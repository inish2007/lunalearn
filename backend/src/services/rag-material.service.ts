import { SupabaseClient } from '@supabase/supabase-js';
import { Database, Material } from '../types/database.js';
import { StorageService } from './storage.service.js';
import { PdfService } from './pdf.service.js';
import { ChunkingService } from './chunking.service.js';
import { EmbeddingService } from './embedding.service.js';
import { RagJobsService } from './rag-jobs.service.js';
import { AppError } from '../types/errors.js';
import {
  RagUploadResponseData,
  ChunkPreview,
  ChunkingOptions
} from '../types/rag.js';

export interface ProcessPdfUploadParams {
  db: SupabaseClient<Database>;
  profileId: string;
  subjectId: string;
  unitId?: string | null;
  fileName: string;
  fileBuffer: Buffer;
  customName?: string;
  chunkOptions?: ChunkingOptions;
  jobId?: string;
}

function table(db: any, tableName: string) {
  return db.from(tableName);
}

export class RagMaterialService {
  /**
   * Complete Phase 1 & Production RAG Ingestion Pipeline:
   * State progression: UPLOADED -> VALIDATING -> EXTRACTING -> CHUNKING -> EMBEDDING -> INDEXING -> READY/FAILED
   */
  public static async processAndIndexPdf(params: ProcessPdfUploadParams): Promise<RagUploadResponseData & { jobId?: string }> {
    const {
      db,
      profileId,
      subjectId,
      unitId,
      fileName,
      fileBuffer,
      customName,
      chunkOptions,
      jobId
    } = params;

    const activeJobId = jobId || RagJobsService.createJob({ profileId, subjectId, fileName }).id;

    try {
      // 1. VALIDATING
      RagJobsService.updateJob(activeJobId, { status: 'VALIDATING', progressPercent: null });

      // Server-side independent validation of magic bytes (%PDF-) and file size
      if (fileBuffer.length > PdfService.MAX_FILE_SIZE_BYTES) {
        throw AppError.payloadTooLarge(
          `PDF file size (${Math.round(fileBuffer.length / (1024 * 1024))}MB) exceeds maximum limit of 10MB.`
        );
      }
      if (!PdfService.isPdf(fileBuffer)) {
        throw AppError.unsupportedMediaType(
          'Invalid file format. The provided file does not have a valid %PDF- magic header signature.'
        );
      }

      // Validate Subject exists and is accessible to user under RLS
      const { data: subject, error: subError } = await table(db, 'subjects')
        .select('id, name, code')
        .eq('id', subjectId)
        .maybeSingle();

      if (subError || !subject) {
        throw AppError.notFound(`Subject with ID "${subjectId}" was not found or is inaccessible.`);
      }

      // Validate Unit (if supplied) exists for this subject
      if (unitId) {
        const { data: unit, error: unitError } = await table(db, 'units')
          .select('id, title, subject_id')
          .eq('id', unitId)
          .eq('subject_id', subjectId)
          .maybeSingle();

        if (unitError || !unit) {
          throw AppError.notFound(`Unit with ID "${unitId}" was not found under subject "${(subject as any).name}".`);
        }
      }

      // Storage upload
      const storageResult = await StorageService.uploadPdf(
        db,
        profileId,
        subjectId,
        fileName,
        fileBuffer
      );

      const materialRecordName = (customName && customName.trim()) || fileName;

      const { data: materialDataRaw, error: insertError } = await table(db, 'materials')
        .insert({
          profile_id: profileId,
          subject_id: subjectId,
          unit_id: unitId ?? null,
          name: materialRecordName,
          storage_path: storageResult.storagePath,
          file_type: 'PDF',
          size_bytes: fileBuffer.length,
          processed: false
        })
        .select('*')
        .single();

      if (insertError || !materialDataRaw) {
        throw AppError.internal(`Failed to save material record: ${insertError?.message || 'Database insert failed'}`);
      }

      const materialData: Material = materialDataRaw as Material;
      const materialId = materialData.id;

      RagJobsService.updateJob(activeJobId, { materialId });

      // 2. EXTRACTING
      RagJobsService.updateJob(activeJobId, { status: 'EXTRACTING', progressPercent: null });
      const extracted = await PdfService.extractText(fileBuffer);

      // 3. CHUNKING
      RagJobsService.updateJob(activeJobId, {
        status: 'CHUNKING',
        progressPercent: null,
        totalPages: extracted.totalPages
      });
      const chunkDrafts = ChunkingService.chunkPdf(
        extracted,
        subjectId,
        unitId ?? null,
        chunkOptions
      );

      // 4. EMBEDDING
      RagJobsService.updateJob(activeJobId, {
        status: 'EMBEDDING',
        progressPercent: null,
        chunksCreated: chunkDrafts.length
      });
      const chunkContents = chunkDrafts.map(d => d.content);
      const embeddings = await EmbeddingService.embedBatch(chunkContents);

      // 5. INDEXING
      RagJobsService.updateJob(activeJobId, { status: 'INDEXING', progressPercent: null });
      const chunkRows = chunkDrafts.map((draft, idx) => ({
        material_id: materialId,
        profile_id: profileId,
        content: draft.content,
        chunk_index: draft.chunk_index,
        page_number: draft.page_number,
        embedding: embeddings[idx] || null,
        metadata: {
          ...draft.metadata,
          material_id: materialId,
          material_name: materialRecordName,
          storage_path: storageResult.storagePath
        }
      }));

      // Batch insert into document_chunks
      if (chunkRows.length > 0) {
        const BATCH_SIZE = 50;
        for (let i = 0; i < chunkRows.length; i += BATCH_SIZE) {
          const batch = chunkRows.slice(i, i + BATCH_SIZE);
          const { error: batchErr } = await table(db, 'document_chunks')
            .insert(batch);

          if (batchErr) {
            RagJobsService.updateJob(activeJobId, {
              status: 'FAILED',
              progressPercent: 0,
              error: batchErr.message
            });
            throw AppError.internal('Failed to persist document chunk batch.', batchErr);
          }
        }
      }

      const { error: readyError } = await table(db, 'materials').update({ processed: true }).eq('id', materialId);
      if (readyError) throw AppError.internal('Could not mark material indexed.', readyError);
      materialData.processed = true;
      // 6. READY
      RagJobsService.updateJob(activeJobId, {
        status: 'READY',
        progressPercent: 100,
        materialId
      });

      const sampleChunks: ChunkPreview[] = chunkDrafts.slice(0, 3).map(c => ({
        chunk_index: c.chunk_index,
        page_number: c.page_number,
        content_preview: c.content.length > 120 ? `${c.content.substring(0, 120)}...` : c.content,
        char_count: c.content.length
      }));

      return {
        material: {
          ...materialData,
          processing_status: 'completed'
        },
        chunks_created: chunkDrafts.length,
        total_pages: extracted.totalPages,
        total_characters: extracted.characterCount,
        sample_chunks: sampleChunks,
        jobId: activeJobId
      };
    } catch (err: unknown) {
      const currentJob = RagJobsService.getJob(activeJobId);
      if (currentJob?.status !== 'FAILED') {
        const errorMessage = err instanceof Error ? err.message : String(err);
        RagJobsService.updateJob(activeJobId, {
          status: 'FAILED',
          progressPercent: 0,
          error: errorMessage
        });
      }
      throw err;
    }
  }
}

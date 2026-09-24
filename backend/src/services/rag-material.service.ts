import { SupabaseClient } from '@supabase/supabase-js';
import { Database, Material } from '../types/database.js';
import { StorageService } from './storage.service.js';
import { PdfService } from './pdf.service.js';
import { ChunkingService } from './chunking.service.js';
import { EmbeddingService } from './embedding.service.js';
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
}

function table(db: any, tableName: string) {
  return db.from(tableName);
}

export class RagMaterialService {
  /**
   * Complete Phase 1 PDF Ingestion Pipeline:
   * 1. Validates subject and unit ownership under RLS.
   * 2. Stores the raw PDF file in Supabase Storage ('materials' bucket).
   * 3. Extracts clean text and page count using PdfService.
   * 4. Splits text into overlapping chunks sized for semantic vector embedding.
   * 5. Inserts the metadata record into the existing 'materials' table.
   * 6. Inserts each chunk into the existing 'document_chunks' table with embedding: null.
   * 7. Returns full metadata, chunk count, and previews.
   */
  public static async processAndIndexPdf(params: ProcessPdfUploadParams): Promise<RagUploadResponseData> {
    const {
      db,
      profileId,
      subjectId,
      unitId,
      fileName,
      fileBuffer,
      customName,
      chunkOptions
    } = params;

    // 1. Validate Subject exists and is accessible to user under RLS
    const { data: subject, error: subError } = await table(db, 'subjects')
      .select('id, name, code')
      .eq('id', subjectId)
      .maybeSingle();

    if (subError || !subject) {
      throw new Error(`Subject with ID "${subjectId}" was not found or is inaccessible.`);
    }

    // 2. Validate Unit (if supplied) exists for this subject
    if (unitId) {
      const { data: unit, error: unitError } = await table(db, 'units')
        .select('id, title, subject_id')
        .eq('id', unitId)
        .eq('subject_id', subjectId)
        .maybeSingle();

      if (unitError || !unit) {
        throw new Error(`Unit with ID "${unitId}" was not found under subject "${(subject as any).name}".`);
      }
    }

    // 3. Upload raw PDF file to Supabase Storage
    const storageResult = await StorageService.uploadPdf(
      db,
      profileId,
      subjectId,
      fileName,
      fileBuffer
    );

    // 4. Extract text from PDF buffer
    const extracted = await PdfService.extractText(fileBuffer);

    // 5. Generate overlapping chunks sized for embedding
    const chunkDrafts = ChunkingService.chunkPdf(
      extracted,
      subjectId,
      unitId ?? null,
      chunkOptions
    );

    // 6. Record metadata in the existing 'materials' table
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
        processed: true
      })
      .select('*')
      .single();

    if (insertError || !materialDataRaw) {
      throw new Error(`Failed to save material record: ${insertError?.message || 'Database insert failed'}`);
    }

    const materialData: Material = materialDataRaw as Material;
    const materialId = materialData.id;

    // 7. Insert each chunk into the existing 'document_chunks' table with Gemini vector embedding
    const chunkContents = chunkDrafts.map(d => d.content);
    const embeddings = await EmbeddingService.embedBatch(chunkContents);

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
          console.warn(`⚠️ Warning: Failed to insert chunk batch into document_chunks: ${batchErr.message}`);
        }
      }
    }

    // 8. Prepare response with sample chunk previews
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
      sample_chunks: sampleChunks
    };
  }
}

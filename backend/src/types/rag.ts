import { z } from 'zod';
import { Material } from './database.js';

// ==============================================================================
// AI/RAG Track Phase 1 — PDF Processing & Chunking Schemas
// ==============================================================================

export const ProcessingStatusEnum = z.enum(['pending', 'processing', 'completed', 'failed']);
export type ProcessingStatus = z.infer<typeof ProcessingStatusEnum>;

/**
 * JSON Request payload schema when uploading a PDF as base64
 */
export const UploadPdfJsonSchema = z.object({
  subject_id: z.string().uuid({ message: 'Valid subject_id UUID is required' }),
  unit_id: z.string().uuid({ message: 'unit_id must be a valid UUID' }).optional().nullable(),
  file_name: z.string().min(1, { message: 'file_name is required' }).max(255),
  file_base64: z.string().min(1, { message: 'file_base64 content is required' }),
  custom_name: z.string().max(255).optional()
});

export type UploadPdfJsonInput = z.infer<typeof UploadPdfJsonSchema>;

/**
 * Parameters for the chunking algorithm
 */
export interface ChunkingOptions {
  chunkSize?: number;      // Target characters per chunk (default: 800)
  chunkOverlap?: number;   // Overlap characters between chunks (default: 160)
  minChunkSize?: number;   // Minimum characters for a chunk (default: 100)
}

/**
 * Single extracted page from a PDF
 */
export interface ExtractedPage {
  pageNumber: number;
  text: string;
}

/**
 * Overall result of extracting text from a PDF
 */
export interface ExtractedPdf {
  fullText: string;
  totalPages: number;
  pages: ExtractedPage[];
  characterCount: number;
}

/**
 * Single chunk draft ready to be inserted into document_chunks
 */
export interface DocumentChunkDraft {
  chunk_index: number;
  page_number: number;
  content: string;
  metadata: {
    subject_id: string;
    unit_id: string | null;
    material_id?: string;
    char_count: number;
    word_count: number;
    chunk_index: number;
    page_number: number;
    [key: string]: unknown;
  };
}

/**
 * Preview summary for API responses
 */
export interface ChunkPreview {
  chunk_index: number;
  page_number: number;
  content_preview: string;
  char_count: number;
}

/**
 * Full response returned by the PDF upload & processing endpoint
 */
export interface RagUploadResponseData {
  material: Material & { processing_status?: ProcessingStatus };
  chunks_created: number;
  total_pages: number;
  total_characters: number;
  sample_chunks: ChunkPreview[];
}

// ==============================================================================
// AI/RAG Track Phase 2 — Semantic Search & Vector Retrieval Schemas
// ==============================================================================

export const SemanticSearchSchema = z.object({
  query: z.string().min(1, { message: 'Search query cannot be empty' }).max(2000),
  subject_id: z.preprocess(
    val => (val === '' ? null : val),
    z.string().uuid({ message: 'subject_id must be a valid UUID' }).optional().nullable()
  ),
  material_id: z.preprocess(
    val => (val === '' ? null : val),
    z.string().uuid({ message: 'material_id must be a valid UUID' }).optional().nullable()
  ),
  top_k: z.coerce.number().int().min(1).max(50).default(5),
  threshold: z.coerce.number().min(0).max(1).default(0.3)
});

export type SemanticSearchInput = z.infer<typeof SemanticSearchSchema>;


export interface SearchResultChunk {
  chunk_id: string;
  material_id: string;
  content: string;
  similarity: number;
  page_number: number | null;
  chunk_index: number;
  material: {
    id: string;
    name: string;
    storage_path: string;
    file_type?: string;
  };
  metadata: Record<string, unknown>;
}

export interface SemanticSearchResponseData {
  query: string;
  matches_count: number;
  results: SearchResultChunk[];
}

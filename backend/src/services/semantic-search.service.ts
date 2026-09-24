import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types/database.js';
import { EmbeddingService } from './embedding.service.js';
import {
  SemanticSearchResponseData,
  SearchResultChunk
} from '../types/rag.js';

export interface SemanticSearchParams {
  db: SupabaseClient<Database>;
  profileId: string;
  query: string;
  subjectId?: string | null;
  materialId?: string | null;
  topK?: number;
  threshold?: number;
}

function table(db: any, tableName: string) {
  return db.from(tableName);
}

interface MaterialMeta {
  id: string;
  name: string;
  storage_path: string;
  file_type?: string;
  subject_id?: string;
}

export class SemanticSearchService {
  public static readonly DEFAULT_TOP_K = 5;
  public static readonly DEFAULT_THRESHOLD = 0.3;

  /**
   * Performs semantic similarity search across ingested document chunks:
   * 1. Embeds the natural language query using the Gemini embedding model.
   * 2. Scopes search to the authenticated student under RLS.
   * 3. Filters by subject_id and/or material_id when provided.
   * 4. Calculates vector similarity (Postgres pgvector or cosine similarity fallback).
   * 5. Enriches results with source material metadata and similarity scores.
   */
  public static async search(params: SemanticSearchParams): Promise<SemanticSearchResponseData> {
    const {
      db,
      profileId,
      query,
      subjectId,
      materialId,
      topK = this.DEFAULT_TOP_K,
      threshold = this.DEFAULT_THRESHOLD
    } = params;

    const cleanQuery = query.trim();
    if (!cleanQuery) {
      return { query: '', matches_count: 0, results: [] };
    }

    // 1. Generate query vector embedding with Gemini API (1536-dim)
    const queryEmbedding = await EmbeddingService.embedText(cleanQuery);

    // 2. Attempt PostgreSQL RPC match_document_chunks if available
    try {
      const { data: rpcMatches, error: rpcErr } = await (db as any).rpc('match_document_chunks', {
        query_embedding: queryEmbedding,
        match_count: topK,
        filter_profile_id: profileId,
        filter_subject_id: subjectId || null,
        filter_material_id: materialId || null,
        similarity_threshold: threshold
      });

      if (!rpcErr && Array.isArray(rpcMatches) && rpcMatches.length > 0) {
        // Fetch material metadata for matched chunks
        const materialIds = Array.from(new Set(rpcMatches.map((m: any) => m.material_id)));
        const { data: materials } = await table(db, 'materials')
          .select('id, name, storage_path, file_type')
          .in('id', materialIds);

        const materialMap = new Map<string, MaterialMeta>((materials || []).map((m: any) => [m.id, m]));

        const results: SearchResultChunk[] = rpcMatches.map((row: any) => {
          const mat = materialMap.get(row.material_id);
          return {
            chunk_id: row.id,
            material_id: row.material_id,
            content: row.content,
            similarity: Number(Number(row.similarity).toFixed(4)),
            page_number: row.page_number ?? null,
            chunk_index: row.chunk_index ?? 0,
            material: {
              id: row.material_id,
              name: mat?.name || (row.metadata?.material_name as string) || 'Document',
              storage_path: mat?.storage_path || (row.metadata?.storage_path as string) || '',
              file_type: mat?.file_type || 'PDF'
            },
            metadata: row.metadata || {}
          };
        });

        return {
          query: cleanQuery,
          matches_count: results.length,
          results
        };
      }
    } catch {
      // Continue to fallback implementation
    }


    // 3. Robust Fallback: Scoped table query + Vector Cosine Similarity
    return this.searchWithClientFallback({
      db,
      profileId,
      cleanQuery,
      queryEmbedding,
      subjectId,
      materialId,
      topK,
      threshold
    });
  }

  /**
   * Client-side fallback for environments without Postgres RPC function.
   * Retrieves user-scoped chunks, calculates cosine similarity with query embedding,
   * filters by threshold, and returns the top K ranked matches.
   */
  private static async searchWithClientFallback(opts: {
    db: any;
    profileId: string;
    cleanQuery: string;
    queryEmbedding: number[];
    subjectId?: string | null;
    materialId?: string | null;
    topK: number;
    threshold: number;
  }): Promise<SemanticSearchResponseData> {
    const { db, profileId, cleanQuery, queryEmbedding, subjectId, materialId, topK, threshold } = opts;

    // A. Query materials for this student to resolve subject filtering
    let materialQuery = table(db, 'materials').select('id, name, storage_path, file_type, subject_id');
    if (materialId) {
      materialQuery = materialQuery.eq('id', materialId);
    }
    if (subjectId) {
      materialQuery = materialQuery.eq('subject_id', subjectId);
    }

    const { data: materials } = await materialQuery;
    const materialList: any[] = materials || [];
    const allowedMaterialIds = materialList.map(m => m.id);

    if (materialId || subjectId) {
      if (allowedMaterialIds.length === 0) {
        return { query: cleanQuery, matches_count: 0, results: [] };
      }
    }

    // B. Fetch chunks scoped to profile_id
    let chunkQuery = table(db, 'document_chunks')
      .select('id, material_id, profile_id, content, chunk_index, page_number, embedding, metadata')
      .eq('profile_id', profileId);

    if (allowedMaterialIds.length > 0) {
      chunkQuery = chunkQuery.in('material_id', allowedMaterialIds);
    }

    const { data: chunks, error: chunkErr } = await chunkQuery;
    if (chunkErr || !chunks || chunks.length === 0) {
      return { query: cleanQuery, matches_count: 0, results: [] };
    }

    const materialMap = new Map<string, MaterialMeta>(materialList.map(m => [m.id, m]));

    // C. Calculate cosine similarity for each chunk
    const scoredChunks: SearchResultChunk[] = [];

    for (const chunk of chunks as any[]) {
      let chunkVec: number[] | null = null;
      const rawVector = chunk.embedding ?? chunk.vector;

      if (Array.isArray(rawVector)) {
        chunkVec = rawVector;
      } else if (typeof rawVector === 'string') {
        try {
          chunkVec = JSON.parse(rawVector);
        } catch {
          chunkVec = null;
        }
      }

      // If chunk has no stored embedding, generate deterministic vector from content
      if (!chunkVec || chunkVec.length === 0) {
        chunkVec = EmbeddingService.generateDeterministicVector(chunk.content);
      }

      const similarity = EmbeddingService.cosineSimilarity(queryEmbedding, chunkVec);

      if (similarity >= threshold) {
        const mat = materialMap.get(chunk.material_id);
        scoredChunks.push({
          chunk_id: chunk.id,
          material_id: chunk.material_id,
          content: chunk.content,
          similarity: Number(similarity.toFixed(4)),
          page_number: chunk.page_number ?? null,
          chunk_index: chunk.chunk_index ?? 0,
          material: {
            id: chunk.material_id,
            name: mat?.name || (chunk.metadata?.material_name as string) || 'Study Material',
            storage_path: mat?.storage_path || (chunk.metadata?.storage_path as string) || '',
            file_type: mat?.file_type || 'PDF'
          },
          metadata: chunk.metadata || {}
        });
      }
    }


    // D. Sort by similarity score descending and take topK
    scoredChunks.sort((a, b) => b.similarity - a.similarity);
    const topResults = scoredChunks.slice(0, topK);

    return {
      query: cleanQuery,
      matches_count: topResults.length,
      results: topResults
    };
  }
}

-- ==============================================================================
-- LunaLearn — AI/RAG Track Phase 2 Migration
-- PostgreSQL pgvector Similarity Search Function (match_document_chunks)
-- ==============================================================================

-- Ensure vector extension is enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Vector similarity search matching document chunks using cosine distance
CREATE OR REPLACE FUNCTION match_document_chunks (
  query_embedding vector(1536),
  match_count int DEFAULT 5,
  filter_profile_id uuid DEFAULT NULL,
  filter_subject_id uuid DEFAULT NULL,
  filter_material_id uuid DEFAULT NULL,
  similarity_threshold float DEFAULT 0.0
)
RETURNS TABLE (
  id uuid,
  material_id uuid,
  profile_id uuid,
  content text,
  chunk_index int,
  page_number int,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.material_id,
    dc.profile_id,
    dc.content,
    dc.chunk_index,
    dc.page_number,
    dc.metadata,
    (1 - (dc.embedding <=> query_embedding))::float AS similarity
  FROM document_chunks dc
  JOIN materials m ON m.id = dc.material_id
  WHERE (filter_profile_id IS NULL OR dc.profile_id = filter_profile_id)
    AND (filter_subject_id IS NULL OR m.subject_id = filter_subject_id)
    AND (filter_material_id IS NULL OR dc.material_id = filter_material_id)
    AND dc.embedding IS NOT NULL
    AND (1 - (dc.embedding <=> query_embedding)) >= similarity_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

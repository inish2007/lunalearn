-- ==============================================================================
-- LunaLearn — AI/RAG Track Phase 1 Migration
-- Materials Processing Status & Document Chunk Vector Search Indexing
-- ==============================================================================

-- 1. Ensure processing_status column exists on materials
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'materials' 
        AND column_name = 'processing_status'
    ) THEN
        ALTER TABLE materials 
        ADD COLUMN processing_status TEXT NOT NULL DEFAULT 'completed' 
        CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed'));
    END IF;
END $$;

-- 2. Ensure storage bucket for student materials exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('materials', 'materials', false)
ON CONFLICT (id) DO NOTHING;

-- 3. Row-Level Security on Storage objects (scoped to owning student)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Authenticated students can manage their own materials storage'
    ) THEN
        CREATE POLICY "Authenticated students can manage their own materials storage"
        ON storage.objects FOR ALL
        TO authenticated
        USING (bucket_id = 'materials' AND auth.uid()::text = (storage.foldername(name))[1])
        WITH CHECK (bucket_id = 'materials' AND auth.uid()::text = (storage.foldername(name))[1]);
    END IF;
END $$;

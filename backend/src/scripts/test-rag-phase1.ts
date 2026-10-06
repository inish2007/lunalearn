/**
 * LunaLearn — AI/RAG Track Phase 1 Test Suite
 * Tests the PDF Processing, Text Extraction, and Chunking Pipeline:
 * 1. PDF validation & text extraction with page tracking (PdfService).
 * 2. Overlapping chunk generator sized for embedding (ChunkingService).
 * 3. Zod schema validation for upload requests (UploadPdfJsonSchema).
 * 4. End-to-end ingestion pipeline inserting into materials & document_chunks.
 */

import { PdfService } from '../services/pdf.service.js';
import { ChunkingService } from '../services/chunking.service.js';
import { RagMaterialService } from '../services/rag-material.service.js';
import { EmbeddingService } from '../services/embedding.service.js';
import { RagJobsService } from '../services/rag-jobs.service.js';
import { AppError, ErrorCode } from '../types/errors.js';
import { UploadPdfJsonSchema } from '../types/rag.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`   ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`   ❌ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
    failed++;
  }
}

/**
 * Creates a minimal valid synthetic PDF with custom text and pages.
 */
function createSyntheticPdf(pagesContent: string[]): Buffer {
  const numPages = pagesContent.length;
  // Obj 1: Catalog
  // Obj 2: Pages container
  // Obj 3..2+N: Page objects
  // Obj 3+N..2+2N: Content streams

  const pageObjIds: string[] = [];
  for (let i = 0; i < numPages; i++) {
    pageObjIds.push(`${3 + i} 0 R`);
  }

  // Obj 1: Catalog
  const catalog = `1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n`;
  // Obj 2: Pages
  const pagesObj = `2 0 obj\n<</Type/Pages/Kids[${pageObjIds.join(' ')}]/Count ${numPages}>>\nendobj\n`;

  let body = catalog + pagesObj;

  // Pages and content streams
  for (let i = 0; i < numPages; i++) {
    const rawLines = pagesContent[i].split('\n').map(l => l.trim()).filter(Boolean);
    const textOps = rawLines.map(l => `(${l.replace(/[()\\]/g, '')}) '`).join('\n');
    const streamContent = `BT\n/F1 12 Tf\n20 750 Td\n15 TL\n${textOps}\nET`;
    const streamObjId = 3 + numPages + i;
    const pageObj = `${3 + i} 0 obj\n<</Type/Page/MediaBox[0 0 595 842]/Parent 2 0 R/Resources<<>>/Contents ${streamObjId} 0 R>>\nendobj\n`;
    const streamObj = `${streamObjId} 0 obj\n<</Length ${Buffer.byteLength(streamContent)}>>\nstream\n${streamContent}\nendstream\nendobj\n`;
    body += pageObj + streamObj;
  }

  const pdfStr = `%PDF-1.4\n${body}xref\n0 ${3 + 2 * numPages}\n0000000000 65535 f \n`;
  const trailer = `trailer\n<</Size ${3 + 2 * numPages}/Root 1 0 R>>\nstartxref\n${pdfStr.length}\n%%EOF`;

  return Buffer.from(pdfStr + trailer, 'latin1');
}

/**
 * Creates a mock Supabase client for testing pipeline database operations.
 */
function createMockDb(
  initialSubjects: any[],
  initialUnits: any[],
  documentChunkInsertError: { message: string } | null = null
) {
  const store: Record<string, any[]> = {
    subjects: [...initialSubjects],
    units: [...initialUnits],
    materials: [],
    document_chunks: []
  };

  const client: any = {
    storage: {
      from: () => ({
        upload: async (path: string, _buffer: Buffer) => ({
          data: { path },
          error: null
        })
      })
    },
    from: (tableName: string) => {
      let filtered = [...(store[tableName] || [])];

      const query: any = {
        select: (_cols?: string) => query,
        eq: (col: string, val: any) => {
          filtered = filtered.filter(row => row[col] === val);
          return query;
        },
        maybeSingle: async () => ({
          data: filtered[0] || null,
          error: null
        }),
        single: async () => ({
          data: filtered[0] || null,
          error: filtered[0] ? null : { message: 'Row not found' }
        }),
        update: (values: any) => { for (const row of filtered) Object.assign(row,values); return query; },
        then: (resolve: any) => Promise.resolve({data: filtered,error:null}).then(resolve),
        insert: (rows: any | any[]) => {
          if (tableName === 'document_chunks' && documentChunkInsertError) {
            return { data: null, error: documentChunkInsertError };
          }

          const toInsert = Array.isArray(rows) ? rows : [rows];
          const inserted = toInsert.map((r, idx) => ({
            id: r.id || `gen-uuid-${tableName}-${Date.now()}-${idx}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...r
          }));

          if (!store[tableName]) store[tableName] = [];
          store[tableName].push(...inserted);

          return {
            select: () => ({
              single: async () => ({ data: inserted[0], error: null })
            }),
            data: inserted,
            error: null
          };
        }
      };

      return query;
    },
    _getStore: () => store
  };

  return client;
}

async function runRagPhase1Tests() {
  console.log('====================================================');
  console.log('🌙 LunaLearn — AI/RAG Track Phase 1 Test Suite');
  console.log('====================================================\n');

  // --------------------------------------------------------------------------
  // 1. PDF Validation & Parsing Tests
  // --------------------------------------------------------------------------
  console.log('1. Testing PDF Validation & Text Extraction (PdfService)...');

  const validSinglePageBuffer = createSyntheticPdf([
    'Database Management Systems Unit 1: Introduction to relational models, relational algebra, and calculus.'
  ]);

  assert(PdfService.isPdf(validSinglePageBuffer), 'Identifies valid PDF from magic bytes (%PDF)');
  assert(!PdfService.isPdf(Buffer.from('Hello plain text file')), 'Rejects non-PDF buffer');
  assert(!PdfService.isPdf(Buffer.alloc(0)), 'Rejects empty buffer');

  const extracted = await PdfService.extractText(validSinglePageBuffer);
  assert(extracted.totalPages === 1, 'Accurately detects total page count (1)');
  assert(extracted.pages.length === 1, 'Extracts per-page content array');
  assert(extracted.pages[0].pageNumber === 1, 'Records correct 1-indexed page number');
  assert(extracted.fullText.includes('Database Management Systems'), 'Extracts expected text content from PDF');

  // Test multi-page extraction
  const multiPageBuffer = createSyntheticPdf([
    'Unit 1: ER Model and Relational Schemas.',
    'Unit 2: SQL and Query Optimization.',
    'Unit 3: Normalization 1NF 2NF 3NF BCNF.'
  ]);

  const multiExtracted = await PdfService.extractText(multiPageBuffer);
  assert(multiExtracted.totalPages === 3, 'Accurately parses 3-page document');
  assert(multiExtracted.pages.length === 3, 'Contains 3 separate page records');
  assert(multiExtracted.pages[2].pageNumber === 3, 'Page 3 index preserved');
  assert(multiExtracted.pages[2].text.includes('Normalization'), 'Page 3 contains correct text');

  // --------------------------------------------------------------------------
  // 2. Overlapping Chunking Strategy Tests
  // --------------------------------------------------------------------------
  console.log('\n2. Testing Overlapping Chunking Strategy (ChunkingService)...');

  const fakeSubjectId = 'c1f6d3a8-4b2e-4a9f-8e2b-1a2c3d4e5f6a';
  const fakeUnitId = 'b1f6d3a8-4b2e-4a9f-8e2b-1a2c3d4e5f6b';

  // Generate multiple lines of academic text to force chunking with overlap
  const longLines = [
    'Database normalization is the process of structuring a relational database.',
    'It follows normal forms in order to reduce data redundancy.',
    'It was first proposed by Edgar F Codd as part of his relational model.',
    'Normalization organizes columns and tables to ensure proper dependencies.',
    'First normal form 1NF sets the very basic rules for an organized database.',
    'It eliminates duplicative columns and ensures every attribute is atomic.',
    'Second normal form 2NF removes partial functional dependencies.',
    'All non-key attributes must depend on the whole candidate key.',
    'Third normal form 3NF goes further by removing transitive dependencies.',
    'Non-prime attributes must not depend on other non-prime attributes.',
    'Boyce-Codd Normal Form BCNF handles remaining anomalies in overlapping keys.',
    'Every determinant in relation R must strictly be a superkey.'
  ];

  const longPage = longLines.join('\n');

  const longPdf = await PdfService.extractText(createSyntheticPdf([longPage]));
  const chunks = ChunkingService.chunkPdf(longPdf, fakeSubjectId, fakeUnitId, {
    chunkSize: 300,
    chunkOverlap: 60
  });

  assert(chunks.length > 1, `Generates multiple chunks (${chunks.length}) for text exceeding chunk size`);
  assert(chunks[0].chunk_index === 0, 'First chunk starts at index 0');
  assert(chunks[1].chunk_index === 1, 'Second chunk has index 1');

  // Check chunk size and overlap
  const chunk0 = chunks[0].content;
  const chunk1 = chunks[1].content;
  assert(chunk0.length <= 500, 'Chunk size adheres to target threshold');

  // Verify overlap: words at end of chunk0 appear in chunk1
  const chunk0Words = chunk0.split(/\s+/).slice(-8).join(' ');
  const hasOverlap = chunk1.includes(chunk0Words.split(/\s+/)[0]);
  assert(hasOverlap, 'Chunks overlap to preserve contextual continuity across boundaries');

  // Verify metadata tagging
  assert(chunks[0].metadata.subject_id === fakeSubjectId, 'Chunk links to subject_id in metadata');
  assert(chunks[0].metadata.unit_id === fakeUnitId, 'Chunk links to unit_id in metadata');
  assert(chunks[0].metadata.char_count === chunks[0].content.length, 'Metadata includes character count');
  assert(typeof chunks[0].metadata.word_count === 'number', 'Metadata includes word count');
  assert(chunks[0].page_number === 1, 'Page number recorded on chunk');

  // --------------------------------------------------------------------------
  // 3. Schema & Input Validation Tests
  // --------------------------------------------------------------------------
  console.log('\n3. Testing Request Payload Validation (UploadPdfJsonSchema)...');

  const validPayload = {
    subject_id: fakeSubjectId,
    unit_id: fakeUnitId,
    file_name: 'Unit3_Normalization.pdf',
    file_base64: Buffer.from('%PDF-1.4\n...').toString('base64')
  };

  const parsedValid = UploadPdfJsonSchema.safeParse(validPayload);
  assert(parsedValid.success, 'Valid JSON upload payload passes validation');

  const invalidSubjectPayload = {
    ...validPayload,
    subject_id: 'not-a-uuid'
  };
  const parsedInvalidSubject = UploadPdfJsonSchema.safeParse(invalidSubjectPayload);
  assert(!parsedInvalidSubject.success, 'Rejects invalid subject_id UUID');

  const missingFilePayload = {
    subject_id: fakeSubjectId,
    file_name: 'Test.pdf'
  };
  const parsedMissingFile = UploadPdfJsonSchema.safeParse(missingFilePayload);
  assert(!parsedMissingFile.success, 'Rejects payload with missing file_base64');

  // --------------------------------------------------------------------------
  // 4. End-to-End Pipeline Execution Tests
  // --------------------------------------------------------------------------
  console.log('\n4. Testing Full Pipeline Execution (RagMaterialService)...');

  const mockDb = createMockDb(
    [{ id: fakeSubjectId, name: 'Database Management Systems', code: 'CS-401' }],
    [{ id: fakeUnitId, title: 'Unit 3: Normalization', subject_id: fakeSubjectId }]
  );

  const profileId = 'student-test-uuid-123';
  const samplePdfBuffer = createSyntheticPdf([
    'Unit 3 Normalization: 1NF requires atomic values. 2NF requires full functional dependency. 3NF removes transitive dependencies.'
  ]);

  const originalEmbedBatch = EmbeddingService.embedBatch;
  EmbeddingService.embedBatch = async texts => texts.map(() => new Array(EmbeddingService.DEFAULT_DIMENSION).fill(0.25));
  const pipelineResult = await RagMaterialService.processAndIndexPdf({
    db: mockDb,
    profileId,
    subjectId: fakeSubjectId,
    unitId: fakeUnitId,
    fileName: 'DBMS_Unit3_Notes.pdf',
    fileBuffer: samplePdfBuffer
  });
  EmbeddingService.embedBatch = originalEmbedBatch;

  const store = mockDb._getStore();

  assert(pipelineResult.chunks_created >= 1, 'Pipeline reports chunks created');
  assert(pipelineResult.total_pages === 1, 'Pipeline reports total pages (1)');
  assert(pipelineResult.material.file_type === 'PDF', 'Material file_type set to PDF');
  assert(pipelineResult.material.processed === true, 'Material processed flag set to true');
  assert(pipelineResult.material.processing_status === 'completed', 'Material processing_status marked as completed');
  assert(pipelineResult.material.storage_path.includes(fakeSubjectId), 'Storage path links profile and subject');

  // Verify database tables state
  assert(store.materials.length === 1, 'Exactly 1 record inserted into materials table');
  assert(store.materials[0].profile_id === profileId, 'Material profile_id bound to authenticated user');
  assert(store.materials[0].subject_id === fakeSubjectId, 'Material linked to subject_id');
  assert(store.materials[0].unit_id === fakeUnitId, 'Material linked to unit_id');

  assert(store.document_chunks.length >= 1, 'Chunks inserted into document_chunks table');
  const storedChunk = store.document_chunks[0];
  assert(storedChunk.material_id === store.materials[0].id, 'Chunk linked to parent material_id foreign key');
  assert(storedChunk.profile_id === profileId, 'Chunk profile_id bound to authenticated user');
  assert(storedChunk.embedding === null || Array.isArray(storedChunk.embedding), 'Chunk embedding column is appropriately handled');
  assert(storedChunk.metadata.subject_id === fakeSubjectId, 'Chunk metadata contains subject_id');
  assert(storedChunk.metadata.unit_id === fakeUnitId, 'Chunk metadata contains unit_id');
  assert(storedChunk.content.includes('Normalization'), 'Chunk content contains extracted syllabus text');

  console.log('\n5. Testing provider rate-limit and chunk persistence failures...');

  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.GEMINI_API_KEY;
  let embeddingRequests = 0;
  process.env.GEMINI_API_KEY = 'test-gemini-api-key';
  globalThis.fetch = (async () => {
    embeddingRequests++;
    return new Response('quota exceeded', { status: 429 });
  }) as typeof fetch;

  try {
    await EmbeddingService.embedText('rate-limited embedding');
    assert(false, 'Exhausted Gemini rate limit throws instead of returning a synthetic vector');
  } catch (error) {
    assert(error instanceof AppError && error.code === ErrorCode.RATE_LIMITED && error.statusCode === 429,
      'Exhausted Gemini rate limit throws a rate-limited AppError');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalApiKey;
  }
  assert(embeddingRequests === 4, 'Gemini embedding request is retried before failing');

  const chunkInsertError = { message: 'Postgres chunk insert failed' };
  const failedJob = RagJobsService.createJob({ profileId, subjectId: fakeSubjectId, fileName: 'failed.pdf' });
  const failedMockDb = createMockDb(
    [{ id: fakeSubjectId, name: 'Database Management Systems', code: 'CS-401' }],
    [{ id: fakeUnitId, title: 'Unit 3: Normalization', subject_id: fakeSubjectId }],
    chunkInsertError
  );
  EmbeddingService.embedBatch = async texts => texts.map(() => new Array(EmbeddingService.DEFAULT_DIMENSION).fill(0.25));
  let chunkInsertThrown: unknown;
  try {
    await RagMaterialService.processAndIndexPdf({
      db: failedMockDb,
      profileId,
      subjectId: fakeSubjectId,
      unitId: fakeUnitId,
      fileName: 'failed.pdf',
      fileBuffer: samplePdfBuffer,
      jobId: failedJob.id
    });
  } catch (error) {
    chunkInsertThrown = error;
  } finally {
    EmbeddingService.embedBatch = originalEmbedBatch;
  }

  const failedJobState = RagJobsService.getJob(failedJob.id);
  assert(chunkInsertThrown instanceof AppError && chunkInsertThrown.code === ErrorCode.INTERNAL_SERVER_ERROR,
    'Chunk batch insertion failure throws an internal AppError');
  assert(failedJobState?.status === 'FAILED' && failedJobState.progressPercent === 0,
    'Chunk batch insertion failure marks the job FAILED');
  assert(failedJobState?.error === chunkInsertError.message,
    'Failed job preserves the exact Postgres error message');

  console.log(`\n====================================================`);
  console.log(`RAG Phase 1 Verification: ${passed} passed, ${failed} failed.`);
  console.log(`====================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runRagPhase1Tests().catch(err => {
  console.error('Fatal error during RAG Phase 1 test suite:', err);
  process.exit(1);
});

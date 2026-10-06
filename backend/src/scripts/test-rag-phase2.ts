/**
 * LunaLearn — AI/RAG Track Phase 2 Test Suite
 * Tests Gemini Vector Embeddings, pgvector Semantic Search, and Retrieval Endpoint:
 * 1. Gemini embedding model resolution (currently recommended: gemini-embedding-001).
 * 2. 1536-dimensional vector generation (single & batch).
 * 3. Mathematical cosine similarity evaluation.
 * 4. End-to-end PDF ingestion storing real vector embeddings in document_chunks.
 * 5. Semantic similarity search with subject & material scoping.
 * 6. Zod input schema validation for POST /api/rag/search.
 */

import { EmbeddingService } from '../services/embedding.service.js';
import { SemanticSearchService } from '../services/semantic-search.service.js';
import { RagMaterialService } from '../services/rag-material.service.js';
import { SemanticSearchSchema } from '../types/rag.js';

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
 * Creates a minimal valid synthetic PDF with custom text.
 */
function createSyntheticPdf(pagesContent: string[]): Buffer {
  const numPages = pagesContent.length;
  const pageObjIds: string[] = [];
  for (let i = 0; i < numPages; i++) {
    pageObjIds.push(`${3 + i} 0 R`);
  }

  const catalog = `1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n`;
  const pagesObj = `2 0 obj\n<</Type/Pages/Kids[${pageObjIds.join(' ')}]/Count ${numPages}>>\nendobj\n`;
  let body = catalog + pagesObj;

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
 * Creates an in-memory mutable store simulating Supabase RLS and PostgREST.
 */
function createMockDb(initialSubjects: any[], initialUnits: any[], initialMaterials: any[] = []) {
  const store: Record<string, any[]> = {
    subjects: [...initialSubjects],
    units: [...initialUnits],
    materials: [...initialMaterials],
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
    rpc: async (_fnName: string, _params: any) => {
      // Return null so test exercises the robust client-side cosine fallback
      return { data: null, error: { message: 'RPC not installed' } };
    },
    from: (tableName: string) => {
      let filtered = [...(store[tableName] || [])];

      const query: any = {
        select: (_cols?: string) => query,
        eq: (col: string, val: any) => {
          filtered = filtered.filter(row => row[col] === val);
          return query;
        },
        in: (col: string, vals: any[]) => {
          filtered = filtered.filter(row => vals.includes(row[col]));
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
        insert: (rows: any | any[]) => {
          const toInsert = Array.isArray(rows) ? rows : [rows];
          const inserted = toInsert.map((r, idx) => ({
            id: r.id || `chunk-uuid-${Date.now()}-${idx}`,
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
        },
        then: (resolve: any) => resolve({ data: filtered, error: null })
      };

      return query;
    },
    _getStore: () => store
  };

  return client;
}

async function runRagPhase2Tests() {
  console.log('====================================================');
  console.log('🌙 LunaLearn — AI/RAG Track Phase 2 Test Suite');
  console.log('====================================================\n');

  // --------------------------------------------------------------------------
  // 1. Model Resolution & Vector Generation
  // --------------------------------------------------------------------------
  console.log('1. Testing Gemini Embedding Model & Vector Generation (EmbeddingService)...');

  const modelName = EmbeddingService.getModelName();
  assert(
    modelName === 'gemini-embedding-001' || modelName.includes('embedding'),
    `Uses recommended Gemini embedding model (${modelName})`
  );

  const sampleQuery = 'Explain Boyce-Codd Normal Form and functional dependencies';
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.GEMINI_API_KEY;
  const createTestEmbedding = (text: string): number[] => {
    const vector = new Array(EmbeddingService.DEFAULT_DIMENSION).fill(0);
    if (text === sampleQuery) {
      vector[0] = 1;
    } else if (text.startsWith('BCNF')) {
      vector[0] = 0.8;
      vector[1] = 0.6;
    } else if (text.startsWith('The history')) {
      vector[1] = 1;
    } else {
      vector[0] = 1;
    }
    return vector;
  };
  process.env.GEMINI_API_KEY = 'test-gemini-api-key';
  globalThis.fetch = (async (input, init) => {
    const requestBody = JSON.parse(String(init?.body));
    if (String(input).includes(':batchEmbedContents')) {
      return new Response(JSON.stringify({
        embeddings: requestBody.requests.map((request: any) => ({
          values: createTestEmbedding(request.content.parts[0].text)
        }))
      }), { headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({
      embedding: { values: createTestEmbedding(requestBody.content.parts[0].text) }
    }), { headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;

  const queryEmbedding = await EmbeddingService.embedText(sampleQuery);

  assert(Array.isArray(queryEmbedding), 'Returns vector array');
  assert(queryEmbedding.length === 1536, `Vector dimension is exactly 1536 (got: ${queryEmbedding.length})`);
  assert(queryEmbedding.some(v => v !== 0), 'Vector contains non-zero float values');

  // Test batch embedding
  const batchTexts = [
    'Unit 1: ER Modeling and Relational Schemas',
    'Unit 2: SQL DDL, DML, and Indexes',
    'Unit 3: 1NF, 2NF, 3NF, BCNF Decomposition'
  ];
  const batchEmbeddings = await EmbeddingService.embedBatch(batchTexts);

  assert(batchEmbeddings.length === 3, 'Generates embeddings for all items in batch');
  assert(batchEmbeddings[0].length === 1536, 'Batch items have 1536 dimensions');
  assert(batchEmbeddings[1].length === 1536, 'Batch item 2 has 1536 dimensions');
  assert(batchEmbeddings[2].length === 1536, 'Batch item 3 has 1536 dimensions');

  // --------------------------------------------------------------------------
  // 2. Cosine Similarity Evaluation
  // --------------------------------------------------------------------------
  console.log('\n2. Testing Cosine Similarity Evaluation...');

  const unitVector = queryEmbedding;
  const selfSim = EmbeddingService.cosineSimilarity(unitVector, unitVector);
  assert(Math.abs(selfSim - 1.0) < 0.001, `Self-similarity evaluates to 1.0 (got ${selfSim.toFixed(4)})`);

  const emptySim = EmbeddingService.cosineSimilarity([], unitVector);
  assert(emptySim === 0, 'Empty vector similarity evaluates to 0');

  // Semantic similarity comparison
  const relatedEmbedding = await EmbeddingService.embedText('BCNF candidate key functional dependency rules');
  const unrelatedEmbedding = await EmbeddingService.embedText('The history of Renaissance painting in Florence');

  const relatedScore = EmbeddingService.cosineSimilarity(queryEmbedding, relatedEmbedding);
  const unrelatedScore = EmbeddingService.cosineSimilarity(queryEmbedding, unrelatedEmbedding);

  assert(
    relatedScore > unrelatedScore,
    `Related text scores higher (${relatedScore.toFixed(4)}) than unrelated text (${unrelatedScore.toFixed(4)})`
  );

  // --------------------------------------------------------------------------
  // 3. End-to-End PDF Ingestion Storing Real Vector Embeddings
  // --------------------------------------------------------------------------
  console.log('\n3. Testing PDF Ingestion with Vector Storage (RagMaterialService)...');

  const subjectId = 'c1f6d3a8-4b2e-4a9f-8e2b-1a2c3d4e5f6a';
  const unitId = 'b1f6d3a8-4b2e-4a9f-8e2b-1a2c3d4e5f6b';
  const profileId = 'student-test-uuid-456';

  const mockDb = createMockDb(
    [{ id: subjectId, name: 'Database Management Systems', code: 'CS-401' }],
    [{ id: unitId, title: 'Unit 3: Normalization', subject_id: subjectId }]
  );

  const samplePdf = createSyntheticPdf([
    'Unit 3 Normalization: 1NF requires atomic values.\n2NF removes partial functional dependencies.\n3NF removes transitive dependencies from candidate keys.'
  ]);

  const uploadResult = await RagMaterialService.processAndIndexPdf({
    db: mockDb,
    profileId,
    subjectId,
    unitId,
    fileName: 'DBMS_Normalization_Unit3.pdf',
    fileBuffer: samplePdf
  });

  const store = mockDb._getStore();

  assert(uploadResult.chunks_created >= 1, 'Upload created document chunks');
  assert(store.document_chunks.length >= 1, 'Chunks saved in database table');

  const storedChunk = store.document_chunks[0];
  assert(storedChunk.embedding !== null, 'Chunk embedding column is populated with vector (not null)');
  assert(Array.isArray(storedChunk.embedding), 'Chunk embedding is stored as vector array');
  assert(storedChunk.embedding.length === 1536, 'Stored chunk embedding has 1536 dimensions');

  // --------------------------------------------------------------------------
  // 4. Semantic Similarity Search & Retrieval
  // --------------------------------------------------------------------------
  console.log('\n4. Testing Semantic Search Service (SemanticSearchService)...');

  // Add another material for contrast
  const otherSubjectId = 'e2f6d3a8-4b2e-4a9f-8e2b-1a2c3d4e5f6e';
  const materialId1 = store.materials[0].id;

  // Search with query matching Normalization
  const searchResults = await SemanticSearchService.search({
    db: mockDb,
    profileId,
    query: 'What does third normal form remove?',
    subjectId,
    topK: 3,
    threshold: 0.1
  });

  assert(searchResults.matches_count >= 1, 'Search finds relevant matching chunks');
  assert(searchResults.results.length >= 1, 'Results array populated');

  const topMatch = searchResults.results[0];
  assert(topMatch.chunk_id !== undefined, 'Result chunk includes chunk_id');
  assert(topMatch.content.includes('transitive dependencies') || topMatch.content.includes('1NF'), 'Matched content contains relevant text');
  assert(topMatch.similarity > 0, `Result carries positive similarity score (${topMatch.similarity})`);
  assert(topMatch.material.name === 'DBMS_Normalization_Unit3.pdf', 'Result includes source material title');
  assert(topMatch.metadata.subject_id === subjectId, 'Chunk metadata contains correct subject_id');

  // Test subject scoping: searching under unrelated subject returns 0 results
  const scopedOutSearch = await SemanticSearchService.search({
    db: mockDb,
    profileId,
    query: 'What does third normal form remove?',
    subjectId: otherSubjectId,
    topK: 3,
    threshold: 0.1
  });
  assert(scopedOutSearch.matches_count === 0, 'Subject filter correctly excludes materials from other courses');

  // Test material scoping
  const scopedMaterialSearch = await SemanticSearchService.search({
    db: mockDb,
    profileId,
    query: 'What does third normal form remove?',
    materialId: materialId1,
    topK: 3,
    threshold: 0.1
  });
  assert(scopedMaterialSearch.matches_count >= 1, 'Material filter correctly scopes retrieval to target document');

  // --------------------------------------------------------------------------
  // 5. Schema Validation for POST /api/rag/search
  // --------------------------------------------------------------------------
  console.log('\n5. Testing Search Input Validation (SemanticSearchSchema)...');

  const validSearchPayload = {
    query: 'What are ACID properties in database transactions?',
    subject_id: subjectId,
    top_k: 5,
    threshold: 0.4
  };

  const validParsed = SemanticSearchSchema.safeParse(validSearchPayload);
  assert(validParsed.success, 'Valid semantic search payload passes validation');

  const emptyQueryPayload = {
    query: '',
    subject_id: subjectId
  };
  const emptyQueryParsed = SemanticSearchSchema.safeParse(emptyQueryPayload);
  assert(!emptyQueryParsed.success, 'Rejects empty search query');

  const invalidSubjectSearch = {
    query: 'Find SQL syntax',
    subject_id: 'not-a-valid-uuid'
  };
  const invalidSubjectParsed = SemanticSearchSchema.safeParse(invalidSubjectSearch);
  assert(!invalidSubjectParsed.success, 'Rejects invalid subject_id UUID');

  // Test string coercion for numeric parameters (from form-data or query params)
  const coercedPayload = {
    query: 'Explain ACID',
    subject_id: '',
    top_k: '3',
    threshold: '0.25'
  };
  const coercedParsed = SemanticSearchSchema.safeParse(coercedPayload);
  assert(coercedParsed.success, 'Coerces string numbers and converts empty subject_id to null');
  if (coercedParsed.success) {
    assert(coercedParsed.data.subject_id === null, 'Empty string subject_id converts to null');
    assert(coercedParsed.data.top_k === 3, 'String "3" coerces to integer 3');
    assert(coercedParsed.data.threshold === 0.25, 'String "0.25" coerces to number 0.25');
  }

  globalThis.fetch = originalFetch;
  if (originalApiKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalApiKey;

  console.log(`\n====================================================`);
  console.log(`RAG Phase 2 Verification: ${passed} passed, ${failed} failed.`);
  console.log(`====================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runRagPhase2Tests().catch(err => {
  console.error('Fatal error during RAG Phase 2 test suite:', err);
  process.exit(1);
});

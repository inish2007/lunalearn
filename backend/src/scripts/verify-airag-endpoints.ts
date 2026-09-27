import http from 'http';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:4000';
const DB_FILE = path.resolve(process.cwd(), 'scratch/local-db.json');

interface HttpResponse {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: any;
  rawText: string;
}

function requestJson(
  method: string,
  urlPath: string,
  data?: any,
  token?: string
): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const bodyString = data !== undefined ? JSON.stringify(data) : undefined;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (bodyString !== undefined) {
      headers['Content-Length'] = Buffer.byteLength(bodyString).toString();
    }

    const req = http.request(
      url,
      {
        method,
        headers
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk.toString()));
        res.on('end', () => {
          let parsed: any;
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = raw;
          }
          resolve({
            status: res.statusCode || 0,
            headers: res.headers,
            body: parsed,
            rawText: raw
          });
        });
      }
    );

    req.on('error', reject);

    if (bodyString !== undefined) {
      req.write(bodyString);
    }
    req.end();
  });
}

function requestMultipart(
  urlPath: string,
  fields: Record<string, string>,
  fileName: string,
  fileBuffer: Buffer,
  token: string
): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const url = new URL(urlPath, BASE_URL);

    const parts: Buffer[] = [];

    // Fields
    for (const [key, val] of Object.entries(fields)) {
      parts.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${val}\r\n`
        )
      );
    }

    // File
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: application/pdf\r\n\r\n`
      )
    );
    parts.push(fileBuffer);
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

    const fullPayload = Buffer.concat(parts);

    const headers: Record<string, string> = {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': fullPayload.length.toString(),
      Authorization: `Bearer ${token}`
    };

    const req = http.request(
      url,
      {
        method: 'POST',
        headers
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk.toString()));
        res.on('end', () => {
          let parsed: any;
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = raw;
          }
          resolve({
            status: res.statusCode || 0,
            headers: res.headers,
            body: parsed,
            rawText: raw
          });
        });
      }
    );

    req.on('error', reject);
    req.write(fullPayload);
    req.end();
  });
}

/**
 * Creates a minimal valid synthetic PDF with custom text and pages.
 * Valid binary format starting with %PDF- and compliant with standard PDF parsers.
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

function readDb(): any {
  if (!fs.existsSync(DB_FILE)) return {};
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
}

async function run() {
  console.log('🌙 Starting Real HTTP Verification of all AI/RAG Endpoints...\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}${detail ? ` - ${detail}` : ''}`);
      failed++;
    }
  }

  // =========================================================================
  // SETUP: Sign up a user and create subject/unit/topic
  // =========================================================================
  console.log('📌 0. Setting up test student and course structure...');
  const email = `student_airag_${Date.now()}@example.com`;
  const signupRes = await requestJson('POST', '/api/auth/signup', {
    email,
    password: 'Password123!',
    full_name: 'Priya Sharma',
    course: 'B.Tech CS',
    semester: 4
  });
  assert(signupRes.status === 201, 'Student signed up successfully');
  const token = signupRes.body?.session?.access_token;
  const profileId = signupRes.body?.user?.id;

  // Create subject
  const subRes = await requestJson('POST', '/api/subjects', {
    name: 'Database Management Systems',
    code: 'DBMS-401',
    color: '#6C4CE8'
  }, token);
  assert(subRes.status === 201, 'Subject created');
  const subjectId = subRes.body?.data?.id;

  // Create unit
  const unitRes = await requestJson('POST', '/api/units', {
    subject_id: subjectId,
    unit_number: 1,
    title: 'Unit 1: Relational Database Normalization'
  }, token);
  assert(unitRes.status === 201, 'Unit created');
  const unitId = unitRes.body?.data?.id;

  // Create topic
  const topicRes = await requestJson('POST', '/api/topics', {
    unit_id: unitId,
    title: 'Boyce-Codd Normal Form',
    status: 'in_progress',
    is_weak: true,
    mastery_score: 40
  }, token);
  assert(topicRes.status === 201, 'Topic created');
  const topicId = topicRes.body?.data?.id;

  // =========================================================================
  // STEP 1: Upload real PDF via POST /api/rag/upload
  // =========================================================================
  console.log('\n📌 1. Testing PDF Upload, Chunking & Embedding (POST /api/rag/upload)...');

  const pdfBuffer = createSyntheticPdf([
    `Unit 1: Advanced Relational Database Normalization.
Boyce-Codd Normal Form (BCNF) is a stricter definition of normalization than 3NF.
A relation schema R is in BCNF with respect to a set F of functional dependencies if,
for all functional dependencies X -> Y in F+, at least one of the following holds:
1. X -> Y is a trivial functional dependency (Y is a subset of X).
2. X is strictly a superkey for relation schema R.
Unlike Third Normal Form (3NF), BCNF does not permit the exception where Y is a prime attribute.`,

    `BCNF Decomposition and Lossless Joins.
Any relation schema can be decomposed into a collection of BCNF schemas with a lossless join.
However, BCNF decomposition is not always dependency-preserving.
When decomposing a relation into BCNF, we identify a dependency X -> Y that violates BCNF,
and decompose R into (R - Y) and (X union Y).
We repeat this process until all decomposed relations satisfy Boyce-Codd Normal Form.`
  ]);

  const uploadRes = await requestMultipart(
    '/api/rag/upload',
    {
      subject_id: subjectId,
      unit_id: unitId,
      name: 'DBMS_Unit1_BCNF_Lecture_Notes.pdf'
    },
    'DBMS_Unit1_BCNF_Lecture_Notes.pdf',
    pdfBuffer,
    token
  );

  assert(uploadRes.status === 201, 'POST /api/rag/upload returns 201 Created', `Got ${uploadRes.status}: ${JSON.stringify(uploadRes.body)}`);
  assert(uploadRes.body?.success === true, 'Upload returns success: true');
  assert(uploadRes.body?.data?.chunks_created >= 2, 'Response confirms at least 2 chunks created');
  const materialId = uploadRes.body?.data?.material?.id;
  assert(!!materialId, 'Response returns material ID');

  // Verify actual database rows in local-db.json
  const db = readDb();
  const dbMat = (db.materials || []).find((m: any) => m.id === materialId);
  assert(!!dbMat, 'Material row physically exists in database');
  assert(dbMat?.processed === true, 'Material record marked processed: true');
  assert(dbMat?.file_type === 'PDF', 'Material record file_type is PDF');

  const dbChunks = (db.document_chunks || []).filter((c: any) => c.material_id === materialId);
  assert(dbChunks.length >= 2, `document_chunks table contains ${dbChunks.length} chunks for this material`);

  const hasContent = dbChunks.every((c: any) => typeof c.content === 'string' && c.content.includes('Boyce-Codd Normal Form'));
  assert(hasContent, 'All chunks contain extracted text discussing Boyce-Codd Normal Form');

  const allChunksEmbedded = dbChunks.every((c: any) => Array.isArray(c.embedding) && c.embedding.length === 1536);
  assert(allChunksEmbedded, 'All chunks have 1536-dimensional vector embeddings generated and stored in database');

  // =========================================================================
  // STEP 2: Semantic Search Query (POST /api/rag/search)
  // =========================================================================
  console.log('\n📌 2. Testing Semantic Vector Search (POST /api/rag/search)...');

  const searchRes = await requestJson(
    'POST',
    '/api/rag/search',
    {
      query: 'What is the condition for a relation to be in Boyce-Codd Normal Form superkey?',
      subject_id: subjectId,
      top_k: 3,
      threshold: 0.2
    },
    token
  );

  assert(searchRes.status === 200, 'POST /api/rag/search returns 200 OK', `Got ${searchRes.status}`);
  assert(searchRes.body?.success === true, 'Search response success: true');
  assert(searchRes.body?.data?.results?.length > 0, 'Search returned matching chunks');

  const topMatch = searchRes.body?.data?.results?.[0];
  assert(topMatch?.similarity > 0.5, `Top chunk similarity is strong (${topMatch?.similarity?.toFixed(3)})`);
  assert(
    topMatch?.content.includes('Boyce-Codd Normal Form') || topMatch?.content.includes('superkey'),
    'Top chunk is actually relevant to the BCNF superkey query'
  );
  assert(topMatch?.material?.id === materialId, 'Top matching chunk links to the uploaded material');

  // =========================================================================
  // STEP 3: AI Study Assistant Grounded Answer (POST /api/assistant/chat)
  // =========================================================================
  console.log('\n📌 3. Testing AI Study Assistant (POST /api/assistant/chat)...');

  const assistantRes = await requestJson(
    'POST',
    '/api/assistant/chat',
    {
      message: 'Explain Boyce-Codd Normal Form from my uploaded notes and tell me the rule on superkeys.',
      subject_id: subjectId
    },
    token
  );

  assert(assistantRes.status === 200, 'POST /api/assistant/chat returns 200 OK', `Got ${assistantRes.status}`);
  assert(assistantRes.body?.success === true, 'Assistant response success: true');
  assert(Array.isArray(assistantRes.body?.data?.sources), 'Assistant returns sources array');
  assert(assistantRes.body?.data?.sources?.length > 0, 'Assistant retrieved grounded sources from uploaded PDF');

  const citedDoc = assistantRes.body?.data?.sources?.[0]?.material_name;
  assert(citedDoc === 'DBMS_Unit1_BCNF_Lecture_Notes.pdf', `Cited document name matches uploaded PDF (${citedDoc})`);

  const answer = assistantRes.body?.data?.answer || '';
  assert(
    answer.toLowerCase().includes('boyce-codd') || answer.toLowerCase().includes('bcnf') || answer.toLowerCase().includes('superkey'),
    'Assistant answer is grounded in retrieved BCNF chunks rather than generic'
  );

  // =========================================================================
  // STEP 4: Quiz Generation (POST /api/quiz/generate)
  // =========================================================================
  console.log('\n📌 4. Testing Grounded Quiz Generation (POST /api/quiz/generate)...');

  const quizGenRes = await requestJson(
    'POST',
    '/api/quiz/generate',
    {
      subject_id: subjectId,
      topic_id: topicId,
      num_questions: 5,
      question_type: 'multiple_choice'
    },
    token
  );

  assert(quizGenRes.status === 200, 'POST /api/quiz/generate returns 200 OK', `Got ${quizGenRes.status}`);
  assert(quizGenRes.body?.success === true, 'Quiz generation success: true');
  assert(quizGenRes.body?.data?.grounded === true, 'Quiz is flagged as grounded: true in uploaded notes');
  assert(quizGenRes.body?.data?.questions?.length === 5, 'Generated exactly 5 questions');

  const questions = quizGenRes.body?.data?.questions || [];
  const areAboutTopic = questions.some((q: any) =>
    (q.question || '').toLowerCase().includes('normal form') ||
    (q.question || '').toLowerCase().includes('bcnf') ||
    (q.question || '').toLowerCase().includes('dependency') ||
    (q.question || '').toLowerCase().includes('superkey') ||
    (q.explanation || '').toLowerCase().includes('bcnf')
  );
  assert(areAboutTopic, 'Questions are actually about the requested topic (Boyce-Codd Normal Form)');

  // =========================================================================
  // STEP 5: Submit Quiz Answers (POST /api/quiz/submit) & Check Readiness
  // =========================================================================
  console.log('\n📌 5. Testing Quiz Submission & Readiness Engine Integration...');

  // Deliberately answer 2 correctly and 3 incorrectly for "Boyce-Codd Normal Form"
  const answersPayload = questions.map((q: any, idx: number) => {
    if (idx < 2) {
      // Correct
      return {
        question_id: q.id,
        question: q.question,
        user_answer: q.correct_answer,
        correct_answer: q.correct_answer,
        topic_id: topicId,
        topic_title: 'Boyce-Codd Normal Form'
      };
    } else {
      // Wrong
      return {
        question_id: q.id,
        question: q.question,
        user_answer: 'Incorrect Option Z',
        correct_answer: q.correct_answer,
        topic_id: topicId,
        topic_title: 'Boyce-Codd Normal Form'
      };
    }
  });

  const submitRes = await requestJson(
    'POST',
    '/api/quiz/submit',
    {
      subject_id: subjectId,
      topic_id: topicId,
      answers: answersPayload
    },
    token
  );

  assert(submitRes.status === 201, 'POST /api/quiz/submit returns 201 Created', `Got ${submitRes.status}`);
  assert(submitRes.body?.data?.score === 40, 'Quiz score is exactly 40% (2/5 correct)');
  assert(submitRes.body?.data?.passed === false, 'Quiz passed is false (score < 60%)');
  assert(
    submitRes.body?.data?.weak_topics_identified?.includes('Boyce-Codd Normal Form'),
    'Weak topics identified includes "Boyce-Codd Normal Form"'
  );

  // Check actual database row in quiz_results
  const dbAfterSubmit = readDb();
  const quizRow = (dbAfterSubmit.quiz_results || []).find((qr: any) => qr.subject_id === subjectId);
  assert(!!quizRow, 'Row physically written to quiz_results in database');
  assert(quizRow?.score === 40, 'quiz_results database row contains score: 40');
  assert(quizRow?.profile_id === profileId, 'quiz_results database row has correct profile_id');
  assert(
    Array.isArray(quizRow?.weak_topics_identified) && quizRow.weak_topics_identified.includes('Boyce-Codd Normal Form'),
    'quiz_results row has correct topic breakdown in weak_topics_identified'
  );

  // Check Person 2's Readiness Endpoint re-read
  const readinessRes = await requestJson('GET', `/api/readiness/${subjectId}`, undefined, token);
  assert(readinessRes.status === 200, 'GET /api/readiness/:subjectId returns 200 OK');
  assert(readinessRes.body?.data?.breakdown?.quiz_performance === 40, 'Readiness breakdown quiz_performance immediately reflects 40%');
  const hasPerfRisk = readinessRes.body?.data?.risks?.some((r: any) => r.type === 'PERFORMANCE_RISK');
  assert(hasPerfRisk, 'AcademicEngineService automatically triggers PERFORMANCE_RISK for score < 60%');

  // =========================================================================
  // STEP 6: Planner Context Reflects Dynamic Weak Topics
  // =========================================================================
  console.log('\n📌 6. Testing Adaptive Planner Context Dynamically Reflects Weak Topics...');

  const plannerRes1 = await requestJson('GET', `/api/planner/context/${subjectId}`, undefined, token);
  assert(plannerRes1.status === 200, 'GET /api/planner/context/:subjectId returns 200 OK');
  const subCtx1 = plannerRes1.body?.data?.subjects?.[0];
  assert(!!subCtx1, 'Subject planner context returned');
  assert(subCtx1.recent_quiz_performance?.[0]?.score === 40, 'Planner context recent_quiz_performance contains 40% quiz attempt');
  assert(
    subCtx1.weak_and_unfinished_topics?.some((t: any) => t.title === 'Boyce-Codd Normal Form' && t.is_weak === true),
    'Planner context weak_and_unfinished_topics includes Boyce-Codd Normal Form as weak'
  );
  assert(
    subCtx1.active_risks?.some((r: any) => r.type === 'PERFORMANCE_RISK'),
    'Planner context active_risks contains PERFORMANCE_RISK'
  );

  // ADAPTIVE TEST: Student studies and marks topic completed + passes a new quiz with 100%!
  console.log('     🔄 Student studies BCNF: Marking topic completed & submitting 100% quiz...');
  await requestJson('PATCH', `/api/topics/${topicId}`, {
    status: 'completed',
    is_weak: false,
    mastery_score: 100
  }, token);

  const perfectAnswers = questions.map((q: any) => ({
    question_id: q.id,
    question: q.question,
    user_answer: q.correct_answer,
    correct_answer: q.correct_answer,
    topic_id: topicId,
    topic_title: 'Boyce-Codd Normal Form'
  }));

  const submitPerfectRes = await requestJson(
    'POST',
    '/api/quiz/submit',
    {
      subject_id: subjectId,
      topic_id: topicId,
      answers: perfectAnswers
    },
    token
  );
  assert(submitPerfectRes.status === 201, 'Perfect quiz submitted with 100%');

  // Re-request planner context and verify it dynamically updated!
  const plannerRes2 = await requestJson('GET', `/api/planner/context/${subjectId}`, undefined, token);
  const subCtx2 = plannerRes2.body?.data?.subjects?.[0];
  const isBcnfStillWeak = subCtx2.weak_and_unfinished_topics?.some((t: any) => t.title === 'Boyce-Codd Normal Form' && t.is_weak);
  assert(!isBcnfStillWeak, 'Planner context dynamically updated: Boyce-Codd Normal Form is no longer weak');
  assert(subCtx2.readiness_percentage > subCtx1.readiness_percentage, `Readiness score increased dynamically from ${subCtx1.readiness_percentage}% to ${subCtx2.readiness_percentage}%`);

  console.log('\n======================================================');
  console.log(`📊 AI/RAG Endpoints Verification: ${passed} Passed, ${failed} Failed.`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal error in AI/RAG test suite:', err);
  process.exit(1);
});

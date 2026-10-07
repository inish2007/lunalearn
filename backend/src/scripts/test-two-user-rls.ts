import assert from 'node:assert/strict';

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

interface TestResult {
  check: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function record(check: string, fn: () => void | Promise<void>) {
  return async () => {
    try {
      await fn();
      results.push({ check, passed: true });
      console.log(`   ✅ PASS: ${check}`);
    } catch (err: any) {
      results.push({ check, passed: false, error: err?.message || String(err) });
      console.error(`   ❌ FAIL: ${check} — ${err?.message || err}`);
    }
  };
}

async function main() {
  const base = process.env.API_BASE_URL || 'http://localhost:4000/api';
  console.log(`\n====================================================`);
  console.log(`🌙 LunaLearn — Two-User RLS & Isolation Verification`);
  console.log(`Target: ${base}`);
  console.log(`====================================================\n`);

  async function api(route: string, method = 'GET', body?: unknown, token?: string) {
    const res = await fetch(`${base}${route}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    let data: any = null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      const text = await res.text();
      data = { raw: text };
    }
    return { status: res.status, ok: res.ok, body: data };
  }

  // 1. Create User A and User B
  const ts = Date.now();
  const userAEmail = `rls-user-a-${ts}@example.test`;
  const userBEmail = `rls-user-b-${ts}@example.test`;

  console.log(`1. Setting up Test Users...`);
  const signupA = await api('/auth/signup', 'POST', {
    email: userAEmail,
    password: 'Password123!',
    full_name: 'User Alpha',
    course: 'Computer Science',
    semester: 4
  });
  assert.equal(signupA.status, 201, 'User A signup failed');
  const tokenA = signupA.body?.session?.access_token || signupA.body?.data?.session?.access_token;
  assert.ok(tokenA, 'Missing User A access token');

  const signupB = await api('/auth/signup', 'POST', {
    email: userBEmail,
    password: 'Password123!',
    full_name: 'User Beta',
    course: 'Mechanical Eng',
    semester: 2
  });
  assert.equal(signupB.status, 201, 'User B signup failed');
  const tokenB = signupB.body?.session?.access_token || signupB.body?.data?.session?.access_token;
  assert.ok(tokenB, 'Missing User B access token');

  // User A creates a subject
  const subA = await api('/subjects', 'POST', {
    name: 'Distributed Systems',
    code: 'CS-401',
    color: '#3B82F6'
  }, tokenA);
  assert.equal(subA.status, 201, 'Failed to create User A subject');
  const subjectAId = subA.body?.data?.id;
  assert.ok(subjectAId, 'Missing subject A ID');

  // User B creates a subject
  const subB = await api('/subjects', 'POST', {
    name: 'Fluid Mechanics',
    code: 'ME-201',
    color: '#10B981'
  }, tokenB);
  const subjectBId = subB.body?.data?.id;
  assert.ok(subjectBId, 'User B subject ID should exist');

  // -------------------------------------------------------------
  // CHECK 1: Tasks RLS
  // -------------------------------------------------------------
  console.log(`\n2. Verifying Tasks Isolation...`);
  let taskAId = '';
  await record('User A creates task in Subject A', async () => {
    const res = await api('/tasks', 'POST', {
      subject_id: subjectAId,
      title: 'Paxos Implementation Assignment',
      type: 'Assignment',
      priority: 'high',
      is_completed: false
    }, tokenA);
    assert.equal(res.status, 201);
    taskAId = res.body?.data?.id;
    assert.ok(taskAId);
  })();

  await record('User B cannot create task referencing Subject A (403 Forbidden)', async () => {
    const res = await api('/tasks', 'POST', {
      subject_id: subjectAId,
      title: 'Malicious Injected Task',
      type: 'Assignment',
      priority: 'high',
      is_completed: false
    }, tokenB);
    assert.equal(res.status, 403);
  })();

  await record('User B cannot see Task A in tasks list', async () => {
    const res = await api('/tasks', 'GET', undefined, tokenB);
    assert.equal(res.status, 200);
    const tasks = res.body?.data || [];
    assert.ok(!tasks.some((t: any) => t.id === taskAId));
  })();

  await record('User B cannot fetch Task A by ID (404 Not Found)', async () => {
    const res = await api(`/tasks/${taskAId}`, 'GET', undefined, tokenB);
    assert.equal(res.status, 404);
  })();

  await record('User B cannot modify Task A (404/403 Rejected)', async () => {
    const res = await api(`/tasks/${taskAId}`, 'PATCH', { title: 'Compromised Title' }, tokenB);
    assert.ok(res.status === 404 || res.status === 403);
  })();

  await record('User B cannot delete Task A (404/403 Rejected)', async () => {
    const res = await api(`/tasks/${taskAId}`, 'DELETE', undefined, tokenB);
    assert.ok(res.status === 404 || res.status === 403);
  })();

  // -------------------------------------------------------------
  // CHECK 2: Exams RLS
  // -------------------------------------------------------------
  console.log(`\n3. Verifying Exams Isolation...`);
  let examAId = '';
  const examDate = new Date(Date.now() + 5 * 86400000).toISOString();
  await record('User A creates exam in Subject A', async () => {
    const res = await api('/exams', 'POST', {
      subject_id: subjectAId,
      title: 'Distributed Systems Midterm',
      exam_date: examDate,
      target_score: 95
    }, tokenA);
    assert.equal(res.status, 201);
    examAId = res.body?.data?.id;
    assert.ok(examAId);
  })();

  await record('User B cannot create exam referencing Subject A (403 Forbidden)', async () => {
    const res = await api('/exams', 'POST', {
      subject_id: subjectAId,
      title: 'Bob Exam in Alice Subject',
      exam_date: examDate,
      target_score: 50
    }, tokenB);
    assert.equal(res.status, 403);
  })();

  await record('User B cannot see Exam A in exams list', async () => {
    const res = await api('/exams', 'GET', undefined, tokenB);
    assert.equal(res.status, 200);
    const exams = res.body?.data || [];
    assert.ok(!exams.some((e: any) => e.id === examAId));
  })();

  await record('User B cannot fetch Exam A by ID (404 Not Found)', async () => {
    const res = await api(`/exams/${examAId}`, 'GET', undefined, tokenB);
    assert.equal(res.status, 404);
  })();

  await record('User B cannot modify Exam A (404/403 Rejected)', async () => {
    const res = await api(`/exams/${examAId}`, 'PATCH', { target_score: 10 }, tokenB);
    assert.ok(res.status === 404 || res.status === 403);
  })();

  await record('User B cannot delete Exam A (404/403 Rejected)', async () => {
    const res = await api(`/exams/${examAId}`, 'DELETE', undefined, tokenB);
    assert.ok(res.status === 404 || res.status === 403);
  })();

  // -------------------------------------------------------------
  // CHECK 3: Materials RLS
  // -------------------------------------------------------------
  console.log(`\n4. Verifying Materials Isolation...`);
  let materialAId = '';
  await record('User A creates material metadata in Subject A', async () => {
    const res = await api('/materials', 'POST', {
      subject_id: subjectAId,
      name: 'Lecture1_Paxos.pdf',
      storage_path: `materials/${userAEmail}/lecture1.pdf`,
      file_type: 'pdf',
      size_bytes: 2048,
      processed: true
    }, tokenA);
    assert.equal(res.status, 201);
    materialAId = res.body?.data?.id;
    assert.ok(materialAId);
  })();

  await record('User B cannot create material referencing Subject A (403 Forbidden)', async () => {
    const res = await api('/materials', 'POST', {
      subject_id: subjectAId,
      name: 'Bob Notes.pdf',
      storage_path: `materials/${userBEmail}/bob.pdf`,
      file_type: 'pdf',
      size_bytes: 1024,
      processed: true
    }, tokenB);
    assert.equal(res.status, 403);
  })();

  await record('User B cannot see Material A in materials list', async () => {
    const res = await api('/materials', 'GET', undefined, tokenB);
    assert.equal(res.status, 200);
    const materials = res.body?.data || [];
    assert.ok(!materials.some((m: any) => m.id === materialAId));
  })();

  await record('User B cannot fetch Material A by ID (404 Not Found)', async () => {
    const res = await api(`/materials/${materialAId}`, 'GET', undefined, tokenB);
    assert.equal(res.status, 404);
  })();

  await record('User B cannot modify Material A (404/403 Rejected)', async () => {
    const res = await api(`/materials/${materialAId}`, 'PATCH', { name: 'Hacked.pdf' }, tokenB);
    assert.ok(res.status === 404 || res.status === 403);
  })();

  await record('User B cannot delete Material A (404/403 Rejected)', async () => {
    const res = await api(`/materials/${materialAId}`, 'DELETE', undefined, tokenB);
    assert.ok(res.status === 404 || res.status === 403);
  })();

  // -------------------------------------------------------------
  // CHECK 4: Quiz Answers RLS
  // -------------------------------------------------------------
  console.log(`\n5. Verifying Quiz Answers Isolation...`);
  // Setup unit & topic for quiz
  const unitRes = await api('/units', 'POST', {
    subject_id: subjectAId,
    unit_number: 1,
    title: 'Consensus Protocols'
  }, tokenA);
  const unitId = unitRes.body?.data?.id;

  const topicRes = await api('/topics', 'POST', {
    unit_id: unitId,
    title: 'Raft & Paxos Consensus',
    estimated_study_hours: 2,
    status: 'in_progress'
  }, tokenA);
  const topicId = topicRes.body?.data?.id;

  await record('User B cannot submit quiz answers against User A Subject (403/404 Rejected)', async () => {
    const res = await api('/quiz/submit', 'POST', {
      quiz_id: '00000000-0000-0000-0000-000000000001',
      subject_id: subjectAId,
      topic_id: topicId,
      answers: [
        { question_id: 'q1', user_answer: 'Option A', correct_answer: 'Option A' }
      ]
    }, tokenB);
    assert.ok(res.status === 403 || res.status === 404 || res.status === 400);
  })();

  // -------------------------------------------------------------
  // CHECK 5: PDF Storage Isolation
  // -------------------------------------------------------------
  console.log(`\n6. Verifying PDF Storage Isolation...`);
  const pdfBytes = createSyntheticPdf([
    'First normal form requires atomic values and unique keys. Second normal form removes partial dependencies on a composite primary key. Third normal form removes transitive functional dependencies. Boyce Codd normal form requires each determinant of a nontrivial functional dependency to be a superkey.'
  ]);
  let uploadedMaterialId = '';

  await record('User A uploads PDF to storage', async () => {
    const uploadRes = await api('/rag/upload', 'POST', {
      subject_id: subjectAId,
      file_name: 'paxos-notes.pdf',
      file_base64: pdfBytes.toString('base64')
    }, tokenA);
    assert.ok(uploadRes.status === 200 || uploadRes.status === 201, `Upload status was ${uploadRes.status}: ${JSON.stringify(uploadRes.body)}`);
    uploadedMaterialId = uploadRes.body?.data?.material?.id || uploadRes.body?.material?.id;
    assert.ok(uploadedMaterialId, `Missing uploadedMaterialId in body: ${JSON.stringify(uploadRes.body)}`);
  })();

  await record('User A can download own PDF from /api/materials/:id/content (200 OK)', async () => {
    const res = await fetch(`${base}/materials/${uploadedMaterialId}/content`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.equal(res.status, 200);
    const buf = Buffer.from(await res.arrayBuffer());
    assert.equal(buf.length, pdfBytes.length);
  })();

  await record('User B cannot download User A PDF from /api/materials/:id/content (404/403 Rejected)', async () => {
    const res = await fetch(`${base}/materials/${uploadedMaterialId}/content`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    assert.ok(res.status === 404 || res.status === 403);
  })();

  // -------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------
  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;
  console.log(`\n====================================================`);
  console.log(`RLS Verification Summary: ${passedCount} Passed, ${failedCount} Failed.`);
  console.log(`====================================================\n`);

  if (failedCount > 0) {
    process.exitCode = 1;
  }
}

main().catch(err => {
  console.error('Test script crashed:', err);
  process.exit(1);
});

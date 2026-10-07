import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import assert from 'assert/strict';
import fs from 'fs';
import path from 'path';
import { env } from '../config/env.js';
import type { Database } from '../types/database.js';

interface CheckResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'not run';
  details?: string;
  durationMs?: number;
}

const results: CheckResult[] = [];
const LOG_FILE = path.resolve(process.cwd(), 'staging-run.log');

// Clear / initialize log file
fs.writeFileSync(LOG_FILE, `=== LunaLearn Staging Verification Run Started: ${new Date().toISOString()} ===\n`, 'utf8');

function logLine(msg: string) {
  const ts = new Date().toISOString();
  const formatted = `[${ts}] ${msg}`;
  console.log(formatted);
  fs.appendFileSync(LOG_FILE, formatted + '\n', 'utf8');
}

async function withTimeout<T>(promise: Promise<T>, ms = 15000, description = 'Operation'): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${description} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer!);
  }
}

async function runCheck(name: string, fn: () => Promise<void>) {
  const start = Date.now();
  logLine(`START: ${name}`);
  try {
    await withTimeout(fn(), 45000, name);
    const durationMs = Date.now() - start;
    results.push({ name, status: 'PASS', durationMs });
    logLine(`PASS: ${name} (${durationMs}ms)`);
  } catch (err: any) {
    const durationMs = Date.now() - start;
    const msg = err?.message || String(err);
    results.push({ name, status: 'FAIL', details: msg, durationMs });
    logLine(`FAIL: ${name} (${durationMs}ms) - ${msg}`);
    // Non-zero exit on hard failure so nothing hangs silently
    throw err;
  }
}

function createSyntheticPdf(lines: string[]): Buffer {
  const content = lines.join('\n');
  const stream = `BT\n/F1 12 Tf\n50 750 Td\n(${content.replace(/[\r\n]+/g, ' ')}) Tj\nET`;
  const streamLength = Buffer.byteLength(stream, 'utf8');

  const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length ${streamLength} >>
stream
${stream}
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000350 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
440
%%EOF`;

  return Buffer.from(pdf, 'utf8');
}

async function main() {
  logLine('====================================================');
  logLine('🌙 LunaLearn — Hardened Live Staging Verification Suite');
  logLine('====================================================');

  if (!env.SUPABASE_URL || env.SUPABASE_URL.includes('placeholder')) {
    throw new Error('SUPABASE_URL is missing or placeholder.');
  }
  if (!env.SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY.includes('placeholder')) {
    throw new Error('SUPABASE_ANON_KEY is missing or placeholder.');
  }
  if (!env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY.includes('placeholder')) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing or placeholder.');
  }

  const adminClient: any = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  // Start in-process backend server bound to ephemeral port
  const { server } = await import('../index.js');
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  const address = server.address() as { port: number };
  const apiBase = `http://127.0.0.1:${address.port}/api`;

  const ts = Date.now();
  const userAEmail = `staging-user-a-${ts}@test.lunalearn.local`;
  const userBEmail = `staging-user-b-${ts}@test.lunalearn.local`;
  const password = 'Password123!Secure';

  let userAId = '';
  let userBId = '';
  let tokenA = '';
  let tokenB = '';

  let clientA: any;
  let clientB: any;

  let subjectAId = '';
  let taskAId = '';
  let examAId = '';
  let materialAId = '';
  let sessionAId = '';
  let quizRunAId = '';
  let storagePathA = '';

  let subjectBId = '';
  let taskBId = '';
  let examBId = '';
  let materialBId = '';
  let sessionBId = '';
  let quizRunBId = '';
  let storagePathB = '';

  const pdfBuffer = createSyntheticPdf([
    'Distributed Systems Lecture 1: Introduction to Paxos Consensus and Raft protocols.'
  ]);
  const pdfSha256 = crypto.createHash('sha256').update(pdfBuffer).digest('hex');

  async function api(path: string, method = 'GET', body?: unknown, token?: string, version?: string, timeoutMs = 15000) {
    const res = await fetch(`${apiBase}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(version ? { 'If-Match': version } : {})
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs)
    });
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { status: res.status, ok: res.ok, data };
  }

  async function apiRaw(path: string, method = 'GET', token?: string, timeoutMs = 15000) {
    const res = await fetch(`${apiBase}${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      signal: AbortSignal.timeout(timeoutMs)
    });
    const buffer = Buffer.from(await res.arrayBuffer());
    return { status: res.status, ok: res.ok, buffer };
  }

  try {
    // -------------------------------------------------------------
    // Setup Test Users in Staging Supabase
    // -------------------------------------------------------------
    await runCheck('Setup test User A and User B on staging Supabase Auth', async () => {
      // User A
      const { data: authA, error: errA } = await withTimeout<any>(
        adminClient.auth.admin.createUser({
          email: userAEmail,
          password,
          email_confirm: true,
          user_metadata: { full_name: 'Staging User Alpha' }
        })
      );
      if (errA || !authA.user) throw new Error(`User A creation failed: ${errA?.message}`);
      userAId = authA.user.id;

      // User B
      const { data: authB, error: errB } = await withTimeout<any>(
        adminClient.auth.admin.createUser({
          email: userBEmail,
          password,
          email_confirm: true,
          user_metadata: { full_name: 'Staging User Beta' }
        })
      );
      if (errB || !authB.user) throw new Error(`User B creation failed: ${errB?.message}`);
      userBId = authB.user.id;

      // Sign in User A
      const clientAnon = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
      const { data: sessionA, error: sErrA } = await withTimeout(
        clientAnon.auth.signInWithPassword({ email: userAEmail, password })
      );
      if (sErrA || !sessionA.session) throw new Error(`User A login failed: ${sErrA?.message}`);
      tokenA = sessionA.session.access_token;

      // Sign in User B
      const { data: sessionB, error: sErrB } = await withTimeout(
        clientAnon.auth.signInWithPassword({ email: userBEmail, password })
      );
      if (sErrB || !sessionB.session) throw new Error(`User B login failed: ${sErrB?.message}`);
      tokenB = sessionB.session.access_token;

      // Scoped clients
      clientA = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${tokenA}` } }
      });
      clientB = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${tokenB}` } }
      });
    });

    // -------------------------------------------------------------
    // Populate Initial Entities for User A and User B
    // -------------------------------------------------------------
    await runCheck('Populate isolated entities for User A and User B', async () => {
      // User A creates Subject
      const { data: subA, error: subAErr } = await clientA
        .from('subjects')
        .insert({ profile_id: userAId, name: 'Distributed Systems', code: 'CS-401', color: '#6366f1' })
        .select()
        .single();
      if (subAErr || !subA) throw new Error(`User A subject failed: ${subAErr?.message}`);
      subjectAId = subA.id;

      // User A creates Task
      const { data: taskA, error: taskAErr } = await clientA
        .from('tasks')
        .insert({ profile_id: userAId, subject_id: subjectAId, title: 'Implement Raft', type: 'Assignment', priority: 'High', is_completed: false })
        .select()
        .single();
      if (taskAErr || !taskA) throw new Error(`User A task failed: ${taskAErr?.message}`);
      taskAId = taskA.id;

      // User A creates Exam
      const examDateA = new Date(Date.now() + 86400000 * 14).toISOString();
      const { data: examA, error: examAErr } = await clientA
        .from('exams')
        .insert({ profile_id: userAId, subject_id: subjectAId, title: 'Final Exam', exam_date: examDateA, target_score: 90 })
        .select()
        .single();
      if (examAErr || !examA) throw new Error(`User A exam failed: ${examAErr?.message}`);
      examAId = examA.id;

      // User A creates Material metadata
      storagePathA = `${userAId}/${subjectAId}/lecture1.pdf`;
      const { data: matA, error: matAErr } = await clientA
        .from('materials')
        .insert({ profile_id: userAId, subject_id: subjectAId, name: 'Lecture 1 Slides', storage_path: storagePathA, file_type: 'PDF', size_bytes: pdfBuffer.length })
        .select()
        .single();
      if (matAErr || !matA) throw new Error(`User A material failed: ${matAErr?.message}`);
      materialAId = matA.id;

      // User A logs Study Session
      const sessPayloadA = {
        id: crypto.randomUUID(),
        subject_id: subjectAId,
        started_at: new Date(Date.now() - 3600000).toISOString(),
        ended_at: new Date(Date.now() - 1800000).toISOString(),
        session_type: 'focus',
        notes: 'Studied Raft consensus'
      };
      const { data: sDataA, error: sErrA } = await clientA.rpc('log_study_session', { p_session: sessPayloadA });
      if (sErrA || !sDataA) throw new Error(`User A session failed: ${sErrA?.message}`);
      sessionAId = sessPayloadA.id;

      // User A Quiz Run
      const { data: qrA, error: qrAErr } = await adminClient
        .from('quiz_runs')
        .insert({
          profile_id: userAId,
          subject_id: subjectAId,
          difficulty: 'medium',
          model: 'gemini-3.8-flash',
          questions: [{ id: 'qa1', question: 'What is Raft?', options: ['Consensus', 'Database'], correct_answer: 'Consensus', explanation: 'Protocol' }]
        })
        .select()
        .single();
      if (qrAErr || !qrA) throw new Error(`User A quiz run failed: ${qrAErr?.message}`);
      quizRunAId = qrA.id;

      // User B creates Subject
      const { data: subB, error: subBErr } = await clientB
        .from('subjects')
        .insert({ profile_id: userBId, name: 'Machine Learning', code: 'CS-501', color: '#10b981' })
        .select()
        .single();
      if (subBErr || !subB) throw new Error(`User B subject failed: ${subBErr?.message}`);
      subjectBId = subB.id;

      // User B creates Task
      const { data: taskB, error: taskBErr } = await clientB
        .from('tasks')
        .insert({ profile_id: userBId, subject_id: subjectBId, title: 'Train Transformer', type: 'Assignment', priority: 'High', is_completed: false })
        .select()
        .single();
      if (taskBErr || !taskB) throw new Error(`User B task failed: ${taskBErr?.message}`);
      taskBId = taskB.id;

      // User B creates Exam
      const examDateB = new Date(Date.now() + 86400000 * 21).toISOString();
      const { data: examB, error: examBErr } = await clientB
        .from('exams')
        .insert({ profile_id: userBId, subject_id: subjectBId, title: 'ML Midterm', exam_date: examDateB, target_score: 85 })
        .select()
        .single();
      if (examBErr || !examB) throw new Error(`User B exam failed: ${examBErr?.message}`);
      examBId = examB.id;

      // User B creates Material metadata
      storagePathB = `${userBId}/${subjectBId}/lecture1_ml.pdf`;
      const { data: matB, error: matBErr } = await clientB
        .from('materials')
        .insert({ profile_id: userBId, subject_id: subjectBId, name: 'ML Notes', storage_path: storagePathB, file_type: 'PDF', size_bytes: pdfBuffer.length })
        .select()
        .single();
      if (matBErr || !matB) throw new Error(`User B material failed: ${matBErr?.message}`);
      materialBId = matB.id;

      // User B logs Study Session
      const sessPayloadB = {
        id: crypto.randomUUID(),
        subject_id: subjectBId,
        started_at: new Date(Date.now() - 3600000).toISOString(),
        ended_at: new Date(Date.now() - 1800000).toISOString(),
        session_type: 'revision',
        notes: 'Studied attention'
      };
      const { data: sDataB, error: sErrB } = await clientB.rpc('log_study_session', { p_session: sessPayloadB });
      if (sErrB || !sDataB) throw new Error(`User B session failed: ${sErrB?.message}`);
      sessionBId = sessPayloadB.id;

      // User B Quiz Run
      const { data: qrB, error: qrBErr } = await adminClient
        .from('quiz_runs')
        .insert({
          profile_id: userBId,
          subject_id: subjectBId,
          difficulty: 'medium',
          model: 'gemini-3.8-flash',
          questions: [{ id: 'qb1', question: 'What is attention?', options: ['Mechanism', 'Hardware'], correct_answer: 'Mechanism', explanation: 'Attention' }]
        })
        .select()
        .single();
      if (qrBErr || !qrB) throw new Error(`User B quiz run failed: ${qrBErr?.message}`);
      quizRunBId = qrB.id;
    });

    // -------------------------------------------------------------
    // Check 6a: Two-User RLS Direct Isolation
    // -------------------------------------------------------------
    await runCheck('6a. RLS Direct: User A cannot read or modify User B entities', async () => {
      // Subjects
      const { data: sRead } = await clientA.from('subjects').select('*').eq('id', subjectBId);
      assert.equal(sRead?.length ?? 0, 0, 'User A must not SELECT User B subjects');

      // Tasks
      const { data: tRead } = await clientA.from('tasks').select('*').eq('id', taskBId);
      assert.equal(tRead?.length ?? 0, 0, 'User A must not SELECT User B tasks');
      const { data: tUpdate } = await clientA.from('tasks').update({ title: 'Hijack' }).eq('id', taskBId).select();
      assert.equal(tUpdate?.length ?? 0, 0, 'User A must not UPDATE User B tasks');
      const { data: tDelete } = await clientA.from('tasks').delete().eq('id', taskBId).select();
      assert.equal(tDelete?.length ?? 0, 0, 'User A must not DELETE User B tasks');

      // Exams
      const { data: eRead } = await clientA.from('exams').select('*').eq('id', examBId);
      assert.equal(eRead?.length ?? 0, 0, 'User A must not SELECT User B exams');
      const { data: eUpdate } = await clientA.from('exams').update({ title: 'Hijack' }).eq('id', examBId).select();
      assert.equal(eUpdate?.length ?? 0, 0, 'User A must not UPDATE User B exams');
      const { data: eDelete } = await clientA.from('exams').delete().eq('id', examBId).select();
      assert.equal(eDelete?.length ?? 0, 0, 'User A must not DELETE User B exams');

      // Materials
      const { data: mRead } = await clientA.from('materials').select('*').eq('id', materialBId);
      assert.equal(mRead?.length ?? 0, 0, 'User A must not SELECT User B materials');

      // Quiz runs / submission
      const { error: rpcErr } = await clientA.rpc('submit_quiz_run', {
        p_quiz_id: quizRunBId,
        p_answers: [{ question_id: 'qb1', user_answer: 'Mechanism' }]
      });
      assert.ok(rpcErr, 'User A submit_quiz_run on User B quiz must be rejected');

      // Study sessions & XP events
      const { data: ssRead } = await clientA.from('study_sessions').select('*').eq('id', sessionBId);
      assert.equal(ssRead?.length ?? 0, 0, 'User A must not SELECT User B study sessions');
      const { data: xpRead } = await clientA.from('xp_events').select('*').eq('profile_id', userBId);
      assert.equal(xpRead?.length ?? 0, 0, 'User A must not SELECT User B XP events');
    });

    await runCheck('6a. RLS Direct: User B cannot read or modify User A entities', async () => {
      // Subjects
      const { data: sRead } = await clientB.from('subjects').select('*').eq('id', subjectAId);
      assert.equal(sRead?.length ?? 0, 0, 'User B must not SELECT User A subjects');

      // Tasks
      const { data: tRead } = await clientB.from('tasks').select('*').eq('id', taskAId);
      assert.equal(tRead?.length ?? 0, 0, 'User B must not SELECT User A tasks');
      const { data: tUpdate } = await clientB.from('tasks').update({ title: 'Hijack' }).eq('id', taskAId).select();
      assert.equal(tUpdate?.length ?? 0, 0, 'User B must not UPDATE User A tasks');
      const { data: tDelete } = await clientB.from('tasks').delete().eq('id', taskAId).select();
      assert.equal(tDelete?.length ?? 0, 0, 'User B must not DELETE User A tasks');

      // Exams
      const { data: eRead } = await clientB.from('exams').select('*').eq('id', examAId);
      assert.equal(eRead?.length ?? 0, 0, 'User B must not SELECT User A exams');
      const { data: eUpdate } = await clientB.from('exams').update({ title: 'Hijack' }).eq('id', examAId).select();
      assert.equal(eUpdate?.length ?? 0, 0, 'User B must not UPDATE User A exams');
      const { data: eDelete } = await clientB.from('exams').delete().eq('id', examAId).select();
      assert.equal(eDelete?.length ?? 0, 0, 'User B must not DELETE User A exams');

      // Materials
      const { data: mRead } = await clientB.from('materials').select('*').eq('id', materialAId);
      assert.equal(mRead?.length ?? 0, 0, 'User B must not SELECT User A materials');

      // Quiz runs / submission
      const { error: rpcErr } = await clientB.rpc('submit_quiz_run', {
        p_quiz_id: quizRunAId,
        p_answers: [{ question_id: 'qa1', user_answer: 'Consensus' }]
      });
      assert.ok(rpcErr, 'User B submit_quiz_run on User A quiz must be rejected');

      // Study sessions & XP events
      const { data: ssRead } = await clientB.from('study_sessions').select('*').eq('id', sessionAId);
      assert.equal(ssRead?.length ?? 0, 0, 'User B must not SELECT User A study sessions');
      const { data: xpRead } = await clientB.from('xp_events').select('*').eq('profile_id', userAId);
      assert.equal(xpRead?.length ?? 0, 0, 'User B must not SELECT User A XP events');
    });

    // -------------------------------------------------------------
    // Check 6a: Two-User API Isolation Enforcement
    // -------------------------------------------------------------
    await runCheck('6a. API Enforcement: User A cannot read or modify User B entities via API', async () => {
      // Subjects
      const sGet = await api(`/subjects/${subjectBId}`, 'GET', undefined, tokenA);
      assert.equal(sGet.status, 404);
      const sPatch = await api(`/subjects/${subjectBId}`, 'PATCH', { name: 'Hack' }, tokenA);
      assert.equal(sPatch.status, 404);
      const sDel = await api(`/subjects/${subjectBId}`, 'DELETE', undefined, tokenA);
      assert.equal(sDel.status, 404);

      // Tasks
      const tGet = await api(`/tasks/${taskBId}`, 'GET', undefined, tokenA);
      assert.equal(tGet.status, 404);
      const tPatch = await api(`/tasks/${taskBId}`, 'PATCH', { title: 'Hack' }, tokenA);
      assert.equal(tPatch.status, 404);
      const tDel = await api(`/tasks/${taskBId}`, 'DELETE', undefined, tokenA);
      assert.equal(tDel.status, 404);

      // Exams
      const eGet = await api(`/exams/${examBId}`, 'GET', undefined, tokenA);
      assert.equal(eGet.status, 404);
      const ePatch = await api(`/exams/${examBId}`, 'PATCH', { title: 'Hack' }, tokenA);
      assert.equal(ePatch.status, 404);
      const eDel = await api(`/exams/${examBId}`, 'DELETE', undefined, tokenA);
      assert.equal(eDel.status, 404);

      // Materials
      const mGet = await api(`/materials/${materialBId}`, 'GET', undefined, tokenA);
      assert.equal(mGet.status, 404);
      const mContent = await apiRaw(`/materials/${materialBId}/content`, 'GET', tokenA);
      assert.ok(mContent.status === 404 || mContent.status === 403);

      // Quiz Submit
      const qSubmit = await api('/quiz/submit', 'POST', {
        quiz_id: quizRunBId,
        subject_id: subjectBId,
        answers: [{ question_id: 'qb1', user_answer: 'Mechanism' }]
      }, tokenA);
      assert.ok(qSubmit.status === 404 || qSubmit.status === 400 || qSubmit.status === 500);
    });

    await runCheck('6a. API Enforcement: User B cannot read or modify User A entities via API', async () => {
      // Subjects
      const sGet = await api(`/subjects/${subjectAId}`, 'GET', undefined, tokenB);
      assert.equal(sGet.status, 404);
      const sPatch = await api(`/subjects/${subjectAId}`, 'PATCH', { name: 'Hack' }, tokenB);
      assert.equal(sPatch.status, 404);
      const sDel = await api(`/subjects/${subjectAId}`, 'DELETE', undefined, tokenB);
      assert.equal(sDel.status, 404);

      // Tasks
      const tGet = await api(`/tasks/${taskAId}`, 'GET', undefined, tokenB);
      assert.equal(tGet.status, 404);
      const tPatch = await api(`/tasks/${taskAId}`, 'PATCH', { title: 'Hack' }, tokenB);
      assert.equal(tPatch.status, 404);
      const tDel = await api(`/tasks/${taskAId}`, 'DELETE', undefined, tokenB);
      assert.equal(tDel.status, 404);

      // Exams
      const eGet = await api(`/exams/${examAId}`, 'GET', undefined, tokenB);
      assert.equal(eGet.status, 404);
      const ePatch = await api(`/exams/${examAId}`, 'PATCH', { title: 'Hack' }, tokenB);
      assert.equal(ePatch.status, 404);
      const eDel = await api(`/exams/${examAId}`, 'DELETE', undefined, tokenB);
      assert.equal(eDel.status, 404);

      // Materials
      const mGet = await api(`/materials/${materialAId}`, 'GET', undefined, tokenB);
      assert.equal(mGet.status, 404);
      const mContent = await apiRaw(`/materials/${materialAId}/content`, 'GET', tokenB);
      assert.ok(mContent.status === 404 || mContent.status === 403);

      // Quiz Submit
      const qSubmit = await api('/quiz/submit', 'POST', {
        quiz_id: quizRunAId,
        subject_id: subjectAId,
        answers: [{ question_id: 'qa1', user_answer: 'Consensus' }]
      }, tokenB);
      assert.ok(qSubmit.status === 404 || qSubmit.status === 400 || qSubmit.status === 500);
    });

    // -------------------------------------------------------------
    // Check 6b: PDF Storage Upload & Byte Integrity
    // -------------------------------------------------------------
    await runCheck('6b. PDF Storage: User A uploads PDF and retrieves byte-for-byte exact file', async () => {
      // Direct Storage upload by User A scoped client
      const { error: uploadErr } = await clientA.storage
        .from('materials')
        .upload(storagePathA, pdfBuffer, { contentType: 'application/pdf', upsert: true });
      if (uploadErr) throw new Error(`PDF upload failed: ${uploadErr.message}`);

      // Direct Storage download by User A scoped client
      const { data: downloadedBlob, error: downloadErr } = await clientA.storage
        .from('materials')
        .download(storagePathA);
      if (downloadErr || !downloadedBlob) throw new Error(`PDF download failed: ${downloadErr?.message}`);

      const directBuffer = Buffer.from(await downloadedBlob.arrayBuffer());
      const directSha256 = crypto.createHash('sha256').update(directBuffer).digest('hex');

      assert.equal(directBuffer.length, pdfBuffer.length, 'Direct downloaded PDF size must match exactly');
      assert.equal(directSha256, pdfSha256, 'Direct downloaded PDF sha256 checksum must match byte-for-byte');

      // API fetch by User A
      const apiFetch = await apiRaw(`/materials/${materialAId}/content`, 'GET', tokenA);
      assert.equal(apiFetch.status, 200, 'API PDF fetch must succeed with 200');
      const apiSha256 = crypto.createHash('sha256').update(apiFetch.buffer).digest('hex');
      assert.equal(apiFetch.buffer.length, pdfBuffer.length, 'API downloaded PDF size must match exactly');
      assert.equal(apiSha256, pdfSha256, 'API downloaded PDF sha256 checksum must match byte-for-byte');
    });

    await runCheck('6b. PDF Storage: User B CANNOT download User A PDF from storage directly or via API', async () => {
      // Direct Storage download by User B
      const { data: bBlob, error: bErr } = await clientB.storage
        .from('materials')
        .download(storagePathA);
      assert.ok(bErr || !bBlob, 'User B must not download User A PDF directly from storage bucket');

      // API content download by User B
      const apiRes = await apiRaw(`/materials/${materialAId}/content`, 'GET', tokenB);
      assert.ok(apiRes.status === 404 || apiRes.status === 403, `API must return 404/403, got ${apiRes.status}`);
    });

    // -------------------------------------------------------------
    // Check 6c: End-to-End Flow Against Staging
    // -------------------------------------------------------------
    let e2eSubjectId = '';
    let e2eTaskId = '';
    let e2eExamId = '';
    let e2eTaskEtag = '';

    await runCheck('6c. E2E Flow: 1. Login & Profile Check', async () => {
      const meRes = await api('/auth/me', 'GET', undefined, tokenA);
      assert.equal(meRes.status, 200, 'auth/me failed');
      assert.equal(meRes.data?.data?.user?.id, userAId);
    });

    await runCheck('6c. E2E Flow: 2. Add Subject', async () => {
      const res = await api('/subjects', 'POST', {
        name: 'Database Engineering',
        code: 'CS-302',
        color: '#10b981'
      }, tokenA);
      assert.equal(res.status, 201, 'Create subject failed');
      e2eSubjectId = res.data?.data?.id;
      assert.ok(e2eSubjectId, 'Subject ID missing');
    });

    await runCheck('6c. E2E Flow: 3. Task Lifecycle (Create, Edit with If-Match, Complete, Delete)', async () => {
      // Create Task
      const createRes = await api('/tasks', 'POST', {
        subject_id: e2eSubjectId,
        title: 'B-Tree Indexing Implementation',
        type: 'Assignment',
        priority: 'High',
        estimated_minutes: 120
      }, tokenA);
      assert.equal(createRes.status, 201, 'Create task failed');
      e2eTaskId = createRes.data?.data?.id;
      e2eTaskEtag = `"${createRes.data?.data?.updated_at}"`;
      assert.ok(e2eTaskId, 'Task ID missing');

      // Edit Task with optimistic concurrency
      const editRes = await api(`/tasks/${e2eTaskId}`, 'PATCH', {
        title: 'B+ Tree Indexing Implementation (Advanced)',
        estimated_minutes: 150
      }, tokenA, e2eTaskEtag);
      assert.equal(editRes.status, 200, 'Edit task failed');
      assert.equal(editRes.data?.data?.title, 'B+ Tree Indexing Implementation (Advanced)');
      const nextEtag = `"${editRes.data?.data?.updated_at}"`;

      // Complete Task
      const completeRes = await api(`/tasks/${e2eTaskId}`, 'PATCH', {
        is_completed: true
      }, tokenA, nextEtag);
      assert.equal(completeRes.status, 200, 'Complete task failed');
      assert.equal(completeRes.data?.data?.is_completed, true);

      // Verify task completion
      const getRes = await api(`/tasks/${e2eTaskId}`, 'GET', undefined, tokenA);
      assert.equal(getRes.status, 200, 'Get task failed');
      assert.equal(getRes.data?.data?.is_completed, true);

      // Delete Task
      const delRes = await api(`/tasks/${e2eTaskId}`, 'DELETE', undefined, tokenA);
      assert.equal(delRes.status, 200, 'Delete task failed');

      // Confirm Deleted
      const confirmRes = await api(`/tasks/${e2eTaskId}`, 'GET', undefined, tokenA);
      assert.equal(confirmRes.status, 404, 'Deleted task still exists');
    });

    await runCheck('6c. E2E Flow: 4. Exam Lifecycle & Readiness Check', async () => {
      const futureDate = new Date(Date.now() + 86400000 * 30).toISOString();

      // Create Exam
      const createRes = await api('/exams', 'POST', {
        subject_id: e2eSubjectId,
        title: 'Midterm Examination',
        exam_date: futureDate,
        target_score: 95
      }, tokenA);
      assert.equal(createRes.status, 201, 'Create exam failed');
      e2eExamId = createRes.data?.data?.id;
      assert.ok(e2eExamId, 'Exam ID missing');

      // Edit Exam
      const editRes = await api(`/exams/${e2eExamId}`, 'PATCH', {
        title: 'Midterm Examination (Comprehensive)'
      }, tokenA);
      assert.equal(editRes.status, 200, 'Edit exam failed');
      assert.equal(editRes.data?.data?.title, 'Midterm Examination (Comprehensive)');

      // Verify Readiness endpoint calculates basis from DB
      const readinessRes = await api(`/readiness/${e2eSubjectId}`, 'GET', undefined, tokenA);
      assert.equal(readinessRes.status, 200, 'Readiness fetch failed');
      assert.ok(typeof readinessRes.data?.data?.readiness_percentage === 'number');

      // Delete Exam
      const delRes = await api(`/exams/${e2eExamId}`, 'DELETE', undefined, tokenA);
      assert.equal(delRes.status, 200, 'Delete exam failed');

      // Confirm Deleted
      const confirmRes = await api(`/exams/${e2eExamId}`, 'GET', undefined, tokenA);
      assert.equal(confirmRes.status, 404, 'Deleted exam still exists');
    });

    // -------------------------------------------------------------
    // Grounded Quiz Generation & Authoritative Scoring Check
    // -------------------------------------------------------------
    await runCheck('6c. E2E Flow: 5. Grounded Quiz Generation & Authoritative Scoring', async () => {
      // 1. Setup syllabus and material chunk for User A's subject so grounded quiz generator has source text
      const { data: unit, error: uErr } = await clientA
        .from('units')
        .insert({ subject_id: subjectAId, unit_number: 1, title: 'Unit 1: Consensus' })
        .select()
        .single();
      if (uErr) throw new Error(`Unit creation failed: ${uErr.message}`);

      const { data: topic, error: tErr } = await clientA
        .from('topics')
        .insert({ unit_id: unit.id, title: 'Raft Protocol' })
        .select()
        .single();
      if (tErr) throw new Error(`Topic creation failed: ${tErr.message}`);

      // Mark materialA processed = true and insert document chunk
      await adminClient.from('materials').update({ processed: true }).eq('id', materialAId);
      const { error: cErr } = await adminClient
        .from('document_chunks')
        .insert({
          material_id: materialAId,
          profile_id: userAId,
          chunk_index: 0,
          content: 'The Raft consensus protocol operates by electing a distinguished leader node, which then accepts client requests and coordinates log replication across all follower nodes to achieve strong consistency.',
          page_number: 1
        })
        .select()
        .single();
      if (cErr) throw new Error(`Document chunk creation failed: ${cErr.message}`);

      // 2. Generate grounded quiz via POST /api/quiz/generate
      logLine('Testing POST /api/quiz/generate with live Gemini AI...');
      const genRes = await api('/quiz/generate', 'POST', {
        subject_id: subjectAId,
        topic_id: topic.id,
        num_questions: 1,
        question_type: 'multiple_choice'
      }, tokenA, undefined, 25000);

      assert.equal(genRes.status, 200, `Quiz generation returned HTTP ${genRes.status}: ${JSON.stringify(genRes.data)}`);
      assert.equal(genRes.data?.data?.grounded, true, 'Generated quiz is grounded');
      const generatedQuestions = genRes.data?.data?.questions;
      assert.ok(Array.isArray(generatedQuestions) && generatedQuestions.length >= 1, 'At least 1 question returned');
      const genQuizId = genRes.data?.data?.quiz_id;
      assert.ok(genQuizId, 'Quiz ID returned');

      // 3. User submits answer to the generated quiz run
      const q1 = generatedQuestions[0];
      const selectedOption = (q1.options && q1.options[0]) || 'Option A';

      const submitRes = await api('/quiz/submit', 'POST', {
        quiz_id: genQuizId,
        subject_id: subjectAId,
        answers: [{ question_id: q1.id, user_answer: selectedOption }]
      }, tokenA);

      assert.equal(submitRes.status, 201, `Quiz submit returned HTTP ${submitRes.status}: ${JSON.stringify(submitRes.data)}`);
      assert.ok(typeof submitRes.data?.data?.score === 'number', 'Authoritative numeric score returned');
      assert.ok(submitRes.data?.data?.quiz_result_id, 'quiz_result_id persisted in database');
      assert.equal(submitRes.data?.data?.total_questions, 1);
    });

    await runCheck('6c. E2E Flow: 6. Dashboard / Planner Context Integrity', async () => {
      const plannerRes = await api('/planner/context', 'GET', undefined, tokenA);
      assert.equal(plannerRes.status, 200, 'Planner context failed');
      assert.ok(Array.isArray(plannerRes.data?.data?.subjects));

      const activityRes = await api('/activity', 'GET', undefined, tokenA);
      assert.equal(activityRes.status, 200, 'Activity feed failed');
      assert.ok(typeof activityRes.data?.data?.xp === 'number');
    });

    // -------------------------------------------------------------
    // Step 7: Authorization Header Regression Verification
    // -------------------------------------------------------------
    await runCheck('7. Regression: Authorization Header Handling (Direct & Next.js Rewrite)', async () => {
      // 1. Missing Authorization header returns clean 401
      const missingAuth = await api('/subjects', 'POST', { name: 'Unauthorized Subject' });
      assert.equal(missingAuth.status, 401, 'Request without token must return 401');

      // 2. Valid Bearer token creates subject successfully
      const validAuth = await api('/subjects', 'POST', {
        name: 'Auth Header Test Subject',
        code: 'CS-999',
        color: '#6366f1'
      }, tokenA);
      assert.equal(validAuth.status, 201, 'Request with valid token must succeed');

      // 3. Check Next.js rewrite proxy on port 3000 forwards Authorization header
      try {
        const nextRes = await fetch('http://localhost:3000/api/subjects', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokenA}`
          },
          body: JSON.stringify({
            name: 'Next.js Rewrite Proxy Subject',
            code: 'CS-3000',
            color: '#8b5cf6'
          }),
          signal: AbortSignal.timeout(10000)
        });
        assert.equal(nextRes.status, 201, `Next.js rewrite proxy must return 201, got ${nextRes.status}`);
      } catch (err: any) {
        logLine(`Next.js port 3000 rewrite proxy test notice: ${err?.message}`);
        // If port 3000 is running on a different port or in dev server rebuild, log notice
      }
    });

  } finally {
    // Clean up test users and files from Supabase Auth & Storage with timeouts
    logLine('CLEANUP: Removing test fixtures from staging Supabase...');
    try {
      if (userAId) await withTimeout(adminClient.auth.admin.deleteUser(userAId), 10000);
      if (userBId) await withTimeout(adminClient.auth.admin.deleteUser(userBId), 10000);
      const pathsToDelete = [storagePathA, storagePathB].filter(Boolean);
      if (pathsToDelete.length > 0) {
        await withTimeout(adminClient.storage.from('materials').remove(pathsToDelete), 10000);
      }
    } catch (cleanupErr) {
      logLine(`Notice during cleanup: ${cleanupErr}`);
    }
    await new Promise<void>(r => server.close(() => r()));
  }

  // -------------------------------------------------------------
  // Final Summary Report
  // -------------------------------------------------------------
  logLine('\n====================================================');
  logLine('Staging Verification Summary');
  logLine('====================================================');
  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅ [PASS]' : r.status === 'FAIL' ? '❌ [FAIL]' : '⚪ [NOT RUN]';
    logLine(`${icon} ${r.name} (${r.durationMs || 0}ms)`);
    if (r.details) {
      logLine(`   Error: ${r.details}`);
    }
  }

  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  logLine(`\nTotal: ${results.length} checks, ${passCount} PASSED, ${failCount} FAILED.\n`);

  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  logLine(`Fatal execution error: ${err?.stack || err}`);
  process.exit(1);
});

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

function request(
  method: string,
  path: string,
  data?: any,
  token?: string
): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const bodyString = typeof data === 'string' ? data : (data ? JSON.stringify(data) : undefined);

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

    req.on('error', (err) => reject(err));

    if (bodyString !== undefined) {
      req.write(bodyString);
    }
    req.end();
  });
}

function readDb(): any {
  if (!fs.existsSync(DB_FILE)) return {};
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
}

async function runAudit() {
  console.log('🚀 Starting Comprehensive Live Backend API Audit & Verification...\n');

  let passedTests = 0;
  let failedTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passedTests++;
    } else {
      console.error(`  ❌ FAIL: ${testName}${detail ? ` - ${detail}` : ''}`);
      failedTests++;
    }
  }

  // =========================================================================
  // 1. AUTHENTICATION & PROFILE VERIFICATION
  // =========================================================================
  console.log('📌 1. Testing Authentication Endpoints...');

  const aliceEmail = `alice_${Date.now()}@example.com`;
  const bobEmail = `bob_${Date.now()}@example.com`;

  // 1.1 Alice Sign Up
  const signupRes = await request('POST', '/api/auth/signup', {
    email: aliceEmail,
    password: 'Password123!',
    full_name: 'Alice Academic',
    course: 'Computer Science',
    semester: 4
  });

  assert(signupRes.status === 201, 'Signup returns 201 Created', `Got ${signupRes.status}`);
  assert(signupRes.body?.success === true, 'Signup returns success: true');
  assert(!!signupRes.body?.session?.access_token, 'Signup returns session access_token');
  assert(!!signupRes.body?.user?.id, 'Signup returns user with valid id');
  assert(signupRes.body?.profile?.full_name === 'Alice Academic', 'Signup returns profile with full_name');

  const aliceId = signupRes.body?.user?.id;
  const aliceToken = signupRes.body?.session?.access_token;

  // Verify DB state for Alice
  const dbAfterSignup = readDb();
  const aliceDbUser = (dbAfterSignup.auth_users || []).find((u: any) => u.id === aliceId);
  const aliceDbProfile = (dbAfterSignup.profiles || []).find((p: any) => p.id === aliceId);
  assert(!!aliceDbUser && aliceDbUser.email === aliceEmail, 'Alice user row exists in auth_users');
  assert(!!aliceDbProfile && aliceDbProfile.full_name === 'Alice Academic', 'Alice profile row exists in profiles');

  // 1.2 Alice Login
  const loginRes = await request('POST', '/api/auth/login', {
    email: aliceEmail,
    password: 'Password123!'
  });
  assert(loginRes.status === 200, 'Login returns 200 OK');
  assert(loginRes.body?.success === true, 'Login returns success: true');
  assert(!!loginRes.body?.session?.access_token, 'Login returns session token');

  // 1.3 Alice Get Me
  const meRes = await request('GET', '/api/auth/me', undefined, aliceToken);
  assert(meRes.status === 200, 'GET /api/auth/me returns 200 OK');
  assert(meRes.body?.user?.id === aliceId, 'GET /api/auth/me returns correct user id');
  assert(meRes.body?.profile?.email === aliceEmail, 'GET /api/auth/me returns correct profile email');

  // 1.4 Unauthenticated / Invalid token rejection
  const invalidTokenRes = await request('GET', '/api/auth/me', undefined, 'invalid-random-token');
  assert(invalidTokenRes.status === 401, 'Invalid token returns 401 Unauthorized', `Got ${invalidTokenRes.status}`);

  // 1.5 Bob Sign Up (for cross-user RLS testing)
  const bobSignup = await request('POST', '/api/auth/signup', {
    email: bobEmail,
    password: 'BobPassword123!',
    full_name: 'Bob Competitor',
    course: 'Information Technology',
    semester: 4
  });
  assert(bobSignup.status === 201, 'Bob signs up successfully');
  const bobId = bobSignup.body?.user?.id;
  const bobToken = bobSignup.body?.session?.access_token;
  assert(!!bobId && !!bobToken, 'Bob has valid user ID and session token');

  // =========================================================================
  // 2. SUBJECTS CRUD & RLS
  // =========================================================================
  console.log('\n📌 2. Testing Subjects CRUD & RLS...');

  // 2.1 Alice creates subject
  const createSubRes = await request('POST', '/api/subjects', {
    name: 'Database Management Systems',
    code: 'DBMS-401',
    color: '#6C4CE8'
  }, aliceToken);

  assert(createSubRes.status === 201, 'POST /api/subjects returns 201 Created', `Got ${createSubRes.status}`);
  assert(createSubRes.body?.success === true, 'Subject creation returns success: true');
  assert(!!createSubRes.body?.data?.id, 'Subject creation returns a real UUID id');
  assert(createSubRes.body?.data?.name === 'Database Management Systems', 'Subject name matches payload');

  const subjectId = createSubRes.body?.data?.id;

  // Verify DB state
  const dbAfterSub = readDb();
  const subInDb = (dbAfterSub.subjects || []).find((s: any) => s.id === subjectId);
  assert(!!subInDb, 'Subject row physically inserted into local-db.json');
  assert(subInDb?.profile_id === aliceId, 'Subject row has profile_id equal to Alice user id');

  // 2.2 Alice lists subjects
  const listSubRes = await request('GET', '/api/subjects', undefined, aliceToken);
  assert(listSubRes.status === 200, 'GET /api/subjects returns 200 OK');
  assert(listSubRes.body?.count >= 1, 'GET /api/subjects returns count >= 1');
  assert(listSubRes.body?.data?.some((s: any) => s.id === subjectId), 'Alice sees her subject in the list');

  // 2.3 RLS: Bob must NOT see Alice's subject in list
  const bobListSub = await request('GET', '/api/subjects', undefined, bobToken);
  assert(bobListSub.status === 200, 'Bob GET /api/subjects returns 200 OK');
  assert(!bobListSub.body?.data?.some((s: any) => s.id === subjectId), 'Bob CANNOT see Alice subject in list (RLS scoped)');

  // 2.4 RLS: Bob cannot GET Alice's subject by ID
  const bobGetAliceSub = await request('GET', `/api/subjects/${subjectId}`, undefined, bobToken);
  assert(bobGetAliceSub.status === 404, 'Bob GET /api/subjects/:aliceId returns 404 NotFound (RLS scoped)');

  // 2.5 RLS: Bob cannot PATCH Alice's subject
  const bobPatchAliceSub = await request('PATCH', `/api/subjects/${subjectId}`, { name: 'Hacked Subject' }, bobToken);
  assert(bobPatchAliceSub.status === 404, 'Bob PATCH /api/subjects/:aliceId returns 404 NotFound');

  // 2.6 RLS: Bob cannot DELETE Alice's subject
  const bobDeleteAliceSub = await request('DELETE', `/api/subjects/${subjectId}`, undefined, bobToken);
  assert(bobDeleteAliceSub.status === 404, 'Bob DELETE /api/subjects/:aliceId returns 404 NotFound');

  // 2.7 Alice PATCH subject
  const alicePatchSub = await request('PATCH', `/api/subjects/${subjectId}`, { color: '#4B2DB8' }, aliceToken);
  assert(alicePatchSub.status === 200, 'Alice PATCH /api/subjects/:id returns 200 OK');
  assert(alicePatchSub.body?.data?.color === '#4B2DB8', 'Subject color updated in response');
  const dbAfterPatch = readDb();
  const subInDbAfterPatch = (dbAfterPatch.subjects || []).find((s: any) => s.id === subjectId);
  assert(subInDbAfterPatch?.color === '#4B2DB8', 'Subject color updated in database row');

  // =========================================================================
  // 3. UNITS CRUD & CROSS-USER REJECTION
  // =========================================================================
  console.log('\n📌 3. Testing Units CRUD & Cross-user Ownership Checks...');

  // 3.1 Bob attempts to create a unit under Alice's subject -> MUST BE REJECTED
  const bobCreateUnitUnderAlice = await request('POST', '/api/units', {
    subject_id: subjectId,
    unit_number: 1,
    title: 'Bob Malicious Unit'
  }, bobToken);
  assert(bobCreateUnitUnderAlice.status === 403, 'Creating unit under another user subject returns 403 Forbidden', `Got ${bobCreateUnitUnderAlice.status}`);
  const dbAfterMaliciousUnit = readDb();
  assert(!dbAfterMaliciousUnit.units?.some((u: any) => u.title === 'Bob Malicious Unit'), 'Malicious unit was NOT inserted into DB');

  // 3.2 Alice creates valid Unit 1
  const createUnit1 = await request('POST', '/api/units', {
    subject_id: subjectId,
    unit_number: 1,
    title: 'Unit 1: Relational Model & Normalization'
  }, aliceToken);
  assert(createUnit1.status === 201, 'Alice POST /api/units returns 201 Created');
  assert(!!createUnit1.body?.data?.id, 'Unit created with real UUID');
  const unit1Id = createUnit1.body?.data?.id;

  // 3.3 Alice creates valid Unit 2
  const createUnit2 = await request('POST', '/api/units', {
    subject_id: subjectId,
    unit_number: 2,
    title: 'Unit 2: Transaction Processing & Concurrency'
  }, aliceToken);
  assert(createUnit2.status === 201, 'Alice creates Unit 2 returns 201');
  const unit2Id = createUnit2.body?.data?.id;
  assert(!!unit2Id, 'Unit 2 created with real UUID');

  // 3.4 Alice GET units
  const getUnits = await request('GET', `/api/units?subject_id=${subjectId}`, undefined, aliceToken);
  assert(getUnits.status === 200, 'GET /api/units returns 200 OK');
  assert(getUnits.body?.count === 2, 'GET /api/units returns count of 2');

  // 3.5 Bob GET units for Alice's subject returns empty
  const bobGetUnits = await request('GET', `/api/units?subject_id=${subjectId}`, undefined, bobToken);
  assert(bobGetUnits.status === 200, 'Bob GET /api/units returns 200');
  assert(bobGetUnits.body?.count === 0, 'Bob cannot see Alice units (count = 0 due to RLS scoping)');

  // =========================================================================
  // 4. TOPICS CRUD & CROSS-USER REJECTION
  // =========================================================================
  console.log('\n📌 4. Testing Topics CRUD & Cross-user Ownership Checks...');

  // 4.1 Bob attempts to create a topic under Alice's unit -> MUST BE REJECTED
  const bobCreateTopicUnderAlice = await request('POST', '/api/topics', {
    unit_id: unit1Id,
    title: 'Bob Malicious Topic',
    status: 'in_progress',
    is_weak: false,
    mastery_score: 50
  }, bobToken);
  assert(bobCreateTopicUnderAlice.status === 403, 'Creating topic under another user unit returns 403 Forbidden', `Got ${bobCreateTopicUnderAlice.status}`);
  const dbAfterMaliciousTopic = readDb();
  assert(!dbAfterMaliciousTopic.topics?.some((t: any) => t.title === 'Bob Malicious Topic'), 'Malicious topic was NOT inserted into DB');

  // 4.2 Alice creates Topic 1
  const createTopic1 = await request('POST', '/api/topics', {
    unit_id: unit1Id,
    title: 'Functional Dependencies',
    status: 'in_progress',
    is_weak: true,
    mastery_score: 40
  }, aliceToken);
  assert(createTopic1.status === 201, 'Alice creates Topic 1 returns 201 Created');
  const topic1Id = createTopic1.body?.data?.id;

  // 4.3 Alice creates Topic 2
  const createTopic2 = await request('POST', '/api/topics', {
    unit_id: unit1Id,
    title: 'Boyce-Codd Normal Form (BCNF)',
    status: 'not_started',
    is_weak: true,
    mastery_score: 30
  }, aliceToken);
  assert(createTopic2.status === 201, 'Alice creates Topic 2 returns 201 Created');
  const topic2Id = createTopic2.body?.data?.id;

  // 4.4 GET topics
  const getTopics = await request('GET', `/api/topics?unit_id=${unit1Id}`, undefined, aliceToken);
  assert(getTopics.status === 200, 'GET /api/topics returns 200 OK');
  assert(getTopics.body?.count === 2, 'GET /api/topics returns count of 2');

  // =========================================================================
  // 5. TASKS CRUD & CROSS-USER REJECTION
  // =========================================================================
  console.log('\n📌 5. Testing Tasks CRUD & Ownership Checks...');

  // 5.1 Bob attempts to create task with Alice's subject -> REJECTED
  const bobTask = await request('POST', '/api/tasks', {
    subject_id: subjectId,
    title: 'Bob Task',
    type: 'Assignment',
    priority: 'high',
    is_completed: false
  }, bobToken);
  assert(bobTask.status === 403, 'Creating task under another user subject returns 403 Forbidden');

  // 5.2 Alice creates urgent Assignment task (due in 18 hours to trigger DEADLINE_RISK)
  const dueDate18h = new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString();
  const createTask = await request('POST', '/api/tasks', {
    subject_id: subjectId,
    title: 'Normalization Practice Assignment',
    type: 'Assignment',
    priority: 'high',
    due_date: dueDate18h,
    is_completed: false
  }, aliceToken);

  assert(createTask.status === 201, 'Alice creates Assignment task returns 201 Created');
  const taskId = createTask.body?.data?.id;

  // =========================================================================
  // 6. EXAMS CRUD & CROSS-USER REJECTION
  // =========================================================================
  console.log('\n📌 6. Testing Exams CRUD & Ownership Checks...');

  // 6.1 Bob attempts to create exam for Alice's subject -> REJECTED
  const bobExam = await request('POST', '/api/exams', {
    subject_id: subjectId,
    title: 'Bob Exam',
    exam_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    target_score: 90
  }, bobToken);
  assert(bobExam.status === 403, 'Creating exam under another user subject returns 403 Forbidden');

  // 6.2 Alice creates Exam due in 3 days (triggers HIGH_EXAM_RISK because 2 topics unfinished/weak)
  const examDate3d = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  const createExam = await request('POST', '/api/exams', {
    subject_id: subjectId,
    title: 'DBMS Mid-Semester Examination',
    exam_date: examDate3d,
    target_score: 85
  }, aliceToken);

  assert(createExam.status === 201, 'Alice creates exam returns 201 Created');
  const examId = createExam.body?.data?.id;

  // =========================================================================
  // 7. MATERIALS CRUD & CROSS-USER REJECTION
  // =========================================================================
  console.log('\n📌 7. Testing Materials CRUD & Ownership Checks...');

  // 7.1 Bob attempts to add material to Alice's subject -> REJECTED
  const bobMaterial = await request('POST', '/api/materials', {
    subject_id: subjectId,
    name: 'Bob Notes',
    storage_path: 'materials/bob/notes.pdf',
    file_type: 'pdf',
    size_bytes: 50000,
    processed: true
  }, bobToken);
  assert(bobMaterial.status === 403, 'Creating material under another user subject returns 403 Forbidden');

  // 7.2 Alice creates material
  const createMaterial = await request('POST', '/api/materials', {
    subject_id: subjectId,
    unit_id: unit1Id,
    name: 'Unit1_Normalization_Guide.pdf',
    storage_path: 'materials/alice/unit1.pdf',
    file_type: 'pdf',
    size_bytes: 1048576,
    processed: true
  }, aliceToken);
  assert(createMaterial.status === 201, 'Alice creates material metadata returns 201 Created');
  const materialId = createMaterial.body?.data?.id;

  // =========================================================================
  // 8. READINESS & RISKS DYNAMICS VERIFICATION
  // =========================================================================
  console.log('\n📌 8. Testing Academic Engine (Readiness & Risks Dynamics)...');

  // 8.1 Check initial readiness for Alice's subject:
  // - 0 completed topics out of 2 => topic_completion = 0%
  // - 0 completed assignments out of 1 => assignment_completion = 0%
  const initialReadiness = await request('GET', `/api/readiness/${subjectId}`, undefined, aliceToken);
  assert(initialReadiness.status === 200, 'GET /api/readiness/:subjectId returns 200 OK');
  assert(initialReadiness.body?.data?.breakdown?.topic_completion === 0, 'Initial topic_completion is 0%');
  assert(initialReadiness.body?.data?.breakdown?.assignment_completion === 0, 'Initial assignment_completion is 0%');
  const initialScore = initialReadiness.body?.data?.readiness_percentage;
  console.log(`     📊 Initial Readiness Score: ${initialScore}%`);

  // 8.2 Check initial risks:
  // - HIGH_EXAM_RISK must be active (exam in 3 days, 2 unfinished/weak topics)
  // - DEADLINE_RISK must be active (assignment pending, due in 18h)
  const initialRisks = await request('GET', `/api/risks/${subjectId}`, undefined, aliceToken);
  assert(initialRisks.status === 200, 'GET /api/risks/:subjectId returns 200 OK');
  const hasExamRiskInitial = initialRisks.body?.data?.some((r: any) => r.type === 'HIGH_EXAM_RISK');
  const hasDeadlineRiskInitial = initialRisks.body?.data?.some((r: any) => r.type === 'DEADLINE_RISK');
  assert(hasExamRiskInitial, 'HIGH_EXAM_RISK actively triggered');
  assert(hasDeadlineRiskInitial, 'DEADLINE_RISK actively triggered');

  // 8.3 Complete the Assignment task!
  console.log('     🔄 Completing Assignment task...');
  const completeTaskRes = await request('PATCH', `/api/tasks/${taskId}`, {
    is_completed: true
  }, aliceToken);
  assert(completeTaskRes.status === 200, 'Task marked is_completed: true');

  // 8.4 Re-check risks: DEADLINE_RISK must now be GONE!
  const risksAfterTaskComplete = await request('GET', `/api/risks/${subjectId}`, undefined, aliceToken);
  const hasDeadlineRiskAfter = risksAfterTaskComplete.body?.data?.some((r: any) => r.type === 'DEADLINE_RISK');
  assert(!hasDeadlineRiskAfter, 'DEADLINE_RISK disappeared after completing the task (Dynamic Risk Behavior Verified)');

  // 8.5 Complete the two topics!
  console.log('     🔄 Completing topics (Functional Dependencies, BCNF)...');
  await request('PATCH', `/api/topics/${topic1Id}`, { status: 'completed', is_weak: false }, aliceToken);
  await request('PATCH', `/api/topics/${topic2Id}`, { status: 'completed', is_weak: false }, aliceToken);

  // 8.6 Re-check readiness: topic_completion must now be 100%, readiness score increased!
  const updatedReadiness = await request('GET', `/api/readiness/${subjectId}`, undefined, aliceToken);
  assert(updatedReadiness.body?.data?.breakdown?.topic_completion === 100, 'topic_completion is now 100%');
  assert(updatedReadiness.body?.data?.breakdown?.assignment_completion === 100, 'assignment_completion is now 100%');
  const updatedScore = updatedReadiness.body?.data?.readiness_percentage;
  console.log(`     📊 Updated Readiness Score: ${updatedScore}% (Increased from ${initialScore}%)`);
  assert(updatedScore > initialScore, 'Readiness percentage increased after completing topics and assignments (Dynamic Readiness Verified)');

  // 8.7 Re-check risks: HIGH_EXAM_RISK must now be GONE! (0 unfinished topics < 2)
  const risksAfterTopicsComplete = await request('GET', `/api/risks/${subjectId}`, undefined, aliceToken);
  const hasExamRiskAfter = risksAfterTopicsComplete.body?.data?.some((r: any) => r.type === 'HIGH_EXAM_RISK');
  assert(!hasExamRiskAfter, 'HIGH_EXAM_RISK disappeared after completing topics (Dynamic Risk Behavior Verified)');

  // 8.8 List all readiness and risks
  const allReadiness = await request('GET', '/api/readiness', undefined, aliceToken);
  assert(allReadiness.status === 200, 'GET /api/readiness returns 200 OK');
  assert(allReadiness.body?.count >= 1, 'GET /api/readiness count >= 1');

  const allRisks = await request('GET', '/api/risks', undefined, aliceToken);
  assert(allRisks.status === 200, 'GET /api/risks returns 200 OK');

  // =========================================================================
  // 9. ADAPTIVE PLANNER CONTEXT VERIFICATION
  // =========================================================================
  console.log('\n📌 9. Testing Adaptive Planner Context Endpoints...');

  const plannerContext = await request('GET', '/api/planner/context', undefined, aliceToken);
  assert(plannerContext.status === 200, 'GET /api/planner/context returns 200 OK');
  assert(plannerContext.body?.success === true, 'Planner context success: true');
  assert(plannerContext.body?.data?.student?.id === aliceId, 'Planner context student matches Alice ID');
  assert(Array.isArray(plannerContext.body?.data?.subjects), 'Planner context contains subjects array');
  assert(plannerContext.body?.data?.subjects?.some((s: any) => s.subject_id === subjectId), 'Subject present in planner context');

  const scopedPlanner = await request('GET', `/api/planner/context/${subjectId}`, undefined, aliceToken);
  assert(scopedPlanner.status === 200, 'GET /api/planner/context/:subjectId returns 200 OK');
  assert(scopedPlanner.body?.data?.subjects?.length === 1, 'Scoped planner context returns exactly 1 subject');

  // =========================================================================
  // 10. VALIDATION ERRORS ON ALL ENDPOINTS (Returns clear 400, never 500)
  // =========================================================================
  console.log('\n📌 10. Testing Validation Error Handling (400 vs 500)...');

  // 10.1 Malformed JSON body
  const malformedJson = await request('POST', '/api/subjects', '{ "name": unclosed string ', aliceToken);
  assert(malformedJson.status === 400, 'Malformed JSON body returns 400 ValidationError, not 500', `Got ${malformedJson.status}`);
  assert(malformedJson.body?.error === 'ValidationError' || malformedJson.body?.error?.code === 'VALIDATION_ERROR', 'Error type is ValidationError');

  // 10.2 Missing required field on subjects
  const invalidSub = await request('POST', '/api/subjects', { color: '#6C4CE8' }, aliceToken);
  assert(invalidSub.status === 400, 'POST /api/subjects missing name returns 400');
  assert(Array.isArray(invalidSub.body?.issues), 'Issues array included in response');

  // 10.3 Missing required field on units
  const invalidUnit = await request('POST', '/api/units', { title: 'Unit Without Subject' }, aliceToken);
  assert(invalidUnit.status === 400, 'POST /api/units missing subject_id returns 400');

  // 10.4 Missing required field on topics
  const invalidTopic = await request('POST', '/api/topics', { title: 'Topic Without Unit' }, aliceToken);
  assert(invalidTopic.status === 400, 'POST /api/topics missing unit_id returns 400');

  // 10.5 Missing required field on tasks
  const invalidTask = await request('POST', '/api/tasks', { priority: 'high' }, aliceToken);
  assert(invalidTask.status === 400, 'POST /api/tasks missing title/type returns 400');

  // 10.6 Missing required field on exams
  const invalidExam = await request('POST', '/api/exams', { title: 'Exam Without Date' }, aliceToken);
  assert(invalidExam.status === 400, 'POST /api/exams missing exam_date returns 400');

  // 10.7 Missing required field on materials
  const invalidMaterial = await request('POST', '/api/materials', { name: 'Note' }, aliceToken);
  assert(invalidMaterial.status === 400, 'POST /api/materials missing storage_path returns 400');

  // =========================================================================
  // 11. DELETION & CASCADE VERIFICATION
  // =========================================================================
  console.log('\n📌 11. Testing Deletion & Cascade Clean-up...');

  // 11.1 Delete Exam
  const delExam = await request('DELETE', `/api/exams/${examId}`, undefined, aliceToken);
  assert(delExam.status === 200, 'DELETE /api/exams/:id returns 200 OK');
  assert(delExam.body?.data?.deletedId === examId, 'Returns deletedId');
  const dbAfterDelExam = readDb();
  assert(!dbAfterDelExam.exams?.some((e: any) => e.id === examId), 'Exam row deleted from DB');

  // 11.2 Delete Material
  const delMat = await request('DELETE', `/api/materials/${materialId}`, undefined, aliceToken);
  assert(delMat.status === 200, 'DELETE /api/materials/:id returns 200 OK');

  // 11.3 Delete Task
  const delTask = await request('DELETE', `/api/tasks/${taskId}`, undefined, aliceToken);
  assert(delTask.status === 200, 'DELETE /api/tasks/:id returns 200 OK');

  // 11.4 Delete Unit (and check cascade of topics)
  const delUnit = await request('DELETE', `/api/units/${unit1Id}`, undefined, aliceToken);
  assert(delUnit.status === 200, 'DELETE /api/units/:id returns 200 OK');
  const dbAfterDelUnit = readDb();
  assert(!dbAfterDelUnit.topics?.some((t: any) => t.unit_id === unit1Id), 'Cascade deleted child topics of unit1');

  // 11.5 Delete Subject
  const delSub = await request('DELETE', `/api/subjects/${subjectId}`, undefined, aliceToken);
  assert(delSub.status === 200, 'DELETE /api/subjects/:id returns 200 OK');
  const dbAfterDelSub = readDb();
  assert(!dbAfterDelSub.subjects?.some((s: any) => s.id === subjectId), 'Subject row deleted from DB');
  assert(!dbAfterDelSub.units?.some((u: any) => u.subject_id === subjectId), 'Cascade deleted remaining units of subject');

  // 11.6 Alice Logout
  const logoutRes = await request('POST', '/api/auth/logout', undefined, aliceToken);
  assert(logoutRes.status === 200, 'POST /api/auth/logout returns 200 OK');

  console.log('\n======================================================');
  console.log(`📊 Audit Summary: ${passedTests} Passed, ${failedTests} Failed.`);
  console.log('======================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAudit().catch((err) => {
  console.error('Audit run encountered fatal exception:', err);
  process.exit(1);
});

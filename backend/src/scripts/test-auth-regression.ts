interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

async function assert(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`  ✓ ${name}`);
  } catch (err: any) {
    results.push({ name, passed: false, error: err.message });
    console.error(`  ✗ ${name}: ${err.message}`);
  }
}

async function run() {
  console.log('--- Running Auth Bug & Authenticated Routes Regression Suite ---');

  const BASE_URL = 'http://localhost:4000/api';
  const email = `auth-test-${Date.now()}@example.com`;
  const password = 'Password123!';

  // 1. Unauthenticated request to /subjects returns clean 401
  await assert('Unauthenticated request to /subjects returns clean 401', async () => {
    const res = await fetch(`${BASE_URL}/subjects`);
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    const data: any = await res.json();
    if (!data.error && !data.message) throw new Error('Expected clean 401 error payload');
  });

  // 2. Malformed token returns clean 401
  await assert('Malformed or invalid token returns clean 401', async () => {
    const res = await fetch(`${BASE_URL}/subjects`, {
      headers: { 'Authorization': 'Bearer invalid-token-123' }
    });
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    const data: any = await res.json();
    if (data.message !== 'Invalid or expired session') {
      throw new Error(`Unexpected error message: ${data.message}`);
    }
  });

  // 3. Sign up user
  let token = '';
  let refreshToken = '';

  await assert('User can sign up and receives access and refresh tokens', async () => {
    const res = await fetch(`${BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, full_name: 'Auth Regression User' })
    });
    if (res.status !== 201) throw new Error(`Signup failed with status ${res.status}`);
    const json: any = await res.json();
    token = json.data?.session?.access_token;
    refreshToken = json.data?.session?.refresh_token;
    if (!token || !refreshToken) throw new Error('Missing tokens in signup response');
  });

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  });

  // 4. Verify all 7 authenticated calls after login:
  // (subjects, tasks, exams, materials, quiz, assistant, settings)
  let subjectId = '';
  await assert('1. Authenticated subjects call works after login', async () => {
    // Create subject
    const createRes = await fetch(`${BASE_URL}/subjects`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ name: 'Mathematics', code: 'MATH101', color: '#4f46e5' })
    });
    if (createRes.status !== 201) throw new Error(`Create subject failed: ${createRes.status}`);
    const createJson: any = await createRes.json();
    subjectId = createJson.data?.id;
    if (!subjectId) throw new Error('No subject id returned');

    // List subjects
    const listRes = await fetch(`${BASE_URL}/subjects`, { headers: authHeaders() });
    if (listRes.status !== 200) throw new Error(`List subjects failed: ${listRes.status}`);
    const listJson: any = await listRes.json();
    if (!Array.isArray(listJson.data) || listJson.data.length === 0) throw new Error('Subjects list empty');
  });

  let taskId = '';
  await assert('2. Authenticated tasks call works after login', async () => {
    const res = await fetch(`${BASE_URL}/tasks`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ title: 'Complete Problem Set 1', subject_id: subjectId, priority: 'High' })
    });
    if (res.status !== 201) throw new Error(`Create task failed: ${res.status}`);
    const json: any = await res.json();
    taskId = json.data?.id;
    if (!taskId) throw new Error('No task id returned');

    const listRes = await fetch(`${BASE_URL}/tasks`, { headers: authHeaders() });
    if (listRes.status !== 200) throw new Error(`List tasks failed: ${listRes.status}`);
  });

  let examId = '';
  await assert('3. Authenticated exams call works after login', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 7).toISOString();
    const res = await fetch(`${BASE_URL}/exams`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ title: 'Midterm Exam', subject_id: subjectId, exam_date: futureDate, target_score: 85 })
    });
    if (res.status !== 201) throw new Error(`Create exam failed: ${res.status}`);
    const json: any = await res.json();
    examId = json.data?.id;
    if (!examId) throw new Error('No exam id returned');

    const listRes = await fetch(`${BASE_URL}/exams`, { headers: authHeaders() });
    if (listRes.status !== 200) throw new Error(`List exams failed: ${listRes.status}`);
  });

  await assert('4. Authenticated materials call works after login', async () => {
    const res = await fetch(`${BASE_URL}/materials`, { headers: authHeaders() });
    if (res.status !== 200) throw new Error(`List materials failed: ${res.status}`);
  });

  await assert('5. Authenticated quiz call works after login', async () => {
    // Generate or list quiz
    const res = await fetch(`${BASE_URL}/quiz/generate`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ subject_id: subjectId, num_questions: 3 })
    });
    // In local dev without materials/Gemini, might return 200 or 400/422 validation, but NOT 401 Unauthorized
    if (res.status === 401) throw new Error('Quiz endpoint returned 401 Unauthorized for authenticated user');
  });

  await assert('6. Authenticated assistant call works after login', async () => {
    const res = await fetch(`${BASE_URL}/assistant/chat`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ message: 'Hello assistant', history: [] })
    });
    if (res.status === 401) throw new Error('Assistant chat returned 401 Unauthorized for authenticated user');
  });

  await assert('7. Authenticated settings/profile call works after login', async () => {
    const meRes = await fetch(`${BASE_URL}/auth/me`, { headers: authHeaders() });
    if (meRes.status !== 200) throw new Error(`Auth me failed: ${meRes.status}`);

    const patchRes = await fetch(`${BASE_URL}/auth/me`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ course: 'Computer Science', semester: 5 })
    });
    if (patchRes.status !== 200) throw new Error(`Update settings failed: ${patchRes.status}`);
  });

  // 5. Reload simulation: Token restored from store continues to work
  await assert('Token restored on reload works for all operations', async () => {
    // Simulate reading saved token from storage
    const restoredToken = token;
    const restoredHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${restoredToken}`
    };

    const res = await fetch(`${BASE_URL}/subjects`, { headers: restoredHeaders });
    if (res.status !== 200) throw new Error(`Failed to load subjects with restored token: ${res.status}`);
    const json: any = await res.json();
    if (!json.data.some((s: any) => s.id === subjectId)) {
      throw new Error('Restored token cannot see previously created subject');
    }
  });

  // 6. Token refresh flow works
  await assert('Refresh token successfully issues new access token', async () => {
    const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken })
    });
    if (refreshRes.status !== 200) throw new Error(`Refresh failed: ${refreshRes.status}`);
    const refreshJson: any = await refreshRes.json();
    const newToken = refreshJson.data?.session?.access_token;
    if (!newToken) throw new Error('No new access token issued on refresh');

    // Use new token
    const testRes = await fetch(`${BASE_URL}/subjects`, {
      headers: { 'Authorization': `Bearer ${newToken}` }
    });
    if (testRes.status !== 200) throw new Error(`New token failed on subjects request: ${testRes.status}`);
  });

  // 7. Expired / revoked token returns clean 401
  await assert('Expired token returns clean 401', async () => {
    const expiredRes = await fetch(`${BASE_URL}/subjects`, {
      headers: { 'Authorization': 'Bearer expired-or-invalid-jwt' }
    });
    if (expiredRes.status !== 401) throw new Error(`Expected 401, got ${expiredRes.status}`);
  });

  console.log(`\nResults: ${results.filter(r => r.passed).length}/${results.length} passed.`);
  const failed = results.filter(r => !r.passed);
  if (failed.length > 0) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});

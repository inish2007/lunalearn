/**
 * LunaLearn — Phase 6 End-to-End Backend Loop Verification Suite
 * Verifies the complete academic feedback loop:
 * 1. Initial State: Demo dataset seeded (DBMS, exam in 6d, 5 topics, pending assignment, 75% quiz).
 * 2. Topic Feedback Loop: Adding or completing a topic changes the mathematical readiness score.
 * 3. Risk Feedback Loop: Adding a task or exam changes the risk alerts (HIGH_EXAM_RISK, DEADLINE_RISK, WORKLOAD_RISK).
 * 4. Quiz Feedback Loop: Posting a quiz result changes readiness immediately on the next read and triggers performance risk if scores fall.
 * 5. Adaptive Planner Loop: Verifies that GET /api/planner/context reflects all real-time changes in a single call.
 */

import { AcademicEngineService } from '../services/academic-engine.service.js';
import { PlannerContextService } from '../services/planner-context.service.js';
import { DEMO_PROFILE_ID, DEMO_SUBJECT_ID } from './seed-demo.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`   ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`   ❌ FAIL: ${message}`);
    failed++;
  }
}

/**
 * Creates an in-memory mutable store that perfectly simulates Supabase query chaining
 * (select, eq, in, is, order, limit, insert, update, delete).
 */
export function createMutableStore() {
  const tables: Record<string, any[]> = {
    profiles: [],
    subjects: [],
    units: [],
    topics: [],
    exams: [],
    tasks: [],
    quiz_results: [],
    study_sessions: []
  };

  function createQuery(tableName: string) {
    let currentData = [...(tables[tableName] || [])];

    const query: any = {
      select: (_fields?: string) => query,
      eq: (col: string, val: any) => {
        currentData = currentData.filter(row => row[col] === val);
        return query;
      },
      in: (col: string, vals: any[]) => {
        currentData = currentData.filter(row => vals.includes(row[col]));
        return query;
      },
      is: (col: string, val: any) => {
        currentData = currentData.filter(row => row[col] === val);
        return query;
      },
      order: (col: string, opts?: { ascending?: boolean }) => {
        const asc = opts?.ascending !== false;
        currentData.sort((a, b) => {
          if (a[col] < b[col]) return asc ? -1 : 1;
          if (a[col] > b[col]) return asc ? 1 : -1;
          return 0;
        });
        return query;
      },
      limit: (n: number) => {
        currentData = currentData.slice(0, n);
        return query;
      },
      maybeSingle: () => Promise.resolve({ data: currentData[0] || null }),
      then: (resolve: any, reject?: any) => Promise.resolve({ data: currentData }).then(resolve, reject),
      // Mutation methods
      insert: (rows: any | any[]) => {
        const arr = Array.isArray(rows) ? rows : [rows];
        tables[tableName].push(...arr);
        return {
          select: () => ({
            maybeSingle: () => Promise.resolve({ data: arr[0] }),
            then: (resolve: any) => resolve({ data: arr })
          }),
          then: (resolve: any) => resolve({ data: arr })
        };
      },
      upsert: (rows: any | any[]) => {
        const arr = Array.isArray(rows) ? rows : [rows];
        for (const item of arr) {
          const idx = tables[tableName].findIndex(r => r.id === item.id);
          if (idx >= 0) tables[tableName][idx] = { ...tables[tableName][idx], ...item };
          else tables[tableName].push(item);
        }
        return {
          select: () => ({
            maybeSingle: () => Promise.resolve({ data: arr[0] })
          }),
          then: (resolve: any) => resolve({ data: arr })
        };
      },
      update: (patch: Record<string, any>) => {
        return {
          eq: (col: string, val: any) => {
            for (let i = 0; i < tables[tableName].length; i++) {
              if (tables[tableName][i][col] === val) {
                tables[tableName][i] = { ...tables[tableName][i], ...patch };
              }
            }
            return Promise.resolve({ data: tables[tableName].filter(r => r[col] === val) });
          }
        };
      },
      delete: () => {
        return {
          eq: (col: string, val: any) => {
            tables[tableName] = tables[tableName].filter(r => r[col] !== val);
            return Promise.resolve({ data: [] });
          },
          in: (col: string, vals: any[]) => {
            tables[tableName] = tables[tableName].filter(r => !vals.includes(r[col]));
            return Promise.resolve({ data: [] });
          }
        };
      }
    };

    return query;
  }

  return {
    _tables: tables,
    from: (table: string) => createQuery(table)
  };
}

async function runEndToEndVerification() {
  console.log('\n====================================================');
  console.log('🌙 LunaLearn — Phase 6 End-to-End Loop Verification');
  console.log('====================================================\n');

  const now = new Date();
  const db: any = createMutableStore();

  // ----------------------------------------------------------------------------
  // STEP 1: Seed initial demo dataset
  // ----------------------------------------------------------------------------
  console.log('1. Seeding Canonical Demo Dataset...');

  const examDate = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString(); // 6 days
  const taskDueDate = new Date(now.getTime() + 36 * 60 * 60 * 1000).toISOString(); // 36 hours

  await db.from('profiles').insert({
    id: DEMO_PROFILE_ID,
    full_name: 'Aarav Patel',
    course: 'Computer Science & Engineering',
    semester: 4,
    preferred_focus_time: 'Evening (5:30 PM - 8:30 PM)'
  });

  await db.from('subjects').insert({
    id: DEMO_SUBJECT_ID,
    profile_id: DEMO_PROFILE_ID,
    name: 'Database Management Systems',
    code: 'CS-401',
    color: '#4B2DB8'
  });

  await db.from('units').insert([
    { id: 'u1', subject_id: DEMO_SUBJECT_ID, unit_number: 1, title: 'Data Modeling & Relational Languages' },
    { id: 'u2', subject_id: DEMO_SUBJECT_ID, unit_number: 2, title: 'Relational Database Design & Normalization' },
    { id: 'u3', subject_id: DEMO_SUBJECT_ID, unit_number: 3, title: 'Transaction Processing & Indexing' }
  ]);

  // Topics: SQL (strong), ER Model (strong), Normalization (weak), Transactions (weak), Indexing (partial)
  await db.from('topics').insert([
    { id: 't-sql', unit_id: 'u1', title: 'SQL', status: 'completed', is_weak: false, mastery_score: 90 },
    { id: 't-er', unit_id: 'u1', title: 'ER Model', status: 'completed', is_weak: false, mastery_score: 88 },
    { id: 't-norm', unit_id: 'u2', title: 'Normalization', status: 'in_progress', is_weak: true, mastery_score: 45 },
    { id: 't-tx', unit_id: 'u3', title: 'Transactions', status: 'in_progress', is_weak: true, mastery_score: 40 },
    { id: 't-idx', unit_id: 'u3', title: 'Indexing', status: 'in_progress', is_weak: false, mastery_score: 60 }
  ]);

  await db.from('exams').insert({
    id: 'exam-1',
    profile_id: DEMO_PROFILE_ID,
    subject_id: DEMO_SUBJECT_ID,
    title: 'DBMS Mid-semester',
    exam_date: examDate,
    target_score: 85.0
  });

  await db.from('tasks').insert({
    id: 'task-1',
    profile_id: DEMO_PROFILE_ID,
    subject_id: DEMO_SUBJECT_ID,
    title: 'Normalization Problem Set',
    type: 'Assignment',
    priority: 'High',
    due_date: taskDueDate,
    is_completed: false
  });

  await db.from('quiz_results').insert({
    id: 'quiz-1',
    profile_id: DEMO_PROFILE_ID,
    subject_id: DEMO_SUBJECT_ID,
    score: 75,
    total_questions: 10,
    correct_answers: 7,
    weak_topics_identified: ['Normalization'],
    created_at: now.toISOString()
  });

  await db.from('study_sessions').insert({
    id: 'session-1',
    profile_id: DEMO_PROFILE_ID,
    subject_id: DEMO_SUBJECT_ID,
    duration_minutes: 60,
    session_type: 'revision',
    started_at: now.toISOString()
  });

  // Read initial readiness
  const initialReadiness = await AcademicEngineService.getSubjectReadiness(db, DEMO_SUBJECT_ID);
  console.log(`   Initial Topic Completion: ${initialReadiness.breakdown.topic_completion}%`);
  console.log(`   Initial Quiz Performance: ${initialReadiness.breakdown.quiz_performance}%`);
  console.log(`   Initial Revision Activity: ${initialReadiness.breakdown.revision_activity}%`);
  console.log(`   Initial Assignment Completion: ${initialReadiness.breakdown.assignment_completion}%`);
  console.log(`   Initial Weighted Readiness: ${initialReadiness.readiness_percentage}%`);

  assert(initialReadiness.breakdown.topic_completion === 40, 'Initial topic completion is 2/5 = 40%');
  assert(initialReadiness.breakdown.quiz_performance === 75, 'Initial quiz performance is 75%');
  assert(initialReadiness.breakdown.revision_activity === 50, 'Initial revision activity is 60/120 min = 50%');
  assert(initialReadiness.breakdown.assignment_completion === 0, 'Initial assignment completion is 0/1 = 0%');
  // (40 * 0.40) + (75 * 0.30) + (50 * 0.20) + (0 * 0.10) = 16 + 22.5 + 10 + 0 = 48.5 => 49%
  assert(initialReadiness.readiness_percentage === 49, 'Initial weighted readiness accurately evaluates to 49%');

  // Verify initial risks:
  // 1. HIGH_EXAM_RISK: Exam in 6 days and 3 topics unfinished/weak (Normalization, Transactions, Indexing)
  // 2. DEADLINE_RISK: Assignment due in 36 hours
  const initialRisks = initialReadiness.risks;
  const hasHighExamRisk = initialRisks.some(r => r.type === 'HIGH_EXAM_RISK');
  const hasDeadlineRisk = initialRisks.some(r => r.type === 'DEADLINE_RISK');
  assert(hasHighExamRisk, 'Initial state fires HIGH_EXAM_RISK (exam in 6d, 3 incomplete/weak topics)');
  assert(hasDeadlineRisk, 'Initial state fires DEADLINE_RISK (pending assignment due in 36h)');

  // ----------------------------------------------------------------------------
  // STEP 2: Topic Feedback Loop (Adding or completing a topic changes readiness)
  // ----------------------------------------------------------------------------
  console.log('\n2. Verifying Topic Feedback Loop...');

  // A. Complete topic 'Indexing'
  await db.from('topics').update({ status: 'completed', is_weak: false, mastery_score: 85 }).eq('id', 't-idx');
  const afterCompleteTopic = await AcademicEngineService.getSubjectReadiness(db, DEMO_SUBJECT_ID);
  console.log(`   Readiness after completing 'Indexing': ${afterCompleteTopic.readiness_percentage}% (was 49%)`);
  assert(
    afterCompleteTopic.readiness_percentage > initialReadiness.readiness_percentage,
    'Completing a topic immediately increases readiness score'
  );
  assert(
    afterCompleteTopic.breakdown.topic_completion === 60,
    'Topic completion jumped from 40% to 60% (3/5 completed)'
  );
  // (60 * 0.40) + 22.5 + 10 = 24 + 22.5 + 10 = 56.5 => 57%
  assert(afterCompleteTopic.readiness_percentage === 57, 'Weighted readiness correctly recalculated to 57%');

  // B. Add a new unfinished topic 'Query Optimization'
  await db.from('topics').insert({
    id: 't-opt',
    unit_id: 'u3',
    title: 'Query Optimization',
    status: 'not_started',
    is_weak: false,
    mastery_score: 0
  });
  const afterAddTopic = await AcademicEngineService.getSubjectReadiness(db, DEMO_SUBJECT_ID);
  console.log(`   Readiness after adding unfinished topic: ${afterAddTopic.readiness_percentage}% (was 57%)`);
  assert(
    afterAddTopic.readiness_percentage < afterCompleteTopic.readiness_percentage,
    'Adding an unfinished syllabus topic changes readiness proportionally'
  );
  assert(
    afterAddTopic.breakdown.topic_completion === 50,
    'Topic completion updated to 3/6 = 50%'
  );
  // (50 * 0.40) + 22.5 + 10 = 20 + 22.5 + 10 = 52.5 => 53%
  assert(afterAddTopic.readiness_percentage === 53, 'Weighted readiness correctly recalculated to 53%');

  // ----------------------------------------------------------------------------
  // STEP 3: Risk Feedback Loop (Adding task/exam changes risk alerts)
  // ----------------------------------------------------------------------------
  console.log('\n3. Verifying Risk Feedback Loop...');

  // A. Add a 2nd competing assignment due on the exact same date to trigger WORKLOAD_RISK
  await db.from('tasks').insert({
    id: 'task-2',
    profile_id: DEMO_PROFILE_ID,
    subject_id: DEMO_SUBJECT_ID,
    title: 'Transactions Concurrency Lab',
    type: 'Assignment',
    priority: 'Medium',
    due_date: taskDueDate, // exactly same calendar date as task-1
    is_completed: false
  });

  const risksAfterCompTask = await AcademicEngineService.evaluateSubjectRisks(db, DEMO_SUBJECT_ID);
  const workloadRisk = risksAfterCompTask.find(r => r.type === 'WORKLOAD_RISK');
  assert(workloadRisk !== undefined, 'Adding a task on the same date triggers WORKLOAD_RISK');
  assert(
    Boolean(workloadRisk?.reason.includes('competing deadlines coincide')),
    'WORKLOAD_RISK includes informative human-readable reason'
  );

  // B. Mark both assignments as completed
  await db.from('tasks').update({ is_completed: true }).eq('id', 'task-1');
  await db.from('tasks').update({ is_completed: true }).eq('id', 'task-2');

  const risksAfterCompleteTasks = await AcademicEngineService.evaluateSubjectRisks(db, DEMO_SUBJECT_ID);
  const deadlineRiskAfter = risksAfterCompleteTasks.find(r => r.type === 'DEADLINE_RISK');
  const workloadRiskAfter = risksAfterCompleteTasks.find(r => r.type === 'WORKLOAD_RISK');
  assert(deadlineRiskAfter === undefined, 'Completing pending tasks clears DEADLINE_RISK');
  assert(workloadRiskAfter === undefined, 'Completing pending tasks clears WORKLOAD_RISK');

  // Also check that assignment completion jumped to 100%
  const readinessAfterTasks = await AcademicEngineService.getSubjectReadiness(db, DEMO_SUBJECT_ID);
  assert(
    readinessAfterTasks.breakdown.assignment_completion === 100,
    'Assignment completion jumps to 100% after completing all assignments'
  );

  // C. Mark remaining weak topics as completed & strong
  await db.from('topics').update({ status: 'completed', is_weak: false, mastery_score: 95 }).eq('id', 't-norm');
  await db.from('topics').update({ status: 'completed', is_weak: false, mastery_score: 90 }).eq('id', 't-tx');
  await db.from('topics').update({ status: 'completed', is_weak: false, mastery_score: 85 }).eq('id', 't-opt');

  const risksAfterMastery = await AcademicEngineService.evaluateSubjectRisks(db, DEMO_SUBJECT_ID);
  const examRiskAfter = risksAfterMastery.find(r => r.type === 'HIGH_EXAM_RISK');
  assert(
    examRiskAfter === undefined,
    'Mastering weak/unfinished topics clears HIGH_EXAM_RISK even with exam in 6 days'
  );

  // ----------------------------------------------------------------------------
  // STEP 4: Quiz Feedback Loop (Posting quiz result changes readiness immediately)
  // ----------------------------------------------------------------------------
  console.log('\n4. Verifying Quiz Feedback Loop...');

  const readinessBeforeQuiz = await AcademicEngineService.getSubjectReadiness(db, DEMO_SUBJECT_ID);

  // Post a new top-tier quiz attempt (score: 95%)
  await db.from('quiz_results').insert({
    id: 'quiz-2',
    profile_id: DEMO_PROFILE_ID,
    subject_id: DEMO_SUBJECT_ID,
    score: 95,
    total_questions: 10,
    correct_answers: 9,
    weak_topics_identified: [],
    created_at: new Date(now.getTime() + 1000).toISOString()
  });

  const readinessAfterGoodQuiz = await AcademicEngineService.getSubjectReadiness(db, DEMO_SUBJECT_ID);
  console.log(`   Quiz performance before: ${readinessBeforeQuiz.breakdown.quiz_performance}% (score: 75)`);
  console.log(`   Quiz performance after: ${readinessAfterGoodQuiz.breakdown.quiz_performance}% (scores: [95, 75] avg: 85)`);
  console.log(`   Readiness changed: ${readinessBeforeQuiz.readiness_percentage}% -> ${readinessAfterGoodQuiz.readiness_percentage}%`);

  assert(
    readinessAfterGoodQuiz.breakdown.quiz_performance === 85,
    'Quiz performance accurately recalculates average of [95, 75] = 85%'
  );
  assert(
    readinessAfterGoodQuiz.readiness_percentage > readinessBeforeQuiz.readiness_percentage,
    'Posting a high quiz score immediately increases subject readiness on next read'
  );

  // Now post a sharp drop in score (score: 35%) to test PERFORMANCE_RISK
  await db.from('quiz_results').insert({
    id: 'quiz-3',
    profile_id: DEMO_PROFILE_ID,
    subject_id: DEMO_SUBJECT_ID,
    score: 35,
    total_questions: 10,
    correct_answers: 3,
    weak_topics_identified: ['Transactions'],
    created_at: new Date(now.getTime() + 2000).toISOString()
  });

  const risksAfterDrop = await AcademicEngineService.evaluateSubjectRisks(db, DEMO_SUBJECT_ID);
  const perfRisk = risksAfterDrop.find(r => r.type === 'PERFORMANCE_RISK');
  assert(perfRisk !== undefined, 'Posting declining quiz score immediately triggers PERFORMANCE_RISK on next read');
  assert(
    Boolean(perfRisk?.reason.includes('declined') || perfRisk?.reason.includes('35%')),
    'PERFORMANCE_RISK explains why score dropped with human-readable rationale'
  );

  // ----------------------------------------------------------------------------
  // STEP 5: Adaptive Planner Single-Call Feedback Verification
  // ----------------------------------------------------------------------------
  console.log('\n5. Verifying Adaptive Planner Single-Call Context Feed...');

  const plannerContext = await PlannerContextService.getPlannerContext(db, DEMO_PROFILE_ID, DEMO_SUBJECT_ID);
  assert(plannerContext.subjects.length === 1, 'Planner context retrieved for DBMS');
  const dbmsCtx = plannerContext.subjects[0];

  assert(
    dbmsCtx.readiness_percentage === (await AcademicEngineService.getSubjectReadiness(db, DEMO_SUBJECT_ID)).readiness_percentage,
    'Planner context reflects identical real-time readiness calculation'
  );
  assert(
    dbmsCtx.recent_quiz_performance.length >= 2,
    'Planner context immediately includes recent quiz attempts'
  );
  assert(
    dbmsCtx.active_risks.some(r => r.type === 'PERFORMANCE_RISK'),
    'Planner context bundles active performance risk in one call'
  );

  console.log('\n====================================================');
  console.log(`Loop Verification Complete: ${passed} passed, ${failed} failed.`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runEndToEndVerification().catch(err => {
  console.error('Fatal error during E2E verification:', err);
  process.exit(1);
});

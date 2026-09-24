import { AcademicEngineService } from '../services/academic-engine.service.js';
import { AcademicRisk, ReadinessBreakdown } from '../types/database.js';

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

async function runEngineTests() {
  console.log('====================================================');
  console.log('🌙 LunaLearn — Phase 4 Academic Engine Tests');
  console.log('====================================================\n');

  console.log('1. Testing Pure Readiness Mathematical Formulas...');
  
  // Test perfect score
  const perfectBreakdown: ReadinessBreakdown = {
    topic_completion: 100,
    quiz_performance: 100,
    revision_activity: 100,
    assignment_completion: 100
  };
  const perfectResult = AcademicEngineService.calculateWeightedReadiness(perfectBreakdown);
  assert(perfectResult === 100, 'All 100% drivers produce 100% readiness');

  // Test zero score
  const zeroBreakdown: ReadinessBreakdown = {
    topic_completion: 0,
    quiz_performance: 0,
    revision_activity: 0,
    assignment_completion: 0
  };
  const zeroResult = AcademicEngineService.calculateWeightedReadiness(zeroBreakdown);
  assert(zeroResult === 0, 'All 0% drivers produce 0% readiness');

  // Test weighted formula: 62*0.4 + 55*0.3 + 48*0.2 + 80*0.1 = 24.8 + 16.5 + 9.6 + 8.0 = 58.9 => 59%
  const dbmsBreakdown: ReadinessBreakdown = {
    topic_completion: 62,
    quiz_performance: 55,
    revision_activity: 48,
    assignment_completion: 80
  };
  const dbmsResult = AcademicEngineService.calculateWeightedReadiness(dbmsBreakdown);
  assert(dbmsResult === 59, 'Weighted formula correctly produces 59% for DBMS baseline');

  // Test Topic Completion driver
  const topicsSample = [
    { status: 'completed' },
    { status: 'completed' },
    { status: 'in_progress' },
    { status: 'not_started' }
  ];
  const topicScore = AcademicEngineService.calculateTopicCompletion(topicsSample);
  assert(topicScore === 50, 'Topic completion correctly calculates 2/4 = 50%');

  // Test Quiz Performance driver
  const quizzesSample = [{ score: 80 }, { score: 60 }, { score: 70 }];
  const quizScore = AcademicEngineService.calculateQuizPerformance(quizzesSample);
  assert(quizScore === 70, 'Quiz performance correctly averages [80, 60, 70] to 70%');

  // Test Revision Activity driver (120 min = 100%)
  const sessionsSample = [{ duration_minutes: 60, session_type: 'focus' }, { duration_minutes: 30, session_type: 'revision' }];
  const revisionScore = AcademicEngineService.calculateRevisionActivity(sessionsSample);
  assert(revisionScore === 75, 'Revision activity correctly evaluates 90/120 min = 75%');

  // Test Assignment Completion driver
  const assignmentsSample = [{ is_completed: true }, { is_completed: false }];
  const assignmentScore = AcademicEngineService.calculateAssignmentCompletion(assignmentsSample);
  assert(assignmentScore === 50, 'Assignment completion correctly calculates 1/2 = 50%');

  // Empty assignment test (no debt = 100%)
  const noAssignments = AcademicEngineService.calculateAssignmentCompletion([]);
  assert(noAssignments === 100, 'No assignments returns 100% (no pending assignment debt)');

  console.log('\n2. Testing Reasoned Risk Rules Evaluation...');

  // Mock DB for Risk evaluation simulation
  const now = new Date();
  const sixDaysAway = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString();
  const tomorrow = new Date(now.getTime() + 20 * 60 * 60 * 1000).toISOString();

  const mockDb: any = {
    from: (table: string) => {
      if (table === 'exams') {
        return {
          select: () => ({
            eq: () => Promise.resolve({
              data: [
                {
                  id: 'exam-1',
                  subject_id: 'dbms-1',
                  title: 'DBMS Mid-semester',
                  exam_date: sixDaysAway
                }
              ]
            })
          })
        };
      }
      if (table === 'units') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: [{ id: 'unit-1' }] })
          })
        };
      }
      if (table === 'topics') {
        return {
          select: () => ({
            in: () => Promise.resolve({
              data: [
                { title: 'SQL', status: 'completed', is_weak: false },
                { title: 'Normalization', status: 'in_progress', is_weak: true },
                { title: 'Transactions', status: 'not_started', is_weak: true }
              ]
            })
          })
        };
      }
      if (table === 'tasks') {
        return {
          select: () => ({
            eq: (_field: string) => ({
              eq: () => Promise.resolve({
                data: [
                  {
                    id: 'task-1',
                    subject_id: 'dbms-1',
                    title: 'Normalize the library schema',
                    type: 'Assignment',
                    due_date: tomorrow,
                    is_completed: false
                  },
                  {
                    id: 'task-2',
                    subject_id: 'dbms-1',
                    title: 'Transaction states review',
                    type: 'Assignment',
                    due_date: tomorrow,
                    is_completed: false
                  }
                ]
              })
            })
          })
        };
      }
      if (table === 'quiz_results') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => Promise.resolve({
                  data: [
                    { score: 55, created_at: now.toISOString() },
                    { score: 75, created_at: now.toISOString() }
                  ]
                })
              })
            })
          })
        };
      }
      return { select: () => Promise.resolve({ data: [] }) };
    }
  };

  const risks: AcademicRisk[] = await AcademicEngineService.evaluateSubjectRisks(mockDb, 'dbms-1');

  // Verify HIGH_EXAM_RISK
  const examRisk = risks.find(r => r.type === 'HIGH_EXAM_RISK');
  assert(examRisk !== undefined, 'HIGH_EXAM_RISK fired for exam in 6 days with weak topics');
  assert(examRisk?.severity === 'high', 'HIGH_EXAM_RISK carries high severity');
  assert(
    Boolean(examRisk?.reason.includes("Exam 'DBMS Mid-semester'") && examRisk?.reason.includes('Normalization')),
    'HIGH_EXAM_RISK includes specific exam name and weak topic titles in human-readable reason'
  );

  // Verify DEADLINE_RISK
  const deadlineRisk = risks.find(r => r.type === 'DEADLINE_RISK');
  assert(deadlineRisk !== undefined, 'DEADLINE_RISK fired for pending assignment due tomorrow');
  assert(
    Boolean(deadlineRisk?.reason.includes('Normalize the library schema')),
    'DEADLINE_RISK specifies the pending assignment title and countdown'
  );

  // Verify PERFORMANCE_RISK (75 down to 55 => drop of 20%)
  const perfRisk = risks.find(r => r.type === 'PERFORMANCE_RISK');
  assert(perfRisk !== undefined, 'PERFORMANCE_RISK fired for 20% score drop');
  assert(
    Boolean(perfRisk?.reason.includes('declined by 20%')),
    'PERFORMANCE_RISK explicitly reports drop from 75% down to 55%'
  );

  // Verify WORKLOAD_RISK (two tasks due on the exact same date)
  const workloadRisk = risks.find(r => r.type === 'WORKLOAD_RISK');
  assert(workloadRisk !== undefined, 'WORKLOAD_RISK fired for 2 competing deadlines on the same date');
  assert(
    Boolean(workloadRisk?.reason.includes('competing deadlines coincide')),
    'WORKLOAD_RISK explains why deadlines conflict'
  );

  // Verify contract: every single risk must have type, reason, severity
  const allValidContracts = risks.every(r => r.type && r.reason && r.severity);
  assert(allValidContracts, 'All risk objects conform strictly to { type, reason, severity }');

  console.log('\n====================================================');
  console.log(`Results: ${passed} passed, ${failed} failed.`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runEngineTests().catch((err) => {
  console.error('Engine test execution error:', err);
  process.exit(1);
});

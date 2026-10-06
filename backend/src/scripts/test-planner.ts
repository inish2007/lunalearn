/**
 * LunaLearn — Phase 5 Adaptive Planner Context Test Suite
 * Tests the single unified planner payload endpoint that aggregates:
 * - Student availability & study time settings
 * - Per-subject upcoming exams & countdowns
 * - Weak and unfinished topics
 * - Pending assignments and tasks
 * - Recent quiz performance
 * - Pure mathematical readiness
 * - Reasoned academic risks
 */

import { ScheduleService } from '../services/schedule.service.js';
import { PlannerContextService } from '../services/planner-context.service.js';
import { PlannerContextResponse } from '../types/database.js';
import { AppError, ErrorCode } from '../types/errors.js';

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

async function runPlannerTests() {
  console.log('\n====================================================');
  console.log('🌙 LunaLearn — Phase 5 Adaptive Planner Context Tests');
  console.log('====================================================\n');

  const now = new Date();
  const examDate = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString();
  const taskDueDate = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const mockProfile = {
    id: 'student-1',
    full_name: 'Aarav Patel',
    course: 'Computer Science & Engineering',
    semester: 4,
    preferred_focus_time: 'Evening (5:30 PM - 8:30 PM)',
    available_hours_per_day: 1.5 as number | null
  };

  // Mock Supabase Client simulating full academic database
  const mockDb: any = {
    from: (table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({
                data: mockProfile
              })
            })
          })
        };
      }

      if (table === 'subjects') {
        return {
          select: () => ({
            order: () => Promise.resolve({
              data: [
                {
                  id: 'dbms-101',
                  name: 'Database Management Systems',
                  code: 'CS-401',
                  color: '#4B2DB8'
                }
              ]
            })
          })
        };
      }

      if (table === 'units') {
        return {
          select: () => ({
            eq: () => Promise.resolve({
              data: [
                { id: 'unit-1', title: 'Relational Model & Normalization' },
                { id: 'unit-2', title: 'Transaction Processing' }
              ]
            })
          })
        };
      }

      if (table === 'topics') {
        return {
          select: () => ({
            in: () => Promise.resolve({
              data: [
                { id: 'top-1', unit_id: 'unit-1', title: 'Functional Dependencies', status: 'completed', is_weak: false, mastery_score: 90, estimated_study_hours: null },
                { id: 'top-2', unit_id: 'unit-1', title: 'Boyce-Codd Normal Form', status: 'in_progress', is_weak: true, mastery_score: 45, estimated_study_hours: 2 },
                { id: 'top-3', unit_id: 'unit-2', title: 'ACID Properties', status: 'completed', is_weak: true, mastery_score: 55, estimated_study_hours: 3 },
                { id: 'top-4', unit_id: 'unit-2', title: 'Concurrency Control Protocols', status: 'not_started', is_weak: false, mastery_score: 0, estimated_study_hours: 4 }
              ]
            })
          })
        };
      }

      if (table === 'exams') {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({
                data: [
                  {
                    id: 'exam-1',
                    subject_id: 'dbms-101',
                    title: 'DBMS Mid-sem',
                    exam_date: examDate,
                    target_score: 85
                  }
                ]
              })
            })
          })
        };
      }

      if (table === 'tasks') {
        return {
          select: () => ({
            eq: (_field: string, _val: any) => ({
              eq: () => ({
                order: () => Promise.resolve({
                  data: [
                    {
                      id: 'task-1',
                      subject_id: 'dbms-101',
                      title: 'Schema Normalization Problem Set',
                      type: 'Assignment',
                      priority: 'High',
                      due_date: taskDueDate,
                      is_completed: false
                    }
                  ]
                })
              })
            }),
            is: () => ({
              eq: () => ({
                order: () => Promise.resolve({
                  data: [
                    {
                      id: 'task-gen-1',
                      subject_id: null,
                      title: 'Renew Library Book Borrowing',
                      type: 'Task',
                      priority: 'Low',
                      due_date: null,
                      is_completed: false
                    }
                  ]
                })
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
                    {
                      id: 'quiz-1',
                      subject_id: 'dbms-101',
                      score: 65,
                      total_questions: 10,
                      correct_answers: 6,
                      weak_topics_identified: ['Boyce-Codd Normal Form'],
                      created_at: now.toISOString()
                    }
                  ]
                })
              })
            })
          })
        };
      }

      if (table === 'study_sessions') {
        return {
          select: () => ({
            eq: () => Promise.resolve({
              data: [
                { duration_minutes: 60, session_type: 'revision' }
              ]
            })
          })
        };
      }

      return { select: () => Promise.resolve({ data: [] }) };
    }
  };

  console.log('1. Testing Unified Planner Context Aggregation...');

  const context: PlannerContextResponse = await PlannerContextService.getPlannerContext(
    mockDb,
    'student-1'
  );

  // Student Profile & Availability Verification
  assert(context.student.id === 'student-1', 'Student ID matched authenticated profile');
  assert(context.student.full_name === 'Aarav Patel', 'Student full name populated');
  assert(
    context.student.study_time_settings.preferred_focus_time === 'Evening (5:30 PM - 8:30 PM)',
    'Preferred focus time extracted from student settings'
  );
  assert(
    context.student.study_time_settings.daily_study_target_minutes === 90,
    'Daily study target target follows saved 1.5 hour availability (90 min)'
  );
  assert(
    context.student.study_time_settings.available_hours_per_day === 1.5,
    'Available study hours per day read from the student profile'
  );

  // Subject Planner Context
  assert(context.subjects.length === 1, 'Subject array populated');
  const dbms = context.subjects[0];
  assert(dbms.subject_name === 'Database Management Systems', 'Subject name correctly resolved');
  assert(dbms.subject_code === 'CS-401', 'Subject code correctly resolved');

  // Exam Dates & Countdowns
  assert(dbms.exams.length === 1, 'Exams array populated');
  assert(dbms.exams[0].title === 'DBMS Mid-sem', 'Exam title included');
  assert(dbms.exams[0].days_until_exam === 6, 'Countdown accurately calculates 6 days remaining');

  // Weak and Unfinished Topics Filtering
  // Expected:
  // - BCNF (in_progress, weak) -> included
  // - ACID (completed, but weak) -> included
  // - Concurrency (not_started) -> included
  // - Functional Dependencies (completed, not weak) -> excluded
  assert(
    dbms.weak_and_unfinished_topics.length === 3,
    'Filters out completed non-weak topics (3 weak/unfinished remain)'
  );
  const topicTitles = dbms.weak_and_unfinished_topics.map(t => t.title);
  assert(
    topicTitles.includes('Boyce-Codd Normal Form') &&
    topicTitles.includes('ACID Properties') &&
    topicTitles.includes('Concurrency Control Protocols'),
    'Weak or incomplete topics properly identified with unit metadata'
  );
  assert(
    dbms.weak_and_unfinished_topics.every(topic => topic.estimated_study_hours !== null),
    'Topic study-hour estimates are included in planner context'
  );

  // Pending Tasks & Assignments
  assert(dbms.pending_tasks.length === 1, 'Pending tasks populated');
  assert(
    dbms.pending_tasks[0].title === 'Schema Normalization Problem Set',
    'Pending assignment identified'
  );
  assert(
    dbms.pending_tasks[0].days_until_due === 1,
    'Days until due accurately calculated as 1 day'
  );

  // Recent Quiz Performance
  assert(dbms.recent_quiz_performance.length === 1, 'Recent quiz performance populated');
  assert(dbms.recent_quiz_performance[0].score === 65, 'Quiz score recorded');
  assert(
    dbms.recent_quiz_performance[0].weak_topics_identified.includes('Boyce-Codd Normal Form'),
    'Weak topics identified by quiz included'
  );

  // Readiness & Active Risks Attached Per Subject
  assert(typeof dbms.readiness_percentage === 'number', 'Mathematical readiness score attached');
  assert(Array.isArray(dbms.active_risks), 'Active reasoned risks attached');

  // General commitments & Global Risks
  assert(
    context.unassigned_pending_tasks.length === 1 &&
    context.unassigned_pending_tasks[0].title === 'Renew Library Book Borrowing',
    'Unassigned standalone student tasks captured'
  );
  assert(Array.isArray(context.global_risks), 'Global risk overview captured');
  assert(Boolean(context.generated_at), 'Timestamp generated');

  console.log('\n2. Testing Planner Capacity Constraints...');
  try { PlannerContextService.assertPlanFeasible(context); assert(false,'Missing task estimates must fail'); }
  catch(error) { assert(error instanceof AppError && error.code===ErrorCode.INSUFFICIENT_DATA,'Missing task estimates are surfaced'); }
  const ready = structuredClone(context);
  ready.student.study_time_settings.available_hours_per_day=4;
  ready.student.study_time_settings.focus_start='08:00';ready.student.study_time_settings.focus_end='20:00';
  for(const subject of ready.subjects)for(const task of subject.pending_tasks)task.estimated_minutes=10;
  for(const task of ready.unassigned_pending_tasks)task.estimated_minutes=10;
  ready.study_plan=ScheduleService.build(ready);
  PlannerContextService.assertPlanFeasible(ready);assert(true,'All estimated work fits shared availability');
  ready.student.study_time_settings.available_hours_per_day=0;
  ready.study_plan=ScheduleService.build(ready);
  try { PlannerContextService.assertPlanFeasible(ready);assert(false,'Zero capacity rejected'); }
  catch(error) {assert(error instanceof AppError && error.code===ErrorCode.CONSTRAINT_CONFLICT,'Zero availability is preserved and creates a capacity conflict');}

  mockProfile.available_hours_per_day = null;
  const defaultAvailabilityContext = await PlannerContextService.getPlannerContext(mockDb, 'student-1');
  assert(defaultAvailabilityContext.student.study_time_settings.available_hours_per_day === 2.0,
    'Defaults daily availability to 2 hours only when the profile has no value');

  console.log('\n====================================================');
  console.log(`Results: ${passed} passed, ${failed} failed.`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPlannerTests().catch(err => {
  console.error('Fatal error running planner test suite:', err);
  process.exit(1);
});

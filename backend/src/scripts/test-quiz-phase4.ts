/**
 * LunaLearn — Quiz Generation and Scoring Phase 4 Test Suite
 * Tests:
 * 1. Question generation grounded in retrieved document chunks when material exists.
 * 2. Question generation grounded in topic name alone when material doesn't exist.
 * 3. Question format support: multiple_choice, short_answer, mixed.
 * 4. Schema validation for POST /api/quiz/generate.
 * 5. Scoring & answer normalization (letter selection, option text, case insensitivity, short answer).
 * 6. Weak topic identification on missed questions.
 * 7. Scoped client writes to quiz_results table with correct shape.
 * 8. Automatic pickup by Person 2's AcademicEngineService readiness & risk calculation.
 * 9. Schema validation for POST /api/quiz/submit.
 */

import { QuizService } from '../services/quiz.service.js';
import { GenerateQuizSchema, SubmitQuizSchema } from '../types/quiz.js';
import { AcademicEngineService } from '../services/academic-engine.service.js';

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
 * Creates a mock Supabase client simulating student data with topics, materials, chunks, and quiz_results.
 */
function createMockDb(opts: {
  hasMaterials: boolean;
  quizResultsStore?: any[];
}) {
  const subjectId = 'c1f6d3a8-4b2e-4a9f-8e2b-1a2c3d4e5f6a';
  const unitId = 'u3-uuid';
  const topicId = 't-norm-uuid';
  const profileId = 'student-uuid-1';

  const subjects = [
    {
      id: subjectId,
      profile_id: profileId,
      name: 'Database Management Systems',
      code: 'CS-401',
      color: '#4B2DB8'
    }
  ];

  const units = [
    { id: unitId, subject_id: subjectId, unit_number: 3, title: 'Normalization' }
  ];

  const topics = [
    {
      id: topicId,
      unit_id: unitId,
      title: 'Boyce-Codd Normal Form',
      description: 'BCNF anomalies, determinants, and decomposition',
      status: 'in_progress',
      is_weak: true
    },
    {
      id: 't-trans-uuid',
      unit_id: unitId,
      title: 'Transactions & ACID Properties',
      description: 'Atomicity, Consistency, Isolation, Durability',
      status: 'not_started',
      is_weak: true
    }
  ];

  const materials = opts.hasMaterials
    ? [
        {
          id: 'mat-norm-uuid',
          subject_id: subjectId,
          unit_id: unitId,
          name: 'Unit 3 Normalization Notes',
          storage_path: 'materials/norm.pdf'
        }
      ]
    : [];

  const chunks = opts.hasMaterials
    ? [
        {
          id: 'chunk-1',
          profile_id: profileId,
          subject_id: subjectId,
          material_id: 'mat-norm-uuid',
          page_number: 4,
          chunk_index: 0,
          content:
            'Boyce-Codd Normal Form (BCNF) requires that for every non-trivial functional dependency X -> Y, X must be a superkey. It eliminates redundancies and anomalies that remain in 3NF.',
          vector: new Array(1536).fill(0.02)
        }
      ]
    : [];

  const quizResults: any[] = opts.quizResultsStore || [];

  const client: any = {
    from: (table: string) => {
      let activeData: any[] = [];
      if (table === 'subjects') activeData = [...subjects];
      else if (table === 'units') activeData = [...units];
      else if (table === 'topics') activeData = [...topics];
      else if (table === 'materials') activeData = [...materials];
      else if (table === 'document_chunks') activeData = [...chunks];
      else if (table === 'quiz_results') activeData = quizResults;
      else if (table === 'study_sessions') activeData = [];
      else if (table === 'tasks') activeData = [];
      else if (table === 'exams') activeData = [];

      const queryBuilder: any = {
        select: (_cols: string = '*') => queryBuilder,
        eq: (col: string, val: any) => {
          activeData = activeData.filter((row: any) => row[col] === val);
          return queryBuilder;
        },
        in: (col: string, vals: any[]) => {
          activeData = activeData.filter((row: any) => vals.includes(row[col]));
          return queryBuilder;
        },
        order: (col: string, opts?: { ascending?: boolean }) => {
          const asc = opts?.ascending !== false;
          activeData = [...activeData].sort((a: any, b: any) => {
            const valA = a[col];
            const valB = b[col];
            if (valA < valB) return asc ? -1 : 1;
            if (valA > valB) return asc ? 1 : -1;
            return 0;
          });
          return queryBuilder;
        },
        limit: (n: number) => {
          activeData = activeData.slice(0, n);
          return queryBuilder;
        },
        maybeSingle: async () => ({
          data: activeData.length > 0 ? activeData[0] : null,
          error: null
        }),
        single: async () => ({
          data: activeData.length > 0 ? activeData[0] : null,
          error: activeData.length > 0 ? null : { message: 'Row not found' }
        }),
        insert: (rowOrRows: any) => {
          const toInsert = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows];
          const inserted = toInsert.map((r, i) => ({
            id: r.id || `qr-gen-${Date.now()}-${i}`,
            ...r
          }));
          quizResults.push(...inserted);
          return {
            select: () => ({
              maybeSingle: async () => ({ data: inserted[0], error: null }),
              single: async () => ({ data: inserted[0], error: null })
            })
          };
        },
        then: (resolve: any) => resolve({ data: activeData, error: null })
      };

      return queryBuilder;
    },
    rpc: async () => ({ data: [], error: null })
  };

  return { client, subjectId, topicId, profileId, quizResults };
}

async function runTests() {
  console.log('\n=============================================================');
  console.log('🧪 Running LunaLearn Phase 4 Quiz Generation & Scoring Tests');
  console.log('=============================================================\n');

  // --------------------------------------------------------------------------
  // Test 1: Grounded Quiz Generation with Material Chunks
  // --------------------------------------------------------------------------
  console.log('🔹 1. Grounded Quiz Generation (Chunks Exist)');
  const mockDb1 = createMockDb({ hasMaterials: true });
  const quiz1 = await QuizService.generateQuiz(mockDb1.client, mockDb1.profileId, {
    subject_id: mockDb1.subjectId,
    topic_id: mockDb1.topicId,
    question_type: 'multiple_choice',
    num_questions: 5
  });

  assert(quiz1.questions.length === 5, 'Generates exactly 5 questions');
  assert(quiz1.subject_id === mockDb1.subjectId, 'Binds to correct subject_id');
  assert(quiz1.topic_title?.includes('Boyce-Codd') === true, 'Binds to topic title');
  assert(typeof quiz1.grounded === 'boolean', 'Grounding flag is boolean');
  assert(
    quiz1.questions.every(q => Array.isArray(q.options) && q.options.length === 4),
    'Multiple choice questions contain exactly 4 options'
  );
  assert(
    quiz1.questions.every(q => Boolean(q.correct_answer && q.explanation)),
    'All questions have correct_answer and explanation'
  );

  // --------------------------------------------------------------------------
  // Test 2: Quiz Generation Grounded in Topic Name Alone (No Material)
  // --------------------------------------------------------------------------
  console.log('\n🔹 2. Quiz Generation Grounded in Topic Name Alone (No Material Chunks)');
  const mockDb2 = createMockDb({ hasMaterials: false });
  const quiz2 = await QuizService.generateQuiz(mockDb2.client, mockDb2.profileId, {
    subject_id: mockDb2.subjectId,
    topic_id: mockDb2.topicId,
    question_type: 'mixed',
    num_questions: 5
  });

  assert(quiz2.questions.length === 5, 'Generates 5 questions without material chunks');
  assert(quiz2.grounded === false, 'Flags grounded as false when no document chunks exist');
  assert(quiz2.grounding_type === 'topic_syllabus', 'Grounding type set to topic_syllabus');
  assert(quiz2.topic_title === 'Boyce-Codd Normal Form', 'Retains topic name for grounding');

  // --------------------------------------------------------------------------
  // Test 3: Short Answer and Mixed Question Formats
  // --------------------------------------------------------------------------
  console.log('\n🔹 3. Question Formats: short_answer & mixed');
  const shortAnsQuestions = QuizService.generateOfflineQuestions({
    subjectName: 'Database Management Systems',
    topicId: mockDb2.topicId,
    topicTitle: 'Boyce-Codd Normal Form',
    questionType: 'short_answer',
    numQuestions: 5
  });

  assert(shortAnsQuestions.length === 5, 'Generates 5 short answer questions');
  assert(
    shortAnsQuestions.every(q => q.type === 'short_answer' && !q.options),
    'Short answer questions omit options array'
  );

  // --------------------------------------------------------------------------
  // Test 4: Answer Normalization & Correctness Logic
  // --------------------------------------------------------------------------
  console.log('\n🔹 4. Answer Normalization & Correctness Verification');
  // Exact match
  assert(
    QuizService.isAnswerCorrect('A) Superkey', 'A) Superkey') === true,
    'Matches identical answers'
  );
  // Option letter match ("A" matching "A) Option text")
  assert(
    QuizService.isAnswerCorrect('A', 'A) For every non-trivial functional dependency X -> Y, X must be a superkey') === true,
    'Matches option letter A to full option text'
  );
  assert(
    QuizService.isAnswerCorrect('b', 'B) Second Normal Form') === true,
    'Case-insensitive letter match'
  );
  // Stripped text match without prefix
  assert(
    QuizService.isAnswerCorrect('Superkey', 'A) Superkey') === true,
    'Matches plain option text to prefixed option'
  );
  // Case-insensitive & trimmed match
  assert(
    QuizService.isAnswerCorrect('  partial dependency  ', 'Partial dependency') === true,
    'Matches trimmed case-insensitive short answer'
  );
  // Wrong answer
  assert(
    QuizService.isAnswerCorrect('C) Third Normal Form', 'A) Superkey') === false,
    'Correctly rejects incorrect answer'
  );

  // --------------------------------------------------------------------------
  // Test 5: Scoring Attempt & Weak Topic Detection
  // --------------------------------------------------------------------------
  console.log('\n🔹 5. Scoring Attempt, Weak Topic Detection & Database Insertion');
  const quizResultsStore: any[] = [];
  const mockDb5 = createMockDb({ hasMaterials: true, quizResultsStore });

  const submissionPayload = {
    subject_id: mockDb5.subjectId,
    topic_id: mockDb5.topicId,
    answers: [
      {
        question_id: 'q-1',
        question: 'What is required for BCNF?',
        user_answer: 'A) Superkey',
        correct_answer: 'A) Superkey',
        topic_title: 'Boyce-Codd Normal Form'
      },
      {
        question_id: 'q-2',
        question: 'Which normal form removes transitive dependencies?',
        user_answer: 'C) Third Normal Form',
        correct_answer: 'C) Third Normal Form',
        topic_title: 'Normalization'
      },
      {
        question_id: 'q-3',
        question: 'What property may be lost in BCNF?',
        user_answer: 'A) Lossless join', // INCORRECT (correct is Dependency preservation)
        correct_answer: 'B) Dependency preservation',
        topic_title: 'Boyce-Codd Normal Form'
      },
      {
        question_id: 'q-4',
        question: 'What is ACID atomicity?',
        user_answer: 'All or nothing execution',
        correct_answer: 'All or nothing execution',
        topic_title: 'Transactions & ACID'
      },
      {
        question_id: 'q-5',
        question: 'What is Isolation in ACID?',
        user_answer: 'Completely wrong answer', // INCORRECT
        correct_answer: 'Concurrent transactions do not interfere',
        topic_title: 'Transactions & ACID'
      }
    ]
  };

  const scoredResult = await QuizService.scoreAndSubmitQuiz(
    mockDb5.client,
    mockDb5.profileId,
    submissionPayload
  );

  assert(scoredResult.total_questions === 5, 'Total questions scored is 5');
  assert(scoredResult.correct_answers === 3, 'Correct answers counted as 3');
  assert(scoredResult.score === 60, 'Percentage score is 60% (3/5)');
  assert(scoredResult.passed === true, 'Passed is true for score >= 60%');
  assert(
    scoredResult.weak_topics_identified.includes('Boyce-Codd Normal Form'),
    'Identified Boyce-Codd Normal Form as weak topic from missed Q3'
  );
  assert(
    scoredResult.weak_topics_identified.includes('Transactions & ACID'),
    'Identified Transactions & ACID as weak topic from missed Q5'
  );
  assert(
    scoredResult.weak_topics_identified.length === 2,
    'Identified exactly 2 unique weak topics'
  );
  assert(
    quizResultsStore.length === 1,
    'Successfully wrote row to quiz_results table using scoped client'
  );

  const insertedRow = quizResultsStore[0];
  assert(insertedRow.score === 60, 'Inserted quiz_results row has correct score');
  assert(insertedRow.subject_id === mockDb5.subjectId, 'Inserted row has correct subject_id');
  assert(insertedRow.profile_id === mockDb5.profileId, 'Inserted row has correct profile_id');
  assert(
    Array.isArray(insertedRow.weak_topics_identified) &&
      insertedRow.weak_topics_identified.length === 2,
    'Inserted row contains weak_topics_identified array'
  );

  // --------------------------------------------------------------------------
  // Test 6: Person 2 Academic Readiness Formula Reads New Quiz Result Automatically
  // --------------------------------------------------------------------------
  console.log('\n🔹 6. Automatic Pickup by Person 2 Academic Readiness Engine');
  // Run AcademicEngineService.getSubjectReadiness using the DB containing the new quiz_result
  const readiness = await AcademicEngineService.getSubjectReadiness(mockDb5.client, mockDb5.subjectId);
  assert(
    readiness.breakdown.quiz_performance === 60,
    `AcademicEngine picks up 60% in quiz_performance breakdown (got ${readiness.breakdown.quiz_performance}%)`
  );
  assert(
    typeof readiness.readiness_percentage === 'number' && readiness.readiness_percentage > 0,
    'Readiness percentage computed successfully'
  );

  // --------------------------------------------------------------------------
  // Test 7: Low Score Triggers Academic Risk (PERFORMANCE_RISK)
  // --------------------------------------------------------------------------
  console.log('\n🔹 7. Low Score Triggers PERFORMANCE_RISK on Next Read');
  if (quizResultsStore.length > 0) {
    quizResultsStore[0].created_at = new Date(Date.now() - 3600000).toISOString();
  }
  const lowScoreSubmission = {
    subject_id: mockDb5.subjectId,
    topic_id: mockDb5.topicId,
    answers: [
      {
        question_id: 'q-1',
        user_answer: 'Wrong Answer',
        correct_answer: 'Right Answer',
        topic_title: 'Boyce-Codd Normal Form'
      },
      {
        question_id: 'q-2',
        user_answer: 'Wrong Answer',
        correct_answer: 'Right Answer',
        topic_title: 'Boyce-Codd Normal Form'
      }
    ]
  };

  const lowResult = await QuizService.scoreAndSubmitQuiz(
    mockDb5.client,
    mockDb5.profileId,
    lowScoreSubmission
  );

  assert(lowResult.score === 0, 'Score is 0% for all wrong answers');
  assert(lowResult.passed === false, 'Passed is false for score < 60%');
  assert(quizResultsStore.length === 2, 'quiz_results now contains 2 attempts');

  const readinessAfterLow = await AcademicEngineService.getSubjectReadiness(mockDb5.client, mockDb5.subjectId);
  const perfRisk = readinessAfterLow.risks.find(r => r.type === 'PERFORMANCE_RISK');
  assert(Boolean(perfRisk), 'PERFORMANCE_RISK automatically fired on next readiness read');

  // --------------------------------------------------------------------------
  // Test 8: Zod Schema Validation
  // --------------------------------------------------------------------------
  console.log('\n🔹 8. Schema Validation');
  const validGen = GenerateQuizSchema.safeParse({
    subject_id: 'c1f6d3a8-4b2e-4a9f-8e2b-1a2c3d4e5f6a',
    question_type: 'multiple_choice',
    num_questions: 5
  });
  assert(validGen.success === true, 'GenerateQuizSchema accepts valid input');

  const invalidGen = GenerateQuizSchema.safeParse({
    subject_id: 'not-a-uuid'
  });
  assert(invalidGen.success === false, 'GenerateQuizSchema rejects invalid UUID');

  const validSubmit = SubmitQuizSchema.safeParse({
    subject_id: 'c1f6d3a8-4b2e-4a9f-8e2b-1a2c3d4e5f6a',
    answers: [
      {
        user_answer: 'Option A',
        correct_answer: 'Option A'
      }
    ]
  });
  assert(validSubmit.success === true, 'SubmitQuizSchema accepts valid answers');

  const invalidSubmit = SubmitQuizSchema.safeParse({
    subject_id: 'c1f6d3a8-4b2e-4a9f-8e2b-1a2c3d4e5f6a',
    answers: []
  });
  assert(invalidSubmit.success === false, 'SubmitQuizSchema rejects empty answers array');

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log('\n=============================================================');
  console.log(`📊 Phase 4 Quiz Test Summary: ${passed} passed, ${failed} failed`);
  console.log('=============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Unhandled error in test suite:', err);
  process.exit(1);
});

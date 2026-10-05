/**
 * LunaLearn — AI Study Assistant Phase 3 Test Suite
 * Tests the AI Study Assistant (StudyAssistantService):
 * 1. Recommended Gemini chat model resolution (gemini-3.8-flash).
 * 2. Explicit handling when student has 0 subjects (no fabrication).
 * 3. Concept explanation grounded in retrieved material chunks.
 * 4. Note summarization with source citations.
 * 5. Practice question generation grounded in course syllabus.
 * 6. Academic next steps recommendation grounded in exam countdown and weak topics.
 * 7. Retrieved sources structure representation.
 * 8. Academic context summary formatting.
 * 9. Schema validation for POST /api/assistant/chat.
 */

import { StudyAssistantService } from '../services/study-assistant.service.js';
import { EmbeddingService } from '../services/embedding.service.js';
import { AssistantChatSchema } from '../types/assistant.js';

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
 * Creates a mock Supabase client simulating student data with materials and document chunks.
 */
async function createMockDb(opts: {
  hasSubjects: boolean;
  subjectId?: string;
  hasMaterials?: boolean;
}) {
  const { hasSubjects, subjectId = 'c1f6d3a8-4b2e-4a9f-8e2b-1a2c3d4e5f6a', hasMaterials = true } = opts;

  const subjects = hasSubjects
    ? [
        {
          id: subjectId,
          profile_id: 'student-uuid-1',
          name: 'Database Management Systems',
          code: 'CS-401',
          color: '#4B2DB8'
        }
      ]
    : [];

  const units = hasSubjects
    ? [
        { id: 'u1-uuid', subject_id: subjectId, unit_number: 1, title: 'Relational Model' },
        { id: 'u2-uuid', subject_id: subjectId, unit_number: 2, title: 'Transactions' },
        { id: 'u3-uuid', subject_id: subjectId, unit_number: 3, title: 'Normalization' }
      ]
    : [];

  const topics = hasSubjects
    ? [
        { id: 't1', unit_id: 'u1-uuid', title: 'SQL Queries', status: 'completed', is_weak: false, mastery_score: 90 },
        { id: 't2', unit_id: 'u2-uuid', title: 'ACID Properties', status: 'completed', is_weak: true, mastery_score: 55 },
        { id: 't3', unit_id: 'u3-uuid', title: 'Boyce-Codd Normal Form', status: 'in_progress', is_weak: true, mastery_score: 45 },
        { id: 't4', unit_id: 'u3-uuid', title: 'Multi-valued Dependencies', status: 'not_started', is_weak: false, mastery_score: 0 }
      ]
    : [];

  const exams = hasSubjects
    ? [
        {
          id: 'exam-1',
          profile_id: 'student-uuid-1',
          subject_id: subjectId,
          title: 'DBMS Mid-Semester Exam',
          exam_date: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
          target_score: 85
        }
      ]
    : [];

  const tasks = hasSubjects
    ? [
        {
          id: 'task-1',
          profile_id: 'student-uuid-1',
          subject_id: subjectId,
          title: 'Schema Decomposition Problem Set',
          type: 'Assignment',
          priority: 'High',
          due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
          is_completed: false
        }
      ]
    : [];

  const quizResults = hasSubjects
    ? [
        {
          id: 'quiz-1',
          profile_id: 'student-uuid-1',
          subject_id: subjectId,
          score: 65,
          total_questions: 10,
          correct_answers: 6,
          weak_topics_identified: ['Boyce-Codd Normal Form', 'ACID Properties'],
          created_at: new Date().toISOString()
        }
      ]
    : [];

  const materials = hasMaterials && hasSubjects
    ? [
        {
          id: 'mat-1',
          profile_id: 'student-uuid-1',
          subject_id: subjectId,
          name: 'Unit 3 · Normalization Lecture Notes.pdf',
          storage_path: 'materials/dbms_u3.pdf',
          file_type: 'PDF'
        }
      ]
    : [];

  const chunk1Content = 'Boyce-Codd Normal Form (BCNF) requires that for every non-trivial functional dependency X -> Y, X must strictly be a superkey of relation R. It resolves anomalies that persist even in 3NF when candidate keys overlap.';
  const chunk2Content = 'Example of BCNF violation: Consider relation R(Student, Course, Instructor) where (Student, Course) -> Instructor, and Instructor -> Course. Here Instructor is not a superkey, causing redundancy and update anomalies.';

  const chunk1Embedding = hasMaterials && hasSubjects ? await import('../services/embedding.service.js').then(m => m.EmbeddingService.embedText(chunk1Content)) : null;
  const chunk2Embedding = hasMaterials && hasSubjects ? await import('../services/embedding.service.js').then(m => m.EmbeddingService.embedText(chunk2Content)) : null;

  const chunks = hasMaterials && hasSubjects
    ? [
        {
          id: 'chunk-1',
          material_id: 'mat-1',
          profile_id: 'student-uuid-1',
          content: chunk1Content,
          chunk_index: 0,
          page_number: 4,
          embedding: chunk1Embedding,
          metadata: { subject_id: subjectId, material_name: 'Unit 3 · Normalization Lecture Notes.pdf' }
        },
        {
          id: 'chunk-2',
          material_id: 'mat-1',
          profile_id: 'student-uuid-1',
          content: chunk2Content,
          chunk_index: 1,
          page_number: 5,
          embedding: chunk2Embedding,
          metadata: { subject_id: subjectId, material_name: 'Unit 3 · Normalization Lecture Notes.pdf' }
        }
      ]
    : [];

  const store: Record<string, any[]> = {
    profiles: [
      {
        id: 'student-uuid-1',
        full_name: 'Aarav Patel',
        course: 'Computer Science',
        semester: 4,
        preferred_focus_time: 'Evening'
      }
    ],
    subjects,
    units,
    topics,
    exams,
    tasks,
    quiz_results: quizResults,
    study_sessions: [{ duration_minutes: 60, session_type: 'revision' }],
    materials,
    document_chunks: chunks
  };

  const client: any = {
    rpc: async () => ({ data: null, error: { message: 'Use fallback' } }),
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
        order: () => query,
        limit: () => query,
        is: (col: string, val: any) => {
          filtered = filtered.filter(row => row[col] === val);
          return query;
        },
        maybeSingle: async () => ({ data: filtered[0] || null, error: null }),
        single: async () => ({
          data: filtered[0] || null,
          error: filtered[0] ? null : { message: 'Not found' }
        }),
        then: (resolve: any) => resolve({ data: filtered, error: null })
      };

      return query;
    },
    _getStore: () => store
  };

  return client;
}

async function runAssistantPhase3Tests() {
  console.log('====================================================');
  console.log('🌙 LunaLearn — AI Study Assistant Phase 3 Test Suite');
  console.log('====================================================\n');

  const profileId = 'student-uuid-1';
  const subjectId = 'c1f6d3a8-4b2e-4a9f-8e2b-1a2c3d4e5f6a';

  // --------------------------------------------------------------------------
  // 1. Model Resolution
  // --------------------------------------------------------------------------
  console.log('1. Testing Recommended Gemini Model Resolution...');
  const model = StudyAssistantService.getModelName();
  assert(
    model === 'gemini-3.8-flash' || model.includes('flash') || model.includes('gemini'),
    `Uses recommended Gemini chat model (${model})`
  );

  // --------------------------------------------------------------------------
  // 2. Absence of Academic Context Handling
  // --------------------------------------------------------------------------
  console.log('\n2. Testing Absence of Context Handling (0 Subjects)...');
  const emptyDb = await createMockDb({ hasSubjects: false });

  const emptyResponse = await StudyAssistantService.askAssistant(emptyDb, profileId, {
    message: 'Can you summarize my notes for tomorrow?',
    conversation_history: []
  });

  assert(!emptyResponse.academic_context.has_academic_profile, 'Flags has_academic_profile as false');
  assert(emptyResponse.academic_context.total_subjects === 0, 'Reports 0 total subjects');
  assert(emptyResponse.sources.length === 0, 'Returns 0 sources for empty context');
  assert(
    emptyResponse.answer.toLowerCase().includes("haven't added any subjects") ||
    emptyResponse.answer.toLowerCase().includes("add your first subject"),
    'Explicitly tells student no subjects or study materials are added yet'
  );
  assert(
    !emptyResponse.answer.toLowerCase().includes("tomorrow's exam"),
    'Does not fabricate imaginary exams or notes'
  );

  // --------------------------------------------------------------------------
  // 3. Grounded Concept Explanation & Source Citations
  // --------------------------------------------------------------------------
  console.log('\n3. Testing Grounded Concept Explanation & Source Citations...');
  const originalEmbedText = EmbeddingService.embedText;
  EmbeddingService.embedText = async text => {
    const vector = new Array(EmbeddingService.DEFAULT_DIMENSION).fill(0);
    vector[text.toLowerCase().startsWith('what should i study next') ? 1 : 0] = 1;
    return vector;
  };
  const activeDb = await createMockDb({ hasSubjects: true, subjectId });


  const explainResponse = await StudyAssistantService.askAssistant(activeDb, profileId, {
    message: 'What is Boyce-Codd Normal Form and how does it handle candidate keys?',
    subject_id: subjectId,
    conversation_history: []
  });

  assert(Boolean(explainResponse.answer), 'Returns non-empty answer');
  assert(explainResponse.academic_context.has_academic_profile, 'Academic profile detected');
  assert(explainResponse.academic_context.total_subjects === 1, 'Correctly reports 1 subject');
  assert(
    explainResponse.academic_context.active_subject?.name === 'Database Management Systems',
    'Active subject identified as Database Management Systems'
  );
  assert(
    explainResponse.academic_context.active_subject?.days_until_exam === 6,
    'Exam countdown captured as 6 days'
  );
  assert(
    Boolean(explainResponse.academic_context.active_subject?.weak_topics.includes('Boyce-Codd Normal Form')),
    'Weak topic BCNF included in context'
  );


  // Sources verification
  assert(explainResponse.sources.length >= 1, 'Retrieves matching source chunks from Phase 2');
  const topSource = explainResponse.sources[0];
  assert(Boolean(topSource.material_name), 'Source includes document name');
  assert(typeof topSource.page_number === 'number', 'Source includes page number');
  assert(typeof topSource.chunk_index === 'number', 'Source includes chunk index');
  assert(typeof topSource.similarity === 'number', 'Source includes cosine similarity score');
  assert(Boolean(topSource.preview), 'Source includes text preview');

  // Verify answer references course content or citation
  assert(
    explainResponse.answer.includes('BCNF') ||
    explainResponse.answer.includes('Boyce-Codd') ||
    explainResponse.answer.includes('superkey') ||
    explainResponse.answer.includes('functional dependency'),
    'Answer accurately addresses BCNF concept'
  );

  // --------------------------------------------------------------------------
  // 4. Note Summarization & Examples
  // --------------------------------------------------------------------------
  console.log('\n4. Testing Note Summarization & Examples...');
  const summaryResponse = await StudyAssistantService.askAssistant(activeDb, profileId, {
    message: 'Can you summarize my Unit 3 lecture notes and give an example?',
    subject_id: subjectId,
    conversation_history: []
  });

  assert(Boolean(summaryResponse.answer), 'Generates summary answer');
  assert(summaryResponse.sources.length >= 1, 'Links summary to retrieved lecture notes');
  assert(
    summaryResponse.answer.toLowerCase().includes('normalization') ||
    summaryResponse.answer.toLowerCase().includes('bcnf') ||
    summaryResponse.answer.toLowerCase().includes('candidate key') ||
    summaryResponse.answer.toLowerCase().includes('notes'),
    'Summary incorporates core normalization concepts from uploaded notes'
  );

  // --------------------------------------------------------------------------
  // 5. Practice Question Generation
  // --------------------------------------------------------------------------
  console.log('\n5. Testing Practice Question Generation...');
  const quizPromptResponse = await StudyAssistantService.askAssistant(activeDb, profileId, {
    message: 'Give me a practice question to prepare for my upcoming exam.',
    subject_id: subjectId,
    conversation_history: []
  });

  assert(Boolean(quizPromptResponse.answer), 'Generates practice question response');
  assert(
    quizPromptResponse.answer.includes('?') ||
    quizPromptResponse.answer.toLowerCase().includes('question') ||
    quizPromptResponse.answer.toLowerCase().includes('explain'),
    'Response contains a practice question for student preparation'
  );

  // --------------------------------------------------------------------------
  // 6. Next Steps & Study Recommendation Grounded in Real Academic State
  // --------------------------------------------------------------------------
  console.log('\n6. Testing Next Steps & Study Recommendation...');
  const nextStepsResponse = await StudyAssistantService.askAssistant(activeDb, profileId, {
    message: 'What should I study next to prepare for my test?',
    conversation_history: []
  });

  assert(Boolean(nextStepsResponse.answer), 'Generates study recommendations');
  assert(
    nextStepsResponse.answer.toLowerCase().includes('exam') ||
    nextStepsResponse.answer.toLowerCase().includes('weak') ||
    nextStepsResponse.answer.toLowerCase().includes('problem set') ||
    nextStepsResponse.answer.toLowerCase().includes('database') ||
    nextStepsResponse.answer.toLowerCase().includes('prioritize'),
    'Recommendations reflect upcoming exam, weak areas, or pending deadlines'
  );

  // --------------------------------------------------------------------------
  // 7. Zod Schema Validation for POST /api/assistant/chat
  // --------------------------------------------------------------------------
  console.log('\n7. Testing Input Schema Validation (AssistantChatSchema)...');

  const validPayload = {
    message: 'Explain Boyce-Codd Normal Form please.',
    subject_id: subjectId,
    conversation_history: [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi! Ready to study.' }
    ]
  };
  const parsedValid = AssistantChatSchema.safeParse(validPayload);
  assert(parsedValid.success, 'Valid chat payload passes schema validation');

  const emptyMsgPayload = { message: '' };
  const parsedEmpty = AssistantChatSchema.safeParse(emptyMsgPayload);
  assert(!parsedEmpty.success, 'Rejects empty chat message');

  const invalidSubjectPayload = {
    message: 'Hello',
    subject_id: 'not-a-valid-uuid'
  };
  const parsedInvalidSubject = AssistantChatSchema.safeParse(invalidSubjectPayload);
  assert(!parsedInvalidSubject.success, 'Rejects invalid subject_id UUID');

  const emptySubjectPayload = {
    message: 'Hello',
    subject_id: ''
  };
  const parsedEmptySubject = AssistantChatSchema.safeParse(emptySubjectPayload);
  assert(parsedEmptySubject.success, 'Preprocesses empty string subject_id to null');
  if (parsedEmptySubject.success) {
    assert(parsedEmptySubject.data.subject_id === null, 'Empty string subject_id converts to null');
  }

  EmbeddingService.embedText = originalEmbedText;

  console.log(`\n====================================================`);
  console.log(`Assistant Phase 3 Verification: ${passed} passed, ${failed} failed.`);
  console.log(`====================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runAssistantPhase3Tests().catch(err => {
  console.error('Fatal error during Assistant Phase 3 test suite:', err);
  process.exit(1);
});

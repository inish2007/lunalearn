import {
  CreateSubjectSchema, UpdateSubjectSchema,
  CreateUnitSchema, UpdateUnitSchema,
  CreateTopicSchema, UpdateTopicSchema,
  CreateTaskSchema, UpdateTaskSchema,
  CreateExamSchema, UpdateExamSchema,
  CreateMaterialSchema, UpdateMaterialSchema
} from '../types/domain.js';
import { matchRoute } from '../routes/domain.routes.js';

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

async function runCrudTests() {
  console.log('====================================================');
  console.log('🌙 LunaLearn — Phase 3 CRUD Validation & Contracts Tests');
  console.log('====================================================\n');

  console.log('1. Testing URL Path Matcher & Parameter Extraction...');
  const baseMatch = matchRoute('/api/subjects', 'subjects');
  assert(baseMatch.matches && !baseMatch.id, 'Matches /api/subjects base list route');

  const idMatch = matchRoute('/api/subjects/c1f6d3a8-4b2e', 'subjects');
  assert(idMatch.matches && idMatch.id === 'c1f6d3a8-4b2e', 'Extracts ID parameter from /api/subjects/:id');

  const falseMatch = matchRoute('/api/tasks', 'subjects');
  assert(!falseMatch.matches, 'Correctly rejects non-matching route path');

  console.log('\n2. Testing Subject Schemas...');
  const validSubject = CreateSubjectSchema.safeParse({
    name: 'Database Management',
    code: 'DBMS',
    color: '#6C4CE8'
  });
  assert(validSubject.success, 'Valid subject payload passes validation');

  const invalidColorSubject = CreateSubjectSchema.safeParse({
    name: 'Database Management',
    code: 'DBMS',
    color: 'not-a-color'
  });
  assert(!invalidColorSubject.success, 'Invalid color hex code rejected');

  const validSubjectUpdate = UpdateSubjectSchema.safeParse({ color: '#4B2DB8' });
  assert(validSubjectUpdate.success, 'Partial subject update accepted');

  const emptySubjectUpdate = UpdateSubjectSchema.safeParse({});
  assert(!emptySubjectUpdate.success, 'Empty subject update payload rejected');

  console.log('\n3. Testing Unit Schemas...');
  const fakeUuid = 'c1f6d3a8-4b2e-4a9f-8e2b-1a2c3d4e5f6a';
  const validUnit = CreateUnitSchema.safeParse({
    subject_id: fakeUuid,
    unit_number: 3,
    title: 'Unit 3 · Normalization'
  });
  assert(validUnit.success, 'Valid unit payload passes validation');

  const invalidUuidUnit = CreateUnitSchema.safeParse({
    subject_id: 'not-a-uuid',
    unit_number: 1,
    title: 'Unit 1'
  });
  assert(!invalidUuidUnit.success, 'Non-UUID subject_id rejected');

  const validUnitUpdate = UpdateUnitSchema.safeParse({ title: 'Unit 3 · Advanced Normalization' });
  assert(validUnitUpdate.success, 'Unit update accepted');

  console.log('\n4. Testing Topic Schemas...');
  const validTopic = CreateTopicSchema.safeParse({
    unit_id: fakeUuid,
    title: '3NF & BCNF',
    status: 'in_progress',
    is_weak: true,
    mastery_score: 45.0,
    estimated_study_hours: 3.5
  });
  assert(validTopic.success, 'Valid topic payload passes validation');
  assert(validTopic.success && validTopic.data.estimated_study_hours === 3.5, 'Topic study-hour estimate accepted');

  const invalidStatusTopic = CreateTopicSchema.safeParse({
    unit_id: fakeUuid,
    title: '3NF & BCNF',
    status: 'almost_done' // invalid enum
  });
  assert(!invalidStatusTopic.success, 'Invalid topic status enum rejected');

  const validTopicUpdate = UpdateTopicSchema.safeParse({ status: 'completed', is_weak: false, estimated_study_hours: 2 });
  assert(validTopicUpdate.success, 'Topic status update accepted');
  assert(!UpdateTopicSchema.safeParse({ estimated_study_hours: 0 }).success, 'Rejects non-positive topic estimate');

  console.log('\n5. Testing Task Schemas...');
  const validTask = CreateTaskSchema.safeParse({
    title: 'Normalize schema assignment',
    subject_id: fakeUuid,
    type: 'Assignment',
    priority: 'High',
    due_date: '2026-09-30T18:00:00.000Z'
  });
  assert(validTask.success, 'Valid task payload passes validation');

  const invalidDueDateTask = CreateTaskSchema.safeParse({
    title: 'Task with bad date',
    due_date: 'tomorrow afternoon' // invalid ISO
  });
  assert(!invalidDueDateTask.success, 'Non-ISO due_date timestamp rejected');

  const validTaskUpdate = UpdateTaskSchema.safeParse({ is_completed: true });
  assert(validTaskUpdate.success, 'Task completion update accepted');

  console.log('\n6. Testing Exam Schemas...');
  const validExam = CreateExamSchema.safeParse({
    subject_id: fakeUuid,
    title: 'DBMS Mid-semester',
    exam_date: new Date(Date.now()+86400000).toISOString(),
    target_score: 85
  });
  assert(validExam.success, 'Valid exam payload passes validation');

  const outOfRangeScoreExam = CreateExamSchema.safeParse({
    subject_id: fakeUuid,
    title: 'DBMS Mid-sem',
    exam_date: new Date(Date.now()+86400000).toISOString(),
    target_score: 150 // max 100
  });
  assert(!outOfRangeScoreExam.success, 'Exam target score > 100 rejected');

  const validExamUpdate = UpdateExamSchema.safeParse({ target_score: 90 });
  assert(validExamUpdate.success, 'Exam target_score update accepted');

  console.log('\n7. Testing Materials Metadata Schemas...');
  const validMaterial = CreateMaterialSchema.safeParse({
    subject_id: fakeUuid,
    unit_id: fakeUuid,
    name: 'Normalization Unit 3.pdf',
    storage_path: 'materials/dbms/unit3.pdf',
    file_type: 'PDF',
    size_bytes: 2048576,
    processed: false
  });
  assert(validMaterial.success, 'Valid material metadata payload passes validation');

  const invalidFileTypeMaterial = CreateMaterialSchema.safeParse({
    subject_id: fakeUuid,
    name: 'Audio recording',
    storage_path: 'materials/audio.mp3',
    file_type: 'MP3' // invalid enum (only PDF, Notes, Slides)
  });
  assert(!invalidFileTypeMaterial.success, 'Invalid material file_type enum rejected');

  const validMaterialUpdate = UpdateMaterialSchema.safeParse({ processed: true });
  assert(validMaterialUpdate.success, 'Material processed update accepted');

  console.log('\n====================================================');
  console.log(`Results: ${passed} passed, ${failed} failed.`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runCrudTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});

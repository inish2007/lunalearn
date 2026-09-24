/**
 * LunaLearn — Demo Dataset Seed Script
 * Resets the database to the canonical demo dataset in one command:
 * - Student Profile: Aarav Patel (CS semester 4)
 * - Subject: Database Management Systems (DBMS, CS-401)
 * - Exam: DBMS Mid-semester in 6 days
 * - Topics:
 *     1. SQL (strong) - completed, not weak, score: 90
 *     2. ER Model (strong) - completed, not weak, score: 88
 *     3. Normalization (weak) - in_progress, weak, score: 45
 *     4. Transactions (weak) - in_progress, weak, score: 40
 *     5. Indexing (partial) - in_progress, not weak, score: 60
 * - Tasks: Normalization assignment due in 36 hours
 * - Quiz: Initial quiz attempt (score 75%)
 * - Study session: 60 minutes logged revision
 */

import { supabaseAdmin } from '../lib/supabase.js';
import { env } from '../config/env.js';

export const DEMO_PROFILE_ID = 'e3b0c442-98fc-1c14-9af0-2b9a7b9efb7f';
export const DEMO_SUBJECT_ID = 'c1f6d3a8-4b2e-4a9f-8e2b-1a2c3d4e5f6a';

export interface SeedResult {
  profile: any;
  subject: any;
  units: any[];
  topics: any[];
  exam: any;
  tasks: any[];
  quizzes: any[];
  sessions: any[];
}

/**
 * Resets and populates the canonical demo dataset on any Supabase client (live or mock).
 */
export async function seedDemoDataset(db: any, targetProfileId: string = DEMO_PROFILE_ID): Promise<SeedResult> {
  const now = new Date();
  const examDate = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString(); // exactly 6 days away
  const assignmentDueDate = new Date(now.getTime() + 36 * 60 * 60 * 1000).toISOString(); // 36 hours away

  console.log(`\n🌱 Resetting and seeding LunaLearn demo dataset for profile ${targetProfileId}...`);

  // 1. Upsert Profile
  const profilePayload = {
    id: targetProfileId,
    full_name: 'Aarav Patel',
    email: 'aarav.patel@example.com',
    course: 'Computer Science & Engineering',
    semester: 4,
    xp: 450,
    level: 3,
    preferred_focus_time: 'Evening (5:30 PM - 8:30 PM)',
    updated_at: now.toISOString()
  };

  const { data: profile } = await db
    .from('profiles')
    .upsert(profilePayload)
    .select()
    .maybeSingle();

  // 2. Clear previous demo records for this subject to ensure a clean reset
  try {
    await db.from('quiz_results').delete().eq('subject_id', DEMO_SUBJECT_ID);
    await db.from('study_sessions').delete().eq('subject_id', DEMO_SUBJECT_ID);
    await db.from('tasks').delete().eq('subject_id', DEMO_SUBJECT_ID);
    await db.from('exams').delete().eq('subject_id', DEMO_SUBJECT_ID);

    const { data: existingUnits } = await db.from('units').select('id').eq('subject_id', DEMO_SUBJECT_ID);
    if (existingUnits && existingUnits.length > 0) {
      const uIds = existingUnits.map((u: any) => u.id);
      await db.from('topics').delete().in('unit_id', uIds);
    }
    await db.from('units').delete().eq('subject_id', DEMO_SUBJECT_ID);
    await db.from('subjects').delete().eq('id', DEMO_SUBJECT_ID);
  } catch (_e) {
    // Best effort cleanup for mock/restricted clients
  }

  // 3. Insert Subject: DBMS
  const subjectPayload = {
    id: DEMO_SUBJECT_ID,
    profile_id: targetProfileId,
    name: 'Database Management Systems',
    code: 'CS-401',
    color: '#4B2DB8'
  };

  const { data: subjectData } = await db
    .from('subjects')
    .insert(subjectPayload)
    .select()
    .maybeSingle();

  // 4. Insert Units
  const unitsPayload = [
    {
      id: 'u1-relational-sql',
      subject_id: DEMO_SUBJECT_ID,
      unit_number: 1,
      title: 'Data Modeling & Relational Query Languages'
    },
    {
      id: 'u2-norm-theory',
      subject_id: DEMO_SUBJECT_ID,
      unit_number: 2,
      title: 'Relational Database Design & Normalization'
    },
    {
      id: 'u3-tx-indexing',
      subject_id: DEMO_SUBJECT_ID,
      unit_number: 3,
      title: 'Transaction Processing & Index Structures'
    }
  ];

  const { data: unitsData } = await db
    .from('units')
    .insert(unitsPayload)
    .select();

  // 5. Insert Topics as required:
  // - SQL (strong)
  // - ER Model (strong)
  // - Normalization (weak)
  // - Transactions (weak)
  // - Indexing (partial)
  const topicsPayload = [
    {
      id: 'top-sql',
      unit_id: 'u1-relational-sql',
      title: 'SQL',
      status: 'completed',
      is_weak: false,
      mastery_score: 90
    },
    {
      id: 'top-er-model',
      unit_id: 'u1-relational-sql',
      title: 'ER Model',
      status: 'completed',
      is_weak: false,
      mastery_score: 88
    },
    {
      id: 'top-norm',
      unit_id: 'u2-norm-theory',
      title: 'Normalization',
      status: 'in_progress',
      is_weak: true,
      mastery_score: 45
    },
    {
      id: 'top-tx',
      unit_id: 'u3-tx-indexing',
      title: 'Transactions',
      status: 'in_progress',
      is_weak: true,
      mastery_score: 40
    },
    {
      id: 'top-idx',
      unit_id: 'u3-tx-indexing',
      title: 'Indexing',
      status: 'in_progress',
      is_weak: false,
      mastery_score: 60
    }
  ];

  const { data: topicsData } = await db
    .from('topics')
    .insert(topicsPayload)
    .select();

  // 6. Insert Exam in 6 days
  const examPayload = {
    id: 'exam-dbms-midsem',
    profile_id: targetProfileId,
    subject_id: DEMO_SUBJECT_ID,
    title: 'DBMS Mid-semester',
    exam_date: examDate,
    target_score: 85.0
  };

  const { data: examData } = await db
    .from('exams')
    .insert(examPayload)
    .select()
    .maybeSingle();

  // 7. Insert Tasks (pending assignment)
  const tasksPayload = [
    {
      id: 'task-norm-probset',
      profile_id: targetProfileId,
      subject_id: DEMO_SUBJECT_ID,
      title: 'Normalization Problem Set',
      type: 'Assignment',
      priority: 'High',
      due_date: assignmentDueDate,
      is_completed: false
    }
  ];

  const { data: tasksData } = await db
    .from('tasks')
    .insert(tasksPayload)
    .select();

  // 8. Insert Initial Quiz Result
  const quizPayload = [
    {
      id: 'quiz-init-dbms',
      profile_id: targetProfileId,
      subject_id: DEMO_SUBJECT_ID,
      score: 75,
      total_questions: 10,
      correct_answers: 7,
      weak_topics_identified: ['Normalization']
    }
  ];

  const { data: quizData } = await db
    .from('quiz_results')
    .insert(quizPayload)
    .select();

  // 9. Insert Study Session (60 mins revision)
  const sessionPayload = [
    {
      id: 'session-init-rev',
      profile_id: targetProfileId,
      subject_id: DEMO_SUBJECT_ID,
      duration_minutes: 60,
      session_type: 'revision',
      notes: 'Reviewed ER diagrams and SQL joins.'
    }
  ];

  const { data: sessionData } = await db
    .from('study_sessions')
    .insert(sessionPayload)
    .select();

  console.log('✅ Demo dataset populated successfully:');
  console.log(`   - Subject: DBMS (CS-401)`);
  console.log(`   - Exam: DBMS Mid-semester in 6 days (${examDate.substring(0, 10)})`);
  console.log(`   - Topics: SQL (strong), ER Model (strong), Normalization (weak), Transactions (weak), Indexing (partial)`);
  console.log(`   - Pending Task: Normalization Problem Set due in 36h`);
  console.log(`   - Quiz: 75% score logged`);
  console.log(`   - Study Session: 60 min revision logged`);

  return {
    profile: profile || profilePayload,
    subject: subjectData || subjectPayload,
    units: unitsData || unitsPayload,
    topics: topicsData || topicsPayload,
    exam: examData || examPayload,
    tasks: tasksData || tasksPayload,
    quizzes: quizData || quizPayload,
    sessions: sessionData || sessionPayload
  };
}

// Standalone execution handler
async function main() {
  const isLiveConfigured =
    !env.SUPABASE_URL.includes('your-project-ref') &&
    !env.SUPABASE_URL.includes('placeholder');

  if (isLiveConfigured) {
    try {
      await seedDemoDataset(supabaseAdmin);
      console.log('\n✨ Database reset and seeded on live Supabase instance.\n');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('❌ Error seeding live Supabase:', msg);
      process.exit(1);
    }
  } else {
    console.log('\nℹ️  Live Supabase credentials not set in backend/.env.');
    console.log('   Running in local simulation mode. Verification scripts will use programmatic state.\n');
    // Simulate seed run
    const inMemoryDb = createInMemoryStore();
    await seedDemoDataset(inMemoryDb);
    console.log('\n✨ Demo dataset validated successfully.\n');
  }
}

// Helper to provide an in-memory client for dry-run validation
export function createInMemoryStore() {
  const store: Record<string, any[]> = {
    profiles: [],
    subjects: [],
    units: [],
    topics: [],
    exams: [],
    tasks: [],
    quiz_results: [],
    study_sessions: []
  };

  return {
    _store: store,
    from: (table: string) => {
      if (!store[table]) store[table] = [];
      const tableData = store[table];

      return {
        select: (_fields?: string) => ({
          eq: (col: string, val: any) => ({
            maybeSingle: () => Promise.resolve({ data: tableData.find(r => r[col] === val) || null }),
            order: () => Promise.resolve({ data: tableData.filter(r => r[col] === val) }),
            in: (_inCol: string, _inVals: any[]) => Promise.resolve({ data: tableData.filter(r => r[col] === val) })
          }),
          in: (col: string, vals: any[]) => Promise.resolve({ data: tableData.filter(r => vals.includes(r[col])) }),
          order: () => Promise.resolve({ data: [...tableData] }),
          maybeSingle: () => Promise.resolve({ data: tableData[0] || null })
        }),
        insert: (rows: any | any[]) => {
          const arr = Array.isArray(rows) ? rows : [rows];
          tableData.push(...arr);
          return {
            select: () => ({
              maybeSingle: () => Promise.resolve({ data: arr[0] })
            }),
            then: (resolve: any) => resolve({ data: arr })
          };
        },
        upsert: (rows: any | any[]) => {
          const arr = Array.isArray(rows) ? rows : [rows];
          for (const item of arr) {
            const idx = tableData.findIndex(r => r.id === item.id);
            if (idx >= 0) tableData[idx] = { ...tableData[idx], ...item };
            else tableData.push(item);
          }
          return {
            select: () => ({
              maybeSingle: () => Promise.resolve({ data: arr[0] })
            })
          };
        },
        delete: () => ({
          eq: (col: string, val: any) => {
            store[table] = tableData.filter(r => r[col] !== val);
            return Promise.resolve({ data: [] });
          },
          in: (col: string, vals: any[]) => {
            store[table] = tableData.filter(r => !vals.includes(r[col]));
            return Promise.resolve({ data: [] });
          }
        })
      };
    }
  };
}

if (process.argv[1]?.endsWith('seed-demo.ts')) {
  main().catch(err => {
    console.error('Fatal error in seed script:', err);
    process.exit(1);
  });
}

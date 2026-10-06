import fs from 'fs';
import { evaluateQuiz } from './quiz-scoring.js';
import path from 'path';
import crypto from 'crypto';
import { User, Session, SupabaseClient } from '@supabase/supabase-js';
import { Database, Profile, Subject, Unit, Topic, Exam, Task, Material, DocumentChunk, QuizResult, StudySession } from '../types/database.js';

export const DEMO_PROFILE_ID = 'e3b0c442-98fc-1c14-9af0-2b9a7b9efb7f';
export const DEMO_SUBJECT_ID = 'c1f6d3a8-4b2e-4a9f-8e2b-1a2c3d4e5f6a';

interface LocalAuthUser {
  id: string;
  email: string;
  password?: string;
  full_name?: string;
  course?: string;
  semester?: number;
  avatar_url?: string | null;
  created_at: string;
  role: string;
}

interface LocalDatabaseState {
  auth_users: LocalAuthUser[];
  profiles: Profile[];
  subjects: Subject[];
  units: Unit[];
  topics: Topic[];
  exams: Exam[];
  tasks: Task[];
  materials: Material[];
  document_chunks: DocumentChunk[];
  quiz_results: QuizResult[];
  study_sessions: StudySession[];
  quiz_runs: any[];
  xp_events: any[];
}

function getInitialState(): LocalDatabaseState {
  return {
    auth_users: [],
    profiles: [],
    subjects: [],
    units: [],
    topics: [],
    exams: [],
    tasks: [],
    materials: [],
    document_chunks: [],
    quiz_results: [],
    quiz_runs: [],
    xp_events: [],
    study_sessions: []
  };
}

export class LocalDevStore {
  private static instance: LocalDevStore;
  private state: LocalDatabaseState;
  private storageFilePath: string;

  private constructor() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: LocalDevStore is strictly forbidden in production (NODE_ENV=production). Live Supabase configuration is required.');
    }
    const scratchDir = path.resolve(process.cwd(), 'scratch');
    if (!fs.existsSync(scratchDir)) {
      try {
        fs.mkdirSync(scratchDir, { recursive: true });
      } catch {
        // Fallback to process cwd
      }
    }
    this.storageFilePath = path.join(scratchDir, 'local-db.json');
    this.state = this.loadState();
  }

  public static getInstance(): LocalDevStore {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: LocalDevStore is strictly forbidden in production (NODE_ENV=production). Live Supabase configuration is required.');
    }
    if (!LocalDevStore.instance) {
      LocalDevStore.instance = new LocalDevStore();
    }
    return LocalDevStore.instance;
  }

  private loadState(): LocalDatabaseState {
    try {
      if (fs.existsSync(this.storageFilePath)) {
        const raw = fs.readFileSync(this.storageFilePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.profiles) && Array.isArray(parsed.subjects)) {
          return { ...getInitialState(), ...parsed };
        }
      }
    } catch (err) {
      console.warn('⚠️ Could not read local-db.json, initializing fresh store:', err);
    }
    const initial = getInitialState();
    this.saveState(initial);
    return initial;
  }

  private saveState(stateToSave = this.state): void {
    try {
      this.collectXp(stateToSave);
      const dir = path.dirname(this.storageFilePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const temporary = this.storageFilePath + '.tmp';
      fs.writeFileSync(temporary, JSON.stringify(stateToSave, null, 2), 'utf8');
      fs.renameSync(temporary, this.storageFilePath);
    } catch (err) {
      throw err;
    }
  }

  private collectXp(state: LocalDatabaseState): void {
    state.xp_events ||= [];
    const award=(profile:string,key:string,amount:number,day?:string)=>{
      if(state.xp_events.some(e=>e.profile_id===profile && e.activity_key===key)) return;
      state.xp_events.push({id:crypto.randomUUID(),profile_id:profile,activity_key:key,amount,local_day:day || null,created_at:new Date().toISOString()});
    };
    for(const t of state.topics) if(t.status==='completed' && !['Core Concepts & Terminology','Applied Systems & Practice'].includes(t.title)) {
      const unit=state.units.find(u=>u.id===t.unit_id);const sub=state.subjects.find(s=>s.id===unit?.subject_id);
      if(sub) award(sub.profile_id,'topic:'+t.id,50);
    }
    for(const run of state.quiz_runs || []) if(run.result) award(run.profile_id,'quiz:'+run.id,Math.round(run.result.score/5));
    for(const s of [...state.study_sessions].sort((a,b)=>a.started_at.localeCompare(b.started_at))) if(s.ended_at && Date.parse(s.ended_at)<=Date.now()) {
      const day=(s as any).local_day || s.started_at.slice(0,10);
      const used=state.xp_events.filter(e=>e.profile_id===s.profile_id && e.activity_key.startsWith('session:') && e.local_day===day).reduce((n,e)=>n+e.amount,0);
      award(s.profile_id,'session:'+s.id,Math.max(0,Math.min(24-used,Math.floor(s.duration_minutes/5))),day);
    }
    for(const profile of state.profiles) { profile.xp=state.xp_events.filter(e=>e.profile_id===profile.id).reduce((n,e)=>n+e.amount,0);profile.level=1+Math.floor(profile.xp/500); }
  }

  public reloadState(): LocalDatabaseState {
    this.state = this.loadState();
    return this.state;
  }

  // --------------------------------------------------------------------------
  // Local Auth Operations
  // --------------------------------------------------------------------------
  public async signUp(input: {
    email: string;
    password?: string;
    full_name?: string;
    course?: string;
    semester?: number;
    avatar_url?: string | null;
  }): Promise<{ user: User; session: Session; profile: Profile }> {
    this.state = this.loadState();
    const email = input.email.trim().toLowerCase();
    let existing = this.state.auth_users.find(u => u.email.toLowerCase() === email);

    if (existing) {
      // Allow updating existing credentials cleanly so re-registering succeeds without error
      existing.password = input.password || existing.password;
      if (input.full_name) existing.full_name = input.full_name;
      if (input.course) existing.course = input.course;
      if (input.semester) existing.semester = input.semester;
      let profile = this.state.profiles.find(p => p.id === existing!.id);
      if (!profile) {
        profile = {
          id: existing.id,
          email,
          full_name: existing.full_name || email.split('@')[0],
          avatar_url: existing.avatar_url || null,
          course: existing.course || 'Not set',
          semester: existing.semester || 4,
          xp: 0,
          level: 1,
          preferred_focus_time: '17:00–19:00 (default)',
          available_hours_per_day: null,
          created_at: existing.created_at,
          updated_at: new Date().toISOString()
        };
        this.state.profiles.push(profile);
      } else {
        if (input.full_name) profile.full_name = input.full_name;
        if (input.course) profile.course = input.course;
        if (input.semester) profile.semester = input.semester;
        profile.updated_at = new Date().toISOString();
      }
      this.saveState();

      const user: User = {
        id: existing.id,
        app_metadata: {},
        user_metadata: {
          full_name: profile.full_name,
          course: profile.course,
          semester: profile.semester
        },
        aud: 'authenticated',
        created_at: existing.created_at,
        email: existing.email,
        role: 'authenticated'
      };

      const session: Session = {
        access_token: `local-dev-jwt-${existing.id}`,
        refresh_token: `local-dev-refresh-${existing.id}`,
        expires_in: 604800,
        token_type: 'bearer',
        user
      };

      return { user, session, profile };
    }

    const userId = crypto.randomUUID();
    const now = new Date().toISOString();

    const localUser: LocalAuthUser = {
      id: userId,
      email,
      password: input.password || 'password123',
      full_name: input.full_name || email.split('@')[0],
      course: input.course || 'Not set',
      semester: input.semester || 4,
      avatar_url: input.avatar_url || null,
      created_at: now,
      role: 'authenticated'
    };

    const profile: Profile = {
      id: userId,
      email,
      full_name: localUser.full_name || email.split('@')[0],
      avatar_url: localUser.avatar_url || null,
      course: localUser.course || 'Not set',
      semester: localUser.semester || 4,
      xp: 0,
      level: 1,
      preferred_focus_time: '17:00–19:00 (default)',
      available_hours_per_day: null,
      created_at: now,
      updated_at: now
    };

    this.state.auth_users.push(localUser);
    this.state.profiles.push(profile);
    this.saveState();

    const user: User = {
      id: userId,
      app_metadata: {},
      user_metadata: {
        full_name: profile.full_name,
        course: profile.course,
        semester: profile.semester
      },
      aud: 'authenticated',
      created_at: now,
      email: localUser.email,
      role: 'authenticated'
    };

    const session: Session = {
      access_token: `local-dev-jwt-${userId}`,
      refresh_token: `local-dev-refresh-${userId}`,
      expires_in: 604800,
      token_type: 'bearer',
      user
    };

    return { user, session, profile };
  }

  public async signIn(input: { email: string; password?: string }): Promise<{ user: User; session: Session; profile: Profile }> {
    this.state = this.loadState();
    const email = input.email.trim().toLowerCase();
    const password = (input.password || '').trim();
    let localUser = this.state.auth_users.find(u => u.email.toLowerCase() === email);

    if (!localUser) {
      throw new Error('Account not found with this email. Please sign up to create your account.');
    }

    if (password && localUser.password && localUser.password.trim() !== password) {
      throw new Error('Incorrect password. Please verify and try again.');
    }

    let profile = this.state.profiles.find(p => p.id === localUser!.id);
    if (!profile) {
      const now = new Date().toISOString();
      profile = {
        id: localUser.id,
        email: localUser.email,
        full_name: localUser.full_name || localUser.email.split('@')[0],
        avatar_url: localUser.avatar_url || null,
        course: localUser.course || 'Not set',
        semester: localUser.semester || 4,
        xp: 0,
        level: 1,
        preferred_focus_time: '17:00–19:00 (default)',
        available_hours_per_day: null,
        created_at: now,
        updated_at: now
      };
      this.state.profiles.push(profile);
      this.saveState();
    }

    const user: User = {
      id: localUser.id,
      app_metadata: {},
      user_metadata: {
        full_name: profile.full_name,
        course: profile.course,
        semester: profile.semester
      },
      aud: 'authenticated',
      created_at: localUser.created_at,
      email: localUser.email,
      role: 'authenticated'
    };

    const session: Session = {
      access_token: `local-dev-jwt-${localUser.id}`,
      refresh_token: `local-dev-refresh-${localUser.id}`,
      expires_in: 604800,
      token_type: 'bearer',
      user
    };

    return { user, session, profile };
  }

  public verifyToken(token: string): User {
    this.state = this.loadState();
    if (!token || !token.startsWith('local-dev-jwt-')) {
      throw new Error('Invalid or expired session token');
    }
    const userId = token.replace('local-dev-jwt-', '');
    const localUser = this.state.auth_users.find(u => u.id === userId);
    if (!localUser) {
      throw new Error('Invalid or expired session token');
    }

    return {
      id: localUser.id,
      app_metadata: {},
      user_metadata: {
        full_name: localUser.full_name,
        course: localUser.course,
        semester: localUser.semester
      },
      aud: 'authenticated',
      created_at: localUser.created_at,
      email: localUser.email,
      role: 'authenticated'
    };
  }

  public async refreshSession(refreshToken: string): Promise<{ user: User; session: Session; profile: Profile }> {
    this.state = this.loadState();
    const prefix = 'local-dev-refresh-';
    if (!refreshToken || !refreshToken.startsWith(prefix)) {
      throw new Error('Invalid or expired refresh token');
    }
    const userId = refreshToken.replace(prefix, '');
    const userRow = this.state.auth_users.find(u => u.id === userId);
    if (!userRow) {
      throw new Error('User not found for refresh token');
    }
    const profile = this.state.profiles.find(p => p.id === userId);
    if (!profile) {
      throw new Error('Profile not found for refresh token');
    }
    const now = new Date().toISOString();
    const user: User = {
      id: userId,
      app_metadata: {},
      user_metadata: {
        full_name: profile.full_name,
        course: profile.course,
        semester: profile.semester
      },
      aud: 'authenticated',
      created_at: userRow.created_at || now,
      email: userRow.email,
      role: 'authenticated'
    };
    const session: Session = {
      access_token: `local-dev-jwt-${userId}`,
      refresh_token: `local-dev-refresh-${userId}`,
      expires_in: 604800,
      token_type: 'bearer',
      user
    };
    return { user, session, profile };
  }

  public rowBelongsToUser(tableName: keyof LocalDatabaseState, row: any, userId: string): boolean {
    if (!userId || !row) return true;
    if (tableName === 'profiles') {
      return row.id === userId;
    }
    if (['subjects', 'exams', 'tasks', 'materials', 'document_chunks', 'quiz_results', 'quiz_runs', 'xp_events', 'study_sessions'].includes(tableName)) {
      return row.profile_id === userId;
    }
    if (tableName === 'units') {
      const userSubjectIds = new Set(
        (this.state.subjects || []).filter(s => s.profile_id === userId).map(s => s.id)
      );
      return userSubjectIds.has(row.subject_id);
    }
    if (tableName === 'topics') {
      const userSubjectIds = new Set(
        (this.state.subjects || []).filter(s => s.profile_id === userId).map(s => s.id)
      );
      const userUnitIds = new Set(
        (this.state.units || []).filter(u => userSubjectIds.has(u.subject_id)).map(u => u.id)
      );
      return userUnitIds.has(row.unit_id);
    }
    return true;
  }

  // --------------------------------------------------------------------------
  // Supabase Client Simulator (Query Chaining)
  // --------------------------------------------------------------------------
  public createClient(scopedUserId?: string): SupabaseClient<Database> {
    const self = this;
    this.collectXp(this.state);

    const mockClient: any = {
      rpc: async (name: string, args: any) => {
        if (name === 'log_study_session') {
          const before=structuredClone(self.state);
          try {
            const s=args.p_session;
            const existing=self.state.study_sessions.find(x=>x.id===s.id);
            if(existing) { if(existing.profile_id!==scopedUserId) throw new Error('Session inaccessible'); return {data:existing,error:null}; }
            if(!self.state.subjects.some(x=>x.id===s.subject_id && x.profile_id===scopedUserId)) throw new Error('Subject not found');
            if(s.topic_id && !self.state.topics.some(t=>t.id===s.topic_id && self.state.units.some(u=>u.id===t.unit_id && u.subject_id===s.subject_id))) throw new Error('Topic does not belong to subject');
            const start=Date.parse(s.started_at),end=Date.parse(s.ended_at);
            if(!Number.isFinite(start)||!Number.isFinite(end)||end>Date.now()||end-start<60000) throw new Error('Invalid session times');
            if(self.state.study_sessions.some(x=>x.profile_id===scopedUserId && Date.parse(x.started_at)<end && Date.parse(x.ended_at || x.started_at)>start)) throw new Error('This session overlaps an existing session.');
            const local_day=new Intl.DateTimeFormat('en-CA',{timeZone:s.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(start));
            const session={...s,profile_id:scopedUserId,duration_minutes:Math.floor((end-start)/60000),local_day,created_at:new Date().toISOString()};
            self.state.study_sessions.push(session);self.saveState();return {data:session,error:null};
          } catch(error) {self.state=before;return {data:null,error};}
        }
        if (name !== 'submit_quiz_run') return mockClient.searchRpc(name,args);
        const before = structuredClone(self.state);
        try {
          const run = self.state.quiz_runs.find(r => r.id === args.p_quiz_id && r.profile_id === scopedUserId);
          if (!run) throw new Error('Quiz not found');
          if (run.result) return { data: run.result, error: null };
          const result = evaluateQuiz(run, args.p_answers);
          self.state.quiz_results.push({ id: result.quiz_result_id, profile_id: scopedUserId!, subject_id: run.subject_id, topic_id: run.topic_id, score: result.score, total_questions: result.total_questions, correct_answers: result.correct_answers, weak_topics_identified: result.weak_topics_identified, created_at: result.created_at });
          for (const q of result.question_evaluations) if (!q.is_correct && q.topic_id) {
            const topic = self.state.topics.find(t => t.id === q.topic_id && self.rowBelongsToUser('topics', t, scopedUserId!));
            if (topic) topic.is_weak = true;
          }
          run.result = result; self.saveState();
          return { data: result, error: null };
        } catch (error) { self.state = before; return { data: null, error }; }
      },
      auth: {
        getUser: async (tok?: string) => {
          try {
            const tokenToUse = tok || (scopedUserId ? `local-dev-jwt-${scopedUserId}` : '');
            const user = self.verifyToken(tokenToUse);
            return { data: { user }, error: null };
          } catch (err: unknown) {
            return { data: { user: null }, error: { message: (err as Error).message } };
          }
        },
        signUp: async (args: any) => {
          try {
            const res = await self.signUp({
              email: args.email,
              password: args.password,
              full_name: args.options?.data?.full_name,
              course: args.options?.data?.course,
              semester: args.options?.data?.semester,
              avatar_url: args.options?.data?.avatar_url
            });
            return { data: { user: res.user, session: res.session }, error: null };
          } catch (err: unknown) {
            return { data: { user: null, session: null }, error: { message: (err as Error).message } };
          }
        },
        signInWithPassword: async (args: any) => {
          try {
            const res = await self.signIn(args);
            return { data: { user: res.user, session: res.session }, error: null };
          } catch (err: unknown) {
            return { data: { user: null, session: null }, error: { message: (err as Error).message } };
          }
        },
        signOut: async () => {
          return { error: null };
        }
      },

      searchRpc: async (fnName: string, args: any) => {
        if (fnName === 'match_document_chunks') {
          const chunks = self.state.document_chunks || [];
          const profileId = args.filter_profile_id;
          const subjectId = args.filter_subject_id;
          const materialId = args.filter_material_id;
          const matchCount = args.match_count || 5;

          const filtered = chunks.filter(c => {
            if (!scopedUserId || c.profile_id !== scopedUserId || (profileId && c.profile_id !== profileId)) return false;
            if (subjectId && !self.state.materials.some(m => m.id === c.material_id && m.subject_id === subjectId && m.profile_id === scopedUserId)) return false;
            if (materialId && c.material_id !== materialId) return false;
            return true;
          });

          return {
            data: filtered.flatMap(c => {
              let vector: number[];
              try { vector = typeof c.embedding === 'string' ? JSON.parse(c.embedding) : c.embedding as number[]; } catch { return []; }
              const query = args.query_embedding;
              if (!Array.isArray(vector) || !Array.isArray(query) || vector.length !== query.length || !vector.length || ![...vector, ...query].every(Number.isFinite)) return [];
              const norm = Math.sqrt(vector.reduce((sum, v) => sum + v*v, 0) * query.reduce((sum: number, v: number) => sum + v*v, 0));
              if (!norm) return [];
              const similarity = vector.reduce((sum, v, i) => sum + v*query[i], 0) / norm;
              return similarity >= (args.similarity_threshold ?? 0) ? [{ ...c, similarity }] : [];
            }).sort((a,b) => b.similarity-a.similarity).slice(0, matchCount),
            error: null
          };
        }
        return { data: [], error: null };
      },

      storage: {
        from: (bucket: string) => {
          const resolveFile = (key: string) => {
            if (bucket !== 'materials' || !scopedUserId || key.split('/')[0] !== scopedUserId || key.includes('..') || key.includes('\\')) throw new Error('Storage access denied');
            const root = path.resolve(process.cwd(), 'uploads');
            const file = path.resolve(root, key);
            if (!file.startsWith(root + path.sep)) throw new Error('Invalid storage path');
            return file;
          };
          return {
            upload: async (key: string, bytes: Buffer) => {
              try { const file = resolveFile(key); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, bytes, { flag: 'wx' }); return { data: { path: key }, error: null }; }
              catch (error) { return { data: null, error }; }
            },
            download: async (key: string) => {
              try { return { data: fs.readFileSync(resolveFile(key)), error: null }; }
              catch (error) { return { data: null, error }; }
            }
          };
        }
      },

      from: (tableName: keyof LocalDatabaseState) => {
        return self.createQuery(tableName, scopedUserId);
      }
    };

    return mockClient as unknown as SupabaseClient<Database>;
  }

  private createQuery(tableName: keyof LocalDatabaseState, scopedUserId?: string) {
    const self = this;
    const tableList: any[] = (self.state[tableName] as any[]) || [];

    // Apply baseline RLS scoping if scopedUserId is provided
    let currentData = [...tableList];
    if (scopedUserId) {
      currentData = currentData.filter(r => self.rowBelongsToUser(tableName, r, scopedUserId));
    }

    const query: any = {
      select: (_fields?: string) => query,

      eq: (col: string, val: any) => {
        currentData = currentData.filter(row => row[col] === val);
        return query;
      },

      neq: (col: string, val: any) => {
        currentData = currentData.filter(row => row[col] !== val);
        return query;
      },

      in: (col: string, vals: any[]) => {
        const valArr = Array.isArray(vals) ? vals : [vals];
        currentData = currentData.filter(row => valArr.includes(row[col]));
        return query;
      },

      is: (col: string, val: any) => {
        currentData = currentData.filter(row => row[col] === val);
        return query;
      },

      gte: (col: string, val: any) => {
        currentData = currentData.filter(row => row[col] >= val);
        return query;
      },

      lte: (col: string, val: any) => {
        currentData = currentData.filter(row => row[col] <= val);
        return query;
      },

      gt: (col: string, val: any) => {
        currentData = currentData.filter(row => row[col] > val);
        return query;
      },

      lt: (col: string, val: any) => {
        currentData = currentData.filter(row => row[col] < val);
        return query;
      },

      ilike: (col: string, pattern: string) => {
        const regexStr = pattern.replace(/%/g, '.*');
        const re = new RegExp(regexStr, 'i');
        currentData = currentData.filter(row => re.test(String(row[col] || '')));
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

      single: () => {
        const item = currentData[0] || null;
        if (!item) {
          return Promise.resolve({ data: null, error: { message: `No rows found in ${tableName}` } });
        }
        return Promise.resolve({ data: item, error: null });
      },

      maybeSingle: () => {
        return Promise.resolve({ data: currentData[0] || null, error: null });
      },

      then: (resolve: any, reject?: any) => {
        return Promise.resolve({ data: currentData, error: null }).then(resolve, reject);
      },

      // Insert Method
      insert: (rows: any | any[]) => {
        const now = new Date().toISOString();
        const arr = (Array.isArray(rows) ? rows : [rows]).map(row => ({
          id: row.id || crypto.randomUUID(),
          ...(scopedUserId && !row.profile_id && ['subjects', 'exams', 'tasks', 'materials', 'document_chunks', 'quiz_results', 'quiz_runs', 'xp_events', 'study_sessions'].includes(tableName)
            ? { profile_id: scopedUserId }
            : {}),
          created_at: row.created_at || now,
          updated_at: row.updated_at || now,
          ...row
        }));

        // Strict RLS ownership check on insert
        if (scopedUserId) {
          for (const item of arr) {
            if (!self.rowBelongsToUser(tableName, item, scopedUserId)) {
              const err = { message: `Row-level security violation: ${tableName} parent does not belong to authenticated user` };
              return {
                select: () => ({
                  single: () => Promise.resolve({ data: null, error: err }),
                  maybeSingle: () => Promise.resolve({ data: null, error: err }),
                  then: (res: any, rej?: any) => Promise.resolve({ data: null, error: err }).then(res, rej)
                }),
                single: () => Promise.resolve({ data: null, error: err }),
                maybeSingle: () => Promise.resolve({ data: null, error: err }),
                then: (res: any, rej?: any) => Promise.resolve({ data: null, error: err }).then(res, rej)
              };
            }
          }
        }

        (self.state[tableName] as any[]).push(...arr);
        self.saveState();

        return {
          select: () => ({
            single: () => Promise.resolve({ data: arr[0], error: null }),
            maybeSingle: () => Promise.resolve({ data: arr[0], error: null }),
            then: (resolve: any, reject?: any) => Promise.resolve({ data: arr, error: null }).then(resolve, reject)
          }),
          single: () => Promise.resolve({ data: arr[0], error: null }),
          maybeSingle: () => Promise.resolve({ data: arr[0], error: null }),
          then: (resolve: any, reject?: any) => Promise.resolve({ data: arr, error: null }).then(resolve, reject)
        };
      },

      // Upsert Method
      upsert: (rows: any | any[]) => {
        const now = new Date().toISOString();
        const arr = (Array.isArray(rows) ? rows : [rows]).map(row => ({
          id: row.id || crypto.randomUUID(),
          created_at: row.created_at || now,
          updated_at: now,
          ...row
        }));

        const tableArr = self.state[tableName] as any[];
        for (const item of arr) {
          const idx = tableArr.findIndex(r => r.id === item.id);
          if (idx >= 0) {
            tableArr[idx] = { ...tableArr[idx], ...item };
          } else {
            tableArr.push(item);
          }
        }
        self.saveState();

        return {
          select: () => ({
            single: () => Promise.resolve({ data: arr[0], error: null }),
            maybeSingle: () => Promise.resolve({ data: arr[0], error: null }),
            then: (resolve: any, reject?: any) => Promise.resolve({ data: arr, error: null }).then(resolve, reject)
          }),
          single: () => Promise.resolve({ data: arr[0], error: null }),
          maybeSingle: () => Promise.resolve({ data: arr[0], error: null }),
          then: (resolve: any, reject?: any) => Promise.resolve({ data: arr, error: null }).then(resolve, reject)
        };
      },

      // Update Method
      update: (patch: Record<string, any>) => {
        return {
          eq: (col: string, val: any) => {
            const tableArr = self.state[tableName] as any[];
            const updated: any[] = [];
            for (let i = 0; i < tableArr.length; i++) {
              if (tableArr[i][col] === val && (!scopedUserId || self.rowBelongsToUser(tableName, tableArr[i], scopedUserId))) {
                tableArr[i] = { ...tableArr[i], ...patch, updated_at: new Date().toISOString() };
                updated.push(tableArr[i]);
              }
            }
            self.saveState();
            return {
              select: () => ({
                single: () => Promise.resolve({ data: updated[0] || null, error: null }),
                then: (res: any) => Promise.resolve({ data: updated, error: null }).then(res)
              }),
              then: (res: any) => Promise.resolve({ data: updated, error: null }).then(res)
            };
          },
          in: (col: string, vals: any[]) => {
            const tableArr = self.state[tableName] as any[];
            const updated: any[] = [];
            for (let i = 0; i < tableArr.length; i++) {
              if (vals.includes(tableArr[i][col]) && (!scopedUserId || self.rowBelongsToUser(tableName, tableArr[i], scopedUserId))) {
                tableArr[i] = { ...tableArr[i], ...patch, updated_at: new Date().toISOString() };
                updated.push(tableArr[i]);
              }
            }
            self.saveState();
            return {
              select: () => ({
                then: (res: any) => Promise.resolve({ data: updated, error: null }).then(res)
              }),
              then: (res: any) => Promise.resolve({ data: updated, error: null }).then(res)
            };
          }
        };
      },

      // Delete Method
      delete: () => {
        return {
          eq: (col: string, val: any) => {
            const tableArr = self.state[tableName] as any[];
            const deletedRows = tableArr.filter(
              r => r[col] === val && (!scopedUserId || self.rowBelongsToUser(tableName, r, scopedUserId))
            );
            (self.state[tableName] as any[]) = tableArr.filter(
              r => !(r[col] === val && (!scopedUserId || self.rowBelongsToUser(tableName, r, scopedUserId)))
            );
            if (deletedRows.length > 0) {
              if (tableName === 'subjects' && col === 'id') {
                const subIds = deletedRows.map(s => s.id);
                const unitIds = (self.state.units || []).filter(u => subIds.includes(u.subject_id)).map(u => u.id);
                self.state.topics = (self.state.topics || []).filter(t => !unitIds.includes(t.unit_id));
                self.state.units = (self.state.units || []).filter(u => !subIds.includes(u.subject_id));
                self.state.tasks = (self.state.tasks || []).filter(t => !subIds.includes(t.subject_id));
                self.state.exams = (self.state.exams || []).filter(e => !subIds.includes(e.subject_id));
                self.state.materials = (self.state.materials || []).filter(m => !subIds.includes(m.subject_id));
              } else if (tableName === 'units' && col === 'id') {
                const uIds = deletedRows.map(u => u.id);
                self.state.topics = (self.state.topics || []).filter(t => !uIds.includes(t.unit_id));
              }
              self.saveState();
            }
            return Promise.resolve({ data: [], error: null });
          },
          in: (col: string, vals: any[]) => {
            const tableArr = self.state[tableName] as any[];
            const deletedRows = tableArr.filter(
              r => vals.includes(r[col]) && (!scopedUserId || self.rowBelongsToUser(tableName, r, scopedUserId))
            );
            (self.state[tableName] as any[]) = tableArr.filter(
              r => !(vals.includes(r[col]) && (!scopedUserId || self.rowBelongsToUser(tableName, r, scopedUserId)))
            );
            if (deletedRows.length > 0) {
              if (tableName === 'subjects' && col === 'id') {
                const subIds = deletedRows.map(s => s.id);
                const unitIds = (self.state.units || []).filter(u => subIds.includes(u.subject_id)).map(u => u.id);
                self.state.topics = (self.state.topics || []).filter(t => !unitIds.includes(t.unit_id));
                self.state.units = (self.state.units || []).filter(u => !subIds.includes(u.subject_id));
                self.state.tasks = (self.state.tasks || []).filter(t => !subIds.includes(t.subject_id));
                self.state.exams = (self.state.exams || []).filter(e => !subIds.includes(e.subject_id));
                self.state.materials = (self.state.materials || []).filter(m => !subIds.includes(m.subject_id));
              } else if (tableName === 'units' && col === 'id') {
                const uIds = deletedRows.map(u => u.id);
                self.state.topics = (self.state.topics || []).filter(t => !uIds.includes(t.unit_id));
              }
              self.saveState();
            }
            return Promise.resolve({ data: [], error: null });
          }
        };
      }
    };

    return query;
  }
}

import { SupabaseClient } from '@supabase/supabase-js';
import { Database, AcademicRisk, ReadinessBreakdown, SubjectReadiness } from '../types/database.js';

export class AcademicEngineService {
  /**
   * Pure mathematical formula for readiness:
   * Readiness = (TopicCompletion × 40%) + (QuizPerformance × 30%) + (RevisionActivity × 20%) + (AssignmentCompletion × 10%)
   */
  static calculateWeightedReadiness(breakdown: ReadinessBreakdown): number {
    const raw =
      breakdown.topic_completion * 0.40 +
      breakdown.quiz_performance * 0.30 +
      breakdown.revision_activity * 0.20 +
      breakdown.assignment_completion * 0.10;

    return Math.round(Math.min(100, Math.max(0, raw)));
  }

  /**
   * Calculates topic completion percentage:
   * (completed topics / total topics) * 100
   */
  static calculateTopicCompletion(topics: { status: string }[]): number {
    if (!topics || topics.length === 0) return 0;
    const completed = topics.filter(t => t.status === 'completed').length;
    return Math.round((completed / topics.length) * 100);
  }

  /**
   * Calculates quiz performance percentage:
   * Average of recent quiz attempts for the subject
   */
  static calculateQuizPerformance(quizzes: { score: number }[]): number {
    if (!quizzes || quizzes.length === 0) return 0;
    const total = quizzes.reduce((acc, q) => acc + q.score, 0);
    return Math.round(Math.min(100, Math.max(0, total / quizzes.length)));
  }

  /**
   * Calculates revision activity score (0-100):
   * Assesses focus & revision time in minutes against a weekly 120-minute benchmark
   */
  static calculateRevisionActivity(sessions: { duration_minutes: number; session_type: string }[]): number {
    if (!sessions || sessions.length === 0) return 0;
    const totalMinutes = sessions.reduce((acc, s) => acc + (s.duration_minutes || 0), 0);
    // 120 minutes = 100% benchmark
    const score = (totalMinutes / 120) * 100;
    return Math.round(Math.min(100, Math.max(0, score)));
  }

  /**
   * Calculates assignment completion percentage:
   * (completed assignments / total assignments) * 100
   * If no assignments have been set for this subject, student has no debt -> 100%
   */
  static calculateAssignmentCompletion(assignments: { is_completed: boolean }[]): number {
    if (!assignments || assignments.length === 0) return 100;
    const completed = assignments.filter(a => a.is_completed).length;
    return Math.round((completed / assignments.length) * 100);
  }

  /**
   * Computes readiness for a single subject from stored database records.
   */
  static async getSubjectReadiness(
    db: SupabaseClient<Database>,
    subjectId: string
  ): Promise<SubjectReadiness> {
    const client = db as any;
    // 1. Fetch units for this subject
    const { data: units } = await client
      .from('units')
      .select('id')
      .eq('subject_id', subjectId);

    const unitIds = (units || []).map((u: any) => u.id);

    // 2. Fetch topics
    let topics: { status: string; is_weak: boolean; title: string }[] = [];
    if (unitIds.length > 0) {
      const { data: topicData } = await client
        .from('topics')
        .select('status, is_weak, title')
        .in('unit_id', unitIds);
      topics = topicData || [];
    }

    // 3. Fetch quiz results
    const { data: quizData } = await client
      .from('quiz_results')
      .select('score')
      .eq('subject_id', subjectId)
      .order('created_at', { ascending: false })
      .limit(10);

    // 4. Fetch study sessions (recent revision/focus)
    const { data: sessionData } = await client
      .from('study_sessions')
      .select('duration_minutes, session_type')
      .eq('subject_id', subjectId);

    // 5. Fetch assignments
    const { data: taskData } = await client
      .from('tasks')
      .select('is_completed, type')
      .eq('subject_id', subjectId)
      .eq('type', 'Assignment');

    const breakdown: ReadinessBreakdown = {
      topic_completion: this.calculateTopicCompletion(topics),
      quiz_performance: this.calculateQuizPerformance(quizData || []),
      revision_activity: this.calculateRevisionActivity(sessionData || []),
      assignment_completion: this.calculateAssignmentCompletion(taskData || [])
    };

    const readiness_percentage = this.calculateWeightedReadiness(breakdown);
    const risks = await this.evaluateSubjectRisks(db, subjectId, topics);

    return {
      subject_id: subjectId,
      readiness_percentage,
      breakdown,
      risks
    };
  }

  /**
   * Computes readiness across all subjects for a student.
   */
  static async getAllSubjectsReadiness(
    db: SupabaseClient<Database>
  ): Promise<SubjectReadiness[]> {
    const client = db as any;
    const { data: subjects } = await client
      .from('subjects')
      .select('id')
      .order('created_at', { ascending: true });

    if (!subjects || subjects.length === 0) return [];

    const results: SubjectReadiness[] = [];
    for (const sub of subjects) {
      const r = await this.getSubjectReadiness(db, sub.id);
      results.push(r);
    }
    return results;
  }

  /**
   * Pure evaluation of reasoned risk rules for a given subject:
   * - HIGH_EXAM_RISK: Exam is <= 7 days away and >= 2 topics are unfinished or weak.
   * - DEADLINE_RISK: An assignment is pending and due within 2 days (48h).
   * - PERFORMANCE_RISK: Recent quiz performance is falling (>= 10% drop or score < 60%).
   * - WORKLOAD_RISK: Multiple deadlines overlap on the same calendar day.
   */
  static async evaluateSubjectRisks(
    db: SupabaseClient<Database>,
    subjectId: string,
    cachedTopics?: { status: string; is_weak: boolean; title: string }[]
  ): Promise<AcademicRisk[]> {
    const client = db as any;
    const risks: AcademicRisk[] = [];
    const now = new Date();

    // 1. Fetch exams for subject
    const { data: exams } = await client
      .from('exams')
      .select('*')
      .eq('subject_id', subjectId);

    // Fetch topics if not supplied
    let topics = cachedTopics;
    if (!topics) {
      const { data: units } = await client.from('units').select('id').eq('subject_id', subjectId);
      const unitIds = (units || []).map((u: any) => u.id);
      if (unitIds.length > 0) {
        const { data: topicData } = await client.from('topics').select('status, is_weak, title').in('unit_id', unitIds);
        topics = topicData || [];
      } else {
        topics = [];
      }
    }
    // 2. Fetch tasks for subject
    const { data: tasks } = await client
      .from('tasks')
      .select('*')
      .eq('subject_id', subjectId)
      .eq('is_completed', false);

    // 3. Fetch recent quiz scores
    const { data: quizResults } = await client
      .from('quiz_results')
      .select('score, created_at')
      .eq('subject_id', subjectId)
      .order('created_at', { ascending: false })
      .limit(5);

    // RULE 1: HIGH_EXAM_RISK
    // An exam is 7 or fewer days away AND 2 or more topics are unfinished or weak
    if (exams && exams.length > 0) {
      const incompleteOrWeakTopics = (topics || []).filter(
        t => t.status !== 'completed' || t.is_weak
      );

      for (const exam of exams) {
        const examDate = new Date(exam.exam_date);
        const diffMs = examDate.getTime() - now.getTime();
        const daysAway = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (daysAway >= 0 && daysAway <= 7 && incompleteOrWeakTopics.length >= 2) {
          const weakNames = incompleteOrWeakTopics.slice(0, 3).map(t => t.title).join(', ');
          risks.push({
            type: 'HIGH_EXAM_RISK',
            reason: `Exam '${exam.title}' is in ${daysAway} day${daysAway === 1 ? '' : 's'}, but ${incompleteOrWeakTopics.length} topic${incompleteOrWeakTopics.length === 1 ? '' : 's'} (${weakNames}) remain unfinished or weak.`,
            severity: 'high',
            subject_id: subjectId,
            metadata: {
              exam_id: exam.id,
              days_away: daysAway,
              unfinished_count: incompleteOrWeakTopics.length
            }
          });
        }
      }
    }

    // RULE 2: DEADLINE_RISK
    // An assignment is pending and due within 2 days (48 hours)
    if (tasks && tasks.length > 0) {
      for (const task of tasks) {
        if (task.due_date && task.type === 'Assignment') {
          const dueDate = new Date(task.due_date);
          const diffHours = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);

          if (diffHours >= 0 && diffHours <= 48) {
            const hoursRounded = Math.round(diffHours);
            risks.push({
              type: 'DEADLINE_RISK',
              reason: `Assignment '${task.title}' is pending and due in ${hoursRounded} hour${hoursRounded === 1 ? '' : 's'}.`,
              severity: hoursRounded <= 24 ? 'high' : 'medium',
              subject_id: subjectId,
              metadata: {
                task_id: task.id,
                hours_remaining: hoursRounded
              }
            });
          }
        }
      }
    }

    // RULE 3: PERFORMANCE_RISK
    // Recent quiz performance is falling (e.g. drop >= 10 points or latest score < 60%)
    if (quizResults && quizResults.length >= 1) {
      const latestScore = quizResults[0].score;
      if (quizResults.length >= 2) {
        const previousScore = quizResults[1].score;
        const drop = previousScore - latestScore;

        if (drop >= 10) {
          risks.push({
            type: 'PERFORMANCE_RISK',
            reason: `Recent quiz scores have declined by ${Math.round(drop)}% (from ${previousScore}% down to ${latestScore}%).`,
            severity: latestScore < 50 ? 'high' : 'medium',
            subject_id: subjectId,
            metadata: { latestScore, previousScore, drop }
          });
        } else if (latestScore < 60) {
          risks.push({
            type: 'PERFORMANCE_RISK',
            reason: `Latest quiz score of ${latestScore}% is below the target passing threshold (60%).`,
            severity: latestScore < 50 ? 'high' : 'medium',
            subject_id: subjectId,
            metadata: { latestScore }
          });
        }
      } else if (latestScore < 60) {
        risks.push({
          type: 'PERFORMANCE_RISK',
          reason: `Initial quiz score of ${latestScore}% indicates weak topic recall (below 60%).`,
          severity: latestScore < 50 ? 'high' : 'medium',
          subject_id: subjectId,
          metadata: { latestScore }
        });
      }
    }

    // RULE 4: WORKLOAD_RISK
    // Multiple deadlines/exams overlap within the same 24-hour window
    const activeDeadlines: { title: string; date: string }[] = [];
    if (tasks) {
      for (const t of tasks) {
        if (t.due_date) activeDeadlines.push({ title: t.title, date: t.due_date.substring(0, 10) });
      }
    }
    if (exams) {
      for (const e of exams) {
        if (e.exam_date) activeDeadlines.push({ title: `Exam: ${e.title}`, date: e.exam_date.substring(0, 10) });
      }
    }

    const dateMap = new Map<string, string[]>();
    for (const d of activeDeadlines) {
      const list = dateMap.get(d.date) || [];
      list.push(d.title);
      dateMap.set(d.date, list);
    }

    for (const [dateStr, titles] of dateMap.entries()) {
      if (titles.length >= 2) {
        risks.push({
          type: 'WORKLOAD_RISK',
          reason: `${titles.length} competing deadlines coincide on ${dateStr}: ${titles.join(' and ')}.`,
          severity: titles.length >= 3 ? 'high' : 'medium',
          subject_id: subjectId,
          metadata: { date: dateStr, count: titles.length, titles }
        });
      }
    }

    return risks;
  }

  /**
   * Evaluates all risks across the entire student profile.
   */
  static async evaluateAllStudentRisks(
    db: SupabaseClient<Database>
  ): Promise<AcademicRisk[]> {
    const client = db as any;
    const { data: subjects } = await client
      .from('subjects')
      .select('id');

    const allRisks: AcademicRisk[] = [];

    if (subjects && subjects.length > 0) {
      for (const sub of subjects) {
        const subRisks = await this.evaluateSubjectRisks(db, sub.id);
        allRisks.push(...subRisks);
      }
    }

    // Also check student-wide standalone task workload conflicts
    const now = new Date();
    const { data: unassignedTasks } = await client
      .from('tasks')
      .select('*')
      .is('subject_id', null)
      .eq('is_completed', false);

    if (unassignedTasks && unassignedTasks.length > 0) {
      for (const task of unassignedTasks) {
        if (task.due_date && task.type === 'Assignment') {
          const dueDate = new Date(task.due_date);
          const diffHours = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
          if (diffHours >= 0 && diffHours <= 48) {
            allRisks.push({
              type: 'DEADLINE_RISK',
              reason: `General commitment '${task.title}' is due in ${Math.round(diffHours)} hours.`,
              severity: diffHours <= 24 ? 'high' : 'medium',
              metadata: { task_id: task.id }
            });
          }
        }
      }
    }

    return allRisks;
  }
}

import { SupabaseClient } from '@supabase/supabase-js';
import {
  Database,
  PlannerContextResponse,
  SubjectPlannerContext,
  SubjectExamSummary,
  TopicSummary,
  TaskSummary,
  QuizPerformanceSummary,
  StudyTimeSettings
} from '../types/database.js';
import { AppError } from '../types/errors.js';
import { AcademicEngineService } from './academic-engine.service.js';

export class PlannerContextService {
  /**
   * Packages everything the adaptive planner needs in one unified call:
   * - Student availability settings
   * - Per-subject exam dates and countdowns
   * - Weak and unfinished topics
   * - Pending tasks and assignments
   * - Recent quiz performance
   * - Mathematical readiness score and breakdown
   * - Evaluated reasoned risks
   *
   * Pure, deterministic aggregation with zero AI/LLM calls.
   */
  static async getPlannerContext(
    db: SupabaseClient<Database>,
    userId: string,
    filterSubjectId?: string
  ): Promise<PlannerContextResponse> {
    const client = db as any;
    const now = new Date();

    // 1. Fetch Student Profile & Study Settings
    const { data: profile } = await client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    const studySettings: StudyTimeSettings = {
      preferred_focus_time: profile?.preferred_focus_time || 'Evening (5:00 PM - 8:00 PM)',
      daily_study_target_minutes: 120, // 2-hour daily benchmark
      weekly_study_target_minutes: 840,
      available_hours_per_day: profile?.available_hours_per_day == null
        ? 2.0
        : Number(profile.available_hours_per_day)
    };

    // 2. Fetch Subjects
    let subjectQuery = client
      .from('subjects')
      .select('*')
      .order('created_at', { ascending: true });

    if (filterSubjectId) {
      subjectQuery = subjectQuery.eq('id', filterSubjectId);
    }

    const { data: subjects } = await subjectQuery;
    const subjectList = subjects || [];

    // 3. Assemble per-subject planner context
    const subjectContexts: SubjectPlannerContext[] = [];

    for (const sub of subjectList) {
      // Units for topic lookup
      const { data: units } = await client
        .from('units')
        .select('id, title')
        .eq('subject_id', sub.id);

      const unitMap = new Map<string, string>();
      const unitIds: string[] = [];
      for (const u of units || []) {
        unitMap.set(u.id, u.title);
        unitIds.push(u.id);
      }

      // Topics: weak or unfinished
      let weakAndUnfinishedTopics: TopicSummary[] = [];
      if (unitIds.length > 0) {
        const { data: topicData } = await client
          .from('topics')
          .select('*')
          .in('unit_id', unitIds);

        const allTopics = topicData || [];
        weakAndUnfinishedTopics = allTopics
          .filter((t: any) => t.status !== 'completed' || t.is_weak)
          .map((t: any) => ({
            id: t.id,
            unit_id: t.unit_id,
            unit_title: unitMap.get(t.unit_id),
            title: t.title,
            status: t.status,
            is_weak: Boolean(t.is_weak),
            mastery_score: t.mastery_score || 0,
            estimated_study_hours: t.estimated_study_hours == null ? null : Number(t.estimated_study_hours)
          }));
      }

      // Exams
      const { data: examsData } = await client
        .from('exams')
        .select('*')
        .eq('subject_id', sub.id)
        .order('exam_date', { ascending: true });

      const exams: SubjectExamSummary[] = (examsData || []).map((e: any) => {
        const diffMs = new Date(e.exam_date).getTime() - now.getTime();
        const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        return {
          id: e.id,
          title: e.title,
          exam_date: e.exam_date,
          days_until_exam: daysUntil,
          target_score: e.target_score
        };
      });

      // Pending tasks
      const { data: taskData } = await client
        .from('tasks')
        .select('*')
        .eq('subject_id', sub.id)
        .eq('is_completed', false)
        .order('due_date', { ascending: true });

      const pendingTasks: TaskSummary[] = (taskData || []).map((t: any) => {
        let daysUntilDue: number | null = null;
        if (t.due_date) {
          const diffMs = new Date(t.due_date).getTime() - now.getTime();
          daysUntilDue = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        }
        return {
          id: t.id,
          title: t.title,
          type: t.type,
          priority: t.priority,
          due_date: t.due_date,
          days_until_due: daysUntilDue,
          is_completed: Boolean(t.is_completed)
        };
      });

      // Recent quiz performance
      const { data: quizData } = await client
        .from('quiz_results')
        .select('*')
        .eq('subject_id', sub.id)
        .order('created_at', { ascending: false })
        .limit(5);

      const recentQuizzes: QuizPerformanceSummary[] = (quizData || []).map((q: any) => ({
        id: q.id,
        score: q.score,
        total_questions: q.total_questions,
        correct_answers: q.correct_answers,
        weak_topics_identified: q.weak_topics_identified || [],
        created_at: q.created_at
      }));

      // Readiness & active risks
      const readiness = await AcademicEngineService.getSubjectReadiness(db, sub.id);

      subjectContexts.push({
        subject_id: sub.id,
        subject_name: sub.name,
        subject_code: sub.code,
        subject_color: sub.color,
        readiness_percentage: readiness.readiness_percentage,
        readiness_breakdown: readiness.breakdown,
        readiness_basis: readiness.basis,
        exams,
        weak_and_unfinished_topics: weakAndUnfinishedTopics,
        pending_tasks: pendingTasks,
        recent_quiz_performance: recentQuizzes,
        active_risks: readiness.risks
      });
    }

    // 4. Fetch general/unassigned tasks
    const { data: unassignedData } = await client
      .from('tasks')
      .select('*')
      .is('subject_id', null)
      .eq('is_completed', false)
      .order('due_date', { ascending: true });

    const unassignedPendingTasks: TaskSummary[] = (unassignedData || []).map((t: any) => {
      let daysUntilDue: number | null = null;
      if (t.due_date) {
        const diffMs = new Date(t.due_date).getTime() - now.getTime();
        daysUntilDue = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      }
      return {
        id: t.id,
        title: t.title,
        type: t.type,
        priority: t.priority,
        due_date: t.due_date,
        days_until_due: daysUntilDue,
        is_completed: Boolean(t.is_completed)
      };
    });

    // 5. Global risks across subjects
    const globalRisks = await AcademicEngineService.evaluateAllStudentRisks(db);

    return {
      student: {
        id: userId,
        full_name: profile?.full_name || null,
        course: profile?.course || 'Computer Science',
        semester: profile?.semester || 1,
        study_time_settings: studySettings
      },
      subjects: subjectContexts,
      unassigned_pending_tasks: unassignedPendingTasks,
      global_risks: globalRisks,
      generated_at: now.toISOString()
    };
  }

  static assertPlanFeasible(context: PlannerContextResponse): void {
    const availableHoursPerDay = context.student.study_time_settings.available_hours_per_day;

    for (const subject of context.subjects) {
      const imminentExams = subject.exams.filter(exam => exam.days_until_exam >= 0 && exam.days_until_exam <= 7);
      for (const exam of imminentExams) {
        const topics = subject.weak_and_unfinished_topics;
        const unestimatedTopics = topics.filter(topic => topic.estimated_study_hours == null);
        if (unestimatedTopics.length > 0) {
          const topicTitles = unestimatedTopics.map(topic => topic.title).join(', ');
          throw AppError.insufficientData(
            `Add estimated study hours for these weak or unfinished topics before planning for "${exam.title}": ${topicTitles}.`
          );
        }

        const requiredHours = topics.reduce((total, topic) => total + (topic.estimated_study_hours ?? 0), 0);
        const availableHours = availableHoursPerDay * exam.days_until_exam;
        if (requiredHours > availableHours) {
          throw AppError.constraintConflict(
            `Preparing for "${exam.title}" requires ${requiredHours.toFixed(1)} study hours across weak or unfinished topics, but only ${availableHours.toFixed(1)} hours are available before the exam. Increase your daily study availability or revise topic estimates before generating a plan.`
          );
        }
      }
    }
  }
}

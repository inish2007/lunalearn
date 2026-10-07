-- Additive indexes for ownership-filtered ordered task/exam reads.
CREATE INDEX IF NOT EXISTS idx_tasks_profile_completed_due ON public.tasks(profile_id, is_completed, due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_profile_subject_due ON public.tasks(profile_id, subject_id, due_date);
CREATE INDEX IF NOT EXISTS idx_exams_profile_date ON public.exams(profile_id, exam_date);
CREATE INDEX IF NOT EXISTS idx_exams_profile_subject_date ON public.exams(profile_id, subject_id, exam_date);

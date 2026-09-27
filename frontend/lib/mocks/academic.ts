/**
 * LunaLearn Academic Mock & Empty Data Layer
 * Defaults to returning empty arrays (never fabricated data),
 * strictly matching CONTRACTS.md.
 */

import type { Exam, Material, Subject, Task, AcademicRisk, SubjectReadiness } from '@/lib/types/academic';

export const subjects: Subject[] = [];
export const tasks: Task[] = [];
export const exams: Exam[] = [];
export const materials: Material[] = [];
export const risks: AcademicRisk[] = [];
export const readinessList: SubjectReadiness[] = [];

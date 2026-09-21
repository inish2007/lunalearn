export type RiskLevel = 'High' | 'Medium' | 'On track';
export interface Subject { id: string; name: string; code: string; progress: number; readiness: number; color: string; topics: number; completedTopics: number; weakTopics: string[]; }
export interface Task { id: string; title: string; subject: string; due: string; type: 'Assignment' | 'Task' | 'Revision'; priority: 'High' | 'Medium' | 'Low'; done?: boolean; }
export interface Exam { id: string; title: string; subject: string; date: string; daysAway: number; readiness: number; weakTopics: string[]; reason: string; }
export interface Material { id: string; name: string; subject: string; folder: string; type: 'PDF' | 'Notes' | 'Slides'; size: string; updated: string; }

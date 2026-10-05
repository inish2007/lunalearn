import crypto from 'crypto';
import { SubmitQuizResponseData, QuizQuestion } from '../types/quiz.js';
export function answerMatches(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
export function evaluateQuiz(run: { id: string; subject_id: string; topic_id?: string; questions: QuizQuestion[] }, answers: any[]): SubmitQuizResponseData {
  if (!Array.isArray(answers) || answers.length !== run.questions.length || new Set(answers.map(a => a.question_id)).size !== answers.length || answers.some(a => !run.questions.some(q => q.id === a.question_id))) throw new Error('Submit exactly one answer for every quiz question.');
  const evaluations = run.questions.map(q => {
    const answer = answers.find(a => a.question_id === q.id);
    const user_answer = String(answer?.user_answer ?? answer?.selected_answer ?? '').trim();
    return { question_id: q.id, question: q.question, user_answer, correct_answer: q.correct_answer, explanation: q.explanation, topic_id: q.topic_id, topic_title: q.topic_title, is_correct: answerMatches(user_answer, q.correct_answer) };
  });
  const correct = evaluations.filter(q => q.is_correct).length;
  const score = Math.round(correct / evaluations.length * 100);
  return { quiz_result_id: crypto.randomUUID(), subject_id: run.subject_id, topic_id: run.topic_id, score, total_questions: evaluations.length, correct_answers: correct, passed: score >= 60, weak_topics_identified: [...new Set(evaluations.filter(q => !q.is_correct).map(q => q.topic_title))], question_evaluations: evaluations, created_at: new Date().toISOString() };
}

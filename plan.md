# LunaLearn real-data repair and product improvement plan

Approved 2026-10-06. Implement phases 1–14 in this order, one commit per phase. Update context.md after each phase and CONTRACTS.md with every shared interface change. OCR (phase 3) and natural-language commands (phase 13) remain plans only. Preserve auth/RLS, local/Supabase parity, themes, and the canonical DBMS demo. Additive migrations only; no merge or deployment. The original layer guide is preserved in layered-build-plan.md (Windows filenames are case-insensitive).

## 1. Explain readiness
Owners: backend/src/services/academic-engine.service.ts — calculateWeightedReadiness, calculateTopicCompletion, calculateQuizPerformance, calculateRevisionActivity, calculateAssignmentCompletion, getSubjectReadiness; frontend/components/Workspace.tsx — Exams; frontend/components/Dashboard.tsx — Dashboard.
Cause: percentages omit input counts; revision says weekly but includes all sessions.
Fix: keep rounded component formulas: completed/all topics (empty=0), mean latest 10 quizzes (empty=0), min(100, minutes/120*100), completed/all Assignment tasks (empty=100); weighted total = round(.4T+.3Q+.2R+.1A). Change revision to started_at within rolling seven days, excluding future sessions. Add basis counts, window, weights and timestamp to readiness and planner types; reusable UI explains counts/defaults and links to study actions.

## 2. PDF preview
Owners: Workspace.Materials/submitUpload; AcademicContext.uploadMaterialPdf; RagMaterialService.processAndIndexPdf; StorageService.uploadPdf/writeLocalFallback; LocalDevStore.createClient; handleDomainRoutes.
Cause: no open action/content route; local storage discards upload bytes and returns a dummy PDF; filesystem errors are swallowed.
Fix: real local bytes, honest live-storage errors, authenticated GET /api/materials/:id/content from owned metadata with safe path containment. In-app browser PDF dialog via authenticated Blob fetch: loading/error, close/download, page fragments, URL cleanup. Missing old originals require re-upload.

## 3. Assistant formatting and OCR plan
Owners: Workspace.Assistant/send; StudyAssistantService.askAssistant/buildSystemPrompt/callGeminiWithResilience; PdfService.extractText; RagMaterialService.processAndIndexPdf.
Cause: raw JSX text, discarded sources, fallback falsely marked as Gemini; pdf-parse cannot OCR.
Implement safe Markdown headings/lists/emphasis/code without raw HTML or unsafe schemes; plain user messages; source links to PDF pages, material scope, truthful fallback.
OCR DOCUMENTATION ONLY: page-level local OCR adapter after text-quality detection, bounded rendering/work, cancellation and job states; per-page provenance, mixed-document deduplication, retained original; tests for scanned/mixed/rotated/blank/unreadable pages. No OCR runtime/dependencies.

## 4. Real material-grounded quizzes
Owners: QuizService.generateQuiz/generateQuestionsWithGemini/buildQuizPrompt/parseGeminiQuizJson/generateOfflineQuestions/scoreAndSubmitQuiz; CircuitBreaker.execute; backend/src/types/quiz.ts; quiz.routes.ts; Workspace.Quizzes/beginQuiz/submitQuiz; frontend/lib/api.ts.
Causes: fallback mislabeled; 250-character excerpts; repeated topic/low sampling/no history; positional citations; silent syllabus mode; client answer keys; failed result inserts reported successful.
Fix: require usable material, actionable INSUFFICIENT_DATA; bounded full chunks; material/topic/count/difficulty controls. Adaptive difficulty: <60 easy, 60–79 medium, >=80 hard, no history medium. Persist runs and authoritative answers/fingerprints, exclude recent exact stems, validate question count/options/answers/topic ownership/source IDs, one bounded regeneration. Truthful model/is_fallback/notice; configuration failure for missing credentials; never generic canned questions in normal generation. Provider failure may return explicit grounded practice only if valid, otherwise error. Submit quiz_id+answers, durable idempotency, await weak-topic updates, fail on persistence errors.

## 5. Honest percentages
Owners: Workspace.Learning/Exams/Analytics/Profile; Dashboard; AppShell; Ui.Progress/CountUpAll; AcademicProvider.refreshAll; AcademicEngineService.getSubjectReadiness.
Causes: failures become empty/zero, low scores hidden, artificial XP minimum, global numeric DOM mutation.
Fix: audit every percent; show unavailable versus zero, dataset-specific errors, query failure propagation, focus/minute refresh; clamp accessible Progress, remove CountUpAll. Sources: subject readiness=weighted engine; drivers=phase1; unit completion=completed/total; quiz=server correct/count; average=mean available subject readiness with sample count; target=student goal; XP=phase6 formula.

## 6. XP and sessions
Owners: AppShell/Profile, database.ts profiles/study_sessions, handleDomainRoutes topic writes, QuizService.scoreAndSubmitQuiz. Cause: stored XP fields have no earning system; no session API/UI.
Fix: authenticated session logging/history (subject/topic/type/start/end/notes), timestamp-derived duration; reject future, overlapping, nonpositive sessions. Immutable uniquely keyed XP events: first topic completion 50; first persisted quiz submission round(score/5); session floor(minutes/5), daily cap24; level=1+floor(total/500), progress=(total%500)/5. Server transactions and duplicate protection. Backfill real eligible activity once, exclude fabricated importer records and unverified legacy quiz results. Breakdown/history/next level UI and refresh derived data.

## 7. Dates
Owners: CreateExamSchema/UpdateExamSchema, handleDomainRoutes exam mutations, Workspace.Exams/handleCreate, Dashboard, PlannerContextService.getPlannerContext/assertPlanFeasible.
Cause: format-only validation and raw negative countdowns; past exam selected as upcoming.
Fix: reject new/changed past timestamps with field message; preserve historical records and other-field edits; central passed/today/tomorrow/days display; upcoming filters; remaining usable same-day capacity.

## 8. Tasks and exams depth
Owners: Workspace.Tasks/Exams/handleCreate, AcademicContext CRUD, api.tasks.update/api.exams.update, handleDomainRoutes and schemas.
Cause: available PATCH APIs lack UI.
Fix: task edit/search/subject/type/priority filters/date-priority sort/Today-Upcoming-Overdue-Completed views; clear/reschedule deadlines/reopen tasks; pending/error states. Exam edit/upcoming-history/subject filter/targets, readiness basis, weak-topic checklist, scoped preparation links. Preserve optimistic concurrency. No recurrence, subtasks, reminder infrastructure or exam-specific syllabus tables.

## 9. Simulator
Owners: Workspace.Simulator; AcademicEngineService; PlannerContextService.
Cause: slider only changes narrative, including false improvement at saturation.
Fix: POST /api/planner/simulate accepts owned subject/topic hypothetical completion, extra minutes, availability; shared engine baseline/projected drivers/delta/required-available hours/feasibility/assumptions. No quiz improvement inferred, no writes, cap revision; actual logging separate.

## 10. Settings
Owners: Workspace.Settings; ThemeProvider/setTheme/applyTheme; UpdateProfileSettingsSchema; auth.routes profile PATCH; PlannerContextService; api.auth.
Cause: theme works but profile/preferences inert, static Online claim, zero replaced by defaults.
Fix: persisted validated name/course/semester/focus start-end/availability; profile+planner refresh. Browser-local theme labeled and validated, OS appearance wording, preserve zero; actual request state; saved/loading/errors. Focus window used by scheduling.

## 11. Distinct Learning and Planner
Owners: Workspace.Learning/Planner; AcademicContext.loadUnitsAndTopics/createTopic/updateTopic; PlannerContextService.getPlannerContext/assertPlanFeasible.
Cause: planner first-three-subject slots/first task are not schedule; missing estimates ignored.
Fix: Learning owns syllabus/completion/weakness/material/quiz feedback/estimates. Planner owns budgeted daily topic/task blocks with duration/reason/deadline/start/log. Deterministic shared scheduler prioritizes deadlines/imminent exams/weak/unfinished; student-entered task estimates, no invented durations; global capacity across subjects once; explicit missing-data/conflict states; focus window and actual sessions.

## 12. Dashboard/calendar
Owners: Dashboard, AcademicProvider.refreshAll and planner/task/exam feeds.
Cause: generic mission and fragmented summaries; no calendar.
Fix: top nearest upcoming exam/readiness basis/today time; main next block/prioritized tasks; side month calendar+agenda; lower subject progress/risks. Mobile single column. Events from exams, task deadlines, logged sessions and explicitly labeled generated blocks. Prev/next/Today/date selection/event links/task completion; honest empty dates; remove inert menus.

## 13. Natural-language commands — PLAN ONLY
Owners: StudyAssistantService.askAssistant, assistant.routes.ts and domain/material APIs. Cause: no intent dispatcher, organization is subjects/units not folders.
Document future allowlisted typed commands, Gemini parsing, authenticated entity resolution, preview, existing-service execution. “show my DBMS notes” filters/navigates; “save this PDF to my Maths folder” requires selected file and resolves subject/unit. Clarify ambiguity, preview writes, idempotency/ownership, never execute document instructions. Document material-move support and tests. No command implementation or folder migration.

## 14. Full real-data/control sweep
Audit inventory: completed. Verification distinguishes source/control review, automated fixtures, browser actions, and unavailable live Supabase.
| File/function or owner; finding | Correction / phase | Verification status |
|---|---|---|
| LocalDevStore.createClient fake file storage | real bytes, 2 | Done — source/contract review and relevant regression |
| StorageService.writeLocalFallback swallowed errors | propagate, 2 | Done — source/contract review and relevant regression |
| Materials.submitUpload fake metadata/1,024,000 bytes | require PDF, remove unsupported choices, 14 | Done — source/contract review and relevant regression |
| AcademicProvider.importSyllabus invented file/units/topics/mastery | real upload/manual entry, 14 | Done — source/contract review and relevant regression |
| Login.handleProcessSyllabus staged delays/false AI extraction | actual status, 14 | Done — source/contract review and relevant regression |
| quiz/assistant fallback mislabel | 3–4 | Done — source/contract review and relevant regression |
| positional quiz citations/client keys/failed writes | 4 | Done — source/contract review and relevant regression |
| refreshAll suppressed failures/engine query failures | 5 | Done — source/contract review and relevant regression |
| XP 15% minimum | 6 | Done — source/contract review and relevant regression |
| past exams/negative counts | 7 | Done — source/contract review and relevant regression |
| fake planner slots/missing-data suppression | 11 | Done — source/contract review and relevant regression |
| zero availability replaced | 10 | Done — source/contract review and relevant regression |
| narrative-only simulator | 9 | Done — source/contract review and relevant regression |
| settings inert/static online | 10 | Done — source/contract review and relevant regression |
| demo identity/course/focus fallbacks | neutral missing data, 14 | Done — source/contract review and relevant regression |
| assistant discarded sources/null material scope | 3 | Done — source/contract review and relevant regression |
| Indexed materials includes unprocessed files | actual status, 14 | Done — source/contract review and relevant regression |
| CountUpAll mutates all numeric text | remove, 5 | Done — source/contract review and relevant regression |
| unused Ui.Mission/statMeta fixed DBMS/time/streak/totals/button | remove, 14 | Done — source/contract review and relevant regression |
| RAG fixed inconsistent progress percentages | named stages/measured counts, 14 | Done — source/contract review and relevant regression |
| Analytics threshold/sample unexplained | explanation and unavailable states, 14 | Done — source/contract review and relevant regression |
| frontend/lib/mocks/academic.ts empty exports | retain only if used; no fake activity | Done — source/contract review and relevant regression |
| demo login/seed | preserve explicitly labeled | Done — source/contract review and relevant regression |
Finish route-by-route buttons/links/filters/forms/previews, wire or remove inert affordances. Constants for design/formulas/defaults and test fixtures are not fabricated student data.

## Interfaces and validation
Update backend/frontend types, wrappers, local-store parity, additive migrations and CONTRACTS with readiness basis, PDF retrieval, quiz run/difficulty/submission, sessions/XP, simulation/schedule, settings. Tests: formula boundaries/empty/latest10/seven-day/rounding; file bytes/reload/ownership/missing/corrupt/cleanup; Markdown/citations/unsafe HTML; AI success/failure/open circuit/missing material/count/duplicates/difficulty/source tampering/durable submission; XP duplicate/overlap/cap; dates/history/timezones; edit/filter/persist/zero/estimates/capacity; simulation nonmutation/calendar dates. Backend typecheck/relevant tests each phase, frontend production build and final core-loop walkthrough. Deterministic provider mocks separately from live Gemini verification; unavailable live provider must be reported, never substitute fallback as proof.

## Execution log
Plan saved before implementation. Phases 1–13 committed separately; phase 14 final verification recorded below. Live Supabase remains unverified. Live Gemini succeeded on a bounded retry (two source-grounded questions and 1,536-dimensional embeddings); earlier 503 responses remain recorded as failures.

### Percentage audit: all academic bars use engine or topic counts; targets are student goals; average uses returned readiness sample; global number animation removed. Missing required datasets now block misleading zero/empty displays. XP bar replaced in phase 6.


### Phase 14 additional findings and corrections
| File / function | Finding and correction | Phase | Verification status |
|---|---|---|---|
| backend/src/lib/local-store.ts / createClient.searchRpc; semantic-search.service.ts / searchWithClientFallback | Constant 0.85 relevance and synthetic missing vectors removed; compare stored vectors, enforce scope, skip missing embeddings | 14 | Done; retrieval/provider fixtures |
| backend/src/services/rag-material.service.ts / processAndIndexPdf | Metadata was created only after embeddings; now retain original as unprocessed before extraction, mark processed only after all chunk writes succeed | 14 | Done; failed-indexing original-read fixture |
| backend/src/services/quiz.service.ts / generateQuiz; migration 20261006000005 | Removed unused canned bank; validate model-selected topic IDs; answer table is backend-only in Supabase, ownership-checked submission RPC retained | 14 | Done locally; migration/RLS live execution unverified |
| backend/src/middleware/auth.middleware.ts / requireAuth | Handler/database failures incorrectly became 401; token verification alone maps to 401 | 14 | Done; auth regression |
| backend/src/scripts/seed-demo.ts / main, seedDemoDataset | Local reset was only in-memory; now saves actual local demo. Replace non-UUID IDs; use ledger XP and consistent 15/20=75% quiz fixture | 14 | Done; disposable fixture server |
| frontend/lib/context/AcademicContext.tsx / loadUnitsAndTopics | Syllabus failures silently ignored; visible dataset error now retained | 14 | Done; source review/typechecks |
| frontend/components/Workspace.tsx / Learning | Completing a topic silently cleared its weak marker; preserve marker. Label checkboxes/delete controls; show delete errors | 14 | Done; control/source review |
| Workspace / Quizzes, Assistant | Stale material/topic selection across subject switches; reset scope. Dynamic question-count copy and accessible Send control | 14 | Done; browser/source review |
| backend/src/types/errors.ts / insufficientData | Generic message hid the required PDF upload action; preserve actionable service message | 14 | Done; browser finding corrected |
| PlannerView / PlannerView; Dashboard / Dashboard | Old display-only focus label and inconsistent default timezone; show scheduler window and timezone | 14 | Done; browser finding corrected |
| SimulatorView / SimulatorView; SimulationService / simulate | Unknown hours rendered as Unknownh; format explicitly, disclose eight-day capacity, charge hypothetical minutes against today's availability | 14 | Done; nonmutation/saturation fixtures and browser calculation |
| AcademicContext / uploadMaterialPdf; Workspace / Materials | Expose actual asynchronous job stage with measured extracted page/prepared chunk counts, no invented intermediate percentage | 14 | Done; production build; job endpoint covered |

### Route-by-route control audit (one browser pass, disposable data)
All visible controls were checked against their handlers/links; meaningful safe actions below were exercised. Destructive delete handlers were inspected without deleting user data.
| Route / owner | Result |
|---|---|
| Dashboard / Dashboard | Done: readiness disclosure, next-month navigation, event markers/agenda; task/subject/study links wired |
| Materials / Workspace.Materials, PdfPreview | Done: upload dialog, required file/title/subject, cancel; name opens authenticated viewer, close/download/page cleanup implemented; final PDF check below |
| Assistant / Workspace.Assistant | Done: subject/material selectors, suggested prompt fills composer, Send wired, source preview and Markdown handlers retained |
| Quizzes / Workspace.Quizzes | Done: all real subject topics, count/material/difficulty selectors, Begin returns honest missing-material error; submit/reset/retry handlers reviewed |
| Learning / Workspace.Learning, TopicEstimate | Done: subject/unit/topic forms, completion/weak toggles, estimates and deletes wired; add/cancel exercised |
| Planner / PlannerView, StudyActivity | Done: missing-estimate state, study/task/settings links, session fields and history wired |
| Tasks / Productivity | Done: edit estimate saved; Completed filter produced honest empty state; search/type/priority/sort/completion/reopen/delete handlers reviewed |
| Exams / Productivity | Done: edit/cancel, target goal, readiness disclosure, history/filter and scoped preparation links |
| Simulator / SimulatorView | Done: scenario calculated 49→54 with 30 additional minutes; unknown estimates surfaced |
| Analytics / Workspace.Analytics | Done: real 49% mean, sample=1; 70% status threshold displayed |
| Profile / Workspace.Profile, StudyActivity | Done: ledger-derived 112 XP, history/logging, real readiness; no arbitrary progress |
| Settings / SettingsView, ThemeProvider | Done: zero availability saved and survived reload; theme scope and actual connection status visible |
| Shared navigation / AppShell; Notifications | Done: route links, mobile toggle, sign-out, theme switch; notifications use actual risk records; no fabricated feed |

No CountUpAll implementation or call remains. Ui.Mission/statMeta and pseudo-embedding/canned quiz helpers are removed. Empty academic mock exports contain no student activity; explicit seed fixtures remain distinguishable from user records.

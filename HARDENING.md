
## Production verification and remaining Tasks/Exams checks
Use disposable accounts/databases only. Never run test HTTP scripts against a real workspace.
Before hardening, `test-security-hardening.ts` reproduced six failures (CORS rejection/reflection, payload status, spoofable rate limits, missing production AI/origin configuration, sensitive log fields). All six now pass. `frontend/scripts/test-dates.ts` reproduced silent DST-gap rescheduling; strict local conversion now rejects it and 16 date assertions pass across UTC, India and New York, including leap day and both DST transitions.
Browser evidence: Escape initially left task dialog open and focus outside it; fixed native dialog autofocus, inert background, Escape and focus restoration verified. Two tabs editing a disposable task produced a visible 409 and Reload latest restored saved data. Script markup rendered literally; pending fields disabled; no-match search and clear filters worked.

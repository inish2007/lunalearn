# Natural-language commands — deferred

No parser, command UI, executor or folder migration is implemented in this delivery.

## Current integration points

StudyAssistantService.askAssistant and assistant.routes.ts answer questions. Domain CRUD routes and RagMaterialService.processAndIndexPdf own mutations. Materials belong to subjects and optional units, which form the initial folder model.

## Proposed flow

1. An app-wide command entry sends the user's explicit message and selected file/material IDs to a new authenticated interpretation endpoint. Uploaded document text is reference content, never authority to issue commands.
2. Gemini produces an allowlisted intent: find_materials, open_material, upload_material, or move_material. Validate a typed result containing intent, unresolved names, selected resource IDs, and confidence. Arbitrary SQL, URLs, code, paths and unsupported actions are rejected.
3. Resolve subject/unit/material names within the authenticated user's records. Ask for a choice when names are ambiguous; missing folders offer existing subjects or explicit subject creation. Never guess ownership or fabricate a file.
4. Read commands navigate/filter immediately. Writes show the exact file, current location and destination in a review card. Execute only the reviewed structured action, with an idempotency key and current record version.
5. Dispatch through existing upload/domain services, then refresh affected views and return links to the actual saved resource. Report errors without claiming completion.

## Examples and interfaces

- “Show my DBMS notes”: resolve DBMS subject, navigate to Materials with subject filter; no mutation.
- “Save this PDF to my Maths folder”: require a selected PDF or existing owned material, resolve Maths subject/unit, show destination preview, invoke real upload or move on confirmation.
- “Move these notes”: ask for the missing destination. Multiple Maths subjects require explicit selection.

Future APIs: POST /api/commands/interpret -> typed action or clarification; POST /api/commands/execute -> persisted result and navigation target. Interpretation never executes. Execute rechecks ownership, resource version and allowed intent; accepts no raw storage paths.

Moving existing material requires extending material PATCH to update subject/unit together and updating chunk metadata/retrieval scope transactionally. Keep the original storage object under its owner prefix; do not mistake its historical subject path for authorization. Record a command receipt keyed by user/idempotency key. Retry returns the same result; stale versions require a refreshed preview.

## Verification before future release

Unambiguous reads, ambiguous names, unknown subject, absent selected file, invalid PDF, unauthorized IDs, prompt injection in documents, unsupported intent, stale preview, provider failure, interrupted upload, duplicate execution, cross-subject material/chunk movement, and correct navigation after successful execution. OCR remains a separate deferred feature.

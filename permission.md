# permission.md (root)

## Default scope
Each agent is scoped to its own folder (see each person's permission.md).
Touching files outside your scope means flagging it in the PR, not doing it
silently.

## Always allowed
- Editing files inside your own scope
- Branches/PRs within your scope
- Installing packages that only affect your own scope
- Writing/updating your own tests

## Requires a heads-up (not a blocker)
- Changing a shared contract another track calls
- Adding a new environment variable

## Requires explicit human approval
- Schema migrations that drop/rename a column or table already in use
- Merging to main
- Any production deploy
- Changing or rotating Supabase keys / env secrets
- Deleting another person's files or overwriting their branch

## Not permitted for any agent
- Committing secrets (.env, API keys) to git
- Disabling auth/RLS "temporarily for testing" without reverting before demo

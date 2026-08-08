# External verification runbook

These checks require resources that are intentionally absent from repository CI. Record the date, exact commit, sanitized configuration, command, result, cost, and cleanup evidence. Never commit credentials or manuscript content.

## Provider smoke test

Prerequisites: explicit spend approval, a restricted test credential, provider budget alerts, and a non-sensitive prompt. Start with the smallest supported preset and model override.

1. Copy `.env.example` to an untracked `.env` and configure exactly one provider key and model.
2. Run `pnpm verify`, then `pnpm dev`.
3. Confirm `system.status` reports only the intended provider and never returns the credential.
4. Create a disposable project with synthetic canon. Preview context and confirm only selected entries appear.
5. Generate one short draft, cancel a second run while it is active, and confirm no duplicate or partial story is saved.
6. Confirm the workflow screen lists actual participating roles, shows an advisory quality/content result only if that reviewer ran, and exposes no invented token counts, UCF metrics, or reasoning logs.
7. Record provider request identifiers and billed usage from the provider dashboard, then revoke the test credential.

This repository had no configured provider key on 2026-08-08, so no live result is claimed.

## Disposable MySQL verification

Use an isolated local or ephemeral MySQL 8 database. Never point this procedure at production or an irreplaceable database.

1. Create a database and least-privilege test user; require TLS if the server is not loopback.
2. Set `DATABASE_URL` only in the test shell.
3. Run `pnpm db:migrate`, then `pnpm verify`.
4. Run the app and complete project, canon, chapter, scene, organization, revision, generation-job, export, and import operations.
5. Interrupt an active generation by restarting the server and confirm its content-free job becomes `interrupted`.
6. Inspect foreign keys and verify a cross-user story, scene, revision, or job cannot be read or changed.
7. Export a backup, recreate the database from migrations, import the backup, and compare chapter order, scenes, canon, revisions, tags, and favorites.
8. Drop the disposable database and revoke its user.

Migration `0009_flashy_black_widow.sql` adds ordered story scenes. The schema was generated and type/build checked without a database; no live MySQL migration or write-path result is claimed because no database service or `DATABASE_URL` was available on 2026-08-08.

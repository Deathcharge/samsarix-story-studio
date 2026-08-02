# Operations and deployment boundaries

Samsarix Story Studio’s verified distribution is a local source build. This guide does not claim an active hosted URL, container image, one-click platform integration, or production readiness.

## Local production build

Requirements: Node.js 20–24 and pnpm 11.9.0.

```bash
pnpm install --frozen-lockfile
pnpm verify
pnpm start
```

The default endpoint is `http://127.0.0.1:3000`; readiness is available at `GET /healthz`. `pnpm start` does not search for another port: if `PORT` is unavailable, startup fails so an operator can correct the conflict explicitly.

The default profile needs no environment file. It uses local authentication and a JSON data file under the current user’s home directory. Set `SAMSARIX_DATA_FILE` to put the archive on a protected, backed-up volume. `HELIX_DATA_FILE` remains a deprecated compatibility alias, and an existing default `.helix-story-studio/studio.json` archive is copied to the new Samsarix path on first use when needed.

## Configuration boundaries

| Setting              | Default             | Operational effect                         |
| -------------------- | ------------------- | ------------------------------------------ |
| `HOST`               | `127.0.0.1`         | Bind address                               |
| `PORT`               | `3000`              | HTTP port                                  |
| `AUTH_MODE`          | `local`             | Any other value is rejected                |
| `SAMSARIX_DATA_FILE` | user data directory | Local archive path                         |
| `DATABASE_URL`       | unset               | Enables MySQL instead of the local file    |
| `LLM_TIMEOUT_MS`     | `120000`            | Provider timeout, clamped to 5–300 seconds |

Provider keys and model overrides are documented in `.env.example` and `README.md`.

## Network exposure

Local auth is a trusted-desktop mode, not multi-user authentication. The process refuses to bind to a non-loopback host and rejects non-local Host and browser Origin values.

A credible internet deployment requires a separate authentication design and work outside this release:

- an approved identity provider and verified session/redirect design;
- TLS termination and trusted-proxy configuration;
- a durable MySQL service with backups and migrations;
- rate limiting, abuse controls, request observability, retention policy, and incident response;
- provider credential management and spend alerts;
- cross-browser, accessibility, load, recovery, and penetration testing;
- counsel review of licensing, contribution, privacy, support, and incident-response policies.

Do not infer that setting `HOST=0.0.0.0` makes the application production-ready.

## MySQL profile

Set `DATABASE_URL` to a MySQL connection string, then apply migrations before startup:

```bash
pnpm db:migrate
pnpm build
pnpm start
```

Database TLS, credentials, least-privilege grants, backup/restore drills, and schema rollback are operator responsibilities. The local file and MySQL adapters should not point at the same logical archive and do not synchronize.

Release 1.1 adds migrations `0004_projects_canon_workspace.sql` and `0005_manuscript_mediumtext.sql`. Apply both before starting 1.1 against an existing MySQL database.

Release 1.2 adds project-backup import without a schema migration. Import requests remain loopback-only; only the exact import procedure receives an 8 MB JSON body ceiling, while other API procedures retain 1 MB. The UI accepts at most 7 MB backup files before client and server validation. Local imports use one atomic archive write; MySQL imports use one transaction. A failed import should not create a partial project.

Release 1.3 adds migration `0006_cynical_squirrel_girl.sql` for chapter synopsis and draft-status fields. Apply it before starting 1.3 against an existing MySQL database. The default local-file adapter upgrades version-1 or version-2 archives to version 3 on first load. Back up either storage profile before upgrading when rollback matters.

Release 1.4 adds migrations `0007_woozy_quasimodo.sql` and `0008_acoustic_emma_frost.sql` for content-free generation-job metadata, explicit terminal stages, and lifecycle lookup indexing. Apply them before starting 1.4 or later against an existing MySQL database. The default local-file adapter upgrades archives to version 4 on first load. Jobs left queued, running, or cancelling by a previous process are marked interrupted at startup; prompt and manuscript text are not stored in job records. Release 1.5 changes planned-chapter behavior without adding a storage migration.

## Health and shutdown

- `GET /healthz` returns process health and auth mode.
- `system.status` reports demo/provider mode, storage mode, provider names/models, and orchestration ceilings without exposing keys.
- `SIGINT` and `SIGTERM` stop accepting new connections and allow up to ten seconds for graceful HTTP shutdown.

No production deployment was performed as part of repository productization.

# Changelog

All notable changes to Samsarix Story Studio are documented here.

## 1.1.1 — 2026-08-01

- Upgraded Vite and Vitest to patched release lines and pinned vulnerable transitive build dependencies to audited versions.
- Moved dependency overrides into pnpm 11's workspace configuration so clean installs and CI enforce the same resolutions.
- Verified the complete dependency graph with no known vulnerabilities or peer dependency issues.

## 1.1.0 — 2026-08-01

- Added project workspaces that group ordered manuscript chapters with a project brief and style guidance.
- Added typed canon entries with always-on, keyword-activated, and writer-selected context; previews expose selected entries and an approximate token count before generation.
- Added in-place chapter editing, recoverable revision history, safe restore behavior, and a 50-snapshot retention bound per chapter.
- Added full-project JSON backup and combined Markdown manuscript export.
- Migrated existing local archives forward without losing standalone drafts and added MySQL migrations for projects, canon, revisions, and larger manuscript content.
- Removed story text from continuation URLs and deferred series mutation until the next chapter is successfully saved.
- Fixed local file writes so a disk failure cannot leave in-memory state ahead of persisted state.
- Improved demo canon fidelity, navigation scroll restoration, responsive project ordering, and review-metadata labels.

## 1.0.0 — 2026-07-28

- Reframed the repository as a standalone, local-first fiction workshop from Samsarix LLC.
- Added a complete no-key demo and bring-your-own-provider generation path with bounded calls, timeouts, retries, and output.
- Added atomic local persistence, archive search, story continuation, and Markdown export.
- Enforced loopback-only operation, request boundaries, story ownership, input validation, and sanitized provider errors.
- Removed private-platform dependencies, placeholder analytics, dead UI, and unused dependency surface.
- Added behavioral tests, production build verification, pinned CI, support/security policies, and a consistent Business Source License 1.1 posture.
- Preserved compatibility with the legacy data environment variable and default archive location during the Samsarix rebrand.

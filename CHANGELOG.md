# Changelog

All notable changes to Samsarix Story Studio are documented here.

## 1.6.0 — 2026-08-08

- Added ordered scene cards with editable beats, optional point of view and location, accessible move controls, backup round trips, and bounded inclusion in planned-chapter drafting prompts.
- Added bounded story tags and favorites across local-file/MySQL storage, ownership-scoped APIs, backup import/export, archive search/filtering, and story detail controls.
- Removed synthetic UCF metrics, empty reasoning-log/trajectory screens, default review approval, and placeholder token counts from the active product contract; advisory review results now appear only when the relevant provider-backed reviewer actually ran.
- Added local archive version 5 and MySQL migration `0009_flashy_black_widow.sql` for story scenes.
- Added reproducible source packaging with a SHA-256 manifest, an independent-writer pilot protocol, provider/MySQL verification runbooks, and a counsel-ready licensing review packet.
- Updated direct and transitive Nano ID and PostCSS resolutions after 2026-08-08 registry advisories; the final dependency audit reports no known vulnerabilities.

## 1.5.0 — 2026-08-01

- Added ownership-safe generation into an existing blank chapter plan, preserving its stable story ID, working title, synopsis, manuscript position, series, and continuity links.
- Added dedicated “Draft this plan” and “Draft with studio” actions plus targeted studio onboarding that derives a bounded prompt from the chapter synopsis and prior chapter ending.
- Prevented generated or manually drafted chapters from being overwritten, rejected conflicting continuation/target inputs, and kept imported blank chapter plans eligible for drafting.
- Extended behavioral coverage for in-place completion, duplicate prevention, cross-user isolation, imported-plan compatibility, continuity, and cancellation without plan mutation.

## 1.4.0 — 2026-08-01

- Replaced timer-simulated generation progress with durable jobs and live server-sent stage events, plus status polling when the event stream is unavailable.
- Added writer cancellation that propagates one abort signal through demo execution and the OpenAI-compatible, Anthropic, and Google provider SDK requests.
- Added reconnectable active-job state, overlap prevention, terminal success/failure/cancellation/interruption states, and restart recovery that truthfully marks abandoned work interrupted.
- Persisted only content-free lifecycle metadata with a 100-job-per-writer terminal-history bound; prompts and generated manuscripts remain in their existing story boundary.
- Added the version-4 local archive migration plus MySQL migrations `0007_woozy_quasimodo.sql` and `0008_acoustic_emma_frost.sql` for generation jobs, terminal-stage fidelity, and lifecycle lookup indexing.

## 1.3.0 — 2026-08-01

- Added a manuscript board for creating genuinely empty chapter plans with working titles, synopsis notes, and planned/drafting/revising/complete states.
- Added drag-to-reorder plus keyboard- and touch-accessible move controls; each saved order atomically rewrites chapter numbers, series identity, and previous-chapter continuity links.
- Allowed blank manuscripts and revisions so writers can outline before drafting; the first substantive edit automatically advances a planned chapter to drafting.
- Preserved chapter plans, statuses, empty manuscripts, order, and revision history through project backup export/import.
- Added the version-3 local archive migration and MySQL migration `0006_cynical_squirrel_girl.sql` for planning fields.

## 1.2.0 — 2026-08-01

- Added schema-validated project backup import with an explicit local preview and a 7 MB file limit.
- Restored backups only as new projects, atomically remapping project, canon, story, series, revision, and previous-chapter identities without trusting or exporting internal ownership fields.
- Preserved manuscript whitespace, metadata, chapter relationships, and capped revision history while rejecting malformed, cross-project, dangling, duplicate, oversized, or cyclic backup data.
- Added behavioral round-trip and validation tests for local storage; the MySQL import uses one transaction and the same validated import plan.

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

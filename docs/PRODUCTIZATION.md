# Samsarix Story Studio productization record

Last updated: 2026-08-01

## Current repository assessment

The checked-out `master` branch contains a Vite/React client, an Express/tRPC server, MySQL/Drizzle persistence, and two overlapping story-generation engines. The intended experience is recognizable, but the repository was not installable or independently usable at the start of this work:

- commit `c8d1bb5` replaced the full application manifest with a six-package test manifest while leaving a 610-entry lockfile and source imports intact;
- the documented setup required private Manus OAuth and Forge endpoints that were absent from the repository;
- without `DATABASE_URL`, reads silently returned empty data and every generated story failed when persistence was attempted;
- the default multi-provider presets required several unrelated API keys and referenced retired or preview model identifiers;
- several core claims, test names, deployment instructions, and UI controls described behavior that was not implemented;
- stored integer metrics were returned unscaled on the ritual-ID detail route, producing incorrect values in the primary journey;
- there was no CI configuration and the committed tests asserted hard-coded objects rather than application behavior.

The worktree was clean before implementation (`git status --short --branch` returned `## master...origin/master`). Existing history and unrelated branches were left untouched.

## Chosen product

**Samsarix Story Studio** is a local-first, bring-your-own-provider manuscript workspace from Samsarix LLC. A writer creates a project, maintains explicit story canon, previews the bounded context selected for a chapter, generates or writes a draft, edits it with recoverable revisions, continues the manuscript, and exports Markdown or a versioned JSON backup.

The default no-credential mode is an explicitly labeled deterministic demo. It exists so a new user can evaluate the complete workflow without an account, cloud database, private legacy service, or API spend. Supplying one supported provider key enables the real orchestration path; unavailable preferred providers fall back to the configured provider instead of requiring five accounts.

This is deliberately not a recreation of `helix-unified`, a hosted collaborative editor, or a claim of scientific “consciousness modulation.” UCF values are retained only as legacy creative-process heuristics and are labeled accordingly.

## Target user and primary use case

The target user is a technically comfortable fiction writer or small creative team who wants to inspect and control a multi-stage AI drafting pipeline, bring their own model account, and keep the application data on their own machine.

Primary release journey:

1. install dependencies and start the local server;
2. open the studio without external authentication;
3. enter or choose a prompt;
4. generate a demo or provider-backed draft with bounded cost;
5. edit the persisted story while retaining the previous manuscript as a recoverable revision;
6. restore a revision, continue the manuscript, or find any draft in the archive;
7. download a combined Markdown manuscript or full project JSON backup.

## Product and architecture decisions

- Preserve the React/Express/tRPC architecture and pnpm lockfile.
- Add a file-backed JSON repository as the default persistence adapter; retain MySQL as an opt-in adapter.
- Use loopback-only networking with a single local profile. Hosted or multi-user operation is rejected rather than silently weakening the trust boundary.
- Instantiate external provider clients lazily, validate configuration before calls, bound retries/timeouts, and cap orchestration size.
- Remove private Manus services and unused legacy adapters from the product and dependency graph.
- Remove fabricated metrics, dead controls, placeholder analytics, and external font dependencies from the user-facing core.
- Prefer a focused project/canon/manuscript workflow over collaboration, billing, or broad content-management features.
- Do not deploy, publish, spend money, create accounts, or modify `helix-unified`.

## Current ecosystem evidence

The narrow product wedge is control, recoverability, and inspectable context—not feature parity with mature writing suites. Scrivener validates the need to organize and export long manuscripts; Sudowrite’s Story Bible treats project facts as both writer reference and AI context; NovelAI exposes lore activation and context budgets; and Novelcrafter combines a project Codex with bring-your-own-provider choices and revision history. These workflows support the 1.1 decision to build projects, canon, explicit selection reasons, revisions, and portable export before adding more generation modes.

Provider identifiers must remain configuration rather than permanent code assumptions: current OpenAI, Anthropic, Google, xAI, and Perplexity documentation all expose active model lists or explicit deprecation lifecycles. The repository’s original Anthropic and Gemini defaults were already retired by July 2026.

Primary references:

- https://docs.sudowrite.com/using-sudowrite/1ow1qkGqof9rtcyGnrWUBS/what-is-story-bible/jmWepHcQdJetNrE991fjJC
- https://www.literatureandlatte.com/scrivener/overview
- https://docs.novelai.net/en/text/lorebook/
- https://docs.novelai.net/en/text/editor/advancedsettings/
- https://www.novelcrafter.com/
- https://docs.novelcrafter.com/en/articles/8677729-revision-history/
- https://platform.openai.com/docs/models
- https://platform.claude.com/docs/en/about-claude/models/overview
- https://ai.google.dev/gemini-api/docs/models
- https://docs.x.ai/developers/rest-api-reference/inference/models
- https://docs.perplexity.ai/docs/sonar/models

## Assumptions

- The checked-out `master` application is authoritative despite the unrelated `origin/main` history.
- The existing BSL commit represents owner intent; Samsarix LLC supplied the current company identity and working contact addresses for corrected release parameters.
- Local single-user operation is a defensible independent distribution model.
- A deterministic demo is acceptable only when every relevant screen labels it as a demo and never presents it as an external model response.
- Generated fiction may be sensitive; local persistence and no analytics are the safest defaults.

## Baseline command results

Environment: Windows, Node.js `v24.12.0`, pnpm `11.9.0`.

| Command                          | Baseline result                                                                                                                          |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `git status --short --branch`    | Passed; clean `master` tracking `origin/master`.                                                                                         |
| `pnpm install --frozen-lockfile` | Failed after lock verification with `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`; the manifest had lost the lockfile override and patch settings. |
| `pnpm build`                     | Did not reach Vite; pnpm entered automatic dependency resolution against the broken manifest.                                            |
| `pnpm lint`                      | Did not reach ESLint; pnpm entered automatic dependency resolution and the manifest did not declare ESLint.                              |
| `pnpm test -- --run`             | Did not reach Vitest; pnpm entered automatic dependency resolution.                                                                      |
| `pnpm exec tsc --noEmit`         | Did not produce a valid baseline result because dependency resolution had not completed.                                                 |

The duplicate resolver processes started by those four independent baseline commands were terminated before repairs. Final results will be recorded only after clean sequential runs.

## Prioritized findings

### P0 — release blockers

- [x] Restore an installable manifest that matches the actual source and lockfile intent.
- [x] Make the no-credential local setup complete, including authentication, generation, persistence, and archive retrieval.
- [x] Correct story-detail scaling and contribution parsing on the primary route.
- [x] Replace retired hard-coded provider models with configurable current defaults.
- [x] Produce a runnable server build and accurate start command.
- [x] Replace setup documentation that depends on nonexistent scripts and private infrastructure.

### P1 — serious quality, safety, or usefulness issues

- [x] Enforce story ownership in server procedures.
- [x] Remove the public provider-probe endpoint that can incur five paid calls per request.
- [x] Add request timeouts, retry limits, provider validation, and orchestration cost caps.
- [x] Replace decorative progress, dead sharing UI, and unhandled query failures.
- [x] Replace placeholder tests with tests of generation, persistence, validation, and access boundaries.
- [x] Add CI for install, formatting, type-checking, tests, and build.
- [x] Remove placeholder analytics and third-party font requests from the default local experience.
- [x] Make local-auth exposure constraints explicit and enforced.

### P2 — valuable after the first credible release

- [x] Project-level story bible/canon with explicit, bounded context selection.
- [x] Draft editing with capped, recoverable version history.
- Project import/restore, scene-level planning, and explicit chapter ordering.
- Streaming real stage progress and user cancellation.
- Tags, collections, and favorites after their incomplete backend is designed; basic archive search is included now.
- Local-model adapters such as Ollama or an OpenAI-compatible base URL.
- Accessibility testing with assistive technology and cross-browser visual QA.

## Implementation checklist

- [x] Protect and inventory the repository.
- [x] Capture the broken baseline.
- [x] Choose the product definition and scope.
- [x] Restore the package contract.
- [x] Add a loopback-only local identity and file persistence.
- [x] Add deterministic demo generation and one-key provider fallback.
- [x] Complete generation, detail, archive, continuation, and export behavior.
- [x] Add meaningful tests and CI.
- [x] Rewrite README and deployment/configuration guidance.
- [x] Run final adversarial verification.

## Release acceptance criteria

- [x] A fresh frozen install succeeds from the manifest and lockfile.
- [x] `pnpm start` starts on loopback and reports a health endpoint.
- [x] The complete demo journey works without credentials or a database.
- [x] A single supported provider key is sufficient by configuration and routing design; a live paid call remains credential-blocked.
- [x] Local stories survive a repository reload and remain isolated to the active user in tests.
- [x] Invalid prompts and unavailable providers return actionable, non-secret errors.
- [x] Network calls have finite timeouts/retries and orchestration has a documented maximum.
- [x] Format check, type-check, focused tests, production build, and start smoke test pass.
- [x] README commands and configuration match verified behavior.
- [x] No locally actionable P0 remains.

## Completed work

- Audited the repository, history, branches, docs, manifests, core server/client paths, tests, license, configuration, and security-sensitive integrations.
- Identified the package regression and restored the application dependency/script contract from the lockfile and pre-regression history.
- Defined the standalone product, release journey, safety defaults, and deferred scope.
- Replaced private authentication and persistence requirements with a loopback-only local profile and atomic JSON storage, while retaining MySQL as an explicit operator choice.
- Completed the prompt-to-draft journey: deterministic no-key demo, bounded provider orchestration, story detail, searchable archive, continuation, and Markdown export.
- Enforced ownership checks and request validation, removed the paid provider probe, capped bodies/calls/output, sanitized provider failures, and rejected non-loopback host/origin traffic.
- Rebuilt the UI around honest loading, error, empty, demo, and provider states; removed fake sharing/analytics and external font traffic.
- Pruned unused packages and private adapters, upgraded vulnerable production dependencies, and added a pinned, least-privilege CI workflow.
- Replaced assertion-free demo tests with generation, persistence, ownership, validation, and network-boundary coverage.
- Rebranded the standalone product for Samsarix LLC, preserved legacy data/configuration compatibility, and replaced conflicting legal files with a single canonical BSL 1.1 posture plus copyright, trademark, commercial, support, and security notices.
- Added the 1.1 Projects & Canon vertical slice: project briefs, typed canon, deterministic context activation and preview, project-aware generation, editable chapters, revision restore, and portable project/manuscript export.
- Added a versioned local-data migration, transactional MySQL revision writes, generated Drizzle migrations, medium-text manuscript storage, and a 50-revision retention bound.
- Removed story-derived continuation text from URLs, made continuation preparation read-only, and delayed prior-chapter series updates until a next chapter is successfully persisted.
- Corrected atomic local persistence so failed disk writes leave the last persisted in-memory state intact.
- Kept routine project responses bounded to chapter summaries; full manuscript and revision bodies are returned only by story detail or an explicit project export.
- Performed production-browser QA for project creation, canon creation, context preview, demo generation, chapter editing, revision history, continuation privacy, and 390-pixel responsive layout; QA findings were fixed before release verification.

## Final verification

Environment: Windows, Node.js `v24.12.0`, pnpm `11.9.0`. CI uses the documented Node.js 22 release line.

| Command                          | Final result                                                                                                                                                                                         |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile` | Passed; lockfile was current.                                                                                                                                                                        |
| `pnpm lint`                      | Passed; all tracked source/config/docs matched Prettier.                                                                                                                                             |
| `pnpm check`                     | Passed; TypeScript completed with no errors.                                                                                                                                                         |
| `pnpm test`                      | Passed; 4 files and 12 behavioral tests, including projects/canon/revisions, context bounds, ownership, continuation, demo fidelity, and version-1 local archive migration.                          |
| `pnpm build`                     | Passed; 1,769 client modules and the bundled server production artifact were emitted.                                                                                                                |
| `pnpm audit --prod`              | Passed; no known production dependency vulnerabilities.                                                                                                                                              |
| `pnpm peers check`               | Passed; no peer dependency issues.                                                                                                                                                                   |
| Drizzle schema check             | Passed; generated migrations and snapshots match the eight-table schema with no ungenerated changes.                                                                                                 |
| production browser QA            | Passed on `127.0.0.1`: project/canon creation, context preview, demo generation, editing, revision history, continuation URL/privacy, 390px layout, and final zero-error/zero-warning console check. |

No external provider call, live MySQL migration, deployment, package publication, account creation, or paid operation was performed. MySQL DDL was generated and schema-drift checked, but applying it remains dependent on an operator-supplied database.

The Codex Security workbench could not initialize its local helper and returned no scan ID or artifacts. No formal scanner result is claimed. A manual release-diff review instead covered project/story ownership, context and editor input bounds, export scope, continuation data exposure, local atomic writes and migration behavior, MySQL transaction/retention behavior, and client response size; its locally actionable response-size finding was fixed before the final gate.

## Deferred work and rationale

- Project JSON import is deferred until schema validation, conflict handling, and recovery semantics are designed; the current export is still useful as a readable backup and portability artifact.
- Scene planning and chapter reordering are deferred until an explicit ordering model replaces inferred chapter numbers.
- Multi-user hosted collaboration, billing, and subscriptions would expand operational and privacy scope without evidence.
- PDF export adds layout and dependency work; Markdown is sufficient for the first release.

## Owner-, credential-, legal-, or production-blocked tasks

- Obtain qualified legal review of the BSL parameters, older automated/bot-authored contributions, contributor terms, and any commercial agreement before relying on exclusivity.
- Complete trademark clearance and decide whether Samsarix or Samsarix Story Studio should be federally registered.
- Supply provider credentials for live-provider verification; no credentials will be fabricated or logged.
- Design and approve a real authentication, tenancy, CSRF, rate-limit, and deployment model before any multi-user or non-loopback service is attempted; the current server intentionally rejects that mode.
- Approve any future hosted deployment, domain, telemetry, billing, or package publication.

## Known risks

- JSON persistence is appropriate for a single local process, not multiple replicas or untrusted multi-user hosting.
- Provider output quality, pricing, retention, and model availability remain external concerns; configuration and documentation reduce but cannot eliminate that risk.
- AI-generated fiction may reproduce bias or unwanted content. Automated review metadata is advisory and must not be represented as a guarantee.
- Node 24 is the local verification runtime; CI must cover the documented minimum runtime as well.

## Distribution and sustainability

The simplest realistic distribution is a source release run locally with Node.js and pnpm, with optional MySQL persistence for advanced operators. The core remains bring-your-own-provider, so repository operation does not incur vendor inference cost for the maintainer.

Potential sustainability is paid support, configuration help, commercial production licenses, or a separately approved hosted edition. No subscription economics, demand validation, or production service are claimed. The repository now has one consistent source-available license posture, subject to formal legal review.

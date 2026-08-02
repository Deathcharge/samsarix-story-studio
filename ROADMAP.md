# Samsarix Story Studio roadmap

This roadmap separates four gates: merge, release, publication, and flagship adoption. Passing one does not imply the next.

## Product boundary

Portfolio role: **standalone product candidate**. Develop this as a focused standalone product with its own distribution and support boundary. Integrate with the flagship through versioned contracts, not shared private source.
Planned repository identity: `Deathcharge/samsarix-story-studio` (ready).

Current disposition: Versions 1.0 through 1.4 are merged product candidates. The 1.5 planned-chapter drafting candidate completed branch verification; verification, default-branch merge, packaged distribution, a user pilot, and flagship adoption remain separate gates.

## Stabilize the productized default

- Keep the default branch buildable from a clean checkout and preserve exact-head CI evidence.
- Keep Samsarix LLC branding, package identity, license metadata, and compatibility aliases internally consistent.
- Preserve the pre-productization default under a rollback ref before merging; do not delete legacy history.
- Review priority: Make review metadata truthful. (UI labels corrected in 1.1; engine metadata redesign remains.)
- Review priority: persist logs/trajectories or remove the legacy routes.
- [x] Remove story text from continuation URLs.
- [x] Make local persistence commits consistent after write failure.
- [x] Persist content-free generation jobs, report live stages, recover interrupted work, and support cancellation.
- [x] Complete a blank chapter plan in place without duplicating or reordering manuscript chapters.

## Release candidate

- Run a small user pilot against the exact packaged artifact.
- Instrument only truthful, privacy-respecting product signals and define support ownership.
- Promote from prerelease only after recovery, upgrade, and failure paths are demonstrated.

Current hardening backlog:

- No live provider smoke test or packaged-artifact user pilot; both require owner credentials or participants.
- No committed tests execute paid provider SDK calls, live MySQL, or disk failure/corruption paths. Credential-free behavioral tests cover generation cancellation, overlap prevention, job ownership, and restart recovery.
- “Automated review passed,” quality/UCF scores, agent logs, and trajectories overstate the evidence currently recorded: review can default to success, UCF values are derived constants, tokens are zero placeholders, and new stories write no log/trajectory rows.
- Provider defaults and response compatibility can drift; five adapters plus unrestricted `OPENAI_BASE_URL` create ongoing maintenance/security work.
- [x] Project backups round-trip through schema-validating, copy-only import with conflict-safe identity remapping.
- [x] Chapter plans have explicit status and synopsis fields, and persisted ordering maintains a single continuity chain.
- Optional MySQL expands scope without live database CI evidence; its import path is transaction-scoped and type/build checked only.
- No desktop installer or hosted distribution path; source checkout is the current route.
- Legal ownership, BSL parameters, and branding need explicit owner approval.
- Branch history is confusing because unrelated `main` and default `master` represent different products.

## Samsarix adoption

- Define a public API, event, schema, artifact, or deployment contract before connecting to Samsarix Unified.
- Add a consumer-owned contract fixture covering authentication, privacy, limits, errors, and version compatibility.
- Make one implementation canonical; remove or freeze duplicate behavior only after parity and rollback are proven.
- Record an owner, support level, compatibility window, and measurable adoption signal.

## Completion evidence

A milestone is complete only when its exact commit, commands and results, artifact digest, consumer or deployment, and rollback path are recorded in a pull request or release record. README claims must not exceed that evidence.

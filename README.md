# Samsarix Story Studio

Samsarix Story Studio is a local-first manuscript workspace from Samsarix LLC for writers who want explicit control over both their story canon and a bounded, multi-stage AI drafting process. Build a project, record characters and world rules, preview the exact canon entries selected for a chapter, generate or edit the manuscript, recover prior revisions, and export or restore portable files.

The default experience is a deterministic, no-key demo. It does not call an AI provider and is labeled as demo output throughout the interface. Add one supported provider key to use the provider-backed workflow; missing preferred providers fall back to the provider you configured.

This repository is a coherent local product candidate. It is not a hosted collaboration service, a desktop installer, or a scientific consciousness system. The retained “UCF” values are legacy creative-process heuristics, not measurements of consciousness or guarantees of quality or safety.

## Quick start

Requirements:

- Node.js 20, 22, or 24
- pnpm 11.9.0

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://127.0.0.1:3000`. No account, database, `.env` file, or provider credential is required. Stories are stored by default at:

- Windows: `%USERPROFILE%\.samsarix-story-studio\studio.json`
- macOS/Linux: `~/.samsarix-story-studio/studio.json`

Set `SAMSARIX_DATA_FILE` to choose another location. Existing default data at `.helix-story-studio/studio.json` is copied forward automatically on first use when the new archive does not exist. The legacy `HELIX_DATA_FILE` setting remains a compatibility alias. This release binds only to loopback and rejects non-local Host and browser Origin values.

## Primary workflow

1. Create a project with a premise, genre, and optional style guidance.
2. Add empty chapter plans with working titles and synopsis notes, track each as planned, drafting, revising, or complete, and reorder the manuscript with drag or accessible move buttons.
3. Add characters, locations, factions, items, or lore to its canon. Entries can be always-on or activated by names and phrases.
4. Write a planned chapter manually, or draft one in the studio. Before generation, review the selected canon entries and approximate context-token count; manually include any additional entry.
5. Choose a preset or enable up to seven agent roles, then create a clearly labeled demo or provider-backed draft.
6. Edit the chapter directly. Every changed save keeps the prior title and manuscript—even a blank planned draft—as a recoverable revision; the newest 50 snapshots per chapter are retained.
7. Continue the manuscript, reopen any planned or drafted chapter from the archive, export combined Markdown, or download a versioned project JSON backup.
8. Restore a backup from the Projects page. The file is validated first and imported as a separate project, so existing work is never overwritten.

Standalone drafts remain supported when a project would be unnecessary.

Generation is currently request/response rather than streaming. The progress display describes the planned stages; it does not claim live per-agent telemetry. Project context is capped at eight canon entries and 6,000 characters. Its token estimate uses the transparent approximation of four characters per token; provider billing remains authoritative.

## Provider mode

Copy `.env.example` to `.env` and set at least one key:

| Provider   | Key                 | Default model      | Override           |
| ---------- | ------------------- | ------------------ | ------------------ |
| OpenAI     | `OPENAI_API_KEY`    | `gpt-4.1-mini`     | `OPENAI_MODEL`     |
| Anthropic  | `ANTHROPIC_API_KEY` | `claude-sonnet-5`  | `ANTHROPIC_MODEL`  |
| xAI        | `XAI_API_KEY`       | `grok-4.5`         | `XAI_MODEL`        |
| Google     | `GEMINI_API_KEY`    | `gemini-3.6-flash` | `GEMINI_MODEL`     |
| Perplexity | `SONAR_API_KEY`     | `sonar-pro`        | `PERPLEXITY_MODEL` |

Model catalogs change. The defaults reflect the provider documentation reviewed on 2026-07-28, and every model is configurable. Check the current [OpenAI](https://platform.openai.com/docs/models), [Anthropic](https://platform.claude.com/docs/en/about-claude/models/overview), [xAI](https://docs.x.ai/developers/rest-api-reference/inference/models), [Google](https://ai.google.dev/gemini-api/docs/models), or [Perplexity](https://docs.perplexity.ai/docs/sonar/models) documentation before spending money.

An experimental preset can make at most eight provider calls and request at most 18,000 output tokens. Each request has one SDK retry and a 120-second timeout by default; `LLM_TIMEOUT_MS` may be set between 5,000 and 300,000 milliseconds. One generation per user may run at a time.

The upper-bound cost for a run is:

```text
sum over calls ((input tokens / 1,000,000 × provider input price)
              + (output tokens / 1,000,000 × provider output price))
```

Input size depends on intermediate drafts, so Samsarix Story Studio does not print a dollar estimate that will become stale. Provider dashboards remain the billing source of truth. API keys stay server-side and must never use a `VITE_` prefix.

`OPENAI_BASE_URL` supports an OpenAI-compatible endpoint for the OpenAI provider slot. Compatibility varies and has not been certified for arbitrary local-model servers.

## Storage and authentication profiles

The default profile is deliberately small:

```text
Browser → Express/tRPC on 127.0.0.1 → local JSON archive
                                 ↘ optional provider API
```

- The release supports one local writer identity and requires loopback binding.
- Omitting `DATABASE_URL` uses the atomic local-file adapter.
- Setting `DATABASE_URL` selects MySQL/Drizzle storage and requires `pnpm db:migrate` before use.

Local JSON storage is designed for one process and one trusted desktop user. It is not appropriate for multiple replicas, shared-host multi-tenancy, or untrusted network exposure.

## Commands

| Command            | Purpose                                                    |
| ------------------ | ---------------------------------------------------------- |
| `pnpm dev`         | Run the local development server with reload               |
| `pnpm build`       | Build the browser app and bundled server                   |
| `pnpm start`       | Run the production build on the configured host/port       |
| `pnpm lint`        | Check repository formatting                                |
| `pnpm check`       | Run strict TypeScript checking on the active product graph |
| `pnpm test`        | Run focused Vitest suites                                  |
| `pnpm verify`      | Run format check, type-check, tests, and production build  |
| `pnpm db:generate` | Generate a Drizzle migration after schema changes          |
| `pnpm db:migrate`  | Apply MySQL migrations                                     |

The HTTP health endpoint is `GET /healthz`. The public tRPC status endpoint exposes mode and configured provider names/models, never credential values.

## Privacy and safety

- The default build has no analytics and makes no font or provider request in demo mode.
- Local projects, canon, revisions, and stories can contain sensitive text; protect and back up the data file accordingly.
- In provider mode, prompts, intermediate material, and drafts are sent to the configured provider. Review that provider’s retention and training terms.
- Generated text can be incorrect, biased, derivative, or unwanted. “Quality,” “ethical review,” and UCF metadata are advisory heuristics only.
- Prompt validation, story ownership checks, loopback enforcement, body limits, timeouts, retry limits, and call ceilings reduce risk; they do not make hosted multi-user operation production-ready.
- Project imports accept only the versioned Samsarix backup shape, reject inconsistent references, and cap selected files at 7 MB. Imported ownership and database IDs are always replaced.

## Scope and known limitations

The release intentionally does not include streaming/cancellation, scene-level cards, public sharing, PDF/EPUB export, billing, or collaboration. Chapter planning is currently manuscript-level: a chapter has one synopsis and status rather than an ordered list of scenes. Archive search is client-side and suited to a personal library. Backup restore always creates a new project; merging into or replacing an existing project is intentionally unsupported. Live provider calls require owner-supplied credentials and were not exercised during credential-free verification.

Legacy component examples remain outside the active TypeScript and runtime graph so historical UI source is preserved without making it part of the release contract. Incomplete QoL helpers and private-platform runtime adapters were removed. Future cleanup is tracked in [the productization record](docs/PRODUCTIZATION.md).

## Development and release notes

See [CONTRIBUTING.md](CONTRIBUTING.md) for the contributor workflow, [DEPLOYMENT.md](DEPLOYMENT.md) for local operation and advanced self-hosting boundaries, [SECURITY.md](SECURITY.md) for private vulnerability reporting, and [docs/PRODUCTIZATION.md](docs/PRODUCTIZATION.md) for the audit, decisions, verification evidence, risks, and deferred work.

No deployment, package publication, account creation, or paid provider request is performed by the repository setup.

## License and ownership

Copyright © 2024–2026 Samsarix LLC. The code is source-available under the [Business Source License 1.1](LICENSE), with limited production use under its Additional Use Grant. On 2030-07-28—or the fourth anniversary of a version’s first public distribution, if earlier—that version converts to Apache License 2.0. Commercial arrangements are available through [contact@samsarix.com](mailto:contact@samsarix.com).

The license does not grant rights to Samsarix names or logos. See [TRADEMARKS.md](TRADEMARKS.md) and [NOTICE](NOTICE). This repository’s legal history includes automated and bot-authored commits; Samsarix LLC should have counsel confirm the copyright chain before relying on exclusivity, accepting outside contributions, or registering the work.

Support questions may be sent to [support@samsarix.com](mailto:support@samsarix.com). Please report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

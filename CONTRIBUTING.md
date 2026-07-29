# Contributing

Samsarix Story Studio is currently a local-first MVP. Keep changes focused on the complete writer journey and make user-facing behavior more honest, portable, and testable.

## Setup

Requirements: Git, Node.js 20–24, and pnpm 11.9.0.

```bash
git clone https://github.com/Deathcharge/helix-creative-studio.git
cd helix-creative-studio
pnpm install --frozen-lockfile
pnpm dev
```

No `.env` or database is needed for the default demo. Copy `.env.example` only when testing an optional provider or MySQL profile. Never commit credentials or put provider keys in `VITE_` variables.

## Change workflow

1. Start from a clean branch and keep unrelated edits intact.
2. Add or update tests for behavior and access boundaries, not hard-coded mock objects.
3. Run `pnpm verify`.
4. For UI changes, also exercise the premise → story → archive → detail → continuation/export journey at narrow and wide viewport sizes.
5. Update README or operational documentation when commands, configuration, costs, privacy behavior, or limitations change.

TypeScript is strict for the active runtime graph. Prettier is the formatting contract. React components should preserve keyboard operation, visible focus, semantic labels, reduced-motion behavior, and actionable loading/error/empty states.

## Provider changes

Provider APIs are external cost and privacy boundaries. A provider change must include:

- server-only secret handling;
- a configurable model identifier;
- finite timeout and retry behavior;
- token/output bounds;
- sanitized errors;
- documentation of what content leaves the machine;
- credential-free tests, plus opt-in live verification when credentials are explicitly supplied.

Do not add a public “test all providers” route or make paid calls during install, build, tests, or startup.

## Pull requests

Describe the user problem, the chosen scope, verification performed, remaining risks, and any owner/credential/legal dependencies. Screenshots are useful for visual changes but do not replace behavioral or accessibility checks.

The highest-value deferred work is tracked in [docs/PRODUCTIZATION.md](docs/PRODUCTIZATION.md). Avoid reviving incomplete collections/tags/bulk-operation scaffolding without first defining its data migration, ownership, failure, and test behavior.

## Contribution licensing

Copyright in an accepted contribution remains with its author unless separately assigned. By submitting a contribution, you agree that it may be distributed under the repository’s Business Source License 1.1 terms and its stated Change License. Samsarix LLC is not currently accepting contributions that require a separate license, prevent future commercial licensing, or add an incompatible dependency.

Before accepting substantial outside contributions, maintainers should adopt a counsel-reviewed contributor agreement that grants the rights needed for both the public and commercial licensing models. Licensing questions belong at [contact@samsarix.com](mailto:contact@samsarix.com); support questions belong at [support@samsarix.com](mailto:support@samsarix.com).

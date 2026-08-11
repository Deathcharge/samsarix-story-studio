# Writer pilot protocol

This protocol evaluates one exact packaged release candidate. It is not a claim that a pilot has occurred.

## Artifact handoff

1. From a clean, verified commit, run `pnpm package:source`.
2. Give the participant the ZIP, its adjacent `.sha256` file, and this protocol.
3. Record the version, full Git commit, SHA-256 digest, operating system, Node version, browser, storage profile, and whether demo or provider mode was used.
4. Have the participant verify the digest before extracting the ZIP. Do not ask them to share provider keys, private manuscript text, or the local archive.

## 45-minute primary journey

Ask a fiction writer who did not build the product to:

1. Install dependencies and start the local app from the packaged source.
2. Create a project, a two-chapter plan, and at least two canon entries.
3. Add, edit, and reorder three scene cards in the first chapter.
4. Draft the first chapter manually or with the clearly identified demo/provider workflow.
5. Save an edit, restore the prior revision, add tags, and favorite the chapter.
6. Find the chapter from the archive using a tag and the favorites filter.
7. Export Markdown and a project backup, restore the backup as a copy, and confirm its scenes and continuity.
8. Stop and restart the app, then confirm the project is still available.

The facilitator should observe silently unless the participant is blocked for more than two minutes. Record the point of confusion before helping.

## Exit questions

- What did you think this product was for before and after the session?
- Which task felt most valuable? Which felt least trustworthy?
- At any point did demo output, provider output, review metadata, or saved local data seem ambiguous?
- Could you predict what context would be sent to a provider?
- Were scene planning, revision restore, tags, favorites, backup, and restart recovery understandable without instruction?
- What would prevent you from using it on a real manuscript next week?
- Would you prefer source checkout, a desktop installer, or a hosted service, and why?

## Pilot gate

Do not call the candidate pilot-validated until at least three independent writers complete the journey on the same digest. Before promotion, resolve every data-loss, privacy, inaccessible-blocker, misleading-AI, install-blocker, or backup-restore finding. Summarize lesser friction by frequency; do not discard dissenting feedback.

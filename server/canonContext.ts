import type { CanonEntry, Project } from "../drizzle/schema";

const MAX_CONTEXT_ENTRIES = 8;
const MAX_CONTEXT_CHARACTERS = 6_000;

export function parseActivationKeys(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return parsed
        .filter((key): key is string => typeof key === "string")
        .map(key => key.trim())
        .filter(Boolean)
        .slice(0, 20);
    }
  } catch {
    // Older/manual records may contain comma-separated values.
  }

  return value
    .split(",")
    .map(key => key.trim())
    .filter(Boolean)
    .slice(0, 20);
}

export function selectCanonContext(
  project: Project,
  entries: CanonEntry[],
  prompt: string,
  explicitIds: number[] = []
) {
  const explicit = new Set(explicitIds);
  const normalizedPrompt = prompt.toLocaleLowerCase();
  const selected = entries
    .map(entry => {
      const activationKeys = [
        entry.name,
        ...parseActivationKeys(entry.activationKeys),
      ];
      const matchedKeys = activationKeys.filter(key =>
        normalizedPrompt.includes(key.toLocaleLowerCase())
      );
      const selectionReason = explicit.has(entry.id)
        ? "selected"
        : entry.alwaysInclude === 1
          ? "always"
          : matchedKeys.length > 0
            ? "keyword"
            : null;
      return { entry, activationKeys, matchedKeys, selectionReason };
    })
    .filter(
      (
        candidate
      ): candidate is typeof candidate & {
        selectionReason: "selected" | "always" | "keyword";
      } => candidate.selectionReason !== null
    )
    .sort((a, b) => {
      const priority = { selected: 0, always: 1, keyword: 2 } as const;
      return (
        priority[a.selectionReason] - priority[b.selectionReason] ||
        a.entry.name.localeCompare(b.entry.name)
      );
    })
    .slice(0, MAX_CONTEXT_ENTRIES);

  const projectHeader = [
    `Project: ${project.title}`,
    project.premise ? `Premise: ${project.premise}` : "",
    project.genre ? `Genre: ${project.genre}` : "",
    project.style ? `Style guidance: ${project.style}` : "",
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, MAX_CONTEXT_CHARACTERS);

  let remaining = Math.max(0, MAX_CONTEXT_CHARACTERS - projectHeader.length);
  const included: typeof selected = [];
  const sections: string[] = [];
  for (const candidate of selected) {
    const section = `[${candidate.entry.kind}] ${candidate.entry.name}\n${candidate.entry.content.trim()}`;
    const separatorLength = projectHeader || sections.length > 0 ? 2 : 0;
    const available = remaining - separatorLength;
    if (available <= 0) break;
    const bounded = section.slice(0, available);
    if (!bounded.trim()) break;
    sections.push(bounded);
    included.push(candidate);
    remaining -= bounded.length + separatorLength;
  }

  const context = [projectHeader, ...sections].filter(Boolean).join("\n\n");
  return {
    context,
    estimatedTokens: Math.ceil(context.length / 4),
    truncated: included.length < selected.length || remaining <= 0,
    entries: included.map(candidate => ({
      id: candidate.entry.id,
      kind: candidate.entry.kind,
      name: candidate.entry.name,
      reason: candidate.selectionReason,
      matchedKeys: candidate.matchedKeys,
    })),
  };
}

export const CANON_CONTEXT_LIMITS = {
  maxEntries: MAX_CONTEXT_ENTRIES,
  maxCharacters: MAX_CONTEXT_CHARACTERS,
};

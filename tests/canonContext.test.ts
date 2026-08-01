import { describe, expect, it } from "vitest";
import type { CanonEntry, Project } from "../drizzle/schema";
import {
  CANON_CONTEXT_LIMITS,
  selectCanonContext,
} from "../server/canonContext";

const now = new Date("2026-08-01T12:00:00Z");
const project: Project = {
  id: 1,
  userId: 1,
  title: "Bounded Context",
  premise: "A writer tests which facts enter the draft.",
  genre: null,
  style: null,
  createdAt: now,
  updatedAt: now,
};

function entry(id: number): CanonEntry {
  return {
    id,
    projectId: 1,
    userId: 1,
    kind: "lore",
    name: `Entry ${id}`,
    content: "x".repeat(1_000),
    activationKeys: JSON.stringify([`key-${id}`]),
    alwaysInclude: 1,
    createdAt: now,
    updatedAt: now,
  };
}

describe("canon context selection", () => {
  it("caps context size and entry count deterministically", () => {
    const result = selectCanonContext(
      project,
      Array.from({ length: 12 }, (_, index) => entry(index + 1)),
      "chapter prompt"
    );

    expect(result.entries.length).toBeLessThanOrEqual(
      CANON_CONTEXT_LIMITS.maxEntries
    );
    expect(result.context.length).toBeLessThanOrEqual(
      CANON_CONTEXT_LIMITS.maxCharacters
    );
    expect(result.truncated).toBe(true);
    expect(result.estimatedTokens).toBe(Math.ceil(result.context.length / 4));
  });
});

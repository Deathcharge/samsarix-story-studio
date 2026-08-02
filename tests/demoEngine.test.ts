import { describe, expect, it } from "vitest";
import { executeDemoRitual } from "../server/demoEngine";
import { enhancePrompt } from "../server/promptEnhancer";

describe("local no-key tools", () => {
  it("creates an explicitly identifiable, prompt-aware demo draft", async () => {
    const prompt =
      "A courier discovers the city's maps erase people who refuse corporate housing";
    const result = await executeDemoRitual(prompt);

    expect(result.success).toBe(true);
    expect(result.ritualId).toMatch(/^demo_/);
    expect(result.storyText).toContain(prompt);
    expect(result.metadata.wordCount).toBeGreaterThan(500);
    expect(result.metadata.agentContributions.oracle.provider).toBe("demo");
  });

  it("refines short prompts locally without a provider call", async () => {
    const result = await enhancePrompt("A rebel protects an AI witness");

    expect(result.enhanced).toContain("A rebel protects an AI witness");
    expect(result.enhanced.length).toBeGreaterThan(result.original.length);
    expect(result.suggestedThemes).toContain("personhood");
  });

  it("uses selected character canon in the no-key demonstration", async () => {
    const result = await executeDemoRitual(
      "A cartographer follows a route erased from every city map.",
      "Project: Lost Hours\n\n[character] Nera Vale\nNera keeps paper copies of every route."
    );

    expect(result.storyText).toContain("Nera Vale watched it");
    expect(result.storyText).not.toContain("details, so Jonah");
  });

  it("formats organization possessives without a doubled s", async () => {
    const result = await executeDemoRitual(
      "Nera finds a station clock counting down the names of passengers who vanished."
    );

    expect(result.storyText).not.toMatch(/(?:Systems|Humanics)'s/);
  });
});

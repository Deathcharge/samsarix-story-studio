import { describe, expect, it } from "vitest";
import { executeDemoRitual } from "../server/demoEngine";
import { enhancePrompt } from "../server/promptEnhancer";

describe("local no-key tools", () => {
  it("creates an explicitly identifiable, prompt-aware demo draft", () => {
    const prompt =
      "A courier discovers the city's maps erase people who refuse corporate housing";
    const result = executeDemoRitual(prompt);

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
});

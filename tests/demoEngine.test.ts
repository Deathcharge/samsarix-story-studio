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
    expect(result.metadata.agentContributions.template.provider).toBe("demo");
    expect(result.metadata.qualityScore).toBe(0);
    expect(result.metadata.ethicalApproval).toBe(false);
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

  it("reports deterministic stages in order", async () => {
    const originalDelay = process.env.DEMO_STAGE_DELAY_MS;
    process.env.DEMO_STAGE_DELAY_MS = "0";
    const stages: string[] = [];
    try {
      await executeDemoRitual(
        "A signal keeper discovers the lighthouse is warning ships away from tomorrow.",
        undefined,
        { onStage: stage => stages.push(stage) }
      );
    } finally {
      if (originalDelay === undefined) delete process.env.DEMO_STAGE_DELAY_MS;
      else process.env.DEMO_STAGE_DELAY_MS = originalDelay;
    }

    expect(stages).toEqual(["preparing", "synthesis"]);
  });

  it("stops promptly when its signal is aborted", async () => {
    const originalDelay = process.env.DEMO_STAGE_DELAY_MS;
    process.env.DEMO_STAGE_DELAY_MS = "1000";
    const controller = new AbortController();
    try {
      const pending = executeDemoRitual(
        "A clockmaker finds a minute that belongs to someone who has not been born.",
        undefined,
        { signal: controller.signal }
      );
      controller.abort(new DOMException("Cancelled", "AbortError"));
      await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    } finally {
      if (originalDelay === undefined) delete process.env.DEMO_STAGE_DELAY_MS;
      else process.env.DEMO_STAGE_DELAY_MS = originalDelay;
    }
  });
});

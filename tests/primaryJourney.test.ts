import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import type { User } from "../drizzle/schema";
import * as db from "../server/db";
import { isTrustedRequestMetadata } from "../server/_core/requestSecurity";
import { getLocalDataPath } from "../server/localStore";
import { appRouter } from "../server/routers";

async function createCaller(userOverride?: User) {
  const user = userOverride ?? (await db.getLocalUser());
  return appRouter.createCaller({
    req: {} as Request,
    res: { clearCookie: vi.fn() } as unknown as Response,
    user,
  });
}

describe("primary local story journey", () => {
  it("generates, persists, retrieves, exports metadata, and continues a story", async () => {
    const caller = await createCaller();
    const generated = await caller.stories.generate({
      prompt:
        "A night-shift mechanic finds a forbidden memory inside the city transit grid",
      preset: "balanced",
    });

    expect(generated.ritualId).toMatch(/^demo_/);

    const archive = await caller.stories.list();
    expect(archive).toHaveLength(1);
    expect(archive[0].ritualId).toBe(generated.ritualId);

    const story = await caller.stories.getByRitualId({
      ritualId: generated.ritualId,
    });
    expect(story?.qualityScore).toBeCloseTo(0.72);
    expect(story?.ucfHarmony).toBeCloseTo(0.72);
    expect(story?.agentContributions).toMatchObject({
      oracle: { provider: "demo" },
    });

    const continuation = await caller.stories.continueStory({
      previousStoryId: story!.id,
    });
    expect(continuation.chapterNumber).toBe(2);
    expect(continuation.prompt).toContain("chapter 2");

    const updated = await caller.stories.getByRitualId({
      ritualId: generated.ritualId,
    });
    expect(updated?.seriesId).toBe(continuation.seriesId);
    expect(updated?.chapterNumber).toBe(1);
  });

  it("does not expose a story to another user", async () => {
    const owner = await db.getLocalUser();
    const ownerCaller = await createCaller(owner);
    const generated = await ownerCaller.stories.generate({
      prompt:
        "A public defender learns court transcripts are being rewritten overnight",
      preset: "structured",
    });
    const otherUser: User = {
      ...owner,
      id: 999,
      openId: "other-user",
      name: "Other User",
      role: "user",
    };
    const otherCaller = await createCaller(otherUser);

    expect(
      await otherCaller.stories.getByRitualId({ ritualId: generated.ritualId })
    ).toBeNull();
    expect(await otherCaller.stories.list()).toEqual([]);
  });

  it("rejects prompts below the minimum before generation", async () => {
    const caller = await createCaller();
    await expect(
      caller.stories.generate({ prompt: "too short", preset: "balanced" })
    ).rejects.toThrow();
  });
});

describe("local request boundary", () => {
  it("accepts loopback hosts and rejects DNS-rebinding or cross-origin hosts", () => {
    expect(isTrustedRequestMetadata("127.0.0.1", "http://localhost:3000")).toBe(
      true
    );
    expect(isTrustedRequestMetadata("localhost")).toBe(true);
    expect(
      isTrustedRequestMetadata("attacker.example", "http://attacker.example")
    ).toBe(false);
    expect(
      isTrustedRequestMetadata("127.0.0.1", "https://attacker.example")
    ).toBe(false);
    expect(isTrustedRequestMetadata("127.0.0.1", "null")).toBe(false);
  });
});

describe("Samsarix storage compatibility", () => {
  it("prefers the Samsarix data setting while honoring the legacy Helix alias", () => {
    const samsarixPath = process.env.SAMSARIX_DATA_FILE;
    const helixPath = process.env.HELIX_DATA_FILE;

    try {
      delete process.env.SAMSARIX_DATA_FILE;
      process.env.HELIX_DATA_FILE = "legacy-studio.json";
      expect(getLocalDataPath()).toMatch(/legacy-studio\.json$/);

      process.env.SAMSARIX_DATA_FILE = "samsarix-studio.json";
      expect(getLocalDataPath()).toMatch(/samsarix-studio\.json$/);
    } finally {
      if (samsarixPath === undefined) delete process.env.SAMSARIX_DATA_FILE;
      else process.env.SAMSARIX_DATA_FILE = samsarixPath;

      if (helixPath === undefined) delete process.env.HELIX_DATA_FILE;
      else process.env.HELIX_DATA_FILE = helixPath;
    }
  });
});

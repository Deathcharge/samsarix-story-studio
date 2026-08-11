import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import type { User } from "../drizzle/schema";
import * as db from "../server/db";
import {
  isBackupImportRequestPath,
  isTrustedRequestMetadata,
} from "../server/_core/requestSecurity";
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
    expect(story?.review).toEqual({
      quality: { status: "not-run", score: null },
      safety: { status: "not-run", outcome: null },
    });
    expect(story).not.toHaveProperty("ucfHarmony");
    expect(story?.agentContributions).toMatchObject({
      template: { provider: "demo" },
    });

    const continuation = await caller.stories.prepareContinuation({
      previousStoryId: story!.id,
    });
    expect(continuation.chapterNumber).toBe(2);
    expect(continuation.prompt).toContain("chapter 2");

    const unchanged = await caller.stories.getByRitualId({
      ritualId: generated.ritualId,
    });
    expect(unchanged?.seriesId).toBeNull();

    const nextChapter = await caller.stories.generate({
      prompt: continuation.prompt,
      preset: "balanced",
      previousChapterId: story!.id,
    });
    expect(nextChapter.ritualId).toMatch(/^demo_/);

    const updated = await caller.stories.getByRitualId({
      ritualId: generated.ritualId,
    });
    expect(updated?.seriesId).toBe(continuation.seriesId);
    expect(updated?.chapterNumber).toBe(1);
  });

  it("manages a project, selects bounded canon, edits with history, and exports a backup", async () => {
    const caller = await createCaller();
    const project = await caller.projects.create({
      title: "The Glass Archive",
      premise:
        "A courier maps a city that deletes dissenters from public memory.",
      genre: "speculative noir",
      style: "Close third person with restrained prose.",
    });
    const mara = await caller.projects.createCanon({
      projectId: project.id,
      kind: "character",
      name: "Mara Venn",
      content: "Mara is a courier who refuses neural implants.",
      activationKeys: ["Mara", "the courier"],
      alwaysInclude: false,
    });
    await caller.projects.createCanon({
      projectId: project.id,
      kind: "location",
      name: "Glass Harbor",
      content: "Glass Harbor floods at every high tide.",
      activationKeys: ["harbor"],
      alwaysInclude: true,
    });
    await caller.projects.createCanon({
      projectId: project.id,
      kind: "faction",
      name: "The Pale Office",
      content: "A records bureau that should remain unknown in chapter one.",
      activationKeys: ["Pale Office"],
      alwaysInclude: false,
    });

    const preview = await caller.projects.previewContext({
      projectId: project.id,
      prompt: "Mara follows a forged map through the old station.",
      selectedCanonIds: [],
    });
    expect(preview.entries.map(entry => entry.name)).toEqual([
      "Glass Harbor",
      "Mara Venn",
    ]);
    expect(preview.context).not.toContain("The Pale Office");
    expect(preview.estimatedTokens).toBeGreaterThan(0);

    const generated = await caller.stories.generate({
      prompt: "Mara follows a forged map through the old station.",
      preset: "structured",
      projectId: project.id,
      selectedCanonIds: [mara.id],
    });
    expect(generated.projectId).toBe(project.id);
    expect(generated.contextSelection?.entries).toHaveLength(2);

    const workspace = await caller.projects.get({ id: project.id });
    expect(workspace.stories).toHaveLength(1);
    expect(workspace.stories[0].chapterNumber).toBe(1);
    expect(workspace.canon).toHaveLength(3);

    const story = await caller.stories.getById({
      id: workspace.stories[0].id,
    });
    if (!story) throw new Error("Generated project story was not found");
    const originalContent = story.content;
    await caller.stories.update({
      id: story.id,
      title: "Chapter One: The Missing Route",
      content: `${story.content}\n\nMara folded the map and chose the flooded road.`,
    });
    const revisions = await caller.stories.revisions({ storyId: story.id });
    expect(revisions).toHaveLength(1);
    expect(revisions[0].content).toBe(originalContent);

    await caller.stories.restoreRevision({
      storyId: story.id,
      revisionId: revisions[0].id,
    });
    const restored = await caller.stories.getById({ id: story.id });
    expect(restored?.content).toBe(originalContent);
    expect(await caller.stories.revisions({ storyId: story.id })).toHaveLength(
      2
    );

    const continuation = await caller.stories.prepareContinuation({
      previousStoryId: story.id,
    });
    await caller.stories.generate({
      prompt: continuation.prompt,
      preset: "structured",
      projectId: project.id,
      previousChapterId: story.id,
    });

    const backup = await caller.projects.export({ id: project.id });
    expect(backup.format).toBe("samsarix-project");
    expect(backup.stories).toHaveLength(2);
    expect(backup.stories[0].revisions).toHaveLength(2);
    expect(backup.project).not.toHaveProperty("userId");
    expect(backup.canon.every(entry => !("userId" in entry))).toBe(true);
    expect(backup.stories.every(entry => !("userId" in entry))).toBe(true);
    expect(
      backup.stories.every(entry =>
        entry.revisions.every(revision => !("userId" in revision))
      )
    ).toBe(true);

    const imported = await caller.projects.importBackup({ backup });
    expect(imported.projectId).not.toBe(project.id);
    expect(imported).toMatchObject({
      title: "The Glass Archive",
      canonCount: 3,
      storyCount: 2,
      revisionCount: 2,
    });
    const importedWorkspace = await caller.projects.get({
      id: imported.projectId,
    });
    expect(importedWorkspace.project.title).toBe("The Glass Archive");
    expect(importedWorkspace.canon.map(entry => entry.name)).toEqual(
      workspace.canon.map(entry => entry.name)
    );
    expect(importedWorkspace.stories).toHaveLength(2);
    expect(importedWorkspace.stories[1].previousChapterId).toBe(
      importedWorkspace.stories[0].id
    );
    expect(importedWorkspace.stories[0].seriesId).toBe(
      importedWorkspace.stories[1].seriesId
    );
    expect(importedWorkspace.stories[0].seriesId).not.toBe(
      backup.stories[0].seriesId
    );
    const importedStory = await caller.stories.getById({
      id: importedWorkspace.stories[0].id,
    });
    expect(importedStory?.content).toBe(originalContent);
    expect(importedStory?.ritualId).not.toBe(story.ritualId);
    expect(
      await caller.stories.revisions({
        storyId: importedWorkspace.stories[0].id,
      })
    ).toHaveLength(2);

    const owner = await db.getLocalUser();
    const otherCaller = await createCaller({
      ...owner,
      id: 998,
      openId: "project-intruder",
      name: "Project Intruder",
      role: "user",
    });
    await expect(otherCaller.projects.get({ id: project.id })).rejects.toThrow(
      "Project not found"
    );
    await expect(
      otherCaller.projects.previewContext({
        projectId: project.id,
        prompt: "Reveal the private canon",
        selectedCanonIds: [],
      })
    ).rejects.toThrow("Project not found");
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

  it("plans blank chapters, updates status, reorders continuity, and restores the board", async () => {
    const caller = await createCaller();
    const project = await caller.projects.create({
      title: "The Salt Meridian",
      premise: "Two cartographers discover their coastlines disagree.",
      genre: "fantasy",
    });
    const departure = await caller.projects.createChapterPlan({
      projectId: project.id,
      title: "Departure Lines",
      synopsis: "Iria hides the official chart before the survey ship leaves.",
    });
    const crossing = await caller.projects.createChapterPlan({
      projectId: project.id,
      title: "The False Crossing",
      synopsis: "The crew reaches a harbor that exists on only one map.",
    });
    expect(crossing.draftStatus).toBe("planned");

    await caller.projects.updateChapterPlanning({
      projectId: project.id,
      storyId: crossing.id,
      draftStatus: "revising",
      synopsis: "The crew reaches a harbor that exists on only one map.",
    });
    await caller.projects.updateChapterPlanning({
      projectId: project.id,
      storyId: crossing.id,
      draftStatus: "revising",
      synopsis: "",
    });
    expect(
      (await caller.projects.get({ id: project.id })).stories.find(
        story => story.id === crossing.id
      )?.synopsis
    ).toBeNull();
    await caller.projects.updateChapterPlanning({
      projectId: project.id,
      storyId: crossing.id,
      draftStatus: "revising",
      synopsis: "The crew reaches a harbor that exists on only one map.",
    });
    await caller.projects.reorderChapters({
      projectId: project.id,
      orderedStoryIds: [crossing.id, departure.id],
    });

    let workspace = await caller.projects.get({ id: project.id });
    expect(workspace.stories.map(story => story.id)).toEqual([
      crossing.id,
      departure.id,
    ]);
    expect(workspace.stories.map(story => story.chapterNumber)).toEqual([1, 2]);
    expect(workspace.stories[0].previousChapterId).toBeNull();
    expect(workspace.stories[1].previousChapterId).toBe(crossing.id);
    expect(workspace.stories[0].seriesId).toBe(`project_${project.id}`);
    expect(workspace.stories[1].seriesId).toBe(`project_${project.id}`);
    expect(workspace.stories[0].draftStatus).toBe("revising");

    const arrival = await caller.projects.createScene({
      projectId: project.id,
      storyId: crossing.id,
      title: "Impossible arrival",
      summary: "The harbor master recognizes a ship that has never launched.",
      pov: "Iria",
      location: "False Harbor",
    });
    const ledger = await caller.projects.createScene({
      projectId: project.id,
      storyId: crossing.id,
      title: "Tide ledger",
      summary: "The crew finds tomorrow's tide recorded in a century-old book.",
    });
    await caller.projects.reorderScenes({
      projectId: project.id,
      storyId: crossing.id,
      orderedSceneIds: [ledger.id, arrival.id],
    });
    await caller.projects.updateScene({
      id: arrival.id,
      projectId: project.id,
      storyId: crossing.id,
      title: "Impossible arrival",
      summary: "The harbor master recognizes Iria's ship before it launches.",
      pov: "Iria",
      location: "False Harbor",
    });
    await caller.stories.updateOrganization({
      id: crossing.id,
      tags: ["Map mystery", "Draft", "draft"],
      isFavorite: true,
    });
    workspace = await caller.projects.get({ id: project.id });
    expect(workspace.stories[0].scenes.map(scene => scene.id)).toEqual([
      ledger.id,
      arrival.id,
    ]);
    expect(workspace.stories[0].scenes[1].summary).toContain("Iria's ship");
    expect(await caller.stories.getById({ id: crossing.id })).toMatchObject({
      tags: ["Map mystery", "Draft"],
      isFavorite: true,
    });
    expect(
      (await caller.stories.list()).find(story => story.id === crossing.id)
    ).toMatchObject({ tags: ["Map mystery", "Draft"], isFavorite: true });

    await expect(
      caller.projects.reorderChapters({
        projectId: project.id,
        orderedStoryIds: [departure.id],
      })
    ).rejects.toThrow("every current project chapter");

    await caller.stories.update({
      id: departure.id,
      title: "Departure Lines",
      content: "Iria folded the forbidden chart beneath her coat.",
    });
    workspace = await caller.projects.get({ id: project.id });
    expect(workspace.stories[1].draftStatus).toBe("drafting");
    const blankRevision = await caller.stories.revisions({
      storyId: departure.id,
    });
    expect(blankRevision).toHaveLength(1);
    expect(blankRevision[0].content).toBe("");

    const backup = await caller.projects.export({ id: project.id });
    expect(backup.stories[0]).toMatchObject({
      id: crossing.id,
      draftStatus: "revising",
      synopsis: "The crew reaches a harbor that exists on only one map.",
      content: "",
    });
    expect(backup.stories[1].revisions[0].content).toBe("");
    expect(backup.stories[0].scenes.map(scene => scene.title)).toEqual([
      "Tide ledger",
      "Impossible arrival",
    ]);
    expect(backup.stories[0].scenes.every(scene => !("userId" in scene))).toBe(
      true
    );
    expect(backup.stories.every(story => !("collectionId" in story))).toBe(
      true
    );

    const imported = await caller.projects.importBackup({ backup });
    const restored = await caller.projects.get({ id: imported.projectId });
    expect(restored.stories.map(story => story.draftStatus)).toEqual([
      "revising",
      "drafting",
    ]);
    expect(restored.stories[0].synopsis).toBe(
      "The crew reaches a harbor that exists on only one map."
    );
    expect(restored.stories[1].previousChapterId).toBe(restored.stories[0].id);
    expect(restored.stories[0].scenes.map(scene => scene.title)).toEqual([
      "Tide ledger",
      "Impossible arrival",
    ]);
    expect(
      (await caller.stories.getById({ id: restored.stories[0].id }))?.content
    ).toBe("");
    expect(
      await caller.stories.preparePlannedChapter({
        targetStoryId: restored.stories[0].id,
      })
    ).toMatchObject({
      targetStoryId: restored.stories[0].id,
      projectId: imported.projectId,
    });

    const owner = await db.getLocalUser();
    const otherCaller = await createCaller({
      ...owner,
      id: 997,
      openId: "board-intruder",
      name: "Board Intruder",
      role: "user",
    });
    await expect(
      otherCaller.projects.updateChapterPlanning({
        projectId: project.id,
        storyId: crossing.id,
        draftStatus: "complete",
        synopsis: "Overwrite someone else's plan",
      })
    ).rejects.toThrow("Project not found");
    await expect(
      otherCaller.projects.deleteScene({
        id: arrival.id,
        projectId: project.id,
        storyId: crossing.id,
      })
    ).rejects.toThrow("Project not found");
    await expect(
      otherCaller.stories.updateOrganization({
        id: crossing.id,
        tags: ["stolen"],
        isFavorite: false,
      })
    ).rejects.toThrow();

    const unrelatedProject = await caller.projects.create({
      title: "Unrelated manuscript",
      premise: "A separate project cannot be used to authorize scene edits.",
    });
    await expect(
      caller.projects.deleteScene({
        id: arrival.id,
        projectId: unrelatedProject.id,
        storyId: crossing.id,
      })
    ).rejects.toThrow();
    await expect(
      caller.projects.createScene({
        projectId: unrelatedProject.id,
        storyId: crossing.id,
        title: "Smuggled scene",
        summary: "A scene cannot attach across project boundaries.",
      })
    ).rejects.toThrow();

    const otherChapterScene = await caller.projects.createScene({
      projectId: project.id,
      storyId: departure.id,
      title: "Departure watch",
      summary: "The crew checks the horizon before leaving.",
    });
    await expect(
      caller.projects.reorderScenes({
        projectId: project.id,
        storyId: crossing.id,
        orderedSceneIds: [arrival.id, otherChapterScene.id],
      })
    ).rejects.toThrow();
    expect(
      (await caller.projects.get({ id: project.id })).stories[0].scenes.map(
        scene => scene.id
      )
    ).toEqual([ledger.id, arrival.id]);
  });

  it("drafts planned chapters in place without duplicating or breaking continuity", async () => {
    const owner = await db.getLocalUser();
    const caller = await createCaller(owner);
    const project = await caller.projects.create({
      title: "The Quiet Astrarium",
      premise: "An astronomer finds a constellation that records private vows.",
      genre: "speculative mystery",
    });
    const first = await caller.projects.createChapterPlan({
      projectId: project.id,
      title: "The Unlisted Star",
      synopsis: "Sena discovers a star missing from every official chart.",
    });
    const second = await caller.projects.createChapterPlan({
      projectId: project.id,
      title: "A Map of Promises",
      synopsis: "The observatory staff realize the star repeats their secrets.",
    });
    await caller.projects.createScene({
      projectId: project.id,
      storyId: first.id,
      title: "Roof calibration",
      summary: "Sena aligns the old lens and finds the unlisted star.",
      pov: "Sena",
      location: "North dome",
    });

    const preparedFirst = await caller.stories.preparePlannedChapter({
      targetStoryId: first.id,
    });
    expect(preparedFirst).toMatchObject({
      targetStoryId: first.id,
      projectId: project.id,
      previousChapterId: null,
    });
    expect(preparedFirst.prompt).toContain("The Unlisted Star");
    expect(preparedFirst.prompt).toContain("Roof calibration");

    const generatedFirst = await caller.stories.generate({
      targetStoryId: first.id,
      projectId: project.id,
      prompt: preparedFirst.prompt,
      preset: "structured",
    });
    expect(generatedFirst).toMatchObject({
      storyId: first.id,
      title: "The Unlisted Star",
      projectId: project.id,
    });

    let workspace = await caller.projects.get({ id: project.id });
    expect(workspace.stories).toHaveLength(2);
    expect(workspace.stories.map(story => story.id)).toEqual([
      first.id,
      second.id,
    ]);
    expect(workspace.stories[0]).toMatchObject({
      ritualId: generatedFirst.ritualId,
      draftStatus: "drafting",
      chapterNumber: 1,
      previousChapterId: null,
    });
    expect(workspace.stories[0].wordCount).toBeGreaterThan(500);
    expect(workspace.stories[1].previousChapterId).toBe(first.id);

    await expect(
      caller.stories.generate({
        targetStoryId: first.id,
        projectId: project.id,
        prompt: preparedFirst.prompt,
        preset: "structured",
      })
    ).rejects.toThrow("already has a draft");
    await expect(
      caller.stories.generate({
        targetStoryId: second.id,
        previousChapterId: first.id,
        prompt: preparedFirst.prompt,
        preset: "structured",
      })
    ).rejects.toThrow("either a planned chapter target or a new continuation");

    const otherCaller = await createCaller({
      ...owner,
      id: 995,
      openId: "planned-chapter-intruder",
      name: "Planned Chapter Intruder",
      role: "user",
    });
    await expect(
      otherCaller.stories.preparePlannedChapter({ targetStoryId: second.id })
    ).rejects.toThrow("Planned chapter not found");

    await caller.projects.createScene({
      projectId: project.id,
      storyId: second.id,
      title: "Echo in the staff room",
      summary: "The observatory staff hear their private vows repeated aloud.",
    });

    const preparedSecond = await caller.stories.preparePlannedChapter({
      targetStoryId: second.id,
    });
    expect(preparedSecond.previousChapterId).toBe(first.id);
    expect(preparedSecond.prompt).toContain("chapter 2");
    expect(preparedSecond.prompt).toContain("The Quiet Astrarium");
    expect(preparedSecond.prompt).toContain("Echo in the staff room");
    const generatedSecond = await caller.stories.generate({
      targetStoryId: second.id,
      projectId: project.id,
      prompt: preparedSecond.prompt,
      preset: "structured",
    });
    expect(generatedSecond.storyId).toBe(second.id);

    workspace = await caller.projects.get({ id: project.id });
    expect(workspace.stories).toHaveLength(2);
    expect(workspace.stories[1]).toMatchObject({
      id: second.id,
      previousChapterId: first.id,
      chapterNumber: 2,
      draftStatus: "drafting",
    });

    const whitespace = await caller.projects.createChapterPlan({
      projectId: project.id,
      title: "Whitespace Legacy",
      synopsis: "A compatibility case for an older manually cleared plan.",
    });
    await caller.stories.update({
      id: whitespace.id,
      title: whitespace.title,
      content: "   ",
    });
    expect(
      (await caller.projects.get({ id: project.id })).stories.find(
        story => story.id === whitespace.id
      )
    ).toMatchObject({ canDraftWithStudio: false, wordCount: 0 });
    expect(await caller.stories.getById({ id: whitespace.id })).toMatchObject({
      canDraftWithStudio: false,
      content: "   ",
    });
    await expect(
      caller.stories.preparePlannedChapter({ targetStoryId: whitespace.id })
    ).rejects.toThrow("already has a draft");

    const dangling = await caller.projects.createChapterPlan({
      projectId: project.id,
      title: "The Missing Predecessor",
      synopsis: "The chapter should not prepare against a broken link.",
    });
    await db.updateStory(dangling.id, owner.id, {
      previousChapterId: 999_999,
    });
    await expect(
      caller.stories.preparePlannedChapter({ targetStoryId: dangling.id })
    ).rejects.toThrow("Previous chapter not found");
  });

  it("rejects prompts below the minimum before generation", async () => {
    const caller = await createCaller();
    await expect(
      caller.stories.generate({ prompt: "too short", preset: "balanced" })
    ).rejects.toThrow();
  });

  it("runs a durable metadata-only generation job to a saved draft", async () => {
    const caller = await createCaller();
    const started = await caller.stories.startGeneration({
      prompt:
        "A signal archivist discovers the emergency broadcasts predict tomorrow's disappearances",
      preset: "balanced",
    });
    expect(started).toMatchObject({
      status: "queued",
      stage: "queued",
      mode: "demo",
    });
    expect(started).not.toHaveProperty("userId");
    expect(started).not.toHaveProperty("prompt");
    expect(started).not.toHaveProperty("content");

    let job = started;
    for (
      let attempt = 0;
      attempt < 200 && job.status !== "succeeded";
      attempt += 1
    ) {
      await new Promise(resolve => setTimeout(resolve, 25));
      const current = await caller.stories.generationStatus({
        jobId: started.id,
      });
      if (!current) throw new Error("Generation job disappeared");
      job = current;
    }
    expect(job).toMatchObject({
      status: "succeeded",
      stage: "completed",
      progress: 100,
    });
    expect(job.ritualId).toMatch(/^demo_/);
    expect(job.storyId).toBeTypeOf("number");
    expect(await caller.stories.activeGeneration()).toBeNull();
    expect(
      await caller.stories.getByRitualId({ ritualId: job.ritualId! })
    ).toMatchObject({ id: job.storyId });
  });

  it("cancels an active job, blocks overlap, and enforces job ownership", async () => {
    const originalDelay = process.env.DEMO_STAGE_DELAY_MS;
    process.env.DEMO_STAGE_DELAY_MS = "1000";
    try {
      const owner = await db.getLocalUser();
      const caller = await createCaller(owner);
      const project = await caller.projects.create({
        title: "The Drowned Signal",
        premise: "A harbor pilot hears a second city beneath the bay.",
      });
      const plan = await caller.projects.createChapterPlan({
        projectId: project.id,
        title: "The Answering Foghorn",
        synopsis: "The pilot follows the impossible reply beyond the seawall.",
      });
      const beforeCount = (await caller.stories.list()).length;
      const started = await caller.stories.startGeneration({
        prompt:
          "A harbor pilot hears a second city answering every foghorn from beneath the bay",
        preset: "balanced",
        projectId: project.id,
        targetStoryId: plan.id,
      });
      await expect(
        caller.stories.startGeneration({
          prompt:
            "A second premise must wait until the current generation has ended",
          preset: "balanced",
        })
      ).rejects.toThrow("already being generated");

      const otherCaller = await createCaller({
        ...owner,
        id: 996,
        openId: "generation-intruder",
        name: "Generation Intruder",
        role: "user",
      });
      expect(
        await otherCaller.stories.generationStatus({ jobId: started.id })
      ).toBeNull();
      await expect(
        otherCaller.stories.cancelGeneration({ jobId: started.id })
      ).rejects.toThrow("Generation not found");

      await caller.stories.cancelGeneration({ jobId: started.id });
      let job = await caller.stories.generationStatus({ jobId: started.id });
      for (
        let attempt = 0;
        attempt < 200 && job?.status !== "cancelled";
        attempt += 1
      ) {
        await new Promise(resolve => setTimeout(resolve, 25));
        job = await caller.stories.generationStatus({ jobId: started.id });
      }
      expect(job).toMatchObject({
        status: "cancelled",
        cancelRequested: 1,
      });
      expect((await caller.stories.list()).length).toBe(beforeCount);
      expect(await caller.stories.getById({ id: plan.id })).toMatchObject({
        id: plan.id,
        ritualId: plan.ritualId,
        content: "",
        wordCount: 0,
        draftStatus: "planned",
      });
      expect(await caller.stories.activeGeneration()).toBeNull();
    } finally {
      if (originalDelay === undefined) delete process.env.DEMO_STAGE_DELAY_MS;
      else process.env.DEMO_STAGE_DELAY_MS = originalDelay;
    }
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

  it("grants the larger JSON limit only to an exact backup import procedure", () => {
    expect(isBackupImportRequestPath("/projects.importBackup")).toBe(true);
    expect(
      isBackupImportRequestPath(
        "/stories.list,/projects.importBackup,/projects.list"
      )
    ).toBe(true);
    expect(isBackupImportRequestPath("/projects.importBackup.evil")).toBe(
      false
    );
    expect(isBackupImportRequestPath("/stories.generate")).toBe(false);
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

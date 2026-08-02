import { readFile, writeFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";

async function loadArchive(archive: unknown) {
  const dataPath = process.env.SAMSARIX_DATA_FILE;
  if (!dataPath) throw new Error("Test data path is not configured");
  await writeFile(dataPath, JSON.stringify(archive));
  vi.resetModules();
  const store = await import("../server/localStore");
  const user = await store.getLocalUser();
  return {
    user,
    persisted: JSON.parse(await readFile(dataPath, "utf8")) as {
      version: number;
      projects: unknown[];
      canonEntries: unknown[];
      storyRevisions: unknown[];
      generationJobs: Array<{
        id: string;
        status: string;
        errorMessage: string | null;
        completedAt: string | null;
      }>;
      stories: Array<{
        id: number;
        projectId: number | null;
        draftStatus: string;
        synopsis: string | null;
      }>;
    },
  };
}

describe("local archive migration", () => {
  it("upgrades a version-1 archive before returning data", async () => {
    const now = new Date("2026-07-28T12:00:00Z").toISOString();
    const { user, persisted } = await loadArchive({
      version: 1,
      nextIds: { users: 2, stories: 2, ucfStates: 1, agentLogs: 1 },
      users: [
        {
          id: 1,
          openId: "local-writer",
          name: "Legacy Writer",
          email: null,
          loginMethod: "local",
          role: "admin",
          createdAt: now,
          updatedAt: now,
          lastSignedIn: now,
        },
      ],
      stories: [{ id: 1, title: "Legacy chapter" }],
      ucfStates: [],
      agentLogs: [],
    });

    expect(user.name).toBe("Legacy Writer");
    expect(persisted).toMatchObject({
      version: 4,
      projects: [],
      canonEntries: [],
      storyRevisions: [],
      generationJobs: [],
    });
    expect(persisted.stories[0]).toMatchObject({
      id: 1,
      projectId: null,
      draftStatus: "drafting",
      synopsis: null,
    });
  });

  it("adds planning defaults when upgrading a version-2 archive", async () => {
    const now = new Date("2026-08-01T12:00:00Z").toISOString();
    const { persisted } = await loadArchive({
      version: 2,
      nextIds: {
        users: 2,
        projects: 2,
        stories: 2,
        canonEntries: 1,
        storyRevisions: 1,
        ucfStates: 1,
        agentLogs: 1,
      },
      users: [
        {
          id: 1,
          openId: "local-writer",
          name: "Version Two Writer",
          email: null,
          loginMethod: "local",
          role: "admin",
          createdAt: now,
          updatedAt: now,
          lastSignedIn: now,
        },
      ],
      projects: [{ id: 1, userId: 1, title: "Existing project" }],
      stories: [{ id: 1, userId: 1, projectId: 1, title: "Existing chapter" }],
      canonEntries: [],
      storyRevisions: [],
      ucfStates: [],
      agentLogs: [],
    });

    expect(persisted.version).toBe(4);
    expect(persisted.stories[0]).toMatchObject({
      id: 1,
      projectId: 1,
      draftStatus: "drafting",
      synopsis: null,
    });
  });

  it("interrupts active metadata-only jobs when upgrading a version-3 archive", async () => {
    const now = new Date("2026-08-02T01:00:00Z").toISOString();
    const { persisted } = await loadArchive({
      version: 3,
      nextIds: {
        users: 2,
        projects: 1,
        stories: 1,
        canonEntries: 1,
        storyRevisions: 1,
        ucfStates: 1,
        agentLogs: 1,
      },
      users: [
        {
          id: 1,
          openId: "local-writer",
          name: "Version Three Writer",
          email: null,
          loginMethod: "local",
          role: "admin",
          createdAt: now,
          updatedAt: now,
          lastSignedIn: now,
        },
      ],
      projects: [],
      stories: [],
      canonEntries: [],
      storyRevisions: [],
      ucfStates: [],
      agentLogs: [],
    });

    expect(persisted).toMatchObject({ version: 4, generationJobs: [] });

    const dataPath = process.env.SAMSARIX_DATA_FILE!;
    const archive = JSON.parse(await readFile(dataPath, "utf8"));
    archive.generationJobs = [
      {
        id: "gen_orphaned",
        userId: 1,
        projectId: null,
        storyId: null,
        ritualId: null,
        mode: "demo",
        status: "running",
        stage: "synthesis",
        stageLabel: "Writing the manuscript",
        progress: 70,
        cancelRequested: 0,
        errorMessage: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      },
    ];
    await writeFile(dataPath, JSON.stringify(archive));
    vi.resetModules();
    const reloaded = await import("../server/localStore");
    await reloaded.getLocalUser();
    const recovered = JSON.parse(await readFile(dataPath, "utf8"));
    expect(recovered.generationJobs[0]).toMatchObject({
      id: "gen_orphaned",
      status: "interrupted",
      stage: "interrupted",
      errorMessage: "The local server restarted before this draft finished.",
    });
    expect(recovered.generationJobs[0].completedAt).toBeTruthy();
    expect(recovered.generationJobs[0]).not.toHaveProperty("prompt");
    expect(recovered.generationJobs[0]).not.toHaveProperty("content");
  });
});

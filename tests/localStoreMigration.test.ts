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
      version: 3,
      projects: [],
      canonEntries: [],
      storyRevisions: [],
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

    expect(persisted.version).toBe(3);
    expect(persisted.stories[0]).toMatchObject({
      id: 1,
      projectId: 1,
      draftStatus: "drafting",
      synopsis: null,
    });
  });
});

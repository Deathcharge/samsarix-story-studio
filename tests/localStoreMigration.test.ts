import { readFile, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { getLocalDataPath, getLocalUser } from "../server/localStore";

describe("local archive migration", () => {
  it("upgrades a version-1 archive before returning data", async () => {
    const now = new Date("2026-07-28T12:00:00Z").toISOString();
    await writeFile(
      getLocalDataPath(),
      JSON.stringify({
        version: 1,
        nextIds: { users: 2, stories: 1, ucfStates: 1, agentLogs: 1 },
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
        stories: [],
        ucfStates: [],
        agentLogs: [],
      })
    );

    expect((await getLocalUser()).name).toBe("Legacy Writer");
    const migrated = JSON.parse(await readFile(getLocalDataPath(), "utf8")) as {
      version: number;
      projects: unknown[];
      canonEntries: unknown[];
      storyRevisions: unknown[];
    };
    expect(migrated).toMatchObject({
      version: 2,
      projects: [],
      canonEntries: [],
      storyRevisions: [],
    });
  });
});

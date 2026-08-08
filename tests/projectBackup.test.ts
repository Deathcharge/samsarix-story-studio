import { describe, expect, it } from "vitest";
import {
  projectBackupSchema,
  summarizeProjectBackup,
} from "../shared/projectBackup";

function backupFixture() {
  const now = new Date().toISOString();
  return {
    format: "samsarix-project",
    version: 1,
    exportedAt: now,
    project: {
      id: 7,
      title: "Signal House",
      premise: "A radio operator hears tomorrow's emergency broadcasts.",
      genre: null,
      style: null,
      createdAt: now,
      updatedAt: now,
    },
    canon: [],
    stories: [
      {
        id: 11,
        projectId: 7,
        title: "Chapter One",
        prompt: "A warning arrives before the storm.",
        content: "  The receiver clicked awake before midnight.\n",
        ritualId: "demo-source",
        wordCount: 7,
        qualityScore: 0.72,
        ethicalApproval: true,
        ucfHarmony: 0.72,
        ucfPrana: 0.68,
        ucfDrishti: 0.7,
        ucfKlesha: 0.2,
        ucfResilience: 0.75,
        ucfZoom: 0.66,
        agentContributions: { oracle: { provider: "demo" } },
        createdAt: now,
        updatedAt: now,
        seriesId: "source-series",
        chapterNumber: 1,
        previousChapterId: null,
        tags: null,
        isFavorite: 0,
        deletedAt: null,
        revisions: [],
        scenes: [],
      },
    ],
  };
}

describe("project backup validation", () => {
  it("accepts the current portable format and revives dates", () => {
    const result = projectBackupSchema.parse(backupFixture());
    expect(result.project.createdAt).toBeInstanceOf(Date);
    expect(result.stories[0].createdAt).toBeInstanceOf(Date);
    expect(result.stories[0].content).toBe(
      "  The receiver clicked awake before midnight.\n"
    );
    expect(summarizeProjectBackup(result).wordCount).toBe(6);
  });

  it("rejects cross-project and missing previous-chapter references", () => {
    const fixture = backupFixture();
    fixture.stories[0].projectId = 99;
    fixture.stories[0].previousChapterId = 404;
    const result = projectBackupSchema.safeParse(fixture);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map(issue => issue.message)).toEqual(
      expect.arrayContaining([
        "Every story must belong to the exported project.",
        "A previous chapter must be included in the same backup.",
      ])
    );
  });

  it("rejects cyclic previous-chapter links", () => {
    const fixture = backupFixture();
    fixture.stories.push({
      ...fixture.stories[0],
      id: 12,
      ritualId: "demo-source-two",
      chapterNumber: 2,
      previousChapterId: 11,
    });
    fixture.stories[0].previousChapterId = 12;
    const result = projectBackupSchema.safeParse(fixture);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map(issue => issue.message)).toContain(
      "Previous-chapter links cannot form a cycle."
    );
  });
});

import { randomUUID } from "node:crypto";
import type {
  CanonEntry,
  Project,
  Story,
  StoryRevision,
} from "../drizzle/schema";
import {
  countWords,
  summarizeProjectBackup,
  type ProjectBackup,
} from "../shared/projectBackup";

type ImportStory = {
  sourceId: number;
  previousSourceId: number | null;
  values: Omit<Story, "id" | "projectId" | "previousChapterId" | "userId">;
  revisions: Array<Omit<StoryRevision, "id" | "storyId" | "userId">>;
};

export type ProjectImportPlan = {
  project: Omit<Project, "id" | "userId">;
  canon: Array<Omit<CanonEntry, "id" | "projectId" | "userId">>;
  stories: ImportStory[];
  summary: ReturnType<typeof summarizeProjectBackup>;
};

export function prepareProjectImport(backup: ProjectBackup): ProjectImportPlan {
  const now = new Date();
  const seriesIds = new Map<string, string>();

  return {
    project: {
      title: backup.project.title,
      premise: backup.project.premise,
      genre: backup.project.genre,
      style: backup.project.style,
      createdAt: backup.project.createdAt,
      updatedAt: now,
    },
    canon: backup.canon.map(entry => ({
      kind: entry.kind,
      name: entry.name,
      content: entry.content,
      activationKeys: JSON.stringify(entry.activationKeys),
      alwaysInclude: entry.alwaysInclude ? 1 : 0,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    })),
    stories: backup.stories.map(story => {
      let seriesId: string | null = null;
      if (story.seriesId) {
        seriesId = seriesIds.get(story.seriesId) ?? `series_${randomUUID()}`;
        seriesIds.set(story.seriesId, seriesId);
      }
      return {
        sourceId: story.id,
        previousSourceId: story.previousChapterId,
        values: {
          title: story.title,
          prompt: story.prompt,
          content: story.content,
          ritualId: `import_${randomUUID()}`,
          wordCount: countWords(story.content),
          qualityScore: Math.round(story.qualityScore * 100),
          ethicalApproval: story.ethicalApproval ? 1 : 0,
          ucfHarmony: Math.round(story.ucfHarmony * 10_000),
          ucfPrana: Math.round(story.ucfPrana * 10_000),
          ucfDrishti: Math.round(story.ucfDrishti * 10_000),
          ucfKlesha: Math.round(story.ucfKlesha * 10_000),
          ucfResilience: Math.round(story.ucfResilience * 10_000),
          ucfZoom: Math.round(story.ucfZoom * 10_000),
          agentContributions: JSON.stringify(story.agentContributions ?? []),
          createdAt: story.createdAt,
          updatedAt: story.updatedAt,
          seriesId,
          chapterNumber: story.chapterNumber,
          collectionId: null,
          tags: story.tags ?? null,
          isFavorite: story.isFavorite ?? 0,
          deletedAt: null,
        },
        revisions: [...story.revisions]
          .sort(
            (left, right) =>
              left.createdAt.getTime() - right.createdAt.getTime() ||
              left.id - right.id
          )
          .map(revision => ({
            title: revision.title,
            content: revision.content,
            reason: revision.reason,
            createdAt: revision.createdAt,
          })),
      };
    }),
    summary: summarizeProjectBackup(backup),
  };
}

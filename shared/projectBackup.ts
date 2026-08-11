import { z } from "zod";
import { CHAPTER_STATUSES, DEFAULT_CHAPTER_STATUS } from "./chapterPlanning";

export const PROJECT_BACKUP_FORMAT = "samsarix-project" as const;
export const PROJECT_BACKUP_VERSION = 1 as const;
export const MAX_PROJECT_BACKUP_BYTES = 7_000_000;
export const MAX_PROJECT_BACKUP_JSON_CHARS = 6_000_000;

const dateSchema = z
  .union([z.date(), z.iso.datetime({ offset: true })])
  .transform(value => (value instanceof Date ? value : new Date(value)));
const nullableDateSchema = dateSchema.nullable();
const normalizedScoreSchema = z.number().finite().min(0).max(1);
const nonBlankString = (maximum: number) =>
  z
    .string()
    .min(1)
    .max(maximum)
    .refine(value => value.trim().length > 0, "Text cannot be blank.");

const projectSchema = z.object({
  id: z.number().int().positive(),
  title: nonBlankString(255),
  premise: nonBlankString(4_000),
  genre: z.string().max(100).nullable(),
  style: z.string().max(2_000).nullable(),
  createdAt: dateSchema,
  updatedAt: dateSchema,
});

const canonEntrySchema = z.object({
  id: z.number().int().positive(),
  projectId: z.number().int().positive(),
  kind: z.enum(["character", "location", "faction", "item", "lore"]),
  name: nonBlankString(255),
  content: nonBlankString(8_000),
  activationKeys: z.array(nonBlankString(80)).max(20),
  alwaysInclude: z.boolean(),
  createdAt: dateSchema,
  updatedAt: dateSchema,
});

const revisionSchema = z.object({
  id: z.number().int().positive(),
  storyId: z.number().int().positive(),
  title: nonBlankString(255),
  content: z.string().max(500_000),
  reason: nonBlankString(64),
  createdAt: dateSchema,
});

const sceneSchema = z.object({
  id: z.number().int().positive(),
  storyId: z.number().int().positive(),
  projectId: z.number().int().positive(),
  title: nonBlankString(255),
  summary: nonBlankString(4_000),
  position: z.number().int().min(1).max(100),
  pov: z.string().max(255).nullable(),
  location: z.string().max(255).nullable(),
  createdAt: dateSchema,
  updatedAt: dateSchema,
});

const storySchema = z.object({
  id: z.number().int().positive(),
  projectId: z.number().int().positive(),
  title: nonBlankString(255),
  prompt: nonBlankString(4_000),
  content: z.string().max(500_000),
  ritualId: nonBlankString(128),
  wordCount: z.number().int().nonnegative().max(500_000),
  qualityScore: normalizedScoreSchema,
  ethicalApproval: z.boolean(),
  ucfHarmony: normalizedScoreSchema,
  ucfPrana: normalizedScoreSchema,
  ucfDrishti: normalizedScoreSchema,
  ucfKlesha: normalizedScoreSchema,
  ucfResilience: normalizedScoreSchema,
  ucfZoom: normalizedScoreSchema,
  agentContributions: z.unknown(),
  createdAt: dateSchema,
  updatedAt: dateSchema,
  seriesId: nonBlankString(128).nullable(),
  chapterNumber: z.number().int().min(1).max(10_000).nullable(),
  previousChapterId: z.number().int().positive().nullable(),
  draftStatus: z.enum(CHAPTER_STATUSES).default(DEFAULT_CHAPTER_STATUS),
  synopsis: z.string().max(4_000).nullable().default(null),
  tags: z.string().max(8_000).nullable().optional(),
  isFavorite: z.union([z.literal(0), z.literal(1)]).optional(),
  deletedAt: nullableDateSchema.optional(),
  revisions: z.array(revisionSchema).max(50),
  scenes: z.array(sceneSchema).max(100).default([]),
});

export const projectBackupSchema = z
  .object({
    format: z.literal(PROJECT_BACKUP_FORMAT),
    version: z.literal(PROJECT_BACKUP_VERSION),
    exportedAt: dateSchema,
    project: projectSchema,
    canon: z.array(canonEntrySchema).max(500),
    stories: z.array(storySchema).max(500),
  })
  .superRefine((backup, context) => {
    const storyIds = new Set<number>();
    for (const [index, story] of backup.stories.entries()) {
      if (storyIds.has(story.id)) {
        context.addIssue({
          code: "custom",
          path: ["stories", index, "id"],
          message: "Story IDs must be unique within a backup.",
        });
      }
      storyIds.add(story.id);
      if (story.projectId !== backup.project.id) {
        context.addIssue({
          code: "custom",
          path: ["stories", index, "projectId"],
          message: "Every story must belong to the exported project.",
        });
      }
      for (const [revisionIndex, revision] of story.revisions.entries()) {
        if (revision.storyId !== story.id) {
          context.addIssue({
            code: "custom",
            path: ["stories", index, "revisions", revisionIndex, "storyId"],
            message: "A revision must reference its containing story.",
          });
        }
      }
      const sceneIds = new Set<number>();
      const positions = new Set<number>();
      for (const [sceneIndex, scene] of story.scenes.entries()) {
        if (
          scene.storyId !== story.id ||
          scene.projectId !== backup.project.id
        ) {
          context.addIssue({
            code: "custom",
            path: ["stories", index, "scenes", sceneIndex],
            message: "A scene must reference its containing story and project.",
          });
        }
        if (sceneIds.has(scene.id) || positions.has(scene.position)) {
          context.addIssue({
            code: "custom",
            path: ["stories", index, "scenes", sceneIndex],
            message: "Scene IDs and positions must be unique within a chapter.",
          });
        }
        sceneIds.add(scene.id);
        positions.add(scene.position);
      }
    }

    const storiesById = new Map(backup.stories.map(story => [story.id, story]));
    let cycleReported = false;
    for (const [index, story] of backup.stories.entries()) {
      const visited = new Set<number>();
      let current = story;
      while (current.previousChapterId !== null) {
        if (visited.has(current.id)) {
          if (!cycleReported) {
            context.addIssue({
              code: "custom",
              path: ["stories", index, "previousChapterId"],
              message: "Previous-chapter links cannot form a cycle.",
            });
            cycleReported = true;
          }
          break;
        }
        visited.add(current.id);
        const previous = storiesById.get(current.previousChapterId);
        if (!previous) break;
        current = previous;
      }
    }

    for (const [index, story] of backup.stories.entries()) {
      if (
        story.previousChapterId !== null &&
        !storyIds.has(story.previousChapterId)
      ) {
        context.addIssue({
          code: "custom",
          path: ["stories", index, "previousChapterId"],
          message: "A previous chapter must be included in the same backup.",
        });
      }
    }

    const canonIds = new Set<number>();
    for (const [index, entry] of backup.canon.entries()) {
      if (canonIds.has(entry.id)) {
        context.addIssue({
          code: "custom",
          path: ["canon", index, "id"],
          message: "Canon IDs must be unique within a backup.",
        });
      }
      canonIds.add(entry.id);
      if (entry.projectId !== backup.project.id) {
        context.addIssue({
          code: "custom",
          path: ["canon", index, "projectId"],
          message: "Every canon entry must belong to the exported project.",
        });
      }
    }

    let serializedLength: number | null = null;
    try {
      serializedLength = JSON.stringify(backup).length;
    } catch {
      context.addIssue({
        code: "custom",
        message: "Backup metadata must contain only JSON-compatible values.",
      });
    }
    if (
      serializedLength !== null &&
      serializedLength > MAX_PROJECT_BACKUP_JSON_CHARS
    ) {
      context.addIssue({
        code: "custom",
        message: "This backup is larger than the supported import limit.",
      });
    }
  });

export type ProjectBackup = z.infer<typeof projectBackupSchema>;

export function countWords(content: string) {
  return content.trim().split(/\s+/).filter(Boolean).length;
}

export function summarizeProjectBackup(backup: ProjectBackup) {
  return {
    title: backup.project.title,
    canonCount: backup.canon.length,
    storyCount: backup.stories.length,
    revisionCount: backup.stories.reduce(
      (total, story) => total + story.revisions.length,
      0
    ),
    wordCount: backup.stories.reduce(
      (total, story) => total + countWords(story.content),
      0
    ),
  };
}

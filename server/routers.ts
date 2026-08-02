import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { Story } from "../drizzle/schema";
import { CHAPTER_STATUSES } from "../shared/chapterPlanning";
import {
  PROJECT_BACKUP_FORMAT,
  PROJECT_BACKUP_VERSION,
  projectBackupSchema,
} from "../shared/projectBackup";
import { getAllAgentConfigs, getAllPresetModes } from "./agentConfig";
import { parseActivationKeys, selectCanonContext } from "./canonContext";
import * as db from "./db";
import {
  cancelGeneration,
  getActiveGenerationJob,
  getGenerationJob,
  startGeneration,
} from "./generationCoordinator";
import { generationInputSchema } from "./generationInput";
import { claimGeneration, releaseGeneration } from "./generationLock";
import { generateAndPersistStory } from "./generationService";
import { isDraftablePlannedChapter } from "./plannedChapter";
import { enhancePrompt } from "./promptEnhancer";
import {
  generateContinuationPrompt,
  generateSeriesId,
} from "./storyContinuation";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
const canonKindSchema = z.enum([
  "character",
  "location",
  "faction",
  "item",
  "lore",
]);

const projectFieldsSchema = z.object({
  title: z.string().trim().min(1).max(255),
  premise: z.string().trim().min(1).max(4_000),
  genre: z.string().trim().max(100).optional(),
  style: z.string().trim().max(2_000).optional(),
});

const canonFieldsSchema = z.object({
  kind: canonKindSchema,
  name: z.string().trim().min(1).max(255),
  content: z.string().trim().min(1).max(8_000),
  activationKeys: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  alwaysInclude: z.boolean().default(false),
});

function parseContributions(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return [];
  }
}

function omitUserId<T extends { userId: unknown }>(
  value: T
): Omit<T, "userId"> {
  const { userId, ...portable } = value;
  void userId;
  return portable;
}

function presentStory(story: Story) {
  return {
    ...story,
    canDraftWithStudio: isDraftablePlannedChapter(story),
    qualityScore: Number(story.qualityScore) / 100,
    ethicalApproval: Number(story.ethicalApproval) === 1,
    ucfHarmony: Number(story.ucfHarmony) / 10_000,
    ucfPrana: Number(story.ucfPrana) / 10_000,
    ucfDrishti: Number(story.ucfDrishti) / 10_000,
    ucfKlesha: Number(story.ucfKlesha) / 10_000,
    ucfResilience: Number(story.ucfResilience) / 10_000,
    ucfZoom: Number(story.ucfZoom) / 10_000,
    agentContributions: parseContributions(
      String(story.agentContributions ?? "[]")
    ),
  };
}

function presentProjectStory(story: Story) {
  return {
    id: story.id,
    title: story.title,
    prompt: story.prompt,
    ritualId: story.ritualId,
    wordCount: story.wordCount,
    createdAt: story.createdAt,
    updatedAt: story.updatedAt,
    seriesId: story.seriesId,
    chapterNumber: story.chapterNumber,
    previousChapterId: story.previousChapterId,
    draftStatus: story.draftStatus,
    synopsis: story.synopsis,
    canDraftWithStudio: isDraftablePlannedChapter(story),
  };
}

async function requireProject(projectId: number, userId: number) {
  const project = await db.getProjectById(projectId, userId);
  if (!project) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
  }
  return project;
}

export const appRouter = router({
  system: systemRouter,

  config: router({
    agents: publicProcedure.query(() => getAllAgentConfigs()),
    presets: publicProcedure.query(() => getAllPresetModes()),
  }),

  prompts: router({
    enhance: protectedProcedure
      .input(z.object({ prompt: z.string().trim().min(3).max(1_000) }))
      .mutation(({ input }) => enhancePrompt(input.prompt)),
  }),

  projects: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const projects = await db.getAllProjects(ctx.user.id);
      return Promise.all(
        projects.map(async project => {
          const [stories, canon] = await Promise.all([
            db.getStoriesByProject(project.id, ctx.user.id),
            db.getCanonEntries(project.id, ctx.user.id),
          ]);
          return {
            ...project,
            chapterCount: stories.length,
            canonCount: canon.length,
            wordCount: stories.reduce(
              (total, story) => total + story.wordCount,
              0
            ),
          };
        })
      );
    }),

    create: protectedProcedure
      .input(projectFieldsSchema)
      .mutation(({ input, ctx }) =>
        db.createProject({
          userId: ctx.user.id,
          title: input.title,
          premise: input.premise,
          genre: input.genre || null,
          style: input.style || null,
        })
      ),

    get: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input, ctx }) => {
        const project = await requireProject(input.id, ctx.user.id);
        const [stories, canon] = await Promise.all([
          db.getStoriesByProject(project.id, ctx.user.id),
          db.getCanonEntries(project.id, ctx.user.id),
        ]);
        return {
          project,
          stories: stories.map(presentProjectStory),
          canon: canon.map(entry => ({
            ...entry,
            activationKeys: parseActivationKeys(entry.activationKeys),
            alwaysInclude: entry.alwaysInclude === 1,
          })),
        };
      }),

    update: protectedProcedure
      .input(projectFieldsSchema.extend({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        await requireProject(input.id, ctx.user.id);
        const updated = await db.updateProject(input.id, ctx.user.id, {
          title: input.title,
          premise: input.premise,
          genre: input.genre || null,
          style: input.style || null,
        });
        if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
        return { success: true };
      }),

    createChapterPlan: protectedProcedure
      .input(
        z.object({
          projectId: z.number().int().positive(),
          title: z.string().trim().min(1).max(255),
          synopsis: z.string().trim().max(4_000).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await requireProject(input.projectId, ctx.user.id);
        const created = await db.createPlannedChapter({
          projectId: input.projectId,
          userId: ctx.user.id,
          title: input.title,
          synopsis: input.synopsis || null,
        });
        if (!created) throw new TRPCError({ code: "NOT_FOUND" });
        return presentProjectStory(created);
      }),

    updateChapterPlanning: protectedProcedure
      .input(
        z.object({
          projectId: z.number().int().positive(),
          storyId: z.number().int().positive(),
          draftStatus: z.enum(CHAPTER_STATUSES),
          synopsis: z.string().trim().max(4_000).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await requireProject(input.projectId, ctx.user.id);
        const updated = await db.updateStoryPlanning(
          input.storyId,
          input.projectId,
          ctx.user.id,
          {
            draftStatus: input.draftStatus,
            synopsis: input.synopsis || null,
          }
        );
        if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
        return { success: true };
      }),

    reorderChapters: protectedProcedure
      .input(
        z.object({
          projectId: z.number().int().positive(),
          orderedStoryIds: z
            .array(z.number().int().positive())
            .max(500)
            .refine(
              values => new Set(values).size === values.length,
              "Chapter order cannot contain duplicate IDs."
            ),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await requireProject(input.projectId, ctx.user.id);
        const reordered = await db.reorderProjectStories(
          input.projectId,
          ctx.user.id,
          input.orderedStoryIds
        );
        if (!reordered) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Chapter order must contain every current project chapter.",
          });
        }
        return { success: true };
      }),

    createCanon: protectedProcedure
      .input(
        canonFieldsSchema.extend({ projectId: z.number().int().positive() })
      )
      .mutation(async ({ input, ctx }) => {
        await requireProject(input.projectId, ctx.user.id);
        return db.createCanonEntry({
          projectId: input.projectId,
          userId: ctx.user.id,
          kind: input.kind,
          name: input.name,
          content: input.content,
          activationKeys: JSON.stringify(input.activationKeys),
          alwaysInclude: input.alwaysInclude ? 1 : 0,
        });
      }),

    updateCanon: protectedProcedure
      .input(
        canonFieldsSchema.extend({
          id: z.number().int().positive(),
          projectId: z.number().int().positive(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await requireProject(input.projectId, ctx.user.id);
        const updated = await db.updateCanonEntry(
          input.id,
          input.projectId,
          ctx.user.id,
          {
            kind: input.kind,
            name: input.name,
            content: input.content,
            activationKeys: JSON.stringify(input.activationKeys),
            alwaysInclude: input.alwaysInclude ? 1 : 0,
          }
        );
        if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
        return { success: true };
      }),

    deleteCanon: protectedProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          projectId: z.number().int().positive(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await requireProject(input.projectId, ctx.user.id);
        const deleted = await db.deleteCanonEntry(
          input.id,
          input.projectId,
          ctx.user.id
        );
        if (!deleted) throw new TRPCError({ code: "NOT_FOUND" });
        return { success: true };
      }),

    previewContext: protectedProcedure
      .input(
        z.object({
          projectId: z.number().int().positive(),
          prompt: z.string().trim().max(1_000),
          selectedCanonIds: z
            .array(z.number().int().positive())
            .max(20)
            .default([]),
        })
      )
      .query(async ({ input, ctx }) => {
        const project = await requireProject(input.projectId, ctx.user.id);
        const canon = await db.getCanonEntries(project.id, ctx.user.id);
        return selectCanonContext(
          project,
          canon,
          input.prompt,
          input.selectedCanonIds
        );
      }),

    export: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input, ctx }) => {
        const project = await requireProject(input.id, ctx.user.id);
        const [stories, canon] = await Promise.all([
          db.getStoriesByProject(project.id, ctx.user.id),
          db.getCanonEntries(project.id, ctx.user.id),
        ]);
        const revisions = await Promise.all(
          stories.map(story => db.getStoryRevisions(story.id, ctx.user.id))
        );
        return {
          format: PROJECT_BACKUP_FORMAT,
          version: PROJECT_BACKUP_VERSION,
          exportedAt: new Date(),
          project: omitUserId(project),
          canon: canon.map(entry => ({
            ...omitUserId(entry),
            activationKeys: parseActivationKeys(entry.activationKeys),
            alwaysInclude: entry.alwaysInclude === 1,
          })),
          stories: stories.map((story, index) => ({
            ...omitUserId(presentStory(story)),
            projectId: project.id,
            revisions: revisions[index].map(omitUserId),
          })),
        };
      }),

    importBackup: protectedProcedure
      .input(z.object({ backup: projectBackupSchema }))
      .mutation(({ input, ctx }) =>
        db.importProjectBackup(input.backup, ctx.user.id)
      ),
  }),

  stories: router({
    generate: protectedProcedure
      .input(generationInputSchema)
      .mutation(async ({ input, ctx }) => {
        if (!claimGeneration(ctx.user.id)) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "A story is already being generated for this user.",
          });
        }
        try {
          if (await db.getActiveGenerationJob(ctx.user.id)) {
            throw new TRPCError({
              code: "TOO_MANY_REQUESTS",
              message: "A story is already being generated for this user.",
            });
          }
          return await generateAndPersistStory(input, ctx.user.id);
        } finally {
          releaseGeneration(ctx.user.id);
        }
      }),

    startGeneration: protectedProcedure
      .input(generationInputSchema)
      .mutation(({ input, ctx }) => startGeneration(input, ctx.user.id)),

    generationStatus: protectedProcedure
      .input(z.object({ jobId: z.string().trim().min(1).max(64) }))
      .query(({ input, ctx }) => getGenerationJob(input.jobId, ctx.user.id)),

    activeGeneration: protectedProcedure.query(({ ctx }) =>
      getActiveGenerationJob(ctx.user.id)
    ),

    cancelGeneration: protectedProcedure
      .input(z.object({ jobId: z.string().trim().min(1).max(64) }))
      .mutation(({ input, ctx }) => cancelGeneration(input.jobId, ctx.user.id)),

    list: protectedProcedure.query(async ({ ctx }) => {
      const allStories = await db.getAllStories(ctx.user.id);
      return allStories.map(story => ({
        id: story.id,
        title: story.title,
        prompt: story.prompt,
        ritualId: story.ritualId,
        wordCount: story.wordCount,
        qualityScore: story.qualityScore / 100,
        ethicalApproval: story.ethicalApproval === 1,
        ucfHarmony: story.ucfHarmony / 10_000,
        createdAt: story.createdAt,
        seriesId: story.seriesId,
        chapterNumber: story.chapterNumber,
        projectId: story.projectId,
        draftStatus: story.draftStatus,
        synopsis: story.synopsis,
      }));
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input, ctx }) => {
        const story = await db.getStoryById(input.id, ctx.user.id);
        return story ? presentStory(story) : null;
      }),

    getByRitualId: protectedProcedure
      .input(z.object({ ritualId: z.string().trim().min(1).max(128) }))
      .query(async ({ input, ctx }) => {
        const story = await db.getStoryByRitualId(input.ritualId, ctx.user.id);
        if (!story) return null;
        const nextChapter =
          story.seriesId && story.chapterNumber
            ? await db.getStoryBySeriesAndChapter(
                story.seriesId,
                story.chapterNumber + 1,
                ctx.user.id
              )
            : null;
        return { ...presentStory(story), hasNextChapter: Boolean(nextChapter) };
      }),

    prepareContinuation: protectedProcedure
      .input(
        z.object({
          previousStoryId: z.number().int().positive(),
          userPrompt: z.string().trim().max(500).optional(),
        })
      )
      .query(async ({ input, ctx }) => {
        const previousStory = await db.getStoryById(
          input.previousStoryId,
          ctx.user.id
        );
        if (!previousStory) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Previous story not found",
          });
        }

        const seriesId =
          previousStory.seriesId ||
          generateSeriesId(`story_${previousStory.id}`);
        const chapterNumber = (previousStory.chapterNumber || 1) + 1;

        const prompt = await generateContinuationPrompt({
          previousStory: {
            title: previousStory.title,
            content: previousStory.content,
            chapterNumber: previousStory.chapterNumber || 1,
          },
          userPrompt: input.userPrompt,
        });

        return {
          prompt,
          seriesId,
          chapterNumber,
          previousChapterId: previousStory.id,
          projectId: previousStory.projectId,
        };
      }),

    preparePlannedChapter: protectedProcedure
      .input(z.object({ targetStoryId: z.number().int().positive() }))
      .query(async ({ input, ctx }) => {
        const story = await db.getStoryById(input.targetStoryId, ctx.user.id);
        if (!story) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Planned chapter not found",
          });
        }
        if (!isDraftablePlannedChapter(story)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This chapter already has a draft.",
          });
        }

        const direction =
          story.synopsis?.trim() ||
          `Develop the chapter titled ${story.title}.`;
        const [project, previousStory] = await Promise.all([
          db.getProjectById(story.projectId!, ctx.user.id),
          story.previousChapterId
            ? db.getStoryById(story.previousChapterId, ctx.user.id)
            : Promise.resolve(null),
        ]);
        if (!project) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project not found",
          });
        }
        if (story.previousChapterId && !previousStory) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Previous chapter not found",
          });
        }
        const prompt = previousStory
          ? await generateContinuationPrompt({
              previousStory: {
                title: previousStory.title,
                content: previousStory.content,
                chapterNumber: previousStory.chapterNumber || 1,
              },
              seriesTitle: project.title,
              userPrompt: direction,
            })
          : `Write ${story.title} as chapter ${story.chapterNumber ?? 1}. ${direction} Establish a clear dramatic change, honor the project canon, and end with a meaningful decision.`;

        return {
          targetStoryId: story.id,
          title: story.title,
          prompt: prompt.slice(0, 1_000),
          projectId: story.projectId!,
          previousChapterId: story.previousChapterId,
        };
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          title: z.string().trim().min(1).max(255),
          content: z.string().max(500_000),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const existing = await db.getStoryById(input.id, ctx.user.id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
        if (
          existing.title === input.title &&
          existing.content === input.content
        ) {
          return { success: true, changed: false };
        }
        const wordCount = input.content.split(/\s+/).filter(Boolean).length;
        const updated = await db.updateStoryWithRevision(
          input.id,
          ctx.user.id,
          {
            title: input.title,
            content: input.content,
            wordCount,
            draftStatus:
              existing.draftStatus === "planned" && input.content.trim()
                ? "drafting"
                : existing.draftStatus,
          },
          "manual-edit"
        );
        if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
        return { success: true, changed: true, wordCount };
      }),

    revisions: protectedProcedure
      .input(z.object({ storyId: z.number().int().positive() }))
      .query(async ({ input, ctx }) => {
        const story = await db.getStoryById(input.storyId, ctx.user.id);
        if (!story) throw new TRPCError({ code: "NOT_FOUND" });
        return db.getStoryRevisions(input.storyId, ctx.user.id);
      }),

    restoreRevision: protectedProcedure
      .input(
        z.object({
          storyId: z.number().int().positive(),
          revisionId: z.number().int().positive(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const restored = await db.restoreStoryRevision(
          input.storyId,
          input.revisionId,
          ctx.user.id
        );
        if (!restored) throw new TRPCError({ code: "NOT_FOUND" });
        return { success: true };
      }),

    getSeriesStories: protectedProcedure
      .input(z.object({ seriesId: z.string().trim().min(1).max(128) }))
      .query(({ input, ctx }) =>
        db.getStoriesBySeries(input.seriesId, ctx.user.id)
      ),

    getUcfTrajectory: protectedProcedure
      .input(z.object({ ritualId: z.string().trim().min(1).max(128) }))
      .query(async ({ input, ctx }) => {
        const story = await db.getStoryByRitualId(input.ritualId, ctx.user.id);
        if (!story) throw new TRPCError({ code: "NOT_FOUND" });
        const states = await db.getUcfStatesByRitualId(input.ritualId);
        return states.map(state => ({
          step: state.step,
          harmony: state.harmony / 10_000,
          prana: state.prana / 10_000,
          drishti: state.drishti / 10_000,
          klesha: state.klesha / 10_000,
          resilience: state.resilience / 10_000,
          zoom: state.zoom / 10_000,
          timestamp: state.timestamp,
        }));
      }),

    getAgentLogs: protectedProcedure
      .input(z.object({ ritualId: z.string().trim().min(1).max(128) }))
      .query(async ({ input, ctx }) => {
        const story = await db.getStoryByRitualId(input.ritualId, ctx.user.id);
        if (!story) throw new TRPCError({ code: "NOT_FOUND" });
        return db.getAgentLogsByRitualId(input.ritualId);
      }),
  }),
});

export type AppRouter = typeof appRouter;

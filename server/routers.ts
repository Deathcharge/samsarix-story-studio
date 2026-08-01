import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { Story } from "../drizzle/schema";
import { getAllAgentConfigs, getAllPresetModes } from "./agentConfig";
import { parseActivationKeys, selectCanonContext } from "./canonContext";
import * as db from "./db";
import { enhancePrompt } from "./promptEnhancer";
import {
  generateContinuationPrompt,
  generateSeriesId,
} from "./storyContinuation";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { executeCreativeRitualMulti } from "./z88EngineMulti";

const providerSchema = z.enum([
  "openai",
  "anthropic",
  "xai",
  "google",
  "perplexity",
]);

const activeGenerations = new Set<number>();
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

function presentStory(story: Story) {
  return {
    ...story,
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
          stories: stories.map(story => ({
            id: story.id,
            title: story.title,
            prompt: story.prompt,
            ritualId: story.ritualId,
            wordCount: story.wordCount,
            createdAt: story.createdAt,
            updatedAt: story.updatedAt,
            seriesId: story.seriesId,
            chapterNumber: story.chapterNumber,
          })),
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
          format: "samsarix-project" as const,
          version: 1 as const,
          exportedAt: new Date(),
          project,
          canon: canon.map(entry => ({
            ...entry,
            activationKeys: parseActivationKeys(entry.activationKeys),
            alwaysInclude: entry.alwaysInclude === 1,
          })),
          stories: stories.map((story, index) => ({
            ...presentStory(story),
            revisions: revisions[index],
          })),
        };
      }),
  }),

  stories: router({
    generate: protectedProcedure
      .input(
        z.object({
          prompt: z.string().trim().min(10).max(1_000),
          preset: z
            .enum([
              "balanced",
              "creative",
              "structured",
              "experimental",
              "research",
            ])
            .default("balanced"),
          customAgents: z
            .array(
              z.object({
                agentId: z.string().trim().min(1).max(32),
                provider: providerSchema.optional(),
                temperature: z.number().min(0).max(1).optional(),
                enabled: z.boolean(),
              })
            )
            .max(7)
            .optional()
            .refine(
              agents =>
                !agents ||
                new Set(agents.map(agent => agent.agentId)).size ===
                  agents.length,
              "Agent IDs must be unique"
            ),
          seriesId: z.string().trim().min(1).max(128).optional(),
          chapterNumber: z.number().int().min(1).max(10_000).optional(),
          previousChapterId: z.number().int().positive().optional(),
          projectId: z.number().int().positive().optional(),
          selectedCanonIds: z
            .array(z.number().int().positive())
            .max(20)
            .default([]),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (activeGenerations.has(ctx.user.id)) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "A story is already being generated for this user.",
          });
        }

        activeGenerations.add(ctx.user.id);
        try {
          const previousStory = input.previousChapterId
            ? await db.getStoryById(input.previousChapterId, ctx.user.id)
            : undefined;
          if (input.previousChapterId && !previousStory) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Previous chapter not found",
            });
          }

          const projectId = input.projectId ?? previousStory?.projectId ?? null;
          if (
            previousStory?.projectId &&
            projectId !== previousStory.projectId
          ) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "A continuation must remain in its existing project.",
            });
          }

          const project = projectId
            ? await requireProject(projectId, ctx.user.id)
            : null;
          const canon = project
            ? await db.getCanonEntries(project.id, ctx.user.id)
            : [];
          const contextSelection = project
            ? selectCanonContext(
                project,
                canon,
                input.prompt,
                input.selectedCanonIds
              )
            : null;
          const projectStories = project
            ? await db.getStoriesByProject(project.id, ctx.user.id)
            : [];
          const seriesId = previousStory
            ? previousStory.seriesId ||
              generateSeriesId(`story_${previousStory.id}`)
            : project
              ? `project_${project.id}`
              : input.seriesId;
          const chapterNumber = previousStory
            ? (previousStory.chapterNumber ?? 1) + 1
            : project
              ? Math.max(
                  0,
                  ...projectStories.map(story => story.chapterNumber ?? 0)
                ) + 1
              : input.chapterNumber;

          const result = await executeCreativeRitualMulti(input.prompt, {
            preset: input.preset,
            context: contextSelection?.context,
            customAgents: input.customAgents
              ?.filter(agent => agent.enabled)
              .map(({ enabled: _enabled, ...agent }) => agent),
          });

          if (!result.success) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: result.error || "Story generation failed",
            });
          }

          await db.createStory({
            userId: ctx.user.id,
            projectId,
            title: result.title,
            prompt: input.prompt,
            content: result.storyText,
            ritualId: result.ritualId,
            wordCount: result.metadata.wordCount,
            qualityScore: Math.round(result.metadata.qualityScore * 100),
            ethicalApproval: result.metadata.ethicalApproval ? 1 : 0,
            ucfHarmony: Math.round(
              result.metadata.ucfSnapshot.harmony * 10_000
            ),
            ucfPrana: Math.round(result.metadata.ucfSnapshot.prana * 10_000),
            ucfDrishti: Math.round(
              result.metadata.ucfSnapshot.drishti * 10_000
            ),
            ucfKlesha: Math.round(result.metadata.ucfSnapshot.klesha * 10_000),
            ucfResilience: Math.round(
              result.metadata.ucfSnapshot.resilience * 10_000
            ),
            ucfZoom: Math.round(result.metadata.ucfSnapshot.zoom * 10_000),
            agentContributions: JSON.stringify(
              result.metadata.agentContributions
            ),
            seriesId,
            chapterNumber,
            previousChapterId: previousStory?.id,
          });

          if (previousStory && !previousStory.seriesId) {
            await db.updateStory(previousStory.id, ctx.user.id, {
              seriesId,
              chapterNumber: previousStory.chapterNumber ?? 1,
            });
          }

          return {
            ritualId: result.ritualId,
            title: result.title,
            storyText: result.storyText,
            metadata: result.metadata,
            projectId,
            contextSelection,
          };
        } finally {
          activeGenerations.delete(ctx.user.id);
        }
      }),

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

    update: protectedProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          title: z.string().trim().min(1).max(255),
          content: z.string().trim().min(1).max(500_000),
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
          { title: input.title, content: input.content, wordCount },
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

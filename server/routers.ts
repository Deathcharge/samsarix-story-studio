import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { Story } from "../drizzle/schema";
import { getAllAgentConfigs, getAllPresetModes } from "./agentConfig";
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
          const result = await executeCreativeRitualMulti(input.prompt, {
            preset: input.preset,
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
            seriesId: input.seriesId,
            chapterNumber: input.chapterNumber,
            previousChapterId: input.previousChapterId,
          });

          return {
            ritualId: result.ritualId,
            title: result.title,
            storyText: result.storyText,
            metadata: result.metadata,
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

    continueStory: protectedProcedure
      .input(
        z.object({
          previousStoryId: z.number().int().positive(),
          userPrompt: z.string().trim().max(500).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
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

        const seriesId = previousStory.seriesId || generateSeriesId();
        const chapterNumber = (previousStory.chapterNumber || 1) + 1;
        if (!previousStory.seriesId) {
          await db.updateStory(previousStory.id, ctx.user.id, {
            seriesId,
            chapterNumber: 1,
          });
        }

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
        };
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

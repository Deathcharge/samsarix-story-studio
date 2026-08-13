import { z } from "zod";

export const providerSchema = z.enum([
  "openai",
  "anthropic",
  "xai",
  "google",
  "perplexity",
]);

export const generationInputSchema = z
  .object({
    prompt: z.string().trim().min(10).max(1_000),
    preset: z
      .enum(["balanced", "creative", "structured", "experimental", "research"])
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
          new Set(agents.map(agent => agent.agentId)).size === agents.length,
        "Agent IDs must be unique"
      ),
    seriesId: z.string().trim().min(1).max(128).optional(),
    chapterNumber: z.number().int().min(1).max(10_000).optional(),
    previousChapterId: z.number().int().positive().optional(),
    targetStoryId: z.number().int().positive().optional(),
    projectId: z.number().int().positive().optional(),
    selectedCanonIds: z.array(z.number().int().positive()).max(20).default([]),
  })
  .refine(input => !(input.previousChapterId && input.targetStoryId), {
    message:
      "Choose either a planned chapter target or a new continuation, not both.",
    path: ["targetStoryId"],
  });

export type GenerationInput = z.infer<typeof generationInputSchema>;

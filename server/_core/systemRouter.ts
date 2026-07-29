import { router, publicProcedure } from "./trpc";
import { ENV } from "./env";
import * as db from "../db";
import {
  getConfiguredProviders,
  getModelForProvider,
  type LLMProvider,
} from "../llmRouter";

const ALL_PROVIDERS: LLMProvider[] = [
  "openai",
  "anthropic",
  "xai",
  "google",
  "perplexity",
];

export const systemRouter = router({
  health: publicProcedure.query(() => ({ ok: true })),
  status: publicProcedure.query(() => {
    const configuredProviders = getConfiguredProviders();
    return {
      mode:
        configuredProviders.length === 0
          ? ("demo" as const)
          : ("provider" as const),
      authMode: ENV.authMode,
      storageMode: db.getStorageMode(),
      configuredProviders,
      models: Object.fromEntries(
        ALL_PROVIDERS.map(provider => [provider, getModelForProvider(provider)])
      ) as Record<LLMProvider, string>,
      maxProviderCallsPerStory: 8,
      maxOutputTokensPerStory: 18_000,
    };
  }),
});

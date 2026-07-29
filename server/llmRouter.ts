import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";

export type LLMProvider =
  | "openai"
  | "anthropic"
  | "xai"
  | "google"
  | "perplexity";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface LLMResponse {
  content: string;
  provider: LLMProvider;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

const PROVIDER_KEYS: Record<LLMProvider, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  xai: "XAI_API_KEY",
  google: "GEMINI_API_KEY",
  perplexity: "SONAR_API_KEY",
};

const MODEL_KEYS: Record<LLMProvider, string> = {
  openai: "OPENAI_MODEL",
  anthropic: "ANTHROPIC_MODEL",
  xai: "XAI_MODEL",
  google: "GEMINI_MODEL",
  perplexity: "PERPLEXITY_MODEL",
};

export const DEFAULT_MODELS: Record<LLMProvider, string> = {
  openai: "gpt-4.1-mini",
  anthropic: "claude-sonnet-5",
  xai: "grok-4.5",
  google: "gemini-3.6-flash",
  perplexity: "sonar-pro",
};

function getTimeoutMs() {
  const parsed = Number(process.env.LLM_TIMEOUT_MS ?? 120_000);
  if (!Number.isFinite(parsed)) return 120_000;
  return Math.min(Math.max(Math.floor(parsed), 5_000), 300_000);
}

function getApiKey(provider: LLMProvider) {
  return process.env[PROVIDER_KEYS[provider]]?.trim() ?? "";
}

export function getConfiguredProviders(): LLMProvider[] {
  return (Object.keys(PROVIDER_KEYS) as LLMProvider[]).filter(
    provider => getApiKey(provider).length > 0
  );
}

export function getModelForProvider(provider: LLMProvider) {
  return process.env[MODEL_KEYS[provider]]?.trim() || DEFAULT_MODELS[provider];
}

export function resolveConfiguredProvider(preferred: LLMProvider) {
  if (getApiKey(preferred)) return preferred;
  return getConfiguredProviders()[0];
}

function requireApiKey(provider: LLMProvider) {
  const key = getApiKey(provider);
  if (!key) {
    throw new Error(
      `${provider} is not configured. Set ${PROVIDER_KEYS[provider]} or choose an available provider.`
    );
  }
  return key;
}

async function withTimeout<T>(promise: Promise<T>, provider: LLMProvider) {
  const timeoutMs = getTimeoutMs();
  let timeout: NodeJS.Timeout | undefined;
  const guard = new Promise<never>((_, reject) => {
    timeout = setTimeout(
      () =>
        reject(new Error(`${provider} request timed out after ${timeoutMs}ms`)),
      timeoutMs
    );
  });

  try {
    return await Promise.race([promise, guard]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function callLLM(
  provider: LLMProvider,
  messages: LLMMessage[],
  options: LLMOptions = {}
): Promise<LLMResponse> {
  if (options.stream) {
    throw new Error("Streaming is not supported by this release");
  }

  const temperature = Math.min(Math.max(options.temperature ?? 0.7, 0), 1);
  const maxTokens = Math.min(Math.max(options.maxTokens ?? 2_000, 1), 4_000);
  if (!getApiKey(provider)) {
    throw new Error(
      `${provider} is not configured. Set ${PROVIDER_KEYS[provider]} or choose an available provider.`
    );
  }

  try {
    switch (provider) {
      case "openai":
        return await callOpenAI(provider, messages, temperature, maxTokens);
      case "anthropic":
        return await callAnthropic(messages, temperature, maxTokens);
      case "xai":
        return await callOpenAI(provider, messages, temperature, maxTokens);
      case "google":
        return await callGemini(messages, temperature, maxTokens);
      case "perplexity":
        return await callOpenAI(provider, messages, temperature, maxTokens);
    }
  } catch (error) {
    const status =
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      typeof error.status === "number"
        ? error.status
        : undefined;
    if (status === 401 || status === 403) {
      throw new Error(`${provider} rejected the configured credentials.`);
    }
    if (status === 404) {
      throw new Error(
        `${provider} could not use the configured model. Check the model override.`
      );
    }
    if (status === 429) {
      throw new Error(
        `${provider} rate limit or quota was reached. Try again later.`
      );
    }
    if (error instanceof Error && error.message.includes("timed out after")) {
      throw new Error(error.message);
    }
    throw new Error(
      `${provider} request failed. Check provider status, connectivity, and model configuration.`
    );
  }
}

async function callOpenAI(
  provider: "openai" | "xai" | "perplexity",
  messages: LLMMessage[],
  temperature: number,
  maxTokens: number
): Promise<LLMResponse> {
  const baseURL =
    provider === "xai"
      ? "https://api.x.ai/v1"
      : provider === "perplexity"
        ? "https://api.perplexity.ai"
        : process.env.OPENAI_BASE_URL?.trim() || undefined;
  const client = new OpenAI({
    apiKey: requireApiKey(provider),
    baseURL,
    maxRetries: 1,
    timeout: getTimeoutMs(),
  });
  const model = getModelForProvider(provider);
  const response = await client.chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  });
  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("Provider returned no text content");

  return {
    content,
    provider,
    model: response.model,
    usage: {
      promptTokens: response.usage?.prompt_tokens ?? 0,
      completionTokens: response.usage?.completion_tokens ?? 0,
      totalTokens: response.usage?.total_tokens ?? 0,
    },
  };
}

async function callAnthropic(
  messages: LLMMessage[],
  temperature: number,
  maxTokens: number
): Promise<LLMResponse> {
  const client = new Anthropic({
    apiKey: requireApiKey("anthropic"),
    maxRetries: 1,
    timeout: getTimeoutMs(),
  });
  const system = messages.find(message => message.role === "system")?.content;
  const conversation = messages
    .filter(message => message.role !== "system")
    .map(message => ({
      role:
        message.role === "assistant"
          ? ("assistant" as const)
          : ("user" as const),
      content: message.content,
    }));
  const model = getModelForProvider("anthropic");
  const response = await client.messages.create({
    model,
    system,
    messages: conversation,
    temperature,
    max_tokens: maxTokens,
  });
  const content = response.content.find(part => part.type === "text");
  if (!content || content.type !== "text") {
    throw new Error("Provider returned no text content");
  }

  return {
    content: content.text,
    provider: "anthropic",
    model: response.model,
    usage: {
      promptTokens: response.usage.input_tokens,
      completionTokens: response.usage.output_tokens,
      totalTokens: response.usage.input_tokens + response.usage.output_tokens,
    },
  };
}

async function callGemini(
  messages: LLMMessage[],
  temperature: number,
  maxTokens: number
): Promise<LLMResponse> {
  const client = new GoogleGenerativeAI(requireApiKey("google"));
  const modelName = getModelForProvider("google");
  const systemInstruction = messages.find(
    message => message.role === "system"
  )?.content;
  const conversation = messages.filter(message => message.role !== "system");
  const model = client.getGenerativeModel({
    model: modelName,
    systemInstruction,
    generationConfig: { temperature, maxOutputTokens: maxTokens },
  });
  const chat = model.startChat({
    history: conversation.slice(0, -1).map(message => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    })),
  });
  const lastMessage = conversation.at(-1);
  if (!lastMessage) throw new Error("A user message is required");
  const result = await withTimeout(
    chat.sendMessage(lastMessage.content),
    "google"
  );
  const response = result.response;

  return {
    content: response.text(),
    provider: "google",
    model: modelName,
    usage: {
      promptTokens: response.usageMetadata?.promptTokenCount ?? 0,
      completionTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
      totalTokens: response.usageMetadata?.totalTokenCount ?? 0,
    },
  };
}

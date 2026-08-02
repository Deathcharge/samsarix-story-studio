import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import type { GenerationJob } from "../drizzle/schema";
import {
  GENERATION_STAGE_LABELS,
  isTerminalGenerationStatus,
  type GenerationStage,
} from "../shared/generationLifecycle";
import * as db from "./db";
import type { GenerationInput } from "./generationInput";
import { claimGeneration, releaseGeneration } from "./generationLock";
import { generateAndPersistStory } from "./generationService";
import { getConfiguredProviders } from "./llmRouter";

type Listener = (job: PublicGenerationJob) => void;

const controllers = new Map<string, AbortController>();
const listeners = new Map<string, Set<Listener>>();

export type PublicGenerationJob = Omit<GenerationJob, "userId">;

export function presentGenerationJob(job: GenerationJob): PublicGenerationJob {
  const { userId: _userId, ...visible } = job;
  return visible;
}

function publish(job: GenerationJob) {
  const visible = presentGenerationJob(job);
  const jobListeners = listeners.get(job.id);
  for (const listener of jobListeners ?? []) {
    try {
      listener(visible);
    } catch {
      jobListeners?.delete(listener);
    }
  }
  if (jobListeners?.size === 0) listeners.delete(job.id);
}

function safeErrorMessage(error: unknown) {
  if (error instanceof TRPCError) return error.message.slice(0, 512);
  return "The draft could not be completed. Check local storage and provider configuration, then try again.";
}

async function updateStage(
  jobId: string,
  userId: number,
  stage: GenerationStage,
  progress: number
) {
  const job = await db.updateGenerationJob(jobId, userId, {
    status: "running",
    stage,
    stageLabel: GENERATION_STAGE_LABELS[stage],
    progress,
  });
  if (job) publish(job);
}

async function executeGeneration(
  jobId: string,
  input: GenerationInput,
  userId: number,
  controller: AbortController
) {
  try {
    await updateStage(jobId, userId, "preparing", 3);
    const result = await generateAndPersistStory(input, userId, {
      signal: controller.signal,
      onStage: (stage, progress) => updateStage(jobId, userId, stage, progress),
    });
    const completedAt = new Date();
    const job = await db.updateGenerationJob(jobId, userId, {
      status: "succeeded",
      stage: "completed",
      stageLabel: GENERATION_STAGE_LABELS.completed,
      progress: 100,
      storyId: result.storyId,
      ritualId: result.ritualId,
      projectId: result.projectId,
      completedAt,
      errorMessage: null,
    });
    if (job) publish(job);
  } catch (error) {
    const cancelled = controller.signal.aborted;
    const completedAt = new Date();
    const job = await db.updateGenerationJob(jobId, userId, {
      status: cancelled ? "cancelled" : "failed",
      stageLabel: cancelled ? "Generation cancelled" : "Generation failed",
      cancelRequested: cancelled ? 1 : 0,
      errorMessage: cancelled ? null : safeErrorMessage(error),
      completedAt,
    });
    if (job) publish(job);
  } finally {
    controllers.delete(jobId);
    releaseGeneration(userId);
  }
}

export async function startGeneration(input: GenerationInput, userId: number) {
  if (!claimGeneration(userId)) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "A story is already being generated for this user.",
    });
  }

  try {
    if (await db.getActiveGenerationJob(userId)) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "A story is already being generated for this user.",
      });
    }
    const id = `gen_${randomUUID()}`;
    const controller = new AbortController();
    controllers.set(id, controller);
    const job = await db.createGenerationJob({
      id,
      userId,
      projectId: input.projectId ?? null,
      mode: getConfiguredProviders().length > 0 ? "provider" : "demo",
      status: "queued",
      stage: "queued",
      stageLabel: GENERATION_STAGE_LABELS.queued,
      progress: 0,
    });
    queueMicrotask(() => void executeGeneration(id, input, userId, controller));
    return presentGenerationJob(job);
  } catch (error) {
    releaseGeneration(userId);
    throw error;
  }
}

export async function getGenerationJob(jobId: string, userId: number) {
  const job = await db.getGenerationJob(jobId, userId);
  return job ? presentGenerationJob(job) : null;
}

export async function getActiveGenerationJob(userId: number) {
  const job = await db.getActiveGenerationJob(userId);
  return job ? presentGenerationJob(job) : null;
}

export async function cancelGeneration(jobId: string, userId: number) {
  const current = await db.getGenerationJob(jobId, userId);
  if (!current) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Generation not found" });
  }
  if (isTerminalGenerationStatus(current.status)) {
    return presentGenerationJob(current);
  }
  const controller = controllers.get(jobId);
  const job = await db.updateGenerationJob(jobId, userId, {
    status: controller ? "cancelling" : "interrupted",
    stageLabel: controller
      ? "Cancelling the active generation request"
      : "Generation process is no longer available",
    cancelRequested: 1,
    completedAt: controller ? null : new Date(),
    errorMessage: controller
      ? null
      : "The generation process could not be resumed.",
  });
  if (job) publish(job);
  controller?.abort(new DOMException("Generation cancelled", "AbortError"));
  return job ? presentGenerationJob(job) : null;
}

export function subscribeToGeneration(jobId: string, listener: Listener) {
  const jobListeners = listeners.get(jobId) ?? new Set<Listener>();
  jobListeners.add(listener);
  listeners.set(jobId, jobListeners);
  return () => {
    jobListeners.delete(listener);
    if (jobListeners.size === 0) listeners.delete(jobId);
  };
}

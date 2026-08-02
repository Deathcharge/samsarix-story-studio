import { TRPCError } from "@trpc/server";
import type { GenerationStage } from "../shared/generationLifecycle";
import { selectCanonContext } from "./canonContext";
import * as db from "./db";
import type { GenerationInput } from "./generationInput";
import { generateSeriesId } from "./storyContinuation";
import { executeCreativeRitualMulti } from "./z88EngineMulti";

type GenerationCallbacks = {
  signal?: AbortSignal;
  onStage?: (stage: GenerationStage, progress: number) => void | Promise<void>;
};

export async function generateAndPersistStory(
  input: GenerationInput,
  userId: number,
  callbacks: GenerationCallbacks = {}
) {
  callbacks.signal?.throwIfAborted();
  const previousStory = input.previousChapterId
    ? await db.getStoryById(input.previousChapterId, userId)
    : undefined;
  if (input.previousChapterId && !previousStory) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Previous chapter not found",
    });
  }

  const projectId = input.projectId ?? previousStory?.projectId ?? null;
  if (previousStory?.projectId && projectId !== previousStory.projectId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "A continuation must remain in its existing project.",
    });
  }

  const project = projectId ? await db.getProjectById(projectId, userId) : null;
  if (projectId && !project) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
  }
  const canon = project ? await db.getCanonEntries(project.id, userId) : [];
  const contextSelection = project
    ? selectCanonContext(project, canon, input.prompt, input.selectedCanonIds)
    : null;
  const projectStories = project
    ? await db.getStoriesByProject(project.id, userId)
    : [];
  // Blank planned chapters are structural predecessors in the manuscript.
  const previousProjectChapter = previousStory ?? projectStories.at(-1);
  const seriesId = previousProjectChapter
    ? previousProjectChapter.seriesId ||
      generateSeriesId(`story_${previousProjectChapter.id}`)
    : project
      ? `project_${project.id}`
      : input.seriesId;
  const chapterNumber = previousProjectChapter
    ? (previousProjectChapter.chapterNumber ?? 1) + 1
    : project
      ? Math.max(0, ...projectStories.map(story => story.chapterNumber ?? 0)) +
        1
      : input.chapterNumber;

  const result = await executeCreativeRitualMulti(input.prompt, {
    preset: input.preset,
    context: contextSelection?.context,
    customAgents: input.customAgents
      ?.filter(agent => agent.enabled)
      .map(({ enabled: _enabled, ...agent }) => agent),
    signal: callbacks.signal,
    onStage: callbacks.onStage,
  });
  if (!result.success) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: result.error || "Story generation failed",
    });
  }

  callbacks.signal?.throwIfAborted();
  await callbacks.onStage?.("saving", 96);
  callbacks.signal?.throwIfAborted();
  await db.createStory({
    userId,
    projectId,
    title: result.title,
    prompt: input.prompt,
    content: result.storyText,
    ritualId: result.ritualId,
    wordCount: result.metadata.wordCount,
    qualityScore: Math.round(result.metadata.qualityScore * 100),
    ethicalApproval: result.metadata.ethicalApproval ? 1 : 0,
    ucfHarmony: Math.round(result.metadata.ucfSnapshot.harmony * 10_000),
    ucfPrana: Math.round(result.metadata.ucfSnapshot.prana * 10_000),
    ucfDrishti: Math.round(result.metadata.ucfSnapshot.drishti * 10_000),
    ucfKlesha: Math.round(result.metadata.ucfSnapshot.klesha * 10_000),
    ucfResilience: Math.round(result.metadata.ucfSnapshot.resilience * 10_000),
    ucfZoom: Math.round(result.metadata.ucfSnapshot.zoom * 10_000),
    agentContributions: JSON.stringify(result.metadata.agentContributions),
    seriesId,
    chapterNumber,
    previousChapterId: previousProjectChapter?.id,
  });

  if (previousProjectChapter && !previousProjectChapter.seriesId) {
    await db.updateStory(previousProjectChapter.id, userId, {
      seriesId,
      chapterNumber: previousProjectChapter.chapterNumber ?? 1,
    });
  }
  const story = await db.getStoryByRitualId(result.ritualId, userId);
  if (!story) throw new Error("Generated story was not available after saving");

  return {
    ritualId: result.ritualId,
    storyId: story.id,
    title: result.title,
    storyText: result.storyText,
    metadata: result.metadata,
    projectId,
    contextSelection,
  };
}

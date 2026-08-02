import { TRPCError } from "@trpc/server";
import type { GenerationStage } from "../shared/generationLifecycle";
import { selectCanonContext } from "./canonContext";
import * as db from "./db";
import type { GenerationInput } from "./generationInput";
import { isDraftablePlannedChapter } from "./plannedChapter";
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
  const targetStory = input.targetStoryId
    ? await db.getStoryById(input.targetStoryId, userId)
    : undefined;
  if (input.targetStoryId && !targetStory) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Planned chapter not found",
    });
  }
  if (targetStory && !isDraftablePlannedChapter(targetStory)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "This chapter already has a draft and cannot be generated over.",
    });
  }

  const previousChapterId =
    targetStory?.previousChapterId ?? input.previousChapterId;
  const previousStory = previousChapterId
    ? await db.getStoryById(previousChapterId, userId)
    : undefined;
  if (previousChapterId && !previousStory) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Previous chapter not found",
    });
  }

  const inferredProjectId = targetStory?.projectId ?? previousStory?.projectId;
  if (
    input.projectId &&
    inferredProjectId &&
    input.projectId !== inferredProjectId
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "The selected chapter does not belong to this project.",
    });
  }
  const projectId = inferredProjectId ?? input.projectId ?? null;
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
  const previousProjectChapter = targetStory
    ? previousStory
    : (previousStory ?? projectStories.at(-1));
  const seriesId =
    targetStory?.seriesId ??
    (previousProjectChapter
      ? previousProjectChapter.seriesId ||
        generateSeriesId(`story_${previousProjectChapter.id}`)
      : project
        ? `project_${project.id}`
        : input.seriesId);
  const chapterNumber =
    targetStory?.chapterNumber ??
    (previousProjectChapter
      ? (previousProjectChapter.chapterNumber ?? 1) + 1
      : project
        ? Math.max(
            0,
            ...projectStories.map(story => story.chapterNumber ?? 0)
          ) + 1
        : input.chapterNumber);

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
  const completion = {
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
    draftStatus: "drafting" as const,
  };
  const story = targetStory
    ? await db.completePlannedChapter(targetStory.id, userId, completion)
    : await db.createStory({
        userId,
        projectId,
        title: result.title,
        ...completion,
        seriesId,
        chapterNumber,
        previousChapterId: previousProjectChapter?.id,
      });
  if (!story) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "The planned chapter changed before this draft could be saved.",
    });
  }

  if (previousProjectChapter && !previousProjectChapter.seriesId) {
    try {
      await db.updateStory(previousProjectChapter.id, userId, {
        seriesId,
        chapterNumber: previousProjectChapter.chapterNumber ?? 1,
      });
    } catch (error) {
      console.warn(
        "Draft saved, but the prior chapter series metadata could not be updated",
        error
      );
    }
  }

  return {
    ritualId: result.ritualId,
    storyId: story.id,
    title: story.title,
    storyText: result.storyText,
    metadata: result.metadata,
    projectId,
    contextSelection,
  };
}

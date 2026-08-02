import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  agentLogs,
  canonEntries,
  generationJobs,
  type InsertAgentLog,
  type InsertCanonEntry,
  type InsertGenerationJob,
  type InsertProject,
  type InsertStory,
  type InsertStoryRevision,
  type InsertUcfState,
  type InsertUser,
  projects,
  stories,
  storyRevisions,
  ucfStates,
  users,
} from "../drizzle/schema";
import type { ProjectBackup } from "../shared/projectBackup";
import type { ChapterStatus } from "../shared/chapterPlanning";
import { isTerminalGenerationStatus } from "../shared/generationLifecycle";
import * as localStore from "./localStore";
import { prepareProjectImport } from "./projectImport";

let database: ReturnType<typeof drizzle> | null = null;

function chapterNumberOrderCase(orderedStoryIds: number[]) {
  const cases = orderedStoryIds.map(
    (id, index) => sql`WHEN ${stories.id} = ${id} THEN ${index + 1}`
  );
  return sql`CASE ${sql.join(cases, sql.raw(" "))} ELSE ${stories.chapterNumber} END`;
}

function previousChapterOrderCase(orderedStoryIds: number[]) {
  const cases = orderedStoryIds.map(
    (id, index) =>
      sql`WHEN ${stories.id} = ${id} THEN ${index === 0 ? null : orderedStoryIds[index - 1]}`
  );
  return sql`CASE ${sql.join(cases, sql.raw(" "))} ELSE ${stories.previousChapterId} END`;
}

export function getStorageMode() {
  return process.env.DATABASE_URL ? "mysql" : "local-file";
}

export function getLocalDataPath() {
  return getStorageMode() === "local-file"
    ? localStore.getLocalDataPath()
    : null;
}

export async function getDb() {
  if (!database && process.env.DATABASE_URL) {
    database = drizzle(process.env.DATABASE_URL);
  }
  return database;
}

async function requireDb() {
  const connection = await getDb();
  if (!connection) {
    throw new Error("MySQL storage is not configured");
  }
  return connection;
}

export async function getLocalUser() {
  if (getStorageMode() === "local-file") return localStore.getLocalUser();

  const openId = "local-writer";
  await upsertUser({
    openId,
    name: process.env.LOCAL_USER_NAME?.trim() || "Local Writer",
    loginMethod: "local",
    role: "admin",
    lastSignedIn: new Date(),
  });
  const user = await getUserByOpenId(openId);
  if (!user) throw new Error("Could not initialize the local MySQL user");
  return user;
}

export async function recoverInterruptedGenerationJobs() {
  if (getStorageMode() === "local-file") {
    // Loading the local store performs the recovery atomically.
    await localStore.getLocalUser();
    return;
  }
  const now = new Date();
  await (
    await requireDb()
  )
    .update(generationJobs)
    .set({
      status: "interrupted",
      stage: "interrupted",
      stageLabel: "Generation stopped when the local server restarted",
      errorMessage: "The local server restarted before this draft finished.",
      completedAt: now,
      updatedAt: now,
    })
    .where(inArray(generationJobs.status, ["queued", "running", "cancelling"]));
}

export async function createGenerationJob(input: InsertGenerationJob) {
  if (getStorageMode() === "local-file") {
    return localStore.createGenerationJob(input);
  }
  const connection = await requireDb();
  await connection.insert(generationJobs).values(input);
  const created = await getGenerationJob(input.id, input.userId);
  if (!created)
    throw new Error("Generation job was not available after creation");
  return created;
}

export async function getGenerationJob(id: string, userId: number) {
  if (getStorageMode() === "local-file") {
    return localStore.getGenerationJob(id, userId);
  }
  const result = await (
    await requireDb()
  )
    .select()
    .from(generationJobs)
    .where(and(eq(generationJobs.id, id), eq(generationJobs.userId, userId)))
    .limit(1);
  return result[0];
}

export async function getActiveGenerationJob(userId: number) {
  if (getStorageMode() === "local-file") {
    return localStore.getActiveGenerationJob(userId);
  }
  const result = await (
    await requireDb()
  )
    .select()
    .from(generationJobs)
    .where(
      and(
        eq(generationJobs.userId, userId),
        inArray(generationJobs.status, ["queued", "running", "cancelling"])
      )
    )
    .orderBy(desc(generationJobs.createdAt))
    .limit(1);
  return result[0];
}

export async function updateGenerationJob(
  id: string,
  userId: number,
  data: Partial<InsertGenerationJob>
) {
  if (getStorageMode() === "local-file") {
    return localStore.updateGenerationJob(id, userId, data);
  }
  const connection = await requireDb();
  await connection
    .update(generationJobs)
    .set(data)
    .where(and(eq(generationJobs.id, id), eq(generationJobs.userId, userId)));
  if (
    typeof data.status === "string" &&
    isTerminalGenerationStatus(data.status)
  ) {
    try {
      const terminal = await connection
        .select({ id: generationJobs.id })
        .from(generationJobs)
        .where(
          and(
            eq(generationJobs.userId, userId),
            inArray(generationJobs.status, [
              "succeeded",
              "failed",
              "cancelled",
              "interrupted",
            ])
          )
        )
        .orderBy(desc(generationJobs.createdAt));
      if (terminal.length > 100) {
        await connection.delete(generationJobs).where(
          inArray(
            generationJobs.id,
            terminal.slice(100).map(job => job.id)
          )
        );
      }
    } catch (error) {
      console.warn("Could not prune completed generation metadata", error);
    }
  }
  return getGenerationJob(id, userId);
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  if (getStorageMode() === "local-file") return localStore.upsertUser(user);

  const connection = await requireDb();
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  for (const field of ["name", "email", "loginMethod"] as const) {
    const value = user[field];
    if (value === undefined) continue;
    values[field] = value ?? null;
    updateSet[field] = value ?? null;
  }

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  }

  values.lastSignedIn ??= new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await connection.insert(users).values(values).onDuplicateKeyUpdate({
    set: updateSet,
  });
}

export async function getUserByOpenId(openId: string) {
  if (getStorageMode() === "local-file") {
    return localStore.getUserByOpenId(openId);
  }
  const connection = await requireDb();
  const result = await connection
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);
  return result[0];
}

export async function createProject(project: InsertProject) {
  if (getStorageMode() === "local-file") {
    return localStore.createProject(project);
  }
  const connection = await requireDb();
  const result = await connection.insert(projects).values(project);
  const id = Number(result[0].insertId);
  const created = await getProjectById(id, project.userId);
  if (!created) throw new Error("Project was not available after creation");
  return created;
}

export async function getAllProjects(userId: number) {
  if (getStorageMode() === "local-file") {
    return localStore.getAllProjects(userId);
  }
  return (await requireDb())
    .select()
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(desc(projects.updatedAt));
}

export async function getProjectById(id: number, userId: number) {
  if (getStorageMode() === "local-file") {
    return localStore.getProjectById(id, userId);
  }
  const result = await (
    await requireDb()
  )
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .limit(1);
  return result[0];
}

export async function updateProject(
  id: number,
  userId: number,
  data: Partial<InsertProject>
) {
  if (getStorageMode() === "local-file") {
    return localStore.updateProject(id, userId, data);
  }
  const result = await (
    await requireDb()
  )
    .update(projects)
    .set(data)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)));
  return result[0].affectedRows > 0;
}

export async function createPlannedChapter(input: {
  projectId: number;
  userId: number;
  title: string;
  synopsis: string | null;
}) {
  const ritualId = `plan_${randomUUID()}`;
  if (getStorageMode() === "local-file") {
    return localStore.createPlannedChapter({ ...input, ritualId });
  }

  const connection = await requireDb();
  return connection.transaction(async transaction => {
    const project = await transaction
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(eq(projects.id, input.projectId), eq(projects.userId, input.userId))
      )
      .limit(1);
    if (!project[0]) return null;

    const existingStories = await transaction
      .select({ id: stories.id })
      .from(stories)
      .where(
        and(
          eq(stories.projectId, input.projectId),
          eq(stories.userId, input.userId),
          isNull(stories.deletedAt)
        )
      )
      .orderBy(asc(stories.chapterNumber), asc(stories.createdAt));
    const inserted = await transaction.insert(stories).values({
      userId: input.userId,
      projectId: input.projectId,
      title: input.title,
      prompt: input.synopsis || `Planned chapter: ${input.title}`,
      content: "",
      ritualId,
      wordCount: 0,
      qualityScore: 0,
      ethicalApproval: 1,
      ucfHarmony: 0,
      ucfPrana: 0,
      ucfDrishti: 0,
      ucfKlesha: 0,
      ucfResilience: 0,
      ucfZoom: 0,
      agentContributions: "[]",
      seriesId: `project_${input.projectId}`,
      draftStatus: "planned",
      synopsis: input.synopsis,
    });
    const storyId = Number(inserted[0].insertId);
    const orderedIds = [...existingStories.map(story => story.id), storyId];
    await transaction
      .update(stories)
      .set({
        seriesId: `project_${input.projectId}`,
        chapterNumber: chapterNumberOrderCase(orderedIds),
        previousChapterId: previousChapterOrderCase(orderedIds),
      })
      .where(
        and(
          inArray(stories.id, orderedIds),
          eq(stories.projectId, input.projectId),
          eq(stories.userId, input.userId),
          isNull(stories.deletedAt)
        )
      );
    await transaction
      .update(projects)
      .set({ updatedAt: new Date() })
      .where(eq(projects.id, input.projectId));
    const created = await transaction
      .select()
      .from(stories)
      .where(eq(stories.id, storyId))
      .limit(1);
    return created[0] ?? null;
  });
}

export async function updateStoryPlanning(
  id: number,
  projectId: number,
  userId: number,
  data: { draftStatus: ChapterStatus; synopsis: string | null }
) {
  if (getStorageMode() === "local-file") {
    return localStore.updateStoryPlanning(id, projectId, userId, data);
  }
  const connection = await requireDb();
  return connection.transaction(async transaction => {
    const result = await transaction
      .update(stories)
      .set(data)
      .where(
        and(
          eq(stories.id, id),
          eq(stories.projectId, projectId),
          eq(stories.userId, userId),
          isNull(stories.deletedAt)
        )
      );
    if (result[0].affectedRows === 0) return false;
    await transaction
      .update(projects)
      .set({ updatedAt: new Date() })
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
    return true;
  });
}

export async function reorderProjectStories(
  projectId: number,
  userId: number,
  orderedStoryIds: number[]
) {
  if (getStorageMode() === "local-file") {
    return localStore.reorderProjectStories(projectId, userId, orderedStoryIds);
  }

  const connection = await requireDb();
  return connection.transaction(async transaction => {
    const project = await transaction
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .limit(1);
    if (!project[0]) return false;

    const projectStories = await transaction
      .select({ id: stories.id })
      .from(stories)
      .where(
        and(
          eq(stories.projectId, projectId),
          eq(stories.userId, userId),
          isNull(stories.deletedAt)
        )
      );
    if (
      projectStories.length !== orderedStoryIds.length ||
      new Set(orderedStoryIds).size !== orderedStoryIds.length
    ) {
      return false;
    }
    const projectStoryIds = new Set(projectStories.map(story => story.id));
    if (orderedStoryIds.some(id => !projectStoryIds.has(id))) return false;

    if (orderedStoryIds.length > 0) {
      await transaction
        .update(stories)
        .set({
          seriesId: `project_${projectId}`,
          chapterNumber: chapterNumberOrderCase(orderedStoryIds),
          previousChapterId: previousChapterOrderCase(orderedStoryIds),
        })
        .where(
          and(
            inArray(stories.id, orderedStoryIds),
            eq(stories.projectId, projectId),
            eq(stories.userId, userId),
            isNull(stories.deletedAt)
          )
        );
    }
    await transaction
      .update(projects)
      .set({ updatedAt: new Date() })
      .where(eq(projects.id, projectId));
    return true;
  });
}

export async function importProjectBackup(
  backup: ProjectBackup,
  userId: number
) {
  const plan = prepareProjectImport(backup);
  if (getStorageMode() === "local-file") {
    return localStore.importProject(plan, userId);
  }

  const connection = await requireDb();
  return connection.transaction(async transaction => {
    const projectResult = await transaction
      .insert(projects)
      .values({ userId, ...plan.project });
    const projectId = Number(projectResult[0].insertId);

    if (plan.canon.length > 0) {
      await transaction
        .insert(canonEntries)
        .values(plan.canon.map(entry => ({ projectId, userId, ...entry })));
    }

    const storyIds = new Map<number, number>();
    const revisionRows: InsertStoryRevision[] = [];
    for (const story of plan.stories) {
      const storyResult = await transaction.insert(stories).values({
        userId,
        projectId,
        previousChapterId: null,
        ...story.values,
      });
      storyIds.set(story.sourceId, Number(storyResult[0].insertId));
    }

    for (const story of plan.stories) {
      const storyId = storyIds.get(story.sourceId);
      if (!storyId) throw new Error("Imported story mapping was lost");
      if (story.previousSourceId) {
        const previousChapterId = storyIds.get(story.previousSourceId);
        if (!previousChapterId) {
          throw new Error("Imported previous chapter mapping was lost");
        }
        await transaction
          .update(stories)
          .set({ previousChapterId })
          .where(
            and(
              eq(stories.id, storyId),
              eq(stories.projectId, projectId),
              eq(stories.userId, userId)
            )
          );
      }
      for (const revision of story.revisions) {
        revisionRows.push({ storyId, userId, ...revision });
      }
    }

    if (revisionRows.length > 0) {
      await transaction.insert(storyRevisions).values(revisionRows);
    }

    return {
      projectId,
      ...plan.summary,
    };
  });
}

export async function createCanonEntry(input: InsertCanonEntry) {
  if (getStorageMode() === "local-file") {
    return localStore.createCanonEntry(input);
  }
  const connection = await requireDb();
  const result = await connection.insert(canonEntries).values(input);
  const created = await connection
    .select()
    .from(canonEntries)
    .where(
      and(
        eq(canonEntries.id, Number(result[0].insertId)),
        eq(canonEntries.userId, input.userId)
      )
    )
    .limit(1);
  if (!created[0])
    throw new Error("Canon entry was not available after creation");
  return created[0];
}

export async function getCanonEntries(projectId: number, userId: number) {
  if (getStorageMode() === "local-file") {
    return localStore.getCanonEntries(projectId, userId);
  }
  return (await requireDb())
    .select()
    .from(canonEntries)
    .where(
      and(
        eq(canonEntries.projectId, projectId),
        eq(canonEntries.userId, userId)
      )
    )
    .orderBy(asc(canonEntries.name));
}

export async function updateCanonEntry(
  id: number,
  projectId: number,
  userId: number,
  data: Partial<InsertCanonEntry>
) {
  if (getStorageMode() === "local-file") {
    return localStore.updateCanonEntry(id, projectId, userId, data);
  }
  const result = await (
    await requireDb()
  )
    .update(canonEntries)
    .set(data)
    .where(
      and(
        eq(canonEntries.id, id),
        eq(canonEntries.projectId, projectId),
        eq(canonEntries.userId, userId)
      )
    );
  return result[0].affectedRows > 0;
}

export async function deleteCanonEntry(
  id: number,
  projectId: number,
  userId: number
) {
  if (getStorageMode() === "local-file") {
    return localStore.deleteCanonEntry(id, projectId, userId);
  }
  const result = await (await requireDb())
    .delete(canonEntries)
    .where(
      and(
        eq(canonEntries.id, id),
        eq(canonEntries.projectId, projectId),
        eq(canonEntries.userId, userId)
      )
    );
  return result[0].affectedRows > 0;
}

export async function createStory(story: InsertStory) {
  if (getStorageMode() === "local-file") return localStore.createStory(story);
  if (story.userId == null) throw new Error("Story ownership is required");
  const userId = story.userId;
  const connection = await requireDb();
  return connection.transaction(async transaction => {
    const result = await transaction.insert(stories).values(story);
    if (story.projectId) {
      await transaction
        .update(projects)
        .set({ updatedAt: new Date() })
        .where(
          and(eq(projects.id, story.projectId), eq(projects.userId, userId))
        );
    }
    const created = await transaction
      .select()
      .from(stories)
      .where(
        and(
          eq(stories.id, Number(result[0].insertId)),
          eq(stories.userId, userId)
        )
      )
      .limit(1);
    if (!created[0]) throw new Error("Story was not available after creation");
    return created[0];
  });
}

export async function getStoryById(id: number, userId: number) {
  if (getStorageMode() === "local-file") {
    return localStore.getStoryById(id, userId);
  }
  const result = await (
    await requireDb()
  )
    .select()
    .from(stories)
    .where(
      and(
        eq(stories.id, id),
        eq(stories.userId, userId),
        isNull(stories.deletedAt)
      )
    )
    .limit(1);
  return result[0];
}

export async function getStoryByRitualId(ritualId: string, userId: number) {
  if (getStorageMode() === "local-file") {
    return localStore.getStoryByRitualId(ritualId, userId);
  }
  const result = await (
    await requireDb()
  )
    .select()
    .from(stories)
    .where(
      and(
        eq(stories.ritualId, ritualId),
        eq(stories.userId, userId),
        isNull(stories.deletedAt)
      )
    )
    .limit(1);
  return result[0];
}

export async function getAllStories(userId: number) {
  if (getStorageMode() === "local-file")
    return localStore.getAllStories(userId);
  return (await requireDb())
    .select()
    .from(stories)
    .where(and(eq(stories.userId, userId), isNull(stories.deletedAt)))
    .orderBy(desc(stories.createdAt));
}

export async function getStoriesByProject(projectId: number, userId: number) {
  if (getStorageMode() === "local-file") {
    return localStore.getStoriesByProject(projectId, userId);
  }
  return (await requireDb())
    .select()
    .from(stories)
    .where(
      and(
        eq(stories.projectId, projectId),
        eq(stories.userId, userId),
        isNull(stories.deletedAt)
      )
    )
    .orderBy(asc(stories.chapterNumber), asc(stories.createdAt));
}

export async function updateStory(
  id: number,
  userId: number,
  data: Partial<InsertStory>
) {
  if (getStorageMode() === "local-file") {
    return localStore.updateStory(id, userId, data);
  }
  return (await requireDb())
    .update(stories)
    .set(data)
    .where(
      and(
        eq(stories.id, id),
        eq(stories.userId, userId),
        isNull(stories.deletedAt)
      )
    );
}

export async function updateStoryWithRevision(
  id: number,
  userId: number,
  data: Pick<InsertStory, "title" | "content" | "wordCount" | "draftStatus">,
  reason: string
) {
  if (getStorageMode() === "local-file") {
    return localStore.updateStoryWithRevision(id, userId, data, reason);
  }
  const connection = await requireDb();
  return connection.transaction(async transaction => {
    const existing = await transaction
      .select()
      .from(stories)
      .where(
        and(
          eq(stories.id, id),
          eq(stories.userId, userId),
          isNull(stories.deletedAt)
        )
      )
      .limit(1);
    const story = existing[0];
    if (!story) return false;
    const snapshot: InsertStoryRevision = {
      storyId: id,
      userId,
      title: story.title,
      content: story.content,
      reason,
    };
    await transaction.insert(storyRevisions).values(snapshot);
    const revisions = await transaction
      .select({ id: storyRevisions.id })
      .from(storyRevisions)
      .where(eq(storyRevisions.storyId, id))
      .orderBy(desc(storyRevisions.createdAt), desc(storyRevisions.id))
      .limit(51);
    if (revisions.length > 50) {
      await transaction.delete(storyRevisions).where(
        inArray(
          storyRevisions.id,
          revisions.slice(50).map(item => item.id)
        )
      );
    }
    await transaction.update(stories).set(data).where(eq(stories.id, id));
    if (story.projectId) {
      await transaction
        .update(projects)
        .set({ updatedAt: new Date() })
        .where(
          and(eq(projects.id, story.projectId), eq(projects.userId, userId))
        );
    }
    return true;
  });
}

export async function getStoryRevisions(storyId: number, userId: number) {
  if (getStorageMode() === "local-file") {
    return localStore.getStoryRevisions(storyId, userId);
  }
  return (await requireDb())
    .select()
    .from(storyRevisions)
    .where(
      and(
        eq(storyRevisions.storyId, storyId),
        eq(storyRevisions.userId, userId)
      )
    )
    .orderBy(desc(storyRevisions.createdAt));
}

export async function restoreStoryRevision(
  storyId: number,
  revisionId: number,
  userId: number
) {
  if (getStorageMode() === "local-file") {
    return localStore.restoreStoryRevision(storyId, revisionId, userId);
  }
  const connection = await requireDb();
  return connection.transaction(async transaction => {
    const [existing, target] = await Promise.all([
      transaction
        .select()
        .from(stories)
        .where(
          and(
            eq(stories.id, storyId),
            eq(stories.userId, userId),
            isNull(stories.deletedAt)
          )
        )
        .limit(1),
      transaction
        .select()
        .from(storyRevisions)
        .where(
          and(
            eq(storyRevisions.id, revisionId),
            eq(storyRevisions.storyId, storyId),
            eq(storyRevisions.userId, userId)
          )
        )
        .limit(1),
    ]);
    const story = existing[0];
    const revision = target[0];
    if (!story || !revision) return false;
    await transaction.insert(storyRevisions).values({
      storyId,
      userId,
      title: story.title,
      content: story.content,
      reason: "before-restore",
    });
    const revisions = await transaction
      .select({ id: storyRevisions.id })
      .from(storyRevisions)
      .where(eq(storyRevisions.storyId, storyId))
      .orderBy(desc(storyRevisions.createdAt), desc(storyRevisions.id))
      .limit(51);
    if (revisions.length > 50) {
      await transaction.delete(storyRevisions).where(
        inArray(
          storyRevisions.id,
          revisions.slice(50).map(item => item.id)
        )
      );
    }
    await transaction
      .update(stories)
      .set({
        title: revision.title,
        content: revision.content,
        wordCount: revision.content.trim().split(/\s+/).filter(Boolean).length,
      })
      .where(eq(stories.id, storyId));
    if (story.projectId) {
      await transaction
        .update(projects)
        .set({ updatedAt: new Date() })
        .where(
          and(eq(projects.id, story.projectId), eq(projects.userId, userId))
        );
    }
    return true;
  });
}

export async function getStoryBySeriesAndChapter(
  seriesId: string,
  chapterNumber: number,
  userId: number
) {
  if (getStorageMode() === "local-file") {
    return localStore.getStoryBySeriesAndChapter(
      seriesId,
      chapterNumber,
      userId
    );
  }
  const result = await (
    await requireDb()
  )
    .select()
    .from(stories)
    .where(
      and(
        eq(stories.seriesId, seriesId),
        eq(stories.chapterNumber, chapterNumber),
        eq(stories.userId, userId),
        isNull(stories.deletedAt)
      )
    )
    .limit(1);
  return result[0];
}

export async function getStoriesBySeries(seriesId: string, userId: number) {
  if (getStorageMode() === "local-file") {
    return localStore.getStoriesBySeries(seriesId, userId);
  }
  return (await requireDb())
    .select()
    .from(stories)
    .where(
      and(
        eq(stories.seriesId, seriesId),
        eq(stories.userId, userId),
        isNull(stories.deletedAt)
      )
    );
}

export async function createUcfState(state: InsertUcfState) {
  if (getStorageMode() === "local-file")
    return localStore.createUcfState(state);
  return (await requireDb()).insert(ucfStates).values(state);
}

export async function getUcfStatesByRitualId(ritualId: string) {
  if (getStorageMode() === "local-file") {
    return localStore.getUcfStatesByRitualId(ritualId);
  }
  return (await requireDb())
    .select()
    .from(ucfStates)
    .where(eq(ucfStates.ritualId, ritualId))
    .orderBy(ucfStates.step);
}

export async function createAgentLog(log: InsertAgentLog) {
  if (getStorageMode() === "local-file") return localStore.createAgentLog(log);
  return (await requireDb()).insert(agentLogs).values(log);
}

export async function getAgentLogsByRitualId(ritualId: string) {
  if (getStorageMode() === "local-file") {
    return localStore.getAgentLogsByRitualId(ritualId);
  }
  return (await requireDb())
    .select()
    .from(agentLogs)
    .where(eq(agentLogs.ritualId, ritualId))
    .orderBy(agentLogs.timestamp);
}

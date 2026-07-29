import { and, desc, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  agentLogs,
  type InsertAgentLog,
  type InsertStory,
  type InsertUcfState,
  type InsertUser,
  stories,
  ucfStates,
  users,
} from "../drizzle/schema";
import * as localStore from "./localStore";

let database: ReturnType<typeof drizzle> | null = null;

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

export async function createStory(story: InsertStory) {
  if (getStorageMode() === "local-file") return localStore.createStory(story);
  return (await requireDb()).insert(stories).values(story);
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

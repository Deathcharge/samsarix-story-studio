import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type {
  AgentLog,
  InsertAgentLog,
  InsertStory,
  InsertUcfState,
  InsertUser,
  Story,
  UcfState,
  User,
} from "../drizzle/schema";

type LocalState = {
  version: 1;
  nextIds: {
    users: number;
    stories: number;
    ucfStates: number;
    agentLogs: number;
  };
  users: User[];
  stories: Story[];
  ucfStates: UcfState[];
  agentLogs: AgentLog[];
};

const DEFAULT_USER_OPEN_ID = "local-writer";
const DATE_FIELDS = new Set([
  "createdAt",
  "updatedAt",
  "lastSignedIn",
  "timestamp",
  "deletedAt",
]);

let statePromise: Promise<LocalState> | null = null;
let writeQueue: Promise<void> = Promise.resolve();

export function getLocalDataPath() {
  return path.resolve(
    process.env.SAMSARIX_DATA_FILE?.trim() ||
      process.env.HELIX_DATA_FILE?.trim() ||
      path.join(os.homedir(), ".samsarix-story-studio", "studio.json")
  );
}

function getLegacyDefaultDataPath() {
  if (
    process.env.SAMSARIX_DATA_FILE?.trim() ||
    process.env.HELIX_DATA_FILE?.trim()
  ) {
    return null;
  }

  return path.join(os.homedir(), ".helix-story-studio", "studio.json");
}

function reviveDates(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reviveDates);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => {
      if (DATE_FIELDS.has(key) && typeof entry === "string") {
        return [key, new Date(entry)];
      }
      return [key, reviveDates(entry)];
    })
  );
}

function createInitialState(): LocalState {
  const now = new Date();
  return {
    version: 1,
    nextIds: { users: 2, stories: 1, ucfStates: 1, agentLogs: 1 },
    users: [
      {
        id: 1,
        openId: DEFAULT_USER_OPEN_ID,
        name: process.env.LOCAL_USER_NAME?.trim() || "Local Writer",
        email: null,
        loginMethod: "local",
        role: "admin",
        createdAt: now,
        updatedAt: now,
        lastSignedIn: now,
      },
    ],
    stories: [],
    ucfStates: [],
    agentLogs: [],
  };
}

async function persist(state: LocalState) {
  const dataPath = getLocalDataPath();
  const directory = path.dirname(dataPath);
  await mkdir(directory, { recursive: true });

  const temporaryPath = `${dataPath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await rename(temporaryPath, dataPath);
}

async function loadState(): Promise<LocalState> {
  const dataPath = getLocalDataPath();
  try {
    const raw = await readFile(dataPath, "utf8");
    const parsed = reviveDates(JSON.parse(raw)) as LocalState;
    if (parsed.version !== 1) {
      throw new Error(
        `Unsupported local data version: ${String(parsed.version)}`
      );
    }
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;

    const legacyPath = getLegacyDefaultDataPath();
    if (legacyPath) {
      try {
        const raw = await readFile(legacyPath, "utf8");
        const parsed = reviveDates(JSON.parse(raw)) as LocalState;
        if (parsed.version !== 1) {
          throw new Error(
            `Unsupported local data version: ${String(parsed.version)}`
          );
        }
        await persist(parsed);
        return parsed;
      } catch (legacyError) {
        if ((legacyError as NodeJS.ErrnoException).code !== "ENOENT") {
          throw legacyError;
        }
      }
    }

    const initial = createInitialState();
    await persist(initial);
    return initial;
  }
}

async function getState() {
  statePromise ??= loadState();
  return statePromise;
}

async function readState() {
  await writeQueue;
  return getState();
}

async function mutate<T>(operation: (state: LocalState) => T | Promise<T>) {
  const pending = writeQueue.then(async () => {
    const state = await getState();
    const result = await operation(state);
    await persist(state);
    return result;
  });

  writeQueue = pending.then(
    () => undefined,
    () => undefined
  );
  return pending;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export async function getLocalUser(): Promise<User> {
  const state = await readState();
  const user = state.users.find(user => user.openId === DEFAULT_USER_OPEN_ID);
  if (!user) throw new Error("Local user record is missing");
  return clone(user);
}

export async function upsertUser(user: InsertUser) {
  await mutate(state => {
    const now = new Date();
    const existing = state.users.find(entry => entry.openId === user.openId);
    if (existing) {
      Object.assign(existing, user, { updatedAt: now });
      return;
    }

    state.users.push({
      id: state.nextIds.users++,
      openId: user.openId,
      name: user.name ?? null,
      email: user.email ?? null,
      loginMethod: user.loginMethod ?? null,
      role: user.role ?? "user",
      createdAt: user.createdAt ?? now,
      updatedAt: user.updatedAt ?? now,
      lastSignedIn: user.lastSignedIn ?? now,
    });
  });
}

export async function getUserByOpenId(openId: string) {
  const state = await readState();
  const user = state.users.find(entry => entry.openId === openId);
  return user ? clone(user) : undefined;
}

export async function createStory(story: InsertStory) {
  return mutate(state => {
    const now = new Date();
    const id = state.nextIds.stories++;
    const record: Story = {
      id,
      userId: story.userId ?? null,
      title: story.title,
      prompt: story.prompt,
      content: story.content,
      ritualId: story.ritualId,
      wordCount: story.wordCount,
      qualityScore: story.qualityScore,
      ethicalApproval: story.ethicalApproval ?? 1,
      ucfHarmony: story.ucfHarmony,
      ucfPrana: story.ucfPrana,
      ucfDrishti: story.ucfDrishti,
      ucfKlesha: story.ucfKlesha,
      ucfResilience: story.ucfResilience,
      ucfZoom: story.ucfZoom,
      agentContributions: story.agentContributions,
      createdAt: story.createdAt ?? now,
      updatedAt: story.updatedAt ?? now,
      seriesId: story.seriesId ?? null,
      chapterNumber: story.chapterNumber ?? null,
      previousChapterId: story.previousChapterId ?? null,
      collectionId: story.collectionId ?? null,
      tags: story.tags ?? null,
      isFavorite: story.isFavorite ?? 0,
      deletedAt: story.deletedAt ?? null,
    };
    state.stories.push(record);
    return { insertId: id };
  });
}

export async function getStoryById(id: number, userId: number) {
  const state = await readState();
  const story = state.stories.find(
    entry => entry.id === id && entry.userId === userId && !entry.deletedAt
  );
  return story ? clone(story) : undefined;
}

export async function getStoryByRitualId(ritualId: string, userId: number) {
  const state = await readState();
  const story = state.stories.find(
    entry =>
      entry.ritualId === ritualId && entry.userId === userId && !entry.deletedAt
  );
  return story ? clone(story) : undefined;
}

export async function getAllStories(userId: number) {
  const state = await readState();
  return state.stories
    .filter(entry => entry.userId === userId && !entry.deletedAt)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map(clone);
}

export async function updateStory(
  id: number,
  userId: number,
  data: Partial<InsertStory>
) {
  return mutate(state => {
    const story = state.stories.find(
      entry => entry.id === id && entry.userId === userId && !entry.deletedAt
    );
    if (!story) return false;
    Object.assign(story, data, { updatedAt: new Date() });
    return true;
  });
}

export async function getStoryBySeriesAndChapter(
  seriesId: string,
  chapterNumber: number,
  userId: number
) {
  const state = await readState();
  const story = state.stories.find(
    entry =>
      entry.seriesId === seriesId &&
      entry.chapterNumber === chapterNumber &&
      entry.userId === userId &&
      !entry.deletedAt
  );
  return story ? clone(story) : undefined;
}

export async function getStoriesBySeries(seriesId: string, userId: number) {
  const state = await readState();
  return state.stories
    .filter(
      entry =>
        entry.seriesId === seriesId &&
        entry.userId === userId &&
        !entry.deletedAt
    )
    .sort((a, b) => (a.chapterNumber ?? 0) - (b.chapterNumber ?? 0))
    .map(clone);
}

export async function createUcfState(input: InsertUcfState) {
  return mutate(state => {
    const id = state.nextIds.ucfStates++;
    state.ucfStates.push({
      id,
      ritualId: input.ritualId,
      step: input.step,
      harmony: input.harmony,
      prana: input.prana,
      drishti: input.drishti,
      klesha: input.klesha,
      resilience: input.resilience,
      zoom: input.zoom,
      timestamp: input.timestamp ?? new Date(),
    });
    return { insertId: id };
  });
}

export async function getUcfStatesByRitualId(ritualId: string) {
  const state = await readState();
  return state.ucfStates
    .filter(entry => entry.ritualId === ritualId)
    .sort((a, b) => a.step - b.step)
    .map(clone);
}

export async function createAgentLog(input: InsertAgentLog) {
  return mutate(state => {
    const id = state.nextIds.agentLogs++;
    state.agentLogs.push({
      id,
      ritualId: input.ritualId,
      agentName: input.agentName,
      agentSymbol: input.agentSymbol,
      role: input.role,
      content: input.content,
      timestamp: input.timestamp ?? new Date(),
    });
    return { insertId: id };
  });
}

export async function getAgentLogsByRitualId(ritualId: string) {
  const state = await readState();
  return state.agentLogs
    .filter(entry => entry.ritualId === ritualId)
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    .map(clone);
}

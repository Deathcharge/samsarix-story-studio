import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type {
  AgentLog,
  CanonEntry,
  GenerationJob,
  InsertAgentLog,
  InsertCanonEntry,
  InsertGenerationJob,
  InsertProject,
  InsertStory,
  InsertStoryRevision,
  InsertUcfState,
  InsertUser,
  Project,
  Story,
  StoryRevision,
  UcfState,
  User,
} from "../drizzle/schema";
import {
  DEFAULT_CHAPTER_STATUS,
  type ChapterStatus,
} from "../shared/chapterPlanning";
import type { ProjectImportPlan } from "./projectImport";

type LocalState = {
  version: 4;
  nextIds: {
    users: number;
    projects: number;
    stories: number;
    canonEntries: number;
    storyRevisions: number;
    ucfStates: number;
    agentLogs: number;
  };
  users: User[];
  projects: Project[];
  stories: Story[];
  canonEntries: CanonEntry[];
  storyRevisions: StoryRevision[];
  generationJobs: GenerationJob[];
  ucfStates: UcfState[];
  agentLogs: AgentLog[];
};

type LegacyLocalStateV3 = Omit<LocalState, "version" | "generationJobs"> & {
  version: 3;
};

type LegacyLocalStateV2 = Omit<LegacyLocalStateV3, "version" | "stories"> & {
  version: 2;
  stories: Array<Omit<Story, "draftStatus" | "synopsis">>;
};

type LegacyLocalStateV1 = Omit<
  LegacyLocalStateV3,
  "version" | "projects" | "canonEntries" | "storyRevisions" | "nextIds"
> & {
  version: 1;
  nextIds: Omit<
    LocalState["nextIds"],
    "projects" | "canonEntries" | "storyRevisions"
  >;
  stories: Array<Omit<Story, "projectId" | "draftStatus" | "synopsis">>;
};

const DEFAULT_USER_OPEN_ID = "local-writer";
const DATE_FIELDS = new Set([
  "createdAt",
  "updatedAt",
  "lastSignedIn",
  "timestamp",
  "deletedAt",
  "completedAt",
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
    version: 4,
    nextIds: {
      users: 2,
      projects: 1,
      stories: 1,
      canonEntries: 1,
      storyRevisions: 1,
      ucfStates: 1,
      agentLogs: 1,
    },
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
    projects: [],
    stories: [],
    canonEntries: [],
    storyRevisions: [],
    generationJobs: [],
    ucfStates: [],
    agentLogs: [],
  };
}

function migrateState(
  parsed:
    | LocalState
    | LegacyLocalStateV3
    | LegacyLocalStateV2
    | LegacyLocalStateV1
): LocalState {
  if (parsed.version === 4) return parsed;
  if (parsed.version === 3) {
    return { ...parsed, version: 4, generationJobs: [] };
  }
  if (parsed.version === 2) {
    return {
      ...parsed,
      version: 4,
      generationJobs: [],
      stories: parsed.stories.map(story => ({
        ...story,
        draftStatus: DEFAULT_CHAPTER_STATUS,
        synopsis: null,
      })),
    };
  }
  if (parsed.version !== 1) {
    throw new Error(
      `Unsupported local data version: ${String((parsed as { version?: unknown }).version)}`
    );
  }

  return {
    ...parsed,
    version: 4,
    nextIds: {
      ...parsed.nextIds,
      projects: 1,
      canonEntries: 1,
      storyRevisions: 1,
    },
    projects: [],
    stories: parsed.stories.map(story => ({
      ...story,
      projectId: null,
      draftStatus: DEFAULT_CHAPTER_STATUS,
      synopsis: null,
    })),
    canonEntries: [],
    storyRevisions: [],
    generationJobs: [],
  };
}

function interruptOrphanedGenerationJobs(state: LocalState) {
  let changed = false;
  const now = new Date();
  for (const job of state.generationJobs) {
    if (
      job.status !== "queued" &&
      job.status !== "running" &&
      job.status !== "cancelling"
    ) {
      continue;
    }
    job.status = "interrupted";
    job.stageLabel = "Generation stopped when the local server restarted";
    job.errorMessage = "The local server restarted before this draft finished.";
    job.completedAt = now;
    job.updatedAt = now;
    changed = true;
  }
  return changed;
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
    const parsed = reviveDates(JSON.parse(raw)) as
      | LocalState
      | LegacyLocalStateV3
      | LegacyLocalStateV2
      | LegacyLocalStateV1;
    const state = migrateState(parsed);
    const recovered = interruptOrphanedGenerationJobs(state);
    if (parsed.version !== 4 || recovered) await persist(state);
    return state;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;

    const legacyPath = getLegacyDefaultDataPath();
    if (legacyPath) {
      try {
        const raw = await readFile(legacyPath, "utf8");
        const parsed = reviveDates(JSON.parse(raw)) as
          | LocalState
          | LegacyLocalStateV3
          | LegacyLocalStateV2
          | LegacyLocalStateV1;
        const state = migrateState(parsed);
        interruptOrphanedGenerationJobs(state);
        await persist(state);
        return state;
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
    const current = await getState();
    const next = clone(current);
    const result = await operation(next);
    await persist(next);
    statePromise = Promise.resolve(next);
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

function pruneStoryRevisions(state: LocalState, storyId: number) {
  const retainedIds = new Set(
    state.storyRevisions
      .filter(revision => revision.storyId === storyId)
      .sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id
      )
      .slice(0, 50)
      .map(revision => revision.id)
  );
  state.storyRevisions = state.storyRevisions.filter(
    revision => revision.storyId !== storyId || retainedIds.has(revision.id)
  );
}

function pruneGenerationJobs(state: LocalState, userId: number) {
  const retainedTerminalIds = new Set(
    state.generationJobs
      .filter(
        job =>
          job.userId === userId &&
          job.status !== "queued" &&
          job.status !== "running" &&
          job.status !== "cancelling"
      )
      .sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime()
      )
      .slice(0, 100)
      .map(job => job.id)
  );
  state.generationJobs = state.generationJobs.filter(
    job =>
      job.userId !== userId ||
      job.status === "queued" ||
      job.status === "running" ||
      job.status === "cancelling" ||
      retainedTerminalIds.has(job.id)
  );
}

export async function createGenerationJob(input: InsertGenerationJob) {
  return mutate(state => {
    const now = new Date();
    const record: GenerationJob = {
      id: input.id,
      userId: input.userId,
      projectId: input.projectId ?? null,
      storyId: input.storyId ?? null,
      ritualId: input.ritualId ?? null,
      mode: input.mode,
      status: input.status,
      stage: input.stage,
      stageLabel: input.stageLabel,
      progress: input.progress ?? 0,
      cancelRequested: input.cancelRequested ?? 0,
      errorMessage: input.errorMessage ?? null,
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
      completedAt: input.completedAt ?? null,
    };
    state.generationJobs.push(record);
    pruneGenerationJobs(state, input.userId);
    return clone(record);
  });
}

export async function getGenerationJob(id: string, userId: number) {
  const state = await readState();
  const job = state.generationJobs.find(
    entry => entry.id === id && entry.userId === userId
  );
  return job ? clone(job) : undefined;
}

export async function getActiveGenerationJob(userId: number) {
  const state = await readState();
  const job = state.generationJobs
    .filter(
      entry =>
        entry.userId === userId &&
        (entry.status === "queued" ||
          entry.status === "running" ||
          entry.status === "cancelling")
    )
    .sort(
      (left, right) => right.createdAt.getTime() - left.createdAt.getTime()
    )[0];
  return job ? clone(job) : undefined;
}

export async function updateGenerationJob(
  id: string,
  userId: number,
  data: Partial<InsertGenerationJob>
) {
  return mutate(state => {
    const job = state.generationJobs.find(
      entry => entry.id === id && entry.userId === userId
    );
    if (!job) return undefined;
    Object.assign(job, data, { updatedAt: data.updatedAt ?? new Date() });
    pruneGenerationJobs(state, userId);
    return clone(job);
  });
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

export async function createProject(project: InsertProject) {
  return mutate(state => {
    const now = new Date();
    const id = state.nextIds.projects++;
    const record: Project = {
      id,
      userId: project.userId,
      title: project.title,
      premise: project.premise,
      genre: project.genre ?? null,
      style: project.style ?? null,
      createdAt: project.createdAt ?? now,
      updatedAt: project.updatedAt ?? now,
    };
    state.projects.push(record);
    return clone(record);
  });
}

export async function getAllProjects(userId: number) {
  const state = await readState();
  return state.projects
    .filter(project => project.userId === userId)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .map(clone);
}

export async function getProjectById(id: number, userId: number) {
  const state = await readState();
  const project = state.projects.find(
    entry => entry.id === id && entry.userId === userId
  );
  return project ? clone(project) : undefined;
}

export async function updateProject(
  id: number,
  userId: number,
  data: Partial<InsertProject>
) {
  return mutate(state => {
    const project = state.projects.find(
      entry => entry.id === id && entry.userId === userId
    );
    if (!project) return false;
    Object.assign(project, data, { updatedAt: new Date() });
    return true;
  });
}

function orderProjectStories(
  projectStories: Story[],
  projectId: number,
  updatedAt: Date
) {
  // A project is one manuscript sequence. Reordering intentionally normalizes
  // every chapter into its stable project series as well as rebuilding links.
  const seriesId = `project_${projectId}`;
  projectStories.forEach((story, index) => {
    story.seriesId = seriesId;
    story.chapterNumber = index + 1;
    story.previousChapterId = index === 0 ? null : projectStories[index - 1].id;
    story.updatedAt = updatedAt;
  });
}

export async function createPlannedChapter(input: {
  projectId: number;
  userId: number;
  ritualId: string;
  title: string;
  synopsis: string | null;
}) {
  return mutate(state => {
    const project = state.projects.find(
      entry => entry.id === input.projectId && entry.userId === input.userId
    );
    if (!project) return null;

    const now = new Date();
    const record: Story = {
      id: state.nextIds.stories++,
      userId: input.userId,
      projectId: input.projectId,
      title: input.title,
      prompt: input.synopsis || `Planned chapter: ${input.title}`,
      content: "",
      ritualId: input.ritualId,
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
      createdAt: now,
      updatedAt: now,
      seriesId: `project_${input.projectId}`,
      chapterNumber: null,
      previousChapterId: null,
      draftStatus: "planned",
      synopsis: input.synopsis,
      collectionId: null,
      tags: null,
      isFavorite: 0,
      deletedAt: null,
    };
    state.stories.push(record);

    const projectStories = state.stories
      .filter(
        story =>
          story.projectId === input.projectId &&
          story.userId === input.userId &&
          !story.deletedAt
      )
      .sort((left, right) => {
        const chapterDifference =
          (left.chapterNumber ?? Number.MAX_SAFE_INTEGER) -
          (right.chapterNumber ?? Number.MAX_SAFE_INTEGER);
        return (
          chapterDifference ||
          left.createdAt.getTime() - right.createdAt.getTime()
        );
      });
    orderProjectStories(projectStories, input.projectId, now);
    project.updatedAt = now;
    return clone(record);
  });
}

export async function updateStoryPlanning(
  id: number,
  projectId: number,
  userId: number,
  data: { draftStatus: ChapterStatus; synopsis: string | null }
) {
  return mutate(state => {
    const story = state.stories.find(
      entry =>
        entry.id === id &&
        entry.projectId === projectId &&
        entry.userId === userId &&
        !entry.deletedAt
    );
    if (!story) return false;
    const now = new Date();
    Object.assign(story, data, { updatedAt: now });
    const project = state.projects.find(
      entry => entry.id === projectId && entry.userId === userId
    );
    if (project) project.updatedAt = now;
    return true;
  });
}

export async function reorderProjectStories(
  projectId: number,
  userId: number,
  orderedStoryIds: number[]
) {
  return mutate(state => {
    const project = state.projects.find(
      entry => entry.id === projectId && entry.userId === userId
    );
    if (!project) return false;

    const projectStories = state.stories.filter(
      story =>
        story.projectId === projectId &&
        story.userId === userId &&
        !story.deletedAt
    );
    if (
      projectStories.length !== orderedStoryIds.length ||
      new Set(orderedStoryIds).size !== orderedStoryIds.length
    ) {
      return false;
    }

    const byId = new Map(projectStories.map(story => [story.id, story]));
    const orderedStories = orderedStoryIds.map(id => byId.get(id));
    if (orderedStories.some(story => !story)) return false;

    const now = new Date();
    orderProjectStories(orderedStories as Story[], projectId, now);
    project.updatedAt = now;
    return true;
  });
}

export async function importProject(plan: ProjectImportPlan, userId: number) {
  return mutate(state => {
    const projectId = state.nextIds.projects++;
    state.projects.push({
      id: projectId,
      userId,
      ...plan.project,
    });

    for (const entry of plan.canon) {
      state.canonEntries.push({
        id: state.nextIds.canonEntries++,
        projectId,
        userId,
        ...entry,
      });
    }

    const storyIds = new Map<number, number>();
    const importedStories = new Map<number, Story>();
    for (const story of plan.stories) {
      const id = state.nextIds.stories++;
      const record: Story = {
        id,
        userId,
        projectId,
        previousChapterId: null,
        ...story.values,
      };
      state.stories.push(record);
      storyIds.set(story.sourceId, id);
      importedStories.set(story.sourceId, record);
    }

    for (const story of plan.stories) {
      const record = importedStories.get(story.sourceId);
      if (!record) throw new Error("Imported story mapping was lost");
      if (story.previousSourceId) {
        const previousChapterId = storyIds.get(story.previousSourceId);
        if (!previousChapterId) {
          throw new Error("Imported previous chapter mapping was lost");
        }
        record.previousChapterId = previousChapterId;
      }

      for (const revision of story.revisions) {
        state.storyRevisions.push({
          id: state.nextIds.storyRevisions++,
          storyId: record.id,
          userId,
          ...revision,
        });
      }
    }

    return {
      projectId,
      ...plan.summary,
    };
  });
}

export async function createCanonEntry(input: InsertCanonEntry) {
  return mutate(state => {
    const now = new Date();
    const id = state.nextIds.canonEntries++;
    const record: CanonEntry = {
      id,
      projectId: input.projectId,
      userId: input.userId,
      kind: input.kind,
      name: input.name,
      content: input.content,
      activationKeys: input.activationKeys,
      alwaysInclude: input.alwaysInclude ?? 0,
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
    };
    state.canonEntries.push(record);
    return clone(record);
  });
}

export async function getCanonEntries(projectId: number, userId: number) {
  const state = await readState();
  return state.canonEntries
    .filter(entry => entry.projectId === projectId && entry.userId === userId)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(clone);
}

export async function updateCanonEntry(
  id: number,
  projectId: number,
  userId: number,
  data: Partial<InsertCanonEntry>
) {
  return mutate(state => {
    const entry = state.canonEntries.find(
      item =>
        item.id === id && item.projectId === projectId && item.userId === userId
    );
    if (!entry) return false;
    Object.assign(entry, data, { updatedAt: new Date() });
    return true;
  });
}

export async function deleteCanonEntry(
  id: number,
  projectId: number,
  userId: number
) {
  return mutate(state => {
    const index = state.canonEntries.findIndex(
      item =>
        item.id === id && item.projectId === projectId && item.userId === userId
    );
    if (index < 0) return false;
    state.canonEntries.splice(index, 1);
    return true;
  });
}

export async function createStory(story: InsertStory) {
  return mutate(state => {
    const now = new Date();
    const id = state.nextIds.stories++;
    const record: Story = {
      id,
      userId: story.userId ?? null,
      projectId: story.projectId ?? null,
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
      draftStatus: story.draftStatus ?? DEFAULT_CHAPTER_STATUS,
      synopsis: story.synopsis ?? null,
      collectionId: story.collectionId ?? null,
      tags: story.tags ?? null,
      isFavorite: story.isFavorite ?? 0,
      deletedAt: story.deletedAt ?? null,
    };
    state.stories.push(record);
    if (record.projectId) {
      const project = state.projects.find(
        entry => entry.id === record.projectId && entry.userId === record.userId
      );
      if (project) project.updatedAt = now;
    }
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

export async function getStoriesByProject(projectId: number, userId: number) {
  const state = await readState();
  return state.stories
    .filter(
      entry =>
        entry.projectId === projectId &&
        entry.userId === userId &&
        !entry.deletedAt
    )
    .sort((a, b) => {
      const chapterDifference =
        (a.chapterNumber ?? Number.MAX_SAFE_INTEGER) -
        (b.chapterNumber ?? Number.MAX_SAFE_INTEGER);
      return chapterDifference || a.createdAt.getTime() - b.createdAt.getTime();
    })
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

export async function updateStoryWithRevision(
  id: number,
  userId: number,
  data: Pick<InsertStory, "title" | "content" | "wordCount" | "draftStatus">,
  reason: string
) {
  return mutate(state => {
    const story = state.stories.find(
      entry => entry.id === id && entry.userId === userId && !entry.deletedAt
    );
    if (!story) return false;

    const now = new Date();
    state.storyRevisions.push({
      id: state.nextIds.storyRevisions++,
      storyId: story.id,
      userId,
      title: story.title,
      content: story.content,
      reason,
      createdAt: now,
    });
    pruneStoryRevisions(state, story.id);
    Object.assign(story, data, { updatedAt: now });
    if (story.projectId) {
      const project = state.projects.find(
        entry => entry.id === story.projectId && entry.userId === userId
      );
      if (project) project.updatedAt = now;
    }
    return true;
  });
}

export async function getStoryRevisions(storyId: number, userId: number) {
  const state = await readState();
  return state.storyRevisions
    .filter(
      revision => revision.storyId === storyId && revision.userId === userId
    )
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map(clone);
}

export async function restoreStoryRevision(
  storyId: number,
  revisionId: number,
  userId: number
) {
  return mutate(state => {
    const story = state.stories.find(
      entry =>
        entry.id === storyId && entry.userId === userId && !entry.deletedAt
    );
    const revision = state.storyRevisions.find(
      entry =>
        entry.id === revisionId &&
        entry.storyId === storyId &&
        entry.userId === userId
    );
    if (!story || !revision) return false;

    const now = new Date();
    const currentSnapshot: StoryRevision = {
      id: state.nextIds.storyRevisions++,
      storyId,
      userId,
      title: story.title,
      content: story.content,
      reason: "before-restore",
      createdAt: now,
    };
    state.storyRevisions.push(currentSnapshot);
    pruneStoryRevisions(state, storyId);
    story.title = revision.title;
    story.content = revision.content;
    story.wordCount = revision.content
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
    story.updatedAt = now;
    if (story.projectId) {
      const project = state.projects.find(
        entry => entry.id === story.projectId && entry.userId === userId
      );
      if (project) project.updatedAt = now;
    }
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

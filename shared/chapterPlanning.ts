export const CHAPTER_STATUSES = [
  "planned",
  "drafting",
  "revising",
  "complete",
] as const;

export type ChapterStatus = (typeof CHAPTER_STATUSES)[number];

export const DEFAULT_CHAPTER_STATUS: ChapterStatus = "drafting";

export const CHAPTER_STATUS_LABELS: Record<ChapterStatus, string> = {
  planned: "Planned",
  drafting: "Drafting",
  revising: "Revising",
  complete: "Complete",
};

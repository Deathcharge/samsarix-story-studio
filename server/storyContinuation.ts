import { randomUUID } from "node:crypto";

export interface ContinuationContext {
  previousStory: {
    title: string;
    content: string;
    chapterNumber: number;
  };
  seriesTitle?: string;
  userPrompt?: string;
}

export async function generateContinuationPrompt({
  previousStory,
  seriesTitle,
  userPrompt,
}: ContinuationContext) {
  const finalParagraph = previousStory.content
    .split(/\n\s*\n/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean)
    .at(-1)
    ?.replace(/^#.*\n?/, "")
    .slice(0, 300)
    .replace(/[.!?]+$/, "");
  const direction = userPrompt?.trim()
    ? ` Follow this direction: ${userPrompt.trim().slice(0, 300)}`
    : " Introduce a consequence of the previous chapter's final decision and force the protagonist to choose between protecting one person and preserving the wider truth.";

  return `Write chapter ${previousStory.chapterNumber + 1} of ${seriesTitle ?? previousStory.title}. Continue directly from this closing situation: ${finalParagraph || "the unresolved ending of the previous chapter"}.${direction} Preserve established character motivations and setting details, advance at least one unresolved conflict, and end with a meaningful new decision.`;
}

export async function extractStoryContext(storyContent: string) {
  const properNames =
    storyContent.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g) ?? [];
  return {
    characters: [...new Set(properNames)].slice(0, 8),
    locations: [],
    plotThreads: storyContent
      .split(/\n\s*\n/)
      .map(paragraph => paragraph.trim())
      .filter(Boolean)
      .slice(-3),
    tone: "speculative",
  };
}

export function generateSeriesId(seed?: string | number) {
  if (seed !== undefined) {
    const normalized = String(seed)
      .replace(/[^a-zA-Z0-9_-]/g, "-")
      .slice(0, 48);
    return `series_${normalized}`;
  }
  return `series_${randomUUID()}`;
}

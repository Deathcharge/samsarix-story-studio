import type { InsertStory, Story } from "../drizzle/schema";

export type PlannedChapterCompletion = Pick<
  InsertStory,
  | "prompt"
  | "content"
  | "ritualId"
  | "wordCount"
  | "qualityScore"
  | "ethicalApproval"
  | "ucfHarmony"
  | "ucfPrana"
  | "ucfDrishti"
  | "ucfKlesha"
  | "ucfResilience"
  | "ucfZoom"
  | "agentContributions"
  | "draftStatus"
>;

export function isDraftablePlannedChapter(story: Story) {
  return (
    story.projectId !== null &&
    story.wordCount === 0 &&
    story.content.trim().length === 0
  );
}

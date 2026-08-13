import { z } from "zod";

export const MAX_STORY_TAGS = 12;
export const MAX_STORY_TAG_LENGTH = 32;

export const storyTagsSchema = z
  .array(z.string().trim().min(1).max(MAX_STORY_TAG_LENGTH))
  .max(MAX_STORY_TAGS)
  .transform(tags => {
    const seen = new Set<string>();
    return tags.filter(tag => {
      const key = tag.toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });

export function parseStoredStoryTags(value: string | null | undefined) {
  if (!value) return [];
  try {
    const parsed = storyTagsSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

export function serializeStoryTags(tags: string[]) {
  const normalized = storyTagsSchema.parse(tags);
  return normalized.length > 0 ? JSON.stringify(normalized) : null;
}

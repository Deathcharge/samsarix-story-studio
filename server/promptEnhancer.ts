export interface EnhancedPrompt {
  original: string;
  enhanced: string;
  detectedGenre: string;
  detectedTone: string;
  suggestedThemes: string[];
  wordCount: number;
}

const THEME_RULES = [
  ["memory", "identity"],
  ["corporate", "power"],
  ["ai", "personhood"],
  ["family", "belonging"],
  ["city", "community"],
  ["rebel", "resistance"],
] as const;

function analyze(prompt: string) {
  const normalized = prompt.toLowerCase();
  const suggestedThemes = THEME_RULES.filter(([needle]) =>
    normalized.includes(needle)
  ).map(([, theme]) => theme);

  return {
    detectedGenre: /magic|dragon|kingdom/.test(normalized)
      ? "speculative fantasy"
      : "cyberpunk",
    detectedTone: /hope|save|protect|rebuild/.test(normalized)
      ? "tense but hopeful"
      : "noir and suspenseful",
    suggestedThemes:
      suggestedThemes.length > 0
        ? [...new Set(suggestedThemes)]
        : ["agency", "trust"],
  };
}

export async function enhancePrompt(prompt: string): Promise<EnhancedPrompt> {
  const original = prompt.trim();
  const analysis = analyze(original);
  const wordCount = original.split(/\s+/).filter(Boolean).length;
  const enhanced =
    wordCount >= 45
      ? original
      : `${original}. Set the story in a rain-lit city where technology shapes everyday power. Give the protagonist a personal stake, a difficult choice with consequences, and an ally whose goals do not fully align with theirs. Build toward a reversal that tests who controls the truth, then end with a concrete change rather than a perfect victory.`;

  return {
    original,
    enhanced,
    ...analysis,
    wordCount: enhanced.split(/\s+/).filter(Boolean).length,
  };
}

export const PROMPT_TEMPLATES = {
  hacker:
    "A skilled hacker in a neon-lit megacity discovers {secret} and must {action} before {threat}.",
  detective:
    "An augmented detective investigates {mystery} in a city where {twist}.",
  rebel:
    "A street samurai protects {target} from {antagonist} while navigating {conflict}.",
  memory:
    "A memory trader finds {artifact} containing {revelation}, forcing them to {choice}.",
  ai: "An AI {role} questions its existence when {trigger}, leading to {consequence}.",
};

export function applyTemplate(
  templateKey: keyof typeof PROMPT_TEMPLATES,
  variables: Record<string, string>
) {
  return Object.entries(variables).reduce(
    (template, [key, value]) => template.replace(`{${key}}`, value),
    PROMPT_TEMPLATES[templateKey]
  );
}

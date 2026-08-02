// Changing either enum requires a matching MySQL migration because Drizzle
// persists these values as native ENUM columns.
export const GENERATION_STATUSES = [
  "queued",
  "running",
  "cancelling",
  "succeeded",
  "failed",
  "cancelled",
  "interrupted",
] as const;

export type GenerationStatus = (typeof GENERATION_STATUSES)[number];

export const GENERATION_STAGES = [
  "queued",
  "preparing",
  "plot",
  "characters",
  "world",
  "twists",
  "research",
  "synthesis",
  "review",
  "saving",
  "completed",
  "failed",
  "cancelled",
  "interrupted",
] as const;

export type GenerationStage = (typeof GENERATION_STAGES)[number];

export const TERMINAL_GENERATION_STATUSES = [
  "succeeded",
  "failed",
  "cancelled",
  "interrupted",
] as const satisfies readonly GenerationStatus[];

export function isTerminalGenerationStatus(status: GenerationStatus) {
  return (TERMINAL_GENERATION_STATUSES as readonly GenerationStatus[]).includes(
    status
  );
}

export const GENERATION_STAGE_LABELS: Record<GenerationStage, string> = {
  queued: "Waiting to start",
  preparing: "Preparing project context",
  plot: "Structuring the central conflict",
  characters: "Developing character arcs",
  world: "Building setting and constraints",
  twists: "Testing creative turns",
  research: "Checking real-world grounding",
  synthesis: "Writing the manuscript",
  review: "Running advisory review",
  saving: "Saving the draft",
  completed: "Draft saved",
  failed: "Generation failed",
  cancelled: "Generation cancelled",
  interrupted: "Generation interrupted",
};

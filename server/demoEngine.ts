import { randomUUID } from "node:crypto";
import type { GenerationStage } from "../shared/generationLifecycle";

const PROTAGONISTS = ["Mara Venn", "Ivo Calder", "Sera Nox", "Jonah Vale"];
const DISTRICTS = [
  "Glass Harbor",
  "the Low Circuit",
  "Saint-9",
  "the Lumen Ward",
];
const CORPORATIONS = [
  "Orison Systems",
  "Vanta Civic",
  "Palisade Memory",
  "Northstar Humanics",
];

function hashPrompt(prompt: string) {
  return [...prompt].reduce((hash, character) => {
    return (hash * 31 + character.charCodeAt(0)) >>> 0;
  }, 2_166_136_261);
}

function titleFromPrompt(prompt: string) {
  const words = prompt
    .replace(/[^a-zA-Z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(word => word.length > 3)
    .slice(0, 2)
    .map(word => word[0].toUpperCase() + word.slice(1).toLowerCase());
  return words.length > 0 ? `${words.join(" ")} Protocol` : "Neon Protocol";
}

type DemoRitualOptions = {
  signal?: AbortSignal;
  onStage?: (stage: GenerationStage, progress: number) => void | Promise<void>;
};

async function pause(signal?: AbortSignal) {
  signal?.throwIfAborted();
  const configured = Number(process.env.DEMO_STAGE_DELAY_MS ?? 180);
  const delay = Number.isFinite(configured)
    ? Math.min(Math.max(Math.floor(configured), 0), 5_000)
    : 180;
  await new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      reject(signal?.reason ?? new DOMException("Aborted", "AbortError"));
    };
    const finish = () => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    };
    const timer = setTimeout(finish, delay);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function executeDemoRitual(
  prompt: string,
  context?: string,
  options: DemoRitualOptions = {}
) {
  await options.onStage?.("preparing", 8);
  await pause(options.signal);
  await options.onStage?.("synthesis", 70);
  await pause(options.signal);
  const hash = hashPrompt(prompt);
  const contextEntries = [
    ...(context?.matchAll(/^\[([^\]]+)\]\s+(.+)$/gm) ?? []),
  ].map(match => ({ kind: match[1].trim(), name: match[2].trim() }));
  const protagonist =
    contextEntries.find(entry => entry.kind === "character")?.name ??
    PROTAGONISTS[hash % PROTAGONISTS.length];
  const district = DISTRICTS[(hash >>> 3) % DISTRICTS.length];
  const corporation = CORPORATIONS[(hash >>> 5) % CORPORATIONS.length];
  const corporationPossessive = corporation.endsWith("s")
    ? `${corporation}'`
    : `${corporation}'s`;
  const title = titleFromPrompt(prompt);
  const ritualId = `demo_${randomUUID()}`;
  const canonNames = contextEntries.map(entry => entry.name).slice(0, 3);
  const promptSentence = prompt.trim().replace(/[.!?]+$/, "");
  const canonNote =
    canonNames.length > 0
      ? ` The project canon marked ${canonNames.join(", ")} as established details, so ${protagonist} treated those names as facts rather than suggestions.`
      : "";

  const storyText = `# ${title}

Rain moved through ${district} in silver sheets, turning every advertisement into a trembling second sky. ${protagonist} watched it from beneath the tram line while the city repeated the brief that had brought them here: ${promptSentence}.

The words had arrived without a sender, folded into an obsolete audio file and buried inside a municipal weather report. That was the sort of hiding place people used when they expected both machines and people to be listening. ${protagonist} had replayed it seven times. Each pass exposed another sound under the voice: a station bell, a ventilation fan, and the soft three-note signature of ${corporationPossessive} private network.${canonNote}

At midnight, the last public tram carried ${protagonist} above the flooded avenues. Below, food carts closed their armor shutters while courier drones returned to their charging hives. The city looked automated from that height. Up close, it was held together by night-shift mechanics, borrowed access cards, and people making decisions no system had predicted.

The trail ended at a records annex marked for demolition. Its doors recognized no living employee, but the maintenance panel still trusted a copper key. Inside, cold air rolled between stacks of humming archive cells. ${protagonist} found the hidden file where the message promised it would be. It was not a weapon or a ledger. It was a sequence of ordinary memories: a kitchen at dawn, an argument left unfinished, a hand held during a hospital blackout.

Each memory belonged to someone whose public record said they had volunteered for ${corporationPossessive} civic-assistance program. The consent forms were perfect. The timestamps were not. They had been signed after the memories were taken.

An elevator opened behind ${protagonist}. Director Ansel Rook stepped out alone, his expensive coat dark with real rain. “You expected security,” he said. “Security would turn this into evidence. I need it to remain a choice.”

Rook explained that the stolen memories powered prediction models used throughout the city. Remove them and hospitals would lose forecasts, trams would slow, and emergency crews would work half-blind. Leave them and thousands of people would continue living inside systems trained on pieces of themselves they had never agreed to surrender.

For one breath, the problem had the clean geometry of a trap: harm on one side, complicity on the other. Then ${protagonist} noticed the archive cells were still writing. ${corporation} had never planned for the extraction to stop.

So ${protagonist} chose a third path. They copied the consent records, the delayed timestamps, and the model's dependency map into the city's public maintenance channel. Not a dramatic data dump—those were easy to dismiss as sabotage—but a reproducible audit that every neighborhood technician could verify. Then they throttled the archive rather than destroying it, buying the hospitals seventy-two hours to switch to their degraded public models.

Rook stared at the spreading verification requests on his wrist display. “You think disclosure fixes this?”

“No,” ${protagonist} said. “People fix it. Disclosure just lets them know where to start.”

By sunrise, the tram line was running twelve minutes late. Clinics had canceled noncritical forecasts. Across ${district}, strangers were comparing fragments of the audit and discovering their names in systems they had never seen. The city was less efficient than it had been the night before, and more honest by a measurable degree.

${protagonist} returned to the street as the rain stopped. In the sudden quiet, repair crews opened the first archive cell under public observation. Nothing had been solved forever. But the next decision would be made in daylight, by the people who would have to live with it.`;

  const wordCount = storyText.trim().split(/\s+/).length;
  options.signal?.throwIfAborted();
  return {
    success: true as const,
    ritualId,
    title,
    storyText,
    metadata: {
      ritualId,
      title,
      genre: "speculative fiction",
      wordCount,
      qualityScore: 0,
      ethicalApproval: false,
      agentContributions: {
        template: { provider: "demo", role: "Deterministic local template" },
      },
      ucfSnapshot: {
        harmony: 0,
        prana: 0,
        drishti: 0,
        klesha: 0,
        resilience: 0,
        zoom: 0,
      },
    },
  };
}

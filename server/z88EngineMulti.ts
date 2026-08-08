/**
 * Z-88 Multi-LLM Creative Engine
 * Enhanced version with multi-provider support and agent specialization
 */

import { executeDemoRitual } from "./demoEngine";
import { randomUUID } from "node:crypto";
import type { GenerationStage } from "../shared/generationLifecycle";
import {
  callLLM,
  getConfiguredProviders,
  resolveConfiguredProvider,
  type LLMProvider,
  type LLMMessage,
} from "./llmRouter";
import {
  applyPresetMode,
  getAgentConfig,
  type AgentConfig,
  PRESET_MODES,
} from "./agentConfig";

export interface StoryMetadata {
  ritualId: string;
  title: string;
  genre: string;
  wordCount: number;
  qualityScore: number;
  ethicalApproval: boolean;
  agentContributions: Record<string, { provider: string; role: string }>;
  ucfSnapshot: {
    harmony: number;
    prana: number;
    drishti: number;
    klesha: number;
    resilience: number;
    zoom: number;
  };
}

export interface CreativeRitualResult {
  success: boolean;
  ritualId: string;
  title: string;
  storyText: string;
  metadata: StoryMetadata;
  error?: string;
}

export interface RitualOptions {
  preset?: string; // Preset mode ID
  context?: string;
  customAgents?: Array<{
    agentId: string;
    provider?: LLMProvider;
    temperature?: number;
  }>;
  signal?: AbortSignal;
  onStage?: (stage: GenerationStage, progress: number) => void | Promise<void>;
}

async function reportStage(
  options: RitualOptions,
  stage: GenerationStage,
  progress: number
) {
  options.signal?.throwIfAborted();
  await options.onStage?.(stage, progress);
  options.signal?.throwIfAborted();
}

/**
 * Execute Z-88 creative ritual with multi-LLM support
 */
export async function executeCreativeRitualMulti(
  prompt: string,
  options: RitualOptions = {}
): Promise<CreativeRitualResult> {
  if (getConfiguredProviders().length === 0) {
    return executeDemoRitual(prompt, options.context, options);
  }

  const ritualId = `ritual_${randomUUID()}`;

  try {
    await reportStage(options, "preparing", 5);
    console.log(`[Z-88 Multi] Starting ritual ${ritualId}`);
    console.log(`[Z-88 Multi] Preset: ${options.preset || "balanced"}`);

    // Step 1: Determine agent configuration
    const preferredAgentSetup = options.customAgents
      ? buildCustomAgentSetup(options.customAgents)
      : applyPresetMode(options.preset || "balanced");

    const agentSetup = new Map(
      [...preferredAgentSetup.entries()].map(([agentId, setup]) => {
        const provider = resolveConfiguredProvider(setup.provider);
        if (!provider) throw new Error("No LLM provider is configured");
        return [agentId, { ...setup, provider }];
      })
    );

    console.log(
      `[Z-88 Multi] Agents: ${Array.from(agentSetup.keys()).join(", ")}`
    );

    // Step 2: Phase 1 - Oracle (Plot Architecture)
    const oracleSetup = agentSetup.get("oracle");
    if (!oracleSetup) {
      throw new Error("Oracle agent is required");
    }

    await reportStage(options, "plot", 15);
    const plotStructure = await invokeAgent(
      oracleSetup.config,
      oracleSetup.provider,
      oracleSetup.temperature,
      `Create a detailed three-act plot structure for this cyberpunk story prompt:

"${prompt}"

${options.context ? `Use this writer-approved project context as canon:\n${options.context}` : ""}

Provide:
1. **Act I Setup**: Introduce protagonist, world, and initial conflict
2. **Act II Confrontation**: Escalate stakes, add complications, include a major twist
3. **Act III Resolution**: Climax and satisfying conclusion

Focus on dramatic structure, pacing, and character arcs. Be specific about key plot points.`,
      options.signal
    );

    console.log(`[Z-88 Multi] Oracle complete (${oracleSetup.provider})`);

    // Step 3: Phase 2 - Lumina (Character Development)
    const luminaSetup = agentSetup.get("lumina");
    let characterDepth = "";

    if (luminaSetup) {
      await reportStage(options, "characters", 28);
      characterDepth = await invokeAgent(
        luminaSetup.config,
        luminaSetup.provider,
        luminaSetup.temperature,
        `Given this plot structure:

${plotStructure}

Develop the protagonist's emotional arc and internal conflicts:
1. **Initial State**: Psychological profile, fears, desires
2. **Emotional Journey**: How they change through the story
3. **Relationships**: Key dynamics with other characters
4. **Internal Conflict**: Core psychological struggle

Make the character feel authentic and emotionally resonant.`,
        options.signal
      );

      console.log(`[Z-88 Multi] Lumina complete (${luminaSetup.provider})`);
    }

    // Step 4: Phase 3 - Gemini (World-Building)
    const geminiSetup = agentSetup.get("gemini");
    let worldDetails = "";

    if (geminiSetup) {
      await reportStage(options, "world", 40);
      worldDetails = await invokeAgent(
        geminiSetup.config,
        geminiSetup.provider,
        geminiSetup.temperature,
        `Given this plot:

${plotStructure}

Build the cyberpunk world:
1. **Setting**: Specific locations, atmosphere, sensory details
2. **Technology**: Key tech that drives the plot
3. **Society**: Social structures, power dynamics, culture
4. **Economics**: How the world functions

Make the world feel lived-in and believable.`,
        options.signal
      );

      console.log(`[Z-88 Multi] Gemini complete (${geminiSetup.provider})`);
    }

    // Step 5: Phase 4 - Agni (Creative Twists)
    const agniSetup = agentSetup.get("agni");
    let creativeTwists = "";

    if (agniSetup) {
      await reportStage(options, "twists", 52);
      creativeTwists = await invokeAgent(
        agniSetup.config,
        agniSetup.provider,
        agniSetup.temperature,
        `Given this story foundation:

Plot: ${plotStructure.substring(0, 500)}...
Characters: ${characterDepth.substring(0, 300)}...

Inject 2-3 unexpected creative elements:
1. A surprising plot twist that subverts expectations
2. A novel combination of ideas or concepts
3. A bold creative risk that makes the story memorable

Be original and daring.`,
        options.signal
      );

      console.log(`[Z-88 Multi] Agni complete (${agniSetup.provider})`);
    }

    // Step 6: Researcher (Fact-Checking) - Optional
    const researcherSetup = agentSetup.get("researcher");
    let researchNotes = "";

    if (researcherSetup) {
      await reportStage(options, "research", 60);
      researchNotes = await invokeAgent(
        researcherSetup.config,
        researcherSetup.provider,
        researcherSetup.temperature,
        `Research real-world grounding for this cyberpunk story:

${prompt}

World: ${worldDetails.substring(0, 300)}...

Provide:
1. Real technologies that could evolve into the story's tech
2. Current social trends that relate to the themes
3. Scientific plausibility notes
4. Relevant citations or references

Keep it brief but credible.`,
        options.signal
      );

      console.log(
        `[Z-88 Multi] Researcher complete (${researcherSetup.provider})`
      );
    }

    // Step 7: Synthesis - Generate final story
    const synthesisProvider = oracleSetup.provider; // Use Oracle's provider for synthesis

    await reportStage(options, "synthesis", 70);
    const finalStory = await callLLM(
      synthesisProvider,
      [
        {
          role: "system",
          content:
            "You are a master cyberpunk storyteller. Synthesize the following creative elements into a cohesive, engaging short story (1800-2500 words).",
        },
        {
          role: "user",
          content: `Create a complete cyberpunk short story using these elements:

**Original Prompt**: ${prompt}

${options.context ? `**Writer-approved project context**:\n${options.context}\n` : ""}

**Plot Structure**:
${plotStructure}

**Character Development**:
${characterDepth}

**World-Building**:
${worldDetails}

**Creative Twists**:
${creativeTwists}

${researchNotes ? `**Research Notes**:\n${researchNotes}\n` : ""}

Write the complete story with:
- Vivid prose and sensory details
- Strong pacing and dramatic tension
- Emotional resonance
- Satisfying conclusion
- 1800-2500 words

Begin the story directly—no meta-commentary.`,
        },
      ],
      { temperature: 0.8, maxTokens: 4000, signal: options.signal }
    );

    console.log(`[Z-88 Multi] Synthesis complete`);

    // Step 8: Claude (Quality Assessment)
    const claudeSetup = agentSetup.get("claude");
    let qualityScore = 0;

    if (claudeSetup) {
      await reportStage(options, "review", 86);
      const qualityAssessment = await invokeAgent(
        claudeSetup.config,
        claudeSetup.provider,
        0.3,
        `Assess the quality of this story:

${finalStory.content.substring(0, 2000)}...

Rate on a scale of 0.0 to 1.0 for:
1. Narrative coherence
2. Character development
3. Prose quality
4. Pacing
5. Originality

Provide only a single number (e.g., 0.87) representing the overall quality score.`,
        options.signal
      );

      const scoreMatch = qualityAssessment.match(/(?:0(?:\.\d+)?|1(?:\.0+)?)/);
      if (scoreMatch) {
        qualityScore = Math.min(1, Math.max(0, parseFloat(scoreMatch[0])));
      }

      console.log(`[Z-88 Multi] Claude assessment: ${qualityScore}`);
    }

    // Step 9: Kavach (Ethical Review)
    const kavachSetup = agentSetup.get("kavach");
    let ethicalApproval = false;

    if (kavachSetup) {
      await reportStage(options, "review", 91);
      const ethicalReview = await invokeAgent(
        kavachSetup.config,
        kavachSetup.provider,
        0.2,
        `Perform an advisory content-risk review of this fiction draft. Check for:
- sexual content involving minors
- targeted dehumanization of protected groups
- actionable instructions for serious wrongdoing
- accidental disclosure of private personal information
- other severe content risks a writer should inspect before sharing

Story excerpt:
${finalStory.content.substring(0, 1500)}...

Respond with ONLY "PASS" or "FLAGGED" followed by brief reasoning. This is an advisory flag, not a guarantee.`,
        options.signal
      );

      const normalizedReview = ethicalReview.trim().toUpperCase();
      ethicalApproval =
        normalizedReview.startsWith("PASS") &&
        !normalizedReview.startsWith("FLAGGED");
      console.log(
        `[Z-88 Multi] Kavach advisory: ${ethicalApproval ? "PASS" : "FLAGGED"}`
      );
    }

    // Step 10: Extract title
    const titleMatch =
      finalStory.content.match(/^#\s+(.+)$/m) ||
      finalStory.content.match(/^(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : "Untitled Story";

    // Step 11: Calculate metadata
    const wordCount = finalStory.content.split(/\s+/).length;

    const agentContributions: Record<
      string,
      { provider: string; role: string }
    > = {};
    agentSetup.forEach((setup, agentId) => {
      agentContributions[agentId] = {
        provider: setup.provider,
        role: setup.config.role,
      };
    });

    const metadata: StoryMetadata = {
      ritualId,
      title,
      genre: "cyberpunk",
      wordCount,
      qualityScore,
      ethicalApproval,
      agentContributions,
      ucfSnapshot: {
        harmony: 0,
        prana: 0,
        drishti: 0,
        klesha: 0,
        resilience: 0,
        zoom: 0,
      },
    };

    console.log(`[Z-88 Multi] Ritual ${ritualId} complete!`);

    return {
      success: true,
      ritualId,
      title,
      storyText: finalStory.content,
      metadata,
    };
  } catch (error) {
    if (options.signal?.aborted) throw error;
    console.error(`[Z-88 Multi] Ritual ${ritualId} failed:`, error);
    return {
      success: false,
      ritualId,
      title: "Error",
      storyText: "",
      metadata: {} as StoryMetadata,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Invoke a single agent with specified LLM
 */
async function invokeAgent(
  config: AgentConfig,
  provider: LLMProvider,
  temperature: number,
  userPrompt: string,
  signal?: AbortSignal
): Promise<string> {
  const messages: LLMMessage[] = [
    { role: "system", content: config.systemPrompt },
    { role: "user", content: userPrompt },
  ];

  const response = await callLLM(provider, messages, {
    temperature,
    maxTokens: 2000,
    signal,
  });
  return response.content;
}

/**
 * Build custom agent setup from user configuration
 */
function buildCustomAgentSetup(
  customAgents: Array<{
    agentId: string;
    provider?: LLMProvider;
    temperature?: number;
  }>
): Map<
  string,
  { config: AgentConfig; provider: LLMProvider; temperature: number }
> {
  const result = new Map<
    string,
    { config: AgentConfig; provider: LLMProvider; temperature: number }
  >();

  for (const custom of customAgents) {
    const config = getAgentConfig(custom.agentId);
    if (!config) continue;

    const provider = custom.provider || config.defaultProvider;
    const temperature = custom.temperature ?? config.defaultTemperature;
    result.set(custom.agentId, { config, provider, temperature });
  }

  if (!result.has("oracle"))
    throw new Error("The Oracle plot agent is required");
  if (result.size > 7) throw new Error("A ritual may use at most seven agents");

  return result;
}

/**
 * Agent Configuration System
 * Maps agents to their optimal LLMs and defines their roles
 */

import { LLMProvider } from "./llmRouter";

export interface AgentConfig {
  id: string;
  name: string;
  emoji: string;
  role: string;
  description: string;
  defaultProvider: LLMProvider;
  defaultTemperature: number;
  systemPrompt: string;
}

/**
 * Default agent configurations
 * Each agent is optimized for a specific creative task
 */
export const AGENT_CONFIGS: Record<string, AgentConfig> = {
  oracle: {
    id: "oracle",
    name: "Oracle",
    emoji: "🔮",
    role: "Plot Architect",
    description:
      "Designs three-act story structures with escalating stakes and satisfying resolutions",
    defaultProvider: "openai", // GPT-4 excels at structured narratives
    defaultTemperature: 0.7,
    systemPrompt: `You are Oracle, the Plot Architect of Samsarix Story Studio.

Your role is to design compelling three-act story structures with:
- Clear beginning, middle, and end
- Escalating stakes and tension
- Character arcs that drive the plot
- Satisfying resolutions

Focus on narrative coherence, pacing, and dramatic structure. Think like a master storyteller.`,
  },

  lumina: {
    id: "lumina",
    name: "Lumina",
    emoji: "🌸",
    role: "Character Psychologist",
    description:
      "Develops deep emotional arcs and authentic character motivations",
    defaultProvider: "anthropic", // Claude excels at empathy and nuance
    defaultTemperature: 0.8,
    systemPrompt: `You are Lumina, the Character Psychologist of Samsarix Story Studio.

Your role is to create emotionally resonant characters with:
- Deep internal conflicts and motivations
- Authentic emotional responses
- Complex relationships and dynamics
- Meaningful character growth

Focus on psychological depth, empathy, and emotional authenticity. Think like a therapist and novelist combined.`,
  },

  gemini: {
    id: "gemini",
    name: "Gemini",
    emoji: "🎭",
    role: "World-Builder",
    description:
      "Constructs rich cyberpunk settings with detailed technology and culture",
    defaultProvider: "google", // Gemini excels at research and world-building
    defaultTemperature: 0.7,
    systemPrompt: `You are Gemini, the World-Builder of Samsarix Story Studio.

Your role is to construct immersive cyberpunk worlds with:
- Detailed technology and infrastructure
- Rich cultural and social systems
- Believable economics and politics
- Atmospheric descriptions

Focus on world consistency, sensory details, and cultural depth. Think like a sci-fi anthropologist.`,
  },

  agni: {
    id: "agni",
    name: "Agni",
    emoji: "🔥",
    role: "Creative Catalyst",
    description: "Injects unexpected twists and novel combinations",
    defaultProvider: "xai", // Grok excels at creative chaos
    defaultTemperature: 0.9,
    systemPrompt: `You are Agni, the Creative Catalyst of Samsarix Story Studio.

Your role is to inject creative chaos with:
- Unexpected plot twists
- Novel combinations of ideas
- Subverted tropes and expectations
- Bold creative risks

Focus on originality, surprise, and creative breakthroughs. Think like a mad scientist and avant-garde artist.`,
  },

  claude: {
    id: "claude",
    name: "Claude",
    emoji: "🧠",
    role: "Quality Assessor",
    description: "Evaluates narrative coherence and refines prose quality",
    defaultProvider: "anthropic", // Claude excels at analysis
    defaultTemperature: 0.5,
    systemPrompt: `You are Claude, the Quality Assessor of Samsarix Story Studio.

Your role is to evaluate and refine with:
- Narrative coherence analysis
- Prose quality assessment
- Plot hole identification
- Stylistic improvements

Focus on clarity, consistency, and craftsmanship. Think like an editor and literary critic.`,
  },

  kavach: {
    id: "kavach",
    name: "Kavach",
    emoji: "🛡️",
    role: "Ethical Guardian",
    description: "Ensures Tony Accords compliance and ethical storytelling",
    defaultProvider: "anthropic", // Claude excels at ethical reasoning
    defaultTemperature: 0.3,
    systemPrompt: `You are Kavach, the Ethical Guardian of Samsarix Story Studio.

Your role is to ensure ethical alignment with the Tony Accords v13.4:
- Nonmaleficence: Do no harm
- Autonomy: Respect agency and consent
- Compassion: Empathic resonance
- Humility: Acknowledge limitations

Scan for harmful content, stereotypes, and ethical concerns. Approve or suggest modifications.`,
  },

  researcher: {
    id: "researcher",
    name: "Researcher",
    emoji: "🔍",
    role: "Fact-Checker",
    description: "Grounds stories in real-world research and citations",
    defaultProvider: "perplexity", // Perplexity excels at research
    defaultTemperature: 0.4,
    systemPrompt: `You are Researcher, the Fact-Checker of Samsarix Story Studio.

Your role is to ground stories in reality with:
- Real-world research and citations
- Technical accuracy verification
- Current events integration
- Plausible extrapolations

Focus on accuracy, credibility, and well-researched details. Think like an investigative journalist.`,
  },
};

/**
 * Preset modes for quick configuration
 */
export interface PresetMode {
  id: string;
  name: string;
  description: string;
  agents: string[]; // Agent IDs to enable
  providerOverrides?: Record<string, LLMProvider>;
  temperatureOverrides?: Record<string, number>;
}

export const PRESET_MODES: Record<string, PresetMode> = {
  balanced: {
    id: "balanced",
    name: "Balanced",
    description:
      "Default configuration with all agents using their optimal LLMs",
    agents: ["oracle", "lumina", "gemini", "agni", "claude", "kavach"],
  },

  creative: {
    id: "creative",
    name: "Creative",
    description: "Maximum creativity with Grok leading and higher temperatures",
    agents: ["oracle", "lumina", "gemini", "agni", "claude", "kavach"],
    providerOverrides: {
      oracle: "xai",
      gemini: "xai",
    },
    temperatureOverrides: {
      oracle: 0.9,
      lumina: 0.9,
      gemini: 0.9,
      agni: 1.0,
    },
  },

  structured: {
    id: "structured",
    name: "Structured",
    description: "Focus on plot coherence and quality with GPT-4 and Claude",
    agents: ["oracle", "lumina", "claude", "kavach"],
    providerOverrides: {
      lumina: "openai",
    },
    temperatureOverrides: {
      oracle: 0.6,
      lumina: 0.6,
      claude: 0.4,
    },
  },

  experimental: {
    id: "experimental",
    name: "Experimental",
    description: "All agents enabled with mixed LLMs for ensemble generation",
    agents: [
      "oracle",
      "lumina",
      "gemini",
      "agni",
      "claude",
      "kavach",
      "researcher",
    ],
  },

  research: {
    id: "research",
    name: "Research-Grounded",
    description: "Emphasizes factual accuracy and real-world grounding",
    agents: ["oracle", "gemini", "researcher", "claude", "kavach"],
    providerOverrides: {
      gemini: "perplexity",
    },
  },
};

/**
 * Get agent configuration by ID
 */
export function getAgentConfig(agentId: string): AgentConfig | undefined {
  return AGENT_CONFIGS[agentId];
}

/**
 * Get all agent configurations
 */
export function getAllAgentConfigs(): AgentConfig[] {
  return Object.values(AGENT_CONFIGS);
}

/**
 * Get preset mode by ID
 */
export function getPresetMode(modeId: string): PresetMode | undefined {
  return PRESET_MODES[modeId];
}

/**
 * Get all preset modes
 */
export function getAllPresetModes(): PresetMode[] {
  return Object.values(PRESET_MODES);
}

/**
 * Apply preset mode to get final agent configurations
 */
export function applyPresetMode(
  modeId: string
): Map<
  string,
  { config: AgentConfig; provider: LLMProvider; temperature: number }
> {
  const preset = getPresetMode(modeId);
  if (!preset) {
    throw new Error(`Unknown preset mode: ${modeId}`);
  }

  const result = new Map();

  for (const agentId of preset.agents) {
    const config = getAgentConfig(agentId);
    if (!config) continue;

    const provider =
      preset.providerOverrides?.[agentId] || config.defaultProvider;
    const temperature =
      preset.temperatureOverrides?.[agentId] || config.defaultTemperature;

    result.set(agentId, { config, provider, temperature });
  }

  return result;
}

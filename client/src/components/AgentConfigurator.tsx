import { useState } from "react";
import { ChevronDown, ChevronUp, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type ProviderId = "openai" | "anthropic" | "xai" | "google" | "perplexity";

export interface AgentConfig {
  id: string;
  name: string;
  emoji: string;
  role: string;
  description: string;
  defaultProvider: ProviderId;
  defaultTemperature: number;
}

export interface AgentSelection {
  agentId: string;
  provider: ProviderId;
  temperature: number;
  enabled: boolean;
}

interface AgentConfiguratorProps {
  agents: AgentConfig[];
  presets: Array<{ id: string; name: string; description: string }>;
  configuredProviders: string[];
  onConfigChange: (config: {
    preset?: string;
    customAgents?: AgentSelection[];
  }) => void;
}

const LLM_PROVIDERS = [
  { id: "openai", name: "OpenAI", color: "text-green-400" },
  { id: "anthropic", name: "Anthropic", color: "text-orange-400" },
  { id: "xai", name: "Grok", color: "text-purple-400" },
  { id: "google", name: "Gemini", color: "text-blue-400" },
  { id: "perplexity", name: "Perplexity", color: "text-cyan-400" },
];

export function AgentConfigurator({
  agents,
  presets,
  configuredProviders,
  onConfigChange,
}: AgentConfiguratorProps) {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState("balanced");
  const [agentSelections, setAgentSelections] = useState<AgentSelection[]>(
    agents.map(agent => ({
      agentId: agent.id,
      provider: agent.defaultProvider,
      temperature: agent.defaultTemperature,
      enabled: agent.id !== "researcher", // Researcher is optional by default
    }))
  );

  const handlePresetChange = (presetId: string) => {
    setSelectedPreset(presetId);
    onConfigChange({ preset: presetId });
  };

  const handleAgentChange = (
    agentId: string,
    field: keyof AgentSelection,
    value: AgentSelection[keyof AgentSelection]
  ) => {
    const updated = agentSelections.map(sel =>
      sel.agentId === agentId ? { ...sel, [field]: value } : sel
    );
    setAgentSelections(updated);
    onConfigChange({ customAgents: updated.filter(s => s.enabled) });
  };

  const getProviderColor = (providerId: string) => {
    return (
      LLM_PROVIDERS.find(p => p.id === providerId)?.color || "text-gray-400"
    );
  };

  const getProviderName = (providerId: string) => {
    return LLM_PROVIDERS.find(p => p.id === providerId)?.name || providerId;
  };

  return (
    <div className="space-y-4">
      {/* Preset Selector */}
      <div className="space-y-2">
        <Label htmlFor="preset" className="text-sm font-medium">
          Generation Mode
        </Label>
        <Select value={selectedPreset} onValueChange={handlePresetChange}>
          <SelectTrigger
            id="preset"
            className="bg-background/50 border-primary/20 hover:border-primary/40"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {presets.map(preset => (
              <SelectItem key={preset.id} value={preset.id}>
                <div>
                  <div className="font-medium">{preset.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {preset.description}
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Advanced Options Toggle */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
        className="w-full justify-between text-sm"
      >
        <span>Advanced Options</span>
        {isAdvancedOpen ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </Button>

      {/* Advanced Options Panel */}
      {isAdvancedOpen && (
        <Card className="p-4 bg-background/30 border-primary/20 space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <Info className="h-4 w-4" />
            <span>Configure each agent individually</span>
          </div>

          {agents.map(agent => {
            const selection = agentSelections.find(s => s.agentId === agent.id);
            if (!selection) return null;

            return (
              <div
                key={agent.id}
                className="space-y-3 pb-4 border-b border-primary/10 last:border-0"
              >
                {/* Agent Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={selection.enabled}
                      onCheckedChange={enabled =>
                        handleAgentChange(agent.id, "enabled", enabled)
                      }
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{agent.emoji}</span>
                        <span className="font-medium">{agent.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {agent.role}
                        </span>
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className="text-xs text-muted-foreground max-w-md">
                            {agent.description.substring(0, 60)}...
                          </p>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">{agent.description}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </div>

                {selection.enabled && (
                  <div className="ml-11 space-y-3">
                    {/* LLM Provider */}
                    <div className="space-y-1">
                      <div className="space-y-1">
                        <Label className="text-xs">LLM Provider</Label>
                        <Select
                          value={selection.provider}
                          onValueChange={value =>
                            handleAgentChange(
                              agent.id,
                              "provider",
                              value as ProviderId
                            )
                          }
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {LLM_PROVIDERS.map(provider => (
                              <SelectItem
                                key={provider.id}
                                value={provider.id}
                                disabled={
                                  !configuredProviders.includes(provider.id)
                                }
                              >
                                <span className={provider.color}>
                                  {provider.name}
                                  {!configuredProviders.includes(provider.id)
                                    ? " — not configured"
                                    : ""}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Temperature Slider */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label className="text-xs">
                          Creativity (Temperature)
                        </Label>
                        <span className="text-xs text-muted-foreground">
                          {selection.temperature.toFixed(1)}
                        </span>
                      </div>
                      <Slider
                        value={[selection.temperature]}
                        onValueChange={([value]) =>
                          handleAgentChange(agent.id, "temperature", value)
                        }
                        min={0}
                        max={1}
                        step={0.1}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Precise</span>
                        <span>Creative</span>
                      </div>
                    </div>

                    {/* Current Config Display */}
                    <div className="text-xs text-muted-foreground bg-background/50 p-2 rounded">
                      {agent.name} using{" "}
                      <span className={getProviderColor(selection.provider)}>
                        {getProviderName(selection.provider)}
                      </span>{" "}
                      at {selection.temperature.toFixed(1)} temperature
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}

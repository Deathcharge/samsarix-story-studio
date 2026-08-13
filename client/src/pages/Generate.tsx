import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CircleAlert,
  Loader2,
  Sparkles,
  Wand2,
  X,
  Zap,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  AgentConfigurator,
  type AgentSelection,
} from "@/components/AgentConfigurator";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  TERMINAL_GENERATION_STATUSES,
  type GenerationStatus,
} from "@shared/generationLifecycle";

const EXAMPLE_PROMPTS = [
  "A hacker discovers their memories are corporate property and must steal them back",
  "An AI detective investigates murders in a city where consciousness can be uploaded",
  "A street medic protects a child who can see through augmented-reality propaganda",
  "A memory trader finds a black-market chip containing the last unedited public record",
];

type GenerationJob = {
  id: string;
  ritualId: string | null;
  status: GenerationStatus;
  stageLabel: string;
  progress: number;
  errorMessage: string | null;
};

const TERMINAL_STATUSES = new Set<GenerationStatus>(
  TERMINAL_GENERATION_STATUSES
);

function getContinuationParameters() {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

export default function Generate() {
  const [, setLocation] = useLocation();
  const continuation = useMemo(getContinuationParameters, []);
  const initialProjectId = Number(continuation.get("projectId")) || null;
  const previousStoryId = Number(continuation.get("previousStoryId")) || null;
  const targetStoryId = Number(continuation.get("targetStoryId")) || null;
  const [prompt, setPrompt] = useState("");
  const [projectId, setProjectId] = useState<number | null>(initialProjectId);
  const [selectedCanonIds, setSelectedCanonIds] = useState<number[]>([]);
  const [continuationApplied, setContinuationApplied] = useState(false);
  const [targetApplied, setTargetApplied] = useState(false);
  const [generationJob, setGenerationJob] = useState<GenerationJob | null>(
    null
  );
  const [eventStreamAvailable, setEventStreamAvailable] = useState(true);
  const [enhancedData, setEnhancedData] = useState<{
    detectedGenre: string;
    detectedTone: string;
    suggestedThemes: string[];
  } | null>(null);
  const [generationConfig, setGenerationConfig] = useState<{
    preset?: string;
    customAgents?: AgentSelection[];
  }>({ preset: "balanced" });

  const statusQuery = trpc.system.status.useQuery();
  const status = statusQuery.data;
  const { data: agents } = trpc.config.agents.useQuery();
  const { data: presets } = trpc.config.presets.useQuery();
  const { data: projects } = trpc.projects.list.useQuery();
  const activeGenerationQuery = trpc.stories.activeGeneration.useQuery(
    undefined,
    { retry: false }
  );
  const generationStatusQuery = trpc.stories.generationStatus.useQuery(
    { jobId: generationJob?.id ?? "" },
    { enabled: false, retry: false }
  );
  const refetchGenerationStatus = generationStatusQuery.refetch;
  const projectQuery = trpc.projects.get.useQuery(
    { id: projectId ?? 0 },
    { enabled: Boolean(projectId), retry: false }
  );
  const continuationQuery = trpc.stories.prepareContinuation.useQuery(
    { previousStoryId: previousStoryId ?? 0 },
    { enabled: Boolean(previousStoryId), retry: false }
  );
  const plannedChapterQuery = trpc.stories.preparePlannedChapter.useQuery(
    { targetStoryId: targetStoryId ?? 0 },
    { enabled: Boolean(targetStoryId), retry: false }
  );
  const deferredPrompt = useDeferredValue(prompt);
  const contextQuery = trpc.projects.previewContext.useQuery(
    {
      projectId: projectId ?? 0,
      prompt: deferredPrompt.trim().slice(0, 1_000),
      selectedCanonIds,
    },
    { enabled: Boolean(projectId), retry: false }
  );

  const enhanceMutation = trpc.prompts.enhance.useMutation({
    onSuccess: data => {
      setEnhancedData(data);
      setPrompt(data.enhanced);
    },
  });

  const generateMutation = trpc.stories.startGeneration.useMutation({
    onSuccess: data => {
      setGenerationJob(data);
      setEventStreamAvailable(true);
    },
  });
  const cancelMutation = trpc.stories.cancelGeneration.useMutation({
    onSuccess: data => {
      if (data) setGenerationJob(data);
    },
  });

  useEffect(() => {
    if (generationJob || !activeGenerationQuery.data) return;
    setGenerationJob(activeGenerationQuery.data);
  }, [activeGenerationQuery.data, generationJob]);

  const generationJobId = generationJob?.id;
  const generationJobStatus = generationJob?.status;
  const shouldPollGeneration = Boolean(
    !eventStreamAvailable &&
      generationJobId &&
      generationJobStatus &&
      !TERMINAL_STATUSES.has(generationJobStatus)
  );

  useEffect(() => {
    const jobId = generationJobId;
    if (!jobId) return;
    const source = new EventSource(
      `/api/generation/${encodeURIComponent(jobId)}/events`
    );
    const handleGeneration = (event: MessageEvent<string>) => {
      try {
        const next = JSON.parse(event.data) as GenerationJob;
        setGenerationJob(next);
        setEventStreamAvailable(true);
        if (TERMINAL_STATUSES.has(next.status)) source.close();
      } catch {
        setEventStreamAvailable(false);
        source.close();
      }
    };
    source.addEventListener("generation", handleGeneration);
    source.onerror = () => {
      setEventStreamAvailable(false);
      source.close();
    };
    return () => source.close();
  }, [generationJobId]);

  useEffect(() => {
    if (!shouldPollGeneration || !generationJobId) return;
    const interval = window.setInterval(async () => {
      const response = await refetchGenerationStatus();
      if (response.data?.id === generationJobId) {
        setGenerationJob(response.data);
      }
    }, 3_000);
    return () => window.clearInterval(interval);
  }, [generationJobId, refetchGenerationStatus, shouldPollGeneration]);

  useEffect(() => {
    if (generationJob?.status === "succeeded" && generationJob.ritualId) {
      setLocation(`/story/${generationJob.ritualId}`);
    }
  }, [generationJob?.ritualId, generationJob?.status, setLocation]);

  useEffect(() => {
    if (!continuationQuery.data || continuationApplied) return;
    setPrompt(continuationQuery.data.prompt);
    setProjectId(continuationQuery.data.projectId ?? null);
    setContinuationApplied(true);
  }, [continuationApplied, continuationQuery.data]);

  useEffect(() => {
    if (!plannedChapterQuery.data || targetApplied) return;
    setPrompt(plannedChapterQuery.data.prompt);
    setProjectId(plannedChapterQuery.data.projectId);
    setTargetApplied(true);
  }, [plannedChapterQuery.data, targetApplied]);

  const trimmedPrompt = prompt.trim();
  const targetReady = !targetStoryId || Boolean(plannedChapterQuery.data);
  const isGenerating = Boolean(
    generationJob && !TERMINAL_STATUSES.has(generationJob.status)
  );
  const canGenerate =
    Boolean(status) &&
    targetReady &&
    trimmedPrompt.length >= 10 &&
    !isGenerating &&
    !generateMutation.isPending;
  const isDemo = status?.mode !== "provider";

  const handleGenerate = () => {
    if (!canGenerate) return;
    generateMutation.reset();
    cancelMutation.reset();
    setGenerationJob(null);
    generateMutation.mutate({
      prompt: trimmedPrompt,
      preset: generationConfig.preset as
        | "balanced"
        | "creative"
        | "structured"
        | "experimental"
        | "research"
        | undefined,
      customAgents: generationConfig.customAgents,
      projectId: projectId ?? undefined,
      selectedCanonIds,
      previousChapterId: previousStoryId ?? undefined,
      targetStoryId: targetStoryId ?? undefined,
    });
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Zap className="h-5 w-5 text-primary" aria-hidden="true" />
            Samsarix Story Studio
          </Link>
          <nav
            aria-label="Primary navigation"
            className="flex items-center gap-5 text-sm"
          >
            <Link
              href="/projects"
              className="text-muted-foreground hover:text-foreground"
            >
              Projects
            </Link>
            <Link href="/generate" className="font-medium text-primary">
              Studio
            </Link>
            <Link
              href="/archive"
              className="text-muted-foreground hover:text-foreground"
            >
              Archive
            </Link>
          </nav>
        </div>
      </header>

      <main className="container py-10 md:py-14">
        <div className="mx-auto max-w-4xl space-y-8">
          <div className="flex items-start gap-4">
            <Button asChild variant="ghost" size="sm" className="mt-1">
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Home
              </Link>
            </Button>
            <div>
              <p className="eyebrow">Writing workspace</p>
              <h1 className="mt-2 text-3xl font-bold md:text-4xl">
                {targetStoryId
                  ? "Draft the planned chapter"
                  : previousStoryId
                    ? "Draft the next chapter"
                    : "Turn a premise into a complete draft"}
              </h1>
              <p className="mt-2 max-w-2xl text-muted-foreground">
                {plannedChapterQuery.data
                  ? `Complete “${plannedChapterQuery.data.title}” in place without changing its manuscript position.`
                  : "Shape the premise, choose a workflow, and keep the result in your local archive."}
              </p>
            </div>
          </div>

          {status && (
            <div
              className={`mode-banner ${isDemo ? "mode-banner-demo" : "mode-banner-live"}`}
            >
              <div>
                <strong>{isDemo ? "Local demo mode" : "Provider mode"}</strong>
                <p>
                  {isDemo
                    ? "No API key is configured. The studio will create a deterministic sample draft so you can evaluate the complete workflow without spend."
                    : `${status.configuredProviders.length} provider${status.configuredProviders.length === 1 ? "" : "s"} configured. Preferred agents fall back to an available provider when needed.`}
                </p>
              </div>
              <span className="status-pill">{status.storageMode}</span>
            </div>
          )}

          {statusQuery.error && (
            <Card
              className="space-y-4 border-destructive/30 p-6 text-center"
              role="alert"
            >
              <CircleAlert className="mx-auto h-8 w-8 text-destructive" />
              <div>
                <strong>The local server status is unavailable</strong>
                <p className="mt-1 text-sm text-muted-foreground">
                  {statusQuery.error.message}
                </p>
              </div>
              <Button variant="outline" onClick={() => statusQuery.refetch()}>
                Try again
              </Button>
            </Card>
          )}

          {plannedChapterQuery.error && (
            <Card
              className="space-y-4 border-destructive/30 p-6 text-center"
              role="alert"
            >
              <CircleAlert className="mx-auto h-8 w-8 text-destructive" />
              <div>
                <strong>Planned chapter unavailable</strong>
                <p className="mt-1 text-sm text-muted-foreground">
                  {plannedChapterQuery.error.message}
                </p>
              </div>
              <Button asChild variant="outline">
                <Link href="/projects">Back to projects</Link>
              </Button>
            </Card>
          )}

          <Card className="space-y-6 border-primary/20 p-6 md:p-8">
            <div className="space-y-2">
              <label
                htmlFor="project-context"
                className="text-sm font-semibold"
              >
                Project context{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </label>
              <select
                id="project-context"
                value={projectId ?? ""}
                onChange={event => {
                  setProjectId(Number(event.target.value) || null);
                  setSelectedCanonIds([]);
                }}
                disabled={Boolean(previousStoryId || targetStoryId)}
                className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="" className="bg-background">
                  Standalone draft
                </option>
                {projects?.map(project => (
                  <option
                    key={project.id}
                    value={project.id}
                    className="bg-background"
                  >
                    {project.title}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Project briefs and selected canon stay visible and bounded
                before generation.
              </p>
            </div>
            <div className="space-y-2">
              <label htmlFor="story-prompt" className="text-sm font-semibold">
                Story premise
              </label>
              <Textarea
                id="story-prompt"
                placeholder="A transit engineer discovers the city's safest route is built from stolen memories..."
                value={prompt}
                onChange={event => {
                  setPrompt(event.target.value);
                  setEnhancedData(null);
                  generateMutation.reset();
                }}
                rows={6}
                disabled={isGenerating || !targetReady}
                className="resize-y text-base leading-relaxed"
                maxLength={1_000}
                aria-describedby="prompt-help"
              />
              <div
                id="prompt-help"
                className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"
              >
                <span>{prompt.length} / 1,000 characters · minimum 10</span>
                <button
                  type="button"
                  onClick={() =>
                    enhanceMutation.mutate({ prompt: trimmedPrompt })
                  }
                  disabled={
                    trimmedPrompt.length < 3 ||
                    enhanceMutation.isPending ||
                    isGenerating
                  }
                  className="inline-flex items-center gap-1.5 font-medium text-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {enhanceMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Wand2 className="h-3.5 w-3.5" />
                  )}
                  {enhanceMutation.isPending ? "Refining" : "Refine locally"}
                </button>
              </div>
            </div>

            {enhanceMutation.error && (
              <p
                role="alert"
                className="inline-flex items-center gap-2 text-sm text-destructive"
              >
                <CircleAlert className="h-4 w-4" />
                {enhanceMutation.error.message}
              </p>
            )}

            {enhancedData && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
                <strong>Prompt refined locally</strong>
                <p className="mt-1 text-muted-foreground">
                  {enhancedData.detectedGenre} · {enhancedData.detectedTone} ·{" "}
                  {enhancedData.suggestedThemes.join(", ")}
                </p>
              </div>
            )}

            {projectQuery.data ? (
              <div className="space-y-4 rounded-xl border border-border/70 bg-muted/25 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <strong>{projectQuery.data.project.title} context</strong>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {contextQuery.data
                        ? `${contextQuery.data.entries.length} ${contextQuery.data.entries.length === 1 ? "canon entry" : "canon entries"} · about ${contextQuery.data.estimatedTokens.toLocaleString()} input tokens`
                        : "Calculating context…"}
                    </p>
                  </div>
                  {contextQuery.data?.truncated ? (
                    <span className="status-pill">bounded</span>
                  ) : null}
                </div>
                {projectQuery.data.canon.length > 0 ? (
                  <fieldset className="grid gap-2 sm:grid-cols-2">
                    <legend className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Manually include canon
                    </legend>
                    {projectQuery.data.canon.map(entry => {
                      const selected = selectedCanonIds.includes(entry.id);
                      const active = contextQuery.data?.entries.find(
                        item => item.id === entry.id
                      );
                      return (
                        <label
                          key={entry.id}
                          className="flex items-start gap-2 rounded-lg border border-border/60 p-3 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            disabled={
                              !selected && selectedCanonIds.length >= 20
                            }
                            onChange={event =>
                              setSelectedCanonIds(current =>
                                event.target.checked
                                  ? [...current, entry.id]
                                  : current.filter(id => id !== entry.id)
                              )
                            }
                          />
                          <span>
                            <span className="block font-medium">
                              {entry.name}
                            </span>
                            <span className="text-xs text-muted-foreground capitalize">
                              {active ? `${active.reason} · ` : ""}
                              {entry.kind}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </fieldset>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    This project has no canon entries yet. Its premise and style
                    guidance will still be included.
                  </p>
                )}
              </div>
            ) : null}

            {!isDemo && agents && presets && status && (
              <AgentConfigurator
                agents={agents}
                presets={presets}
                configuredProviders={status.configuredProviders}
                onConfigChange={setGenerationConfig}
              />
            )}

            {(generateMutation.error || cancelMutation.error) && (
              <div
                role="alert"
                className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm"
              >
                <strong>
                  {generateMutation.error
                    ? "Draft not created"
                    : "Cancellation failed"}
                </strong>
                <p className="mt-1 text-muted-foreground">
                  {(generateMutation.error || cancelMutation.error)?.message}
                  {cancelMutation.error
                    ? " The generation may still be running."
                    : null}
                </p>
              </div>
            )}

            <Button
              onClick={handleGenerate}
              disabled={!canGenerate}
              size="lg"
              className="w-full text-base"
            >
              {isGenerating || generateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Creating draft
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  {!status
                    ? "Loading studio"
                    : isDemo
                      ? "Create demo draft"
                      : "Generate and save draft"}
                </>
              )}
            </Button>

            {!isDemo && status && (
              <p className="text-center text-xs text-muted-foreground">
                At most {status.maxProviderCallsPerStory} provider calls and{" "}
                {status.maxOutputTokensPerStory.toLocaleString()} requested
                output tokens per story. Provider charges remain yours.
              </p>
            )}
          </Card>

          {isGenerating && generationJob && (
            <Card
              className="space-y-3 border-primary/40 p-6"
              aria-live="polite"
              aria-busy="true"
            >
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="font-medium">{generationJob.stageLabel}</span>
                <span className="tabular-nums text-muted-foreground">
                  {generationJob.progress}%
                </span>
              </div>
              <Progress value={generationJob.progress} className="h-2" />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  {eventStreamAvailable
                    ? "Stages are reported by the local generation process."
                    : "Live updates disconnected; checking job status periodically."}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={
                    generationJob.status === "cancelling" ||
                    cancelMutation.isPending
                  }
                  onClick={() =>
                    cancelMutation.mutate({ jobId: generationJob.id })
                  }
                >
                  {cancelMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <X className="mr-2 h-4 w-4" />
                  )}
                  {generationJob.status === "cancelling"
                    ? "Cancelling"
                    : "Cancel generation"}
                </Button>
              </div>
            </Card>
          )}

          {generationJob &&
            TERMINAL_STATUSES.has(generationJob.status) &&
            generationJob.status !== "succeeded" && (
              <Card
                className="space-y-2 border-destructive/30 p-6"
                role="status"
              >
                <strong>
                  {generationJob.status === "cancelled"
                    ? "Generation cancelled"
                    : generationJob.status === "interrupted"
                      ? "Generation interrupted"
                      : "Draft not created"}
                </strong>
                <p className="text-sm text-muted-foreground">
                  {generationJob.errorMessage ||
                    "Your prompt is still here. Adjust it or try again when ready."}
                </p>
              </Card>
            )}

          {!isGenerating && !previousStoryId && !targetStoryId && (
            <section aria-labelledby="prompt-examples" className="space-y-3">
              <h2
                id="prompt-examples"
                className="text-sm font-semibold text-muted-foreground"
              >
                Start from an example
              </h2>
              <div className="grid gap-3 md:grid-cols-2">
                {EXAMPLE_PROMPTS.map(example => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => setPrompt(example)}
                    className="rounded-xl border border-border/60 bg-card/40 p-4 text-left text-sm leading-relaxed transition hover:border-primary/50 hover:bg-card"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

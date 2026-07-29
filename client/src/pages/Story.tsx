import {
  ArrowLeft,
  Brain,
  Calendar,
  CircleAlert,
  Download,
  FileText,
  Loader2,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { Link, useLocation, useParams } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";

type Contribution = { name: string; provider?: string; role?: string };

function normalizeContributions(value: unknown): Contribution[] {
  if (Array.isArray(value)) {
    return value.map(item => ({ name: String(item) }));
  }
  if (!value || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).map(
    ([name, metadata]) => {
      if (!metadata || typeof metadata !== "object") return { name };
      const details = metadata as Record<string, unknown>;
      return {
        name,
        provider:
          typeof details.provider === "string" ? details.provider : undefined,
        role: typeof details.role === "string" ? details.role : undefined,
      };
    }
  );
}

export default function Story() {
  const params = useParams<{ id: string }>();
  const ritualId = params.id || "";
  const [, setLocation] = useLocation();
  const storyQuery = trpc.stories.getByRitualId.useQuery(
    { ritualId },
    { enabled: Boolean(ritualId), retry: false }
  );
  const story = storyQuery.data;
  const trajectoryQuery = trpc.stories.getUcfTrajectory.useQuery(
    { ritualId },
    { enabled: Boolean(story?.ritualId), retry: false }
  );
  const agentLogsQuery = trpc.stories.getAgentLogs.useQuery(
    { ritualId },
    { enabled: Boolean(story?.ritualId), retry: false }
  );
  const continueMutation = trpc.stories.continueStory.useMutation({
    onSuccess: data => {
      const query = new URLSearchParams({
        prompt: data.prompt,
        seriesId: data.seriesId,
        chapterNumber: String(data.chapterNumber),
        previousChapterId: String(data.previousChapterId),
      });
      setLocation(`/generate?${query.toString()}`);
    },
  });

  if (storyQuery.isLoading) {
    return (
      <main className="min-h-screen grid place-items-center" aria-busy="true">
        <Loader2
          className="h-8 w-8 animate-spin text-primary"
          aria-label="Loading story"
        />
      </main>
    );
  }

  if (storyQuery.error) {
    return (
      <main className="min-h-screen grid place-items-center px-4">
        <Card
          className="max-w-lg space-y-5 border-destructive/30 p-8 text-center"
          role="alert"
        >
          <CircleAlert className="mx-auto h-10 w-10 text-destructive" />
          <div>
            <h1 className="text-2xl font-bold">
              The story could not be loaded
            </h1>
            <p className="mt-2 text-muted-foreground">
              {storyQuery.error.message}
            </p>
          </div>
          <div className="flex justify-center gap-3">
            <Button onClick={() => storyQuery.refetch()}>Try again</Button>
            <Button asChild variant="outline">
              <Link href="/archive">Back to archive</Link>
            </Button>
          </div>
        </Card>
      </main>
    );
  }

  if (!story) {
    return (
      <main className="min-h-screen grid place-items-center px-4">
        <Card className="max-w-lg space-y-5 p-8 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-bold">Story not found</h1>
            <p className="mt-2 text-muted-foreground">
              It may have been removed or belongs to another local profile.
            </p>
          </div>
          <Button asChild>
            <Link href="/archive">Back to archive</Link>
          </Button>
        </Card>
      </main>
    );
  }

  const contributions = normalizeContributions(story.agentContributions);
  const isDemo = contributions.some(
    contribution => contribution.provider === "demo"
  );
  const handleDownload = () => {
    const blob = new Blob([story.content], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${
      story.title
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase() || "story"
    }.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Zap className="h-5 w-5 text-primary" />
            Samsarix Story Studio
          </Link>
          <nav
            aria-label="Primary navigation"
            className="flex items-center gap-5 text-sm"
          >
            <Link
              href="/generate"
              className="text-muted-foreground hover:text-foreground"
            >
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
        <article className="mx-auto max-w-5xl space-y-8">
          <Button asChild variant="ghost" size="sm">
            <Link href="/archive">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Archive
            </Link>
          </Button>

          <header className="space-y-5 border-b border-border/50 pb-8">
            <div className="flex flex-wrap items-center gap-2">
              {isDemo && (
                <Badge className="bg-amber-300 text-amber-950 hover:bg-amber-300">
                  Deterministic demo
                </Badge>
              )}
              {story.seriesId && (
                <Badge variant="outline">
                  Chapter {story.chapterNumber ?? "—"}
                </Badge>
              )}
            </div>
            <h1 className="max-w-4xl text-4xl font-bold tracking-tight md:text-5xl">
              {story.title}
            </h1>
            <p className="max-w-3xl text-base leading-7 text-muted-foreground">
              {story.prompt}
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">
                <FileText className="mr-1 h-3 w-3" />
                {story.wordCount} words
              </Badge>
              <Badge variant="outline">
                <Sparkles className="mr-1 h-3 w-3" />
                {Math.round(story.qualityScore * 100)}% advisory score
              </Badge>
              {story.ethicalApproval && (
                <Badge variant="outline">
                  <ShieldCheck className="mr-1 h-3 w-3" />
                  Automated review passed
                </Badge>
              )}
              <Badge variant="outline">
                <Calendar className="mr-1 h-3 w-3" />
                {new Date(story.createdAt).toLocaleDateString()}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={handleDownload} variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Download Markdown
              </Button>
              <Button
                onClick={() =>
                  continueMutation.mutate({ previousStoryId: story.id })
                }
                disabled={continueMutation.isPending}
              >
                {continueMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="mr-2 h-4 w-4" />
                )}
                Continue story
              </Button>
            </div>
            {continueMutation.error && (
              <p role="alert" className="text-sm text-destructive">
                {continueMutation.error.message}
              </p>
            )}
            {isDemo && (
              <p className="text-sm text-muted-foreground">
                This sample was assembled locally from a fixed template. It did
                not call or imitate a named model.
              </p>
            )}
          </header>

          <Tabs defaultValue="story" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="story">Draft</TabsTrigger>
              <TabsTrigger value="process">Process</TabsTrigger>
              <TabsTrigger value="logs">Logs</TabsTrigger>
            </TabsList>

            <TabsContent value="story">
              <Card className="story-prose p-6 md:p-10">
                {String(story.content)
                  .split(/\n\s*\n/)
                  .map((paragraph: string, index: number) =>
                    paragraph.startsWith("# ") ? null : (
                      <p key={index}>{paragraph}</p>
                    )
                  )}
              </Card>
            </TabsContent>

            <TabsContent value="process">
              <div className="grid gap-5 md:grid-cols-2">
                <Card className="p-6">
                  <h2 className="flex items-center gap-2 text-lg font-bold">
                    <Brain className="h-5 w-5 text-primary" />
                    Creative signal snapshot
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Legacy heuristic values recorded by the workflow. They are
                    not scientific measurements.
                  </p>
                  <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                    {[
                      ["Harmony", story.ucfHarmony],
                      ["Energy", story.ucfPrana],
                      ["Focus", story.ucfDrishti],
                      ["Friction", story.ucfKlesha],
                      ["Resilience", story.ucfResilience],
                      ["Scope", story.ucfZoom],
                    ].map(([label, value]) => (
                      <div
                        key={String(label)}
                        className="rounded-lg border border-border/50 p-3"
                      >
                        <dt className="text-muted-foreground">{label}</dt>
                        <dd className="mt-1 font-mono">
                          {Number(value).toFixed(2)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </Card>
                <Card className="p-6">
                  <h2 className="text-lg font-bold">Agent contributions</h2>
                  <div className="mt-5 space-y-3">
                    {contributions.length > 0 ? (
                      contributions.map(contribution => (
                        <div
                          key={contribution.name}
                          className="rounded-lg border border-border/50 p-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <strong className="capitalize">
                              {contribution.name}
                            </strong>
                            {contribution.provider && (
                              <span className="status-pill">
                                {contribution.provider}
                              </span>
                            )}
                          </div>
                          {contribution.role && (
                            <p className="mt-1 text-sm text-muted-foreground">
                              {contribution.role}
                            </p>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No contribution metadata was recorded.
                      </p>
                    )}
                  </div>
                </Card>
                {trajectoryQuery.data && trajectoryQuery.data.length > 0 && (
                  <Card className="p-6 md:col-span-2">
                    <h2 className="text-lg font-bold">Recorded trajectory</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {trajectoryQuery.data.length} workflow snapshots are
                      available from the legacy engine.
                    </p>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="logs">
              <div className="space-y-4">
                {agentLogsQuery.isLoading ? (
                  <Card className="p-8 text-center text-muted-foreground">
                    Loading logs…
                  </Card>
                ) : agentLogsQuery.data && agentLogsQuery.data.length > 0 ? (
                  agentLogsQuery.data.map(log => (
                    <Card key={log.id} className="p-6">
                      <div className="flex items-center gap-3">
                        <span className="text-xl" aria-hidden="true">
                          {log.agentSymbol}
                        </span>
                        <div>
                          <h2 className="font-bold">{log.agentName}</h2>
                          <p className="text-sm text-muted-foreground">
                            {log.role}
                          </p>
                        </div>
                      </div>
                      <p className="mt-4 whitespace-pre-wrap border-t border-border/50 pt-4 text-sm leading-6">
                        {log.content}
                      </p>
                    </Card>
                  ))
                ) : (
                  <Card className="p-10 text-center">
                    <p className="text-muted-foreground">
                      No detailed agent logs were stored for this draft.
                    </p>
                  </Card>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </article>
      </main>
    </div>
  );
}

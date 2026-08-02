import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Brain,
  Calendar,
  CircleAlert,
  Download,
  FileText,
  History,
  Loader2,
  Pencil,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { Link, useLocation, useParams } from "wouter";
import { CHAPTER_STATUS_LABELS } from "@shared/chapterPlanning";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
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
  const utils = trpc.useUtils();
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const storyQuery = trpc.stories.getByRitualId.useQuery(
    { ritualId },
    { enabled: Boolean(ritualId), retry: false }
  );
  const story = storyQuery.data;
  const contributions = normalizeContributions(story?.agentContributions);
  const hasGenerationProcess = contributions.length > 0;
  const revisionsQuery = trpc.stories.revisions.useQuery(
    { storyId: story?.id ?? 0 },
    { enabled: Boolean(story?.id), retry: false }
  );
  const trajectoryQuery = trpc.stories.getUcfTrajectory.useQuery(
    { ritualId },
    { enabled: Boolean(story?.ritualId) && hasGenerationProcess, retry: false }
  );
  const agentLogsQuery = trpc.stories.getAgentLogs.useQuery(
    { ritualId },
    { enabled: Boolean(story?.ritualId) && hasGenerationProcess, retry: false }
  );
  const updateMutation = trpc.stories.update.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.stories.getByRitualId.invalidate({ ritualId }),
        story
          ? utils.stories.revisions.invalidate({ storyId: story.id })
          : Promise.resolve(),
        story?.projectId
          ? utils.projects.get.invalidate({ id: story.projectId })
          : Promise.resolve(),
        story?.projectId ? utils.projects.list.invalidate() : Promise.resolve(),
      ]);
      setIsEditing(false);
    },
  });
  const restoreMutation = trpc.stories.restoreRevision.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.stories.getByRitualId.invalidate({ ritualId }),
        story
          ? utils.stories.revisions.invalidate({ storyId: story.id })
          : Promise.resolve(),
      ]);
    },
  });

  useEffect(() => {
    if (!story || isEditing) return;
    setEditTitle(story.title);
    setEditContent(story.content);
  }, [isEditing, story]);

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

  const isDemo = contributions.some(
    contribution => contribution.provider === "demo"
  );
  const hasQualityReview = contributions.some(
    contribution =>
      contribution.name === "claude" && contribution.provider !== "demo"
  );
  const hasSafetyReview = contributions.some(
    contribution =>
      contribution.name === "kavach" && contribution.provider !== "demo"
  );
  const hasManuscript = Boolean(story.content.trim());
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
              href="/projects"
              className="text-muted-foreground hover:text-foreground"
            >
              Projects
            </Link>
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
              <Badge variant="outline">
                {CHAPTER_STATUS_LABELS[story.draftStatus]}
              </Badge>
            </div>
            <h1 className="max-w-4xl text-4xl font-bold tracking-tight md:text-5xl">
              {story.title}
            </h1>
            <p className="max-w-3xl text-base leading-7 text-muted-foreground">
              {story.synopsis || story.prompt}
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">
                <FileText className="mr-1 h-3 w-3" />
                {story.wordCount} words
              </Badge>
              {isDemo || hasQualityReview ? (
                <Badge variant="outline">
                  <Sparkles className="mr-1 h-3 w-3" />
                  {Math.round(story.qualityScore * 100)}%{" "}
                  {isDemo ? "template score" : "automated quality score"}
                </Badge>
              ) : null}
              {hasSafetyReview && story.ethicalApproval && (
                <Badge variant="outline">
                  <ShieldCheck className="mr-1 h-3 w-3" />
                  Safety review flag: pass
                </Badge>
              )}
              <Badge variant="outline">
                <Calendar className="mr-1 h-3 w-3" />
                {new Date(story.createdAt).toLocaleDateString()}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={handleDownload}
                variant="outline"
                disabled={!hasManuscript}
              >
                <Download className="mr-2 h-4 w-4" />
                Download Markdown
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsEditing(current => !current)}
              >
                <Pencil className="mr-2 h-4 w-4" />
                {isEditing
                  ? "Cancel edit"
                  : hasManuscript
                    ? "Edit draft"
                    : "Start writing"}
              </Button>
              {hasManuscript ? (
                <Button
                  onClick={() =>
                    setLocation(`/generate?previousStoryId=${story.id}`)
                  }
                >
                  <Zap className="mr-2 h-4 w-4" />
                  Continue story
                </Button>
              ) : story.projectId ? (
                <Button
                  onClick={() =>
                    setLocation(`/generate?targetStoryId=${story.id}`)
                  }
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Draft with studio
                </Button>
              ) : null}
            </div>
            {updateMutation.error && (
              <p role="alert" className="text-sm text-destructive">
                {updateMutation.error.message}
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
            <TabsList
              className={`grid w-full ${
                hasGenerationProcess ? "grid-cols-4" : "grid-cols-2"
              }`}
            >
              <TabsTrigger value="story">Draft</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              {hasGenerationProcess ? (
                <>
                  <TabsTrigger value="process">Process</TabsTrigger>
                  <TabsTrigger value="logs">Logs</TabsTrigger>
                </>
              ) : null}
            </TabsList>

            <TabsContent value="story">
              {isEditing ? (
                <Card className="space-y-5 p-6 md:p-8">
                  <div className="space-y-2">
                    <label
                      htmlFor="draft-title"
                      className="text-sm font-semibold"
                    >
                      Title
                    </label>
                    <Input
                      id="draft-title"
                      value={editTitle}
                      maxLength={255}
                      onChange={event => setEditTitle(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="draft-content"
                      className="text-sm font-semibold"
                    >
                      Manuscript
                    </label>
                    <Textarea
                      id="draft-content"
                      value={editContent}
                      maxLength={500_000}
                      rows={28}
                      onChange={event => setEditContent(event.target.value)}
                      className="min-h-[34rem] resize-y font-serif text-base leading-8"
                    />
                    <p className="text-xs text-muted-foreground">
                      {editContent
                        .split(/\s+/)
                        .filter(Boolean)
                        .length.toLocaleString()}{" "}
                      words · saving creates a recoverable revision
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      disabled={!editTitle.trim() || updateMutation.isPending}
                      onClick={() =>
                        updateMutation.mutate({
                          id: story.id,
                          title: editTitle.trim(),
                          content: editContent,
                        })
                      }
                    >
                      {updateMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      Save revision
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setIsEditing(false)}
                    >
                      Discard unsaved changes
                    </Button>
                  </div>
                </Card>
              ) : (
                <Card className="story-prose p-6 md:p-10">
                  {hasManuscript ? (
                    String(story.content)
                      .split(/\n\s*\n/)
                      .map((paragraph: string, index: number) =>
                        paragraph.startsWith("# ") ? null : (
                          <p key={index}>{paragraph}</p>
                        )
                      )
                  ) : (
                    <div className="py-16 text-center">
                      <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
                      <h2 className="mt-4 text-xl font-bold">
                        This chapter is ready to write
                      </h2>
                      <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
                        The plan is saved without placeholder prose. Start with
                        a blank manuscript whenever you are ready.
                      </p>
                      <Button
                        className="mt-5"
                        onClick={() => setIsEditing(true)}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Start writing
                      </Button>
                    </div>
                  )}
                </Card>
              )}
            </TabsContent>

            <TabsContent value="history">
              <Card className="p-6 md:p-8">
                <h2 className="flex items-center gap-2 text-lg font-bold">
                  <History className="h-5 w-5 text-primary" />
                  Revision history
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Every save snapshots the prior manuscript. Restoring also
                  preserves the current version.
                </p>
                {revisionsQuery.isLoading ? (
                  <p className="mt-6 text-sm text-muted-foreground">
                    Loading revisions…
                  </p>
                ) : revisionsQuery.data && revisionsQuery.data.length > 0 ? (
                  <div className="mt-6 space-y-3">
                    {revisionsQuery.data.map(revision => (
                      <div
                        key={revision.id}
                        className="flex flex-col gap-3 rounded-lg border border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <strong>{revision.title}</strong>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {new Date(revision.createdAt).toLocaleString()} ·{" "}
                            {revision.reason.replaceAll("-", " ")} ·{" "}
                            {revision.content
                              .split(/\s+/)
                              .filter(Boolean)
                              .length.toLocaleString()}{" "}
                            words
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={restoreMutation.isPending}
                          onClick={() => {
                            if (
                              window.confirm(
                                "Restore this revision? The current manuscript will be preserved in history."
                              )
                            ) {
                              restoreMutation.mutate({
                                storyId: story.id,
                                revisionId: revision.id,
                              });
                            }
                          }}
                        >
                          <RotateCcw className="mr-2 h-4 w-4" />
                          Restore
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-6 text-sm text-muted-foreground">
                    No revisions yet. The first changed save will preserve the
                    prior manuscript here, including a blank planned draft.
                  </p>
                )}
                {restoreMutation.error ? (
                  <p role="alert" className="mt-4 text-sm text-destructive">
                    {restoreMutation.error.message}
                  </p>
                ) : null}
              </Card>
            </TabsContent>

            {hasGenerationProcess ? (
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
                      {contributions.map(contribution => (
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
                      ))}
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
            ) : null}

            {hasGenerationProcess ? (
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
            ) : null}
          </Tabs>
        </article>
      </main>
    </div>
  );
}

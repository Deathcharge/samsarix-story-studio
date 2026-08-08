import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  FilePenLine,
  GripVertical,
  Loader2,
  Plus,
  Save,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import {
  CHAPTER_STATUSES,
  CHAPTER_STATUS_LABELS,
  type ChapterStatus,
} from "@shared/chapterPlanning";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ScenePlan, type SceneCardData } from "@/components/ScenePlan";

type Chapter = {
  id: number;
  title: string;
  prompt: string;
  ritualId: string;
  wordCount: number;
  updatedAt: Date;
  chapterNumber: number | null;
  draftStatus: ChapterStatus;
  synopsis: string | null;
  canDraftWithStudio: boolean;
  scenes: SceneCardData[];
};

function PlanningEditor({
  chapter,
  disabled,
  onSave,
}: {
  chapter: Chapter;
  disabled: boolean;
  onSave: (draftStatus: ChapterStatus, synopsis: string) => void;
}) {
  const [draftStatus, setDraftStatus] = useState(chapter.draftStatus);
  const [synopsis, setSynopsis] = useState(chapter.synopsis ?? "");

  useEffect(() => {
    setDraftStatus(chapter.draftStatus);
    setSynopsis(chapter.synopsis ?? "");
  }, [chapter.draftStatus, chapter.synopsis]);

  const changed =
    draftStatus !== chapter.draftStatus ||
    synopsis.trim() !== (chapter.synopsis ?? "");

  return (
    <details className="mt-4 rounded-lg border border-border/60 p-3">
      <summary className="cursor-pointer text-sm font-semibold">
        Planning details
      </summary>
      <div className="mt-4 space-y-3">
        <div className="space-y-2">
          <label
            htmlFor={`chapter-status-${chapter.id}`}
            className="text-xs font-semibold"
          >
            Draft status
          </label>
          <select
            id={`chapter-status-${chapter.id}`}
            value={draftStatus}
            onChange={event =>
              setDraftStatus(event.target.value as ChapterStatus)
            }
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {CHAPTER_STATUSES.map(status => (
              <option key={status} value={status}>
                {CHAPTER_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label
            htmlFor={`chapter-synopsis-${chapter.id}`}
            className="text-xs font-semibold"
          >
            Synopsis or chapter intent
          </label>
          <Textarea
            id={`chapter-synopsis-${chapter.id}`}
            value={synopsis}
            maxLength={4_000}
            rows={4}
            placeholder="What changes in this chapter?"
            onChange={event => setSynopsis(event.target.value)}
          />
        </div>
        <Button
          size="sm"
          disabled={!changed || disabled}
          onClick={() => onSave(draftStatus, synopsis.trim())}
        >
          {disabled ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save planning
        </Button>
      </div>
    </details>
  );
}

export function ChapterBoard({
  projectId,
  stories,
}: {
  projectId: number;
  stories: Chapter[];
}) {
  const utils = trpc.useUtils();
  const [orderedStories, setOrderedStories] = useState(stories);
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newSynopsis, setNewSynopsis] = useState("");

  useEffect(() => setOrderedStories(stories), [stories]);

  const refresh = async () => {
    await Promise.all([
      utils.projects.get.invalidate({ id: projectId }),
      utils.projects.list.invalidate(),
      utils.stories.list.invalidate(),
    ]);
  };
  const createPlan = trpc.projects.createChapterPlan.useMutation({
    onSuccess: async () => {
      setNewTitle("");
      setNewSynopsis("");
      await refresh();
      toast.success("Chapter plan added");
    },
  });
  const updatePlanning = trpc.projects.updateChapterPlanning.useMutation({
    onSuccess: async () => {
      await refresh();
      toast.success("Chapter planning saved");
    },
  });
  const reorder = trpc.projects.reorderChapters.useMutation({
    onSuccess: async () => {
      await refresh();
      toast.success("Chapter order saved");
    },
    onError: () => setOrderedStories(stories),
  });

  const statusCounts = useMemo(
    () =>
      Object.fromEntries(
        CHAPTER_STATUSES.map(status => [
          status,
          orderedStories.filter(story => story.draftStatus === status).length,
        ])
      ) as Record<ChapterStatus, number>,
    [orderedStories]
  );

  const saveOrder = (next: Chapter[]) => {
    if (reorder.isPending) return;
    setOrderedStories(next);
    reorder.mutate({
      projectId,
      orderedStoryIds: next.map(story => story.id),
    });
  };

  const moveChapter = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= orderedStories.length) return;
    const next = [...orderedStories];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    saveOrder(next);
  };

  const dropChapter = (targetId: number) => {
    if (draggedId === null || draggedId === targetId) return;
    const next = [...orderedStories];
    const fromIndex = next.findIndex(story => story.id === draggedId);
    const targetIndex = next.findIndex(story => story.id === targetId);
    if (fromIndex < 0 || targetIndex < 0) return;
    const [moved] = next.splice(fromIndex, 1);
    const insertionIndex = next.findIndex(story => story.id === targetId);
    if (insertionIndex < 0) return;
    next.splice(insertionIndex, 0, moved);
    setDraggedId(null);
    saveOrder(next);
  };

  const error = createPlan.error ?? updatePlanning.error ?? reorder.error;
  const planningPending = updatePlanning.isPending;

  return (
    <section aria-labelledby="chapters-heading" className="space-y-4">
      <div>
        <p className="eyebrow">Manuscript board</p>
        <h2 id="chapters-heading" className="mt-2 text-2xl font-bold">
          Chapters
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Plan empty chapters, track their drafting state, and reorder the
          manuscript without breaking its continuation links.
        </p>
      </div>

      {orderedStories.length > 0 ? (
        <div
          role="group"
          className="flex flex-wrap gap-2"
          aria-label="Chapter status totals"
        >
          {CHAPTER_STATUSES.map(status => (
            <Badge key={status} variant="outline">
              {statusCounts[status]}{" "}
              {CHAPTER_STATUS_LABELS[status].toLowerCase()}
            </Badge>
          ))}
        </div>
      ) : null}

      <Card className="space-y-4 border-primary/20 p-5">
        <div>
          <h3 className="font-bold">Add a chapter plan</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Start with an empty, editable chapter. AI generation is optional.
          </p>
        </div>
        <div className="space-y-2">
          <label
            htmlFor="planned-chapter-title"
            className="text-sm font-semibold"
          >
            Working title
          </label>
          <Input
            id="planned-chapter-title"
            value={newTitle}
            maxLength={255}
            placeholder={`Chapter ${orderedStories.length + 1}`}
            onChange={event => setNewTitle(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label
            htmlFor="planned-chapter-synopsis"
            className="text-sm font-semibold"
          >
            Synopsis or intent (optional)
          </label>
          <Textarea
            id="planned-chapter-synopsis"
            value={newSynopsis}
            maxLength={4_000}
            rows={3}
            placeholder="The protagonist discovers…"
            onChange={event => setNewSynopsis(event.target.value)}
          />
        </div>
        <Button
          disabled={!newTitle.trim() || createPlan.isPending}
          onClick={() =>
            createPlan.mutate({
              projectId,
              title: newTitle.trim(),
              synopsis: newSynopsis.trim() || undefined,
            })
          }
        >
          {createPlan.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          Add planned chapter
        </Button>
      </Card>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error.message}
        </p>
      ) : null}

      {orderedStories.length > 0 ? (
        <div className="space-y-3" aria-busy={reorder.isPending}>
          {orderedStories.map((story, index) => (
            <Card
              key={story.id}
              draggable={!reorder.isPending}
              onDragStart={() => setDraggedId(story.id)}
              onDragEnd={() => setDraggedId(null)}
              onDragOver={event => event.preventDefault()}
              onDrop={() => dropChapter(story.id)}
              className={`story-card p-5 ${
                draggedId === story.id ? "opacity-60" : ""
              }`}
            >
              <div className="flex items-start gap-3">
                <GripVertical
                  className="mt-1 hidden h-5 w-5 shrink-0 cursor-grab text-muted-foreground sm:block"
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">
                      Chapter {index + 1}
                    </p>
                    <Badge variant="outline">
                      {CHAPTER_STATUS_LABELS[story.draftStatus]}
                    </Badge>
                  </div>
                  <Link
                    href={`/story/${story.ritualId}`}
                    className="group mt-2 inline-flex items-center gap-2 text-lg font-bold hover:text-primary"
                  >
                    {story.title}
                    <FilePenLine className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                  </Link>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {story.synopsis || story.prompt}
                  </p>
                  <p className="mt-4 text-xs text-muted-foreground">
                    {story.wordCount.toLocaleString()} words · edited{" "}
                    {new Date(story.updatedAt).toLocaleDateString()}
                  </p>
                  {story.canDraftWithStudio ? (
                    <Button asChild size="sm" className="mt-4">
                      <Link href={`/generate?targetStoryId=${story.id}`}>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Draft this plan
                      </Link>
                    </Button>
                  ) : null}
                  <PlanningEditor
                    chapter={story}
                    disabled={
                      planningPending &&
                      updatePlanning.variables?.storyId === story.id
                    }
                    onSave={(draftStatus, synopsis) =>
                      updatePlanning.mutate({
                        projectId,
                        storyId: story.id,
                        draftStatus,
                        synopsis,
                      })
                    }
                  />
                  <ScenePlan
                    projectId={projectId}
                    storyId={story.id}
                    scenes={story.scenes}
                  />
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={index === 0 || reorder.isPending}
                    aria-label={`Move ${story.title} earlier`}
                    onClick={() => moveChapter(index, -1)}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={
                      index === orderedStories.length - 1 || reorder.isPending
                    }
                    aria-label={`Move ${story.title} later`}
                    onClick={() => moveChapter(index, 1)}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
          <p className="text-xs text-muted-foreground">
            Drag cards on desktop, or use the up and down buttons with touch or
            a keyboard. Each move is saved immediately.
          </p>
        </div>
      ) : (
        <Card className="p-8 text-center">
          <h3 className="text-lg font-bold">The manuscript is empty</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Add a chapter plan above, or generate a first draft from the studio.
          </p>
          <Button asChild variant="outline" className="mt-5">
            <Link href={`/generate?projectId=${projectId}`}>
              Open generation studio
            </Link>
          </Button>
        </Card>
      )}
    </section>
  );
}

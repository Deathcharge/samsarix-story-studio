import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  MapPin,
  Plus,
  Save,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";

export type SceneCardData = {
  id: number;
  title: string;
  summary: string;
  position: number;
  pov: string | null;
  location: string | null;
};

function SceneEditor({
  scene,
  disabled,
  onSave,
  onDelete,
}: {
  scene: SceneCardData;
  disabled: boolean;
  onSave: (fields: Omit<SceneCardData, "id" | "position">) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(scene.title);
  const [summary, setSummary] = useState(scene.summary);
  const [pov, setPov] = useState(scene.pov ?? "");
  const [location, setLocation] = useState(scene.location ?? "");

  useEffect(() => {
    setTitle(scene.title);
    setSummary(scene.summary);
    setPov(scene.pov ?? "");
    setLocation(scene.location ?? "");
  }, [scene.location, scene.pov, scene.summary, scene.title]);

  const changed =
    title.trim() !== scene.title ||
    summary.trim() !== scene.summary ||
    pov.trim() !== (scene.pov ?? "") ||
    location.trim() !== (scene.location ?? "");

  return (
    <details className="mt-3 rounded-md border border-border/50 p-3">
      <summary className="cursor-pointer text-xs font-semibold">
        Edit scene
      </summary>
      <div className="mt-3 space-y-3">
        <div className="space-y-1">
          <label
            htmlFor={`scene-title-${scene.id}`}
            className="text-xs font-semibold"
          >
            Scene title
          </label>
          <Input
            id={`scene-title-${scene.id}`}
            value={title}
            maxLength={255}
            onChange={event => setTitle(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label
            htmlFor={`scene-summary-${scene.id}`}
            className="text-xs font-semibold"
          >
            Beat or outcome
          </label>
          <Textarea
            id={`scene-summary-${scene.id}`}
            value={summary}
            maxLength={4_000}
            rows={3}
            onChange={event => setSummary(event.target.value)}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label
              htmlFor={`scene-pov-${scene.id}`}
              className="text-xs font-semibold"
            >
              Point of view (optional)
            </label>
            <Input
              id={`scene-pov-${scene.id}`}
              value={pov}
              maxLength={255}
              onChange={event => setPov(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label
              htmlFor={`scene-location-${scene.id}`}
              className="text-xs font-semibold"
            >
              Location (optional)
            </label>
            <Input
              id={`scene-location-${scene.id}`}
              value={location}
              maxLength={255}
              onChange={event => setLocation(event.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={!changed || !title.trim() || !summary.trim() || disabled}
            onClick={() =>
              onSave({
                title: title.trim(),
                summary: summary.trim(),
                pov: pov.trim() || null,
                location: location.trim() || null,
              })
            }
          >
            {disabled ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save scene
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => {
              if (window.confirm(`Delete the scene “${scene.title}”?`))
                onDelete();
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </Button>
        </div>
      </div>
    </details>
  );
}

export function ScenePlan({
  projectId,
  storyId,
  scenes,
}: {
  projectId: number;
  storyId: number;
  scenes: SceneCardData[];
}) {
  const utils = trpc.useUtils();
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const refresh = () => utils.projects.get.invalidate({ id: projectId });
  const createScene = trpc.projects.createScene.useMutation({
    onSuccess: async () => {
      setTitle("");
      setSummary("");
      await refresh();
      toast.success("Scene added");
    },
  });
  const updateScene = trpc.projects.updateScene.useMutation({
    onSuccess: async () => {
      await refresh();
      toast.success("Scene saved");
    },
  });
  const deleteScene = trpc.projects.deleteScene.useMutation({
    onSuccess: async () => {
      await refresh();
      toast.success("Scene removed");
    },
  });
  const reorderScenes = trpc.projects.reorderScenes.useMutation({
    onSuccess: refresh,
  });
  const error =
    createScene.error ??
    updateScene.error ??
    deleteScene.error ??
    reorderScenes.error;

  const moveScene = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= scenes.length || reorderScenes.isPending)
      return;
    const next = [...scenes];
    [next[index], next[target]] = [next[target], next[index]];
    reorderScenes.mutate({
      projectId,
      storyId,
      orderedSceneIds: next.map(scene => scene.id),
    });
  };

  return (
    <details className="mt-4 rounded-lg border border-primary/20 p-3">
      <summary className="cursor-pointer text-sm font-semibold">
        Scene plan ({scenes.length})
      </summary>
      <div className="mt-4 space-y-4">
        <p className="text-xs leading-5 text-muted-foreground">
          Ordered scene beats are writer-authored and included when this planned
          chapter is drafted with the studio.
        </p>
        {scenes.length > 0 ? (
          <ol className="space-y-3">
            {scenes.map((scene, index) => (
              <li key={scene.id}>
                <Card className="p-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-1 text-xs font-semibold text-primary">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-semibold">{scene.title}</h4>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {scene.summary}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {scene.pov ? (
                          <span className="flex items-center gap-1">
                            <UserRound className="h-3 w-3" /> {scene.pov}
                          </span>
                        ) : null}
                        {scene.location ? (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {scene.location}
                          </span>
                        ) : null}
                      </div>
                      <SceneEditor
                        scene={scene}
                        disabled={
                          updateScene.isPending || deleteScene.isPending
                        }
                        onSave={fields =>
                          updateScene.mutate({
                            id: scene.id,
                            projectId,
                            storyId,
                            title: fields.title,
                            summary: fields.summary,
                            pov: fields.pov ?? undefined,
                            location: fields.location ?? undefined,
                          })
                        }
                        onDelete={() =>
                          deleteScene.mutate({
                            id: scene.id,
                            projectId,
                            storyId,
                          })
                        }
                      />
                    </div>
                    <div className="flex shrink-0 flex-col">
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={index === 0 || reorderScenes.isPending}
                        aria-label={`Move ${scene.title} earlier`}
                        onClick={() => moveScene(index, -1)}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={
                          index === scenes.length - 1 || reorderScenes.isPending
                        }
                        aria-label={`Move ${scene.title} later`}
                        onClick={() => moveScene(index, 1)}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ol>
        ) : null}
        <div className="space-y-3 rounded-md border border-border/50 p-3">
          <h4 className="text-sm font-semibold">Add a scene</h4>
          <Input
            value={title}
            maxLength={255}
            placeholder="Scene title"
            aria-label="New scene title"
            onChange={event => setTitle(event.target.value)}
          />
          <Textarea
            value={summary}
            maxLength={4_000}
            rows={3}
            placeholder="What changes in this scene?"
            aria-label="New scene beat or outcome"
            onChange={event => setSummary(event.target.value)}
          />
          <Button
            size="sm"
            disabled={
              !title.trim() ||
              !summary.trim() ||
              scenes.length >= 100 ||
              createScene.isPending
            }
            onClick={() =>
              createScene.mutate({
                projectId,
                storyId,
                title: title.trim(),
                summary: summary.trim(),
              })
            }
          >
            {createScene.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Add scene
          </Button>
        </div>
        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {error.message}
          </p>
        ) : null}
      </div>
    </details>
  );
}

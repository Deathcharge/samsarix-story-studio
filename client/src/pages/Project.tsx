import { useEffect, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  CircleAlert,
  Download,
  FilePenLine,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Link, useParams } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";

type CanonKind = "character" | "location" | "faction" | "item" | "lore";

function download(name: string, contents: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function safeName(title: string) {
  return (
    title
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "project"
  );
}

export default function Project() {
  const params = useParams<{ id: string }>();
  const projectId = Number(params.id);
  const utils = trpc.useUtils();
  const projectQuery = trpc.projects.get.useQuery(
    { id: projectId },
    { enabled: Number.isInteger(projectId) && projectId > 0, retry: false }
  );
  const exportQuery = trpc.projects.export.useQuery(
    { id: projectId },
    { enabled: false, retry: false }
  );
  const [title, setTitle] = useState("");
  const [premise, setPremise] = useState("");
  const [genre, setGenre] = useState("");
  const [style, setStyle] = useState("");
  const [canonId, setCanonId] = useState<number | null>(null);
  const [canonKind, setCanonKind] = useState<CanonKind>("character");
  const [canonName, setCanonName] = useState("");
  const [canonContent, setCanonContent] = useState("");
  const [canonKeys, setCanonKeys] = useState("");
  const [alwaysInclude, setAlwaysInclude] = useState(false);
  const data = projectQuery.data;

  useEffect(() => {
    if (!data) return;
    setTitle(data.project.title);
    setPremise(data.project.premise);
    setGenre(data.project.genre ?? "");
    setStyle(data.project.style ?? "");
  }, [data]);

  const refresh = () => utils.projects.get.invalidate({ id: projectId });
  const updateProject = trpc.projects.update.useMutation({
    onSuccess: async () => {
      await refresh();
      await utils.projects.list.invalidate();
      toast.success("Project details saved");
    },
  });
  const createCanon = trpc.projects.createCanon.useMutation({
    onSuccess: async () => {
      resetCanonForm();
      await refresh();
      toast.success("Canon entry added");
    },
  });
  const updateCanon = trpc.projects.updateCanon.useMutation({
    onSuccess: async () => {
      resetCanonForm();
      await refresh();
      toast.success("Canon entry saved");
    },
  });
  const deleteCanon = trpc.projects.deleteCanon.useMutation({
    onSuccess: async () => {
      await refresh();
      toast.success("Canon entry removed");
    },
  });

  function resetCanonForm() {
    setCanonId(null);
    setCanonKind("character");
    setCanonName("");
    setCanonContent("");
    setCanonKeys("");
    setAlwaysInclude(false);
  }

  function editCanon(entry: NonNullable<typeof data>["canon"][number]) {
    setCanonId(entry.id);
    setCanonKind(entry.kind);
    setCanonName(entry.name);
    setCanonContent(entry.content);
    setCanonKeys(entry.activationKeys.join(", "));
    setAlwaysInclude(entry.alwaysInclude);
    document
      .getElementById("canon-editor")
      ?.scrollIntoView({ behavior: "smooth" });
  }

  const saveCanon = () => {
    const fields = {
      projectId,
      kind: canonKind,
      name: canonName.trim(),
      content: canonContent.trim(),
      activationKeys: canonKeys
        .split(",")
        .map(key => key.trim())
        .filter(Boolean),
      alwaysInclude,
    };
    if (canonId) updateCanon.mutate({ ...fields, id: canonId });
    else createCanon.mutate(fields);
  };

  const handleProjectExport = async () => {
    const result = await exportQuery.refetch();
    if (!result.data || !data) return;
    download(
      `${safeName(data.project.title)}.samsarix.json`,
      `${JSON.stringify(result.data, null, 2)}\n`,
      "application/json;charset=utf-8"
    );
  };

  const handleManuscriptExport = async () => {
    const result = await exportQuery.refetch();
    if (!result.data || !data) return;
    const manuscript = [
      `# ${data.project.title}`,
      data.project.premise,
      ...result.data.stories.map(story => `\n---\n\n${story.content}`),
    ].join("\n\n");
    download(
      `${safeName(data.project.title)}.md`,
      manuscript,
      "text/markdown;charset=utf-8"
    );
  };

  if (projectQuery.isLoading) {
    return (
      <main className="grid min-h-screen place-items-center" aria-busy="true">
        <Loader2
          className="h-8 w-8 animate-spin text-primary"
          aria-label="Loading project"
        />
      </main>
    );
  }

  if (projectQuery.error || !data) {
    return (
      <main className="grid min-h-screen place-items-center px-4">
        <Card
          className="max-w-lg space-y-4 border-destructive/30 p-8 text-center"
          role="alert"
        >
          <CircleAlert className="mx-auto h-10 w-10 text-destructive" />
          <h1 className="text-2xl font-bold">Project unavailable</h1>
          <p className="text-muted-foreground">
            {projectQuery.error?.message ?? "This project was not found."}
          </p>
          <Button asChild>
            <Link href="/projects">Back to projects</Link>
          </Button>
        </Card>
      </main>
    );
  }

  const canonPending = createCanon.isPending || updateCanon.isPending;
  const canonError =
    createCanon.error ?? updateCanon.error ?? deleteCanon.error;

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
            <Link href="/projects" className="font-medium text-primary">
              Projects
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

      <main className="container py-8 md:py-12">
        <div className="mx-auto max-w-6xl space-y-8">
          <Button asChild variant="ghost" size="sm">
            <Link href="/projects">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Projects
            </Link>
          </Button>
          <section className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="eyebrow">Manuscript workspace</p>
              <h1 className="mt-2 text-4xl font-bold tracking-tight md:text-5xl">
                {data.project.title}
              </h1>
              <p className="mt-3 max-w-3xl leading-7 text-muted-foreground">
                {data.project.premise}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {data.project.genre ? (
                  <Badge variant="outline">{data.project.genre}</Badge>
                ) : null}
                <Badge variant="outline">
                  {data.stories.length}{" "}
                  {data.stories.length === 1 ? "chapter" : "chapters"}
                </Badge>
                <Badge variant="outline">
                  {data.canon.length}{" "}
                  {data.canon.length === 1 ? "canon entry" : "canon entries"}
                </Badge>
                <Badge variant="outline">
                  {data.stories
                    .reduce((sum, story) => sum + story.wordCount, 0)
                    .toLocaleString()}{" "}
                  words
                </Badge>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={handleManuscriptExport}
                disabled={data.stories.length === 0 || exportQuery.isFetching}
              >
                <Download className="mr-2 h-4 w-4" />
                Markdown
              </Button>
              <Button
                variant="outline"
                onClick={handleProjectExport}
                disabled={exportQuery.isFetching}
              >
                <Download className="mr-2 h-4 w-4" />
                Backup JSON
              </Button>
              <Button asChild>
                <Link href={`/generate?projectId=${projectId}`}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Draft chapter
                </Link>
              </Button>
            </div>
          </section>
          {exportQuery.error ? (
            <p role="alert" className="text-sm text-destructive">
              Export failed: {exportQuery.error.message}
            </p>
          ) : null}

          <details className="rounded-xl border border-border bg-card/60 p-5">
            <summary className="cursor-pointer font-semibold">
              Project brief and style
            </summary>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="edit-title" className="text-sm font-semibold">
                  Title
                </label>
                <Input
                  id="edit-title"
                  value={title}
                  maxLength={255}
                  onChange={event => setTitle(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="edit-genre" className="text-sm font-semibold">
                  Genre
                </label>
                <Input
                  id="edit-genre"
                  value={genre}
                  maxLength={100}
                  onChange={event => setGenre(event.target.value)}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label htmlFor="edit-premise" className="text-sm font-semibold">
                  Premise
                </label>
                <Textarea
                  id="edit-premise"
                  value={premise}
                  maxLength={4_000}
                  rows={4}
                  onChange={event => setPremise(event.target.value)}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label htmlFor="edit-style" className="text-sm font-semibold">
                  Style guidance
                </label>
                <Textarea
                  id="edit-style"
                  value={style}
                  maxLength={2_000}
                  rows={3}
                  onChange={event => setStyle(event.target.value)}
                />
              </div>
            </div>
            {updateProject.error ? (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {updateProject.error.message}
              </p>
            ) : null}
            <Button
              className="mt-4"
              disabled={
                !title.trim() || !premise.trim() || updateProject.isPending
              }
              onClick={() =>
                updateProject.mutate({
                  id: projectId,
                  title: title.trim(),
                  premise: premise.trim(),
                  genre: genre.trim() || undefined,
                  style: style.trim() || undefined,
                })
              }
            >
              <Save className="mr-2 h-4 w-4" />
              Save project
            </Button>
          </details>

          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <section aria-labelledby="chapters-heading" className="space-y-4">
              <div>
                <p className="eyebrow">Manuscript</p>
                <h2 id="chapters-heading" className="mt-2 text-2xl font-bold">
                  Chapters
                </h2>
              </div>
              {data.stories.length > 0 ? (
                data.stories.map(story => (
                  <Link
                    key={story.id}
                    href={`/story/${story.ritualId}`}
                    className="group block"
                  >
                    <Card className="story-card p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">
                            Chapter {story.chapterNumber ?? "—"}
                          </p>
                          <h3 className="mt-2 text-lg font-bold group-hover:text-primary">
                            {story.title}
                          </h3>
                        </div>
                        <FilePenLine className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">
                        {story.prompt}
                      </p>
                      <p className="mt-4 text-xs text-muted-foreground">
                        {story.wordCount.toLocaleString()} words · edited{" "}
                        {new Date(story.updatedAt).toLocaleDateString()}
                      </p>
                    </Card>
                  </Link>
                ))
              ) : (
                <Card className="p-10 text-center">
                  <BookOpen className="mx-auto h-10 w-10 text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-bold">
                    The manuscript is empty
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Add canon first, or draft chapter one now.
                  </p>
                  <Button asChild className="mt-5">
                    <Link href={`/generate?projectId=${projectId}`}>
                      Draft chapter one
                    </Link>
                  </Button>
                </Card>
              )}
            </section>

            <section aria-labelledby="canon-heading" className="space-y-4">
              <div>
                <p className="eyebrow">Source of truth</p>
                <h2 id="canon-heading" className="mt-2 text-2xl font-bold">
                  Canon
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Only always-on, keyword-matched, or manually selected entries
                  are sent during generation.
                </p>
              </div>
              <Card
                id="canon-editor"
                className="space-y-4 border-primary/20 p-5"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-bold">
                    {canonId ? "Edit canon entry" : "Add canon entry"}
                  </h3>
                  {canonId ? (
                    <Button variant="ghost" size="sm" onClick={resetCanonForm}>
                      Cancel
                    </Button>
                  ) : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-[0.4fr_1fr]">
                  <div className="space-y-2">
                    <label
                      htmlFor="canon-kind"
                      className="text-sm font-semibold"
                    >
                      Type
                    </label>
                    <select
                      id="canon-kind"
                      value={canonKind}
                      onChange={event =>
                        setCanonKind(event.target.value as CanonKind)
                      }
                      className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                    >
                      {["character", "location", "faction", "item", "lore"].map(
                        kind => (
                          <option
                            key={kind}
                            value={kind}
                            className="bg-background capitalize"
                          >
                            {kind}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="canon-name"
                      className="text-sm font-semibold"
                    >
                      Name
                    </label>
                    <Input
                      id="canon-name"
                      value={canonName}
                      maxLength={255}
                      onChange={event => setCanonName(event.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="canon-content"
                    className="text-sm font-semibold"
                  >
                    Established facts
                  </label>
                  <Textarea
                    id="canon-content"
                    value={canonContent}
                    maxLength={8_000}
                    rows={5}
                    onChange={event => setCanonContent(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="canon-keys" className="text-sm font-semibold">
                    Activation keys
                  </label>
                  <Input
                    id="canon-keys"
                    value={canonKeys}
                    maxLength={1_620}
                    placeholder="Mara, Captain Venn, the courier"
                    onChange={event => setCanonKeys(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Comma-separated. The entry activates when the premise
                    contains one of these names or phrases.
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={alwaysInclude}
                    onChange={event => setAlwaysInclude(event.target.checked)}
                  />
                  Always include in project context
                </label>
                {canonError ? (
                  <p role="alert" className="text-sm text-destructive">
                    {canonError.message}
                  </p>
                ) : null}
                <Button
                  className="w-full"
                  disabled={
                    !canonName.trim() || !canonContent.trim() || canonPending
                  }
                  onClick={saveCanon}
                >
                  {canonPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : canonId ? (
                    <Save className="mr-2 h-4 w-4" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  {canonId ? "Save entry" : "Add to canon"}
                </Button>
              </Card>

              <div className="space-y-3">
                {data.canon.map(entry => (
                  <Card key={entry.id} className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="capitalize">
                            {entry.kind}
                          </Badge>
                          {entry.alwaysInclude ? (
                            <Badge>Always on</Badge>
                          ) : null}
                        </div>
                        <h3 className="mt-3 font-bold">{entry.name}</h3>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => editCanon(entry)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Delete ${entry.name}`}
                          disabled={deleteCanon.isPending}
                          onClick={() => {
                            if (
                              window.confirm(
                                `Remove ${entry.name} from this project's canon?`
                              )
                            )
                              deleteCanon.mutate({ id: entry.id, projectId });
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                      {entry.content}
                    </p>
                    {entry.activationKeys.length > 0 ? (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Activates on: {entry.activationKeys.join(", ")}
                      </p>
                    ) : null}
                  </Card>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

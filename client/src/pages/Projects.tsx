import { useState } from "react";
import {
  BookOpen,
  CircleAlert,
  FilePlus2,
  FolderOpen,
  Loader2,
  Sparkles,
  Zap,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";

export default function Projects() {
  const [, setLocation] = useLocation();
  const [title, setTitle] = useState("");
  const [premise, setPremise] = useState("");
  const [genre, setGenre] = useState("");
  const [style, setStyle] = useState("");
  const projectsQuery = trpc.projects.list.useQuery();
  const createMutation = trpc.projects.create.useMutation({
    onSuccess: project => setLocation(`/project/${project.id}`),
  });
  const canCreate = title.trim().length > 0 && premise.trim().length > 0;
  const hasProjects = Boolean(projectsQuery.data?.length);

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

      <main className="container py-10 md:py-14">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.75fr_1.25fr]">
          <section
            aria-labelledby="new-project-heading"
            className={hasProjects ? "order-2 lg:order-1" : undefined}
          >
            <Card className="sticky top-24 space-y-5 border-primary/20 p-6">
              <div>
                <p className="eyebrow">Start a manuscript</p>
                <h1
                  id="new-project-heading"
                  className="mt-2 text-2xl font-bold"
                >
                  New project
                </h1>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Group chapters with the characters, places, and rules that
                  must stay consistent.
                </p>
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="project-title"
                  className="text-sm font-semibold"
                >
                  Title
                </label>
                <Input
                  id="project-title"
                  value={title}
                  maxLength={255}
                  onChange={event => setTitle(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="project-premise"
                  className="text-sm font-semibold"
                >
                  Premise
                </label>
                <Textarea
                  id="project-premise"
                  value={premise}
                  maxLength={4_000}
                  rows={5}
                  onChange={event => setPremise(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="project-genre"
                  className="text-sm font-semibold"
                >
                  Genre{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </label>
                <Input
                  id="project-genre"
                  value={genre}
                  maxLength={100}
                  onChange={event => setGenre(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="project-style"
                  className="text-sm font-semibold"
                >
                  Style guidance{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </label>
                <Textarea
                  id="project-style"
                  value={style}
                  maxLength={2_000}
                  rows={3}
                  onChange={event => setStyle(event.target.value)}
                />
              </div>
              {createMutation.error ? (
                <p role="alert" className="text-sm text-destructive">
                  {createMutation.error.message}
                </p>
              ) : null}
              <Button
                className="w-full"
                disabled={!canCreate || createMutation.isPending}
                onClick={() =>
                  createMutation.mutate({
                    title: title.trim(),
                    premise: premise.trim(),
                    genre: genre.trim() || undefined,
                    style: style.trim() || undefined,
                  })
                }
              >
                {createMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FilePlus2 className="mr-2 h-4 w-4" />
                )}
                Create project
              </Button>
            </Card>
          </section>

          <section
            aria-labelledby="projects-heading"
            className={`space-y-5 ${hasProjects ? "order-1 lg:order-2" : ""}`}
          >
            <div>
              <p className="eyebrow">Your writing desk</p>
              <h2 id="projects-heading" className="mt-2 text-3xl font-bold">
                Projects
              </h2>
              <p className="mt-2 text-muted-foreground">
                Open a manuscript, update its canon, and keep drafting.
              </p>
            </div>
            {projectsQuery.isLoading ? (
              <Card
                className="grid min-h-48 place-items-center"
                aria-busy="true"
              >
                <Loader2
                  className="h-7 w-7 animate-spin text-primary"
                  aria-label="Loading projects"
                />
              </Card>
            ) : projectsQuery.error ? (
              <Card
                className="space-y-4 border-destructive/30 p-8 text-center"
                role="alert"
              >
                <CircleAlert className="mx-auto h-9 w-9 text-destructive" />
                <p>{projectsQuery.error.message}</p>
                <Button
                  variant="outline"
                  onClick={() => projectsQuery.refetch()}
                >
                  Try again
                </Button>
              </Card>
            ) : projectsQuery.data && projectsQuery.data.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {projectsQuery.data.map(project => (
                  <Link
                    key={project.id}
                    href={`/project/${project.id}`}
                    className="group block"
                  >
                    <Card className="story-card h-full p-6">
                      <div className="flex items-start justify-between gap-4">
                        <FolderOpen
                          className="h-6 w-6 text-primary"
                          aria-hidden="true"
                        />
                        <span className="text-xs text-muted-foreground">
                          {new Date(project.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <h3 className="mt-5 text-xl font-bold group-hover:text-primary">
                        {project.title}
                      </h3>
                      <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">
                        {project.premise}
                      </p>
                      <div className="mt-5 flex flex-wrap gap-3 border-t border-border/50 pt-4 text-xs text-muted-foreground">
                        <span>
                          {project.chapterCount}{" "}
                          {project.chapterCount === 1 ? "chapter" : "chapters"}
                        </span>
                        <span>
                          {project.canonCount}{" "}
                          {project.canonCount === 1
                            ? "canon entry"
                            : "canon entries"}
                        </span>
                        <span>{project.wordCount.toLocaleString()} words</span>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            ) : (
              <Card className="p-10 text-center">
                <BookOpen className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-xl font-bold">No projects yet</h3>
                <p className="mt-2 text-muted-foreground">
                  Create one here, or keep using standalone drafts.
                </p>
                <Button asChild variant="outline" className="mt-5">
                  <Link href="/generate">
                    <Sparkles className="mr-2 h-4 w-4" />
                    Standalone draft
                  </Link>
                </Button>
              </Card>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

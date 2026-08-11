import { useMemo, useState } from "react";
import {
  BookOpen,
  Calendar,
  CircleAlert,
  FileText,
  Search,
  Sparkles,
  Star,
  Tag,
  Zap,
} from "lucide-react";
import { Link } from "wouter";
import { CHAPTER_STATUS_LABELS } from "@shared/chapterPlanning";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";

export default function Archive() {
  const [query, setQuery] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [pendingFavoriteIds, setPendingFavoriteIds] = useState<Set<number>>(
    () => new Set()
  );
  const utils = trpc.useUtils();
  const storiesQuery = trpc.stories.list.useQuery();
  const organizationMutation = trpc.stories.updateOrganization.useMutation({
    onSuccess: () => utils.stories.list.invalidate(),
    onMutate: variables => {
      setPendingFavoriteIds(current => new Set(current).add(variables.id));
    },
    onSettled: (_data, _error, variables) => {
      setPendingFavoriteIds(current => {
        const next = new Set(current);
        next.delete(variables.id);
        return next;
      });
    },
  });
  const stories = storiesQuery.data ?? [];
  const filteredStories = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return stories.filter(story => {
      if (favoritesOnly && !story.isFavorite) return false;
      if (!needle) return true;
      return `${story.title} ${story.synopsis ?? ""} ${story.prompt} ${story.tags.join(" ")}`
        .toLowerCase()
        .includes(needle);
    });
  }, [favoritesOnly, query, stories]);

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
            <Link href="/archive" className="font-medium text-primary">
              Archive
            </Link>
          </nav>
        </div>
      </header>

      <main className="container py-10 md:py-14">
        <div className="mx-auto max-w-6xl space-y-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow">Local library</p>
              <h1 className="mt-2 text-3xl font-bold md:text-4xl">
                Story archive
              </h1>
              <p className="mt-2 text-muted-foreground">
                Reopen every planned, drafted, or revised chapter.
              </p>
            </div>
            <Button asChild>
              <Link href="/generate">
                <Sparkles className="mr-2 h-4 w-4" />
                New draft
              </Link>
            </Button>
          </div>

          {stories.length > 0 && (
            <div className="flex max-w-2xl flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Search titles, plans, premises, and tags"
                  className="pl-9"
                  aria-label="Search story archive"
                />
              </div>
              <Button
                variant={favoritesOnly ? "default" : "outline"}
                aria-pressed={favoritesOnly}
                onClick={() => setFavoritesOnly(current => !current)}
              >
                <Star
                  className={`mr-2 h-4 w-4 ${favoritesOnly ? "fill-current" : ""}`}
                />
                Favorites only
              </Button>
            </div>
          )}

          {storiesQuery.isLoading ? (
            <div
              className="grid gap-5 md:grid-cols-2 lg:grid-cols-3"
              aria-label="Loading stories"
            >
              {[1, 2, 3].map(item => (
                <Card key={item} className="h-64 animate-pulse bg-card/50" />
              ))}
            </div>
          ) : storiesQuery.error ? (
            <Card
              className="space-y-4 border-destructive/30 p-8 text-center"
              role="alert"
            >
              <CircleAlert className="mx-auto h-10 w-10 text-destructive" />
              <div>
                <h2 className="text-xl font-bold">
                  The archive could not be loaded
                </h2>
                <p className="mt-2 text-muted-foreground">
                  {storiesQuery.error.message}
                </p>
              </div>
              <Button onClick={() => storiesQuery.refetch()}>Try again</Button>
            </Card>
          ) : filteredStories.length > 0 ? (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {filteredStories.map(story => (
                <Card key={story.id} className="story-card h-full p-6">
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                      {story.seriesId
                        ? `Chapter ${story.chapterNumber ?? "—"}`
                        : "Standalone"}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`${story.isFavorite ? "Remove" : "Add"} ${story.title} ${story.isFavorite ? "from" : "to"} favorites`}
                      aria-pressed={story.isFavorite}
                      disabled={pendingFavoriteIds.has(story.id)}
                      onClick={() =>
                        organizationMutation.mutate({
                          id: story.id,
                          tags: story.tags,
                          isFavorite: !story.isFavorite,
                        })
                      }
                    >
                      <Star
                        className={`h-4 w-4 ${story.isFavorite ? "fill-current text-primary" : ""}`}
                      />
                    </Button>
                  </div>
                  <div className="mt-5">
                    <h2 className="line-clamp-2 text-xl font-bold">
                      <Link
                        href={`/story/${story.ritualId}`}
                        className="transition hover:text-primary"
                      >
                        {story.title}
                      </Link>
                    </h2>
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">
                      {story.synopsis || story.prompt}
                    </p>
                  </div>
                  <div className="mt-6 flex flex-wrap gap-2">
                    <Badge variant="outline">
                      <FileText className="mr-1 h-3 w-3" />
                      {story.wordCount} words
                    </Badge>
                    <Badge variant="outline">
                      {CHAPTER_STATUS_LABELS[story.draftStatus]}
                    </Badge>
                    {story.tags.map(tag => (
                      <Badge key={tag} variant="secondary">
                        <Tag className="mr-1 h-3 w-3" /> {tag}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-6 flex items-center justify-between border-t border-border/50 pt-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(story.createdAt).toLocaleDateString()}
                    </span>
                    <Link
                      href={`/story/${story.ritualId}`}
                      className="font-medium hover:text-primary"
                    >
                      Open draft
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          ) : stories.length > 0 ? (
            <Card className="p-10 text-center">
              <Search className="mx-auto h-10 w-10 text-muted-foreground" />
              <h2 className="mt-4 text-xl font-bold">No matching stories</h2>
              <p className="mt-2 text-muted-foreground">
                Try a title or a phrase from the original premise.
              </p>
            </Card>
          ) : (
            <Card className="p-12 text-center">
              <BookOpen className="mx-auto h-14 w-14 text-muted-foreground" />
              <h2 className="mt-5 text-xl font-bold">Your archive is empty</h2>
              <p className="mt-2 text-muted-foreground">
                Create a draft and it will be saved here automatically.
              </p>
              <Button asChild className="mt-6">
                <Link href="/generate">Create first draft</Link>
              </Button>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}

import { useMemo, useState } from "react";
import {
  BookOpen,
  Calendar,
  CircleAlert,
  FileText,
  Search,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";

export default function Archive() {
  const [query, setQuery] = useState("");
  const storiesQuery = trpc.stories.list.useQuery();
  const stories = storiesQuery.data ?? [];
  const filteredStories = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return stories;
    return stories.filter(story =>
      `${story.title} ${story.prompt}`.toLowerCase().includes(needle)
    );
  }, [query, stories]);

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
                Reopen, continue, or export every saved draft.
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
            <div className="relative max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search titles and premises"
                className="pl-9"
                aria-label="Search story archive"
              />
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
                <Link
                  key={story.id}
                  href={`/story/${story.ritualId}`}
                  className="group block h-full"
                >
                  <Card className="story-card h-full p-6">
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                        {story.seriesId
                          ? `Chapter ${story.chapterNumber ?? "—"}`
                          : "Standalone"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(story.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="mt-5">
                      <h2 className="line-clamp-2 text-xl font-bold transition group-hover:text-primary">
                        {story.title}
                      </h2>
                      <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">
                        {story.prompt}
                      </p>
                    </div>
                    <div className="mt-6 flex flex-wrap gap-2">
                      <Badge variant="outline">
                        <FileText className="mr-1 h-3 w-3" />
                        {story.wordCount} words
                      </Badge>
                      {story.ethicalApproval && (
                        <Badge variant="outline">
                          <ShieldCheck className="mr-1 h-3 w-3" />
                          Review passed
                        </Badge>
                      )}
                    </div>
                    <div className="mt-6 flex items-center justify-between border-t border-border/50 pt-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Saved locally
                      </span>
                      <span>
                        {Math.round(story.qualityScore * 100)}% advisory score
                      </span>
                    </div>
                  </Card>
                </Link>
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

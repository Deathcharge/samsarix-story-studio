import {
  ArrowRight,
  BookOpen,
  Braces,
  Database,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

export default function Home() {
  const { data: status } = trpc.system.status.useQuery();
  const isDemo = status?.mode !== "provider";

  return (
    <div className="min-h-screen overflow-hidden">
      <header className="relative z-40 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold tracking-tight"
          >
            <Zap className="h-5 w-5 text-primary" aria-hidden="true" />
            Samsarix Story Studio
          </Link>
          <nav
            aria-label="Primary navigation"
            className="flex items-center gap-3 sm:gap-5"
          >
            <Link
              href="/projects"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Projects
            </Link>
            <Link
              href="/archive"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Archive
            </Link>
            <Button asChild size="sm">
              <Link href="/generate">Open studio</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main>
        <section className="hero-grid relative border-b border-border/40">
          <div className="hero-orb hero-orb-one" aria-hidden="true" />
          <div className="hero-orb hero-orb-two" aria-hidden="true" />
          <div className="container relative grid gap-14 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-28">
            <div className="max-w-3xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Local-first fiction workshop
              </div>
              <h1 className="text-balance text-5xl font-bold leading-[1.02] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
                Keep the spark.
                <span className="block text-gradient">Give it structure.</span>
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
                Plan a project, keep its canon consistent, and turn sharp
                premises into editable chapters through a visible, bounded
                workflow. Your manuscript stays on your machine by default.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="group px-7 text-base">
                  <Link href="/generate">
                    {isDemo ? "Try the no-key demo" : "Create a draft"}
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="px-7 text-base"
                >
                  <Link href="/archive">
                    <BookOpen className="mr-2 h-4 w-4" />
                    Open archive
                  </Link>
                </Button>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                {isDemo
                  ? "No account, database, or provider key required in local mode. Demo output is clearly labeled."
                  : `Using ${status?.configuredProviders.join(", ")}. Provider usage is billed by your provider.`}
              </p>
            </div>

            <div className="workflow-card" aria-label="Story workflow preview">
              <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Current workflow
                  </p>
                  <p className="mt-1 font-semibold">
                    Project → canon → chapters
                  </p>
                </div>
                <span
                  className={`status-pill ${isDemo ? "" : "status-pill-live"}`}
                >
                  {isDemo ? "demo" : "provider"}
                </span>
              </div>
              <div className="space-y-3 p-5">
                {[
                  [
                    "01",
                    "Plot architecture",
                    "Clarify the want, obstacle, and reversal.",
                  ],
                  [
                    "02",
                    "Character pressure",
                    "Make the external problem personally costly.",
                  ],
                  [
                    "03",
                    "World constraints",
                    "Turn setting details into story mechanics.",
                  ],
                  [
                    "04",
                    "Synthesis + record",
                    "Create the draft and record the workflow used.",
                  ],
                ].map(([number, title, description]) => (
                  <div key={number} className="workflow-step">
                    <span>{number}</span>
                    <div>
                      <strong>{title}</strong>
                      <p>{description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="container py-20">
          <div className="max-w-2xl">
            <p className="eyebrow">A smaller, honest product</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Enough control to learn from the process.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Samsarix does not pretend a dashboard is a writing practice. It
              gives you a recoverable manuscript workspace, transparent context,
              and portable output.
            </p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            <article className="feature-card">
              <Braces className="h-6 w-6 text-primary" />
              <h3>See the context</h3>
              <p>
                Keep characters and world rules in canon, then preview exactly
                which entries a chapter will use.
              </p>
            </article>
            <article className="feature-card">
              <Database className="h-6 w-6 text-primary" />
              <h3>Own the archive</h3>
              <p>
                Projects, chapters, canon, and revisions persist locally and
                export as Markdown or a complete JSON backup.
              </p>
            </article>
            <article className="feature-card">
              <ShieldCheck className="h-6 w-6 text-primary" />
              <h3>Bound the spend</h3>
              <p>
                One active generation per user, finite timeouts and retries, and
                a documented call ceiling.
              </p>
            </article>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/50 py-8">
        <div className="container flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>Samsarix Story Studio · local-first preview</p>
          <p>No analytics in the default build.</p>
        </div>
      </footer>
    </div>
  );
}

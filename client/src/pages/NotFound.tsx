import { ArrowLeft, FileQuestion, Zap } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function NotFound() {
  return (
    <main className="container grid min-h-screen place-items-center py-12">
      <Card className="max-w-lg space-y-5 border-primary/20 p-8 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-primary/25 bg-primary/10">
          <FileQuestion className="h-7 w-7 text-primary" aria-hidden="true" />
        </div>
        <p className="eyebrow">404 · missing page</p>
        <h1 className="text-3xl font-bold tracking-tight">
          This thread ends here.
        </h1>
        <p className="text-muted-foreground">
          The page may have moved, or the story link may no longer exist in this
          local archive.
        </p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild>
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" /> Home
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/archive">
              <Zap className="mr-2 h-4 w-4" /> Open archive
            </Link>
          </Button>
        </div>
      </Card>
    </main>
  );
}

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

const Home = lazy(() => import("./pages/Home"));
const Generate = lazy(() => import("./pages/Generate"));
const Archive = lazy(() => import("./pages/Archive"));
const Story = lazy(() => import("./pages/Story"));

function PageFallback() {
  return (
    <main
      className="container grid min-h-screen place-items-center"
      aria-live="polite"
    >
      <p className="text-sm text-muted-foreground">Opening the studio…</p>
    </main>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/generate" component={Generate} />
        <Route path="/archive" component={Archive} />
        <Route path="/story/:id" component={Story} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

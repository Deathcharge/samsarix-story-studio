import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { lazy, Suspense, useEffect } from "react";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

const Home = lazy(() => import("./pages/Home"));
const Generate = lazy(() => import("./pages/Generate"));
const Archive = lazy(() => import("./pages/Archive"));
const Story = lazy(() => import("./pages/Story"));
const Projects = lazy(() => import("./pages/Projects"));
const Project = lazy(() => import("./pages/Project"));

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

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location]);
  return null;
}

function Router() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/generate" component={Generate} />
        <Route path="/archive" component={Archive} />
        <Route path="/projects" component={Projects} />
        <Route path="/project/:id" component={Project} />
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
          <ScrollToTop />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

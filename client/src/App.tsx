import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { useEffect, useRef } from "react";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import AboutPage from "./pages/AboutPage";
import BriefPage from "./pages/BriefPage";
import CalendarPage from "./pages/CalendarPage";
import TrendsPage from "./pages/TrendsPage";

const VISITED_KEY = "ripple_visited";

/**
 * Root route. First-ever visitor lands on the About page; every visit after
 * that defaults straight to Today's Brief. Explicit /brief/:slug links are
 * unaffected.
 */
function Home() {
  const [, navigate] = useLocation();
  const firstVisit = useRef(
    typeof window !== "undefined" && !localStorage.getItem(VISITED_KEY)
  );

  useEffect(() => {
    if (firstVisit.current) {
      localStorage.setItem(VISITED_KEY, "1");
      navigate("/about", { replace: true });
    }
  }, [navigate]);

  // Avoid flashing the brief before redirecting a first-time visitor.
  if (firstVisit.current) return null;
  return <BriefPage />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/brief/:slug" component={BriefPage} />
      <Route path="/trends" component={TrendsPage} />
      <Route path="/calendar" component={CalendarPage} />
      <Route path="/about" component={AboutPage} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
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

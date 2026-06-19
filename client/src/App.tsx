import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import BriefPage from "./pages/BriefPage";
import CalendarPage from "./pages/CalendarPage";
import TrendsPage from "./pages/TrendsPage";

function Router() {
  return (
    <Switch>
      <Route path="/" component={BriefPage} />
      <Route path="/brief/:slug" component={BriefPage} />
      <Route path="/calendar" component={CalendarPage} />
      <Route path="/trends" component={TrendsPage} />
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

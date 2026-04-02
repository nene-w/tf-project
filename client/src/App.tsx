import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import EmailSignals from "./pages/EmailSignals";
import FundamentalAnalysis from "./pages/FundamentalAnalysis";
import ExternalViews from "./pages/ExternalViews";
import TradeRecords from "./pages/TradeRecords";
import EmailAutomation from "./pages/EmailAutomation";
import MarketAnalysis from "./pages/MarketAnalysis";
import IndicatorEditor from "./pages/IndicatorEditor";
import SignalRecords from "./pages/SignalRecords";
import MarketSettings from "./pages/MarketSettings";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/signals"} component={EmailSignals} />
      <Route path={"/analysis"} component={FundamentalAnalysis} />
      <Route path={"/views"} component={ExternalViews} />
      <Route path={"/trades"} component={TradeRecords} />
      <Route path={"/email-automation"} component={EmailAutomation} />
      <Route path={"/market"} component={MarketAnalysis} />
      <Route path={"/indicators"} component={IndicatorEditor} />
      <Route path={"/signal-records"} component={SignalRecords} />
      <Route path={"/market-settings"} component={MarketSettings} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

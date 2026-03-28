import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ChatProvider } from "./contexts/ChatContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { lazy, Suspense, useEffect } from "react";
import { Shield, Loader2 } from "lucide-react";
import { useLocation } from "wouter";

// Lazy-loaded route components (code splitting)
const LandingPage = lazy(() => import("./pages/LandingPage"));
const Home = lazy(() => import("./pages/Home"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const NotFound = lazy(() => import("./pages/NotFound"));

/** /app → /chat geriye uyumluluk redirect'i */
function RedirectToChat() {
  const [, navigate] = useLocation();
  useEffect(() => { navigate('/chat', { replace: true }); }, [navigate]);
  return null;
}

/** Minimal loading spinner - appears during chunk loading */
function RouteLoader() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#111b21]">
      <div className="flex flex-col items-center gap-4 animate-pulse">
        <div className="w-16 h-16 rounded-2xl bg-[#00a884]/20 flex items-center justify-center">
          <Shield className="w-8 h-8 text-[#00a884]" />
        </div>
        <h1 className="text-xl font-semibold text-white font-[Noto_Sans]">ChatApp Ultra</h1>
        <Loader2 className="w-5 h-5 text-[#00a884] animate-spin" />
      </div>
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<RouteLoader />}>
      <Switch>
        <Route path="/"        component={LandingPage} />
        <Route path="/app"     component={RedirectToChat} />
        <Route path="/chat"    component={Home} />
        <Route path="/terms"   component={TermsOfService} />
        <Route path="/privacy" component={PrivacyPolicy} />
        <Route path="/404"     component={NotFound} />
        <Route                 component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <LanguageProvider>
          <ChatProvider>
            <TooltipProvider>
              <Toaster richColors position="top-center" />
              <Router />
            </TooltipProvider>
          </ChatProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

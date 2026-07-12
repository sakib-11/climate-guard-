// C:\Users\DELL\Desktop\ClimateGuard\src\App.tsx

import { Toaster } from "@/components/ui/toaster";
// Temporarily remove Sonner to avoid runtime errors during theme access
// import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ErrorBoundary from "@/components/ErrorBoundary";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// 🚨 CORRECTED IMPORT PATH: Import ProtectedRoute from the pages/firebase directory
import ProtectedRoute from "./pages/firebase/ProtectedRoute";
import Alerts from "./pages/Alerts";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import CommunityReports from "./pages/CommunityReports";
import YourPoints from "./pages/YourPoints";
import ContributeMore from "./pages/ContributeMore";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error instanceof Error && /\b(400|401|403|404)\b/.test(error.message)) {
          return false;
        }

        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 8000),
    },
  },
});

const App: React.FC = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        {/* <Sonner /> temporarily disabled to avoid theme-related runtime errors */}
        <BrowserRouter>
          <Routes>
          {/* 🔑 Public Route: Login/Signup */}
          <Route path="/auth" element={<Auth />} />

          {/* 🔒 Protected Routes: Require user authentication */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Index />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/reports" element={<CommunityReports />} />
            <Route path="/points" element={<YourPoints />} />
            <Route path="/contribute" element={<ContributeMore />} />
          </Route>

          {/* 🧭 Catch-All Route: 404 Not Found */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;

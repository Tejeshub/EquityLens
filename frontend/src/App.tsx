import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/auth/AuthContext";
import RequireAuth from "@/auth/RequireAuth";
import Footer from "@/components/Footer";
import { createQueryClient } from "@/lib/queryClient";
import Home from "./pages/Home.tsx";
import CompanyDetail from "./pages/CompanyDetail.tsx";
import WatchlistsPage from "./pages/WatchlistsPage.tsx";
import WatchlistAnalysis from "./pages/WatchlistAnalysis.tsx";
import LoginPage from "./pages/LoginPage.tsx";
import RegisterPage from "./pages/RegisterPage.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = createQueryClient();

/** The landing page (signed-out "/") carries its own footer and makes no API calls, so the app footer is skipped there. */
const AppFooter = () => {
  const { pathname } = useLocation();
  const { status } = useAuth();
  return pathname === "/" && status !== "authenticated" ? null : <Footer />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <div className="min-h-screen flex flex-col bg-background">
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/" element={<Home />} />
            <Route element={<RequireAuth />}>
              <Route path="/company/:id" element={<CompanyDetail />} />
              <Route path="/watchlists" element={<WatchlistsPage />} />
              <Route path="/watchlist/:id/analysis" element={<WatchlistAnalysis />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
          <AppFooter />
          </div>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

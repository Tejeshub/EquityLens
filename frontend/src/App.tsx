import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/auth/AuthContext";
import RequireAuth from "@/auth/RequireAuth";
import Footer from "@/components/Footer";
import { createQueryClient } from "@/lib/queryClient";
import Index from "./pages/Index.tsx";
import CompanyDetail from "./pages/CompanyDetail.tsx";
import WatchlistsPage from "./pages/WatchlistsPage.tsx";
import WatchlistAnalysis from "./pages/WatchlistAnalysis.tsx";
import LoginPage from "./pages/LoginPage.tsx";
import RegisterPage from "./pages/RegisterPage.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = createQueryClient();

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
            <Route element={<RequireAuth />}>
              <Route path="/" element={<Index />} />
              <Route path="/company/:id" element={<CompanyDetail />} />
              <Route path="/watchlists" element={<WatchlistsPage />} />
              <Route path="/watchlist/:id/analysis" element={<WatchlistAnalysis />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
          <Footer />
          </div>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

import { Navigate, Outlet, useLocation } from "react-router";
import { Loader2 } from "lucide-react";
import { useAuth } from "./AuthContext";
import { safeNextPath } from "@/lib/safeRedirect";

const RequireAuth = () => {
  const { status, error, retry } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" role="status" aria-live="polite">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
        <span className="sr-only">Checking your session…</span>
      </div>
    );
  }
  if (status === "error") {
    return (
      <main className="flex-1 min-h-screen flex items-center justify-center bg-background px-4">
        <div role="alert" className="max-w-sm border border-border rounded-md bg-card p-6 text-center space-y-3">
          <h1 className="text-base font-bold text-foreground">We could not check your session</h1>
          <p className="text-xs text-muted-foreground">{error ?? "The server could not be reached."} You have not been signed out.</p>
          <button onClick={retry} className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90">Try again</button>
        </div>
      </main>
    );
  }
  if (status === "unauthenticated") {
    const next = safeNextPath(`${location.pathname}${location.search}`, "/");
    const qs = next === "/" ? "" : `?next=${encodeURIComponent(next)}`;
    return <Navigate to={`/login${qs}`} replace />;
  }
  return <Outlet />;
};

export default RequireAuth;

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api, ApiError, setUnauthorizedHandler } from "@/services/api";
import { toast } from "@/hooks/use-toast";
import { CAPABILITIES_KEY } from "@/hooks/useCapabilities";
import type { User } from "@/types/api";

/** "error": the session check itself failed (network / server problem). That is NOT the same as being signed out. */
type Status = "loading" | "authenticated" | "unauthenticated" | "error";

interface AuthValue {
  user: User | null;
  status: Status;
  /** Message for status === "error". */
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  /** Resolves true when the user is now signed out; false (and a toast) when the server could not be told. */
  logout: () => Promise<boolean>;
  logoutAll: () => Promise<boolean>;
  retry: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

/** Drop every cached per-user query; deployment capabilities are public and stay. */
const clearUserData = (qc: QueryClient) =>
  qc.removeQueries({ predicate: (q) => q.queryKey[0] !== CAPABILITIES_KEY[0] });

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const clearAuth = useCallback(() => {
    setUser(null);
    setError(null);
    setStatus("unauthenticated");
    clearUserData(queryClient);
  }, [queryClient]);

  // Any 401 from the API clears auth state; the route guard then redirects to /login.
  useEffect(() => {
    setUnauthorizedHandler(clearAuth);
    return () => setUnauthorizedHandler(null);
  }, [clearAuth]);

  useEffect(() => {
    const ctrl = new AbortController();
    api.auth
      .me(ctrl.signal)
      .then((u) => { setUser(u); setError(null); setStatus("authenticated"); })
      .catch((e) => {
        if (ctrl.signal.aborted) return;
        if (e instanceof ApiError && e.status === 401) {
          setUser(null);
          setStatus("unauthenticated");
        } else {
          // Network failure, 5xx, bad payload: we do not know the session state, so do not pretend the user logged out.
          setUser(null);
          setError(e instanceof ApiError ? e.message : "Could not check your session.");
          setStatus("error");
        }
      });
    return () => ctrl.abort();
  }, [attempt]);

  const retry = useCallback(() => {
    setError(null);
    setStatus("loading");
    setAttempt((n) => n + 1);
  }, []);

  const startSession = useCallback((u: User) => {
    clearUserData(queryClient);
    setUser(u);
    setError(null);
    setStatus("authenticated");
  }, [queryClient]);

  const login = useCallback(async (email: string, password: string) => {
    startSession(await api.auth.login(email, password));
  }, [startSession]);

  // The backend sets the session cookies on register (201); no second login call is needed.
  const register = useCallback(async (email: string, password: string) => {
    startSession(await api.auth.register(email, password));
  }, [startSession]);

  const endSession = useCallback(async (call: () => Promise<void>, failure: string): Promise<boolean> => {
    try {
      await call();
    } catch (e) {
      // 401: the session is already gone server-side. Anything else: we could not end it, so stay signed in and say so.
      if (!(e instanceof ApiError && e.status === 401)) {
        toast({ variant: "destructive", title: failure, description: e instanceof ApiError ? e.message : "Please try again." });
        return false;
      }
    }
    clearAuth();
    return true;
  }, [clearAuth]);

  const logout = useCallback(() => endSession(() => api.auth.logout(), "Could not sign you out"), [endSession]);
  const logoutAll = useCallback(() => endSession(() => api.auth.logoutAll(), "Could not sign you out everywhere"), [endSession]);

  const value = useMemo(
    () => ({ user, status, error, login, register, logout, logoutAll, retry }),
    [user, status, error, login, register, logout, logoutAll, retry],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

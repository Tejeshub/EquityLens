import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import type { Capabilities, SourceName } from "@/types/api";

export const CAPABILITIES_KEY = ["capabilities"] as const;

/** Public (no auth). Fetched once per app start; deployment capabilities do not change while the page is open. */
export const useCapabilities = () =>
  useQuery({
    queryKey: CAPABILITIES_KEY,
    queryFn: ({ signal }) => api.capabilities(signal),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 2,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

export type SourceState = { state: "loading" | "enabled" | "disabled"; reason: string | null; caps: Capabilities | undefined };

/**
 * Whether a restricted source may be used. While capabilities load nothing is requested; if they cannot be loaded at all we
 * fall back to "enabled" because the backend enforces the policy itself (503 source_disabled is handled wherever it surfaces).
 */
export function useSource(name: SourceName): SourceState {
  const q = useCapabilities();
  if (q.data) {
    const s = name === "ai" ? { enabled: q.data.ai.research, reason: q.data.ai.reason } : q.data[name];
    return { state: s.enabled ? "enabled" : "disabled", reason: s.reason ?? null, caps: q.data };
  }
  if (q.isError) return { state: "enabled", reason: null, caps: undefined };
  return { state: "loading", reason: null, caps: undefined };
}

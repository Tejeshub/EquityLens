import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import type { HistoryRange, Segment, StatementKind } from "@/types/api";
import { useDebouncedValue } from "./useDebouncedValue";
import { useSource } from "./useCapabilities";

export const SEARCH_DEBOUNCE_MS = 300;

export function useCompanySearch(q: string, filters: { sector?: string; segment?: Segment } = {}) {
  // Sector / segment labels are not shown (and the backend refuses them) when index_segments is disabled.
  const segmentsOn = useSource("index_segments").state === "enabled";
  const query = q.trim();
  const sector = segmentsOn ? (filters.sector ?? "").trim() : "";
  const dq = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const ds = useDebouncedValue(sector, SEARCH_DEBOUNCE_MS);
  const segment = segmentsOn ? filters.segment : undefined;
  const hasCriteria = !!(dq || ds || segment);
  const result = useQuery({
    queryKey: ["search", dq, ds, segment ?? null],
    queryFn: ({ signal }) => api.companies.search({ q: dq, sector: ds || undefined, segment, limit: 10 }, signal),
    enabled: hasCriteria,
  });
  return {
    ...result,
    hasCriteria,
    // True while the user's latest keystrokes have not yet been sent.
    debouncing: query !== dq || sector !== ds,
  };
}

export const useCompany = (id: string) =>
  useQuery({ queryKey: ["company", id], queryFn: ({ signal }) => api.companies.get(id, signal), enabled: !!id });

export const useQuote = (id: string, enabled = true) =>
  useQuery({ queryKey: ["quote", id], queryFn: ({ signal }) => api.companies.quote(id, signal), enabled: !!id && enabled, staleTime: 30_000 });

export const useHistory = (id: string, range: HistoryRange, enabled = true) =>
  useQuery({
    queryKey: ["history", id, range],
    queryFn: ({ signal }) => api.companies.history(id, range, signal),
    enabled: !!id && enabled,
    placeholderData: keepPreviousData,
  });

export const useNews = (id: string, enabled = true) =>
  useQuery({ queryKey: ["news", id], queryFn: ({ signal }) => api.companies.news(id, 10, 0, signal), enabled: !!id && enabled, staleTime: 5 * 60_000 });

export const useFinancials = (id: string, statement: StatementKind, enabled = true) =>
  useQuery({
    queryKey: ["financials", id, statement],
    queryFn: ({ signal }) => api.companies.financials(id, statement, signal),
    enabled: !!id && enabled,
    staleTime: 10 * 60_000,
  });

export const useMovers = (segment: Segment, enabled = true) =>
  useQuery({ queryKey: ["movers", segment], queryFn: ({ signal }) => api.market.movers(segment, 5, signal), staleTime: 60_000, enabled });

export const useWatchlists = () => useQuery({ queryKey: ["watchlists"], queryFn: ({ signal }) => api.watchlists.list(signal) });

export const useSnapshot = (id: string, enabled = true) =>
  useQuery({ queryKey: ["snapshot", id], queryFn: ({ signal }) => api.watchlists.snapshot(id, signal), enabled: !!id && enabled, staleTime: 30_000 });

export const useLatestResearch = (companyId: string) =>
  useQuery({
    queryKey: ["research", "latest", companyId],
    queryFn: ({ signal }) => api.research.latest(companyId, signal),
    enabled: !!companyId,
    retry: false,
  });

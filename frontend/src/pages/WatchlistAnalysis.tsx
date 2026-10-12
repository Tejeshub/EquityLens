import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router";
import Layout from "@/components/Layout";
import ComparisonTable, { STATEMENT_LABELS } from "@/components/ComparisonTable";
import { ErrorBox, InfoBanner, LoadingBox, SourceDisabledNotice } from "@/components/DataStates";
import { useWatchlists } from "@/hooks/queries";
import { useSource } from "@/hooks/useCapabilities";
import { api, ApiError, isAbortError } from "@/services/api";
import { ArrowLeft, Loader2, Play } from "lucide-react";
import type { CompareStatement } from "@/types/api";

const STATEMENTS = Object.keys(STATEMENT_LABELS) as CompareStatement[];

const Analysis = ({ id }: { id: string }) => {
  const navigate = useNavigate();
  const lists = useWatchlists();
  const fundamentals = useSource("fundamentals");
  const watchlist = lists.data?.find((w) => w.id === id);
  const [statement, setStatement] = useState<CompareStatement>("quarterly_results");
  const ctrl = useRef<AbortController | null>(null);
  const compare = useMutation({
    mutationFn: (st: CompareStatement) => {
      ctrl.current?.abort();
      ctrl.current = new AbortController();
      return api.watchlists.compare(id, st, ctrl.current.signal);
    },
  });
  // Ignore a run that is still in flight when the user leaves the page.
  useEffect(() => () => ctrl.current?.abort(), []);
  const missing = compare.error instanceof ApiError && compare.error.isEndpointMissing;
  const err = compare.error && !isAbortError(compare.error) ? compare.error : null;
  const disabled = fundamentals.state === "disabled";

  return (
    <Layout title={watchlist ? `Compare ${watchlist.name}` : "Compare watchlist"}>
      <div className="container mx-auto px-4 py-5">
        <button onClick={() => navigate("/watchlists")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden /> Back to Watchlists
        </button>

        {lists.isPending ? (
          <LoadingBox label="Loading watchlist…" />
        ) : lists.isError ? (
          <div className="border border-border rounded-md bg-card"><ErrorBox error={lists.error} onRetry={() => lists.refetch()} title="Could not load watchlist" /></div>
        ) : !watchlist ? (
          <div className="border border-border rounded-md bg-card p-8 text-center" role="alert">
            <h1 className="text-lg font-bold text-foreground">Watchlist not found</h1>
            <p className="text-xs text-muted-foreground mt-1">This watchlist does not exist or is not yours.</p>
          </div>
        ) : (
          <>
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold text-foreground">{watchlist.name}</h1>
                <p className="text-xs text-muted-foreground">Comparison of reported metrics · {watchlist.items.length} companies</p>
              </div>
              {!disabled && (
                <div className="flex items-end gap-2">
                  <label className="text-[11px] text-muted-foreground flex flex-col gap-0.5">
                    Statement
                    <select value={statement} onChange={(e) => setStatement(e.target.value as CompareStatement)} disabled={compare.isPending}
                      className="bg-card border border-border rounded px-2 py-1.5 text-xs text-foreground">
                      {STATEMENTS.map((s) => <option key={s} value={s}>{STATEMENT_LABELS[s]}</option>)}
                    </select>
                  </label>
                  <button onClick={() => compare.mutate(statement)} disabled={compare.isPending || watchlist.items.length < 2 || fundamentals.state !== "enabled"}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed">
                    {compare.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    {compare.data ? "Refresh comparison" : "Run comparison"}
                  </button>
                </div>
              )}
            </div>

            {disabled && <SourceDisabledNotice title="Comparison is not available" reason={fundamentals.reason} />}
            {!disabled && watchlist.items.length < 2 && <InfoBanner>Add at least two companies to this watchlist to compare them.</InfoBanner>}
            {compare.isPending && <LoadingBox label="Fetching reported metrics. This can take a while…" />}
            {err && (missing
              ? <InfoBanner tone="warn">The comparison service is not available on this backend yet.</InfoBanner>
              : <div className="border border-border rounded-md bg-card"><ErrorBox error={err} title="Comparison failed" /></div>)}
            {compare.data && <ComparisonTable data={compare.data} />}
            {!disabled && !compare.data && !compare.isPending && !err && watchlist.items.length >= 2 && (
              <p className="text-xs text-muted-foreground">Nothing has been fetched yet. Press "Run comparison" to load reported metrics for these companies.</p>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

// Keyed by watchlist id so a previous watchlist's comparison never carries over.
const WatchlistAnalysis = () => {
  const { id = "" } = useParams();
  return <Analysis key={id} id={id} />;
};

export default WatchlistAnalysis;

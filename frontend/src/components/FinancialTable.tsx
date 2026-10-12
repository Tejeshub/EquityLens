import { useState } from "react";
import { ApiError } from "@/services/api";
import { useFinancials } from "@/hooks/queries";
import { EmptyBox, ErrorBox, InfoBanner, LoadingBox, SourceDisabledNotice, SourceLine } from "@/components/DataStates";
import NumText from "@/components/NumText";
import { useSource } from "@/hooks/useCapabilities";
import { computedChange, yearAgoPeriod } from "@/lib/financials";
import { NA_SHORT, fmtDate, fmtReported, isNum, periodTypeLabel, safeHttpUrl, signClass } from "@/lib/format";
import type { StatementKind } from "@/types/api";

const STATEMENTS: { value: StatementKind; label: string }[] = [
  { value: "quarterly_results", label: "Quarterly Results" },
  { value: "profit_loss", label: "Profit & Loss" },
  { value: "balance_sheet", label: "Balance Sheet" },
  { value: "cash_flow", label: "Cash Flow" },
  { value: "ratios", label: "Ratios" },
];

type ChangeMode = "off" | "prev" | "yoy";

const Change = ({ pct }: { pct: number | null }) =>
  pct === null ? null : (
    <span className={`ml-1.5 text-[10px] font-mono ${signClass(Math.round(pct * 10) / 10)}`} title="Computed in the browser from the reported values">
      {Math.round(pct * 10) === 0 ? "" : pct > 0 ? "▲" : "▼"}{Math.abs(pct).toFixed(1)}%
    </span>
  );

const FinancialTable = ({ companyId }: { companyId: string }) => {
  const [statement, setStatement] = useState<StatementKind>("quarterly_results");
  const [mode, setMode] = useState<ChangeMode>("off");
  const source = useSource("fundamentals");
  const fin = useFinancials(companyId, statement, source.state === "enabled");
  const d = fin.data;
  const notCovered = fin.error instanceof ApiError && fin.error.status === 404 && fin.error.code === "not_covered";
  const sourceUrl = safeHttpUrl(d?.source_url);

  return (
    <div className="border border-border rounded-md bg-card">
      <div className="px-4 py-3 border-b border-border flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">Reported Financials</h3>
        {source.state !== "disabled" && <div className="flex flex-wrap gap-1" role="tablist" aria-label="Statement">
          {STATEMENTS.map((s) => (
            <button key={s.value} role="tab" aria-selected={statement === s.value} onClick={() => setStatement(s.value)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${statement === s.value ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent"}`}>
              {s.label}
            </button>
          ))}
        </div>}
      </div>

      {source.state === "disabled" ? (
        <div className="p-4"><SourceDisabledNotice title="Reported financials are not shown" reason={source.reason} /></div>
      ) : fin.isPending ? (
        <LoadingBox label="Loading financials…" />
      ) : notCovered ? (
        <EmptyBox title="Not covered by the current source">The current financial-data source does not cover this company.</EmptyBox>
      ) : fin.isError ? (
        <ErrorBox error={fin.error} onRetry={() => fin.refetch()} title="Financials unavailable" />
      ) : d && d.rows.length === 0 ? (
        <EmptyBox title="No rows reported">The source returned no {STATEMENTS.find((s) => s.value === statement)?.label.toLowerCase()} data for this company.</EmptyBox>
      ) : d ? (
        <>
          <div className="px-4 pt-3 space-y-2">
            {d.stale && (
              <InfoBanner tone="warn">
                Stale data: the last refresh did not succeed{d.refresh_error ? ` (${d.refresh_error})` : ""}. Showing the most recently stored values.
              </InfoBanner>
            )}
            {d.notice && <InfoBanner>{d.notice}</InfoBanner>}
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
              <span className="px-1.5 py-0.5 rounded bg-secondary capitalize">{d.basis ?? "basis not stated"}</span>
              <span>{periodTypeLabel(d.period_type)}</span>
              <label className="flex items-center gap-1 ml-auto">
                Computed change:
                <select value={mode} onChange={(e) => setMode(e.target.value as ChangeMode)} className="bg-card border border-border rounded px-1.5 py-0.5 text-[11px] text-foreground">
                  <option value="off">Off</option>
                  <option value="prev">vs previous period</option>
                  <option value="yoy">vs same period last year</option>
                </select>
              </label>
            </div>
          </div>
          <div className="overflow-x-auto mt-2" tabIndex={0} role="region" aria-label="Financial statement table (scrollable)">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/40">
                  <th className="text-left py-2 px-4 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Metric</th>
                  {d.periods.map((p) => (
                    <th key={p} className="text-right py-2 px-4 text-[11px] font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">{fmtDate(p)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.rows.map((row) => (
                  <tr key={row.metric} className="border-b border-border/50 hover:bg-secondary/30">
                    <td className="py-2 px-4 text-xs text-foreground whitespace-nowrap">
                      {row.metric}{row.unit ? <span className="text-muted-foreground"> ({row.unit})</span> : null}
                    </td>
                    {d.periods.map((p, i) => {
                      const v = row.values[p];
                      if (!isNum(v)) return <td key={p} className="py-2 px-4 text-right text-xs text-muted-foreground"><NumText text={NA_SHORT} /></td>;
                      let pct: number | null = null;
                      if (mode === "prev" && i > 0) pct = computedChange(v, row.values[d.periods[i - 1]]);
                      if (mode === "yoy") {
                        const ya = yearAgoPeriod(p, d.periods);
                        pct = ya ? computedChange(v, row.values[ya]) : null;
                      }
                      return (
                        <td key={p} className="py-2 px-4 text-right font-mono text-xs text-foreground whitespace-nowrap">
                          {fmtReported(v)}
                          {mode !== "off" && <Change pct={pct} />}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {mode !== "off" && <p className="px-4 pt-2 text-[10px] text-muted-foreground">Percent changes are computed in your browser from the reported values; shown only when both periods are reported and the base is non-zero.</p>}
          <div className="px-4 py-3 space-y-0.5">
            <SourceLine source={d.source} retrievedAt={d.retrieved_at} stale={d.stale} />
            {sourceUrl && (
              <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline">View source page</a>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
};

export default FinancialTable;

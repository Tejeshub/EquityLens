import { fmtDateTime, fmtReported, isNum, NA_SHORT } from "@/lib/format";
import { reasonText } from "@/lib/reasons";
import { InfoBanner, SourceLine } from "@/components/DataStates";
import NumText from "@/components/NumText";
import type { CompareResponse } from "@/types/api";

export const STATEMENT_LABELS: Record<string, string> = {
  quarterly_results: "Quarterly results",
  profit_loss: "Profit & loss",
  ratios: "Ratios",
  balance_sheet: "Balance sheet",
  shareholding: "Shareholding",
};

const ComparisonTable = ({ data }: { data: CompareResponse }) => {
  const periods = new Set(data.companies.filter((c) => c.status === "ok" && c.period).map((c) => c.period));
  const periodsDiffer = periods.size > 1;
  return (
    <div className="border border-border rounded-lg bg-card">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-base font-medium text-foreground">Reported metrics comparison</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {STATEMENT_LABELS[data.statement] ?? data.statement.replace(/_/g, " ")}
          {data.period ? ` · period ${data.period}` : periodsDiffer ? " · latest period differs between companies" : ""}.
          {" "}Values are as reported by the source; no ranking or scoring is applied.
        </p>
      </div>
      {data.rows.length === 0 ? (
        <p className="p-6 text-center text-xs text-muted-foreground">The source returned no comparable metrics for these companies.</p>
      ) : (
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Comparison table (scrollable)">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40">
                <th className="text-left py-2 px-4 text-[11px] font-medium text-muted-foreground uppercase tracking-wider align-top">Metric</th>
                {data.companies.map((c) => {
                  const ok = c.status === "ok";
                  return (
                    <th key={c.company_id} className="text-right py-2 px-4 text-[11px] font-medium text-muted-foreground uppercase tracking-wider align-top">
                      {c.name}<span className="block normal-case font-mono">{c.symbol}</span>
                      <span
                        data-testid={`status-${c.company_id}`}
                        title={ok ? undefined : reasonText(c.reason)}
                        className={`inline-block mt-1 normal-case px-1.5 py-0.5 rounded-full text-[10px] font-medium ${ok ? "bg-secondary text-secondary-foreground" : "bg-warning/15 text-warning"}`}
                      >
                        {ok ? "Data available" : "Unavailable"}
                      </span>
                      {!ok && <span className="block normal-case font-normal text-[10px] mt-0.5 max-w-[14rem] ml-auto">{reasonText(c.reason)}</span>}
                      {ok && (periodsDiffer || !data.period) && c.period && <span className="block normal-case font-mono font-normal text-[10px] mt-0.5">period {c.period}</span>}
                      {ok && c.basis && <span className="block normal-case font-normal text-[10px] capitalize">{c.basis}</span>}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.metric} className="border-b border-border/50 hover:bg-secondary/30">
                  <td className="py-2 px-4 text-xs text-foreground whitespace-nowrap">{r.metric}{r.unit ? <span className="text-muted-foreground"> ({r.unit})</span> : null}</td>
                  {data.companies.map((c) => {
                    const v = r.values[c.company_id];
                    return (
                      <td key={c.company_id} className={`py-2 px-4 text-right font-mono text-xs ${isNum(v) ? "text-foreground" : "text-muted-foreground"}`}>
                        <NumText text={isNum(v) ? fmtReported(v) : NA_SHORT} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="px-4 py-3 space-y-1.5">
        {periodsDiffer && <InfoBanner tone="warn">The companies report different latest periods; compare values with care.</InfoBanner>}
        {data.basis_note && <InfoBanner>{data.basis_note}</InfoBanner>}
        {data.notice && <InfoBanner>{data.notice}</InfoBanner>}
        <SourceLine source={data.source} retrievedAt={data.retrieved_at} />
        {data.retrieved_at && <span className="sr-only">{fmtDateTime(data.retrieved_at)}</span>}
      </div>
    </div>
  );
};

export default ComparisonTable;

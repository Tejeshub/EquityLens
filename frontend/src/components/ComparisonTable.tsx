import { companies, Company } from "@/data/dummyData";

const metrics = [
  { key: "price", label: "Price (₹)", format: (v: number) => `₹${v.toLocaleString()}` },
  { key: "pe", label: "P/E Ratio", format: (v: number) => v.toFixed(1) },
  { key: "roe", label: "ROE (%)", format: (v: number) => `${v}%`, higherBetter: true },
  { key: "roce", label: "ROCE (%)", format: (v: number) => `${v}%`, higherBetter: true },
  { key: "debtToEquity", label: "D/E Ratio", format: (v: number) => v.toFixed(2), higherBetter: false },
  { key: "promoterHolding", label: "Promoter (%)", format: (v: number) => `${v}%`, higherBetter: true },
  { key: "overallScore", label: "Overall Score", format: (v: number) => `${v}/100`, higherBetter: true },
  { key: "confidenceScore", label: "Confidence", format: (v: number) => `${v}%`, higherBetter: true },
  { key: "marketCap", label: "Market Cap", format: (v: string) => v },
  { key: "beta", label: "Beta", format: (v: number) => v.toFixed(2) },
  { key: "dividend", label: "Div Yield (%)", format: (v: number) => `${v}%`, higherBetter: true },
] as const;

const ComparisonTable = ({ companyIds }: { companyIds: string[] }) => {
  const selected = companies.filter((c) => companyIds.includes(c.id));

  const getRank = (metric: (typeof metrics)[number], company: Company) => {
    if (!("higherBetter" in metric)) return null;
    const key = metric.key as keyof Company;
    const values = selected.map((c) => c[key] as number);
    const sorted = [...values].sort((a, b) => metric.higherBetter ? b - a : a - b);
    return sorted.indexOf(company[key] as number) + 1;
  };

  return (
    <div className="border border-border rounded-md bg-card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-secondary/40">
            <th className="text-left py-2.5 px-4 text-[11px] font-medium text-muted-foreground uppercase tracking-wider sticky left-0 bg-secondary/40">Metric</th>
            {selected.map((c) => (
              <th key={c.id} className="text-center py-2.5 px-4 min-w-[130px]">
                <p className="text-xs font-semibold text-foreground">{c.ticker}</p>
                <p className="text-[10px] text-muted-foreground font-normal">{c.name}</p>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {metrics.map((m) => (
            <tr key={m.key} className="border-b border-border/50 hover:bg-secondary/20">
              <td className="py-2 px-4 text-xs font-medium text-muted-foreground sticky left-0 bg-card">{m.label}</td>
              {selected.map((c) => {
                const val = c[m.key as keyof Company];
                const rank = getRank(m, c);
                return (
                  <td key={c.id} className="py-2 px-4 text-center font-mono text-xs text-foreground">
                    <span>{m.format(val as never)}</span>
                    {rank && (
                      <span className={`ml-1 text-[10px] ${rank === 1 ? "text-chart-up font-semibold" : rank === selected.length ? "text-chart-down" : "text-muted-foreground"}`}>
                        #{rank}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ComparisonTable;

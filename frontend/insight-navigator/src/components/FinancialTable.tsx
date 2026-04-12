import { quarterlyData } from "@/data/dummyData";

const FinancialTable = () => (
  <div className="border border-border rounded-md bg-card overflow-x-auto">
    <div className="px-4 py-3 border-b border-border">
      <h3 className="text-sm font-semibold text-foreground">Quarterly Financials (₹ Cr)</h3>
    </div>
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border bg-secondary/40">
          {["Quarter", "Revenue", "Net Profit", "EBITDA", "EPS (₹)", "Op. Margin"].map((h) => (
            <th key={h} className="text-left py-2 px-4 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {quarterlyData.map((q, i) => {
          const prev = quarterlyData[i - 1];
          return (
            <tr key={q.quarter} className="border-b border-border/50 hover:bg-secondary/30">
              <td className="py-2 px-4 font-medium font-mono text-xs text-foreground">{q.quarter}</td>
              <td className="py-2 px-4 font-mono text-xs text-foreground">
                {q.revenue.toLocaleString()}
                {prev && <Change current={q.revenue} previous={prev.revenue} />}
              </td>
              <td className="py-2 px-4 font-mono text-xs text-foreground">
                {q.netProfit.toLocaleString()}
                {prev && <Change current={q.netProfit} previous={prev.netProfit} />}
              </td>
              <td className="py-2 px-4 font-mono text-xs text-foreground">{q.ebitda.toLocaleString()}</td>
              <td className="py-2 px-4 font-mono text-xs text-foreground">{q.eps.toFixed(1)}</td>
              <td className="py-2 px-4 font-mono text-xs text-foreground">{q.operatingMargin.toFixed(1)}%</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

const Change = ({ current, previous }: { current: number; previous: number }) => {
  const pct = ((current - previous) / previous) * 100;
  return (
    <span className={`ml-1.5 text-[10px] font-mono ${pct >= 0 ? "text-chart-up" : "text-chart-down"}`}>
      {pct >= 0 ? "▲" : "▼"}{Math.abs(pct).toFixed(1)}%
    </span>
  );
};

export default FinancialTable;

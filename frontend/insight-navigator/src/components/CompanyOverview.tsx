import { Company } from "@/data/dummyData";
import { TrendingUp, TrendingDown, Shield, Target, Users, AlertTriangle } from "lucide-react";

const CompanyOverview = ({ company }: { company: Company }) => {
  const metrics = [
    { label: "Market Cap", value: company.marketCap },
    { label: "P/E Ratio", value: company.pe.toFixed(1) },
    { label: "EPS", value: `₹${company.eps.toFixed(2)}` },
    { label: "52W High", value: `₹${company.weekHigh52.toLocaleString()}` },
    { label: "52W Low", value: `₹${company.weekLow52.toLocaleString()}` },
    { label: "Volume", value: company.volume },
    { label: "Beta", value: company.beta.toFixed(2) },
    { label: "D/E", value: company.debtToEquity.toFixed(2) },
    { label: "ROE", value: `${company.roe}%` },
    { label: "ROCE", value: `${company.roce}%` },
    { label: "Promoter Hold", value: `${company.promoterHolding}%` },
    { label: "Dividend Yield", value: `${company.dividend}%` },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">{company.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-mono text-muted-foreground">{company.ticker}</span>
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">{company.sector}</span>
            <span className={`text-[11px] px-1.5 py-0.5 rounded ${company.cap === "Small Cap" ? "bg-primary/8 text-primary" : "bg-warning/10 text-warning"}`}>{company.cap}</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold font-mono text-foreground">₹{company.price.toLocaleString()}</p>
          <div className={`flex items-center gap-1 justify-end ${company.changePercent >= 0 ? "text-chart-up" : "text-chart-down"}`}>
            {company.changePercent >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            <span className="font-mono text-sm">
              {company.changePercent >= 0 ? "+" : ""}₹{company.change.toFixed(2)} ({company.changePercent >= 0 ? "+" : ""}{company.changePercent.toFixed(2)}%)
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-px bg-border rounded-md overflow-hidden border border-border">
        {metrics.map(({ label, value }) => (
          <div key={label} className="bg-card p-2.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className="text-sm font-semibold font-mono text-foreground mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ScorePill icon={Target} label="Industry Position" score={8.2} />
        <ScorePill icon={Shield} label="Financial Quality" score={7.8} />
        <ScorePill icon={Users} label="Mgmt Credibility" score={6.5} />
        <ScorePill icon={AlertTriangle} label="Risk Score" score={7.0} />
      </div>
    </div>
  );
};

const ScorePill = ({ icon: Icon, label, score }: { icon: any; label: string; score: number }) => (
  <div className="border border-border rounded-md p-2.5 flex items-center gap-2.5">
    <Icon className="w-4 h-4 text-muted-foreground" />
    <div className="flex-1">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <div className="flex items-center gap-1.5">
        <p className="text-base font-bold font-mono text-foreground">{score}</p>
        <span className="text-[10px] text-muted-foreground">/10</span>
      </div>
    </div>
    <div className="w-10 h-1 bg-secondary rounded-full overflow-hidden">
      <div className="h-full rounded-full bg-primary" style={{ width: `${score * 10}%` }} />
    </div>
  </div>
);

export default CompanyOverview;

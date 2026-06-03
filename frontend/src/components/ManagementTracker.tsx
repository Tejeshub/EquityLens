import { managementGuidance } from "@/data/dummyData";
import { CheckCircle, AlertCircle, XCircle, TrendingUp } from "lucide-react";

const patternConfig = {
  consistent: { icon: CheckCircle, color: "text-chart-up", label: "Consistent" },
  overpromise: { icon: AlertCircle, color: "text-warning", label: "Overpromise" },
  underpromise: { icon: TrendingUp, color: "text-primary", label: "Underpromise" },
  erratic: { icon: XCircle, color: "text-destructive", label: "Erratic" },
};

const ManagementTracker = () => (
  <div className="border border-border rounded-md bg-card">
    <div className="px-4 py-3 border-b border-border">
      <h3 className="text-sm font-semibold text-foreground">Management Guidance Tracker</h3>
      <p className="text-xs text-muted-foreground mt-0.5">What was said vs. what was delivered — last 4 quarters</p>
    </div>
    <div className="divide-y divide-border">
      {managementGuidance.map((g, i) => {
        const { icon: Icon, color, label } = patternConfig[g.pattern];
        return (
          <div key={i} className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-muted-foreground">{g.quarter}</span>
                <span className="text-xs font-medium text-foreground">{g.metric}</span>
              </div>
              <div className={`flex items-center gap-1 ${color}`}>
                <Icon className="w-3.5 h-3.5" />
                <span className="text-[10px] font-medium">{label}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-2.5 rounded bg-secondary/60">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Said</p>
                <p className="text-xs text-foreground">{g.said}</p>
              </div>
              <div className="p-2.5 rounded bg-secondary/60">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Delivered</p>
                <p className="text-xs text-foreground">{g.delivered}</p>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${g.deviation >= 0 ? "bg-chart-up" : "bg-chart-down"}`}
                  style={{ width: `${Math.min(Math.abs(g.deviation) + 50, 100)}%`, marginLeft: g.deviation >= 0 ? "50%" : `${50 - Math.abs(g.deviation)}%` }}
                />
              </div>
              <span className={`text-[10px] font-mono ${g.deviation >= 0 ? "text-chart-up" : "text-chart-down"}`}>
                {g.deviation >= 0 ? "+" : ""}{g.deviation}%
              </span>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

export default ManagementTracker;

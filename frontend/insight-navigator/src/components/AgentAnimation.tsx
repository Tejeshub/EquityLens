import { useState, useEffect } from "react";
import { Bot, Shield, Zap, MessageCircle, AlertTriangle, CheckCircle } from "lucide-react";

type Phase = "scraping" | "analyzing" | "debating" | "monitoring" | "scoring" | "complete";

const phases: { key: Phase; label: string; duration: number }[] = [
  { key: "scraping", label: "Scraping multi-source data...", duration: 3000 },
  { key: "analyzing", label: "Agents analyzing independently...", duration: 4000 },
  { key: "debating", label: "Agents debating analysis...", duration: 5000 },
  { key: "monitoring", label: "Monitor checking for hallucinations...", duration: 3000 },
  { key: "scoring", label: "Assigning confidence scores...", duration: 2000 },
  { key: "complete", label: "Report ready!", duration: 1000 },
];

const debateMessages = [
  { agent: "Alpha", color: "text-agent-1", msg: "Revenue growth of 18% aligns with BSE filing data..." },
  { agent: "Beta", color: "text-agent-2", msg: "I challenge this — Chinese capacity adds may erode margins..." },
  { agent: "Gamma", color: "text-agent-3", msg: "Earnings call confirms market share maintained via pivot..." },
  { agent: "Alpha", color: "text-agent-1", msg: "EBITDA expansion of 130bps driven by product mix shift..." },
  { agent: "Beta", color: "text-agent-2", msg: "But Q4 FY25 showed 13.2% decline — needs explanation..." },
  { agent: "Monitor", color: "text-monitor", msg: "⚠️ Q4 decline is tax provisioning — not operational. Verified." },
  { agent: "Gamma", color: "text-agent-3", msg: "Promoter holding stable at 45.41%, no pledging detected..." },
  { agent: "Beta", color: "text-agent-2", msg: "Management overpromised on capex by 10%. Pattern detected." },
  { agent: "Monitor", color: "text-monitor", msg: "✓ All claims verified. No hallucinations detected in Cycle 1." },
];

const AgentAnimation = ({ onComplete }: { onComplete: () => void }) => {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [visibleMessages, setVisibleMessages] = useState(0);
  const [confidenceScore, setConfidenceScore] = useState(0);

  useEffect(() => {
    if (phaseIndex >= phases.length - 1) {
      setTimeout(onComplete, 2000);
      return;
    }
    const timer = setTimeout(() => setPhaseIndex((p) => p + 1), phases[phaseIndex].duration);
    return () => clearTimeout(timer);
  }, [phaseIndex]);

  useEffect(() => {
    if (phases[phaseIndex]?.key === "debating") {
      const interval = setInterval(() => {
        setVisibleMessages((v) => {
          if (v >= debateMessages.length) { clearInterval(interval); return v; }
          return v + 1;
        });
      }, 550);
      return () => clearInterval(interval);
    }
  }, [phaseIndex]);

  useEffect(() => {
    if (phases[phaseIndex]?.key === "scoring") {
      let score = 0;
      const interval = setInterval(() => {
        score += 2;
        setConfidenceScore(Math.min(score, 82));
        if (score >= 82) clearInterval(interval);
      }, 40);
      return () => clearInterval(interval);
    }
  }, [phaseIndex]);

  const currentPhase = phases[phaseIndex]?.key;

  return (
    <div className="min-h-[65vh] flex flex-col items-center justify-center p-6">
      {/* Phase dots */}
      <div className="flex items-center gap-1.5 mb-6">
        {phases.map((p, i) => (
          <div key={p.key} className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${i <= phaseIndex ? "bg-primary" : "bg-border"}`} />
        ))}
      </div>

      <p className="text-sm font-medium text-primary mb-6">{phases[phaseIndex]?.label}</p>

      {/* Three agent cards */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-3xl mb-6">
        {[
          { name: "Agent Alpha", color: "border-t-agent-1", textColor: "text-agent-1", role: "Financial Data Analyst", tasks: ["BSE/NSE filings", "Structured financials", "Annual reports"] },
          { name: "Agent Beta", color: "border-t-agent-2", textColor: "text-agent-2", role: "Qualitative Analyst", tasks: ["Earnings transcripts", "IR disclosures", "Management commentary"] },
          { name: "Agent Gamma", color: "border-t-agent-3", textColor: "text-agent-3", role: "Market Intel Analyst", tasks: ["News feeds", "Industry reports", "Alternative data"] },
        ].map((agent) => (
          <div key={agent.name} className={`border border-border ${agent.color} border-t-2 rounded-md p-3 bg-card`}>
            <div className="flex items-center gap-2 mb-2">
              <Bot className={`w-4 h-4 ${agent.textColor}`} />
              <div>
                <p className={`text-xs font-semibold ${agent.textColor}`}>{agent.name}</p>
                <p className="text-[10px] text-muted-foreground">{agent.role}</p>
              </div>
            </div>
            {currentPhase === "scraping" && (
              <div className="space-y-1">
                {agent.tasks.map((t, j) => (
                  <div key={j} className="flex items-center gap-1.5 animate-fade-in" style={{ animationDelay: `${j * 400}ms` }}>
                    <Zap className="w-3 h-3 text-primary" />
                    <span className="text-[11px] text-muted-foreground">{t}</span>
                  </div>
                ))}
              </div>
            )}
            {(currentPhase === "analyzing" || currentPhase === "debating" || currentPhase === "monitoring") && (
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-chart-up animate-pulse" />
                Active
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Debate log */}
      {(currentPhase === "debating" || currentPhase === "monitoring" || currentPhase === "scoring" || currentPhase === "complete") && (
        <div className="w-full max-w-xl border border-border rounded-md bg-card p-3 max-h-52 overflow-y-auto scrollbar-thin mb-4">
          <div className="flex items-center gap-1.5 mb-2">
            <MessageCircle className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Agent Discussion</span>
          </div>
          <div className="space-y-1.5">
            {debateMessages.slice(0, visibleMessages).map((m, i) => (
              <div key={i} className="flex gap-2 animate-fade-in">
                <span className={`text-[11px] font-semibold ${m.color} min-w-[50px]`}>{m.agent}:</span>
                <span className="text-[11px] text-foreground/80">{m.msg}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Monitor + Score */}
      {(currentPhase === "monitoring" || currentPhase === "scoring" || currentPhase === "complete") && (
        <div className="border border-border border-t-2 border-t-monitor rounded-md bg-card p-4 w-full max-w-md">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-monitor" />
            <span className="text-sm font-semibold text-monitor">Monitor Agent</span>
          </div>
          {currentPhase === "monitoring" && (
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-warning animate-pulse" />
              <span className="text-xs text-muted-foreground">Checking for hallucinations...</span>
            </div>
          )}
          {(currentPhase === "scoring" || currentPhase === "complete") && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-chart-up" />
                <span className="text-xs text-chart-up font-medium">No hallucinations detected</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">Confidence:</span>
                <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-100" style={{ width: `${confidenceScore}%` }} />
                </div>
                <span className="text-base font-bold font-mono text-primary">{confidenceScore}%</span>
              </div>
              {confidenceScore >= 30 && currentPhase === "complete" && (
                <p className="text-xs text-chart-up font-medium">✓ Score above threshold (30%). Report approved.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AgentAnimation;

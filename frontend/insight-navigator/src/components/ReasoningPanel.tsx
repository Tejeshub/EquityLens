import { useState, useEffect } from "react";
import { X, Bot, Shield, Sparkles, Loader2 } from "lucide-react";
import { scoreCards } from "@/data/dummyData";

const agentStyles: Record<string, string> = {
  "Agent Alpha": "border-agent-1/20 bg-agent-1/5",
  "Agent Beta": "border-agent-2/20 bg-agent-2/5",
  "Agent Gamma": "border-agent-3/20 bg-agent-3/5",
  "Monitor": "border-monitor/20 bg-monitor/5",
};

const agentTextColor: Record<string, string> = {
  "Agent Alpha": "text-agent-1",
  "Agent Beta": "text-agent-2",
  "Agent Gamma": "text-agent-3",
  "Monitor": "text-monitor",
};

const typeIcons: Record<string, string> = {
  analysis: "📊",
  challenge: "⚔️",
  agreement: "🤝",
  verdict: "⚖️",
  hallucination_flag: "🚨",
};

const ReasoningPanel = ({ isOpen, onClose, sectionId }: { isOpen: boolean; onClose: () => void; sectionId: string | null }) => {
  const [loading, setLoading] = useState(true);
  const [loadingStep, setLoadingStep] = useState(0);

  const steps = ["Analyzing sources...", "Reading agent discussion...", "Collecting evidence...", "Ready"];

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setLoadingStep(0);
      const timers = steps.map((_, i) => setTimeout(() => setLoadingStep(i), i * 700));
      const done = setTimeout(() => setLoading(false), steps.length * 700);
      return () => { timers.forEach(clearTimeout); clearTimeout(done); };
    }
  }, [isOpen, sectionId]);

  const sectionIndex = sectionId ? parseInt(sectionId.replace("s", "")) - 1 : 0;
  const card = scoreCards[Math.min(sectionIndex, scoreCards.length - 1)];

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-12 bottom-0 w-[460px] bg-card border-l border-border z-40 flex flex-col animate-slide-in-right shadow-lg">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Agent Reasoning</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground font-medium">Read-only</span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-3">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
          {steps.map((step, i) => (
            <div key={i} className={`flex items-center gap-2 transition-opacity duration-300 ${i <= loadingStep ? "opacity-100" : "opacity-20"}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${i <= loadingStep ? "bg-primary" : "bg-muted"}`} />
              <span className="text-xs text-muted-foreground">{step}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3">
          <div className="border border-border rounded-md p-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-foreground">{card.dimension}</h4>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold font-mono text-foreground">{card.score}/{card.maxScore}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                  card.confidence >= 80 ? "bg-chart-up/8 text-chart-up" : card.confidence >= 60 ? "bg-warning/10 text-warning" : "bg-destructive/8 text-destructive"
                }`}>
                  {card.confidence}%
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{card.evidence}</p>
          </div>

          <h5 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider pt-1">Agent Discussion Log</h5>

          {card.reasoning.map((msg, i) => (
            <div key={i} className={`p-3 rounded-md border ${agentStyles[msg.agent]}`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  {msg.agent === "Monitor" ? <Shield className={`w-3 h-3 ${agentTextColor[msg.agent]}`} /> : <Bot className={`w-3 h-3 ${agentTextColor[msg.agent]}`} />}
                  <span className={`text-xs font-semibold ${agentTextColor[msg.agent]}`}>{msg.agent}</span>
                  <span className="text-xs">{typeIcons[msg.type]}</span>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground">{msg.timestamp}</span>
              </div>
              <p className="text-xs text-foreground/80 leading-relaxed">{msg.message}</p>
            </div>
          ))}

          <div className="p-3 rounded-md bg-primary/5 border border-primary/15">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Source</p>
            <p className="text-xs text-primary">{card.source}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReasoningPanel;

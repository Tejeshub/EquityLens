import { useState, useEffect } from "react";
import { X, Bot, Shield, Sparkles, Loader2, ChevronDown, ExternalLink } from "lucide-react";
import type { EquityResearchResponse, ScoreDimension, AgentMessage } from "@/types/api";

// Helper to parse source lineage JSON from message
interface SourceLineageData {
  signal?: string;
  source?: string;
  source_url?: string;
  source_lineage?: string;
  last_updated?: string;
  methodology?: string;
}

const parseSourceLineage = (message: string): SourceLineageData | null => {
  try {
    // Extract JSON from message (handles [source_lineage #X] prefix)
    const jsonRegex = /\{[\s\S]*\}/;
    const matches = jsonRegex.exec(message);
    if (!matches) {
      console.log("[parseSourceLineage] No JSON match found in message:", message.substring(0, 100));
      return null;
    }
    const parsed = JSON.parse(matches[0]) as SourceLineageData;
    console.log("[parseSourceLineage] Successfully parsed:", parsed);
    return parsed;
  } catch (error) {
    console.error("[parseSourceLineage] JSON parse error:", error, "message:", message.substring(0, 100));
    return null;
  }
};

// Helper to collect all sources from reasoning array
const extractSourcesForDimension = (reasoning: AgentMessage[]): SourceLineageData[] => {
  console.log("[extractSourcesForDimension] Total messages in reasoning:", reasoning.length);
  
  const sourceMessages = reasoning.filter(msg => msg.type === "source_lineage");
  console.log("[extractSourcesForDimension] Found", sourceMessages.length, "source_lineage messages");
  
  if (sourceMessages.length > 0) {
    sourceMessages.forEach((msg, i) => {
      console.log(`[extractSourcesForDimension] Message ${i}:`, msg.message.substring(0, 200));
    });
  }
  
  const sources = sourceMessages
    .map(msg => parseSourceLineage(msg.message))
    .filter((source): source is SourceLineageData => source !== null);
  
  console.log("[extractSourcesForDimension] Final source count:", sources.length);
  if (sources.length > 0) {
    console.log("[extractSourcesForDimension] Sources found:", sources);
  }
  
  return sources;
};

// Map agent names to colors
const agentColorMap: Record<string, { style: string; textColor: string }> = {
  "Fundamental Debater": { style: "border-agent-1/20 bg-agent-1/5", textColor: "text-agent-1" },
  "Sentiment Debater": { style: "border-agent-2/20 bg-agent-2/5", textColor: "text-agent-2" },
  "Alternative Debater": { style: "border-agent-3/20 bg-agent-3/5", textColor: "text-agent-3" },
  "Agent Alpha": { style: "border-agent-1/20 bg-agent-1/5", textColor: "text-agent-1" },
  "Agent Beta": { style: "border-agent-2/20 bg-agent-2/5", textColor: "text-agent-2" },
  "Agent Gamma": { style: "border-agent-3/20 bg-agent-3/5", textColor: "text-agent-3" },
  "Monitor": { style: "border-monitor/20 bg-monitor/5", textColor: "text-monitor" },
};

// Transform agent name: "Fundamental" -> "Fundamental Debater"
const getAgentDisplayName = (agent: string): string => {
  if (agent === "Fundamental") return "Fundamental Debater";
  if (agent === "Sentiment") return "Sentiment Debater";
  if (agent === "Alternative") return "Alternative Debater";
  return agent;
};

const getAgentStyles = (agent: string) => {
  const displayName = getAgentDisplayName(agent);
  return agentColorMap[displayName] || agentColorMap["Agent Alpha"];
};

const typeIcons: Record<string, string> = {
  analysis: "📊",
  challenge: "⚔️",
  agreement: "🤝",
  verdict: "⚖️",
  hallucination_flag: "🚨",
  position: "📍",
  reasoning: "🧠",
  sentiment_signal: "📈",
  alternative_signal: "💡",
  source_lineage: "🔗",
};

const typeColors: Record<string, string> = {
  position: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  reasoning: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  sentiment_signal: "bg-green-500/10 text-green-700 dark:text-green-400",
  alternative_signal: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  source_lineage: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  analysis: "bg-gray-500/10 text-gray-700 dark:text-gray-400",
  challenge: "bg-red-500/10 text-red-700 dark:text-red-400",
  agreement: "bg-teal-500/10 text-teal-700 dark:text-teal-400",
  verdict: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400",
  hallucination_flag: "bg-pink-500/10 text-pink-700 dark:text-pink-400",
};

interface ReasoningPanelProps {
  isOpen: boolean;
  onClose: () => void;
  sectionId: string | null;
  analysisData?: EquityResearchResponse;
}

const ReasoningPanel = ({ isOpen, onClose, sectionId, analysisData }: ReasoningPanelProps) => {
  const [loading, setLoading] = useState(true);
  const [loadingStep, setLoadingStep] = useState(0);
  const [collapsedDimensions, setCollapsedDimensions] = useState<Set<string>>(new Set());

  const steps = ["Analyzing sources...", "Reading agent discussion...", "Collecting evidence...", "Ready"];

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setLoadingStep(0);
      setCollapsedDimensions(new Set());
      const timers = steps.map((_, i) => setTimeout(() => setLoadingStep(i), i * 700));
      const done = setTimeout(() => setLoading(false), steps.length * 700);
      return () => { timers.forEach(clearTimeout); clearTimeout(done); };
    }
  }, [isOpen]);

  // Get all dimensions from API data
  const getDimensions = (): ScoreDimension[] => {
    return analysisData?.scorecards?.[0]?.dimensions || [];
  };

  const toggleDimensionCollapse = (dimensionName: string) => {
    const newCollapsed = new Set(collapsedDimensions);
    if (newCollapsed.has(dimensionName)) {
      newCollapsed.delete(dimensionName);
    } else {
      newCollapsed.add(dimensionName);
    }
    setCollapsedDimensions(newCollapsed);
  };

  // Calculate confidence percentage based on data source
  const getConfidencePercent = (conf: number): number => {
    return typeof conf === "number" && conf <= 1 ? conf * 100 : conf;
  };

  // Determine confidence color based on percentage
  const getConfidenceColor = (conf: number): string => {
    const percent = getConfidencePercent(conf);
    if (percent >= 80) return "bg-chart-up/8 text-chart-up";
    if (percent >= 60) return "bg-warning/10 text-warning";
    return "bg-destructive/8 text-destructive";
  };

  const dimensions = getDimensions();

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
          {steps.map((step) => (
            <div key={step} className={`flex items-center gap-2 transition-opacity duration-300 ${steps.indexOf(step) <= loadingStep ? "opacity-100" : "opacity-20"}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${steps.indexOf(step) <= loadingStep ? "bg-primary" : "bg-muted"}`} />
              <span className="text-xs text-muted-foreground">{step}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3">
          {dimensions.length > 0 ? (
            dimensions.map((dimension) => {
              const isCollapsed = collapsedDimensions.has(dimension.dimension);
              const confidencePercent = getConfidencePercent(dimension.confidence);
              return (
                <div key={dimension.dimension} className="border border-border rounded-lg overflow-hidden bg-card">
                  {/* Dimension Header with Collapse Button */}
                  <button
                    onClick={() => toggleDimensionCollapse(dimension.dimension)}
                    className="w-full px-4 py-3 bg-secondary/40 hover:bg-secondary/60 transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3 flex-1 text-left">
                      <ChevronDown
                        className={`w-4 h-4 text-foreground transition-transform flex-shrink-0 ${
                          isCollapsed ? "-rotate-90" : ""
                        }`}
                      />
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-foreground truncate">{dimension.dimension}</h4>
                        <p className="text-xs text-muted-foreground truncate">{dimension.evidence}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className="text-sm font-bold font-mono text-foreground whitespace-nowrap">
                        {dimension.score.toFixed(0)}/{dimension.max_score}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono whitespace-nowrap ${getConfidenceColor(dimension.confidence)}`}>
                        {confidencePercent.toFixed(0)}%
                      </span>
                    </div>
                  </button>

                  {/* Reasoning Content - Collapsible */}
                  {!isCollapsed && (
                    <div className="p-4 bg-card space-y-3 border-t border-border/50">
                      {/* Source Section */}
                      <div>
                        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Source</div>
                        <div className="text-xs text-primary font-medium">{dimension.source}</div>
                      </div>

                      {/* Divider */}
                      <div className="border-t border-border/30" />

                      {/* Agent Discussion Log */}
                      <div>
                        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Agent Discussion</div>
                        <div className="space-y-3">
                          {dimension.reasoning.map((msg: AgentMessage, i: number) => {
                            const displayAgentName = getAgentDisplayName(msg.agent);
                            const styles = getAgentStyles(msg.agent);
                            const msgKey = `${displayAgentName}-${msg.timestamp}-${i}`;
                            const typeColor = typeColors[msg.type] || "bg-gray-500/10 text-gray-700";
                            
                            // Skip source_lineage messages - we'll show them as links below reasoning
                            if (msg.type === "source_lineage") {
                              console.log("[ReasoningPanel] Skipping source_lineage message, will show as link");
                              return null;
                            }

                            // Extract sources for reasoning messages
                            const shouldShowSources = msg.type === "reasoning";
                            const sources = shouldShowSources ? extractSourcesForDimension(dimension.reasoning) : [];
                            
                            if (shouldShowSources) {
                              console.log("[ReasoningPanel] Reasoning message found, sources count:", sources.length);
                            }

                            return (
                              <div key={msgKey}>
                                <div className={`p-2.5 rounded-md border ${styles.style}`}>
                                  <div className="flex items-start justify-between gap-2 mb-1.5">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      {displayAgentName === "Monitor" ? (
                                        <Shield className={`w-3 h-3 ${styles.textColor} flex-shrink-0`} />
                                      ) : (
                                        <Bot className={`w-3 h-3 ${styles.textColor} flex-shrink-0`} />
                                      )}
                                      <span className={`text-xs font-semibold ${styles.textColor} truncate`}>{displayAgentName}</span>
                                      <span className={`text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap flex-shrink-0 ${typeColor}`}>
                                        {msg.type.replace(/_/g, " ")}
                                      </span>
                                    </div>
                                    <span className="text-[9px] font-mono text-muted-foreground flex-shrink-0">{msg.timestamp.split("T")[1]?.substring(0, 8)}</span>
                                  </div>
                                  <p className="text-xs text-foreground/85 leading-relaxed break-words">{msg.message}</p>
                                </div>

                                {/* Display Sources Below Reasoning */}
                                {shouldShowSources && sources.length > 0 && (
                                  <div className="mt-2 ml-2 pl-3 border-l-2 border-primary/30 space-y-1">
                                    <div className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">📚 Sources:</div>
                                    <div className="space-y-1.5">
                                      {sources.map((source, idx) => (
                                        <div key={`${msgKey}-source-${idx}`} className="flex items-start gap-2">
                                          {source.source_url ? (
                                            <a 
                                              href={source.source_url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-primary/10 hover:bg-primary/20 transition-colors group"
                                            >
                                              <span className="text-[9px] font-medium text-primary truncate">
                                                {source.source || source.signal?.substring(0, 20)}
                                              </span>
                                              <ExternalLink className="w-3 h-3 text-primary flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
                                            </a>
                                          ) : (
                                            <div className="text-[9px] px-2 py-1 text-muted-foreground">
                                              {source.source || source.signal}
                                            </div>
                                          )}
                                          {source.last_updated && (
                                            <span className="text-[8px] text-muted-foreground whitespace-nowrap">
                                              {source.last_updated}
                                            </span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">No reasoning data available</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReasoningPanel;

import { useState } from "react";
import { reportSections } from "@/data/dummyData";
import { ExternalLink, Sparkles, Zap, MessageSquare, ChevronRight } from "lucide-react";

type Props = {
  onSelectParagraph: (sectionId: string) => void;
  onOpenCopilot: (text: string) => void;
};

const ReportSection = ({ onSelectParagraph, onOpenCopilot }: Props) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">AI-Generated Research Report</h3>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-chart-up" />
          <span className="text-[11px] font-mono text-muted-foreground">Confidence: 82%</span>
        </div>
      </div>

      {reportSections.map((section) => (
        <div
          key={section.id}
          className={`border rounded-md bg-card cursor-pointer transition-all ${selectedId === section.id ? "border-primary shadow-sm" : "border-border hover:border-border/80"}`}
          onClick={() => setSelectedId(section.id === selectedId ? null : section.id)}
        >
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[13px] font-semibold text-foreground">{section.title}</h4>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                section.confidence >= 85 ? "bg-chart-up/8 text-chart-up" :
                section.confidence >= 70 ? "bg-warning/10 text-warning" :
                "bg-destructive/8 text-destructive"
              }`}>
                {section.confidence}% confidence
              </span>
            </div>

            {section.shortTermFlag && section.shortTermNote && (
              <div className="mb-3 p-2.5 rounded bg-warning/5 border border-warning/15">
                <div className="flex items-start gap-2">
                  <Zap className="w-3.5 h-3.5 text-warning flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-warning leading-relaxed">{section.shortTermNote}</p>
                </div>
              </div>
            )}

            <p className="text-[13px] text-secondary-foreground leading-relaxed">{section.content}</p>

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
              <div className="flex items-center gap-1 text-muted-foreground">
                <ExternalLink className="w-3 h-3" />
                <span className="text-[10px] truncate max-w-[280px] hover:text-primary cursor-pointer">{section.source}</span>
              </div>

              {selectedId === section.id && (
                <div className="flex gap-1.5 animate-fade-in">
                  <button
                    onClick={(e) => { e.stopPropagation(); onOpenCopilot(section.content); }}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-primary/8 text-primary hover:bg-primary/15 transition-colors"
                  >
                    <MessageSquare className="w-3 h-3" /> Query
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onSelectParagraph(section.id); }}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-secondary text-foreground hover:bg-accent transition-colors"
                  >
                    <Sparkles className="w-3 h-3" /> Reasoning <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ReportSection;

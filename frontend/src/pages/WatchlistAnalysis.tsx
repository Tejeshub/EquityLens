import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import AgentAnimation from "@/components/AgentAnimation";
import ComparisonTable from "@/components/ComparisonTable";
import ReportSection from "@/components/ReportSection";
import CopilotSidebar from "@/components/CopilotSidebar";
import ReasoningPanel from "@/components/ReasoningPanel";
import { watchlists, companies } from "@/data/dummyData";
import { ArrowLeft } from "lucide-react";

const WatchlistAnalysis = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const watchlist = watchlists.find((w) => w.id === id) || watchlists[0];
  const wlCompanies = companies.filter((c) => watchlist.companies.includes(c.id));

  const [showReport, setShowReport] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotContext, setCopilotContext] = useState("");
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const [reasoningSectionId, setReasoningSectionId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-12">
        <div className={`container mx-auto px-4 py-5 transition-all ${copilotOpen || reasoningOpen ? "pr-[420px]" : ""}`}>
          <button onClick={() => navigate("/watchlists")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Watchlists
          </button>

          <div className="mb-5">
            <h1 className="text-xl font-bold text-foreground">{watchlist.name}</h1>
            <p className="text-xs text-muted-foreground">
              Comparative analysis · {wlCompanies.length} companies · {watchlist.sector} · {watchlist.cap}
            </p>
          </div>

          {!showReport ? (
            <AgentAnimation onComplete={() => setShowReport(true)} />
          ) : (
            <div className="space-y-5 animate-fade-in">
              <ComparisonTable companyIds={watchlist.companies} />
              <div>
                <h2 className="text-sm font-semibold text-foreground mb-3">Detailed Comparative Report</h2>
                <ReportSection
                  onSelectParagraph={(sid) => { setReasoningSectionId(sid); setReasoningOpen(true); setCopilotOpen(false); }}
                  onOpenCopilot={(text) => { setCopilotContext(text); setCopilotOpen(true); setReasoningOpen(false); }}
                />
              </div>
            </div>
          )}
        </div>

        <CopilotSidebar
          isOpen={copilotOpen}
          onClose={() => setCopilotOpen(false)}
          context={copilotContext}
          company={
            wlCompanies.length > 0
              ? {
                  name: wlCompanies[0].name,
                  screener_id: wlCompanies[0].ticker,
                  sector: wlCompanies[0].sector,
                }
              : undefined
          }
        />
        <ReasoningPanel isOpen={reasoningOpen} onClose={() => setReasoningOpen(false)} sectionId={reasoningSectionId} />
      </div>
    </div>
  );
};

export default WatchlistAnalysis;

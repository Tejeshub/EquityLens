import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { companies, getCompanyNews } from "@/data/dummyData";
import Navbar from "@/components/Navbar";
import CompanyOverview from "@/components/CompanyOverview";
import CandlestickChart from "@/components/CandlestickChart";
import NewsFeed from "@/components/NewsFeed";
import FinancialTable from "@/components/FinancialTable";
import ManagementTracker from "@/components/ManagementTracker";
import ReportSection from "@/components/ReportSection";
import CopilotSidebar from "@/components/CopilotSidebar";
import ReasoningPanel from "@/components/ReasoningPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAnalyze } from "@/hooks/useAnalyze";
import { Loader2, AlertCircle } from "lucide-react";
import type { EquityResearchResponse } from "@/types/api";

const CompanyDetail = () => {
  const { id } = useParams();
  const company = companies.find((c) => c.id === id) || companies[0];
  const news = getCompanyNews(company.id);

  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotContext, setCopilotContext] = useState("");
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const [reasoningSectionId, setReasoningSectionId] = useState<string | null>(null);
  const [analysisData, setAnalysisData] = useState<EquityResearchResponse | null>(null);

  // React Query mutation for /analyze
  const analyzeQuery = useAnalyze();

  // Call /analyze when component mounts or company changes
  useEffect(() => {
    const runAnalysis = async () => {
      await analyzeQuery.mutateAsync({
        companies: [
          {
            name: company.name,
            screener_id: company.ticker,
            sector: company.sector,
          },
        ],
        quarters: 4,
        debate_refinement_threshold: 0.7,
      });
    };

    runAnalysis();
  }, [company.id]);

  // Update analysis data when mutation succeeds
  useEffect(() => {
    if (analyzeQuery.data) {
      setAnalysisData(analyzeQuery.data);
    }
  }, [analyzeQuery.data]);

  const isAnalyzing = analyzeQuery.isPending;
  const scorecard = analysisData?.scorecards?.[0];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-12">
        <div className={`container mx-auto px-4 py-5 transition-all ${copilotOpen || reasoningOpen ? "pr-[420px]" : ""}`}>
          <CompanyOverview company={company} />

          {/* Analysis Loading State */}
          {isAnalyzing && (
            <div className="mt-6 p-8 border border-border rounded-lg bg-card/50 flex flex-col items-center justify-center gap-4">
              <div className="animate-spin">
                <Loader2 className="w-8 h-8 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">
                  Running Multi-Agent Analysis
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Fundamental, Sentiment & Alternative agents debating...
                </p>
              </div>
            </div>
          )}

          {/* Analysis Failed State */}
          {analyzeQuery.isError && (
            <div className="mt-6 p-4 border border-chart-down/50 rounded-lg bg-chart-down/8 flex gap-3">
              <AlertCircle className="w-4 h-4 text-chart-down flex-shrink-0 mt-0.5" />
              <div className="text-sm text-chart-down">
                <p className="font-medium">Analysis failed</p>
                <p className="text-xs mt-1">{analyzeQuery.error?.message}</p>
              </div>
            </div>
          )}

          {/* Tabs - Show when analysis complete or use dummy data */}
          {!isAnalyzing && (
            <>
              <Tabs defaultValue="overview" className="mt-5">
                <TabsList className="bg-secondary/60 border border-border">
                  <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
                  <TabsTrigger value="financials" className="text-xs">Financials</TabsTrigger>
                  <TabsTrigger value="report" className="text-xs">AI Report</TabsTrigger>
                  <TabsTrigger value="management" className="text-xs">Management</TabsTrigger>
                  {scorecard && (
                    <TabsTrigger value="analysis" className="text-xs">
                      Analysis Results
                    </TabsTrigger>
                  )}
                </TabsList>

            <TabsContent value="overview" className="mt-4 space-y-4">
              <div className="grid lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2"><CandlestickChart /></div>
                <div><NewsFeed news={news} /></div>
              </div>
            </TabsContent>

            <TabsContent value="financials" className="mt-4 space-y-4">
              <FinancialTable />
              <CandlestickChart />
            </TabsContent>

            <TabsContent value="report" className="mt-4">
              <div className="flex items-center gap-2 mb-4">
                <select className="bg-card border border-border rounded-md px-3 py-1.5 text-xs text-foreground">
                  <option>Q3 FY26 (Latest)</option>
                  <option>Q2 FY26</option>
                  <option>Q1 FY26</option>
                  <option>Q4 FY25</option>
                </select>
                <select className="bg-card border border-border rounded-md px-3 py-1.5 text-xs text-foreground">
                  <option>Quarterly Analysis</option>
                  <option>Annual FY25</option>
                  <option>Past Performance (10Y)</option>
                </select>
              </div>
              <ReportSection
                onSelectParagraph={(sid) => { setReasoningSectionId(sid); setReasoningOpen(true); setCopilotOpen(false); }}
                onOpenCopilot={(text) => { setCopilotContext(text); setCopilotOpen(true); setReasoningOpen(false); }}
              />
            </TabsContent>

            <TabsContent value="management" className="mt-4">
              <ManagementTracker />
            </TabsContent>

            {/* Analysis Tab - Show scorecard data from API */}
            {scorecard && (
              <TabsContent value="analysis" className="mt-4 space-y-6">
                {/* Overall Metrics */}
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="border border-border rounded-lg p-6 bg-card">
                    <p className="text-xs text-muted-foreground mb-2">
                      Overall Score
                    </p>
                    <p className="text-4xl font-bold text-primary">
                      {scorecard.overall_score.toFixed(1)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      out of 100
                    </p>
                  </div>
                  <div className="border border-border rounded-lg p-6 bg-card">
                    <p className="text-xs text-muted-foreground mb-2">
                      Confidence Score
                    </p>
                    <p className="text-4xl font-bold text-chart-up">
                      {scorecard.confidence_score.toFixed(0)}%
                    </p>
                  </div>
                  <div className="border border-border rounded-lg p-6 bg-card">
                    <p className="text-xs text-muted-foreground mb-2">
                      Agents Participated
                    </p>
                    <p className="text-sm font-medium text-foreground">
                      {scorecard.agents_participated?.join(", ") || "N/A"}
                    </p>
                  </div>
                </div>

                {/* Score Dimensions */}
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3">
                    Analysis Dimensions
                  </h3>
                  <div className="space-y-3">
                    {scorecard.dimensions?.map((dim, idx) => (
                      <div
                        key={idx}
                        className="border border-border rounded-lg p-4 bg-card hover:border-border/80 transition-colors"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <p className="font-medium text-sm text-foreground">
                              {dim.dimension}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {dim.evidence}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-lg font-bold text-primary">
                              {dim.score.toFixed(1)}/{dim.max_score}
                            </p>
                            <p className="text-xs bg-primary/10 text-primary px-2 py-1 rounded mt-1 inline-block">
                              {(dim.confidence * 100).toFixed(0)}% conf
                            </p>
                          </div>
                        </div>
                        <div className="bg-secondary/30 rounded p-2 text-xs">
                          <span className="text-muted-foreground">
                            Source:{" "}
                          </span>
                          <span className="text-foreground font-medium">
                            {dim.source}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Peer Comparisons */}
                {analysisData?.peer_comparisons && analysisData.peer_comparisons.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-3">
                      Peer Comparisons
                    </h3>
                    <div className="space-y-3">
                      {analysisData.peer_comparisons.map((comp, idx) => (
                        <div
                          key={idx}
                          className="border border-border rounded-lg p-4 bg-card"
                        >
                          <p className="font-medium text-sm mb-2">
                            {comp.metric}
                          </p>
                          <div className="space-y-1">
                            {comp.companies?.map((co, cidx) => (
                              <div
                                key={cidx}
                                className="flex justify-between items-center text-xs"
                              >
                                <span className="text-muted-foreground">
                                  {co.name}{" "}
                                  <span className="text-primary font-medium">
                                    #{co.rank}
                                  </span>
                                </span>
                                <span className="font-mono text-foreground">
                                  {co.value.toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>
            )}
          </Tabs>
            </>
          )}
        </div>

        <CopilotSidebar
          isOpen={copilotOpen}
          onClose={() => setCopilotOpen(false)}
          context={copilotContext}
          company={{
            name: company.name,
            screener_id: company.ticker,
            sector: company.sector,
          }}
        />
        <ReasoningPanel isOpen={reasoningOpen} onClose={() => setReasoningOpen(false)} sectionId={reasoningSectionId} />
      </div>
    </div>
  );
};

export default CompanyDetail;

import SearchBar from "@/components/SearchBar";
import { companies } from "@/data/dummyData";
import { useNavigate } from "react-router-dom";
import { TrendingUp, TrendingDown, Building2, BarChart3, Shield, Sparkles } from "lucide-react";
import Navbar from "@/components/Navbar";

const Index = () => {
  const navigate = useNavigate();

  const topGainers = [...companies].sort((a, b) => b.changePercent - a.changePercent).slice(0, 4);
  const topLosers = [...companies].sort((a, b) => a.changePercent - b.changePercent).slice(0, 4);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-12">
        {/* Hero */}
        <section className="py-16 px-4 border-b border-border">
          <div className="container mx-auto text-center space-y-5">
            <div className="flex items-center justify-center gap-1.5 mb-3">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-[11px] font-medium text-primary uppercase tracking-wider">Multi-Agent AI Research System</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground leading-tight">
              Institutional-Grade Equity Research
              <br />
              <span className="text-primary">for Indian Small & Mid Caps</span>
            </h1>
            <p className="text-muted-foreground max-w-lg mx-auto text-sm leading-relaxed">
              AI agents that scrape, analyze, debate, and verify — delivering source-cited,
              evidence-backed research with confidence scoring.
            </p>

            <div className="pt-2">
              <SearchBar />
            </div>

            <div className="flex items-center justify-center gap-6 text-muted-foreground text-xs pt-2">
              <div className="flex items-center gap-1"><BarChart3 className="w-3.5 h-3.5" /> Multi-source data</div>
              <div className="flex items-center gap-1"><Shield className="w-3.5 h-3.5" /> Anti-hallucination</div>
              <div className="flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" /> Confidence scoring</div>
            </div>
          </div>
        </section>

        {/* Market movers */}
        <section className="container mx-auto px-4 py-8">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-chart-up" /> Top Gainers
              </h3>
              <div className="border border-border rounded-md divide-y divide-border bg-card">
                {topGainers.map((c) => (
                  <button key={c.id} onClick={() => navigate(`/company/${c.id}`)} className="w-full px-4 py-2.5 flex items-center gap-3 text-left hover:bg-secondary/40 transition-colors">
                    <div className="w-8 h-8 rounded bg-chart-up/8 flex items-center justify-center">
                      <Building2 className="w-4 h-4 text-chart-up" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[13px] font-medium text-foreground">{c.name}</p>
                      <p className="text-[11px] text-muted-foreground">{c.ticker}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[13px] font-mono text-foreground">₹{c.price.toLocaleString()}</p>
                      <p className="text-[11px] font-mono text-chart-up">+{c.changePercent.toFixed(2)}%</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
                <TrendingDown className="w-4 h-4 text-chart-down" /> Top Losers
              </h3>
              <div className="border border-border rounded-md divide-y divide-border bg-card">
                {topLosers.map((c) => (
                  <button key={c.id} onClick={() => navigate(`/company/${c.id}`)} className="w-full px-4 py-2.5 flex items-center gap-3 text-left hover:bg-secondary/40 transition-colors">
                    <div className="w-8 h-8 rounded bg-chart-down/8 flex items-center justify-center">
                      <Building2 className="w-4 h-4 text-chart-down" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[13px] font-medium text-foreground">{c.name}</p>
                      <p className="text-[11px] text-muted-foreground">{c.ticker}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[13px] font-mono text-foreground">₹{c.price.toLocaleString()}</p>
                      <p className="text-[11px] font-mono text-chart-down">{c.changePercent.toFixed(2)}%</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Index;

import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { TrendingUp, TrendingDown, Building2, BarChart3, Sparkles, Search, Newspaper, Bot, MessageSquare, List } from "lucide-react";
import SearchBar from "@/components/SearchBar";
import Layout from "@/components/Layout";
import NumText from "@/components/NumText";
import { EmptyBox, ErrorBox, InfoBanner, LoadingBox, SourceDisabledNotice, SourceLine } from "@/components/DataStates";
import { useMovers } from "@/hooks/queries";
import { useCapabilities } from "@/hooks/useCapabilities";
import { fmtPercent, fmtPrice, signClass } from "@/lib/format";
import type { Capabilities, Mover, Segment } from "@/types/api";

const SEGMENTS: { value: Segment; label: string }[] = [
  { value: "small", label: "Small Cap" },
  { value: "mid", label: "Mid Cap" },
  { value: "large", label: "Large Cap" },
];

const MoverList = ({ items, up }: { items: Mover[]; up: boolean }) => (
  <div className="border border-border rounded-md divide-y divide-border bg-card">
    {items.length === 0 ? (
      <EmptyBox title={up ? "No gainers" : "No losers"}>No symbols in this segment qualified from the current data.</EmptyBox>
    ) : (
      items.map((c) => (
        <Link key={c.company_id} to={`/company/${encodeURIComponent(c.company_id)}`} className="w-full px-4 py-2.5 flex items-center gap-3 text-left hover:bg-secondary/40 transition-colors">
          <div className={`w-8 h-8 rounded ${up ? "bg-chart-up/8" : "bg-chart-down/8"} flex items-center justify-center`}>
            <Building2 className={`w-4 h-4 ${up ? "text-chart-up" : "text-chart-down"}`} aria-hidden />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-foreground truncate">{c.name}</p>
            <p className="text-[11px] text-muted-foreground">{c.symbol}</p>
          </div>
          <div className="text-right">
            <p className="text-[13px] font-mono text-foreground"><NumText text={fmtPrice(c.price)} /></p>
            <p className={`text-[11px] font-mono ${signClass(c.change_percent)}`}><NumText text={fmtPercent(c.change_percent)} /></p>
          </div>
        </Link>
      ))
    )}
  </div>
);

const FEATURES = [
  { icon: Search, title: "Company search", text: "Find NSE-listed companies by name or symbol.", needs: null },
  { icon: Newspaper, title: "News", text: "Recent headlines with their publishers and links.", needs: "news" },
  { icon: Bot, title: "AI research", text: "On-request, source-linked analysis with an inspectable scoring rubric.", needs: "ai" },
  { icon: MessageSquare, title: "Copilot", text: "Ask questions about a company; each answer says whether it is document-grounded.", needs: "ai" },
  { icon: List, title: "Watchlists", text: "Keep a list of companies you follow.", needs: null },
] as const;

const WhatIsAvailable = ({ caps, notice }: { caps: Capabilities; notice?: ReactNode }) => {
  const features = FEATURES.filter((f) => f.needs === null || (f.needs === "news" ? caps.news.enabled : caps.ai.research));
  const noSource = !caps.market_data.enabled && !caps.fundamentals.enabled && !caps.news.enabled && !caps.index_segments.enabled;
  return (
    <section className="container mx-auto px-4 py-8 space-y-5" aria-label="What is available">
      {notice}
      {noSource && (
        <p data-testid="no-sources" className="text-sm text-foreground">
          In this deployment no data source is enabled. There are no prices, charts, financials, news, AI research or Copilot answers here.
          What exists: company search (name, symbol and ISIN only), watchlists (company names only) and your account.
        </p>
      )}
      <h2 className="text-sm font-semibold text-foreground">What you can do here</h2>
      <ul className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {features.map(({ icon: Icon, title, text }) => (
          <li key={title} className="border border-border rounded-md bg-card p-3">
            <Icon className="w-4 h-4 text-primary mb-1.5" aria-hidden />
            <p className="text-[13px] font-medium text-foreground">{title}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
};

const Movers = () => {
  const [segment, setSegment] = useState<Segment>("mid");
  const caps = useCapabilities();
  const marketOn = !!caps.data && caps.data.market_data.enabled && caps.data.index_segments.enabled;
  // If capabilities cannot be loaded the backend still enforces policy; a 503 source_disabled renders as a notice.
  const movers = useMovers(segment, marketOn || caps.isError);
  const m = movers.data;

  if (caps.data && !marketOn) {
    const off = !caps.data.market_data.enabled ? caps.data.market_data : caps.data.index_segments;
    return <WhatIsAvailable caps={caps.data} notice={<SourceDisabledNotice title="Market movers are not shown" reason={off.reason} />} />;
  }

  return (
    <section className="container mx-auto px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="text-sm font-semibold text-foreground">Market movers</h2>
        <div className="flex gap-1" role="group" aria-label="Market segment">
          {SEGMENTS.map((s) => (
            <button key={s.value} aria-pressed={segment === s.value} onClick={() => setSegment(s.value)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${segment === s.value ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent"}`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {movers.isPending ? (
        <div className="border border-border rounded-md bg-card"><LoadingBox label="Loading movers…" /></div>
      ) : movers.isError ? (
        <div className="border border-border rounded-md bg-card"><ErrorBox error={movers.error} onRetry={() => movers.refetch()} title="Could not load market movers" /></div>
      ) : m && m.reason && m.universe_size === 0 ? (
        <InfoBanner>{m.reason}</InfoBanner>
      ) : m ? (
        <div className="space-y-3">
          {m.stale && <InfoBanner tone="warn">These movers are stale (the latest refresh failed or is outdated). Treat them with caution.</InfoBanner>}
          {m.partial && <InfoBanner tone="warn">Some price batches could not be fetched; showing a partial ranking ({m.batches_failed} batch(es) failed).</InfoBanner>}
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-chart-up" aria-hidden /> Top Gainers
              </h3>
              <MoverList items={m.gainers} up />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
                <TrendingDown className="w-4 h-4 text-chart-down" aria-hidden /> Top Losers
              </h3>
              <MoverList items={m.losers} up={false} />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Evaluated {m.evaluated} of {m.universe_size} symbols; excluded {m.excluded} symbols with stale/insufficient data.
          </p>
          <SourceLine
            label={caps.data?.market_data.provider ? `Delayed – ${caps.data.market_data.provider}` : "Delayed"}
            source={m.source}
            asOf={m.as_of_date}
            retrievedAt={m.fetched_at}
            cached={m.cached ?? undefined}
            stale={m.stale ?? undefined}
            note={m.note}
          />
        </div>
      ) : null}
    </section>
  );
};

const Index = () => {
  const caps = useCapabilities().data;
  const pricesOn = !caps || caps.market_data.enabled;
  const finOn = !caps || caps.fundamentals.enabled;
  const newsOn = !caps || caps.news.enabled;
  const offered = [...(newsOn ? ["news"] : []), ...(pricesOn ? ["delayed price data"] : []), ...(finOn ? ["reported financials"] : [])];
  const intro = offered.length > 0
    ? `Search a company to see ${offered.join(", ").replace(/, ([^,]*)$/, " and $1")} with their sources and timestamps.${!caps || caps.ai.research ? " AI-generated research is informational only and is run only when you ask for it." : ""}`
    : "Search for an NSE-listed company by name, symbol or ISIN. In this deployment no data source is enabled, so no market data, financials or news are shown.";
  return (
    <Layout title="Discover">
      <div>
        <section className="py-16 px-4 border-b border-border">
          <div className="container mx-auto text-center space-y-5">
            <div className="flex items-center justify-center gap-1.5 mb-3">
              <Sparkles className="w-4 h-4 text-primary" aria-hidden />
              <span className="text-[11px] font-medium text-primary uppercase tracking-wider">Equity research for Indian listed companies</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground leading-tight">
              Source-linked equity research
              <br />
              <span className="text-primary">for NSE-listed companies</span>
            </h1>
            <p className="text-muted-foreground max-w-lg mx-auto text-sm leading-relaxed">
              {intro}
            </p>

            <div className="pt-2">
              <SearchBar />
            </div>

            {offered.length > 0 && (
              <div className="flex items-center justify-center gap-6 text-muted-foreground text-xs pt-2">
                <div className="flex items-center gap-1"><BarChart3 className="w-3.5 h-3.5" aria-hidden /> Every figure shows its source</div>
              </div>
            )}
          </div>
        </section>

        <Movers />
      </div>
    </Layout>
  );
};

export default Index;

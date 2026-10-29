import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { TrendingUp, TrendingDown, Building2, BarChart3, Sparkles, Search, Newspaper, Bot, MessageSquare, List } from "lucide-react";
import SearchBar from "@/components/SearchBar";
import Layout from "@/components/Layout";
import { Reveal } from "@/landing/Reveal";
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
  <div className="border border-border rounded-lg divide-y divide-border bg-card overflow-hidden">
    {items.length === 0 ? (
      <EmptyBox title={up ? "No gainers" : "No losers"}>No symbols in this segment qualified from the current data.</EmptyBox>
    ) : (
      items.map((c) => (
        <Link key={c.company_id} to={`/company/${encodeURIComponent(c.company_id)}`} className="w-full px-5 py-3 flex items-center gap-3 text-left hover:bg-fog transition-colors">
          <div className={`w-9 h-9 rounded-full ${up ? "bg-chart-up/8" : "bg-chart-down/8"} flex items-center justify-center`}>
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
    <section className="container mx-auto px-4 py-16 space-y-6" aria-label="What is available">
      {notice}
      {noSource && (
        <p data-testid="no-sources" className="surface-peach p-6 text-base leading-relaxed">
          In this deployment no data source is enabled. There are no prices, charts, financials, news, AI research or Copilot answers here.
          What exists: company search (name, symbol and ISIN only), watchlists (company names only) and your account.
        </p>
      )}
      <h2 className="text-3xl md:text-4xl text-foreground">What you can do here</h2>
      <ul className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {features.map(({ icon: Icon, title, text }) => (
          <li key={title} className="rounded-lg bg-peach/40 p-5">
            <Icon className="w-5 h-5 text-sienna mb-4" aria-hidden />
            <p className="text-base font-medium text-foreground">{title}</p>
            <p className="text-sm text-muted-foreground mt-1.5 leading-snug">{text}</p>
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
    <section className="container mx-auto px-4 py-16">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <h2 className="text-3xl md:text-4xl text-foreground">Market movers</h2>
        <div className="flex gap-1" role="group" aria-label="Market segment">
          {SEGMENTS.map((s) => (
            <button key={s.value} aria-pressed={segment === s.value} onClick={() => setSegment(s.value)}
              className={`px-4 py-2 rounded-full text-sm transition-colors duration-200 ${segment === s.value ? "bg-peach text-sienna" : "bg-secondary text-secondary-foreground hover:bg-peach/50"}`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {movers.isPending ? (
        <div className="border border-border rounded-lg bg-card"><LoadingBox label="Loading movers…" variant="list" /></div>
      ) : movers.isError ? (
        <div className="border border-border rounded-lg bg-card"><ErrorBox error={movers.error} onRetry={() => movers.refetch()} title="Could not load market movers" /></div>
      ) : m && m.reason && m.universe_size === 0 ? (
        <InfoBanner>{m.reason}</InfoBanner>
      ) : m ? (
        <div className="space-y-3">
          {m.stale && <InfoBanner tone="warn">These movers are stale (the latest refresh failed or is outdated). Treat them with caution.</InfoBanner>}
          {m.partial && <InfoBanner tone="warn">Some price batches could not be fetched; showing a partial ranking ({m.batches_failed} batch(es) failed).</InfoBanner>}
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-medium text-foreground mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-chart-up" aria-hidden /> Top Gainers
              </h3>
              <MoverList items={m.gainers} up />
            </div>
            <div>
              <h3 className="text-lg font-medium text-foreground mb-4 flex items-center gap-2">
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
        <section className="pt-6 px-4">
          <div className="container mx-auto px-4">
          <div className="surface-peach text-center space-y-8 py-16 md:py-24 px-6">
            <Reveal className="flex items-center justify-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-sienna" aria-hidden />
              <span className="metric-label text-sienna">Equity research for Indian listed companies</span>
            </Reveal>
            <Reveal as="h1" delay={80} className="display-serif text-5xl sm:text-6xl md:text-7xl lg:text-[90px] text-sienna">
              Source-linked equity research
              <br />
              <em className="italic">for NSE-listed companies</em>
            </Reveal>
            <Reveal as="p" delay={200} className="text-sienna max-w-xl mx-auto text-base md:text-lg leading-snug">
              {intro}
            </Reveal>

            <Reveal delay={320} className="pt-4">
              <SearchBar />
            </Reveal>

            {offered.length > 0 && (
              <div className="flex items-center justify-center gap-6 text-sienna text-sm pt-2">
                <div className="flex items-center gap-1"><BarChart3 className="w-3.5 h-3.5" aria-hidden /> Every figure shows its source</div>
              </div>
            )}
          </div>
          </div>
        </section>

        <Movers />
      </div>
    </Layout>
  );
};

export default Index;

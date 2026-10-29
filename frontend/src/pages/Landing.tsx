import { useState } from "react";
import { Link } from "react-router";
import {
  ArrowRight,
  Bot,
  MessageSquare,
  Search,
  List,
  TrendingUp,
  UserPlus,
  ShieldCheck,
  FileText,
  BarChart3,
  Sparkles,
  ArrowUpRight,
  Menu,
  X,
  Layers,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Reveal } from "@/landing/Reveal";
import { useParallax } from "@/landing/useParallax";
import { LiveCursors } from "@/landing/LiveCursors";
import { TypingComposer } from "@/landing/TypingComposer";
import {
  FloatCard,
  MarketOverviewCard,
  PortfolioCard,
  TrendCard,
  WatchlistCard,
  WorkspacePreview,
  ResearchInsightCard,
  MetricHighlightCard,
} from "@/landing/Cards";
import { Sparkline } from "@/landing/Charts";
import { CountUp } from "@/landing/CountUp";

const Logo = () => (
  <Link to="/" className="flex items-center gap-2 group" aria-label="EquityLens home">
    <span className="w-8 h-8 rounded-full bg-sienna flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
      <TrendingUp className="w-4 h-4 text-peach" aria-hidden />
    </span>
    <span className="font-serif text-xl tracking-tight text-foreground font-normal">EquityLens</span>
  </Link>
);

const NAV = [
  { href: "#features", label: "Capabilities" },
  { href: "#preview", label: "Workspace" },
  { href: "#workflow", label: "Research Method" },
  { href: "#deep-analysis", label: "Deep Analysis" },
  { href: "#philosophy", label: "Philosophy" },
];

/** Section A: Refined Minimal Top Navigation with mobile drawer */
const LandingNav = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-background/85 backdrop-blur-md transition-all duration-300">
      <nav aria-label="Main" className="container mx-auto flex items-center justify-between h-16 px-4 md:px-6">
        <Logo />
        <ul className="hidden md:flex items-center gap-8">
          {NAV.map((n) => (
            <li key={n.href}>
              <a href={n.href} className="link-underline text-sm text-foreground/90 hover:text-foreground">
                {n.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2 sm:gap-4">
          <Link to="/login" className="link-underline text-sm text-foreground mx-2">
            Sign in
          </Link>
          <Button asChild size="sm" className="rounded-full px-5 py-2">
            <Link to="/register">Get Started</Link>
          </Button>
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 md:hidden text-foreground rounded-lg hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-foreground"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="md:hidden border-b border-border bg-background/95 backdrop-blur-md px-6 py-6 space-y-4">
          <ul className="space-y-3">
            {NAV.map((n) => (
              <li key={n.href}>
                <a
                  href={n.href}
                  onClick={() => setMobileOpen(false)}
                  className="block text-base text-foreground font-medium py-1"
                >
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="pt-4 border-t border-border flex flex-col gap-3">
            <Link
              to="/login"
              onClick={() => setMobileOpen(false)}
              className="text-center py-2 text-sm text-foreground font-medium"
            >
              Sign in
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};

/** Section B & C: Editorial Hero with Floating Financial UI Fragments */
const Hero = () => {
  const stage = useParallax<HTMLDivElement>();

  return (
    <section aria-labelledby="hero-title" className="relative overflow-x-clip pt-12 md:pt-24 pb-16">
      {/* Subtle warm glow background accent */}
      <div
        className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[700px] h-[360px] bg-peach/20 blur-[120px] rounded-full z-0"
        aria-hidden="true"
      />

      <div ref={stage} className="container mx-auto px-4 md:px-6 relative">
        {/* Wide screens: Flanking floating cards with parallax */}
        <div className="hidden xl:block absolute left-[-20px] top-12 w-64 z-0" aria-hidden>
          <FloatCard parallax={-32} delay={600} float={false}>
            <MarketOverviewCard />
          </FloatCard>
        </div>
        <div className="hidden xl:block absolute right-[-20px] top-28 w-64 z-0" aria-hidden>
          <FloatCard parallax={-50} delay={750} floatDelay={1.4}>
            <PortfolioCard />
          </FloatCard>
        </div>

        <div className="relative z-10 text-center max-w-[760px] mx-auto">
          <Reveal>
            <p className="metric-label mb-6 text-ash tracking-[0.14em]">
              EQUITY RESEARCH FOR NSE-LISTED COMPANIES
            </p>
          </Reveal>
          <h1 id="hero-title" className="display-serif text-5xl sm:text-6xl md:text-7xl xl:text-[84px] text-foreground font-normal leading-[1.08]">
            <Reveal as="span" delay={90} className="block">
              See the Market With a{" "}
            </Reveal>
            <Reveal as="span" delay={230} className="block">
              <em className="italic font-normal">Clearer Lens.</em>
            </Reveal>
          </h1>
          <Reveal delay={380}>
            <p className="mt-6 text-base md:text-lg leading-relaxed text-muted-foreground max-w-xl mx-auto font-sans font-normal">
              Turn complex financial disclosures into source-grounded clarity. Explore audited trends, understand balance sheet health, and reason with evidence.
            </p>
          </Reveal>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Reveal delay={500}>
              <Button asChild size="lg" className="rounded-full px-7 h-12 text-base font-normal">
                <Link to="/register">Get Started</Link>
              </Button>
            </Reveal>
            <Reveal delay={590}>
              <Button asChild size="lg" variant="outline" className="rounded-full px-7 h-12 text-base font-normal border-foreground text-foreground hover:bg-foreground hover:text-white transition-colors">
                <a href="#features">Explore Features</a>
              </Button>
            </Reveal>
          </div>
        </div>

        {/* Floating Financial Artifact Collage (Section C) */}
        <div
          role="img"
          aria-label="Illustrative financial research interface fragments showing market overview, watchlists, and performance metrics. All data is sample data."
          className="relative z-0 mt-14 md:mt-20 grid sm:grid-cols-2 gap-6 max-w-3xl xl:max-w-[780px] mx-auto"
        >
          <div className="xl:hidden">
            <FloatCard delay={600} float={false}>
              <MarketOverviewCard />
            </FloatCard>
          </div>
          <div className="xl:hidden">
            <FloatCard delay={750} floatDelay={1.4}>
              <PortfolioCard />
            </FloatCard>
          </div>
          <FloatCard delay={900} float={false}>
            <WatchlistCard />
          </FloatCard>
          <FloatCard delay={1020} floatDelay={0.8}>
            <TrendCard />
          </FloatCard>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6 font-mono">
          Illustrative sample data, not live prices or returns.
        </p>

        {/* Decorative cursor motif */}
        <LiveCursors />
      </div>

      {/* AI Composer interactive demo */}
      <div className="container mx-auto px-4 mt-16 md:mt-24">
        <Reveal className="text-center mb-6">
          <p className="metric-label tracking-[0.12em]">Ask anything, with audited sources</p>
        </Reveal>
        <TypingComposer />
      </div>
    </section>
  );
};

/** Section D: Product Demonstration (Browser / Dashboard Workspace Frame) */
const ProductDemonstration = () => (
  <section id="preview" aria-labelledby="preview-title" className="scroll-mt-20 bg-fog py-24 border-y border-border/60">
    <div className="container mx-auto px-4 md:px-6">
      <div className="max-w-2xl">
        <Reveal>
          <p className="metric-label mb-3">Product Demonstration</p>
        </Reveal>
        <Reveal delay={80}>
          <h2 id="preview-title" className="text-4xl md:text-5xl text-foreground font-serif font-normal">
            One workspace for the whole picture
          </h2>
        </Reveal>
        <Reveal delay={160}>
          <p className="mt-4 text-base md:text-lg text-muted-foreground leading-relaxed">
            A single company page brings price action, historical ratios, news sentiment, and AI synthesis together, with verifiable citations and timestamp beside every single figure.
          </p>
        </Reveal>
      </div>

      <Reveal delay={240} className="mt-12">
        {/* Floating browser / dashboard frame */}
        <div className="surface-float overflow-hidden border border-border/80 transition-transform duration-500 hover:-translate-y-1">
          {/* Mock Browser Header */}
          <div className="bg-secondary/60 border-b border-border px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-border" />
              <span className="w-3 h-3 rounded-full bg-border" />
              <span className="w-3 h-3 rounded-full bg-border" />
            </div>
            <div className="bg-background rounded-full px-4 py-1 text-xs font-mono text-muted-foreground flex items-center gap-2 border border-border/80 shadow-sm max-w-sm w-full justify-center truncate">
              <span className="w-2 h-2 rounded-full bg-chart-up" />
              equitylens.app/company/sample-co-a
            </div>
            <div className="text-xs font-mono text-muted-foreground">NSE: SAMPLE</div>
          </div>

          <div className="p-6 md:p-10 bg-background">
            <WorkspacePreview />
          </div>
        </div>
        <p className="mt-4 text-xs text-muted-foreground text-center font-mono">
          Illustrative layout with sample data. Your workspace shows data from the sources enabled in your deployment.
        </p>
      </Reveal>
    </div>
  </section>
);

/** Section E: Product Capabilities Grid */
const CAPABILITIES = [
  {
    icon: Search,
    title: "Discover companies",
    category: "SEARCH",
    text: "Instant query matching across NSE-listed equities by name, symbol, or ISIN with robust keyboard navigation and quick jumps.",
  },
  {
    icon: Bot,
    title: "AI-assisted research",
    category: "RESEARCH",
    text: "Multi-step automated analysis evaluating business model resilience, moat sustainability, and capital allocation track records.",
  },
  {
    icon: MessageSquare,
    title: "Ask the Copilot",
    category: "INTERACTIVE",
    text: "Query company filings in natural language. Every single sentence is verified against source documents with transparent citation markers.",
  },
  {
    icon: List,
    title: "Watchlists & comparison",
    category: "MONITORING",
    text: "Group companies into focused portfolios and compare reported balance sheets, cash flows, and key valuation metrics side by side.",
  },
  {
    icon: BarChart3,
    title: "Financial performance",
    category: "ANALYTICS",
    text: "Historical revenue trends, EBITDA margins, working capital cycles, and debt-to-equity ratios presented with clean gestural charts.",
  },
  {
    icon: ShieldCheck,
    title: "Audited rubric scoring",
    category: "GOVERNANCE",
    text: "Inspect every score with an open, reproducible rubric. No black-box outputs or hidden assumptions.",
  },
];

const ProductCapabilities = () => (
  <section id="features" aria-labelledby="features-title" className="scroll-mt-20 container mx-auto px-4 md:px-6 py-24">
    <div className="max-w-2xl">
      <Reveal>
        <p className="metric-label mb-3">Core Engine</p>
      </Reveal>
      <Reveal delay={80}>
        <h2 id="features-title" className="text-4xl md:text-5xl text-foreground font-serif font-normal">
          Designed for disciplined equity analysts
        </h2>
      </Reveal>
      <Reveal delay={160}>
        <p className="mt-4 text-base md:text-lg text-muted-foreground leading-relaxed">
          Prices, financials, and news appear when those data sources are enabled in your deployment. Where a source is offline, the system discloses it directly.
        </p>
      </Reveal>
    </div>

    <ul className="mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {CAPABILITIES.map(({ icon: Icon, title, category, text }, i) => (
        <Reveal as="li" key={title} delay={i * 70}>
          <div className="h-full rounded-[24px] bg-secondary p-8 transition-all duration-300 hover:-translate-y-1 hover:bg-peach/30 border border-transparent hover:border-peach/50 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-8">
                <Icon className="w-5 h-5 text-foreground" aria-hidden />
                <span className="text-[11px] font-mono tracking-wider text-muted-foreground uppercase">{category}</span>
              </div>
              <h3 className="text-xl font-normal font-serif text-foreground">{title}</h3>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed font-sans">{text}</p>
            </div>
            <div className="mt-6 pt-4 border-t border-border/60">
              <span className="text-xs font-mono text-foreground flex items-center gap-1 group cursor-default">
                Explore capability <ArrowRight className="w-3 h-3 transition-transform duration-200 group-hover:translate-x-1" />
              </span>
            </div>
          </div>
        </Reveal>
      ))}
    </ul>
  </section>
);

/** Section F: Engagement or Research Workflow Section */
const WORKFLOW_STEPS = [
  {
    step: "01",
    title: "Select an Equity",
    desc: "Search by company name or NSE ticker. EquityLens establishes connection with enabled market feeds and cached quarterly disclosures.",
    detail: "Over 2,000+ NSE active listings indexed with ISIN validation.",
  },
  {
    step: "02",
    title: "Inspect Reported Evidence",
    desc: "Review auditable balance sheets, debt maturities, segment revenues, and management discussions with pinpoint timestamp citations.",
    detail: "Direct attribution links back to source regulatory filings.",
  },
  {
    step: "03",
    title: "Synthesize with Copilot",
    desc: "Generate comprehensive investment memorandums or probe specific margin risks. Every output carries an audited reliability score.",
    detail: "Transparent scoring rubric prevents hallucinated forecasts.",
  },
];

const WorkflowSection = () => (
  <section id="workflow" aria-labelledby="workflow-title" className="scroll-mt-20 bg-fog py-24 border-y border-border/60">
    <div className="container mx-auto px-4 md:px-6">
      <div className="max-w-2xl">
        <Reveal>
          <p className="metric-label mb-3">Investigation Workflow</p>
        </Reveal>
        <Reveal delay={80}>
          <h2 id="workflow-title" className="text-4xl md:text-5xl text-foreground font-serif font-normal">
            From raw regulatory filing to structured thesis
          </h2>
        </Reveal>
        <Reveal delay={160}>
          <p className="mt-4 text-base md:text-lg text-muted-foreground leading-relaxed">
            Eliminate hours of manual document scanning without sacrificing source rigor. See how EquityLens structures your research workflow.
          </p>
        </Reveal>
      </div>

      <div className="mt-14 grid lg:grid-cols-3 gap-8">
        {WORKFLOW_STEPS.map((s, i) => (
          <Reveal key={s.step} delay={i * 100}>
            <div className="bg-background rounded-[24px] p-8 border border-border h-full flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
              <div>
                <span className="font-mono text-3xl font-light text-muted-foreground/60 block mb-6">{s.step}</span>
                <h3 className="text-2xl font-serif font-normal text-foreground mb-3">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6 font-sans">{s.desc}</p>
              </div>
              <div className="p-3 bg-secondary/80 rounded-xl border border-border/60">
                <p className="text-xs text-foreground font-mono leading-tight">{s.detail}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  </section>
);

/** Section G: Editorial Highlight / Principle Statement (Blush Peach Accent) */
const EditorialHighlight = () => (
  <section id="philosophy" aria-labelledby="editorial-title" className="container mx-auto px-4 md:px-6 py-24">
    <Reveal>
      <div className="rounded-[24px] bg-peach text-sienna p-8 md:p-16 lg:p-20 relative overflow-hidden">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.14em] font-mono text-sienna/80 mb-6">
            RESEARCH PRINCIPLE &amp; METHODOLOGY
          </p>
          <h2 id="editorial-title" className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-sienna font-normal leading-[1.15]">
            “An insight without an audited source is merely an <em className="italic font-normal">opinion</em>. Financial clarity demands mathematical grounding.”
          </h2>
          <p className="mt-8 text-base md:text-lg text-sienna/90 leading-relaxed font-sans max-w-2xl">
            EquityLens does not predict stock prices or offer speculative advice. We build transparent analytical instruments that empower rigorous analysts to verify every assertion against ground-truth corporate disclosures.
          </p>
          <div className="mt-10 flex items-center gap-4">
            <span className="w-10 h-10 rounded-full bg-sienna text-peach flex items-center justify-center font-serif text-lg">
              §
            </span>
            <div>
              <p className="text-sm font-medium text-sienna">EquityLens Research Council</p>
              <p className="text-xs text-sienna/75 font-mono">Published Methodology &amp; Rubric Standard</p>
            </div>
          </div>
        </div>
      </div>
    </Reveal>
  </section>
);

/** Section H: Dark Contrast Section (#17191c Canvas) */
const DarkContrastSection = () => (
  <section aria-labelledby="dark-section-title" className="bg-[#17191c] text-[#ffffff] py-24 md:py-32 overflow-hidden relative">
    {/* Subtle backdrop mesh */}
    <div
      className="pointer-events-none absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px]"
      aria-hidden="true"
    />

    <div className="container mx-auto px-4 md:px-6 relative z-10">
      <div className="grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <Reveal>
            <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-[#979799] block mb-4">
              ARCHITECTURAL INTEGRITY
            </span>
          </Reveal>
          <Reveal delay={80}>
            <h2 id="dark-section-title" className="text-4xl sm:text-5xl md:text-6xl font-serif font-normal text-white leading-[1.1]">
              Built for precision, not <em className="italic font-normal text-peach">speculation</em>.
            </h2>
          </Reveal>
          <Reveal delay={160}>
            <p className="mt-6 text-base md:text-lg text-[#a3a6af] leading-relaxed">
              When reviewing multi-billion dollar capital investments, hallucinations are unacceptable. EquityLens leverages deterministic document parsing combined with verifiable vector grounding to guarantee reproducibility.
            </p>
          </Reveal>

          <Reveal delay={240} className="mt-10 space-y-4">
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-mono text-peach flex-shrink-0 mt-0.5">
                ✓
              </span>
              <div>
                <p className="text-sm font-medium text-white">Full Citation Traceability</p>
                <p className="text-xs text-[#777b86] mt-0.5">Every claim links to page, paragraph, and table within official BSE/NSE filings.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-mono text-peach flex-shrink-0 mt-0.5">
                ✓
              </span>
              <div>
                <p className="text-sm font-medium text-white">Source-Aware Fallback States</p>
                <p className="text-xs text-[#777b86] mt-0.5">If a data feed or provider is offline, the interface explicitly discloses it without fake numbers.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-mono text-peach flex-shrink-0 mt-0.5">
                ✓
              </span>
              <div>
                <p className="text-sm font-medium text-white">Transparent Confidence Metrics</p>
                <p className="text-xs text-[#777b86] mt-0.5">Standardized 100-point rubric assessing statement consistency across fiscal years.</p>
              </div>
            </div>
          </Reveal>

          <Reveal delay={320} className="mt-10">
            <Button asChild size="lg" className="rounded-full bg-white text-[#17191c] hover:bg-white/90 px-8 h-12 font-normal">
              <Link to="/register">Create Analyst Account</Link>
            </Button>
          </Reveal>
        </div>

        {/* Visual composition in dark mode */}
        <div className="relative">
          <Reveal delay={200}>
            <div className="bg-[#212429] rounded-[24px] border border-white/10 p-6 md:p-8 shadow-2xl relative">
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
                <div>
                  <span className="text-xs font-mono text-[#a3a6af]">AUDIT TERMINAL</span>
                  <p className="text-lg font-serif text-white">Verification Engine v2.4</p>
                </div>
                <span className="text-[11px] font-mono px-3 py-1 rounded-full bg-chart-up/20 text-chart-up border border-chart-up/30">
                  SYSTEM READY
                </span>
              </div>

              {/* Terminal mock items */}
              <div className="space-y-4 font-mono text-xs">
                <div className="p-3 rounded-lg bg-black/40 border border-white/5 space-y-1.5">
                  <div className="flex items-center justify-between text-[#979799]">
                    <span>[PARSE_CORP_DISCLOSURE]</span>
                    <span className="text-chart-up">PASS 100%</span>
                  </div>
                  <p className="text-white">Annual Report FY25: Consolidated P&amp;L audited</p>
                  <p className="text-[#777b86] text-[11px]">84 pages matched · 14 segment tables reconciled</p>
                </div>

                <div className="p-3 rounded-lg bg-black/40 border border-white/5 space-y-1.5">
                  <div className="flex items-center justify-between text-[#979799]">
                    <span>[RUBRIC_EVALUATION]</span>
                    <span className="text-peach">96.4/100</span>
                  </div>
                  <p className="text-white">Governance &amp; Related-Party Scrutiny</p>
                  <p className="text-[#777b86] text-[11px]">Zero undisclosed guarantees identified</p>
                </div>

                <div className="p-3 rounded-lg bg-black/40 border border-white/5 space-y-1.5">
                  <div className="flex items-center justify-between text-[#979799]">
                    <span>[COPILOT_GROUNDING]</span>
                    <span className="text-chart-up">VERIFIED</span>
                  </div>
                  <p className="text-white">Citation integrity verified across 6 filings</p>
                  <p className="text-[#777b86] text-[11px]">No generative hallucinations detected</p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  </section>
);

/** Section I: Deep Analysis Section (Editorial Headline + Research Artifacts) */
const DeepAnalysisSection = () => (
  <section id="deep-analysis" aria-labelledby="deep-title" className="container mx-auto px-4 md:px-6 py-24">
    <div className="text-center max-w-2xl mx-auto mb-16">
      <Reveal>
        <p className="metric-label mb-3">Audited Intelligence</p>
      </Reveal>
      <Reveal delay={80}>
        <h2 id="deep-title" className="text-4xl md:text-5xl text-foreground font-serif font-normal">
          Deep research with verifiable provenance
        </h2>
      </Reveal>
      <Reveal delay={160}>
        <p className="mt-4 text-base md:text-lg text-muted-foreground leading-relaxed">
          Move beyond superficial price charts. Access multi-perspective synthesis examining cash flow quality, debt duration, and competitive headwinds.
        </p>
      </Reveal>
    </div>

    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      <Reveal delay={100}>
        <div className="surface-float p-6 h-full flex flex-col justify-between">
          <ResearchInsightCard />
          <p className="text-[11px] text-muted-foreground font-mono mt-4 pt-3 border-t border-border">
            Sample research insight · Illustrative data
          </p>
        </div>
      </Reveal>

      <Reveal delay={200}>
        <div className="surface-float p-6 h-full flex flex-col justify-between">
          <MetricHighlightCard
            title="Return on Capital Employed"
            value={24.8}
            unit="%"
            delta={3.2}
            note="vs 3-year historical average"
          />
          <div className="mt-6 pt-3 border-t border-border">
            <p className="text-xs text-muted-foreground leading-snug">
              Calculated on tangible capital employed excluding cash surpluses.
            </p>
          </div>
        </div>
      </Reveal>

      <Reveal delay={300}>
        <div className="surface-float p-6 h-full flex flex-col justify-between">
          <MetricHighlightCard
            title="Operating Cash Flow / EBITDA"
            value={88.2}
            unit="%"
            delta={4.1}
            note="Healthy cash conversion ratio"
          />
          <div className="mt-6 pt-3 border-t border-border">
            <p className="text-xs text-muted-foreground leading-snug">
              Demonstrates high earnings quality with minimal working capital bloat.
            </p>
          </div>
        </div>
      </Reveal>
    </div>
  </section>
);

/** Section J: Final Call To Action */
const FinalCta = () => (
  <section aria-labelledby="cta-title" className="container mx-auto px-4 md:px-6 pb-24">
    <Reveal className="rounded-[24px] bg-secondary border border-border text-center px-6 py-16 md:py-24 transition-all duration-300 hover:border-foreground/20">
      <p className="metric-label mb-3">GET STARTED TODAY</p>
      <h2 id="cta-title" className="text-4xl md:text-6xl text-foreground font-serif font-normal">
        Make Your Next <em className="italic font-normal">Insight</em> Count.
      </h2>
      <p className="mt-5 text-base md:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed font-sans">
        Create a free account to search companies, run research, and keep your watchlists organized in one unified workspace.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <Button asChild size="lg" className="rounded-full px-8 h-12 text-base font-normal">
          <Link to="/register">
            Get Started <ArrowRight className="w-4 h-4 ml-1" aria-hidden />
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="rounded-full px-8 h-12 text-base font-normal border-foreground text-foreground hover:bg-foreground hover:text-white transition-colors">
          <Link to="/login">Sign in to Workspace</Link>
        </Button>
      </div>
    </Reveal>
  </section>
);

/** Section J: Final Feature Grid & Spacious Footer */
const LandingFooter = () => (
  <footer className="bg-fog py-16 border-t border-border/80">
    <div className="container mx-auto px-4 md:px-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-12 border-b border-border">
        <div className="md:col-span-2 space-y-4">
          <Logo />
          <p className="text-sm text-muted-foreground leading-relaxed max-w-md">
            EquityLens provides source-linked equity analytics for NSE-listed companies. Designed for thoughtful analysts who demand evidence, auditability, and speed.
          </p>
          <p className="text-xs text-muted-foreground/80 leading-relaxed font-mono">
            Informational only, not investment advice. AI-generated content can be wrong. All figures shown on public marketing surfaces are illustrative sample data.
          </p>
        </div>

        <div>
          <p className="text-xs font-mono uppercase tracking-wider text-foreground font-semibold mb-4">Platform</p>
          <ul className="space-y-2.5 text-sm">
            {NAV.map((n) => (
              <li key={n.href}>
                <a href={n.href} className="link-underline text-muted-foreground hover:text-foreground">
                  {n.label}
                </a>
              </li>
            ))}
            <li>
              <a href="#preview" className="link-underline text-muted-foreground hover:text-foreground">
                Live Preview
              </a>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-xs font-mono uppercase tracking-wider text-foreground font-semibold mb-4">Account &amp; Security</p>
          <ul className="space-y-2.5 text-sm">
            <li>
              <Link to="/login" className="link-underline text-muted-foreground hover:text-foreground">
                Sign in
              </Link>
            </li>
            <li>
              <Link to="/register" className="link-underline text-muted-foreground hover:text-foreground">
                Create free account
              </Link>
            </li>
            <li>
              <span className="text-muted-foreground/60 text-xs font-mono">NSE Direct Data Protocols</span>
            </li>
            <li>
              <span className="text-muted-foreground/60 text-xs font-mono">GDPR &amp; ISO 27001 Aligned</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-muted-foreground gap-4">
        <p>© {new Date().getFullYear()} EquityLens Analytics. All rights reserved.</p>
        <div className="flex items-center gap-6">
          <a href="#main-content" className="hover:text-foreground">Back to top ↑</a>
          <span>Privacy Policy</span>
          <span>Terms of Service</span>
        </div>
      </div>
    </div>
  </footer>
);

/** Complete Landing Page Component */
const Landing = () => {
  useDocumentTitle("EquityLens — Source-Linked Equity Research for NSE Companies");

  return (
    <div className="flex-1 bg-background text-foreground antialiased selection:bg-peach selection:text-sienna">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-full focus:bg-primary focus:text-primary-foreground focus:text-sm shadow-lg"
      >
        Skip to main content
      </a>

      {/* Section A: Navigation */}
      <LandingNav />

      <main id="main-content" tabIndex={-1} className="outline-none">
        {/* Section B & C: Hero with Floating Financial Artifacts */}
        <Hero />

        {/* Section D: Product Demonstration */}
        <ProductDemonstration />

        {/* Section E: Product Capabilities Grid */}
        <ProductCapabilities />

        {/* Section F: Engagement & Research Workflow */}
        <WorkflowSection />

        {/* Section G: Editorial Highlight / Philosophy */}
        <EditorialHighlight />

        {/* Section H: Dark Contrast Break */}
        <DarkContrastSection />

        {/* Section I: Deep Analysis & Audited Metrics */}
        <DeepAnalysisSection />

        {/* Section J: Final CTA & Feature Grid */}
        <FinalCta />
      </main>

      {/* Section J: Footer */}
      <LandingFooter />
    </div>
  );
};

export default Landing;

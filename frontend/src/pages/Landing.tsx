import { Link } from "react-router";
import { ArrowRight, Bot, MessageSquare, Search, List, TrendingUp, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Reveal } from "@/landing/Reveal";
import { useParallax } from "@/landing/useParallax";
import { LiveCursors } from "@/landing/LiveCursors";
import { TypingComposer } from "@/landing/TypingComposer";
import { FloatCard, MarketOverviewCard, PortfolioCard, TrendCard, WatchlistCard, WorkspacePreview } from "@/landing/Cards";

const Logo = () => (
  <Link to="/" className="flex items-center gap-2" aria-label="EquityLens home">
    <span className="w-8 h-8 rounded-full bg-sienna flex items-center justify-center">
      <TrendingUp className="w-4 h-4 text-peach" aria-hidden />
    </span>
    <span className="font-serif text-xl tracking-tight text-foreground">EquityLens</span>
  </Link>
);

const NAV = [
  { href: "#features", label: "Features" },
  { href: "#preview", label: "Preview" },
  { href: "#how-it-works", label: "How it works" },
];

const LandingNav = () => (
  <header className="sticky top-0 z-50 bg-background/85 backdrop-blur-md">
    <nav aria-label="Main" className="container mx-auto flex items-center justify-between h-16 px-4">
      <Logo />
      <ul className="hidden md:flex items-center gap-8">
        {NAV.map((n) => (
          <li key={n.href}><a href={n.href} className="link-underline text-sm text-foreground">{n.label}</a></li>
        ))}
      </ul>
      <div className="flex items-center gap-2 sm:gap-4">
        <Link to="/login" className="link-underline text-sm text-foreground mx-2">Sign in</Link>
        <Button asChild size="sm"><Link to="/register">Get Started</Link></Button>
      </div>
    </nav>
  </header>
);

const Hero = () => {
  const stage = useParallax<HTMLDivElement>();
  return (
    <section aria-labelledby="hero-title" className="relative overflow-x-clip pt-12 md:pt-20 pb-8">
      <div ref={stage} className="container mx-auto px-4 relative">
        {/* Wide screens: two cards flank the headline and drift gently as you scroll. */}
        <div className="hidden xl:block absolute left-[-32px] top-16 w-60 z-0" aria-hidden>
          <FloatCard parallax={-36} delay={650} float={false}><MarketOverviewCard /></FloatCard>
        </div>
        <div className="hidden xl:block absolute right-[-32px] top-36 w-60 z-0" aria-hidden>
          <FloatCard parallax={-60} delay={780} floatDelay={1.4}><PortfolioCard /></FloatCard>
        </div>

        <div className="relative z-10 text-center max-w-[720px] mx-auto">
          <Reveal>
            <p className="metric-label mb-6">Equity research for NSE-listed companies</p>
          </Reveal>
          <h1 id="hero-title" className="display-serif text-5xl sm:text-6xl xl:text-[72px] text-foreground">
            <Reveal as="span" delay={90} className="block">See the Market With a{" "}</Reveal>
            <Reveal as="span" delay={230} className="block"><em className="italic">Clearer Lens.</em></Reveal>
          </h1>
          <Reveal delay={380}>
            <p className="mt-6 text-base md:text-lg leading-snug text-muted-foreground max-w-xl mx-auto">
              Turn financial data into clearer insights. Explore market trends, understand performance, and make more informed
              investment decisions with EquityLens.
            </p>
          </Reveal>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Reveal delay={500}><Button asChild size="lg"><Link to="/register">Get Started</Link></Button></Reveal>
            <Reveal delay={590}><Button asChild size="lg" variant="outline"><a href="#features">Explore Features</a></Button></Reveal>
          </div>
        </div>

        {/* Decorative collage of sample cards. Below xl all four sit in a grid; at xl the first two are the flanking cards above. */}
        <div role="img" aria-label="Illustrative sample dashboard cards. All figures are sample data." className="relative z-0 mt-14 md:mt-20 grid sm:grid-cols-2 gap-6 max-w-3xl xl:max-w-[760px] mx-auto">
          <div className="xl:hidden"><FloatCard delay={650} float={false}><MarketOverviewCard /></FloatCard></div>
          <div className="xl:hidden"><FloatCard delay={780} floatDelay={1.4}><PortfolioCard /></FloatCard></div>
          <FloatCard delay={910} float={false}><WatchlistCard /></FloatCard>
          <FloatCard delay={1040} floatDelay={0.8}><TrendCard /></FloatCard>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-6">Illustrative sample data, not live prices or returns.</p>
        <LiveCursors />
      </div>

      <div className="container mx-auto px-4 mt-16 md:mt-24">
        <Reveal className="text-center mb-6">
          <p className="metric-label">Ask anything, with sources</p>
        </Reveal>
        <TypingComposer />
      </div>
    </section>
  );
};

const FEATURES = [
  { icon: Search, title: "Discover companies", text: "Search NSE-listed companies by name, symbol or ISIN and open a page for each one." },
  { icon: Bot, title: "AI-assisted research", text: "Run research when you ask for it: source-linked, scored with a published rubric you can inspect." },
  { icon: MessageSquare, title: "Ask the Copilot", text: "Ask questions about a company. Every answer states whether it is grounded in documents, with citations." },
  { icon: List, title: "Watchlists and comparison", text: "Keep a list of the companies you follow and compare their reported financials side by side." },
];

const Features = () => (
  <section id="features" aria-labelledby="features-title" className="scroll-mt-20 container mx-auto px-4 py-20">
    <Reveal className="max-w-2xl">
      <h2 id="features-title" className="text-4xl md:text-5xl text-foreground">What you can do with EquityLens</h2>
      <p className="mt-4 text-base md:text-lg text-muted-foreground leading-snug">
        Prices, financials and news appear when those data sources are enabled in the deployment you use. Where one is off, the app says so
        instead of guessing.
      </p>
    </Reveal>
    <ul className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {FEATURES.map(({ icon: Icon, title, text }, i) => (
        <Reveal as="li" key={title} delay={i * 90}>
          <div className="h-full rounded-lg bg-secondary p-6 transition-[transform,background-color] duration-300 hover:-translate-y-1 hover:bg-peach/40">
            <Icon className="w-5 h-5 text-foreground mb-8" aria-hidden />
            <h3 className="text-lg font-medium text-foreground">{title}</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-snug">{text}</p>
          </div>
        </Reveal>
      ))}
    </ul>
  </section>
);

const Preview = () => (
  <section id="preview" aria-labelledby="preview-title" className="scroll-mt-20 bg-fog py-20">
    <div className="container mx-auto px-4">
      <Reveal className="max-w-2xl">
        <h2 id="preview-title" className="text-4xl md:text-5xl text-foreground">One workspace for the whole picture</h2>
        <p className="mt-4 text-base md:text-lg text-muted-foreground leading-snug">
          A company page brings price, key figures, charts, news and research together, with the source and timestamp beside every number.
        </p>
      </Reveal>
      <Reveal delay={120} className="mt-12">
        <div className="surface-float p-5 md:p-8 transition-transform duration-500 hover:-translate-y-1">
          <WorkspacePreview />
        </div>
        <p className="mt-4 text-xs text-muted-foreground">Illustrative layout with sample data. Your workspace shows data from the sources enabled in your deployment.</p>
      </Reveal>
    </div>
  </section>
);

const STEPS = [
  { icon: UserPlus, title: "Create an account", text: "Register with your email and a password to open your own workspace." },
  { icon: Search, title: "Search a company", text: "Find an NSE-listed company and open its page." },
  { icon: Bot, title: "Research and track", text: "Run AI research, ask the Copilot, and add companies to a watchlist." },
];

const HowItWorks = () => (
  <section id="how-it-works" aria-labelledby="how-title" className="scroll-mt-20 container mx-auto px-4 py-20">
    <Reveal className="max-w-2xl">
      <h2 id="how-title" className="text-4xl md:text-5xl text-foreground">How it works</h2>
    </Reveal>
    <ol className="mt-12 grid md:grid-cols-3 gap-6">
      {STEPS.map(({ icon: Icon, title, text }, i) => (
        <Reveal as="li" key={title} delay={i * 100}>
          <div className="h-full border border-border rounded-lg p-6 transition-[transform,border-color] duration-300 hover:-translate-y-1 hover:border-foreground/30">
          <div className="flex items-center justify-between mb-8">
            <span className="w-10 h-10 rounded-full bg-peach text-sienna flex items-center justify-center font-serif text-lg" aria-hidden>{i + 1}</span>
            <Icon className="w-5 h-5 text-muted-foreground" aria-hidden />
          </div>
          <h3 className="text-lg font-medium text-foreground">{title}</h3>
          <p className="mt-2 text-sm text-muted-foreground leading-snug">{text}</p>
          </div>
        </Reveal>
      ))}
    </ol>
  </section>
);

const FinalCta = () => (
  <section aria-labelledby="cta-title" className="container mx-auto px-4 pb-20">
    <Reveal className="surface-peach text-center px-6 py-16 md:py-24">
      <h2 id="cta-title" className="text-4xl md:text-6xl text-sienna display-serif">Make Your Next <em className="italic">Insight</em> Count.</h2>
      <p className="mt-5 text-base md:text-lg text-sienna max-w-xl mx-auto leading-snug">
        Create a free account to search companies, run research and keep your watchlists in one place.
      </p>
      <div className="mt-8 flex justify-center">
        <Button asChild size="lg"><Link to="/register">Get Started <ArrowRight aria-hidden /></Link></Button>
      </div>
    </Reveal>
  </section>
);

const LandingFooter = () => (
  <footer className="bg-fog py-12">
    <Reveal className="container mx-auto px-4 flex flex-col md:flex-row md:items-start md:justify-between gap-8">
      <div className="space-y-3 max-w-md">
        <Logo />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Informational only, not investment advice. AI-generated content can be wrong. The figures shown on this page are illustrative sample data.
        </p>
      </div>
      <nav aria-label="Footer">
        <ul className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm">
          {NAV.map((n) => (<li key={n.href}><a href={n.href} className="link-underline text-foreground">{n.label}</a></li>))}
          <li><Link to="/login" className="link-underline text-foreground">Sign in</Link></li>
          <li><Link to="/register" className="link-underline text-foreground">Create account</Link></li>
        </ul>
      </nav>
    </Reveal>
  </footer>
);

const Landing = () => {
  useDocumentTitle("Source-linked equity research for NSE-listed companies");
  return (
    <div className="flex-1 bg-background">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-full focus:bg-primary focus:text-primary-foreground focus:text-sm">
        Skip to main content
      </a>
      <LandingNav />
      <main id="main-content" tabIndex={-1} className="outline-none">
        <Hero />
        <Features />
        <Preview />
        <HowItWorks />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
};

export default Landing;

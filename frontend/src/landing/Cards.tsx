import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Sparkline } from "./Charts";
import { CountUp } from "./CountUp";
import { useReveal } from "./useReveal";

/*
 * Every number on this page is ILLUSTRATIVE sample data with generic names ("Sample Co. A"). Nothing here is a real price,
 * index level, return or forecast, and no API is called. Each card says so.
 */

const SAMPLE = "Sample data";

/** Three layers so the transforms never fight: parallax (outer) > reveal (middle) > float + hover (inner). */
export const FloatCard = ({
  children, className, delay = 0, floatDelay = 0, parallax = 0, float = true,
}: { children: ReactNode; className?: string; delay?: number; floatDelay?: number; parallax?: number; float?: boolean }) => {
  const [ref, visible] = useReveal<HTMLDivElement>();
  return (
    <div className={className} style={parallax ? { transform: `translate3d(0, calc(var(--ps, 0) * ${parallax}px), 0)` } : undefined}>
      <div ref={ref} className={cn("reveal", visible && "is-visible")} style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}>
        <div
          className={cn(
            "surface-float p-4 transition-[box-shadow,transform] duration-300 hover:shadow-[0_0_0_1px_rgba(4,23,43,0.08),0_28px_40px_-8px_rgba(0,0,0,0.14),0_10px_14px_-6px_rgba(0,0,0,0.1)]",
            // A floating card's animation owns its transform, so only the still cards lift on hover.
            float ? "float-soft" : "hover:-translate-y-1",
          )}
          style={{ "--float-delay": `${floatDelay}s` } as CSSProperties}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

const CardHead = ({ title, tag = SAMPLE }: { title: string; tag?: string }) => (
  <div className="flex items-center justify-between gap-3 mb-3">
    <h3 className="text-sm font-medium text-foreground">{title}</h3>
    <span className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{tag}</span>
  </div>
);

const Delta = ({ value }: { value: number }) => (
  <span className={cn("font-mono text-xs", value >= 0 ? "text-chart-up" : "text-chart-down")}>
    {value >= 0 ? "+" : "−"}{Math.abs(value).toFixed(2)}%
  </span>
);

const UP = [10, 12, 11, 14, 13, 17, 16, 19, 18, 22, 21, 25];
const FLAT = [14, 15, 13, 14, 16, 15, 17, 16, 18, 17, 19, 20];
const DOWN = [22, 21, 22, 20, 19, 20, 18, 17, 18, 16, 15, 14];
const TREND = [18, 20, 19, 23, 22, 21, 26, 25, 29, 27, 31, 30, 34, 33, 38, 36, 41];

export const MarketOverviewCard = () => (
  <>
    <CardHead title="Market overview" />
    <ul className="space-y-3">
      {([
        ["Index A", "12,480.50", 0.84, UP],
        ["Index B", "4,212.10", -0.31, DOWN],
        ["Index C", "9,874.25", 0.12, FLAT],
      ] as [string, string, number, number[]][]).map(([name, level, delta, data]) => (
        <li key={name} className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground truncate">{name}</p>
            <p className="font-mono text-sm text-foreground">{level}</p>
          </div>
          <Sparkline data={data} width={48} height={26} className="w-12 h-6" />
          <div className="w-12 text-right"><Delta value={delta} /></div>
        </li>
      ))}
    </ul>
  </>
);

export const PortfolioCard = () => (
  <>
    <CardHead title="Portfolio performance" tag="Illustrative" />
    <p className="font-serif text-4xl text-foreground tracking-tight"><CountUp to={12.4} decimals={1} prefix="+" suffix={<span className="text-2xl">%</span>} delay={700} /></p>
    <p className="text-xs text-muted-foreground mt-0.5">Since start · sample portfolio</p>
    <Sparkline data={TREND} width={220} height={64} area className="w-full h-16 mt-3" />
  </>
);

export const WatchlistCard = () => (
  <>
    <CardHead title="Watchlist" />
    <table className="w-full text-xs">
      <thead>
        <tr className="text-left text-muted-foreground">
          <th scope="col" className="font-normal pb-2">Company</th>
          <th scope="col" className="font-normal pb-2 text-right">Price</th>
          <th scope="col" className="font-normal pb-2 text-right">Day</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {([
          ["Sample Co. A", "1,240.00", 1.24],
          ["Sample Co. B", "312.45", -0.62],
          ["Sample Co. C", "2,087.30", 0.35],
          ["Sample Co. D", "98.10", 2.08],
        ] as [string, string, number][]).map(([name, price, d]) => (
          <tr key={name}>
            <td className="py-2 text-foreground">{name}</td>
            <td className="py-2 text-right font-mono text-foreground">{price}</td>
            <td className="py-2 text-right"><Delta value={d} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  </>
);

export const TrendCard = () => (
  <>
    <CardHead title="Market trends" />
    <div className="flex items-baseline justify-between mb-1">
      <p className="font-mono text-lg text-foreground"><CountUp to={8640.2} decimals={2} delay={800} /></p>
      <Delta value={3.46} />
    </div>
    <Sparkline data={TREND} width={260} height={96} area className="w-full h-24" />
    <div className="flex justify-between text-[10px] text-muted-foreground mt-2" aria-hidden>
      <span>Jan</span><span>Mar</span><span>May</span><span>Jul</span><span>Sep</span>
    </div>
  </>
);

/** Larger "workspace" preview: styled like the real company page (price, key figures, chart) but with sample numbers. */
export const WorkspacePreview = () => (
  <div className="grid lg:grid-cols-3 gap-6">
    <div className="lg:col-span-2 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-serif text-2xl text-foreground">Sample Co. A</p>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <span className="text-xs font-mono text-muted-foreground">SAMPLE</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">NSE</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">Sample sector</span>
          </div>
        </div>
        <div className="text-right">
          <p className="font-mono text-2xl text-foreground"><CountUp to={1240} decimals={2} align="right" delay={300} /></p>
          <Delta value={1.24} />
        </div>
      </div>
      <Sparkline data={TREND} width={640} height={160} area className="w-full h-40" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border rounded-md overflow-hidden border border-border">
        {[["Previous close", "1,225.00"], ["52W high", "1,410.00"], ["52W low", "880.50"], ["Volume", "1.2M"]].map(([k, v]) => (
          <div key={k} className="bg-card p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{k}</p>
            <p className="font-mono text-sm text-foreground mt-0.5">{v}</p>
          </div>
        ))}
      </div>
    </div>
    <div className="rounded-lg bg-secondary p-5 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-foreground">Your watchlist</h3>
        <span className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{SAMPLE}</span>
      </div>
      <ul className="space-y-3 flex-1">
        {([["Sample Co. A", 1.24, UP], ["Sample Co. B", -0.62, DOWN], ["Sample Co. C", 0.35, FLAT]] as [string, number, number[]][]).map(([name, d, data]) => (
          <li key={name} className="flex items-center gap-3 bg-card rounded-md px-3 py-2.5">
            <span className="flex-1 text-sm text-foreground truncate">{name}</span>
            <Sparkline data={data} width={56} height={22} className="w-14 h-5" />
            <Delta value={d} />
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground mt-4 leading-snug">Compare reported financials side by side once two or more companies are on a list.</p>
    </div>
  </div>
);

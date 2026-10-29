import { TrendingUp, TrendingDown } from "lucide-react";
import type { UseQueryResult } from "@tanstack/react-query";
import type { Company, Quote } from "@/types/api";
import { ErrorBox, InfoBanner, SourceDisabledNotice, SourceLine } from "@/components/DataStates";
import NumText from "@/components/NumText";
import { useSource } from "@/hooks/useCapabilities";
import { NA_SHORT, fmtNumber, fmtPercent, fmtPrice, fmtVolume, isNum, signClass } from "@/lib/format";

const CompanyOverview = ({ company, quote }: { company: Company; quote: UseQueryResult<Quote> }) => {
  const market = useSource("market_data");
  const q = market.state === "enabled" ? quote.data : undefined;
  const up = q && isNum(q.change_percent) && q.change_percent !== 0 ? q.change_percent > 0 : null;
  const colour = signClass(q?.change_percent);
  const priceLabel = market.caps?.market_data.provider ? `Delayed – ${market.caps.market_data.provider}` : "Delayed";

  const metrics = q
    ? [
        { label: "Previous Close", value: fmtPrice(q.previous_close, q.currency) },
        { label: "52W High", value: fmtPrice(q.week52_high, q.currency) },
        { label: "52W Low", value: fmtPrice(q.week52_low, q.currency) },
        { label: "Volume", value: fmtVolume(q.volume) },
      ]
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl md:text-4xl text-foreground">{company.name}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className="text-xs font-mono text-muted-foreground">{company.primary_symbol}</span>
            <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-secondary text-secondary-foreground">{company.exchange}</span>
            {company.sector && <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-secondary text-secondary-foreground">{company.sector}</span>}
            {company.isin && <span className="text-[11px] font-mono text-muted-foreground">{company.isin}</span>}
          </div>
        </div>
        {market.state !== "disabled" && <div className="text-right">
          {quote.isPending ? (
            <p className="text-xs text-muted-foreground" role="status">Loading price…</p>
          ) : q ? (
            <>
              <p className="text-2xl font-bold font-mono text-foreground"><NumText text={fmtPrice(q.price, q.currency)} /></p>
              <div className={`flex items-center gap-1 justify-end ${colour}`}>
                {up === null ? null : up ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                <span className="font-mono text-sm">
                  <NumText text={isNum(q.change) ? `${q.change > 0 ? "+" : ""}${fmtNumber(q.change)}` : NA_SHORT} /> (<NumText text={fmtPercent(q.change_percent)} />)
                </span>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Price unavailable</p>
          )}
        </div>}
      </div>

      {market.state === "disabled" && <SourceDisabledNotice title="Market prices are not shown" reason={market.reason} />}

      {market.state === "enabled" && quote.isError && <div className="border border-border rounded-md"><ErrorBox error={quote.error} onRetry={() => quote.refetch()} title="Price data unavailable" /></div>}

      {q && (
        <>
          {q.provenance.stale && <InfoBanner tone="warn">This price is stale. The latest refresh failed or is outdated.</InfoBanner>}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border rounded-md overflow-hidden border border-border">
            {metrics.map(({ label, value }) => (
              <div key={label} className="bg-card p-2.5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
                <p className="text-sm font-semibold font-mono text-foreground mt-0.5"><NumText text={value} /></p>
              </div>
            ))}
          </div>
          <SourceLine
            label={priceLabel}
            source={q.provenance.source}
            asOf={q.as_of}
            retrievedAt={q.provenance.fetched_at}
            cached={q.provenance.cached}
            stale={q.provenance.stale}
            note={[q.change_basis ? `Change basis: ${q.change_basis}` : "", q.provenance.note ?? ""].filter(Boolean).join(" · ") || null}
          />
        </>
      )}
    </div>
  );
};

export default CompanyOverview;

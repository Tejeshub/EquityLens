import { useState } from "react";
import { ResponsiveContainer, ComposedChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { useHistory } from "@/hooks/queries";
import { EmptyBox, ErrorBox, InfoBanner, LoadingBox, SourceDisabledNotice, SourceLine } from "@/components/DataStates";
import { useSource } from "@/hooks/useCapabilities";
import { fmtNumber, fmtVolume, isNum } from "@/lib/format";
import type { Bar as OhlcBar, HistoryRange } from "@/types/api";

const RANGES: { value: HistoryRange; label: string }[] = [
  { value: "1mo", label: "1M" },
  { value: "3mo", label: "3M" },
  { value: "6mo", label: "6M" },
  { value: "1y", label: "1Y" },
  { value: "5y", label: "5Y" },
];

const UP = "hsl(152 60% 40%)";
const DOWN = "hsl(0 72% 51%)";

interface CandleProps {
  x?: number; y?: number; width?: number; height?: number;
  payload?: OhlcBar & { hl: [number, number] };
}

// The bar spans low..high; open/close positions are derived proportionally inside that span.
const Candle = ({ x = 0, y = 0, width = 0, height = 0, payload }: CandleProps) => {
  if (!payload) return null;
  const { open, close, high, low } = payload;
  const colour = close >= open ? UP : DOWN;
  const span = high - low;
  const toY = (v: number) => (span === 0 ? y : y + ((high - v) / span) * height);
  const cx = x + width / 2;
  const bodyTop = Math.min(toY(open), toY(close));
  const bodyH = Math.max(Math.abs(toY(open) - toY(close)), 1);
  const bw = Math.max(width * 0.7, 1);
  return (
    <g>
      <line x1={cx} x2={cx} y1={y} y2={y + height} stroke={colour} strokeWidth={1} />
      <rect x={cx - bw / 2} y={bodyTop} width={bw} height={bodyH} fill={colour} />
    </g>
  );
};

const validBar = (b: OhlcBar) => [b.open, b.high, b.low, b.close].every(isNum);

const SUMMARY_BARS = 10;

/** Axis tick decimals adapted to the visible price span so low-priced scrips do not collapse to repeated integers. */
export function tickDecimals(min: number, max: number): number {
  const span = Math.abs(max - min);
  if (!Number.isFinite(span) || span >= 20) return 0;
  if (span >= 2) return 1;
  if (span >= 0.2) return 2;
  return 3;
}

const PriceChart = ({ companyId }: { companyId: string }) => {
  const [range, setRange] = useState<HistoryRange>("3mo");
  const market = useSource("market_data");
  const history = useHistory(companyId, range, market.state === "enabled");
  const bars = (history.data?.bars ?? []).filter(validBar);
  const data = bars.map((b) => ({ ...b, hl: [b.low, b.high] as [number, number] }));
  const label = RANGES.find((r) => r.value === range)?.label ?? range;
  const lo = data.length ? Math.min(...data.map((d) => d.low)) : 0;
  const hi = data.length ? Math.max(...data.map((d) => d.high)) : 0;
  const decimals = tickDecimals(lo, hi);
  const last = data[data.length - 1];
  const summaryBars = data.slice(-SUMMARY_BARS);
  const chartLabel = last
    ? `Daily candlestick chart, ${label} range, ${data.length} trading days. Latest close ${fmtNumber(last.close)} on ${last.date}. Lowest low ${fmtNumber(lo)}, highest high ${fmtNumber(hi)}.`
    : "";

  if (market.state !== "enabled") {
    return (
      <div className="border border-border rounded-md p-4 bg-card space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Price Chart</h3>
        {market.state === "disabled" ? <SourceDisabledNotice title="Price charts are not shown" reason={market.reason} /> : <LoadingBox label="Loading…" />}
      </div>
    );
  }

  return (
    <div className="border border-border rounded-md p-4 bg-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">Price Chart ({label}, daily candles)</h3>
        <div className="flex gap-0.5" role="group" aria-label="Chart range">
          {RANGES.map((r) => (
            <button key={r.value} aria-pressed={range === r.value} onClick={() => setRange(r.value)}
              className={`px-2 py-0.5 text-[11px] rounded font-medium ${range === r.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {history.isError ? (
        <ErrorBox error={history.error} onRetry={() => history.refetch()} title="Price history unavailable" />
      ) : history.isPending ? (
        <LoadingBox label="Loading price history…" />
      ) : data.length === 0 ? (
        <EmptyBox title="No price history for this range">The data source returned no bars for this company and range.</EmptyBox>
      ) : (
        <>
          {history.data?.provenance.stale && <div className="mb-2"><InfoBanner tone="warn">Price history is stale.</InfoBanner></div>}
          <div className={history.isFetching ? "opacity-60 transition-opacity" : ""} role="img" aria-label={chartLabel}>
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 93%)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(220 10% 55%)" }} tickFormatter={(v: string) => v.slice(range === "5y" || range === "1y" ? 0 : 5, range === "5y" || range === "1y" ? 7 : 10)} minTickGap={24} />
                <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10, fill: "hsl(220 10% 55%)" }} tickFormatter={(v: number) => v.toFixed(decimals)} width={decimals > 1 ? 56 : 48} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(0 0% 100%)", border: "1px solid hsl(220 13% 91%)", borderRadius: "6px", fontSize: "12px" }}
                  content={({ active, payload }) => {
                    const p = active && payload?.[0]?.payload as OhlcBar | undefined;
                    if (!p) return null;
                    return (
                      <div className="bg-card border border-border rounded-md p-2 text-[11px] font-mono shadow-sm">
                        <p className="font-semibold">{p.date}</p>
                        <p>O {fmtNumber(p.open)} H {fmtNumber(p.high)}</p>
                        <p>L {fmtNumber(p.low)} C {fmtNumber(p.close)}</p>
                        <p>Vol {fmtVolume(p.volume)}</p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="hl" shape={<Candle />} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
            <ResponsiveContainer width="100%" height={60}>
              <ComposedChart data={data.map((d) => ({ date: d.date, volume: d.volume ?? undefined }))}>
                <XAxis dataKey="date" hide />
                <YAxis hide />
                <Bar dataKey="volume" fill="hsl(220 14% 80%)" isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <table className="sr-only">
            <caption>Last {summaryBars.length} trading days of the price chart</caption>
            <thead><tr><th scope="col">Date</th><th scope="col">Open</th><th scope="col">High</th><th scope="col">Low</th><th scope="col">Close</th><th scope="col">Volume</th></tr></thead>
            <tbody>
              {summaryBars.map((b) => (
                <tr key={b.date}>
                  <th scope="row">{b.date}</th>
                  <td>{fmtNumber(b.open)}</td><td>{fmtNumber(b.high)}</td><td>{fmtNumber(b.low)}</td><td>{fmtNumber(b.close)}</td><td>{fmtVolume(b.volume)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.some((d) => d.volume === null) && <p className="text-[10px] text-muted-foreground mt-1">Volume not available for some days; those bars are drawn empty.</p>}
          <SourceLine
            className="mt-2"
            label={market.caps?.market_data.provider ? `Delayed – ${market.caps.market_data.provider}` : "Delayed"}
            source={history.data?.provenance.source}
            retrievedAt={history.data?.provenance.fetched_at}
            cached={history.data?.provenance.cached}
            stale={history.data?.provenance.stale}
            note={history.data?.provenance.note}
          />
        </>
      )}
    </div>
  );
};

export default PriceChart;

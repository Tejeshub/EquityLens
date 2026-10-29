import { useId } from "react";

/** Smooth path through the points: quadratic segments between midpoints. */
function pathFor(data: number[], w: number, h: number, pad: number): { line: string; area: string } {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => [i * step, h - pad - ((v - min) / span) * (h - pad * 2)] as const);
  let line = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    line += ` Q${pts[i][0].toFixed(1)},${pts[i][1].toFixed(1)} ${mx.toFixed(1)},${my.toFixed(1)}`;
  }
  const last = pts[pts.length - 1];
  line += ` L${last[0].toFixed(1)},${last[1].toFixed(1)}`;
  return { line, area: `${line} L${w},${h} L0,${h} Z` };
}

/** A gestural line: no axes, no gridlines. Decorative (aria-hidden); the surrounding card carries the label. */
export const Sparkline = ({ data, width = 120, height = 36, area = false, className }: { data: number[]; width?: number; height?: number; area?: boolean; className?: string }) => {
  const id = useId();
  const { line, area: areaPath } = pathFor(data, width, height, 3);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className={[className, "chart-draw"].filter(Boolean).join(" ")} aria-hidden focusable="false">
      {area && (
        <>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--peach))" stopOpacity="0.9" />
              <stop offset="100%" stopColor="hsl(var(--peach))" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#${id})`} />
        </>
      )}
      <path d={line} fill="none" stroke="hsl(var(--sienna))" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

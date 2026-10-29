import type { CSSProperties } from "react";

/**
 * Two decorative "collaborator" cursors that drift between the hero cards, pause and click, echoing DESIGN.md's avatar-with-pointer
 * motif. Purely visual: aria-hidden, pointer-events-none (they can never block a button or input) and only shown on wide screens,
 * where the card positions the waypoints refer to are fixed. Waypoints are percentages of the hero container.
 */
const CURSORS = [
  { initials: "JB", tint: "hsl(142 50% 86%)", delay: 0, pts: [[33, 78], [64, 80], [27, 69], [4, 13], [36, 78]] },
  { initials: "AF", tint: "hsl(212 70% 89%)", delay: -11, pts: [[66, 70], [91, 31], [80, 82], [45, 70], [76, 62]] },
] as const;

export const LiveCursors = () => (
  <div aria-hidden className="hidden xl:block pointer-events-none absolute inset-0 z-20">
    {CURSORS.map((c) => {
      const style: Record<string, string> = { "--cursor-delay": `${c.delay}s` };
      c.pts.forEach(([x, y], i) => { style[`--x${i}`] = `${x}%`; style[`--y${i}`] = `${y}%`; });
      return (
        <div key={c.initials} className="live-cursor" style={style as CSSProperties}>
          <span className="cursor-ring" />
          <svg width="18" height="18" viewBox="0 0 18 18" className="relative drop-shadow-sm" focusable="false">
            <path d="M2 1.5 15 8l-5.6 1.6L7.6 15 2 1.5Z" fill="hsl(var(--foreground))" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" />
          </svg>
          <span
            className="absolute left-3.5 top-3.5 flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-[11px] font-medium text-foreground shadow-pop"
            style={{ background: c.tint }}
          >
            {c.initials}
          </span>
        </div>
      );
    })}
  </div>
);

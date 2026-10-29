import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useReveal } from "./useReveal";

const fmt = (n: number, decimals: number) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n);

interface CountUpProps {
  to: number;
  decimals?: number;
  prefix?: ReactNode;
  suffix?: ReactNode;
  /** ms to wait after the element is visible, so the count lines up with its card's entrance. */
  delay?: number;
  duration?: number;
  align?: "left" | "right";
  className?: string;
}

/**
 * Counts up to a fixed, illustrative value once it scrolls into view. Only used for the landing page's sample figures, never for data
 * loaded from the API. An invisible copy of the final value reserves the width (no layout shift) and is what assistive tech reads;
 * the animated overlay is aria-hidden. With reduced motion, or without matchMedia, the final value is simply shown.
 */
export const CountUp = ({ to, decimals = 0, prefix = "", suffix = "", delay = 0, duration = 1300, align = "left", className }: CountUpProps) => {
  const [ref, visible] = useReveal<HTMLSpanElement>();
  const final = fmt(to, decimals);
  const [shown, setShown] = useState(final);

  useEffect(() => {
    if (!visible || typeof window.matchMedia !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let timer = 0;
    setShown(fmt(0, decimals));
    timer = window.setTimeout(() => {
      const t0 = performance.now();
      const tick = (now: number) => {
        const p = Math.min((now - t0) / duration, 1);
        setShown(fmt(to * (1 - Math.pow(1 - p, 3)), decimals)); // ease-out cubic
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => { window.clearTimeout(timer); cancelAnimationFrame(raf); };
  }, [visible, to, decimals, delay, duration]);

  return (
    <span ref={ref} className={cn("relative inline-block tabular-nums", className)}>
      <span className="opacity-0">{prefix}{final}{suffix}</span>
      <span aria-hidden className={cn("absolute inset-y-0", align === "right" ? "right-0" : "left-0")}>{prefix}{shown}{suffix}</span>
    </span>
  );
};

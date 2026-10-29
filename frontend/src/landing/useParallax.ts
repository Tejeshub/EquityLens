import { useEffect, useRef } from "react";

/**
 * Writes --ps (0 at the top of the page, 1 after 700px of scroll) onto the element. Only on wide screens and only when the
 * user has not asked for reduced motion; otherwise --ps stays unset (0) and nothing moves.
 */
export function useParallax<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof window.matchMedia !== "function") return;
    if (!window.matchMedia("(min-width: 1280px) and (prefers-reduced-motion: no-preference)").matches) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      el.style.setProperty("--ps", String(Math.min(window.scrollY, 700) / 700));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    window.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return ref;
}

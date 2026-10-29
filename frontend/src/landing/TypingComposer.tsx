import { useEffect, useState } from "react";
import { ArrowUp, AtSign, Info, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useReveal } from "./useReveal";

/*
 * A scripted demo of the Copilot: a question types itself into the composer, "send" is pressed, and a sample answer with citations
 * appears. Nothing here is connected to the real Copilot or any data; the question, the numbers and the sources are all invented sample
 * content and the card says so. It plays once when scrolled into view (no loop). With reduced motion, or where matchMedia is missing
 * (jsdom), the finished state is shown immediately.
 */

const QUESTION = "How did Sample Co. A's operating margin change over the last four quarters?";
const ANSWER = "Operating margin rose in each of the last four quarters, from 14.2% to 16.8%, mainly on lower input costs. The latest quarter is the first above 16%.";
const CITATIONS = ["Sample filing, Q3", "Sample call transcript"];

type Phase = "idle" | "typing" | "sent" | "answer";

const staticFinish = () => typeof window.matchMedia !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const TypingComposer = () => {
  const [ref, visible] = useReveal<HTMLDivElement>();
  const [still] = useState(staticFinish);
  const [chars, setChars] = useState(still ? QUESTION.length : 0);
  const [phase, setPhase] = useState<Phase>(still ? "answer" : "idle");

  useEffect(() => {
    if (!visible || still) return;
    let cancelled = false;
    const timers: number[] = [];
    const wait = (ms: number) => new Promise<void>((resolve) => { timers.push(window.setTimeout(resolve, ms)); });
    (async () => {
      await wait(600);
      if (cancelled) return;
      setPhase("typing");
      for (let i = 1; i <= QUESTION.length; i++) {
        if (cancelled) return;
        setChars(i);
        // A steady rhythm with small, deterministic pauses at spaces and every few letters.
        await wait(32 + (QUESTION[i - 1] === " " ? 28 : 0) + (i % 9 === 0 ? 70 : 0));
      }
      await wait(450);
      if (cancelled) return;
      setPhase("sent");
      await wait(380);
      if (cancelled) return;
      setPhase("answer");
    })();
    return () => { cancelled = true; timers.forEach((t) => window.clearTimeout(t)); };
  }, [visible, still]);

  const typing = phase === "idle" || phase === "typing";

  return (
    <div
      ref={ref}
      role="img"
      aria-label="Illustrative sample: a question typed into the Copilot, followed by a sample answer with citations. Sample content, not real analysis."
      className="max-w-[600px] mx-auto text-left"
    >
      <div aria-hidden>
        <div className="flex items-center gap-2 bg-card border border-input rounded-md p-3 pl-2 shadow-pop">
          <span className="flex gap-0.5 text-muted-foreground">
            <span className="w-9 h-9 rounded-full flex items-center justify-center"><AtSign className="w-4 h-4" /></span>
            <span className="w-9 h-9 rounded-full flex items-center justify-center"><Info className="w-4 h-4" /></span>
          </span>
          <p className="flex-1 min-h-[1.5rem] text-base leading-snug text-foreground">
            {chars === 0 ? <span className="text-muted-foreground">Ask anything…</span> : QUESTION.slice(0, chars)}
            {typing && <span className="typing-caret" />}
          </p>
          <span className={cn("w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 transition-transform duration-200", phase === "sent" && "scale-90")}>
            <ArrowUp className="w-4 h-4" />
          </span>
        </div>

        {/* Always laid out (just transparent until shown) so the page never jumps when the answer arrives. */}
        <div className={cn("mt-4 surface-float p-5 transition-[opacity,transform] duration-700 ease-out", phase === "answer" ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3")}>
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-sienna flex items-center justify-center"><TrendingUp className="w-3.5 h-3.5 text-peach" /></span>
              <span className="text-sm font-medium text-foreground">Copilot</span>
            </div>
            <span className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Sample answer</span>
          </div>
          <p className="text-sm leading-relaxed text-foreground">{ANSWER}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Citations (sample):</span>
            {CITATIONS.map((c, i) => (
              <span key={c} className="text-xs rounded-full bg-secondary text-secondary-foreground px-3 py-1">[{i + 1}] {c}</span>
            ))}
            <span className="text-xs rounded-full bg-peach text-sienna px-3 py-1">Grounded in sample documents</span>
          </div>
        </div>
      </div>
    </div>
  );
};

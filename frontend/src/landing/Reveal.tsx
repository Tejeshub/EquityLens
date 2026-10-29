import type { CSSProperties, ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useReveal } from "./useReveal";

interface RevealProps {
  as?: ElementType;
  delay?: number;
  className?: string;
  children: ReactNode;
}

/** Fades and lifts its children into place the first time they scroll into view. */
export const Reveal = ({ as: Tag = "div", delay = 0, className, children }: RevealProps) => {
  const [ref, visible] = useReveal<HTMLElement>();
  return (
    <Tag ref={ref} className={cn("reveal", visible && "is-visible", className)} style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}>
      {children}
    </Tag>
  );
};

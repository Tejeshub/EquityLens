import type { ReactNode } from "react";
import { AlertCircle, Info, Loader2, Clock } from "lucide-react";
import { ApiError, describeError } from "@/services/api";
import { fmtDateTime } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";

// Fixed heights so the skeleton looks the same on every load (no random values).
const CANDLES = [38, 46, 42, 55, 50, 62, 58, 48, 56, 66, 60, 72, 68, 58, 64, 76, 70, 82, 74, 68, 78, 86, 80, 90];

const SkeletonShape = ({ variant }: { variant: "chart" | "list" | "table" }) => {
  if (variant === "chart") {
    return (
      <div className="space-y-3">
        <div className="flex items-end gap-1.5 h-[240px]">
          {CANDLES.map((h, i) => <Skeleton key={i} className="flex-1 rounded-sm" style={{ height: `${h}%` }} />)}
        </div>
        <Skeleton className="h-12 w-full rounded-sm" />
      </div>
    );
  }
  if (variant === "table") {
    return (
      <div className="space-y-3">
        <Skeleton className="h-4 w-2/5" />
        {[0, 1, 2, 3, 4].map((r) => (
          <div key={r} className="grid grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((c) => <Skeleton key={c} className={`h-5 ${c === 0 ? "col-span-1" : ""}`} />)}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {[0, 1, 2, 3].map((r) => (
        <div key={r} className="flex items-center gap-3">
          <Skeleton className="w-9 h-9 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-3/5" /><Skeleton className="h-3 w-2/5" /></div>
          <Skeleton className="h-4 w-14" />
        </div>
      ))}
    </div>
  );
};

/** Loading state. The default is a small spinner; chart / list / table show a skeleton shaped like the content that is coming. */
export const LoadingBox = ({ label = "Loading…", variant = "spinner" }: { label?: string; variant?: "spinner" | "chart" | "list" | "table" }) =>
  variant === "spinner" ? (
    <div className="flex items-center justify-center gap-2 p-8 text-xs text-muted-foreground" role="status" aria-live="polite">
      <Loader2 className="w-4 h-4 animate-spin text-primary" /> {label}
    </div>
  ) : (
    <div className="p-5" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      <div aria-hidden><SkeletonShape variant={variant} /></div>
    </div>
  );

export const EmptyBox = ({ title, children }: { title: string; children?: ReactNode }) => (
  <div className="p-6 text-center">
    <p className="text-sm font-medium text-foreground">{title}</p>
    {children && <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">{children}</p>}
  </div>
);

export const ErrorBox = ({ error, onRetry, title = "Could not load this data" }: { error: unknown; onRetry?: () => void; title?: string }) => {
  // A switched-off source is a deployment decision, not a failure: explain it, never offer a retry.
  if (error instanceof ApiError && error.isSourceDisabled) {
    return <div className="m-3"><SourceDisabledNotice reason={error.message} /></div>;
  }
  // Retrying cannot help a rate limit (429) or a resource that does not exist (404).
  const retryable = !(error instanceof ApiError) || (error.status !== 429 && error.status !== 404);
  return (
    <div role="alert" className="m-3 p-3 border border-chart-down/50 rounded-md bg-chart-down/8 flex gap-2.5">
      <AlertCircle className="w-4 h-4 text-chart-down flex-shrink-0 mt-0.5" />
      <div className="text-xs text-chart-down flex-1">
        <p className="font-medium">{title}</p>
        <p className="mt-0.5">{describeError(error)}</p>
        {error instanceof ApiError && error.requestId && <p className="mt-0.5 opacity-80">Reference: {error.requestId}</p>}
        {onRetry && retryable && (
          <button onClick={onRetry} className="mt-1.5 underline hover:no-underline">Try again</button>
        )}
      </div>
    </div>
  );
};

export const InfoBanner = ({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" }) => (
  <div className={`flex gap-2 items-start text-[11px] rounded-md px-2.5 py-1.5 border ${tone === "warn" ? "border-warning/40 bg-warning/10 text-foreground" : "border-border bg-secondary/40 text-muted-foreground"}`}>
    {tone === "warn" ? <Clock className="w-3.5 h-3.5 mt-px flex-shrink-0 text-warning" /> : <Info className="w-3.5 h-3.5 mt-px flex-shrink-0" />}
    <div>{children}</div>
  </div>
);

/** Shown in place of a section whose data source is switched off in this deployment. No retry: it will not change. */
export const SourceDisabledNotice = ({ title, reason }: { title?: string; reason?: string | null }) => (
  <div data-testid="source-disabled" role="status">
    <InfoBanner>
      {title && <span className="font-semibold text-foreground">{title}. </span>}
      {reason || "This data source is not available in this deployment."}
    </InfoBanner>
  </div>
);

interface SourceLineProps {
  source?: string | null;
  label?: string;
  asOf?: string | null;
  retrievedAt?: string | null;
  cached?: boolean;
  stale?: boolean;
  delayed?: boolean;
  note?: string | null;
  className?: string;
}

/** One-line provenance footer: source, as-of / retrieved time, cached / stale flags. */
export const SourceLine = ({ source, label, asOf, retrievedAt, cached, stale, delayed, note, className = "" }: SourceLineProps) => (
  <div className={`text-[10px] text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 ${className}`}>
    {label && <span className="font-medium">{label}</span>}
    {source && <span>Source: {source}</span>}
    {asOf && <span>As of {fmtDateTime(asOf)}</span>}
    {retrievedAt && <span>Retrieved {fmtDateTime(retrievedAt)}</span>}
    {delayed && <span>Delayed</span>}
    {cached && <span className="px-1 rounded bg-secondary">cached</span>}
    {stale && <span className="px-1 rounded bg-warning/15 text-warning font-medium">stale</span>}
    {note && <span>{note}</span>}
  </div>
);

import { Loader2, Sparkles } from "lucide-react";
import { ApiError } from "@/services/api";
import { useLatestResearch } from "@/hooks/queries";
import { useSource } from "@/hooks/useCapabilities";
import { isBusyError, useResearchJob } from "@/hooks/useResearchJob";
import { EmptyBox, ErrorBox, InfoBanner, LoadingBox, SourceDisabledNotice } from "@/components/DataStates";
import { fmtDateTime, isNum, safeHttpUrl } from "@/lib/format";
import type { ResearchDimension, ResearchReport } from "@/types/api";

const CONFIDENCE_NOTE = "Confidence reflects how much evidence was available and how recent it is. It does not measure whether the conclusion is correct.";
const fmtScore = (v: number) => `${v.toFixed(1)} / 100`;

const NOT_AVAILABLE_YET = "AI research is not available on this backend yet.";

const Stat = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="border border-border rounded-lg p-4 bg-card">
    <p className="text-xs text-muted-foreground mb-1.5">{label}</p>
    {children}
  </div>
);

const positionStyle = {
  bullish: "bg-chart-up/10 text-chart-up",
  bearish: "bg-chart-down/10 text-chart-down",
  neutral: "bg-secondary text-secondary-foreground",
} as const;

const Dimension = ({ dim }: { dim: ResearchDimension }) => (
  <div className="border border-border rounded-lg p-4 bg-card space-y-2">
    <div className="flex justify-between items-start gap-3">
      <div>
        <p className="font-medium text-sm text-foreground">{dim.title}</p>
        <div className="flex flex-wrap items-center gap-1.5 mt-1">
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${dim.status === "ok" ? "bg-secondary text-secondary-foreground" : "bg-warning/15 text-warning font-medium"}`}>
            {dim.status === "ok" ? "Analysed" : dim.status === "unavailable" ? "Unavailable" : "Failed"}
          </span>
          {dim.position && <span className={`text-[10px] px-1.5 py-0.5 rounded ${positionStyle[dim.position] ?? positionStyle.neutral}`}>{dim.position}</span>}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-lg font-bold font-mono text-foreground">{isNum(dim.score) ? fmtScore(dim.score) : "N/A"}</p>
        <p className="text-[10px] text-muted-foreground">
          {isNum(dim.confidence) ? `confidence ${(dim.confidence * 100).toFixed(0)}%` : "confidence not available"}
        </p>
      </div>
    </div>
    {dim.summary ? <p className="text-xs text-foreground">{dim.summary}</p> : <p className="text-xs text-muted-foreground">No summary available for this dimension.</p>}
    {dim.criteria.length > 0 && (
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={`${dim.title} rubric (scrollable)`}>
        <table className="w-full text-[11px]" aria-label={`${dim.title} rubric inputs`}>
          <thead>
            <tr className="text-left text-muted-foreground border-b border-border">
              <th scope="col" className="py-1 pr-3 font-medium">Criterion</th>
              <th scope="col" className="py-1 pr-3 font-medium">Value</th>
              <th scope="col" className="py-1 pr-3 font-medium">Score</th>
              <th scope="col" className="py-1 font-medium">Detail</th>
            </tr>
          </thead>
          <tbody>
            {dim.criteria.map((c) => (
              <tr key={c.key} className="border-b border-border/50 align-top">
                <th scope="row" className="py-1 pr-3 text-left font-medium text-foreground">{c.label}</th>
                <td className="py-1 pr-3 font-mono whitespace-nowrap">{c.value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}{c.unit ? ` ${c.unit}` : ""}</td>
                <td className="py-1 pr-3 font-mono whitespace-nowrap">{fmtScore(c.score)}</td>
                <td className="py-1 text-muted-foreground">
                  {c.detail}{" "}
                  {c.source_ref != null && <a href={`#research-source-${c.source_ref}`} className="text-primary font-mono hover:underline">[{c.source_ref}]</a>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
    {dim.evidence.length > 0 && (
      <ul className="space-y-1 text-xs text-muted-foreground list-disc pl-4">
        {dim.evidence.map((e, i) => (
          <li key={i}>
            {e.text}{" "}
            {e.source_ref != null && <a href={`#research-source-${e.source_ref}`} className="text-primary font-mono hover:underline">[{e.source_ref}]</a>}
          </li>
        ))}
      </ul>
    )}
    {dim.limitations.length > 0 && (
      <div className="bg-secondary/30 rounded p-2 text-[11px] text-muted-foreground">
        <span className="font-medium">Limitations: </span>{dim.limitations.join(" ")}
      </div>
    )}
  </div>
);

export const ResearchReportView = ({ report }: { report: ResearchReport }) => (
  <div className="space-y-5">
    <InfoBanner>{report.disclaimer || "Informational only, not investment advice. This analysis is AI-generated and may be wrong."}</InfoBanner>
    {report.reused && <InfoBanner>Identical evidence was found, so a stored report was reused. No new analysis was run.</InfoBanner>}
    {report.status === "partial" && <InfoBanner tone="warn">Partial result: some analysis dimensions could not be completed.</InfoBanner>}

    <div className="grid md:grid-cols-3 gap-4">
      <Stat label="Overall score">
        {isNum(report.overall.score) ? (
          <p className="text-4xl font-bold text-primary font-mono">{report.overall.score.toFixed(1)}<span className="text-base text-muted-foreground"> / 100</span></p>
        ) : (
          <p className="text-lg font-semibold text-foreground">Insufficient evidence</p>
        )}
      </Stat>
      <Stat label="Overall confidence">
        {isNum(report.overall.confidence) ? (
          <p className="text-4xl font-bold text-foreground font-mono">{(report.overall.confidence * 100).toFixed(0)}%</p>
        ) : (
          <p className="text-sm text-muted-foreground">Not available</p>
        )}
        <p className="mt-1.5 text-[11px] text-muted-foreground">{CONFIDENCE_NOTE}</p>
        {report.overall.confidence_basis.length > 0 && (
          <ul className="mt-1.5 text-[11px] text-muted-foreground list-disc pl-4">
            {report.overall.confidence_basis.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        )}
      </Stat>
      <Stat label="Generated">
        <p className="text-sm font-medium text-foreground">{fmtDateTime(report.generated_at)}</p>
        <p className="text-[11px] text-muted-foreground mt-1 capitalize">{report.status}</p>
      </Stat>
    </div>

    <div>
      <h3 className="text-sm font-semibold text-foreground mb-3">Analysis dimensions</h3>
      <div className="space-y-3">{report.dimensions.map((d) => <Dimension key={d.key} dim={d} />)}</div>
    </div>

    {report.limitations.length > 0 && (
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2">Overall limitations</h3>
        <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">{report.limitations.map((l, i) => <li key={i}>{l}</li>)}</ul>
      </div>
    )}

    <div>
      <h3 className="text-sm font-semibold text-foreground mb-2">Sources</h3>
      {report.sources.length === 0 ? (
        <p className="text-xs text-muted-foreground">No sources were recorded for this report.</p>
      ) : (
        <ol className="space-y-1.5 text-xs">
          {report.sources.map((s) => {
            const href = safeHttpUrl(s.url);
            return (
              <li key={s.id} id={`research-source-${s.id}`} className="flex gap-2">
                <span className="font-mono text-muted-foreground">[{s.id}]</span>
                <div>
                  {href ? <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">{s.title}</a> : <span className="text-foreground">{s.title}</span>}
                  <span className="text-muted-foreground"> · {s.type.replace("_", " ")} · retrieved {fmtDateTime(s.retrieved_at)}{s.as_of ? ` · as of ${fmtDateTime(s.as_of)}` : ""}</span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>

    {report.method_note && <p className="text-[11px] text-muted-foreground"><span className="font-medium">Method: </span>{report.method_note}</p>}
    <p className="text-[11px] text-muted-foreground">
      {report.refinement.rounds > 0
        ? `Refinement: ${report.refinement.rounds} round(s)${report.refinement.changes.length ? ` — ${report.refinement.changes.join("; ")}` : ""}.`
        : `Refinement skipped${report.refinement.skipped_reason ? `: ${report.refinement.skipped_reason}` : "."}`}
    </p>
  </div>
);

const failureTitle = (code: string | null | undefined) =>
  code === "rate_limited" ? "Daily research limit reached" : code === "timeout" ? "Research timed out" : "Research could not be generated";

const ResearchRunner = ({ companyId }: { companyId: string }) => {
  const latest = useLatestResearch(companyId);
  const run = useResearchJob(companyId);

  const latestErr = latest.error instanceof ApiError ? latest.error : null;
  const endpointMissing = !!latestErr?.isEndpointMissing;
  const noneYet = !!latestErr && latestErr.status === 404 && !endpointMissing;
  const report = latest.data;
  const failed = run.job?.status === "failed" ? run.job : null;
  const startErr = run.startError;
  const startMissing = startErr instanceof ApiError && startErr.isEndpointMissing;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">AI research</h3>
          <p className="text-[11px] text-muted-foreground">Generated only when you request it, in the background (usually under a minute). It counts toward a daily per-user limit unless identical evidence is reused.</p>
        </div>
        <button
          onClick={run.start}
          disabled={run.busy || run.active || endpointMissing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {run.busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {report ? "Regenerate research" : "Generate research"}
        </button>
      </div>

      {run.busy && (
        <div className="border border-border rounded-md bg-card p-4 flex items-center gap-2 text-xs text-foreground" role="status">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          {run.starting ? "Starting research…" : run.job?.status === "queued" ? "Research is queued…" : "Research is running…"}
        </div>
      )}

      {run.active && run.slow && (
        <div className="border border-border rounded-md bg-card p-4 space-y-2" role="status">
          <p className="text-xs text-foreground">This is taking longer than expected. The research is still running on the server.</p>
          <button onClick={run.checkAgain} className="text-xs text-primary underline">Check again</button>
        </div>
      )}

      {run.active && run.pollError != null && (
        <div className="border border-border rounded-md bg-card">
          <ErrorBox error={run.pollError} onRetry={run.checkAgain} title="Could not check research progress" />
        </div>
      )}

      {failed && (
        <div className="border border-border rounded-md bg-card">
          <ErrorBox error={new ApiError({ status: 0, code: failed.error?.code ?? null, message: failed.error?.message || "The research job failed." })} title={failureTitle(failed.error?.code)} />
        </div>
      )}

      {startErr != null && (
        startMissing ? <InfoBanner tone="warn">{NOT_AVAILABLE_YET}</InfoBanner>
        : isBusyError(startErr) ? <InfoBanner tone="warn">Research is busy, try again in a few minutes.</InfoBanner>
        : <div className="border border-border rounded-md"><ErrorBox error={startErr} title="Research could not be started" /></div>
      )}

      {latest.isPending ? (
        <LoadingBox label="Checking for saved research…" />
      ) : report ? (
        <ResearchReportView report={report} />
      ) : endpointMissing ? (
        <div className="border border-border rounded-md bg-card"><EmptyBox title="AI research unavailable">{NOT_AVAILABLE_YET} The rest of this page is unaffected.</EmptyBox></div>
      ) : noneYet ? (
        <div className="border border-border rounded-md bg-card"><EmptyBox title="No saved research for this company">Use "Generate research" to create a report. Nothing has been generated yet.</EmptyBox></div>
      ) : latest.isError ? (
        <div className="border border-border rounded-md bg-card"><ErrorBox error={latest.error} onRetry={() => latest.refetch()} title="Could not check for saved research" /></div>
      ) : null}
    </div>
  );
};

/** Research needs at least one enabled evidence source; otherwise explain why and make no /research request at all. */
const ResearchPanel = ({ companyId }: { companyId: string }) => {
  const ai = useSource("ai");
  if (ai.state === "loading") return <LoadingBox label="Loading…" />;
  if (ai.state === "disabled") {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">AI research</h3>
        <SourceDisabledNotice title="AI research is not available" reason={ai.reason} />
      </div>
    );
  }
  return <ResearchRunner companyId={companyId} />;
};

export default ResearchPanel;

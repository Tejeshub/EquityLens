import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Send } from "lucide-react";
import { api, ApiError } from "@/services/api";
import { ErrorBox, InfoBanner, LoadingBox, SourceDisabledNotice } from "@/components/DataStates";
import { useSource } from "@/hooks/useCapabilities";
import { fmtDateTime, safeHttpUrl } from "@/lib/format";

const MAX = 500;

const AskForm = ({ companyId }: { companyId: string }) => {
  const [question, setQuestion] = useState("");
  const ask = useMutation({ mutationFn: (q: string) => api.ask(companyId, q) });
  // Panels are keyed by company id by the parent, so a different company never inherits this state.

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = question.trim();
    if (!q || q.length > MAX || ask.isPending) return;
    ask.mutate(q);
  };

  const err = ask.error instanceof ApiError ? ask.error : null;
  const missing = !!err?.isEndpointMissing;
  const d = ask.data;

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Ask about this company</h3>
        <p className="text-[11px] text-muted-foreground">Answers are AI-generated. Check whether an answer is document-grounded and review its citations.</p>
      </div>
      <form onSubmit={submit} className="space-y-2">
        <label htmlFor="ask-q" className="sr-only">Your question</label>
        <textarea id="ask-q" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={MAX} rows={3}
          placeholder="e.g. What did management say about margins?"
          className="w-full bg-card border border-border rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/30 text-foreground" />
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">{question.length}/{MAX}</span>
          <button type="submit" disabled={ask.isPending || !question.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed">
            {ask.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Ask
          </button>
        </div>
      </form>

      {ask.isError && (missing
        ? <InfoBanner tone="warn">The question-answering service is not available on this backend yet.</InfoBanner>
        : <div className="border border-border rounded-md"><ErrorBox error={ask.error} title="Could not get an answer" /></div>)}

      {d && (
        <div className="border border-border rounded-md bg-card p-4 space-y-3">
          {!d.grounded && (
            <div role="alert"><InfoBanner tone="warn"><span className="font-semibold">Not document-grounded.</span> This answer is not supported by retrieved company documents. Treat it as unverified.</InfoBanner></div>
          )}
          {d.notice && <div data-testid="ask-notice"><InfoBanner>{d.notice}</InfoBanner></div>}
          <p className="text-sm text-foreground whitespace-pre-wrap">{d.answer}</p>
          <p className="text-[11px] text-muted-foreground">{d.retrieval_count} document passage(s) retrieved.</p>
          {d.citations.length > 0 && (
            <ol className="space-y-1.5 text-xs border-t border-border pt-2">
              {d.citations.map((c) => {
                const href = safeHttpUrl(c.url);
                return (
                  <li key={c.index}>
                    <span className="font-mono text-muted-foreground">[{c.index}] </span>
                    {href ? <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">{c.title}</a> : <span className="font-medium text-foreground">{c.title}</span>}
                    {c.page != null && <span className="text-muted-foreground"> · p. {c.page}</span>}
                    {c.as_of && <span className="text-muted-foreground"> · as of {fmtDateTime(c.as_of)}</span>}
                    {c.excerpt && <p className="text-muted-foreground mt-0.5 line-clamp-3">{c.excerpt}</p>}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </div>
  );
};

/** Copilot needs at least one enabled evidence source; otherwise explain why and offer no controls (and make no /ask request). */
const AskPanel = ({ companyId }: { companyId: string }) => {
  const ai = useSource("ai");
  if (ai.state === "loading") return <LoadingBox label="Loading…" />;
  if (ai.state === "disabled") {
    return (
      <div className="space-y-3 max-w-3xl">
        <h3 className="text-sm font-semibold text-foreground">Ask about this company</h3>
        <SourceDisabledNotice title="Copilot is not available" reason={ai.reason} />
      </div>
    );
  }
  return <AskForm companyId={companyId} />;
};

export default AskPanel;

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiError, isAbortError } from "@/services/api";
import type { ResearchJob } from "@/types/api";

/** Stop polling after this long and let the user check again. */
export const RESEARCH_POLL_MAX_MS = 5 * 60_000;

const isActive = (j: ResearchJob | null) => !!j && (j.status === "queued" || j.status === "running");

/**
 * Research generation is a background job: start it (or adopt the one already running), then poll until it finishes.
 * Polling stops on unmount, on completion, on a poll error, and after RESEARCH_POLL_MAX_MS.
 */
export function useResearchJob(companyId: string) {
  const qc = useQueryClient();
  const [job, setJob] = useState<ResearchJob | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<unknown>(null);
  const [pollError, setPollError] = useState<unknown>(null);
  const [slow, setSlow] = useState(false);
  const [tick, setTick] = useState(0); // bumping this (re)starts polling, with a fresh deadline
  const deadline = useRef(0);
  const startCtrl = useRef<AbortController | null>(null);

  const adopt = useCallback((j: ResearchJob) => {
    setJob(j);
    setPollError(null);
    setSlow(false);
    deadline.current = Date.now() + RESEARCH_POLL_MAX_MS;
    setTick((n) => n + 1);
  }, []);

  // Resume a run that is still in progress after a reload or tab switch.
  useEffect(() => {
    const ctrl = new AbortController();
    api.research.active(companyId, ctrl.signal).then(adopt).catch(() => { /* 404 no_active_job (or any failure): nothing to resume */ });
    return () => ctrl.abort();
  }, [companyId, adopt]);

  const jobId = job?.job_id;
  const status = job?.status;
  const pollMs = job?.poll_after_ms ?? 2000;
  useEffect(() => {
    if (!jobId || (status !== "queued" && status !== "running") || slow || pollError) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      if (Date.now() >= deadline.current) { setSlow(true); return; }
      try {
        const next = await api.research.job(jobId, ctrl.signal);
        if (ctrl.signal.aborted) return;
        if (next.status === "complete" && next.report) qc.setQueryData(["research", "latest", companyId], next.report);
        setJob(next);
      } catch (e) {
        if (ctrl.signal.aborted || isAbortError(e)) return;
        setPollError(e);
      }
    }, pollMs);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [jobId, status, pollMs, slow, pollError, tick, job, companyId, qc]);

  useEffect(() => () => startCtrl.current?.abort(), []);

  const start = useCallback(async () => {
    if (starting || isActive(job)) return; // never a second job while one is active
    setStarting(true);
    setStartError(null);
    startCtrl.current = new AbortController();
    try {
      adopt(await api.research.start(companyId, startCtrl.current.signal));
    } catch (e) {
      if (!isAbortError(e)) setStartError(e);
    } finally {
      setStarting(false);
    }
  }, [starting, job, companyId, adopt]);

  const checkAgain = useCallback(() => {
    setSlow(false);
    setPollError(null);
    deadline.current = Date.now() + RESEARCH_POLL_MAX_MS;
    setTick((n) => n + 1);
  }, []);

  const busy = starting || (isActive(job) && !slow && !pollError);
  return { job, busy, starting, active: isActive(job), slow, pollError, startError, start, checkAgain };
}

export const isBusyError = (e: unknown) => e instanceof ApiError && e.status === 503 && e.code === "busy";

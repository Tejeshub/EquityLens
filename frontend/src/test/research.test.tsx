import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor, act } from "@testing-library/react";
import ResearchPanel from "@/components/ResearchPanel";
import AskPanel from "@/components/AskPanel";
import CompanyDetail from "@/pages/CompanyDetail";
import { RESEARCH_POLL_MAX_MS } from "@/hooks/useResearchJob";
import { defaultCompanyRoutes, COMPANY, jsonResponse, meRoute, mockFetch, renderWithProviders, route } from "./helpers";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const dim = (over: object = {}) => ({
  key: "fundamental", title: "Fundamentals", status: "ok", position: "bullish", score: 62, confidence: 0.55, summary: "Solid.",
  evidence: [], limitations: [],
  criteria: [{ key: "roce", label: "ROCE", value: 18.5, unit: "%", score: 70, detail: "ROCE 18.5% vs rubric", source_ref: 1 }],
  ...over,
});
const REPORT = {
  id: "r1", company_id: "c-1", company_name: "Acme", status: "complete", generated_at: "2026-10-12T10:00:00Z", disclaimer: "Disclaimer text.",
  overall: { score: 62, confidence: 0.55, confidence_basis: ["2 of 6 criteria computed"] },
  dimensions: [dim(), dim({ key: "alternative", title: "Alternative", status: "unavailable", score: null, confidence: null, criteria: [], limitations: ["Shareholding data is not shown in this deployment."], position: null })],
  sources: [{ id: 1, title: "Quarterly data", url: null, type: "financial_data", retrieved_at: "2026-10-12T09:00:00Z", as_of: null }],
  refinement: { rounds: 0, changes: [], skipped_reason: null }, limitations: [], method_note: "Fixed published rubric.", reused: false,
};
const job = (status: string, extra: object = {}) => ({
  job_id: "j1", company_id: "c-1", status, error: null, report_id: null, report: null, created_at: "2026-10-12T10:00:00Z",
  started_at: null, finished_at: null, poll_after_ms: 10, ...extra,
});
const none = route("GET", "/api/v1/research/latest", () => jsonResponse(404, { detail: { code: "no_research", message: "none" } }));
const noActive = route("GET", "/api/v1/research/active", () => jsonResponse(404, { detail: { code: "no_active_job", message: "none" } }));
const renderPanel = () => renderWithProviders(<ResearchPanel companyId="c-1" />, { withAuth: false });
const gen = () => fireEvent.click(screen.getByRole("button", { name: /generate research|regenerate research/i }));

describe("ResearchPanel report rendering", () => {
  it("shows scores as 'x / 100', criteria, confidence note, method note, basis", async () => {
    mockFetch(route("GET", "/api/v1/research/latest", () => jsonResponse(200, REPORT)), noActive);
    renderPanel();
    expect(await screen.findByText("Analysis dimensions")).toBeInTheDocument();
    expect(screen.getByText("62.0 / 100")).toBeInTheDocument();
    expect(screen.getByText("55%")).toBeInTheDocument();
    expect(screen.getByText(/does not measure whether the conclusion is correct/i)).toBeInTheDocument();
    expect(screen.getByText("2 of 6 criteria computed")).toBeInTheDocument();
    expect(screen.getByText(/Fixed published rubric/)).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Fundamentals rubric inputs" });
    expect(table).toHaveTextContent("ROCE");
    expect(table).toHaveTextContent("18.5 %");
    expect(table).toHaveTextContent("70.0 / 100");
    expect(screen.getByText(/Shareholding data is not shown in this deployment/)).toBeInTheDocument();
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
  });

  it("flags a reused report", async () => {
    mockFetch(route("GET", "/api/v1/research/latest", () => jsonResponse(200, { ...REPORT, reused: true })), noActive);
    renderPanel();
    expect(await screen.findByText(/stored report was reused/i)).toBeInTheDocument();
  });
});

describe("ResearchPanel job lifecycle", () => {
  it("submit -> queued -> running -> complete shows the report", async () => {
    const seq = ["queued", "running", "complete"]; let i = 0;
    const { calls } = mockFetch(none, noActive,
      route("POST", "/api/v1/research/c-1", () => jsonResponse(202, job("queued"))),
      route("GET", "/api/v1/research/jobs/j1", () => { const s = seq[Math.min(i++, 2)]; return jsonResponse(200, job(s, s === "complete" ? { report: REPORT, report_id: "r1" } : {})); }));
    renderPanel();
    await screen.findByText(/No saved research/);
    gen();
    expect(await screen.findByText("Research is queued…")).toBeInTheDocument();
    expect(await screen.findByText("Research is running…")).toBeInTheDocument();
    expect(await screen.findByText("62.0 / 100")).toBeInTheDocument();
    const pollsAfterDone = calls.filter((c) => c.url.pathname.includes("/jobs/")).length;
    await act(async () => { await new Promise((r) => setTimeout(r, 80)); });
    expect(calls.filter((c) => c.url.pathname.includes("/jobs/")).length).toBe(pollsAfterDone);
  });

  it.each([
    ["rate_limited", "Daily research limit (3) reached; try again tomorrow", "Daily research limit reached"],
    ["timeout", "The analysis timed out.", "Research timed out"],
    ["internal", "Something broke.", "Research could not be generated"],
  ])("failed job (%s) shows the server message", async (code, message, title) => {
    mockFetch(none, noActive,
      route("POST", "/api/v1/research/c-1", () => jsonResponse(202, job("queued"))),
      route("GET", "/api/v1/research/jobs/j1", () => jsonResponse(200, job("failed", { error: { code, message } }))));
    renderPanel();
    await screen.findByText(/No saved research/);
    gen();
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generate research/i })).toBeEnabled();
  });

  it("resumes an active job found via /research/active and polls it", async () => {
    const { calls } = mockFetch(none,
      route("GET", "/api/v1/research/active", () => jsonResponse(200, job("running"))),
      route("GET", "/api/v1/research/jobs/j1", () => jsonResponse(200, job("complete", { report: REPORT, report_id: "r1" }))));
    renderPanel();
    expect(await screen.findByText("Research is running…")).toBeInTheDocument();
    expect(await screen.findByText("62.0 / 100")).toBeInTheDocument();
    expect(calls.some((c) => c.init.method === "POST")).toBe(false);
  });

  it("never starts a second job while one is active", async () => {
    const { calls } = mockFetch(none,
      route("GET", "/api/v1/research/active", () => jsonResponse(200, job("running", { poll_after_ms: 5000 }))));
    renderPanel();
    await screen.findByText("Research is running…");
    expect(screen.getByRole("button", { name: /generate research/i })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /generate research/i }));
    expect(calls.filter((c) => c.init.method === "POST")).toHaveLength(0);
  });

  it("double-clicking Generate sends a single POST", async () => {
    const { calls } = mockFetch(none, noActive,
      route("POST", "/api/v1/research/c-1", () => jsonResponse(202, job("queued", { poll_after_ms: 5000 }))));
    renderPanel();
    await screen.findByText(/No saved research/);
    gen(); gen();
    await screen.findByText("Research is queued…");
    expect(calls.filter((c) => c.init.method === "POST")).toHaveLength(1);
  });

  it("stops polling on unmount", async () => {
    const { calls } = mockFetch(none,
      route("GET", "/api/v1/research/active", () => jsonResponse(200, job("running"))),
      route("GET", "/api/v1/research/jobs/j1", () => jsonResponse(200, job("running"))));
    const { unmount } = renderPanel();
    await waitFor(() => expect(calls.filter((c) => c.url.pathname.includes("/jobs/")).length).toBeGreaterThan(1));
    unmount();
    const n = calls.filter((c) => c.url.pathname.includes("/jobs/")).length;
    await new Promise((r) => setTimeout(r, 80));
    expect(calls.filter((c) => c.url.pathname.includes("/jobs/")).length).toBe(n);
  });

  it("after the maximum wait shows 'taking longer than expected' with Check again", async () => {
    const { calls } = mockFetch(none,
      route("GET", "/api/v1/research/active", () => jsonResponse(200, job("running"))),
      route("GET", "/api/v1/research/jobs/j1", () => jsonResponse(200, job("running"))));
    const real = Date.now();
    renderPanel();
    await screen.findByText("Research is running…");
    vi.spyOn(Date, "now").mockReturnValue(real + RESEARCH_POLL_MAX_MS + 1000);
    expect(await screen.findByText(/taking longer than expected/i)).toBeInTheDocument();
    const polls = calls.filter((c) => c.url.pathname.includes("/jobs/")).length;
    await new Promise((r) => setTimeout(r, 60));
    expect(calls.filter((c) => c.url.pathname.includes("/jobs/")).length).toBe(polls);
    vi.spyOn(Date, "now").mockReturnValue(real);
    fireEvent.click(screen.getByRole("button", { name: "Check again" }));
    await waitFor(() => expect(calls.filter((c) => c.url.pathname.includes("/jobs/")).length).toBeGreaterThan(polls));
  });

  it("503 busy shows the busy message; 429 shows the rate-limit message", async () => {
    mockFetch(none, noActive, route("POST", "/api/v1/research/c-1", () => jsonResponse(503, { detail: { code: "busy", message: "x" } })));
    renderPanel();
    await screen.findByText(/No saved research/);
    gen();
    expect(await screen.findByText("Research is busy, try again in a few minutes.")).toBeInTheDocument();
    cleanup();
    mockFetch(none, noActive, route("POST", "/api/v1/research/c-1", () => jsonResponse(429, { detail: "Too many research requests; slow down" }, { "Retry-After": "40" })));
    renderPanel();
    await screen.findByText(/No saved research/);
    gen();
    expect(await screen.findByText(/Too many requests\. Please try again later \(retry in about 40s\)/)).toBeInTheDocument();
  });
});

describe("AskPanel", () => {
  const ask = async (body: object) => {
    mockFetch(route("POST", "/api/v1/ask", () => jsonResponse(200, body)));
    renderWithProviders(<AskPanel companyId="c-1" />, { withAuth: false });
    fireEvent.change(await screen.findByLabelText("Your question"), { target: { value: "What about margins?" } });
    fireEvent.click(screen.getByRole("button", { name: /ask/i }));
  };

  it("grounded answer: citations with as_of, notice, no warning", async () => {
    await ask({ answer: "Margins rose.", grounded: true, retrieval_count: 1, notice: "Answers use filings up to Q1.",
      citations: [{ index: 1, title: "Q1 call", url: "https://x.example/a", page: 3, excerpt: "margin up", as_of: "2026-06-30" }] });
    expect(await screen.findByText("Margins rose.")).toBeInTheDocument();
    expect(screen.queryByText(/Not document-grounded/)).not.toBeInTheDocument();
    expect(screen.getByTestId("ask-notice")).toHaveTextContent("Answers use filings up to Q1.");
    expect(screen.getByText(/as of .*2026/)).toBeInTheDocument();
  });

  it("ungrounded answer shows the warning banner", async () => {
    await ask({ answer: "General knowledge.", grounded: false, retrieval_count: 0, notice: null, citations: [] });
    expect(await screen.findByText(/Not document-grounded/)).toBeInTheDocument();
    expect(screen.queryByTestId("ask-notice")).not.toBeInTheDocument();
  });
});

describe("CompanyDetail tabs", () => {
  const renderCompany = (id = "c-1") => renderWithProviders(<CompanyDetail />, { path: `/company/${id}`, routePath: "/company/:id" });
  const openTab = (name: string) => { const t = screen.getByRole("tab", { name }); fireEvent.mouseDown(t); fireEvent.click(t); };

  it("keeps Ask state when switching tabs and back", async () => {
    mockFetch(...defaultCompanyRoutes, route("POST", "/api/v1/ask", () => jsonResponse(200, { answer: "Kept answer.", grounded: true, citations: [], retrieval_count: 0, notice: null })));
    renderCompany();
    await screen.findByText("Acme Chemicals Ltd");
    openTab("Ask");
    fireEvent.change(await screen.findByLabelText("Your question"), { target: { value: "Keep this question" } });
    fireEvent.click(screen.getByRole("button", { name: /^ask$/i }));
    await screen.findByText("Kept answer.");
    openTab("Overview");
    await waitFor(() => expect(screen.getByTestId("panel-ask")).toHaveAttribute("hidden"));
    openTab("Ask");
    expect(screen.getByLabelText("Your question")).toHaveValue("Keep this question");
    expect(screen.getByText("Kept answer.")).toBeInTheDocument();
  });

  it("does not fetch research until the tab is visited", async () => {
    const { calls } = mockFetch(...defaultCompanyRoutes, none, noActive);
    renderCompany();
    await screen.findByText("Acme Chemicals Ltd");
    expect(calls.some((c) => c.url.pathname.startsWith("/api/v1/research"))).toBe(false);
    openTab("AI Research");
    await waitFor(() => expect(calls.some((c) => c.url.pathname === "/api/v1/research/latest")).toBe(true));
    expect(calls.some((c) => c.url.pathname === "/api/v1/research/active")).toBe(true);
  });

  it.each([404, 422])("treats %s on the company GET as 'Company not found'", async (status) => {
    mockFetch(meRoute, route("GET", "/api/v1/companies/bad", () => jsonResponse(status, { detail: status === 404 ? "Company not found" : [{ loc: ["path", "company_id"], msg: "Input should be a valid UUID" }] })));
    renderCompany("bad");
    expect(await screen.findByRole("heading", { name: "Company not found" })).toBeInTheDocument();
  });
});

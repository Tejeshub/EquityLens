import { NA } from "@/lib/format";

const REASONS: Record<string, string> = {
  source_disabled: "Not shown in this deployment",
  not_covered: "Not covered by the current source",
  not_found: "No data found for this symbol",
  no_data: "No data found for this symbol",
  quota: "Provider rate limit reached",
  budget: "Request budget reached",
  timeout: "Provider timed out",
  unavailable: "Provider temporarily unavailable",
  circuit_open: "Provider temporarily unavailable",
  bad_payload: "Provider returned an unexpected response",
};

/** Plain-language form of a backend reason code. Unknown codes are shown as given rather than guessed at. */
export const reasonText = (code: string | null | undefined): string => (code ? (REASONS[code] ?? code) : NA);

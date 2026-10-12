/**
 * Returns `candidate` only if it is a same-origin relative path (e.g. "/company/abc?x=1").
 * Anything else (absolute URLs, protocol-relative "//evil", backslash tricks, control chars)
 * falls back to `fallback`, which prevents open redirects after login.
 */
export function safeNextPath(candidate: string | null | undefined, fallback = "/"): string {
  if (!candidate) return fallback;
  if (!candidate.startsWith("/")) return fallback;
  if (candidate.startsWith("//") || candidate.startsWith("/\\")) return fallback;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\\]/.test(candidate)) return fallback;
  if (candidate.startsWith("/login") || candidate.startsWith("/register")) return fallback;
  return candidate;
}

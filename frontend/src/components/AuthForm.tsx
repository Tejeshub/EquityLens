import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { Loader2, TrendingUp } from "lucide-react";
import { ApiError } from "@/services/api";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD = 10;
// Anything outside printable ASCII (accents, spaces inside, zero-width characters): the backend rejects these with 422.
const NON_ASCII_RE = /[^\x21-\x7E]/;
const EMAIL_ASCII_MSG = "Use only standard ASCII characters in your email (no accents, spaces or invisible characters).";

/** Maps a failed auth call to an accurate, user-facing message. "Invalid email or password" is only ever for a 401. */
export function authErrorMessage(err: unknown, mode: "login" | "register"): string {
  if (!(err instanceof ApiError)) return "Something went wrong. Please try again.";
  if (err.code === "invalid_response" || err.status === 0 || err.status === 429) return err.message;
  if (err.status === 401) return mode === "login" ? "Invalid email or password." : "We could not create the account. Please check your details and try again.";
  if (err.status === 403) return "The request was refused (403). Reload the page and try again.";
  if (err.status >= 500) return "The server had a problem. Please try again in a moment.";
  if (err.status === 422) {
    if (err.fields.email) return `Enter a valid email address. ${EMAIL_ASCII_MSG}`;
    if (err.fields.password) return `Password: ${err.fields.password}`;
    return mode === "register"
      ? `Please check your email and password (password must be at least ${MIN_PASSWORD} characters).`
      : "Please check your email and password.";
  }
  return mode === "register" ? "We could not create the account. Please check your details and try again." : "We could not sign you in. Please try again.";
}

interface Props {
  mode: "login" | "register";
  onSubmit: (email: string, password: string) => Promise<void>;
}

const AuthForm = ({ mode, onSubmit }: Props) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const trimmed = email.trim();
  const emailError = !email ? "Email is required." : NON_ASCII_RE.test(trimmed) ? EMAIL_ASCII_MSG : !EMAIL_RE.test(trimmed) ? "Enter a valid email address." : null;
  const passwordError = !password
    ? "Password is required."
    : mode === "register" && password.length < MIN_PASSWORD
      ? `Password must be at least ${MIN_PASSWORD} characters.`
      : null;

  const handle = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setTouched(true);
    setFormError(null);
    if (emailError || passwordError) return;
    setSubmitting(true);
    try {
      await onSubmit(email.trim(), password);
    } catch (err) {
      setFormError(authErrorMessage(err, mode));
      setSubmitting(false);
    }
  };

  const title = mode === "login" ? "Sign in" : "Create account";
  const inputCls = "w-full bg-card border border-input rounded-md px-4 py-3 text-sm outline-none transition-shadow focus:border-foreground focus:ring-2 focus:ring-foreground/10 text-foreground placeholder:text-muted-foreground";

  return (
    <main className="flex-1 min-h-screen bg-peach/40 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-full bg-sienna flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-peach" />
          </div>
          <span className="font-serif text-2xl tracking-tight text-foreground">EquityLens</span>
        </div>
        <form onSubmit={handle} noValidate className="surface-float p-8 space-y-5" aria-label={title}>
          <h1 className="font-serif text-3xl text-foreground">{title}</h1>

          {formError && (
            <div role="alert" className="border border-chart-down/50 bg-chart-down/8 text-chart-down text-xs rounded-md p-3">{formError}</div>
          )}

          <div>
            <label htmlFor="auth-email" className="metric-label mb-1 block">Email</label>
            <input
              id="auth-email" type="email" autoComplete="email" value={email}
              onChange={(e) => setEmail(e.target.value)} onBlur={() => setTouched(true)}
              aria-invalid={touched && !!emailError} aria-describedby={touched && emailError ? "auth-email-err" : undefined}
              className={inputCls}
            />
            {touched && emailError && <p id="auth-email-err" className="text-[11px] text-chart-down mt-1">{emailError}</p>}
          </div>

          <div>
            <label htmlFor="auth-password" className="metric-label mb-1 block">Password</label>
            <input
              id="auth-password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password}
              onChange={(e) => setPassword(e.target.value)} onBlur={() => setTouched(true)}
              aria-invalid={touched && !!passwordError} aria-describedby={touched && passwordError ? "auth-password-err" : undefined}
              className={inputCls}
            />
            {touched && passwordError && <p id="auth-password-err" className="text-[11px] text-chart-down mt-1">{passwordError}</p>}
            {mode === "register" && <p className="text-[11px] text-muted-foreground mt-1">At least {MIN_PASSWORD} characters.</p>}
          </div>

          <button type="submit" disabled={submitting}
            className="w-full h-11 flex items-center justify-center gap-2 px-5 bg-primary text-primary-foreground rounded-full text-sm hover:bg-primary/85 disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-200">
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {submitting ? "Please wait…" : title}
          </button>

          <p className="text-xs text-muted-foreground text-center">
            {mode === "login" ? (<>No account? <Link to="/register" className="text-foreground underline underline-offset-4 hover:no-underline">Create one</Link></>) : (<>Already registered? <Link to="/login" className="text-foreground underline underline-offset-4 hover:no-underline">Sign in</Link></>)}
          </p>
        </form>
      </div>
    </main>
  );
};

export default AuthForm;

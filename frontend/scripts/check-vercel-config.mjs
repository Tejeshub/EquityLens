// Guards against deploying vercel.json with its backend placeholder still in place.
// No-op locally; fails (exit 1) on Vercel (VERCEL is set) or with --strict when RENDER_BACKEND_URL remains.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const file = process.env.VERCEL_CONFIG_PATH || resolve(here, "..", "vercel.json");
const strict = process.argv.includes("--strict") || !!process.env.VERCEL;

const text = readFileSync(file, "utf8");
if (strict && text.includes("RENDER_BACKEND_URL")) {
  process.stderr.write(
    `${file} still contains the RENDER_BACKEND_URL placeholder. Replace it with the real backend origin before deploying.\n`,
  );
  process.exit(1);
}
process.exit(0);

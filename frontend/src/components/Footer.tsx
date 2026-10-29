import { useCapabilities } from "@/hooks/useCapabilities";
import type { Capabilities } from "@/types/api";

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Data-source attribution built only from what the backend says is enabled; nothing is hard-coded. */
export function attributionParts(c: Capabilities): string[] {
  const parts: string[] = [];
  if (c.news.enabled && c.news.provider) parts.push(`News: ${c.news.provider}`);
  if (c.market_data.enabled && c.market_data.provider) parts.push(`Prices: ${c.market_data.provider}`);
  if (c.fundamentals.enabled && c.fundamentals.provider) parts.push(`Reported financials: ${c.fundamentals.provider}`);
  if (c.index_segments.enabled && c.index_segments.provider) parts.push(`Sector and segment labels: ${c.index_segments.provider}`);
  if (c.ai.research && c.ai.copilot_provider) parts.push(`AI answers: ${titleCase(c.ai.copilot_provider)}`);
  return parts;
}

const Footer = () => {
  const { data } = useCapabilities();
  const parts = data ? attributionParts(data) : [];
  const off = data
    ? [!data.market_data.enabled && "market prices", !data.fundamentals.enabled && "reported financials", !data.index_segments.enabled && "sector and segment labels", !data.news.enabled && "news"].filter(Boolean) as string[]
    : [];
  return (
    <footer className="mt-16 bg-peach/30 py-10 text-xs text-muted-foreground">
      <div className="container mx-auto space-y-2">
        <p className="font-medium text-foreground">Informational only — not investment advice. AI-generated content can be wrong.</p>
        {data && (
          <p data-testid="source-attribution">
            {parts.length > 0 ? `Data sources — ${parts.join(" · ")}.` : "No third-party data sources are enabled."}
            {off.length > 0 && ` Not shown in this deployment: ${off.join(", ")}.`}
            {data.ai.note ? ` ${data.ai.note}` : ""}
          </p>
        )}
      </div>
    </footer>
  );
};

export default Footer;

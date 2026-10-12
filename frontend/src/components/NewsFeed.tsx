import { ExternalLink } from "lucide-react";
import { useNews } from "@/hooks/queries";
import { EmptyBox, ErrorBox, InfoBanner, LoadingBox, SourceDisabledNotice, SourceLine } from "@/components/DataStates";
import { useSource } from "@/hooks/useCapabilities";
import { fmtDateTime, safeHttpUrl } from "@/lib/format";

const NewsFeed = ({ companyId }: { companyId: string }) => {
  const source = useSource("news");
  const news = useNews(companyId, source.state === "enabled");
  const d = news.data;

  return (
    <div className="border border-border rounded-md bg-card">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Latest News</h3>
      </div>
      {source.state === "disabled" ? (
        <div className="p-3"><SourceDisabledNotice reason={source.reason} /></div>
      ) : source.state === "loading" || news.isPending ? (
        <LoadingBox label="Loading news…" />
      ) : news.isError ? (
        <ErrorBox error={news.error} onRetry={() => news.refetch()} title="News unavailable" />
      ) : d && d.items.length === 0 ? (
        <EmptyBox title="No recent news found">The news source returned no articles for this company.</EmptyBox>
      ) : d ? (
        <>
          {d.stale && <div className="p-3 pb-0"><InfoBanner tone="warn">News is stale (the latest refresh failed or is outdated).</InfoBanner></div>}
          <ul className="divide-y divide-border max-h-[400px] overflow-y-auto scrollbar-thin">
            {d.items.map((item, i) => {
              const href = safeHttpUrl(item.url);
              return (
                <li key={`${item.url}-${i}`} className="px-4 py-3 hover:bg-secondary/40 transition-colors">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      {href ? (
                        <a href={href} target="_blank" rel="noopener noreferrer" className="text-[13px] font-medium text-foreground leading-snug hover:text-primary hover:underline">
                          {item.title}
                        </a>
                      ) : (
                        <p className="text-[13px] font-medium text-foreground leading-snug">{item.title}</p>
                      )}
                      {item.excerpt && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.excerpt}</p>}
                      <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
                        <span className="font-medium">{item.source}</span>
                        <span>·</span>
                        <span>{item.published_at ? fmtDateTime(item.published_at) : "Publication date not available"}</span>
                        {item.author && (<><span>·</span><span>{item.author}</span></>)}
                      </div>
                    </div>
                    {href && <ExternalLink className="w-3 h-3 text-muted-foreground mt-1 flex-shrink-0" aria-hidden />}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="px-4 py-2 border-t border-border space-y-0.5">
            <p className="text-[10px] text-muted-foreground">{d.attribution}</p>
            <SourceLine source={d.source} retrievedAt={d.fetched_at} cached={d.cached} stale={d.stale} />
            <p className="text-[10px] text-muted-foreground">Headlines are shown as provided; no sentiment is inferred.</p>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default NewsFeed;

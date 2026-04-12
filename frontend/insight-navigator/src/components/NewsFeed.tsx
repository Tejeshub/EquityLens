import { NewsItem } from "@/data/dummyData";
import { ExternalLink, TrendingUp, TrendingDown, Minus } from "lucide-react";

const sentimentConfig = {
  positive: { icon: TrendingUp, color: "text-chart-up", bg: "bg-chart-up/8" },
  negative: { icon: TrendingDown, color: "text-chart-down", bg: "bg-chart-down/8" },
  neutral: { icon: Minus, color: "text-muted-foreground", bg: "bg-secondary" },
};

const NewsFeed = ({ news }: { news: NewsItem[] }) => (
  <div className="border border-border rounded-md bg-card">
    <div className="px-4 py-3 border-b border-border">
      <h3 className="text-sm font-semibold text-foreground">Latest News & Filings</h3>
    </div>
    <div className="divide-y divide-border max-h-[400px] overflow-y-auto scrollbar-thin">
      {news.map((item) => {
        const { icon: Icon, color, bg } = sentimentConfig[item.sentiment];
        return (
          <div key={item.id} className="px-4 py-3 hover:bg-secondary/40 transition-colors">
            <div className="flex items-start gap-2.5">
              <div className={`w-6 h-6 rounded ${bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                <Icon className={`w-3 h-3 ${color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-foreground leading-snug">{item.title}</p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.summary}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[10px] font-medium text-muted-foreground">{item.source}</span>
                  <span className="text-[10px] text-muted-foreground">·</span>
                  <span className="text-[10px] text-muted-foreground">{item.date}</span>
                  <ExternalLink className="w-3 h-3 text-muted-foreground ml-auto cursor-pointer hover:text-primary" />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

export default NewsFeed;

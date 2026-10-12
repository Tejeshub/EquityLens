import { useState } from "react";
import { Link, useParams } from "react-router";
import Layout from "@/components/Layout";
import CompanyOverview from "@/components/CompanyOverview";
import PriceChart from "@/components/PriceChart";
import NewsFeed from "@/components/NewsFeed";
import FinancialTable from "@/components/FinancialTable";
import ResearchPanel from "@/components/ResearchPanel";
import AskPanel from "@/components/AskPanel";
import { ErrorBox, LoadingBox } from "@/components/DataStates";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCompany, useQuote } from "@/hooks/queries";
import { useSource } from "@/hooks/useCapabilities";
import { ApiError } from "@/services/api";

const CompanyDetail = () => {
  const { id = "" } = useParams();
  const company = useCompany(id);
  const market = useSource("market_data");
  const quote = useQuote(id, company.isSuccess && market.state === "enabled");
  const [tab, setTab] = useState("overview");
  // Panels mount on first visit and then stay mounted so Ask / Research state survives tab switches.
  const [visited, setVisited] = useState<Set<string>>(() => new Set(["overview"]));
  const onTab = (v: string) => { setTab(v); setVisited((s) => (s.has(v) ? s : new Set(s).add(v))); };

  // 404 (unknown) and 422 (malformed id) both mean there is no such company.
  const notFound = company.error instanceof ApiError && (company.error.status === 404 || company.error.status === 422);
  // Companies are only valid if the backend resolved them; never substitute another company.
  const c = company.data;

  return (
    <Layout title={company.data?.name ?? (notFound ? "Company not found" : "Company")}>
      <div>
        <div className="container mx-auto px-4 py-5">
          {company.isPending ? (
            <LoadingBox label="Loading company…" />
          ) : notFound ? (
            <div className="border border-border rounded-md bg-card p-8 text-center" role="alert">
              <h1 className="text-lg font-bold text-foreground">Company not found</h1>
              <p className="text-xs text-muted-foreground mt-1">No company matches this link.</p>
              <Link to="/" className="text-xs text-primary hover:underline mt-3 inline-block">Search for a company</Link>
            </div>
          ) : company.isError ? (
            <div className="border border-border rounded-md bg-card"><ErrorBox error={company.error} onRetry={() => company.refetch()} title="Could not load this company" /></div>
          ) : c ? (
            <>
              <CompanyOverview company={c} quote={quote} />
              <Tabs key={c.id} value={tab} onValueChange={onTab} className="mt-5">
                <TabsList className="bg-secondary/60 border border-border">
                  <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
                  <TabsTrigger value="financials" className="text-xs">Financials</TabsTrigger>
                  <TabsTrigger value="research" className="text-xs">AI Research</TabsTrigger>
                  <TabsTrigger value="ask" className="text-xs">Ask</TabsTrigger>
                </TabsList>

                {([
                  ["overview", <div key="o" className="grid lg:grid-cols-3 gap-4"><div className="lg:col-span-2"><PriceChart companyId={c.id} /></div><div><NewsFeed companyId={c.id} /></div></div>],
                  ["financials", <FinancialTable key="f" companyId={c.id} />],
                  ["research", <ResearchPanel key="r" companyId={c.id} />],
                  ["ask", <AskPanel key="a" companyId={c.id} />],
                ] as [string, JSX.Element][]).map(([v, node]) => (
                  <TabsContent key={v} value={v} forceMount className="mt-4 data-[state=inactive]:hidden">
                    <div hidden={tab !== v} data-testid={`panel-${v}`}>{visited.has(v) ? node : null}</div>
                  </TabsContent>
                ))}
              </Tabs>
            </>
          ) : null}
        </div>
      </div>
    </Layout>
  );
};

export default CompanyDetail;

import { useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import NumText from "@/components/NumText";
import CompanyPicker from "@/components/CompanyPicker";
import { EmptyBox, ErrorBox, InfoBanner, LoadingBox, SourceLine } from "@/components/DataStates";
import { useSnapshot, useWatchlists } from "@/hooks/queries";
import { useSource } from "@/hooks/useCapabilities";
import { api, ApiError, describeError } from "@/services/api";
import { fmtPercent, fmtPrice, isNum, signClass } from "@/lib/format";
import { reasonText } from "@/lib/reasons";
import { Plus, Trash2, Play, Building2, X, Pencil, Check } from "lucide-react";
import type { Watchlist } from "@/types/api";

const DUP_COMPANY = "That company is already in this watchlist.";
const DUP_NAME = "You already have a watchlist with that name.";

/** `conflict` is what a 409 means for the action that failed (adding a company vs. creating / renaming a list). */
const mutationMessage = (e: unknown, conflict: string = DUP_COMPANY): string => {
  if (e instanceof ApiError) {
    if (e.status === 409) return conflict;
    if (e.status === 422 && e.code === "validation_error") {
      const first = e.fields.name ?? Object.values(e.fields)[0] ?? "the value is not valid";
      return `Could not save: ${first.charAt(0).toLowerCase()}${first.slice(1)}`.replace(/\.$/, "") + ".";
    }
    if (e.status === 422) return e.message;
  }
  return describeError(e);
};

const WatchlistCard = ({ wl }: { wl: Watchlist }) => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showPrices, setShowPrices] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(wl.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const market = useSource("market_data");
  const fundamentals = useSource("fundamentals");
  const pricesOn = market.state === "enabled";
  const snapshot = useSnapshot(wl.id, showPrices && pricesOn);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["watchlists"] });
    qc.invalidateQueries({ queryKey: ["snapshot", wl.id] });
  };
  const onError = (e: unknown) => setError(mutationMessage(e));
  const onNameError = (e: unknown) => setError(mutationMessage(e, DUP_NAME));

  const add = useMutation({ mutationFn: (cid: string) => api.watchlists.addItem(wl.id, cid), onSuccess: () => { setError(null); refresh(); }, onError });
  const removeItem = useMutation({ mutationFn: (cid: string) => api.watchlists.removeItem(wl.id, cid), onSuccess: () => { setError(null); refresh(); }, onError });
  const rename = useMutation({ mutationFn: (n: string) => api.watchlists.rename(wl.id, n), onSuccess: () => { setError(null); setRenaming(false); refresh(); }, onError: onNameError });
  const del = useMutation({ mutationFn: () => api.watchlists.remove(wl.id), onSuccess: () => { qc.invalidateQueries({ queryKey: ["watchlists"] }); }, onError });

  const busy = add.isPending || removeItem.isPending || rename.isPending || del.isPending;
  const rowById = new Map(snapshot.data?.rows.map((r) => [r.company_id, r]));
  const full = wl.items.length >= wl.max_items;

  return (
    <div className="border border-border rounded-md bg-card" data-testid={`watchlist-${wl.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-border">
        <div className="min-w-0">
          {renaming ? (
            <form onSubmit={(e) => { e.preventDefault(); if (name.trim() && !rename.isPending) rename.mutate(name.trim()); }} className="flex items-center gap-1.5">
              <input aria-label="Watchlist name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80}
                className="bg-card border border-border rounded-md px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-primary/30 text-foreground" />
              <button type="submit" aria-label="Save name" disabled={rename.isPending || !name.trim()} className="p-1 text-primary disabled:opacity-50"><Check className="w-4 h-4" /></button>
              <button type="button" aria-label="Cancel rename" onClick={() => { setRenaming(false); setName(wl.name); }} className="p-1 text-muted-foreground"><X className="w-4 h-4" /></button>
            </form>
          ) : (
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-semibold text-foreground truncate">{wl.name}</h3>
              <button aria-label={`Rename ${wl.name}`} onClick={() => setRenaming(true)} className="p-1 text-muted-foreground hover:text-foreground"><Pencil className="w-3 h-3" /></button>
            </div>
          )}
          <span className="text-[10px] text-muted-foreground">{wl.items.length}/{wl.max_items} companies</span>
        </div>
        <div className="flex items-center gap-2">
          {pricesOn && (
            <button onClick={() => setShowPrices((v) => !v)} aria-pressed={showPrices}
              className="px-3 py-1 rounded-md bg-secondary text-secondary-foreground text-[11px] font-medium hover:bg-accent">
              {showPrices ? "Hide prices" : "Show delayed prices"}
            </button>
          )}
          <button
            onClick={() => wl.items.length >= 2 && navigate(`/watchlist/${encodeURIComponent(wl.id)}/analysis`)}
            disabled={wl.items.length < 2 || fundamentals.state === "disabled"}
            title={fundamentals.state === "disabled" ? (fundamentals.reason ?? "Comparison is not available in this deployment") : wl.items.length < 2 ? "Add at least 2 companies to compare" : undefined}
            className="flex items-center gap-1 px-3 py-1 rounded-md bg-primary text-primary-foreground text-[11px] font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Play className="w-3 h-3" /> Compare
          </button>
          {confirmDelete ? (
            <span className="flex items-center gap-1 text-[11px]">
              <button onClick={() => del.mutate()} disabled={busy} className="px-2 py-1 rounded bg-destructive text-destructive-foreground">Confirm delete</button>
              <button onClick={() => setConfirmDelete(false)} className="px-2 py-1 rounded bg-secondary text-secondary-foreground">Cancel</button>
            </span>
          ) : (
            <button aria-label={`Delete ${wl.name}`} onClick={() => setConfirmDelete(true)} className="p-1 text-muted-foreground hover:text-destructive">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-3">
        {error && <div role="alert"><InfoBanner tone="warn">{error}</InfoBanner></div>}

        {showPrices && pricesOn && snapshot.isError && <ErrorBox error={snapshot.error} onRetry={() => snapshot.refetch()} title="Prices unavailable" />}
        {showPrices && pricesOn && snapshot.isPending && <p className="text-[11px] text-muted-foreground" role="status">Loading prices…</p>}

        {wl.items.length === 0 ? (
          <EmptyBox title="This watchlist is empty">Search below to add companies.</EmptyBox>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            {wl.items.map((c) => {
              const row = rowById.get(c.company_id);
              return (
                <div key={c.company_id} className="border border-border rounded-md p-2.5 relative hover:bg-secondary/30 transition-colors">
                  <button aria-label={`Remove ${c.name}`} disabled={busy} onClick={() => removeItem.mutate(c.company_id)}
                    className="absolute top-1 right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center disabled:opacity-50">
                    <X className="w-2.5 h-2.5" />
                  </button>
                  <button onClick={() => navigate(`/company/${encodeURIComponent(c.company_id)}`)} className="text-left w-full">
                    <Building2 className="w-4 h-4 text-muted-foreground mb-1" />
                    <p className="text-[11px] font-medium text-foreground truncate">{c.name}</p>
                    <p className="text-[10px] font-mono text-muted-foreground">{c.symbol}</p>
                  </button>
                  {showPrices && pricesOn && snapshot.data && (
                    row && row.status === "ok" ? (
                      <div className="mt-0.5">
                        <p className="text-[11px] font-mono text-foreground"><NumText text={fmtPrice(row.price)} /></p>
                        <p className={`text-[11px] font-mono ${signClass(row.change_percent)}`}>
                          <NumText text={fmtPercent(row.change_percent)} />
                        </p>
                        {row.stale && <span className="text-[9px] px-1 rounded bg-warning/15 text-warning font-medium">stale</span>}
                      </div>
                    ) : (
                      <p className="text-[10px] text-muted-foreground mt-0.5">{reasonText(row?.reason)}</p>
                    )
                  )}
                </div>
              );
            })}
          </div>
        )}

        {showPrices && pricesOn && snapshot.data && (
          <SourceLine label={market.caps?.market_data.provider ? `Delayed – ${market.caps.market_data.provider}` : "Delayed"} source={snapshot.data.source} note={snapshot.data.note}
            asOf={snapshot.data.rows.map((r) => r.as_of).filter(Boolean).sort().pop() ?? null}
            cached={snapshot.data.rows.some((r) => r.cached)} stale={snapshot.data.rows.some((r) => r.stale)} />
        )}

        {full ? (
          <p className="text-[11px] text-muted-foreground">This watchlist has reached its {wl.max_items}-company limit.</p>
        ) : (
          <CompanyPicker existingIds={wl.items.map((i) => i.company_id)} disabled={busy} onPick={(cid) => add.mutate(cid)} />
        )}
      </div>
    </div>
  );
};

const WatchlistsPage = () => {
  const qc = useQueryClient();
  const lists = useWatchlists();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: (name: string) => api.watchlists.create(name),
    onSuccess: () => { setShowCreate(false); setNewName(""); setCreateError(null); qc.invalidateQueries({ queryKey: ["watchlists"] }); },
    onError: (e) => setCreateError(mutationMessage(e, DUP_NAME)),
  });

  return (
    <Layout title="Watchlists">
      <div className="container mx-auto px-4 py-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-foreground">Watchlists</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Track companies and compare their reported financials</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
            <Plus className="w-3.5 h-3.5" /> New Watchlist
          </button>
        </div>

        {showCreate && (
          <form
            onSubmit={(e) => { e.preventDefault(); if (newName.trim() && !create.isPending) create.mutate(newName.trim()); }}
            className="border border-border rounded-md bg-card p-4 mb-5 animate-fade-in"
          >
            <h3 className="text-sm font-semibold text-foreground mb-3">Create Watchlist</h3>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label htmlFor="wl-name" className="metric-label mb-1 block">Name</label>
                <input id="wl-name" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={80}
                  className="w-full bg-card border border-border rounded-md px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary/30 text-foreground" placeholder="e.g., Chemicals picks" />
              </div>
              <button type="submit" disabled={create.isPending || !newName.trim()} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium disabled:opacity-50">Create</button>
              <button type="button" onClick={() => { setShowCreate(false); setCreateError(null); }} className="px-3 py-1.5 bg-secondary text-secondary-foreground rounded-md text-sm">Cancel</button>
            </div>
            {createError && <p role="alert" className="text-[11px] text-chart-down mt-2">{createError}</p>}
          </form>
        )}

        {lists.isPending ? (
          <LoadingBox label="Loading watchlists…" />
        ) : lists.isError ? (
          <div className="border border-border rounded-md bg-card"><ErrorBox error={lists.error} onRetry={() => lists.refetch()} title="Could not load watchlists" /></div>
        ) : lists.data.length === 0 ? (
          <div className="border border-border rounded-md bg-card"><EmptyBox title="No watchlists yet">Create a watchlist, then search for companies to add to it.</EmptyBox></div>
        ) : (
          <div className="space-y-5">{lists.data.map((wl) => <WatchlistCard key={wl.id} wl={wl} />)}</div>
        )}
      </div>
    </Layout>
  );
};

export default WatchlistsPage;

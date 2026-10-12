import { useState } from "react";
import { Loader2, Plus, Search } from "lucide-react";
import { useCompanySearch } from "@/hooks/queries";
import { ErrorBox } from "@/components/DataStates";

interface Props {
  existingIds: string[];
  disabled?: boolean;
  onPick: (companyId: string) => void;
}

/** Company search (debounced, abortable via react-query signal) used to add companies to a watchlist. */
const CompanyPicker = ({ existingIds, disabled, onPick }: Props) => {
  const [q, setQ] = useState("");
  const search = useCompanySearch(q);
  const items = search.data?.items ?? [];

  return (
    <div className="border border-dashed border-border rounded-md p-2.5">
      <div className="flex items-center gap-2">
        <Search className="w-3.5 h-3.5 text-muted-foreground" />
        <input aria-label="Search companies to add" maxLength={60} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a company to add…"
          className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none" />
        {(search.debouncing || search.isFetching) && search.hasCriteria && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" aria-label="Searching" />}
      </div>
      {search.hasCriteria && (
        <div className="mt-2 border-t border-border pt-1">
          {search.isError ? (
            <ErrorBox error={search.error} onRetry={() => search.refetch()} title="Search failed" />
          ) : search.debouncing || search.isPending ? (
            <p className="text-[11px] text-muted-foreground py-2">Searching…</p>
          ) : items.length === 0 ? (
            <p className="text-[11px] text-muted-foreground py-2">No companies found</p>
          ) : (
            <ul className="max-h-48 overflow-y-auto scrollbar-thin">
              {items.map((c) => {
                const already = existingIds.includes(c.id);
                return (
                  <li key={c.id} className="flex items-center gap-2 py-1.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground truncate">{c.name}</p>
                      <p className="text-[10px] text-muted-foreground">{c.primary_symbol} · {c.exchange}</p>
                    </div>
                    <button
                      disabled={disabled || already}
                      onClick={() => onPick(c.id)}
                      aria-label={already ? `${c.name} already added` : `Add ${c.name}`}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-secondary text-secondary-foreground text-[11px] hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-3 h-3" /> {already ? "Added" : "Add"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default CompanyPicker;

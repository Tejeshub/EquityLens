import { useState, useRef, useEffect, useId, type KeyboardEvent } from "react";
import { Search, X, Filter, Building2, Tag, BarChart, Loader2 } from "lucide-react";
import { useNavigate } from "react-router";
import { useCompanySearch } from "@/hooks/queries";
import { useSource } from "@/hooks/useCapabilities";
import { ErrorBox } from "@/components/DataStates";
import type { Segment } from "@/types/api";

export const SEARCH_MAX_LEN = 60;
export const SECTOR_MAX_LEN = 120;

const segments: { label: string; value: Segment | undefined }[] = [
  { label: "All", value: undefined },
  { label: "Small Cap", value: "small" },
  { label: "Mid Cap", value: "mid" },
  { label: "Large Cap", value: "large" },
];

/** ARIA 1.2 combobox with a listbox popup (editable, list autocomplete, focus stays on the input). */
const SearchBar = () => {
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState<Segment | undefined>(undefined);
  const [sector, setSector] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [active, setActive] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const uid = useId();
  const listId = `${uid}-listbox`;
  const optId = (i: number) => `${uid}-option-${i}`;

  const segmentsOn = useSource("index_segments").state === "enabled";
  const search = useCompanySearch(query, { sector, segment });
  const items = search.data?.items ?? [];
  const loading = search.debouncing || search.isFetching;
  const popupOpen = showResults && search.hasCriteria;
  const settled = popupOpen && !search.isError && !search.debouncing && !(search.isPending && search.isFetching);
  const listOpen = settled && items.length > 0;

  useEffect(() => { setActive(-1); }, [query, sector, segment, search.data]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setShowResults(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const open = (id: string) => { navigate(`/company/${encodeURIComponent(id)}`); setShowResults(false); };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const n = items.length;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!popupOpen) { setShowResults(true); break; }
        if (n) setActive((a) => (a + 1) % n);
        break;
      case "ArrowUp":
        e.preventDefault();
        if (!popupOpen) { setShowResults(true); break; }
        if (n) setActive((a) => (a <= 0 ? n - 1 : a - 1));
        break;
      case "Home":
        if (listOpen) { e.preventDefault(); setActive(0); }
        break;
      case "End":
        if (listOpen) { e.preventDefault(); setActive(n - 1); }
        break;
      case "Enter":
        if (listOpen && active >= 0 && items[active]) { e.preventDefault(); open(items[active].id); }
        break;
      case "Escape":
        if (popupOpen) { e.preventDefault(); setShowResults(false); setActive(-1); }
        else if (query) { e.preventDefault(); setQuery(""); }
        break;
    }
  };

  const announcement = !popupOpen ? ""
    : search.isError ? "Search failed"
    : !settled ? "Searching"
    : items.length === 0 ? "No results"
    : `${items.length} ${items.length === 1 ? "result" : "results"}`;

  return (
    <div ref={containerRef} className="w-full max-w-2xl mx-auto relative text-left">
      <div className="border border-input rounded-md flex items-center gap-2 bg-card shadow-pop focus-within:border-foreground focus-within:ring-2 focus-within:ring-foreground/10 transition-all">
        <Search className="w-4 h-4 text-muted-foreground ml-4" aria-hidden />
        <input
          ref={inputRef}
          role="combobox"
          aria-label="Search companies"
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-expanded={listOpen}
          aria-controls={listOpen ? listId : undefined}
          aria-activedescendant={listOpen && active >= 0 ? optId(active) : undefined}
          autoComplete="off"
          maxLength={SEARCH_MAX_LEN}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setShowResults(true); }}
          onFocus={() => setShowResults(true)}
          onKeyDown={onKeyDown}
          placeholder="Search by company name or NSE symbol..."
          className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground outline-none text-base py-4"
        />
        {loading && search.hasCriteria && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" aria-label="Searching" />}
        {query && (
          <button type="button" aria-label="Clear search" onClick={() => { setQuery(""); inputRef.current?.focus(); }} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        )}
        {segmentsOn && (
          <button
            type="button"
            aria-label="Toggle filters"
            aria-expanded={showFilters}
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2.5 mr-2 rounded-full transition-colors ${showFilters ? "bg-peach text-sienna" : "text-muted-foreground hover:text-foreground hover:bg-peach/50"}`}
          >
            <Filter className="w-4 h-4" />
          </button>
        )}
      </div>

      <div role="status" aria-live="polite" className="sr-only">{announcement}</div>

      {segmentsOn && showFilters && (
        <div className="border border-border rounded-lg bg-card shadow-pop mt-2 p-4 animate-fade-in">
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="metric-label mb-1.5 flex items-center gap-1"><BarChart className="w-3 h-3" /> Market Cap</p>
              <div className="flex gap-1">
                {segments.map((s) => (
                  <button type="button" key={s.label} aria-pressed={segment === s.value} onClick={() => { setSegment(s.value); setShowResults(true); }}
                    className={`px-3.5 py-1.5 rounded-full text-xs transition-colors ${segment === s.value ? "bg-peach text-sienna" : "bg-secondary text-secondary-foreground hover:bg-peach/50"}`}
                  >{s.label}</button>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="sector-filter" className="metric-label mb-1.5 flex items-center gap-1"><Tag className="w-3 h-3" /> Sector</label>
              <input id="sector-filter" value={sector} maxLength={SECTOR_MAX_LEN} onChange={(e) => { setSector(e.target.value); setShowResults(true); }} placeholder="e.g. Chemicals"
                className="bg-card border border-input rounded-full px-4 py-1.5 text-xs outline-none focus:border-foreground focus:ring-2 focus:ring-foreground/10 text-foreground" />
            </div>
          </div>
        </div>
      )}

      {popupOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card rounded-md shadow-float max-h-80 overflow-y-auto scrollbar-thin z-50 animate-fade-in">
          {search.isError ? (
            <ErrorBox error={search.error} onRetry={() => search.refetch()} title="Search failed" />
          ) : !settled ? (
            <div className="p-6 text-center text-muted-foreground text-sm">Searching…</div>
          ) : items.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">No companies found</div>
          ) : (
            <>
              <ul id={listId} role="listbox" aria-label="Search results">
                {items.map((c, i) => (
                  <li
                    key={c.id}
                    id={optId(i)}
                    role="option"
                    aria-selected={i === active}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => open(c.id)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors text-left border-b border-border/50 last:border-0 ${i === active ? "bg-peach/60" : "hover:bg-peach/30"}`}
                  >
                    <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center">
                      <Building2 className="w-4 h-4 text-muted-foreground" aria-hidden />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.primary_symbol} · {c.exchange}{c.sector ? ` · ${c.sector}` : ""}</p>
                    </div>
                  </li>
                ))}
              </ul>
              {search.data && search.data.total > items.length && (
                <p className="px-4 py-2 text-[11px] text-muted-foreground">Showing {items.length} of {search.data.total}. Refine your search to narrow results.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBar;

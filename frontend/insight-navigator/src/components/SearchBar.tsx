import { useState, useRef, useEffect } from "react";
import { Search, X, Filter, Building2, Tag, BarChart } from "lucide-react";
import { companies } from "@/data/dummyData";
import { useNavigate } from "react-router-dom";

const caps = ["All", "Small Cap", "Mid Cap", "Large Cap"];
const sectors = ["All", "Chemicals", "Pharma", "IT", "Auto", "FMCG"];

const SearchBar = () => {
  const [query, setQuery] = useState("");
  const [selectedCap, setSelectedCap] = useState("All");
  const [selectedSector, setSelectedSector] = useState("All");
  const [showFilters, setShowFilters] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const filtered = companies.filter((c) => {
    const matchesQuery = !query || c.name.toLowerCase().includes(query.toLowerCase()) || c.ticker.toLowerCase().includes(query.toLowerCase()) || c.sector.toLowerCase().includes(query.toLowerCase());
    const matchesCap = selectedCap === "All" || c.cap === selectedCap;
    const matchesSector = selectedSector === "All" || c.sector === selectedSector;
    return matchesQuery && matchesCap && matchesSector;
  });

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={containerRef} className="w-full max-w-xl mx-auto relative">
      <div className="border border-border rounded-md flex items-center gap-2 bg-card shadow-sm focus-within:border-primary/40 focus-within:shadow-[0_0_0_2px_hsl(var(--primary)/0.08)] transition-all">
        <Search className="w-4 h-4 text-muted-foreground ml-3" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setShowResults(true); }}
          onFocus={() => setShowResults(true)}
          placeholder="Search by name, ticker, or sector..."
          className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground outline-none text-sm py-2.5"
        />
        {query && (
          <button onClick={() => setQuery("")} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`p-2 mr-1 rounded transition-colors ${showFilters ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Filter className="w-4 h-4" />
        </button>
      </div>

      {showFilters && (
        <div className="border border-border rounded-md bg-card shadow-sm mt-1.5 p-3 animate-fade-in">
          <div className="flex gap-6">
            <div>
              <p className="metric-label mb-1.5 flex items-center gap-1"><BarChart className="w-3 h-3" /> Market Cap</p>
              <div className="flex gap-1">
                {caps.map((cap) => (
                  <button key={cap} onClick={() => setSelectedCap(cap)}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${selectedCap === cap ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent"}`}
                  >{cap}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="metric-label mb-1.5 flex items-center gap-1"><Tag className="w-3 h-3" /> Sector</p>
              <div className="flex gap-1">
                {sectors.map((s) => (
                  <button key={s} onClick={() => setSelectedSector(s)}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${selectedSector === s ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent"}`}
                  >{s}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showResults && (query || selectedCap !== "All" || selectedSector !== "All") && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-lg max-h-80 overflow-y-auto scrollbar-thin z-50 animate-fade-in">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">No companies found</div>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => { navigate(`/company/${c.id}`); setShowResults(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/60 transition-colors text-left border-b border-border/50 last:border-0"
              >
                <div className="w-8 h-8 rounded bg-secondary flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.ticker} · {c.sector}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono text-foreground">₹{c.price.toLocaleString()}</p>
                  <p className={`text-xs font-mono ${c.changePercent >= 0 ? "text-chart-up" : "text-chart-down"}`}>
                    {c.changePercent >= 0 ? "+" : ""}{c.changePercent.toFixed(2)}%
                  </p>
                </div>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${c.cap === "Small Cap" ? "bg-primary/8 text-primary" : c.cap === "Mid Cap" ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground"}`}>
                  {c.cap}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBar;

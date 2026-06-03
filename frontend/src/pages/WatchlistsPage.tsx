import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { watchlists, companies, Watchlist } from "@/data/dummyData";
import { Plus, Trash2, Play, Building2, X } from "lucide-react";

const caps = ["Small Cap", "Mid Cap"];
const sectors = ["Chemicals"];
const timeOptions = ["Q3 FY26 (Latest)", "Q2 FY26", "Q1 FY26", "Q4 FY25", "Annual FY25", "Past Performance"];

const WatchlistsPage = () => {
  const navigate = useNavigate();
  const [lists, setLists] = useState<Watchlist[]>(watchlists);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSector, setNewSector] = useState("Chemicals");
  const [newCap, setNewCap] = useState("Mid Cap");
  const [selectedTime, setSelectedTime] = useState<Record<string, string>>({});
  const [selectedMetric, setSelectedMetric] = useState<Record<string, string>>({});

  const handleCreate = () => {
    if (!newName) return;
    setLists([...lists, { id: `w${lists.length + 1}`, name: newName, sector: newSector, cap: newCap, companies: [], createdAt: new Date().toISOString().split("T")[0] }]);
    setShowCreate(false);
    setNewName("");
  };

  const handleAddCompany = (wlId: string, cId: string) => {
    setLists(lists.map((w) => w.id === wlId && !w.companies.includes(cId) && w.companies.length < 6 ? { ...w, companies: [...w.companies, cId] } : w));
  };

  const handleRemoveCompany = (wlId: string, cId: string) => {
    setLists(lists.map((w) => w.id === wlId ? { ...w, companies: w.companies.filter((c) => c !== cId) } : w));
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-12 container mx-auto px-4 py-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-foreground">Watchlists</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Compare companies across sectors & caps</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
            <Plus className="w-3.5 h-3.5" /> New Watchlist
          </button>
        </div>

        {showCreate && (
          <div className="border border-border rounded-md bg-card p-4 mb-5 animate-fade-in">
            <h3 className="text-sm font-semibold text-foreground mb-3">Create Watchlist</h3>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="metric-label mb-1 block">Name</label>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full bg-card border border-border rounded-md px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary/30 text-foreground" placeholder="e.g., Pharma Small Cap" />
              </div>
              <div>
                <label className="metric-label mb-1 block">Sector</label>
                <select value={newSector} onChange={(e) => setNewSector(e.target.value)} className="bg-card border border-border rounded-md px-3 py-1.5 text-sm text-foreground">
                  {sectors.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="metric-label mb-1 block">Cap</label>
                <select value={newCap} onChange={(e) => setNewCap(e.target.value)} className="bg-card border border-border rounded-md px-3 py-1.5 text-sm text-foreground">
                  {caps.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <button onClick={handleCreate} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium">Create</button>
              <button onClick={() => setShowCreate(false)} className="px-3 py-1.5 bg-secondary text-secondary-foreground rounded-md text-sm">Cancel</button>
            </div>
          </div>
        )}

        <div className="space-y-5">
          {lists.map((wl) => {
            const wlCompanies = companies.filter((c) => wl.companies.includes(c.id));
            const available = companies.filter((c) => c.sector === wl.sector && c.cap === wl.cap && !wl.companies.includes(c.id));

            return (
              <div key={wl.id} className="border border-border rounded-md bg-card">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{wl.name}</h3>
                    <div className="flex gap-1.5 mt-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">{wl.sector}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/8 text-primary">{wl.cap}</span>
                      <span className="text-[10px] text-muted-foreground">{wlCompanies.length}/6</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select value={selectedTime[wl.id] || timeOptions[0]} onChange={(e) => setSelectedTime({ ...selectedTime, [wl.id]: e.target.value })} className="bg-card border border-border rounded-md px-2 py-1 text-[11px] text-foreground">
                      {timeOptions.map((t) => <option key={t}>{t}</option>)}
                    </select>
                    <select value={selectedMetric[wl.id] || "All Metrics"} onChange={(e) => setSelectedMetric({ ...selectedMetric, [wl.id]: e.target.value })} className="bg-card border border-border rounded-md px-2 py-1 text-[11px] text-foreground">
                      {["All Metrics", "P/E Ratio", "ROE", "ROCE", "D/E Ratio", "Promoter Holding"].map((m) => <option key={m}>{m}</option>)}
                    </select>
                    <button
                      onClick={() => wlCompanies.length >= 2 && navigate(`/watchlist/${wl.id}/analysis`)}
                      disabled={wlCompanies.length < 2}
                      className="flex items-center gap-1 px-3 py-1 rounded-md bg-primary text-primary-foreground text-[11px] font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <Play className="w-3 h-3" /> Analyze
                    </button>
                    <button onClick={() => setLists(lists.filter((w) => w.id !== wl.id))} className="p-1 text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="p-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                    {wlCompanies.map((c) => (
                      <div key={c.id} className="border border-border rounded-md p-2.5 relative group cursor-pointer hover:bg-secondary/30 transition-colors" onClick={() => navigate(`/company/${c.id}`)}>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRemoveCompany(wl.id, c.id); }}
                          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                        <Building2 className="w-4 h-4 text-muted-foreground mb-1" />
                        <p className="text-[11px] font-medium text-foreground truncate">{c.name}</p>
                        <p className="text-[10px] font-mono text-muted-foreground">{c.ticker}</p>
                        <p className={`text-[11px] font-mono mt-0.5 ${c.changePercent >= 0 ? "text-chart-up" : "text-chart-down"}`}>
                          {c.changePercent >= 0 ? "+" : ""}{c.changePercent.toFixed(2)}%
                        </p>
                      </div>
                    ))}
                    {wlCompanies.length < 6 && available.length > 0 && (
                      <div className="border border-dashed border-border rounded-md p-2.5 flex items-center justify-center">
                        <select
                          onChange={(e) => { if (e.target.value) handleAddCompany(wl.id, e.target.value); e.target.value = ""; }}
                          className="bg-transparent text-[11px] text-muted-foreground outline-none cursor-pointer w-full"
                          defaultValue=""
                        >
                          <option value="" disabled>+ Add company</option>
                          {available.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WatchlistsPage;

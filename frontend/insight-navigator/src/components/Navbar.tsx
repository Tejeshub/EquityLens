import { Link, useLocation } from "react-router-dom";
import { Search, List, TrendingUp } from "lucide-react";

const Navbar = () => {
  const location = useLocation();

  const links = [
    { to: "/", icon: Search, label: "Discover" },
    { to: "/watchlists", icon: List, label: "Watchlists" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border">
      <div className="container mx-auto flex items-center justify-between h-12 px-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-primary flex items-center justify-center">
            <TrendingUp className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
          <span className="text-base font-bold text-foreground">EquityLens</span>
          <span className="text-[9px] font-mono font-medium uppercase tracking-widest text-muted-foreground border border-border rounded px-1 py-0.5">AI</span>
        </Link>

        <div className="flex items-center gap-0.5">
          {links.map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[13px] font-medium transition-colors ${
                location.pathname === to
                  ? "text-primary bg-primary/5"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

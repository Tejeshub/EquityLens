import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { Search, List, TrendingUp, LogOut, User as UserIcon, ChevronDown } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, logoutAll } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const links = [
    { to: "/", icon: Search, label: "Discover" },
    { to: "/watchlists", icon: List, label: "Watchlists" },
  ];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const signOut = async (everywhere: boolean) => {
    setOpen(false);
    // On failure the context toasts and the user stays signed in; only navigate away when the session really ended.
    const ended = await (everywhere ? logoutAll() : logout());
    if (ended) navigate("/login", { replace: true });
  };

  const itemCls = "w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-foreground hover:bg-secondary";

  return (
    <nav aria-label="Main" className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border">
      <div className="container mx-auto flex items-center justify-between h-12 px-4">
        <Link to="/" className="flex items-center gap-2" aria-label="EquityLens home">
          <div className="w-7 h-7 rounded bg-primary flex items-center justify-center">
            <TrendingUp className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
          <span className="text-base font-bold text-foreground">EquityLens</span>
          <span className="hidden sm:inline text-[9px] font-mono font-medium uppercase tracking-widest text-muted-foreground border border-border rounded px-1 py-0.5">AI</span>
        </Link>

        <div className="flex items-center gap-0.5">
          {links.map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              aria-label={label}
              aria-current={location.pathname === to ? "page" : undefined}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded text-[13px] font-medium transition-colors ${
                location.pathname === to
                  ? "text-primary bg-primary/5"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4 sm:w-3.5 sm:h-3.5" aria-hidden />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          ))}
          {user && (
            <div ref={menuRef} className="relative ml-1 sm:ml-3 pl-1 sm:pl-3 border-l border-border">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={`Account menu for ${user.email}`}
                onClick={() => setOpen((v) => !v)}
                className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-secondary"
              >
                <UserIcon className="w-4 h-4 sm:w-3.5 sm:h-3.5" aria-hidden />
                <span className="hidden md:inline max-w-[180px] truncate" title={user.email}>{user.email}</span>
                <ChevronDown className="w-3 h-3" aria-hidden />
              </button>
              {open && (
                <div role="menu" aria-label="Account" className="absolute right-0 top-full mt-1 w-56 bg-card border border-border rounded-md shadow-lg py-1">
                  <p className="px-3 py-1.5 text-[11px] text-muted-foreground truncate border-b border-border" title={user.email}>{user.email}</p>
                  <button role="menuitem" type="button" onClick={() => signOut(false)} className={itemCls}>
                    <LogOut className="w-3.5 h-3.5" aria-hidden /> Log out
                  </button>
                  <button role="menuitem" type="button" onClick={() => signOut(true)} className={itemCls}>
                    <LogOut className="w-3.5 h-3.5" aria-hidden /> Sign out everywhere
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

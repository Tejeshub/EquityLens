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

  const itemCls = "w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-peach/40 rounded-sm transition-colors";

  return (
    <nav aria-label="Main" className="fixed top-0 left-0 right-0 z-50 bg-background/85 backdrop-blur-md">
      <div className="container mx-auto flex items-center justify-between h-16 px-4">
        <Link to="/" className="flex items-center gap-2" aria-label="EquityLens home">
          <div className="w-8 h-8 rounded-full bg-sienna flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-peach" />
          </div>
          <span className="font-serif text-xl tracking-tight text-foreground">EquityLens</span>
          <span className="hidden sm:inline text-[10px] font-medium uppercase tracking-widest text-muted-foreground border border-border rounded-full px-2 py-0.5">AI</span>
        </Link>

        <div className="flex items-center gap-1">
          {links.map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              aria-label={label}
              aria-current={location.pathname === to ? "page" : undefined}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-full text-sm transition-colors ${
                location.pathname === to
                  ? "text-sienna bg-peach"
                  : "text-muted-foreground hover:text-foreground hover:bg-peach/40"
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
                className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm text-muted-foreground hover:text-foreground hover:bg-peach/40 transition-colors"
              >
                <UserIcon className="w-4 h-4 sm:w-3.5 sm:h-3.5" aria-hidden />
                <span className="hidden md:inline max-w-[180px] truncate" title={user.email}>{user.email}</span>
                <ChevronDown className="w-3 h-3" aria-hidden />
              </button>
              {open && (
                <div role="menu" aria-label="Account" className="absolute right-0 top-full mt-1 w-60 bg-card rounded-[20px] shadow-float p-1.5">
                  <p className="px-3 py-2 text-xs text-muted-foreground truncate border-b border-border mb-1" title={user.email}>{user.email}</p>
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

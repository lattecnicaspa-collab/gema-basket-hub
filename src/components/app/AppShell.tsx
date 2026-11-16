import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronsLeft, ChevronsRight, LogOut, Menu, LayoutDashboard, CalendarClock, Handshake, Ticket, CalendarDays, Wallet, FileText, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useRoles, ROLE_LABEL } from "@/lib/auth";
import { NAV, type NavGroup } from "@/lib/nav";
import { useClub } from "@/hooks/useClub";
import { ClubLogo } from "./Logo";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

function NavTree({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const { hasAny } = useRoles();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState<Record<string, boolean>>({ Sponsor: true, "Match day": true });
  const items = NAV.filter((g) => hasAny(g.roles));
  const leafHref = (to: string, params?: Record<string, string>) => (params ? to.replace("$slug", params.slug) : to);
  const linkCls = (active: boolean) =>
    cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
      active ? "bg-nav-active text-nav-foreground shadow-inner" : "text-nav-muted hover:bg-nav-active/60 hover:text-nav-foreground");

  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((g: NavGroup) => {
        const Icon = g.icon;
        const kids = g.children?.filter((c) => hasAny(c.roles));
        if (!kids?.length) {
          const href = g.to!;
          const active = path === href;
          return (
            <Link key={g.label} to={href as never} onClick={onNavigate} className={linkCls(active)} title={g.label}>
              <Icon className="h-4 w-4 shrink-0" />{!collapsed && <span>{g.label}</span>}
              {active && !collapsed && <span className="ml-auto h-2 w-2 rounded-full bg-brand-red" />}
            </Link>
          );
        }
        const anyActive = kids.some((c) => path === leafHref(c.to, c.params));
        const isOpen = open[g.label] ?? anyActive;
        if (collapsed) {
          const first = kids[0];
          return (
            <Link key={g.label} to={first.to as never} params={first.params as never} className={linkCls(anyActive)} title={g.label}>
              <Icon className="h-4 w-4" />
            </Link>
          );
        }
        return (
          <div key={g.label}>
            <button onClick={() => setOpen({ ...open, [g.label]: !isOpen })} className={cn(linkCls(false), "w-full", anyActive && "text-nav-foreground")}>
              <Icon className="h-4 w-4" /><span>{g.label}</span>
              <ChevronDown className={cn("ml-auto h-4 w-4 transition-transform", isOpen && "rotate-180")} />
            </button>
            {isOpen && (
              <div className="ml-5 mt-0.5 flex flex-col border-l border-sidebar-border pl-2">
                {kids.map((c) => {
                  const active = path === leafHref(c.to, c.params);
                  return (
                    <Link key={c.label} to={c.to as never} params={c.params as never} onClick={onNavigate}
                      className={cn("rounded-md px-3 py-1.5 text-sm", active ? "bg-brand-red text-accent-foreground" : "text-nav-muted hover:text-nav-foreground")}>
                      {c.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

function UserBox({ collapsed }: { collapsed?: boolean }) {
  const { session } = useAuth();
  const { roles } = useRoles();
  const qc = useQueryClient();
  const navigate = useNavigate();
  async function signOut() {
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  return (
    <div className="border-t border-sidebar-border p-3">
      {!collapsed && (
        <div className="mb-2 text-xs text-nav-muted">
          <div className="truncate font-semibold text-nav-foreground">{session?.user.email}</div>
          <div className="truncate">{roles.map((r) => ROLE_LABEL[r]).join(", ") || "Nessun ruolo assegnato"}</div>
        </div>
      )}
      <button onClick={signOut} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-nav-muted hover:bg-nav-active hover:text-nav-foreground">
        <LogOut className="h-4 w-4" />{!collapsed && "Esci"}
      </button>
    </div>
  );
}

function Brand({ collapsed }: { collapsed?: boolean }) {
  const { data } = useClub();
  return (
    <div className="flex items-center gap-3 px-3 py-4">
      <ClubLogo className="h-10 w-10 shrink-0" />
      {!collapsed && (
        <div className="leading-tight">
          <div className="font-display text-xl font-extrabold tracking-wide text-nav-foreground">GEMA<span className="text-brand-red">360</span></div>
          <div className="text-[11px] text-nav-muted">{data?.name ?? "La T Tecnica Gema Montecatini"}</div>
        </div>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: club } = useClub();
  const { hasAny } = useRoles();
  const family = !hasAny(["direttivo", "segreteria", "tesoriere", "direttore_sportivo", "responsabile_commerciale", "ufficio_stampa", "cassiere", "steward", "allenatore", "dirigente_accompagnatore", "sponsor"]);
  const bottom = family
    ? [
        { to: "/dashboard", label: "Home", icon: LayoutDashboard },
        { to: "/modulo/calendario", label: "Calendario", icon: CalendarDays },
        { to: "/dashboard", label: "Pagamenti", icon: Wallet },
        { to: "/info/documenti", label: "Documenti", icon: FileText },
        { to: "/modulo/bacheca", label: "Messaggi", icon: MessageSquare },
      ]
    : [
        { to: "/dashboard", label: "Home", icon: LayoutDashboard },
        { to: "/scadenzario", label: "Scadenze", icon: CalendarClock },
        { to: "/sponsor", label: "Sponsor", icon: Handshake },
        { to: "/matchday", label: "Match day", icon: Ticket },
      ];

  return (
    <div className="flex min-h-screen">
      <aside className={cn("no-print sticky top-0 hidden h-screen shrink-0 flex-col bg-nav text-nav-foreground transition-all lg:flex", collapsed ? "w-[68px]" : "w-64")}>
        <Brand collapsed={collapsed} />
        <div className="h-1 bg-stripe" />
        <div className="flex-1 overflow-y-auto p-2">
          <NavTree collapsed={collapsed} />
        </div>
        <button onClick={() => setCollapsed(!collapsed)} className="mx-2 mb-1 flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-nav-muted hover:text-nav-foreground">
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <><ChevronsLeft className="h-4 w-4" />Comprimi</>}
        </button>
        <UserBox collapsed={collapsed} />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="flex w-72 flex-col border-0 bg-nav p-0 text-nav-foreground">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <Brand />
          <div className="h-1 bg-stripe" />
          <div className="flex-1 overflow-y-auto p-2"><NavTree onNavigate={() => setMobileOpen(false)} /></div>
          <UserBox />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex items-center gap-3 bg-nav px-4 py-3 text-nav-foreground lg:hidden">
          <button onClick={() => setMobileOpen(true)} aria-label="Apri menu"><Menu className="h-6 w-6" /></button>
          <ClubLogo className="h-8 w-8" />
          <span className="font-display text-lg font-extrabold">GEMA<span className="text-brand-red">360</span></span>
        </header>
        <main className="flex-1 px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:pb-8">{children}</main>
        <footer className="no-print hidden border-t bg-card px-8 py-3 text-xs text-muted-foreground lg:flex lg:justify-between">
          <span>{club?.footer_text ?? "Main sponsor La T Tecnica S.p.A."}</span>
          <span>GEMA360 · {club?.name}</span>
        </footer>
        <nav className="no-print fixed inset-x-0 bottom-0 z-30 grid border-t bg-card lg:hidden" style={{ gridTemplateColumns: `repeat(${bottom.length + (family ? 0 : 1)}, 1fr)` }}>
          {bottom.map((b) => (
            <Link key={b.label} to={b.to as never} className="flex flex-col items-center gap-0.5 py-2 text-[11px] text-muted-foreground" activeProps={{ className: "text-accent" }}>
              <b.icon className="h-5 w-5" />{b.label}
            </Link>
          ))}
          {!family && (
            <button onClick={() => setMobileOpen(true)} className="flex flex-col items-center gap-0.5 py-2 text-[11px] text-muted-foreground">
              <Menu className="h-5 w-5" />Menu
            </button>
          )}
        </nav>
      </div>
    </div>
  );
}

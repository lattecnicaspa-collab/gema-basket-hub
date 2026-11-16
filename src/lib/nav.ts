import type { Role } from "./auth";
import {
  LayoutDashboard, CalendarClock, Handshake, Ticket, Users, Trophy, ClipboardList, HeartPulse,
  CalendarDays, Wallet, Megaphone, FileLock2, ShieldAlert, Package, Landmark, BarChart3, Settings, Store,
} from "lucide-react";

export type NavLeaf = { label: string; to: string; params?: Record<string, string>; roles?: Role[] };
export type NavGroup = { label: string; icon: typeof LayoutDashboard; to?: string; roles?: Role[]; children?: NavLeaf[] };

const STAFF: Role[] = ["direttivo", "segreteria", "tesoriere", "direttore_sportivo", "responsabile_commerciale", "ufficio_stampa"];
const SPONSOR: Role[] = ["direttivo", "responsabile_commerciale", "tesoriere", "ufficio_stampa"];
const MD: Role[] = ["direttivo", "segreteria", "tesoriere", "responsabile_commerciale"];
const SPORT: Role[] = ["direttivo", "segreteria", "direttore_sportivo", "allenatore", "dirigente_accompagnatore"];
const m = (slug: string, label: string, roles?: Role[]): NavLeaf => ({ label, to: "/modulo/$slug", params: { slug }, roles });

export const NAV: NavGroup[] = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/dashboard" },
  { label: "Scadenzario", icon: CalendarClock, to: "/scadenzario", roles: STAFF },
  {
    label: "Sponsor", icon: Handshake, roles: SPONSOR, children: [
      { label: "Cruscotto", to: "/sponsor" }, { label: "CRM", to: "/sponsor/crm" },
      { label: "Contratti", to: "/sponsor/contratti" }, { label: "Spazi vendibili", to: "/sponsor/spazi" },
      { label: "Controprestazioni", to: "/sponsor/controprestazioni" }, { label: "Report", to: "/sponsor/report" },
    ],
  },
  {
    label: "Match day", icon: Ticket, roles: [...MD, "cassiere", "steward", "ufficio_stampa"], children: [
      { label: "Partite", to: "/matchday", roles: [...MD, "ufficio_stampa"] },
      { label: "Botteghino / Cassa", to: "/matchday/cassa", roles: ["tesoriere", "cassiere", "segreteria"] },
      { label: "Abbonamenti", to: "/matchday/abbonamenti", roles: MD },
      { label: "Accrediti", to: "/matchday/accrediti", roles: [...MD, "ufficio_stampa"] },
      { label: "Controllo accessi", to: "/matchday/accessi", roles: ["steward", "segreteria", "direttivo"] },
      { label: "Report stagione", to: "/matchday/report", roles: MD },
    ],
  },
  { label: "Portale sponsor", icon: Store, to: "/portale-sponsor", roles: ["sponsor"] },
  {
    label: "Anagrafica", icon: Users, roles: ["direttivo", "segreteria", "tesoriere"], children: [
      m("persone", "Persone"), m("soci", "Libro soci"),
    ],
  },
  {
    label: "Stagione", icon: Trophy, roles: SPORT, children: [
      m("squadre", "Squadre"), m("rose", "Rose"), m("tesseramenti", "Tesseramenti FIP"),
    ],
  },
  { label: "Iscrizioni", icon: ClipboardList, to: "/modulo/$slug", roles: ["direttivo", "segreteria"], children: [m("iscrizioni", "Coda approvazione")] },
  {
    label: "Sanità", icon: HeartPulse, roles: ["direttivo", "segreteria", "direttore_sportivo"], children: [
      m("certificati", "Certificati"), m("infortuni", "Infortuni"), m("dae", "DAE / BLSD"),
    ],
  },
  { label: "Attività", icon: CalendarDays, roles: SPORT, children: [m("calendario", "Calendario")] },
  { label: "Economia", icon: Wallet, roles: ["direttivo", "tesoriere"], children: [m("prima-nota", "Prima nota")] },
  { label: "Comunicazioni", icon: Megaphone, roles: [...STAFF, "allenatore", "genitore", "atleta"], children: [m("bacheca", "Bacheca")] },
  { label: "Documenti e privacy", icon: FileLock2, to: "/info/documenti", roles: ["direttivo", "segreteria"] },
  { label: "Safeguarding", icon: ShieldAlert, to: "/info/safeguarding", roles: ["responsabile_safeguarding", "direttivo"] },
  { label: "Magazzino", icon: Package, roles: ["direttivo", "segreteria"], children: [m("magazzino", "Articoli")] },
  { label: "Governance", icon: Landmark, roles: ["direttivo", "segreteria"], children: [m("assemblee", "Assemblee e consigli")] },
  { label: "Report", icon: BarChart3, to: "/matchday/report", roles: ["direttivo", "tesoriere"] },
  { label: "Impostazioni", icon: Settings, to: "/impostazioni", roles: ["superadmin"] },
];

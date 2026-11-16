import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Urgency } from "@/lib/format";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="mb-1 h-1 w-12 rounded-full bg-stripe" />
        <h1 className="text-3xl font-bold uppercase text-primary sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, tone = "default", icon }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "default" | "red" | "green" | "orange" | "navy"; icon?: ReactNode }) {
  const tones = {
    default: "bg-card text-card-foreground",
    navy: "bg-primary text-primary-foreground",
    red: "bg-accent text-accent-foreground",
    green: "bg-card text-card-foreground border-l-4 border-l-success",
    orange: "bg-card text-card-foreground border-l-4 border-l-warning",
  } as const;
  return (
    <div className={cn("rounded-xl border p-4 shadow-card", tones[tone])}>
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider opacity-80">{label}{icon}</div>
      <div className="mt-2 font-display text-3xl font-bold">{value}</div>
      {hint && <div className="mt-1 text-xs opacity-75">{hint}</div>}
    </div>
  );
}

export function Panel({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border bg-card p-4 shadow-card print-area", className)}>
      {(title || actions) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="text-lg font-bold uppercase text-primary">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

const URG: Record<Urgency, string> = {
  scaduto: "bg-destructive text-destructive-foreground",
  "7": "bg-warning text-warning-foreground",
  "30": "bg-caution text-caution-foreground",
  ok: "bg-secondary text-secondary-foreground",
  fatto: "bg-success text-success-foreground",
};
export function UrgencyDot({ u }: { u: Urgency }) {
  return <span className={cn("inline-block h-2.5 w-2.5 rounded-full", URG[u])} />;
}
export function Pill({ tone = "ok", children }: { tone?: Urgency | "navy" | "red"; children: ReactNode }) {
  const t = tone === "navy" ? "bg-primary text-primary-foreground" : tone === "red" ? "bg-accent text-accent-foreground" : URG[tone];
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap", t)}>{children}</span>;
}

export function Notice({ children, tone = "warning" }: { children: ReactNode; tone?: "warning" | "danger" | "info" }) {
  const t = tone === "danger" ? "border-destructive bg-destructive/10 text-destructive" : tone === "info" ? "border-primary/30 bg-secondary text-secondary-foreground" : "border-warning bg-warning/10 text-foreground";
  return (
    <div className={cn("flex gap-3 rounded-lg border p-3 text-sm", t)}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export const FISCAL_TICKETS_WARNING =
  "I titoli d'accesso a pagamento per eventi sportivi vanno emessi tramite misuratore fiscale o sistema di biglietteria automatizzata autorizzato, con trasmissione dei corrispettivi e adempimenti SIAE/Agenzia Entrate dove previsti. Questo modulo serve per organizzare, contare, controllare gli accessi e fare la quadratura. Verificare con il commercialista se i biglietti emessi qui possono essere usati come titoli fiscali o se va integrato un sistema certificato.";
export const RULES_WARNING =
  "Regole fiscali, contributive e FIP preimpostate per la stagione 2026/27 da fonti pubbliche: le soglie e i testi sono modificabili e vanno verificati con commercialista, consulente del lavoro e comitato FIP Toscana";

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{children}</div>;
}

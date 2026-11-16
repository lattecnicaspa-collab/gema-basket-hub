import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { addDays, differenceInYears, format, isWeekend, parseISO } from "date-fns";
import { Check, Download, Pencil, Plus, Trash2, X } from "lucide-react";
import { db } from "@/lib/db";
import { useAuth, useRoles, type Role } from "@/lib/auth";
import { useClub } from "@/hooks/useClub";
import { daysUntil, eur, fmtDate, fmtDateTime, todayISO } from "@/lib/format";
import { downloadCSV } from "@/lib/export";
import { Empty, Notice, PageHeader, Pill, StatCard } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/modulo/$slug")({
  head: () => ({ meta: [{ title: "Modulo – GEMA360" }] }),
  component: ModuloPage,
});

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = any;
type Opt = { value: string; label: string };
type FkTable = "persons" | "teams" | "seasons";
type Field = {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "datetime" | "select" | "boolean" | "textarea";
  options?: Opt[];
  fk?: FkTable;
  required?: boolean;
  list?: boolean; // mostra in tabella (default true per i campi non textarea)
  hint?: string;
};
type Ctx = {
  fk: Record<FkTable, Row[]>;
  fkLabel: (t: FkTable, id: string | null | undefined) => string;
  certByPerson: Record<string, Row>;
  club: Row | undefined;
  refresh: () => void;
  canWrite: boolean;
  userId?: string | undefined;
};
type Extra = { label: string; render: (r: Row, ctx: Ctx) => ReactNode };
type Config = {
  title: string;
  subtitle: string;
  table: string;
  order: { col: string; asc: boolean }[];
  fields: Field[];
  softDelete?: boolean;
  readOnly?: boolean;
  writeRoles: Role[];
  defaults?: () => Row;
  extras?: Extra[];
  top?: (rows: Row[], ctx: Ctx) => ReactNode;
  rowActions?: (r: Row, ctx: Ctx) => ReactNode;
  beforeSave?: (r: Row, ctx: Ctx) => Row;
  needsCerts?: boolean;
};

const o = (...pairs: [string, string][]): Opt[] =>
  pairs.map(([value, label]) => ({ value, label }));
const SEX = o(["M", "Maschio"], ["F", "Femmina"]);
const FIP_CAT = o(["I", "I – italiano"], ["C", "C – UE/Schengen"], ["E", "E – extra UE"]);

const age = (bd?: string | null) => (bd ? differenceInYears(new Date(), parseISO(bd)) : null);

function workingDaysLeft(fromISO: string, total = 30) {
  // 30 giorni lavorativi dalla data dell'infortunio (esclusi sabato e domenica)
  let d = parseISO(fromISO);
  let n = 0;
  while (n < total) {
    d = addDays(d, 1);
    if (!isWeekend(d)) n++;
  }
  return { deadline: format(d, "yyyy-MM-dd"), left: daysUntil(format(d, "yyyy-MM-dd")) };
}

function certTone(expiry?: string | null): {
  tone: "fatto" | "30" | "scaduto" | "ok";
  label: string;
} {
  if (!expiry) return { tone: "ok", label: "Mancante" };
  const d = daysUntil(expiry);
  if (d < 0) return { tone: "scaduto", label: `Scaduto da ${-d} gg` };
  if (d <= 30) return { tone: "30", label: `Scade tra ${d} gg` };
  return { tone: "fatto", label: "Valido" };
}

function expiryPill(date?: string | null) {
  if (!date) return <Pill tone="ok">—</Pill>;
  const d = daysUntil(date);
  if (d < 0) return <Pill tone="scaduto">Scaduto {fmtDate(date)}</Pill>;
  if (d <= 30)
    return (
      <Pill tone="7">
        {fmtDate(date)} ({d} gg)
      </Pill>
    );
  return <Pill tone="fatto">{fmtDate(date)}</Pill>;
}

const PERSON_FIELDS: Field[] = [
  { key: "last_name", label: "Cognome", type: "text", required: true },
  { key: "first_name", label: "Nome", type: "text", required: true },
  { key: "sex", label: "Sesso", type: "select", options: SEX, list: false },
  { key: "birth_date", label: "Data di nascita", type: "date" },
  { key: "birth_place", label: "Luogo di nascita", type: "text", list: false },
  { key: "tax_code", label: "Codice fiscale", type: "text" },
  { key: "citizenship", label: "Cittadinanza", type: "text", list: false },
  { key: "fip_category", label: "Categoria FIP", type: "select", options: FIP_CAT, list: false },
  { key: "email", label: "Email", type: "text" },
  { key: "phone", label: "Telefono", type: "text" },
  { key: "address", label: "Indirizzo", type: "text", list: false },
  { key: "emergency_contact", label: "Contatto di emergenza", type: "text", list: false },
  { key: "size", label: "Taglia", type: "text", list: false },
  {
    key: "medical_notes",
    label: "Note mediche (riservate)",
    type: "textarea",
    hint: "Visibili solo a segreteria, direttivo e staff autorizzato.",
  },
];

const CONFIGS: Record<string, Config> = {
  persone: {
    title: "Persone",
    subtitle: "Anagrafica unica: atleti, staff, dirigenti, genitori",
    table: "persons",
    order: [
      { col: "last_name", asc: true },
      { col: "first_name", asc: true },
    ],
    softDelete: true,
    writeRoles: ["segreteria"],
    fields: PERSON_FIELDS,
    defaults: () => ({ citizenship: "ITA", fip_category: "I" }),
    extras: [
      {
        label: "Età",
        render: (r) => {
          const a = age(r.birth_date);
          return a == null ? (
            "—"
          ) : (
            <span className={a < 18 ? "font-semibold text-accent" : ""}>
              {a}
              {a < 18 ? " (min.)" : ""}
            </span>
          );
        },
      },
    ],
  },
  soci: {
    title: "Libro soci",
    subtitle: "Elenco soci in ordine di inserimento",
    table: "persons",
    order: [{ col: "created_at", asc: true }],
    softDelete: true,
    readOnly: true,
    writeRoles: ["segreteria"],
    fields: PERSON_FIELDS.filter((f) =>
      ["last_name", "first_name", "birth_date", "tax_code", "email"].includes(f.key),
    ),
    top: () => (
      <Notice tone="info">
        Vista provvisoria basata sull'anagrafica. Il libro soci completo (numero progressivo, data
        di ammissione e recesso, quota associativa, diritto di voto) richiede una tabella dedicata
        che verrà aggiunta al database. Per ora i soci si gestiscono da <b>Anagrafica → Persone</b>.
      </Notice>
    ),
    extras: [{ label: "Inserito il", render: (r) => fmtDate(r.created_at) }],
  },
  squadre: {
    title: "Squadre",
    subtitle: "Squadre della stagione con categoria e campionato",
    table: "teams",
    order: [{ col: "name", asc: true }],
    writeRoles: ["segreteria", "direttore_sportivo"],
    fields: [
      { key: "name", label: "Nome", type: "text", required: true },
      {
        key: "category",
        label: "Categoria",
        type: "select",
        required: true,
        options: o(
          ["Serie A2", "Serie A2"],
          ["B Nazionale", "B Nazionale"],
          ["B Interregionale", "B Interregionale"],
          ["Serie C", "Serie C"],
          ["DR1", "DR1"],
          ["DR2", "DR2"],
          ["U19", "U19"],
          ["U17", "U17"],
          ["U15", "U15"],
          ["U14", "U14"],
          ["U13", "U13"],
          ["Esordienti", "Esordienti"],
          ["Aquilotti", "Aquilotti"],
          ["Scoiattoli", "Scoiattoli"],
          ["Pulcini", "Pulcini"],
        ),
      },
      { key: "league", label: "Campionato / girone", type: "text" },
      {
        key: "birth_years",
        label: "Anni di nascita",
        type: "text",
        hint: "Es. 2010-2011 (DOA FIP 2026/27: U19 2008-09, U17 2010-11, U15 2012, U14 2013, U13 2014)",
      },
      { key: "season_id", label: "Stagione", type: "select", fk: "seasons" },
    ],
  },
  rose: {
    title: "Rose",
    subtitle: "Atleti e staff per squadra, con stato del certificato medico",
    table: "team_members",
    order: [
      { col: "team_id", asc: true },
      { col: "jersey", asc: true },
    ],
    writeRoles: ["segreteria", "direttore_sportivo"],
    needsCerts: true,
    fields: [
      { key: "team_id", label: "Squadra", type: "select", fk: "teams", required: true },
      { key: "person_id", label: "Persona", type: "select", fk: "persons", required: true },
      {
        key: "role",
        label: "Ruolo",
        type: "select",
        required: true,
        options: o(
          ["atleta", "Atleta"],
          ["capo_allenatore", "Capo allenatore"],
          ["assistente", "Assistente"],
          ["preparatore", "Preparatore"],
          ["dirigente_accompagnatore", "Dirigente accompagnatore"],
          ["addetto_arbitri", "Addetto arbitri"],
          ["medico", "Medico"],
          ["fisioterapista", "Fisioterapista"],
          ["scorer", "Scorer / statistico"],
        ),
      },
      { key: "jersey", label: "Maglia", type: "number" },
    ],
    defaults: () => ({ role: "atleta" }),
    extras: [
      {
        label: "Certificato",
        render: (r, ctx) => {
          if (r.role !== "atleta") return "—";
          const c = certTone(ctx.certByPerson[r.person_id]?.expiry_date);
          return <Pill tone={c.tone}>{c.label}</Pill>;
        },
      },
    ],
    top: (rows, ctx) => {
      const blocked = rows.filter(
        (r) =>
          r.role === "atleta" &&
          certTone(ctx.certByPerson[r.person_id]?.expiry_date).tone !== "fatto" &&
          certTone(ctx.certByPerson[r.person_id]?.expiry_date).tone !== "30",
      );
      return blocked.length ? (
        <Notice tone="danger">
          <b>{blocked.length} atleti bloccati</b>: certificato scaduto o mancante, non possono
          essere convocati né allenarsi.
        </Notice>
      ) : null;
    },
  },
  tesseramenti: {
    title: "Tesseramenti FIP",
    subtitle: "Tesseramento digitale myFIP / FIP Online (dal 1/7/2026)",
    table: "fip_registrations",
    order: [{ col: "status", asc: true }],
    writeRoles: ["segreteria"],
    fields: [
      { key: "person_id", label: "Persona", type: "select", fk: "persons", required: true },
      { key: "season_id", label: "Stagione", type: "select", fk: "seasons" },
      {
        key: "type",
        label: "Tipo",
        type: "select",
        options: o(
          ["atleta", "Atleta"],
          ["allenatore", "Allenatore"],
          ["dirigente", "Dirigente"],
          ["minibasket", "Minibasket"],
          ["3x3", "Solo 3x3"],
        ),
      },
      { key: "card_number", label: "N. tessera", type: "text" },
      {
        key: "status",
        label: "Stato",
        type: "select",
        options: o(
          ["da_fare", "Da fare"],
          ["attesa_pin", "In attesa PIN myFIP"],
          ["attivo", "Attivo"],
          ["scaduto", "Scaduto"],
          ["trasferito", "Trasferito"],
        ),
      },
      { key: "registered_at", label: "Data", type: "date" },
      {
        key: "notes",
        label: "Note (nulla osta, trasferimenti, doppio utilizzo)",
        type: "textarea",
      },
    ],
    defaults: () => ({ type: "atleta", status: "da_fare" }),
    top: (rows) => {
      const todo = rows.filter((r) => r.status === "da_fare" || r.status === "attesa_pin").length;
      return todo ? (
        <Notice>
          {todo} tesseramenti da completare. Senza tessera attiva l'atleta non può essere convocato.
        </Notice>
      ) : null;
    },
  },
  iscrizioni: {
    title: "Iscrizioni",
    subtitle: "Richieste arrivate dal modulo pubblico: approva o rifiuta",
    table: "enrollments",
    order: [{ col: "created_at", asc: false }],
    writeRoles: ["segreteria"],
    fields: [
      { key: "last_name", label: "Cognome", type: "text", required: true },
      { key: "first_name", label: "Nome", type: "text", required: true },
      { key: "birth_date", label: "Nascita", type: "date" },
      { key: "tax_code", label: "Codice fiscale", type: "text", list: false },
      { key: "requested_team", label: "Squadra richiesta", type: "text" },
      { key: "parent_name", label: "Genitore", type: "text" },
      { key: "parent_email", label: "Email genitore", type: "text", list: false },
      { key: "parent_phone", label: "Telefono genitore", type: "text" },
      {
        key: "status",
        label: "Stato",
        type: "select",
        options: o(
          ["in_attesa", "In attesa"],
          ["approvata", "Approvata"],
          ["rifiutata", "Rifiutata"],
        ),
      },
      { key: "notes", label: "Note", type: "textarea" },
    ],
    defaults: () => ({ status: "in_attesa" }),
    rowActions: (r, ctx) =>
      r.status === "in_attesa" && ctx.canWrite ? (
        <>
          <Button size="sm" variant="outline" onClick={() => approveEnrollment(r, ctx)}>
            <Check className="h-4 w-4" />
            Approva
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              const x = await db.from("enrollments").update({ status: "rifiutata" }).eq("id", r.id);
              if (x.error) return toast.error(x.error.message);
              toast.success("Iscrizione rifiutata");
              ctx.refresh();
            }}
          >
            <X className="h-4 w-4" />
            Rifiuta
          </Button>
        </>
      ) : null,
  },
  certificati: {
    title: "Certificati medici",
    subtitle: "Semaforo: verde valido · giallo entro 30 gg · rosso scaduto · grigio mancante",
    table: "medical_certificates",
    order: [{ col: "expiry_date", asc: true }],
    writeRoles: ["segreteria"],
    fields: [
      { key: "person_id", label: "Atleta", type: "select", fk: "persons", required: true },
      {
        key: "type",
        label: "Tipo",
        type: "select",
        options: o(
          ["agonistico", "Agonistico"],
          ["non_agonistico", "Non agonistico"],
          ["libretto", "Libretto"],
        ),
      },
      { key: "visit_date", label: "Data visita", type: "date" },
      { key: "expiry_date", label: "Scadenza", type: "date", required: true },
      { key: "doctor", label: "Medico / centro", type: "text" },
      { key: "verified", label: "Verificato dalla segreteria", type: "boolean" },
      { key: "file_url", label: "Percorso file (bucket certificati)", type: "text", list: false },
    ],
    defaults: () => ({
      type: "agonistico",
      visit_date: todayISO(),
      expiry_date: format(addDays(new Date(), 365), "yyyy-MM-dd"),
    }),
    extras: [
      {
        label: "Stato",
        render: (r) => {
          const c = certTone(r.expiry_date);
          return <Pill tone={c.tone}>{c.label}</Pill>;
        },
      },
      {
        label: "Regola 11 anni",
        render: (r, ctx) => {
          const p = ctx.fk.persons.find((x) => x.id === r.person_id);
          const a = age(p?.birth_date);
          return a != null && a >= 11 && r.type !== "agonistico" ? (
            <Pill tone="scaduto">Serve agonistico</Pill>
          ) : (
            "—"
          );
        },
      },
    ],
    top: (rows) => (
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          tone="red"
          label="Scaduti"
          value={rows.filter((r) => daysUntil(r.expiry_date) < 0).length}
        />
        <StatCard
          tone="orange"
          label="Entro 30 giorni"
          value={
            rows.filter((r) => {
              const d = daysUntil(r.expiry_date);
              return d >= 0 && d <= 30;
            }).length
          }
        />
        <StatCard
          tone="green"
          label="Validi"
          value={rows.filter((r) => daysUntil(r.expiry_date) > 30).length}
        />
        <div className="col-span-3">
          <Notice tone="info">
            Dal giorno dell'11° compleanno serve il certificato <b>agonistico</b> (Regolamento
            Sanitario FIP). Con certificato scaduto l'atleta non può allenarsi né essere convocato.
            Conservare gli originali per 5 anni.
          </Notice>
        </div>
      </div>
    ),
  },
  infortuni: {
    title: "Infortuni",
    subtitle: "Denuncia all'assicurazione FIP entro 30 giorni lavorativi",
    table: "injuries",
    order: [{ col: "injury_date", asc: false }],
    writeRoles: ["segreteria", "direttore_sportivo", "allenatore"],
    fields: [
      { key: "person_id", label: "Persona", type: "select", fk: "persons", required: true },
      { key: "injury_date", label: "Data", type: "date", required: true },
      { key: "event", label: "Evento", type: "text" },
      { key: "description", label: "Descrizione", type: "textarea" },
      {
        key: "status",
        label: "Stato",
        type: "select",
        options: o(
          ["aperto", "Aperto – da denunciare"],
          ["denunciato", "Denunciato"],
          ["chiuso", "Chiuso"],
        ),
      },
      { key: "return_date", label: "Rientro", type: "date" },
    ],
    defaults: () => ({ injury_date: todayISO(), status: "aperto" }),
    extras: [
      {
        label: "Termine denuncia",
        render: (r) => {
          if (r.status !== "aperto") return "—";
          const w = workingDaysLeft(r.injury_date);
          return (
            <Pill tone={w.left < 0 ? "scaduto" : w.left <= 7 ? "7" : "30"}>
              {fmtDate(w.deadline)} · {w.left < 0 ? "scaduto" : `${w.left} gg`}
            </Pill>
          );
        },
      },
    ],
  },
  dae: {
    title: "DAE / BLSD",
    subtitle: "Defibrillatori: scadenze di piastre e batteria",
    table: "aed_devices",
    order: [{ col: "location", asc: true }],
    writeRoles: ["segreteria"],
    fields: [
      { key: "location", label: "Posizione", type: "text", required: true },
      { key: "serial", label: "Matricola", type: "text" },
      { key: "pads_expiry", label: "Scadenza piastre", type: "date", list: false },
      { key: "battery_expiry", label: "Scadenza batteria", type: "date", list: false },
      { key: "notes", label: "Note", type: "textarea" },
    ],
    extras: [
      { label: "Piastre", render: (r) => expiryPill(r.pads_expiry) },
      { label: "Batteria", render: (r) => expiryPill(r.battery_expiry) },
    ],
    top: () => (
      <Notice tone="info">
        DM 26/06/2017: prima di ogni gara va verificato il DAE e deve essere presente un operatore
        BLSD con brevetto valido (spunta nella scheda partita del Match day). Il registro dei
        brevetti BLSD richiede una tabella dedicata che verrà aggiunta.
      </Notice>
    ),
  },
  calendario: {
    title: "Calendario",
    subtitle: "Allenamenti, partite, riunioni ed eventi delle squadre",
    table: "events",
    order: [{ col: "starts_at", asc: true }],
    writeRoles: ["segreteria", "direttore_sportivo", "allenatore"],
    fields: [
      { key: "starts_at", label: "Data e ora", type: "datetime", required: true },
      { key: "title", label: "Titolo", type: "text", required: true },
      {
        key: "type",
        label: "Tipo",
        type: "select",
        options: o(
          ["allenamento", "Allenamento"],
          ["partita", "Partita"],
          ["amichevole", "Amichevole"],
          ["torneo", "Torneo"],
          ["riunione", "Riunione"],
          ["camp", "Camp"],
        ),
      },
      { key: "team_id", label: "Squadra", type: "select", fk: "teams" },
      { key: "location", label: "Luogo", type: "text" },
      { key: "notes", label: "Note", type: "textarea" },
    ],
    defaults: () => ({ type: "allenamento", location: "PalaTerme" }),
  },
  "prima-nota": {
    title: "Prima nota",
    subtitle: "Movimenti di cassa e banca, istituzionali e commerciali (L. 398/91)",
    table: "ledger_entries",
    order: [{ col: "entry_date", asc: false }],
    writeRoles: ["tesoriere"],
    fields: [
      { key: "entry_date", label: "Data", type: "date", required: true },
      { key: "description", label: "Descrizione", type: "text", required: true },
      {
        key: "direction",
        label: "Tipo",
        type: "select",
        options: o(["entrata", "Entrata"], ["uscita", "Uscita"]),
      },
      { key: "amount", label: "Importo (€)", type: "number", required: true },
      { key: "vat_amount", label: "di cui IVA (€)", type: "number", list: false },
      {
        key: "area",
        label: "Area",
        type: "select",
        options: o(["istituzionale", "Istituzionale"], ["commerciale", "Commerciale"]),
      },
      { key: "account", label: "Conto / causale", type: "text" },
      {
        key: "method",
        label: "Metodo",
        type: "select",
        options: o(
          ["banca", "Banca / bonifico"],
          ["contanti", "Contanti"],
          ["pos", "POS"],
          ["carta", "Carta online"],
          ["satispay", "Satispay"],
          ["sepa", "SEPA"],
        ),
      },
      { key: "attachment_url", label: "Allegato (percorso)", type: "text", list: false },
    ],
    defaults: () => ({
      entry_date: todayISO(),
      direction: "entrata",
      area: "istituzionale",
      method: "banca",
      account: "Varie",
      vat_amount: 0,
    }),
    extras: [
      {
        label: "Avvisi",
        render: (r) =>
          r.method === "contanti" && Number(r.amount) >= 1000 ? (
            <Pill tone="scaduto">Contanti ≥ 1.000 €</Pill>
          ) : r.source ? (
            <span className="text-xs text-muted-foreground">Automatico ({r.source})</span>
          ) : (
            ""
          ),
      },
    ],
    top: (rows, ctx) => {
      const sum = (f: (r: Row) => boolean) =>
        rows.filter(f).reduce((s, r) => s + Number(r.amount ?? 0), 0);
      const inc = sum((r) => r.direction === "entrata");
      const out = sum((r) => r.direction === "uscita");
      const y = String(new Date().getFullYear());
      const comm = sum(
        (r) =>
          r.direction === "entrata" &&
          r.area === "commerciale" &&
          String(r.entry_date).startsWith(y),
      );
      const thr = Number(ctx.club?.commercial_threshold ?? 400000);
      const cash = rows.filter((r) => r.method === "contanti" && Number(r.amount) >= 1000).length;
      return (
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard tone="green" label="Entrate" value={eur(inc)} />
            <StatCard tone="orange" label="Uscite" value={eur(out)} />
            <StatCard tone="navy" label="Saldo" value={eur(inc - out)} />
            <StatCard
              tone={comm > thr * 0.8 ? "red" : "default"}
              label={`Proventi commerciali ${y}`}
              value={eur(comm)}
              hint={`Soglia 398/91: ${eur(thr)} (${Math.round((comm / thr) * 100)}%)`}
            />
          </div>
          {cash > 0 && (
            <Notice tone="danger">
              {cash} movimenti in contanti pari o superiori a 1.000 €: incassi e pagamenti da 1.000
              € in su devono essere tracciabili.
            </Notice>
          )}
          <Notice>
            Regole fiscali preimpostate da fonti pubbliche: verificare con il commercialista.
          </Notice>
        </div>
      );
    },
  },
  bacheca: {
    title: "Bacheca",
    subtitle: "Avvisi alla società, alle squadre e alle famiglie",
    table: "announcements",
    order: [
      { col: "pinned", asc: false },
      { col: "created_at", asc: false },
    ],
    writeRoles: ["segreteria", "ufficio_stampa", "direttivo"],
    fields: [
      { key: "title", label: "Titolo", type: "text", required: true },
      { key: "body", label: "Testo", type: "textarea" },
      {
        key: "audience",
        label: "Destinatari",
        type: "select",
        options: o(
          ["tutti", "Tutti"],
          ["staff", "Staff"],
          ["squadre", "Squadre"],
          ["genitori", "Genitori"],
          ["sponsor", "Sponsor"],
        ),
      },
      { key: "pinned", label: "Fissato in alto", type: "boolean" },
    ],
    defaults: () => ({ audience: "tutti", pinned: false }),
    beforeSave: (r, ctx) => (r.id ? r : { ...r, created_by: ctx.userId ?? null }),
    extras: [
      { label: "Pubblicato", render: (r) => fmtDate(r.created_at) },
      {
        label: "WhatsApp",
        render: (r) => (
          <a
            className="text-xs text-primary underline"
            target="_blank"
            rel="noreferrer"
            href={`https://wa.me/?text=${encodeURIComponent(`${r.title}\n\n${r.body ?? ""}`)}`}
          >
            Condividi
          </a>
        ),
      },
    ],
  },
  magazzino: {
    title: "Magazzino",
    subtitle: "Divise, tute, borse, palloni e materiale",
    table: "inventory_items",
    order: [
      { col: "category", asc: true },
      { col: "name", asc: true },
    ],
    writeRoles: ["segreteria"],
    fields: [
      { key: "name", label: "Articolo", type: "text", required: true },
      { key: "category", label: "Categoria", type: "text" },
      { key: "size", label: "Taglia", type: "text" },
      { key: "stock", label: "Giacenza", type: "number" },
      { key: "notes", label: "Note", type: "textarea" },
    ],
    defaults: () => ({ stock: 0 }),
    extras: [
      {
        label: "",
        render: (r) =>
          Number(r.stock ?? 0) <= 0 ? (
            <Pill tone="scaduto">Esaurito</Pill>
          ) : Number(r.stock) <= 3 ? (
            <Pill tone="7">Scorta bassa</Pill>
          ) : (
            ""
          ),
      },
    ],
  },
  assemblee: {
    title: "Assemblee e consigli",
    subtitle: "Convocazioni, ordine del giorno e verbali",
    table: "assemblies",
    order: [{ col: "meeting_date", asc: false }],
    writeRoles: ["direttivo", "segreteria"],
    fields: [
      {
        key: "type",
        label: "Tipo",
        type: "select",
        options: o(["assemblea", "Assemblea dei soci"], ["consiglio", "Consiglio direttivo"]),
      },
      { key: "meeting_date", label: "Data", type: "date", required: true },
      {
        key: "status",
        label: "Stato",
        type: "select",
        options: o(["convocata", "Convocata"], ["svolta", "Svolta"], ["annullata", "Annullata"]),
      },
      { key: "agenda", label: "Ordine del giorno", type: "textarea" },
      { key: "minutes", label: "Verbale", type: "textarea" },
    ],
    defaults: () => ({ type: "assemblea", status: "convocata", meeting_date: todayISO() }),
    top: () => (
      <Notice tone="info">
        Promemoria: rendiconto da approvare in assemblea entro 4 mesi dalla chiusura dell'esercizio;
        aggiornamento dati sul Registro attività sportive (RASD) entro il 31 gennaio.
      </Notice>
    ),
  },
};

async function approveEnrollment(r: Row, ctx: Ctx) {
  if (r.tax_code) {
    const ex = await db.from("persons").select("id").eq("tax_code", r.tax_code).maybeSingle();
    if (ex.data) {
      const u = await db.from("enrollments").update({ status: "approvata" }).eq("id", r.id);
      if (u.error) return toast.error(u.error.message);
      toast.success("Persona già presente in anagrafica: iscrizione approvata");
      return ctx.refresh();
    }
  }
  const p = await db.from("persons").insert({
    first_name: r.first_name,
    last_name: r.last_name,
    birth_date: r.birth_date,
    tax_code: r.tax_code || null,
    emergency_contact: [r.parent_name, r.parent_phone].filter(Boolean).join(" ") || null,
    email: r.parent_email || null,
  });
  if (p.error) return toast.error(p.error.message);
  const u = await db.from("enrollments").update({ status: "approvata" }).eq("id", r.id);
  if (u.error) return toast.error(u.error.message);
  toast.success(
    "Iscrizione approvata: persona creata in anagrafica. Ora assegnala alla squadra in Rose.",
  );
  ctx.refresh();
}

const toLocalInput = (iso?: string | null) =>
  iso ? format(parseISO(iso), "yyyy-MM-dd'T'HH:mm") : "";

function ModuloPage() {
  const { slug } = Route.useParams();
  const cfg = CONFIGS[slug];
  if (!cfg)
    return (
      <div>
        <PageHeader title="Modulo" />
        <Empty>Modulo “{slug}” non disponibile.</Empty>
      </div>
    );
  return <Modulo key={slug} slug={slug} cfg={cfg} />;
}

function Modulo({ slug, cfg }: { slug: string; cfg: Config }) {
  const qc = useQueryClient();
  const { session } = useAuth();
  const { hasAny } = useRoles();
  const { data: club } = useClub();
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Row | null>(null);
  const [del, setDel] = useState<Row | null>(null);
  const canWrite = !cfg.readOnly && hasAny(cfg.writeRoles);
  const fkTables = Array.from(new Set(cfg.fields.filter((f) => f.fk).map((f) => f.fk as FkTable)));
  if ((cfg.needsCerts || slug === "certificati") && !fkTables.includes("persons"))
    fkTables.push("persons");

  const {
    data: rows = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["modulo", slug],
    queryFn: async () => {
      let qq = db.from(cfg.table).select("*");
      if (cfg.softDelete) qq = qq.is("deleted_at", null);
      for (const ord of cfg.order)
        qq = qq.order(ord.col, { ascending: ord.asc, nullsFirst: false });
      const r = await qq.limit(2000);
      if (r.error) throw r.error;
      return (r.data ?? []) as Row[];
    },
  });

  const { data: fkData = { persons: [], teams: [], seasons: [] } } = useQuery({
    queryKey: ["modulo-fk", fkTables.join(",")],
    enabled: fkTables.length > 0,
    queryFn: async () => {
      const out: Record<FkTable, Row[]> = { persons: [], teams: [], seasons: [] };
      for (const t of fkTables) {
        const sel =
          t === "persons"
            ? db
                .from("persons")
                .select("id,first_name,last_name,birth_date")
                .is("deleted_at", null)
                .order("last_name")
            : db.from(t).select("id,name").order("name");
        out[t] = ((await sel).data ?? []) as Row[];
      }
      return out;
    },
  });

  const { data: certs = [] } = useQuery({
    queryKey: ["modulo-certs"],
    enabled: !!cfg.needsCerts,
    queryFn: async () =>
      ((
        await db
          .from("medical_certificates")
          .select("person_id,expiry_date")
          .order("expiry_date", { ascending: true })
      ).data ?? []) as Row[],
  });
  const certByPerson = useMemo(
    () => Object.fromEntries(certs.map((c) => [c.person_id, c])),
    [certs],
  );

  const fkLabel = (t: FkTable, id: string | null | undefined) => {
    if (!id) return "—";
    const r = fkData[t]?.find((x) => x.id === id);
    if (!r) return "—";
    return t === "persons" ? `${r.last_name} ${r.first_name}` : r.name;
  };
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["modulo", slug] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };
  const ctx: Ctx = {
    fk: fkData,
    fkLabel,
    certByPerson,
    club: club as Row | undefined,
    refresh,
    canWrite,
    userId: session?.user.id,
  };

  const listFields = cfg.fields.filter((f) => f.list !== false && f.type !== "textarea");
  const display = (f: Field, r: Row): ReactNode => {
    const v = r[f.key];
    if (f.fk) return fkLabel(f.fk, v);
    if (v == null || v === "") return "—";
    if (f.type === "date") return fmtDate(v);
    if (f.type === "datetime") return fmtDateTime(v);
    if (f.type === "boolean") return v ? "Sì" : "No";
    if (f.type === "select") return f.options?.find((x) => x.value === v)?.label ?? String(v);
    if (f.type === "number" && /amount|importo/.test(f.key)) return eur(v);
    return String(v);
  };
  const text = (f: Field, r: Row) => {
    const d = display(f, r);
    return typeof d === "string" || typeof d === "number" ? String(d) : "";
  };

  const filtered = useMemo(() => {
    if (!q) return rows;
    const s = q.toLowerCase();
    return rows.filter((r) => cfg.fields.some((f) => text(f, r).toLowerCase().includes(s)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, fkData]);

  async function save() {
    if (!edit) return;
    const payload: Row = {};
    for (const f of cfg.fields) {
      let v = edit[f.key];
      if (f.type === "number") v = v === "" || v == null ? null : Number(v);
      else if (f.type === "boolean") v = !!v;
      else if (f.type === "datetime") v = v ? new Date(v).toISOString() : null;
      else if (typeof v === "string") v = v.trim() === "" ? null : v.trim();
      if (f.required && (v == null || v === ""))
        return toast.error(`Campo obbligatorio: ${f.label}`);
      if (f.type === "number" && v != null && Number.isNaN(v))
        return toast.error(`Numero non valido: ${f.label}`);
      if (v !== undefined) payload[f.key] = v;
    }
    if (payload.tax_code) payload.tax_code = String(payload.tax_code).toUpperCase();
    if (payload.tax_code && !/^[A-Z0-9]{16}$/.test(payload.tax_code))
      return toast.error("Codice fiscale non valido (16 caratteri)");
    const data = cfg.beforeSave ? cfg.beforeSave({ ...payload, id: edit.id }, ctx) : payload;
    delete data.id;
    const r = edit.id
      ? await db.from(cfg.table).update(data).eq("id", edit.id)
      : await db.from(cfg.table).insert(data);
    if (r.error)
      return toast.error(
        r.error.message.includes("row-level")
          ? "Non hai i permessi per questa operazione"
          : r.error.message,
      );
    toast.success("Salvato");
    setEdit(null);
    refresh();
  }

  async function remove() {
    if (!del) return;
    const r = cfg.softDelete
      ? await db.from(cfg.table).update({ deleted_at: new Date().toISOString() }).eq("id", del.id)
      : await db.from(cfg.table).delete().eq("id", del.id);
    if (r.error) return toast.error(r.error.message);
    setDel(null);
    refresh();
    toast.success("Eliminato");
  }

  const exportRows = () =>
    filtered.map((r, i) => {
      const out: Row = slug === "soci" ? { "N.": i + 1 } : {};
      for (const f of cfg.fields) out[f.label] = text(f, r);
      return out;
    });

  const openNew = () => setEdit({ ...(cfg.defaults?.() ?? {}) });
  const openEdit = (r: Row) => {
    const e: Row = { ...r };
    for (const f of cfg.fields) if (f.type === "datetime") e[f.key] = toLocalInput(r[f.key]);
    setEdit(e);
  };

  return (
    <div>
      <PageHeader
        title={cfg.title}
        subtitle={cfg.subtitle}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadCSV(`${slug}.csv`, exportRows())}
              disabled={!filtered.length}
            >
              <Download className="h-4 w-4" />
              Excel
            </Button>
            {canWrite && (
              <Button size="sm" variant="destructive" onClick={openNew}>
                <Plus className="h-4 w-4" />
                Nuovo
              </Button>
            )}
          </>
        }
      />

      {cfg.top && <div className="mb-4">{cfg.top(rows, ctx)}</div>}

      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Cerca…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-64"
        />
        <span className="text-xs text-muted-foreground">{filtered.length} record</span>
      </div>

      {error ? (
        <Notice tone="danger">
          Impossibile caricare i dati: {(error as Error).message}. Verifica di avere il ruolo
          necessario.
        </Notice>
      ) : isLoading ? (
        <Empty>Caricamento…</Empty>
      ) : !filtered.length ? (
        <Empty>Nessun record.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-primary text-left text-xs uppercase text-primary-foreground">
              <tr>
                {slug === "soci" && <th className="p-3">N.</th>}
                {listFields.map((f) => (
                  <th key={f.key} className="p-3">
                    {f.label}
                  </th>
                ))}
                {(cfg.extras ?? []).map((x, i) => (
                  <th key={i} className="p-3">
                    {x.label}
                  </th>
                ))}
                <th className="no-print p-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.id} className={`border-t ${r.pinned ? "bg-secondary/60" : ""}`}>
                  {slug === "soci" && <td className="p-3 tabular-nums">{i + 1}</td>}
                  {listFields.map((f, j) => (
                    <td key={f.key} className="p-3">
                      {j === 0 && canWrite ? (
                        <button
                          className="text-left font-medium hover:underline"
                          onClick={() => openEdit(r)}
                        >
                          {display(f, r)}
                        </button>
                      ) : (
                        display(f, r)
                      )}
                    </td>
                  ))}
                  {(cfg.extras ?? []).map((x, k) => (
                    <td key={k} className="p-3 whitespace-nowrap">
                      {x.render(r, ctx)}
                    </td>
                  ))}
                  <td className="no-print p-3 whitespace-nowrap text-right">
                    {cfg.rowActions?.(r, ctx)}
                    {canWrite && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openEdit(r)}
                        aria-label="Modifica"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {canWrite && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setDel(r)}
                        aria-label="Elimina"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {edit?.id ? `Modifica – ${cfg.title}` : `Nuovo – ${cfg.title}`}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {cfg.fields.map((f) => (
              <div key={f.key} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
                <Label>
                  {f.label}
                  {f.required && " *"}
                </Label>
                <FieldInput
                  f={f}
                  value={edit?.[f.key]}
                  onChange={(v) => setEdit((e: Row) => ({ ...(e ?? {}), [f.key]: v }))}
                  ctx={ctx}
                />
                {f.hint && <p className="mt-1 text-xs text-muted-foreground">{f.hint}</p>}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>
              Annulla
            </Button>
            <Button onClick={save}>Salva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!del} onOpenChange={(v) => !v && setDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare questo record?</AlertDialogTitle>
            <AlertDialogDescription>
              {cfg.softDelete
                ? "Il record verrà archiviato (eliminazione logica)."
                : "L'operazione non si può annullare."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Elimina</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FieldInput({
  f,
  value,
  onChange,
  ctx,
}: {
  f: Field;
  value: any;
  onChange: (v: any) => void;
  ctx: Ctx;
}) {
  if (f.type === "textarea")
    return <Textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} rows={4} />;
  if (f.type === "boolean")
    return (
      <div className="pt-2">
        <Switch checked={!!value} onCheckedChange={onChange} />
      </div>
    );
  if (f.type === "select") {
    const opts: Opt[] = f.fk
      ? ctx.fk[f.fk].map((r) => ({ value: r.id, label: ctx.fkLabel(f.fk as FkTable, r.id) }))
      : (f.options ?? []);
    return (
      <Select
        value={value ?? (f.required ? "" : "__none")}
        onValueChange={(v) => onChange(v === "__none" ? null : v)}
      >
        <SelectTrigger>
          <SelectValue placeholder="Seleziona…" />
        </SelectTrigger>
        <SelectContent>
          {!f.required && <SelectItem value="__none">—</SelectItem>}
          {opts.map((x) => (
            <SelectItem key={x.value} value={x.value}>
              {x.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  const type = f.type === "datetime" ? "datetime-local" : f.type;
  return (
    <Input
      type={type}
      step={f.type === "number" ? "any" : undefined}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Plus, RefreshCw, Save, Trash2, X } from "lucide-react";
import { db } from "@/lib/db";
import { useAuth, useRoles, ROLE_LABEL, type Role } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import {
  Empty,
  FISCAL_TICKETS_WARNING,
  Notice,
  PageHeader,
  Panel,
  Pill,
  RULES_WARNING,
} from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/impostazioni")({
  head: () => ({ meta: [{ title: "Impostazioni – GEMA360" }] }),
  component: Impostazioni,
});

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = any;

function Impostazioni() {
  const { hasAny, loading } = useRoles();
  if (!loading && !hasAny(["superadmin"])) {
    return (
      <div>
        <PageHeader title="Impostazioni" />
        <Notice tone="danger">Solo il superadmin può modificare le impostazioni.</Notice>
      </div>
    );
  }
  return (
    <div>
      <PageHeader
        title="Impostazioni"
        subtitle="Dati della società, stagioni, categorie, checklist e utenti"
      />
      <Tabs defaultValue="societa">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="societa">Società</TabsTrigger>
          <TabsTrigger value="stagioni">Stagioni</TabsTrigger>
          <TabsTrigger value="categorie">Categorie scadenzario</TabsTrigger>
          <TabsTrigger value="checklist">Checklist match day</TabsTrigger>
          <TabsTrigger value="utenti">Utenti e ruoli</TabsTrigger>
          <TabsTrigger value="info">Informazioni</TabsTrigger>
        </TabsList>
        <TabsContent value="societa">
          <Societa />
        </TabsContent>
        <TabsContent value="stagioni">
          <Stagioni />
        </TabsContent>
        <TabsContent value="categorie">
          <Categorie />
        </TabsContent>
        <TabsContent value="checklist">
          <Checklist />
        </TabsContent>
        <TabsContent value="utenti">
          <Utenti />
        </TabsContent>
        <TabsContent value="info">
          <Notice>{RULES_WARNING}.</Notice>
        </TabsContent>
      </Tabs>
    </div>
  );
}

const CLUB_FIELDS: { key: string; label: string; type?: "number" | "color"; hint?: string }[] = [
  { key: "name", label: "Nome società" },
  {
    key: "legal_name",
    label: "Ragione sociale (ASD/SSD)",
    hint: "Da compilare: la forma giuridica esatta non è verificata.",
  },
  { key: "tax_code", label: "Codice fiscale" },
  { key: "vat_number", label: "Partita IVA" },
  { key: "rasd_number", label: "N. iscrizione RASD" },
  { key: "fip_code", label: "Codice società FIP" },
  { key: "address", label: "Sede" },
  { key: "pec", label: "PEC / email" },
  { key: "iban", label: "IBAN" },
  { key: "legal_rep", label: "Legale rappresentante" },
  { key: "logo_url", label: "URL logo" },
  { key: "venue_name", label: "Palazzetto" },
  { key: "footer_text", label: "Testo a piè di pagina" },
  { key: "primary_color", label: "Colore primario", type: "color" },
  { key: "accent_color", label: "Colore accento", type: "color" },
  { key: "sponsor_budget_target", label: "Obiettivo budget sponsor (€)", type: "number" },
  {
    key: "commercial_threshold",
    label: "Soglia proventi commerciali L. 398/91 (€)",
    type: "number",
  },
  {
    key: "guest_names_hours_before",
    label: "Ore prima della partita per i nominativi ospiti sponsor",
    type: "number",
  },
];

const newToken = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

function Societa() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["club-settings-edit"],
    queryFn: async () =>
      ((await db.from("club_settings").select("*").eq("id", 1).maybeSingle()).data ?? {}) as Row,
  });
  const [f, setF] = useState<Row>({});
  useEffect(() => {
    if (data)
      setF({ ...data, default_reminder_days: (data.default_reminder_days ?? []).join(", ") });
  }, [data]);

  async function save(extra: Row = {}) {
    const payload: Row = { ...f, ...extra };
    delete payload.id;
    for (const k of ["sponsor_budget_target", "commercial_threshold", "guest_names_hours_before"])
      payload[k] = Number(payload[k] ?? 0);
    payload.default_reminder_days = String(payload.default_reminder_days ?? "")
      .split(",")
      .map((x) => parseInt(x.trim()))
      .filter((n) => !isNaN(n));
    payload.updated_at = new Date().toISOString();
    const r = await db.from("club_settings").update(payload).eq("id", 1);
    if (r.error) return toast.error(r.error.message);
    toast.success("Impostazioni salvate");
    qc.invalidateQueries({ queryKey: ["club"] });
    qc.invalidateQueries({ queryKey: ["club-settings-edit"] });
  }

  const icalUrl =
    typeof window !== "undefined" && f.ical_token
      ? `${window.location.origin}/api/public/ical/${f.ical_token}.ics`
      : "";

  return (
    <div className="grid gap-4">
      <Panel
        title="Dati della società"
        actions={
          <Button size="sm" onClick={() => save()}>
            <Save className="h-4 w-4" />
            Salva
          </Button>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {CLUB_FIELDS.map((c) => (
            <div key={c.key}>
              <Label>{c.label}</Label>
              <Input
                type={c.type ?? "text"}
                value={f[c.key] ?? ""}
                onChange={(e) => setF({ ...f, [c.key]: e.target.value })}
              />
              {c.hint && <p className="mt-1 text-xs text-muted-foreground">{c.hint}</p>}
            </div>
          ))}
          <div>
            <Label>Giorni di preavviso predefiniti (separati da virgola)</Label>
            <Input
              value={f.default_reminder_days ?? ""}
              onChange={(e) => setF({ ...f, default_reminder_days: e.target.value })}
            />
          </div>
        </div>
      </Panel>

      <Panel title="Biglietteria">
        <div className="flex items-center gap-3">
          <Switch
            checked={!!f.fiscal_tickets}
            onCheckedChange={(v) => setF({ ...f, fiscal_tickets: v })}
          />
          <span className="text-sm font-medium">Biglietti interni come titoli fiscali</span>
          <Pill tone={f.fiscal_tickets ? "red" : "fatto"}>
            {f.fiscal_tickets ? "ATTIVO" : "Solo uso organizzativo"}
          </Pill>
        </div>
        <div className="mt-3">
          <Notice tone={f.fiscal_tickets ? "danger" : "warning"}>{FISCAL_TICKETS_WARNING}</Notice>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Ricorda di premere “Salva” in alto per memorizzare la scelta.
        </p>
      </Panel>

      <Panel title="Feed iCal dello scadenzario">
        <p className="mb-2 text-sm">
          Incolla questo indirizzo in Google Calendar (Aggiungi calendario → Da URL) o in Outlook.
          Chi ha il link vede le scadenze: rigeneralo se è stato condiviso per errore.
        </p>
        <div className="flex flex-wrap gap-2">
          <Input readOnly value={icalUrl} className="min-w-0 flex-1 font-mono text-xs" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(icalUrl);
              toast.success("Link copiato");
            }}
          >
            <Copy className="h-4 w-4" />
            Copia
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              const t = newToken();
              setF({ ...f, ical_token: t });
              save({ ical_token: t });
            }}
          >
            <RefreshCw className="h-4 w-4" />
            Rigenera
          </Button>
        </div>
      </Panel>
    </div>
  );
}

function Stagioni() {
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({
    queryKey: ["seasons-all"],
    queryFn: async () =>
      ((await db.from("seasons").select("*").order("start_date", { ascending: false })).data ??
        []) as Row[],
  });
  const [n, setN] = useState<Row>({ name: "", start_date: "", end_date: "" });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["seasons-all"] });
    qc.invalidateQueries({ queryKey: ["season-active"] });
  };

  async function add() {
    if (!n.name || !n.start_date || !n.end_date) return toast.error("Compila nome e date");
    const r = await db
      .from("seasons")
      .insert({ name: n.name.trim(), start_date: n.start_date, end_date: n.end_date });
    if (r.error) return toast.error(r.error.message);
    setN({ name: "", start_date: "", end_date: "" });
    refresh();
    toast.success("Stagione creata");
  }
  async function activate(id: string) {
    const a = await db.from("seasons").update({ is_active: false }).neq("id", id);
    if (a.error) return toast.error(a.error.message);
    const b = await db.from("seasons").update({ is_active: true }).eq("id", id);
    if (b.error) return toast.error(b.error.message);
    refresh();
    toast.success("Stagione attiva aggiornata");
  }
  async function remove(r: Row) {
    if (r.is_active) return toast.error("Non puoi eliminare la stagione attiva");
    if (!confirmDelete(`la stagione ${r.name}`)) return;
    const x = await db.from("seasons").delete().eq("id", r.id);
    if (x.error) return toast.error("Impossibile eliminare: la stagione è collegata ad altri dati");
    refresh();
  }

  return (
    <Panel
      title="Stagioni"
      actions={
        <span className="text-xs text-muted-foreground">Una sola stagione attiva (1/9 – 31/8)</span>
      }
    >
      <div className="mb-4 grid gap-2 sm:grid-cols-4">
        <Input
          placeholder="Es. 2027/28"
          value={n.name}
          onChange={(e) => setN({ ...n, name: e.target.value })}
        />
        <Input
          type="date"
          value={n.start_date}
          onChange={(e) => setN({ ...n, start_date: e.target.value })}
        />
        <Input
          type="date"
          value={n.end_date}
          onChange={(e) => setN({ ...n, end_date: e.target.value })}
        />
        <Button onClick={add}>
          <Plus className="h-4 w-4" />
          Aggiungi
        </Button>
      </div>
      {!rows.length ? (
        <Empty>Nessuna stagione.</Empty>
      ) : (
        <ul className="divide-y">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
            >
              <span>
                <b>{r.name}</b> · {fmtDate(r.start_date)} – {fmtDate(r.end_date)}{" "}
                {r.is_active && <Pill tone="navy">Attiva</Pill>}
              </span>
              <span className="flex gap-1">
                {!r.is_active && (
                  <Button size="sm" variant="outline" onClick={() => activate(r.id)}>
                    Rendi attiva
                  </Button>
                )}
                <Button size="icon" variant="ghost" onClick={() => remove(r)} aria-label="Elimina">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

// Le conferme passano da window.confirm solo per azioni distruttive rare nelle impostazioni.
function confirmDelete(what: string) {
  return typeof window === "undefined" ? false : window.confirm(`Eliminare ${what}?`);
}

function Categorie() {
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({
    queryKey: ["deadline_categories"],
    queryFn: async () =>
      ((await db.from("deadline_categories").select("*").order("sort")).data ?? []) as Row[],
  });
  const [n, setN] = useState<Row>({ name: "", color: "#0B2A5B", description: "" });
  const refresh = () => qc.invalidateQueries({ queryKey: ["deadline_categories"] });

  async function upsert(r: Row) {
    const payload = {
      name: String(r.name ?? "").trim(),
      color: r.color,
      description: r.description || null,
      sort: Number(r.sort ?? rows.length + 1),
    };
    if (!payload.name) return toast.error("Nome obbligatorio");
    const x = r.id
      ? await db.from("deadline_categories").update(payload).eq("id", r.id)
      : await db.from("deadline_categories").insert(payload);
    if (x.error) return toast.error(x.error.message);
    if (!r.id) setN({ name: "", color: "#0B2A5B", description: "" });
    refresh();
    toast.success("Categoria salvata");
  }
  async function remove(r: Row) {
    if (!confirmDelete(`la categoria ${r.name}`)) return;
    const x = await db.from("deadline_categories").delete().eq("id", r.id);
    if (x.error) return toast.error(x.error.message);
    refresh();
  }

  return (
    <Panel title="Categorie dello scadenzario">
      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_80px_2fr_auto]">
        <Input
          placeholder="Nome"
          value={n.name}
          onChange={(e) => setN({ ...n, name: e.target.value })}
        />
        <Input
          type="color"
          value={n.color}
          onChange={(e) => setN({ ...n, color: e.target.value })}
        />
        <Input
          placeholder="Descrizione"
          value={n.description}
          onChange={(e) => setN({ ...n, description: e.target.value })}
        />
        <Button onClick={() => upsert(n)}>
          <Plus className="h-4 w-4" />
          Aggiungi
        </Button>
      </div>
      <ul className="divide-y">
        {rows.map((r) => (
          <CatRow key={r.id} r={r} onSave={upsert} onDelete={remove} />
        ))}
      </ul>
    </Panel>
  );
}

function CatRow({
  r,
  onSave,
  onDelete,
}: {
  r: Row;
  onSave: (r: Row) => void;
  onDelete: (r: Row) => void;
}) {
  const [e, setE] = useState<Row>(r);
  return (
    <li className="grid items-center gap-2 py-2 sm:grid-cols-[60px_1fr_80px_2fr_auto]">
      <Input
        type="number"
        value={e.sort ?? 0}
        onChange={(x) => setE({ ...e, sort: x.target.value })}
      />
      <Input value={e.name} onChange={(x) => setE({ ...e, name: x.target.value })} />
      <Input
        type="color"
        value={e.color ?? "#0B2A5B"}
        onChange={(x) => setE({ ...e, color: x.target.value })}
      />
      <Input
        value={e.description ?? ""}
        onChange={(x) => setE({ ...e, description: x.target.value })}
      />
      <span className="flex gap-1">
        <Button size="icon" variant="outline" onClick={() => onSave(e)} aria-label="Salva">
          <Save className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={() => onDelete(r)} aria-label="Elimina">
          <Trash2 className="h-4 w-4" />
        </Button>
      </span>
    </li>
  );
}

function Checklist() {
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({
    queryKey: ["checklist_templates"],
    queryFn: async () =>
      ((await db.from("checklist_templates").select("*").order("sort")).data ?? []) as Row[],
  });
  const [n, setN] = useState<Row>({ area: "", task: "" });
  const refresh = () => qc.invalidateQueries({ queryKey: ["checklist_templates"] });

  async function add() {
    if (!n.area?.trim() || !n.task?.trim()) return toast.error("Area e attività obbligatorie");
    const x = await db
      .from("checklist_templates")
      .insert({ area: n.area.trim(), task: n.task.trim(), sort: rows.length + 1 });
    if (x.error) return toast.error(x.error.message);
    setN({ area: n.area, task: "" });
    refresh();
  }
  async function remove(id: string) {
    const x = await db.from("checklist_templates").delete().eq("id", id);
    if (x.error) return toast.error(x.error.message);
    refresh();
  }
  const areas = Array.from(new Set(rows.map((r) => r.area)));

  return (
    <Panel
      title="Modello di checklist del match day"
      actions={
        <span className="text-xs text-muted-foreground">
          Copiata in ogni nuova partita casalinga
        </span>
      }
    >
      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
        <Input
          list="checklist-areas"
          placeholder="Area (es. Sicurezza)"
          value={n.area}
          onChange={(e) => setN({ ...n, area: e.target.value })}
        />
        <datalist id="checklist-areas">
          {areas.map((a) => (
            <option key={a} value={a} />
          ))}
        </datalist>
        <Input
          placeholder="Attività"
          value={n.task}
          onChange={(e) => setN({ ...n, task: e.target.value })}
        />
        <Button onClick={add}>
          <Plus className="h-4 w-4" />
          Aggiungi
        </Button>
      </div>
      {!rows.length ? (
        <Empty>Nessuna attività.</Empty>
      ) : (
        areas.map((a) => (
          <div key={a} className="mb-3">
            <h3 className="mb-1 text-xs font-bold uppercase text-primary">{a}</h3>
            <ul className="divide-y rounded-lg border">
              {rows
                .filter((r) => r.area === a)
                .map((r) => (
                  <li key={r.id} className="flex items-center justify-between px-3 py-1.5 text-sm">
                    {r.task}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => remove(r.id)}
                      aria-label="Elimina"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
            </ul>
          </div>
        ))
      )}
    </Panel>
  );
}

const ALL_ROLES = Object.keys(ROLE_LABEL) as Role[];

function Utenti() {
  const qc = useQueryClient();
  const { session } = useAuth();
  const { data: users = [] } = useQuery({
    queryKey: ["profiles-all"],
    queryFn: async () =>
      ((await db.from("profiles").select("*").order("full_name")).data ?? []) as Row[],
  });
  const { data: roles = [] } = useQuery({
    queryKey: ["user_roles-all"],
    queryFn: async () => ((await db.from("user_roles").select("*")).data ?? []) as Row[],
  });
  const { data: teams = [] } = useQuery({
    queryKey: ["teams-min"],
    queryFn: async () =>
      ((await db.from("teams").select("id,name").order("name")).data ?? []) as Row[],
  });
  const [pick, setPick] = useState<Record<string, { role?: Role; team?: string }>>({});
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["user_roles-all"] });
    qc.invalidateQueries({ queryKey: ["my-roles"] });
  };

  async function add(uid: string) {
    const p = pick[uid];
    if (!p?.role) return toast.error("Scegli un ruolo");
    const x = await db.from("user_roles").insert({
      user_id: uid,
      role: p.role,
      team_id: p.team && p.team !== "__all" ? p.team : null,
    });
    if (x.error)
      return toast.error(
        x.error.message.includes("duplicate") ? "Ruolo già assegnato" : x.error.message,
      );
    refresh();
    toast.success("Ruolo assegnato");
  }
  async function remove(r: Row) {
    if (r.user_id === session?.user.id && r.role === "superadmin")
      return toast.error("Non puoi togliere a te stesso il ruolo di superadmin");
    const x = await db.from("user_roles").delete().eq("id", r.id);
    if (x.error) return toast.error(x.error.message);
    refresh();
  }

  return (
    <Panel title="Utenti e ruoli">
      <Notice tone="info">
        Gli utenti compaiono qui dopo la registrazione. Un ruolo di allenatore o dirigente può
        essere limitato a una squadra.
      </Notice>
      <ul className="mt-3 divide-y">
        {users.map((u) => {
          const mine = roles.filter((r) => r.user_id === u.id);
          return (
            <li key={u.id} className="grid gap-2 py-3 lg:grid-cols-[1fr_2fr]">
              <div>
                <div className="font-medium">{u.full_name || "—"}</div>
                <div className="text-xs text-muted-foreground">{u.email}</div>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-1">
                  {mine.length ? (
                    mine.map((r) => (
                      <span
                        key={r.id}
                        className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs"
                      >
                        {ROLE_LABEL[r.role as Role] ?? r.role}
                        {r.team_id &&
                          ` · ${teams.find((t) => t.id === r.team_id)?.name ?? "squadra"}`}
                        <button onClick={() => remove(r)} aria-label="Rimuovi ruolo">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Nessun ruolo: l'utente non vede dati.
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Select
                    value={pick[u.id]?.role ?? ""}
                    onValueChange={(v) =>
                      setPick({ ...pick, [u.id]: { ...pick[u.id], role: v as Role } })
                    }
                  >
                    <SelectTrigger className="w-52">
                      <SelectValue placeholder="Ruolo…" />
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={pick[u.id]?.team ?? "__all"}
                    onValueChange={(v) => setPick({ ...pick, [u.id]: { ...pick[u.id], team: v } })}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all">Tutte le squadre</SelectItem>
                      {teams.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" onClick={() => add(u.id)}>
                    <Plus className="h-4 w-4" />
                    Assegna
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

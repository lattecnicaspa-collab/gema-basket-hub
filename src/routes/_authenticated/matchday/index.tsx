import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import {
  CalendarClock,
  Check,
  ClipboardCheck,
  ExternalLink,
  HeartPulse,
  Pencil,
  Plus,
  Printer,
  Receipt,
  Trash2,
  Tv,
  Users,
  Utensils,
} from "lucide-react";
import { db } from "@/lib/db";
import { useActiveSeason } from "@/hooks/useClub";
import { useRoles } from "@/lib/auth";
import { eur, fmtDateTime, fmtLong, num, TICKET_LABEL } from "@/lib/format";
import {
  PageHeader,
  Panel,
  Pill,
  Empty,
  Notice,
  StatCard,
  FISCAL_TICKETS_WARNING,
} from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  CHANNEL_LABEL,
  LIST_TYPE_LABEL,
  MATCH_STATUS_LABEL,
  PAY_LABEL,
  TIER_LABEL,
  useMatches,
  type Match,
} from "./-shared";

export const Route = createFileRoute("/_authenticated/matchday/")({
  head: () => ({
    meta: [
      { title: "Match day – GEMA360" },
      {
        name: "description",
        content:
          "Partite casalinghe al PalaTerme: disponibilità, checklist, turni, hospitality e borderò.",
      },
    ],
  }),
  component: MatchdayPage,
});

const matchSchema = z.object({
  opponent: z.string().trim().min(2, "Avversario obbligatorio").max(120),
  round: z.number().int().min(0).max(99).nullable(),
  match_date: z.string().min(10, "Data e ora obbligatorie"),
  gates_open: z.string().nullable(),
  tier: z.enum(["normale", "cartello", "playoff"]),
  competition: z.string().max(80).nullable(),
  tv: z.string().max(120).nullable(),
  referees: z.string().max(300).nullable(),
  commissioner: z.string().max(120).nullable(),
  presale_url: z
    .string()
    .url("Link prevendita non valido")
    .nullable()
    .or(z.literal("").transform(() => null)),
  status: z.string(),
  home_score: z.number().int().min(0).nullable(),
  away_score: z.number().int().min(0).nullable(),
  notes: z.string().max(2000).nullable(),
});

const toLocalInput = (iso?: string) => (iso ? format(parseISO(iso), "yyyy-MM-dd'T'HH:mm") : "");
const nOrNull = (v: unknown) => (v === "" || v == null ? null : Number(v));

function MatchdayPage() {
  const qc = useQueryClient();
  const { data: season } = useActiveSeason();
  const { data: matches = [] } = useMatches(season?.id);
  const { hasAny } = useRoles();
  const canEdit = hasAny(["direttivo", "segreteria", "tesoriere", "responsabile_commerciale"]);
  const [edit, setEdit] = useState<Partial<Match> | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const opened = matches.find((m) => m.id === openId) ?? null;

  const now = Date.now();
  const upcoming = matches.filter((m) => new Date(m.match_date).getTime() >= now - 6 * 3600_000);
  const past = matches.filter((m) => new Date(m.match_date).getTime() < now - 6 * 3600_000);
  const next = upcoming[0];

  async function save() {
    if (!edit) return;
    const p = matchSchema.safeParse({
      opponent: edit.opponent ?? "",
      round: nOrNull(edit.round),
      match_date: edit.match_date ?? "",
      gates_open: edit.gates_open || null,
      tier: edit.tier ?? "normale",
      competition: edit.competition || "Serie A2",
      tv: edit.tv || null,
      referees: edit.referees || null,
      commissioner: edit.commissioner || null,
      presale_url: edit.presale_url || null,
      status: edit.status ?? "programmata",
      home_score: nOrNull(edit.home_score),
      away_score: nOrNull(edit.away_score),
      notes: edit.notes || null,
    });
    if (!p.success) return toast.error(p.error.issues[0].message);
    const payload = {
      ...p.data,
      match_date: new Date(p.data.match_date).toISOString(),
      season_id: edit.season_id ?? season?.id ?? null,
    };
    const r = edit.id
      ? await db.from("matches").update(payload).eq("id", edit.id)
      : await db.from("matches").insert(payload);
    if (r.error) return toast.error(r.error.message);
    toast.success("Partita salvata");
    setEdit(null);
    qc.invalidateQueries({ queryKey: ["matches"] });
  }

  async function remove(m: Match) {
    if (
      !confirmDelete(
        `Eliminare la partita contro ${m.opponent}? Verranno eliminati anche vendite, accrediti e checklist collegati.`,
      )
    )
      return;
    const r = await db.from("matches").delete().eq("id", m.id);
    if (r.error) return toast.error(r.error.message);
    toast.success("Partita eliminata");
    qc.invalidateQueries({ queryKey: ["matches"] });
  }

  return (
    <div>
      <PageHeader
        title="Match day"
        subtitle={`Partite casalinghe al PalaTerme${season ? ` · stagione ${season.name}` : ""}`}
        actions={
          canEdit ? (
            <Button
              size="sm"
              variant="destructive"
              onClick={() =>
                setEdit({
                  tier: "normale",
                  status: "programmata",
                  competition: "Serie A2",
                  gates_open: "17:00",
                })
              }
            >
              <Plus className="h-4 w-4" />
              Nuova partita
            </Button>
          ) : null
        }
      />

      {next && (
        <div className="mb-6 overflow-hidden rounded-xl bg-primary text-primary-foreground shadow-card">
          <div className="h-1.5 bg-stripe" />
          <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest opacity-80">
                Prossima partita casalinga
              </div>
              <div className="font-display text-3xl font-bold uppercase">
                Gema vs {next.opponent}
              </div>
              <div className="text-sm opacity-90">
                {fmtLong(next.match_date)} · cancelli {next.gates_open?.slice(0, 5) ?? "—"} ·{" "}
                {TIER_LABEL[next.tier] ?? next.tier}
                {next.tv ? ` · ${next.tv}` : ""}
              </div>
            </div>
            <Button variant="secondary" onClick={() => setOpenId(next.id)}>
              <ClipboardCheck className="h-4 w-4" />
              Apri match day
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-6">
        <MatchList
          title="In programma"
          rows={upcoming}
          onOpen={setOpenId}
          onEdit={canEdit ? setEdit : undefined}
          onDelete={canEdit ? remove : undefined}
        />
        <MatchList
          title="Giocate"
          rows={[...past].reverse()}
          onOpen={setOpenId}
          onEdit={canEdit ? setEdit : undefined}
          onDelete={canEdit ? remove : undefined}
        />
      </div>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{edit?.id ? "Modifica partita" : "Nuova partita"}</DialogTitle>
          </DialogHeader>
          {edit && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Avversario">
                <Input
                  value={edit.opponent ?? ""}
                  onChange={(e) => setEdit({ ...edit, opponent: e.target.value })}
                />
              </Field>
              <Field label="Giornata">
                <Input
                  type="number"
                  value={edit.round ?? ""}
                  onChange={(e) => setEdit({ ...edit, round: e.target.value as unknown as number })}
                />
              </Field>
              <Field label="Data e ora">
                <Input
                  type="datetime-local"
                  value={
                    edit.match_date?.includes("T") && edit.match_date.length <= 16
                      ? edit.match_date
                      : toLocalInput(edit.match_date)
                  }
                  onChange={(e) => setEdit({ ...edit, match_date: e.target.value })}
                />
              </Field>
              <Field label="Apertura cancelli">
                <Input
                  type="time"
                  value={edit.gates_open?.slice(0, 5) ?? ""}
                  onChange={(e) => setEdit({ ...edit, gates_open: e.target.value })}
                />
              </Field>
              <Field label="Fascia prezzi">
                <Select
                  value={edit.tier ?? "normale"}
                  onValueChange={(v) => setEdit({ ...edit, tier: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["normale", "cartello", "playoff"].map((t) => (
                      <SelectItem key={t} value={t}>
                        {TIER_LABEL[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Stato">
                <Select
                  value={edit.status ?? "programmata"}
                  onValueChange={(v) => setEdit({ ...edit, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(MATCH_STATUS_LABEL).map(([k, l]) => (
                      <SelectItem key={k} value={k}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Competizione">
                <Input
                  value={edit.competition ?? ""}
                  onChange={(e) => setEdit({ ...edit, competition: e.target.value })}
                />
              </Field>
              <Field label="Diretta TV / streaming">
                <Input
                  value={edit.tv ?? ""}
                  onChange={(e) => setEdit({ ...edit, tv: e.target.value })}
                />
              </Field>
              <Field label="Arbitri">
                <Input
                  value={edit.referees ?? ""}
                  onChange={(e) => setEdit({ ...edit, referees: e.target.value })}
                />
              </Field>
              <Field label="Commissario">
                <Input
                  value={edit.commissioner ?? ""}
                  onChange={(e) => setEdit({ ...edit, commissioner: e.target.value })}
                />
              </Field>
              <Field label="Link prevendita (TicketOne…)" className="sm:col-span-2">
                <Input
                  placeholder="https://"
                  value={edit.presale_url ?? ""}
                  onChange={(e) => setEdit({ ...edit, presale_url: e.target.value })}
                />
              </Field>
              <Field label="Punti Gema">
                <Input
                  type="number"
                  value={edit.home_score ?? ""}
                  onChange={(e) =>
                    setEdit({ ...edit, home_score: e.target.value as unknown as number })
                  }
                />
              </Field>
              <Field label="Punti ospiti">
                <Input
                  type="number"
                  value={edit.away_score ?? ""}
                  onChange={(e) =>
                    setEdit({ ...edit, away_score: e.target.value as unknown as number })
                  }
                />
              </Field>
              <Field label="Note" className="sm:col-span-2">
                <Textarea
                  value={edit.notes ?? ""}
                  onChange={(e) => setEdit({ ...edit, notes: e.target.value })}
                />
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>
              Annulla
            </Button>
            <Button onClick={save}>Salva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!opened} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
          {opened && <MatchDetail match={opened} canEdit={canEdit} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function confirmDelete(msg: string) {
  // conferma nativa non bloccante per gli strumenti di automazione: usata solo su azione esplicita dell'utente
  return typeof window === "undefined" ? false : window.confirm(msg);
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function MatchList({
  title,
  rows,
  onOpen,
  onEdit,
  onDelete,
}: {
  title: string;
  rows: Match[];
  onOpen: (id: string) => void;
  onEdit?: ((m: Match) => void) | undefined;
  onDelete?: ((m: Match) => void) | undefined;
}) {
  return (
    <Panel title={`${title} (${rows.length})`}>
      {!rows.length ? (
        <Empty>Nessuna partita.</Empty>
      ) : (
        <div className="grid gap-2">
          {rows.map((m) => (
            <div
              key={m.id}
              className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center"
            >
              <button className="flex-1 text-left" onClick={() => onOpen(m.id)}>
                <div className="flex flex-wrap items-center gap-2">
                  {m.round != null && <Pill tone="navy">G{m.round}</Pill>}
                  <span className="font-display text-lg font-bold uppercase text-primary">
                    vs {m.opponent}
                  </span>
                  {m.tier !== "normale" && <Pill tone="red">{TIER_LABEL[m.tier] ?? m.tier}</Pill>}
                  <Pill tone={m.status === "chiusa" ? "fatto" : "ok"}>
                    {MATCH_STATUS_LABEL[m.status] ?? m.status}
                  </Pill>
                  {m.home_score != null && m.away_score != null && (
                    <span className="font-bold tabular-nums">
                      {m.home_score}–{m.away_score}
                    </span>
                  )}
                  {!m.aed_checked && m.status !== "chiusa" && (
                    <Pill tone="scaduto">DAE da verificare</Pill>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {fmtDateTime(m.match_date)}
                  {m.tv ? ` · ${m.tv}` : ""}
                </div>
              </button>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => onOpen(m.id)}>
                  Apri
                </Button>
                {onEdit && (
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Modifica"
                    onClick={() => onEdit(m)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                {onDelete && (
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Elimina"
                    onClick={() => onDelete(m)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/* ------------------------------ DETTAGLIO PARTITA ------------------------------ */

function MatchDetail({ match, canEdit }: { match: Match; canEdit: boolean }) {
  return (
    <div>
      <DialogHeader>
        <DialogTitle className="font-display text-2xl uppercase text-primary">
          Gema vs {match.opponent}
        </DialogTitle>
        <div className="text-sm text-muted-foreground">
          {fmtLong(match.match_date)} · cancelli {match.gates_open?.slice(0, 5) ?? "—"}
          {match.presale_url && (
            <>
              {" "}
              ·{" "}
              <a
                className="inline-flex items-center gap-1 text-accent underline"
                href={match.presale_url}
                target="_blank"
                rel="noreferrer"
              >
                prevendita <ExternalLink className="h-3 w-3" />
              </a>
            </>
          )}
        </div>
      </DialogHeader>
      <Tabs defaultValue="disponibilita" className="mt-4">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="disponibilita">
            <Users className="mr-1 h-4 w-4" />
            Disponibilità
          </TabsTrigger>
          <TabsTrigger value="checklist">
            <ClipboardCheck className="mr-1 h-4 w-4" />
            Checklist
          </TabsTrigger>
          <TabsTrigger value="turni">
            <CalendarClock className="mr-1 h-4 w-4" />
            Turni
          </TabsTrigger>
          <TabsTrigger value="hospitality">
            <Utensils className="mr-1 h-4 w-4" />
            Hospitality
          </TabsTrigger>
          <TabsTrigger value="sicurezza">
            <HeartPulse className="mr-1 h-4 w-4" />
            Sicurezza
          </TabsTrigger>
          <TabsTrigger value="bordero">
            <Receipt className="mr-1 h-4 w-4" />
            Borderò
          </TabsTrigger>
        </TabsList>
        <TabsContent value="disponibilita">
          <Availability match={match} />
        </TabsContent>
        <TabsContent value="checklist">
          <Checklist match={match} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="turni">
          <Shifts match={match} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="hospitality">
          <Hospitality match={match} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="sicurezza">
          <Safety match={match} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="bordero">
          <Bordero match={match} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

type Avail = {
  sector_id: string;
  sector_name: string;
  capacity: number;
  subscribers: number;
  accreditations: number;
  sold: number;
  free: number;
  entered: number;
};

function Availability({ match }: { match: Match }) {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["availability", match.id],
    queryFn: async () => {
      const { data, error } = await db.rpc("match_availability", { _match: match.id });
      if (error) throw error;
      return (data ?? []) as Avail[];
    },
    refetchInterval: 10_000,
  });
  const tot = rows.reduce(
    (a, r) => ({
      cap: a.cap + Number(r.capacity),
      sub: a.sub + Number(r.subscribers),
      acc: a.acc + Number(r.accreditations),
      sold: a.sold + Number(r.sold),
      free: a.free + Number(r.free),
      ent: a.ent + Number(r.entered),
    }),
    { cap: 0, sub: 0, acc: 0, sold: 0, free: 0, ent: 0 },
  );
  if (isLoading) return <Empty>Caricamento…</Empty>;
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Capienza" value={num(tot.cap)} />
        <StatCard
          label="Occupati"
          value={num(tot.sub + tot.acc + tot.sold)}
          hint={`${num(tot.sub)} abb. · ${num(tot.acc)} accr. · ${num(tot.sold)} venduti`}
          tone="navy"
        />
        <StatCard
          label="Posti liberi"
          value={num(tot.free)}
          tone={tot.free < 0 ? "red" : "green"}
        />
        <StatCard label="Entrati" value={num(tot.ent)} tone="orange" />
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Settore</TableHead>
              <TableHead className="text-right">Capienza</TableHead>
              <TableHead className="text-right">Abbonati</TableHead>
              <TableHead className="text-right">Accrediti</TableHead>
              <TableHead className="text-right">Venduti</TableHead>
              <TableHead className="text-right">Liberi</TableHead>
              <TableHead className="text-right">Entrati</TableHead>
              <TableHead className="w-40">Riempimento</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const used = Number(r.capacity) - Number(r.free);
              const pct = Number(r.capacity)
                ? Math.min(100, Math.round((used / Number(r.capacity)) * 100))
                : 0;
              return (
                <TableRow key={r.sector_id}>
                  <TableCell className="font-medium">{r.sector_name}</TableCell>
                  <TableCell className="text-right tabular-nums">{num(r.capacity)}</TableCell>
                  <TableCell className="text-right tabular-nums">{num(r.subscribers)}</TableCell>
                  <TableCell className="text-right tabular-nums">{num(r.accreditations)}</TableCell>
                  <TableCell className="text-right tabular-nums">{num(r.sold)}</TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-bold tabular-nums",
                      Number(r.free) < 0
                        ? "text-destructive"
                        : Number(r.free) < 20
                          ? "text-warning"
                          : "text-success",
                    )}
                  >
                    {num(r.free)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{num(r.entered)}</TableCell>
                  <TableCell>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div
                        className={cn("h-2 rounded-full", pct >= 95 ? "bg-accent" : "bg-primary")}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {tot.free < 0 && (
        <Notice tone="danger">
          Attenzione: in almeno un settore i posti assegnati superano la capienza autorizzata.
        </Notice>
      )}
    </div>
  );
}

type ChecklistRow = {
  id: string;
  area: string;
  task: string;
  assignee: string | null;
  done: boolean;
  notes: string | null;
  sort: number | null;
};

function Checklist({ match, canEdit }: { match: Match; canEdit: boolean }) {
  const qc = useQueryClient();
  const key = ["match_checklist", match.id];
  const { data: rows = [] } = useQuery({
    queryKey: key,
    queryFn: async () =>
      ((await db.from("match_checklist").select("*").eq("match_id", match.id).order("sort")).data ??
        []) as ChecklistRow[],
  });
  const [newTask, setNewTask] = useState({ area: "", task: "" });
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  async function generate() {
    const { data: tpl, error } = await db.from("checklist_templates").select("*").order("sort");
    if (error) return toast.error(error.message);
    const existing = new Set(rows.map((r) => `${r.area}|${r.task}`));
    const toAdd = (tpl ?? [])
      .filter((t: { area: string; task: string }) => !existing.has(`${t.area}|${t.task}`))
      .map((t: { area: string; task: string; sort: number }) => ({
        match_id: match.id,
        area: t.area,
        task: t.task,
        sort: t.sort,
      }));
    if (!toAdd.length) return toast.info("La checklist contiene già tutte le voci del modello");
    const r = await db.from("match_checklist").insert(toAdd);
    if (r.error) return toast.error(r.error.message);
    toast.success(`${toAdd.length} voci aggiunte dal modello`);
    refresh();
  }
  async function patch(id: string, p: Partial<ChecklistRow>) {
    const r = await db.from("match_checklist").update(p).eq("id", id);
    if (r.error) return toast.error(r.error.message);
    refresh();
  }
  async function add() {
    if (newTask.task.trim().length < 2) return toast.error("Scrivi l'attività");
    const r = await db.from("match_checklist").insert({
      match_id: match.id,
      area: newTask.area.trim() || "Varie",
      task: newTask.task.trim(),
      sort: 999,
    });
    if (r.error) return toast.error(r.error.message);
    setNewTask({ area: newTask.area, task: "" });
    refresh();
  }
  async function remove(id: string) {
    const r = await db.from("match_checklist").delete().eq("id", id);
    if (r.error) return toast.error(r.error.message);
    refresh();
  }

  const groups = useMemo(() => {
    const g = new Map<string, ChecklistRow[]>();
    rows.forEach((r) => g.set(r.area, [...(g.get(r.area) ?? []), r]));
    return [...g.entries()];
  }, [rows]);
  const done = rows.filter((r) => r.done).length;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm">
          <b>{done}</b> / {rows.length} completate
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <Button size="sm" variant="outline" onClick={generate}>
              <ClipboardCheck className="h-4 w-4" />
              Genera dal modello
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Stampa
          </Button>
        </div>
      </div>
      {rows.length > 0 && (
        <div className="h-2 w-full rounded-full bg-muted">
          <div
            className="h-2 rounded-full bg-success"
            style={{ width: `${Math.round((done / rows.length) * 100)}%` }}
          />
        </div>
      )}
      {!rows.length && (
        <Empty>
          Checklist vuota. Premi “Genera dal modello” per caricare le attività standard del match
          day.
        </Empty>
      )}
      {groups.map(([area, items]) => (
        <div key={area} className="rounded-lg border">
          <div className="border-b bg-secondary px-3 py-2 text-sm font-bold uppercase text-primary">
            {area}
          </div>
          <div className="divide-y">
            {items.map((r) => (
              <div key={r.id} className="flex flex-col gap-2 p-2 sm:flex-row sm:items-center">
                <label className="flex flex-1 items-center gap-3">
                  <Checkbox
                    checked={r.done}
                    disabled={!canEdit}
                    onCheckedChange={(v) => patch(r.id, { done: !!v })}
                    className="h-5 w-5"
                  />
                  <span className={cn("text-sm", r.done && "text-muted-foreground line-through")}>
                    {r.task}
                  </span>
                </label>
                <Input
                  className="h-8 sm:w-48"
                  placeholder="Incaricato"
                  defaultValue={r.assignee ?? ""}
                  disabled={!canEdit}
                  onBlur={(e) =>
                    e.target.value !== (r.assignee ?? "") &&
                    patch(r.id, { assignee: e.target.value || null })
                  }
                />
                {canEdit && (
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Elimina voce"
                    onClick={() => remove(r.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      {canEdit && (
        <div className="grid gap-2 rounded-lg border border-dashed p-3 sm:grid-cols-[180px_1fr_auto]">
          <Input
            placeholder="Area (es. Sicurezza)"
            value={newTask.area}
            onChange={(e) => setNewTask({ ...newTask, area: e.target.value })}
          />
          <Input
            placeholder="Nuova attività"
            value={newTask.task}
            onChange={(e) => setNewTask({ ...newTask, task: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <Button onClick={add}>
            <Plus className="h-4 w-4" />
            Aggiungi
          </Button>
        </div>
      )}
    </div>
  );
}

type ShiftRow = {
  id: string;
  role: string;
  person_name: string;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
};

function Shifts({ match, canEdit }: { match: Match; canEdit: boolean }) {
  const qc = useQueryClient();
  const key = ["match_shifts", match.id];
  const { data: rows = [] } = useQuery({
    queryKey: key,
    queryFn: async () =>
      ((await db.from("match_shifts").select("*").eq("match_id", match.id).order("start_time"))
        .data ?? []) as ShiftRow[],
  });
  const [f, setF] = useState({
    role: "Steward",
    person_name: "",
    start_time: match.gates_open?.slice(0, 5) ?? "",
    end_time: "",
    notes: "",
  });
  async function add() {
    if (f.person_name.trim().length < 2) return toast.error("Nome obbligatorio");
    const r = await db.from("match_shifts").insert({
      match_id: match.id,
      role: f.role.trim() || "Volontario",
      person_name: f.person_name.trim(),
      start_time: f.start_time || null,
      end_time: f.end_time || null,
      notes: f.notes || null,
    });
    if (r.error) return toast.error(r.error.message);
    setF({ ...f, person_name: "", notes: "" });
    qc.invalidateQueries({ queryKey: key });
  }
  async function remove(id: string) {
    const r = await db.from("match_shifts").delete().eq("id", id);
    if (r.error) return toast.error(r.error.message);
    qc.invalidateQueries({ queryKey: key });
  }
  const roles = [
    "Steward",
    "Security",
    "Botteghino",
    "Volontario",
    "Speaker",
    "Ufficiali di campo",
    "Statistiche",
    "Hospitality",
    "Pulizie",
    "Addetto DAE/BLSD",
  ];
  return (
    <div className="grid gap-4">
      {canEdit && (
        <div className="grid gap-2 rounded-lg border border-dashed p-3 sm:grid-cols-[170px_1fr_110px_110px_auto]">
          <Select value={f.role} onValueChange={(v) => setF({ ...f, role: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roles.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Nome e cognome"
            value={f.person_name}
            onChange={(e) => setF({ ...f, person_name: e.target.value })}
          />
          <Input
            type="time"
            value={f.start_time}
            onChange={(e) => setF({ ...f, start_time: e.target.value })}
            aria-label="Inizio"
          />
          <Input
            type="time"
            value={f.end_time}
            onChange={(e) => setF({ ...f, end_time: e.target.value })}
            aria-label="Fine"
          />
          <Button onClick={add}>
            <Plus className="h-4 w-4" />
            Aggiungi
          </Button>
        </div>
      )}
      {!rows.length ? (
        <Empty>Nessun turno assegnato.</Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ruolo</TableHead>
              <TableHead>Persona</TableHead>
              <TableHead>Orario</TableHead>
              <TableHead>Note</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Pill tone="navy">{r.role}</Pill>
                </TableCell>
                <TableCell className="font-medium">{r.person_name}</TableCell>
                <TableCell className="tabular-nums">
                  {r.start_time?.slice(0, 5) ?? "—"} – {r.end_time?.slice(0, 5) ?? "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.notes}</TableCell>
                <TableCell>
                  {canEdit && (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Elimina turno"
                      onClick={() => remove(r.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

type HospRow = {
  id: string;
  caterer: string | null;
  guests: number | null;
  cost: number | null;
  menu: string | null;
  notes: string | null;
};

function Hospitality({ match, canEdit }: { match: Match; canEdit: boolean }) {
  const qc = useQueryClient();
  const key = ["hospitality", match.id];
  const { data: row } = useQuery({
    queryKey: key,
    queryFn: async () =>
      ((await db.from("hospitality_events").select("*").eq("match_id", match.id).maybeSingle())
        .data ?? null) as HospRow | null,
  });
  const { data: guests = [] } = useQuery({
    queryKey: ["hosp-guests", match.id],
    queryFn: async () =>
      (
        await db
          .from("accreditations")
          .select("id,full_name,organization,list_type")
          .eq("match_id", match.id)
          .eq("is_hospitality", true)
          .order("organization")
      ).data ?? [],
  });
  const [f, setF] = useState<Partial<HospRow> | null>(null);
  const form = f ?? row ?? { caterer: "", guests: guests.length, cost: 0, menu: "", notes: "" };
  async function save() {
    const payload = {
      match_id: match.id,
      caterer: form.caterer || null,
      guests: Number(form.guests ?? 0),
      cost: Number(form.cost ?? 0),
      menu: form.menu || null,
      notes: form.notes || null,
    };
    const r = row
      ? await db.from("hospitality_events").update(payload).eq("id", row.id)
      : await db.from("hospitality_events").insert(payload);
    if (r.error) return toast.error(r.error.message);
    toast.success("Hospitality salvata");
    setF(null);
    qc.invalidateQueries({ queryKey: key });
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Catering e costi">
        <div className="grid gap-3">
          <Field label="Fornitore catering">
            <Input
              disabled={!canEdit}
              value={form.caterer ?? ""}
              onChange={(e) => setF({ ...form, caterer: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ospiti previsti">
              <Input
                disabled={!canEdit}
                type="number"
                value={form.guests ?? 0}
                onChange={(e) => setF({ ...form, guests: Number(e.target.value) })}
              />
            </Field>
            <Field label="Costo (€)">
              <Input
                disabled={!canEdit}
                type="number"
                step="0.01"
                value={form.cost ?? 0}
                onChange={(e) => setF({ ...form, cost: Number(e.target.value) })}
              />
            </Field>
          </div>
          <Field label="Menu">
            <Textarea
              disabled={!canEdit}
              value={form.menu ?? ""}
              onChange={(e) => setF({ ...form, menu: e.target.value })}
            />
          </Field>
          <Field label="Note">
            <Textarea
              disabled={!canEdit}
              value={form.notes ?? ""}
              onChange={(e) => setF({ ...form, notes: e.target.value })}
            />
          </Field>
          <div className="text-xs text-muted-foreground">
            Costo per ospite:{" "}
            {eur(Number(form.guests) ? Number(form.cost) / Number(form.guests) : 0)}
          </div>
          {canEdit && (
            <Button onClick={save}>
              <Check className="h-4 w-4" />
              Salva
            </Button>
          )}
        </div>
      </Panel>
      <Panel title={`Invitati hospitality (${guests.length})`}>
        {!guests.length ? (
          <Empty>
            Nessun ospite hospitality: gli sponsor li inseriscono dal portale o li aggiungi da
            Accrediti.
          </Empty>
        ) : (
          <div className="max-h-96 divide-y overflow-y-auto">
            {guests.map(
              (g: {
                id: string;
                full_name: string;
                organization: string | null;
                list_type: string;
              }) => (
                <div key={g.id} className="flex items-center justify-between py-1.5 text-sm">
                  <span>{g.full_name}</span>
                  <span className="text-xs text-muted-foreground">
                    {g.organization ?? LIST_TYPE_LABEL[g.list_type]}
                  </span>
                </div>
              ),
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}

function Safety({ match, canEdit }: { match: Match; canEdit: boolean }) {
  const qc = useQueryClient();
  const [op, setOp] = useState(match.blsd_operator ?? "");
  async function patch(p: Partial<Match>) {
    const r = await db.from("matches").update(p).eq("id", match.id);
    if (r.error) return toast.error(r.error.message);
    toast.success("Aggiornato");
    qc.invalidateQueries({ queryKey: ["matches"] });
  }
  const ok = match.aed_checked && !!match.blsd_operator;
  return (
    <div className="grid gap-4">
      {ok ? (
        <Notice tone="info">
          Sicurezza sanitaria a posto: DAE verificato e operatore BLSD indicato (
          {match.blsd_operator}).
        </Notice>
      ) : (
        <div className="rounded-xl border-2 border-destructive bg-destructive/10 p-4 font-bold text-destructive">
          ⚠ PARTITA NON IN REGOLA: {!match.aed_checked && "DAE non verificato. "}
          {!match.blsd_operator && "Manca l'operatore BLSD presente."} Il DM 26/06/2017 richiede DAE
          funzionante e una persona formata BLSD durante la gara.
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Panel title="Defibrillatore (DAE)">
          <label className="flex items-center gap-3 text-sm">
            <Switch
              checked={match.aed_checked}
              disabled={!canEdit}
              onCheckedChange={(v) => patch({ aed_checked: v })}
            />
            DAE presente, in manutenzione e funzionante (verificato prima della gara)
          </label>
        </Panel>
        <Panel title="Operatore BLSD">
          <div className="flex gap-2">
            <Input
              disabled={!canEdit}
              placeholder="Nome e cognome (brevetto valido)"
              value={op}
              onChange={(e) => setOp(e.target.value)}
            />
            {canEdit && (
              <Button onClick={() => patch({ blsd_operator: op.trim() || null })}>Salva</Button>
            )}
          </div>
        </Panel>
      </div>
      <div className="text-xs text-muted-foreground">
        Arbitri: {match.referees ?? "—"} · Commissario: {match.commissioner ?? "—"}
        {match.tv && (
          <>
            {" "}
            · <Tv className="inline h-3 w-3" /> {match.tv}
          </>
        )}
      </div>
    </div>
  );
}

type Sale = {
  sector_id: string | null;
  ticket_type: string;
  qty: number;
  total: number;
  payment_method: string;
  channel: string;
};

function Bordero({ match }: { match: Match }) {
  const qc = useQueryClient();
  const { hasAny } = useRoles();
  const canRegister = hasAny(["tesoriere", "direttivo"]);
  const { data } = useQuery({
    queryKey: ["bordero", match.id],
    queryFn: async () => {
      const [sales, subs, accr, entries, sectors] = await Promise.all([
        db
          .from("ticket_sales")
          .select("sector_id,ticket_type,qty,total,payment_method,channel")
          .eq("match_id", match.id),
        db
          .from("subscribers")
          .select("sector_id")
          .eq("season_id", match.season_id)
          .eq("paid", true),
        db
          .from("accreditations")
          .select("sector_id,list_type,is_hospitality")
          .eq("match_id", match.id),
        db.from("entries").select("sector_id,kind").eq("match_id", match.id),
        db.from("sectors").select("id,name,capacity").order("sort"),
      ]);
      return {
        sales: (sales.data ?? []) as Sale[],
        subs: (subs.data ?? []) as { sector_id: string | null }[],
        accr: (accr.data ?? []) as {
          sector_id: string | null;
          list_type: string;
          is_hospitality: boolean;
        }[],
        entries: (entries.data ?? []) as { sector_id: string | null; kind: string }[],
        sectors: (sectors.data ?? []) as { id: string; name: string; capacity: number }[],
      };
    },
  });
  if (!data) return <Empty>Caricamento…</Empty>;
  const { sales, subs, accr, entries, sectors } = data;
  const isPaid = (s: Sale) => Number(s.total) > 0;

  const bySector = sectors.map((s) => {
    const ss = sales.filter((x) => x.sector_id === s.id);
    const paganti = ss.filter(isPaid).reduce((a, x) => a + Number(x.qty), 0);
    const omaggi = ss.filter((x) => !isPaid(x)).reduce((a, x) => a + Number(x.qty), 0);
    const abbonati = subs.filter((x) => x.sector_id === s.id).length;
    const accrediti = accr.filter((x) => x.sector_id === s.id).length;
    const entrati = entries.filter((x) => x.sector_id === s.id).length;
    const incasso = ss.reduce((a, x) => a + Number(x.total), 0);
    return {
      ...s,
      paganti,
      omaggi,
      abbonati,
      accrediti,
      entrati,
      totale: paganti + omaggi + abbonati + accrediti,
      incasso,
    };
  });
  const T = bySector.reduce(
    (a, r) => ({
      cap: a.cap + r.capacity,
      pag: a.pag + r.paganti,
      omg: a.omg + r.omaggi,
      abb: a.abb + r.abbonati,
      acc: a.acc + r.accrediti,
      ent: a.ent + r.entrati,
      tot: a.tot + r.totale,
      inc: a.inc + r.incasso,
    }),
    { cap: 0, pag: 0, omg: 0, abb: 0, acc: 0, ent: 0, tot: 0, inc: 0 },
  );

  const byType = Object.entries(
    sales.reduce<Record<string, { qty: number; total: number }>>((a, s) => {
      const k = s.ticket_type;
      a[k] = { qty: (a[k]?.qty ?? 0) + Number(s.qty), total: (a[k]?.total ?? 0) + Number(s.total) };
      return a;
    }, {}),
  );
  const byChannel = Object.entries(
    sales.reduce<Record<string, { qty: number; total: number }>>((a, s) => {
      const k =
        s.channel === "online"
          ? "Prevendita online"
          : `${CHANNEL_LABEL[s.channel] ?? s.channel} – ${PAY_LABEL[s.payment_method] ?? s.payment_method}`;
      a[k] = { qty: (a[k]?.qty ?? 0) + Number(s.qty), total: (a[k]?.total ?? 0) + Number(s.total) };
      return a;
    }, {}),
  );
  const accrByList = Object.entries(
    accr.reduce<Record<string, number>>((a, x) => {
      const k = x.is_hospitality ? "Hospitality" : (LIST_TYPE_LABEL[x.list_type] ?? x.list_type);
      a[k] = (a[k] ?? 0) + 1;
      return a;
    }, {}),
  );

  async function register() {
    const r = await db.rpc("register_bordero", { _match: match.id });
    if (r.error) return toast.error(r.error.message);
    toast.success(`Borderò registrato in prima nota (${r.data ?? 0} movimenti, area commerciale)`);
    qc.invalidateQueries({ queryKey: ["matches"] });
    qc.invalidateQueries({ queryKey: ["bordero", match.id] });
  }

  return (
    <div className="grid gap-4 print-area">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            Borderò di fine partita
          </div>
          <div className="font-display text-xl font-bold uppercase text-primary">
            Gema vs {match.opponent} · {fmtDateTime(match.match_date)}
          </div>
        </div>
        <div className="no-print flex gap-2">
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Stampa / PDF
          </Button>
          {canRegister && (
            <Button size="sm" variant="destructive" onClick={register}>
              <Receipt className="h-4 w-4" />
              Registra in prima nota
            </Button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Spettatori totali"
          value={num(T.tot)}
          hint={`capienza ${num(T.cap)}`}
          tone="navy"
        />
        <StatCard label="Paganti" value={num(T.pag)} hint={`${num(T.omg)} omaggi`} />
        <StatCard
          label="Abbonati + accrediti"
          value={num(T.abb + T.acc)}
          hint={`${num(T.abb)} abb. · ${num(T.acc)} accr.`}
        />
        <StatCard label="Incasso" value={eur(T.inc)} tone="red" />
      </div>
      {T.tot > T.cap && (
        <Notice tone="danger">
          Spettatori ({num(T.tot)}) oltre la capienza autorizzata ({num(T.cap)}).
        </Notice>
      )}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Settore</TableHead>
              <TableHead className="text-right">Capienza</TableHead>
              <TableHead className="text-right">Paganti</TableHead>
              <TableHead className="text-right">Omaggi</TableHead>
              <TableHead className="text-right">Abbonati</TableHead>
              <TableHead className="text-right">Accrediti</TableHead>
              <TableHead className="text-right">Totale</TableHead>
              <TableHead className="text-right">Entrati (QR)</TableHead>
              <TableHead className="text-right">Incasso</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bySector.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="text-right tabular-nums">{num(r.capacity)}</TableCell>
                <TableCell className="text-right tabular-nums">{num(r.paganti)}</TableCell>
                <TableCell className="text-right tabular-nums">{num(r.omaggi)}</TableCell>
                <TableCell className="text-right tabular-nums">{num(r.abbonati)}</TableCell>
                <TableCell className="text-right tabular-nums">{num(r.accrediti)}</TableCell>
                <TableCell
                  className={cn(
                    "text-right font-bold tabular-nums",
                    r.totale > r.capacity && "text-destructive",
                  )}
                >
                  {num(r.totale)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{num(r.entrati)}</TableCell>
                <TableCell className="text-right tabular-nums">{eur(r.incasso)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell>Totale</TableCell>
              <TableCell className="text-right">{num(T.cap)}</TableCell>
              <TableCell className="text-right">{num(T.pag)}</TableCell>
              <TableCell className="text-right">{num(T.omg)}</TableCell>
              <TableCell className="text-right">{num(T.abb)}</TableCell>
              <TableCell className="text-right">{num(T.acc)}</TableCell>
              <TableCell className="text-right">{num(T.tot)}</TableCell>
              <TableCell className="text-right">{num(T.ent)}</TableCell>
              <TableCell className="text-right">{eur(T.inc)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Panel title="Per tipologia">
          {byType.map(([k, v]) => (
            <Row key={k} l={TICKET_LABEL[k] ?? k} q={v.qty} t={v.total} />
          ))}
          {!byType.length && <Empty>Nessuna vendita</Empty>}
        </Panel>
        <Panel title="Incasso per canale">
          {byChannel.map(([k, v]) => (
            <Row key={k} l={k} q={v.qty} t={v.total} />
          ))}
          {!byChannel.length && <Empty>Nessun incasso</Empty>}
        </Panel>
        <Panel title="Omaggi e accrediti">
          {accrByList.map(([k, v]) => (
            <Row key={k} l={k} q={v} />
          ))}
          {!accrByList.length && <Empty>Nessun accredito</Empty>}
        </Panel>
      </div>
      <div className="no-print">
        <Notice>{FISCAL_TICKETS_WARNING}</Notice>
      </div>
    </div>
  );
}

function Row({ l, q, t }: { l: string; q: number; t?: number }) {
  return (
    <div className="flex items-center justify-between border-b py-1.5 text-sm last:border-0">
      <span>{l}</span>
      <span className="tabular-nums">
        <b>{num(q)}</b>
        {t != null && <span className="ml-2 text-muted-foreground">{eur(t)}</span>}
      </span>
    </div>
  );
}

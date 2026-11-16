import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import {
  addMonths,
  endOfMonth,
  format,
  getDay,
  startOfMonth,
  eachDayOfInterval,
  parseISO,
} from "date-fns";
import { it } from "date-fns/locale";
import {
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  FileDown,
  Plus,
  Printer,
  Rss,
  Trash2,
} from "lucide-react";
import { db } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useClub } from "@/hooks/useClub";
import {
  eur,
  fmtDate,
  urgency,
  todayISO,
  STATUS_LABEL,
  RECURRENCE_LABEL,
  daysUntil,
} from "@/lib/format";
import { buildICS, downloadCSV, downloadFile } from "@/lib/export";
import { PageHeader, Pill, UrgencyDot, Empty, StatCard } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/scadenzario")({
  head: () => ({
    meta: [
      { title: "Scadenzario – GEMA360" },
      { name: "description", content: "Scadenzario unico della società." },
      { property: "og:title", content: "Scadenzario – GEMA360" },
      { property: "og:description", content: "Tutte le scadenze in un unico posto." },
    ],
  }),
  component: Scadenzario,
});

type Deadline = {
  id: string;
  title: string;
  category: string;
  due_date: string;
  recurrence: string;
  amount: number | null;
  owner_id: string | null;
  status: string;
  notes: string | null;
  done_at: string | null;
  attachment_url: string | null;
  link_type: string | null;
  source: string | null;
  reminder_days: number[];
};

const schema = z.object({
  title: z.string().trim().min(2, "Titolo obbligatorio").max(200),
  category: z.string().min(1),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida"),
  recurrence: z.enum(["una_volta", "mensile", "trimestrale", "annuale", "stagione"]),
  amount: z.number().nonnegative().nullable(),
  owner_id: z.string().uuid().nullable(),
  status: z.enum(["da_fare", "in_corso", "fatto", "annullato"]),
  notes: z.string().max(2000).nullable(),
  reminder_days: z.array(z.number().int().min(0).max(365)),
});

function Scadenzario() {
  const qc = useQueryClient();
  const { session } = useAuth();
  const { data: club } = useClub();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("tutte");
  const [st, setSt] = useState("aperte");
  const [edit, setEdit] = useState<Partial<Deadline> | null>(null);
  const [done, setDone] = useState<Deadline | null>(null);
  const [del, setDel] = useState<Deadline | null>(null);

  const { data: rows = [] } = useQuery({
    queryKey: ["deadlines"],
    queryFn: async () =>
      (await db.from("deadlines").select("*").is("deleted_at", null).order("due_date"))
        .data as Deadline[],
  });
  const { data: cats = [] } = useQuery({
    queryKey: ["deadline_categories"],
    queryFn: async () =>
      (await db.from("deadline_categories").select("*").order("sort")).data ?? [],
  });
  const { data: users = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => (await db.from("profiles").select("id,full_name,email")).data ?? [],
  });
  const userName = (id: string | null) =>
    users.find((u: { id: string }) => u.id === id)?.full_name ?? "—";
  const catColor = (n: string) => cats.find((c: { name: string }) => c.name === n)?.color ?? "#888";

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (cat !== "tutte" && r.category !== cat) return false;
        if (st === "aperte" && (r.status === "fatto" || r.status === "annullato")) return false;
        if (st !== "aperte" && st !== "tutte" && r.status !== st) return false;
        if (q && !r.title.toLowerCase().includes(q.toLowerCase())) return false;
        return true;
      }),
    [rows, cat, st, q],
  );
  const mine = filtered.filter((r) => r.owner_id === session?.user.id);

  const open = rows.filter((r) => r.status !== "fatto" && r.status !== "annullato");
  const stats = {
    overdue: open.filter((r) => daysUntil(r.due_date) < 0).length,
    w7: open.filter((r) => daysUntil(r.due_date) >= 0 && daysUntil(r.due_date) <= 7).length,
    d30: open.filter((r) => daysUntil(r.due_date) > 7 && daysUntil(r.due_date) <= 30).length,
  };

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["deadlines"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  async function save() {
    const p = schema.safeParse({
      title: edit?.title ?? "",
      category: edit?.category ?? "Personalizzate",
      due_date: edit?.due_date ?? "",
      recurrence: edit?.recurrence ?? "una_volta",
      amount: edit?.amount != null && String(edit.amount) !== "" ? Number(edit.amount) : null,
      owner_id: edit?.owner_id || null,
      status: edit?.status ?? "da_fare",
      notes: edit?.notes || null,
      reminder_days: edit?.reminder_days ?? [30, 15, 7, 1],
    });
    if (!p.success) return toast.error(p.error.issues[0].message);
    const r = edit?.id
      ? await db.from("deadlines").update(p.data).eq("id", edit.id)
      : await db.from("deadlines").insert(p.data);
    if (r.error) return toast.error(r.error.message);
    toast.success("Scadenza salvata");
    setEdit(null);
    refresh();
  }

  async function softDelete() {
    if (!del) return;
    const r = await db
      .from("deadlines")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", del.id);
    if (r.error) return toast.error(r.error.message);
    setDel(null);
    refresh();
    toast.success("Scadenza eliminata");
  }

  const exportRows = () =>
    filtered.map((r) => ({
      Scadenza: fmtDate(r.due_date),
      Titolo: r.title,
      Categoria: r.category,
      Ricorrenza: RECURRENCE_LABEL[r.recurrence],
      Importo: r.amount ?? "",
      Responsabile: userName(r.owner_id),
      Stato: STATUS_LABEL[r.status],
      Note: r.notes ?? "",
    }));
  const feedUrl =
    typeof window !== "undefined" && club?.ical_token
      ? `${window.location.origin}/api/public/ical/${club.ical_token}`
      : "";

  return (
    <div>
      <PageHeader
        title="Scadenzario"
        subtitle="Fiscale, FIP/Lega, sponsor, PalaTerme, sanità, contratti e adempimenti societari"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadCSV("scadenzario.csv", exportRows())}
            >
              <Download className="h-4 w-4" />
              Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                downloadFile(
                  "scadenzario.ics",
                  buildICS(
                    filtered.map((r) => ({
                      id: r.id,
                      title: r.title,
                      date: r.due_date,
                      description: r.category,
                    })),
                    "Scadenzario Gema",
                  ),
                  "text/calendar",
                )
              }
            >
              <CalendarPlus className="h-4 w-4" />
              iCal
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(feedUrl);
                toast.success(
                  "Link del feed copiato: incollalo in Google Calendar → Aggiungi da URL",
                );
              }}
            >
              <Rss className="h-4 w-4" />
              Feed
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() =>
                setEdit({
                  category: "Personalizzate",
                  recurrence: "una_volta",
                  status: "da_fare",
                  due_date: todayISO(),
                  reminder_days: [30, 15, 7, 1],
                })
              }
            >
              <Plus className="h-4 w-4" />
              Nuova scadenza
            </Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <StatCard tone="red" label="Scadute" value={stats.overdue} />
        <StatCard tone="orange" label="Entro 7 giorni" value={stats.w7} />
        <StatCard label="Entro 30 giorni" value={stats.d30} />
      </div>

      <div className="no-print mb-4 flex flex-wrap gap-2">
        <Input
          placeholder="Cerca…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-56"
        />
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tutte">Tutte le categorie</SelectItem>
            {cats.map((c: { id: string; name: string }) => (
              <SelectItem key={c.id} value={c.name}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={st} onValueChange={setSt}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="aperte">Aperte</SelectItem>
            <SelectItem value="tutte">Tutte</SelectItem>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="elenco">
        <TabsList className="no-print">
          <TabsTrigger value="elenco">Elenco</TabsTrigger>
          <TabsTrigger value="calendario">Calendario</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="mie">Le mie scadenze</TabsTrigger>
        </TabsList>
        <TabsContent value="elenco">
          <List
            rows={filtered}
            userName={userName}
            catColor={catColor}
            onEdit={setEdit}
            onDone={setDone}
            onDelete={setDel}
          />
        </TabsContent>
        <TabsContent value="calendario">
          <MonthCalendar rows={filtered} onOpen={setEdit} />
        </TabsContent>
        <TabsContent value="timeline">
          <Timeline rows={filtered} catColor={catColor} />
        </TabsContent>
        <TabsContent value="mie">
          {mine.length ? (
            <List
              rows={mine}
              userName={userName}
              catColor={catColor}
              onEdit={setEdit}
              onDone={setDone}
              onDelete={setDel}
            />
          ) : (
            <Empty>Nessuna scadenza assegnata a te.</Empty>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{edit?.id ? "Modifica scadenza" : "Nuova scadenza"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Titolo</Label>
              <Input
                value={edit?.title ?? ""}
                onChange={(e) => setEdit({ ...edit, title: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoria</Label>
                <Select
                  value={edit?.category}
                  onValueChange={(v) => setEdit({ ...edit, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {cats.map((c: { id: string; name: string }) => (
                      <SelectItem key={c.id} value={c.name}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data scadenza</Label>
                <Input
                  type="date"
                  value={edit?.due_date ?? ""}
                  onChange={(e) => setEdit({ ...edit, due_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Ricorrenza</Label>
                <Select
                  value={edit?.recurrence}
                  onValueChange={(v) => setEdit({ ...edit, recurrence: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(RECURRENCE_LABEL).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Importo (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={edit?.amount ?? ""}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      amount: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </div>
              <div>
                <Label>Responsabile</Label>
                <Select
                  value={edit?.owner_id ?? "none"}
                  onValueChange={(v) => setEdit({ ...edit, owner_id: v === "none" ? null : v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nessuno</SelectItem>
                    {users.map((u: { id: string; full_name: string }) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Stato</Label>
                <Select value={edit?.status} onValueChange={(v) => setEdit({ ...edit, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABEL).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Giorni di preavviso (separati da virgola)</Label>
              <Input
                value={(edit?.reminder_days ?? []).join(", ")}
                onChange={(e) =>
                  setEdit({
                    ...edit,
                    reminder_days: e.target.value
                      .split(",")
                      .map((x) => parseInt(x.trim()))
                      .filter((n) => !isNaN(n)),
                  })
                }
              />
            </div>
            <div>
              <Label>Note</Label>
              <Textarea
                value={edit?.notes ?? ""}
                onChange={(e) => setEdit({ ...edit, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>
              Annulla
            </Button>
            <Button onClick={save}>Salva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DoneDialog d={done} onClose={() => setDone(null)} onDone={refresh} />

      <AlertDialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare la scadenza?</AlertDialogTitle>
            <AlertDialogDescription>
              “{del?.title}” verrà archiviata (eliminazione logica, resta nel registro modifiche).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={softDelete}>Elimina</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function List({
  rows,
  userName,
  catColor,
  onEdit,
  onDone,
  onDelete,
}: {
  rows: Deadline[];
  userName: (id: string | null) => string;
  catColor: (n: string) => string;
  onEdit: (d: Deadline) => void;
  onDone: (d: Deadline) => void;
  onDelete: (d: Deadline) => void;
}) {
  if (!rows.length) return <Empty>Nessuna scadenza con questi filtri.</Empty>;
  const rowTone: Record<string, string> = {
    scaduto: "bg-destructive/10",
    "7": "bg-warning/15",
    "30": "bg-caution/25",
    ok: "",
    fatto: "opacity-60",
  };
  return (
    <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
      <table className="w-full text-sm">
        <thead className="bg-primary text-left text-xs uppercase text-primary-foreground">
          <tr>
            <th className="p-3">Scadenza</th>
            <th className="p-3">Titolo</th>
            <th className="hidden p-3 md:table-cell">Categoria</th>
            <th className="hidden p-3 lg:table-cell">Ricorrenza</th>
            <th className="p-3 text-right">Importo</th>
            <th className="hidden p-3 md:table-cell">Resp.</th>
            <th className="p-3">Stato</th>
            <th className="no-print p-3" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const u = urgency(r.due_date, r.status);
            const d = daysUntil(r.due_date);
            return (
              <tr key={r.id} className={cn("border-t", rowTone[u])}>
                <td className="p-3 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <UrgencyDot u={u} />
                    <b className="tabular-nums">{fmtDate(r.due_date)}</b>
                  </div>
                  {u !== "fatto" && (
                    <div className="text-xs text-muted-foreground">
                      {d < 0 ? `scaduta da ${-d} gg` : d === 0 ? "oggi" : `tra ${d} gg`}
                    </div>
                  )}
                </td>
                <td className="p-3">
                  <button
                    className="text-left font-medium hover:underline"
                    onClick={() => onEdit(r)}
                  >
                    {r.title}
                  </button>
                  {r.source && (
                    <div className="text-xs text-muted-foreground">Generata automaticamente</div>
                  )}
                  {r.done_at && (
                    <div className="text-xs text-success">Fatto il {fmtDate(r.done_at)}</div>
                  )}
                </td>
                <td className="hidden p-3 md:table-cell">
                  <span className="inline-flex items-center gap-1.5 text-xs">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: catColor(r.category) }}
                    />
                    {r.category}
                  </span>
                </td>
                <td className="hidden p-3 text-xs lg:table-cell">
                  {RECURRENCE_LABEL[r.recurrence]}
                </td>
                <td className="p-3 text-right tabular-nums">{r.amount ? eur(r.amount) : ""}</td>
                <td className="hidden p-3 text-xs md:table-cell">{userName(r.owner_id)}</td>
                <td className="p-3">
                  <Pill tone={u === "fatto" ? "fatto" : u}>{STATUS_LABEL[r.status]}</Pill>
                </td>
                <td className="no-print p-3 whitespace-nowrap text-right">
                  {r.status !== "fatto" && (
                    <Button size="sm" variant="outline" onClick={() => onDone(r)}>
                      <Check className="h-4 w-4" />
                      Fatto
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onDelete(r)}
                    aria-label="Elimina"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DoneDialog({
  d,
  onClose,
  onDone,
}: {
  d: Deadline | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [date, setDate] = useState(todayISO());
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  async function confirm() {
    if (!d) return;
    setBusy(true);
    let path: string | null = null;
    if (file) {
      path = `scadenze/${d.id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const up = await supabase.storage.from("documenti").upload(path, file);
      if (up.error) {
        setBusy(false);
        return toast.error("Caricamento allegato non riuscito: " + up.error.message);
      }
    }
    const r = await db.rpc("complete_deadline", { _id: d.id, _done: date, _attachment: path });
    setBusy(false);
    if (r.error) return toast.error(r.error.message);
    toast.success(r.data ? "Fatto! Creata la prossima occorrenza." : "Scadenza completata");
    setFile(null);
    onClose();
    onDone();
  }
  return (
    <Dialog open={!!d} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Segna come fatto</DialogTitle>
        </DialogHeader>
        <p className="text-sm">{d?.title}</p>
        {d && d.recurrence !== "una_volta" && (
          <p className="text-xs text-muted-foreground">
            Ricorrenza {RECURRENCE_LABEL[d.recurrence].toLowerCase()}: verrà generata subito la
            prossima occorrenza.
          </p>
        )}
        <div className="grid gap-3">
          <div>
            <Label>Data</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Allegato (es. quietanza F24)</Label>
            <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annulla
          </Button>
          <Button onClick={confirm} disabled={busy}>
            <Check className="h-4 w-4" />
            Conferma
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MonthCalendar({ rows, onOpen }: { rows: Deadline[]; onOpen: (d: Deadline) => void }) {
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const offset = (getDay(days[0]) + 6) % 7;
  const byDay = (iso: string) => rows.filter((r) => r.due_date === iso);
  return (
    <div className="rounded-xl border bg-card p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => setMonth(addMonths(month, -1))}>
          <ChevronLeft />
        </Button>
        <h3 className="font-display text-2xl font-bold uppercase capitalize text-primary">
          {format(month, "MMMM yyyy", { locale: it })}
        </h3>
        <Button variant="ghost" size="icon" onClick={() => setMonth(addMonths(month, 1))}>
          <ChevronRight />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase text-muted-foreground">
        {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: offset }).map((_, i) => (
          <div key={"e" + i} />
        ))}
        {days.map((day) => {
          const iso = format(day, "yyyy-MM-dd");
          const items = byDay(iso);
          const isToday = iso === todayISO();
          return (
            <div
              key={iso}
              className={cn(
                "min-h-20 rounded-md border p-1 text-left",
                isToday && "border-accent ring-1 ring-accent",
              )}
            >
              <div className="text-xs font-semibold">{format(day, "d")}</div>
              {items.slice(0, 3).map((r) => {
                const u = urgency(r.due_date, r.status);
                return (
                  <button
                    key={r.id}
                    onClick={() => onOpen(r)}
                    className={cn(
                      "mt-0.5 block w-full truncate rounded px-1 text-left text-[10px]",
                      u === "scaduto"
                        ? "bg-destructive text-destructive-foreground"
                        : u === "7"
                          ? "bg-warning text-warning-foreground"
                          : u === "30"
                            ? "bg-caution text-caution-foreground"
                            : u === "fatto"
                              ? "bg-success/30"
                              : "bg-secondary",
                    )}
                  >
                    {r.title}
                  </button>
                );
              })}
              {items.length > 3 && (
                <div className="text-[10px] text-muted-foreground">+{items.length - 3}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Timeline({ rows, catColor }: { rows: Deadline[]; catColor: (n: string) => string }) {
  const groups = rows.reduce<Record<string, Deadline[]>>((acc, r) => {
    const k = r.due_date.slice(0, 7);
    (acc[k] ||= []).push(r);
    return acc;
  }, {});
  if (!rows.length) return <Empty>Nessuna scadenza.</Empty>;
  return (
    <div className="space-y-6">
      {Object.entries(groups).map(([k, items]) => (
        <div key={k}>
          <h3 className="mb-2 font-display text-xl font-bold uppercase capitalize text-primary">
            {format(parseISO(k + "-01"), "MMMM yyyy", { locale: it })}
          </h3>
          <ol className="relative ml-3 border-l-2 border-primary/20">
            {items.map((r) => (
              <li key={r.id} className="mb-3 ml-4">
                <span
                  className="absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full ring-2 ring-background"
                  style={{ background: catColor(r.category) }}
                />
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <b className="tabular-nums">{fmtDate(r.due_date)}</b>
                  <span>{r.title}</span>
                  <Pill tone={urgency(r.due_date, r.status)}>{STATUS_LABEL[r.status]}</Pill>
                  {r.amount ? <span className="text-muted-foreground">{eur(r.amount)}</span> : null}
                </div>
                <div className="text-xs text-muted-foreground">{r.category}</div>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

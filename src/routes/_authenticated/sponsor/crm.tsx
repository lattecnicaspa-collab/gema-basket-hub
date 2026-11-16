import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Pencil,
  Plus,
  Phone,
  Check,
  Printer,
} from "lucide-react";
import { db } from "@/lib/db";
import { useAuth } from "@/lib/auth";
import { useClub, useActiveSeason } from "@/hooks/useClub";
import { eur, fmtDate, todayISO, STAGE_LABEL, daysUntil } from "@/lib/format";
import { PageHeader, Pill, Empty } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/sponsor/crm")({
  head: () => ({
    meta: [
      { title: "CRM sponsor – GEMA360" },
      { name: "description", content: "Pipeline commerciale sponsor." },
    ],
  }),
  component: Crm,
});

const STAGES = ["contatto", "proposta", "trattativa", "firmato", "rinnovo", "perso"] as const;
const ACT_TYPES: Record<string, string> = {
  chiamata: "Chiamata",
  incontro: "Incontro",
  email: "Email",
  proposta: "Proposta",
  altro: "Altro",
};

type Sponsor = {
  id: string;
  name: string;
  level_id: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  vat_number: string | null;
  address: string | null;
  website: string | null;
  pipeline_stage: string;
  expected_value: number | null;
  notes: string | null;
};
type Level = { id: string; name: string; list_price: number | null; sort: number };
type Activity = {
  id: string;
  sponsor_id: string;
  type: string;
  activity_date: string;
  notes: string | null;
  reminder_date: string | null;
  done: boolean | null;
};
type Asset = {
  id: string;
  name: string;
  category: string;
  unit: string | null;
  quantity: number;
  price: number;
  season_id: string | null;
};

const schema = z.object({
  name: z.string().trim().min(2, "Ragione sociale obbligatoria").max(200),
  level_id: z.string().uuid().nullable(),
  contact_name: z.string().max(200).nullable(),
  email: z.string().email("Email non valida").nullable().or(z.literal(null)),
  phone: z.string().max(50).nullable(),
  vat_number: z.string().max(30).nullable(),
  address: z.string().max(300).nullable(),
  website: z.string().max(300).nullable(),
  pipeline_stage: z.enum(STAGES),
  expected_value: z.number().nonnegative().nullable(),
  notes: z.string().max(4000).nullable(),
});
const nz = (v: unknown) => (v === "" || v === undefined ? null : v);

function Crm() {
  const qc = useQueryClient();
  const [edit, setEdit] = useState<Partial<Sponsor> | null>(null);
  const [acts, setActs] = useState<Sponsor | null>(null);
  const [proposal, setProposal] = useState<Sponsor | null>(null);
  const [q, setQ] = useState("");

  const { data: sponsors = [] } = useQuery({
    queryKey: ["sponsors"],
    queryFn: async () =>
      ((await db.from("sponsors").select("*").is("deleted_at", null).order("name")).data ??
        []) as Sponsor[],
  });
  const { data: levels = [] } = useQuery({
    queryKey: ["sponsor_levels"],
    queryFn: async () =>
      ((await db.from("sponsor_levels").select("*").order("sort")).data ?? []) as Level[],
  });
  const { data: activities = [] } = useQuery({
    queryKey: ["crm_activities"],
    queryFn: async () =>
      ((await db.from("crm_activities").select("*").order("activity_date", { ascending: false }))
        .data ?? []) as Activity[],
  });
  const levelName = (id: string | null) => levels.find((l) => l.id === id)?.name ?? "";
  const refresh = () => qc.invalidateQueries({ queryKey: ["sponsors"] });

  async function move(s: Sponsor, dir: -1 | 1) {
    const idx = STAGES.indexOf(s.pipeline_stage as (typeof STAGES)[number]);
    const next = STAGES[Math.max(0, Math.min(STAGES.length - 1, idx + dir))];
    if (next === s.pipeline_stage) return;
    const r = await db.from("sponsors").update({ pipeline_stage: next }).eq("id", s.id);
    if (r.error) return toast.error(r.error.message);
    toast.success(`${s.name} → ${STAGE_LABEL[next]}`);
    refresh();
  }

  async function save() {
    const p = schema.safeParse({
      name: edit?.name ?? "",
      level_id: nz(edit?.level_id),
      contact_name: nz(edit?.contact_name),
      email: nz(edit?.email),
      phone: nz(edit?.phone),
      vat_number: nz(edit?.vat_number),
      address: nz(edit?.address),
      website: nz(edit?.website),
      pipeline_stage: edit?.pipeline_stage ?? "contatto",
      expected_value:
        edit?.expected_value != null && String(edit.expected_value) !== ""
          ? Number(edit.expected_value)
          : null,
      notes: nz(edit?.notes),
    });
    if (!p.success) return toast.error(p.error.issues[0].message);
    const r = edit?.id
      ? await db.from("sponsors").update(p.data).eq("id", edit.id)
      : await db.from("sponsors").insert(p.data);
    if (r.error) return toast.error(r.error.message);
    toast.success("Sponsor salvato");
    setEdit(null);
    refresh();
  }

  const list = sponsors.filter((s) => !q || s.name.toLowerCase().includes(q.toLowerCase()));
  const pending = (sid: string) =>
    activities.filter((a) => a.sponsor_id === sid && !a.done && a.reminder_date);

  return (
    <div>
      <PageHeader
        title="CRM sponsor"
        subtitle="Pipeline commerciale: Contatto → Proposta → Trattativa → Firmato → Rinnovo / Perso"
        actions={
          <>
            <Input
              placeholder="Cerca sponsor…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-52"
            />
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setEdit({ pipeline_stage: "contatto" })}
            >
              <Plus className="h-4 w-4" />
              Nuovo sponsor
            </Button>
          </>
        }
      />

      <div className="flex gap-3 overflow-x-auto pb-4">
        {STAGES.map((st) => {
          const col = list.filter((s) => s.pipeline_stage === st);
          const tot = col.reduce((s, x) => s + Number(x.expected_value ?? 0), 0);
          return (
            <div
              key={st}
              className={cn(
                "w-72 shrink-0 rounded-xl border bg-muted/40 p-2",
                st === "firmato" && "border-success",
                st === "perso" && "opacity-70",
              )}
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <h3 className="font-bold uppercase text-primary">{STAGE_LABEL[st]}</h3>
                <Pill tone="navy">{col.length}</Pill>
              </div>
              <div className="mb-2 px-1 text-xs text-muted-foreground">
                Valore atteso {eur(tot)}
              </div>
              <div className="space-y-2">
                {col.map((s) => {
                  const rem = pending(s.id);
                  return (
                    <div key={s.id} className="rounded-lg border bg-card p-3 shadow-card">
                      <div className="flex items-start justify-between gap-2">
                        <button
                          className="text-left font-semibold hover:underline"
                          onClick={() => setEdit(s)}
                        >
                          {s.name}
                        </button>
                        {s.level_id && <Pill tone="red">{levelName(s.level_id)}</Pill>}
                      </div>
                      {s.contact_name && (
                        <div className="text-xs text-muted-foreground">
                          {s.contact_name}
                          {s.phone ? ` · ${s.phone}` : ""}
                        </div>
                      )}
                      {s.expected_value != null && (
                        <div className="mt-1 text-sm tabular-nums">{eur(s.expected_value)}</div>
                      )}
                      {rem.length > 0 && (
                        <div className="mt-1 text-xs">
                          <Pill
                            tone={
                              rem.some((a) => daysUntil(a.reminder_date!) < 0) ? "scaduto" : "7"
                            }
                          >
                            Richiamo {fmtDate(rem[0].reminder_date)}
                          </Pill>
                        </div>
                      )}
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            disabled={st === STAGES[0]}
                            onClick={() => move(s, -1)}
                            aria-label="Indietro"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            disabled={st === STAGES[STAGES.length - 1]}
                            onClick={() => move(s, 1)}
                            aria-label="Avanti"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => setActs(s)}
                            aria-label="Attività"
                          >
                            <Phone className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => setProposal(s)}
                            aria-label="Proposta PDF"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => setEdit(s)}
                            aria-label="Modifica"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {!col.length && (
                  <div className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
                    Vuoto
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{edit?.id ? "Modifica sponsor" : "Nuovo sponsor"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Ragione sociale</Label>
              <Input
                value={edit?.name ?? ""}
                onChange={(e) => setEdit({ ...edit, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Livello</Label>
              <Select
                value={edit?.level_id ?? "none"}
                onValueChange={(v) => setEdit({ ...edit, level_id: v === "none" ? null : v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {levels.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fase</Label>
              <Select
                value={edit?.pipeline_stage ?? "contatto"}
                onValueChange={(v) => setEdit({ ...edit, pipeline_stage: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STAGE_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Referente</Label>
              <Input
                value={edit?.contact_name ?? ""}
                onChange={(e) => setEdit({ ...edit, contact_name: e.target.value })}
              />
            </div>
            <div>
              <Label>Telefono</Label>
              <Input
                value={edit?.phone ?? ""}
                onChange={(e) => setEdit({ ...edit, phone: e.target.value })}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={edit?.email ?? ""}
                onChange={(e) => setEdit({ ...edit, email: e.target.value })}
              />
            </div>
            <div>
              <Label>P.IVA</Label>
              <Input
                value={edit?.vat_number ?? ""}
                onChange={(e) => setEdit({ ...edit, vat_number: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Indirizzo</Label>
              <Input
                value={edit?.address ?? ""}
                onChange={(e) => setEdit({ ...edit, address: e.target.value })}
              />
            </div>
            <div>
              <Label>Sito web</Label>
              <Input
                value={edit?.website ?? ""}
                onChange={(e) => setEdit({ ...edit, website: e.target.value })}
              />
            </div>
            <div>
              <Label>Valore atteso (€)</Label>
              <Input
                type="number"
                step="0.01"
                value={edit?.expected_value ?? ""}
                onChange={(e) =>
                  setEdit({
                    ...edit,
                    expected_value: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </div>
            <div className="sm:col-span-2">
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

      <ActivitiesDialog sponsor={acts} activities={activities} onClose={() => setActs(null)} />
      <ProposalDialog sponsor={proposal} levelName={levelName} onClose={() => setProposal(null)} />
    </div>
  );
}

function ActivitiesDialog({
  sponsor,
  activities,
  onClose,
}: {
  sponsor: Sponsor | null;
  activities: Activity[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { session } = useAuth();
  const [form, setForm] = useState<{
    type: string;
    activity_date: string;
    notes: string;
    reminder_date: string;
  }>({ type: "chiamata", activity_date: todayISO(), notes: "", reminder_date: "" });
  const rows = activities.filter((a) => a.sponsor_id === sponsor?.id);
  const refresh = () => qc.invalidateQueries({ queryKey: ["crm_activities"] });
  async function add() {
    if (!sponsor) return;
    if (!form.notes.trim()) return toast.error("Scrivi una nota");
    const r = await db.from("crm_activities").insert({
      sponsor_id: sponsor.id,
      type: form.type,
      activity_date: form.activity_date,
      notes: form.notes.trim().slice(0, 4000),
      reminder_date: form.reminder_date || null,
      created_by: session?.user.id ?? null,
    });
    if (r.error) return toast.error(r.error.message);
    setForm({ type: "chiamata", activity_date: todayISO(), notes: "", reminder_date: "" });
    refresh();
    toast.success("Attività registrata");
  }
  async function toggle(a: Activity) {
    const r = await db.from("crm_activities").update({ done: !a.done }).eq("id", a.id);
    if (r.error) return toast.error(r.error.message);
    refresh();
  }
  return (
    <Dialog open={!!sponsor} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Attività – {sponsor?.name}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-4">
          <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ACT_TYPES).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={form.activity_date}
            onChange={(e) => setForm({ ...form, activity_date: e.target.value })}
            aria-label="Data"
          />
          <div className="sm:col-span-2">
            <Input
              type="date"
              value={form.reminder_date}
              onChange={(e) => setForm({ ...form, reminder_date: e.target.value })}
              aria-label="Promemoria"
              title="Data promemoria (facoltativa)"
            />
          </div>
          <Textarea
            className="sm:col-span-4"
            placeholder="Esito, prossimi passi…"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
          <div className="sm:col-span-4 flex justify-end">
            <Button size="sm" onClick={add}>
              <Plus className="h-4 w-4" />
              Aggiungi
            </Button>
          </div>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {rows.length ? (
            <ul className="divide-y text-sm">
              {rows.map((a) => (
                <li
                  key={a.id}
                  className={cn("flex items-start gap-3 py-2", a.done && "opacity-60")}
                >
                  <Checkbox
                    checked={!!a.done}
                    onCheckedChange={() => toggle(a)}
                    aria-label="Completata"
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex flex-wrap gap-2">
                      <b>{ACT_TYPES[a.type] ?? a.type}</b>
                      <span className="text-muted-foreground">{fmtDate(a.activity_date)}</span>
                      {a.reminder_date && !a.done && (
                        <Pill
                          tone={
                            daysUntil(a.reminder_date) < 0
                              ? "scaduto"
                              : daysUntil(a.reminder_date) <= 7
                                ? "7"
                                : "ok"
                          }
                        >
                          Promemoria {fmtDate(a.reminder_date)}
                        </Pill>
                      )}
                    </div>
                    <div className="whitespace-pre-wrap">{a.notes}</div>
                  </div>
                  {a.done && <Check className="h-4 w-4 text-success" />}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Nessuna attività registrata.</Empty>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProposalDialog({
  sponsor,
  levelName,
  onClose,
}: {
  sponsor: Sponsor | null;
  levelName: (id: string | null) => string;
  onClose: () => void;
}) {
  const { data: club } = useClub();
  const { data: season } = useActiveSeason();
  const [sel, setSel] = useState<Record<string, number>>({});
  const [discount, setDiscount] = useState(0);
  const { data: assets = [] } = useQuery({
    queryKey: ["sponsor_assets"],
    queryFn: async () =>
      ((await db.from("sponsor_assets").select("*").order("category").order("name")).data ??
        []) as Asset[],
  });
  const list = assets.filter((a) => !season || !a.season_id || a.season_id === season.id);
  const chosen = list.filter((a) => (sel[a.id] ?? 0) > 0);
  const subtotal = chosen.reduce((s, a) => s + Number(a.price) * sel[a.id], 0);
  const total = Math.max(0, subtotal - (subtotal * discount) / 100);

  return (
    <Dialog
      open={!!sponsor}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          setSel({});
          setDiscount(0);
        }
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader className="no-print">
          <DialogTitle>Proposta commerciale – {sponsor?.name}</DialogTitle>
        </DialogHeader>
        <div className="no-print grid gap-2">
          <p className="text-sm text-muted-foreground">
            Scegli gli spazi e le quantità, poi premi Stampa / PDF.
          </p>
          <div className="max-h-64 overflow-y-auto rounded-lg border">
            <table className="w-full text-sm">
              <tbody>
                {list.map((a) => (
                  <tr key={a.id} className="border-t">
                    <td className="p-2">
                      {a.name}
                      <div className="text-xs text-muted-foreground">
                        {a.category} · {a.unit}
                      </div>
                    </td>
                    <td className="p-2 text-right tabular-nums">{eur(a.price)}</td>
                    <td className="w-24 p-2">
                      <Input
                        type="number"
                        min={0}
                        max={a.quantity}
                        value={sel[a.id] ?? 0}
                        onChange={(e) =>
                          setSel({ ...sel, [a.id]: Math.max(0, Number(e.target.value)) })
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-2">
            <Label>Sconto %</Label>
            <Input
              className="w-24"
              type="number"
              min={0}
              max={100}
              value={discount}
              onChange={(e) => setDiscount(Math.min(100, Math.max(0, Number(e.target.value))))}
            />
          </div>
        </div>

        <section className="print-area mt-4 rounded-xl border bg-white p-6 text-black">
          <div className="mb-4 flex items-center justify-between border-b-4 border-[#C8102E] pb-3">
            <div>
              <div className="text-xs uppercase tracking-widest text-[#0B2A5B]">
                Proposta di sponsorizzazione
              </div>
              <h2 className="text-2xl font-bold text-[#0B2A5B]">
                {club?.name ?? "La T Tecnica Gema Montecatini"}
              </h2>
              <div className="text-sm">
                Stagione {season?.name ?? "2026/27"} · {club?.venue_name ?? "PalaTerme"}
              </div>
            </div>
            {club?.logo_url && (
              <img src={club.logo_url} alt="Logo" className="h-16 w-16 object-contain" />
            )}
          </div>
          <p className="mb-3 text-sm">
            Spett.le <b>{sponsor?.name}</b>
            {sponsor?.contact_name ? `, alla c.a. di ${sponsor.contact_name}` : ""}
            {sponsor?.level_id ? ` – livello proposto: ${levelName(sponsor.level_id)}` : ""}
          </p>
          {chosen.length ? (
            <table className="w-full text-sm">
              <thead className="bg-[#0B2A5B] text-left text-white">
                <tr>
                  <th className="p-2">Spazio</th>
                  <th className="p-2">Q.tà</th>
                  <th className="p-2 text-right">Prezzo</th>
                  <th className="p-2 text-right">Totale</th>
                </tr>
              </thead>
              <tbody>
                {chosen.map((a) => (
                  <tr key={a.id} className="border-b">
                    <td className="p-2">
                      {a.name}
                      <div className="text-xs text-gray-500">{a.category}</div>
                    </td>
                    <td className="p-2">{sel[a.id]}</td>
                    <td className="p-2 text-right">{eur(a.price)}</td>
                    <td className="p-2 text-right">{eur(Number(a.price) * sel[a.id])}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="p-2 text-right">
                    Imponibile listino
                  </td>
                  <td className="p-2 text-right">{eur(subtotal)}</td>
                </tr>
                {discount > 0 && (
                  <tr>
                    <td colSpan={3} className="p-2 text-right">
                      Sconto {discount}%
                    </td>
                    <td className="p-2 text-right">− {eur(subtotal - total)}</td>
                  </tr>
                )}
                <tr className="font-bold text-[#C8102E]">
                  <td colSpan={3} className="p-2 text-right">
                    Totale proposto (IVA 22% esclusa)
                  </td>
                  <td className="p-2 text-right">{eur(total)}</td>
                </tr>
              </tfoot>
            </table>
          ) : (
            <p className="text-sm text-gray-500">Nessuno spazio selezionato.</p>
          )}
          <p className="mt-6 text-xs text-gray-600">
            Proposta valida 30 giorni dal {fmtDate(todayISO())}.{" "}
            {club?.footer_text ?? "Main sponsor La T Tecnica S.p.A."}
          </p>
        </section>
        <DialogFooter className="no-print">
          <Button variant="outline" onClick={onClose}>
            Chiudi
          </Button>
          <Button onClick={() => window.print()} disabled={!chosen.length}>
            <Printer className="h-4 w-4" />
            Stampa / PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

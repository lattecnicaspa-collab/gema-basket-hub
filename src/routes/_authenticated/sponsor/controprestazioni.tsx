import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Download, ExternalLink, Plus, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { fmtDate, todayISO, daysUntil, fmtDateTime } from "@/lib/format";
import { downloadCSV } from "@/lib/export";
import { PageHeader, Pill, Empty, StatCard } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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

export const Route = createFileRoute("/_authenticated/sponsor/controprestazioni")({
  head: () => ({
    meta: [
      { title: "Controprestazioni – GEMA360" },
      { name: "description", content: "Controprestazioni sponsor erogate per partita." },
    ],
  }),
  component: Controprestazioni,
});

type Deliv = {
  id: string;
  contract_id: string;
  match_id: string | null;
  type: string;
  description: string | null;
  due_date: string | null;
  delivered: boolean;
  delivered_at: string | null;
  proof_url: string | null;
  interactions: number | null;
};
type Contract = { id: string; title: string | null; sponsors: { name: string } | null };
type Match = { id: string; opponent: string; match_date: string; round: number | null };
const TYPES = [
  "LED",
  "Social",
  "Speaker",
  "Maxischermo",
  "Cartellonistica",
  "Maglia",
  "Hospitality",
  "Newsletter",
  "Evento",
  "Altro",
];

function Controprestazioni() {
  const qc = useQueryClient();
  const [fMatch, setFMatch] = useState("tutte");
  const [fContract, setFContract] = useState("tutti");
  const [fType, setFType] = useState("tutti");
  const [fState, setFState] = useState("aperte");
  const [edit, setEdit] = useState<Partial<Deliv> | null>(null);

  const { data: rows = [] } = useQuery({
    queryKey: ["sponsor_deliverables"],
    queryFn: async () =>
      ((await db.from("sponsor_deliverables").select("*").order("due_date", { nullsFirst: false }))
        .data ?? []) as Deliv[],
  });
  const { data: contracts = [] } = useQuery({
    queryKey: ["contracts-min"],
    queryFn: async () =>
      ((
        await db
          .from("sponsor_contracts")
          .select("id,title,sponsors(name)")
          .neq("status", "annullato")
      ).data ?? []) as Contract[],
  });
  const { data: matches = [] } = useQuery({
    queryKey: ["matches-min"],
    queryFn: async () =>
      ((await db.from("matches").select("id,opponent,match_date,round").order("match_date")).data ??
        []) as Match[],
  });
  const cName = (id: string) => {
    const c = contracts.find((x) => x.id === id);
    return c ? `${c.sponsors?.name ?? ""}${c.title ? ` – ${c.title}` : ""}` : "—";
  };
  const mName = (id: string | null) => {
    const m = matches.find((x) => x.id === id);
    return m ? `${m.round ? `G${m.round} ` : ""}vs ${m.opponent}` : "";
  };
  const today = todayISO();
  const isLate = (d: Deliv) => !d.delivered && !!d.due_date && d.due_date < today;

  const list = useMemo(
    () =>
      rows.filter((d) => {
        if (fMatch !== "tutte" && d.match_id !== fMatch) return false;
        if (fContract !== "tutti" && d.contract_id !== fContract) return false;
        if (fType !== "tutti" && d.type !== fType) return false;
        if (fState === "aperte" && d.delivered) return false;
        if (fState === "ritardo" && !isLate(d)) return false;
        if (fState === "erogate" && !d.delivered) return false;
        return true;
      }),
    [rows, fMatch, fContract, fType, fState],
  );

  const late = rows.filter(isLate).length;
  const done = rows.filter((d) => d.delivered).length;
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["sponsor_deliverables"] });
    qc.invalidateQueries({ queryKey: ["sponsor_deliverables_min"] });
  };

  async function toggle(d: Deliv) {
    const r = await db
      .from("sponsor_deliverables")
      .update({ delivered: !d.delivered, delivered_at: !d.delivered ? today : null })
      .eq("id", d.id);
    if (r.error) return toast.error(r.error.message);
    refresh();
  }
  async function save() {
    if (!edit?.contract_id) return toast.error("Scegli il contratto");
    if (!edit.type) return toast.error("Scegli il tipo");
    const proof = (edit.proof_url ?? "").trim();
    if (proof && !/^https?:\/\//i.test(proof))
      return toast.error("Il link della prova deve iniziare con http:// o https://");
    const payload = {
      contract_id: edit.contract_id,
      match_id: edit.match_id || null,
      type: edit.type,
      description: edit.description?.slice(0, 1000) || null,
      due_date: edit.due_date || null,
      delivered: !!edit.delivered,
      delivered_at: edit.delivered ? edit.delivered_at || today : null,
      proof_url: proof || null,
      interactions:
        edit.interactions != null && String(edit.interactions) !== ""
          ? Math.max(0, Number(edit.interactions))
          : null,
    };
    const r = edit.id
      ? await db.from("sponsor_deliverables").update(payload).eq("id", edit.id)
      : await db.from("sponsor_deliverables").insert(payload);
    if (r.error) return toast.error(r.error.message);
    setEdit(null);
    refresh();
    toast.success("Controprestazione salvata");
  }
  async function remove(id: string) {
    const r = await db.from("sponsor_deliverables").delete().eq("id", id);
    if (r.error) return toast.error(r.error.message);
    setEdit(null);
    refresh();
  }

  return (
    <div>
      <PageHeader
        title="Controprestazioni"
        subtitle="LED, speaker, social e spazi da erogare agli sponsor, partita per partita"
        actions={
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                downloadCSV(
                  "controprestazioni.csv",
                  list.map((d) => ({
                    Sponsor: cName(d.contract_id),
                    Partita: mName(d.match_id),
                    Tipo: d.type,
                    Descrizione: d.description ?? "",
                    Scadenza: fmtDate(d.due_date),
                    Erogata: d.delivered ? "Sì" : "No",
                    "Data erogazione": fmtDate(d.delivered_at),
                    Interazioni: d.interactions ?? "",
                    Prova: d.proof_url ?? "",
                  })),
                )
              }
            >
              <Download className="h-4 w-4" />
              Excel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setEdit({ type: "LED", due_date: today, delivered: false })}
            >
              <Plus className="h-4 w-4" />
              Nuova
            </Button>
          </>
        }
      />
      <div className="mb-4 grid grid-cols-3 gap-3">
        <StatCard tone="red" label="In ritardo" value={late} />
        <StatCard label="Da erogare" value={rows.length - done} />
        <StatCard
          tone="green"
          label="Erogate"
          value={`${done} / ${rows.length}`}
          hint={rows.length ? `${Math.round((done / rows.length) * 100)}%` : ""}
        />
      </div>
      <div className="no-print mb-4 flex flex-wrap gap-2">
        <Select value={fState} onValueChange={setFState}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="aperte">Da erogare</SelectItem>
            <SelectItem value="ritardo">In ritardo</SelectItem>
            <SelectItem value="erogate">Erogate</SelectItem>
            <SelectItem value="tutte">Tutte</SelectItem>
          </SelectContent>
        </Select>
        <Select value={fContract} onValueChange={setFContract}>
          <SelectTrigger className="w-60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">Tutti gli sponsor</SelectItem>
            {contracts.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {cName(c.id)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={fMatch} onValueChange={setFMatch}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tutte">Tutte le partite</SelectItem>
            {matches.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {fmtDate(m.match_date)} · {mName(m.id)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={fType} onValueChange={setFType}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">Tutti i tipi</SelectItem>
            {TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {list.length ? (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-primary text-left text-xs uppercase text-primary-foreground">
              <tr>
                <th className="p-3">Scadenza</th>
                <th className="p-3">Sponsor</th>
                <th className="hidden p-3 md:table-cell">Partita</th>
                <th className="p-3">Tipo</th>
                <th className="hidden p-3 lg:table-cell">Prova</th>
                <th className="p-3">Stato</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {list.map((d) => (
                <tr
                  key={d.id}
                  className={cn(
                    "border-t",
                    isLate(d) && "bg-destructive/10",
                    d.delivered && "opacity-70",
                  )}
                >
                  <td className="p-3 whitespace-nowrap tabular-nums">
                    {fmtDate(d.due_date)}
                    {isLate(d) && d.due_date && (
                      <div className="text-xs text-destructive">
                        in ritardo di {-daysUntil(d.due_date)} gg
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    <button className="text-left hover:underline" onClick={() => setEdit(d)}>
                      {cName(d.contract_id)}
                    </button>
                    <div className="text-xs text-muted-foreground">{d.description}</div>
                  </td>
                  <td className="hidden p-3 text-xs md:table-cell">{mName(d.match_id)}</td>
                  <td className="p-3">
                    <Pill tone="navy">{d.type}</Pill>
                  </td>
                  <td className="hidden p-3 text-xs lg:table-cell">
                    {d.proof_url ? (
                      <a
                        className="inline-flex items-center gap-1 underline"
                        href={d.proof_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Apri
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      "—"
                    )}
                    {d.interactions != null && <div>{d.interactions} interazioni</div>}
                  </td>
                  <td className="p-3">
                    {d.delivered ? (
                      <Pill tone="fatto">Erogata {fmtDate(d.delivered_at)}</Pill>
                    ) : isLate(d) ? (
                      <Pill tone="scaduto">In ritardo</Pill>
                    ) : (
                      <Pill tone="ok">Da erogare</Pill>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <Button
                      size="sm"
                      variant={d.delivered ? "ghost" : "outline"}
                      onClick={() => toggle(d)}
                    >
                      <Check className="h-4 w-4" />
                      {d.delivered ? "Riapri" : "Erogata"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>Nessuna controprestazione con questi filtri.</Empty>
      )}

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{edit?.id ? "Controprestazione" : "Nuova controprestazione"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Contratto</Label>
              <Select
                value={edit?.contract_id ?? ""}
                onValueChange={(v) => setEdit({ ...edit, contract_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Scegli…" />
                </SelectTrigger>
                <SelectContent>
                  {contracts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {cName(c.id)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo</Label>
              <Select
                value={edit?.type ?? "LED"}
                onValueChange={(v) => setEdit({ ...edit, type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[...new Set([...TYPES, ...(edit?.type ? [edit.type] : [])])].map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Scadenza</Label>
              <Input
                type="date"
                value={edit?.due_date ?? ""}
                onChange={(e) => setEdit({ ...edit, due_date: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <Label>Partita (facoltativa)</Label>
              <Select
                value={edit?.match_id ?? "none"}
                onValueChange={(v) => setEdit({ ...edit, match_id: v === "none" ? null : v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nessuna</SelectItem>
                  {matches.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {fmtDateTime(m.match_date)} · {mName(m.id)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Descrizione</Label>
              <Textarea
                value={edit?.description ?? ""}
                onChange={(e) => setEdit({ ...edit, description: e.target.value })}
              />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <Switch
                checked={!!edit?.delivered}
                onCheckedChange={(v) =>
                  setEdit({
                    ...edit,
                    delivered: v,
                    delivered_at: v ? (edit?.delivered_at ?? today) : null,
                  })
                }
              />
              <Label>Erogata</Label>
            </div>
            {edit?.delivered && (
              <div>
                <Label>Data erogazione</Label>
                <Input
                  type="date"
                  value={edit?.delivered_at ?? ""}
                  onChange={(e) => setEdit({ ...edit, delivered_at: e.target.value })}
                />
              </div>
            )}
            <div>
              <Label>Interazioni (social)</Label>
              <Input
                type="number"
                min={0}
                value={edit?.interactions ?? ""}
                onChange={(e) =>
                  setEdit({ ...edit, interactions: e.target.value as unknown as number })
                }
              />
            </div>
            <div className="col-span-2">
              <Label>Link prova (foto, post)</Label>
              <Input
                placeholder="https://…"
                value={edit?.proof_url ?? ""}
                onChange={(e) => setEdit({ ...edit, proof_url: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            {edit?.id && (
              <Button
                variant="ghost"
                className="mr-auto text-destructive"
                onClick={() => remove(edit.id!)}
              >
                <Trash2 className="h-4 w-4" />
                Elimina
              </Button>
            )}
            <Button variant="outline" onClick={() => setEdit(null)}>
              Annulla
            </Button>
            <Button onClick={save}>Salva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

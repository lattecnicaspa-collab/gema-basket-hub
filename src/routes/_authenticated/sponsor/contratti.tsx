import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Download, FileUp, Plus, Trash2, Receipt, BadgeEuro } from "lucide-react";
import { db } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { useActiveSeason } from "@/hooks/useClub";
import { eur, fmtDate, todayISO, daysUntil } from "@/lib/format";
import { downloadCSV } from "@/lib/export";
import { PageHeader, Pill, Empty, Panel } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
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

export const Route = createFileRoute("/_authenticated/sponsor/contratti")({
  head: () => ({
    meta: [
      { title: "Contratti sponsor – GEMA360" },
      { name: "description", content: "Contratti, spazi e rate degli sponsor." },
    ],
  }),
  component: Contratti,
});

type Contract = {
  id: string;
  sponsor_id: string;
  season_id: string | null;
  title: string | null;
  amount_cash: number;
  amount_goods: number;
  is_barter: boolean;
  start_date: string | null;
  end_date: string | null;
  auto_renew: boolean | null;
  status: string;
  signed_at: string | null;
  tickets_per_match: number;
  hospitality_per_match: number;
  led_seconds_per_match: number;
  posts_per_season: number;
  pdf_url: string | null;
  notes: string | null;
  sponsors?: { name: string } | null;
};
type Inst = {
  id: string;
  contract_id: string;
  due_date: string;
  amount: number;
  vat_rate: number;
  invoice_number: string | null;
  invoiced_at: string | null;
  paid_at: string | null;
  notes: string | null;
};
type CA = {
  id: string;
  contract_id: string;
  asset_id: string;
  quantity: number;
  sponsor_assets?: { name: string; category: string; price: number } | null;
};
type Deliv = { id: string; contract_id: string; delivered: boolean };

const STATUS: Record<string, string> = {
  bozza: "Bozza",
  attivo: "Attivo",
  scaduto: "Scaduto",
  annullato: "Annullato",
};
const schema = z.object({
  sponsor_id: z.string().uuid("Scegli lo sponsor"),
  season_id: z.string().uuid().nullable(),
  title: z.string().max(200).nullable(),
  amount_cash: z.number().nonnegative(),
  amount_goods: z.number().nonnegative(),
  is_barter: z.boolean(),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
  auto_renew: z.boolean(),
  status: z.enum(["bozza", "attivo", "scaduto", "annullato"]),
  signed_at: z.string().nullable(),
  tickets_per_match: z.number().int().min(0),
  hospitality_per_match: z.number().int().min(0),
  led_seconds_per_match: z.number().int().min(0),
  posts_per_season: z.number().int().min(0),
  notes: z.string().max(4000).nullable(),
});
const nz = (v: unknown) => (v === "" || v === undefined ? null : v);
const n = (v: unknown) => (v === "" || v == null ? 0 : Number(v));
const gross = (i: Inst) => Number(i.amount) * (1 + Number(i.vat_rate) / 100);

function Contratti() {
  const qc = useQueryClient();
  const { data: season } = useActiveSeason();
  const [edit, setEdit] = useState<Partial<Contract> | null>(null);
  const [q, setQ] = useState("");
  const [st, setSt] = useState("tutti");

  const { data: contracts = [] } = useQuery({
    queryKey: ["sponsor_contracts"],
    queryFn: async () =>
      ((
        await db
          .from("sponsor_contracts")
          .select("*,sponsors(name)")
          .order("created_at", { ascending: false })
      ).data ?? []) as Contract[],
  });
  const { data: inst = [] } = useQuery({
    queryKey: ["sponsor_installments"],
    queryFn: async () =>
      ((await db.from("sponsor_installments").select("*").order("due_date")).data ?? []) as Inst[],
  });
  const { data: deliv = [] } = useQuery({
    queryKey: ["sponsor_deliverables_min"],
    queryFn: async () =>
      ((await db.from("sponsor_deliverables").select("id,contract_id,delivered")).data ??
        []) as Deliv[],
  });

  const rows = useMemo(
    () =>
      contracts.filter(
        (c) =>
          (st === "tutti" || c.status === st) &&
          (!q ||
            (c.sponsors?.name ?? "").toLowerCase().includes(q.toLowerCase()) ||
            (c.title ?? "").toLowerCase().includes(q.toLowerCase())),
      ),
    [contracts, q, st],
  );
  const pctDeliv = (cid: string) => {
    const d = deliv.filter((x) => x.contract_id === cid);
    return d.length ? Math.round((d.filter((x) => x.delivered).length / d.length) * 100) : null;
  };
  const instOf = (cid: string) => inst.filter((i) => i.contract_id === cid);

  const exportRows = () =>
    rows.map((c) => {
      const ii = instOf(c.id);
      return {
        Sponsor: c.sponsors?.name ?? "",
        Contratto: c.title ?? "",
        Stato: STATUS[c.status],
        Inizio: fmtDate(c.start_date),
        Fine: fmtDate(c.end_date),
        Denaro: Number(c.amount_cash),
        Merce: Number(c.amount_goods),
        Incassato: ii.filter((i) => i.paid_at).reduce((s, i) => s + gross(i), 0),
        "Da incassare": ii.filter((i) => !i.paid_at).reduce((s, i) => s + gross(i), 0),
      };
    });

  return (
    <div>
      <PageHeader
        title="Contratti sponsor"
        subtitle="Spazi venduti, piano di fatturazione e incassi (le rate generano scadenze e prima nota in automatico)"
        actions={
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => downloadCSV("contratti-sponsor.csv", exportRows())}
            >
              <Download className="h-4 w-4" />
              Excel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() =>
                setEdit({
                  status: "attivo",
                  season_id: season?.id ?? null,
                  amount_cash: 0,
                  amount_goods: 0,
                  is_barter: false,
                  auto_renew: false,
                  tickets_per_match: 0,
                  hospitality_per_match: 0,
                  led_seconds_per_match: 0,
                  posts_per_season: 0,
                })
              }
            >
              <Plus className="h-4 w-4" />
              Nuovo contratto
            </Button>
          </>
        }
      />
      <div className="no-print mb-4 flex flex-wrap gap-2">
        <Input
          placeholder="Cerca sponsor o contratto…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-64"
        />
        <Select value={st} onValueChange={setSt}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">Tutti</SelectItem>
            {Object.entries(STATUS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {rows.length ? (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-primary text-left text-xs uppercase text-primary-foreground">
              <tr>
                <th className="p-3">Sponsor</th>
                <th className="hidden p-3 md:table-cell">Periodo</th>
                <th className="p-3 text-right">Valore</th>
                <th className="hidden p-3 text-right sm:table-cell">Incassato</th>
                <th className="hidden p-3 lg:table-cell">Controprest.</th>
                <th className="p-3">Stato</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const ii = instOf(c.id);
                const paid = ii.filter((i) => i.paid_at).reduce((s, i) => s + gross(i), 0);
                const late = ii.some((i) => !i.paid_at && i.due_date < todayISO());
                const p = pctDeliv(c.id);
                return (
                  <tr
                    key={c.id}
                    className="cursor-pointer border-t hover:bg-muted/50"
                    onClick={() => setEdit(c)}
                  >
                    <td className="p-3">
                      <b>{c.sponsors?.name}</b>
                      <div className="text-xs text-muted-foreground">
                        {c.title}
                        {c.is_barter ? " · permuta" : ""}
                      </div>
                    </td>
                    <td className="hidden p-3 text-xs md:table-cell">
                      {fmtDate(c.start_date)} → {fmtDate(c.end_date)}
                      {c.end_date && daysUntil(c.end_date) >= 0 && daysUntil(c.end_date) <= 90 && (
                        <div>
                          <Pill tone="7">Rinnovo tra {daysUntil(c.end_date)} gg</Pill>
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      {eur(Number(c.amount_cash) + Number(c.amount_goods))}
                    </td>
                    <td className="hidden p-3 text-right tabular-nums sm:table-cell">
                      {eur(paid)}
                      {late && (
                        <div>
                          <Pill tone="scaduto">Rate scadute</Pill>
                        </div>
                      )}
                    </td>
                    <td className="hidden w-32 p-3 lg:table-cell">
                      {p == null ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <div>
                          <Progress value={p} />
                          <span className="text-xs">{p}%</span>
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <Pill
                        tone={
                          c.status === "attivo"
                            ? "fatto"
                            : c.status === "annullato"
                              ? "scaduto"
                              : "ok"
                        }
                      >
                        {STATUS[c.status]}
                      </Pill>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>Nessun contratto.</Empty>
      )}

      <ContractDialog
        c={edit}
        setC={setEdit}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["sponsor_contracts"] });
          qc.invalidateQueries({ queryKey: ["sponsor-dashboard"] });
        }}
        pct={edit?.id ? pctDeliv(edit.id) : null}
      />
    </div>
  );
}

function ContractDialog({
  c,
  setC,
  onSaved,
  pct,
}: {
  c: Partial<Contract> | null;
  setC: (c: Partial<Contract> | null) => void;
  onSaved: () => void;
  pct: number | null;
}) {
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState(false);
  const { data: sponsors = [] } = useQuery({
    queryKey: ["sponsors-min"],
    queryFn: async () =>
      (await db.from("sponsors").select("id,name").is("deleted_at", null).order("name")).data ?? [],
  });
  const { data: seasons = [] } = useQuery({
    queryKey: ["seasons"],
    queryFn: async () =>
      (await db.from("seasons").select("id,name").order("start_date", { ascending: false })).data ??
      [],
  });

  async function save() {
    if (!c) return;
    const p = schema.safeParse({
      sponsor_id: c.sponsor_id ?? "",
      season_id: nz(c.season_id),
      title: nz(c.title),
      amount_cash: n(c.amount_cash),
      amount_goods: n(c.amount_goods),
      is_barter: !!c.is_barter,
      start_date: nz(c.start_date),
      end_date: nz(c.end_date),
      auto_renew: !!c.auto_renew,
      status: c.status ?? "attivo",
      signed_at: nz(c.signed_at),
      tickets_per_match: n(c.tickets_per_match),
      hospitality_per_match: n(c.hospitality_per_match),
      led_seconds_per_match: n(c.led_seconds_per_match),
      posts_per_season: n(c.posts_per_season),
      notes: nz(c.notes),
    });
    if (!p.success) return toast.error(p.error.issues[0].message);
    if (p.data.start_date && p.data.end_date && p.data.end_date < p.data.start_date)
      return toast.error("La data di fine è prima dell'inizio");
    setBusy(true);
    const r = c.id
      ? await db.from("sponsor_contracts").update(p.data).eq("id", c.id).select().single()
      : await db.from("sponsor_contracts").insert(p.data).select().single();
    setBusy(false);
    if (r.error) return toast.error(r.error.message);
    toast.success("Contratto salvato");
    onSaved();
    if (!c.id)
      setC({
        ...r.data,
        sponsors: sponsors.find((s: { id: string }) => s.id === r.data.sponsor_id) ?? null,
      });
  }

  async function upload(file: File) {
    if (!c?.id) return;
    const path = `sponsor/${c.id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const up = await supabase.storage.from("contratti").upload(path, file);
    if (up.error) return toast.error(up.error.message);
    const r = await db.from("sponsor_contracts").update({ pdf_url: path }).eq("id", c.id);
    if (r.error) return toast.error(r.error.message);
    setC({ ...c, pdf_url: path });
    onSaved();
    toast.success("PDF caricato");
  }
  async function openPdf() {
    if (!c?.pdf_url) return;
    const s = await supabase.storage.from("contratti").createSignedUrl(c.pdf_url, 300);
    if (s.error) return toast.error(s.error.message);
    window.open(s.data.signedUrl, "_blank");
  }
  async function remove() {
    if (!c?.id) return;
    const r = await db.from("sponsor_contracts").update({ status: "annullato" }).eq("id", c.id);
    if (r.error) return toast.error(r.error.message);
    setDel(false);
    setC(null);
    onSaved();
    toast.success("Contratto annullato");
  }

  const num = (k: keyof Contract, label: string) => (
    <div>
      <Label>{label}</Label>
      <Input
        type="number"
        min={0}
        value={(c?.[k] as number | undefined) ?? ""}
        onChange={(e) =>
          setC({
            ...c,
            [k]: e.target.value === "" ? "" : Number(e.target.value),
          } as Partial<Contract>)
        }
      />
    </div>
  );

  return (
    <Dialog open={!!c} onOpenChange={(o) => !o && setC(null)}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {c?.id ? `Contratto – ${c.sponsors?.name ?? ""}` : "Nuovo contratto"}
          </DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="dati">
          <TabsList>
            <TabsTrigger value="dati">Dati</TabsTrigger>
            <TabsTrigger value="spazi" disabled={!c?.id}>
              Spazi
            </TabsTrigger>
            <TabsTrigger value="rate" disabled={!c?.id}>
              Rate e incassi
            </TabsTrigger>
          </TabsList>
          <TabsContent value="dati">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Sponsor</Label>
                <Select
                  value={c?.sponsor_id ?? ""}
                  onValueChange={(v) => setC({ ...c, sponsor_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Scegli…" />
                  </SelectTrigger>
                  <SelectContent>
                    {sponsors.map((s: { id: string; name: string }) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Stagione</Label>
                <Select
                  value={c?.season_id ?? "none"}
                  onValueChange={(v) => setC({ ...c, season_id: v === "none" ? null : v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {seasons.map((s: { id: string; name: string }) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label>Titolo / pacchetto</Label>
                <Input
                  value={c?.title ?? ""}
                  onChange={(e) => setC({ ...c, title: e.target.value })}
                />
              </div>
              <div>
                <Label>Importo in denaro (€, imponibile)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={c?.amount_cash ?? ""}
                  onChange={(e) => setC({ ...c, amount_cash: e.target.value as unknown as number })}
                />
              </div>
              <div>
                <Label>Importo in merce / permuta (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={c?.amount_goods ?? ""}
                  onChange={(e) =>
                    setC({ ...c, amount_goods: e.target.value as unknown as number })
                  }
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={!!c?.is_barter}
                  onCheckedChange={(v) => setC({ ...c, is_barter: v })}
                />
                <Label>Permuta / cambio merce</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={!!c?.auto_renew}
                  onCheckedChange={(v) => setC({ ...c, auto_renew: v })}
                />
                <Label>Rinnovo automatico</Label>
              </div>
              <div>
                <Label>Inizio</Label>
                <Input
                  type="date"
                  value={c?.start_date ?? ""}
                  onChange={(e) => setC({ ...c, start_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Fine</Label>
                <Input
                  type="date"
                  value={c?.end_date ?? ""}
                  onChange={(e) => setC({ ...c, end_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Firmato il</Label>
                <Input
                  type="date"
                  value={c?.signed_at ?? ""}
                  onChange={(e) => setC({ ...c, signed_at: e.target.value })}
                />
              </div>
              <div>
                <Label>Stato</Label>
                <Select
                  value={c?.status ?? "attivo"}
                  onValueChange={(v) => setC({ ...c, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {num("tickets_per_match", "Biglietti per partita")}
              {num("hospitality_per_match", "Pass hospitality per partita")}
              {num("led_seconds_per_match", "Secondi LED per partita")}
              {num("posts_per_season", "Post social a stagione")}
              <div className="sm:col-span-2">
                <Label>Note / controprestazioni</Label>
                <Textarea
                  value={c?.notes ?? ""}
                  onChange={(e) => setC({ ...c, notes: e.target.value })}
                />
              </div>
              {c?.is_barter && (
                <p className="text-xs text-muted-foreground sm:col-span-2">
                  Permuta: dal 2026 la base imponibile IVA si calcola sui costi; servono due fatture
                  distinte (sponsor e società). Verificare con il commercialista.
                </p>
              )}
              {c?.id && (
                <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
                  <Label className="cursor-pointer rounded-md border px-3 py-2 text-sm">
                    <FileUp className="mr-1 inline h-4 w-4" />
                    Carica PDF contratto
                    <input
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
                    />
                  </Label>
                  {c.pdf_url && (
                    <Button size="sm" variant="outline" onClick={openPdf}>
                      Apri PDF
                    </Button>
                  )}
                  {pct != null && (
                    <span className="text-sm">
                      Controprestazioni erogate: <b>{pct}%</b>
                    </span>
                  )}
                </div>
              )}
            </div>
            <DialogFooter className="mt-4">
              {c?.id && c.status !== "annullato" && (
                <Button
                  variant="ghost"
                  className="mr-auto text-destructive"
                  onClick={() => setDel(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  Annulla contratto
                </Button>
              )}
              <Button variant="outline" onClick={() => setC(null)}>
                Chiudi
              </Button>
              <Button onClick={save} disabled={busy}>
                Salva
              </Button>
            </DialogFooter>
          </TabsContent>
          <TabsContent value="spazi">
            {c?.id && <AssetsTab contractId={c.id} seasonId={c.season_id ?? null} />}
          </TabsContent>
          <TabsContent value="rate">
            {c?.id && <InstallmentsTab contract={c as Contract} />}
          </TabsContent>
        </Tabs>
        <AlertDialog open={del} onOpenChange={setDel}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Annullare il contratto?</AlertDialogTitle>
              <AlertDialogDescription>
                Il contratto passa a "Annullato" e i suoi spazi tornano disponibili. Rate e storico
                restano registrati.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Indietro</AlertDialogCancel>
              <AlertDialogAction onClick={remove}>Annulla contratto</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}

function AssetsTab({ contractId, seasonId }: { contractId: string; seasonId: string | null }) {
  const qc = useQueryClient();
  const [assetId, setAssetId] = useState("");
  const [qty, setQty] = useState(1);
  const { data: rows = [] } = useQuery({
    queryKey: ["contract_assets", contractId],
    queryFn: async () =>
      ((
        await db
          .from("contract_assets")
          .select("*,sponsor_assets(name,category,price)")
          .eq("contract_id", contractId)
      ).data ?? []) as CA[],
  });
  const { data: assets = [] } = useQuery({
    queryKey: ["sponsor_assets"],
    queryFn: async () =>
      (await db.from("sponsor_assets").select("*").order("category").order("name")).data ?? [],
  });
  const list = assets.filter(
    (a: { season_id: string | null }) => !seasonId || !a.season_id || a.season_id === seasonId,
  );
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["contract_assets", contractId] });
    qc.invalidateQueries({ queryKey: ["sponsor-dashboard"] });
    qc.invalidateQueries({ queryKey: ["contract_assets_all"] });
  };
  async function add() {
    if (!assetId) return toast.error("Scegli uno spazio");
    const r = await db
      .from("contract_assets")
      .insert({ contract_id: contractId, asset_id: assetId, quantity: Math.max(1, qty) });
    if (r.error)
      return toast.error(r.error.message.replace(/^.*?Sovrapposizione/, "Sovrapposizione"));
    setAssetId("");
    setQty(1);
    refresh();
    toast.success("Spazio aggiunto");
  }
  async function remove(id: string) {
    const r = await db.from("contract_assets").delete().eq("id", id);
    if (r.error) return toast.error(r.error.message);
    refresh();
  }
  const total = rows.reduce((s, r) => s + Number(r.sponsor_assets?.price ?? 0) * r.quantity, 0);
  return (
    <Panel>
      <div className="mb-3 flex flex-wrap gap-2">
        <Select value={assetId} onValueChange={setAssetId}>
          <SelectTrigger className="w-72">
            <SelectValue placeholder="Spazio da vendere…" />
          </SelectTrigger>
          <SelectContent>
            {list.map((a: { id: string; name: string; category: string; price: number }) => (
              <SelectItem key={a.id} value={a.id}>
                {a.category} – {a.name} ({eur(a.price)})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="number"
          min={1}
          className="w-24"
          value={qty}
          onChange={(e) => setQty(Number(e.target.value))}
          aria-label="Quantità"
        />
        <Button size="sm" onClick={add}>
          <Plus className="h-4 w-4" />
          Aggiungi
        </Button>
      </div>
      {rows.length ? (
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th>Spazio</th>
              <th>Q.tà</th>
              <th className="text-right">Valore listino</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="py-2">
                  {r.sponsor_assets?.name}
                  <div className="text-xs text-muted-foreground">{r.sponsor_assets?.category}</div>
                </td>
                <td>{r.quantity}</td>
                <td className="text-right tabular-nums">
                  {eur(Number(r.sponsor_assets?.price ?? 0) * r.quantity)}
                </td>
                <td className="text-right">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => remove(r.id)}
                    aria-label="Rimuovi"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t font-bold">
              <td colSpan={2} className="py-2">
                Totale listino
              </td>
              <td className="text-right">{eur(total)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      ) : (
        <Empty>Nessuno spazio collegato.</Empty>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        Uno spazio non può essere venduto oltre la quantità disponibile nella stagione: il sistema
        blocca le sovrapposizioni.
      </p>
    </Panel>
  );
}

function InstallmentsTab({ contract }: { contract: Contract }) {
  const qc = useQueryClient();
  const [edit, setEdit] = useState<Partial<Inst> | null>(null);
  const [plan, setPlan] = useState({ n: 3, first: todayISO() });
  const { data: rows = [] } = useQuery({
    queryKey: ["sponsor_installments"],
    queryFn: async () =>
      ((await db.from("sponsor_installments").select("*").order("due_date")).data ?? []) as Inst[],
  });
  const mine = rows.filter((r) => r.contract_id === contract.id);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["sponsor_installments"] });
    qc.invalidateQueries({ queryKey: ["sponsor-dashboard"] });
    qc.invalidateQueries({ queryKey: ["deadlines"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };
  const planned = mine.reduce((s, i) => s + Number(i.amount), 0);

  async function save() {
    if (!edit) return;
    const amount = Number(edit.amount);
    if (!edit.due_date || !(amount > 0)) return toast.error("Data e importo obbligatori");
    const payload = {
      contract_id: contract.id,
      due_date: edit.due_date,
      amount,
      vat_rate: Number(edit.vat_rate ?? 22),
      invoice_number: edit.invoice_number || null,
      invoiced_at: edit.invoiced_at || null,
      paid_at: edit.paid_at || null,
      notes: edit.notes || null,
    };
    if (payload.paid_at && !payload.invoiced_at)
      return toast.error("Prima di segnare incassata, indica i dati della fattura");
    const r = edit.id
      ? await db.from("sponsor_installments").update(payload).eq("id", edit.id)
      : await db.from("sponsor_installments").insert(payload);
    if (r.error) return toast.error(r.error.message);
    toast.success(
      payload.paid_at ? "Rata incassata: registrata in prima nota (commerciale)" : "Rata salvata",
    );
    setEdit(null);
    refresh();
  }
  async function generate() {
    const cash = Number(contract.amount_cash);
    if (!(cash > 0) || plan.n < 1) return toast.error("Importo in denaro del contratto mancante");
    const each = Math.round((cash / plan.n) * 100) / 100;
    const base = new Date(plan.first + "T00:00:00");
    const items = Array.from({ length: plan.n }, (_, k) => {
      const d = new Date(base);
      d.setMonth(d.getMonth() + k);
      const amount = k === plan.n - 1 ? Math.round((cash - each * (plan.n - 1)) * 100) / 100 : each;
      return {
        contract_id: contract.id,
        due_date: d.toISOString().slice(0, 10),
        amount,
        vat_rate: 22,
      };
    });
    const r = await db.from("sponsor_installments").insert(items);
    if (r.error) return toast.error(r.error.message);
    toast.success(`${plan.n} rate create e aggiunte allo scadenzario`);
    refresh();
  }
  async function remove(i: Inst) {
    if (i.paid_at)
      return toast.error("Rata già incassata: modifica la data di incasso invece di eliminarla");
    const r = await db.from("sponsor_installments").delete().eq("id", i.id);
    if (r.error) return toast.error(r.error.message);
    refresh();
  }

  return (
    <Panel>
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <Button size="sm" onClick={() => setEdit({ due_date: todayISO(), vat_rate: 22 })}>
          <Plus className="h-4 w-4" />
          Nuova rata
        </Button>
        {!mine.length && (
          <>
            <div>
              <Label className="text-xs">N. rate mensili</Label>
              <Input
                type="number"
                min={1}
                max={24}
                className="w-24"
                value={plan.n}
                onChange={(e) => setPlan({ ...plan, n: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label className="text-xs">Prima scadenza</Label>
              <Input
                type="date"
                value={plan.first}
                onChange={(e) => setPlan({ ...plan, first: e.target.value })}
              />
            </div>
            <Button size="sm" variant="outline" onClick={generate}>
              Genera piano da {eur(contract.amount_cash)}
            </Button>
          </>
        )}
      </div>
      {mine.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th>Scadenza</th>
                <th className="text-right">Imponibile</th>
                <th className="text-right">Totale IVA</th>
                <th>Fattura</th>
                <th>Stato</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {mine.map((i) => {
                const late = !i.paid_at && i.due_date < todayISO();
                return (
                  <tr key={i.id} className="border-t">
                    <td className="py-2 tabular-nums">{fmtDate(i.due_date)}</td>
                    <td className="text-right tabular-nums">{eur(i.amount)}</td>
                    <td className="text-right tabular-nums">{eur(gross(i))}</td>
                    <td className="text-xs">
                      {i.invoice_number
                        ? `n. ${i.invoice_number} del ${fmtDate(i.invoiced_at)}`
                        : "—"}
                    </td>
                    <td>
                      {i.paid_at ? (
                        <Pill tone="fatto">Incassata {fmtDate(i.paid_at)}</Pill>
                      ) : late ? (
                        <Pill tone="scaduto">Scaduta</Pill>
                      ) : i.invoiced_at ? (
                        <Pill tone="30">Fatturata</Pill>
                      ) : (
                        <Pill tone="ok">Da fatturare</Pill>
                      )}
                    </td>
                    <td className="whitespace-nowrap text-right">
                      {!i.invoiced_at && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEdit({ ...i, invoiced_at: todayISO() })}
                        >
                          <Receipt className="h-4 w-4" />
                          Fattura
                        </Button>
                      )}
                      {i.invoiced_at && !i.paid_at && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEdit({ ...i, paid_at: todayISO() })}
                        >
                          <BadgeEuro className="h-4 w-4" />
                          Incassa
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setEdit(i)}>
                        Modifica
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => remove(i)}
                        aria-label="Elimina"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t font-semibold">
                <td className="py-2">Totale piano</td>
                <td className="text-right">{eur(planned)}</td>
                <td
                  colSpan={4}
                  className={
                    planned !== Number(contract.amount_cash)
                      ? "pl-3 text-xs text-destructive"
                      : "pl-3 text-xs text-muted-foreground"
                  }
                >
                  {planned !== Number(contract.amount_cash)
                    ? `Differenza con il contratto: ${eur(Number(contract.amount_cash) - planned)}`
                    : "Piano allineato al contratto"}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <Empty>Nessuna rata. Genera il piano o aggiungi le rate.</Empty>
      )}

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{edit?.id ? "Rata" : "Nuova rata"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Scadenza</Label>
              <Input
                type="date"
                value={edit?.due_date ?? ""}
                onChange={(e) => setEdit({ ...edit, due_date: e.target.value })}
              />
            </div>
            <div>
              <Label>Imponibile (€)</Label>
              <Input
                type="number"
                step="0.01"
                value={edit?.amount ?? ""}
                onChange={(e) => setEdit({ ...edit, amount: e.target.value as unknown as number })}
              />
            </div>
            <div>
              <Label>IVA %</Label>
              <Input
                type="number"
                value={edit?.vat_rate ?? 22}
                onChange={(e) => setEdit({ ...edit, vat_rate: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>N. fattura</Label>
              <Input
                value={edit?.invoice_number ?? ""}
                onChange={(e) => setEdit({ ...edit, invoice_number: e.target.value })}
              />
            </div>
            <div>
              <Label>Data fattura</Label>
              <Input
                type="date"
                value={edit?.invoiced_at ?? ""}
                onChange={(e) => setEdit({ ...edit, invoiced_at: e.target.value })}
              />
            </div>
            <div>
              <Label>Data incasso</Label>
              <Input
                type="date"
                value={edit?.paid_at ?? ""}
                onChange={(e) => setEdit({ ...edit, paid_at: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <Label>Note</Label>
              <Textarea
                value={edit?.notes ?? ""}
                onChange={(e) => setEdit({ ...edit, notes: e.target.value })}
              />
            </div>
            <p className="col-span-2 text-xs text-muted-foreground">
              Totale con IVA:{" "}
              <b>{eur(Number(edit?.amount ?? 0) * (1 + Number(edit?.vat_rate ?? 22) / 100))}</b>.
              Con la data di incasso il movimento va automaticamente in prima nota (area
              commerciale).
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>
              Annulla
            </Button>
            <Button onClick={save}>Salva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Panel>
  );
}

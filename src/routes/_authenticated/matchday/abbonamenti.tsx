import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Download, IdCard, Pencil, Plus, Printer, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { useActiveSeason, useClub } from "@/hooks/useClub";
import { useRoles } from "@/lib/auth";
import { eur, num, TICKET_LABEL } from "@/lib/format";
import { downloadCSV } from "@/lib/export";
import { PageHeader, Panel, Pill, Empty, StatCard } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PassCard, PAY_LABEL, TICKET_TYPES, TIER_LABEL, useSectors, type Sector } from "./-shared";

export const Route = createFileRoute("/_authenticated/matchday/abbonamenti")({
  head: () => ({
    meta: [
      { title: "Abbonamenti – GEMA360" },
      {
        name: "description",
        content: "Campagna abbonamenti, listino prezzi e settori del PalaTerme.",
      },
    ],
  }),
  component: AbbonamentiPage,
});

type Sub = {
  id: string;
  season_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  sector_id: string | null;
  seat: string | null;
  sub_type: string;
  price: number;
  paid: boolean;
  payment_method: string | null;
  renewed_from_previous: boolean | null;
  qr_code: string;
};

const subSchema = z.object({
  first_name: z.string().trim().min(1, "Nome obbligatorio").max(80),
  last_name: z.string().trim().min(1, "Cognome obbligatorio").max(80),
  email: z
    .string()
    .email("Email non valida")
    .nullable()
    .or(z.literal("").transform(() => null)),
  phone: z.string().max(40).nullable(),
  sector_id: z.string().uuid("Scegli il settore"),
  seat: z.string().max(20).nullable(),
  sub_type: z.string(),
  price: z.number().nonnegative(),
  paid: z.boolean(),
  payment_method: z.string().nullable(),
  renewed_from_previous: z.boolean(),
});

function AbbonamentiPage() {
  const { data: season } = useActiveSeason();
  const { hasAny } = useRoles();
  const canEdit = hasAny(["direttivo", "segreteria", "tesoriere", "responsabile_commerciale"]);
  return (
    <div>
      <PageHeader
        title="Abbonamenti"
        subtitle={`Campagna abbonamenti${season ? ` ${season.name}` : ""}, listino e settori del PalaTerme`}
      />
      <Tabs defaultValue="abbonati">
        <TabsList>
          <TabsTrigger value="abbonati">Abbonati</TabsTrigger>
          <TabsTrigger value="listino">Listino prezzi</TabsTrigger>
          <TabsTrigger value="settori">Settori</TabsTrigger>
        </TabsList>
        <TabsContent value="abbonati">
          <Subscribers seasonId={season?.id ?? null} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="listino">
          <PriceList seasonId={season?.id ?? null} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="settori">
          <Sectors canEdit={canEdit} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Subscribers({ seasonId, canEdit }: { seasonId: string | null; canEdit: boolean }) {
  const qc = useQueryClient();
  const { data: club } = useClub();
  const { data: sectors = [] } = useSectors();
  const { data: rows = [] } = useQuery({
    queryKey: ["subscribers", seasonId],
    enabled: !!seasonId,
    queryFn: async () =>
      ((await db.from("subscribers").select("*").eq("season_id", seasonId).order("last_name"))
        .data ?? []) as Sub[],
  });
  const { data: subPrices = [] } = useQuery({
    queryKey: ["price_list_abb", seasonId],
    enabled: !!seasonId,
    queryFn: async () =>
      (
        await db
          .from("price_list")
          .select("sector_id,ticket_type,price")
          .eq("season_id", seasonId)
          .eq("tier", "abbonamento")
      ).data ?? [],
  });
  const [q, setQ] = useState("");
  const [fSector, setFSector] = useState("tutti");
  const [fPaid, setFPaid] = useState("tutti");
  const [edit, setEdit] = useState<Partial<Sub> | null>(null);
  const [cards, setCards] = useState<Sub[] | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const sectorName = (id: string | null) => sectors.find((s) => s.id === id)?.name ?? "—";

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (fSector !== "tutti" && r.sector_id !== fSector) return false;
        if (fPaid === "pagati" && !r.paid) return false;
        if (fPaid === "da_pagare" && r.paid) return false;
        if (fPaid === "rinnovi" && !r.renewed_from_previous) return false;
        if (
          q &&
          !`${r.first_name} ${r.last_name} ${r.email ?? ""} ${r.qr_code}`
            .toLowerCase()
            .includes(q.toLowerCase())
        )
          return false;
        return true;
      }),
    [rows, q, fSector, fPaid],
  );

  const stats = {
    tot: rows.length,
    paid: rows.filter((r) => r.paid).length,
    incasso: rows.filter((r) => r.paid).reduce((a, r) => a + Number(r.price), 0),
    daIncassare: rows.filter((r) => !r.paid).reduce((a, r) => a + Number(r.price), 0),
    rinnovi: rows.filter((r) => r.renewed_from_previous).length,
  };

  const suggestPrice = (sector?: string | null, type?: string) =>
    Number(
      subPrices.find(
        (p: { sector_id: string; ticket_type: string }) =>
          p.sector_id === sector && p.ticket_type === (type ?? "intero"),
      )?.price ?? 0,
    );

  async function save() {
    if (!edit || !seasonId) return;
    const p = subSchema.safeParse({
      first_name: edit.first_name ?? "",
      last_name: edit.last_name ?? "",
      email: edit.email ?? "",
      phone: edit.phone || null,
      sector_id: edit.sector_id ?? "",
      seat: edit.seat || null,
      sub_type: edit.sub_type ?? "intero",
      price: Number(edit.price ?? 0),
      paid: !!edit.paid,
      payment_method: edit.payment_method || null,
      renewed_from_previous: !!edit.renewed_from_previous,
    });
    if (!p.success) return toast.error(p.error.issues[0].message);
    if (
      p.data.seat &&
      rows.some(
        (r) => r.id !== edit.id && r.sector_id === p.data.sector_id && r.seat === p.data.seat,
      )
    )
      return toast.error("Posto già assegnato in questo settore");
    const r = edit.id
      ? await db.from("subscribers").update(p.data).eq("id", edit.id)
      : await db.from("subscribers").insert({ ...p.data, season_id: seasonId });
    if (r.error) return toast.error(r.error.message);
    toast.success("Abbonato salvato");
    setEdit(null);
    qc.invalidateQueries({ queryKey: ["subscribers", seasonId] });
  }
  async function togglePaid(s: Sub, v: boolean) {
    const r = await db
      .from("subscribers")
      .update({ paid: v, payment_method: v ? (s.payment_method ?? "contanti") : s.payment_method })
      .eq("id", s.id);
    if (r.error) return toast.error(r.error.message);
    qc.invalidateQueries({ queryKey: ["subscribers", seasonId] });
  }
  async function remove(s: Sub) {
    if (!window.confirm(`Eliminare l'abbonamento di ${s.first_name} ${s.last_name}?`)) return;
    const r = await db.from("subscribers").delete().eq("id", s.id);
    if (r.error) return toast.error(r.error.message);
    toast.success("Abbonamento eliminato");
    qc.invalidateQueries({ queryKey: ["subscribers", seasonId] });
  }
  const exportRows = () =>
    filtered.map((r) => ({
      Cognome: r.last_name,
      Nome: r.first_name,
      Email: r.email ?? "",
      Telefono: r.phone ?? "",
      Settore: sectorName(r.sector_id),
      Posto: r.seat ?? "",
      Tipologia: TICKET_LABEL[r.sub_type] ?? r.sub_type,
      Prezzo: Number(r.price),
      Pagato: r.paid ? "Sì" : "No",
      Metodo: r.payment_method ?? "",
      Rinnovo: r.renewed_from_previous ? "Sì" : "No",
      QR: r.qr_code,
    }));

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label="Abbonati" value={num(stats.tot)} tone="navy" />
        <StatCard
          label="Pagati"
          value={num(stats.paid)}
          hint={`${num(stats.tot - stats.paid)} da pagare`}
          tone="green"
        />
        <StatCard label="Incassato" value={eur(stats.incasso)} />
        <StatCard label="Da incassare" value={eur(stats.daIncassare)} tone="orange" />
        <StatCard label="Rinnovi (prelazione)" value={num(stats.rinnovi)} />
      </div>
      <Panel>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Input
            className="w-full sm:w-64"
            placeholder="Cerca nome, email o codice"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Select value={fSector} onValueChange={setFSector}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tutti">Tutti i settori</SelectItem>
              {sectors.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={fPaid} onValueChange={setFPaid}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tutti">Tutti</SelectItem>
              <SelectItem value="pagati">Pagati</SelectItem>
              <SelectItem value="da_pagare">Da pagare</SelectItem>
              <SelectItem value="rinnovi">Solo rinnovi</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => downloadCSV("abbonati.csv", exportRows())}
            >
              <Download className="h-4 w-4" />
              Excel
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!sel.size}
              onClick={() => setCards(rows.filter((r) => sel.has(r.id)))}
            >
              <IdCard className="h-4 w-4" />
              Tessere ({sel.size})
            </Button>
            {canEdit && (
              <Button
                size="sm"
                variant="destructive"
                disabled={!seasonId}
                onClick={() =>
                  setEdit({ sub_type: "intero", paid: false, renewed_from_previous: false })
                }
              >
                <Plus className="h-4 w-4" />
                Nuovo abbonato
              </Button>
            )}
          </div>
        </div>
        {!filtered.length ? (
          <Empty>Nessun abbonato.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <Checkbox
                      checked={sel.size > 0 && sel.size === filtered.length}
                      onCheckedChange={(v) =>
                        setSel(v ? new Set(filtered.map((r) => r.id)) : new Set())
                      }
                      aria-label="Seleziona tutti"
                    />
                  </TableHead>
                  <TableHead>Abbonato</TableHead>
                  <TableHead>Settore / posto</TableHead>
                  <TableHead>Tipologia</TableHead>
                  <TableHead className="text-right">Prezzo</TableHead>
                  <TableHead>Pagato</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Checkbox
                        checked={sel.has(r.id)}
                        onCheckedChange={(v) => {
                          const n = new Set(sel);
                          if (v) n.add(r.id);
                          else n.delete(r.id);
                          setSel(n);
                        }}
                        aria-label="Seleziona"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {r.last_name} {r.first_name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {r.email ?? r.phone ?? ""}
                      </div>
                      {r.renewed_from_previous && <Pill tone="navy">Rinnovo</Pill>}
                    </TableCell>
                    <TableCell>
                      {sectorName(r.sector_id)}
                      {r.seat && <span className="text-muted-foreground"> · {r.seat}</span>}
                    </TableCell>
                    <TableCell>{TICKET_LABEL[r.sub_type] ?? r.sub_type}</TableCell>
                    <TableCell className="text-right tabular-nums">{eur(r.price)}</TableCell>
                    <TableCell>
                      <Switch
                        checked={r.paid}
                        disabled={!canEdit}
                        onCheckedChange={(v) => togglePaid(r, v)}
                        aria-label="Pagato"
                      />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Tessera"
                        onClick={() => setCards([r])}
                      >
                        <IdCard className="h-4 w-4" />
                      </Button>
                      {canEdit && (
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Modifica"
                          onClick={() => setEdit(r)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {canEdit && (
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Elimina"
                          onClick={() => remove(r)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{edit?.id ? "Modifica abbonato" : "Nuovo abbonato"}</DialogTitle>
          </DialogHeader>
          {edit && (
            <div className="grid gap-3 sm:grid-cols-2">
              <F l="Nome">
                <Input
                  value={edit.first_name ?? ""}
                  onChange={(e) => setEdit({ ...edit, first_name: e.target.value })}
                />
              </F>
              <F l="Cognome">
                <Input
                  value={edit.last_name ?? ""}
                  onChange={(e) => setEdit({ ...edit, last_name: e.target.value })}
                />
              </F>
              <F l="Email">
                <Input
                  type="email"
                  value={edit.email ?? ""}
                  onChange={(e) => setEdit({ ...edit, email: e.target.value })}
                />
              </F>
              <F l="Telefono">
                <Input
                  value={edit.phone ?? ""}
                  onChange={(e) => setEdit({ ...edit, phone: e.target.value })}
                />
              </F>
              <F l="Settore">
                <Select
                  value={edit.sector_id ?? ""}
                  onValueChange={(v) =>
                    setEdit({
                      ...edit,
                      sector_id: v,
                      price: edit.id ? Number(edit.price ?? 0) : suggestPrice(v, edit.sub_type),
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Scegli" />
                  </SelectTrigger>
                  <SelectContent>
                    {sectors.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </F>
              <F l="Posto (fila-numero)">
                <Input
                  value={edit.seat ?? ""}
                  onChange={(e) => setEdit({ ...edit, seat: e.target.value })}
                />
              </F>
              <F l="Tipologia">
                <Select
                  value={edit.sub_type ?? "intero"}
                  onValueChange={(v) =>
                    setEdit({
                      ...edit,
                      sub_type: v,
                      price: edit.id ? Number(edit.price ?? 0) : suggestPrice(edit.sector_id, v),
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["intero", "ridotto", "ridotto_giovanili"].map((t) => (
                      <SelectItem key={t} value={t}>
                        {TICKET_LABEL[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </F>
              <F l="Prezzo (€)">
                <Input
                  type="number"
                  step="0.01"
                  value={edit.price ?? 0}
                  onChange={(e) => setEdit({ ...edit, price: Number(e.target.value) })}
                />
              </F>
              <F l="Metodo di pagamento">
                <Select
                  value={edit.payment_method ?? ""}
                  onValueChange={(v) => setEdit({ ...edit, payment_method: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {["contanti", "pos", "bonifico", "online"].map((k) => (
                      <SelectItem key={k} value={k}>
                        {PAY_LABEL[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </F>
              <div className="grid content-end gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={!!edit.paid}
                    onCheckedChange={(v) => setEdit({ ...edit, paid: v })}
                  />
                  Pagato
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={!!edit.renewed_from_previous}
                    onCheckedChange={(v) => setEdit({ ...edit, renewed_from_previous: v })}
                  />
                  Rinnovo con prelazione
                </label>
              </div>
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

      <Dialog open={!!cards} onOpenChange={(o) => !o && setCards(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Tessere abbonamento</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2 print-area">
            {cards?.map((c) => (
              <PassCard
                key={c.id}
                title={`Abbonamento ${club?.name ?? "Gema"}`}
                name={`${c.first_name} ${c.last_name}`}
                line2={`${sectorName(c.sector_id)}${c.seat ? ` · posto ${c.seat}` : ""} · ${TICKET_LABEL[c.sub_type] ?? c.sub_type}`}
                code={c.qr_code}
                footer={
                  c.paid ? (club?.footer_text ?? undefined) : "NON PAGATO – non valido all'ingresso"
                }
              />
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              Stampa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function F({ l, children }: { l: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label>{l}</Label>
      {children}
    </div>
  );
}

type PriceRow = { id: string; sector_id: string; ticket_type: string; tier: string; price: number };

function PriceList({ seasonId, canEdit }: { seasonId: string | null; canEdit: boolean }) {
  const qc = useQueryClient();
  const { data: sectors = [] } = useSectors();
  const [tier, setTier] = useState("normale");
  const key = ["price_list_all", seasonId];
  const { data: rows = [] } = useQuery({
    queryKey: key,
    enabled: !!seasonId,
    queryFn: async () =>
      ((await db.from("price_list").select("*").eq("season_id", seasonId)).data ??
        []) as PriceRow[],
  });
  const types =
    tier === "abbonamento"
      ? TICKET_TYPES.filter((t) => t !== "omaggio" && t !== "accredito")
      : TICKET_TYPES;
  const cell = (sector: string, type: string) =>
    rows.find((r) => r.sector_id === sector && r.ticket_type === type && r.tier === tier);

  async function setPrice(sector: string, type: string, value: string) {
    const v = value.trim() === "" ? null : Number(value.replace(",", "."));
    const existing = cell(sector, type);
    if (v == null || Number.isNaN(v)) {
      if (!existing) return;
      const r = await db.from("price_list").delete().eq("id", existing.id);
      if (r.error) return toast.error(r.error.message);
    } else if (existing) {
      if (Number(existing.price) === v) return;
      const r = await db.from("price_list").update({ price: v }).eq("id", existing.id);
      if (r.error) return toast.error(r.error.message);
    } else {
      const r = await db
        .from("price_list")
        .insert({ season_id: seasonId, sector_id: sector, ticket_type: type, tier, price: v });
      if (r.error) return toast.error(r.error.message);
    }
    toast.success("Prezzo aggiornato");
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["price_list"] });
  }

  return (
    <Panel
      title="Listino prezzi"
      actions={
        <Select value={tier} onValueChange={setTier}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["normale", "cartello", "playoff", "abbonamento"].map((t) => (
              <SelectItem key={t} value={t}>
                {TIER_LABEL[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      <p className="mb-3 text-xs text-muted-foreground">
        Lascia la casella vuota per rendere la tipologia non vendibile in quel settore. Omaggi e
        accrediti valgono sempre 0 €.
      </p>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Settore</TableHead>
              {types.map((t) => (
                <TableHead key={t} className="text-right">
                  {TICKET_LABEL[t]}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sectors.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                {types.map((t) => {
                  const c = cell(s.id, t);
                  return (
                    <TableCell key={t} className="text-right">
                      <Input
                        key={`${tier}-${c?.id ?? "x"}-${c?.price ?? ""}`}
                        disabled={!canEdit}
                        inputMode="decimal"
                        className="ml-auto h-8 w-24 text-right"
                        defaultValue={c ? String(c.price) : ""}
                        onBlur={(e) => setPrice(s.id, t, e.target.value)}
                        aria-label={`Prezzo ${s.name} ${TICKET_LABEL[t]}`}
                      />
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Panel>
  );
}

function Sectors({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const { data: sectors = [] } = useSectors();
  const [edit, setEdit] = useState<Partial<Sector> | null>(null);
  const total = sectors.reduce((a, s) => a + Number(s.capacity), 0);
  async function save() {
    if (!edit) return;
    if (!edit.name?.trim()) return toast.error("Nome obbligatorio");
    const payload = {
      name: edit.name.trim(),
      capacity: Number(edit.capacity ?? 0),
      is_numbered: !!edit.is_numbered,
      sort: Number(edit.sort ?? sectors.length + 1),
      kind: edit.kind ?? "pubblico",
    };
    if (payload.capacity < 0) return toast.error("Capienza non valida");
    const r = edit.id
      ? await db.from("sectors").update(payload).eq("id", edit.id)
      : await db.from("sectors").insert(payload);
    if (r.error) return toast.error(r.error.message);
    toast.success("Settore salvato");
    setEdit(null);
    qc.invalidateQueries({ queryKey: ["sectors"] });
  }
  async function remove(s: Sector) {
    if (
      !window.confirm(`Eliminare il settore ${s.name}? Verranno rimossi anche i prezzi collegati.`)
    )
      return;
    const r = await db.from("sectors").delete().eq("id", s.id);
    if (r.error) return toast.error(r.error.message);
    qc.invalidateQueries({ queryKey: ["sectors"] });
  }
  const KINDS: Record<string, string> = {
    pubblico: "Pubblico",
    ospiti: "Ospiti",
    disabili: "Disabili",
    stampa: "Stampa",
    hospitality: "Hospitality",
  };
  return (
    <Panel
      title={`Settori PalaTerme · capienza totale ${num(total)}`}
      actions={
        canEdit ? (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setEdit({ kind: "pubblico", capacity: 0 })}
          >
            <Plus className="h-4 w-4" />
            Nuovo settore
          </Button>
        ) : null
      }
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ordine</TableHead>
            <TableHead>Settore</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead className="text-right">Capienza autorizzata</TableHead>
            <TableHead>Numerato</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sectors.map((s) => (
            <TableRow key={s.id}>
              <TableCell>{s.sort}</TableCell>
              <TableCell className="font-medium">{s.name}</TableCell>
              <TableCell>{KINDS[s.kind ?? "pubblico"] ?? s.kind}</TableCell>
              <TableCell className="text-right tabular-nums">{num(s.capacity)}</TableCell>
              <TableCell>{s.is_numbered ? "Sì" : "No"}</TableCell>
              <TableCell className="whitespace-nowrap">
                {canEdit && (
                  <>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Modifica"
                      onClick={() => setEdit(s)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Elimina"
                      onClick={() => remove(s)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{edit?.id ? "Modifica settore" : "Nuovo settore"}</DialogTitle>
          </DialogHeader>
          {edit && (
            <div className="grid gap-3 sm:grid-cols-2">
              <F l="Nome">
                <Input
                  value={edit.name ?? ""}
                  onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                />
              </F>
              <F l="Capienza autorizzata">
                <Input
                  type="number"
                  value={edit.capacity ?? 0}
                  onChange={(e) => setEdit({ ...edit, capacity: Number(e.target.value) })}
                />
              </F>
              <F l="Tipo">
                <Select
                  value={edit.kind ?? "pubblico"}
                  onValueChange={(v) => setEdit({ ...edit, kind: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(KINDS).map(([k, l]) => (
                      <SelectItem key={k} value={k}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </F>
              <F l="Ordine">
                <Input
                  type="number"
                  value={edit.sort ?? ""}
                  onChange={(e) => setEdit({ ...edit, sort: Number(e.target.value) })}
                />
              </F>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={!!edit.is_numbered}
                  onCheckedChange={(v) => setEdit({ ...edit, is_numbered: v })}
                />
                Posti numerati
              </label>
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
    </Panel>
  );
}

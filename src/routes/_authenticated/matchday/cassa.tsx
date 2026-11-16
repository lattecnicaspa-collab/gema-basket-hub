import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Banknote,
  CreditCard,
  FileUp,
  Lock,
  Minus,
  Plus,
  Printer,
  ShoppingCart,
  Trash2,
  Unlock,
} from "lucide-react";
import { db } from "@/lib/db";
import { useAuth } from "@/lib/auth";
import { useActiveSeason } from "@/hooks/useClub";
import { eur, fmtDateTime, num, TICKET_LABEL } from "@/lib/format";
import { parseCSV } from "@/lib/export";
import {
  PageHeader,
  Panel,
  Notice,
  Empty,
  StatCard,
  Pill,
  FISCAL_TICKETS_WARNING,
} from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  defaultMatchId,
  MatchSelect,
  PAY_LABEL,
  QrImage,
  TICKET_TYPES,
  useMatches,
  useSectors,
} from "./-shared";

export const Route = createFileRoute("/_authenticated/matchday/cassa")({
  head: () => ({
    meta: [
      { title: "Botteghino – GEMA360" },
      { name: "description", content: "Cassa del botteghino partite, turni e chiusura cassa." },
    ],
  }),
  component: CassaPage,
});

type Shift = {
  id: string;
  match_id: string;
  operator_id: string | null;
  operator_name: string | null;
  opening_float: number;
  opened_at: string;
  closed_at: string | null;
  counted_cash: number | null;
  denominations: Record<string, number> | null;
  expected_cash: number | null;
  notes: string | null;
};
type Sale = {
  id: string;
  sector_id: string | null;
  ticket_type: string;
  qty: number;
  unit_price: number;
  total: number;
  payment_method: string;
  channel: string;
  qr_code: string;
  created_at: string;
  shift_id: string | null;
};
type Price = { sector_id: string; ticket_type: string; tier: string; price: number };
type CartLine = { sector_id: string; ticket_type: string; qty: number; unit_price: number };

const DENOMS = [500, 200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05];

function CassaPage() {
  const qc = useQueryClient();
  const { session } = useAuth();
  const { data: season } = useActiveSeason();
  const { data: matches = [] } = useMatches(season?.id);
  const { data: sectors = [] } = useSectors();
  const [matchId, setMatchId] = useState("");
  useEffect(() => {
    if (!matchId && matches.length) setMatchId(defaultMatchId(matches));
  }, [matches, matchId]);
  const match = matches.find((m) => m.id === matchId);

  const { data: prices = [] } = useQuery({
    queryKey: ["price_list", match?.season_id, match?.tier],
    enabled: !!match,
    queryFn: async () =>
      ((
        await db
          .from("price_list")
          .select("sector_id,ticket_type,tier,price")
          .eq("season_id", match!.season_id)
          .eq("tier", match!.tier)
      ).data ?? []) as Price[],
  });
  const { data: shifts = [] } = useQuery({
    queryKey: ["cash_shifts", matchId],
    enabled: !!matchId,
    queryFn: async () =>
      ((await db.from("cash_shifts").select("*").eq("match_id", matchId).order("opened_at")).data ??
        []) as Shift[],
  });
  const { data: sales = [] } = useQuery({
    queryKey: ["ticket_sales", matchId],
    enabled: !!matchId,
    queryFn: async () =>
      ((
        await db
          .from("ticket_sales")
          .select("*")
          .eq("match_id", matchId)
          .order("created_at", { ascending: false })
      ).data ?? []) as Sale[],
    refetchInterval: 15_000,
  });

  const myShift =
    shifts.find((s) => !s.closed_at && (s.operator_id === session?.user.id || !s.operator_id)) ??
    shifts.find((s) => !s.closed_at);
  const shiftSales = sales.filter((s) => s.shift_id && s.shift_id === myShift?.id);
  const shiftCash = shiftSales
    .filter((s) => s.payment_method === "contanti")
    .reduce((a, s) => a + Number(s.total), 0);
  const shiftPos = shiftSales
    .filter((s) => s.payment_method !== "contanti")
    .reduce((a, s) => a + Number(s.total), 0);
  const priceOf = (sector: string, type: string) => {
    if (type === "omaggio" || type === "accredito") return 0;
    return Number(
      prices.find((p) => p.sector_id === sector && p.ticket_type === type)?.price ?? NaN,
    );
  };

  const [cart, setCart] = useState<CartLine[]>([]);
  const [pay, setPay] = useState<"contanti" | "pos">("contanti");
  const [given, setGiven] = useState("");
  const [lastQr, setLastQr] = useState<string[]>([]);
  const cartTotal = cart.reduce((a, l) => a + l.qty * l.unit_price, 0);
  const change = pay === "contanti" && given ? Number(given.replace(",", ".")) - cartTotal : null;

  function addToCart(sector_id: string, ticket_type: string) {
    const unit_price = priceOf(sector_id, ticket_type);
    if (Number.isNaN(unit_price))
      return toast.error("Prezzo non impostato nel listino per questo settore/tipologia");
    setCart((c) => {
      const i = c.findIndex((l) => l.sector_id === sector_id && l.ticket_type === ticket_type);
      if (i >= 0) return c.map((l, j) => (j === i ? { ...l, qty: l.qty + 1 } : l));
      return [...c, { sector_id, ticket_type, qty: 1, unit_price }];
    });
  }
  const setQty = (i: number, d: number) =>
    setCart((c) =>
      c
        .map((l, j) => (j === i ? { ...l, qty: Math.max(0, l.qty + d) } : l))
        .filter((l) => l.qty > 0),
    );

  const [busy, setBusy] = useState(false);
  async function checkout() {
    if (!myShift) return toast.error("Apri prima il turno di cassa");
    if (!cart.length) return;
    if (change != null && change < 0) return toast.error("Importo ricevuto insufficiente");
    setBusy(true);
    const rows = cart.map((l) => ({
      match_id: matchId,
      shift_id: myShift.id,
      sector_id: l.sector_id,
      ticket_type: l.ticket_type,
      qty: l.qty,
      unit_price: l.unit_price,
      total: Math.round(l.qty * l.unit_price * 100) / 100,
      payment_method: pay,
      channel: "botteghino",
      qr_code: "BIG-" + crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase(),
    }));
    const r = await db.from("ticket_sales").insert(rows);
    setBusy(false);
    if (r.error) return toast.error(r.error.message);
    toast.success(
      `Venduti ${rows.reduce((a, x) => a + x.qty, 0)} biglietti · ${eur(cartTotal)}${change != null && change > 0 ? ` · resto ${eur(change)}` : ""}`,
    );
    setLastQr(rows.map((x) => x.qr_code));
    setCart([]);
    setGiven("");
    qc.invalidateQueries({ queryKey: ["ticket_sales", matchId] });
    qc.invalidateQueries({ queryKey: ["availability", matchId] });
  }

  async function voidSale(s: Sale) {
    if (!window.confirm(`Annullare la vendita ${s.qr_code} (${eur(s.total)})?`)) return;
    const r = await db.from("ticket_sales").delete().eq("id", s.id);
    if (r.error) return toast.error(r.error.message);
    toast.success("Vendita annullata");
    qc.invalidateQueries({ queryKey: ["ticket_sales", matchId] });
  }

  // apertura turno
  const [openForm, setOpenForm] = useState({ operator_name: "", opening_float: "100" });
  async function openShift() {
    const r = await db.from("cash_shifts").insert({
      match_id: matchId,
      operator_id: session?.user.id ?? null,
      operator_name: openForm.operator_name.trim() || session?.user.email || "Cassiere",
      opening_float: Number(openForm.opening_float.replace(",", ".")) || 0,
    });
    if (r.error) return toast.error(r.error.message);
    toast.success("Turno di cassa aperto");
    qc.invalidateQueries({ queryKey: ["cash_shifts", matchId] });
  }

  // chiusura turno
  const [closing, setClosing] = useState(false);
  const [denoms, setDenoms] = useState<Record<string, string>>({});
  const counted = DENOMS.reduce((a, d) => a + d * (Number(denoms[String(d)]) || 0), 0);
  const expected = Number(myShift?.opening_float ?? 0) + shiftCash;
  async function closeShift() {
    if (!myShift) return;
    const den = Object.fromEntries(DENOMS.map((d) => [String(d), Number(denoms[String(d)]) || 0]));
    const r = await db
      .from("cash_shifts")
      .update({
        closed_at: new Date().toISOString(),
        counted_cash: Math.round(counted * 100) / 100,
        expected_cash: Math.round(expected * 100) / 100,
        denominations: den,
      })
      .eq("id", myShift.id);
    if (r.error) return toast.error(r.error.message);
    toast.success("Cassa chiusa");
    setClosing(false);
    setDenoms({});
    qc.invalidateQueries({ queryKey: ["cash_shifts", matchId] });
  }

  // import prevendita
  const [importOpen, setImportOpen] = useState(false);
  const [preview, setPreview] = useState<
    { sector_id: string | null; sector: string; ticket_type: string; qty: number; total: number }[]
  >([]);
  function onFile(file: File) {
    file.text().then((text) => {
      const rows = parseCSV(text);
      const pick = (r: Record<string, string>, ...keys: string[]) =>
        keys.map((k) => r[k]).find((v) => v != null && v !== "") ?? "";
      const out = rows
        .map((r) => {
          const sectorName = pick(r, "settore", "sector", "zona", "area");
          const sec =
            sectors.find((s) => s.name.toLowerCase() === sectorName.toLowerCase()) ??
            sectors.find(
              (s) => sectorName && s.name.toLowerCase().includes(sectorName.toLowerCase()),
            );
          const tt = pick(r, "tipologia", "tipo", "ticket_type", "riduzione").toLowerCase();
          const type = TICKET_TYPES.find((t) => tt.startsWith(t.split("_")[0] ?? t)) ?? "intero";
          const qty = Number(pick(r, "quantita", "quantità", "qty", "biglietti", "numero") || 1);
          const rawTot = pick(r, "totale", "importo", "total", "prezzo").replace(/[€\s]/g, "");
          const total = Number(
            (rawTot.includes(",") ? rawTot.replace(/\./g, "").replace(",", ".") : rawTot) || 0,
          );
          return {
            sector_id: sec?.id ?? null,
            sector: sec?.name ?? `${sectorName} (non trovato)`,
            ticket_type: type,
            qty,
            total,
          };
        })
        .filter((r) => r.qty > 0);
      setPreview(out);
    });
  }
  async function confirmImport() {
    if (!preview.length) return;
    const rows = preview.map((p) => ({
      match_id: matchId,
      sector_id: p.sector_id,
      ticket_type: p.ticket_type,
      qty: p.qty,
      unit_price: p.qty ? Math.round((p.total / p.qty) * 100) / 100 : 0,
      total: p.total,
      payment_method: "online",
      channel: "online",
      qr_code: "ONL-" + crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase(),
    }));
    const r = await db.from("ticket_sales").insert(rows);
    if (r.error) return toast.error(r.error.message);
    toast.success(`Importate ${rows.length} righe di prevendita online`);
    setImportOpen(false);
    setPreview([]);
    qc.invalidateQueries({ queryKey: ["ticket_sales", matchId] });
  }

  const totals = useMemo(
    () => ({
      bott: sales
        .filter((s) => s.channel === "botteghino")
        .reduce((a, s) => a + Number(s.total), 0),
      online: sales.filter((s) => s.channel === "online").reduce((a, s) => a + Number(s.total), 0),
      qty: sales.reduce((a, s) => a + Number(s.qty), 0),
    }),
    [sales],
  );
  const sectorName = (id: string | null) => sectors.find((s) => s.id === id)?.name ?? "—";
  const saleSectors = sectors.filter((s) => s.kind !== "stampa" && s.kind !== "hospitality");

  return (
    <div>
      <PageHeader
        title="Botteghino"
        subtitle="Cassa veloce da tablet, turni e quadratura"
        actions={
          <>
            <MatchSelect
              matches={matches}
              value={matchId}
              onChange={(v) => {
                setMatchId(v);
                setCart([]);
              }}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => setImportOpen(true)}
              disabled={!matchId}
            >
              <FileUp className="h-4 w-4" />
              Importa prevendita
            </Button>
          </>
        }
      />
      <div className="mb-4">
        <Notice>{FISCAL_TICKETS_WARNING}</Notice>
      </div>

      {!match ? (
        <Empty>Nessuna partita in programma per la stagione attiva.</Empty>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Biglietti partita" value={num(totals.qty)} tone="navy" />
            <StatCard label="Incasso botteghino" value={eur(totals.bott)} />
            <StatCard label="Prevendita online" value={eur(totals.online)} />
            <StatCard
              label="Fascia prezzi"
              value={match.tier}
              hint="dal listino stagione"
              tone="orange"
            />
          </div>

          {!myShift ? (
            <Panel title="Apri turno di cassa">
              <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
                <div className="grid gap-1.5">
                  <Label>Operatore</Label>
                  <Input
                    placeholder={session?.user.email ?? "Nome cassiere"}
                    value={openForm.operator_name}
                    onChange={(e) => setOpenForm({ ...openForm, operator_name: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Fondo cassa iniziale (€)</Label>
                  <Input
                    inputMode="decimal"
                    value={openForm.opening_float}
                    onChange={(e) => setOpenForm({ ...openForm, opening_float: e.target.value })}
                  />
                </div>
                <Button size="lg" onClick={openShift}>
                  <Unlock className="h-4 w-4" />
                  Apri cassa
                </Button>
              </div>
            </Panel>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
              <Panel
                title="Vendita"
                actions={
                  <Pill tone="navy">
                    Turno: {myShift.operator_name} · fondo {eur(myShift.opening_float)}
                  </Pill>
                }
              >
                <div className="grid gap-3">
                  {saleSectors.map((s) => (
                    <div key={s.id} className="rounded-lg border p-2">
                      <div className="mb-2 text-sm font-bold uppercase text-primary">{s.name}</div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                        {TICKET_TYPES.filter((t) => t !== "accredito").map((t) => {
                          const p = priceOf(s.id, t);
                          const disabled = Number.isNaN(p);
                          return (
                            <button
                              key={t}
                              disabled={disabled}
                              onClick={() => addToCart(s.id, t)}
                              className={cn(
                                "min-h-16 rounded-lg border-2 p-2 text-left transition active:scale-95",
                                disabled
                                  ? "cursor-not-allowed border-dashed opacity-40"
                                  : t === "intero"
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : t === "omaggio"
                                      ? "border-muted bg-muted"
                                      : "border-accent/40 bg-card hover:bg-secondary",
                              )}
                            >
                              <div className="text-xs font-semibold uppercase">
                                {TICKET_LABEL[t]}
                              </div>
                              <div className="font-display text-xl font-bold">
                                {disabled ? "—" : eur(p)}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>

              <div className="grid content-start gap-4">
                <Panel title="Carrello" actions={<ShoppingCart className="h-5 w-5 text-accent" />}>
                  {!cart.length ? (
                    <Empty>Tocca un prezzo per aggiungere biglietti</Empty>
                  ) : (
                    <div className="grid gap-2">
                      {cart.map((l, i) => (
                        <div
                          key={`${l.sector_id}-${l.ticket_type}`}
                          className="flex items-center gap-2 text-sm"
                        >
                          <div className="flex-1">
                            <div className="font-medium">{sectorName(l.sector_id)}</div>
                            <div className="text-xs text-muted-foreground">
                              {TICKET_LABEL[l.ticket_type]} · {eur(l.unit_price)}
                            </div>
                          </div>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-9 w-9"
                            aria-label="Meno"
                            onClick={() => setQty(i, -1)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-6 text-center font-bold tabular-nums">{l.qty}</span>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-9 w-9"
                            aria-label="Più"
                            onClick={() => setQty(i, 1)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                          <span className="w-20 text-right tabular-nums">
                            {eur(l.qty * l.unit_price)}
                          </span>
                        </div>
                      ))}
                      <div className="mt-2 flex items-center justify-between border-t pt-2 font-display text-2xl font-bold text-primary">
                        <span>Totale</span>
                        <span>{eur(cartTotal)}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant={pay === "contanti" ? "default" : "outline"}
                          onClick={() => setPay("contanti")}
                        >
                          <Banknote className="h-4 w-4" />
                          Contanti
                        </Button>
                        <Button
                          variant={pay === "pos" ? "default" : "outline"}
                          onClick={() => setPay("pos")}
                        >
                          <CreditCard className="h-4 w-4" />
                          POS
                        </Button>
                      </div>
                      {pay === "contanti" && (
                        <div className="grid gap-2">
                          <Input
                            inputMode="decimal"
                            placeholder="Importo ricevuto €"
                            value={given}
                            onChange={(e) => setGiven(e.target.value)}
                            className="h-12 text-lg"
                          />
                          <div className="flex flex-wrap gap-1">
                            {[5, 10, 20, 50, 100].map((v) => (
                              <Button
                                key={v}
                                size="sm"
                                variant="outline"
                                onClick={() => setGiven(String(v))}
                              >
                                {eur(v)}
                              </Button>
                            ))}
                          </div>
                          {change != null && (
                            <div
                              className={cn(
                                "rounded-lg p-2 text-center font-display text-2xl font-bold",
                                change < 0
                                  ? "bg-destructive/10 text-destructive"
                                  : "bg-success/15 text-success",
                              )}
                            >
                              Resto {eur(Math.max(0, change))}
                              {change < 0 && " (mancano " + eur(-change) + ")"}
                            </div>
                          )}
                        </div>
                      )}
                      <div className="grid grid-cols-[auto_1fr] gap-2">
                        <Button variant="ghost" onClick={() => setCart([])} aria-label="Svuota">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="lg"
                          variant="destructive"
                          disabled={busy}
                          onClick={checkout}
                          className="h-14 text-lg"
                        >
                          Incassa {eur(cartTotal)}
                        </Button>
                      </div>
                    </div>
                  )}
                </Panel>

                {lastQr.length > 0 && (
                  <Panel
                    title="Ultimi biglietti (QR)"
                    actions={
                      <Button size="sm" variant="outline" onClick={() => window.print()}>
                        <Printer className="h-4 w-4" />
                        Stampa
                      </Button>
                    }
                  >
                    <div className="flex flex-wrap gap-3 print-area">
                      {lastQr.map((q) => (
                        <div key={q} className="text-center">
                          <QrImage value={q} size={110} />
                          <div className="font-mono text-[10px]">{q}</div>
                        </div>
                      ))}
                    </div>
                  </Panel>
                )}

                <Panel title="Il mio turno">
                  <div className="grid gap-1 text-sm">
                    <div className="flex justify-between">
                      <span>Aperto</span>
                      <span>{fmtDateTime(myShift.opened_at)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Fondo cassa</span>
                      <span className="tabular-nums">{eur(myShift.opening_float)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Contanti incassati</span>
                      <span className="tabular-nums">{eur(shiftCash)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>POS</span>
                      <span className="tabular-nums">{eur(shiftPos)}</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span>Contanti attesi in cassa</span>
                      <span className="tabular-nums">{eur(expected)}</span>
                    </div>
                  </div>
                  <Button
                    className="mt-3 w-full"
                    variant="outline"
                    onClick={() => setClosing(true)}
                  >
                    <Lock className="h-4 w-4" />
                    Chiudi cassa
                  </Button>
                </Panel>
              </div>
            </div>
          )}

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Panel title="Turni della partita">
              {!shifts.length ? (
                <Empty>Nessun turno</Empty>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Operatore</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead className="text-right">Atteso</TableHead>
                      <TableHead className="text-right">Contato</TableHead>
                      <TableHead className="text-right">Differenza</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shifts.map((s) => {
                      const diff =
                        s.counted_cash != null && s.expected_cash != null
                          ? Number(s.counted_cash) - Number(s.expected_cash)
                          : null;
                      return (
                        <TableRow key={s.id}>
                          <TableCell>
                            {s.operator_name}
                            <div className="text-xs text-muted-foreground">
                              {fmtDateTime(s.opened_at)}
                            </div>
                          </TableCell>
                          <TableCell>
                            {s.closed_at ? (
                              <Pill tone="fatto">Chiuso</Pill>
                            ) : (
                              <Pill tone="7">Aperto</Pill>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {s.expected_cash != null ? eur(s.expected_cash) : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {s.counted_cash != null ? eur(s.counted_cash) : "—"}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-right font-bold tabular-nums",
                              diff != null && Math.abs(diff) >= 0.01 && "text-destructive",
                            )}
                          >
                            {diff != null ? eur(diff) : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </Panel>
            <Panel title="Ultime vendite">
              {!sales.length ? (
                <Empty>Nessuna vendita</Empty>
              ) : (
                <div className="max-h-80 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ora</TableHead>
                        <TableHead>Settore</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Q.tà</TableHead>
                        <TableHead className="text-right">Totale</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sales.slice(0, 60).map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="text-xs">
                            {fmtDateTime(s.created_at).slice(11)}
                          </TableCell>
                          <TableCell className="text-xs">{sectorName(s.sector_id)}</TableCell>
                          <TableCell className="text-xs">
                            {TICKET_LABEL[s.ticket_type] ?? s.ticket_type}
                            <div className="text-muted-foreground">
                              {s.channel === "online"
                                ? "online"
                                : (PAY_LABEL[s.payment_method] ?? s.payment_method)}
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{s.qty}</TableCell>
                          <TableCell className="text-right tabular-nums">{eur(s.total)}</TableCell>
                          <TableCell>
                            {s.shift_id === myShift?.id && (
                              <Button
                                size="icon"
                                variant="ghost"
                                aria-label="Annulla vendita"
                                onClick={() => voidSale(s)}
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
          </div>
        </>
      )}

      <Dialog open={closing} onOpenChange={setClosing}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Chiusura cassa – conteggio contanti</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {DENOMS.map((d) => (
              <div key={d} className="flex items-center gap-2">
                <span className="w-16 text-right text-sm font-semibold tabular-nums">{eur(d)}</span>
                <span className="text-muted-foreground">×</span>
                <Input
                  inputMode="numeric"
                  className="h-9"
                  value={denoms[String(d)] ?? ""}
                  onChange={(e) =>
                    setDenoms({ ...denoms, [String(d)]: e.target.value.replace(/\D/g, "") })
                  }
                />
              </div>
            ))}
          </div>
          <div className="grid gap-1 rounded-lg bg-secondary p-3 text-sm">
            <div className="flex justify-between">
              <span>Contanti attesi (fondo + incassi)</span>
              <b className="tabular-nums">{eur(expected)}</b>
            </div>
            <div className="flex justify-between">
              <span>Contanti contati</span>
              <b className="tabular-nums">{eur(counted)}</b>
            </div>
            <div
              className={cn(
                "flex justify-between font-display text-xl font-bold",
                Math.abs(counted - expected) < 0.01 ? "text-success" : "text-destructive",
              )}
            >
              <span>Differenza</span>
              <span className="tabular-nums">{eur(counted - expected)}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClosing(false)}>
              Annulla
            </Button>
            <Button variant="destructive" onClick={closeShift}>
              <Lock className="h-4 w-4" />
              Conferma chiusura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={importOpen}
        onOpenChange={(o) => {
          setImportOpen(o);
          if (!o) setPreview([]);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importa prevendita online (CSV)</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esporta dal rivenditore (TicketOne o altro) un CSV con le colonne <b>settore</b>,{" "}
            <b>tipologia</b>, <b>quantità</b>, <b>totale</b>. Separatore “;” o “,”. Le righe vengono
            registrate sul canale “online”.
          </p>
          <Input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
          {preview.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Settore</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Q.tà</TableHead>
                  <TableHead className="text-right">Totale</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.map((p, i) => (
                  <TableRow key={i} className={cn(!p.sector_id && "text-destructive")}>
                    <TableCell>{p.sector}</TableCell>
                    <TableCell>{TICKET_LABEL[p.ticket_type]}</TableCell>
                    <TableCell className="text-right">{p.qty}</TableCell>
                    <TableCell className="text-right">{eur(p.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              Annulla
            </Button>
            <Button disabled={!preview.length} onClick={confirmImport}>
              Importa {preview.length} righe
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Handshake, AlertTriangle, CalendarClock, Package } from "lucide-react";
import { db } from "@/lib/db";
import { useClub, useActiveSeason } from "@/hooks/useClub";
import { eur, fmtDate, daysUntil, todayISO } from "@/lib/format";
import { PageHeader, StatCard, Panel, Pill, Empty } from "@/components/app/ui-bits";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/sponsor/")({
  head: () => ({
    meta: [
      { title: "Cruscotto sponsor – GEMA360" },
      { name: "description", content: "Cruscotto commerciale sponsor." },
    ],
  }),
  component: SponsorDashboard,
});

type Contract = {
  id: string;
  sponsor_id: string;
  title: string | null;
  amount_cash: number;
  amount_goods: number;
  end_date: string | null;
  status: string;
  season_id: string | null;
  sponsors?: { name: string } | null;
};
type Inst = {
  id: string;
  contract_id: string;
  amount: number;
  vat_rate: number;
  due_date: string;
  paid_at: string | null;
  invoiced_at: string | null;
};
type Asset = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  price: number;
  season_id: string | null;
};

const gross = (i: Inst) => Number(i.amount) * (1 + Number(i.vat_rate) / 100);

function SponsorDashboard() {
  const { data: club } = useClub();
  const { data: season } = useActiveSeason();
  const { data, isLoading } = useQuery({
    queryKey: ["sponsor-dashboard"],
    queryFn: async () => {
      const [c, i, a, ca] = await Promise.all([
        db
          .from("sponsor_contracts")
          .select(
            "id,sponsor_id,title,amount_cash,amount_goods,end_date,status,season_id,sponsors(name)",
          )
          .neq("status", "annullato"),
        db
          .from("sponsor_installments")
          .select("id,contract_id,amount,vat_rate,due_date,paid_at,invoiced_at"),
        db.from("sponsor_assets").select("id,name,category,quantity,price,season_id"),
        db.from("contract_assets").select("asset_id,quantity,sponsor_contracts(status)"),
      ]);
      return {
        contracts: (c.data ?? []) as Contract[],
        inst: (i.data ?? []) as Inst[],
        assets: (a.data ?? []) as Asset[],
        sold: (ca.data ?? []) as {
          asset_id: string;
          quantity: number;
          sponsor_contracts: { status: string } | null;
        }[],
      };
    },
  });
  if (isLoading || !data) return <div className="text-muted-foreground">Caricamento…</div>;

  const today = todayISO();
  const contracts = data.contracts.filter(
    (c) => !season || !c.season_id || c.season_id === season.id,
  );
  const contracted = contracts.reduce(
    (s, c) => s + Number(c.amount_cash) + Number(c.amount_goods),
    0,
  );
  const cash = contracts.reduce((s, c) => s + Number(c.amount_cash), 0);
  const goods = contracts.reduce((s, c) => s + Number(c.amount_goods), 0);
  const target = Number(club?.sponsor_budget_target ?? 0);
  const paid = data.inst.filter((i) => i.paid_at).reduce((s, i) => s + gross(i), 0);
  const open = data.inst.filter((i) => !i.paid_at);
  const toCollect = open.reduce((s, i) => s + gross(i), 0);
  const late = open.filter((i) => i.due_date < today);
  const lateSum = late.reduce((s, i) => s + gross(i), 0);
  const toInvoice = data.inst.filter((i) => !i.invoiced_at && daysUntil(i.due_date) <= 15);
  const renewals = data.contracts
    .filter((c) => c.end_date && daysUntil(c.end_date) >= 0 && daysUntil(c.end_date) <= 90)
    .sort((a, b) => (a.end_date! < b.end_date! ? -1 : 1));

  const soldBy = new Map<string, number>();
  data.sold.forEach((s) => {
    if (s.sponsor_contracts?.status !== "annullato")
      soldBy.set(s.asset_id, (soldBy.get(s.asset_id) ?? 0) + Number(s.quantity));
  });
  const unsold = data.assets
    .filter((a) => !season || !a.season_id || a.season_id === season.id)
    .map((a) => ({ ...a, free: Number(a.quantity) - (soldBy.get(a.id) ?? 0) }))
    .filter((a) => a.free > 0);
  const unsoldValue = unsold.reduce((s, a) => s + a.free * Number(a.price), 0);

  const bySponsor = new Map<string, { name: string; total: number }>();
  contracts.forEach((c) => {
    const k = c.sponsor_id;
    const cur = bySponsor.get(k) ?? { name: c.sponsors?.name ?? "—", total: 0 };
    cur.total += Number(c.amount_cash) + Number(c.amount_goods);
    bySponsor.set(k, cur);
  });
  const top = [...bySponsor.values()].sort((a, b) => b.total - a.total).slice(0, 10);
  const pct = target > 0 ? Math.min(100, Math.round((contracted / target) * 100)) : 0;
  const lateByContract = (cid: string) =>
    data.contracts.find((c) => c.id === cid)?.sponsors?.name ?? "—";

  return (
    <div>
      <PageHeader
        title="Cruscotto sponsor"
        subtitle={`Stagione ${season?.name ?? "attiva"} · contratti, incassi, rinnovi e spazi`}
        actions={
          <>
            <Button asChild size="sm" variant="outline">
              <Link to="/sponsor/crm">CRM</Link>
            </Button>
            <Button asChild size="sm" variant="destructive">
              <Link to="/sponsor/contratti">Contratti</Link>
            </Button>
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          tone="navy"
          label="Contrattualizzato"
          value={eur(contracted)}
          hint={`Denaro ${eur(cash)} · merce ${eur(goods)}`}
          icon={<Handshake className="h-4 w-4" />}
        />
        <StatCard tone="green" label="Incassato (IVA incl.)" value={eur(paid)} />
        <StatCard
          tone="orange"
          label="Da incassare"
          value={eur(toCollect)}
          hint={`${open.length} rate aperte`}
        />
        <StatCard
          tone="red"
          label="Scaduto"
          value={eur(lateSum)}
          hint={`${late.length} rate oltre la scadenza`}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
      </div>

      <Panel className="mt-6" title="Obiettivo di budget">
        <div className="mb-2 flex justify-between text-sm">
          <span>
            {eur(contracted)} su {eur(target)}
          </span>
          <b>{pct}%</b>
        </div>
        <Progress value={pct} />
        {target > contracted && (
          <p className="mt-2 text-xs text-muted-foreground">
            Mancano {eur(target - contracted)} all'obiettivo. Valore spazi ancora invenduti:{" "}
            {eur(unsoldValue)}.
          </p>
        )}
      </Panel>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel
          title="Rinnovi entro 90 giorni"
          actions={<CalendarClock className="h-4 w-4 text-muted-foreground" />}
        >
          {renewals.length ? (
            <ul className="divide-y text-sm">
              {renewals.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2">
                  <span>
                    <b>{c.sponsors?.name}</b>{" "}
                    <span className="text-muted-foreground">{c.title}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums">{fmtDate(c.end_date)}</span>
                    <Pill tone={daysUntil(c.end_date!) <= 30 ? "7" : "30"}>
                      {daysUntil(c.end_date!)} gg
                    </Pill>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Nessun contratto in scadenza nei prossimi 90 giorni.</Empty>
          )}
        </Panel>
        <Panel title="Rate scadute">
          {late.length ? (
            <ul className="divide-y text-sm">
              {late.map((i) => (
                <li key={i.id} className="flex items-center justify-between py-2">
                  <span>{lateByContract(i.contract_id)}</span>
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums">{fmtDate(i.due_date)}</span>
                    <b className="text-destructive">{eur(gross(i))}</b>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Nessuna rata scaduta. </Empty>
          )}
          {toInvoice.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              {toInvoice.length} rate da fatturare entro 15 giorni.
            </p>
          )}
        </Panel>
        <Panel title="Top sponsor">
          {top.length ? (
            <table className="w-full text-sm">
              <tbody>
                {top.map((t, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="py-2 pr-2 text-muted-foreground">{idx + 1}</td>
                    <td className="py-2 font-medium">{t.name}</td>
                    <td className="py-2 text-right tabular-nums">{eur(t.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty>Nessun contratto.</Empty>
          )}
        </Panel>
        <Panel
          title="Spazi invenduti"
          actions={<Package className="h-4 w-4 text-muted-foreground" />}
        >
          {unsold.length ? (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-1">Spazio</th>
                  <th>Liberi</th>
                  <th className="text-right">Valore</th>
                </tr>
              </thead>
              <tbody>
                {unsold.slice(0, 12).map((a) => (
                  <tr key={a.id} className="border-t">
                    <td className="py-2">
                      {a.name}
                      <div className="text-xs text-muted-foreground">{a.category}</div>
                    </td>
                    <td>{a.free}</td>
                    <td className="text-right tabular-nums">{eur(a.free * Number(a.price))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty>Tutti gli spazi sono venduti.</Empty>
          )}
          <div className="mt-2 text-right text-sm">
            Totale invenduto: <b>{eur(unsoldValue)}</b> ·{" "}
            <Link className="underline" to="/sponsor/spazi">
              Gestisci spazi
            </Link>
          </div>
        </Panel>
      </div>
    </div>
  );
}

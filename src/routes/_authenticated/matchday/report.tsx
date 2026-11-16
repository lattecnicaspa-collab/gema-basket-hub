import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Printer } from "lucide-react";
import {
  Bar,
  CartesianGrid,
  Legend,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { db } from "@/lib/db";
import { useActiveSeason } from "@/hooks/useClub";
import { eur, fmtDate, num } from "@/lib/format";
import { downloadCSV } from "@/lib/export";
import { PageHeader, Panel, Empty, StatCard } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TIER_LABEL, useMatches } from "./-shared";

export const Route = createFileRoute("/_authenticated/matchday/report")({
  head: () => ({
    meta: [
      { title: "Report match day – GEMA360" },
      { name: "description", content: "Spettatori e incassi della stagione partita per partita." },
    ],
  }),
  component: ReportPage,
});

const NAVY = "#0B2A5B";
const RED = "#C8102E";

function ReportPage() {
  const { data: season } = useActiveSeason();
  const { data: matches = [] } = useMatches(season?.id);
  const { data } = useQuery({
    queryKey: ["md-report", season?.id, matches.length],
    enabled: !!season?.id && matches.length > 0,
    queryFn: async () => {
      const ids = matches.map((m) => m.id);
      const [sales, accr, entries, subs, prevSeason] = await Promise.all([
        db
          .from("ticket_sales")
          .select("match_id,qty,total,channel")
          .in("match_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
        db
          .from("accreditations")
          .select("match_id")
          .in("match_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
        db
          .from("entries")
          .select("match_id")
          .in("match_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
        db
          .from("subscribers")
          .select("paid,price,renewed_from_previous")
          .eq("season_id", season!.id),
        db
          .from("seasons")
          .select("id,name")
          .lt("start_date", season!.start_date)
          .order("start_date", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      let prevSubs: number | null = null;
      if (prevSeason.data?.id) {
        const r = await db
          .from("subscribers")
          .select("id", { count: "exact", head: true })
          .eq("season_id", prevSeason.data.id)
          .eq("paid", true);
        prevSubs = r.count ?? null;
      }
      return {
        sales: (sales.data ?? []) as {
          match_id: string;
          qty: number;
          total: number;
          channel: string;
        }[],
        accr: (accr.data ?? []) as { match_id: string }[],
        entries: (entries.data ?? []) as { match_id: string }[],
        subs: (subs.data ?? []) as {
          paid: boolean;
          price: number;
          renewed_from_previous: boolean | null;
        }[],
        prevSeasonName: prevSeason.data?.name as string | undefined,
        prevSubs,
      };
    },
  });

  const paidSubs = data?.subs.filter((s) => s.paid).length ?? 0;
  const rows = useMemo(() => {
    if (!data) return [];
    return matches.map((m) => {
      const s = data.sales.filter((x) => x.match_id === m.id);
      const paganti = s.filter((x) => Number(x.total) > 0).reduce((a, x) => a + Number(x.qty), 0);
      const omaggi = s.filter((x) => Number(x.total) <= 0).reduce((a, x) => a + Number(x.qty), 0);
      const accrediti = data.accr.filter((x) => x.match_id === m.id).length;
      const entrati = data.entries.filter((x) => x.match_id === m.id).length;
      const botteghino = s
        .filter((x) => x.channel !== "online")
        .reduce((a, x) => a + Number(x.total), 0);
      const online = s
        .filter((x) => x.channel === "online")
        .reduce((a, x) => a + Number(x.total), 0);
      const played = new Date(m.match_date).getTime() < Date.now();
      return {
        m,
        played,
        paganti,
        omaggi,
        accrediti,
        abbonati: paidSubs,
        spettatori: paganti + omaggi + accrediti + paidSubs,
        entrati,
        botteghino,
        online,
        incasso: botteghino + online,
      };
    });
  }, [data, matches, paidSubs]);

  const played = rows.filter((r) => r.played);
  const tot = played.reduce(
    (a, r) => ({ spett: a.spett + r.spettatori, inc: a.inc + r.incasso, ent: a.ent + r.entrati }),
    { spett: 0, inc: 0, ent: 0 },
  );
  const avg = played.length ? Math.round(tot.spett / played.length) : 0;
  const subsIncome = data?.subs.filter((s) => s.paid).reduce((a, s) => a + Number(s.price), 0) ?? 0;
  const renewals = data?.subs.filter((s) => s.renewed_from_previous).length ?? 0;
  const chart = played.map((r) => ({
    name: `${r.m.round ? "G" + r.m.round + " " : ""}${r.m.opponent.split(" ")[0]}`,
    Spettatori: r.spettatori,
    Incasso: Math.round(r.incasso),
  }));

  const exportRows = () =>
    rows.map((r) => ({
      Giornata: r.m.round ?? "",
      Data: fmtDate(r.m.match_date),
      Avversario: r.m.opponent,
      Fascia: TIER_LABEL[r.m.tier] ?? r.m.tier,
      Giocata: r.played ? "Sì" : "No",
      Paganti: r.paganti,
      Omaggi: r.omaggi,
      Abbonati: r.abbonati,
      Accrediti: r.accrediti,
      Spettatori: r.spettatori,
      "Entrati (QR)": r.entrati,
      "Incasso botteghino": r.botteghino,
      "Prevendita online": r.online,
      "Incasso totale": r.incasso,
    }));

  return (
    <div className="print-area">
      <PageHeader
        title="Report match day"
        subtitle={`Spettatori e incassi${season ? ` · stagione ${season.name}` : ""}`}
        actions={
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={!rows.length}
              onClick={() =>
                downloadCSV(
                  `report-matchday-${season?.name?.replace("/", "-") ?? ""}.csv`,
                  exportRows(),
                )
              }
            >
              <Download className="h-4 w-4" />
              Excel
            </Button>
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              PDF
            </Button>
          </>
        }
      />
      {!data ? (
        <Empty>Caricamento…</Empty>
      ) : (
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatCard
              label="Partite giocate"
              value={`${played.length} / ${rows.length}`}
              tone="navy"
            />
            <StatCard
              label="Media spettatori"
              value={num(avg)}
              hint={`${num(tot.spett)} in totale`}
            />
            <StatCard label="Incasso biglietteria" value={eur(tot.inc)} tone="red" />
            <StatCard
              label="Abbonati paganti"
              value={num(paidSubs)}
              hint={
                data.prevSubs != null
                  ? `${data.prevSeasonName}: ${num(data.prevSubs)} (${paidSubs - data.prevSubs >= 0 ? "+" : ""}${num(paidSubs - data.prevSubs)})`
                  : `${num(renewals)} rinnovi`
              }
            />
            <StatCard label="Incasso abbonamenti" value={eur(subsIncome)} tone="green" />
          </div>

          <Panel title="Andamento stagione">
            {!chart.length ? (
              <Empty>Nessuna partita ancora giocata.</Empty>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="l" tick={{ fontSize: 11 }} />
                    <YAxis
                      yAxisId="r"
                      orientation="right"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => `€${num(v)}`}
                    />
                    <Tooltip
                      formatter={(v: number, n: string) => (n === "Incasso" ? eur(v) : num(v))}
                    />
                    <Legend />
                    <Bar yAxisId="l" dataKey="Spettatori" fill={NAVY} radius={[4, 4, 0, 0]} />
                    <Line
                      yAxisId="r"
                      dataKey="Incasso"
                      stroke={RED}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </Panel>

          <Panel title="Partita per partita">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Partita</TableHead>
                    <TableHead className="text-right">Paganti</TableHead>
                    <TableHead className="text-right">Omaggi</TableHead>
                    <TableHead className="text-right">Abbonati</TableHead>
                    <TableHead className="text-right">Accrediti</TableHead>
                    <TableHead className="text-right">Spettatori</TableHead>
                    <TableHead className="text-right">Entrati</TableHead>
                    <TableHead className="text-right">Botteghino</TableHead>
                    <TableHead className="text-right">Online</TableHead>
                    <TableHead className="text-right">Totale</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.m.id} className={r.played ? "" : "text-muted-foreground"}>
                      <TableCell>
                        <div className="font-medium">
                          {r.m.round ? `G${r.m.round} · ` : ""}vs {r.m.opponent}
                        </div>
                        <div className="text-xs">
                          {fmtDate(r.m.match_date)} · {TIER_LABEL[r.m.tier] ?? r.m.tier}
                          {!r.played && " · in programma"}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{num(r.paganti)}</TableCell>
                      <TableCell className="text-right tabular-nums">{num(r.omaggi)}</TableCell>
                      <TableCell className="text-right tabular-nums">{num(r.abbonati)}</TableCell>
                      <TableCell className="text-right tabular-nums">{num(r.accrediti)}</TableCell>
                      <TableCell className="text-right font-bold tabular-nums">
                        {num(r.spettatori)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{num(r.entrati)}</TableCell>
                      <TableCell className="text-right tabular-nums">{eur(r.botteghino)}</TableCell>
                      <TableCell className="text-right tabular-nums">{eur(r.online)}</TableCell>
                      <TableCell className="text-right font-bold tabular-nums">
                        {eur(r.incasso)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell>Totale giocate ({played.length})</TableCell>
                    <TableCell className="text-right">
                      {num(played.reduce((a, r) => a + r.paganti, 0))}
                    </TableCell>
                    <TableCell className="text-right">
                      {num(played.reduce((a, r) => a + r.omaggi, 0))}
                    </TableCell>
                    <TableCell className="text-right">—</TableCell>
                    <TableCell className="text-right">
                      {num(played.reduce((a, r) => a + r.accrediti, 0))}
                    </TableCell>
                    <TableCell className="text-right">{num(tot.spett)}</TableCell>
                    <TableCell className="text-right">{num(tot.ent)}</TableCell>
                    <TableCell className="text-right">
                      {eur(played.reduce((a, r) => a + r.botteghino, 0))}
                    </TableCell>
                    <TableCell className="text-right">
                      {eur(played.reduce((a, r) => a + r.online, 0))}
                    </TableCell>
                    <TableCell className="text-right">{eur(tot.inc)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Gli abbonati paganti sono conteggiati come presenti a ogni partita; la colonna
              “Entrati” riporta gli ingressi effettivi registrati con la scansione QR.
            </p>
          </Panel>
        </div>
      )}
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { db } from "@/lib/db";
import { useClub, useActiveSeason } from "@/hooks/useClub";
import { eur, num, fmtDate, todayISO } from "@/lib/format";
import { PageHeader, Empty, Notice } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/sponsor/report")({
  head: () => ({
    meta: [
      { title: "Report sponsor – GEMA360" },
      { name: "description", content: "Report di fine stagione per lo sponsor." },
    ],
  }),
  component: Report,
});

type Deliv = {
  id: string;
  type: string;
  description: string | null;
  delivered: boolean;
  delivered_at: string | null;
  interactions: number | null;
  proof_url: string | null;
  match_id: string | null;
  contract_id: string;
};
type Contract = {
  id: string;
  title: string | null;
  amount_cash: number;
  amount_goods: number;
  start_date: string | null;
  end_date: string | null;
  led_seconds_per_match: number;
  posts_per_season: number;
  tickets_per_match: number;
  hospitality_per_match: number;
  season_id: string | null;
  status: string;
};

function Report() {
  const { data: club } = useClub();
  const { data: season } = useActiveSeason();
  const [sponsorId, setSponsorId] = useState("");
  const { data: sponsors = [] } = useQuery({
    queryKey: ["sponsors-min"],
    queryFn: async () =>
      (await db.from("sponsors").select("id,name").is("deleted_at", null).order("name")).data ?? [],
  });

  const { data, isFetching } = useQuery({
    queryKey: ["sponsor-report", sponsorId, season?.id],
    enabled: !!sponsorId,
    queryFn: async () => {
      const [sp, cs, played, acc] = await Promise.all([
        db.from("sponsors").select("*").eq("id", sponsorId).single(),
        db
          .from("sponsor_contracts")
          .select("*")
          .eq("sponsor_id", sponsorId)
          .neq("status", "annullato"),
        db
          .from("matches")
          .select("id,opponent,match_date,round,home_score,away_score")
          .eq("status", "chiusa")
          .order("match_date"),
        db.from("accreditations").select("id,match_id,is_hospitality").eq("sponsor_id", sponsorId),
      ]);
      const contracts = ((cs.data ?? []) as Contract[]).filter(
        (c) => !season || !c.season_id || c.season_id === season.id,
      );
      const ids = contracts.map((c) => c.id);
      const del = ids.length
        ? (((await db.from("sponsor_deliverables").select("*").in("contract_id", ids)).data ??
            []) as Deliv[])
        : [];
      const matches = (played.data ?? []) as {
        id: string;
        opponent: string;
        match_date: string;
        round: number | null;
        home_score: number | null;
        away_score: number | null;
      }[];
      const counts = await Promise.all(
        matches.map(async (m) => {
          const [e, s] = await Promise.all([
            db.from("entries").select("id", { count: "exact", head: true }).eq("match_id", m.id),
            db.from("ticket_sales").select("qty").eq("match_id", m.id),
          ]);
          const sold = ((s.data ?? []) as { qty: number }[]).reduce((t, x) => t + Number(x.qty), 0);
          return { ...m, spectators: Math.max(e.count ?? 0, sold) };
        }),
      );
      return {
        sponsor: sp.data,
        contracts,
        del,
        matches: counts,
        acc: (acc.data ?? []) as { id: string; match_id: string; is_hospitality: boolean | null }[],
      };
    },
  });

  const d = data;
  const totalSpect = d?.matches.reduce((s, m) => s + m.spectators, 0) ?? 0;
  const ledDel = d?.del.filter((x) => x.type === "LED" && x.delivered) ?? [];
  const ledSeconds =
    (d?.contracts.reduce((s, c) => Math.max(s, Number(c.led_seconds_per_match)), 0) ?? 0) *
    ledDel.length;
  const posts = d?.del.filter((x) => x.type === "Social" && x.delivered) ?? [];
  const interactions = posts.reduce((s, x) => s + Number(x.interactions ?? 0), 0);
  const guests = d?.acc.length ?? 0;
  const hosp = d?.acc.filter((a) => a.is_hospitality).length ?? 0;
  const delivered = d?.del.filter((x) => x.delivered).length ?? 0;
  const value =
    d?.contracts.reduce((s, c) => s + Number(c.amount_cash) + Number(c.amount_goods), 0) ?? 0;
  const byType = new Map<string, { tot: number; done: number }>();
  d?.del.forEach((x) => {
    const v = byType.get(x.type) ?? { tot: 0, done: 0 };
    v.tot++;
    if (x.delivered) v.done++;
    byType.set(x.type, v);
  });
  const proofs = d?.del.filter((x) => x.delivered && x.proof_url).slice(0, 12) ?? [];

  return (
    <div>
      <PageHeader
        title="Report sponsor"
        subtitle="Report di stagione da consegnare allo sponsor per il rinnovo"
        actions={
          <>
            <Select value={sponsorId} onValueChange={setSponsorId}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Scegli lo sponsor…" />
              </SelectTrigger>
              <SelectContent>
                {sponsors.map((s: { id: string; name: string }) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => window.print()} disabled={!d}>
              <Printer className="h-4 w-4" />
              Stampa / PDF
            </Button>
          </>
        }
      />
      {!sponsorId && <Empty>Scegli uno sponsor per generare il report.</Empty>}
      {sponsorId && isFetching && !d && <div className="text-muted-foreground">Caricamento…</div>}
      {d?.sponsor && (
        <section className="print-area rounded-xl border bg-white p-6 text-black shadow-card">
          <div className="mb-6 flex items-center justify-between border-b-4 border-[#C8102E] pb-4">
            <div>
              <div className="text-xs uppercase tracking-widest text-[#0B2A5B]">
                Report di visibilità · stagione {season?.name ?? ""}
              </div>
              <h2 className="text-3xl font-bold text-[#0B2A5B]">{d.sponsor.name}</h2>
              <div className="text-sm">
                {club?.name} · {club?.venue_name ?? "PalaTerme"}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {d.sponsor.logo_url && (
                <img src={d.sponsor.logo_url} alt="" className="h-14 w-14 object-contain" />
              )}
              {club?.logo_url && (
                <img src={club.logo_url} alt="" className="h-14 w-14 object-contain" />
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Partite casalinghe", num(d.matches.length)],
              ["Spettatori totali", num(totalSpect)],
              [
                "Passaggi LED",
                `${num(ledDel.length)}${ledSeconds ? ` · ${num(ledSeconds)} s` : ""}`,
              ],
              ["Post social", `${num(posts.length)} · ${num(interactions)} interazioni`],
              ["Ospiti accreditati", num(guests)],
              ["Di cui hospitality", num(hosp)],
              ["Controprestazioni erogate", `${delivered} / ${d.del.length}`],
              ["Valore contratti", eur(value)],
            ].map(([l, v]) => (
              <div key={l} className="rounded-lg border-l-4 border-[#C8102E] bg-[#0B2A5B]/5 p-3">
                <div className="text-xs uppercase text-gray-600">{l}</div>
                <div className="text-xl font-bold text-[#0B2A5B]">{v}</div>
              </div>
            ))}
          </div>

          <h3 className="mt-6 mb-2 text-lg font-bold uppercase text-[#0B2A5B]">
            Controprestazioni per tipo
          </h3>
          {byType.size ? (
            <table className="w-full text-sm">
              <thead className="bg-[#0B2A5B] text-left text-white">
                <tr>
                  <th className="p-2">Tipo</th>
                  <th className="p-2">Erogate</th>
                  <th className="p-2">Previste</th>
                  <th className="p-2">%</th>
                </tr>
              </thead>
              <tbody>
                {[...byType.entries()].map(([t, v]) => (
                  <tr key={t} className="border-b">
                    <td className="p-2">{t}</td>
                    <td className="p-2">{v.done}</td>
                    <td className="p-2">{v.tot}</td>
                    <td className="p-2">{Math.round((v.done / v.tot) * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-gray-500">Nessuna controprestazione registrata.</p>
          )}

          <h3 className="mt-6 mb-2 text-lg font-bold uppercase text-[#0B2A5B]">
            Partite e spettatori
          </h3>
          {d.matches.length ? (
            <table className="w-full text-sm">
              <thead className="bg-[#0B2A5B] text-left text-white">
                <tr>
                  <th className="p-2">Data</th>
                  <th className="p-2">Partita</th>
                  <th className="p-2">Risultato</th>
                  <th className="p-2 text-right">Spettatori</th>
                  <th className="p-2 text-right">Ospiti sponsor</th>
                </tr>
              </thead>
              <tbody>
                {d.matches.map((m) => (
                  <tr key={m.id} className="border-b">
                    <td className="p-2">{fmtDate(m.match_date)}</td>
                    <td className="p-2">
                      {m.round ? `G${m.round} · ` : ""}Gema – {m.opponent}
                    </td>
                    <td className="p-2">
                      {m.home_score != null ? `${m.home_score}-${m.away_score}` : "—"}
                    </td>
                    <td className="p-2 text-right">{num(m.spectators)}</td>
                    <td className="p-2 text-right">
                      {d.acc.filter((a) => a.match_id === m.id).length}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-gray-500">Nessuna partita casalinga disputata.</p>
          )}

          {proofs.length > 0 && (
            <>
              <h3 className="mt-6 mb-2 text-lg font-bold uppercase text-[#0B2A5B]">
                Prove di erogazione
              </h3>
              <ul className="grid gap-1 text-sm sm:grid-cols-2">
                {proofs.map((p) => (
                  <li key={p.id}>
                    {fmtDate(p.delivered_at)} · {p.type}:{" "}
                    <a className="underline" href={p.proof_url!} target="_blank" rel="noreferrer">
                      {p.proof_url}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="mt-8 text-xs text-gray-600">
            Report generato il {fmtDate(todayISO())}. Spettatori: ingressi registrati al controllo
            accessi o biglietti venduti, se maggiori. {club?.footer_text}
          </p>
        </section>
      )}
      {d && !d.contracts.length && (
        <div className="mt-4">
          <Notice tone="info">
            Questo sponsor non ha contratti attivi nella stagione corrente.
          </Notice>
        </div>
      )}
    </div>
  );
}

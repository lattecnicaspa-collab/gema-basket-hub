import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Handshake, Ticket, Users, AlertTriangle, CheckCircle2 } from "lucide-react";
import { db } from "@/lib/db";
import { useRoles } from "@/lib/auth";
import { eur, num, fmtDate, fmtLong, todayISO, isoPlus, urgency, daysUntil } from "@/lib/format";
import {
  PageHeader,
  StatCard,
  Panel,
  Pill,
  UrgencyDot,
  Empty,
  Notice,
} from "@/components/app/ui-bits";
import { Progress } from "@/components/ui/progress";
import { useClub } from "@/hooks/useClub";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard – GEMA360" },
      { name: "description", content: "Cruscotto della direzione." },
      { property: "og:title", content: "Dashboard – GEMA360" },
      { property: "og:description", content: "Cruscotto della direzione." },
    ],
  }),
  component: Dashboard,
});

function useDash() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [dl, contracts, inst, next, played, sales, entries, certs, fip, enr, ann, ledger] =
        await Promise.all([
          db
            .from("deadlines")
            .select("id,title,category,due_date,status,amount")
            .in("status", ["da_fare", "in_corso"])
            .is("deleted_at", null)
            .lte("due_date", isoPlus(14))
            .order("due_date"),
          db
            .from("sponsor_contracts")
            .select("id,amount_cash,amount_goods,end_date,status,sponsors(name)")
            .neq("status", "annullato"),
          db.from("sponsor_installments").select("amount,vat_rate,due_date,paid_at"),
          db
            .from("matches")
            .select("*")
            .gte("match_date", new Date().toISOString())
            .order("match_date")
            .limit(1)
            .maybeSingle(),
          db.from("matches").select("id,opponent,match_date").eq("status", "chiusa"),
          db.from("ticket_sales").select("match_id,total,qty"),
          db.from("entries").select("match_id", { count: "exact", head: true }),
          db.from("medical_certificates").select("id,expiry_date").lte("expiry_date", isoPlus(30)),
          db.from("fip_registrations").select("id").neq("status", "attivo"),
          db.from("enrollments").select("id").eq("status", "in_attesa"),
          db
            .from("announcements")
            .select("*")
            .order("pinned", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(3),
          db.from("ledger_entries").select("amount,direction,area,method"),
        ]);
      let avail: {
        capacity: number;
        subscribers: number;
        accreditations: number;
        sold: number;
        free: number;
      }[] = [];
      let checklist = { done: 0, total: 0 };
      if (next.data) {
        const a = await db.rpc("match_availability", { _match: next.data.id });
        avail = a.data ?? [];
        const c = await db.from("match_checklist").select("done").eq("match_id", next.data.id);
        checklist = {
          done: (c.data ?? []).filter((x: { done: boolean }) => x.done).length,
          total: (c.data ?? []).length,
        };
      }
      return {
        dl: dl.data ?? [],
        contracts: contracts.data ?? [],
        inst: inst.data ?? [],
        next: next.data,
        played: played.data ?? [],
        sales: sales.data ?? [],
        entriesCount: entries.count ?? 0,
        certs: certs.data ?? [],
        fip: fip.data ?? [],
        enr: enr.data ?? [],
        ann: ann.data ?? [],
        ledger: ledger.data ?? [],
        avail,
        checklist,
      };
    },
  });
}

function Dashboard() {
  const { hasAny, loading } = useRoles();
  const { data: club } = useClub();
  const { data, isLoading } = useDash();
  const staff = hasAny([
    "direttivo",
    "segreteria",
    "tesoriere",
    "responsabile_commerciale",
    "direttore_sportivo",
    "ufficio_stampa",
  ]);
  if (loading || isLoading || !data)
    return <div className="text-muted-foreground">Caricamento…</div>;
  if (!staff) return <FamilyHome ann={data.ann} />;

  const today = todayISO();
  const overdue = data.dl.filter((d: { due_date: string }) => d.due_date < today);
  const upcoming = data.dl.filter((d: { due_date: string }) => d.due_date >= today);
  const contracted = data.contracts.reduce(
    (s: number, c: { amount_cash: number; amount_goods: number }) =>
      s + Number(c.amount_cash) + Number(c.amount_goods),
    0,
  );
  const gross = (i: { amount: number; vat_rate: number }) =>
    Number(i.amount) * (1 + Number(i.vat_rate) / 100);
  const paid = data.inst
    .filter((i: { paid_at: string | null }) => i.paid_at)
    .reduce((s: number, i: never) => s + gross(i), 0);
  const late = data.inst
    .filter((i: { paid_at: string | null; due_date: string }) => !i.paid_at && i.due_date < today)
    .reduce((s: number, i: never) => s + gross(i), 0);
  const toCollect = data.inst
    .filter((i: { paid_at: string | null }) => !i.paid_at)
    .reduce((s: number, i: never) => s + gross(i), 0);
  const renewals = data.contracts.filter(
    (c: { end_date: string | null }) =>
      c.end_date && daysUntil(c.end_date) <= 90 && daysUntil(c.end_date) >= 0,
  );
  const matchesPlayed = data.played.length || 1;
  const avgSpect = Math.round(data.entriesCount / matchesPlayed);
  const boxOffice = data.sales.reduce((s: number, x: { total: number }) => s + Number(x.total), 0);
  const commercial = data.ledger
    .filter(
      (l: { area: string; direction: string }) =>
        l.area === "commerciale" && l.direction === "entrata",
    )
    .reduce((s: number, l: { amount: number }) => s + Number(l.amount), 0);
  const A = data.avail.reduce(
    (acc, a) => ({
      cap: acc.cap + a.capacity,
      sub: acc.sub + Number(a.subscribers),
      acc: acc.acc + Number(a.accreditations),
      sold: acc.sold + Number(a.sold),
      free: acc.free + Number(a.free),
    }),
    { cap: 0, sub: 0, acc: 0, sold: 0, free: 0 },
  );

  return (
    <div>
      <PageHeader title="Direzione" subtitle={`${club?.name ?? ""} · stagione 2026/27`} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          tone="red"
          label="Scadenze scadute"
          value={overdue.length}
          hint={`${upcoming.length} nei prossimi 14 giorni`}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <StatCard
          tone="navy"
          label="Sponsor contrattualizzato"
          value={eur(contracted)}
          hint={`Obiettivo ${eur(club?.sponsor_budget_target)}`}
          icon={<Handshake className="h-4 w-4" />}
        />
        <StatCard
          label="Sponsor incassato"
          value={eur(paid)}
          hint={
            <span>
              Da incassare {eur(toCollect)} ·{" "}
              <b className="text-destructive">scaduto {eur(late)}</b>
            </span>
          }
        />
        <StatCard
          label="Media spettatori"
          value={num(avgSpect)}
          hint={`Incasso botteghino ${eur(boxOffice)} · ${data.played.length} gare`}
          icon={<Users className="h-4 w-4" />}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title={
            <span className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5" />
              Scadenze 14 giorni
            </span>
          }
          actions={
            <Link to="/scadenzario" className="text-sm text-accent underline">
              Apri scadenzario
            </Link>
          }
        >
          {data.dl.length === 0 ? (
            <Empty>Nessuna scadenza imminente.</Empty>
          ) : (
            <ul className="divide-y">
              {data.dl
                .slice(0, 14)
                .map(
                  (d: {
                    id: string;
                    title: string;
                    category: string;
                    due_date: string;
                    status: string;
                    amount: number | null;
                  }) => (
                    <li key={d.id} className="flex items-center gap-3 py-2 text-sm">
                      <UrgencyDot u={urgency(d.due_date, d.status)} />
                      <span className="w-24 shrink-0 font-semibold tabular-nums">
                        {fmtDate(d.due_date)}
                      </span>
                      <span className="flex-1 truncate">{d.title}</span>
                      <span className="hidden text-xs text-muted-foreground sm:inline">
                        {d.category}
                      </span>
                      {d.amount ? <span className="tabular-nums">{eur(d.amount)}</span> : null}
                    </li>
                  ),
                )}
            </ul>
          )}
        </Panel>

        <Panel
          title={
            <span className="flex items-center gap-2">
              <Ticket className="h-5 w-5" />
              Prossima in casa
            </span>
          }
        >
          {data.next ? (
            <div>
              <div className="rounded-lg bg-hero p-4 text-primary-foreground">
                <div className="text-xs uppercase opacity-80">
                  Giornata {data.next.round} · PalaTerme
                </div>
                <div className="font-display text-2xl font-extrabold uppercase">
                  Gema vs {data.next.opponent}
                </div>
                <div className="text-sm capitalize opacity-90">{fmtLong(data.next.match_date)}</div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg bg-muted p-2">
                  <div className="text-xs text-muted-foreground">Abbonati</div>
                  <b>{num(A.sub)}</b>
                </div>
                <div className="rounded-lg bg-muted p-2">
                  <div className="text-xs text-muted-foreground">Accrediti</div>
                  <b>{num(A.acc)}</b>
                </div>
                <div className="rounded-lg bg-muted p-2">
                  <div className="text-xs text-muted-foreground">Venduti</div>
                  <b>{num(A.sold)}</b>
                </div>
                <div className="rounded-lg bg-muted p-2">
                  <div className="text-xs text-muted-foreground">Posti liberi</div>
                  <b className="text-success">{num(A.free)}</b> / {num(A.cap)}
                </div>
              </div>
              <div className="mt-3 text-sm">
                Checklist {data.checklist.done}/{data.checklist.total}
              </div>
              <Progress
                value={
                  data.checklist.total ? (data.checklist.done / data.checklist.total) * 100 : 0
                }
                className="mt-1"
              />
              {!data.next.aed_checked && (
                <div className="mt-3">
                  <Notice tone="danger">
                    DAE non ancora verificato / operatore BLSD da indicare.
                  </Notice>
                </div>
              )}
              <Link to="/matchday" className="mt-3 inline-block text-sm text-accent underline">
                Apri match day
              </Link>
            </div>
          ) : (
            <Empty>Nessuna partita in programma.</Empty>
          )}
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel title="Rinnovi sponsor entro 90 gg">
          {renewals.length === 0 ? (
            <Empty>Nessun rinnovo imminente.</Empty>
          ) : (
            <ul className="space-y-2 text-sm">
              {renewals.map((c: { id: string; end_date: string; sponsors: { name: string } }) => (
                <li key={c.id} className="flex justify-between">
                  <span>{c.sponsors?.name}</span>
                  <Pill tone={urgency(c.end_date)}>{fmtDate(c.end_date)}</Pill>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        {hasAny(["tesoriere", "direttivo"]) && (
          <Panel title="Tesoreria">
            <div className="text-sm">
              Proventi commerciali {eur(commercial)} su soglia {eur(club?.commercial_threshold)}
            </div>
            <Progress
              value={Math.min(
                100,
                (commercial / Number(club?.commercial_threshold || 400000)) * 100,
              )}
              className="mt-2"
            />
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg bg-muted p-2">
                <div className="text-xs text-muted-foreground">Cassa</div>
                <b>
                  {eur(
                    data.ledger
                      .filter((l: { method: string }) => l.method === "cassa")
                      .reduce(
                        (s: number, l: { amount: number; direction: string }) =>
                          s + (l.direction === "entrata" ? 1 : -1) * Number(l.amount),
                        0,
                      ),
                  )}
                </b>
              </div>
              <div className="rounded-lg bg-muted p-2">
                <div className="text-xs text-muted-foreground">Banca</div>
                <b>
                  {eur(
                    data.ledger
                      .filter((l: { method: string }) => l.method !== "cassa")
                      .reduce(
                        (s: number, l: { amount: number; direction: string }) =>
                          s + (l.direction === "entrata" ? 1 : -1) * Number(l.amount),
                        0,
                      ),
                  )}
                </b>
              </div>
            </div>
          </Panel>
        )}
        {hasAny(["segreteria", "direttore_sportivo"]) && (
          <Panel title="Segreteria">
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between">
                Certificati scaduti o in scadenza (30 gg)<Pill tone="7">{data.certs.length}</Pill>
              </li>
              <li className="flex justify-between">
                Tesseramenti FIP da completare<Pill tone="30">{data.fip.length}</Pill>
              </li>
              <li className="flex justify-between">
                Iscrizioni da approvare<Pill tone="navy">{data.enr.length}</Pill>
              </li>
            </ul>
            <Link
              to="/modulo/$slug"
              params={{ slug: "certificati" }}
              className="mt-3 inline-block text-sm text-accent underline"
            >
              Vai ai certificati
            </Link>
          </Panel>
        )}
      </div>
    </div>
  );
}

function FamilyHome({
  ann,
}: {
  ann: { id: string; title: string; body: string; pinned: boolean; created_at: string }[];
}) {
  return (
    <div>
      <PageHeader title="Ciao!" subtitle="La tua area Gema" />
      <Notice tone="info">
        Il tuo account non ha ancora un ruolo operativo. La segreteria collegherà il tuo profilo
        alla scheda di tuo figlio o al tuo ruolo in società.
      </Notice>
      <div className="mt-4 space-y-3">
        {ann.map((a) => (
          <Panel
            key={a.id}
            title={
              <span className="flex items-center gap-2">
                {a.pinned && <CheckCircle2 className="h-4 w-4 text-accent" />}
                {a.title}
              </span>
            }
          >
            <p className="text-sm">{a.body}</p>
            <p className="mt-1 text-xs text-muted-foreground">{fmtDate(a.created_at)}</p>
          </Panel>
        ))}
      </div>
    </div>
  );
}

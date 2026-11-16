import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Trash2, Ticket, Printer, CheckCircle2 } from "lucide-react";
import { db } from "@/lib/db";
import { useAuth, useRoles } from "@/lib/auth";
import { useClub } from "@/hooks/useClub";
import { eur, fmtDate, fmtLong } from "@/lib/format";
import { PageHeader, Panel, Pill, Empty, StatCard, Notice } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/portale-sponsor")({
  head: () => ({
    meta: [
      { title: "Portale sponsor – GEMA360" },
      { name: "description", content: "Area riservata agli sponsor." },
    ],
  }),
  component: Portale,
});

type Sponsor = { id: string; name: string; logo_url: string | null };
type Contract = {
  id: string;
  title: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  amount_cash: number;
  amount_goods: number;
  tickets_per_match: number;
  hospitality_per_match: number;
  led_seconds_per_match: number;
  posts_per_season: number;
};
type Deliv = {
  id: string;
  contract_id: string;
  type: string;
  description: string | null;
  due_date: string | null;
  delivered: boolean;
  delivered_at: string | null;
  proof_url: string | null;
  interactions: number | null;
};
type Match = {
  id: string;
  opponent: string;
  match_date: string;
  round: number | null;
  competition: string | null;
};
type Acc = {
  id: string;
  match_id: string;
  full_name: string;
  email: string | null;
  is_hospitality: boolean | null;
  qr_code: string;
};

const guestSchema = z.object({
  full_name: z.string().trim().min(3, "Nome e cognome obbligatori").max(120),
  email: z.string().trim().email("Email non valida").max(200).or(z.literal("")),
});

function Portale() {
  const { session } = useAuth();
  const { roles, hasAny } = useRoles();
  const { data: club } = useClub();
  const staff = hasAny(["direttivo", "responsabile_commerciale"]) && !roles.includes("sponsor");
  const [preview, setPreview] = useState("");
  const uid = session?.user.id;

  const { data: all = [] } = useQuery({
    queryKey: ["sponsors-min"],
    enabled: staff,
    queryFn: async () =>
      (await db.from("sponsors").select("id,name").is("deleted_at", null).order("name")).data ?? [],
  });
  const { data: sponsor, isLoading } = useQuery({
    queryKey: ["my-sponsor", uid, preview],
    enabled: !!uid,
    queryFn: async () => {
      const q =
        staff && preview
          ? db.from("sponsors").select("id,name,logo_url").eq("id", preview)
          : db.from("sponsors").select("id,name,logo_url").eq("portal_user_id", uid);
      return ((await q.maybeSingle()).data ?? null) as Sponsor | null;
    },
  });

  if (isLoading) return <div className="text-muted-foreground">Caricamento…</div>;
  return (
    <div>
      <PageHeader
        title="Portale sponsor"
        subtitle={sponsor ? `${sponsor.name} · area riservata` : "Area riservata agli sponsor"}
        actions={
          staff ? (
            <Select value={preview} onValueChange={setPreview}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Anteprima come sponsor…" />
              </SelectTrigger>
              <SelectContent>
                {all.map((s: { id: string; name: string }) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : undefined
        }
      />
      {!sponsor ? (
        <Empty>
          {staff
            ? "Scegli uno sponsor per vedere la sua area."
            : "Il tuo account non è ancora collegato a uno sponsor. Contatta l'ufficio commerciale della società."}
        </Empty>
      ) : (
        <SponsorArea
          sponsor={sponsor}
          hoursBefore={Number(club?.guest_names_hours_before ?? 48)}
          readOnly={staff}
        />
      )}
    </div>
  );
}

function SponsorArea({
  sponsor,
  hoursBefore,
  readOnly,
}: {
  sponsor: Sponsor;
  hoursBefore: number;
  readOnly: boolean;
}) {
  const { data } = useQuery({
    queryKey: ["portal", sponsor.id],
    queryFn: async () => {
      const [c, m] = await Promise.all([
        db
          .from("sponsor_contracts")
          .select("*")
          .eq("sponsor_id", sponsor.id)
          .neq("status", "annullato")
          .order("start_date", { ascending: false }),
        db
          .from("matches")
          .select("id,opponent,match_date,round,competition")
          .gte("match_date", new Date().toISOString())
          .order("match_date")
          .limit(8),
      ]);
      const contracts = (c.data ?? []) as Contract[];
      const ids = contracts.map((x) => x.id);
      const d = ids.length
        ? (((
            await db
              .from("sponsor_deliverables")
              .select("*")
              .in("contract_id", ids)
              .order("due_date")
          ).data ?? []) as Deliv[])
        : [];
      return { contracts, matches: (m.data ?? []) as Match[], deliv: d };
    },
  });
  if (!data) return <div className="text-muted-foreground">Caricamento…</div>;
  const active = data.contracts.filter((c) => c.status === "attivo");
  const quota = active.reduce(
    (s, c) => s + Number(c.tickets_per_match) + Number(c.hospitality_per_match),
    0,
  );
  const hospQuota = active.reduce((s, c) => s + Number(c.hospitality_per_match), 0);
  const done = data.deliv.filter((d) => d.delivered).length;
  const pct = data.deliv.length ? Math.round((done / data.deliv.length) * 100) : 0;
  const interactions = data.deliv.reduce((s, d) => s + Number(d.interactions ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard tone="navy" label="Contratti attivi" value={active.length} />
        <StatCard
          label="Ospiti per partita"
          value={quota}
          hint={`di cui hospitality ${hospQuota}`}
          icon={<Ticket className="h-4 w-4" />}
        />
        <StatCard
          tone="green"
          label="Controprestazioni erogate"
          value={`${pct}%`}
          hint={`${done} su ${data.deliv.length}`}
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <StatCard label="Interazioni social" value={interactions} />
      </div>

      <Panel title="Ospiti alle prossime partite">
        <Notice tone="info">
          Inserisci i nominativi entro {hoursBefore} ore dall'inizio della partita. Ogni ospite
          riceve un pass con QR da mostrare all'ingresso.
        </Notice>
        <div className="mt-4 space-y-4">
          {data.matches.length ? (
            data.matches.map((m) => (
              <MatchGuests
                key={m.id}
                m={m}
                sponsorId={sponsor.id}
                quota={quota}
                hospQuota={hospQuota}
                hoursBefore={hoursBefore}
                readOnly={readOnly}
              />
            ))
          ) : (
            <Empty>Nessuna partita in programma.</Empty>
          )}
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="I tuoi contratti">
          {data.contracts.length ? (
            <ul className="divide-y text-sm">
              {data.contracts.map((c) => (
                <li key={c.id} className="py-2">
                  <div className="flex justify-between">
                    <b>{c.title ?? "Contratto"}</b>
                    <Pill tone={c.status === "attivo" ? "fatto" : "ok"}>{c.status}</Pill>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {fmtDate(c.start_date)} → {fmtDate(c.end_date)} ·{" "}
                    {eur(Number(c.amount_cash) + Number(c.amount_goods))}
                  </div>
                  <div className="text-xs">
                    {c.led_seconds_per_match ? `${c.led_seconds_per_match}s LED/partita · ` : ""}
                    {c.posts_per_season ? `${c.posts_per_season} post/stagione · ` : ""}
                    {c.tickets_per_match} biglietti + {c.hospitality_per_match} hospitality/partita
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Nessun contratto.</Empty>
          )}
        </Panel>
        <Panel
          title="Controprestazioni"
          actions={
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              PDF
            </Button>
          }
        >
          <div className="mb-3">
            <Progress value={pct} />
          </div>
          {data.deliv.length ? (
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <tbody>
                  {data.deliv.map((d) => (
                    <tr key={d.id} className="border-t">
                      <td className="py-2 pr-2 tabular-nums">{fmtDate(d.due_date)}</td>
                      <td className="py-2">
                        <b>{d.type}</b>{" "}
                        <span className="text-muted-foreground">{d.description}</span>
                        {d.proof_url && (
                          <a
                            className="ml-1 text-xs underline"
                            href={d.proof_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            prova
                          </a>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        {d.delivered ? (
                          <Pill tone="fatto">Erogata</Pill>
                        ) : (
                          <Pill tone="ok">Prevista</Pill>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>Nessuna controprestazione registrata.</Empty>
          )}
        </Panel>
      </div>
    </div>
  );
}

function MatchGuests({
  m,
  sponsorId,
  quota,
  hospQuota,
  hoursBefore,
  readOnly,
}: {
  m: Match;
  sponsorId: string;
  quota: number;
  hospQuota: number;
  hoursBefore: number;
  readOnly: boolean;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ full_name: "", email: "", is_hospitality: false });
  const key = ["portal-acc", sponsorId, m.id];
  const { data: guests = [] } = useQuery({
    queryKey: key,
    queryFn: async () =>
      ((
        await db
          .from("accreditations")
          .select("id,match_id,full_name,email,is_hospitality,qr_code")
          .eq("sponsor_id", sponsorId)
          .eq("match_id", m.id)
          .order("full_name")
      ).data ?? []) as Acc[],
  });
  const deadline = new Date(new Date(m.match_date).getTime() - hoursBefore * 3600000);
  const closed = new Date() > deadline;
  const hospUsed = guests.filter((g) => g.is_hospitality).length;
  const full = guests.length >= quota;

  async function add() {
    if (closed) return toast.error("Termine per i nominativi scaduto");
    if (full) return toast.error("Hai raggiunto il numero di ospiti previsto dal contratto");
    if (form.is_hospitality && hospUsed >= hospQuota)
      return toast.error("Pass hospitality esauriti per questa partita");
    const p = guestSchema.safeParse({ full_name: form.full_name, email: form.email });
    if (!p.success) return toast.error(p.error.issues[0].message);
    const r = await db.from("accreditations").insert({
      match_id: m.id,
      list_type: "sponsor",
      sponsor_id: sponsorId,
      full_name: p.data.full_name,
      email: p.data.email || null,
      is_hospitality: form.is_hospitality,
    });
    if (r.error) return toast.error(r.error.message);
    setForm({ full_name: "", email: "", is_hospitality: false });
    qc.invalidateQueries({ queryKey: key });
    toast.success("Ospite aggiunto");
  }
  async function remove(id: string) {
    if (closed) return toast.error("Termine scaduto: contatta la società per modifiche");
    const r = await db.from("accreditations").delete().eq("id", id);
    if (r.error) return toast.error(r.error.message);
    qc.invalidateQueries({ queryKey: key });
  }

  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <b>
            {m.round ? `G${m.round} · ` : ""}Gema – {m.opponent}
          </b>
          <div className="text-xs text-muted-foreground">
            {fmtLong(m.match_date)} · {m.competition}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Pill tone={full ? "fatto" : "30"}>
            {guests.length} / {quota} ospiti
          </Pill>
          {closed ? (
            <Pill tone="scaduto">Nominativi chiusi</Pill>
          ) : (
            <span className="text-xs text-muted-foreground">
              entro {fmtLong(deadline.toISOString())}
            </span>
          )}
        </div>
      </div>
      {guests.length > 0 && (
        <ul className="mb-2 divide-y text-sm">
          {guests.map((g) => (
            <li key={g.id} className="flex items-center justify-between py-1.5">
              <span>
                {g.full_name}
                {g.is_hospitality && <Pill tone="red">Hospitality</Pill>}
                <span className="ml-2 text-xs text-muted-foreground">{g.email}</span>
              </span>
              <span className="flex items-center gap-2">
                <code className="text-xs">{g.qr_code}</code>
                {!readOnly && !closed && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => remove(g.id)}
                    aria-label="Rimuovi"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {!readOnly && !closed && !full && quota > 0 && (
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
          <div>
            <Label className="text-xs">Nome e cognome</Label>
            <Input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Email (per il pass)</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={form.is_hospitality}
              disabled={hospUsed >= hospQuota}
              onCheckedChange={(v) => setForm({ ...form, is_hospitality: v })}
            />
            Hospitality
          </label>
          <Button size="sm" onClick={add}>
            <Plus className="h-4 w-4" />
            Aggiungi
          </Button>
        </div>
      )}
      {quota === 0 && (
        <p className="text-xs text-muted-foreground">
          Il contratto non prevede biglietti o pass per le partite.
        </p>
      )}
    </div>
  );
}

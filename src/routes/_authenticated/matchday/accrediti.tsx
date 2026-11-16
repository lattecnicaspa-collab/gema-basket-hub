import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, IdCard, Plus, Printer, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { useActiveSeason, useClub } from "@/hooks/useClub";
import { useRoles } from "@/lib/auth";
import { fmtDateTime, num } from "@/lib/format";
import { downloadCSV } from "@/lib/export";
import { PageHeader, Panel, Pill, Empty, StatCard } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  defaultMatchId,
  LIST_TYPE_LABEL,
  MatchSelect,
  PassCard,
  useMatches,
  useSectors,
} from "./-shared";

export const Route = createFileRoute("/_authenticated/matchday/accrediti")({
  head: () => ({
    meta: [
      { title: "Accrediti – GEMA360" },
      {
        name: "description",
        content: "Accrediti e omaggi per sponsor, stampa, ospiti e istituzioni.",
      },
    ],
  }),
  component: AccreditiPage,
});

type Accr = {
  id: string;
  match_id: string;
  list_type: string;
  sponsor_id: string | null;
  full_name: string;
  organization: string | null;
  email: string | null;
  sector_id: string | null;
  is_hospitality: boolean | null;
  qr_code: string;
  created_at: string;
};

function AccreditiPage() {
  const qc = useQueryClient();
  const { data: club } = useClub();
  const { data: season } = useActiveSeason();
  const { data: matches = [] } = useMatches(season?.id);
  const { data: sectors = [] } = useSectors();
  const { hasAny } = useRoles();
  const canEdit = hasAny([
    "direttivo",
    "segreteria",
    "tesoriere",
    "responsabile_commerciale",
    "ufficio_stampa",
  ]);
  const [matchId, setMatchId] = useState("");
  useEffect(() => {
    if (!matchId && matches.length) setMatchId(defaultMatchId(matches));
  }, [matches, matchId]);
  const match = matches.find((m) => m.id === matchId);

  const { data: rows = [] } = useQuery({
    queryKey: ["accreditations", matchId],
    enabled: !!matchId,
    queryFn: async () =>
      ((
        await db
          .from("accreditations")
          .select("*")
          .eq("match_id", matchId)
          .order("list_type")
          .order("full_name")
      ).data ?? []) as Accr[],
  });
  const { data: sponsors = [] } = useQuery({
    queryKey: ["sponsors-min"],
    queryFn: async () =>
      (await db.from("sponsors").select("id,name").is("deleted_at", null).order("name")).data ?? [],
  });
  const { data: entered = [] } = useQuery({
    queryKey: ["entries-codes", matchId],
    enabled: !!matchId,
    queryFn: async () =>
      ((await db.from("entries").select("qr_code").eq("match_id", matchId)).data ?? []).map(
        (e: { qr_code: string }) => e.qr_code,
      ) as string[],
  });
  const enteredSet = useMemo(() => new Set(entered), [entered]);

  const [list, setList] = useState("tutte");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [passes, setPasses] = useState<Accr[] | null>(null);
  const [form, setForm] = useState<Partial<Accr> | null>(null);
  const filtered = rows.filter(
    (r) =>
      (list === "tutte" || r.list_type === list) &&
      (!q || `${r.full_name} ${r.organization ?? ""}`.toLowerCase().includes(q.toLowerCase())),
  );
  const sectorName = (id: string | null) => sectors.find((s) => s.id === id)?.name ?? "—";
  const sponsorName = (id: string | null) =>
    sponsors.find((s: { id: string }) => s.id === id)?.name;

  const counts = Object.keys(LIST_TYPE_LABEL).map((k) => ({
    k,
    n: rows.filter((r) => r.list_type === k).length,
  }));

  async function save() {
    if (!form) return;
    if ((form.full_name ?? "").trim().length < 2) return toast.error("Nome e cognome obbligatori");
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) return toast.error("Email non valida");
    const defaultSector =
      sectors.find(
        (s) =>
          s.kind ===
          (form.list_type === "stampa"
            ? "stampa"
            : form.is_hospitality
              ? "hospitality"
              : "pubblico"),
      )?.id ?? null;
    const payload = {
      match_id: matchId,
      list_type: form.list_type ?? "sponsor",
      sponsor_id: form.list_type === "sponsor" ? form.sponsor_id || null : null,
      full_name: form.full_name!.trim(),
      organization:
        form.organization?.trim() ||
        (form.list_type === "sponsor" ? (sponsorName(form.sponsor_id ?? null) ?? null) : null),
      email: form.email?.trim() || null,
      sector_id: form.sector_id || defaultSector,
      is_hospitality: !!form.is_hospitality,
    };
    const r = await db.from("accreditations").insert(payload);
    if (r.error) return toast.error(r.error.message);
    toast.success("Accredito aggiunto");
    setForm({ ...form, full_name: "", email: "" });
    qc.invalidateQueries({ queryKey: ["accreditations", matchId] });
    qc.invalidateQueries({ queryKey: ["availability", matchId] });
  }
  async function remove(a: Accr) {
    if (!window.confirm(`Eliminare l'accredito di ${a.full_name}?`)) return;
    const r = await db.from("accreditations").delete().eq("id", a.id);
    if (r.error) return toast.error(r.error.message);
    qc.invalidateQueries({ queryKey: ["accreditations", matchId] });
  }
  function sendEmail(a: Accr) {
    const subject = encodeURIComponent(
      `Accredito ${club?.name ?? "Gema"} vs ${match?.opponent ?? ""}`,
    );
    const body = encodeURIComponent(
      `Gentile ${a.full_name},\n\nè accreditato/a per la partita ${club?.name ?? ""} vs ${match?.opponent ?? ""} del ${fmtDateTime(match?.match_date)} al PalaTerme.\nSettore: ${sectorName(a.sector_id)}\nCodice di ingresso: ${a.qr_code}\n\nPresenti il codice (o il pass stampato) agli steward all'ingresso.\n\nCordiali saluti`,
    );
    window.open(`mailto:${a.email ?? ""}?subject=${subject}&body=${body}`, "_blank");
  }

  return (
    <div>
      <PageHeader
        title="Accrediti"
        subtitle="Omaggi e pass nominativi per sponsor, stampa, ospiti, istituzioni, staff e famiglie"
        actions={
          <>
            <MatchSelect
              matches={matches}
              value={matchId}
              onChange={(v) => {
                setMatchId(v);
                setSel(new Set());
              }}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={!filtered.length}
              onClick={() =>
                downloadCSV(
                  "accrediti.csv",
                  filtered.map((r) => ({
                    Lista: LIST_TYPE_LABEL[r.list_type] ?? r.list_type,
                    Nome: r.full_name,
                    Organizzazione: r.organization ?? "",
                    Email: r.email ?? "",
                    Settore: sectorName(r.sector_id),
                    Hospitality: r.is_hospitality ? "Sì" : "No",
                    Codice: r.qr_code,
                    Entrato: enteredSet.has(r.qr_code) ? "Sì" : "No",
                  })),
                )
              }
            >
              <Download className="h-4 w-4" />
              Excel
            </Button>
            {canEdit && (
              <Button
                size="sm"
                variant="destructive"
                disabled={!matchId}
                onClick={() => setForm({ list_type: "stampa", is_hospitality: false })}
              >
                <Plus className="h-4 w-4" />
                Nuovo accredito
              </Button>
            )}
          </>
        }
      />

      {!match ? (
        <Empty>Nessuna partita per la stagione attiva.</Empty>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Accrediti totali" value={num(rows.length)} tone="navy" />
            <StatCard
              label="Hospitality"
              value={num(rows.filter((r) => r.is_hospitality).length)}
              tone="red"
            />
            <StatCard
              label="Già entrati"
              value={num(rows.filter((r) => enteredSet.has(r.qr_code)).length)}
              tone="green"
            />
            <StatCard
              label="Sponsor coinvolti"
              value={num(new Set(rows.filter((r) => r.sponsor_id).map((r) => r.sponsor_id)).size)}
            />
          </div>
          <Panel>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap gap-1">
                <Button
                  size="sm"
                  variant={list === "tutte" ? "default" : "outline"}
                  onClick={() => setList("tutte")}
                >
                  Tutte ({rows.length})
                </Button>
                {counts.map((c) => (
                  <Button
                    key={c.k}
                    size="sm"
                    variant={list === c.k ? "default" : "outline"}
                    onClick={() => setList(c.k)}
                  >
                    {LIST_TYPE_LABEL[c.k]} ({c.n})
                  </Button>
                ))}
              </div>
              <Input
                className="w-full sm:ml-auto sm:w-56"
                placeholder="Cerca"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={!sel.size}
                onClick={() => setPasses(rows.filter((r) => sel.has(r.id)))}
              >
                <IdCard className="h-4 w-4" />
                Stampa pass ({sel.size})
              </Button>
            </div>
            {!filtered.length ? (
              <Empty>Nessun accredito in questa lista.</Empty>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">
                        <Checkbox
                          checked={sel.size > 0 && filtered.every((r) => sel.has(r.id))}
                          onCheckedChange={(v) =>
                            setSel(v ? new Set(filtered.map((r) => r.id)) : new Set())
                          }
                          aria-label="Seleziona tutti"
                        />
                      </TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Lista</TableHead>
                      <TableHead>Settore</TableHead>
                      <TableHead>Ingresso</TableHead>
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
                          <div className="font-medium">{r.full_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {r.organization ?? ""}
                            {r.email ? ` · ${r.email}` : ""}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Pill tone="navy">{LIST_TYPE_LABEL[r.list_type] ?? r.list_type}</Pill>
                          {r.is_hospitality && (
                            <span className="ml-1">
                              <Pill tone="red">Hospitality</Pill>
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{sectorName(r.sector_id)}</TableCell>
                        <TableCell>
                          {enteredSet.has(r.qr_code) ? (
                            <Pill tone="fatto">Entrato</Pill>
                          ) : (
                            <Pill tone="ok">Atteso</Pill>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Pass"
                            onClick={() => setPasses([r])}
                          >
                            <IdCard className="h-4 w-4" />
                          </Button>
                          {r.email && (
                            <Button size="sm" variant="ghost" onClick={() => sendEmail(r)}>
                              Email
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
        </>
      )}

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Nuovo accredito</DialogTitle>
          </DialogHeader>
          {form && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Lista</Label>
                <Select
                  value={form.list_type ?? "stampa"}
                  onValueChange={(v) => setForm({ ...form, list_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(LIST_TYPE_LABEL).map(([k, l]) => (
                      <SelectItem key={k} value={k}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.list_type === "sponsor" ? (
                <div className="grid gap-1.5">
                  <Label>Sponsor</Label>
                  <Select
                    value={form.sponsor_id ?? ""}
                    onValueChange={(v) => setForm({ ...form, sponsor_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Scegli lo sponsor" />
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
              ) : (
                <div className="grid gap-1.5">
                  <Label>Organizzazione / testata</Label>
                  <Input
                    value={form.organization ?? ""}
                    onChange={(e) => setForm({ ...form, organization: e.target.value })}
                  />
                </div>
              )}
              <div className="grid gap-1.5">
                <Label>Nome e cognome</Label>
                <Input
                  value={form.full_name ?? ""}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && save()}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Email (per inviare il pass)</Label>
                <Input
                  type="email"
                  value={form.email ?? ""}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Settore</Label>
                <Select
                  value={form.sector_id ?? ""}
                  onValueChange={(v) => setForm({ ...form, sector_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Automatico" />
                  </SelectTrigger>
                  <SelectContent>
                    {sectors.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-2 self-end text-sm">
                <Switch
                  checked={!!form.is_hospitality}
                  onCheckedChange={(v) => setForm({ ...form, is_hospitality: v })}
                />
                Pass hospitality
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>
              Chiudi
            </Button>
            <Button onClick={save}>
              <Plus className="h-4 w-4" />
              Aggiungi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!passes} onOpenChange={(o) => !o && setPasses(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Pass accredito</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2 print-area">
            {passes?.map((p) => (
              <PassCard
                key={p.id}
                title={`${p.is_hospitality ? "Hospitality" : "Accredito"} · ${LIST_TYPE_LABEL[p.list_type] ?? p.list_type}`}
                name={p.full_name}
                line2={`${p.organization ? p.organization + " · " : ""}${sectorName(p.sector_id)} · vs ${match?.opponent ?? ""} ${fmtDateTime(match?.match_date)}`}
                code={p.qr_code}
                footer={club?.footer_text ?? undefined}
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

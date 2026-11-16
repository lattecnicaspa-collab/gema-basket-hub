import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Download, Plus, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { useActiveSeason } from "@/hooks/useClub";
import { eur } from "@/lib/format";
import { downloadCSV } from "@/lib/export";
import { PageHeader, Pill, Empty, Panel, StatCard } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

export const Route = createFileRoute("/_authenticated/sponsor/spazi")({
  head: () => ({
    meta: [
      { title: "Spazi vendibili – GEMA360" },
      { name: "description", content: "Inventario degli spazi sponsor." },
    ],
  }),
  component: Spazi,
});

type Asset = {
  id: string;
  season_id: string | null;
  name: string;
  category: string;
  unit: string | null;
  quantity: number;
  price: number;
  notes: string | null;
};
type Level = { id: string; name: string; list_price: number | null; sort: number };
const CATEGORIES = [
  "Maglia",
  "LED",
  "Cartellonistica",
  "Parquet",
  "Backdrop",
  "Maxischermo",
  "Social",
  "Sito e newsletter",
  "Speaker",
  "Naming",
  "Hospitality",
  "Eventi",
  "Altro",
];
const UNITS = ["stagione", "partita", "secondi/partita", "post", "evento"];

const assetSchema = z.object({
  season_id: z.string().uuid().nullable(),
  name: z.string().trim().min(2, "Nome obbligatorio").max(200),
  category: z.string().min(1),
  unit: z.string().max(50).nullable(),
  quantity: z.number().int().min(0),
  price: z.number().nonnegative(),
  notes: z.string().max(2000).nullable(),
});

function Spazi() {
  const qc = useQueryClient();
  const { data: season } = useActiveSeason();
  const [seasonId, setSeasonId] = useState<string>("attiva");
  const [edit, setEdit] = useState<Partial<Asset> | null>(null);
  const [del, setDel] = useState<Asset | null>(null);
  const { data: seasons = [] } = useQuery({
    queryKey: ["seasons"],
    queryFn: async () =>
      (await db.from("seasons").select("id,name").order("start_date", { ascending: false })).data ??
      [],
  });
  const { data: assets = [] } = useQuery({
    queryKey: ["sponsor_assets"],
    queryFn: async () =>
      ((await db.from("sponsor_assets").select("*").order("category").order("name")).data ??
        []) as Asset[],
  });
  const { data: sold = [] } = useQuery({
    queryKey: ["contract_assets_all"],
    queryFn: async () =>
      ((
        await db
          .from("contract_assets")
          .select("asset_id,quantity,sponsor_contracts(status,sponsors(name))")
      ).data ?? []) as {
        asset_id: string;
        quantity: number;
        sponsor_contracts: { status: string; sponsors: { name: string } | null } | null;
      }[],
  });

  const sid = seasonId === "attiva" ? season?.id : seasonId === "tutte" ? undefined : seasonId;
  const list = assets.filter((a) => !sid || !a.season_id || a.season_id === sid);
  const soldOf = (id: string) =>
    sold.filter((s) => s.asset_id === id && s.sponsor_contracts?.status !== "annullato");
  const rows = list.map((a) => {
    const s = soldOf(a.id);
    const q = s.reduce((t, x) => t + Number(x.quantity), 0);
    return {
      ...a,
      sold: q,
      free: Number(a.quantity) - q,
      buyers: s.map((x) => x.sponsor_contracts?.sponsors?.name).filter(Boolean) as string[],
    };
  });
  const totValue = rows.reduce((s, a) => s + Number(a.quantity) * Number(a.price), 0);
  const soldValue = rows.reduce((s, a) => s + a.sold * Number(a.price), 0);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["sponsor_assets"] });
    qc.invalidateQueries({ queryKey: ["sponsor-dashboard"] });
  };

  async function save() {
    const p = assetSchema.safeParse({
      season_id: edit?.season_id ?? null,
      name: edit?.name ?? "",
      category: edit?.category ?? "Altro",
      unit: edit?.unit || null,
      quantity: Number(edit?.quantity ?? 1),
      price: Number(edit?.price ?? 0),
      notes: edit?.notes || null,
    });
    if (!p.success) return toast.error(p.error.issues[0].message);
    const r = edit?.id
      ? await db.from("sponsor_assets").update(p.data).eq("id", edit.id)
      : await db.from("sponsor_assets").insert(p.data);
    if (r.error) return toast.error(r.error.message);
    toast.success("Spazio salvato");
    setEdit(null);
    refresh();
  }
  async function remove() {
    if (!del) return;
    if (soldOf(del.id).length) {
      setDel(null);
      return toast.error("Spazio collegato a contratti: rimuovilo prima dai contratti");
    }
    const r = await db.from("sponsor_assets").delete().eq("id", del.id);
    if (r.error) return toast.error(r.error.message);
    setDel(null);
    refresh();
    toast.success("Spazio eliminato");
  }

  return (
    <div>
      <PageHeader
        title="Spazi vendibili"
        subtitle="Inventario: maglia, LED, cartelloni PalaTerme, parquet, social, hospitality…"
        actions={
          <>
            <Select value={seasonId} onValueChange={setSeasonId}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="attiva">Stagione attiva</SelectItem>
                <SelectItem value="tutte">Tutte</SelectItem>
                {seasons.map((s: { id: string; name: string }) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                downloadCSV(
                  "spazi-sponsor.csv",
                  rows.map((a) => ({
                    Categoria: a.category,
                    Spazio: a.name,
                    Unità: a.unit ?? "",
                    Quantità: a.quantity,
                    Venduti: a.sold,
                    Liberi: a.free,
                    Prezzo: Number(a.price),
                    Sponsor: a.buyers.join(", "),
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
              onClick={() =>
                setEdit({
                  season_id: season?.id ?? null,
                  category: "LED",
                  unit: "stagione",
                  quantity: 1,
                  price: 0,
                })
              }
            >
              <Plus className="h-4 w-4" />
              Nuovo spazio
            </Button>
          </>
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard tone="navy" label="Valore listino" value={eur(totValue)} />
        <StatCard tone="green" label="Venduto" value={eur(soldValue)} />
        <StatCard tone="orange" label="Invenduto" value={eur(totValue - soldValue)} />
      </div>
      <Tabs defaultValue="spazi">
        <TabsList>
          <TabsTrigger value="spazi">Spazi</TabsTrigger>
          <TabsTrigger value="livelli">Livelli sponsor</TabsTrigger>
        </TabsList>
        <TabsContent value="spazi">
          {rows.length ? (
            <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
              <table className="w-full text-sm">
                <thead className="bg-primary text-left text-xs uppercase text-primary-foreground">
                  <tr>
                    <th className="p-3">Spazio</th>
                    <th className="hidden p-3 md:table-cell">Unità</th>
                    <th className="p-3 text-right">Prezzo</th>
                    <th className="p-3 text-center">Venduti / Tot.</th>
                    <th className="hidden p-3 lg:table-cell">Sponsor</th>
                    <th className="p-3" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => (
                    <tr key={a.id} className="border-t">
                      <td className="p-3">
                        <button
                          className="text-left font-medium hover:underline"
                          onClick={() => setEdit(a)}
                        >
                          {a.name}
                        </button>
                        <div className="text-xs text-muted-foreground">{a.category}</div>
                      </td>
                      <td className="hidden p-3 text-xs md:table-cell">{a.unit}</td>
                      <td className="p-3 text-right tabular-nums">{eur(a.price)}</td>
                      <td className="p-3 text-center">
                        <Pill tone={a.free < 0 ? "scaduto" : a.free === 0 ? "fatto" : "30"}>
                          {a.sold} / {a.quantity}
                        </Pill>
                        {a.free < 0 && <div className="text-xs text-destructive">Sovravenduto</div>}
                      </td>
                      <td className="hidden p-3 text-xs lg:table-cell">
                        {a.buyers.join(", ") || "—"}
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setDel(a)}
                          aria-label="Elimina"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>Nessuno spazio per questa stagione.</Empty>
          )}
        </TabsContent>
        <TabsContent value="livelli">
          <Levels />
        </TabsContent>
      </Tabs>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{edit?.id ? "Modifica spazio" : "Nuovo spazio"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Nome</Label>
              <Input
                value={edit?.name ?? ""}
                onChange={(e) => setEdit({ ...edit, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select
                value={edit?.category ?? "Altro"}
                onValueChange={(v) => setEdit({ ...edit, category: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[...new Set([...CATEGORIES, ...(edit?.category ? [edit.category] : [])])].map(
                    (c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Unità</Label>
              <Select
                value={edit?.unit ?? "stagione"}
                onValueChange={(v) => setEdit({ ...edit, unit: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[...new Set([...UNITS, ...(edit?.unit ? [edit.unit] : [])])].map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantità disponibile</Label>
              <Input
                type="number"
                min={0}
                value={edit?.quantity ?? ""}
                onChange={(e) =>
                  setEdit({ ...edit, quantity: e.target.value as unknown as number })
                }
              />
            </div>
            <div>
              <Label>Prezzo listino (€)</Label>
              <Input
                type="number"
                step="0.01"
                value={edit?.price ?? ""}
                onChange={(e) => setEdit({ ...edit, price: e.target.value as unknown as number })}
              />
            </div>
            <div className="col-span-2">
              <Label>Stagione</Label>
              <Select
                value={edit?.season_id ?? "none"}
                onValueChange={(v) => setEdit({ ...edit, season_id: v === "none" ? null : v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tutte</SelectItem>
                  {seasons.map((s: { id: string; name: string }) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Note</Label>
              <Textarea
                value={edit?.notes ?? ""}
                onChange={(e) => setEdit({ ...edit, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>
              Annulla
            </Button>
            <Button onClick={save}>Salva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare lo spazio?</AlertDialogTitle>
            <AlertDialogDescription>
              “{del?.name}” verrà eliminato definitivamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Elimina</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Levels() {
  const qc = useQueryClient();
  const [edit, setEdit] = useState<Partial<Level> | null>(null);
  const { data: levels = [] } = useQuery({
    queryKey: ["sponsor_levels"],
    queryFn: async () =>
      ((await db.from("sponsor_levels").select("*").order("sort")).data ?? []) as Level[],
  });
  const { data: used = [] } = useQuery({
    queryKey: ["sponsors-levels-used"],
    queryFn: async () =>
      (await db.from("sponsors").select("level_id").is("deleted_at", null)).data ?? [],
  });
  const count = (id: string) =>
    used.filter((u: { level_id: string | null }) => u.level_id === id).length;
  const refresh = () => qc.invalidateQueries({ queryKey: ["sponsor_levels"] });
  async function save() {
    const name = (edit?.name ?? "").trim();
    if (name.length < 2) return toast.error("Nome obbligatorio");
    const payload = {
      name: name.slice(0, 100),
      list_price:
        edit?.list_price != null && String(edit.list_price) !== "" ? Number(edit.list_price) : null,
      sort: Number(edit?.sort ?? levels.length + 1),
    };
    const r = edit?.id
      ? await db.from("sponsor_levels").update(payload).eq("id", edit.id)
      : await db.from("sponsor_levels").insert(payload);
    if (r.error) return toast.error(r.error.message);
    setEdit(null);
    refresh();
    toast.success("Livello salvato");
  }
  async function remove(l: Level) {
    if (count(l.id)) return toast.error("Livello assegnato a degli sponsor");
    const r = await db.from("sponsor_levels").delete().eq("id", l.id);
    if (r.error) return toast.error(r.error.message);
    refresh();
  }
  return (
    <Panel
      title="Livelli"
      actions={
        <Button size="sm" onClick={() => setEdit({ sort: levels.length + 1 })}>
          <Plus className="h-4 w-4" />
          Nuovo livello
        </Button>
      }
    >
      {levels.length ? (
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th>Ordine</th>
              <th>Livello</th>
              <th className="text-right">Prezzo listino</th>
              <th>Sponsor</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {levels.map((l) => (
              <tr key={l.id} className="border-t">
                <td className="py-2">{l.sort}</td>
                <td>
                  <button className="font-medium hover:underline" onClick={() => setEdit(l)}>
                    {l.name}
                  </button>
                </td>
                <td className="text-right tabular-nums">
                  {l.list_price != null ? eur(l.list_price) : "—"}
                </td>
                <td>{count(l.id)}</td>
                <td className="text-right">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => remove(l)}
                    aria-label="Elimina"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <Empty>Nessun livello.</Empty>
      )}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{edit?.id ? "Modifica livello" : "Nuovo livello"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Nome</Label>
              <Input
                value={edit?.name ?? ""}
                onChange={(e) => setEdit({ ...edit, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Prezzo listino (€)</Label>
              <Input
                type="number"
                step="0.01"
                value={edit?.list_price ?? ""}
                onChange={(e) =>
                  setEdit({ ...edit, list_price: e.target.value as unknown as number })
                }
              />
            </div>
            <div>
              <Label>Ordine</Label>
              <Input
                type="number"
                value={edit?.sort ?? ""}
                onChange={(e) => setEdit({ ...edit, sort: Number(e.target.value) })}
              />
            </div>
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

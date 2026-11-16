import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, CameraOff, CheckCircle2, Keyboard, XCircle } from "lucide-react";
import { db } from "@/lib/db";
import { useActiveSeason } from "@/hooks/useClub";
import { num } from "@/lib/format";
import { PageHeader, Panel, Empty, StatCard, Notice } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { defaultMatchId, MatchSelect, useMatches } from "./-shared";

export const Route = createFileRoute("/_authenticated/matchday/accessi")({
  head: () => ({
    meta: [
      { title: "Controllo accessi – GEMA360" },
      {
        name: "description",
        content: "Scansione QR di abbonamenti, biglietti e accrediti agli ingressi.",
      },
    ],
  }),
  component: AccessiPage,
});

type ScanResult = {
  ok: boolean;
  reason?: string;
  kind?: string;
  label?: string;
  sector?: string;
  remaining?: number;
  code: string;
  at: number;
};
type Avail = {
  sector_id: string;
  sector_name: string;
  capacity: number;
  subscribers: number;
  accreditations: number;
  sold: number;
  free: number;
  entered: number;
};

const KIND_LABEL: Record<string, string> = {
  abbonato: "Abbonato",
  accredito: "Accredito",
  hospitality: "Hospitality",
  biglietto: "Biglietto",
};

// BarcodeDetector non è ancora nei tipi standard di TypeScript
type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type DetectorCtor = new (opts: { formats: string[] }) => Detector;

function AccessiPage() {
  const qc = useQueryClient();
  const { data: season } = useActiveSeason();
  const { data: matches = [] } = useMatches(season?.id);
  const [matchId, setMatchId] = useState("");
  useEffect(() => {
    if (!matchId && matches.length) setMatchId(defaultMatchId(matches));
  }, [matches, matchId]);
  const match = matches.find((m) => m.id === matchId);

  const { data: avail = [] } = useQuery({
    queryKey: ["availability", matchId],
    enabled: !!matchId,
    refetchInterval: 5000,
    queryFn: async () => {
      const { data, error } = await db.rpc("match_availability", { _match: matchId });
      if (error) throw error;
      return (data ?? []) as Avail[];
    },
  });
  const totalEntered = avail.reduce((a, r) => a + Number(r.entered), 0);
  const expected = avail.reduce(
    (a, r) => a + Number(r.subscribers) + Number(r.accreditations) + Number(r.sold),
    0,
  );

  const [result, setResult] = useState<ScanResult | null>(null);
  const [history, setHistory] = useState<ScanResult[]>([]);
  const [manual, setManual] = useState("");
  const busy = useRef(false);
  const lastCode = useRef<{ code: string; at: number }>({ code: "", at: 0 });

  const scan = useCallback(
    async (raw: string) => {
      const code = raw.trim().toUpperCase();
      if (!code || !matchId || busy.current) return;
      // evita doppie letture dello stesso QR a raffica dalla fotocamera
      if (lastCode.current.code === code && Date.now() - lastCode.current.at < 3000) return;
      lastCode.current = { code, at: Date.now() };
      busy.current = true;
      const { data, error } = await db.rpc("scan_qr", { _match: matchId, _code: code });
      busy.current = false;
      const res: ScanResult = error
        ? { ok: false, reason: error.message, code, at: Date.now() }
        : { ...(data as Omit<ScanResult, "code" | "at">), code, at: Date.now() };
      setResult(res);
      setHistory((h) => [res, ...h].slice(0, 30));
      try {
        navigator.vibrate?.(res.ok ? 80 : [200, 80, 200]);
      } catch {
        /* vibrazione non supportata */
      }
      if (res.ok) qc.invalidateQueries({ queryKey: ["availability", matchId] });
    },
    [matchId, qc],
  );

  // fotocamera
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [camOn, setCamOn] = useState(false);
  const supported = typeof window !== "undefined" && "BarcodeDetector" in window;

  const stopCam = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamOn(false);
  }, []);

  async function startCam() {
    if (!supported)
      return toast.error(
        "Questo browser non legge i QR dalla fotocamera: usa Chrome su Android o l'inserimento manuale / lettore USB",
      );
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCamOn(true);
    } catch {
      toast.error("Fotocamera non disponibile o permesso negato");
    }
  }

  useEffect(() => {
    if (!camOn) return;
    const Ctor = (window as unknown as { BarcodeDetector: DetectorCtor }).BarcodeDetector;
    const detector = new Ctor({ formats: ["qr_code"] });
    let alive = true;
    const loop = async () => {
      if (!alive) return;
      const v = videoRef.current;
      if (v && v.readyState >= 2) {
        try {
          const codes = await detector.detect(v);
          if (codes[0]?.rawValue) await scan(codes[0].rawValue);
        } catch {
          /* frame non leggibile */
        }
      }
      setTimeout(loop, 250);
    };
    loop();
    return () => {
      alive = false;
    };
  }, [camOn, scan]);

  useEffect(() => () => stopCam(), [stopCam]);
  // il risultato grande sparisce dopo qualche secondo
  useEffect(() => {
    if (!result) return;
    const t = setTimeout(() => setResult(null), 4000);
    return () => clearTimeout(t);
  }, [result]);

  return (
    <div>
      <PageHeader
        title="Controllo accessi"
        subtitle="Scansione QR di abbonamenti, biglietti, accrediti e pass sponsor"
        actions={
          <MatchSelect
            matches={matches}
            value={matchId}
            onChange={(v) => {
              setMatchId(v);
              setHistory([]);
              setResult(null);
            }}
          />
        }
      />
      {!match ? (
        <Empty>Nessuna partita per la stagione attiva.</Empty>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="grid content-start gap-4">
            <div
              className={cn(
                "flex min-h-48 flex-col items-center justify-center rounded-2xl p-6 text-center transition-colors",
                !result
                  ? "border-2 border-dashed bg-card"
                  : result.ok
                    ? "bg-success text-success-foreground"
                    : "bg-destructive text-destructive-foreground",
              )}
            >
              {!result ? (
                <div className="text-muted-foreground">
                  <div className="font-display text-2xl font-bold uppercase text-primary">
                    Pronto
                  </div>
                  <div className="text-sm">Inquadra un QR o digita il codice</div>
                </div>
              ) : result.ok ? (
                <>
                  <CheckCircle2 className="h-16 w-16" />
                  <div className="font-display text-5xl font-bold uppercase">Entra</div>
                  <div className="mt-1 text-lg font-semibold">
                    {KIND_LABEL[result.kind ?? ""] ?? result.kind} · {result.label}
                  </div>
                  <div className="text-base">
                    Settore: <b>{result.sector ?? "—"}</b>
                    {result.remaining ? ` · ancora ${result.remaining} ingressi` : ""}
                  </div>
                </>
              ) : (
                <>
                  <XCircle className="h-16 w-16" />
                  <div className="font-display text-5xl font-bold uppercase">Stop</div>
                  <div className="mt-1 text-lg font-semibold">{result.reason}</div>
                  {result.label && (
                    <div className="text-base">
                      {result.label}
                      {result.sector ? ` · ${result.sector}` : ""}
                    </div>
                  )}
                </>
              )}
            </div>

            <Panel
              title="Fotocamera"
              actions={
                camOn ? (
                  <Button size="sm" variant="outline" onClick={stopCam}>
                    <CameraOff className="h-4 w-4" />
                    Spegni
                  </Button>
                ) : (
                  <Button size="sm" onClick={startCam}>
                    <Camera className="h-4 w-4" />
                    Avvia scansione
                  </Button>
                )
              }
            >
              <video
                ref={videoRef}
                playsInline
                muted
                className={cn(
                  "aspect-video w-full rounded-lg bg-black object-cover",
                  !camOn && "hidden",
                )}
              />
              {!camOn &&
                (supported ? (
                  <Empty>Premi “Avvia scansione” e consenti l'uso della fotocamera.</Empty>
                ) : (
                  <Notice tone="info">
                    Lettura da fotocamera non supportata da questo browser (serve Chrome/Edge su
                    Android o desktop). Puoi usare un lettore QR USB/Bluetooth: scrive il codice nel
                    campo qui sotto e preme Invio da solo.
                  </Notice>
                ))}
            </Panel>

            <Panel
              title="Inserimento manuale / lettore USB"
              actions={<Keyboard className="h-5 w-5 text-muted-foreground" />}
            >
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  lastCode.current = { code: "", at: 0 };
                  scan(manual);
                  setManual("");
                }}
              >
                <Input
                  autoFocus
                  className="h-12 font-mono text-lg uppercase"
                  placeholder="ABB-… / ACC-… / BIG-…"
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                />
                <Button type="submit" size="lg" className="h-12">
                  Verifica
                </Button>
              </form>
            </Panel>
          </div>

          <div className="grid content-start gap-4">
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Entrati" value={num(totalEntered)} tone="navy" />
              <StatCard
                label="Attesi"
                value={num(expected)}
                hint={expected ? `${Math.round((totalEntered / expected) * 100)}%` : undefined}
              />
            </div>
            <Panel title="Ingressi per settore">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Settore</TableHead>
                    <TableHead className="text-right">Entrati</TableHead>
                    <TableHead className="text-right">Capienza</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {avail.map((a) => (
                    <TableRow key={a.sector_id}>
                      <TableCell>{a.sector_name}</TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-bold tabular-nums",
                          Number(a.entered) > Number(a.capacity) && "text-destructive",
                        )}
                      >
                        {num(a.entered)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {num(a.capacity)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-2 text-xs text-muted-foreground">
                Aggiornamento automatico ogni 5 secondi
              </div>
            </Panel>
            <Panel title="Ultime scansioni">
              {!history.length ? (
                <Empty>Nessuna scansione</Empty>
              ) : (
                <div className="grid max-h-80 gap-1 overflow-y-auto">
                  {history.map((h, i) => (
                    <div
                      key={`${h.code}-${h.at}-${i}`}
                      className={cn(
                        "flex items-center gap-2 rounded px-2 py-1 text-xs",
                        h.ok ? "bg-success/10" : "bg-destructive/10",
                      )}
                    >
                      {h.ok ? (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                      <span className="font-mono">{h.code}</span>
                      <span className="ml-auto truncate">{h.ok ? h.label : h.reason}</span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}

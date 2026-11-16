// File condiviso del modulo Match day (il prefisso "-" lo esclude dalle route).
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type Match = {
  id: string;
  season_id: string | null;
  round: number | null;
  opponent: string;
  match_date: string;
  gates_open: string | null;
  tier: string;
  competition: string | null;
  tv: string | null;
  referees: string | null;
  commissioner: string | null;
  presale_url: string | null;
  aed_checked: boolean;
  blsd_operator: string | null;
  status: string;
  home_score: number | null;
  away_score: number | null;
  notes: string | null;
};
export type Sector = {
  id: string;
  name: string;
  capacity: number;
  is_numbered: boolean | null;
  sort: number | null;
  kind: string | null;
};

export const TIER_LABEL: Record<string, string> = {
  normale: "Normale",
  cartello: "Di cartello",
  playoff: "Playoff",
  abbonamento: "Abbonamento",
};
export const MATCH_STATUS_LABEL: Record<string, string> = {
  programmata: "Programmata",
  in_corso: "In corso",
  chiusa: "Chiusa",
  rinviata: "Rinviata",
  annullata: "Annullata",
};
export const LIST_TYPE_LABEL: Record<string, string> = {
  sponsor: "Sponsor",
  stampa: "Stampa",
  ospiti: "Società ospite",
  istituzioni: "Istituzioni",
  staff: "Staff",
  giovanili: "Famiglie giovanili",
};
export const PAY_LABEL: Record<string, string> = {
  contanti: "Contanti",
  pos: "POS",
  carta: "Carta",
  bonifico: "Bonifico",
  online: "Online",
};
export const CHANNEL_LABEL: Record<string, string> = {
  botteghino: "Botteghino",
  online: "Prevendita online",
  hospitality: "Hospitality",
};
export const TICKET_TYPES = [
  "intero",
  "ridotto",
  "ridotto_giovanili",
  "omaggio",
  "accredito",
] as const;

export function useMatches(seasonId?: string | null) {
  return useQuery({
    queryKey: ["matches", seasonId ?? "all"],
    queryFn: async () => {
      let q = db.from("matches").select("*").order("match_date");
      if (seasonId) q = q.eq("season_id", seasonId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Match[];
    },
  });
}

export function useSectors() {
  return useQuery({
    queryKey: ["sectors"],
    queryFn: async () =>
      ((await db.from("sectors").select("*").order("sort")).data ?? []) as Sector[],
  });
}

/** Sceglie per default la prossima partita (o l'ultima giocata). */
export function defaultMatchId(matches: Match[]) {
  const now = Date.now() - 6 * 3600_000;
  return (
    (matches.find((m) => new Date(m.match_date).getTime() >= now) ?? matches[matches.length - 1])
      ?.id ?? ""
  );
}

export function MatchSelect({
  matches,
  value,
  onChange,
  className,
}: {
  matches: Match[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className ?? "w-full sm:w-80"}>
        <SelectValue placeholder="Scegli la partita" />
      </SelectTrigger>
      <SelectContent>
        {matches.map((m) => (
          <SelectItem key={m.id} value={m.id}>
            {m.round ? `G${m.round} · ` : ""}vs {m.opponent} — {fmtDateTime(m.match_date)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** QR generato in locale con la libreria "qrcode" (nessun servizio esterno). */
export function QrImage({ value, size = 140 }: { value: string; size?: number }) {
  const [src, setSrc] = useState<string>("");
  useEffect(() => {
    let alive = true;
    import("qrcode")
      .then((QR) =>
        QR.toDataURL(value, {
          margin: 1,
          width: size,
          color: { dark: "#0B2A5B", light: "#ffffff" },
        }),
      )
      .then((url) => {
        if (alive) setSrc(url);
      })
      .catch(() => setSrc(""));
    return () => {
      alive = false;
    };
  }, [value, size]);
  return src ? (
    <img src={src} alt={`QR ${value}`} width={size} height={size} className="rounded bg-white" />
  ) : (
    <div
      style={{ width: size, height: size }}
      className="flex items-center justify-center rounded border bg-white p-2 text-center font-mono text-[10px] break-all text-primary"
    >
      {value}
    </div>
  );
}

/** Tessera/pass stampabile rossoblù. */
export function PassCard({
  title,
  name,
  line2,
  code,
  footer,
}: {
  title: string;
  name: string;
  line2?: string | undefined;
  code: string;
  footer?: string | undefined;
}) {
  return (
    <div className="pass-card flex w-full max-w-sm break-inside-avoid overflow-hidden rounded-xl border-2 border-primary bg-card shadow-card">
      <div className="w-2 bg-accent" />
      <div className="flex flex-1 items-center gap-3 p-3">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-widest text-accent">{title}</div>
          <div className="truncate font-display text-xl font-bold uppercase text-primary">
            {name}
          </div>
          {line2 && <div className="text-xs text-muted-foreground">{line2}</div>}
          <div className="mt-1 font-mono text-[10px] text-muted-foreground">{code}</div>
          {footer && <div className="mt-1 text-[10px] text-muted-foreground">{footer}</div>}
        </div>
        <QrImage value={code} size={96} />
      </div>
    </div>
  );
}

import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { it } from "date-fns/locale";

const eurFmt = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const numFmt = new Intl.NumberFormat("it-IT");
export const eur = (v: number | null | undefined) => eurFmt.format(Number(v ?? 0));
export const num = (v: number | null | undefined) => numFmt.format(Number(v ?? 0));

const toDate = (d: string | Date) => (typeof d === "string" ? parseISO(d) : d);
export const fmtDate = (d?: string | Date | null) => (d ? format(toDate(d), "dd/MM/yyyy") : "—");
export const fmtDateTime = (d?: string | Date | null) => (d ? format(toDate(d), "dd/MM/yyyy HH:mm") : "—");
export const fmtLong = (d?: string | Date | null) => (d ? format(toDate(d), "EEEE d MMMM yyyy, HH:mm", { locale: it }) : "—");
export const daysUntil = (d: string) => differenceInCalendarDays(parseISO(d), new Date());
export const todayISO = () => format(new Date(), "yyyy-MM-dd");
export const isoPlus = (days: number) => format(new Date(Date.now() + days * 86400000), "yyyy-MM-dd");

export type Urgency = "scaduto" | "7" | "30" | "ok" | "fatto";
export function urgency(due: string, status?: string): Urgency {
  if (status === "fatto" || status === "annullato") return "fatto";
  const d = daysUntil(due);
  if (d < 0) return "scaduto";
  if (d <= 7) return "7";
  if (d <= 30) return "30";
  return "ok";
}

export const STATUS_LABEL: Record<string, string> = {
  da_fare: "Da fare", in_corso: "In corso", fatto: "Fatto", annullato: "Annullato",
};
export const RECURRENCE_LABEL: Record<string, string> = {
  una_volta: "Una volta", mensile: "Mensile", trimestrale: "Trimestrale", annuale: "Annuale", stagione: "Per stagione",
};
export const TICKET_LABEL: Record<string, string> = {
  intero: "Intero", ridotto: "Ridotto", ridotto_giovanili: "Ridotto giovanili Gema", omaggio: "Omaggio", accredito: "Accredito",
};
export const STAGE_LABEL: Record<string, string> = {
  contatto: "Contatto", proposta: "Proposta inviata", trattativa: "Trattativa", firmato: "Firmato", rinnovo: "Rinnovo", perso: "Perso",
};

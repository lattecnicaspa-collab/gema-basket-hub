import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/db";

export type ClubSettings = {
  name: string; legal_name: string | null; logo_url: string | null; footer_text: string | null; venue_name: string | null;
  fiscal_tickets: boolean; sponsor_budget_target: number; commercial_threshold: number; ical_token: string;
  guest_names_hours_before: number; [k: string]: unknown;
};

export function useClub() {
  return useQuery({
    queryKey: ["club"],
    queryFn: async () => {
      const { data } = await db.from("club_settings").select("*").eq("id", 1).maybeSingle();
      return (data ?? { name: "La T Tecnica Gema Montecatini", footer_text: "Main sponsor La T Tecnica S.p.A.", fiscal_tickets: false, sponsor_budget_target: 900000, commercial_threshold: 400000 }) as ClubSettings;
    },
    staleTime: 60_000,
  });
}

export function useActiveSeason() {
  return useQuery({
    queryKey: ["season-active"],
    queryFn: async () => {
      const { data } = await db.from("seasons").select("*").eq("is_active", true).maybeSingle();
      return data as { id: string; name: string; start_date: string; end_date: string } | null;
    },
    staleTime: 60_000,
  });
}

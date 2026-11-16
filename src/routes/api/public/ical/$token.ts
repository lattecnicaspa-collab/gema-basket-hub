import { createFileRoute } from "@tanstack/react-router";
import { buildICS } from "@/lib/export";

// Feed iCal dello scadenzario da importare in Google Calendar / Outlook.
// Protetto dal token segreto salvato nelle impostazioni (rigenerabile).
export const Route = createFileRoute("/api/public/ical/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const token = String(params.token ?? "").replace(/\.ics$/, "");
        if (!/^[a-f0-9]{32}$/.test(token)) return new Response("Not found", { status: 404 });
        const { data: club } = await supabaseAdmin
          .from("club_settings")
          .select("ical_token")
          .eq("id", 1)
          .maybeSingle();
        if (!club || club.ical_token !== token) return new Response("Not found", { status: 404 });
        const { data } = await supabaseAdmin
          .from("deadlines")
          .select("id,title,due_date,category,status")
          .is("deleted_at", null)
          .neq("status", "annullato")
          .order("due_date");
        const ics = buildICS(
          (data ?? []).map((d) => ({
            id: d.id,
            title: (d.status === "fatto" ? "✔ " : "") + d.title,
            date: d.due_date,
            description: d.category,
          })),
          "Scadenzario Gema",
        );
        return new Response(ics, { headers: { "content-type": "text/calendar; charset=utf-8" } });
      },
    },
  },
});

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { CalendarClock, Handshake, Ticket } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Shield } from "@/components/app/Logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GEMA360 – Gestionale La T Tecnica Gema Montecatini" },
      {
        name: "description",
        content:
          "Scadenzario, sponsor, botteghino e match day al PalaTerme per la Pallacanestro Montecatini, Serie A2 2026/27.",
      },
      { property: "og:title", content: "GEMA360 – Gestionale La T Tecnica Gema Montecatini" },
      {
        property: "og:description",
        content: "Il gestionale rossoblù della Pallacanestro Montecatini.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard" });
  }, [loading, session, navigate]);
  return (
    <div className="flex min-h-screen flex-col bg-hero text-primary-foreground">
      <div className="h-2 bg-stripe" />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-16">
        <Shield className="mb-8 h-24 w-24" />
        <p className="font-display text-lg font-semibold uppercase tracking-[0.3em] opacity-80">
          Pallacanestro Montecatini · Serie A2 2026/27
        </p>
        <h1 className="mt-2 font-display text-6xl font-extrabold uppercase leading-none sm:text-8xl">
          GEMA<span className="text-brand-red">360</span>
        </h1>
        <p className="mt-4 max-w-xl text-lg opacity-90">
          Il gestionale della La T Tecnica Gema Montecatini: scadenze, sponsor e match day al
          PalaTerme in un unico posto.
        </p>
        <div className="mt-8 flex gap-3">
          <Button asChild size="lg" variant="secondary">
            <Link to="/auth">Accedi</Link>
          </Button>
          <Button asChild size="lg" variant="ghost" className="border border-primary-foreground/40">
            <Link to="/iscrizione">Iscrivi tuo figlio</Link>
          </Button>
        </div>
        <div className="mt-16 grid gap-4 sm:grid-cols-3">
          {[
            {
              i: CalendarClock,
              t: "Scadenzario unico",
              d: "F24, FIP, PalaTerme, sponsor e certificati con promemoria.",
            },
            {
              i: Handshake,
              t: "Sponsor",
              d: "CRM, contratti, spazi vendibili, controprestazioni e report.",
            },
            {
              i: Ticket,
              t: "Match day",
              d: "Botteghino, abbonamenti, accrediti, QR agli ingressi e borderò.",
            },
          ].map((f) => (
            <div
              key={f.t}
              className="rounded-xl border border-primary-foreground/20 bg-primary-foreground/5 p-5 backdrop-blur"
            >
              <f.i className="h-6 w-6 text-brand-red" />
              <h2 className="mt-3 font-display text-xl font-bold uppercase">{f.t}</h2>
              <p className="mt-1 text-sm opacity-80">{f.d}</p>
            </div>
          ))}
        </div>
      </main>
      <footer className="px-6 py-4 text-center text-xs opacity-70">
        Main sponsor La T Tecnica S.p.A.
      </footer>
    </div>
  );
}

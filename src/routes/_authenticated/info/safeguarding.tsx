import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Mail } from "lucide-react";
import { useClub } from "@/hooks/useClub";
import { Notice, PageHeader, Panel, RULES_WARNING } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/info/safeguarding")({
  head: () => ({ meta: [{ title: "Safeguarding – GEMA360" }] }),
  component: Safeguarding,
});

const OBBLIGHI = [
  "Adottare il Modello organizzativo e di controllo (MOCAS) e il Codice di condotta (art. 33 c. 6 D.Lgs. 36/2021).",
  "Nominare il Responsabile safeguarding: indipendente (meglio se esterno), mandato di 4 anni, certificato del casellario giudiziale depositato.",
  "Pubblicare la nomina sulla homepage del sito e affiggerla in sede; comunicarla al Safeguarding Officer FIP.",
  "Consegnare copia di MOCAS e Codice di condotta a soci, tesserati, genitori, lavoratori e volontari, con registro della presa visione.",
  "Garantire un canale di segnalazione riservato, anche anonimo, accessibile solo al Responsabile e al presidente.",
  "Formazione periodica di allenatori, dirigenti e volontari sulla tutela dei minori.",
  "Verificare contenuti e scadenze sulle linee guida FIP in vigore: chi non è in regola rischia sanzioni fino alla revoca dell'affiliazione.",
];

function Safeguarding() {
  const { data: club } = useClub();
  const email = (club?.["pec"] as string | null) ?? null;
  return (
    <div className="grid gap-4">
      <PageHeader
        title="Safeguarding"
        subtitle="Tutela dei minori e prevenzione di abusi e discriminazioni"
      />
      <Panel title="Fare una segnalazione">
        <div className="flex flex-col gap-3 text-sm">
          <p>
            Le segnalazioni vanno inviate in modo riservato al Responsabile safeguarding della
            società. Non usare la bacheca, le chat di squadra o altri canali condivisi.
          </p>
          {email ? (
            <div>
              <Button asChild variant="destructive">
                <a
                  href={`mailto:${email}?subject=${encodeURIComponent("Segnalazione safeguarding – riservata")}`}
                >
                  <Mail className="h-4 w-4" />
                  Scrivi in modo riservato
                </a>
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">
                Indirizzo: {email} (impostato in Impostazioni → Società). Sostituiscilo con l'email
                del Responsabile safeguarding se diversa.
              </p>
            </div>
          ) : (
            <Notice>
              Contatto del Responsabile safeguarding non ancora impostato: aggiungilo in
              Impostazioni → Società.
            </Notice>
          )}
          <Notice tone="info">
            Il modulo di segnalazione interno, anche anonimo, non modificabile dopo l'invio e
            visibile solo al Responsabile e al presidente, richiede una tabella dedicata con
            permessi propri: verrà aggiunta al database. Fino ad allora usare il contatto riservato
            qui sopra.
          </Notice>
        </div>
      </Panel>
      <Panel title="Obblighi della società">
        <ul className="grid gap-2 text-sm">
          {OBBLIGHI.map((it) => (
            <li key={it} className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      </Panel>
      <Notice>{RULES_WARNING}.</Notice>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { Notice, PageHeader, Panel, RULES_WARNING } from "@/components/app/ui-bits";

export const Route = createFileRoute("/_authenticated/info/documenti")({
  head: () => ({ meta: [{ title: "Documenti e privacy – GEMA360" }] }),
  component: Documenti,
});

const SECTIONS: { title: string; items: string[] }[] = [
  {
    title: "Consensi GDPR",
    items: [
      "Informative privacy versionate: ogni modifica crea una nuova versione e va riaccettata.",
      "Consensi separati e revocabili: trattamento dati, dati sanitari, foto/video, pubblicazione social, newsletter.",
      "Il consenso foto/video è separato dall'iscrizione: il rifiuto non deve bloccare l'iscrizione né l'attività.",
      "Sotto i 14 anni il consenso alla pubblicazione delle foto richiede ENTRAMBI i genitori (Garante, provv. 13/11/2024).",
      "Dal compimento dei 14 anni il consenso va chiesto direttamente all'atleta.",
      "Chi non ha il consenso va segnalato come NON PUBBLICABILE in galleria, social e referti pubblici.",
      "Registro dei trattamenti aggiornato; risposta alle richieste di accesso, rettifica e cancellazione.",
    ],
  },
  {
    title: "Documenti dei tesserati",
    items: [
      "Documento d'identità (preferibilmente CIE) e codice fiscale per il tesseramento myFIP.",
      "Certificato medico agonistico dagli 11 anni, non agonistico per il minibasket: originali conservati in sede per 5 anni.",
      "Modulo TMA del minibasket firmato da almeno un genitore e conservato dalla società.",
      "Autorizzazioni trasferta e liberatorie firmate dai genitori per i minorenni.",
      "Ricevute delle quote con i dati per la detrazione 19% (pagante e atleta con codice fiscale, pagamento tracciabile).",
    ],
  },
  {
    title: "Documenti societari",
    items: [
      "Statuto vigente e atto costitutivo, caricati sul Registro nazionale attività sportive (RASD).",
      "Libro soci, libro verbali delle assemblee e del consiglio direttivo.",
      "Rendiconto economico-finanziario approvato in assemblea entro 4 mesi dalla chiusura dell'esercizio.",
      "Contratti dei collaboratori sportivi (D.Lgs. 36/2021) e comunicazioni di inizio/fine rapporto.",
      "Contratti sponsor e fatture elettroniche (IVA 22%).",
      "Modello organizzativo (MOCAS) e Codice di condotta safeguarding, con registro di consegna.",
    ],
  },
];

function Documenti() {
  return (
    <div className="grid gap-4">
      <PageHeader
        title="Documenti e privacy"
        subtitle="Promemoria degli obblighi documentali e dei consensi GDPR"
      />
      <Notice tone="info">
        L'archivio documenti con caricamento file e il registro dei consensi per persona richiedono
        tabelle dedicate che verranno aggiunte al database. Nel frattempo i file si caricano nei
        bucket privati “documenti” e “contratti”.
      </Notice>
      {SECTIONS.map((s) => (
        <Panel key={s.title} title={s.title}>
          <ul className="grid gap-2 text-sm">
            {s.items.map((it) => (
              <li key={it} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <span>{it}</span>
              </li>
            ))}
          </ul>
        </Panel>
      ))}
      <Notice>{RULES_WARNING}.</Notice>
    </div>
  );
}

/**
 * Note legali di Quadra — sorgente unico del testo mostrato nel modale "Note legali"
 * del welcome (hub). NON viene riportato nei documenti tecnici esportati (computo,
 * relazione, capitolato): quelli seguono un modello tecnico e non necessitano di
 * questa nota.
 *
 * Punto chiave: nessun nome di prodotto o azienda di terzi. I formati di interscambio
 * si citano solo per quello che fanno, a fini di INTEROPERABILITÀ (import/export).
 * Nessuna affiliazione, nessuna ridistribuzione di software o dati di terzi. Vedi anche l'edizione (src/shared/edition.ts): il code signing
 * è demandato all'IT aziendale.
 */
import { escHtml as esc } from '../../shared/doc/doc'

export interface ThirdPartyMark {
  /** Nome del marchio/prodotto così come citato nella suite. */
  name: string
  /** Titolare (dove noto), a scopo di corretta attribuzione. */
  owner?: string
  /** Perché è citato: la funzione di interoperabilità. */
  use: string
}

/** I formati di terzi con cui la suite è interoperabile, con la finalità d'uso. Nessun
 *  nome di prodotto o azienda: il formato si cita per quello che fa. Quadra non include
 *  né ridistribuisce prezzari o cataloghi: l'utente porta i propri file. */
export const THIRD_PARTY_MARKS: ThirdPartyMark[] = [
  { name: 'XPWE', use: 'formato di interscambio del computo metrico e della contabilità, letto e scritto per lavorare con gli altri programmi del settore' },
]

/** HTML del corpo del modale "Note legali" (riusa lo stile .cl-body). */
export function legalNoticeHTML(): string {
  const marks = THIRD_PARTY_MARKS.map(m =>
    `<li><b>${esc(m.name)}</b>${m.owner ? ` <span class="lg-owner">(${esc(m.owner)})</span>` : ''} — ${esc(m.use)}.</li>`
  ).join('')
  return `
    <p>Quadra è uno <b>strumento di supporto e verifica</b> per il computo metrico e la contabilità dei lavori: <b>non è un
    software di calcolo</b>. È distribuito <b>senza alcuna garanzia</b> (vedi la licenza MIT nel repository): gli
    elaborati prodotti sono un <b>ausilio al progettista</b>, le scelte progettuali, il dimensionamento e la
    responsabilità dell’elaborato firmato restano del <b>progettista abilitato</b>.</p>

    <h4>Marchi e software di terzi</h4>
    <p>I nomi di prodotti, formati e marchi eventualmente citati appartengono ai <b>rispettivi proprietari</b>.
    Quadra li richiama <b>unicamente a fini descrittivi e di interoperabilità</b> (riconoscimento di formati,
    indicazione della provenienza di dati): ciò <b>non implica</b> alcuna affiliazione, sponsorizzazione
    o approvazione da parte dei titolari. La suite <b>non include né ridistribuisce</b> prezzari, cataloghi o
    software di terzi: è l’utente a importare i propri file.</p>
    <ul class="hub-guide-ul">${marks}</ul>

    <h4>Prezzari e banche dati</h4>
    <p>I prezzari regionali e le opere editoriali di prezzo sono dei <b>rispettivi enti ed editori</b>; l’utente è
    tenuto a rispettarne le condizioni di licenza. Quadra non ne include alcuno: fornisce solo lo strumento
    per consultare quelli che l’utente importa.</p>

    <h4>Dati di progetto</h4>
    <p>Quadra gira <b>interamente in locale</b>: nessun dato lascia il computer dell’utente. I dati di
    progetto sono salvati in file di progetto (<code>.quadra</code>) <b>sotto il controllo esclusivo dell’utente</b>.</p>`
}

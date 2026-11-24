/**
 * Contabilità — RISERVE DELL'ESECUTORE (art. 115 c. 2 D.Lgs. 36/2023; art. 7
 * All. II.14) e FIRMA DEL REGISTRO.
 *
 * Il contenzioso dei lavori pubblici si decide quasi sempre sui tempi e sulla
 * forma, non sul merito: una pretesa fondata ma iscritta tardi è persa. La
 * sequenza che il programma deve saper tenere è questa:
 *
 *  1. ISCRIZIONE nel primo atto idoneo a riceverla — di norma il registro di
 *     contabilità, sottoposto all'esecutore alla firma di ogni SAL — a pena di
 *     decadenza;
 *  2. ESPLICITAZIONE entro QUINDICI GIORNI dall'iscrizione: domande, ragioni e
 *     quantificazione della pretesa, anch'essa a pena di decadenza;
 *  3. DEDUZIONI MOTIVATE del direttore dei lavori, che restano sul registro;
 *  4. CONFERMA alla firma del CONTO FINALE: le riserve non confermate si hanno
 *     per abbandonate.
 *
 * E il caso in cui l'esecutore NON firma: il DL ne fa verbale e ne informa
 * subito la stazione appaltante. Qui stanno il calcolo delle scadenze e le
 * sezioni che gli atti stampano; nessuna data è inventata: quando una data
 * manca, il programma lo dice invece di presumerla.
 */
import { escHtml } from '../../../shared/doc/doc'
import { eur } from '../../../shared/format'
import { addDaysIt, giorniTra, itToISO, oggiISO } from '../../../shared/date-it'
import type { Riserva, Sal } from './types'

/** Giorni per esplicitare una riserva già iscritta (art. 7 c. 2 All. II.14). */
export const GIORNI_ESPLICITAZIONE = 15
/** Giorni per firmare il conto finale dall'invito del RUP (art. 7 c. 3). */
export const GIORNI_FIRMA_CONTO_FINALE = 30

export type StatoRiserva = 'daEsplicitare' | 'inScadenza' | 'decaduta' | 'esplicitata' | 'definita' | 'rinunciata'

export interface RiservaStato {
  stato: StatoRiserva
  /** Termine ultimo per l'esplicitazione (gg/mm/aaaa), se l'iscrizione è datata. */
  scadenza: string
  /** Giorni residui al termine (negativo = scaduto); null se le date non ci sono. */
  giorniResidui: number | null
  /** Riga di spiegazione pronta da stampare. */
  nota: string
}

/**
 * Dove sta una riserva rispetto ai suoi termini. `oggi` è la data di lavoro del
 * programma (non l'orologio di sistema): la contabilità si scrive anche a
 * posteriori, e le scadenze vanno lette alla data in cui si sta lavorando.
 */
export function statoRiserva(r: Riserva, oggiIso?: string): RiservaStato {
  const oggi = oggiIso || oggiISO()
  if (r.esito === 'definita') return { stato: 'definita', scadenza: '', giorniResidui: null, nota: `Definita in corso d'opera${r.notaEsito ? ': ' + r.notaEsito : ''}` }
  if (r.esito === 'rinunciata') return { stato: 'rinunciata', scadenza: '', giorniResidui: null, nota: `Rinunciata dall'esecutore${r.notaEsito ? ': ' + r.notaEsito : ''}` }
  const scadenza = addDaysIt(r.data, GIORNI_ESPLICITAZIONE)
  const residui = giorniTra(oggi, itToISO(scadenza))
  if (r.dataEsplicitazione || r.esplicitazione) {
    const ritardo = giorniTra(itToISO(r.data), itToISO(r.dataEsplicitazione))
    const tardi = ritardo != null && ritardo > GIORNI_ESPLICITAZIONE
    return {
      stato: tardi ? 'decaduta' : 'esplicitata', scadenza, giorniResidui: residui,
      nota: tardi
        ? `Esplicitata il ${r.dataEsplicitazione} — oltre i ${GIORNI_ESPLICITAZIONE} giorni dall'iscrizione (${ritardo} giorni): il termine è a pena di decadenza`
        : `Esplicitata il ${r.dataEsplicitazione || '—'}${ritardo != null ? ` (${ritardo} giorni dall'iscrizione)` : ''}`,
    }
  }
  if (r.esito === 'decaduta') return { stato: 'decaduta', scadenza, giorniResidui: residui, nota: 'Dichiarata decaduta' }
  if (residui == null) return { stato: 'daEsplicitare', scadenza, giorniResidui: null, nota: `Da esplicitare entro ${GIORNI_ESPLICITAZIONE} giorni dall'iscrizione — manca la data di iscrizione, il termine non è calcolabile` }
  if (residui < 0) return { stato: 'decaduta', scadenza, giorniResidui: residui, nota: `Non esplicitata entro il ${scadenza}: il termine di ${GIORNI_ESPLICITAZIONE} giorni è scaduto (${-residui} giorni)` }
  return {
    stato: residui <= 5 ? 'inScadenza' : 'daEsplicitare', scadenza, giorniResidui: residui,
    nota: `Da esplicitare entro il ${scadenza} (${residui} giorni)`,
  }
}

export const RISERVA_LABEL: Record<StatoRiserva, string> = {
  daEsplicitare: 'iscritta, da esplicitare',
  inScadenza: 'in scadenza',
  decaduta: 'termine scaduto',
  esplicitata: 'esplicitata',
  definita: "definita in corso d'opera",
  rinunciata: 'rinunciata',
}

/** Riserve ancora aperte (contano per il conto finale e per il collaudo). */
export function riserveAperte(riserve?: Riserva[]): Riserva[] {
  return (riserve || []).filter((r) => r.esito !== 'definita' && r.esito !== 'rinunciata')
}

/** Somma delle pretese quantificate ancora aperte. */
export function importoRiserveAperte(riserve?: Riserva[]): number {
  return riserveAperte(riserve).reduce((s, r) => s + (r.importo || 0), 0)
}

/** Sezione «Riserve» del registro di contabilità: iscrizione, esplicitazione, deduzioni. */
export function riserveRegistroHTML(riserve: Riserva[] | undefined, oggiIso?: string): string {
  const oggi = oggiIso || oggiISO()
  const testa = `<h2 class="sec-h">Riserve dell'esecutore</h2>`
  if (!riserve || !riserve.length) {
    return `${testa}
      <p class="note">Il registro è sottoposto all'esecutore per la sottoscrizione in occasione di ogni stato di avanzamento: è il momento per l'iscrizione delle riserve, <b>a pena di decadenza</b> (art. 115 c. 2 D.Lgs. 36/2023; art. 7 All. II.14). Le riserve iscritte vanno <b>esplicitate entro ${GIORNI_ESPLICITAZIONE} giorni</b>, con le domande e la quantificazione della pretesa, e <b>confermate alla firma del conto finale</b>. Alla data del presente registro <b>non risultano riserve iscritte</b>.</p>`
  }
  const rows = riserve.map((r) => {
    const st = statoRiserva(r, oggi)
    const grave = st.stato === 'decaduta' || st.stato === 'inScadenza'
    return `<tr class="${grave ? 'nv' : ''}">
      <td class="num">${escHtml(String(r.numero))}</td>
      <td>${escHtml(r.oggetto || '—')}
        <span class="sub">Iscritta ${r.data ? `il ${escHtml(r.data)}` : '(data non indicata)'}${r.attoIscrizione ? ` su: ${escHtml(r.attoIscrizione)}` : r.salNumero != null ? ` al SAL n. ${escHtml(String(r.salNumero))}` : ''} · ${escHtml(RISERVA_LABEL[st.stato])} — ${escHtml(st.nota)}</span>
        ${r.esplicitazione ? `<span class="sub"><b>Domande dell'esecutore:</b> ${escHtml(r.esplicitazione)}</span>` : ''}
        ${r.controdeduzioni ? `<span class="sub"><b>Deduzioni motivate del DL:</b> ${escHtml(r.controdeduzioni)}</span>` : ''}
        ${r.confermataContoFinale ? `<span class="sub">Confermata alla firma del conto finale.</span>` : ''}</td>
      <td class="num">${r.salNumero == null ? '—' : escHtml(String(r.salNumero))}</td>
      <td class="num">${r.importo == null ? '<i>non quantificata</i>' : eur(r.importo)}</td>
    </tr>`
  }).join('')
  const aperte = riserveAperte(riserve)
  const tot = importoRiserveAperte(riserve)
  return `${testa}
    <table class="dtable">
      <thead><tr><th class="num">N.</th><th>Oggetto, iscrizione, domande e deduzioni del DL</th><th class="num">SAL</th><th class="num">Pretesa</th></tr></thead>
      <tbody>${rows}
        <tr class="tot"><td colspan="3">Totale delle pretese quantificate ancora aperte (${aperte.length} riserv${aperte.length === 1 ? 'a' : 'e'})</td><td class="num">${eur(tot)}</td></tr>
      </tbody>
    </table>
    <p class="note">Le riserve iscritte vanno esplicitate entro ${GIORNI_ESPLICITAZIONE} giorni dall'iscrizione, con domande e quantificazione, e <b>confermate alla firma del conto finale</b> (entro ${GIORNI_FIRMA_CONTO_FINALE} giorni dall'invito del RUP): quelle non confermate si hanno per abbandonate. Il termine di ${GIORNI_ESPLICITAZIONE} giorni e la conferma sono a pena di decadenza, salvo le riserve già definite in via conciliativa.</p>`
}

/**
 * Che cosa il registro dichiara sulla firma dell'esecutore. Il rifiuto non si
 * tace: va messo a verbale e comunicato subito alla stazione appaltante.
 */
export function firmaEsecutoreNota(sal?: Sal): string {
  if (!sal?.firmaEsecutore) return ''
  const f = sal.firmaEsecutore
  const quando = sal.dataFirmaEsecutore ? ` in data ${escHtml(sal.dataFirmaEsecutore)}` : ''
  if (f === 'rifiutata') {
    return `<p class="note"><b>Il presente registro è stato sottoposto all'esecutore, che ha RIFIUTATO di sottoscriverlo${quando}.</b> Del rifiuto il direttore dei lavori redige apposito verbale, che fa parte degli atti contabili, e ne dà immediata comunicazione alla stazione appaltante (art. 7 All. II.14 D.Lgs. 36/2023).</p>`
  }
  if (f === 'conRiserva') {
    const entro = addDaysIt(sal.dataFirmaEsecutore, GIORNI_ESPLICITAZIONE)
    return `<p class="note"><b>Registro sottoscritto dall'esecutore CON RISERVA${quando}.</b> Le riserve iscritte vanno esplicitate — domande, ragioni e quantificazione — entro ${GIORNI_ESPLICITAZIONE} giorni${entro ? `, cioè entro il ${escHtml(entro)}` : ''}, a pena di decadenza.</p>`
  }
  return `<p class="note">Registro sottoscritto dall'esecutore <b>senza riserve</b>${quando}: le partite contabilizzate e il credito progressivo risultano accettati.</p>`
}

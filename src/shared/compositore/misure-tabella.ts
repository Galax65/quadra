/**
 * IL CAMPO DI UNA RIGA DI MISURA — lo stesso in ogni foglio della suite.
 *
 * Misurare è lo stesso gesto nel computo, nel libretto del SAL e nella
 * perizia: par.ug. × lung. × larg. × H/peso, con le formule, le detrazioni col
 * segno meno e gli stessi tasti. Le righe stanno nel foglio della griglia
 * (shared/griglia/griglia.ts: righeFoglioHtml); qui c'è com'è fatto ogni campo
 * e quali comandi lo strumento aggancia.
 *
 * Il modulo è PURO (niente DOM, niente stato): riceve le righe e le «azioni»
 * — i pezzi di codice da mettere negli attributi onX, che ogni tool costruisce
 * con i propri identificativi — e restituisce HTML.
 *
 * Convenzioni di aggancio: `[data-mis-input="<i>:<campo>"]` ogni campo
 * (campo = descrizione|n|l1|l2|h), `[data-mis-qt]` la quantità della riga,
 * `[data-mis-tot]` il totale.
 */
import { formulaPerSchermo } from './misure-edit'
import type { MisurazioneRiga } from './misurazioni'

export type CampoMisura = 'descrizione' | 'n' | 'l1' | 'l2' | 'h'

/** Promemoria dei tasti: uno solo, mostrato identico nei due tool. */
export const TASTI_MISURE = 'Tab = cella accanto · Invio = riga sotto (dall\'ultima, una riga nuova) · ↑↓ = stessa colonna sopra/sotto · Esc = annulla · Formule: 12+250+65, 2x3,5 · Detrazione: parti uguali col meno (-2) · Alt+↑↓ sposta la riga · Ctrl+D duplica · Ctrl+Canc elimina · incolla righe da Excel'

const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

/** Valore da mostrare nel campo: il RISULTATO (entrando si vede la formula). */
export function valoreMostrato(m: MisurazioneRiga | undefined, campo: CampoMisura): string {
  if (!m) return ''
  if (campo === 'descrizione') return m.descrizione || ''
  const v = (m as unknown as Record<string, number | null | undefined>)[campo]
  return v == null ? '' : String(+Number(v).toFixed(4)).replace('.', ',')
}

/** I pezzi di codice che ogni tool mette negli attributi onX (già con i suoi id). */
export interface AzioniMisure {
  /** onchange di un campo (riga, campo) */
  set: (i: number, campo: CampoMisura) => string
  /** onkeydown di un campo */
  tasti: (i: number, campo: CampoMisura) => string
  /** onpaste dentro una cella (incolla da Excel) */
  incollaQui?: (i: number) => string
  /** onfocus/onblur: nel campo si vede il risultato, entrando la formula */
  fuoco?: (i: number, campo: CampoMisura) => string
  sfuoco?: (i: number, campo: CampoMisura) => string
  duplica: (i: number) => string
  elimina: (i: number) => string
  /** Tasto destro sulla riga: ogni operazione si deve poter fare da dove si è. */
  menu?: (i: number) => string
  aggiungi: string
  detrazione?: string
  vediVoce?: (i: number) => string
  trascina?: { inizio: (i: number) => string; fine: string; sopra: string; esce: string; rilascia: (i: number) => string }
}

/** Quello che serve per disegnare i campi di una riga. */
export interface OpzioniCampiMisura {
  righe: MisurazioneRiga[]
  /** SAL firmato / voce bloccata: si legge, non si scrive. */
  soloLettura?: boolean
  azioni: AzioniMisure
}

/** Il campo di una riga di misura (descrizione o fattore): lo stesso in ogni foglio. */
export function campoMisuraHtml(o: OpzioniCampiMisura, i: number, campo: CampoMisura): string { return campoHtml(o, i, campo) }

function campoHtml(o: OpzioniCampiMisura, i: number, campo: CampoMisura): string {
  const m = o.righe[i]
  const a = o.azioni
  const f = campo === 'descrizione' ? undefined : m?.formule?.[campo]
  const ro = o.soloLettura ? ' readonly' : ''
  if (campo !== 'l1' || !m?.vediVoce) {
    const cls = `ehb-mis-in${campo === 'descrizione' ? ' ehb-mis-in--desc' : ''}${f ? ' is-formula' : ''}`
    const titolo = campo === 'descrizione' ? 'Designazione della misura' : f ? 'Formula: ' + formulaPerSchermo(f) : 'Numero o formula (es. 12+250+65, 2x3,5)'
    return `<input type="text" class="${cls}"${campo === 'descrizione' ? '' : ' inputmode="decimal"'} value="${esc(valoreMostrato(m, campo))}"
      data-mis-input="${i}:${campo}"${f ? ' data-formula="1"' : ''}${ro}
      ${campo === 'descrizione' && !o.soloLettura ? `placeholder="${m?.vediVoce ? 'nota…' : 'descrizione (es. piano terra)'}"` : 'placeholder=""'}
      onclick="event.stopPropagation()" onchange="${esc(a.set(i, campo))}" onkeydown="${esc(a.tasti(i, campo))}"
      ${a.fuoco ? `onfocus="${esc(a.fuoco(i, campo))}"` : ''} ${a.sfuoco ? `onblur="${esc(a.sfuoco(i, campo))}"` : ''}
      ${a.incollaQui ? `onpaste="${esc(a.incollaQui(i))}"` : ''}
      title="${esc(titolo)}">`
  }
  // riga «vedi voce»: L1 è la quantità richiamata, non si scrive
  return `<input type="text" class="ehb-mis-in is-richiamo" value="${esc(valoreMostrato(m, campo))}" readonly tabindex="-1" title="Quantità della voce richiamata">`
}

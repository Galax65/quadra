/**
 * TABELLA DELLE MISURE — un solo componente per tutta la suite.
 *
 * Misurare è lo stesso gesto nel computo e nella contabilità: si prende una voce
 * e si scrivono le sue misure (par.ug. × L1 × L2 × H), con le formule, le
 * detrazioni col segno meno e gli stessi tasti. Qui vive l'UNICA interfaccia di
 * quel gesto: il Computo e il Libretto delle misure (Contabilità) la montano entrambi,
 * così non possono più divergere.
 *
 * Il modulo è PURO (niente DOM, niente stato): riceve le righe e le «azioni»
 * — i pezzi di codice da mettere negli attributi onX, che ogni tool costruisce
 * con i propri identificativi — e restituisce HTML.
 *
 * Convenzioni di aggancio, uguali nei due tool:
 *  - `[data-mis-input="<i>:<campo>"]` ogni campo (campo = descrizione|n|l1|l2|h)
 *  - `[data-mis-qt]` la quantità di riga, `[data-mis-tot]` il totale
 *  - `.ehb-mis-riga` la riga, `.is-sel` quella selezionata, `.is-neg` la detrazione
 */
import { formulaPerSchermo } from './misure-edit'
import { sommaMisurazioni, type MisurazioneRiga } from './misurazioni'

export type CampoMisura = 'descrizione' | 'n' | 'l1' | 'l2' | 'h'
export const CAMPI_NUMERICI: CampoMisura[] = ['n', 'l1', 'l2', 'h']
export const TITOLI_CAMPI: Record<CampoMisura, string> = { descrizione: 'Designazione', n: 'par.ug.', l1: 'L1', l2: 'L2', h: 'H/peso' }

/** Promemoria dei tasti: uno solo, mostrato identico nei due tool. */
export const TASTI_MISURE = 'Invio = nuova riga · Esc = chiudi · Formule: 12+250+65, 2x3,5 · Detrazione: segno meno (es. par.ug. -2) · ↑↓ campo sopra/sotto · Alt+↑↓ sposta · Ctrl+D duplica · Ctrl+Canc elimina · incolla da Excel'

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
  copia?: string
  incolla?: string
  vediVoce?: (i: number) => string
  seleziona?: (i: number) => string
  trascina?: { inizio: (i: number) => string; fine: string; sopra: string; esce: string; rilascia: (i: number) => string }
}

export interface OpzioniMisureTabella {
  righe: MisurazioneRiga[]
  /** Unità di misura della voce (in testa alla colonna quantità e nel totale). */
  um?: string
  /** Titolino a sinistra della barra dei comandi. */
  titolo?: string
  /** Etichetta del totale: «Totale» nel computo, «Totale a tutto il SAL» nel libretto. */
  totale?: string
  /** SAL firmato / voce bloccata: si legge, non si scrive. */
  soloLettura?: boolean
  selezione?: Set<number>
  /** Etichetta del richiamo «vedi voce» di una riga. */
  etichettaVediVoce?: (chiave: string) => string
  /** Formattatore dei numeri del tool (stesse cifre di tutto il resto). */
  fmt: (n: number) => string
  azioni: AzioniMisure
  /** Bottoni in più nella barra (es. «Da altro computo…» nel computo). */
  extra?: string
  /** Messaggio quando non c'è ancora nessuna riga. */
  vuoto?: string
}

function campoHtml(o: OpzioniMisureTabella, i: number, campo: CampoMisura): string {
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

function rigaHtml(o: OpzioniMisureTabella, i: number): string {
  const m = o.righe[i]
  const a = o.azioni
  const sel = o.selezione?.has(i)
  const neg = (m.quantita || 0) < 0
  const tr = a.trascina
  return `<tr class="ehb-mis-riga mis-riga${sel ? ' is-sel mis-sel' : ''}${neg ? ' is-neg' : ''}"
      ${a.menu && !o.soloLettura ? `oncontextmenu="${esc(a.menu(i))}"` : ''}
      ${tr ? `ondragover="${esc(tr.sopra)}" ondragleave="${esc(tr.esce)}" ondrop="${esc(tr.rilascia(i))}"` : ''}>
    ${a.seleziona ? `<td class="ehb-mis-td ehb-mis-td--sel"><input type="checkbox" ${sel ? 'checked' : ''} onclick="${esc(a.seleziona(i))}" title="Seleziona la riga (Maiusc = intervallo)"></td>` : ''}
    <td class="ehb-mis-td ehb-mis-td--desc">
      ${tr ? `<span class="cm-drag ehb-mis-drag" draggable="true" ondragstart="${esc(tr.inizio(i))}" ondragend="${esc(tr.fine)}" title="Trascina la riga di misura">⠿</span>` : ''}
      ${m.vediVoce && o.etichettaVediVoce ? `<span class="ehb-mis-vv" title="La quantità di quella voce entra come L1">↪ ${esc(o.etichettaVediVoce(m.vediVoce))}</span>` : ''}
      ${campoHtml(o, i, 'descrizione')}</td>
    ${CAMPI_NUMERICI.map((c) => `<td class="ehb-mis-td">${campoHtml(o, i, c)}</td>`).join('')}
    <td class="ehb-mis-td ehb-mis-qt" data-mis-qt>${esc(o.fmt(m.quantita || 0))}</td>
    <td class="ehb-mis-td ehb-mis-td--cmd">
      ${a.vediVoce && !o.soloLettura ? `<button class="ehb-icon-btn ehb-mis-cmd" onclick="${esc(a.vediVoce(i))}" title="Vedi voce: usa la quantità di un'altra voce del computo">↪</button>` : ''}
      ${o.soloLettura ? '' : `<button class="ehb-icon-btn ehb-mis-cmd" onclick="${esc(a.duplica(i))}" title="Duplica la riga (Ctrl+D)">⧉</button>
      <button class="ehb-btn-fam-danger-ghost ehb-mis-cmd" onclick="${esc(a.elimina(i))}" title="Elimina la riga (Ctrl+Canc)">✕</button>`}</td>
  </tr>`
}

/**
 * Il pannello: barra dei comandi, tabella delle misure, piede con «+ riga»,
 * promemoria dei tasti e totale. Il tool lo infila dove vuole (una riga della
 * sua tabella, un riquadro, una scheda) — l'interno è questo, sempre.
 */
export function misureTabellaHtml(o: OpzioniMisureTabella): string {
  const a = o.azioni
  const um = o.um ? ` (${esc(o.um)})` : ''
  const nSel = o.selezione?.size || 0
  const colonne = (a.seleziona ? 1 : 0) + 1 + CAMPI_NUMERICI.length + 2
  const righe = o.righe.map((_, i) => rigaHtml(o, i)).join('')
  const barra = [
    a.copia ? `<button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="${esc(a.copia)}" title="Copia le righe${nSel ? ' selezionate' : ' (tutte)'}: si incollano in un'altra voce o in Excel">Copia${nSel ? ` (${nSel})` : ''}</button>` : '',
    a.incolla && !o.soloLettura ? `<button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="${esc(a.incolla)}" title="Incolla in fondo le righe copiate (anche da Excel: descrizione, par.ug., L1, L2, H)">Incolla</button>` : '',
    o.soloLettura ? '' : (o.extra || ''),
  ].filter(Boolean).join('')
  return `<div class="ehb-mis">
    <div class="ehb-mis-barra">
      <span class="ehb-mis-titolo">${esc(o.titolo || 'Misure (par.ug. × L1 × L2 × H)')}</span>
      ${barra ? `<span class="ehb-mis-azioni">${barra}</span>` : ''}
    </div>
    <table class="ehb-mis-tab">
      <thead><tr>${a.seleziona ? '<th></th>' : ''}<th class="ehb-mis-th--desc">${TITOLI_CAMPI.descrizione} della misura</th>${CAMPI_NUMERICI.map((c) => `<th>${TITOLI_CAMPI[c]}</th>`).join('')}<th>Quantità${um}</th><th></th></tr></thead>
      <tbody>${righe || `<tr><td class="ehb-mis-vuoto" colspan="${colonne}">${esc(o.vuoto || 'Nessuna riga di misura.')}</td></tr>`}</tbody>
    </table>
    <div class="ehb-mis-piede">
      ${o.soloLettura ? '' : `<button class="ehb-btn-fam-create-ghost ehb-mis-nuova" onclick="${esc(a.aggiungi)}">＋ riga di misura</button>`}
      ${o.soloLettura || !a.detrazione ? '' : `<button class="ehb-btn-fam-danger-ghost ehb-mis-nuova" onclick="${esc(a.detrazione)}" title="Riga di detrazione (quantità negativa)">− riga in detrazione</button>`}
      <span class="ehb-mis-tasti mis-tasti" tabindex="0" title="${esc(TASTI_MISURE)}">⌨ tasti e formule</span>
      <span class="ehb-mis-totale">${esc(o.totale || 'Totale')}: <b data-mis-tot>${esc(o.fmt(sommaMisurazioni(o.righe)))}</b>${o.um ? ' ' + esc(o.um) : ''}</span>
    </div>
  </div>`
}

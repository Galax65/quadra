/**
 * LE CELLE DELLA GRIGLIA — che cosa c'è dentro una riga, detto una volta sola.
 *
 * La griglia (griglia.ts) decide le colonne e il loro ordine; qui si decide come
 * è fatta ogni cella. Lo strumento non scrive più l'HTML di un codice, di una
 * designazione o del campo della quantità: dice CHE COSA ci va (il testo, il
 * valore, il comando da chiamare) e la cella viene uguale nel computo, nel
 * libretto e nella perizia (Docs/06-Interfaccia-unica.md §4: «il campo che si
 * scrive si vede», codici in monospazio, numeri tabulari, descrizioni brevi).
 *
 * Restano HTML dello strumento solo le cose che sono davvero sue: i chip
 * (categoria, WBS, sicurezza…), i comandi accanto alla designazione, la maniglia
 * di trascinamento. Entrano negli slot `meta`, `azioni`, `prima`, `dopo`.
 *
 * Modulo PURO, come la griglia: dati in ingresso, HTML in uscita.
 */
import { COLONNE_NUMERICHE, type IdColonna, type StrutturaFase } from './fase'

const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

/** Quello che ogni cella può portare sul suo <td>. */
interface Aggancio {
  /** id del <td>, per gli aggiornamenti mirati. */
  id?: string
  /** Attributi in più sul <td>: HTML già pronto. */
  attributi?: string
}

/** Il codice della voce: monospazio, con l'eventuale etichetta (NP, a corpo…). */
export interface CellaCodice extends Aggancio {
  tipo: 'codice'
  codice: string
  /** Codice mancante: che cosa dire al suo posto (voce libera, composta). */
  senza?: string
  /** Etichetta sotto il codice: «NP», «NP · Σ». */
  etichetta?: string
  /** np = nuovo prezzo; proprio = codice non da prezzario; libera = articolo da assegnare. */
  tono?: 'np' | 'proprio' | 'libera'
  titolo?: string
  /** HTML prima del codice (maniglia di trascinamento, apri/chiudi). */
  prima?: string
}

/** La designazione: una descrizione breve, e sotto i suoi dati e comandi. */
export interface CellaDesignazione extends Aggancio {
  tipo: 'designazione'
  testo: string
  /** Testo mancante: che cosa dire al suo posto (in corsivo, attenuato). */
  vuoto?: string
  /** Nota in tono minore, sulla riga dei dati: «a corpo», «soppressa al SAL 2». */
  nota?: string
  /** Chip e dati della voce (HTML dello strumento), sulla riga sotto. */
  meta?: string[]
  /** Comandi della voce (HTML dello strumento): modifica, scheda NP. */
  azioni?: string
}

/**
 * Il CAMPO: un numero che si scrive. Nella colonna che la fase scrive ha
 * l'aspetto di un campo; nelle altre sembra testo finché non ci si passa sopra.
 */
export interface CellaCampo extends Aggancio {
  tipo: 'campo'
  valore: string
  /** Il comando, con il valore in `this.value`: «setSalQta(2,'p1',this.value)». */
  comando: string
  /** Quando si chiama il comando: a ogni tasto o alla conferma (default). */
  quando?: 'input' | 'change'
  segnaposto?: string
  /** Unità di misura, dopo il campo. */
  um?: string
  /** Prefisso prima del campo («€»). */
  prefisso?: string
  /** Percentuale: campo numerico 0–100 con «%» dopo. */
  percento?: boolean
  titolo?: string
  /** Il clic sul campo non arriva alla riga (che lo userebbe per selezionare). */
  isola?: boolean
  /** HTML dopo il campo (▸ dettaglia, scostamento dal prezzo di contratto). */
  dopo?: string
  disabilitato?: boolean
}

/** Una quantità che non si scrive perché la fanno le misure di dettaglio. */
export interface CellaMisurata extends Aggancio {
  tipo: 'misurata'
  /** Il valore già formattato. */
  valore: string
  um?: string
  /** Quante righe di misura la fanno. */
  misure: number
  /** id dello <span> del valore, che le misure riscrivono mentre si digita. */
  idValore?: string
}

/** Un numero calcolato: si legge, non si scrive. */
export interface CellaNumero extends Aggancio {
  tipo: 'numero'
  testo: string
  titolo?: string
  /** In tono minore (un importo a corpo dove si aspetta un prezzo). */
  muto?: boolean
}

/** Un comando di riga: ripeti, elimina. Sempre gli stessi pulsanti. */
export interface ComandoRiga {
  icona: string
  titolo: string
  onclick: string
  /** Distruttivo: si colora di rosso al passaggio. */
  pericolo?: boolean
}
export interface CellaComandi extends Aggancio {
  tipo: 'comandi'
  comandi: ComandoRiga[]
}

export type CellaVoce = CellaCodice | CellaDesignazione | CellaCampo | CellaMisurata | CellaNumero | CellaComandi

const attr = (a: Aggancio): string => (a.id ? ` id="${esc(a.id)}"` : '') + (a.attributi ? ' ' + a.attributi : '')

function codiceHtml(c: CellaCodice): string {
  const testo = c.codice
    ? `<span class="ehb-gr-cod${c.tono ? ' is-' + c.tono : ''}"${c.titolo ? ` title="${esc(c.titolo)}"` : ''}>${esc(c.codice)}</span>`
    : `<span class="ehb-gr-cod is-${c.tono || 'libera'}"${c.titolo ? ` title="${esc(c.titolo)}"` : ''}>${esc(c.senza || '—')}</span>`
  return (c.prima || '') + testo + (c.etichetta ? `<span class="ehb-gr-etic">${esc(c.etichetta)}</span>` : '')
}

function designazioneHtml(d: CellaDesignazione): string {
  const testo = d.testo
    ? `<div class="ehb-gr-des" title="${esc(d.testo)}">${esc(d.testo)}</div>`
    : `<div class="ehb-gr-des is-vuota">${esc(d.vuoto || 'senza descrizione')}</div>`
  const meta = [d.nota ? `<span class="ehb-gr-meta__nota">${esc(d.nota)}</span>` : '', ...(d.meta || []), d.azioni || ''].filter((x) => x && x.trim())
  return testo + (meta.length ? `<div class="ehb-gr-meta">${meta.join('')}</div>` : '')
}

function campoHtml(c: CellaCampo): string {
  const evento = c.quando === 'input' ? 'oninput' : 'onchange'
  const tipo = c.percento ? 'type="number" min="0" max="100" step="0.1"' : 'type="text" inputmode="decimal"'
  const input = `<input ${tipo} class="ehb-gr-campo${c.percento ? ' ehb-gr-campo--pct' : ''}" value="${esc(c.valore)}"`
    + (c.segnaposto ? ` placeholder="${esc(c.segnaposto)}"` : '')
    + (c.titolo ? ` title="${esc(c.titolo)}"` : '')
    + (c.isola ? ' onclick="event.stopPropagation()"' : '')
    + (c.disabilitato ? ' disabled' : '')
    + ` ${evento}="${esc(c.comando)}">`
  const um = c.percento ? '%' : c.um
  return (c.prefisso ? `<span class="ehb-gr-um">${esc(c.prefisso)}</span> ` : '') + input
    + (um ? ` <span class="ehb-gr-um">${esc(um)}</span>` : '') + (c.dopo ? `<span class="ehb-gr-dopo">${c.dopo}</span>` : '')
}

function misurataHtml(m: CellaMisurata): string {
  return `<span class="ehb-gr-misurata"${m.idValore ? ` id="${esc(m.idValore)}"` : ''}>${esc(m.valore)}</span>`
    + (m.um ? ` <span class="ehb-gr-um">${esc(m.um)}</span>` : '')
    + ` <span class="ehb-gr-da">(da ${m.misure} ${m.misure === 1 ? 'misura' : 'misure'})</span>`
}

function comandiHtml(c: CellaComandi): string {
  return c.comandi.map((k) =>
    `<button class="ehb-btn ehb-btn--sm ehb-btn--ghost ehb-gr-cmd${k.pericolo ? ' is-pericolo' : ''}" onclick="${esc(k.onclick)}" title="${esc(k.titolo)}" aria-label="${esc(k.titolo)}">${esc(k.icona)}</button>`).join('')
}

/** Il contenuto di una cella descritta (senza il <td>). */
export function contenutoCella(c: CellaVoce): string {
  switch (c.tipo) {
    case 'codice': return codiceHtml(c)
    case 'designazione': return designazioneHtml(c)
    case 'campo': return campoHtml(c)
    case 'misurata': return misurataHtml(c)
    case 'numero': return c.muto ? `<span class="ehb-gr-muto">${esc(c.testo)}</span>` : esc(c.testo)
    case 'comandi': return comandiHtml(c)
  }
}

/** Le classi del <td>, dalla colonna e dalla fase. */
export function classiCella(fase: StrutturaFase, id: IdColonna): string {
  return `ehb-gr-c ehb-gr-c--${id}`
    + (COLONNE_NUMERICHE.has(id) ? ' ehb-gr-num' : '')
    + (fase.scrive === id ? ' ehb-gr-c--scrive' : '')
    + (fase.confronta === id ? ' ehb-gr-c--confronto' : '')
}

/** Il <td> di una cella descritta. */
export function cellaVoceHtml(fase: StrutturaFase, id: IdColonna, c: CellaVoce): string {
  const titolo = c.tipo === 'numero' && c.titolo ? ` title="${esc(c.titolo)}"` : ''
  return `<td class="${classiCella(fase, id)}"${attr(c)}${titolo}>${contenutoCella(c)}</td>`
}

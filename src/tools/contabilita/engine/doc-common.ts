/**
 * Contabilità — helper comuni ai documenti contabili. Tutti gli atti sono HTML
 * stampabili resi dal sistema documentale condiviso (`renderDocPage`) in
 * MODALITÀ ISTITUZIONALE: testata dell'ente (stazione appaltante) e NIENTE
 * brand Quadra (`brand:'none'`). Numeri/valuta dal modulo condiviso `shared/format`.
 */
import { escHtml, type DocEnte, type DocField } from '../../../shared/doc/doc'
import type { Appalto, Partita } from './types'

/** Testata istituzionale dell'ente dal contratto (logo + denominazione + C.F./indirizzo). */
export function enteDi(appalto: Appalto): DocEnte {
  const e = appalto.ente || { denominazione: '' }
  const sub: string[] = []
  if (e.indirizzo) sub.push(e.indirizzo)
  const cf = [e.codiceFiscale ? `C.F. ${e.codiceFiscale}` : '', e.partitaIva ? `P.IVA ${e.partitaIva}` : ''].filter(Boolean).join(' · ')
  if (cf) sub.push(cf)
  return {
    name: e.denominazione || 'Stazione appaltante',
    ...(e.logo ? { logoHtml: `<img src="${escHtml(e.logo)}" alt="">` } : {}),
    sub,
  }
}

/** Campi di cartiglio comuni (oggetto, CUP, CIG, impresa) — piè di pagina di ogni atto. */
export function footerFieldsDi(appalto: Appalto): DocField[] {
  const f: DocField[] = []
  if (appalto.cup) f.push({ k: 'CUP', v: escHtml(appalto.cup) })
  if (appalto.cig) f.push({ k: 'CIG', v: escHtml(appalto.cig) })
  if (appalto.impresa?.denominazione) f.push({ k: 'Impresa', v: escHtml(appalto.impresa.denominazione) })
  return f
}

/** Meta della testata (in alto a destra): impresa, RUP, DL. */
export function headMetaDi(appalto: Appalto): DocField[] {
  const m: DocField[] = []
  if (appalto.rup) m.push({ k: 'RUP', v: escHtml(appalto.rup) })
  if (appalto.direttoreLavori) m.push({ k: 'Dir. Lavori', v: escHtml(appalto.direttoreLavori) })
  return m
}

/** Kicker comune: «Contabilità · <oggetto abbreviato>». */
export function kickerDi(appalto: Appalto, coda: string): string {
  // L'oggetto dei lavori si taglia semmai su una parola, mai a metà: un atto che
  // dice «SERVIZI COMPLEMENTARI DELL'AUTOSTAZI» non nomina nessun lavoro.
  const ogg = accorciaFinale(appalto.oggetto || 'Lavori', 110)
  return `Contabilità lavori pubblici · ${coda}${ogg ? ' · ' + ogg : ''}`
}

/** Taglia un testo alla parola intera, con i puntini, solo se è più lungo del limite. */
export function accorciaFinale(testo: string, max: number): string {
  const t = String(testo || '').replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  const taglio = t.lastIndexOf(' ', max)
  return t.slice(0, taglio > max * 0.6 ? taglio : max).replace(/[,;:·.\-]$/, '') + '…'
}

/** Riquadro firme in calce a un atto (DL / esecutore / RUP secondo l'atto). */
export function firmeHTML(ruoli: Array<{ ruolo: string; nome?: string }>): string {
  const cols = ruoli.map((r) => `
    <div class="bt-firma">
      <div class="bt-firma__line"></div>
      <div class="bt-firma__ruolo">${escHtml(r.ruolo)}</div>
      ${r.nome ? `<div class="bt-firma__nome">${escHtml(r.nome)}</div>` : ''}
    </div>`).join('')
  return `<div class="bt-firme">${cols}</div>`
}

/** Placeholder esplicito «da confermare» per i dati non disponibili (regola di fedeltà del dato). */
export const DA_CONFERMARE = '<span class="bt-todo">da confermare</span>'

/** Valore o placeholder «da confermare» se vuoto. */
export function orTodo(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v).trim()
  return s ? escHtml(s) : DA_CONFERMARE
}

/** Chi firma come direttore: DL per i lavori, DEC per servizi e forniture. */
export function ilDirettore(appalto: Appalto): string {
  return appalto.tipologia && appalto.tipologia !== 'lavori' ? "Il Direttore dell'esecuzione" : 'Il Direttore dei Lavori'
}
/** Come si chiamano le prestazioni del contratto («lavori», «servizi», «forniture»). */
export function prestazioniDi(appalto: Appalto): string {
  return appalto.tipologia === 'servizi' ? 'servizi' : appalto.tipologia === 'forniture' ? 'forniture' : 'lavori'
}

/**
 * Sezioni degli atti contabili, nell'ordine d'uso: i lavori (a misura, a corpo)
 * e i costi della sicurezza, che non sono lavori e non subiscono il ribasso.
 * Una sola definizione per registro, sommario, SAL e quadri comparativi.
 */
export type Sezione = 'misura' | 'corpo' | 'sicurezza'
export const TITOLO_SEZIONE: Record<Sezione, string> = { misura: 'LAVORI A MISURA', corpo: 'LAVORI A CORPO', sicurezza: 'COSTI DELLA SICUREZZA (non soggetti a ribasso)' }
export const sezioneDi = (p: Partita): Sezione => (p.sicurezza ? 'sicurezza' : p.modalita === 'corpo' ? 'corpo' : 'misura')
export const SEZIONI: Sezione[] = ['misura', 'corpo', 'sicurezza']

/**
 * OPZIONI DI STAMPA DEGLI ATTI. Non riguardano il contenuto contabile — quello
 * non si sceglie — ma quanto testo si porta in stampa e se compaiono le date dei
 * rilevamenti: un registro con le declaratorie intere è illeggibile, uno senza
 * non dice che cosa è stato pagato.
 */
export interface OpzioniAtto {
  /** 'estesa': tutta la declaratoria; 'ridotta': solo la descrizione breve;
   *  'parziale': descrizione breve più l'inizio e la fine della declaratoria. */
  descrizione?: 'estesa' | 'ridotta' | 'parziale'
  /** Stampare la data del rilevamento accanto alla tariffa (libretto). */
  date?: boolean
  /** Con 'parziale': quante righe di declaratoria stampare all'inizio e alla fine. */
  righeIniziali?: number
  righeFinali?: number
}

/** Caratteri che stanno, in media, in una riga della colonna della designazione. */
const CARATTERI_PER_RIGA = 80

export const OPZIONI_ATTO_DEFAULT: Required<OpzioniAtto> = { descrizione: 'parziale', date: true, righeIniziali: 3, righeFinali: 2 }

/** Inizio e fine di un testo lungo, con l'omissione dichiarata nel mezzo. */
export function accorciaTesto(testo: string, prime = 240, ultime = 160): string {
  const t = String(testo || '').replace(/\s+/g, ' ').trim()
  if (t.length <= prime + ultime + 20) return t
  const taglioA = t.lastIndexOf(' ', prime)
  const taglioB = t.indexOf(' ', t.length - ultime)
  return `${t.slice(0, taglioA > 0 ? taglioA : prime)} […] ${t.slice(taglioB > 0 ? taglioB + 1 : t.length - ultime)}`
}

/**
 * Testo della voce negli atti, secondo l'opzione scelta. `fallback` è il modo
 * proprio dell'atto quando l'utente non ha scelto: il libretto porta la sola
 * descrizione (è l'atto delle misure), registro e sommario anche l'inizio e la
 * fine della declaratoria (dicono che cosa si paga).
 */
export function testoVoceHTML(p: Partita, opz?: OpzioniAtto, fallback: OpzioniAtto['descrizione'] = OPZIONI_ATTO_DEFAULT.descrizione): string {
  const modo = opz?.descrizione ?? fallback
  const breve = escHtml(p.descrizione || p.codice)
  if (modo === 'ridotta' || !p.declaratoria) return breve
  const lunga = modo === 'estesa' ? p.declaratoria : accorciaTesto(p.declaratoria, (opz?.righeIniziali ?? OPZIONI_ATTO_DEFAULT.righeIniziali) * CARATTERI_PER_RIGA, (opz?.righeFinali ?? OPZIONI_ATTO_DEFAULT.righeFinali) * CARATTERI_PER_RIGA)
  return `${breve}<span class="sub">${escHtml(lunga)}</span>`
}

/**
 * IL LAVORO — tappa 1 di Docs/07-Un-lavoro-un-modulo.md.
 *
 * Un lavoro è una CATENA: revisioni di computo nelle fasi di progetto, il
 * contratto, i SAL, le perizie, il SAL finale, il CRE. Computo e contabilità
 * non sono due programmi: sono tappe della stessa catena, e si aprono nella
 * stessa schermata. Questo modulo ne è il modello, puro (niente DOM, niente
 * stato globale): ogni operazione riceve un Lavoro e ne restituisce uno nuovo,
 * oppure lancia un errore che dice in italiano perché non si può.
 *
 * LA NUMERAZIONE. Il numero di revisione è un numero, proposto in ordine
 * cronologico ma liberamente modificabile, e può saltare (rev.02 → rev.05: in
 * mezzo ci sono state revisioni del progetto che non hanno toccato il
 * computo). Hanno un numero le revisioni che portano voci e prezzi — computo,
 * contratto, perizia. I SAL, il SAL finale e il CRE NON hanno un numero
 * proprio: portano quello della revisione da cui leggono i prezzi (il
 * contratto, poi la perizia approvata).
 *
 * GLI STATI. Una tappa aperta si scrive; una chiusa è in sola lettura. Chiudere
 * è un atto esplicito — consegna di una revisione, stipula del contratto,
 * approvazione di una perizia, emissione di un SAL — e anche riaprire: non si
 * riapre ciò su cui poggia qualcosa di già chiuso.
 */
import type { MisurazioneRiga } from '../compositore/misurazioni'
import { sommaMisurazioni } from '../compositore/misurazioni'
import { risolviVediVoce, type QtyVoce } from '../compositore/misure-edit'
import { importoQta } from '../importo'
import type { DatiGenerali } from '../dati-generali'
import type { DatiContabilita } from './contabilita'
import { economiaATuttoSal, type Atti } from './atti'
import type { AnalisiPrezzi } from '../compositore/analisi-prezzi'
import type { QuadroEconomico } from '../quadro-economico'
import type { Offerta } from '../offerte'

export type Fase = 'PFTE' | 'definitivo' | 'esecutivo'
export const FASI: readonly Fase[] = ['PFTE', 'definitivo', 'esecutivo']
export const NOME_FASE: Record<Fase, string> = { PFTE: 'PFTE', definitivo: 'Definitivo', esecutivo: 'Esecutivo' }

/** Un articolo dell'elenco prezzi di una revisione. */
export interface Articolo {
  id: string
  codice: string
  descrizione: string
  /** Declaratoria estesa. */
  estesa?: string
  um: string
  prezzo: number | null
  /** Da dove viene il prezzo. */
  origine: 'prezzario' | 'np' | 'analisi' | 'manuale'
  /** Il prezzario di provenienza (id in Lavoro.prezzari). */
  prezzario?: string
  /** Per un nuovo prezzo: il codice da cui è nato. */
  codiceOrig?: string
  /** Oneri della sicurezza: non soggetti a ribasso. */
  sicurezza?: boolean
  /**
   * Il ribasso d'asta su questo articolo, quando non vale la regola del
   * contratto (ribassoArticolo): true = soggetto, false = non soggetto. Serve
   * ai NP: col ribasso unico lo sono per default (come il rigo «PROGETTO» di
   * rigo di ribasso unico), ma un NP per analisi può non esserlo (D.Lgs. 36/2023, parere MIT
   * 3545/2025); coi prezzi offerti non lo sono, salvo contratto diverso.
   */
  soggettoRibasso?: boolean
  /** L'analisi prezzi da cui viene il prezzo (analisi.ts), se c'è. */
  analisi?: string
  /** Incidenza della manodopera sul prezzo, % (dal prezzario, dall'XPWE o dall'analisi). */
  incMdo?: number
  /** Il prezzo di listino (del prezzario) prima della prima modifica. */
  prezzoListino?: number | null
  /** Le variazioni di prezzo: da, a, quando, perché. */
  storico?: { data: string; da: number | null; a: number | null; nota?: string }[]
}

/** Una voce di computo: un articolo, misurato. Lo stesso articolo può comparire più volte. */
export interface Voce {
  id: string
  articolo: string
  misure: MisurazioneRiga[]
  /** Quantità scritta direttamente, quando non ci sono misure di dettaglio. */
  quantita?: number
  categoria?: string
  wbs?: string
  /** Lavoro a corpo. */
  corpo?: boolean
  /**
   * Per un lavoro a corpo: il SOTTO-COMPUTO, le lavorazioni in cui il corpo si
   * scompone. La quota del SAL non si stima a occhio: si ricava da quanto di
   * queste lavorazioni è stato eseguito (art. 12 All. II.14).
   */
  sottoComputo?: VoceSotto[]
}

export interface VoceSotto { id: string; codice?: string; descrizione: string; um?: string; qty?: number | null; prezzo?: number | null }

export type TipoRevisione = 'computo' | 'contratto' | 'perizia'

export interface StrutturaRevisione {
  /** Rami di categoria senza voci (da un modello, o creati vuoti). */
  dichiarate: string[]
  /** Ordine dei nomi per livello (Super, Categoria, Sub). */
  ordineLivelli?: string[][]
  /** Nodi WBS: codice → descrizione. */
  wbsNodi: Record<string, string>
}

/** Una revisione con voci e prezzi: computo di una fase, contratto, perizia. */
export interface Revisione {
  id: string
  tipo: TipoRevisione
  /** Il numero di revisione: libero, ma in ordine lungo la catena. */
  numero: number
  /** Fase di progetto (solo per i computi). */
  fase?: Fase
  nome?: string
  /** Data in formato gg/mm/aaaa. */
  data: string
  stato: 'aperta' | 'chiusa'
  /** Quando è stata chiusa (consegnata, stipulata, approvata). */
  chiusaIl?: string
  /** Posizione nella catena: chi viene prima e chi dopo. */
  ordine: number
  /** La revisione da cui è stata copiata (il computo da cui nasce il contratto, ecc.). */
  da?: string
  articoli: Articolo[]
  voci: Voce[]
  /** Solo per il contratto: come i prezzi di progetto diventano prezzi di contratto. */
  contratto?: {
    ribassoPct?: number; prezziOfferti?: Record<string, number>; offerente?: string
    /**
     * Contratto A MISURA SENZA COMPUTO (lavori privati, contabilità da zero):
     * l'elenco prezzi cresce dal SAL, ogni articolo misurato entra nel contratto
     * senza una quantità di riferimento. L'importo pattuito, se c'è, è il
     * riferimento del lavoro.
     */
    libero?: boolean
    importoPattuito?: number | null
  }
  /** La struttura che non sta sulle voci: rami dichiarati, ordine dei livelli, descrizioni WBS. */
  struttura?: StrutturaRevisione
  /** Il quadro economico di questa revisione (somme a disposizione): quadro-economico.ts. */
  qe?: QuadroEconomico
  /** Le offerte ricevute su questa revisione (gara): offerte.ts. */
  offerte?: Offerta[]
}

export type TipoAvanzamento = 'sal' | 'salFinale' | 'cre'

/** Le misure di una voce in un avanzamento: a tutto il SAL (progressive). */
export interface RigaAvanzamento {
  voce: string
  misure: MisurazioneRiga[]
  quantita?: number
  /** Per i lavori a corpo: quota eseguita in %. */
  quotaPct?: number
  /** Lavori a corpo con sotto-computo: l'eseguito a tutto il SAL di ogni lavorazione (la quota ne discende). */
  sotto?: { voceId: string; quantita?: number | null; misure?: MisurazioneRiga[] }[]
}

/** Un avanzamento: SAL, SAL finale (stato finale), CRE. Legge i prezzi da una revisione. */
export interface Avanzamento {
  id: string
  tipo: TipoAvanzamento
  /** Numero del SAL (1, 2, 3…); per SAL finale e CRE il numero del SAL che chiudono. */
  n: number
  data: string
  stato: 'bozza' | 'emesso'
  emessoIl?: string
  ordine: number
  /** La revisione (contratto o perizia approvata) da cui legge i prezzi: ne porta il numero. */
  leggeDa: string
  righe: RigaAvanzamento[]
  /**
   * L'IMPRONTA dell'avanzamento emesso (SHA-256 del testo canonico degli atti:
   * contabilità digitale, art. 12 c. 10 All. II.14): se qualcuno lo riapre e lo
   * cambia, l'impronta ricalcolata non torna e il registro degli atti lo dice.
   */
  impronta?: string
  improntaTs?: number
  /** Le riaperture dopo l'emissione: quando, e con quale impronta si era chiuso. Niente sparisce. */
  sblocchi?: { ts: number; impronta?: string }[]
  /** Detrazioni a tutto il SAL (lavorazioni non conformi o in contestazione), €: si tolgono dal contabilizzato. */
  detrazioni?: number
  note?: string
}

export interface Prezzario {
  id: string
  nome: string
  regione?: string
  anno?: string
}

export interface Lavoro {
  versione: 1
  dati: Partial<DatiGenerali>
  prezzari: Prezzario[]
  /** Le analisi prezzi del lavoro (analisi.ts). */
  analisi: AnalisiPrezzi[]
  revisioni: Revisione[]
  avanzamenti: Avanzamento[]
  /** Contatore della posizione nella catena (cresce sempre). */
  prossimoOrdine: number
  /** Contratto come atto, tempi, pagamenti (contabilita.ts). */
  contabilita?: DatiContabilita
  /** Giornale, verbali e ordini, riserve, liste in economia (atti.ts). */
  atti?: Atti
}

export type Tappa = (Revisione & { famiglia: 'revisione' }) | (Avanzamento & { famiglia: 'avanzamento' })

/* ── Strumenti ────────────────────────────────────────────────────────── */

let _seq = 0
/** Un identificativo nuovo, stabile e leggibile. */
export function nuovoId(prefisso: string): string {
  _seq = (_seq + 1) % 1e6
  return `${prefisso}-${Date.now().toString(36)}-${_seq.toString(36)}`
}

/** «rev.03»: sempre a due cifre, perché la fila resti allineata. */
export const sigla = (n: number): string => `rev.${String(n).padStart(2, '0')}`

const copia = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T

export function nuovoLavoro(dati: Partial<DatiGenerali> = {}): Lavoro {
  return { versione: 1, dati, prezzari: [], analisi: [], revisioni: [], avanzamenti: [], prossimoOrdine: 1 }
}

/** La catena in ordine: revisioni e avanzamenti, come sono accaduti. */
export function catena(l: Lavoro): Tappa[] {
  return [
    ...l.revisioni.map((r) => ({ ...r, famiglia: 'revisione' as const })),
    ...l.avanzamenti.map((a) => ({ ...a, famiglia: 'avanzamento' as const })),
  ].sort((a, b) => a.ordine - b.ordine)
}

export function revisione(l: Lavoro, id: string): Revisione {
  const r = l.revisioni.find((x) => x.id === id)
  if (!r) throw new Error('Revisione non trovata')
  return r
}
export function avanzamento(l: Lavoro, id: string): Avanzamento {
  const a = l.avanzamenti.find((x) => x.id === id)
  if (!a) throw new Error('Avanzamento non trovato')
  return a
}

/** Il numero proposto per la prossima revisione: uno più del più alto. */
export function numeroProposto(l: Lavoro): number {
  return l.revisioni.length ? Math.max(...l.revisioni.map((r) => r.numero)) + 1 : 0
}

/** Il contratto, se c'è. */
export function contratto(l: Lavoro): Revisione | null {
  return l.revisioni.find((r) => r.tipo === 'contratto') ?? null
}

/** La revisione da cui leggono i prezzi gli avanzamenti nuovi: l'ultima chiusa fra contratto e perizie. */
export function vigente(l: Lavoro): Revisione | null {
  let v: Revisione | null = null
  for (const r of [...l.revisioni].sort((a, b) => a.ordine - b.ordine)) {
    if (r.tipo !== 'computo' && r.stato === 'chiusa') v = r
  }
  return v
}

/** Si può ancora scrivere in questa tappa? */
export function modificabile(l: Lavoro, id: string): boolean {
  const r = l.revisioni.find((x) => x.id === id)
  if (r) return r.stato === 'aperta'
  const a = l.avanzamenti.find((x) => x.id === id)
  if (a) return a.stato === 'bozza'
  return false
}

/** Il numero di revisione che una tappa porta: il suo, o quello da cui legge i prezzi. */
export function numeroDi(l: Lavoro, id: string): number {
  const r = l.revisioni.find((x) => x.id === id)
  if (r) return r.numero
  return revisione(l, avanzamento(l, id).leggeDa).numero
}

/* ── Le revisioni ─────────────────────────────────────────────────────── */

/** Controlla che un numero stia al suo posto: unico, e in ordine lungo la catena. */
function controllaNumero(l: Lavoro, numero: number, ordine: number, escludi?: string): void {
  if (!Number.isInteger(numero) || numero < 0) throw new Error('Il numero di revisione è un intero da 0 in su')
  const altre = l.revisioni.filter((r) => r.id !== escludi)
  if (altre.some((r) => r.numero === numero)) throw new Error(`Il numero ${sigla(numero)} è già usato`)
  const prima = altre.filter((r) => r.ordine < ordine).map((r) => r.numero)
  const dopo = altre.filter((r) => r.ordine > ordine).map((r) => r.numero)
  if (prima.length && numero <= Math.max(...prima)) throw new Error(`Il numero deve essere dopo ${sigla(Math.max(...prima))}, la revisione che viene prima`)
  if (dopo.length && numero >= Math.min(...dopo)) throw new Error(`Il numero deve essere prima di ${sigla(Math.min(...dopo))}, la revisione che viene dopo`)
}

/**
 * Una revisione di computo nuova, in una fase qualunque: vuota, oppure copiata
 * da un'altra (di solito l'ultima, per lavorarci sopra). Si apre in lavorazione.
 */
export function nuovoComputo(l: Lavoro, o: { fase: Fase; data: string; numero?: number; da?: string; nome?: string }): { lavoro: Lavoro; id: string } {
  if (contratto(l)) throw new Error('Il contratto c\'è già: un computo nuovo dopo il contratto è una perizia di variante')
  const numero = o.numero ?? numeroProposto(l)
  controllaNumero(l, numero, l.prossimoOrdine)
  const src = o.da ? revisione(l, o.da) : null
  const id = nuovoId('rev')
  const r: Revisione = {
    id, tipo: 'computo', numero, fase: o.fase, data: o.data, stato: 'aperta', ordine: l.prossimoOrdine,
    ...(o.nome ? { nome: o.nome } : {}), ...(src ? { da: src.id } : {}),
    articoli: src ? copia(src.articoli) : [], voci: src ? copia(src.voci) : [],
  }
  return { lavoro: { ...l, revisioni: [...l.revisioni, r], prossimoOrdine: l.prossimoOrdine + 1 }, id }
}

/** Cambia il numero di una revisione: resta unico e in ordine; i SAL che la citano la seguono. */
export function rinumera(l: Lavoro, id: string, numero: number): Lavoro {
  const r = revisione(l, id)
  controllaNumero(l, numero, r.ordine, id)
  return { ...l, revisioni: l.revisioni.map((x) => (x.id === id ? { ...x, numero } : x)) }
}

/** Cambia fase, nome o data di una revisione (anche chiusa: non tocca il contenuto). */
export function descrivi(l: Lavoro, id: string, patch: { fase?: Fase; nome?: string; data?: string }): Lavoro {
  const r = revisione(l, id)
  if (patch.fase && r.tipo !== 'computo') throw new Error('Solo un computo ha una fase di progetto')
  return { ...l, revisioni: l.revisioni.map((x) => (x.id === id ? { ...x, ...patch } : x)) }
}

/** Chi poggia su questa revisione, e le impedisce di riaprirsi. */
function cheCiPoggia(l: Lavoro, r: Revisione): string | null {
  const figlia = l.revisioni.find((x) => x.da === r.id && x.tipo !== 'computo' && x.stato === 'chiusa')
  if (figlia) return figlia.tipo === 'contratto' ? 'il contratto stipulato' : 'una perizia approvata'
  const sal = l.avanzamenti.find((a) => a.leggeDa === r.id && a.stato === 'emesso')
  if (sal) return `il SAL n. ${sal.n} emesso`
  return null
}

/** Chiude una revisione: consegna (computo), stipula (contratto), approvazione (perizia). */
export function chiudi(l: Lavoro, id: string, data: string): Lavoro {
  const r = revisione(l, id)
  if (r.stato === 'chiusa') return l
  if (!r.voci.length) throw new Error('Una revisione senza voci non si consegna')
  if (r.tipo === 'perizia') {
    const prima = l.revisioni.find((x) => x.tipo !== 'computo' && x.ordine < r.ordine && x.stato === 'aperta')
    if (prima) throw new Error('Prima va chiusa la revisione che viene prima')
  }
  const revisioni = l.revisioni.map((x) => (x.id === id ? { ...x, stato: 'chiusa' as const, chiusaIl: data } : x))
  // approvata la perizia, il SAL ancora in bozza passa ai suoi prezzi e al suo numero:
  // non è emesso, e misura lavori che da oggi si pagano ai prezzi della perizia
  const avanzamenti = r.tipo === 'perizia'
    ? l.avanzamenti.map((a) => (a.stato === 'bozza' && a.tipo !== 'cre' ? { ...a, leggeDa: id } : a))
    : l.avanzamenti
  return { ...l, revisioni, avanzamenti }
}

/** Riapre una revisione chiusa, se niente di già chiuso ci poggia sopra. */
export function riapri(l: Lavoro, id: string): Lavoro {
  const r = revisione(l, id)
  if (r.stato === 'aperta') return l
  const blocco = cheCiPoggia(l, r)
  if (blocco) throw new Error(`Non si riapre: ci poggia ${blocco}`)
  const revisioni = l.revisioni.map((x) => (x.id === id ? (({ chiusaIl: _c, ...resto }) => ({ ...resto, stato: 'aperta' as const }))(x) : x))
  // riaperta una perizia, il SAL in bozza che ne leggeva i prezzi torna alla revisione di prima
  const avanzamenti = r.tipo === 'perizia' && r.da
    ? l.avanzamenti.map((a) => (a.leggeDa === id && a.stato === 'bozza' ? { ...a, leggeDa: r.da! } : a))
    : l.avanzamenti
  return { ...l, revisioni, avanzamenti }
}

/* ── Il contratto ─────────────────────────────────────────────────────── */

/**
 * Un computo consegnato diventa contratto: le sue voci e i suoi prezzi, più il
 * ribasso d'asta oppure i prezzi offerti (mai entrambi). Il contratto prende un
 * numero nuovo e si apre in definizione; stipulandolo (chiudi) diventa la base
 * della contabilità.
 */
export function promuoviAContratto(l: Lavoro, daId: string, o: { data: string; numero?: number; ribassoPct?: number; prezziOfferti?: Record<string, number>; offerente?: string }): { lavoro: Lavoro; id: string } {
  if (contratto(l)) throw new Error('Il contratto c\'è già')
  const src = revisione(l, daId)
  if (src.tipo !== 'computo') throw new Error('Diventa contratto un computo')
  if (src.stato !== 'chiusa') throw new Error('Prima si consegna il computo, poi diventa contratto')
  if (o.ribassoPct != null && o.prezziOfferti) throw new Error('O il ribasso o i prezzi offerti: insieme conterebbero il ribasso due volte')
  if (o.ribassoPct != null && (o.ribassoPct < 0 || o.ribassoPct >= 100)) throw new Error('Il ribasso va da 0 a meno di 100')
  const numero = o.numero ?? numeroProposto(l)
  controllaNumero(l, numero, l.prossimoOrdine)
  const id = nuovoId('rev')
  const r: Revisione = {
    // il contratto nasce IN VIGORE: voci e prezzi sono quelli del computo consegnato,
    // e da subito si può aprire il SAL. Ribasso e prezzi offerti si correggono
    // finché nessun SAL è emesso (impostaRibasso, impostaPrezzoOfferto).
    id, tipo: 'contratto', numero, data: o.data, stato: 'chiusa', chiusaIl: o.data, ordine: l.prossimoOrdine, da: src.id,
    articoli: copia(src.articoli), voci: copia(src.voci),
    contratto: {
      ...(o.ribassoPct != null ? { ribassoPct: o.ribassoPct } : {}),
      ...(o.prezziOfferti ? { prezziOfferti: { ...o.prezziOfferti } } : {}),
      ...(o.offerente ? { offerente: o.offerente } : {}),
    },
  }
  return { lavoro: { ...l, revisioni: [...l.revisioni, r], prossimoOrdine: l.prossimoOrdine + 1 }, id }
}

/* ── La contabilità ───────────────────────────────────────────────────── */

/**
 * Un SAL nuovo: legge i prezzi dalla revisione vigente (contratto o ultima
 * perizia approvata) e ne porta il numero; parte dalle misure progressive del
 * SAL prima. Il precedente deve essere emesso: due SAL aperti insieme sono un
 * equivoco (il secondo parte da quantità che possono ancora cambiare).
 */
export function nuovoSal(l: Lavoro, data: string): { lavoro: Lavoro; id: string } {
  const v = vigente(l)
  if (!v) throw new Error('Prima si stipula il contratto')
  const sal = l.avanzamenti.filter((a) => a.tipo === 'sal').sort((a, b) => a.n - b.n)
  if (l.avanzamenti.some((a) => a.tipo !== 'sal')) throw new Error('Dopo il SAL finale non si aprono altri SAL')
  const ultimo = sal[sal.length - 1]
  if (ultimo && ultimo.stato !== 'emesso') throw new Error(`Prima si emette il SAL n. ${ultimo.n}`)
  const id = nuovoId('sal')
  const a: Avanzamento = {
    id, tipo: 'sal', n: (ultimo?.n ?? 0) + 1, data, stato: 'bozza', ordine: l.prossimoOrdine, leggeDa: v.id,
    righe: ultimo ? copia(ultimo.righe) : [],
  }
  return { lavoro: { ...l, avanzamenti: [...l.avanzamenti, a], prossimoOrdine: l.prossimoOrdine + 1 }, id }
}

/** Emette un avanzamento: da qui è in sola lettura. */
export function emetti(l: Lavoro, id: string, data: string): Lavoro {
  const a = avanzamento(l, id)
  if (a.stato === 'emesso') return l
  const prima = l.avanzamenti.find((x) => x.ordine < a.ordine && x.stato !== 'emesso')
  if (prima) throw new Error('Prima si emette quello che viene prima')
  return { ...l, avanzamenti: l.avanzamenti.map((x) => (x.id === id ? { ...x, stato: 'emesso' as const, emessoIl: data } : x)) }
}

/** Riapre un avanzamento emesso, se è l'ultimo: quelli dopo partono dalle sue quantità. */
export function riapriAvanzamento(l: Lavoro, id: string): Lavoro {
  const a = avanzamento(l, id)
  if (a.stato === 'bozza') return l
  if (l.avanzamenti.some((x) => x.ordine > a.ordine)) throw new Error('Si riapre solo l\'ultimo: i successivi partono dalle sue quantità')
  // la riapertura resta scritta, con l'impronta che aveva: è un atto pubblico
  return { ...l, avanzamenti: l.avanzamenti.map((x) => (x.id === id
    ? (({ emessoIl: _e, impronta: imp, improntaTs: _t, ...resto }) => ({ ...resto, stato: 'bozza' as const, sblocchi: [...(x.sblocchi || []), { ts: Date.now(), ...(imp ? { impronta: imp } : {}) }] }))(x)
    : x)) }
}

/**
 * Una perizia di variante: una revisione nuova, copiata dalla vigente, con un
 * numero nuovo. Approvata (chiudi), i SAL successivi ne portano il numero.
 */
export function nuovaPerizia(l: Lavoro, o: { data: string; numero?: number; nome?: string }): { lavoro: Lavoro; id: string } {
  const v = vigente(l)
  if (!v) throw new Error('Una perizia cambia un contratto: prima si stipula il contratto')
  if (l.revisioni.some((r) => r.tipo === 'perizia' && r.stato === 'aperta')) throw new Error('C\'è già una perizia in bozza')
  const numero = o.numero ?? numeroProposto(l)
  controllaNumero(l, numero, l.prossimoOrdine)
  const id = nuovoId('rev')
  const r: Revisione = {
    id, tipo: 'perizia', numero, data: o.data, stato: 'aperta', ordine: l.prossimoOrdine, da: v.id,
    ...(o.nome ? { nome: o.nome } : {}),
    // i prezzi offerti in gara valgono anche per le voci di contratto in perizia
    ...(v.contratto?.prezziOfferti ? { contratto: { prezziOfferti: copia(v.contratto.prezziOfferti) } } : {}),
    articoli: copia(v.articoli), voci: copia(v.voci),
  }
  return { lavoro: { ...l, revisioni: [...l.revisioni, r], prossimoOrdine: l.prossimoOrdine + 1 }, id }
}

/** Il SAL finale (stato finale dei lavori): dopo l'ultimo SAL emesso, ne riprende le misure. */
export function nuovoSalFinale(l: Lavoro, data: string): { lavoro: Lavoro; id: string } {
  const v = vigente(l)
  if (!v) throw new Error('Prima si stipula il contratto')
  if (l.avanzamenti.some((a) => a.tipo !== 'sal')) throw new Error('Il SAL finale c\'è già')
  const sal = l.avanzamenti.filter((a) => a.tipo === 'sal').sort((a, b) => a.n - b.n)
  const ultimo = sal[sal.length - 1]
  if (ultimo && ultimo.stato !== 'emesso') throw new Error(`Prima si emette il SAL n. ${ultimo.n}`)
  const id = nuovoId('sal')
  const a: Avanzamento = { id, tipo: 'salFinale', n: (ultimo?.n ?? 0) + 1, data, stato: 'bozza', ordine: l.prossimoOrdine, leggeDa: v.id, righe: ultimo ? copia(ultimo.righe) : [] }
  return { lavoro: { ...l, avanzamenti: [...l.avanzamenti, a], prossimoOrdine: l.prossimoOrdine + 1 }, id }
}

/** Il certificato di regolare esecuzione: dopo il SAL finale emesso. */
export function nuovoCre(l: Lavoro, data: string): { lavoro: Lavoro; id: string } {
  const fin = l.avanzamenti.find((a) => a.tipo === 'salFinale')
  if (!fin) throw new Error('Il CRE viene dopo il SAL finale')
  if (fin.stato !== 'emesso') throw new Error('Prima si emette il SAL finale')
  if (l.avanzamenti.some((a) => a.tipo === 'cre')) throw new Error('Il CRE c\'è già')
  const id = nuovoId('cre')
  const a: Avanzamento = { id, tipo: 'cre', n: fin.n, data, stato: 'bozza', ordine: l.prossimoOrdine, leggeDa: fin.leggeDa, righe: copia(fin.righe) }
  return { lavoro: { ...l, avanzamenti: [...l.avanzamenti, a], prossimoOrdine: l.prossimoOrdine + 1 }, id }
}

/* ── Quantità e importi ───────────────────────────────────────────────── */

/** La quantità di una voce: la somma delle misure, se ci sono; altrimenti quella scritta. */
export function quantitaVoce(v: Pick<Voce, 'misure' | 'quantita'>): number {
  return v.misure && v.misure.length ? sommaMisurazioni(v.misure) : (v.quantita ?? 0)
}

/** Il prezzo di un articolo in una revisione: con i prezzi offerti del contratto, quello offerto. */
export function prezzoIn(r: Revisione, a: Articolo): number {
  const off = r.contratto?.prezziOfferti?.[a.id]
  return off != null && !a.sicurezza ? off : (a.prezzo ?? 0)
}

/** Importo di una revisione: lavori e sicurezza, ai prezzi della revisione, prima del ribasso. */
export function importiRevisione(r: Revisione): { lavori: number; sicurezza: number; totale: number } {
  const art = new Map(r.articoli.map((a) => [a.id, a]))
  let lavori = 0, sicurezza = 0
  for (const v of r.voci) {
    const a = art.get(v.articolo); if (!a) continue
    const imp = importoQta(quantitaVoce(v), prezzoIn(r, a), a.um)
    if (a.sicurezza) sicurezza += imp; else lavori += imp
  }
  const r2 = (n: number): number => Math.round(n * 100) / 100
  return { lavori: r2(lavori), sicurezza: r2(sicurezza), totale: r2(lavori + sicurezza) }
}

/* ── Le voci di una revisione aperta ──────────────────────────────────────
   Si scrive solo in una revisione aperta: la regola sta QUI, nel modello, e
   non nella schermata — anche un comando arrivato per sbaglio a una revisione
   consegnata viene rifiutato. */

function conRevisioneAperta(l: Lavoro, id: string, f: (r: Revisione) => Revisione): Lavoro {
  const r = revisione(l, id)
  if (r.stato !== 'aperta') throw new Error(`${r.tipo === 'contratto' ? 'Il contratto è stipulato' : r.tipo === 'perizia' ? 'La perizia è approvata' : 'La revisione è consegnata'}: si legge, non si modifica`)
  return { ...l, revisioni: l.revisioni.map((x) => (x.id === id ? f(x) : x)) }
}

/** Un articolo nuovo nell'elenco prezzi della revisione. */
export function aggiungiArticolo(l: Lavoro, revId: string, a: Omit<Articolo, 'id'>): { lavoro: Lavoro; id: string } {
  const id = nuovoId('art')
  return { lavoro: conRevisioneAperta(l, revId, (r) => ({ ...r, articoli: [...r.articoli, { ...a, id }] })), id }
}

/** Cambia un articolo: vale per tutte le voci che lo usano (è l'elenco prezzi). */
export function modificaArticolo(l: Lavoro, revId: string, artId: string, patch: Partial<Omit<Articolo, 'id'>>, nota?: string): Lavoro {
  return conRevisioneAperta(l, revId, (r) => {
    const art = r.articoli.find((a) => a.id === artId)
    if (!art) throw new Error('Articolo non trovato')
    // in perizia i prezzi di contratto restano quelli: si concordano solo i nuovi prezzi
    if (r.tipo === 'perizia' && art.origine !== 'np' && patch.prezzo !== undefined && patch.prezzo !== art.prezzo) {
      throw new Error('In perizia il prezzo di contratto non cambia: un prezzo diverso è un nuovo prezzo (NP)')
    }
    // il prezzo che cambia resta scritto: lo storico, e il listino alla prima modifica
    const cambia = patch.prezzo !== undefined && (patch.prezzo ?? null) !== (art.prezzo ?? null)
    const traccia = cambia ? {
      storico: [...(art.storico || []), { data: oggiIt(), da: art.prezzo ?? null, a: patch.prezzo ?? null, ...(nota ? { nota } : {}) }],
      ...(art.prezzoListino === undefined && art.origine === 'prezzario' ? { prezzoListino: art.prezzo ?? null } : {}),
    } : {}
    return { ...r, articoli: r.articoli.map((a) => (a.id === artId ? { ...a, ...patch, ...traccia } : a)) }
  })
}

/**
 * Toglie un articolo dall'elenco prezzi della revisione aperta. Solo se
 * nessuna voce lo usa: un prezzo che regge una voce non sparisce di nascosto
 * (si toglie prima la voce). Con l'articolo va via il suo prezzo offerto.
 */
export function togliArticolo(l: Lavoro, revId: string, artId: string): Lavoro {
  return conRevisioneAperta(l, revId, (r) => {
    const a = r.articoli.find((x) => x.id === artId)
    if (!a) throw new Error('Articolo non trovato')
    const usi = r.voci.filter((v) => v.articolo === artId).length
    if (usi) throw new Error(`${a.codice || 'L\'articolo'} è usato da ${usi} voc${usi === 1 ? 'e' : 'i'}: togli prima ${usi === 1 ? 'la voce' : 'le voci'}`)
    let contratto = r.contratto
    if (contratto?.prezziOfferti && artId in contratto.prezziOfferti) {
      const { [artId]: _via, ...resto } = contratto.prezziOfferti
      contratto = { ...contratto, prezziOfferti: resto }
    }
    return { ...r, articoli: r.articoli.filter((x) => x.id !== artId), ...(contratto ? { contratto } : {}) }
  })
}

const oggiIt = (): string => { const d = new Date(); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` }

/** Variazione % dei prezzi in blocco (tutti, o gli articoli indicati); la sicurezza resta. */
export function variaPrezzi(l: Lavoro, revId: string, pct: number, o: { articoli?: string[]; nota?: string } = {}): { lavoro: Lavoro; n: number } {
  if (!Number.isFinite(pct) || pct <= -100) throw new Error('Percentuale non valida')
  const r = revisione(l, revId)
  const quali = r.articoli.filter((a) => !a.sicurezza && a.prezzo != null && (!o.articoli || o.articoli.includes(a.id)))
  let x = l
  for (const a of quali) x = modificaArticolo(x, revId, a.id, { prezzo: Math.round(a.prezzo! * (1 + pct / 100) * 100) / 100 }, o.nota || `variazione ${pct > 0 ? '+' : ''}${String(pct).replace('.', ',')}%`)
  return { lavoro: x, n: quali.length }
}

export interface ConfrontoPrezzo { articolo: string; codice: string; descrizione: string; attuale: number | null; nuovo: number; diffPct: number | null }

/** Gli articoli della revisione confrontati con un prezzario, per codice: solo dove il prezzo è diverso. */
export function confrontaConPrezzario(r: Revisione, righe: { codice?: string; prezzo?: number; anno?: string | number }[]): ConfrontoPrezzo[] {
  const per = new Map<string, { prezzo: number; anno: number }>()
  for (const x of righe) {
    const c = String(x.codice ?? '').trim(); if (!c || !(Number(x.prezzo) > 0)) continue
    const p = per.get(c)
    if (!p || Number(x.anno ?? 0) > p.anno) per.set(c, { prezzo: Number(x.prezzo), anno: Number(x.anno ?? 0) })
  }
  const out: ConfrontoPrezzo[] = []
  for (const a of r.articoli) {
    const n = per.get(a.codice.trim()); if (!n || a.sicurezza) continue
    if (a.prezzo != null && Math.abs(a.prezzo - n.prezzo) < 0.005) continue
    out.push({ articolo: a.id, codice: a.codice, descrizione: a.descrizione, attuale: a.prezzo, nuovo: n.prezzo, diffPct: a.prezzo ? Math.round((n.prezzo / a.prezzo - 1) * 10000) / 100 : null })
  }
  return out
}

/** Applica i prezzi scelti dal confronto: ogni cambio entra nello storico. */
export function applicaPrezzario(l: Lavoro, revId: string, scelte: ConfrontoPrezzo[], nota: string): Lavoro {
  return scelte.reduce((x, c) => modificaArticolo(x, revId, c.articolo, { prezzo: c.nuovo }, nota), l)
}

/** L'articolo diventa un NUOVO PREZZO: codice NP.nn, e il codice da cui nasce. */
export function rendiNuovoPrezzo(l: Lavoro, revId: string, artId: string): { lavoro: Lavoro; codice: string } {
  const r = revisione(l, revId)
  const a = r.articoli.find((x) => x.id === artId); if (!a) throw new Error('Articolo non trovato')
  if (a.origine === 'np') return { lavoro: l, codice: a.codice }
  const n = r.articoli.reduce((m, x) => Math.max(m, Number(/^NP[.\s-]?(\d+)/i.exec(x.codice.trim())?.[1]) || 0), 0) + 1
  const codice = `NP.${String(n).padStart(2, '0')}`
  return { lavoro: conRevisioneAperta(l, revId, (rr) => ({ ...rr, articoli: rr.articoli.map((x) => (x.id === artId ? { ...x, codice, origine: 'np' as const, ...(a.codice ? { codiceOrig: a.codice } : {}) } : x)) })), codice }
}

/** Una voce nuova di un articolo, in fondo o dopo una voce data. */
export function aggiungiVoce(l: Lavoro, revId: string, o: { articolo: string; dopo?: string; quantita?: number; categoria?: string }): { lavoro: Lavoro; id: string } {
  const id = nuovoId('voce')
  const lavoro = conRevisioneAperta(l, revId, (r) => {
    if (!r.articoli.some((a) => a.id === o.articolo)) throw new Error('Articolo non trovato')
    const v: Voce = { id, articolo: o.articolo, misure: [], ...(o.quantita != null ? { quantita: o.quantita } : {}), ...(o.categoria ? { categoria: o.categoria } : {}) }
    const i = o.dopo ? r.voci.findIndex((x) => x.id === o.dopo) : -1
    const voci = [...r.voci]
    if (i >= 0) voci.splice(i + 1, 0, v); else voci.push(v)
    return { ...r, voci }
  })
  return { lavoro, id }
}

/** Cambia una voce: misure, quantità, categoria, WBS, a corpo. */
export function modificaVoce(l: Lavoro, revId: string, voceId: string, patch: Partial<Omit<Voce, 'id'>>): Lavoro {
  return conRevisioneAperta(l, revId, (r) => {
    if (!r.voci.some((v) => v.id === voceId)) throw new Error('Voce non trovata')
    // i «vedi voce» seguono: la quantità di una voce può entrare nelle misure di un'altra
    return risolviRichiami({ ...r, voci: r.voci.map((v) => (v.id === voceId ? { ...v, ...copia(patch) } : v)) })
  })
}

/**
 * I «VEDI VOCE» di una revisione: in ogni riga di misura che richiama
 * un'altra voce, L1 è la quantità di quella voce (gli altri fattori la
 * moltiplicano). Si risolve a catena (risolviVediVoce, condiviso).
 */
export function risolviRichiami(r: Revisione): Revisione {
  if (!r.voci.some((v) => v.misure.some((m) => m.vediVoce))) return r
  const voci = copia(r.voci)
  const qty: Record<string, QtyVoce> = Object.fromEntries(voci.map((v) => [v.id, { qty: quantitaVoce(v), misurazioni: v.misure.length ? v.misure : undefined }]))
  risolviVediVoce(qty)
  return { ...r, voci }
}

/** Sposta una voce prima di un'altra (o in fondo): l'ordine manuale del computo. */
export function spostaVoce(l: Lavoro, revId: string, voceId: string, primaDi: string | null): Lavoro {
  return conRevisioneAperta(l, revId, (r) => {
    const v = r.voci.find((x) => x.id === voceId); if (!v) throw new Error('Voce non trovata')
    const resto = r.voci.filter((x) => x.id !== voceId)
    const i = primaDi ? resto.findIndex((x) => x.id === primaDi) : -1
    if (i < 0) return { ...r, voci: [...resto, v] }
    return { ...r, voci: [...resto.slice(0, i), v, ...resto.slice(i)] }
  })
}

/** Toglie una voce; l'articolo resta nell'elenco prezzi. */
export function eliminaVoce(l: Lavoro, revId: string, voceId: string): Lavoro {
  const r0 = revisione(l, revId)
  const chiamanti = r0.voci.filter((v) => v.id !== voceId && v.misure.some((m) => m.vediVoce === voceId))
  if (chiamanti.length) throw new Error(`La voce è richiamata («vedi voce») da ${chiamanti.length} altr${chiamanti.length === 1 ? 'a voce' : 'e voci'}: prima si tolgono i richiami`)
  if (r0.tipo === 'perizia') {
    // quello che è già stato contabilizzato non sparisce: in perizia la voce si porta alla quantità eseguita
    const sal = l.avanzamenti.find((a) => a.stato === 'emesso' && a.righe.some((x) => x.voce === voceId && misurata(x)))
    if (sal) throw new Error(`La voce è già contabilizzata nel SAL n. ${sal.n}: in perizia se ne cambia la quantità, non si toglie`)
  }
  return conRevisioneAperta(l, revId, (r) => ({ ...r, voci: r.voci.filter((v) => v.id !== voceId) }))
}

/** Ripete una voce subito sotto, con le sue misure: lo stesso articolo in un altro punto. */
export function duplicaVoce(l: Lavoro, revId: string, voceId: string): { lavoro: Lavoro; id: string } {
  const id = nuovoId('voce')
  const lavoro = conRevisioneAperta(l, revId, (r) => {
    const i = r.voci.findIndex((v) => v.id === voceId)
    if (i < 0) throw new Error('Voce non trovata')
    const voci = [...r.voci]
    voci.splice(i + 1, 0, { ...copia(r.voci[i]), id })
    return { ...r, voci }
  })
  return { lavoro, id }
}

/**
 * Carica in una revisione aperta delle voci arrivate da fuori (un XPWE): gli
 * articoli con lo stesso codice, unità e prezzo diventano uno solo, come in un
 * elenco prezzi; ogni voce tiene le sue misure.
 */
export function caricaVoci(l: Lavoro, revId: string, righe: { articolo: Omit<Articolo, 'id'>; voce: Omit<Voce, 'id' | 'articolo'> }[]): Lavoro {
  return conRevisioneAperta(l, revId, (r) => {
    const articoli = [...r.articoli]
    const chiave = (a: Omit<Articolo, 'id'>): string => `${a.codice.trim()}|${a.um}|${a.prezzo ?? ''}`
    const perChiave = new Map(articoli.map((a) => [chiave(a), a.id]))
    const voci = [...r.voci]
    for (const x of righe) {
      const k = chiave(x.articolo)
      let artId = x.articolo.codice.trim() ? perChiave.get(k) : undefined
      if (!artId) { artId = nuovoId('art'); articoli.push({ ...x.articolo, id: artId }); perChiave.set(k, artId) }
      voci.push({ ...copia(x.voce), id: nuovoId('voce'), articolo: artId })
    }
    return { ...r, articoli, voci }
  })
}

/** Cambia i dati del lavoro (ente, impresa, CUP…): valgono per tutta la catena. */
export function impostaDati(l: Lavoro, dati: Partial<DatiGenerali>): Lavoro {
  return { ...l, dati: { ...l.dati, ...dati } }
}

/* ── I prezzari del lavoro e le voci che ne vengono ──────────────────────── */

/** Il lavoro ricorda i prezzari da cui ha pescato: sono la sezione ELENCO PREZZI. */
export function registraPrezzario(l: Lavoro, p: Prezzario): Lavoro {
  if (l.prezzari.some((x) => x.id === p.id)) return l
  return { ...l, prezzari: [...l.prezzari, { ...p }] }
}

/**
 * Una voce nuova da un articolo che viene da fuori (un prezzario, un altro
 * lavoro): se nell'elenco della revisione c'è già lo stesso articolo (codice,
 * unità e prezzo) si riusa, altrimenti entra nell'elenco. Restituisce la voce.
 */
export function voceDaArticolo(l: Lavoro, revId: string, a: Omit<Articolo, 'id'>, o: { categoria?: string } = {}): { lavoro: Lavoro; id: string; articolo: string; nuovo: boolean } {
  const r = revisione(l, revId)
  const uguale = a.codice.trim()
    ? r.articoli.find((x) => x.codice.trim() === a.codice.trim() && x.um === a.um && (x.prezzo ?? null) === (a.prezzo ?? null))
    : undefined
  let lavoro = l, artId = uguale?.id
  if (!artId) { const n = aggiungiArticolo(l, revId, a); lavoro = n.lavoro; artId = n.id }
  const v = aggiungiVoce(lavoro, revId, { articolo: artId, ...(o.categoria ? { categoria: o.categoria } : {}) })
  return { lavoro: v.lavoro, id: v.id, articolo: artId, nuovo: !uguale }
}

/** Gli articoli di una revisione con quante voci li usano: l'elenco prezzi a lato. */
export function elencoArticoli(r: Revisione): (Articolo & { usi: number })[] {
  const usi = new Map<string, number>()
  for (const v of r.voci) usi.set(v.articolo, (usi.get(v.articolo) || 0) + 1)
  return r.articoli.map((a) => ({ ...a, usi: usi.get(a.id) || 0 })).sort(cmpArticoli)
}

/** L'ordine dell'elenco prezzi: per codice, in ordine alfanumerico naturale
 *  (A.2 prima di A.10), poi per descrizione; gli articoli senza codice in fondo. */
export function cmpCodici(a: string, b: string): number {
  const x = (a || '').trim(), y = (b || '').trim()
  if (!x !== !y) return x ? -1 : 1
  return x.localeCompare(y, 'it', { numeric: true, sensitivity: 'base' })
}
export const cmpArticoli = (a: Pick<Articolo, 'codice' | 'descrizione'>, b: Pick<Articolo, 'codice' | 'descrizione'>): number =>
  cmpCodici(a.codice, b.codice) || (a.descrizione || '').localeCompare(b.descrizione || '', 'it', { sensitivity: 'base' })

/* ── Le misure di un avanzamento (SAL, SAL finale) ───────────────────────
   Si misura l'ESEGUITO A TUTTO IL SAL, voce per voce del contratto (o della
   perizia vigente): misure di dettaglio, una quantità scritta, o per i lavori
   a corpo la quota eseguita in %. Si scrive solo in un avanzamento in bozza. */

/** Le misure di una voce in un avanzamento (vuota se la voce non è ancora stata misurata). */
export function rigaDi(a: Avanzamento, voceId: string): RigaAvanzamento {
  return a.righe.find((r) => r.voce === voceId) ?? { voce: voceId, misure: [] }
}

/** L'eseguito a tutto il SAL di una riga: le misure, o la quantità scritta. */
export function quantitaEseguita(r: Pick<RigaAvanzamento, 'misure' | 'quantita'>): number {
  return r.misure && r.misure.length ? sommaMisurazioni(r.misure) : (r.quantita ?? 0)
}

/** Una riga è misurata se ha qualcosa: misure, quantità o quota. */
export const misurata = (r: RigaAvanzamento): boolean => r.misure.length > 0 || (r.quantita ?? 0) !== 0 || (r.quotaPct ?? 0) !== 0

/** Cambia le misure di una voce in un avanzamento in bozza (la riga nasce se non c'era). */
export function modificaRigaAvanzamento(l: Lavoro, avId: string, voceId: string, patch: Partial<Omit<RigaAvanzamento, 'voce'>>): Lavoro {
  const a = avanzamento(l, avId)
  if (a.tipo === 'cre') throw new Error('Il CRE certifica lo stato finale: le misure si cambiano nel SAL finale')
  if (a.stato !== 'bozza') throw new Error(`Il ${a.tipo === 'sal' ? `SAL n. ${a.n}` : a.tipo === 'salFinale' ? 'SAL finale' : 'CRE'} è emesso: si legge, non si modifica`)
  const v = revisione(l, a.leggeDa).voci.find((x) => x.id === voceId)
  if (!v) throw new Error('La voce non è nel contratto')
  if (patch.quotaPct != null && (patch.quotaPct < 0 || patch.quotaPct > 100)) throw new Error('La quota va da 0 a 100%')
  const nuova: RigaAvanzamento = { ...rigaDi(a, voceId), ...copia(patch), voce: voceId }
  const righe = a.righe.some((r) => r.voce === voceId) ? a.righe.map((r) => (r.voce === voceId ? nuova : r)) : [...a.righe, nuova]
  return { ...l, avanzamenti: l.avanzamenti.map((x) => (x.id === avId ? { ...x, righe } : x)) }
}

/** Il contratto da cui viene il ribasso (le perizie non lo cambiano). */
function ribassoDi(l: Lavoro): number {
  return contratto(l)?.contratto?.ribassoPct ?? 0
}

/**
 * Il ribasso che si applica a un articolo, in % (0 = nessuno):
 *  - la sicurezza mai;
 *  - offerta a RIBASSO UNICO: il ribasso del contratto, salvo l'articolo
 *    segnato «non soggetto» (soggettoRibasso === false);
 *  - offerta a PREZZI UNITARI: nessuno (il prezzo offerto è già quello di
 *    contratto, il NP vale il prezzo concordato), salvo l'articolo senza
 *    prezzo offerto segnato «soggetto»: allora il ribasso che risulta
 *    dall'offerta.
 */
export function ribassoArticolo(c: Revisione | null, r: Revisione, a: Articolo): number {
  if (!c || a.sicurezza) return 0
  if (c.contratto?.prezziOfferti) {
    if (r.contratto?.prezziOfferti?.[a.id] != null) return 0
    return a.soggettoRibasso === true ? (ribassoRisultante(c) ?? 0) : 0
  }
  return a.soggettoRibasso === false ? 0 : (c.contratto?.ribassoPct ?? 0)
}

/** Con i prezzi offerti: il ribasso che risulta sugli articoli offerti (prezzi offerti su prezzi di progetto). */
export function ribassoRisultante(c: Revisione): number | null {
  const off = c.contratto?.prezziOfferti
  if (!off) return null
  const art = new Map(c.articoli.map((a) => [a.id, a]))
  let progetto = 0, offerto = 0
  for (const v of c.voci) {
    const a = art.get(v.articolo)
    if (!a || a.sicurezza || off[a.id] == null) continue
    const q = quantitaVoce(v)
    progetto += importoQta(q, a.prezzo ?? 0, a.um)
    offerto += importoQta(q, off[a.id], a.um)
  }
  return progetto ? r2((1 - offerto / progetto) * 100) : null
}

/** Tutti i nuovi prezzi (NP e analisi) di una revisione aperta: soggetti, non soggetti, o come da contratto (undefined). */
export function impostaRibassoNp(l: Lavoro, revId: string, soggetto: boolean | undefined): Lavoro {
  return conRevisioneAperta(l, revId, (r) => ({
    ...r,
    articoli: r.articoli.map((a) => (a.origine === 'np' || a.origine === 'analisi'
      ? (({ soggettoRibasso: _s, ...resto }) => (soggetto == null ? resto : { ...resto, soggettoRibasso: soggetto }))(a)
      : a)),
  }))
}

export interface ImportiAvanzamento {
  /** A tutto il SAL, ai prezzi di contratto (lordo): lavori e sicurezza. */
  lavori: number
  sicurezza: number
  /** Lavori in economia a tutto il SAL (liste settimanali, non ribassati). */
  economia: number
  /** Detrazioni a tutto il SAL. */
  detrazioni: number
  lordo: number
  ribassoPct: number
  /** A tutto il SAL, al netto del ribasso (la sicurezza non lo subisce). */
  netto: number
  /** Il netto dell'avanzamento prima (0 se è il primo). */
  precedente: number
  /** Quello che matura in questo SAL, al netto del ribasso. */
  questo: number
  /** Gli stessi, lordi (ai prezzi di contratto, prima del ribasso). */
  precedenteLordo: number
  questoLordo: number
  /** Voci misurate su quante ne ha il contratto. */
  misurate: number
  voci: number
}

const r2 = (n: number): number => Math.round(n * 100) / 100

function totaliA(l: Lavoro, a: Avanzamento): { lavori: number; sicurezza: number; netto: number; misurate: number; voci: number } {
  const r = revisione(l, a.leggeDa)
  const c = contratto(l)
  const art = new Map(r.articoli.map((x) => [x.id, x]))
  let lavori = 0, sicurezza = 0, netto = 0, misurate = 0
  for (const v of r.voci) {
    const ar = art.get(v.articolo); if (!ar) continue
    const riga = a.righe.find((x) => x.voce === v.id)
    if (!riga || !misurata(riga)) continue
    misurate++
    const imp = v.corpo
      ? importoQta(quantitaVoce(v), prezzoIn(r, ar), ar.um) * (riga.quotaPct ?? 0) / 100
      : importoQta(quantitaEseguita(riga), prezzoIn(r, ar), ar.um)
    if (ar.sicurezza) sicurezza += imp; else lavori += imp
    netto += imp * (1 - ribassoArticolo(c, r, ar) / 100)
  }
  return { lavori: r2(lavori), sicurezza: r2(sicurezza), netto: r2(netto), misurate, voci: r.voci.length }
}

/**
 * Gli importi di un avanzamento: a tutto il SAL, lordi e al netto del ribasso,
 * e quello che matura in QUESTO SAL (il netto meno quello del SAL prima). Il
 * ribasso è quello del contratto, una volta sola; con i prezzi offerti è già
 * nei prezzi e qui vale zero. La sicurezza non lo subisce mai.
 */
export function importiAvanzamento(l: Lavoro, avId: string): ImportiAvanzamento {
  const a = avanzamento(l, avId)
  const rib = contratto(l)?.contratto?.prezziOfferti ? 0 : ribassoDi(l)
  // il netto si fa voce per voce: un NP può essere non soggetto a ribasso
  const netto = (t: { netto: number }): number => t.netto
  const t = totaliA(l, a)
  const prima = l.avanzamenti.filter((x) => x.tipo !== 'cre' && x.ordine < a.ordine).sort((x, y) => x.ordine - y.ordine).pop()
  const tp = prima ? totaliA(l, prima) : null
  // i lavori in economia (liste settimanali) entrano nel SAL di competenza, senza ribasso
  const eco = economiaATuttoSal(l, a.tipo === 'cre' ? (l.avanzamenti.find((x) => x.tipo === 'salFinale')?.n ?? a.n) : a.n)
  const ecoPrima = prima ? economiaATuttoSal(l, prima.n) : 0
  const precedente = tp ? r2(netto(tp) + ecoPrima - (prima?.detrazioni || 0)) : 0
  const precedenteLordo = tp ? r2(tp.lavori + tp.sicurezza + ecoPrima) : 0
  // le detrazioni (progressive) si tolgono dal contabilizzato, come nel certificato
  const det = a.tipo === 'cre' ? (l.avanzamenti.find((x) => x.tipo === 'salFinale')?.detrazioni || 0) : (a.detrazioni || 0)
  const n = r2(netto(t) + eco - det)
  const lordo = r2(t.lavori + t.sicurezza + eco)
  return {
    lavori: t.lavori, sicurezza: t.sicurezza, economia: eco, detrazioni: det, lordo, ribassoPct: rib, netto: n, precedente, questo: r2(n - precedente),
    precedenteLordo, questoLordo: r2(lordo - precedenteLordo), misurate: t.misurate, voci: t.voci,
  }
}

/** Gli importi di un contratto: base d'asta, sicurezza, importo contrattuale. */
/**
 * Una contabilità DA ZERO: un contratto a misura senza computo, in vigore
 * subito. L'elenco prezzi si fa misurando (voceNelContrattoLibero).
 */
export function nuovaContabilitaLibera(l: Lavoro, o: { data: string; numero?: number; ribassoPct?: number; importoPattuito?: number | null }): { lavoro: Lavoro; id: string } {
  if (contratto(l)) throw new Error("Il contratto c'è già")
  if (o.ribassoPct != null && !(o.ribassoPct >= 0 && o.ribassoPct < 100)) throw new Error('Il ribasso va da 0 a meno di 100')
  const numero = o.numero ?? numeroProposto(l)
  controllaNumero(l, numero, l.prossimoOrdine)
  const id = nuovoId('rev')
  const r: Revisione = {
    id, tipo: 'contratto', numero, data: o.data, stato: 'chiusa', chiusaIl: o.data, ordine: l.prossimoOrdine, nome: 'Contratto a misura',
    articoli: [], voci: [],
    contratto: { libero: true, ...(o.ribassoPct ? { ribassoPct: o.ribassoPct } : {}), ...(o.importoPattuito ? { importoPattuito: o.importoPattuito } : {}) },
  }
  return { lavoro: { ...l, revisioni: [...l.revisioni, r], prossimoOrdine: l.prossimoOrdine + 1 }, id }
}

/**
 * Nel contratto a misura libera, un articolo misurato in un SAL in bozza entra
 * nell'elenco del contratto (lo stesso codice, unità e prezzo si riusa) con
 * una voce senza quantità di contratto. Restituisce la voce.
 */
export function voceNelContrattoLibero(l: Lavoro, avId: string, art: Omit<Articolo, 'id'>, o: { categoria?: string } = {}): { lavoro: Lavoro; voce: string; nuovo: boolean } {
  const a = avanzamento(l, avId)
  if (a.stato !== 'bozza') throw new Error('Il SAL è emesso: si legge, non si modifica')
  const r = revisione(l, a.leggeDa)
  if (!contratto(l)?.contratto?.libero) throw new Error('Si aggiunge al contratto solo senza computo: con un computo, un prezzo nuovo è una perizia')
  const uguale = art.codice.trim() ? r.articoli.find((x) => x.codice.trim() === art.codice.trim() && x.um === art.um && (x.prezzo ?? null) === (art.prezzo ?? null)) : undefined
  const artId = uguale?.id ?? nuovoId('art')
  // se l'articolo c'è già con una voce, si misura quella
  const gia = uguale ? r.voci.find((v) => v.articolo === uguale.id && (v.categoria || '') === (o.categoria || '')) : undefined
  if (gia) return { lavoro: l, voce: gia.id, nuovo: false }
  const voce: Voce = { id: nuovoId('voce'), articolo: artId, misure: [], ...(o.categoria ? { categoria: o.categoria } : {}) }
  const revisioni = l.revisioni.map((x) => (x.id === r.id ? { ...x, articoli: uguale ? x.articoli : [...x.articoli, { ...art, id: artId }], voci: [...x.voci, voce] } : x))
  return { lavoro: { ...l, revisioni }, voce: voce.id, nuovo: !uguale }
}

export function importiContratto(r: Revisione): { baseAsta: number; sicurezza: number; ribassoPct: number | null; ribassoRisultante: number | null; contrattuale: number } {
  // la base d'asta è ai prezzi di PROGETTO; l'importo offerto, ai prezzi di contratto
  // senza computo il riferimento è l'importo pattuito (se c'è)
  if (r.contratto?.libero) {
    const p = r.contratto.importoPattuito ?? 0
    const rib = r.contratto.ribassoPct ?? 0
    return { baseAsta: p, sicurezza: 0, ribassoPct: rib, ribassoRisultante: null, contrattuale: r2(p * (1 - rib / 100)) }
  }
  const progetto = importiRevisione({ ...r, contratto: undefined })
  const imp = importiRevisione(r)
  const off = !!r.contratto?.prezziOfferti
  const rib = off ? null : (r.contratto?.ribassoPct ?? 0)
  // l'importo contrattuale voce per voce: ogni articolo col suo ribasso
  const art = new Map(r.articoli.map((a) => [a.id, a]))
  let contrattuale = 0
  for (const v of r.voci) {
    const a = art.get(v.articolo); if (!a) continue
    contrattuale += importoQta(quantitaVoce(v), prezzoIn(r, a), a.um) * (1 - ribassoArticolo(r, r, a) / 100)
  }
  return {
    baseAsta: progetto.lavori, sicurezza: imp.sicurezza, ribassoPct: rib,
    /** Con i prezzi offerti, il ribasso che ne risulta sulla base d'asta (si dichiara, non si applica). */
    ribassoRisultante: off ? ribassoRisultante(r) : null,
    contrattuale: r2(contrattuale),
  }
}

/**
 * L'offerta del contratto (ribasso o prezzi offerti) si corregge finché nessun
 * SAL è stato emesso: dopo, i SAL emessi ne dipendono.
 */
export function offertaModificabile(l: Lavoro): boolean {
  return !!contratto(l) && !l.avanzamenti.some((a) => a.stato === 'emesso')
}
function conOfferta(l: Lavoro, id: string, f: (c: NonNullable<Revisione['contratto']>, r: Revisione) => NonNullable<Revisione['contratto']>): Lavoro {
  const r = revisione(l, id)
  if (r.tipo !== 'contratto') throw new Error("L'offerta è del contratto")
  if (!offertaModificabile(l)) throw new Error("C'è già un SAL emesso: l'offerta del contratto non si cambia più")
  return { ...l, revisioni: l.revisioni.map((x) => (x.id === id ? { ...x, contratto: f({ ...(x.contratto || {}) }, x) } : x)) }
}

/** Offerta a ribasso: il ribasso %, e via i prezzi offerti. */
export function impostaRibasso(l: Lavoro, id: string, ribassoPct: number): Lavoro {
  if (!(ribassoPct >= 0 && ribassoPct < 100)) throw new Error('Il ribasso va da 0 a meno di 100')
  return conOfferta(l, id, (c) => { const { prezziOfferti: _p, ...resto } = c; return { ...resto, ribassoPct } })
}

/** Offerta a prezzi unitari: si passa ai prezzi offerti (vuoti), e via il ribasso. */
export function impostaPrezziUnitari(l: Lavoro, id: string): Lavoro {
  return conOfferta(l, id, (c) => { const { ribassoPct: _r, ...resto } = c; return { ...resto, prezziOfferti: { ...(c.prezziOfferti || {}) } } })
}

/** Il prezzo offerto di un articolo (null lo toglie: vale il prezzo di progetto). La sicurezza non si offre. */
export function impostaPrezzoOfferto(l: Lavoro, id: string, artId: string, prezzo: number | null): Lavoro {
  if (prezzo != null && !(prezzo >= 0)) throw new Error('Prezzo non valido')
  return conOfferta(l, id, (c, r) => {
    const a = r.articoli.find((x) => x.id === artId)
    if (!a) throw new Error('Articolo non trovato')
    if (a.sicurezza) throw new Error('Gli oneri della sicurezza non sono soggetti a offerta')
    const off = { ...(c.prezziOfferti || {}) }
    if (prezzo == null) delete off[artId]; else off[artId] = prezzo
    const { ribassoPct: _r, ...resto } = c
    return { ...resto, prezziOfferti: off }
  })
}

/* ── La perizia di variante: il confronto col contratto vigente ──────────── */

export interface ImportiPerizia {
  /** Voci che la perizia cambia: importo diverso, nuove, tolte. */
  variate: number
  voci: number
  /** Maggiori e minori lavori sul vigente, al netto del ribasso. */
  aumenti: number
  diminuzioni: number
  /** Netto del contratto vigente (contratto o perizia prima) e con questa perizia. */
  prima: number
  dopo: number
  differenza: number
  /** Netto del contratto originario e variazione rispetto a esso, in %. */
  originario: number
  variazionePct: number | null
  /** Oltre il quinto d'obbligo (art. 120 c. 9 d.lgs. 36/2023): serve l'atto di sottomissione. */
  oltreQuinto: boolean
  /** Le voci variate per id, con il loro importo prima e dopo. */
  perVoce: Map<string, { prima: number; dopo: number; qPrima: number | null }>
  /**
   * Gli stessi importi LORDI: ai prezzi di progetto e ai nuovi prezzi, prima del
   * ribasso, come si consegna la perizia (con i prezzi offerti, ai prezzi offerti).
   * Il ribasso si applica a parte, ai lavori e ai NP, mai alla sicurezza.
   */
  lordo: { prima: number; dopo: number; differenza: number; aumenti: number; diminuzioni: number }
  ribassoPct: number
}

/** Il netto di ogni voce di una revisione (lavori ribassati, sicurezza no). */
function nettoPerVoce(r: Revisione, c: Revisione): Map<string, { imp: number; lordo: number; q: number }> {
  const art = new Map(r.articoli.map((a) => [a.id, a]))
  const out = new Map<string, { imp: number; lordo: number; q: number }>()
  for (const v of r.voci) {
    const a = art.get(v.articolo); if (!a) continue
    const q = quantitaVoce(v)
    const lordo = importoQta(q, prezzoIn(r, a), a.um)
    out.set(v.id, { imp: lordo * (1 - ribassoArticolo(c, r, a) / 100), lordo, q })
  }
  return out
}

/**
 * Gli importi di una perizia, al netto del ribasso di contratto: quanto cambia
 * sul vigente (la revisione da cui è copiata) e sull'originario, voce per voce.
 */
export function importiPerizia(l: Lavoro, id: string): ImportiPerizia {
  const r = revisione(l, id)
  const c = contratto(l)
  const prec = r.da ? revisione(l, r.da) : c
  if (!prec || !c) throw new Error('Una perizia cambia un contratto')
  const rib = c.contratto?.prezziOfferti ? 0 : (c.contratto?.ribassoPct ?? 0)
  const a = nettoPerVoce(prec, c), b = nettoPerVoce(r, c)
  const perVoce = new Map<string, { prima: number; dopo: number; qPrima: number | null }>()
  let aumenti = 0, diminuzioni = 0, aumentiL = 0, diminuzioniL = 0
  for (const k of new Set([...a.keys(), ...b.keys()])) {
    const pa = a.get(k)?.imp ?? 0, pb = b.get(k)?.imp ?? 0
    const la = a.get(k)?.lordo ?? 0, lb = b.get(k)?.lordo ?? 0
    if (Math.abs(lb - la) < 0.005 && a.has(k) === b.has(k)) continue
    perVoce.set(k, { prima: r2(pa), dopo: r2(pb), qPrima: a.get(k)?.q ?? null })
    if (pb > pa) aumenti += pb - pa; else diminuzioni += pa - pb
    if (lb > la) aumentiL += lb - la; else diminuzioniL += la - lb
  }
  const somma = (m: Map<string, { imp: number }>): number => r2([...m.values()].reduce((t, x) => t + x.imp, 0))
  const sommaL = (m: Map<string, { lordo: number }>): number => r2([...m.values()].reduce((t, x) => t + x.lordo, 0))
  const primaL = sommaL(a), dopoL = sommaL(b)
  const prima = somma(a), dopo = somma(b), originario = somma(nettoPerVoce(c, c))
  return {
    variate: perVoce.size, voci: r.voci.length, aumenti: r2(aumenti), diminuzioni: r2(diminuzioni),
    prima, dopo, differenza: r2(dopo - prima), originario,
    variazionePct: originario ? r2((dopo - originario) / originario * 100) : null,
    oltreQuinto: originario > 0 && Math.abs(dopo - originario) > originario / 5 + 0.005,
    perVoce,
    lordo: { prima: primaL, dopo: dopoL, differenza: r2(dopoL - primaL), aumenti: r2(aumentiL), diminuzioni: r2(diminuzioniL) },
    ribassoPct: rib,
  }
}

/* ── Il conto finale (CRE) ───────────────────────────────────────────────── */

export interface ContoFinale {
  /** Lo stato finale, a tutto il SAL finale: lordo, sicurezza e netto del ribasso. */
  lordo: number
  sicurezza: number
  netto: number
  /** Già nei SAL prima del finale. */
  neiSal: number
  /** Quello che resta all'impresa (prima delle ritenute, che vengono con le stampe). */
  credito: number
}

export function contoFinale(l: Lavoro): ContoFinale | null {
  const fin = l.avanzamenti.find((a) => a.tipo === 'salFinale')
  if (!fin) return null
  const i = importiAvanzamento(l, fin.id)
  return { lordo: i.lordo, sicurezza: i.sicurezza, netto: i.netto, neiSal: i.precedente, credito: i.questo }
}

/**
 * Le voci di un avanzamento il cui eseguito supera la quantità di contratto
 * (della revisione da cui legge: il contratto, o la perizia vigente). Come in
 * nei programmi di contabilità si possono contabilizzare, ma la quantità si ridetermina solo con una
 * perizia: la schermata le mostra in blu, l'emissione le elenca.
 */
export function vociEccedenti(l: Lavoro, a: Avanzamento): { voce: string; codice: string; descrizione: string; um: string; contratto: number; eseguito: number }[] {
  const r = revisione(l, a.leggeDa)
  // senza computo non c'è una quantità di contratto da superare
  if (contratto(l)?.contratto?.libero) return []
  const art = new Map(r.articoli.map((x) => [x.id, x]))
  const out: { voce: string; codice: string; descrizione: string; um: string; contratto: number; eseguito: number }[] = []
  for (const v of r.voci) {
    const ar = art.get(v.articolo); if (!ar || v.corpo) continue
    const riga = a.righe.find((x) => x.voce === v.id); if (!riga) continue
    const eseguito = quantitaEseguita(riga), contrattoQ = quantitaVoce(v)
    if (eseguito > contrattoQ + 1e-9) out.push({ voce: v.id, codice: ar.codice, descrizione: ar.descrizione, um: ar.um, contratto: r2(contrattoQ), eseguito: r2(eseguito) })
  }
  return out
}

/** Il quadro economico di una revisione (un allegato: si scrive anche a revisione consegnata). */
export function impostaQE(l: Lavoro, revId: string, qe: QuadroEconomico): Lavoro {
  revisione(l, revId)
  return { ...l, revisioni: l.revisioni.map((x) => (x.id === revId ? { ...x, qe } : x)) }
}

/** Le offerte di gara su una revisione (un allegato: si scrivono anche a revisione consegnata). */
export function impostaOfferte(l: Lavoro, revId: string, offerte: Offerta[]): Lavoro {
  revisione(l, revId)
  return { ...l, revisioni: l.revisioni.map((x) => (x.id === revId ? { ...x, offerte } : x)) }
}

/** Firma l'avanzamento emesso con la sua impronta (calcolata da chi chiama: è asincrona). */
export function firmaAvanzamento(l: Lavoro, id: string, impronta: string, ts = Date.now()): Lavoro {
  const a = avanzamento(l, id)
  if (a.stato !== 'emesso') throw new Error('Si firma un avanzamento emesso')
  return { ...l, avanzamenti: l.avanzamenti.map((x) => (x.id === id ? { ...x, impronta, improntaTs: ts } : x)) }
}

/** I dati di un avanzamento in bozza: detrazioni e note. */
export function datiAvanzamento(l: Lavoro, id: string, patch: { detrazioni?: number; note?: string }): Lavoro {
  const a = avanzamento(l, id)
  if (a.stato !== 'bozza') throw new Error('Il SAL è emesso: si legge, non si modifica')
  if (patch.detrazioni != null && !(patch.detrazioni >= 0)) throw new Error('Le detrazioni sono un importo positivo')
  return { ...l, avanzamenti: l.avanzamenti.map((x) => (x.id === id ? { ...x, ...patch } : x)) }
}

/* ── Il sotto-computo dei lavori a corpo ─────────────────────────────── */

const imp2 = (q: number, p: number): number => Math.round(q * p * 100) / 100

/** Totale di progetto del sotto-computo: la base su cui si misura la quota. */
export const totaleSotto = (v: Pick<Voce, 'sottoComputo'>): number =>
  r2((v.sottoComputo || []).reduce((t, x) => t + imp2(x.qty || 0, x.prezzo || 0), 0))

/** La quota % del corpo che discende dall'eseguito delle lavorazioni (null senza sotto-computo). */
export function quotaDaSotto(v: Pick<Voce, 'sottoComputo'>, riga?: Pick<RigaAvanzamento, 'sotto'>): number | null {
  const tot = totaleSotto(v)
  if (!(v.sottoComputo || []).length || tot <= 0) return null
  const eseg = (v.sottoComputo || []).reduce((t, x) => {
    const a = riga?.sotto?.find((y) => y.voceId === x.id)
    const q = a?.misure?.length ? sommaMisurazioni(a.misure) : (a?.quantita ?? 0)
    return t + imp2(q, x.prezzo || 0)
  }, 0)
  return r2(eseg / tot * 100)
}

/** Il sotto-computo di un corpo è congelato quando un SAL emesso lo ha usato. */
export function sottoCongelato(l: Lavoro, voceId: string): boolean {
  return l.avanzamenti.some((a) => a.stato === 'emesso' && a.righe.some((r) => r.voce === voceId && (r.sotto?.length || r.quotaPct != null)))
}

/** Cambia il sotto-computo di una voce a corpo (revisione aperta, sotto-computo non congelato). */
export function impostaSottoComputo(l: Lavoro, revId: string, voceId: string, sotto: VoceSotto[]): Lavoro {
  const v = revisione(l, revId).voci.find((x) => x.id === voceId)
  if (!v) throw new Error('Voce non trovata')
  if (!v.corpo) throw new Error('Il sotto-computo è dei lavori a corpo')
  if (sottoCongelato(l, voceId)) throw new Error('Il sotto-computo è già servito a un SAL emesso: non si cambia più')
  return conRevisioneAperta(l, revId, (r) => ({ ...r, voci: r.voci.map((x) => (x.id === voceId ? { ...x, sottoComputo: copia(sotto) } : x)) }))
}

/** L'eseguito di una lavorazione del sotto-computo nel SAL in bozza: la quota del corpo si ricalcola. */
export function eseguitoSotto(l: Lavoro, avId: string, voceId: string, voceSottoId: string, quantita: number | null): Lavoro {
  const a = avanzamento(l, avId)
  const v = revisione(l, a.leggeDa).voci.find((x) => x.id === voceId)
  if (!v?.sottoComputo?.some((x) => x.id === voceSottoId)) throw new Error('Lavorazione non trovata nel sotto-computo')
  const riga = rigaDi(a, voceId)
  const sotto = [...(riga.sotto || []).filter((x) => x.voceId !== voceSottoId), ...(quantita != null ? [{ voceId: voceSottoId, quantita }] : [])]
  const quota = quotaDaSotto(v, { sotto })
  return modificaRigaAvanzamento(l, avId, voceId, { sotto, quotaPct: quota ?? undefined })
}

/* ── La struttura: categorie e WBS ─────────────────────────────────────── */

export const strutturaDi = (r: Revisione): StrutturaRevisione => ({ dichiarate: [], wbsNodi: {}, ...(r.struttura ? copia(r.struttura) : {}) })

/**
 * Cambia la struttura di una revisione aperta: le funzioni condivise
 * (struttura-computo.ts) lavorano su mappe voce → categoria e voce → WBS e
 * sulle parti dichiarate; qui si scrivono indietro sulle voci.
 */
export function cambiaStruttura(l: Lavoro, revId: string, f: (x: { categoria: Record<string, string | undefined>; wbs: Record<string, string | undefined>; s: StrutturaRevisione; ordine: string[] }) => void): Lavoro {
  return conRevisioneAperta(l, revId, (r) => {
    const categoria: Record<string, string | undefined> = Object.fromEntries(r.voci.map((v) => [v.id, v.categoria]))
    const wbs: Record<string, string | undefined> = Object.fromEntries(r.voci.map((v) => [v.id, v.wbs]))
    const st = strutturaDi(r)
    const x = { categoria, wbs, s: st, ordine: r.voci.map((v) => v.id) }
    f(x)
    const pos = new Map(x.ordine.map((k, i) => [k, i]))
    const voci = r.voci.map((v) => {
      const c = x.categoria[v.id], w = x.wbs[v.id]
      const { categoria: _c, wbs: _w, ...resto } = v
      return { ...resto, ...(c ? { categoria: c } : {}), ...(w ? { wbs: w } : {}) }
    }).sort((a, b) => (pos.get(a.id) ?? 0) - (pos.get(b.id) ?? 0))
    return { ...r, voci, struttura: x.s }
  })
}

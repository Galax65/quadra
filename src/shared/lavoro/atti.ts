/**
 * GLI ATTI DEL CANTIERE di un lavoro: giornale dei lavori, verbali e ordini di
 * servizio, riserve, liste in economia (D.M. 49/2018; All. II.14 D.Lgs. 36/2023).
 * Sono atti datati che vivono accanto alla contabilità: il giornale li richiama,
 * il conto finale li elenca, lo scadenziario ne conta i termini.
 *
 * NIENTE DOPPIONI: i verbali di consegna, sospensione, ripresa, proroga e
 * ultimazione NON si scrivono qui. Nascono dai dati di «Contratto, tempi e
 * pagamenti» (contabilita.ts): la data della sospensione si scrive una volta
 * sola, e il verbale, il termine vigente e lo scadenziario la leggono tutti da
 * lì. Qui si scrivono gli atti che non hanno altro posto: gli ordini di
 * servizio, i processi verbali di accertamento, le relazioni al RUP.
 */
import { nuovoId, type Lavoro } from './modello'
import { datiContabilita } from './contabilita'

export interface RigaGiornale {
  id: string
  data: string
  meteo?: string
  manodopera?: string
  mezzi?: string
  lavorazioni?: string
  note?: string
}

/** I tipi di atto che si scrivono a mano. */
export type TipoAttoLibero = 'ordine' | 'accertamento' | 'relazioneRup'
/** Tutti i tipi di verbale (quelli dei tempi si ricavano). */
export type TipoVerbale = TipoAttoLibero | 'consegna' | 'sospensione' | 'ripresa' | 'proroga' | 'ultimazione'

export interface AttoLibero {
  id: string
  tipo: TipoAttoLibero
  data: string
  numero: number
  oggetto?: string
  testo?: string
}

export interface Verbale {
  id: string
  tipo: TipoVerbale
  data?: string
  numero?: number
  oggetto?: string
  testo?: string
  motivo?: string
  giorniProroga?: number | null
  /** Ricavato dai tempi: si cambia lì, non qui. */
  ricavato?: boolean
}

export type EsitoRiserva = 'aperta' | 'definita' | 'rinunciata' | 'decaduta'

export interface Riserva {
  id: string
  numero: number
  /** Iscrizione (fa decorrere i 15 giorni per l'esplicitazione). */
  data?: string
  salNumero?: number
  oggetto: string
  importo?: number | null
  attoIscrizione?: string
  dataEsplicitazione?: string
  esplicitazione?: string
  controdeduzioni?: string
  confermataContoFinale?: boolean
  esito?: EsitoRiserva
  notaEsito?: string
}

export interface RigaOperaio { qualifica?: string; nominativo?: string; ore?: number | null; tariffaOraria?: number | null; lavorazione?: string }
export interface RigaMezzo { descrizione: string; ore?: number | null; tariffaOraria?: number | null }
export interface RigaProvvista { descrizione: string; um?: string; quantita?: number | null; prezzoUnitario?: number | null }

export interface ListaEconomia {
  id: string
  numero: number
  /** Settimana di riferimento. */
  data: string
  /** SAL di competenza: la lista entra nella contabilità di quel SAL. */
  salNumero?: number
  ordineRef?: string
  operai: RigaOperaio[]
  mezzi: RigaMezzo[]
  provviste: RigaProvvista[]
  note?: string
}

/** Un atto prodotto (stampato da una tappa chiusa): il registro degli atti. */
export interface Consegna {
  id: string
  tipo: string
  label: string
  data: string
  salNumero?: number
  ts: number
  /** Impronta del documento come è stato prodotto (SHA-256 del suo HTML). */
  impronta?: string
}

export interface Atti {
  giornale: RigaGiornale[]
  liberi: AttoLibero[]
  riserve: Riserva[]
  economie: ListaEconomia[]
  consegne: Consegna[]
}

export const nuoviAtti = (): Atti => ({ giornale: [], liberi: [], riserve: [], economie: [], consegne: [] })
export const attiDi = (l: Lavoro): Atti => ({ ...nuoviAtti(), ...(l.atti || {}) })
const conAtti = (l: Lavoro, f: (a: Atti) => Partial<Atti>): Lavoro => ({ ...l, atti: { ...attiDi(l), ...f(attiDi(l)) } })

const dataValida = (d?: string): boolean => !!d && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(d)
const giorno = (d?: string): number => {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(d || '')
  return m ? Date.UTC(+m[3], +m[2] - 1, +m[1]) : Number.MAX_SAFE_INTEGER
}
const perData = <T extends { data?: string }>(a: T, b: T): number => giorno(a.data) - giorno(b.data)

/* ── Il giornale ──────────────────────────────────────────────────────── */

export function aggiungiGiorno(l: Lavoro, r: Omit<RigaGiornale, 'id'>): { lavoro: Lavoro; id: string } {
  if (!dataValida(r.data)) throw new Error('Data non valida: gg/mm/aaaa')
  if (attiDi(l).giornale.some((x) => x.data === r.data)) throw new Error(`Il giorno ${r.data} c'è già nel giornale`)
  const id = nuovoId('gio')
  return { lavoro: conAtti(l, (a) => ({ giornale: [...a.giornale, { ...r, id }].sort(perData) })), id }
}
export function modificaGiorno(l: Lavoro, id: string, patch: Partial<Omit<RigaGiornale, 'id'>>): Lavoro {
  if (patch.data != null && !dataValida(patch.data)) throw new Error('Data non valida: gg/mm/aaaa')
  return conAtti(l, (a) => ({ giornale: a.giornale.map((x) => (x.id === id ? { ...x, ...patch } : x)).sort(perData) }))
}
export const togliGiorno = (l: Lavoro, id: string): Lavoro => conAtti(l, (a) => ({ giornale: a.giornale.filter((x) => x.id !== id) }))

/* ── I verbali: quelli liberi, e quelli che vengono dai tempi ─────────── */

export function aggiungiAtto(l: Lavoro, tipo: TipoAttoLibero, data: string, o: { oggetto?: string; testo?: string } = {}): { lavoro: Lavoro; id: string } {
  if (!dataValida(data)) throw new Error('Data non valida: gg/mm/aaaa')
  const numero = attiDi(l).liberi.filter((x) => x.tipo === tipo).reduce((n, x) => Math.max(n, x.numero), 0) + 1
  const id = nuovoId('atto')
  return { lavoro: conAtti(l, (a) => ({ liberi: [...a.liberi, { id, tipo, data, numero, ...o }] })), id }
}
export function modificaAtto(l: Lavoro, id: string, patch: Partial<Omit<AttoLibero, 'id' | 'tipo'>>): Lavoro {
  if (patch.data != null && !dataValida(patch.data)) throw new Error('Data non valida: gg/mm/aaaa')
  return conAtti(l, (a) => ({ liberi: a.liberi.map((x) => (x.id === id ? { ...x, ...patch } : x)) }))
}
export const togliAtto = (l: Lavoro, id: string): Lavoro => conAtti(l, (a) => ({ liberi: a.liberi.filter((x) => x.id !== id) }))

/**
 * Tutti i verbali del lavoro, in ordine di data: quelli ricavati dai tempi
 * (consegna, sospensioni e riprese, proroghe, ultimazione) e quelli scritti.
 */
export function verbaliDi(l: Lavoro): Verbale[] {
  const d = datiContabilita(l)
  const out: Verbale[] = []
  if (d.dataConsegna) out.push({ id: 'v-consegna', tipo: 'consegna', data: d.dataConsegna, numero: 1, ricavato: true })
  d.sospensioni.forEach((s, i) => {
    out.push({ id: `v-sosp-${s.id}`, tipo: 'sospensione', data: s.dal, numero: i + 1, motivo: s.motivo, ricavato: true })
    if (s.al) out.push({ id: `v-ripr-${s.id}`, tipo: 'ripresa', data: s.al, numero: i + 1, ricavato: true })
  })
  d.proroghe.forEach((p, i) => out.push({ id: `v-prg-${p.id}`, tipo: 'proroga', data: p.data, numero: i + 1, giorniProroga: p.giorni, ...(p.motivo ? { oggetto: p.motivo } : {}), ricavato: true }))
  if (d.dataUltimazione) out.push({ id: 'v-ultimazione', tipo: 'ultimazione', data: d.dataUltimazione, numero: 1, ricavato: true })
  for (const a of attiDi(l).liberi) out.push({ id: a.id, tipo: a.tipo, data: a.data, numero: a.numero, oggetto: a.oggetto, testo: a.testo })
  return out.sort(perData)
}

/* ── Le riserve ───────────────────────────────────────────────────────── */

export function aggiungiRiserva(l: Lavoro, r: Omit<Riserva, 'id' | 'numero'>): { lavoro: Lavoro; id: string } {
  if (!r.oggetto.trim()) throw new Error("La riserva ha un oggetto: che cosa chiede l'esecutore")
  const numero = attiDi(l).riserve.reduce((n, x) => Math.max(n, x.numero), 0) + 1
  const id = nuovoId('ris')
  return { lavoro: conAtti(l, (a) => ({ riserve: [...a.riserve, { ...r, id, numero }] })), id }
}
export function modificaRiserva(l: Lavoro, id: string, patch: Partial<Omit<Riserva, 'id' | 'numero'>>): Lavoro {
  return conAtti(l, (a) => ({ riserve: a.riserve.map((x) => (x.id === id ? { ...x, ...patch } : x)) }))
}
export const togliRiserva = (l: Lavoro, id: string): Lavoro => conAtti(l, (a) => ({ riserve: a.riserve.filter((x) => x.id !== id) }))

/* ── Le liste in economia ─────────────────────────────────────────────── */

export function aggiungiLista(l: Lavoro, data: string, salNumero?: number): { lavoro: Lavoro; id: string } {
  if (!dataValida(data)) throw new Error('Data non valida: gg/mm/aaaa')
  const numero = attiDi(l).economie.reduce((n, x) => Math.max(n, x.numero), 0) + 1
  const id = nuovoId('eco')
  return { lavoro: conAtti(l, (a) => ({ economie: [...a.economie, { id, numero, data, ...(salNumero ? { salNumero } : {}), operai: [], mezzi: [], provviste: [] }] })), id }
}
export function modificaLista(l: Lavoro, id: string, patch: Partial<Omit<ListaEconomia, 'id' | 'numero'>>): Lavoro {
  const lista = attiDi(l).economie.find((x) => x.id === id)
  if (!lista) throw new Error('Lista non trovata')
  // una lista già entrata in un SAL emesso non si cambia: è nella contabilità firmata
  const emesso = lista.salNumero != null && l.avanzamenti.some((a) => a.n === lista.salNumero && a.stato === 'emesso' && a.tipo !== 'cre')
  if (emesso) throw new Error(`La lista n. ${lista.numero} è nel SAL n. ${lista.salNumero}, già emesso: si legge, non si modifica`)
  return conAtti(l, (a) => ({ economie: a.economie.map((x) => (x.id === id ? { ...x, ...patch } : x)) }))
}
export function togliLista(l: Lavoro, id: string): Lavoro {
  modificaLista(l, id, {})   // stesso controllo: non si toglie quello che è in un SAL emesso
  return conAtti(l, (a) => ({ economie: a.economie.filter((x) => x.id !== id) }))
}

const r2 = (n: number): number => Math.round(n * 100) / 100

/** Il valore di una lista: manodopera, noli, provviste (prezzi della lista, non ribassati). */
export function valoreLista(x: ListaEconomia): { manodopera: number; noli: number; provviste: number; totale: number } {
  const manodopera = r2(x.operai.reduce((t, o) => t + (o.ore || 0) * (o.tariffaOraria || 0), 0))
  const noli = r2(x.mezzi.reduce((t, m) => t + (m.ore || 0) * (m.tariffaOraria || 0), 0))
  const provviste = r2(x.provviste.reduce((t, p) => t + (p.quantita || 0) * (p.prezzoUnitario || 0), 0))
  return { manodopera, noli, provviste, totale: r2(manodopera + noli + provviste) }
}

/** I lavori in economia a tutto il SAL n.: le liste dei SAL fino a quello. */
export function economiaATuttoSal(l: Lavoro, n: number): number {
  return r2(attiDi(l).economie.filter((x) => x.salNumero != null && x.salNumero <= n).reduce((t, x) => t + valoreLista(x).totale, 0))
}

/** Registra un atto prodotto: lo stesso atto (tipo e SAL) si aggiorna, non si duplica. */
export function registraConsegna(l: Lavoro, c: Omit<Consegna, 'id' | 'ts'> & { ts?: number }): Lavoro {
  return conAtti(l, (a) => {
    const prima = a.consegne.find((x) => x.tipo === c.tipo && x.salNumero === c.salNumero)
    const nuova: Consegna = { ...(prima || { id: nuovoId('cons') }), ...c, ts: c.ts ?? Date.now() } as Consegna
    return { consegne: prima ? a.consegne.map((x) => (x.id === prima.id ? nuova : x)) : [...a.consegne, nuova] }
  })
}

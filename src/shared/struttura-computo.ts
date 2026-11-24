/**
 * STRUTTURA DEL COMPUTO — Supercategorie › Categorie › Subcategorie e WBS.
 *
 * Le categorie vivono sulle voci (chiave → «Super · Cat · Sub»); il progetto può anche
 * DICHIARARE rami ancora senza voci (`dichiarate`), ad esempio da un modello. Qui:
 *  - l'albero con conteggi e importi, nell'ordine dei gruppi a schermo;
 *  - rinomina / elimina un ramo (si propaga a tutte le voci), sposta un gruppo fra i fratelli;
 *  - albero WBS, cambio di codice (con i figli), eliminazione;
 *  - modelli di struttura riutilizzabili fra progetti (gestiti in Amministrazione).
 *
 * Modulo PURO (nessun DOM).
 */
import { SEP_CATEGORIA, ordinaVoci, confrontaNomiLivello } from './ordine-computo'

const r2 = (n: number): number => { const x = Math.abs(n) * 100; return Math.sign(n) * Math.round(Number(x.toPrecision(15))) / 100 }
export const partiCategoria = (c: string | undefined | null): string[] =>
  String(c ?? '').split(SEP_CATEGORIA).map((s) => s.trim()).filter(Boolean)
const unisci = (p: string[]): string => p.join(SEP_CATEGORIA)

export interface NodoCategoria {
  nome: string
  /** Percorso completo (Super, Super·Cat, Super·Cat·Sub). */
  percorso: string[]
  livello: number
  /** Voci del ramo (sue e dei discendenti). */
  voci: number
  importo: number
  figli: NodoCategoria[]
}

/**
 * Albero delle categorie: i gruppi nell'ordine in cui compaiono a schermo (ordine manuale),
 * poi i rami solo dichiarati. `importi`: chiave → importo della voce.
 */
export function alberoCategorie(
  categoria: Record<string, string | undefined>, ordine: string[], importi: Record<string, number> = {}, dichiarate: string[] = [],
  ordineLivelli?: string[][],
): NodoCategoria[] {
  const chiavi = ordinaVoci(Object.keys(categoria).filter((k) => partiCategoria(categoria[k]).length), 'categorie', { ordine, categoria, ordineLivelli })
  const radice: NodoCategoria = { nome: '', percorso: [], livello: -1, voci: 0, importo: 0, figli: [] }
  const ramo = (p: string[]): NodoCategoria[] => {
    let nodo = radice
    const tocchi: NodoCategoria[] = []
    p.forEach((nome, i) => {
      let f = nodo.figli.find((x) => x.nome === nome)
      if (!f) { f = { nome, percorso: p.slice(0, i + 1), livello: i, voci: 0, importo: 0, figli: [] }; nodo.figli.push(f) }
      tocchi.push(f); nodo = f
    })
    return tocchi
  }
  for (const k of chiavi) {
    for (const n of ramo(partiCategoria(categoria[k]))) { n.voci++; n.importo = r2(n.importo + (importi[k] || 0)) }
  }
  for (const d of dichiarate) ramo(partiCategoria(d))
  // l'ordine definito per livello vale anche per i rami senza voci
  const ordina = (nodi: NodoCategoria[], livello: number): void => {
    nodi.sort((a, b) => confrontaNomiLivello(ordineLivelli, livello, a.nome, b.nome) ?? 0)
    for (const n of nodi) ordina(n.figli, livello + 1)
  }
  ordina(radice.figli, 0)
  return radice.figli
}

/**
 * Sposta un nome fra i suoi pari nell'ORDINE DEFINITO del suo livello. `fratelli` è
 * l'ordine attuale dei pari (come compaiono nell'albero); restituisce il nuovo elenco
 * del livello: i pari nel nuovo ordine, seguiti dagli altri nomi già elencati.
 */
export function spostaNelLivello(ordineLivello: string[], fratelli: string[], nome: string, delta: -1 | 1): string[] {
  const i = fratelli.indexOf(nome), j = i + delta
  if (i < 0 || j < 0 || j >= fratelli.length) return ordineLivello
  const nuovi = [...fratelli]
  ;[nuovi[i], nuovi[j]] = [nuovi[j], nuovi[i]]
  // gli altri nomi del livello mantengono la loro posizione relativa, dopo i pari
  const prima = ordineLivello.filter((n) => !fratelli.includes(n))
  return [...nuovi, ...prima]
}

/** Visita in profondità (per disegnare l'albero come elenco). */
export function appiattisci<T extends { figli: T[] }>(nodi: T[]): T[] {
  return nodi.flatMap((n) => [n, ...appiattisci(n.figli)])
}

const inizia = (p: string[], pre: string[]): boolean => pre.length <= p.length && pre.every((x, i) => p[i] === x)

/**
 * Rinomina il ramo `percorso` (l'ultimo livello diventa `nuovo`) su tutte le voci e nelle
 * dichiarate. Se esiste già un ramo con quel nome, i due si fondono. Ritorna le voci toccate.
 */
export function rinominaCategoria(categoria: Record<string, string | undefined>, dichiarate: string[], percorso: string[], nuovo: string): number {
  const nome = nuovo.replace(new RegExp(SEP_CATEGORIA.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '-').trim()
  if (!nome || !percorso.length) return 0
  const sost = (p: string[]): string[] => (inizia(p, percorso) ? [...percorso.slice(0, -1), nome, ...p.slice(percorso.length)] : p)
  let n = 0
  for (const k of Object.keys(categoria)) {
    const p = partiCategoria(categoria[k])
    if (inizia(p, percorso)) { categoria[k] = unisci(sost(p)); n++ }
  }
  const nuove = [...new Set(dichiarate.map((d) => unisci(sost(partiCategoria(d)))))]
  dichiarate.splice(0, dichiarate.length, ...nuove)
  return n
}

/**
 * Elimina il ramo `percorso`: le voci risalgono al livello superiore (una Categoria tolta
 * lascia la sola Supercategoria; una Supercategoria tolta lascia la voce senza categoria).
 */
export function eliminaCategoria(categoria: Record<string, string | undefined>, dichiarate: string[], percorso: string[]): number {
  let n = 0
  for (const k of Object.keys(categoria)) {
    const p = partiCategoria(categoria[k])
    if (!inizia(p, percorso)) continue
    n++
    const resto = percorso.slice(0, -1)
    if (resto.length) categoria[k] = unisci(resto)
    else delete categoria[k]
  }
  const rimaste = dichiarate.filter((d) => !inizia(partiCategoria(d), percorso))
  dichiarate.splice(0, dichiarate.length, ...rimaste)
  return n
}

// ── WBS ────────────────────────────────────────────────────────────────────

export interface NodoWbs { codice: string; descrizione: string; livello: number; voci: number; importo: number; implicito: boolean }

const cmpWbs = (a: string, b: string): number => a.localeCompare(b, 'it', { numeric: true })
const prefissi = (c: string): string[] => { const p = c.split('.'); return p.map((_, i) => p.slice(0, i + 1).join('.')) }

/** Albero WBS (elenco ordinato per codice) con voci e importi cumulati sui nodi padre. */
export function alberoWbs(wbs: Record<string, string | undefined>, nodi: Record<string, string>, importi: Record<string, number> = {}): NodoWbs[] {
  const m = new Map<string, NodoWbs>()
  const nodo = (c: string, implicito: boolean): NodoWbs => {
    let n = m.get(c)
    if (!n) { n = { codice: c, descrizione: nodi[c] ?? '', livello: c.split('.').length - 1, voci: 0, importo: 0, implicito }; m.set(c, n) }
    return n
  }
  for (const c of Object.keys(nodi)) if (c.trim()) for (const p of prefissi(c.trim())) nodo(p, p !== c.trim() && !(p in nodi))
  for (const [k, c] of Object.entries(wbs)) {
    const cc = (c ?? '').trim(); if (!cc) continue
    for (const p of prefissi(cc)) { const n = nodo(p, !(p in nodi)); n.voci++; n.importo = r2(n.importo + (importi[k] || 0)) }
  }
  return [...m.values()].sort((a, b) => cmpWbs(a.codice, b.codice))
}

const valido = (c: string): boolean => /^[0-9A-Za-z]+(\.[0-9A-Za-z]+)*$/.test(c)

/**
 * Cambia il codice di un nodo WBS (e dei suoi figli) nelle voci e nella struttura.
 * Errore se il nuovo codice non è valido o è già usato da un altro ramo.
 */
export function ricodificaWbs(wbs: Record<string, string | undefined>, nodi: Record<string, string>, da: string, a: string): { voci: number; errore?: string } {
  a = a.trim(); da = da.trim()
  if (!valido(a)) return { voci: 0, errore: 'Codice non valido: usa numeri o lettere separati da punti (es. 01.02)' }
  if (a === da) return { voci: 0 }
  const sotto = (c: string, base: string): boolean => c === base || c.startsWith(base + '.')
  if (sotto(a, da)) return { voci: 0, errore: 'Un nodo non può finire dentro se stesso' }
  const occupato = Object.keys(nodi).some((c) => sotto(c, a)) || Object.values(wbs).some((c) => c && sotto(c.trim(), a))
  if (occupato) return { voci: 0, errore: `Il codice ${a} è già usato` }
  const sost = (c: string): string => a + c.slice(da.length)
  let n = 0
  for (const k of Object.keys(wbs)) { const c = (wbs[k] ?? '').trim(); if (c && sotto(c, da)) { wbs[k] = sost(c); n++ } }
  for (const c of Object.keys(nodi)) if (sotto(c, da)) { nodi[sost(c)] = nodi[c]; delete nodi[c] }
  return { voci: n }
}

/** Elimina un nodo WBS e i suoi figli: le voci restano senza WBS. */
export function eliminaWbs(wbs: Record<string, string | undefined>, nodi: Record<string, string>, codice: string): number {
  const sotto = (c: string): boolean => c === codice || c.startsWith(codice + '.')
  let n = 0
  for (const k of Object.keys(wbs)) { const c = (wbs[k] ?? '').trim(); if (c && sotto(c)) { delete wbs[k]; n++ } }
  for (const c of Object.keys(nodi)) if (sotto(c)) delete nodi[c]
  return n
}

/** Primo codice libero sotto `padre` (vuoto = radice), a due cifre: 01, 02… / 01.01, 01.02… */
export function prossimoCodiceWbs(nodi: Record<string, string>, wbs: Record<string, string | undefined>, padre = ''): string {
  const usati = new Set([...Object.keys(nodi), ...Object.values(wbs).map((c) => (c ?? '').trim())].flatMap((c) => (c ? prefissi(c) : [])))
  for (let i = 1; i < 1000; i++) {
    const c = (padre ? padre + '.' : '') + String(i).padStart(2, '0')
    if (!usati.has(c)) return c
  }
  return (padre ? padre + '.' : '') + '999'
}

// ── MODELLI DI STRUTTURA ───────────────────────────────────────────────────

export interface ModelloStruttura {
  id: string
  nome: string
  /** Rami di categoria «Super · Cat · Sub», nell'ordine. */
  categorie: string[]
  /** Nodi WBS: codice → descrizione. */
  wbs: Record<string, string>
  creato: number
}

export const CHIAVE_MODELLI = 'hub:modelli-struttura'

/** Modello dalla struttura del progetto (rami usati e dichiarati, nodi WBS). */
export function modelloDaProgetto(nome: string, categoria: Record<string, string | undefined>, ordine: string[], dichiarate: string[], wbs: Record<string, string | undefined>, nodi: Record<string, string>, ora = Date.now(), ordineLivelli?: string[][]): ModelloStruttura {
  // i rami escono nell'ordine della struttura: applicando il modello, quell'ordine si ritrova
  const foglie = appiattisci(alberoCategorie(categoria, ordine, {}, dichiarate, ordineLivelli)).filter((n) => !n.figli.length).map((n) => unisci(n.percorso))
  const w: Record<string, string> = {}
  for (const n of alberoWbs(wbs, nodi)) w[n.codice] = n.descrizione
  return { id: 'm' + ora.toString(36), nome: nome.trim() || 'Modello', categorie: foglie, wbs: w, creato: ora }
}

/**
 * Applica un modello al progetto: aggiunge i rami alle categorie dichiarate e i nodi WBS
 * mancanti (le descrizioni già presenti nel progetto restano). Ritorna cosa è stato aggiunto.
 */
export function applicaModello(m: ModelloStruttura, dichiarate: string[], nodi: Record<string, string>): { categorie: number; wbs: number } {
  let c = 0, w = 0
  const presenti = new Set(dichiarate)
  for (const ramo of m.categorie || []) {
    const r = unisci(partiCategoria(ramo))
    if (r && !presenti.has(r)) { dichiarate.push(r); presenti.add(r); c++ }
  }
  for (const [codice, d] of Object.entries(m.wbs || {})) {
    if (!(codice in nodi)) { nodi[codice] = d; w++ } else if (!nodi[codice] && d) nodi[codice] = d
  }
  return { categorie: c, wbs: w }
}

/** Lettura difensiva dei modelli salvati (localStorage o file). */
export function normalizzaModelli(x: unknown): ModelloStruttura[] {
  const arr = Array.isArray(x) ? x : (x && typeof x === 'object' && Array.isArray((x as { modelli?: unknown }).modelli) ? (x as { modelli: unknown[] }).modelli : [])
  return arr.filter((m): m is ModelloStruttura => !!m && typeof m === 'object' && typeof (m as ModelloStruttura).nome === 'string')
    .map((m, i) => ({
      id: String(m.id || 'm' + i + Date.now().toString(36)), nome: m.nome,
      categorie: Array.isArray(m.categorie) ? m.categorie.filter((s) => typeof s === 'string') : [],
      wbs: m.wbs && typeof m.wbs === 'object' ? Object.fromEntries(Object.entries(m.wbs).filter(([, v]) => typeof v === 'string')) as Record<string, string> : {},
      creato: Number(m.creato) || 0,
    }))
}

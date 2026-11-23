/**
 * ARCHIVIO PREZZARI DEL PROGRAMMA — uno solo, per tutti gli strumenti.
 *
 * Un prezzario non appartiene al Computo: appartiene al PROGRAMMA
 * il prezzario regionale è un archivio a sé e l'elenco prezzi del lavoro è un'altra
 * cosa. Chi computa e chi contabilizza pescano dallo stesso scaffale.
 *
 * Due provenienze, un elenco solo:
 *  - **archivio** — i prezzari che l'utente ha importato (xlsx, xml, csv…). Le voci
 *    lette si conservano in IndexedDB sul computer, non nel progetto: un prezzario
 *    regionale pesa diversi MB e non va copiato in ogni file di lavoro.
 *  - **installati** — i prezzari impacchettati con il programma (`prezzari/_bundle/`),
 *    dichiarati da un manifest caricato in pagina.
 *
 * IndexedDB è per origine: Computo e Contabilità sono due pagine della stessa app e
 * vedono lo stesso archivio. Finché questa funzione non c'è, la Contabilità non vede
 * i prezzari importati nel Computo — che è esattamente il motivo per cui esiste.
 */
import type { PriceRow } from '../../tools/computo/engine/types'

const DB = 'quadra-prezzari'
const STORE = 'prezzari'

export type OriginePrezzario = 'archivio' | 'installato'

export interface PrezzarioDisponibile {
  /** Identificatore stabile: `arc:<nomefile>` per l'archivio, `pkg:<slug>` per gli installati. */
  id: string
  nome: string
  regione: string | null
  anno: string | null
  /** Quante voci contiene (0 se non dichiarato). */
  n: number
  origine: OriginePrezzario
  categoria?: 'pubblico' | 'privato'
  /** Solo per l'archivio: il nome del file da cui è stato letto. */
  filename?: string
}

export interface RecordArchivio {
  filename: string
  format?: string
  regione?: string | null
  anno?: string | null
  tipo?: string
  variante?: string
  rows: PriceRow[]
  salvato?: number
}

// ── IndexedDB ───────────────────────────────────────────────────────────────
function apri(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    if (typeof indexedDB === 'undefined') { rej(new Error('IndexedDB non disponibile')); return }
    const rq = indexedDB.open(DB, 1)
    rq.onupgradeneeded = () => { rq.result.createObjectStore(STORE, { keyPath: 'filename' }) }
    rq.onsuccess = () => res(rq.result)
    rq.onerror = () => rej(rq.error)
  })
}
async function tx<T>(modo: IDBTransactionMode, fn: (st: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await apri()
  return new Promise<T | undefined>((res, rej) => {
    const t = db.transaction(STORE, modo)
    const out = fn(t.objectStore(STORE))
    t.oncomplete = () => { db.close(); res(out && 'result' in out ? (out as IDBRequest<T>).result : undefined) }
    t.onerror = () => { db.close(); rej(t.error) }
    t.onabort = () => { db.close(); rej(t.error || new Error('operazione interrotta')) }
  })
}

/** Salva le voci lette di un prezzario importato. */
export async function salvaPrezzario(item: RecordArchivio): Promise<void> {
  await tx('readwrite', (st) => st.put({
    filename: item.filename, format: item.format, regione: item.regione, anno: item.anno,
    tipo: item.tipo, variante: item.variante || '', rows: item.rows, salvato: Date.now(),
  }))
}

/** Elenco dei prezzari dell'archivio, SENZA le voci (si leggono quando servono). */
export async function elencoPrezzariSalvati(): Promise<(Omit<RecordArchivio, 'rows'> & { n: number })[]> {
  const tutti = (await tx<RecordArchivio[]>('readonly', (st) => st.getAll())) || []
  return tutti.map(({ rows, ...meta }) => ({ ...meta, n: Array.isArray(rows) ? rows.length : 0 }))
}

/** Le voci di un prezzario dell'archivio. */
export async function righePrezzarioSalvato(filename: string): Promise<PriceRow[]> {
  const rec = await tx<RecordArchivio>('readonly', (st) => st.get(filename))
  return rec?.rows || []
}

/** Toglie un prezzario dall'archivio. */
export async function dimenticaPrezzarioSalvato(filename: string): Promise<void> {
  await tx('readwrite', (st) => st.delete(filename))
  try { if (localStorage.getItem(CHIAVE_ULTIMO) === filename) localStorage.removeItem(CHIAVE_ULTIMO) } catch { /* ok */ }
}

const CHIAVE_ULTIMO = 'miu:ultimo-prezzario'
export function ricordaUltimo(filename: string): void { try { localStorage.setItem(CHIAVE_ULTIMO, filename) } catch { /* ok */ } }
export function ultimoPrezzario(): string | null { try { return localStorage.getItem(CHIAVE_ULTIMO) } catch { return null } }

// ── I prezzari impacchettati con il programma ───────────────────────────────
interface VoceManifest { slug: string; regione: string | null; anno: string | null; count: number; categoria?: 'pubblico' | 'privato' }

export function prezzariInstallati(): VoceManifest[] {
  const m = (window as unknown as { __PRZ_MANIFEST?: VoceManifest[] }).__PRZ_MANIFEST
  return Array.isArray(m) ? m.slice() : []
}

const nomeDi = (regione: string | null | undefined, anno: string | null | undefined, ripiego: string): string =>
  [regione || ripiego, anno].filter(Boolean).join(' ')

/**
 * Tutto lo scaffale, in un elenco solo: prima i prezzari importati dall'utente
 * (sono i suoi), poi quelli impacchettati. Ordine per regione e anno decrescente.
 */
export async function prezzariDisponibili(): Promise<PrezzarioDisponibile[]> {
  const out: PrezzarioDisponibile[] = []
  try {
    for (const r of await elencoPrezzariSalvati()) {
      out.push({
        id: `arc:${r.filename}`, filename: r.filename, nome: nomeDi(r.regione, r.anno, r.filename),
        regione: r.regione ?? null, anno: r.anno ?? null, n: r.n, origine: 'archivio',
        categoria: r.tipo === 'privato' ? 'privato' : 'pubblico',
      })
    }
  } catch { /* nessun archivio su questo computer: restano gli installati */ }
  for (const p of prezzariInstallati()) {
    out.push({ id: `pkg:${p.slug}`, nome: nomeDi(p.regione, p.anno, p.slug), regione: p.regione, anno: p.anno, n: p.count, origine: 'installato', categoria: p.categoria })
  }
  const peso = (p: PrezzarioDisponibile): number => (p.origine === 'archivio' ? 0 : 1)
  return out.sort((a, b) => peso(a) - peso(b) || (a.regione || '').localeCompare(b.regione || '') || (b.anno || '').localeCompare(a.anno || ''))
}

/** Lo slug di un prezzario installato, se `id` ne indica uno. */
export const slugInstallato = (id: string): string | null => (id.startsWith('pkg:') ? id.slice(4) : null)
/** Il nome file di un prezzario d'archivio, se `id` ne indica uno. */
export const fileArchivio = (id: string): string | null => (id.startsWith('arc:') ? id.slice(4) : null)

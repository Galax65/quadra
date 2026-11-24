/**
 * I PREZZARI DEL PROGRAMMA, per chiunque ne abbia bisogno (Lavoro, Contabilità).
 *
 * Contabilizzare è lo stesso gesto del computo: si prende una voce dall'elenco
 * prezzi e la si misura. Qui la Contabilità attinge all'**archivio prezzari del
 * programma** — lo stesso scaffale del Computo: i prezzari che l'utente ha
 * importato (IndexedDB, sul computer) e quelli impacchettati con il programma,
 * in un elenco solo. Un prezzario caricato nel Computo si trova anche qui.
 */
import { loadScript } from '../vendor'
import { unpackPrezzario } from './pack'
import { prezzariDisponibili, righePrezzarioSalvato, slugInstallato, fileArchivio, type PrezzarioDisponibile } from './archivio'
import type { PackedPrezzario, PriceRow } from '../../tools/computo/engine/types'

export { prezzariDisponibili }
export type { PrezzarioDisponibile }

declare global {
  interface Window {
    __PRZ?: Record<string, string>
  }
}

/** gzip base64 → payload, senza fetch (funziona anche sotto file://). */
async function decodeGz(b64: string): Promise<PackedPrezzario> {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
  return JSON.parse(await new Response(stream).text()) as PackedPrezzario
}

const _cache = new Map<string, PriceRow[]>()

/**
 * Le righe di un prezzario, qualunque sia la sua provenienza: dall'archivio
 * dell'utente si leggono da IndexedDB, da quelli installati si scarica e si
 * spacchetta il gzip. In entrambi i casi una volta sola per sessione.
 */
export async function caricaPrezzario(id: string): Promise<PriceRow[]> {
  const pronte = _cache.get(id)
  if (pronte) return pronte
  const file = fileArchivio(id)
  let righe: PriceRow[]
  if (file) {
    righe = await righePrezzarioSalvato(file)
    if (!righe.length) throw new Error('prezzario vuoto o non più in archivio')
  } else {
    const slug = slugInstallato(id) || id
    await loadScript(`prezzari/_bundle/${slug}.js`)
    const b64 = window.__PRZ?.[slug]
    if (!b64) throw new Error('prezzario non trovato: ' + slug)
    righe = unpackPrezzario(await decodeGz(b64)).rows
  }
  _cache.set(id, righe)
  return righe
}

const senzaAccenti = (s: string): string => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/**
 * Ricerca semplice: tutte le parole devono comparire nel codice o nella
 * descrizione. Un codice scritto per intero vince su tutto (è il modo in cui si
 * cerca un articolo quando lo si conosce già).
 */
export function cercaNelPrezzario(righe: PriceRow[], query: string, max = 40): PriceRow[] {
  const parole = senzaAccenti(query).split(/\s+/).filter(Boolean)
  if (!parole.length) return []
  const out: { r: PriceRow; punti: number }[] = []
  for (const r of righe) {
    const cod = senzaAccenti(r.codice || '')
    const breve = cod + ' ' + senzaAccenti(r.desc_short || '')
    const tutto = breve + ' ' + senzaAccenti(r.declaratoria || '')
    if (!parole.every((p) => tutto.includes(p))) continue
    // conta di più dove la voce si riconosce: il codice e il titolo, non la declaratoria
    let punti = parole.filter((p) => breve.includes(p)).length * 10
    if (parole.every((p) => cod.includes(p))) punti += 25
    if (parole.length === 1 && cod === parole[0]) punti += 100
    if (parole.every((p) => breve.includes(p))) punti += 15
    punti -= (r.desc_short || '').length / 400
    out.push({ r, punti })
  }
  return out.sort((a, b) => b.punti - a.punti).slice(0, max).map((x) => x.r)
}


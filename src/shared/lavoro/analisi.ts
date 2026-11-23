/**
 * LE ANALISI PREZZI di un lavoro — sezione ANALISI PREZZI della sidebar.
 *
 * Un'analisi compone un prezzo: righe di manodopera, materiali, noli e varie
 * (scritte a mano o pescate dal prezzario), più spese generali e utile
 * d'impresa, riferita a una quantità (es. 10 m²) e arrotondata. Il calcolo è
 * quello condiviso (compositore/analisi-prezzi.ts).
 *
 * Le analisi sono del LAVORO, non di una revisione: si applicano alla
 * revisione aperta («→ Nell'elenco prezzi»), dove diventano un articolo con
 * origine «analisi», collegato. Se l'analisi cambia dopo, l'articolo tiene il
 * prezzo che aveva (una revisione consegnata non si tocca): la pagina dice
 * dove il prezzo applicato è diverso, e si riapplica dove si può scrivere.
 */
import {
  calcolaAnalisi, incidenzaManodopera, DEFAULT_SPESE_GENERALI_PCT, DEFAULT_UTILE_IMPRESA_PCT,
  type AnalisiPrezzi, type AnalisiRiga,
} from '../compositore/analisi-prezzi'
import { aggiungiArticolo, modificaArticolo, nuovoId, revisione, type Lavoro } from './modello'

export type { AnalisiPrezzi, AnalisiRiga }

export const analisiDi = (l: Lavoro): AnalisiPrezzi[] => (Array.isArray(l.analisi) ? (l.analisi as AnalisiPrezzi[]) : [])
const conAnalisi = (l: Lavoro, f: (a: AnalisiPrezzi[]) => AnalisiPrezzi[]): Lavoro => ({ ...l, analisi: f(analisiDi(l)) })

export function analisi(l: Lavoro, id: string): AnalisiPrezzi {
  const a = analisiDi(l).find((x) => x.id === id)
  if (!a) throw new Error('Analisi non trovata')
  return a
}

/** Il prossimo codice libero: AP.01, AP.02… */
function prossimoCodice(l: Lavoro): string {
  const n = analisiDi(l).reduce((m, a) => Math.max(m, Number(/^AP[.\s-]?(\d+)/i.exec(a.codice)?.[1]) || 0), 0) + 1
  return `AP.${String(n).padStart(2, '0')}`
}

export function nuovaAnalisi(l: Lavoro, o: Partial<Pick<AnalisiPrezzi, 'codice' | 'descrizioneBreve' | 'um'>> = {}): { lavoro: Lavoro; id: string } {
  const id = nuovoId('ap')
  const a: AnalisiPrezzi = {
    id, codice: o.codice?.trim() || prossimoCodice(l), descrizioneBreve: o.descrizioneBreve?.trim() || 'Nuova analisi', um: o.um?.trim() || '',
    righe: [], speseGeneraliPct: DEFAULT_SPESE_GENERALI_PCT, utileImpresaPct: DEFAULT_UTILE_IMPRESA_PCT, quantitaRiferimento: 1,
  }
  return { lavoro: conAnalisi(l, (x) => [...x, a]), id }
}

export function modificaAnalisi(l: Lavoro, id: string, patch: Partial<Omit<AnalisiPrezzi, 'id' | 'righe'>>): Lavoro {
  analisi(l, id)
  for (const k of ['speseGeneraliPct', 'utileImpresaPct'] as const) {
    const v = patch[k]; if (v != null && !(v >= 0 && v < 100)) throw new Error('Le percentuali vanno da 0 a meno di 100')
  }
  if (patch.quantitaRiferimento != null && !(patch.quantitaRiferimento > 0)) throw new Error('La quantità di riferimento è maggiore di zero')
  return conAnalisi(l, (x) => x.map((a) => (a.id === id ? { ...a, ...patch } : a)))
}

export function duplicaAnalisi(l: Lavoro, id: string): { lavoro: Lavoro; id: string } {
  const a = analisi(l, id)
  const nid = nuovoId('ap')
  const copia: AnalisiPrezzi = { ...JSON.parse(JSON.stringify(a)), id: nid, codice: prossimoCodice(l), descrizioneBreve: `${a.descrizioneBreve} (copia)` }
  return { lavoro: conAnalisi(l, (x) => [...x, copia]), id: nid }
}

export const togliAnalisi = (l: Lavoro, id: string): Lavoro => conAnalisi(l, (x) => x.filter((a) => a.id !== id))

export function aggiungiRigaAnalisi(l: Lavoro, id: string, r: Partial<AnalisiRiga> = {}): Lavoro {
  const riga: AnalisiRiga = { tipo: r.tipo || 'materiale', descrizione: r.descrizione || '', um: r.um || '', quantita: r.quantita ?? 1, prezzoUnitario: r.prezzoUnitario ?? 0, ...(r.fonte ? { fonte: r.fonte } : {}) }
  return conAnalisi(l, (x) => x.map((a) => (a.id === id ? { ...a, righe: [...a.righe, riga] } : a)))
}
export function modificaRigaAnalisi(l: Lavoro, id: string, i: number, patch: Partial<AnalisiRiga>): Lavoro {
  const a = analisi(l, id)
  if (!a.righe[i]) throw new Error('Riga non trovata')
  return conAnalisi(l, (x) => x.map((y) => (y.id === id ? { ...y, righe: y.righe.map((r, j) => (j === i ? { ...r, ...patch } : r)) } : y)))
}
export const togliRigaAnalisi = (l: Lavoro, id: string, i: number): Lavoro =>
  conAnalisi(l, (x) => x.map((a) => (a.id === id ? { ...a, righe: a.righe.filter((_, j) => j !== i) } : a)))

/** Il tipo di una riga pescata dal prezzario: dall'unità di misura (ore = manodopera, salvo noli). */
export function tipoDaVoce(v: { um?: string; descrizione?: string }): AnalisiRiga['tipo'] {
  const um = (v.um || '').toLowerCase().replace(/\s|\./g, '')
  const d = (v.descrizione || '').toLowerCase()
  if (/nolo|noleggio|escavator|autocarr|gru|pala|rullo|betoniera|compressore/.test(d)) return 'nolo'
  if (um === 'h' || um === 'ora' || um === 'ore' || /operai|manodopera|operaio/.test(d)) return 'manodopera'
  return 'materiale'
}

/**
 * Applica l'analisi alla revisione aperta: un articolo con origine «analisi»,
 * collegato, al prezzo che risulta. Se c'è già (collegato, o con lo stesso
 * codice), si aggiorna; altrimenti nasce.
 */
export function applicaAnalisi(l: Lavoro, id: string, revId: string): { lavoro: Lavoro; articolo: string; nuovo: boolean } {
  const a = analisi(l, id)
  const r = revisione(l, revId)
  if (r.stato !== 'aperta') throw new Error('La revisione è chiusa: l\'analisi si applica a una revisione aperta')
  const t = calcolaAnalisi(a)
  const prezzo = t.prezzoUnitario
  const c = r.articoli.find((x) => x.analisi === id) ?? r.articoli.find((x) => x.codice.trim() === a.codice.trim())
  const dati = { codice: a.codice, descrizione: a.descrizioneBreve, ...(a.descrizioneEstesa ? { estesa: a.descrizioneEstesa } : {}), um: a.um, prezzo, analisi: id, incMdo: incidenzaManodopera(t) }
  if (c) {
    // in perizia il prezzo di un articolo di contratto non cambia: l'analisi vale per i nuovi prezzi
    if (r.tipo === 'perizia' && c.origine !== 'np' && c.origine !== 'analisi') throw new Error(`${c.codice} è un prezzo di contratto: in perizia l'analisi fa un nuovo prezzo, con un codice nuovo`)
    return { lavoro: modificaArticolo(l, revId, c.id, { ...dati, origine: 'analisi' }), articolo: c.id, nuovo: false }
  }
  const n = aggiungiArticolo(l, revId, { ...dati, origine: 'analisi' })
  return { lavoro: n.lavoro, articolo: n.id, nuovo: true }
}

/** Dove l'analisi è applicata, e a che prezzo: per dire se il prezzo in elenco è rimasto indietro. */
export function usiAnalisi(l: Lavoro, id: string): { rev: string; numero: number; aperta: boolean; prezzo: number | null; aggiornato: boolean }[] {
  const prezzo = calcolaAnalisi(analisi(l, id)).prezzoUnitario
  const out: { rev: string; numero: number; aperta: boolean; prezzo: number | null; aggiornato: boolean }[] = []
  for (const r of [...l.revisioni].sort((x, y) => x.ordine - y.ordine)) {
    const a = r.articoli.find((x) => x.analisi === id)
    if (a) out.push({ rev: r.id, numero: r.numero, aperta: r.stato === 'aperta', prezzo: a.prezzo, aggiornato: a.prezzo != null && Math.abs(a.prezzo - prezzo) < 0.005 })
  }
  return out
}

/**
 * LA MEMORIA DELLO STUDIO — quello che Quadra ha imparato, in un file solo.
 *
 * Lavorando, la suite impara: cos'è ogni blocco del CAD, quali sono legende e non si
 * computano, come si computa un blocco (catalogo voci), le voci composte con le loro
 * Analisi Prezzi, il vocabolario delle categorie. È il capitale dello studio — vale più
 * del singolo progetto, perché il progetto finisce e questo resta.
 *
 * Oggi però vive nel `localStorage` di UNA macchina. Che significa tre cose, tutte spiacevoli:
 * il collega non ce l'ha, il PC nuovo riparte da zero, e se il disco muore è perso.
 * Il server aziendale risolverà tutto questo — ma non c'è ancora, e nel frattempo il lavoro
 * si accumula. Un file che si esporta e si importa non è un ripiego: è ciò che rende quel
 * capitale TRASFERIBILE oggi, e sarà esattamente il payload che il server sincronizzerà domani
 * (stesso schema, stesse parti, stessa unione).
 *
 * REGOLA CHE CONTA: importare UNISCE, non sostituisce.
 * Due colleghi che si scambiano il catalogo non devono cancellarsi a vicenda il lavoro. La
 * sostituzione esiste, ma va chiesta: è l'eccezione, non il default.
 */

export interface Store {
  getItem(k: string): string | null
  setItem(k: string, v: string): void
}

/** Come si fondono due memorie della stessa parte. */
export type Fusione = 'oggetto' | 'lista-unica'

export interface ParteMemoria {
  id: string
  /** Nome per l'utente. */
  nome: string
  /** A cosa serve, detto in una riga. */
  cosa: string
  /** Chiave di `localStorage`. `{company}` viene sostituito con l'azienda corrente. */
  chiave: string
  /** Oggetto (mappa chiave→valore) o lista di elementi con `id`. */
  fusione: Fusione
  /** Da dove viene: serve solo a raggruppare nell'interfaccia. */
  tool: 'Computo' | 'Amministrazione'
}

/**
 * Le parti della memoria. Le PREFERENZE (vista, sidebar, tema) non ci sono, ed è voluto:
 * non sono conoscenza, sono abitudini di una persona su una macchina. Portarsele dietro
 * significherebbe imporre al collega la propria interfaccia insieme al proprio sapere.
 */
export const PARTI: ParteMemoria[] = [
  {
    id: 'libreria-voci',
    nome: 'Libreria voci e Analisi Prezzi',
    cosa: 'Le voci composte dallo studio, con le Analisi Prezzi (manodopera, materiali, noli) già fatte.',
    chiave: 'miu:libreria',
    fusione: 'lista-unica',
    tool: 'Computo',
  },
  {
    id: 'categorie',
    nome: 'Vocabolario categorie',
    cosa: 'Supercategorie, categorie e subcategorie con cui lo studio struttura i suoi computi.',
    chiave: 'miu:catdb',
    fusione: 'oggetto',
    tool: 'Computo',
  },
  {
    id: 'modelli-struttura',
    nome: 'Modelli di struttura',
    cosa: 'Categorie e nodi WBS da riusare nei progetti (Computo → ☰ Struttura → Modelli).',
    chiave: 'hub:modelli-struttura',
    fusione: 'lista-unica',
    tool: 'Amministrazione',
  },
]

export function parteDi(id: string): ParteMemoria | undefined {
  return PARTI.find(p => p.id === id)
}

/** La chiave vera nello store: il catalogo è compartimentato per azienda (es. `…:studio-demo`). */
export function chiaveDi(parte: ParteMemoria, companyId?: string | null): string {
  return parte.chiave.replace('{company}', companyId || 'anon')
}

export interface MemoriaStudio {
  schema: 'ehub/memoria-studio@1'
  /** Chi l'ha esportata e quando: serve a capire cosa si sta importando, prima di farlo. */
  studio: string
  esportata: string
  parti: Record<string, unknown>
}

function leggi(store: Store, chiave: string): unknown {
  try {
    const raw = store.getItem(chiave)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

/** Quanti elementi contiene una parte: è il numero che dice se vale la pena esportarla. */
export function conta(valore: unknown): number {
  if (!valore) return 0
  if (Array.isArray(valore)) return valore.length
  if (typeof valore === 'object') {
    const v = valore as Record<string, unknown>
    // il catalogo è { v: 1, voci: {…} }: quello che conta sono le VOCI, non il numero di
    // versione (che altrimenti si conterebbe come se fosse una decisione dello studio)
    if (v.voci && typeof v.voci === 'object') return Object.keys(v.voci as object).length
    // il vocabolario categorie è { sp:[], cat:[], sb:[] }: si contano gli elementi, non i rami
    const rami = Object.values(v)
    if (rami.length && rami.every(r => Array.isArray(r))) {
      return rami.reduce((s: number, r) => s + (r as unknown[]).length, 0)
    }
    return Object.keys(v).length
  }
  return 0
}

/** Cosa c'è nella memoria di questa macchina, parte per parte. */
export function inventario(store: Store, companyId?: string | null): { parte: ParteMemoria; n: number }[] {
  return PARTI.map(parte => ({ parte, n: conta(leggi(store, chiaveDi(parte, companyId))) }))
}

/** Raccoglie la memoria (o solo le parti chieste) in un oggetto esportabile. */
export function esporta(store: Store, opts: { companyId?: string | null; studio?: string; parti?: string[]; ora?: Date } = {}): MemoriaStudio {
  const scelte = opts.parti && opts.parti.length ? PARTI.filter(p => opts.parti!.includes(p.id)) : PARTI
  const parti: Record<string, unknown> = {}
  for (const p of scelte) {
    const v = leggi(store, chiaveDi(p, opts.companyId))
    if (conta(v)) parti[p.id] = v // le parti vuote non si esportano: sarebbero rumore nel file
  }
  return {
    schema: 'ehub/memoria-studio@1',
    studio: opts.studio || opts.companyId || 'studio',
    esportata: (opts.ora || new Date()).toISOString(),
    parti,
  }
}

/** Il file è una memoria di Quadra? (Un file sbagliato non deve poter cancellare il lavoro.) */
export function valida(j: unknown): j is MemoriaStudio {
  const m = j as MemoriaStudio
  return !!m && typeof m === 'object' && m.schema === 'ehub/memoria-studio@1' && !!m.parti && typeof m.parti === 'object'
}

/** Cosa contiene un file, PRIMA di importarlo: si guarda, poi si decide. */
export function anteprima(m: MemoriaStudio): { parte: ParteMemoria; n: number }[] {
  return Object.keys(m.parti)
    .map(id => ({ parte: parteDi(id), n: conta(m.parti[id]) }))
    .filter((x): x is { parte: ParteMemoria; n: number } => !!x.parte)
}

function fondiOggetto(mio: unknown, suo: unknown, modo: 'unisci' | 'sostituisci'): unknown {
  if (modo === 'sostituisci') return suo
  const a = (mio && typeof mio === 'object' ? mio : {}) as Record<string, unknown>
  const b = (suo && typeof suo === 'object' ? suo : {}) as Record<string, unknown>
  // il vocabolario categorie ha rami-lista: si fondono ramo per ramo, senza duplicati
  const rami = Object.values(b)
  if (rami.length && rami.every(r => Array.isArray(r))) {
    const out: Record<string, unknown> = { ...a }
    for (const k of Object.keys(b)) {
      const mia = Array.isArray(a[k]) ? (a[k] as unknown[]) : []
      out[k] = [...new Set([...mia, ...(b[k] as unknown[])])]
    }
    return out
  }
  // IL MIO VINCE: chi importa ha già deciso qualcosa su questa macchina, e una decisione
  // presa non si scavalca in silenzio. Arriva solo ciò che qui non c'era.
  return { ...b, ...a }
}

function fondiLista(mio: unknown, suo: unknown, modo: 'unisci' | 'sostituisci'): unknown {
  if (modo === 'sostituisci') return suo
  const a = Array.isArray(mio) ? mio : []
  const b = Array.isArray(suo) ? suo : []
  const chiave = (x: unknown): string => {
    if (x && typeof x === 'object') {
      const o = x as Record<string, unknown>
      return String(o.id ?? o.key ?? JSON.stringify(x))
    }
    return String(x)
  }
  const viste = new Set(a.map(chiave))
  return [...a, ...b.filter(x => !viste.has(chiave(x)))]
}

/**
 * Importa una memoria. `unisci` (default) aggiunge senza cancellare: due colleghi che si
 * scambiano il catalogo non si sovrascrivono il lavoro a vicenda. `sostituisci` esiste per
 * quando si vuole davvero ripartire da quel file — ma va chiesto.
 */
export function importa(
  store: Store,
  m: MemoriaStudio,
  opts: { companyId?: string | null; parti?: string[]; modo?: 'unisci' | 'sostituisci' } = {},
): { parte: ParteMemoria; prima: number; dopo: number }[] {
  const modo = opts.modo || 'unisci'
  const esiti: { parte: ParteMemoria; prima: number; dopo: number }[] = []
  for (const id of Object.keys(m.parti)) {
    const parte = parteDi(id)
    if (!parte) continue // parte sconosciuta (file di una versione futura): si salta, non si rompe
    if (opts.parti && opts.parti.length && !opts.parti.includes(id)) continue
    const chiave = chiaveDi(parte, opts.companyId)
    const mio = leggi(store, chiave)
    const fuso = parte.fusione === 'lista-unica'
      ? fondiLista(mio, m.parti[id], modo)
      : fondiOggetto(mio, m.parti[id], modo)
    try { store.setItem(chiave, JSON.stringify(fuso)) } catch { /* quota piena */ }
    esiti.push({ parte, prima: conta(mio), dopo: conta(fuso) })
  }
  return esiti
}

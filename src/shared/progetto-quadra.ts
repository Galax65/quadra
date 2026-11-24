/**
 * "Progetto Quadra" — bundle dello stato dell'intero programma in un unico file
 * (.quadra, JSON). Raccoglie lo stato pieno di ciascun tool (es. il lavoro di
 * Lavoro) raggiunto via il protocollo bus collect/restore.
 *
 * Parte pura/testabile: qui solo costruzione/validazione del contenitore; chi
 * raccoglie/applica gli stati è l'hub (vedi hub/main.js) e i singoli tool.
 */

export const QUADRA_PROJECT_KIND = 'quadra-project'
/** Marcatore dei file salvati prima della rinomina: si aprono ancora. */
export const KIND_LEGACY = 'ehub-project'
export const QUADRA_PROJECT_VERSION = 1

/** appId del registry → stato pieno serializzabile del tool. */
export type StatiDeiTool = Record<string, unknown>

export interface ProgettoQuadra {
  kind: typeof QUADRA_PROJECT_KIND
  v: number
  ts: number
  /** Etichetta opzionale mostrata all'utente. */
  name?: string
  tools: StatiDeiTool
}

/** Costruisce il contenitore del progetto Quadra dagli stati raccolti dai tool. */
export function bundleProgettoQuadra(tools: StatiDeiTool, opts: { now?: number; name?: string } = {}): ProgettoQuadra {
  const cleaned: StatiDeiTool = {}
  for (const [appId, state] of Object.entries(tools || {})) {
    if (state != null) cleaned[appId] = state
  }
  const bundle: ProgettoQuadra = {
    kind: QUADRA_PROJECT_KIND,
    v: QUADRA_PROJECT_VERSION,
    ts: opts.now ?? Date.now(),
    tools: cleaned,
  }
  if (opts.name) bundle.name = opts.name
  return bundle
}

/** Numero di tool con stato nel progetto. */
export function contaToolDelProgetto(p: ProgettoQuadra): number {
  return Object.keys(p.tools || {}).length
}

/**
 * Valida e normalizza un progetto Quadra (oggetto già parsato o stringa JSON).
 * Lancia su contenuto non valido. Accetta `kind` mancante per tolleranza verso
 * file scritti a mano, purché contengano `tools`.
 */
export function parseProgettoQuadra(input: string | unknown): ProgettoQuadra {
  let obj: unknown
  if (typeof input === 'string') {
    try { obj = JSON.parse(input) } catch { throw new Error('File progetto non valido (JSON malformato)') }
  } else {
    obj = input
  }
  if (!obj || typeof obj !== 'object') throw new Error('File progetto non valido')
  const o = obj as Record<string, unknown>
  if (o.kind != null && o.kind !== QUADRA_PROJECT_KIND && o.kind !== KIND_LEGACY) throw new Error('Non è un progetto Quadra')
  if (!o.tools || typeof o.tools !== 'object') throw new Error('Progetto Quadra privo di stati dei tool')
  const tools: StatiDeiTool = {}
  for (const [appId, state] of Object.entries(o.tools as Record<string, unknown>)) {
    if (state != null) tools[appId] = state
  }
  return {
    kind: QUADRA_PROJECT_KIND,
    v: typeof o.v === 'number' ? o.v : QUADRA_PROJECT_VERSION,
    ts: typeof o.ts === 'number' ? o.ts : Date.now(),
    ...(typeof o.name === 'string' ? { name: o.name } : {}),
    tools,
  }
}

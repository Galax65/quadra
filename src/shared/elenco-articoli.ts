/**
 * ELENCO PREZZI DEL PROGETTO — articoli, modifiche di prezzo e nuovi prezzi.
 *
 * Nel Computo ogni voce di computo è una copia (chiave propria) dell'articolo di elenco:
 * la stessa voce di listino usata in cucina e in garage sono due voci di computo. Qui
 * l'ARTICOLO è l'insieme delle copie con lo stesso codice (e stessa provenienza): una
 * modifica di descrizione, U.M. o prezzo vale per tutte, come nell'elenco prezzi in XPWE.
 *
 *  - prezzo di listino conservato alla prima modifica (`prezzoListino`) e storico;
 *  - trasformazione in NUOVO PREZZO (NP.nnn) con il codice di origine;
 *  - variazione % in blocco e aggiornamento dai prezzari caricati (per codice).
 *
 * Modulo PURO (nessun DOM).
 */

export interface VariazionePrezzo { data: string; da: number | null; a: number | null; nota?: string }

/** Campi di una voce del Computo (S.custom) che servono qui. */
export interface VoceElenco {
  codice?: string | null
  desc_short?: string
  declaratoria?: string
  um?: string
  prezzo?: number | null
  regione?: string
  anno?: string | number
  np?: boolean
  sicurezza?: boolean
  analisiPrezzi?: unknown
  /** Prezzo di listino (del prezzario) prima della prima modifica. */
  prezzoListino?: number | null
  /** Codice dell'articolo di prezzario da cui è nato un nuovo prezzo. */
  codiceOrig?: string
  storicoPrezzi?: VariazionePrezzo[]
}

export interface Articolo {
  id: string
  chiavi: string[]
  codice: string
  desc: string
  um: string
  prezzo: number | null
  prezzoListino: number | null
  /** Variazione % rispetto al listino (null se non variato o senza listino). */
  variazionePct: number | null
  np: boolean
  analisi: boolean
  sicurezza: boolean
  /** Voci di computo dell'articolo con quantità > 0. */
  usi: number
  quantita: number
}

const r2 = (n: number): number => { const x = Math.abs(n) * 100; return Math.sign(n) * Math.round(Number(x.toPrecision(15))) / 100 }

/** Identità dell'articolo: codice + provenienza; senza codice ogni voce è a sé. */
export function idArticolo(chiave: string, v: VoceElenco): string {
  const c = String(v.codice ?? '').trim()
  return c ? `${c}|${v.regione ?? ''}|${v.anno ?? ''}` : `#${chiave}`
}

/** Articoli dell'elenco, nell'ordine di prima comparsa. */
export function articoli(voci: Iterable<[string, VoceElenco]>, qty: Record<string, { qty?: number } | undefined> = {}): Articolo[] {
  const m = new Map<string, Articolo>()
  for (const [k, v] of voci) {
    const id = idArticolo(k, v)
    let a = m.get(id)
    if (!a) {
      const p = v.prezzo ?? null, l = v.prezzoListino ?? null
      a = {
        id, chiavi: [], codice: String(v.codice ?? '').trim(), desc: (v.desc_short || v.declaratoria || '').trim(), um: v.um || '',
        prezzo: p, prezzoListino: l,
        variazionePct: l && p != null && Math.abs(p - l) >= 0.005 ? r2((p - l) / l * 100) : null,
        np: !!v.np || /^NP\b/i.test(String(v.codice ?? '')), analisi: !!v.analisiPrezzi, sicurezza: !!v.sicurezza, usi: 0, quantita: 0,
      }
      m.set(id, a)
    }
    a.chiavi.push(k)
    const q = qty[k]?.qty || 0
    if (q > 0) { a.usi++; a.quantita = r2(a.quantita + q) }
  }
  return [...m.values()]
}

/** Le voci (chiavi) dello stesso articolo di `chiave`. */
export function stessoArticolo(voci: Map<string, VoceElenco>, chiave: string): string[] {
  const v = voci.get(chiave); if (!v) return []
  const id = idArticolo(chiave, v)
  return [...voci].filter(([k, x]) => idArticolo(k, x) === id).map(([k]) => k)
}

const oggi = (): string => new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })

/**
 * Modifica un articolo su tutte le sue voci di computo. Al primo cambio di prezzo il prezzo
 * precedente diventa il «prezzo di listino»; ogni cambio di prezzo entra nello storico.
 * Ritorna le chiavi aggiornate.
 */
export function modificaArticolo(
  voci: Map<string, VoceElenco>, chiave: string,
  patch: Partial<Pick<VoceElenco, 'desc_short' | 'declaratoria' | 'um' | 'prezzo' | 'codice' | 'regione' | 'anno'>> & Record<string, unknown>,
  o: { nota?: string; data?: string } = {},
): string[] {
  const chiavi = stessoArticolo(voci, chiave)
  for (const k of chiavi) {
    const v = voci.get(k)!
    if ('prezzo' in patch) {
      const da = v.prezzo ?? null, a = patch.prezzo ?? null
      if (da !== a && !(da != null && a != null && Math.abs(da - a) < 0.0005)) {
        if (v.prezzoListino == null && da != null && !v.np && !v.analisiPrezzi) v.prezzoListino = da
        v.storicoPrezzi = [...(v.storicoPrezzi || []), { data: o.data || oggi(), da, a, ...(o.nota ? { nota: o.nota } : {}) }]
      }
    }
    Object.assign(v, patch)
  }
  return chiavi
}

/** Riporta il prezzo al listino (con voce di storico). */
export function ripristinaListino(voci: Map<string, VoceElenco>, chiave: string, o: { data?: string } = {}): string[] {
  const v = voci.get(chiave)
  if (!v || v.prezzoListino == null) return []
  return modificaArticolo(voci, chiave, { prezzo: v.prezzoListino }, { nota: 'ripristinato il prezzo di listino', data: o.data })
}

/** Prossimo codice NP libero (NP.001, NP.002…). */
export function prossimoNP(voci: Iterable<VoceElenco>): string {
  let max = 0
  for (const v of voci) { const m = /^NP\.(\d+)$/.exec(String(v.codice ?? '')); if (m) max = Math.max(max, +m[1]) }
  return 'NP.' + String(max + 1).padStart(3, '0')
}

/**
 * Trasforma l'articolo in NUOVO PREZZO: codice NP.nnn su tutte le sue voci, il codice di
 * prezzario resta in `codiceOrig` (si stampa nel verbale dei nuovi prezzi).
 */
export function rendiNuovoPrezzo(voci: Map<string, VoceElenco>, chiave: string): { codice: string; chiavi: string[] } {
  const v = voci.get(chiave)
  if (!v) return { codice: '', chiavi: [] }
  if (v.np) return { codice: String(v.codice ?? ''), chiavi: stessoArticolo(voci, chiave) }
  const chiavi = stessoArticolo(voci, chiave)
  const codice = prossimoNP(voci.values())
  for (const k of chiavi) {
    const x = voci.get(k)!
    if (x.codice && !x.codiceOrig) x.codiceOrig = String(x.codice)
    x.codice = codice; x.np = true
    delete x.regione; delete x.anno
  }
  return { codice, chiavi }
}

/** Arrotondamento di un prezzo a `dec` decimali (default 2). */
export const arrotonda = (p: number, dec = 2): number => { const f = 10 ** dec; return Math.round((p + Number.EPSILON) * f) / f }

/**
 * Variazione percentuale dei prezzi degli articoli scelti (es. +5 = aumento del 5%,
 * −10 = riduzione). Le voci con analisi prezzi si saltano (il prezzo viene dall'analisi).
 */
export function variaPrezzi(voci: Map<string, VoceElenco>, ids: string[], pct: number, o: { nota?: string; data?: string; decimali?: number } = {}): number {
  const scelti = new Set(ids)
  let n = 0
  for (const a of articoli(voci)) {
    if (!scelti.has(a.id) || a.analisi || a.prezzo == null) continue
    modificaArticolo(voci, a.chiavi[0], { prezzo: arrotonda(a.prezzo * (1 + pct / 100), o.decimali ?? 2) }, { nota: o.nota ?? `variazione ${pct > 0 ? '+' : ''}${pct}%`, data: o.data })
    n++
  }
  return n
}

export interface RigaListino { codice?: string; prezzo?: number; um?: string; desc_short?: string; declaratoria?: string; regione?: string; anno?: string | number }
export interface ConfrontoListino { id: string; codice: string; desc: string; attuale: number | null; nuovo: number; diffPct: number | null; riga: RigaListino }

/**
 * Confronto con i prezzari caricati: per ogni articolo (non NP, non da analisi) cerca lo
 * stesso codice fra le righe; se più righe, preferisce quella dell'anno più recente.
 * Ritorna solo gli articoli con prezzo diverso.
 */
export function confrontaConListino(arts: Articolo[], righe: RigaListino[]): ConfrontoListino[] {
  const perCodice = new Map<string, RigaListino>()
  for (const r of righe) {
    const c = String(r.codice ?? '').trim(); if (!c || !(r.prezzo! > 0)) continue
    const prec = perCodice.get(c)
    if (!prec || Number(r.anno ?? 0) > Number(prec.anno ?? 0)) perCodice.set(c, r)
  }
  const out: ConfrontoListino[] = []
  for (const a of arts) {
    if (a.np || a.analisi || !a.codice) continue
    const r = perCodice.get(a.codice); if (!r) continue
    const nuovo = r.prezzo!
    if (a.prezzo != null && Math.abs(a.prezzo - nuovo) < 0.005) continue
    out.push({ id: a.id, codice: a.codice, desc: a.desc, attuale: a.prezzo, nuovo, diffPct: a.prezzo ? r2((nuovo - a.prezzo) / a.prezzo * 100) : null, riga: r })
  }
  return out
}

/** Applica il nuovo listino agli articoli scelti: prezzo, e provenienza (regione/anno). */
export function applicaListino(voci: Map<string, VoceElenco>, scelte: ConfrontoListino[], o: { data?: string } = {}): number {
  const ids = new Map(scelte.map((s) => [s.id, s]))
  let n = 0
  for (const a of articoli(voci)) {
    const s = ids.get(a.id); if (!s) continue
    const nota = `aggiornato al prezzario ${[s.riga.regione, s.riga.anno].filter(Boolean).join(' ')}`.trim()
    modificaArticolo(voci, a.chiavi[0], { prezzo: s.nuovo }, { nota, data: o.data })
    // il «listino» di riferimento diventa quello nuovo
    for (const k of a.chiavi) { const v = voci.get(k)!; v.prezzoListino = s.nuovo; if (s.riga.anno != null) v.anno = s.riga.anno; if (s.riga.regione) v.regione = s.riga.regione }
    n++
  }
  return n
}

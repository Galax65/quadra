/**
 * COMPUTO METRICO — strumenti di inserimento delle misure:
 *  - formule nei campi (12+250+65, 2*3,5, (4+2)/2) con la formula conservata;
 *  - «vedi voce»: una riga che richiama la quantità di un'altra voce;
 *  - copia/incolla delle righe (anche da Excel: testo separato da tabulazioni);
 *  - duplica e sposta righe.
 *
 * Modulo PURO (nessun DOM): lo usano il Computo e i test.
 */
import { valutaFormula } from '../xpwe/xpwe'
import { calcolaRigaMisurazione, sommaMisurazioni, type MisurazioneRiga } from './misurazioni'

export type Fattore = 'n' | 'l1' | 'l2' | 'h'
export const FATTORI: Fattore[] = ['n', 'l1', 'l2', 'h']

const NUMERO_SEMPLICE = /^[+-]?(\d{1,3}(\.\d{3})+|\d+)(,\d+)?$|^[+-]?\d+\.\d+$/

/**
 * Legge quanto scritto in un campo di misura. Numero semplice («3,50», «1.234,5»,
 * «2.5») → solo valore; espressione («12+250+65», «2x3,5») → valore + formula,
 * conservata con il punto decimale come nell'XPWE.
 * Vuoto → valore null. Espressione non valida → `errore`.
 */
export function leggiCampo(testo: string): { valore: number | null; formula?: string; errore?: boolean } {
  const s = String(testo ?? '').trim().replace(/^=/, '')
  if (!s) return { valore: null }
  const v = valutaFormula(s)
  if (v == null) return { valore: null }
  if (Number.isNaN(v)) return { valore: null, errore: true }
  if (NUMERO_SEMPLICE.test(s.replace(/\s+/g, ''))) return { valore: v }
  // formula in notazione XPWE: niente separatori delle migliaia, punto decimale
  const formula = s.replace(/\s+/g, '').replace(/(\d)\.(?=\d{3}(\D|$))/g, '$1').replace(/,/g, '.').replace(/x/gi, '*').replace(/:/g, '/')
  return { valore: v, formula }
}

/** Formula da mostrare all'utente (virgola decimale). */
export function formulaPerSchermo(f: string | undefined | null): string {
  return String(f ?? '').replace(/(\d)\.(\d)/g, '$1,$2')
}

/** Assegna a una riga quanto scritto nel campo `campo`; ricalcola la quantità. */
export function impostaCampo(riga: MisurazioneRiga, campo: Fattore, testo: string): { errore?: boolean } {
  const r = leggiCampo(testo)
  if (r.errore) return { errore: true }
  riga[campo] = r.valore
  if (r.formula) riga.formule = { ...(riga.formule || {}), [campo]: r.formula }
  else if (riga.formule) {
    delete riga.formule[campo]
    if (!Object.keys(riga.formule).length) delete riga.formule
  }
  riga.quantita = calcolaRigaMisurazione(riga)
  return {}
}

// ── VEDI VOCE ──────────────────────────────────────────────────────────────

/** Riga di misura che può richiamare un'altra voce (chiave del computo). */
export type RigaConRichiamo = MisurazioneRiga
export interface QtyVoce { qty: number; misurazioni?: RigaConRichiamo[] }

/**
 * Risolve i «vedi voce»: in ogni riga con `vediVoce` il fattore L1 diventa la quantità
 * della voce richiamata (gli altri fattori la moltiplicano: es. N = 0,5 per metà).
 * Ripete finché i valori si stabilizzano (catene di richiami); i cicli si fermano dopo
 * 10 passate. Ritorna le chiavi delle voci la cui quantità è cambiata.
 */
export function risolviVediVoce(qty: Record<string, QtyVoce | undefined>): string[] {
  const cambiate = new Set<string>()
  for (let passata = 0; passata < 10; passata++) {
    let mosso = false
    for (const [k, q] of Object.entries(qty)) {
      if (!q?.misurazioni?.some((m) => m.vediVoce)) continue
      for (const m of q.misurazioni) {
        if (!m.vediVoce) continue
        const base = m.vediVoce === k ? 0 : (qty[m.vediVoce]?.qty ?? 0)
        if (m.l1 !== base) { m.l1 = base; m.quantita = calcolaRigaMisurazione(m); mosso = true }
      }
      const tot = sommaMisurazioni(q.misurazioni)
      if (tot !== q.qty) { q.qty = tot; cambiate.add(k); mosso = true }
    }
    if (!mosso) break
  }
  return [...cambiate]
}

/** Le voci che richiamano `chiave` (per avvisare prima di eliminarla). */
export function vociCheRichiamano(qty: Record<string, QtyVoce | undefined>, chiave: string): string[] {
  return Object.entries(qty).filter(([k, q]) => k !== chiave && q?.misurazioni?.some((m) => m.vediVoce === chiave)).map(([k]) => k)
}

// ── COPIA / INCOLLA ────────────────────────────────────────────────────────

const fmtIt = (n: number | null | undefined): string => (n == null ? '' : String(n).replace('.', ','))

/** Righe → testo con tabulazioni (descrizione, N, L1, L2, H, quantità): si incolla in Excel. */
export function misureATesto(righe: MisurazioneRiga[]): string {
  return righe.map((m) => [
    (m.descrizione || '').replace(/[\t\r\n]+/g, ' '),
    ...FATTORI.map((f) => (m.formule?.[f] ? '=' + formulaPerSchermo(m.formule[f]) : fmtIt(m[f]))),
    fmtIt(m.quantita),
  ].join('\t')).join('\n')
}

/**
 * Testo incollato (da Excel, da un altro programma o da `misureATesto`) → righe di misura.
 * Ogni riga: le celle di testo formano la descrizione, le celle numeriche (o formule)
 * sono i fattori nell'ordine N, L1, L2, H. Una 5ª colonna numerica è la quantità già
 * calcolata e si ignora (si ricalcola). Le righe vuote e le intestazioni si scartano.
 */
export function testoAMisure(testo: string): MisurazioneRiga[] {
  const out: MisurazioneRiga[] = []
  for (const linea of String(testo ?? '').replace(/\r\n?/g, '\n').split('\n')) {
    if (!linea.trim()) continue
    const celle = linea.includes('\t') ? linea.split('\t') : linea.split(';')
    const desc: string[] = []
    const fattori: { valore: number | null; formula?: string }[] = []
    for (const c of celle) {
      const t = c.trim()
      // una cella vuota dopo la descrizione è un fattore che manca (par.ug. vuote): tiene il posto,
      // altrimenti le colonne scivolano (L1 finirebbe in par.ug.)
      if (!t) { if (fattori.length || desc.length) fattori.push({ valore: null }); continue }
      const r = leggiCampo(t)
      if (!r.errore && r.valore != null) fattori.push(r)
      else if (!fattori.length) desc.push(t)
    }
    while (fattori.length && fattori[fattori.length - 1].valore == null) fattori.pop()
    const usati = fattori.length > 4 ? fattori.slice(0, 4) : fattori
    if (!usati.length && !desc.length) continue
    // un'intestazione («Descrizione | N | L1…») non ha numeri: si scarta se non è l'unica riga
    if (!usati.length && /^(descrizione|desc|n\.?|par\.?\s*ug)/i.test(desc[0] || '')) continue
    const riga: MisurazioneRiga = { descrizione: desc.join(' '), n: null, l1: null, l2: null, h: null, quantita: 0 }
    usati.forEach((f, i) => {
      const campo = FATTORI[i]
      riga[campo] = f.valore
      if (f.formula) riga.formule = { ...(riga.formule || {}), [campo]: f.formula }
    })
    riga.quantita = calcolaRigaMisurazione(riga)
    out.push(riga)
  }
  return out
}

/** Copia profonda di righe di misura (per duplicare/incollare senza condividere oggetti). */
export function copiaRighe<T extends MisurazioneRiga>(righe: T[]): T[] {
  return righe.map((m) => ({ ...m, ...(m.formule ? { formule: { ...m.formule } } : {}) }))
}

/** Sposta la riga `i` di `delta` posizioni (−1 su, +1 giù). Ritorna il nuovo indice. */
export function spostaRiga<T>(righe: T[], i: number, delta: number): number {
  const j = Math.max(0, Math.min(righe.length - 1, i + delta))
  if (j === i || i < 0 || i >= righe.length) return i
  const [r] = righe.splice(i, 1)
  righe.splice(j, 0, r)
  return j
}

// ── MISURE DA UN ALTRO COMPUTO ─────────────────────────────────────────────

export interface VoceConMisure { codice: string; descrizione: string; um: string; qty: number; misurazioni: MisurazioneRiga[] }

/**
 * Voci con righe di misura da un altro computo: file XPWE o progetto Quadra
 * (.quadra / .ehub, stato del Computo). Le voci senza righe di misura si scartano.
 */
export function vociConMisure(testo: string, xpweToVoci: (xml: string) => { codice?: string; desc_short?: string; declaratoria?: string; um?: string; qty?: number; misurazioni?: MisurazioneRiga[] }[]): VoceConMisure[] {
  const t = String(testo ?? '').replace(/^﻿/, '').trimStart()
  if (t.startsWith('<')) {
    return xpweToVoci(t).filter((v) => v.misurazioni?.length).map((v) => ({
      codice: v.codice || '', descrizione: v.desc_short || v.declaratoria || '', um: v.um || '', qty: v.qty || 0, misurazioni: copiaRighe(v.misurazioni!),
    }))
  }
  const o = JSON.parse(t) as { tools?: Record<string, unknown> }
  const st = (o.tools?.computo ?? o.tools?.['miu-price-list'] ?? Object.values(o.tools || {}).find((s) => (s as { qty?: unknown })?.qty)) as
    { qty?: Record<string, { qty?: number; um?: string; misurazioni?: MisurazioneRiga[] }>; custom?: [string, { codice?: string; desc_short?: string; declaratoria?: string; um?: string }][]; rows?: { codice?: string; desc_short?: string; declaratoria?: string; um?: string }[]; ordine?: string[] } | undefined
  if (!st?.qty) throw new Error('Il progetto non contiene un computo')
  const custom = new Map(st.custom || [])
  const chiavi = Object.keys(st.qty)
  const pos = new Map((st.ordine || []).map((k, i) => [k, i]))
  chiavi.sort((a, b) => (pos.get(a) ?? 1e9) - (pos.get(b) ?? 1e9))
  const out: VoceConMisure[] = []
  for (const k of chiavi) {
    const q = st.qty[k]
    if (!q?.misurazioni?.length) continue
    const c = custom.get(k) || (st.rows || []).find((r) => k.includes(String(r.codice || '\u0000'))) || {}
    out.push({
      codice: c.codice || k.replace(/^.*?::/, ''), descrizione: c.desc_short || c.declaratoria || '', um: q.um || c.um || '', qty: q.qty || 0,
      misurazioni: copiaRighe(q.misurazioni).map((m) => { const r = { ...m }; delete r.vediVoce; return r }),
    })
  }
  return out
}

/**
 * Contabilità — REVISIONE DEI PREZZI (art. 60 D.Lgs. 36/2023 come modificato dal
 * D.Lgs. 209/2024, Allegato II.2-bis).
 *
 * Lavori: si attiva quando la variazione dell'indice sintetico supera il 3% e opera
 * per il 90% della parte eccedente. Servizi e forniture: soglia 5%, quota 80%.
 * La compensazione si applica alle prestazioni eseguite DOPO l'attivazione: qui, SAL
 * per SAL, sull'importo netto dei lavori contabilizzati in quel SAL (escluse sicurezza
 * ed economie), con l'indice che il DL associa al SAL. Variazione in diminuzione =
 * importo negativo (la clausola opera in aumento e in diminuzione).
 */
import type { Appalto, RevisionePrezzi } from './types'

const r2 = (n: number): number => { const x = Math.abs(n) * 100; return Math.sign(n) * Math.round(Number(x.toPrecision(15))) / 100 }

export function parametriRevisione(appalto: Appalto): { sogliaPct: number; quotaPct: number } {
  const lavori = !appalto.tipologia || appalto.tipologia === 'lavori'
  const rv: RevisionePrezzi | undefined = appalto.revisione
  return {
    sogliaPct: rv?.sogliaPct ?? (lavori ? 3 : 5),
    quotaPct: rv?.quotaPct ?? (lavori ? 90 : 80),
  }
}

export interface EsitoRevisione {
  /** Variazione % dell'indice rispetto alla base (null se manca un indice). */
  variazionePct: number | null
  /** true se la variazione supera la soglia. */
  attivata: boolean
  /** Percentuale effettivamente riconosciuta sull'importo (con segno). */
  percentualeRiconosciuta: number
  /** Compensazione sull'importo indicato (con segno). */
  importo: number
}

/**
 * Compensazione per una quota di prestazioni di importo `base` eseguite quando
 * l'indice vale `indice` (base della clausola `indiceBase`).
 */
export function compensazioneRevisione(appalto: Appalto, base: number, indice: number | null | undefined): EsitoRevisione {
  const rv = appalto.revisione
  const nulla: EsitoRevisione = { variazionePct: null, attivata: false, percentualeRiconosciuta: 0, importo: 0 }
  if (!rv?.attiva || !rv.indiceBase || indice == null || !Number.isFinite(indice)) return nulla
  const { sogliaPct, quotaPct } = parametriRevisione(appalto)
  const variazionePct = Math.round((indice / rv.indiceBase - 1) * 100 * 1e4) / 1e4
  const eccedenza = Math.abs(variazionePct) - sogliaPct
  if (eccedenza <= 0) return { ...nulla, variazionePct }
  const percentualeRiconosciuta = Math.sign(variazionePct) * eccedenza * quotaPct / 100
  return { variazionePct, attivata: true, percentualeRiconosciuta, importo: r2(base * percentualeRiconosciuta / 100) }
}

// ── ACCORDO QUADRO (art. 59): importo massimo e contratti applicativi ─────────
export interface StatoAccordoQuadro {
  importoMassimo: number
  impegnato: number
  residuo: number
  /** % dell'importo massimo già impegnata dai contratti applicativi. */
  utilizzoPct: number | null
  superato: boolean
}
export function statoAccordoQuadro(appalto: Appalto): StatoAccordoQuadro | null {
  const aq = appalto.accordoQuadro
  if (!aq) return null
  const importoMassimo = r2(aq.importoMassimo || 0)
  const impegnato = r2((aq.applicativi || []).reduce((s, c) => s + (c.importo || 0), 0))
  return {
    importoMassimo, impegnato, residuo: r2(importoMassimo - impegnato),
    utilizzoPct: importoMassimo ? Math.round(impegnato / importoMassimo * 1e4) / 100 : null,
    superato: importoMassimo > 0 && impegnato > importoMassimo,
  }
}

/**
 * ANALISI PREZZI — scomposizione di un prezzo unitario in manodopera, materiale,
 * noli e varie, con Spese Generali % e Utile d'Impresa % (schema standard dei
 * capitolati di lavori pubblici: costo diretto → +SG% → subtotale → +UI% →
 * prezzo unitario). Le righe si pescano dalla STESSA ricerca prezzario del
 * resto di Computo (ogni prezzario regionale ha già un capitolo di tariffe orarie
 * manodopera, es. Veneto "RU" — nessuna fonte dati nuova) oppure sono custom.
 *
 * Modulo PURO (nessun DOM), condiviso accanto a `cart-item.ts`/`libreria.ts`.
 */

export type AnalisiRigaTipo = 'manodopera' | 'materiale' | 'nolo' | 'varie'

export interface AnalisiRiga {
  tipo: AnalisiRigaTipo
  descrizione: string
  um: string
  quantita: number
  prezzoUnitario: number
  /** presente solo se la riga è stata pescata da un prezzario reale (tracciabilità). */
  fonte?: { codice: string; regione: string; anno: string }
}

export interface AnalisiPrezzi {
  /** id stabile (kebab), come VocePronta.id */
  id: string
  /** codice utente, es. "AP01" */
  codice: string
  descrizioneBreve: string
  descrizioneEstesa?: string
  /** unità di misura del prezzo unitario finale (es. "mq", "cad") */
  um: string
  /** opzionale: FK a FRASARIO, per ricalcolare la descrizione col motore componi.ts */
  famigliaId?: string
  righe: AnalisiRiga[]
  /** Spese Generali %, default 15 — editabile per singola analisi. */
  speseGeneraliPct: number
  /** Utile d'Impresa %, default 10 — editabile per singola analisi. */
  utileImpresaPct: number
  /**
   * Quantità a cui si riferisce l'analisi (default 1): si analizzano per esempio 10 m² o
   * 100 m e il prezzo unitario è il totale diviso per questa quantità.
   */
  quantitaRiferimento?: number
  /** Arrotondamento del prezzo unitario (default 0,01 €; es. 0,05 o 1). */
  arrotondamento?: number
  note?: string
}

export interface AnalisiTotali {
  totManodopera: number
  totMateriali: number
  totNoli: number
  totVarie: number
  costoDiretto: number
  speseGenerali: number
  subtotale: number
  utileImpresa: number
  /** Importo complessivo dell'analisi (per la quantità di riferimento). */
  totaleAnalisi: number
  /** Quantità di riferimento usata (≥ 0,0001; default 1). */
  quantitaRiferimento: number
  /** Totale ÷ quantità di riferimento, arrotondato (default al centesimo). */
  prezzoUnitario: number
}

export const DEFAULT_SPESE_GENERALI_PCT = 15
export const DEFAULT_UTILE_IMPRESA_PCT = 10

const round2 = (n: number): number => { const x = Math.abs(n) * 100; return Math.sign(n) * Math.round(Number(x.toPrecision(15))) / 100 }

const importoRiga = (r: AnalisiRiga): number => (r.quantita || 0) * (r.prezzoUnitario || 0)

const sommaTipo = (righe: AnalisiRiga[], tipo: AnalisiRigaTipo): number =>
  righe.filter((r) => r.tipo === tipo).reduce((s, r) => s + importoRiga(r), 0)

/**
 * Calcolo puro: costo diretto = Σ(quantità×prezzoUnitario) di tutte le righe;
 * Spese Generali % sul costo diretto; Utile d'Impresa % sul subtotale
 * (costo diretto + SG) — schema standard dei capitolati di lavori pubblici.
 */
export function calcolaAnalisi(a: AnalisiPrezzi): AnalisiTotali {
  const righe = a.righe || []
  const totManodopera = sommaTipo(righe, 'manodopera')
  const totMateriali = sommaTipo(righe, 'materiale')
  const totNoli = sommaTipo(righe, 'nolo')
  const totVarie = sommaTipo(righe, 'varie')
  const costoDiretto = totManodopera + totMateriali + totNoli + totVarie
  const speseGenerali = costoDiretto * ((a.speseGeneraliPct || 0) / 100)
  const subtotale = costoDiretto + speseGenerali
  const utileImpresa = subtotale * ((a.utileImpresaPct || 0) / 100)
  const totaleAnalisi = round2(subtotale + utileImpresa)
  const qRif = a.quantitaRiferimento && a.quantitaRiferimento > 0 ? a.quantitaRiferimento : 1
  const passo = a.arrotondamento && a.arrotondamento > 0 ? a.arrotondamento : 0.01
  const prezzoUnitario = round2(Math.round((subtotale + utileImpresa) / qRif / passo + 1e-9) * passo)
  return {
    totManodopera: round2(totManodopera),
    totMateriali: round2(totMateriali),
    totNoli: round2(totNoli),
    totVarie: round2(totVarie),
    costoDiretto: round2(costoDiretto),
    speseGenerali: round2(speseGenerali),
    subtotale: round2(subtotale),
    utileImpresa: round2(utileImpresa),
    totaleAnalisi,
    quantitaRiferimento: qRif,
    prezzoUnitario,
  }
}

/** Incidenza % della manodopera sul prezzo unitario finale — dato richiesto nei nuovi prezzi. */
export const incidenzaManodopera = (t: AnalisiTotali): number => {
  const tot = t.totaleAnalisi ?? t.prezzoUnitario
  return tot > 0 ? round2((t.totManodopera / tot) * 100) : 0
}

/**
 * Aggiorna i prezzi elementari delle righe con fonte (codice di prezzario) dalle righe dei
 * prezzari caricati, preferendo l'anno più recente. Ritorna le righe cambiate.
 */
export function aggiornaRigheDaListino(a: AnalisiPrezzi, righe: { codice?: string; prezzo?: number; regione?: string; anno?: string | number }[]): { indice: number; da: number; a: number }[] {
  const perCodice = new Map<string, { prezzo: number; regione?: string; anno?: string | number }>()
  for (const r of righe) {
    const c = String(r.codice ?? '').trim(); if (!c || !(r.prezzo! > 0)) continue
    const p = perCodice.get(c)
    if (!p || Number(r.anno ?? 0) > Number(p.anno ?? 0)) perCodice.set(c, { prezzo: r.prezzo!, regione: r.regione, anno: r.anno })
  }
  const out: { indice: number; da: number; a: number }[] = []
  ;(a.righe || []).forEach((r, i) => {
    const n = r.fonte?.codice ? perCodice.get(r.fonte.codice.trim()) : undefined
    if (!n || Math.abs(n.prezzo - (r.prezzoUnitario || 0)) < 0.0005) return
    out.push({ indice: i, da: r.prezzoUnitario || 0, a: n.prezzo })
    r.prezzoUnitario = n.prezzo
    r.fonte = { codice: r.fonte!.codice, regione: n.regione ?? r.fonte!.regione, anno: String(n.anno ?? r.fonte!.anno) }
  })
  return out
}

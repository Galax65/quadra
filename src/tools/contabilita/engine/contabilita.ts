/**
 * Contabilità — MOTORE PURO della contabilità (a corpo, a misura, misto).
 * Codifica le regole di calcolo del D.Lgs. 36/2023 (Allegato II.14) e la
 * cascata del SAL. Nessun DOM, nessuno stato: solo funzioni testabili.
 *
 * Regola di fedeltà del dato: le quote %/quantità sono ATTESTAZIONI del DL
 * (input), il motore non le stima mai; i dati mancanti restano tali (null),
 * non vengono colmati d'ufficio.
 */
import type { Appalto, Partita, Sal, RigaSal, ListaEconomia, Perizia } from './types'
import { partiteVigenti } from './perizie'
import { importoQta } from '../../../shared/importo'
import { compensazioneRevisione } from './revisione'
import { sommaMisurazioni } from '../../../shared/compositore/misurazioni'
import { economiaATuttoSal } from './economia'

export const round2 = (n: number): number => { const x = Math.abs(n) * 100; return Math.sign(n) * Math.round(Number(x.toPrecision(15))) / 100 }

/** Ribasso % = (base − offerta) / base × 100 (4 decimali, come negli atti). null se dati non disponibili. */
export function ribassoPct(baseAsta?: number | null, offerta?: number | null): number | null {
  if (baseAsta == null || offerta == null || baseAsta <= 0) return null
  return Math.round(((baseAsta - offerta) / baseAsta) * 100 * 1e4) / 1e4
}

/**
 * Ribasso da applicare ai lavori nel SAL: quello indicato (o derivato da base/offerta);
 * ZERO con l'offerta a prezzi unitari, perché i prezzi delle partite sono già quelli offerti.
 */
export function ribassoApplicato(appalto: Appalto): number {
  if (appalto.prezziUnitari) return 0
  return appalto.ribassoPct != null ? appalto.ribassoPct : (ribassoPct(appalto.baseAsta, appalto.importoOfferta) ?? 0)
}

/** Importo contrattuale di una partita: a misura = prezzo × qtyProgetto; a corpo = importoContrattuale. */
export function importoContrattualePartita(p: Partita): number {
  if (p.modalita === 'corpo') return round2(p.importoContrattuale || 0)
  return importoQta(p.qtyProgetto, p.prezzoUnitario, p.um)
}

/** Totale contrattuale dei lavori (somma delle partite), diviso per modalità. */
export function totaleContrattualeLavori(partite: Partita[]): { misura: number; corpo: number; totale: number } {
  let misura = 0, corpo = 0
  for (const p of partite) {
    const imp = importoContrattualePartita(p)
    if (p.modalita === 'corpo') corpo += imp; else misura += imp
  }
  misura = round2(misura); corpo = round2(corpo)
  return { misura, corpo, totale: round2(misura + corpo) }
}

/**
 * Totale contrattuale dell'appalto:
 *   lavori soggetti a ribasso × (1 − ribasso) (o l'offerta, se nota)
 *   + costi della sicurezza in partita (non ribassati) + oneri sicurezza a parte.
 */
export function totaleContrattuale(appalto: Appalto, partite: Partita[]): number {
  const sic = totaleContrattualeLavori(partite.filter((p) => p.sicurezza)).totale
  const soggetti = totaleContrattualeLavori(partite.filter((p) => !p.sicurezza)).totale
  const rib = ribassoApplicato(appalto)
  const lavori = appalto.prezziUnitari ? soggetti : appalto.importoOfferta != null ? appalto.importoOfferta : round2(soggetti * (1 - (rib || 0) / 100))
  return round2(lavori + sic + (appalto.oneriSicurezza || 0))
}

/** Aliquota % di un corpo d'opera sul totale dei corpi (0 se non a corpo o totale nullo). */
export function aliquotaCorpoPct(p: Partita, partite: Partita[]): number | null {
  if (p.modalita !== 'corpo') return null
  const totCorpi = totaleContrattualeLavori(partite).corpo
  if (totCorpi <= 0) return null
  return round2((importoContrattualePartita(p) / totCorpi) * 100)
}

/**
 * Una voce COMPARE nel libretto del SAL n se è stata introdotta entro n
 * (le voci da computo, senza `introdottaSal`, valgono da sempre). Le voci
 * soppresse restano visibili (traccia dello storno), col valore azzerato.
 */
export function voceVisibileInSal(p: Partita, salNumero: number): boolean {
  return (p.introdottaSal ?? 1) <= salNumero
}

/** true se la voce risulta soppressa (stornata) a tutto il SAL n. */
export function voceSoppressaInSal(p: Partita, salNumero: number): boolean {
  return p.soppressaSal != null && salNumero >= p.soppressaSal
}

/**
 * Importo eseguito di una partita a un dato SAL (progressivo a tutto il SAL).
 * Se `salNumero` è noto e la voce è soppressa a quel SAL, l'eseguito è 0
 * (la detrazione dello storno), coerentemente con la traccia negli atti.
 */
export function eseguitoPartita(p: Partita, riga: RigaSal | undefined, salNumero?: number): number {
  if (salNumero != null && voceSoppressaInSal(p, salNumero)) return 0
  if (!riga) return 0
  if (p.modalita === 'corpo') {
    // Con un SOTTO-COMPUTO l'importo è quello delle lavorazioni davvero
    // eseguite, non la percentuale arrotondata moltiplicata per il corpo: la
    // quota è il modo di raccontarlo, non il modo di calcolarlo (e due
    // decimali di percentuale su un corpo da centomila euro sono decine di
    // euro di differenza).
    const sotto = eseguitoDalSottoComputo(p, riga)
    if (sotto != null) return sotto
    const quota = riga.quotaPct == null ? 0 : Math.max(0, Math.min(100, riga.quotaPct))
    return round2(importoContrattualePartita(p) * (quota / 100))
  }
  // a misura: quantità progressiva (esplicita o somma delle righe di misura) × prezzo
  const qty = riga.quantitaProgressiva != null ? riga.quantitaProgressiva
    : (riga.misurazioni && riga.misurazioni.length ? sommaMisurazioni(riga.misurazioni) : 0)
  return importoQta(qty, p.prezzoUnitario, p.um)
}

/**
 * Importo eseguito di un corpo d'opera scomposto: Σ (quantità eseguita ×
 * prezzo) delle lavorazioni del sotto-computo. null quando il corpo non è
 * scomposto o il SAL non ne registra l'avanzamento — allora vale la quota %.
 * Sta qui, e non nel modulo del sotto-computo, per non incrociare gli import:
 * il calcolo è tre righe, la dipendenza no.
 */
function eseguitoDalSottoComputo(p: Partita, riga: RigaSal): number | null {
  if (!p.sottoComputo?.length || !riga.sotto?.length) return null
  const tot = round2(p.sottoComputo.reduce((s, v) => s + round2((v.qty || 0) * (v.prezzo || 0)), 0))
  if (tot <= 0) return null
  return round2(p.sottoComputo.reduce((s, v) => {
    const av = riga.sotto!.find((x) => x.voceId === v.id)
    const q = av ? (av.misurazioni?.length ? av.misurazioni.reduce((t, m) => t + (m.quantita || 0), 0) : (av.quantitaProgressiva ?? 0)) : 0
    return s + round2(q * (v.prezzo || 0))
  }, 0))
}

export interface SalRigaResult {
  partita: Partita
  /** quantità (a misura) o quota % (a corpo) progressiva a tutto il SAL. */
  progressivo: number | null
  eseguito: number
}

export interface SalResult {
  numero: number
  data?: string
  righe: SalRigaResult[]
  lavoriMisura: number
  lavoriCorpo: number
  /** Lavori in economia (liste settimanali) a tutto il SAL. */
  lavoriEconomia: number
  lavoriEseguiti: number
  /** Ribasso d'asta % applicato ai lavori a misura e a corpo (0 se non indicato). */
  ribassoPct: number
  /** Importo del ribasso sui lavori a misura e a corpo eseguiti (le economie e la sicurezza non si ribassano). */
  ribassoImporto: number
  /** Lavori al netto del ribasso. */
  lavoriNetti: number
  oneriSicurezzaEseguiti: number
  totaleEseguito: number
  detrazioni: number
  totaleContabilizzato: number
  /** Ritenuta di garanzia 0,5% cumulativa sul progressivo contabilizzato (art. 11 c. 6). */
  ritenuta: number
  /** Revisione prezzi: variazione % dell'indice del SAL rispetto alla base (null se non applicabile). */
  variazioneIndicePct: number | null
  /** Compensazione per revisione prezzi maturata in QUESTO SAL (sui lavori netti del SAL). */
  revisioneSal: number
  /** Compensazione per revisione prezzi a tutto il SAL (progressiva). */
  revisioneProgressiva: number
  /** Credito del SAL prima dell'eventuale arrotondamento del certificato. */
  creditoSal: number
  /** Anticipazione erogata all'impresa (0 se non prevista). */
  anticipazione: number
  /** Anticipazione recuperata a tutto il SAL (progressiva, mai oltre l'erogato). */
  recuperoAnticipazione: number
  nettoProgressivo: number
  /** Netto già liquidato coi SAL precedenti. */
  salPrecedenti: number
  /** Importo NETTO del presente SAL (= netto progressivo − SAL precedenti). */
  importoSal: number
  iva: number
  totaleLordo: number
}

const RITENUTA_GARANZIA = 0.005 // 0,5% — art. 11 c. 6 D.Lgs. 36/2023

/** Percentuale di avanzamento dei lavori (eseguito/contrattuale) per ripartire gli oneri sicurezza. */
function avanzamentoLavori(partite: Partita[], sal: Sal): number {
  const contr = totaleContrattualeLavori(partite).totale
  if (contr <= 0) return 0
  const rigaById = new Map(sal.righe.map((r) => [r.partitaId, r]))
  let eseg = 0
  for (const p of partite) eseg += eseguitoPartita(p, rigaById.get(p.id), sal.numero)
  return Math.max(0, Math.min(1, eseg / contr))
}

/**
 * Calcola la cascata di TUTTI i SAL in sequenza (ognuno progressivo a tutto il
 * SAL). Gli oneri sicurezza sono liquidati per quota di avanzamento dei lavori.
 * `importoSal` è il netto del singolo SAL (il credito del certificato).
 */
export function calcolaSals(appalto: Appalto, partite: Partita[], sals: Sal[], liste?: ListaEconomia[], perizie?: Perizia[]): SalResult[] {
  const ordinati = [...sals].sort((a, b) => a.numero - b.numero)
  const oneri = appalto.oneriSicurezza || 0
  const iva = appalto.ivaPct == null ? 10 : appalto.ivaPct
  // ribasso d'asta: indicato a mano o derivato da base d'asta / offerta; si applica ai
  // lavori a misura e a corpo, non agli oneri della sicurezza
  const rib = ribassoApplicato(appalto)
  // anticipazione: % del valore del contratto (lavori ribassati + sicurezza), recuperata
  // su ogni certificato con la stessa % dell'importo contabilizzato (art. 125 c.1)
  const antPct = Math.max(0, appalto.anticipazionePct || 0)
  const anticipazione = antPct
    ? round2(totaleContrattuale({ ...appalto, ribassoPct: rib }, partite.filter(p => (p.introdottaSal ?? 1) <= 1)) * antPct / 100)
    : 0
  const out: SalResult[] = []
  let nettoPrecedente = 0
  // certificati precedenti = quanto davvero certificato (anche arrotondato per difetto)
  const arr = Math.max(0, appalto.arrotondamentoCertificato || 0)
  let lavoriNettiPrec = 0, revisioneProg = 0
  for (const sal of ordinati) {
    const rigaById = new Map(sal.righe.map((r) => [r.partitaId, r]))
    const pv = partiteVigenti(partite, perizie ?? appalto.perizie, sal.numero)
    const righe: SalRigaResult[] = pv.map((p) => {
      const r = rigaById.get(p.id)
      const eseguito = eseguitoPartita(p, r, sal.numero)
      const soppressa = voceSoppressaInSal(p, sal.numero)
      const progressivo = soppressa ? 0 : p.modalita === 'corpo'
        ? (r?.quotaPct ?? null)
        : (r?.quantitaProgressiva ?? (r?.misurazioni ? sommaMisurazioni(r.misurazioni) : null))
      return { partita: p, progressivo, eseguito }
    })
    // le voci di SICUREZZA non sono lavori: niente ribasso, vanno con gli oneri
    let lavoriMisura = 0, lavoriCorpo = 0, sicurezzaVoci = 0, nonRibassati = 0
    for (const rr of righe) {
      if (rr.partita.sicurezza) sicurezzaVoci += rr.eseguito
      else if (rr.partita.modalita === 'corpo') lavoriCorpo += rr.eseguito; else lavoriMisura += rr.eseguito
      if (!rr.partita.sicurezza && rr.partita.nonRibassata) nonRibassati += rr.eseguito
    }
    sicurezzaVoci = round2(sicurezzaVoci)
    lavoriMisura = round2(lavoriMisura); lavoriCorpo = round2(lavoriCorpo)
    const lavoriEconomia = economiaATuttoSal(liste, sal.numero)
    const lavoriEseguiti = round2(lavoriMisura + lavoriCorpo + lavoriEconomia)
    const oneriSicurezzaEseguiti = round2(oneri * avanzamentoLavori(pv.filter((p) => !p.sicurezza), sal) + sicurezzaVoci)
    // il ribasso non tocca i lavori segnati «non ribassati» (un NP che il contratto non assoggetta)
    const ribassoImporto = round2((lavoriMisura + lavoriCorpo - nonRibassati) * rib / 100)
    const lavoriNetti = round2(lavoriEseguiti - ribassoImporto)
    // revisione prezzi sui lavori netti (no sicurezza, no economie) contabilizzati in questo SAL
    const quotaSal = round2(lavoriNetti - lavoriEconomia - lavoriNettiPrec)
    lavoriNettiPrec = round2(lavoriNetti - lavoriEconomia)
    const rev = compensazioneRevisione(appalto, quotaSal, sal.indiceRevisione)
    revisioneProg = round2(revisioneProg + rev.importo)
    const totaleEseguito = round2(lavoriNetti + oneriSicurezzaEseguiti + revisioneProg)
    const detrazioni = round2(sal.detrazioni || 0)
    const totaleContabilizzato = round2(totaleEseguito - detrazioni)
    // La ritenuta è un trattenuto sul progressivo: se il progressivo è negativo
    // (detrazioni maggiori dell'eseguito) non c'è nulla da trattenere, e una
    // ritenuta negativa restituirebbe una garanzia mai costituita.
    const ritenuta = round2(Math.max(0, totaleContabilizzato) * RITENUTA_GARANZIA)
    const recuperoAnticipazione = antPct ? round2(Math.min(anticipazione, Math.max(0, totaleContabilizzato) * antPct / 100)) : 0
    const nettoProgressivo = round2(totaleContabilizzato - ritenuta - recuperoAnticipazione)
    const creditoSal = round2(nettoProgressivo - nettoPrecedente)
    // L'arrotondamento del certificato è PER DIFETTO sul credito dell'impresa:
    // il resto non pagato resta e matura nel certificato successivo. Su un
    // credito negativo non si applica — arrotondare per difetto un −50 vorrebbe
    // dire certificare −100, cioè trattenere più di quanto dovuto.
    const importoSal = arr && creditoSal > 0 ? round2(Math.floor((creditoSal + 1e-9) / arr) * arr) : creditoSal
    const ivaImporto = round2(importoSal * (iva / 100))
    out.push({
      numero: sal.numero, data: sal.data, righe,
      lavoriMisura, lavoriCorpo, lavoriEconomia, lavoriEseguiti, ribassoPct: rib, ribassoImporto, lavoriNetti, oneriSicurezzaEseguiti,
      variazioneIndicePct: rev.variazionePct, revisioneSal: rev.importo, revisioneProgressiva: revisioneProg,
      totaleEseguito, detrazioni, totaleContabilizzato, ritenuta, anticipazione, recuperoAnticipazione,
      nettoProgressivo, salPrecedenti: round2(nettoPrecedente), creditoSal, importoSal,
      iva: ivaImporto, totaleLordo: round2(importoSal + ivaImporto),
    })
    nettoPrecedente = round2(nettoPrecedente + importoSal)
  }
  return out
}

/** Risultato di un singolo SAL (l'ultimo di indice `numero`), o null se assente. */
export function calcolaSal(appalto: Appalto, partite: Partita[], sals: Sal[], numero: number, liste?: ListaEconomia[], perizie?: Perizia[]): SalResult | null {
  return calcolaSals(appalto, partite, sals, liste, perizie).find((s) => s.numero === numero) || null
}

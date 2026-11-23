/**
 * Dati del contratto riportati in testa a SAL e certificato di pagamento:
 * importo di progetto, ribasso, importo contrattuale, di cui costi della sicurezza,
 * ed eventuale importo aggiornato con le perizie di variante.
 */
import { escHtml } from '../../../shared/doc/doc'
import { eur, pctEsatta } from '../../../shared/format'
import type { Appalto, Partita } from './types'
import { ribassoPct, round2, totaleContrattuale, totaleContrattualeLavori } from './contabilita'
import { partiteVigenti } from './perizie'

export interface DatiContratto {
  /** Importo di progetto: lavori + sicurezza, prima del ribasso. */
  importoProgetto: number
  /** Costi della sicurezza (partite di sicurezza + oneri a parte), non ribassati. */
  sicurezza: number
  ribassoPct: number | null
  /** Importo contrattuale: lavori ribassati + sicurezza. */
  importoContratto: number
  /** Importo aggiornato con le perizie approvate (null se non ce ne sono). */
  importoConPerizie: number | null
  dataStipula?: string
  numeroContratto?: string
}

export function datiContratto(appalto: Appalto, partite: Partita[]): DatiContratto {
  const originali = partite.filter((p) => (p.introdottaSal ?? 1) <= 1)
  const oneri = appalto.oneriSicurezza || 0
  const sicurezza = round2(totaleContrattualeLavori(originali.filter((p) => p.sicurezza)).totale + oneri)
  // a prezzi unitari le partite portano i prezzi offerti: il progetto è la base di gara
  const importoProgetto = appalto.prezziUnitari && appalto.baseAsta != null
    ? round2(appalto.baseAsta + sicurezza)
    : round2(totaleContrattualeLavori(originali).totale + oneri)
  const rib = appalto.ribassoPct != null ? appalto.ribassoPct : ribassoPct(appalto.baseAsta, appalto.importoOfferta)
  const perizie = appalto.perizie || []
  return {
    importoProgetto, sicurezza, ribassoPct: rib,
    importoContratto: totaleContrattuale(appalto, originali),
    importoConPerizie: perizie.length ? totaleContrattuale(appalto, partiteVigenti(partite, perizie, Number.MAX_SAFE_INTEGER)) : null,
    dataStipula: appalto.dataStipula, numeroContratto: appalto.numeroContratto,
  }
}

/** Riquadro «Dati del contratto» per i documenti HTML (SAL, certificato). */
export function datiContrattoHTML(appalto: Appalto, partite: Partita[]): string {
  const d = datiContratto(appalto, partite)
  const kv = (k: string, v: string): string => `<div class="kv"><span>${k}</span><b>${v}</b></div>`
  // Un importo di contratto a zero non esiste: se è zero il dato manca, e si dice.
  const imp = (v?: number | null): string => (v == null || v === 0 ? '<i class="nd">non indicato</i>' : eur(v))
  const contratto = [d.numeroContratto ? `n. ${escHtml(d.numeroContratto)}` : '', d.dataStipula ? `del ${escHtml(d.dataStipula)}` : ''].filter(Boolean).join(' ')
  return `
    <h2 class="sec-h">Dati del contratto</h2>
    <div class="kvgrid">
      ${contratto ? kv('Contratto', contratto) : ''}
      ${kv('Importo di progetto (lavori + sicurezza)', imp(d.importoProgetto))}
      ${d.ribassoPct != null ? kv(appalto.prezziUnitari ? 'Ribasso risultante (offerta a prezzi unitari, già nei prezzi)' : 'Ribasso d\'asta', pctEsatta(d.ribassoPct)) : ''}
      ${kv('Importo contrattuale', imp(d.importoContratto))}
      ${kv('di cui costi della sicurezza (non soggetti a ribasso)', imp(d.sicurezza))}
      ${d.importoConPerizie != null ? kv('Importo aggiornato con le perizie di variante', eur(d.importoConPerizie)) : ''}
    </div>`
}

/**
 * Il ribasso d'asta NON è un dato ricavabile dalla contabilità: se non è stato
 * indicato, l'atto lo dice, perché un importo al lordo del ribasso letto come
 * netto è un errore di liquidazione. Non si suppone e non si azzera in silenzio.
 */
export function avvisoRibassoHTML(appalto: Appalto, partite: Partita[]): string {
  const d = datiContratto(appalto, partite)
  // Un ribasso fuori da 0–100 non è un ribasso: è quasi sempre un numero letto
  // male (il 5,086% diventato 5086%). Meglio fermarsi che liquidare.
  if (d.ribassoPct != null && (d.ribassoPct < 0 || d.ribassoPct >= 100)) {
    return `<p class="warn"><b>Ribasso d'asta non plausibile: ${escHtml(String(d.ribassoPct).replace('.', ','))}%.</b> Un ribasso sta fra 0 e 100: controlla il dato nei dati del contratto (se intendevi 5,086 per cento, scrivi 5,086 e non 5086). Gli importi che seguono sono calcolati con il valore inserito e non vanno liquidati.</p>`
  }
  if (appalto.prezziUnitari || d.ribassoPct != null) return ''
  return `<p class="warn"><b>Ribasso d'asta non indicato.</b> Gli importi che seguono sono al lordo del ribasso: finché il ribasso (o la base d'asta con l'importo di offerta) non è inserito nei dati del contratto, l'importo del presente stato non è quello da liquidare.</p>`
}


/**
 * DATI DEL CONTRATTO CHE LA CONTABILITÀ NON PUÒ CONOSCERE.
 *
 * Un libretto importato (XPWE o altro tracciato) porta misure, codici e prezzi:
 * non porta il ribasso d'asta, l'aliquota IVA, l'arrotondamento del certificato
 * né i tempi contrattuali. Sono dati del contratto, e senza di essi gli importi
 * liquidati sono sbagliati — non "incompleti": sbagliati. Questa funzione li
 * elenca perché l'applicazione li chieda, invece di lasciarli a zero in
 * silenzio. `critico` distingue ciò che falsa gli importi da ciò che manca
 * soltanto sugli atti.
 */
export interface DatoMancante { chiave: string; cosa: string; perche: string; critico: boolean }

export function datiMancanti(appalto: Appalto, partite: Partita[]): DatoMancante[] {
  const out: DatoMancante[] = []
  const d = datiContratto(appalto, partite)
  if (d.ribassoPct != null && (d.ribassoPct < 0 || d.ribassoPct >= 100)) {
    out.push({ chiave: 'ribassoPct', critico: true, cosa: `Ribasso d'asta non plausibile (${String(d.ribassoPct).replace('.', ',')}%)`, perche: 'un ribasso sta fra 0 e 100; con questo valore gli importi del certificato sono senza senso' })
  }
  if (!appalto.prezziUnitari && d.ribassoPct == null) {
    out.push({
      chiave: 'ribassoPct', critico: true, cosa: "Ribasso d'asta",
      perche: 'senza ribasso gli importi restano al lordo: il credito liquidato risulta più alto del dovuto',
    })
  }
  if (appalto.ivaPct == null) {
    out.push({ chiave: 'ivaPct', critico: true, cosa: 'Aliquota IVA', perche: 'in mancanza si assume il 10%, che non vale per tutti gli appalti' })
  }
  if (appalto.arrotondamentoCertificato == null) {
    out.push({ chiave: 'arrotondamentoCertificato', critico: false, cosa: 'Arrotondamento del certificato', perche: "se il contratto prevede il credito arrotondato (es. a 100 euro), l'importo certificato cambia" })
  }
  if (!appalto.oggetto?.trim()) out.push({ chiave: 'oggetto', critico: false, cosa: 'Oggetto dei lavori', perche: 'compare nella testata di ogni atto contabile' })
  if (!appalto.ente?.denominazione?.trim()) out.push({ chiave: 'ente', critico: false, cosa: 'Stazione appaltante', perche: "è la testata istituzionale dell'atto" })
  if (!appalto.impresa?.denominazione?.trim()) out.push({ chiave: 'impresa', critico: false, cosa: 'Impresa esecutrice', perche: 'il certificato di pagamento dispone il pagamento a suo favore' })
  if (!appalto.dataStipula || !appalto.numeroContratto) out.push({ chiave: 'dataStipula', critico: false, cosa: 'Contratto (data e repertorio)', perche: 'il certificato di pagamento lo richiama come titolo' })
  if (!appalto.dataConsegna && !appalto.dataInizio) out.push({ chiave: 'dataConsegna', critico: false, cosa: 'Data di consegna dei lavori', perche: 'apre i tempi contrattuali e la cronologia degli atti' })
  if (!appalto.giorniUtili && !appalto.dataUltimazionePrevista) out.push({ chiave: 'giorniUtili', critico: false, cosa: "Tempo utile per l'ultimazione", perche: "serve a verificare i termini e a calcolare l'eventuale penale" })
  if (!appalto.articoloCapitolato?.trim()) out.push({ chiave: 'articoloCapitolato', critico: false, cosa: 'Articolo del capitolato per il pagamento', perche: 'è la formula con cui il certificato autorizza la rata' })
  return out
}

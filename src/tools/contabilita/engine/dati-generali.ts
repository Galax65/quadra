/**
 * DATI GENERALI dell'appalto, riquadro di testa degli atti contabili (stato di
 * avanzamento, certificato di pagamento, conto finale): contratto e sua
 * registrazione, tempi (consegna, giorni utili, ultimazione, sospensioni) e
 * importi del quadro economico (progetto, somme a disposizione, sicurezza,
 * manodopera, varianti, anticipazione).
 *
 * I dati NON si inventano: le sospensioni si contano dai verbali di sospensione
 * e di ripresa effettivamente redatti, gli importi di variante dalle perizie
 * approvate. Ciò che non è noto resta in bianco, con il segnaposto, perché un
 * atto contabile deve far vedere anche quello che manca.
 */
import { escHtml } from '../../../shared/doc/doc'
import { eur, pctEsatta } from '../../../shared/format'
import type { Appalto, Partita, Verbale } from './types'
import { round2, totaleContrattuale, totaleContrattualeLavori } from './contabilita'
import { datiContratto } from './dati-contratto'
import { partiteVigenti } from './perizie'
import { tempi, tempiHTML } from './tempi'
/** Importi portati dalle perizie APPROVATE: lavori e sicurezza, al netto del contratto originario. */
export function importiVariante(appalto: Appalto, partite: Partita[]): { lavori: number; sicurezza: number } {
  const perizie = (appalto.perizie || []).filter((p) => p.approvata !== false)
  if (!perizie.length) return { lavori: 0, sicurezza: 0 }
  const originali = partite.filter((p) => (p.introdottaSal ?? 1) <= 1)
  const vigenti = partiteVigenti(partite, perizie, Number.MAX_SAFE_INTEGER)
  const sicO = totaleContrattualeLavori(originali.filter((p) => p.sicurezza)).totale
  const sicV = totaleContrattualeLavori(vigenti.filter((p) => p.sicurezza)).totale
  return {
    lavori: round2(totaleContrattuale(appalto, vigenti) - totaleContrattuale(appalto, originali) - (sicV - sicO)),
    sicurezza: round2(sicV - sicO),
  }
}

const ND = '<i class="nd">__/__/____</i>'
const kv = (k: string, v: string): string => `<div class="kv"><span>${escHtml(k)}</span><b>${v}</b></div>`
const data = (v?: string): string => (v ? escHtml(v) : ND)
const n = (v?: number | null): string => (v == null ? '<i class="nd">—</i>' : String(v))
/** Un importo di contratto a zero non esiste: se è zero il dato non c'è, e si dice. */
const imp = (v?: number | null): string => (v == null || v === 0 ? '<i class="nd">non indicato</i>' : eur(v))

/**
 * Riquadro «Dati generali» completo: due colonne, tempi a sinistra e importi a
 * destra, come d'uso sulla testata dello stato di avanzamento.
 */
export function datiGeneraliHTML(appalto: Appalto, partite: Partita[], verbali?: Verbale[], oggiIt?: string): string {
  const d = datiContratto(appalto, partite)
  // I tempi si calcolano in un posto solo: consegna, sospensioni, proroghe e
  // termine vigente vengono dal modulo dei tempi contrattuali, che li ricava
  // dagli atti. Qui si stampano, non si ricontano.
  const t = tempi(appalto, verbali, oggiIt)
  const vari = importiVariante(appalto, partite)
  const reg = appalto.registrazione || {}
  const contratto = [
    appalto.dataStipula ? `Contratto in data ${escHtml(appalto.dataStipula)}` : 'Contratto in data ' + ND,
    appalto.numeroContratto ? `rep. n. ${escHtml(appalto.numeroContratto)}` : 'rep. n. <i class="nd">—</i>',
    `registrato a ${reg.luogo ? escHtml(reg.luogo) : '<i class="nd">—</i>'} in data ${data(reg.data)} al n. ${reg.numero ? escHtml(reg.numero) : '<i class="nd">—</i>'}`,
    `di ${imp(d.importoContratto)}`,
  ].join(' ')
  return `
    <h2 class="sec-h">Dati generali</h2>
    <p class="note">${contratto}</p>
    <div class="kvgrid dg">
      ${kv('Data offerta', data(appalto.dataOfferta))}
      ${kv('Importo del progetto (lavori e sicurezza)', imp(d.importoProgetto))}
      ${kv('Data consegna', data(t.decorrenza))}
      ${kv('Somme a disposizione', imp(appalto.sommeADisposizione))}
      ${kv('Data inizio lavori', data(appalto.dataInizio))}
      ${kv('Importo per la sicurezza (non ribassato)', imp(d.sicurezza))}
      ${kv('Giorni utili per l\'ultimazione', n(t.giorniUtili))}
      ${kv('Importo per la manodopera', imp(appalto.importoManodopera))}
      ${kv('Data utile per l\'ultimazione', data(t.termineContrattuale))}
      ${kv('Importo di variante', vari.lavori || vari.sicurezza ? eur(round2(vari.lavori + vari.sicurezza)) : '<i class="nd">nessuna variante</i>')}
      ${kv('Giorni di sospensione', String(t.giorniSospensione) + (t.sospensioneAperta ? ' (in corso)' : ''))}
      ${kv('Importo per la sicurezza (variante)', vari.sicurezza ? eur(vari.sicurezza) : '<i class="nd">—</i>')}
      ${kv('Numero di sospensioni', String(t.sospensioni.length))}
      ${kv('Anticipazione', appalto.anticipazionePct ? eur(round2(d.importoContratto * appalto.anticipazionePct / 100)) : '<i class="nd">non prevista</i>')}
      ${kv('Nuova data di ultimazione', data(t.termineVigente))}
      ${kv('Ribasso d\'asta', d.ribassoPct == null ? '<i class="nd">non indicato</i>' : pctEsatta(d.ribassoPct))}
    </div>
    ${t.sospensioni.length || t.proroghe.length || t.ultimazione ? tempiHTML(t) : ''}`
}

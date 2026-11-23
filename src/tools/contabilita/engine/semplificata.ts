/**
 * Contabilità — CONTABILITÀ SEMPLIFICATA (art. 12 c. 11-bis All. II.14,
 * introdotto dall'art. 92 del D.Lgs. 209/2024).
 *
 * «Per i lavori di importo inferiore a 40.000 euro è consentita la tenuta di
 * una contabilità semplificata, previa verifica da parte del direttore dei
 * lavori della corrispondenza del lavoro svolto con quanto fatturato, tenendo
 * conto dei lavori effettivamente eseguiti. Il certificato di regolare
 * esecuzione può essere sostituito con l'apposizione del visto del direttore
 * dei lavori sulle fatture di spesa.»
 *
 * Due cose che il programma deve tenere ferme, perché è lì che si sbaglia:
 *  - la semplificazione vale **solo per i lavori**: servizi e forniture
 *    restano con il certificato di regolare esecuzione;
 *  - semplificata non vuol dire «senza»: il visto presuppone la **verifica**
 *    della corrispondenza fra fatturato ed eseguito, e quella verifica il DL
 *    la fa e la dichiara.
 */
import { renderDocPage, escHtml } from '../../../shared/doc/doc'
import { eur } from '../../../shared/format'
import type { Appalto, Fattura, ListaEconomia, Partita, Sal } from './types'
import { calcolaSals, totaleContrattuale } from './contabilita'
import { importoInLettere } from './certificato'
import { enteDi, footerFieldsDi, headMetaDi, kickerDi, firmeHTML, orTodo, ilDirettore, prestazioniDi } from './doc-common'

/** Soglia di importo sotto la quale la contabilità può essere semplificata. */
export const SOGLIA_SEMPLIFICATA = 40000

export interface AmmissibilitaSemplificata {
  ammessa: boolean
  /** Perché non è ammessa (vuoto quando lo è). */
  motivo: string
  /** Importo su cui si misura la soglia (contrattuale). */
  importo: number
}

/**
 * Se questo appalto può tenere la contabilità semplificata. Il confronto si fa
 * sull'importo contrattuale netto (la norma parla di lavori di importo
 * inferiore a 40.000 euro; l'IVA non è importo dei lavori).
 */
export function ammissibilitaSemplificata(appalto: Appalto, partite: Partita[]): AmmissibilitaSemplificata {
  const importo = totaleContrattuale(appalto, partite)
  if (appalto.tipologia && appalto.tipologia !== 'lavori') {
    return { ammessa: false, importo, motivo: `La semplificazione dell'art. 12 c. 11-bis vale per i lavori: per ${prestazioniDi(appalto)} il certificato di regolare esecuzione è sempre necessario.` }
  }
  if (!importo) return { ammessa: false, importo, motivo: "L'importo contrattuale non è ancora determinato: importa il computo o inserisci l'importo offerto." }
  if (importo >= SOGLIA_SEMPLIFICATA) {
    return { ammessa: false, importo, motivo: `L'importo contrattuale è di ${eur(importo)}: la contabilità semplificata è consentita sotto i ${eur(SOGLIA_SEMPLIFICATA)}.` }
  }
  return { ammessa: true, importo, motivo: '' }
}

/** Contabilità semplificata attiva e ammessa: è la condizione che cambia gli atti. */
export function inSemplificata(appalto: Appalto, partite: Partita[]): boolean {
  return !!appalto.contabilitaSemplificata && ammissibilitaSemplificata(appalto, partite).ammessa
}

/** Totale fatturato (imponibile) e totale vistato. */
export function totaliFatture(fatture?: Fattura[]): { fatturato: number; vistato: number; daVistare: number } {
  const l = fatture || []
  const fatturato = round2(l.reduce((s, f) => s + (f.importo || 0), 0))
  const vistato = round2(l.filter((f) => f.vistoData).reduce((s, f) => s + (f.importo || 0), 0))
  return { fatturato, vistato, daVistare: round2(fatturato - vistato) }
}

const round2 = (n: number): number => { const x = Math.abs(n) * 100; return Math.sign(n) * Math.round(Number(x.toPrecision(15))) / 100 }

/**
 * Scostamento fra ciò che è stato fatturato e ciò che risulta eseguito dalla
 * contabilità: è esattamente la verifica che la norma chiede al DL prima del
 * visto, e il programma la mette sotto gli occhi invece di lasciarla intendere.
 */
export function corrispondenza(appalto: Appalto, partite: Partita[], sals: Sal[], fatture?: Fattura[], liste?: ListaEconomia[]): { eseguito: number; fatturato: number; scostamento: number } {
  const res = calcolaSals(appalto, partite, sals, liste)
  const ultimo = res[res.length - 1]
  const eseguito = ultimo ? ultimo.totaleContabilizzato : 0
  const { fatturato } = totaliFatture(fatture)
  return { eseguito, fatturato, scostamento: round2(fatturato - eseguito) }
}

/**
 * IL VISTO DEL DIRETTORE DEI LAVORI SULLA FATTURA. Non è un timbro: è una
 * dichiarazione che la lavorazione fatturata è stata eseguita a regola d'arte
 * e che l'importo corrisponde ai lavori effettivamente eseguiti. Dove il visto
 * sostituisce il certificato di regolare esecuzione, l'atto lo dice.
 */
export function vistoFatturaHTML(appalto: Appalto, f: Fattura, partite: Partita[], sals: Sal[], fatture?: Fattura[], liste?: ListaEconomia[]): string {
  const c = corrispondenza(appalto, partite, sals, fatture, liste)
  const imp = f.importo ?? null
  const am = ammissibilitaSemplificata(appalto, partite)
  const body = `
    ${am.ammessa ? '' : `<p class="note"><b>Attenzione:</b> ${escHtml(am.motivo)} Il presente visto non può sostituire il certificato di regolare esecuzione.</p>`}
    <p class="prose">Il sottoscritto ${escHtml(ilDirettore(appalto).toLowerCase())} dei lavori di <b>${orTodo(appalto.oggetto)}</b>, affidati all'impresa <b>${orTodo(appalto.impresa?.denominazione)}</b>${appalto.numeroContratto ? ` con contratto n. ${escHtml(appalto.numeroContratto)}` : ''}${appalto.dataStipula ? ` del ${escHtml(appalto.dataStipula)}` : ''},</p>
    <p class="prose">VISTA la fattura n. <b>${orTodo(f.numero)}</b>${f.data ? ` del <b>${escHtml(f.data)}</b>` : ''}, di importo imponibile <b>${imp == null ? '—' : eur(imp)}</b>${imp != null ? ` (diconsi euro ${escHtml(importoInLettere(imp))})` : ''}${f.oggetto ? `, relativa a ${escHtml(f.oggetto)}` : ''};</p>
    <p class="prose">VERIFICATA la corrispondenza del lavoro svolto con quanto fatturato, tenuto conto dei lavori effettivamente eseguiti;</p>
    <h2 class="sec-h">Verifica della corrispondenza</h2>
    <table class="dtable"><tbody>
      <tr><td>Lavori contabilizzati a tutto l'ultimo stato di avanzamento</td><td class="num">${eur(c.eseguito)}</td></tr>
      <tr><td>Totale fatturato dall'impresa (imponibile)</td><td class="num">${eur(c.fatturato)}</td></tr>
      <tr class="tot"><td>Scostamento fra fatturato ed eseguito</td><td class="num">${c.scostamento === 0 ? 'nessuno' : (c.scostamento > 0 ? '+ ' : '− ') + eur(Math.abs(c.scostamento))}</td></tr>
    </tbody></table>
    ${c.scostamento > 0.004 ? `<p class="note">Il fatturato eccede l'eseguito di ${eur(c.scostamento)}: il visto va apposto solo per la parte corrispondente ai lavori effettivamente eseguiti.</p>` : ''}
    ${f.rilievi ? `<h2 class="sec-h">Rilievi</h2><p class="prose">${escHtml(f.rilievi)}</p>` : ''}
    <h2 class="sec-h">Visto</h2>
    <p class="prose">DICHIARA che i lavori fatturati sono stati eseguiti a regola d'arte ed entro i termini contrattuali, e che l'importo fatturato corrisponde ai lavori effettivamente eseguiti; appone pertanto il proprio <b>VISTO</b> sulla fattura sopra indicata${f.vistoData ? `, in data <b>${escHtml(f.vistoData)}</b>` : ''}.</p>
    ${f.sostituisceCre ? `<p class="prose">Ai sensi dell'articolo 12, comma 11-bis, dell'Allegato II.14 al D.Lgs. 36/2023, il presente visto <b>sostituisce il certificato di regolare esecuzione</b>.</p>` : `<p class="prose">Il presente visto attiene al pagamento della fattura e <b>non sostituisce</b> il certificato di regolare esecuzione, che resta da emettere.</p>`}
    ${firmeHTML([{ ruolo: ilDirettore(appalto), nome: appalto.direttoreLavori }, { ruolo: 'Il Responsabile Unico del Procedimento', nome: appalto.rup }])}
  `
  return renderDocPage({
    tool: 'contabilita', brand: 'none', enteHeader: enteDi(appalto),
    kicker: kickerDi(appalto, `Visto fattura ${f.numero || ''}`.trim()),
    title: 'Visto del Direttore dei Lavori sulla fattura',
    sub: f.numero ? `fattura n. ${f.numero}${f.data ? ' del ' + f.data : ''}` : undefined,
    headMeta: headMetaDi(appalto),
    bodyHTML: body,
    footer: {
      fields: footerFieldsDi(appalto),
      disc: `Art. 12 c. 11-bis Allegato II.14 D.Lgs. 36/2023: contabilità semplificata per i lavori di importo inferiore a ${eur(SOGLIA_SEMPLIFICATA)}; il visto può sostituire il certificato di regolare esecuzione.`,
      page: 'Visto su fattura',
    },
    docTitle: `Visto del DL — fattura ${f.numero || ''}`.trim(),
  })
}

/**
 * Dichiarazione da stampare in testa agli atti quando la contabilità è tenuta
 * in forma semplificata: chi legge deve sapere perché gli atti sono quelli che
 * sono, e con quale norma.
 */
export function notaSemplificata(appalto: Appalto, partite: Partita[]): string {
  if (!inSemplificata(appalto, partite)) return ''
  const { importo } = ammissibilitaSemplificata(appalto, partite)
  return `<p class="note"><b>Contabilità semplificata</b> — lavori di importo contrattuale pari a ${eur(importo)}, inferiore a ${eur(SOGLIA_SEMPLIFICATA)}: la contabilità è tenuta in forma semplificata ai sensi dell'art. 12 c. 11-bis dell'Allegato II.14 al D.Lgs. 36/2023, previa verifica della corrispondenza fra il lavoro svolto e quanto fatturato.</p>`
}

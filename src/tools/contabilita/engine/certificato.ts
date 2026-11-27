/**
 * Contabilità — CERTIFICATO DI PAGAMENTO (art. 125 c. 1 D.Lgs. 36/2023; art. 12 c. 1 lett. d) All. II.14). Emesso dal RUP entro
 * 7 giorni dal SAL, previa verifica della regolarità contributiva (DURC). Il
 * credito dell'impresa coincide col netto del SAL.
 */
import { renderDocPage, escHtml } from '../../../shared/doc/doc'
import { eur, num, pct, pctEsatta } from '../../../shared/format'
import type { Appalto, Partita, Sal, ListaEconomia } from './types'
import { datiContrattoHTML, avvisoRibassoHTML } from './dati-contratto'
import { calcolaSals } from './contabilita'
import { enteDi, footerFieldsDi, kickerDi, firmeHTML, orTodo } from './doc-common'
import { giorniTra, itToISO } from '../../../shared/date-it'
import { notaSemplificata } from './semplificata'

/** Importo in lettere (euro) — "Diconsi". Deterministico, italiano. */
export function importoInLettere(n: number): string {
  const euro = Math.floor(Math.abs(n))
  const cent = Math.round((Math.abs(n) - euro) * 100)
  const u = ['zero', 'uno', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove', 'dieci', 'undici', 'dodici', 'tredici', 'quattordici', 'quindici', 'sedici', 'diciassette', 'diciotto', 'diciannove']
  const d = ['', '', 'venti', 'trenta', 'quaranta', 'cinquanta', 'sessanta', 'settanta', 'ottanta', 'novanta']
  const dueCifre = (x: number): string => {
    if (x < 20) return u[x]
    const dec = Math.floor(x / 10), un = x % 10
    let base = d[dec]
    if (un === 1 || un === 8) base = base.slice(0, -1)
    return base + (un ? u[un] : '')
  }
  const treCifre = (x: number): string => {
    if (x < 100) return dueCifre(x)
    const cen = Math.floor(x / 100), resto = x % 100
    const pref = cen === 1 ? 'cento' : u[cen] + 'cento'
    return pref + (resto ? dueCifre(resto) : '')
  }
  const gruppi = (x: number): string => {
    if (x === 0) return 'zero'
    if (x < 1000) return treCifre(x)
    const migl = Math.floor(x / 1000), resto = x % 1000
    const pref = migl === 1 ? 'mille' : treCifre(migl) + 'mila'
    return pref + (resto ? treCifre(resto) : '')
  }
  const segno = n < 0 ? 'meno ' : ''
  return `${segno}${gruppi(euro)}/${String(cent).padStart(2, '0')}`
}

/**
 * CERTIFICATI PRECEDENTI: il certificato di pagamento li richiama uno per uno
 * (numero, data, importo), perché il credito del presente è la differenza sul
 * progressivo già certificato. Senza l'elenco, la detrazione «certificati
 * precedenti» non è verificabile da chi legge l'atto.
 */
function precedentiHTML(appalto: Appalto, partite: Partita[], sals: Sal[], numero: number, liste?: ListaEconomia[]): string {
  const res = calcolaSals(appalto, partite, sals, liste).filter((r) => r.numero < numero)
  if (!res.length) return ''
  const rows = res.map((r) => {
    const s = sals.find((x) => x.numero === r.numero)
    return `<tr><td class="num">${escHtml(String(s?.numeroCertificato ?? r.numero))}</td><td>${s?.dataCertificato ? escHtml(s.dataCertificato) : '<i class="nd">—</i>'}</td><td class="num">${eur(r.importoSal)}</td></tr>`
  }).join('')
  const tot = res.reduce((a, r) => a + r.importoSal, 0)
  return `
    <h2 class="sec-h">Certificati precedenti</h2>
    <table class="dtable">
      <thead><tr><th class="num">Cert. n.</th><th>Data</th><th class="num">Importo</th></tr></thead>
      <tbody>${rows}<tr class="tot"><td colspan="2">Ammontare dei certificati precedenti</td><td class="num">${eur(Math.round(tot * 100) / 100)}</td></tr></tbody>
    </table>`
}

export function certificatoHTML(appalto: Appalto, partite: Partita[], sals: Sal[], numero: number, liste?: ListaEconomia[]): string {
  const semplificata = notaSemplificata(appalto, partite)
  const results = calcolaSals(appalto, partite, sals, liste)
  const res = results.find((s) => s.numero === numero)
  const credito = res ? res.importoSal : 0
  const art = appalto.articoloCapitolato || ''
  const body = `
    ${semplificata}
    <p class="prose">VISTO il contratto d'appalto per l'esecuzione dei lavori di <b>${orTodo(appalto.oggetto)}</b>${appalto.dataStipula ? `, stipulato in data ${escHtml(appalto.dataStipula)}` : ''};</p>
    <p class="prose">RISULTANDO dalla contabilità che i lavori e le somministrazioni eseguiti a tutto lo Stato di Avanzamento n. ${escHtml(String(numero))}${res?.data ? ` (${escHtml(res.data)})` : ''} ammontano alle somme di seguito riportate;</p>

    ${avvisoRibassoHTML(appalto, partite)}
    ${datiContrattoHTML(appalto, partite)}
    ${precedentiHTML(appalto, partite, sals, numero, liste)}
    <h2 class="sec-h">Determinazione del credito</h2>
    <table class="dtable"><tbody>
      <tr><td>Lavori eseguiti a tutto il SAL n. ${escHtml(String(numero))}</td><td class="num">${eur(res?.lavoriEseguiti ?? null)}</td></tr>
      ${res?.ribassoImporto ? `<tr><td>a dedurre: ribasso d'asta ${pctEsatta(res.ribassoPct)}</td><td class="num">− ${eur(res.ribassoImporto)}</td></tr>` : ''}
      ${res?.oneriSicurezzaEseguiti ? `<tr><td>costi della sicurezza (non soggetti a ribasso)</td><td class="num">${eur(res.oneriSicurezzaEseguiti)}</td></tr>` : ''}
      ${res?.detrazioni ? `<tr><td>a dedurre: detrazioni per lavorazioni non conformi</td><td class="num">− ${eur(res.detrazioni)}</td></tr>` : ''}
      <tr><td>Totale contabilizzato a tutto il SAL n. ${escHtml(String(numero))}</td><td class="num">${eur(res?.totaleContabilizzato ?? null)}</td></tr>
      ${res?.revisioneProgressiva ? `<tr><td>di cui compensazione per revisione prezzi (art. 60), a tutto il SAL${res.variazioneIndicePct != null ? ` — variazione indice ${num(res.variazioneIndicePct)}%` : ''}</td><td class="num">${eur(res.revisioneProgressiva)}</td></tr>` : ''}
      <tr><td>a dedurre: ritenuta di garanzia 0,50% (art. 11 c. 6)</td><td class="num">− ${eur(res?.ritenuta ?? null)}</td></tr>
      ${res?.anticipazione ? `<tr><td>a dedurre: recupero dell'anticipazione (progressivo, art. 125 c.1)</td><td class="num">− ${eur(res.recuperoAnticipazione)}</td></tr>` : ''}
      <tr><td>a dedurre: certificati / SAL precedenti</td><td class="num">− ${eur(res?.salPrecedenti ?? null)}</td></tr>
      ${res && res.creditoSal !== res.importoSal ? `<tr><td>credito dell'impresa</td><td class="num">${eur(res.creditoSal)}</td></tr><tr><td>credito arrotondato per difetto a ${eur(appalto.arrotondamentoCertificato ?? 0)} (la differenza matura nei certificati successivi)</td><td class="num">${eur(res.importoSal)}</td></tr>` : ''}
      <tr class="tot"><td>CREDITO dell'impresa (netto IVA)</td><td class="num">${eur(credito)}</td></tr>
      <tr><td>IVA ${pct(appalto.ivaPct == null ? 10 : appalto.ivaPct, 0)}</td><td class="num">${eur(res?.iva ?? null)}</td></tr>
      <tr class="sub"><td>TOTALE GENERALE (lordo)</td><td class="num">${eur(res?.totaleLordo ?? null)}</td></tr>
    </tbody></table>

    ${termineHTML(sals.find((x) => x.numero === numero))}
    <p class="prose" style="margin-top:6mm">Il RUP, verificata la regolarità contributiva (DURC) dell'esecutore e dei subappaltatori,
    <b>CERTIFICA</b> che ai termini dell'articolo ${orTodo(art)} del capitolato speciale d'appalto si può pagare all'impresa
    <b>${orTodo(appalto.impresa?.denominazione)}</b> la rata di <b>${eur(credito)}</b> oltre IVA.</p>
    <p class="prose"><i>Diconsi euro ${escHtml(importoInLettere(credito))} oltre IVA.</i></p>

    ${firmeHTML([{ ruolo: 'Il Responsabile Unico del Procedimento', nome: appalto.rup }])}
  `
  return renderDocPage({
    tool: 'contabilita', brand: 'none', enteHeader: enteDi(appalto),
    kicker: kickerDi(appalto, `Certificato ${numero}`),
    title: `Certificato di Pagamento n. ${sals.find((x) => x.numero === numero)?.numeroCertificato ?? numero}`,
    sub: `per il pagamento della rata relativa al SAL n. ${numero}`,
    headMeta: [{ k: 'SAL', v: escHtml(String(numero)) }, { k: 'CIG', v: escHtml(appalto.cig || '—') }],
    bodyHTML: body,
    footer: { fields: footerFieldsDi(appalto), disc: 'Art. 125 c. 1 D.Lgs. 36/2023; art. 12 c. 1 lett. d) Allegato II.14 — emesso dal RUP, previa verifica della regolarità contributiva (DURC), e annotato nel registro di contabilità.', page: `Certificato ${numero}` },
    docTitle: `Certificato di Pagamento n. ${numero}`,
  })
}

/**
 * I TERMINI, SULL'ATTO. Il certificato di pagamento non è solo un importo: è un
 * atto che ha una data e che apre il termine di pagamento. Scriverli sul foglio
 * serve a chi lo riceve (e a chi, mesi dopo, deve ricostruire perché una rata è
 * stata pagata tardi). Se la data non c'è, il certificato lo dichiara invece di
 * far finta che sia quella del SAL.
 */
function termineHTML(sal?: Sal): string {
  if (!sal) return ''
  const g = giorniTra(itToISO(sal.data), itToISO(sal.dataCertificato))
  const emesso = sal.dataCertificato
    ? `Il presente certificato è emesso in data <b>${escHtml(sal.dataCertificato)}</b>${g != null ? ` (${escHtml(String(g))} giorni dall'adozione dello stato di avanzamento${g > 7 ? ', oltre il termine di sette giorni' : ''})` : ''}.`
    : `La data di emissione del presente certificato non è stata indicata: il termine di sette giorni dall'adozione dello stato di avanzamento (art. 12 c. 1 lett. d) All. II.14) non è verificabile.`
  const pagato = sal.dataPagamento
    ? ` Pagamento disposto in data ${escHtml(sal.dataPagamento)}.`
    : ''
  return `<p class="note">${emesso}${pagato} Il pagamento è disposto entro trenta giorni dall'adozione dello stato di avanzamento, salvo il diverso termine pattuito e giustificato nel contratto e comunque non superiore a sessanta (art. 125 D.Lgs. 36/2023). La ritenuta dello 0,50% operata sull'importo netto progressivo si svincola in sede di liquidazione finale, dopo l'approvazione del certificato di collaudo o di regolare esecuzione, previo documento unico di regolarità contributiva.</p>`
}

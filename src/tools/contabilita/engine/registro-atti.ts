/**
 * Contabilità — REGISTRO DEGLI ATTI PRODOTTI (All. II.14 art. 12 c. 10).
 *
 * La contabilità tenuta con strumenti informatici deve garantire autenticità e
 * provenienza dei dati. Questo registro è il libro mastro di ciò che il programma
 * ha prodotto: ogni atto stampato con data, SAL di riferimento e **impronta**, e i
 * **sigilli** dei SAL firmati con l'esito della verifica.
 *
 * È un documento di servizio, non un atto contabile: dichiara chi ha prodotto che
 * cosa e quando, e dice se un fascicolo firmato è ancora quello di allora.
 */
import type { Appalto, Consegna, Sal } from './types'
import { renderDocPage, escHtml as esc } from '../../../shared/doc/doc'
import { enteDi, footerFieldsDi, headMetaDi, kickerDi, firmeHTML, ilDirettore } from './doc-common'
import { ALGO_IMPRONTA, ESITO_LABEL, improntaCorta, type Verifica } from './impronta'

const dataOra = (ts: number): string => new Date(ts).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })

export function registroAttiHTML(appalto: Appalto, consegne: Consegna[], sals: Sal[], verifiche: Verifica[] = []): string {
  const atti = [...(consegne || [])].sort((a, b) => a.ts - b.ts)
  const righe = atti.length
    ? atti.map((c, i) => `<tr>
        <td class="code">${i + 1}</td>
        <td>${esc(c.label)}</td>
        <td class="num">${c.salNumero ? `n. ${c.salNumero}` : ''}</td>
        <td class="num">${esc(c.data || '')}</td>
        <td class="num">${esc(dataOra(c.ts))}</td>
        <td class="code">${esc(improntaCorta(c.impronta))}</td>
      </tr>`).join('')
    : '<tr class="empty"><td colspan="6">Nessun atto ancora prodotto.</td></tr>'

  const firmati = (sals || []).filter((s) => s.firmato || s.impronta).sort((a, b) => a.numero - b.numero)
  const esitoDi = (n: number): Verifica | undefined => verifiche.find((v) => v.salNumero === n)
  const sigilli = firmati.length
    ? firmati.map((s) => {
      const v = esitoDi(s.numero)
      const allarme = v?.esito === 'modificato'
      return `<tr${allarme ? ' class="tot"' : ''}>
        <td class="code">SAL n. ${s.numero}${s.firmato ? '' : '<span class="sub">sbloccato</span>'}</td>
        <td class="num">${esc(s.dataFirma || '')}</td>
        <td class="code">${esc(improntaCorta(s.impronta))}</td>
        <td>${esc(s.improntaAlgo || (s.impronta ? ALGO_IMPRONTA : '—'))}</td>
        <td>${v ? esc(ESITO_LABEL[v.esito]) : 'non verificato'}</td>
        <td class="num">${s.sblocchi?.length ? `${s.sblocchi.length}` : ''}</td>
      </tr>`
    }).join('')
    : '<tr class="empty"><td colspan="6">Nessun fascicolo sigillato: il sigillo si appone alla firma del SAL.</td></tr>'

  const modificati = verifiche.filter((v) => v.esito === 'modificato')
  const body = `
    <p class="note">Registro di servizio della contabilità informatica: elenco degli atti prodotti e sigilli dei fascicoli firmati. L'impronta è l'hash ${esc(ALGO_IMPRONTA)} del contenuto: due fascicoli con la stessa impronta sono lo stesso fascicolo; se cambia una virgola, l'impronta cambia.</p>
    <h2 class="sec-h" data-n="1">Atti prodotti</h2>
    <table class="dtable">
      <thead><tr><th>N.</th><th>Atto</th><th class="num">SAL</th><th class="num">Data dell'atto</th><th class="num">Prodotto il</th><th>Impronta</th></tr></thead>
      <tbody>${righe}</tbody>
    </table>
    <h2 class="sec-h" data-n="2">Sigilli dei SAL firmati</h2>
    <table class="dtable">
      <thead><tr><th>Fascicolo</th><th class="num">Firmato il</th><th>Impronta al sigillo</th><th>Algoritmo</th><th>Verifica</th><th class="num">Sblocchi</th></tr></thead>
      <tbody>${sigilli}</tbody>
    </table>
    ${modificati.length
      ? `<p class="note" style="border-left-color:#b02a7a"><b>Attenzione:</b> ${modificati.length === 1 ? 'il fascicolo del' : 'i fascicoli dei'} SAL ${modificati.map((v) => `n. ${v.salNumero}`).join(', ')} ${modificati.length === 1 ? 'risulta' : 'risultano'} modificat${modificati.length === 1 ? 'o' : 'i'} dopo la firma. Le modifiche successive alla firma vanno motivate e, se incidono sul credito, riportate in un SAL successivo o in una perizia.</p>`
      : ''}
    <p class="note">L'impronta attesta che i dati non sono cambiati; <b>non</b> è una firma digitale e non sostituisce la sottoscrizione degli atti da parte del Direttore dei Lavori e del RUP.</p>
    ${firmeHTML([{ ruolo: ilDirettore(appalto), nome: appalto.direttoreLavori }, { ruolo: 'Il RUP', nome: appalto.rup }])}`

  return renderDocPage({
    tool: 'contabilita', brand: 'none', enteHeader: enteDi(appalto),
    kicker: kickerDi(appalto, 'Registro degli atti'),
    title: 'Registro degli atti prodotti',
    sub: 'Contabilità informatica — autenticità e provenienza dei dati',
    headMeta: headMetaDi(appalto),
    bodyHTML: body,
    footer: { fields: footerFieldsDi(appalto), disc: `Allegato II.14 art. 12 c. 10 D.Lgs. 36/2023 — contabilità con strumenti informatici. Impronte ${ALGO_IMPRONTA}.`, page: 'Registro degli atti' },
    docTitle: `Registro degli atti — ${appalto.oggetto || 'Lavori'}`,
  })
}

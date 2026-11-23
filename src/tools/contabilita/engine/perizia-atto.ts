/**
 * LA PERIZIA DI VARIANTE come ATTO (art. 120 D.Lgs. 36/2023; art. 5 All. II.14).
 *
 * Il quadro comparativo è uno degli elaborati della perizia, non la perizia: è
 * la tabella che mette a confronto contratto e variante. L'atto è la relazione
 * che dice PERCHÉ si varia — e la motivazione non è una formalità: è ciò che
 * rende legittima la variante — che cosa cambia, di quanto, entro quale limite,
 * e con quali nuovi prezzi.
 */
import { renderDocPage, escHtml } from '../../../shared/doc/doc'
import { eur, pctEsatta } from '../../../shared/format'
import type { Appalto, Partita, Perizia } from './types'
import { enteDi, footerFieldsDi, headMetaDi, kickerDi, firmeHTML, ilDirettore } from './doc-common'
import { quadroComparativo, periziaApprovata } from './perizie'
import { quadroEconomicoPerizia, formaAtto, FORMA_LABEL } from './sottomissione'
import { datiContrattoHTML } from './dati-contratto'

/** Le fattispecie dell'art. 120 c. 1: la motivazione dice a quale ci si richiama. */
export const CASI_VARIANTE: { id: string; testo: string }[] = [
  { id: 'a', testo: 'per le modifiche previste nei documenti di gara iniziali in clausole chiare, precise e inequivocabili' },
  { id: 'b', testo: 'per lavori supplementari divenuti necessari e non inclusi nell\'appalto iniziale' },
  { id: 'c', testo: 'per circostanze impreviste e imprevedibili, comprese nuove disposizioni legislative o provvedimenti di autorità' },
  { id: 'd', testo: 'per la sostituzione del contraente originario' },
  { id: 'e', testo: 'per modifiche non sostanziali ai sensi del comma 3' },
  { id: 'f', testo: 'per modifiche di valore inferiore alle soglie del comma 2' },
]

export function periziaHTML(appalto: Appalto, partite: Partita[], pz: Perizia): string {
  const q = quadroComparativo(partite, appalto.perizie, pz)
  const qe = quadroEconomicoPerizia(appalto, partite, pz)
  const np = partite.filter((p) => p.np?.periziaN === pz.numero)
  const variate = q.righe.filter((r) => Math.abs(r.differenza) >= 0.005)
  const forma = formaAtto(partite, appalto, pz)
  const stato = periziaApprovata(pz)
    ? `<p class="note">Perizia <b>approvata</b>: le nuove quantità e i nuovi importi sono contratto dallo stato di avanzamento n. ${escHtml(String(pz.dalSal))} in poi. Gli avanzamenti precedenti restano sul contratto di allora.</p>`
    : `<p class="warn"><b>Perizia in bozza.</b> Finché non è approvata non cambia il contratto: le quantità che seguono sono una proposta, e i nuovi prezzi restano in conto provvisorio.</p>`
  const righeQE = qe.map((r) => `<tr${r.voce.startsWith('Totale') ? ' class="tot"' : ''}>
      <td>${escHtml(r.voce)}${r.nota ? `<span class="sub">${escHtml(r.nota)}</span>` : ''}</td>
      <td class="num">${r.prima == null ? '—' : eur(r.prima)}</td>
      <td class="num">${r.dopo == null ? '—' : eur(r.dopo)}</td>
      <td class="num">${r.prima == null || r.dopo == null ? '—' : eur(Math.round((r.dopo - r.prima) * 100) / 100)}</td>
    </tr>`).join('')
  const body = `
    ${stato}
    ${datiContrattoHTML(appalto, partite)}
    <h2 class="sec-h">Motivazione della variante</h2>
    ${pz.motivazione
      ? `<p class="prose">${escHtml(pz.motivazione)}</p>`
      : `<p class="warn"><b>Motivazione non indicata.</b> Una variante si ammette solo nei casi dell'art. 120 c. 1 D.Lgs. 36/2023, e il provvedimento deve dirne la ragione: senza motivazione l'atto non è completo.</p>`}
    ${pz.oggetto ? `<p class="prose"><b>Oggetto della variante:</b> ${escHtml(pz.oggetto)}</p>` : ''}
    <h2 class="sec-h">Che cosa cambia</h2>
    <p class="prose">La perizia interessa <b>${variate.length}</b> ${variate.length === 1 ? 'lavorazione' : 'lavorazioni'} su ${q.righe.length}, con aumenti per ${eur(q.aumenti)} e diminuzioni per ${eur(q.diminuzioni)}${np.length ? `, e introduce ${np.length} nuov${np.length === 1 ? 'o prezzo' : 'i prezzi'}` : ''}. Il dettaglio voce per voce è nel <b>quadro comparativo</b> allegato.</p>
    <table class="dtable"><tbody>
      <tr><td>Importo contrattuale vigente</td><td class="num">${eur(q.totalePrima)}</td></tr>
      <tr><td>Importo di perizia</td><td class="num">${eur(q.totaleDopo)}</td></tr>
      <tr class="tot"><td>Variazione${q.variazionePct == null ? '' : ` (${pctEsatta(q.variazionePct)})`}</td><td class="num">${eur(q.differenza)}</td></tr>
    </tbody></table>
    ${q.variazioneSuContrattoPct != null ? `<p class="${q.oltreQuinto ? 'warn' : 'note'}">Variazione sul contratto originario: <b>${pctEsatta(q.variazioneSuContrattoPct)}</b>.${q.oltreQuinto
      ? ` Oltre il quinto d'obbligo: l'esecutore non è tenuto a eseguirla agli stessi patti e prezzi, e occorre un <b>${escHtml(FORMA_LABEL[forma].toLowerCase())}</b> (art. 120 c. 9).`
      : " Entro il quinto d'obbligo: l'esecutore è tenuto a eseguire le modifiche agli stessi patti e prezzi (art. 5 c. 6 All. II.14)."}</p>` : ''}
    <h2 class="sec-h">Quadro economico di raffronto</h2>
    <table class="dtable">
      <thead><tr><th>Voce</th><th class="num">Contratto vigente</th><th class="num">Perizia</th><th class="num">Differenza</th></tr></thead>
      <tbody>${righeQE}</tbody>
    </table>
    ${np.length ? `
    <h2 class="sec-h">Nuovi prezzi introdotti</h2>
    <table class="dtable">
      <thead><tr><th>Codice</th><th>Designazione</th><th class="num">U.M.</th><th class="num">Prezzo</th></tr></thead>
      <tbody>${np.map((p) => `<tr><td class="code">${escHtml(p.codice)}</td><td>${escHtml(p.descrizione)}</td><td class="num">${escHtml(p.um || '')}</td><td class="num">${eur(p.prezzoUnitario || 0)}</td></tr>`).join('')}</tbody>
    </table>
    <p class="note">I nuovi prezzi si concordano con l'esecutore prima di contabilizzarli: il verbale di concordamento è atto a sé.</p>` : ''}
    <h2 class="sec-h">Elaborati della perizia</h2>
    <ul class="prose">
      <li>Quadro comparativo delle lavorazioni (contratto / perizia / differenza)</li>
      ${np.length ? '<li>Elenco dei nuovi prezzi, con la derivazione di ciascuno</li>' : ''}
      <li>${escHtml(FORMA_LABEL[forma])}, da sottoscrivere con l'esecutore</li>
    </ul>
    ${firmeHTML([{ ruolo: ilDirettore(appalto), nome: appalto.direttoreLavori }, { ruolo: 'Il RUP', nome: appalto.rup }])}`
  return renderDocPage({
    tool: 'contabilita', brand: 'none', enteHeader: enteDi(appalto),
    kicker: kickerDi(appalto, `Perizia di variante n. ${pz.numero}`),
    title: `Perizia di Variante n. ${pz.numero}`,
    sub: `in vigore dallo stato di avanzamento n. ${pz.dalSal}${pz.data ? ` · ${pz.data}` : ''}`,
    headMeta: headMetaDi(appalto),
    bodyHTML: body,
    footer: { fields: footerFieldsDi(appalto), disc: 'Art. 120 D.Lgs. 36/2023 e art. 5 Allegato II.14. Importi al netto di IVA salvo dove indicato.', page: `Perizia n. ${pz.numero}` },
    docTitle: `Perizia di variante n. ${pz.numero}`,
  })
}

/**
 * Contabilità — ATTO DI SOTTOMISSIONE / ATTO AGGIUNTIVO e QUADRO ECONOMICO
 * DELLA PERIZIA.
 *
 * Una perizia di variante non si esaurisce nel quadro comparativo: va
 * accompagnata dall'atto con cui l'esecutore si impegna a eseguirla, e la
 * forma di quell'atto dipende da quanto vale la variazione.
 *
 *  - **entro il quinto d'obbligo** (variazione cumulata fino al 20%
 *    dell'importo originario, art. 120 c. 9 D.Lgs. 36/2023): la perizia è
 *    accompagnata da un **atto di sottomissione**, UNILATERALE, che
 *    l'esecutore è tenuto a sottoscrivere in segno di accettazione o di
 *    motivato dissenso (art. 5 c. 6 All. II.14). L'esecutore è obbligato a
 *    eseguire agli stessi patti, prezzi e condizioni del contratto
 *    originario, salvi i nuovi prezzi concordati;
 *  - **oltre il quinto**: non basta più imporre, serve un **atto aggiuntivo**
 *    BILATERALE, cioè un vero accordo.
 *
 * Il quadro economico si aggiorna di conseguenza: cambia l'importo dei
 * lavori, e con esso l'IVA e le somme a disposizione.
 */
import { renderDocPage, escHtml } from '../../../shared/doc/doc'
import { eur, pct } from '../../../shared/format'
import type { Appalto, Partita, Perizia } from './types'
import { quadroComparativo } from './perizie'
import { importoInLettere } from './certificato'
import { enteDi, footerFieldsDi, headMetaDi, kickerDi, firmeHTML, orTodo, ilDirettore } from './doc-common'

/** La forma dell'atto che accompagna la perizia. */
export type FormaAtto = 'sottomissione' | 'aggiuntivo'

export const FORMA_LABEL: Record<FormaAtto, string> = {
  sottomissione: 'Atto di sottomissione',
  aggiuntivo: 'Atto aggiuntivo al contratto',
}

/**
 * Quale atto serve: sottomissione entro il quinto, aggiuntivo oltre. La soglia
 * si misura sulla variazione CUMULATA rispetto al contratto originario, non
 * sulla singola perizia: è così che si somma il quinto d'obbligo.
 */
export function formaAtto(partite: Partita[], appalto: Appalto, pz: Perizia): FormaAtto {
  return quadroComparativo(partite, appalto.perizie, pz).oltreQuinto ? 'aggiuntivo' : 'sottomissione'
}

/** Righe del quadro economico aggiornato dalla perizia. */
export interface RigaQE { voce: string; prima: number | null; dopo: number | null; nota?: string }

/**
 * QUADRO ECONOMICO della perizia: lavori prima e dopo, IVA ricalcolata, e le
 * somme a disposizione lasciate dichiaratamente **da confermare** — Quadra non
 * le conosce (stanno nel quadro economico del progetto, non negli atti
 * contabili) e non se le inventa.
 */
export function quadroEconomicoPerizia(appalto: Appalto, partite: Partita[], pz: Perizia): RigaQE[] {
  const q = quadroComparativo(partite, appalto.perizie, pz)
  const ivaPct = appalto.ivaPct == null ? 10 : appalto.ivaPct
  const ivaPrima = round2(q.totalePrima * ivaPct / 100)
  const ivaDopo = round2(q.totaleDopo * ivaPct / 100)
  return [
    { voce: 'Lavori (compresi gli oneri della sicurezza)', prima: q.totalePrima, dopo: q.totaleDopo },
    { voce: `IVA sui lavori ${pct(ivaPct, 0)}`, prima: ivaPrima, dopo: ivaDopo },
    { voce: 'Totale lavori e IVA', prima: round2(q.totalePrima + ivaPrima), dopo: round2(q.totaleDopo + ivaDopo) },
    { voce: 'Somme a disposizione della stazione appaltante', prima: null, dopo: null, nota: 'dal quadro economico del progetto: da confermare' },
  ]
}

const round2 = (n: number): number => { const x = Math.abs(n) * 100; return Math.sign(n) * Math.round(Number(x.toPrecision(15))) / 100 }

/**
 * L'atto che accompagna la perizia, nella forma che le compete. Il testo dice
 * sempre che cosa l'esecutore sta accettando e a quali condizioni, e lascia la
 * casella del **motivato dissenso**: è un diritto, non una formalità.
 */
export function attoSottomissioneHTML(appalto: Appalto, partite: Partita[], pz: Perizia): string {
  const q = quadroComparativo(partite, appalto.perizie, pz)
  const forma = q.oltreQuinto ? 'aggiuntivo' : 'sottomissione'
  const qe = quadroEconomicoPerizia(appalto, partite, pz)
  const nuoviPrezziN = partite.filter((p) => p.np?.periziaN === pz.numero).length
  const inAumento = q.differenza >= 0
  const premesse = `
    <p class="prose">PREMESSO che con contratto${appalto.numeroContratto ? ` n. ${escHtml(appalto.numeroContratto)}` : ''}${appalto.dataStipula ? ` del ${escHtml(appalto.dataStipula)}` : ''} sono stati affidati all'impresa <b>${orTodo(appalto.impresa?.denominazione)}</b> i lavori di <b>${orTodo(appalto.oggetto)}</b>;</p>
    <p class="prose">CHE nel corso dell'esecuzione si è reso necessario redigere la <b>perizia di variante n. ${escHtml(String(pz.numero))}</b>${pz.data ? ` del ${escHtml(pz.data)}` : ''}${pz.oggetto ? `, avente per oggetto ${escHtml(pz.oggetto)}` : ''}, in vigore dallo stato di avanzamento n. ${escHtml(String(pz.dalSal))};</p>
    ${pz.motivazione ? `<p class="prose">CHE la variante è motivata come segue: ${escHtml(pz.motivazione)};</p>` : ''}
    <p class="prose">CHE dal quadro comparativo allegato risulta un importo dei lavori di <b>${eur(q.totaleDopo)}</b> in luogo di ${eur(q.totalePrima)}, con una ${inAumento ? 'maggiore' : 'minore'} spesa di <b>${eur(Math.abs(q.differenza))}</b>${q.variazioneSuContrattoPct != null ? `, pari al ${pct(Math.abs(q.variazioneSuContrattoPct))} dell'importo contrattuale originario` : ''};</p>
    ${nuoviPrezziN ? `<p class="prose">CHE per le lavorazioni non previste in contratto sono stati concordati <b>${escHtml(String(nuoviPrezziN))} nuovi prezzi</b>, assoggettati al medesimo ribasso contrattuale e riportati nel verbale di concordamento allegato;</p>` : ''}
    <p class="prose">CHE la variazione ${q.oltreQuinto ? '<b>eccede</b>' : 'rientra'} il limite del quinto dell'importo contrattuale previsto dall'articolo 120, comma 9, del D.Lgs. 36/2023;</p>`

  const corpo = q.oltreQuinto
    ? `<p class="prose">Poiché la variazione eccede il quinto dell'importo del contratto, essa non può essere imposta all'esecutore: le parti convengono quanto segue con il presente <b>atto aggiuntivo</b>.</p>
       <p class="prose">L'impresa esecutrice si obbliga a eseguire i lavori previsti dalla perizia di variante n. ${escHtml(String(pz.numero))} per l'importo complessivo di <b>${eur(q.totaleDopo)}</b> (diconsi euro ${escHtml(importoInLettere(q.totaleDopo))}), ai patti e alle condizioni del contratto originario, salvi i nuovi prezzi concordati e salve le eventuali diverse pattuizioni espressamente richiamate nel presente atto.</p>
       <p class="prose">La stazione appaltante e l'impresa danno atto che il presente atto aggiuntivo ha natura di <b>accordo</b> e che nessuna delle parti è obbligata a sottoscriverlo in assenza di consenso.</p>`
    : `<p class="prose">L'impresa esecutrice, ai sensi dell'articolo 5, comma 6, dell'Allegato II.14 al D.Lgs. 36/2023, è tenuta a sottoscrivere il presente <b>atto di sottomissione</b> in segno di accettazione ovvero di <b>motivato dissenso</b>.</p>
       <p class="prose">Con la sottoscrizione per accettazione, l'impresa <b>si obbliga a eseguire</b> le lavorazioni previste dalla perizia di variante n. ${escHtml(String(pz.numero))}, per l'importo complessivo di <b>${eur(q.totaleDopo)}</b> (diconsi euro ${escHtml(importoInLettere(q.totaleDopo))}), <b>agli stessi patti, prezzi e condizioni del contratto originario</b>, salvi i nuovi prezzi concordati e riportati nel verbale allegato.</p>
       <p class="prose">Restano fermi il termine di ultimazione dei lavori e le penali del contratto originario, salvo quanto diversamente stabilito dall'atto di approvazione della perizia.</p>`

  const body = `
    ${premesse}
    <h2 class="sec-h">${q.oltreQuinto ? 'Si conviene' : "Obbligazione dell'esecutore"}</h2>
    ${corpo}
    <h2 class="sec-h">Quadro economico aggiornato</h2>
    <table class="dtable">
      <thead><tr><th>Voce</th><th class="num">Prima della perizia</th><th class="num">Dopo la perizia</th><th class="num">Differenza</th></tr></thead>
      <tbody>${qe.map((r) => `<tr${r.prima == null && r.dopo == null ? ' class="nv"' : ''}>
        <td>${escHtml(r.voce)}${r.nota ? `<span class="sub">${escHtml(r.nota)}</span>` : ''}</td>
        <td class="num">${r.prima == null ? '—' : eur(r.prima)}</td>
        <td class="num">${r.dopo == null ? '—' : eur(r.dopo)}</td>
        <td class="num">${r.prima == null || r.dopo == null ? '—' : (r.dopo - r.prima === 0 ? '—' : (r.dopo > r.prima ? '+ ' : '− ') + eur(Math.abs(round2(r.dopo - r.prima))))}</td>
      </tr>`).join('')}</tbody>
    </table>
    <p class="note">Le somme a disposizione della stazione appaltante (imprevisti, spese tecniche, incentivi, allacciamenti) vivono nel quadro economico del progetto e non negli atti contabili: vanno riportate qui dall'atto di approvazione della perizia.</p>
    <h2 class="sec-h">Allegati</h2>
    <ul class="excl">
      <li>Quadro comparativo fra il contratto vigente e la perizia n. ${escHtml(String(pz.numero))}</li>
      ${nuoviPrezziN ? `<li>Verbale di concordamento dei nuovi prezzi ed elenco dei nuovi prezzi (${escHtml(String(nuoviPrezziN))})</li>` : ''}
      <li>Relazione giustificativa della variante ed elaborati di perizia</li>
    </ul>
    ${q.oltreQuinto
      ? firmeHTML([{ ruolo: 'Il Responsabile Unico del Procedimento', nome: appalto.rup }, { ruolo: "L'impresa esecutrice" }, { ruolo: ilDirettore(appalto), nome: appalto.direttoreLavori }])
      : `<p class="prose" style="margin-top:6mm">L'impresa esecutrice sottoscrive: <b>□ per accettazione</b> &nbsp;&nbsp; <b>□ con motivato dissenso</b>, che si allega.</p>
         ${firmeHTML([{ ruolo: "L'impresa esecutrice" }, { ruolo: ilDirettore(appalto), nome: appalto.direttoreLavori }, { ruolo: 'Il Responsabile Unico del Procedimento', nome: appalto.rup }])}`}
  `
  return renderDocPage({
    tool: 'contabilita', brand: 'none', enteHeader: enteDi(appalto),
    kicker: kickerDi(appalto, `${FORMA_LABEL[forma]} · perizia ${pz.numero}`),
    title: FORMA_LABEL[forma],
    sub: `perizia di variante n. ${pz.numero}${pz.data ? ' del ' + pz.data : ''}`,
    headMeta: headMetaDi(appalto),
    bodyHTML: body,
    footer: {
      fields: footerFieldsDi(appalto),
      disc: q.oltreQuinto
        ? 'Art. 120 c. 9 D.Lgs. 36/2023: oltre il quinto dell\'importo contrattuale la variazione non è imponibile — serve un accordo fra le parti.'
        : 'Art. 5 c. 6 Allegato II.14 D.Lgs. 36/2023: atto unilaterale che l\'esecutore sottoscrive per accettazione o con motivato dissenso.',
      page: FORMA_LABEL[forma],
    },
    docTitle: `${FORMA_LABEL[forma]} — perizia n. ${pz.numero}`,
  })
}

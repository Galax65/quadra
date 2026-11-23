/**
 * ELENCO DEI NUOVI PREZZI — l'atto che raccoglie le lavorazioni non previste in
 * contratto e dice, per ognuna, **da dove viene il prezzo**: voce assimilata o
 * riga di prezzario, prezzo base, ribasso contrattuale applicato, prezzo
 * risultante, e a che punto è l'iter (bozza, concordato, approvato).
 *
 * È la tabella che il verbale di concordamento (All. II.14 art. 5 c. 7) e la
 * perizia devono portare con sé, e che il DL stampa separatamente.
 */
import { renderDocPage, escHtml } from '../../../shared/doc/doc'
import { eur } from '../../../shared/format'
import { enteDi, footerFieldsDi, headMetaDi, kickerDi } from './doc-common'
import { righeNP, nuoviPrezzi } from './nuovi-prezzi'
import type { Appalto, Partita } from './types'

/** La tabella dei nuovi prezzi, da sola: la usano l'elenco e il verbale. */
export function tabellaNuoviPrezziHTML(partite: Partita[]): string {
  const righe = righeNP(partite)
  if (!righe.length) return '<p class="note">Nessun nuovo prezzo concordato.</p>'
  const rows = righe.map((r) => `<tr>
      <td class="mono">${escHtml(r.codice)}</td>
      <td>${escHtml(r.descrizione)}<div class="sub">${escHtml(r.derivazione)}</div></td>
      <td class="mono">${escHtml(r.um)}</td>
      <td class="num">${r.base == null ? '—' : eur(r.base)}</td>
      <td class="num">${escHtml(r.ribasso)}</td>
      <td class="num"><b>${r.prezzo == null ? '—' : eur(r.prezzo)}</b></td>
      <td>${escHtml(r.stato)}</td>
    </tr>`).join('')
  return `<table class="dtable">
      <thead><tr><th>N. prezzo</th><th>Designazione e derivazione</th><th>U.M.</th><th class="num">Prezzo base</th><th class="num">Ribasso</th><th class="num">Prezzo</th><th>Iter</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`
}

export function elencoNuoviPrezziHTML(appalto: Appalto, partite: Partita[]): string {
  const np = nuoviPrezzi(partite)
  const daApprovare = np.filter((p) => p.np!.stato !== 'approvato').length
  const body = `
    <p class="note">Lavorazioni non previste nel contratto, i cui prezzi sono stati determinati in contraddittorio con l'esecutore: per assimilazione dai prezzi contrattuali, dai prezzari vigenti o con nuova analisi, e assoggettati al medesimo ribasso contrattuale. I prezzi non ancora approvati si contabilizzano in conto provvisorio.</p>
    ${tabellaNuoviPrezziHTML(partite)}
    ${daApprovare ? `<p class="note"><b>${daApprovare}</b> ${daApprovare === 1 ? 'nuovo prezzo è' : 'nuovi prezzi sono'} ancora da approvare: le relative lavorazioni restano contabilizzate in conto provvisorio fino all'approvazione della perizia.</p>` : ''}`
  return renderDocPage({
    tool: 'contabilita', brand: 'none', enteHeader: enteDi(appalto),
    kicker: kickerDi(appalto, 'Nuovi prezzi'),
    title: 'Elenco dei Nuovi Prezzi',
    sub: np.length ? `${np.length} ${np.length === 1 ? 'nuovo prezzo' : 'nuovi prezzi'}` : '',
    headMeta: headMetaDi(appalto),
    bodyHTML: body,
    footer: { fields: footerFieldsDi(appalto), disc: 'Allegato II.14 art. 5 c. 7 e art. 120 D.Lgs. 36/2023. Importi al netto di IVA.', page: 'Elenco nuovi prezzi' },
    docTitle: 'Elenco dei Nuovi Prezzi',
  })
}

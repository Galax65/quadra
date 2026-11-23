/**
 * COMPUTO CONSUNTIVO: la contabilità letta come un computo.
 *
 * Serve al direttore dei lavori per controllare — voce per voce, con le stesse
 * stampe del progetto — quello che è stato effettivamente contabilizzato a
 * tutto un avanzamento. Non è un atto contabile: è lo stesso computo, con le
 * quantità eseguite al posto di quelle di contratto, e per questo si produce
 * con le stampe del computo e non con quelle degli atti.
 */
import type { VoceComputo } from '../../../shared/xpwe/xpwe'
import type { Appalto, Partita, Sal, ListaEconomia } from './types'
import { calcolaSals, voceVisibileInSal } from './contabilita'
import { partiteVigenti } from './perizie'

/**
 * Le voci contabilizzate a tutto il SAL indicato, nella forma del computo:
 * quantità eseguita, prezzo di contratto, categoria, WBS, misure del libretto.
 */
export function vociConsuntive(appalto: Appalto, partite: Partita[], sals: Sal[], numero: number, liste?: ListaEconomia[]): VoceComputo[] {
  const fino = sals.filter((s) => s.numero <= numero)
  const res = calcolaSals(appalto, partite, fino, liste)
  const ultimo = res[res.length - 1]
  if (!ultimo) return []
  const perId = new Map(ultimo.righe.map((r) => [r.partita.id, r]))
  const misurePerId = new Map<string, Sal['righe'][number]['misurazioni']>()
  // le misure del libretto sono «a tutto il SAL»: valgono quelle dell'ultimo SAL che ne ha
  // (sommarle SAL per SAL ripeterebbe le stesse righe)
  for (const s of fino) for (const r of s.righe) if (r.misurazioni?.length) misurePerId.set(r.partitaId, r.misurazioni)

  return partiteVigenti(partite, appalto.perizie, numero)
    .filter((p) => voceVisibileInSal(p, numero))
    .map((p) => {
      const r = perId.get(p.id)
      const mis = misurePerId.get(p.id)
      return {
        codice: p.codice,
        desc_short: p.descrizione,
        declaratoria: p.declaratoria,
        um: p.um,
        prezzo: p.prezzoUnitario ?? undefined,
        qty: r?.progressivo ?? 0,
        categoria: p.categoria,
        sicurezza: p.sicurezza,
        corpo: p.modalita === 'corpo' || undefined,
        ...(mis?.length ? { misurazioni: mis.map((m) => ({ ...m })) } : {}),
      } as VoceComputo
    })
    .filter((v) => (v.qty ?? 0) !== 0)
}

import { renderDocPage, escHtml } from '../../../shared/doc/doc'
import { eur, num } from '../../../shared/format'
import { importoQta } from '../../../shared/importo'
import { enteDi, footerFieldsDi, headMetaDi, kickerDi, testoVoceHTML, type OpzioniAtto } from './doc-common'
import { round2 } from './contabilita'

/** Il consuntivo a schermo: stesse voci, stessa forma del computo di progetto. */
export function consuntivoHTML(appalto: Appalto, partite: Partita[], sals: Sal[], numero: number, liste?: ListaEconomia[], opz?: OpzioniAtto): string {
  const voci = vociConsuntive(appalto, partite, sals, numero, liste)
  let totale = 0
  const rows = voci.map((v, i) => {
    const imp = importoQta(v.qty, v.prezzo, v.um) || 0
    totale = round2(totale + imp)
    const p = partite.find((x) => x.codice === v.codice)
    return `<tr>
      <td class="num">${i + 1}</td>
      <td class="code">${escHtml(v.codice)}</td>
      <td>${p ? testoVoceHTML(p, opz) : escHtml(v.desc_short || '')}</td>
      <td class="num">${escHtml(v.um || '')}</td>
      <td class="num">${num(v.qty ?? 0)}</td>
      <td class="num">${v.prezzo == null ? '' : num(v.prezzo)}</td>
      <td class="num">${num(imp)}</td>
    </tr>`
  }).join('')
  const body = `
    <p class="note">Computo consuntivo a tutto il SAL n. ${escHtml(String(numero))}: le quantità effettivamente contabilizzate, ai prezzi di contratto, nella forma del computo di progetto. È uno strumento di controllo del direttore dei lavori — <b>non è un atto contabile</b> e non sostituisce registro e sommario. Importi al lordo del ribasso d'asta e al netto di IVA.</p>
    <table class="dtable som">
      <thead><tr><th class="num">N.</th><th>Tariffa</th><th>Designazione</th><th class="num">U.M.</th><th class="num">Quantità</th><th class="num">Prezzo</th><th class="num">Importo</th></tr></thead>
      <tbody>${rows || '<tr class="empty"><td colspan="7">Nessuna voce contabilizzata a questo avanzamento.</td></tr>'}
        <tr class="tot"><td colspan="6">TOTALE contabilizzato (lordo)</td><td class="num">${eur(totale)}</td></tr>
      </tbody>
    </table>`
  return renderDocPage({
    tool: 'contabilita', brand: 'none', enteHeader: enteDi(appalto),
    kicker: kickerDi(appalto, `Computo consuntivo · SAL ${numero}`),
    title: 'Computo Consuntivo',
    sub: `a tutto il SAL n. ${numero}`,
    headMeta: headMetaDi(appalto),
    bodyHTML: body,
    footer: { fields: footerFieldsDi(appalto), disc: 'Documento di controllo interno: non è un atto della contabilità dei lavori. Importi al netto di IVA.', page: `Computo consuntivo SAL ${numero}` },
    docTitle: `Computo consuntivo — SAL ${numero}`,
  })
}

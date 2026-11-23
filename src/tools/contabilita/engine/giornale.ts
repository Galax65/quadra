/**
 * GIORNALE DEI LAVORI (art. 13 All. II.14 D.Lgs. 36/2023).
 *
 * Il direttore dei lavori, o l'assistente delegato, annota «in ciascun giorno»
 * l'ordine e la progressione delle lavorazioni, la manodopera e i mezzi
 * impiegati, le circostanze che influiscono sull'andamento dei lavori.
 *
 * Il giornale però non è solo un diario a mano: deve dare conto anche degli
 * ATTI del periodo — ordini di servizio, sospensioni e riprese, proroghe,
 * verbali, stati di avanzamento, perizie, riserve iscritte. Quelli Quadra li
 * ha già, datati: non si ricopiano a mano (si sbaglierebbe, e sarebbero due
 * verità diverse dello stesso fatto), si intercalano alle annotazioni e si
 * dichiarano per quello che sono.
 */
import { renderDocPage, escHtml } from '../../../shared/doc/doc'
import { giorniTraIt, itToISO } from '../../../shared/date-it'
import type { Appalto, RigaGiornale, Sal, Verbale, Riserva } from './types'
import { enteDi, footerFieldsDi, headMetaDi, kickerDi, firmeHTML, ilDirettore } from './doc-common'
import { VERBALE_LABEL } from './verbali'

export interface VoceGiornale {
  data?: string
  /** Annotazione del DL, oppure atto già registrato altrove. */
  origine: 'annotazione' | 'atto'
  meteo?: string
  manodopera?: string
  mezzi?: string
  testo: string
  note?: string
}

/** Mese di una data italiana, per raggruppare le pagine del giornale. */
const meseDi = (d?: string): string => {
  const iso = itToISO(d)
  if (!iso) return ''
  const [a, m] = iso.split('-')
  const nomi = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
  return `${nomi[Number(m) - 1]} ${a}`
}

/**
 * Le voci del giornale: annotazioni del DL più gli atti del periodo, in ordine
 * di data. Gli atti restano dove sono stati redatti — qui se ne dà conto.
 */
export function vociGiornale(righe: RigaGiornale[], sals?: Sal[], verbali?: Verbale[], riserve?: Riserva[]): VoceGiornale[] {
  const out: VoceGiornale[] = (righe || []).map((r) => ({
    data: r.data, origine: 'annotazione', meteo: r.meteo, manodopera: r.manodopera, mezzi: r.mezzi,
    testo: r.lavorazioni || '', note: r.note,
  }))
  for (const v of verbali || []) {
    if (!v.data) continue
    const n = v.numero != null ? ` n. ${v.numero}` : ''
    out.push({
      data: v.data, origine: 'atto',
      testo: `${VERBALE_LABEL[v.tipo]}${n}${v.oggetto ? `: ${v.oggetto}` : ''}`,
      note: v.motivo || undefined,
    })
  }
  for (const s of sals || []) {
    if (!s.data) continue
    out.push({ data: s.data, origine: 'atto', testo: `Stato di avanzamento dei lavori n. ${s.numero}${s.firmato ? ' (firmato)' : ''}` })
  }
  for (const r of riserve || []) {
    if (!r.data) continue
    out.push({ data: r.data, origine: 'atto', testo: `Riserva n. ${r.numero} iscritta dall'esecutore${r.oggetto ? `: ${r.oggetto}` : ''}` })
  }
  // in ordine di data; a parità, prima l'annotazione del giorno e poi gli atti
  return out.sort((a, b) => -(giorniTraIt(a.data, b.data) ?? 0) || (a.origine === 'atto' ? 1 : -1))
}

/** Filtra le voci in un intervallo di date (estremi compresi). */
export function vociNelPeriodo(voci: VoceGiornale[], dal?: string, al?: string): VoceGiornale[] {
  return voci.filter((v) => {
    if (!v.data) return !dal && !al
    if (dal && (giorniTraIt(dal, v.data) ?? -1) < 0) return false
    if (al && (giorniTraIt(v.data, al) ?? -1) < 0) return false
    return true
  })
}

export function giornaleHTML(appalto: Appalto, righe: RigaGiornale[], sals?: Sal[], verbali?: Verbale[], riserve?: Riserva[], periodo?: { dal?: string; al?: string }): string {
  const voci = vociNelPeriodo(vociGiornale(righe, sals, verbali, riserve), periodo?.dal, periodo?.al)
  let meseCorrente = ''
  const rows = voci.length
    ? voci.map((v) => {
      const mese = meseDi(v.data)
      const testata = mese && mese !== meseCorrente ? (meseCorrente = mese, `<tr class="sub"><td colspan="5">${escHtml(mese.charAt(0).toUpperCase() + mese.slice(1))}</td></tr>`) : ''
      return `${testata}<tr${v.origine === 'atto' ? ' class="rif"' : ''}>
        <td class="code">${escHtml(v.data || '')}</td>
        <td>${escHtml(v.meteo || '')}</td>
        <td>${escHtml(v.manodopera || '')}</td>
        <td>${escHtml(v.mezzi || '')}</td>
        <td>${v.origine === 'atto' ? '<b>Atto:</b> ' : ''}${escHtml(v.testo)}${v.note ? `<span class="sub">${escHtml(v.note)}</span>` : ''}</td>
      </tr>`
    }).join('')
    : '<tr class="empty"><td colspan="5">Nessuna annotazione nel periodo. Il giornale si compila progressivamente, contemporaneamente allo svolgersi delle attività di cantiere.</td></tr>'
  const quante = voci.filter((v) => v.origine === 'annotazione').length
  const atti = voci.length - quante
  const body = `
    <p class="note">Giornale dei lavori — il direttore dei lavori, o l'assistente delegato, annota in ciascun giorno l'ordine e la progressione delle lavorazioni, la manodopera e i mezzi impiegati e le circostanze che influiscono sull'andamento dei lavori (art. 13 All. II.14 D.Lgs. 36/2023).${periodo?.dal || periodo?.al ? ` Periodo: ${escHtml(periodo?.dal || 'inizio')} — ${escHtml(periodo?.al || 'oggi')}.` : ''}</p>
    <table class="dtable">
      <thead><tr><th>Data</th><th>Condizioni</th><th>Manodopera</th><th>Mezzi e provviste</th><th>Lavorazioni, atti e annotazioni</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="note">${quante} ${quante === 1 ? 'annotazione' : 'annotazioni'} del direttore dei lavori${atti ? ` e ${atti} ${atti === 1 ? 'atto richiamato' : 'atti richiamati'} dalla cronologia del cantiere (verbali, stati di avanzamento, riserve): gli atti restano quelli redatti nei rispettivi documenti, qui se ne dà conto alla loro data` : ''}.</p>
    ${firmeHTML([{ ruolo: ilDirettore(appalto), nome: appalto.direttoreLavori }])}`
  return renderDocPage({
    tool: 'contabilita', brand: 'none', enteHeader: enteDi(appalto),
    kicker: kickerDi(appalto, 'Giornale dei lavori'),
    title: 'Giornale dei Lavori',
    headMeta: headMetaDi(appalto),
    bodyHTML: body,
    footer: { fields: footerFieldsDi(appalto), disc: 'Art. 13 Allegato II.14 D.Lgs. 36/2023.', page: 'Giornale dei lavori' },
    docTitle: `Giornale dei Lavori — ${appalto.oggetto || 'Lavori'}`,
  })
}

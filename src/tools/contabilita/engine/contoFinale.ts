/**
 * Contabilità — CONTO FINALE + RELAZIONE FINALE (art. 18, All. II.14). Compilati dal
 * Direttore dei Lavori dopo l'ultimazione: importi finali complessivi, credito
 * residuo dell'impresa; la relazione descrive le vicende dell'esecuzione e il
 * giudizio motivato sulle domande (riserve) non transatte.
 */
import { renderDocPage, escHtml } from '../../../shared/doc/doc'
import { eur } from '../../../shared/format'
import type { Appalto, Partita, Sal, Riserva, Verbale, ListaEconomia } from './types'
import { calcolaSals, totaleContrattuale, round2 } from './contabilita'
import { importoInLettere } from './certificato'
import { enteDi, footerFieldsDi, headMetaDi, kickerDi, firmeHTML, orTodo, ilDirettore } from './doc-common'
import { VERBALE_LABEL } from './verbali'
import { statoRiserva, RISERVA_LABEL, riserveAperte, importoRiserveAperte, GIORNI_FIRMA_CONTO_FINALE } from './riserve'
import { addDaysIt } from '../../../shared/date-it'
import { notaSemplificata } from './semplificata'
import { tempi } from './tempi'
import { penale, penaleDovuta, penaleHTML } from './penali'
import { statoSvincolo, svincoloHTML } from './svincolo'

export function contoFinaleHTML(appalto: Appalto, partite: Partita[], sals: Sal[], verbali?: Verbale[], liste?: ListaEconomia[], riserve?: Riserva[], oggi?: string): string {
  const results = calcolaSals(appalto, partite, sals, liste)
  const ultimo = results[results.length - 1]
  const totContab = ultimo ? ultimo.totaleContabilizzato : 0
  const ritenuta = ultimo ? ultimo.ritenuta : 0
  const giaPagato = ultimo ? ultimo.salPrecedenti : 0
  const creditoResiduo = ultimo ? ultimo.importoSal : 0
  const contrattuale = totaleContrattuale(appalto, partite)
  // Gate SOFT: il conto finale presuppone il certificato di ultimazione (da cui
  // decorrono i termini). Se manca, si avvisa ma il documento resta producibile.
  const haUltimazione = (verbali || []).some((v) => v.tipo === 'ultimazione')
  // Il conto finale è il luogo in cui il ritardo si trattiene e la ritenuta si
  // svincola: entrambi dipendono da atti (ultimazione, collaudo, DURC), non da
  // una scelta fatta qui.
  const t = tempi(appalto, verbali, oggi)
  const pen = penale(appalto, partite, t)
  // la ritenuta maturata è la somma di quelle operate su tutti i certificati
  const ritenutaMaturata = results.reduce((n, r) => n + r.ritenuta, 0)
  const sv = statoSvincolo(appalto, Math.round(ritenutaMaturata * 100) / 100)
  const avviso = haUltimazione ? '' : `<p class="note" style="border-left-color:#b02a7a">Avviso: non risulta redatto il <b>certificato di ultimazione dei lavori</b>, dal quale decorrono i termini per il conto finale. Redigerlo dalla timeline prima di trasmettere il conto finale.</p>`
  const body = `
    ${avviso}
    ${notaSemplificata(appalto, partite)}
    <p class="note">Conto finale dei lavori — compilato dopo l'ultimazione e sottoscritto dall'impresa esecutrice. Importi al netto di IVA.</p>
    <h2 class="sec-h">Riepilogo finale</h2>
    <table class="dtable"><tbody>
      <tr><td>Importo contrattuale dell'appalto</td><td class="num">${eur(contrattuale)}</td></tr>
      ${(appalto.perizie || []).length ? `<tr><td>Perizie di variante approvate: ${(appalto.perizie || []).map(p => 'n. ' + p.numero + (p.data ? ' del ' + escHtml(p.data) : '')).join(', ')}</td><td class="num"></td></tr>` : ''}
      <tr><td>Totale lavori contabilizzati a fine lavori</td><td class="num">${eur(totContab)}</td></tr>
      <tr><td>a dedurre: ritenuta di garanzia 0,50% (svincolo a collaudo)</td><td class="num">− ${eur(ritenuta)}</td></tr>
      ${ultimo?.anticipazione ? `<tr><td>a dedurre: anticipazione recuperata</td><td class="num">− ${eur(ultimo.recuperoAnticipazione)}</td></tr>` : ''}
      <tr><td>a dedurre: già pagato con i SAL/certificati precedenti</td><td class="num">− ${eur(giaPagato)}</td></tr>
      ${penaleDovuta(pen) ? `<tr><td>a dedurre: penale per il ritardo (${pen.giorni} ${pen.giorni === 1 ? 'giorno' : 'giorni'} × ${eur(pen.giornaliera)})</td><td class="num">− ${eur(pen.importo)}</td></tr>` : ''}
      <tr class="tot"><td>CREDITO RESIDUO dell'impresa (netto IVA)</td><td class="num">${eur(round2(creditoResiduo - (penaleDovuta(pen) ? pen.importo : 0)))}</td></tr>
    </tbody></table>
    <p class="prose"><i>Diconsi euro ${escHtml(importoInLettere(round2(creditoResiduo - (penaleDovuta(pen) ? pen.importo : 0))))} oltre IVA.</i></p>
    ${penaleHTML(pen, t)}
    ${svincoloHTML(sv)}
    ${sottoscrizioneHTML(appalto, riserve, oggi)}
    ${firmeHTML([{ ruolo: ilDirettore(appalto), nome: appalto.direttoreLavori }, { ruolo: "L'impresa esecutrice" }, { ruolo: 'Il RUP', nome: appalto.rup }])}
  `
  return renderDocPage({
    tool: 'contabilita', brand: 'none', enteHeader: enteDi(appalto),
    kicker: kickerDi(appalto, 'Conto finale'),
    title: 'Conto Finale dei Lavori',
    headMeta: headMetaDi(appalto),
    bodyHTML: body,
    footer: { fields: footerFieldsDi(appalto), disc: 'Art. 18 Allegato II.14 D.Lgs. 36/2023. La ritenuta di garanzia si svincola in sede di conto finale/collaudo, previo DURC regolare.', page: 'Conto finale' },
    docTitle: `Conto Finale — ${appalto.oggetto || 'Lavori'}`,
  })
}

/**
 * SOTTOSCRIZIONE DEL CONTO FINALE E CONFERMA DELLE RISERVE (art. 7 c. 3).
 *
 * È il passaggio in cui le pretese dell'impresa vivono o muoiono, e va scritto
 * sull'atto, non lasciato alla memoria di chi lo firma: il termine assegnato,
 * l'elenco delle riserve da confermare una per una, e la conseguenza della
 * mancata conferma. Le riserve già definite in via conciliativa non vanno
 * riconfermate e si elencano a parte.
 */
function sottoscrizioneHTML(appalto: Appalto, riserve?: Riserva[], oggi?: string): string {
  const it = appalto.contoFinale || {}
  const gg = Math.min(GIORNI_FIRMA_CONTO_FINALE, Math.max(1, it.giorniTermine || GIORNI_FIRMA_CONTO_FINALE))
  const scadenza = addDaysIt(it.dataInvito, gg)
  const aperte = riserveAperte(riserve)
  const definite = (riserve || []).filter((r) => r.esito === 'definita' || r.esito === 'rinunciata')
  const elenco = aperte.length
    ? `<ul class="excl">${aperte.map((r) => {
        const st = statoRiserva(r, oggi)
        return `<li>Riserva n. ${escHtml(String(r.numero))} — ${escHtml(r.oggetto || '—')}${r.importo != null ? ` · pretesa ${eur(r.importo)}` : ' · non quantificata'}${r.data ? ` · iscritta il ${escHtml(r.data)}` : ''} <i>(${escHtml(RISERVA_LABEL[st.stato])})</i>${r.confermataContoFinale ? ' — <b>confermata</b>' : ''}</li>`
      }).join('')}</ul>
       <p class="prose">Totale delle pretese quantificate da confermare: <b>${eur(importoRiserveAperte(riserve))}</b>.</p>`
    : '<p class="prose">Non risultano riserve da confermare: alla data del presente conto finale non ve ne sono di iscritte e non definite.</p>'
  const stato = it.esito === 'firmatoConConferma'
    ? `<p class="prose">Il conto finale è stato sottoscritto dall'esecutore${it.dataFirma ? ` in data ${escHtml(it.dataFirma)}` : ''}, con conferma delle riserve sopra elencate.</p>`
    : it.esito === 'firmatoSenzaConferma'
      ? `<p class="prose">Il conto finale è stato sottoscritto dall'esecutore${it.dataFirma ? ` in data ${escHtml(it.dataFirma)}` : ''} <b>senza confermare</b> le domande già formulate nel registro di contabilità: il conto finale si ha come da lui definitivamente accettato.</p>`
      : it.esito === 'nonFirmato'
        ? `<p class="prose">L'esecutore <b>non ha sottoscritto</b> il conto finale nel termine assegnato${scadenza ? ` (scaduto il ${escHtml(scadenza)})` : ''}: il conto finale si ha come da lui definitivamente accettato.</p>`
        : `<p class="prose">L'esecutore è invitato a prendere cognizione del conto finale e a sottoscriverlo${it.dataInvito ? `, essendo stato invitato in data ${escHtml(it.dataInvito)},` : ''} entro il termine di ${escHtml(String(gg))} giorni${scadenza ? `, cioè entro il <b>${escHtml(scadenza)}</b>` : ''}.</p>`
  return `<h2 class="sec-h">Sottoscrizione del conto finale e conferma delle riserve</h2>
    ${stato}
    <p class="prose">All'atto della firma l'esecutore non può iscrivere domande diverse, per oggetto o per importo, da quelle formulate nel registro di contabilità, e deve <b>confermare</b>, a pena di decadenza, quelle per le quali non siano intervenute procedure conciliative. Se non firma nel termine assegnato, o se sottoscrive senza confermare le domande, <b>il conto finale si ha come da lui definitivamente accettato</b> (art. 7 c. 3 All. II.14 D.Lgs. 36/2023).</p>
    ${elenco}
    ${definite.length ? `<p class="prose">Riserve già definite in corso d'opera, che non richiedono conferma: ${definite.map((r) => `n. ${escHtml(String(r.numero))}${r.notaEsito ? ` (${escHtml(r.notaEsito)})` : ''}`).join(', ')}.</p>` : ''}`
}

export function relazioneFinaleHTML(appalto: Appalto, partite: Partita[], sals: Sal[], riserve?: Riserva[], testo?: string, verbali?: Verbale[], liste?: ListaEconomia[], oggi?: string): string {
  const results = calcolaSals(appalto, partite, sals, liste)
  const nSal = results.length
  // Allegati obbligatori: i verbali/comunicazioni prodotti in corso d'opera, in ordine di data.
  const atti = [...(verbali || [])].sort((x, y) => (x.data || '').split('/').reverse().join('').localeCompare((y.data || '').split('/').reverse().join('')))
  const allegatiTxt = atti.length
    ? `<ul class="excl">${atti.map((v) => `<li>${escHtml(VERBALE_LABEL[v.tipo])}${v.numero != null ? ` n. ${escHtml(String(v.numero))}` : ''}${v.data ? ` del ${escHtml(v.data)}` : ''}${v.oggetto ? ` — ${escHtml(v.oggetto)}` : ''}</li>`).join('')}</ul>`
    : '<p class="prose">Nessun verbale o comunicazione registrato in corso d\'opera.</p>'
  const nonTransatte = riserveAperte(riserve)
  const riserveTxt = (riserve && riserve.length)
    ? `<ul class="excl">${riserve.map((r) => {
        const st = statoRiserva(r, oggi)
        return `<li>Riserva n. ${escHtml(String(r.numero))}${r.importo != null ? ` (${eur(r.importo)})` : ' (non quantificata)'}: ${escHtml(r.oggetto)}
          <br><i>${escHtml(RISERVA_LABEL[st.stato])}${r.data ? ` · iscritta il ${escHtml(r.data)}` : ''}${r.dataEsplicitazione ? ` · esplicitata il ${escHtml(r.dataEsplicitazione)}` : ''}${r.confermataContoFinale ? ' · confermata al conto finale' : ''}</i>
          <br>${r.controdeduzioni ? escHtml(r.controdeduzioni) : 'giudizio motivato del DL da formulare'}</li>`
      }).join('')}</ul>
      <p class="prose">Riserve non transatte alla data della presente relazione: <b>${escHtml(String(nonTransatte.length))}</b>, per complessivi <b>${eur(importoRiserveAperte(riserve))}</b> di pretese quantificate. Su di esse il direttore dei lavori esprime il giudizio motivato che precede; quelle iscritte nel registro e confermate nel conto finale sono esaminate in sede di collaudo.</p>`
    : '<p class="prose">Alla data della presente relazione non risultano riserve non transatte.</p>'
  // Testo delle vicende: editato dal DL (paragrafi separati da a-capo) o, se assente, sintesi automatica.
  const vicende = (testo && testo.trim())
    ? testo.trim().split(/\n{2,}|\n/).filter(Boolean).map((p) => `<p class="prose">${escHtml(p)}</p>`).join('')
    : `<p class="prose">I lavori di <b>${orTodo(appalto.oggetto)}</b> si sono svolti sotto la direzione del sottoscritto Direttore dei Lavori. Nel corso dell'appalto sono stati emessi ${escHtml(String(nSal))} stati di avanzamento. ${appalto.dataStipula ? `Contratto stipulato in data ${escHtml(appalto.dataStipula)}.` : ''}</p>`
  const body = `
    <h2 class="sec-h">Vicende dell'esecuzione</h2>
    ${vicende}
    <h2 class="sec-h">Giudizio sulle domande dell'esecutore (riserve)</h2>
    ${riserveTxt}
    <h2 class="sec-h">Allegati al conto finale</h2>
    ${allegatiTxt}
    ${firmeHTML([{ ruolo: ilDirettore(appalto), nome: appalto.direttoreLavori }])}
  `
  return renderDocPage({
    tool: 'contabilita', brand: 'none', enteHeader: enteDi(appalto),
    kicker: kickerDi(appalto, 'Relazione finale'),
    title: 'Relazione Finale del Direttore dei Lavori',
    headMeta: headMetaDi(appalto),
    bodyHTML: body,
    footer: { fields: footerFieldsDi(appalto), disc: 'Art. 18 Allegato II.14 D.Lgs. 36/2023 — allegata al conto finale.', page: 'Relazione finale' },
    docTitle: `Relazione Finale — ${appalto.oggetto || 'Lavori'}`,
  })
}

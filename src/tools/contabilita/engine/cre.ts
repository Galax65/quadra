/**
 * CERTIFICATO DI REGOLARE ESECUZIONE dei lavori (art. 28 Allegato II.14 D.Lgs. 36/2023).
 *
 * Contenuto minimo (art. 28 c. 2):
 *   a) estremi del contratto e degli eventuali atti aggiuntivi;
 *   b) indicazione dell'esecutore;
 *   c) nominativo del direttore dei lavori;
 *   d) tempo prescritto per l'esecuzione e date delle attività di effettiva esecuzione;
 *   e) importo totale ovvero importo a saldo da pagare all'esecutore;
 *   f) la certificazione di regolare esecuzione.
 * È emesso dal direttore dei lavori entro tre mesi dall'ultimazione ed è
 * trasmesso al RUP, che ne prende atto e ne conferma la completezza (c. 3);
 * dopo si procede come all'art. 27: rata di saldo e svincolo della cauzione (c. 4).
 *
 * Quando può sostituire il collaudo (c. 1): a scelta della stazione appaltante
 * fino a 1 milione di euro; oltre, fino alla soglia europea, salvo i casi della
 * lett. b) (classe d'uso III e IV, opere strutturali particolari, interventi
 * sismici, RUP progettista o DL…). Il programma non conosce questi fatti: li
 * ricorda sull'atto, non li decide.
 *
 * Gli importi vengono dalla contabilità (calcolaSals), come nel conto finale:
 * nessun numero si reinserisce a mano.
 */
import { renderDocPage, escHtml } from '../../../shared/doc/doc'
import { eur } from '../../../shared/format'
import { giorniTraIt } from '../../../shared/date-it'
import type { Appalto, Partita, Sal, Verbale, ListaEconomia } from './types'
import { calcolaSals, totaleContrattuale, round2 } from './contabilita'
import { importoInLettere } from './certificato'
import { enteDi, footerFieldsDi, headMetaDi, kickerDi, firmeHTML, orTodo, ilDirettore } from './doc-common'
import { tempi } from './tempi'
import { penale, penaleDovuta } from './penali'

/** Limite oltre il quale il CRE sostituisce il collaudo solo in assenza dei casi dell'art. 28 c. 1 lett. b). */
export const LIMITE_CRE_LIBERO = 1_000_000

/** Mesi entro cui il DL emette il CRE dall'ultimazione (art. 28 c. 3). */
export const MESI_CRE = 3

/** Data italiana + n mesi (stesso giorno, o l'ultimo del mese se non esiste). */
function aggiungiMesi(it: string | undefined, mesi: number): string | undefined {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(it || '').trim())
  if (!m) return undefined
  const g = Number(m[1]), mese = Number(m[2]) - 1 + mesi, anno = Number(m[3])
  const fine = new Date(Date.UTC(anno, mese + 1, 0)).getUTCDate()
  const d = new Date(Date.UTC(anno, mese, Math.min(g, fine)))
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`
}

export interface OpzioniCre {
  /** Data del certificato (gg/mm/aaaa). */
  data?: string
  /** Testo libero del DL (constatazioni della visita, osservazioni): paragrafi separati da a-capo. */
  note?: string
  /** Data di lettura per i tempi, se i lavori non risultano ultimati. */
  oggi?: string
}

export function creHTML(appalto: Appalto, partite: Partita[], sals: Sal[], verbali: Verbale[] = [], liste?: ListaEconomia[], o: OpzioniCre = {}): string {
  const results = calcolaSals(appalto, partite, sals, liste)
  const ultimo = results[results.length - 1]
  const contrattuale = totaleContrattuale(appalto, partite)
  const totContab = ultimo ? ultimo.totaleContabilizzato : 0
  const t = tempi(appalto, verbali, o.oggi)
  const pen = penale(appalto, partite, t)
  const penaleImp = penaleDovuta(pen) ? pen.importo : 0
  const saldo = round2((ultimo ? ultimo.importoSal : 0) - penaleImp)
  const ritenuta = round2(results.reduce((n, r) => n + r.ritenuta, 0))

  // a) contratto e atti aggiuntivi
  const reg = appalto.registrazione
  const contratto = [
    appalto.numeroContratto ? `n. ${escHtml(appalto.numeroContratto)}` : '',
    appalto.dataStipula ? `stipulato in data ${escHtml(appalto.dataStipula)}` : '',
    reg && (reg.numero || reg.data) ? `registrato${reg.luogo ? ` a ${escHtml(reg.luogo)}` : ''}${reg.data ? ` il ${escHtml(reg.data)}` : ''}${reg.numero ? ` al n. ${escHtml(reg.numero)}` : ''}` : '',
  ].filter(Boolean).join(', ')
  const perizie = (appalto.perizie || []).filter((p) => p.approvata !== false)
  const atti = perizie.length
    ? `<ul class="excl">${perizie.map((p) => `<li>Perizia di variante n. ${escHtml(String(p.numero))}${p.data ? ` del ${escHtml(p.data)}` : ''}${p.dataApprovazione ? `, approvata il ${escHtml(p.dataApprovazione)}` : ''}${p.oggetto ? ` — ${escHtml(p.oggetto)}` : ''}, con relativo atto di sottomissione</li>`).join('')}</ul>`
    : '<p class="prose">Nessun atto aggiuntivo al contratto.</p>'

  // d) tempi: prescritti ed effettivi
  const consegna = verbali.filter((v) => v.tipo === 'consegna' && v.data).map((v) => v.data!)[0] || appalto.dataConsegna
  const rigaT = (k: string, v: string): string => `<tr><td>${k}</td><td class="num">${v}</td></tr>`
  const tempiTab = `<table class="dtable"><tbody>
      ${rigaT('Consegna dei lavori', orTodo(consegna))}
      ${rigaT('Tempo utile contrattuale', t.giorniUtili != null ? `${escHtml(String(t.giorniUtili))} giorni naturali e consecutivi` : orTodo(''))}
      ${rigaT('Termine contrattuale', orTodo(t.termineContrattuale))}
      ${t.sospensioni.length ? rigaT(`Sospensioni (${t.sospensioni.length})`, `${escHtml(String(t.giorniSospensione))} giorni`) : rigaT('Sospensioni', 'nessuna')}
      ${t.proroghe.length ? rigaT(`Proroghe (${t.proroghe.length})`, `${escHtml(String(t.giorniProroga))} giorni`) : rigaT('Proroghe', 'nessuna')}
      ${rigaT('Termine vigente', orTodo(t.termineVigente))}
      ${rigaT('Ultimazione dei lavori (certificato di ultimazione)', orTodo(t.ultimazione))}
      ${rigaT('Ritardo sul termine vigente', t.ultimazione ? (t.ritardo > 0 ? `<b>${escHtml(String(t.ritardo))} giorni</b>` : 'nessuno: lavori ultimati in tempo utile') : orTodo(''))}
    </tbody></table>`

  // c. 3: entro tre mesi dall'ultimazione
  const limite = aggiungiMesi(t.ultimazione, MESI_CRE)
  const fuoriTermine = limite && o.data ? (giorniTraIt(limite, o.data) ?? 0) > 0 : false
  const avvisi: string[] = []
  if (!t.ultimazione) avvisi.push('non risulta il <b>certificato di ultimazione dei lavori</b>, da cui decorre il termine di tre mesi per l\'emissione del presente certificato (art. 28 c. 3).')
  if (fuoriTermine) avvisi.push(`il certificato è emesso il ${escHtml(o.data!)}, <b>oltre il termine di tre mesi</b> dall'ultimazione (scaduto il ${escHtml(limite!)}; art. 28 c. 3).`)
  if (contrattuale > LIMITE_CRE_LIBERO) avvisi.push(`l'importo dei lavori supera 1.000.000 di euro: il CRE sostituisce il collaudo solo fino alla soglia europea e se non ricorre alcuno dei casi dell'art. 28 c. 1 lett. b) (opere in classe d'uso III o IV, opere strutturali particolari, interventi di miglioramento o adeguamento sismico, RUP anche progettista o direttore dei lavori…). Va verificato prima di emettere l'atto.`)
  const avvisiHTML = avvisi.map((a) => `<p class="note" style="border-left-color:#b02a7a">Avviso: ${a}</p>`).join('')

  const note = (o.note || '').trim()
    ? (o.note || '').trim().split(/\n{2,}|\n/).filter(Boolean).map((p) => `<p class="prose">${escHtml(p)}</p>`).join('')
    : ''

  const body = `
    ${avvisiHTML}
    <h2 class="sec-h">Contratto e atti aggiuntivi</h2>
    <p class="prose">Lavori di <b>${orTodo(appalto.oggetto)}</b>${appalto.cup ? ` — CUP ${escHtml(appalto.cup)}` : ''}${appalto.cig ? ` — CIG ${escHtml(appalto.cig)}` : ''}.</p>
    <p class="prose">Contratto d'appalto ${contratto || orTodo('')}, per l'importo di <b>${eur(contrattuale)}</b> (compresi i costi della sicurezza${appalto.ribassoPct != null ? `, al netto del ribasso d'asta del ${escHtml(String(appalto.ribassoPct).replace('.', ','))}%` : ''}), oltre IVA.</p>
    ${atti}
    <h2 class="sec-h">Esecutore e direzione dei lavori</h2>
    <table class="dtable"><tbody>
      ${rigaT('Impresa esecutrice', `<b>${orTodo(appalto.impresa?.denominazione)}</b>${appalto.impresa?.indirizzo ? `<span class="sub">${escHtml(appalto.impresa.indirizzo)}</span>` : ''}`)}
      ${rigaT(ilDirettore(appalto).replace(/^Il /, ''), orTodo(appalto.direttoreLavori))}
      ${rigaT('Responsabile unico del progetto', orTodo(appalto.rup))}
    </tbody></table>
    <h2 class="sec-h">Tempo prescritto ed esecuzione effettiva</h2>
    ${tempiTab}
    <h2 class="sec-h">Importi</h2>
    <table class="dtable"><tbody>
      ${rigaT('Importo contrattuale', eur(contrattuale))}
      ${rigaT('Importo complessivo dei lavori eseguiti (conto finale)', `<b>${eur(totContab)}</b>`)}
      ${rigaT('a dedurre: acconti corrisposti con i certificati di pagamento', '− ' + eur(ultimo ? ultimo.salPrecedenti : 0))}
      ${penaleImp ? rigaT(`a dedurre: penale per il ritardo (${escHtml(String(pen.giorni))} giorni)`, '− ' + eur(penaleImp)) : ''}
      <tr class="tot"><td>IMPORTO A SALDO da pagare all'esecutore (netto IVA)</td><td class="num">${eur(saldo)}</td></tr>
      ${rigaT('Ritenute di garanzia 0,50% maturate, da svincolare con la liquidazione finale (art. 11 c. 6 D.Lgs. 36/2023)', eur(ritenuta))}
    </tbody></table>
    <p class="prose"><i>Diconsi euro ${escHtml(importoInLettere(saldo))} oltre IVA.</i></p>
    ${note ? `<h2 class="sec-h">Constatazioni del direttore dei lavori</h2>${note}` : ''}
    <h2 class="sec-h">Certificazione</h2>
    <p class="prose">Il sottoscritto ${escHtml(ilDirettore(appalto).replace(/^Il /, '').toLowerCase())}, visti gli atti contabili e accertato che i lavori sono stati eseguiti a regola d'arte, secondo le prescrizioni contrattuali e le eventuali varianti approvate,</p>
    <p class="prose" style="text-align:center;margin:4mm 0"><b>CERTIFICA</b></p>
    <p class="prose">che i lavori sopra descritti, eseguiti dall'impresa <b>${orTodo(appalto.impresa?.denominazione)}</b>, sono stati <b>regolarmente eseguiti</b>, e liquida il credito dell'esecutore nell'importo a saldo di <b>${eur(saldo)}</b> oltre IVA, salvo le risultanze dell'eventuale giudizio sulle riserve. Si procede quindi al pagamento della rata di saldo e allo svincolo della cauzione definitiva (art. 28 c. 4 e art. 27 All. II.14).</p>
    <p class="prose">${o.data ? `Data: ${escHtml(o.data)}` : 'Data: ______________'}${limite ? ` <span class="sub">termine per l'emissione: ${escHtml(limite)} (tre mesi dall'ultimazione)</span>` : ''}</p>
    ${firmeHTML([{ ruolo: ilDirettore(appalto), nome: appalto.direttoreLavori }])}
    <p class="prose" style="margin-top:6mm">Visto: il Responsabile unico del progetto, che ne prende atto e ne conferma la completezza (art. 28 c. 3).</p>
    ${firmeHTML([{ ruolo: 'Il RUP', nome: appalto.rup }])}
  `
  return renderDocPage({
    tool: 'contabilita', brand: 'none', enteHeader: enteDi(appalto),
    kicker: kickerDi(appalto, 'CRE'),
    title: 'Certificato di Regolare Esecuzione',
    sub: o.data ? `in data ${o.data}` : undefined,
    headMeta: headMetaDi(appalto),
    bodyHTML: body,
    footer: { fields: footerFieldsDi(appalto), disc: 'Art. 28 Allegato II.14 e art. 116 D.Lgs. 36/2023. Importi al netto di IVA.', page: 'CRE' },
    docTitle: `Certificato di regolare esecuzione — ${appalto.oggetto || 'Lavori'}`,
  })
}

/** Data di scadenza per il CRE (tre mesi dall'ultimazione), se nota. */
export function scadenzaCre(ultimazione?: string): string | undefined { return aggiungiMesi(ultimazione, MESI_CRE) }

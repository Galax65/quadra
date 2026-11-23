/**
 * LE PAGINE DEL CANTIERE — sezione CANTIERE della sidebar: giornale dei
 * lavori, verbali e ordini di servizio, riserve, liste in economia,
 * scadenziario. Modulo PURO: riceve il lavoro, restituisce HTML; ogni campo
 * salva da solo (comandi lvGio…, lvAtto…, lvRis…, lvEco… in main.ts). Le
 * stampe le fa il motore della Contabilità.
 */
import { testataHtml } from '../../shared/griglia'
import {
  attiDi, verbaliDi, valoreLista, datiContabilita,
  type Lavoro, type ListaEconomia, type Riserva,
} from '../../shared/lavoro'
import { statoRiserva, RISERVA_LABEL, VERBALE_LABEL, scadenze, SCADENZA_LABEL, riserveRegistroHTML } from '../contabilita/engine'
import { enteDi, kickerDi, headMetaDi, footerFieldsDi } from '../contabilita/engine/doc-common'
import { renderDocPage } from '../../shared/doc/doc'
import type { ContabilitaMotore } from './motore-contabilita'
import { eur, fmt } from './schermata'

const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
const q = (s: string): string => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
const num = (n: number | null | undefined): string => (n == null ? '' : String(n).replace('.', ','))

/** Un campo che salva da solo: comando(id, campo, valore). */
const inp = (cmd: string, id: string, campo: string, valore: string, extra = ''): string =>
  `<input value="${esc(valore)}" onchange="${cmd}(${q(id)},'${campo}',this.value)" ${extra}>`
const area = (cmd: string, id: string, campo: string, valore: string, righe = 3): string =>
  `<textarea rows="${righe}" onchange="${cmd}(${q(id)},'${campo}',this.value)">${esc(valore)}</textarea>`
const data = (cmd: string, id: string, campo: string, valore?: string): string => inp(cmd, id, campo, valore || '', 'placeholder="gg/mm/aaaa" class="lv-ct-data"')
const bottone = (etichetta: string, onclick: string, titolo = '', stile = 'ghost'): string =>
  `<button class="ehb-btn ehb-btn--sm ehb-btn--${stile}" onclick="${esc(onclick)}"${titolo ? ` title="${esc(titolo)}"` : ''}>${esc(etichetta)}</button>`
const togli = (onclick: string, titolo = 'Togli'): string => `<button class="ehb-icon-btn" title="${esc(titolo)}" onclick="${esc(onclick)}">✕</button>`

function pagina(titolo: string, sottotitolo: string, corpo: string, stampa?: { onclick: string; titolo: string }): string {
  return `<section class="lv-page lv-dati">
    ${testataHtml({ titolo, sottotitolo, pastiglie: [{ testo: 'cantiere', tono: 'fase' }], ...(stampa ? { stampa } : {}) })}
    <div class="lv-body lv-dati__corpo">${corpo}</div>
  </section>`
}

/* ── Il giornale dei lavori ───────────────────────────────────────────── */

export function paginaGiornale(l: Lavoro): string {
  const g = attiDi(l).giornale
  const righe = g.map((r) => `<tr>
      <td>${data('lvGio', r.id, 'data', r.data)}</td>
      <td>${inp('lvGio', r.id, 'meteo', r.meteo || '', 'placeholder="sereno"')}</td>
      <td>${area('lvGio', r.id, 'lavorazioni', r.lavorazioni || '', 2)}</td>
      <td>${inp('lvGio', r.id, 'manodopera', r.manodopera || '', 'placeholder="2 operai, 1 capo"')}</td>
      <td>${inp('lvGio', r.id, 'mezzi', r.mezzi || '', 'placeholder="escavatore"')}</td>
      <td>${area('lvGio', r.id, 'note', r.note || '', 2)}</td>
      <td>${togli(`lvGioTogli(${q(r.id)})`, 'Togli il giorno')}</td>
    </tr>`).join('')
  return pagina('Giornale dei lavori', `${g.length} giorn${g.length === 1 ? 'o' : 'i'} · art. 12 All. II.14`, `
    <section class="lv-ct">
      <p class="lv-nota">Un giorno per riga: tempo, lavorazioni, manodopera e mezzi. Nella stampa il giornale richiama da sé, giorno per giorno, i SAL, i verbali e le riserve con la loro data.</p>
      ${g.length ? `<table class="lv-ct-tab lv-ct-tab--larga"><thead><tr><th>Data</th><th>Meteo</th><th>Lavorazioni eseguite</th><th>Manodopera</th><th>Mezzi</th><th>Note e ordini</th><th></th></tr></thead><tbody>${righe}</tbody></table>` : '<p class="lv-nota">Il giornale è vuoto.</p>'}
      ${bottone('＋ Un giorno', 'lvGioNuovo()', 'Una riga nuova, con la data di oggi (o il giorno dopo l\'ultimo)')}
    </section>`, { onclick: 'lvGioStampa()', titolo: 'Il giornale dei lavori, con i richiami a SAL, verbali e riserve' })
}

/* ── I verbali e gli ordini di servizio ───────────────────────────────── */

export function paginaVerbali(l: Lavoro): string {
  const v = verbaliDi(l)
  const libero = (id: string) => attiDi(l).liberi.find((x) => x.id === id)
  const righe = v.map((x) => {
    const a = libero(x.id)
    const titolo = `${VERBALE_LABEL[x.tipo]}${x.numero && (x.tipo === 'ordine' || x.tipo === 'accertamento' || x.tipo === 'sospensione' || x.tipo === 'ripresa' || x.tipo === 'proroga') ? ` n. ${x.numero}` : ''}`
    return `<div class="lv-atto">
      <div class="lv-atto__t"><b>${esc(titolo)}</b>${x.ricavato ? `<span class="lv-chip" title="Ricavato dai tempi: la data si cambia in «Contratto, tempi e pagamenti»">dai tempi</span>` : ''}
        <span class="lv-atto__az">${bottone('⎙', `lvAttoStampa(${q(x.id)})`, 'Anteprima e stampa del verbale')}${a ? togli(`lvAttoTogli(${q(x.id)})`, "Togli l'atto") : ''}</span></div>
      ${a ? `<div class="lv-righe">
          <label class="lv-f"><span>Data</span>${data('lvAtto', a.id, 'data', a.data)}</label>
          <label class="lv-f"><span>Oggetto</span>${inp('lvAtto', a.id, 'oggetto', a.oggetto || '')}</label>
        </div>
        <label class="lv-f"><span>Testo</span>${area('lvAtto', a.id, 'testo', a.testo || '', 4)}</label>`
      : `<p class="lv-nota">del ${esc(x.data || '—')}${x.motivo ? ` · ${esc(x.motivo)}` : ''}${x.giorniProroga ? ` · ${x.giorniProroga} giorni` : ''}${x.oggetto ? ` · ${esc(x.oggetto)}` : ''}</p>`}
    </div>`
  }).join('')
  return pagina('Verbali e ordini di servizio', `${v.length} att${v.length === 1 ? 'o' : 'i'}`, `
    <section class="lv-ct">
      <p class="lv-nota">Consegna, sospensioni e riprese, proroghe e ultimazione vengono dai tempi del lavoro (DATI DEL LAVORO → «Contratto, tempi e pagamenti»): lì si scrivono una volta sola. Qui si aggiungono gli ordini di servizio, i processi verbali di accertamento e le relazioni al RUP.</p>
      <div class="lv-righe">
        ${bottone('＋ Ordine di servizio', "lvAttoNuovo('ordine')")}
        ${bottone('＋ Verbale di accertamento', "lvAttoNuovo('accertamento')")}
        ${bottone('＋ Relazione al RUP', "lvAttoNuovo('relazioneRup')")}
        ${bottone('Contratto, tempi e pagamenti →', "lvApri('contabilita')", 'Consegna, sospensioni, proroghe, ultimazione')}
      </div>
      ${righe || '<p class="lv-nota">Ancora nessun atto.</p>'}
    </section>`)
}

/* ── Le riserve ───────────────────────────────────────────────────────── */

const ESITI: [string, string][] = [['aperta', 'aperta'], ['definita', "definita in corso d'opera"], ['rinunciata', 'rinunciata'], ['decaduta', 'decaduta']]

export function paginaRiserve(l: Lavoro, oggiIso: string): string {
  const r = attiDi(l).riserve
  const sal = l.avanzamenti.filter((a) => a.tipo !== 'cre').map((a) => a.n)
  const scheda = (x: Riserva): string => {
    const st = statoRiserva({ ...x }, oggiIso)
    const allarme = st.stato === 'inScadenza' || st.stato === 'decaduta'
    return `<div class="lv-atto">
      <div class="lv-atto__t"><b>Riserva n. ${x.numero}</b><span class="lv-chip${allarme ? ' is-oltre' : ''}" title="${esc(st.nota)}">${esc(RISERVA_LABEL[st.stato])}</span>
        <span class="lv-atto__az">${togli(`lvRisTogli(${q(x.id)})`, 'Togli la riserva')}</span></div>
      <p class="lv-nota">${esc(st.nota)}</p>
      <label class="lv-f"><span>Oggetto (che cosa chiede l'esecutore)</span>${inp('lvRis', x.id, 'oggetto', x.oggetto)}</label>
      <div class="lv-righe">
        <label class="lv-f"><span>Iscritta il</span>${data('lvRis', x.id, 'data', x.data)}</label>
        <label class="lv-f"><span>Sul SAL n.</span><select onchange="lvRis(${q(x.id)},'salNumero',this.value)"><option value="">—</option>${sal.map((n) => `<option value="${n}"${x.salNumero === n ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
        <label class="lv-f"><span>Importo €</span>${inp('lvRis', x.id, 'importo', num(x.importo), 'inputmode="decimal" style="width:120px"')}</label>
        <label class="lv-f"><span>Esplicitata il</span>${data('lvRis', x.id, 'dataEsplicitazione', x.dataEsplicitazione)}</label>
      </div>
      <label class="lv-f"><span>Domande e ragioni dell'esecutore</span>${area('lvRis', x.id, 'esplicitazione', x.esplicitazione || '')}</label>
      <label class="lv-f"><span>Controdeduzioni del direttore dei lavori</span>${area('lvRis', x.id, 'controdeduzioni', x.controdeduzioni || '')}</label>
      <div class="lv-righe">
        <label class="lv-f"><span>Esito</span><select onchange="lvRis(${q(x.id)},'esito',this.value)">${ESITI.map(([v, t]) => `<option value="${v}"${(x.esito || 'aperta') === v ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
        <label class="lv-f"><span>Nota sull'esito</span>${inp('lvRis', x.id, 'notaEsito', x.notaEsito || '')}</label>
        <label class="lv-f lv-f--spunta"><input type="checkbox"${x.confermataContoFinale ? ' checked' : ''} onchange="lvRis(${q(x.id)},'confermataContoFinale',this.checked?'1':'')"><span>Confermata al conto finale</span></label>
      </div>
    </div>`
  }
  const aperte = r.filter((x) => x.esito !== 'definita' && x.esito !== 'rinunciata')
  const importo = aperte.reduce((t, x) => t + (x.importo || 0), 0)
  return pagina('Riserve', `${r.length} riserv${r.length === 1 ? 'a' : 'e'} · ${aperte.length} apert${aperte.length === 1 ? 'a' : 'e'}${importo ? ` per ${eur(importo)}` : ''}`, `
    <section class="lv-ct">
      <p class="lv-nota">L'esecutore iscrive la riserva sul registro e la esplicita entro 15 giorni, a pena di decadenza; il direttore dei lavori la controdeduce. Al conto finale va confermata, o si ha per abbandonata (art. 7 All. II.14).</p>
      ${bottone('＋ Riserva', 'lvRisNuova()')}
      ${r.map(scheda).join('') || '<p class="lv-nota">Nessuna riserva.</p>'}
    </section>`, { onclick: 'lvRisStampa()', titolo: 'Il prospetto delle riserve, come nel registro di contabilità' })
}

/* ── Le liste in economia ─────────────────────────────────────────────── */

const SAL_LISTA = (l: Lavoro, x: ListaEconomia): string => {
  const sal = l.avanzamenti.filter((a) => a.tipo !== 'cre')
  const ultimo = sal.length ? sal[sal.length - 1].n : 0
  const n = [...new Set([...sal.map((a) => a.n), ultimo + 1])]
  return `<select onchange="lvEco(${q(x.id)},'salNumero',this.value)"><option value="">non ancora in un SAL</option>${n.map((k) => `<option value="${k}"${x.salNumero === k ? ' selected' : ''}>SAL n. ${k}${sal.find((a) => a.n === k)?.stato === 'emesso' ? ' (emesso)' : ''}</option>`).join('')}</select>`
}

function tabellaRighe(x: ListaEconomia, gruppo: 'operai' | 'mezzi' | 'provviste', chiuso: boolean): string {
  const cella = (i: number, campo: string, v: string, extra = ''): string => chiuso ? esc(v) : `<input value="${esc(v)}" onchange="lvEcoRiga(${q(x.id)},'${gruppo}',${i},'${campo}',this.value)" ${extra}>`
  const n = (i: number, campo: string, v: number | null | undefined): string => cella(i, campo, num(v), 'inputmode="decimal"')
  const tolta = (i: number): string => chiuso ? '' : togli(`lvEcoRigaTogli(${q(x.id)},'${gruppo}',${i})`)
  if (gruppo === 'operai') {
    return `<table class="lv-ct-tab"><thead><tr><th>Qualifica</th><th>Nominativo</th><th>Ore</th><th>€/ora</th><th>Importo</th><th></th></tr></thead><tbody>${x.operai.map((o, i) => `<tr><td>${cella(i, 'qualifica', o.qualifica || '')}</td><td>${cella(i, 'nominativo', o.nominativo || '')}</td><td>${n(i, 'ore', o.ore)}</td><td>${n(i, 'tariffaOraria', o.tariffaOraria)}</td><td class="lv-ct-n">${eur((o.ore || 0) * (o.tariffaOraria || 0))}</td><td>${tolta(i)}</td></tr>`).join('')}</tbody></table>`
  }
  if (gruppo === 'mezzi') {
    return `<table class="lv-ct-tab"><thead><tr><th>Mezzo o nolo</th><th>Ore</th><th>€/ora</th><th>Importo</th><th></th></tr></thead><tbody>${x.mezzi.map((m, i) => `<tr><td>${cella(i, 'descrizione', m.descrizione)}</td><td>${n(i, 'ore', m.ore)}</td><td>${n(i, 'tariffaOraria', m.tariffaOraria)}</td><td class="lv-ct-n">${eur((m.ore || 0) * (m.tariffaOraria || 0))}</td><td>${tolta(i)}</td></tr>`).join('')}</tbody></table>`
  }
  return `<table class="lv-ct-tab"><thead><tr><th>Provvista</th><th>U.M.</th><th>Quantità</th><th>€ unit.</th><th>Importo</th><th></th></tr></thead><tbody>${x.provviste.map((p, i) => `<tr><td>${cella(i, 'descrizione', p.descrizione)}</td><td>${cella(i, 'um', p.um || '')}</td><td>${n(i, 'quantita', p.quantita)}</td><td>${n(i, 'prezzoUnitario', p.prezzoUnitario)}</td><td class="lv-ct-n">${eur((p.quantita || 0) * (p.prezzoUnitario || 0))}</td><td>${tolta(i)}</td></tr>`).join('')}</tbody></table>`
}

export function paginaEconomie(l: Lavoro): string {
  const e = attiDi(l).economie
  const totale = e.reduce((t, x) => t + valoreLista(x).totale, 0)
  const scheda = (x: ListaEconomia): string => {
    const v = valoreLista(x)
    const chiuso = x.salNumero != null && l.avanzamenti.some((a) => a.n === x.salNumero && a.stato === 'emesso' && a.tipo !== 'cre')
    return `<div class="lv-atto">
      <div class="lv-atto__t"><b>Lista n. ${x.numero}</b>${chiuso ? '<span class="lv-chip">🔒 nel SAL emesso</span>' : ''}<span class="lv-chip">${eur(v.totale)}</span>
        <span class="lv-atto__az">${bottone('⎙', `lvEcoStampa(${q(x.id)})`, 'Anteprima e stampa della lista')}${chiuso ? '' : togli(`lvEcoTogli(${q(x.id)})`, 'Togli la lista')}</span></div>
      <div class="lv-righe">
        <label class="lv-f"><span>Settimana del</span>${chiuso ? esc(x.data) : data('lvEco', x.id, 'data', x.data)}</label>
        <label class="lv-f"><span>SAL di competenza</span>${chiuso ? `SAL n. ${x.salNumero}` : SAL_LISTA(l, x)}</label>
        <label class="lv-f"><span>Ordine di servizio</span>${chiuso ? esc(x.ordineRef || '—') : inp('lvEco', x.id, 'ordineRef', x.ordineRef || '', 'placeholder="n. 2 del …"')}</label>
      </div>
      <h3>Operai · ${eur(v.manodopera)}</h3>${tabellaRighe(x, 'operai', chiuso)}${chiuso ? '' : bottone('＋ Operaio', `lvEcoRigaNuova(${q(x.id)},'operai')`)}
      <h3>Mezzi e noli · ${eur(v.noli)}</h3>${tabellaRighe(x, 'mezzi', chiuso)}${chiuso ? '' : bottone('＋ Mezzo', `lvEcoRigaNuova(${q(x.id)},'mezzi')`)}
      <h3>Provviste · ${eur(v.provviste)}</h3>${tabellaRighe(x, 'provviste', chiuso)}${chiuso ? '' : bottone('＋ Provvista', `lvEcoRigaNuova(${q(x.id)},'provviste')`)}
    </div>`
  }
  return pagina('Liste in economia', `${e.length} list${e.length === 1 ? 'a' : 'e'} · ${eur(totale)}`, `
    <section class="lv-ct">
      <p class="lv-nota">Lavori ordinati dal direttore dei lavori e pagati per risorse impiegate: operai, mezzi, provviste, a prezzi della lista (senza ribasso). Ogni lista entra nella contabilità del SAL di competenza: nel registro, nel SAL e nel certificato.</p>
      ${bottone('＋ Lista settimanale', 'lvEcoNuova()')}
      ${e.map(scheda).join('') || '<p class="lv-nota">Nessuna lista.</p>'}
    </section>`)
}

/* ── Lo scadenziario ──────────────────────────────────────────────────── */

export function paginaScadenze(l: Lavoro, m: ContabilitaMotore | null, oggiIso: string): string {
  if (!m) return pagina('Scadenziario', 'i termini del lavoro', '<section class="lv-ct"><p class="lv-nota">Lo scadenziario conta i termini della contabilità (certificati, pagamenti, riserve, conto finale): comincia con il contratto.</p></section>')
  const lista = scadenze({ appalto: m.appalto, sals: m.sals, riserve: m.riserve, verbali: m.verbali }, oggiIso)
  const d = datiContabilita(l)
  return pagina('Scadenziario', `${lista.filter((s) => s.stato === 'scaduta' || s.stato === 'inScadenza').length} urgenti su ${lista.length}`, `
    <section class="lv-ct">
      <p class="lv-nota">I termini che la norma fissa a partire dagli atti del lavoro: emissione del certificato e pagamento di ogni SAL, esplicitazione delle riserve, conto finale e collaudo.${d.dataConsegna ? '' : ' Senza la data di consegna alcuni termini non si calcolano.'}</p>
      <table class="lv-cfr"><thead><tr><th>Adempimento</th><th>Decorre da</th><th>Entro</th><th>Stato</th></tr></thead><tbody>
        ${lista.map((s) => `<tr class="${s.stato === 'scaduta' ? 'is-diff' : s.stato === 'fatto' ? 'is-ok' : ''}"><td>${esc(s.cosa)}<div class="lv-nota">${esc(s.norma)}</div></td><td>${esc(s.decorre)}</td><td>${esc(s.entro || '—')}</td><td>${esc(SCADENZA_LABEL[s.stato])}<div class="lv-nota">${esc(s.nota)}</div></td></tr>`).join('') || '<tr><td colspan="4">Nessun termine da contare.</td></tr>'}
      </tbody></table>
    </section>`, { onclick: 'lvScadStampa()', titolo: 'Lo scadenziario, da stampare' })
}

export { fmt }

/** Il prospetto delle riserve, nello stesso foglio degli altri atti. */
export function prospettoRiserveHTML(m: ContabilitaMotore, oggiIso: string, oggiIt: string): string {
  return renderDocPage({
    tool: 'contabilita', brand: 'none', enteHeader: enteDi(m.appalto),
    kicker: kickerDi(m.appalto, 'Riserve'),
    title: "Prospetto delle riserve dell'esecutore",
    sub: `alla data del ${oggiIt}`,
    headMeta: headMetaDi(m.appalto),
    bodyHTML: riserveRegistroHTML(m.riserve, oggiIso),
    footer: { fields: footerFieldsDi(m.appalto), disc: 'Iscrizione, esplicitazione entro 15 giorni e controdeduzioni del direttore dei lavori (art. 7 All. II.14 D.Lgs. 36/2023).', page: 'Riserve' },
  })
}

/* ── Il registro degli atti prodotti ──────────────────────────────────── */

const ESITO: Record<string, string> = {
  integro: '✓ integro: gli atti sono quelli firmati', modificato: '✕ modificato dopo la firma', 'senza-impronta': 'firmato senza impronta',
  'non-firmato': 'non firmato', 'non-verificabile': 'non verificabile su questo dispositivo',
}

export function paginaRegistroAtti(l: Lavoro, verifiche: { salNumero: number; esito: string }[]): string {
  const c = [...attiDi(l).consegne].sort((a, b) => a.ts - b.ts)
  const sal = l.avanzamenti.filter((a) => a.stato === 'emesso' && a.tipo !== 'cre')
  return pagina('Registro degli atti prodotti', `${c.length} att${c.length === 1 ? 'o' : 'i'} · ${sal.length} SAL firmat${sal.length === 1 ? 'o' : 'i'}`, `
    <section class="lv-ct">
      <p class="lv-nota">Ogni SAL emesso si firma con la sua <b>impronta</b> (SHA-256 degli atti): se qualcuno lo riapre e lo cambia, l'impronta ricalcolata non torna. Ogni atto stampato da una tappa chiusa entra qui, con la sua impronta (contabilità digitale, art. 12 c. 10 All. II.14).</p>
      <h3>I SAL firmati</h3>
      ${sal.length ? `<table class="lv-cfr"><thead><tr><th>SAL</th><th>Emesso il</th><th>Impronta</th><th>Verifica</th></tr></thead><tbody>
        ${sal.map((a) => { const v = verifiche.find((x) => x.salNumero === a.n); return `<tr class="${v?.esito === 'modificato' ? 'is-diff' : v?.esito === 'integro' ? 'is-ok' : ''}"><td>${a.tipo === 'salFinale' ? 'SAL finale' : `SAL n. ${a.n}`}</td><td>${esc(a.emessoIl || a.data)}</td><td class="lv-cfr-cod">${esc(a.impronta ? a.impronta.slice(0, 16) + '…' : '—')}</td><td>${esc(v ? ESITO[v.esito] || v.esito : 'verifica in corso…')}${a.sblocchi?.length ? `<div class="lv-nota">riaperto ${a.sblocchi.length} volt${a.sblocchi.length === 1 ? 'a' : 'e'}</div>` : ''}</td></tr>` }).join('')}
      </tbody></table>` : '<p class="lv-nota">Nessun SAL emesso.</p>'}
      <h3>Gli atti prodotti</h3>
      ${c.length ? `<table class="lv-cfr"><thead><tr><th>Atto</th><th>Data</th><th>Impronta</th></tr></thead><tbody>
        ${c.map((x) => `<tr><td>${esc(x.label)}</td><td>${esc(x.data)}</td><td class="lv-cfr-cod">${esc(x.impronta ? x.impronta.slice(0, 16) + '…' : '—')}</td></tr>`).join('')}
      </tbody></table>` : '<p class="lv-nota">Ancora nessun atto prodotto: le stampe di una tappa chiusa entrano qui.</p>'}
    </section>`, { onclick: 'lvRegistroAttiStampa()', titolo: 'Il registro degli atti, con la verifica delle impronte' })
}

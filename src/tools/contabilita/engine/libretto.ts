/**
 * Contabilità — LIBRETTO DELLE MISURE (art. 13 Allegato II.14).
 *
 * Il libretto accerta **che cosa è stato eseguito e quanto ne è stato
 * eseguito**: dimensioni, fattori e quantità, rilevate in contraddittorio con
 * l'esecutore. **I PREZZI NON CI STANNO**: la valutazione economica è del
 * registro di contabilità, che trascrive queste quantità e vi applica i prezzi
 * di contratto. Un libretto con gli importi non è un libretto, è un computo —
 * ed è l'errore che si vede più spesso.
 *
 * Perciò qui ci sono solo: numero d'ordine, tariffa e data, designazione,
 * dimensioni (par.ug. × lungh. × largh. × H/peso), quantità **positive** e
 * **negative** (le detrazioni stanno in colonna loro, non col segno meno in
 * mezzo alle altre) e il SOMMANO per voce.
 *
 * E non ci stanno le voci che non sono state misurate: un libretto elenca ciò
 * che è stato rilevato, non l'elenco prezzi del lavoro.
 */
import { renderDocPage, escHtml } from '../../../shared/doc/doc'
import { num, pct } from '../../../shared/format'
import type { Appalto, Partita, Sal, RigaSal, Consegna } from './types'
import type { ListaEconomia } from './types'
import { ordineIscrizione, notaSeguito } from './atti-rif'
import { aliquotaCorpoPct, voceVisibileInSal, voceSoppressaInSal } from './contabilita'
import { listeATuttoSal } from './economia'
import { enteDi, footerFieldsDi, headMetaDi, kickerDi, firmeHTML, ilDirettore, testoVoceHTML, type OpzioniAtto } from './doc-common'

const fatt = (v: number | null | undefined): string => (v == null ? '' : num(v))

/** Una partita entra nel libretto solo se è stata misurata (o stornata). */
export function misurataInSal(p: Partita, riga: RigaSal | undefined, salNumero: number): boolean {
  if (voceSoppressaInSal(p, salNumero)) return true // lo storno è una scrittura, e si vede
  if (p.modalita === 'corpo') return riga?.quotaPct != null || !!riga?.sotto?.length
  if (riga?.misurazioni?.length) return true
  return riga?.quantitaProgressiva != null
}

/** Righe di misura (a misura) per una partita a un SAL: dimensioni e quantità. */
function righeMisuraHTML(p: Partita, riga: RigaSal | undefined, salNumero: number, ord: number, dataSal?: string, opz?: OpzioniAtto): string {
  // la data è quella del RILEVAMENTO, non del SAL: è ciò che la colonna dichiara
  const data = (opz?.date ?? true) ? (riga?.dataMisura || dataSal) : undefined
  const testo = testoVoceHTML(p, opz, 'ridotta')
  const testa = (i: number): string => `
      <td class="num">${i === 0 ? (ord || '') : ''}</td>
      <td class="code">${i === 0 ? escHtml(p.codice) : ''}${i === 0 && data ? `<span class="sub">${escHtml(data)}</span>` : ''}</td>`
  // Voce soppressa: resta a verbale con la detrazione dello storno (traccia).
  if (voceSoppressaInSal(p, salNumero)) {
    const qta = eseguitoQtaPartita(riga)
    return `<tr class="nv">
      ${testa(0)}
      <td>${testo}<span class="sub">voce soppressa e portata in detrazione al SAL n. ${escHtml(String(p.soppressaSal))} (storno)</span></td>
      <td class="num" colspan="4"></td>
      <td class="num"></td>
      <td class="num">${qta ? num(qta) : ''}</td>
    </tr>`
  }
  const righe = riga?.misurazioni && riga.misurazioni.length ? riga.misurazioni : null
  if (!righe) {
    // senza righe di misura resta la quantità attestata: una riga sola
    const qty = riga?.quantitaProgressiva ?? 0
    return `<tr>
      ${testa(0)}
      <td>${testo}</td>
      <td class="num" colspan="4"></td>
      <td class="num">${qty >= 0 ? num(qty) : ''}</td>
      <td class="num">${qty < 0 ? num(-qty) : ''}</td>
    </tr>` + sommanoHTML(p, riga)
  }
  const sub = righe.map((r, i) => {
    const q = r.quantita || 0
    return `<tr class="${q < 0 ? 'nv' : ''}">
      ${testa(i)}
      <td>${i === 0 ? testo : ''}<span class="sub">${escHtml(r.descrizione || '')}</span></td>
      <td class="num">${fatt(r.n)}</td><td class="num">${fatt(r.l1)}</td><td class="num">${fatt(r.l2)}</td><td class="num">${fatt(r.h)}</td>
      <td class="num">${q >= 0 ? num(q) : ''}</td>
      <td class="num">${q < 0 ? num(-q) : ''}</td>
    </tr>`
  }).join('')
  return sub + sommanoHTML(p, riga)
}

/** Quantità eseguita a tutto il SAL (somma delle misure, o quantità attestata). */
function eseguitoQtaPartita(riga: RigaSal | undefined): number {
  if (riga?.misurazioni?.length) return riga.misurazioni.reduce((s, m) => s + (m.quantita || 0), 0)
  return riga?.quantitaProgressiva ?? 0
}

/** Riga «SOMMANO <unità>» che chiude ogni voce, come su un libretto vero. */
function sommanoHTML(p: Partita, riga: RigaSal | undefined): string {
  const q = eseguitoQtaPartita(riga)
  return `<tr class="somma">
    <td></td><td></td>
    <td class="num"><b>SOMMANO ${escHtml(p.um || '')}</b></td>
    <td class="num" colspan="4"></td>
    <td class="num"><b>${q >= 0 ? num(q) : ''}</b></td>
    <td class="num"><b>${q < 0 ? num(-q) : ''}</b></td>
  </tr>`
}

function librettoAMisuraHTML(partite: Partita[], sal: Sal, ord: Map<string, number>, opz?: OpzioniAtto): string {
  const rigaById = new Map(sal.righe.map((r) => [r.partitaId, r]))
  // SOLO le voci misurate: un libretto non elenca ciò che non è stato rilevato
  const misura = partite.filter((p) => p.modalita === 'misura' && voceVisibileInSal(p, sal.numero) && ord.has(p.id) && misurataInSal(p, rigaById.get(p.id), sal.numero))
    .sort((x, y) => (ord.get(x.id)! - ord.get(y.id)!))
  if (!misura.length) return ''
  const body = misura.map((p) => righeMisuraHTML(p, rigaById.get(p.id), sal.numero, ord.get(p.id) ?? 0, sal.data, opz)).join('')
  return `
    <h2 class="sec-h">Lavorazioni a misura</h2>
    <table class="dtable lib">
      <thead>
        <tr>
          <th class="num" rowspan="2">N.</th><th rowspan="2">Tariffa${(opz?.date ?? true) ? '<span class="sub">e data</span>' : ''}</th><th rowspan="2">Designazione dei lavori</th>
          <th class="num" colspan="4">Dimensioni</th>
          <th class="num" colspan="2">Quantità</th>
        </tr>
        <tr>
          <th class="num">par.ug.</th><th class="num">lungh.</th><th class="num">largh.</th><th class="num">H/peso</th>
          <th class="num">Positivi</th><th class="num">Negativi</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
    <p class="note">Il libretto accerta le quantità eseguite: <b>i prezzi e gli importi non vi compaiono</b>, la valutazione economica è del registro di contabilità (artt. 13 e 14 All. II.14). La colonna «N.» è il numero d'ordine di iscrizione della partita: con esso il registro e il sommario richiamano questa misura.</p>`
}

function librettoACorpoHTML(partite: Partita[], sal: Sal, ord: Map<string, number>): string {
  const rigaById = new Map(sal.righe.map((r) => [r.partitaId, r]))
  const corpo = partite.filter((p) => p.modalita === 'corpo' && voceVisibileInSal(p, sal.numero) && ord.has(p.id) && misurataInSal(p, rigaById.get(p.id), sal.numero))
    .sort((x, y) => (ord.get(x.id)! - ord.get(y.id)!))
  if (!corpo.length) return ''
  const body = corpo.map((p) => {
    const r = rigaById.get(p.id)
    const soppressa = voceSoppressaInSal(p, sal.numero)
    const quota = soppressa ? 0 : (r?.quotaPct ?? null)
    return `<tr class="${soppressa ? 'nv' : ''}">
      <td class="num">${ord.get(p.id) || ''}</td>
      <td class="code">${escHtml(p.codice)}</td>
      <td>${escHtml(p.descrizione)}${soppressa ? `<span class="sub">corpo soppresso e portato in detrazione al SAL n. ${escHtml(String(p.soppressaSal))} (storno)</span>` : ''}</td>
      <td class="num">${aliquotaCorpoPct(p, partite) == null ? '—' : pct(aliquotaCorpoPct(p, partite))}</td>
      <td class="num">${soppressa ? '<i>stornata</i>' : quota == null ? '<i>—</i>' : pct(quota, 2)}</td>
    </tr>`
  }).join('')
  return `
    <h2 class="sec-h">Lavorazioni a corpo</h2>
    <p class="note">Per gli appalti a corpo si registra la quota percentuale dell'aliquota della voce disaggregata eseguita a ogni stato di avanzamento (art. 12 All. II.14). Anche qui l'importo maturato è affare del registro: qui si accerta la quota.</p>
    <table class="dtable">
      <thead><tr>
        <th class="num">N.</th><th>Corpo</th><th>Categoria / designazione</th>
        <th class="num">Aliquota</th><th class="num">% eseguita a tutto il SAL</th>
      </tr></thead>
      <tbody>${body}</tbody>
    </table>`
}

/** Sezione «Lavorazioni in economia»: le liste settimanali che competono al SAL. */
function librettoEconomiaHTML(liste: ListaEconomia[] | undefined, sal: Sal): string {
  const del = listeATuttoSal(liste, sal.numero)
  if (!del.length) return ''
  const body = del.map((l) => {
    const ore = (l.operai || []).reduce((s, r) => s + (r.ore || 0), 0)
    return `<tr>
      <td class="code">L${escHtml(String(l.numero ?? ''))}</td>
      <td>Lista settimanale in economia${l.data ? ` del ${escHtml(l.data)}` : ''}</td>
      <td class="num">${num(ore)}</td>
      <td class="num">${escHtml(String(l.mezzi?.length || 0))}</td>
      <td class="num">${escHtml(String(l.provviste?.length || 0))}</td>
    </tr>`
  }).join('')
  return `
    <h2 class="sec-h">Lavorazioni in economia</h2>
    <p class="note">Lavori disposti dal DL e contabilizzati per risorse impiegate (liste settimanali di operai, mezzi e provviste), art. 181 D.Lgs. 36/2023. Le liste sono allegate al libretto; la loro valorizzazione è riportata nel registro di contabilità.</p>
    <table class="dtable">
      <thead><tr><th>Rif. lista</th><th>Designazione</th><th class="num">Ore operai</th><th class="num">Voci di nolo</th><th class="num">Provviste</th></tr></thead>
      <tbody>${body}</tbody>
    </table>`
}

export function librettoHTML(appalto: Appalto, partite: Partita[], sal: Sal, liste?: ListaEconomia[], consegne?: Consegna[], opz?: OpzioniAtto, sals?: Sal[]): string {
  // i numeri d'ordine sono quelli del registro: si contano sui SAL fino a questo
  const ord = ordineIscrizione(partite, (sals || [sal]).filter((s) => s.numero <= sal.numero))
  const misuraHTML = librettoAMisuraHTML(partite, sal, ord, opz)
  const corpoHTML = librettoACorpoHTML(partite, sal, ord)
  const economiaHTML = librettoEconomiaHTML(liste, sal)
  const segue = notaSeguito(consegne, 'libretto', sal.numero, 'Libretto delle misure')
  const body = `
    ${segue ? `<p class="note"><b>${escHtml(segue)}</b></p>` : ''}
    <p class="note">Libretto delle misure — accerta le lavorazioni eseguite a tutto il SAL n. ${escHtml(String(sal.numero))}${sal.data ? ` (${escHtml(sal.data)})` : ''}. Le misure sono rilevate in contraddittorio con l'esecutore.</p>
    ${misuraHTML}
    ${corpoHTML}
    ${economiaHTML}
    ${!misuraHTML && !corpoHTML && !economiaHTML ? '<p class="note"><i>Nessuna lavorazione registrata per questo SAL.</i></p>' : ''}
    ${firmeHTML([{ ruolo: ilDirettore(appalto), nome: appalto.direttoreLavori }, { ruolo: "L'esecutore" }])}
  `
  return renderDocPage({
    tool: 'contabilita',
    brand: 'none',
    enteHeader: enteDi(appalto),
    kicker: kickerDi(appalto, `Libretto · SAL ${sal.numero}`),
    title: 'Libretto delle Misure',
    sub: `SAL n. ${sal.numero}${sal.data ? ' del ' + sal.data : ''}`,
    headMeta: headMetaDi(appalto),
    bodyHTML: body,
    footer: { fields: footerFieldsDi(appalto), disc: 'Art. 13 (a misura) / art. 12 (a corpo) Allegato II.14 D.Lgs. 36/2023. Importi al netto di IVA.', page: `Libretto SAL ${sal.numero}` },
    docTitle: `Libretto delle Misure — SAL ${sal.numero}`,
  })
}

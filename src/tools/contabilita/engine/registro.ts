/**
 * Contabilità — REGISTRO DI CONTABILITÀ (art. 12 c. 1 lett. c) All. II.14). Riassume e accentra la
 * contabilizzazione: trascrive le partite dai libretti in ordine cronologico,
 * determina il credito progressivo, ospita le riserve dell'esecutore (iscritte
 * alla firma di ogni SAL) e le motivate deduzioni del DL.
 */
import { renderDocPage, escHtml } from '../../../shared/doc/doc'
import { eur, num, pct } from '../../../shared/format'
import type { Appalto, Partita, Sal, Riserva, ListaEconomia, Consegna } from './types'
import { calcolaSals, eseguitoPartita, voceVisibileInSal, voceSoppressaInSal, round2 } from './contabilita'
import { economiaATuttoSal } from './economia'
import { enteDi, footerFieldsDi, headMetaDi, kickerDi, firmeHTML, ilDirettore, testoVoceHTML, type OpzioniAtto } from './doc-common'
import { ordineIscrizione, salDiIscrizione, rifLibretto, notaSeguito } from './atti-rif'
import { riserveRegistroHTML, firmaEsecutoreNota } from './riserve'

function partiteHTML(appalto: Appalto, partite: Partita[], sals: Sal[], liste?: ListaEconomia[], opz?: OpzioniAtto): string {
  const results = calcolaSals(appalto, partite, sals, liste)
  const ultimo = results[results.length - 1]
  const salN = ultimo?.numero ?? 1
  const economia = economiaATuttoSal(liste, salN)
  // si iscrivono SOLO le voci contabilizzate, col loro numero d'ordine, in ordine di iscrizione
  const fino = sals.filter((s) => s.numero <= salN)
  const ord = ordineIscrizione(partite, fino)
  const lmDi = salDiIscrizione(fino)
  const rigaById = new Map((ultimo ? sals.find((s) => s.numero === ultimo.numero)?.righe : [])?.map((r) => [r.partitaId, r]) || [])
  const progById = new Map((ultimo?.righe || []).map((r) => [r.partita.id, r.progressivo]))
  const rows = partite.filter((p) => voceVisibileInSal(p, salN) && ord.has(p.id))
    .sort((a, b) => (ord.get(a.id)! - ord.get(b.id)!)).map((p) => {
    const r = rigaById.get(p.id)
    const soppressa = voceSoppressaInSal(p, salN)
    const eseg = eseguitoPartita(p, r, salN)
    const n = ord.get(p.id) ?? 0
    // da quale libretto viene la partita: quello del SAL in cui è entrata in contabilità
    const lm = lmDi.get(p.id) ?? p.introdottaSal ?? 1
    // la quantità è quella progressiva del SAL: dal totale attestato o dalla somma
    // delle righe di misura (sono due modi di scrivere lo stesso dato, non due dati)
    const prog = progById.get(p.id)
    const qtaCol = soppressa ? '<i>stornata</i>' : (p.modalita === 'corpo' ? (r?.quotaPct == null ? '—' : pct(r.quotaPct, 1)) : (prog == null ? '—' : num(prog)))
    return `<tr class="${soppressa ? 'nv' : ''}">
      <td class="num">${n || ''}</td>
      <td class="code">${escHtml(rifLibretto(lm, n))}</td>
      <td><b>${escHtml(p.codice)}</b> ${testoVoceHTML(p, opz)}<span class="sub">${p.modalita === 'corpo' ? 'a corpo' : 'a misura · ' + (p.um || '')}${soppressa ? ` · soppressa al SAL ${p.soppressaSal} (storno)` : ''}</span></td>
      <td class="num">${p.modalita === 'corpo' ? '—' : (p.prezzoUnitario == null ? '—' : eur(p.prezzoUnitario))}</td>
      <td class="num">${qtaCol}</td>
      <td class="num">${eur(eseg)}</td>
    </tr>`
  }).join('')
  const economiaRow = economia > 0
    ? `<tr><td class="num">—</td><td class="code">liste</td><td>Lavori in economia (liste settimanali)<span class="sub">liste settimanali di operai, mezzi e provviste</span></td><td class="num">—</td><td class="num">a economia</td><td class="num">${eur(economia)}</td></tr>`
    : ''
  // Le voci di sicurezza sono già righe del registro; gli oneri contrattuali a
  // corpo (non rappresentati da voci) si iscrivono per quota di avanzamento.
  const sicurezzaVoci = round2((ultimo?.righe || []).filter((r) => r.partita.sicurezza).reduce((s, r) => s + r.eseguito, 0))
  const quotaOneri = round2((ultimo?.oneriSicurezzaEseguiti ?? 0) - sicurezzaVoci)
  const oneriRow = quotaOneri > 0
    ? `<tr><td class="num">—</td><td class="code">—</td><td>Oneri della sicurezza (quota di avanzamento)<span class="sub">importo contrattuale degli oneri della sicurezza, liquidato in proporzione ai lavori eseguiti; non soggetto a ribasso d'asta</span></td><td class="num">—</td><td class="num">quota</td><td class="num">${eur(quotaOneri)}</td></tr>`
    : ''
  // Il totale del registro è il contabilizzato LORDO a tutto il SAL: lavori e
  // somministrazioni più gli oneri della sicurezza. Il ribasso d'asta non si
  // applica qui — opera nello stato di avanzamento, sui soli lavori.
  const totale = round2((ultimo?.lavoriEseguiti ?? 0) + (ultimo?.oneriSicurezzaEseguiti ?? 0))
  const salN2 = ultimo?.numero ?? 1
  return `<table class="dtable">
    <thead><tr><th class="num">N.</th><th>Rif. libretto</th><th>Designazione</th><th class="num">Prezzo</th><th class="num">% / Qtà</th><th class="num">Importo</th></tr></thead>
    <tbody>${anticipazioneRow(appalto, results[0]?.anticipazione)}${rows}${economiaRow}${oneriRow}<tr class="tot"><td colspan="5">Totale contabilizzato a tutto il SAL n. ${escHtml(String(salN2))} (lavori, somministrazioni e oneri della sicurezza)</td><td class="num">${eur(totale)}</td></tr></tbody>
  </table>`
}

/**
 * ANTICIPAZIONE: è la PRIMA ANNOTAZIONE del registro di contabilità (art. 125
 * c. 1 D.Lgs. 36/2023). Non è un lavoro eseguito — non entra nel credito — ma
 * va iscritta, perché è una somma già corrisposta all'impresa che si recupera
 * sui certificati successivi. Chi legge il registro deve vederla al suo posto.
 */
function anticipazioneRow(appalto: Appalto, importo: number | undefined): string {
  const pctAnt = appalto.anticipazionePct || 0
  if (!pctAnt || !importo) return ''
  return `<tr class="nv">
    <td class="num">—</td><td class="code">—</td>
    <td>Anticipazione del prezzo corrisposta all'esecutore<span class="sub">${escHtml(String(pctAnt).replace('.', ','))}% del valore del contratto, art. 125 c. 1 D.Lgs. 36/2023 — si recupera con la stessa percentuale su ogni certificato di pagamento; non è lavoro eseguito e non concorre al credito</span></td>
    <td class="num">—</td><td class="num">anticipo</td><td class="num">${eur(importo)}</td>
  </tr>`
}

/**
 * Annotazione dei certificati di pagamento emessi: il registro ne dà atto
 * (art. 12 c. 1 lett. c) All. II.14) — è la scrittura che chiude il progressivo e collega il
 * registro al titolo di spesa.
 */
function certificatiEmessiHTML(appalto: Appalto, partite: Partita[], sals: Sal[], liste?: ListaEconomia[], ultimoSal?: number): string {
  const fino = ultimoSal ?? Number.MAX_SAFE_INTEGER
  const res = calcolaSals(appalto, partite, sals, liste).filter((r) => r.numero <= fino)
  const righe = res.map((r) => {
    const sal = sals.find((s) => s.numero === r.numero)
    const n = sal?.numeroCertificato ?? r.numero
    const data = sal?.dataCertificato
    // un credito nullo o negativo non si certifica: lo si dice, non lo si scrive come importo
    const imp = r.importoSal > 0 ? eur(r.importoSal) : `<i>nessun credito da certificare</i>`
    return `<tr><td class="num">${escHtml(String(n))}</td><td>${data ? escHtml(data) : '<i>da emettere</i>'}</td><td class="num">${imp}</td></tr>`
  }).join('')
  if (!righe) return ''
  return `
    <h2 class="sec-h">Certificati di pagamento emessi</h2>
    <table class="dtable">
      <thead><tr><th class="num">Cert. n.</th><th>Data di emissione</th><th class="num">Importo certificato</th></tr></thead>
      <tbody>${righe}</tbody>
    </table>`
}

export function registroHTML(appalto: Appalto, partite: Partita[], sals: Sal[], riserve?: Riserva[], liste?: ListaEconomia[], consegne?: Consegna[], oggi?: string, opz?: OpzioniAtto): string {
  const ultimo = sals[sals.length - 1]
  const salN = ultimo?.numero ?? 1
  const segue = notaSeguito(consegne, 'registro', salN, 'Registro di contabilità')
  const body = `
    ${segue ? `<p class="note"><b>${escHtml(segue)}</b></p>` : ''}
    <p class="note">Registro di contabilità — trascrive le partite dei libretti delle misure in ordine cronologico e individua il credito progressivo dell'impresa. Un solo registro, a fogli numerati di seguito e, se la stazione appaltante lo richiede, vidimati prima dell'inizio dei lavori (art. 12 c. 1 lett. c) All. II.14): gli avanzamenti successivi ne continuano le pagine, non ne aprono uno nuovo.</p>
    <h2 class="sec-h">Partite contabilizzate</h2>
    ${partiteHTML(appalto, partite, sals, liste, opz)}
    ${certificatiEmessiHTML(appalto, partite, sals, liste, salN)}
    ${riserveRegistroHTML(riserve, oggi)}
    ${firmaEsecutoreNota(ultimo)}
    ${firmeHTML([{ ruolo: ilDirettore(appalto), nome: appalto.direttoreLavori }, { ruolo: "L'esecutore (per accettazione / con riserva)" }])}
  `
  return renderDocPage({
    tool: 'contabilita', brand: 'none', enteHeader: enteDi(appalto),
    kicker: kickerDi(appalto, 'Registro'),
    title: 'Registro di Contabilità',
    headMeta: headMetaDi(appalto),
    bodyHTML: body,
    footer: { fields: footerFieldsDi(appalto), disc: 'Art. 12 c. 1 lett. c) Allegato II.14 D.Lgs. 36/2023. La firma del registro è il momento dell\'iscrizione delle riserve, a pena di decadenza.', page: 'Registro' },
    docTitle: `Registro di Contabilità — ${appalto.oggetto || 'Lavori'}`,
  })
}

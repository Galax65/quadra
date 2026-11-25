/**
 * Contabilità — SOMMARIO DEL REGISTRO (art. 15, All. II.14). Sintesi per gruppi di
 * lavorazioni omogenee (categoria): importo contrattuale, importo a tutto il SAL
 * corrente, importo dei SAL precedenti, importo nel SAL corrente (differenza).
 */
import { renderDocPage, escHtml } from '../../../shared/doc/doc'
import { eur, num } from '../../../shared/format'
import type { Appalto, Partita, Sal, ListaEconomia } from './types'
import { calcolaSals, importoContrattualePartita, voceVisibileInSal } from './contabilita'
import { economiaATuttoSal } from './economia'
import { categoriaLiv1 } from './import'
import { ordineIscrizione } from './atti-rif'
import { enteDi, footerFieldsDi, headMetaDi, kickerDi, SEZIONI, TITOLO_SEZIONE, sezioneDi, testoVoceHTML, type OpzioniAtto } from './doc-common'
import { partiteVigenti } from './perizie'

interface RigaSommario {
  categoria: string; contrattuale: number; aTutto: number; precedenti: number; corrente: number
  /** Numeri d'ordine del registro che compongono il gruppo (richiamo «RC n. …»). */
  ordini: number[]
}

/** «RC n. 3÷9» oppure «RC n. 3, 7, 12» per pochi numeri: il richiamo al registro. */
export function rifRC(ordini: number[]): string {
  const v = [...new Set(ordini.filter((n) => n > 0))].sort((a, b) => a - b)
  if (!v.length) return '—'
  if (v.length <= 3) return `RC n. ${v.join(', ')}`
  const contigui = v[v.length - 1] - v[0] === v.length - 1
  return contigui ? `RC n. ${v[0]}÷${v[v.length - 1]}` : `RC n. ${v[0]}÷${v[v.length - 1]} (${v.length} voci)`
}

/** Aggrega per categoria (liv.1) gli importi contrattuali e gli eseguiti al SAL k e k−1. */
export function buildSommario(appalto: Appalto, partite: Partita[], sals: Sal[], numero: number, liste?: ListaEconomia[]): RigaSommario[] {
  const results = calcolaSals(appalto, partite, sals, liste)
  const cur = results.find((s) => s.numero === numero)
  const prev = results.filter((s) => s.numero < numero).sort((a, b) => b.numero - a.numero)[0]
  const esegById = (r?: typeof cur): Map<string, number> => {
    const m = new Map<string, number>()
    if (!r) return m
    for (const rr of r.righe) m.set(rr.partita.id, rr.eseguito)
    return m
  }
  const curMap = esegById(cur), prevMap = esegById(prev)
  const ord = ordineIscrizione(partite, sals.filter((s) => s.numero <= numero))
  const gruppi = new Map<string, RigaSommario>()
  for (const p of partite) {
    if (!voceVisibileInSal(p, numero)) continue // le voci introdotte dopo questo SAL non esistono ancora
    const cat = categoriaLiv1(p.categoria)
    const g = gruppi.get(cat) || { categoria: cat, contrattuale: 0, aTutto: 0, precedenti: 0, corrente: 0, ordini: [] }
    g.ordini.push(ord.get(p.id) ?? 0)
    g.contrattuale = round2(g.contrattuale + importoContrattualePartita(p))
    g.aTutto = round2(g.aTutto + (curMap.get(p.id) || 0))
    g.precedenti = round2(g.precedenti + (prevMap.get(p.id) || 0))
    g.corrente = round2(g.aTutto - g.precedenti)
    gruppi.set(cat, g)
  }
  // Lavori in economia: categoria a sé (senza importo contrattuale: si paga sull'effettivo).
  const ecoA = economiaATuttoSal(liste, numero)
  const ecoP = prev ? economiaATuttoSal(liste, prev.numero) : 0
  if (ecoA > 0 || ecoP > 0) gruppi.set('Lavori in economia', { categoria: 'Lavori in economia', contrattuale: 0, aTutto: ecoA, precedenti: ecoP, corrente: round2(ecoA - ecoP), ordini: [] })
  return [...gruppi.values()]
}

const round2 = (n: number): number => { const x = Math.abs(n) * 100; return Math.sign(n) * Math.round(Number(x.toPrecision(15))) / 100 }

/**
 * Corpo del sommario «voce per voce» (forma d'uso degli atti contabili): per ogni
 * partita i richiami al SAL e al numero d'ordine del registro con la quantità
 * contabilizzata in quell'avanzamento, la riga SOMMANO al SAL con quantità
 * totale, prezzo unitario e importo, e il parziale di sezione.
 */
function vociHTML(appalto: Appalto, partite: Partita[], sals: Sal[], numero: number, liste?: ListaEconomia[], opz?: OpzioniAtto): { html: string; totale: number } {
  const fino = [...sals].filter((s) => s.numero <= numero).sort((a, b) => a.numero - b.numero)
  const res = calcolaSals(appalto, partite, fino, liste)
  // progressivo (quantità, o quota % per le voci a corpo) ed eseguito di ogni voce a ogni SAL
  const prog = new Map<number, Map<string, { q: number; imp: number }>>()
  for (const r of res) prog.set(r.numero, new Map(r.righe.map((x) => [x.partita.id, { q: x.progressivo ?? 0, imp: x.eseguito }])))
  const ord = ordineIscrizione(partite, fino)
  const pv = partiteVigenti(partite, appalto.perizie, numero)
  const testa = `<thead><tr>
      <th class="num">N.</th><th>Tariffa</th>
      <th>Indicazione dei lavori e delle somministrazioni</th>
      <th>Rif. registro<span class="sub">SAL · n. d'ordine</span></th>
      <th class="num">Quantità</th><th class="num">Prezzo unitario</th><th class="num">Importo</th>
    </tr></thead>`
  let totale = 0
  const sezioni: string[] = []
  for (const sez of SEZIONI) {
    const voci = pv.filter((p) => sezioneDi(p) === sez && voceVisibileInSal(p, numero) && ord.has(p.id))
      .sort((a, b) => (ord.get(a.id)! - ord.get(b.id)!))
    if (!voci.length) continue
    let parziale = 0
    const righe = voci.map((p) => {
      const corpo = p.modalita === 'corpo'
      const fq = (q: number): string => (corpo ? num(q) + ' %' : num(q))
      const n = ord.get(p.id) ?? 0
      const rif: string[] = []
      let prima = { q: 0, imp: 0 }
      for (const s of fino) {
        const ora = prog.get(s.numero)?.get(p.id) ?? prima
        if (Math.abs(ora.q - prima.q) > 0.0001 || Math.abs(ora.imp - prima.imp) > 0.004) {
          rif.push(`<tr class="rif">
            <td class="num"></td><td></td><td></td>
            <td class="code">SAL ${escHtml(String(s.numero))} · n. ${escHtml(String(n))}</td>
            <td class="num">${fq(round2(ora.q - prima.q))}</td><td class="num"></td>
            <td class="num">${num(round2(ora.imp - prima.imp))}</td>
          </tr>`)
        }
        prima = ora
      }
      const fin = prog.get(numero)?.get(p.id) ?? { q: 0, imp: 0 }
      parziale = round2(parziale + fin.imp)
      return `<tr>
        <td class="num">${n || ''}</td><td class="code">${escHtml(p.codice)}</td>
        <td>${testoVoceHTML(p, opz)}</td>
        <td></td><td class="num"></td><td class="num"></td><td class="num"></td>
      </tr>${rif.join('')}<tr class="somma">
        <td class="num"></td><td></td>
        <td>SOMMANO al SAL n. ${escHtml(String(numero))} ${escHtml(corpo ? 'a corpo' : (p.um || ''))}</td>
        <td></td>
        <td class="num">${fq(fin.q)}</td>
        <td class="num">${corpo ? num(importoContrattualePartita(p)) : (p.prezzoUnitario == null ? '' : num(p.prezzoUnitario))}</td>
        <td class="num">${num(fin.imp)}</td>
      </tr>`
    }).join('')
    totale = round2(totale + parziale)
    sezioni.push(`
    <h2 class="sec-h">${escHtml(TITOLO_SEZIONE[sez])}</h2>
    <table class="dtable som">${testa}<tbody>${righe}
      <tr class="tot"><td colspan="6">Parziale ${escHtml(TITOLO_SEZIONE[sez].toLowerCase())}</td><td class="num">${eur(parziale)}</td></tr>
    </tbody></table>`)
  }
  const eco = economiaATuttoSal(liste, numero)
  if (eco > 0) {
    totale = round2(totale + eco)
    sezioni.push(`
    <h2 class="sec-h">LAVORI IN ECONOMIA</h2>
    <table class="dtable som">${testa}<tbody>
      <tr><td class="num">—</td><td class="code">liste</td><td>Lavori in economia a tutto il SAL n. ${escHtml(String(numero))}<span class="sub">liste settimanali di operai, mezzi e provviste — art. 181 D.Lgs. 36/2023</span></td><td></td><td class="num"></td><td class="num"></td><td class="num">${num(eco)}</td></tr>
      <tr class="tot"><td colspan="6">Parziale lavori in economia</td><td class="num">${eur(eco)}</td></tr>
    </tbody></table>`)
  }
  return { html: sezioni.join(''), totale }
}

export function sommarioHTML(appalto: Appalto, partite: Partita[], sals: Sal[], numero: number, liste?: ListaEconomia[], opz?: OpzioniAtto): string {
  const voci = vociHTML(appalto, partite, sals, numero, liste, opz)
  const righe = buildSommario(appalto, partite, sals, numero, liste)
  const tot = righe.reduce((a, r) => ({
    contrattuale: round2(a.contrattuale + r.contrattuale), aTutto: round2(a.aTutto + r.aTutto),
    precedenti: round2(a.precedenti + r.precedenti), corrente: round2(a.corrente + r.corrente),
  }), { contrattuale: 0, aTutto: 0, precedenti: 0, corrente: 0 })
  const rows = righe.map((r) => `<tr>
      <td>${escHtml(r.categoria)}<span class="sub">SAL ${escHtml(String(numero))} · ${escHtml(rifRC(r.ordini))}</span></td>
      <td class="num">${eur(r.contrattuale)}</td>
      <td class="num">${eur(r.aTutto)}</td>
      <td class="num">${eur(r.precedenti)}</td>
      <td class="num">${eur(r.corrente)}</td>
    </tr>`).join('')
  const body = `
    <p class="note">Sommario del registro di contabilità al SAL n. ${escHtml(String(numero))}: riepiloga voce per voce quanto trascritto nel registro, con il richiamo al SAL e al numero d'ordine di ogni partita, la quantità contabilizzata in ciascun avanzamento e l'importo a tutto il SAL. Importi al lordo del ribasso d'asta e al netto di IVA: il ribasso opera nello stato di avanzamento, sui soli lavori.</p>
    ${voci.html}
    <table class="dtable">
      <tbody><tr class="tot"><td>TOTALE a tutto il SAL n. ${escHtml(String(numero))} (lavori, somministrazioni e costi della sicurezza)</td><td class="num">${eur(voci.totale)}</td></tr></tbody>
    </table>
    <h2 class="sec-h">Riepilogo per gruppi di lavorazioni omogenee</h2>
    <table class="dtable">
      <thead><tr><th>Categoria di lavorazioni<span class="sub">richiamo al SAL e ai numeri d'ordine del registro</span></th><th class="num">Contrattuale</th><th class="num">A tutto il SAL ${escHtml(String(numero))}</th><th class="num">SAL precedenti</th><th class="num">Nel SAL ${escHtml(String(numero))}</th></tr></thead>
      <tbody>${rows}
        <tr class="tot"><td>TOTALE</td><td class="num">${eur(tot.contrattuale)}</td><td class="num">${eur(tot.aTutto)}</td><td class="num">${eur(tot.precedenti)}</td><td class="num">${eur(tot.corrente)}</td></tr>
      </tbody>
    </table>`
  return renderDocPage({
    tool: 'contabilita', brand: 'none', enteHeader: enteDi(appalto),
    kicker: kickerDi(appalto, `Sommario · SAL ${numero}`),
    title: 'Sommario del Registro di Contabilità',
    sub: `al SAL n. ${numero}`,
    headMeta: headMetaDi(appalto),
    bodyHTML: body,
    footer: { fields: footerFieldsDi(appalto), disc: 'Art. 15 Allegato II.14 D.Lgs. 36/2023. Importi al netto di IVA.', page: `Sommario SAL ${numero}` },
    docTitle: `Sommario del Registro — SAL ${numero}`,
  })
}

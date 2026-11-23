/**
 * Computo — REVISIONI (versioni del progetto).
 *
 * Un lavoro non ha un computo: ne ha una successione — PFTE, definitivo, esecutivo,
 * contratto, perizie — e ciò che conta, quando si discute con l'ente o con l'impresa,
 * è il CONFRONTO fra due di esse. Qui il computo corrente si congela in una revisione
 * (nome, fase, data: una fotografia autonoma, con i prezzi di allora) e la si confronta
 * con il computo di adesso, voce per voce.
 *
 * La fotografia è volutamente PIATTA e autosufficiente: codice, descrizione, unità,
 * prezzo, quantità. Così un confronto resta leggibile anche se nel frattempo le voci
 * sono state rinominate, ricategorizzate o il prezzario è cambiato.
 *
 * MEMORIZZATA, NON DERIVATA (Docs/06-Interfaccia-unica.md, tappa 7). Una
 * revisione porta con sé il SUO elenco prezzi (gli articoli con i prezzi di
 * allora e da dove venivano) e le misure di ogni voce: è un computo intero, che
 * resta nel file accanto a quello in corso. Il nome, la fase, la data e le note
 * si correggono (rinominaRevisione); il contenuto no — una revisione che si
 * potesse riscrivere non sarebbe più una revisione.
 *
 * Non ogni revisione del progetto è una revisione del computo: cambiano gli
 * elaborati, la relazione, le tavole, e il computo resta quello. Per questo
 * esiste la revisione DI PROGETTO (natura 'progetto'): ha nome, fase e data,
 * e dice su quale revisione di computo poggia, senza fotografare niente.
 */
import { importoVoce } from '../../../shared/stampa/computo-pdf'
import type { VoceComputo } from '../../../shared/xpwe/xpwe'

/** Le fasi in cui vive un computo (All. I.7 D.Lgs. 36/2023 per i livelli di progetto). */
export const FASI_COMPUTO = ['PFTE', 'definitivo', 'esecutivo', 'contratto', 'perizia', 'altro'] as const
export type FaseComputo = (typeof FASI_COMPUTO)[number]

/** Una voce del computo nel formato condiviso Computo/Contabilità, con la chiave interna di Computo. */
export type VoceRev = VoceComputo & {
  _key?: string
  np?: boolean
  analisiPrezzi?: unknown
  codiceOrig?: string
  regione?: string
  anno?: string | number
}

/** Una riga di misura, come la si è scritta: resta con la revisione. */
export interface MisuraRevisione { descrizione?: string; parti?: number | null; l1?: number | null; l2?: number | null; h?: number | null; quantita: number; formula?: string }

export interface VoceRevisione {
  key: string
  codice: string
  descrizione: string
  um: string
  prezzo: number
  qty: number
  corpo?: boolean
  sicurezza?: boolean
  categoria?: string
  wbs?: string
  /** Le misure di dettaglio da cui veniva la quantità. */
  misurazioni?: MisuraRevisione[]
  importo: number
}

/** Un articolo dell'elenco prezzi, com'era quando la revisione è stata congelata. */
export interface ArticoloRevisione {
  codice: string
  descrizione: string
  um: string
  prezzo: number
  /** Da dove viene il prezzo: «Veneto 2026», «nuovo prezzo», «analisi». */
  provenienza: string
  np?: boolean
  analisi?: boolean
  sicurezza?: boolean
  /** Il codice del prezzario da cui è nato un nuovo prezzo. */
  codiceOrig?: string
  /** Quante voci del computo lo usano. */
  usi: number
}

/** 'computo' = fotografia di voci ed elenco prezzi; 'progetto' = solo l'atto (il computo non cambia). */
export type NaturaRevisione = 'computo' | 'progetto'

/** Un cambio di nome, perché resti traccia di come si chiamava. */
export interface RinominaRevisione { da: string; il: string }

export interface Revisione {
  id: string
  nome: string
  fase: FaseComputo
  data: string
  note?: string
  /** Assente nelle revisioni salvate prima: valgono come revisioni di computo. */
  natura?: NaturaRevisione
  voci: VoceRevisione[]
  /** L'elenco prezzi congelato con la revisione (assente nelle revisioni vecchie: si ricava dalle voci). */
  elenco?: ArticoloRevisione[]
  /** Solo per le revisioni di progetto: la revisione di computo su cui poggiano. */
  computoDi?: string
  totale: number
  ts?: number
  rinomine?: RinominaRevisione[]
}

const r2 = (n: number): number => Math.round(n * 100) / 100
const chiaveDi = (v: VoceRev, i: number): string => v._key || `${(v.codice || '').trim()}#${i}`
/** Quantità della voce: la somma delle misure se ci sono, altrimenti la quantità secca. */
const qtyDi = (v: VoceRev): number => (v.misurazioni?.length ? r2(v.misurazioni.reduce((s, m) => s + (m.quantita || 0), 0)) : r2(v.qty ?? 0))

const provenienzaDi = (v: VoceRev): string =>
  v.np ? (v.analisiPrezzi ? 'nuovo prezzo · analisi' : 'nuovo prezzo')
    : v.analisiPrezzi ? 'analisi'
    : [v.regione, v.anno && v.anno !== '—' ? v.anno : ''].filter(Boolean).join(' ') || 'elenco del progetto'

/**
 * L'elenco prezzi delle voci: un articolo per codice (le voci senza codice sono
 * articoli a sé), con il prezzo e da dove viene. È quello che si congela con
 * una revisione e che si ricava, per quelle vecchie, dalle loro voci.
 */
export function elencoDaVoci(voci: VoceRev[]): ArticoloRevisione[] {
  const m = new Map<string, ArticoloRevisione>()
  voci.forEach((v, i) => {
    const codice = (v.codice || '').trim()
    const id = codice ? `${codice}|${v.um || ''}` : `#${chiaveDi(v, i)}`
    const a = m.get(id)
    if (a) { a.usi++; return }
    const art: ArticoloRevisione = {
      codice, descrizione: (v.desc_short || v.declaratoria || codice).trim(), um: v.um || '',
      prezzo: v.prezzo || 0, provenienza: provenienzaDi(v), usi: 1,
    }
    if (v.np) art.np = true
    if (v.analisiPrezzi) art.analisi = true
    if (v.sicurezza) art.sicurezza = true
    if (v.codiceOrig) art.codiceOrig = v.codiceOrig
    m.set(id, art)
  })
  return [...m.values()]
}

/** La natura di una revisione: le vecchie, senza natura, erano tutte di computo. */
export const naturaDi = (r: Pick<Revisione, 'natura'>): NaturaRevisione => r.natura || 'computo'

/** L'elenco prezzi di una revisione: quello congelato, o (revisioni vecchie) quello delle sue voci. */
export function elencoDellaRevisione(r: Revisione): ArticoloRevisione[] {
  if (naturaDi(r) === 'progetto') return []
  if (Array.isArray(r.elenco)) return r.elenco
  return elencoDaVoci(r.voci.map((v) => ({ codice: v.codice, desc_short: v.descrizione, um: v.um, prezzo: v.prezzo, sicurezza: v.sicurezza, _key: v.key } as VoceRev)))
}

/** Fotografa il computo corrente: una revisione autonoma, con i prezzi di oggi. */
export function snapshotComputo(voci: VoceRev[], meta: { id: string; nome: string; fase: FaseComputo; data: string; note?: string; ts?: number }): Revisione {
  const righe: VoceRevisione[] = voci.map((v, i) => {
    const r: VoceRevisione = {
      key: chiaveDi(v, i),
      codice: (v.codice || '').trim(),
      descrizione: (v.desc_short || v.declaratoria || v.codice || '').trim(),
      um: v.um || '',
      prezzo: v.prezzo || 0,
      qty: qtyDi(v),
      importo: importoVoce(v),
    }
    if (v.corpo) r.corpo = true
    if (v.sicurezza) r.sicurezza = true
    if (v.categoria) r.categoria = v.categoria
    if (v.wbs) r.wbs = v.wbs
    if (v.misurazioni?.length) r.misurazioni = v.misurazioni.map((x) => ({ ...x }) as MisuraRevisione)
    return r
  })
  return { ...meta, natura: 'computo', voci: righe, elenco: elencoDaVoci(voci), totale: r2(righe.reduce((s, r) => s + r.importo, 0)) }
}

/**
 * Una revisione DI PROGETTO: gli elaborati cambiano, il computo no. Non
 * fotografa voci né prezzi; dice su quale revisione di computo poggia (l'ultima
 * congelata, se c'è) e ne riporta il totale, perché a colpo d'occhio si veda
 * che l'importo non è cambiato.
 */
export function revisioneDiProgetto(meta: { id: string; nome: string; fase: FaseComputo; data: string; note?: string; ts?: number }, computo?: Revisione | null): Revisione {
  return { ...meta, natura: 'progetto', voci: [], totale: computo ? computo.totale : 0, ...(computo ? { computoDi: computo.id } : {}) }
}

/** L'ultima revisione di computo prima di `prima` (o in assoluto): quella su cui poggia il progetto. */
export function ultimaDiComputo(revisioni: Revisione[], prima?: number): Revisione | null {
  const ordinate = revisioni.slice().sort((a, b) => (a.ts || 0) - (b.ts || 0))
  let ult: Revisione | null = null
  for (const r of ordinate) {
    if (prima != null && (r.ts || 0) >= prima) break
    if (naturaDi(r) === 'computo') ult = r
  }
  return ult
}

/**
 * Corregge come si chiama una revisione — nome, fase, data, note — e lascia
 * traccia del nome di prima. Il contenuto (voci, elenco, totale) non si tocca:
 * restituisce una revisione nuova che lo condivide intatto.
 */
export function rinominaRevisione(r: Revisione, patch: { nome?: string; fase?: FaseComputo; data?: string; note?: string }, oggi: string): Revisione {
  const nome = patch.nome != null ? patch.nome.trim() : r.nome
  if (!nome) throw new Error('Una revisione deve avere un nome')
  const out: Revisione = { ...r, nome }
  if (patch.fase) out.fase = patch.fase
  if (patch.data != null) out.data = patch.data.trim()
  if (patch.note != null) { const n = patch.note.trim(); if (n) out.note = n; else delete out.note }
  if (nome !== r.nome) out.rinomine = [...(r.rinomine || []), { da: r.nome, il: oggi }]
  return out
}

export type StatoConfronto = 'invariata' | 'variata' | 'nuova' | 'soppressa'

export interface RigaConfronto {
  key: string
  codice: string
  descrizione: string
  um: string
  qtyPrima: number | null
  qtyDopo: number | null
  prezzoPrima: number | null
  prezzoDopo: number | null
  importoPrima: number
  importoDopo: number
  differenza: number
  stato: StatoConfronto
}

export interface Confronto {
  righe: RigaConfronto[]
  totalePrima: number
  totaleDopo: number
  differenza: number
  /** Variazione % sul totale della revisione (null se la revisione era a zero). */
  variazionePct: number | null
  nuove: number
  soppresse: number
  variate: number
}

/**
 * Confronto fra una revisione e il computo corrente. L'abbinamento è per chiave di
 * voce; se la chiave non c'è più (voce ricomposta) si ritenta per codice, perché a
 * schermo è il codice che l'utente riconosce.
 */
export function confrontaRevisione(rev: Revisione, voci: VoceRev[]): Confronto {
  const ora = voci.map((v, i) => ({ v, key: chiaveDi(v, i) }))
  const perChiave = new Map(ora.map((x) => [x.key, x]))
  const perCodice = new Map<string, { v: VoceRev; key: string }[]>()
  for (const x of ora) {
    const c = (x.v.codice || '').trim()
    if (c) perCodice.set(c, [...(perCodice.get(c) || []), x])
  }
  const usate = new Set<string>()
  const righe: RigaConfronto[] = []
  for (const a of rev.voci) {
    let m = perChiave.get(a.key)
    if (m && usate.has(m.key)) m = undefined
    if (!m && a.codice) m = (perCodice.get(a.codice) || []).find((x) => !usate.has(x.key))
    if (m) usate.add(m.key)
    const importoDopo = m ? importoVoce(m.v) : 0
    const differenza = r2(importoDopo - a.importo)
    righe.push({
      key: a.key, codice: a.codice, descrizione: m ? (m.v.desc_short || m.v.declaratoria || a.descrizione) : a.descrizione, um: a.um || (m?.v.um || ''),
      qtyPrima: a.qty, qtyDopo: m ? qtyDi(m.v) : null,
      prezzoPrima: a.prezzo, prezzoDopo: m ? m.v.prezzo ?? 0 : null,
      importoPrima: a.importo, importoDopo, differenza,
      stato: !m ? 'soppressa' : differenza === 0 && qtyDi(m.v) === a.qty ? 'invariata' : 'variata',
    })
  }
  for (const x of ora) {
    if (usate.has(x.key)) continue
    const importoDopo = importoVoce(x.v)
    righe.push({
      key: x.key, codice: (x.v.codice || '').trim(), descrizione: (x.v.desc_short || x.v.declaratoria || '').trim(), um: x.v.um || '',
      qtyPrima: null, qtyDopo: qtyDi(x.v), prezzoPrima: null, prezzoDopo: x.v.prezzo ?? 0,
      importoPrima: 0, importoDopo, differenza: r2(importoDopo), stato: 'nuova',
    })
  }
  const totalePrima = r2(righe.reduce((s, r) => s + r.importoPrima, 0))
  const totaleDopo = r2(righe.reduce((s, r) => s + r.importoDopo, 0))
  return {
    righe, totalePrima, totaleDopo, differenza: r2(totaleDopo - totalePrima),
    variazionePct: totalePrima ? r2((totaleDopo - totalePrima) / totalePrima * 100) : null,
    nuove: righe.filter((r) => r.stato === 'nuova').length,
    soppresse: righe.filter((r) => r.stato === 'soppressa').length,
    variate: righe.filter((r) => r.stato === 'variata').length,
  }
}

// ── Documento: QUADRO COMPARATIVO fra una revisione e il computo corrente ─────
import { renderDocPage, escHtml as esc, fmtDateTime, type DocCompany } from '../../../shared/doc'

const numIt = (n: number): string => (n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const ETICHETTA: Record<StatoConfronto, string> = { invariata: '', variata: 'variata', nuova: 'nuova', soppressa: 'soppressa' }

/** HTML stampabile del confronto: una riga per voce, con quantità e importi a confronto. */
export function confrontoRevisioniHTML(
  rev: Revisione,
  c: Confronto,
  dg?: { oggetto?: string; committente?: string; cup?: string } | null,
  opt?: { company?: DocCompany | null; nomeCorrente?: string; now?: number | Date },
): string {
  const diff = (n: number): string => (n === 0 ? '—' : (n > 0 ? '+ ' : '− ') + '€ ' + numIt(Math.abs(n)))
  const q = (v: number | null): string => (v == null ? '' : numIt(v))
  const rows = c.righe.map((r) => `<tr${r.stato === 'invariata' ? ' class="nv"' : ''}>
      <td class="code">${esc(r.codice)}</td>
      <td>${esc(r.descrizione)}${ETICHETTA[r.stato] ? `<span class="sub">${ETICHETTA[r.stato]}</span>` : ''}</td>
      <td class="num">${esc(r.um)}</td>
      <td class="num">${q(r.qtyPrima)}</td>
      <td class="num">${q(r.qtyDopo)}</td>
      <td class="num">${r.prezzoDopo != null ? '€ ' + numIt(r.prezzoDopo) : r.prezzoPrima != null ? '€ ' + numIt(r.prezzoPrima) : ''}</td>
      <td class="num">€ ${numIt(r.importoPrima)}</td>
      <td class="num">€ ${numIt(r.importoDopo)}</td>
      <td class="num">${diff(r.differenza)}</td>
    </tr>`).join('')
  const corrente = opt?.nomeCorrente || 'computo corrente'
  const body = `
    <p class="note">Confronto fra la revisione <b>${esc(rev.nome)}</b> (${esc(rev.fase)}${rev.data ? ', ' + esc(rev.data) : ''}) e il <b>${esc(corrente)}</b>. Importi al netto di IVA, ai prezzi di ciascuna versione.</p>
    ${rev.note ? `<p class="prose"><b>Note della revisione:</b> ${esc(rev.note)}</p>` : ''}
    <table class="dtable">
      <thead><tr><th>Codice</th><th>Descrizione</th><th class="num">U.M.</th><th class="num">Q.tà ${esc(rev.nome)}</th><th class="num">Q.tà ${esc(corrente)}</th><th class="num">Prezzo</th><th class="num">Importo ${esc(rev.nome)}</th><th class="num">Importo ${esc(corrente)}</th><th class="num">Differenza</th></tr></thead>
      <tbody>${rows}
        <tr class="tot"><td colspan="6">TOTALE</td><td class="num">€ ${numIt(c.totalePrima)}</td><td class="num">€ ${numIt(c.totaleDopo)}</td><td class="num">${diff(c.differenza)}</td></tr>
      </tbody>
    </table>
    <table class="dtable" style="margin-top:4mm"><tbody>
      <tr><td>Voci variate</td><td class="num">${c.variate}</td></tr>
      <tr><td>Voci nuove</td><td class="num">${c.nuove}</td></tr>
      <tr><td>Voci soppresse</td><td class="num">${c.soppresse}</td></tr>
      <tr class="tot"><td>Variazione complessiva</td><td class="num">${diff(c.differenza)}${c.variazionePct != null ? ` (${numIt(c.variazionePct)} %)` : ''}</td></tr>
    </tbody></table>`
  return renderDocPage({
    tool: 'computo',
    company: opt?.company || undefined,
    kicker: dg?.oggetto ? `Computo · ${esc(dg.oggetto)}` : 'Computo · Revisioni',
    title: 'Quadro comparativo delle revisioni',
    sub: `${rev.nome} → ${corrente}`,
    docTitle: `Quadro comparativo — ${rev.nome}`,
    headMeta: [
      { k: 'Data', v: esc(fmtDateTime(opt?.now)) },
      ...(dg?.committente ? [{ k: 'Committente', v: esc(dg.committente) }] : []),
      ...(dg?.cup ? [{ k: 'CUP', v: esc(dg.cup) }] : []),
    ],
    bodyHTML: body,
    footer: {
      fields: [{ k: 'Revisione', v: esc(rev.nome) }, { k: 'Fase', v: esc(rev.fase) }, { k: 'Voci', v: String(c.righe.length) }],
      disc: 'Confronto fra versioni del computo metrico: elaborato di raffronto, non sostituisce il quadro comparativo di perizia (art. 120 D.Lgs. 36/2023).',
      page: 'Pag. 1',
    },
  })
}

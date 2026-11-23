/**
 * «PORTA IL TUO PREZZARIO»: un file di prezzario, scelto dall'utente, diventa
 * le righe che l'archivio conserva (archivio.ts) e che «Lavoro» cerca.
 *
 * Gli stessi lettori della pipeline dei prezzari (scripts/build-prezzari.ts):
 *  - XML: le famiglie riconosciute dalle prime righe (parsers/famiglie.ts:
 *    EASY, Lombardia, Documento, Basilicata, Veneto, RFI);
 *  - XPWE (elenco prezzi degli altri programmi del settore);
 *  - Excel: il prezzario del Friuli Venezia Giulia col suo lettore; un listino
 *    qualsiasi col lettore generico, che riconosce le colonne dalle
 *    intestazioni (codice, descrizione, u.m., prezzo…); se le intestazioni non
 *    ci sono, il tracciato dei listini editoriali;
 *  - CSV a punto e virgola: il Prezzario Unico del Cratere Centro Italia.
 *
 * Un file che nessun lettore riconosce non diventa un prezzario vuoto: si dice.
 */
import type { PriceRow } from '../../tools/computo/engine/types'
import { FAMIGLIE_XML } from '../../tools/computo/engine/parsers/famiglie'
import { isVenetoAnalisi } from '../../tools/computo/engine/parsers/veneto-analisi'
import { isFvg, parseFvg } from '../../tools/computo/engine/parsers/fvg'
import { parseDei } from '../../tools/computo/engine/parsers/dei'
import { parseCratere } from '../../tools/computo/engine/parsers/cratere'
import { edizioneDaNome, righeDaElencoXpwe } from '../../tools/computo/engine/parsers/xpwe-elenco'
import { parseXpwe } from '../xpwe/xpwe'

export interface PrezzarioLetto {
  rows: PriceRow[]
  regione: string
  anno: string
  /** Il lettore che l'ha riconosciuto: «veneto», «fvg», «generico», «xpwe»… */
  formato: string
  tipo: 'pubblico' | 'privato'
}

/** Le sigle regionali in testa ai codici (VEN25-…, LOM…): dicono la regione. */
const REGIONI: Record<string, string> = {
  LOM: 'Lombardia', VEN: 'Veneto', TOS: 'Toscana', LAZ: 'Lazio', PIE: 'Piemonte', LIG: 'Liguria', EMR: 'Emilia-Romagna', MAR: 'Marche',
  UMB: 'Umbria', ABR: 'Abruzzo', MOL: 'Molise', CAM: 'Campania', PUG: 'Puglia', BAS: 'Basilicata', CAL: 'Calabria', SIC: 'Sicilia',
  SAR: 'Sardegna', FRI: 'Friuli V.G.', TN: 'Trento', BZ: 'Bolzano', VDA: "Valle d'Aosta",
}

const annoDalNome = (nome: string): string => /20\d{2}/.exec(nome)?.[0] || ''
/** Senza regione, il prezzario si chiama come il file: «Listino-Rossi-2026.xlsx» → «Listino Rossi». */
export const nomeDalFile = (nome: string): string =>
  nome.replace(/\.[^.]+$/, '').replace(/20\d{2}/g, '').replace(/[-_.]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Prezzario'

/* ── Il lettore generico di un foglio (dal vecchio Computo) ──────────────── */

const normH = (s: unknown): string => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')

/** Alias di ogni campo, in ordine di priorità. */
const ALIAS: Record<string, string[]> = {
  cod: ['codice', 'cod', 'codicevoce', 'codicearticolo', 'tariffa', 'articolo'],
  decl: ['declaratoria', 'descrizioneestesa', 'descrizionelunga', 'descrizionecompleta', 'descestesa'],
  descbreve: ['descrizionebreve', 'descrizionesintetica', 'descbreve', 'descrizione', 'denominazione', 'oggetto'],
  um: ['um', 'desum', 'descum', 'unitadimisura', 'unitamisura', 'umisura', 'udm'],
  prez: ['prezzo', 'prezzounitario', 'prezzo1', 'importo', 'prezzoeuro'],
  netto: ['importosenzasgeui', 'importonetto', 'prezzonetto', 'importosenzasg'],
  ru: ['rapportoru', 'man', 'manodopera', 'costomanodopera', 'incidenzamanodopera', 'perman'],
  l1: ['descrliv1', 'descrizioneliv1', 'livello1', 'categoria'],
  l2: ['descrliv2', 'descrizioneliv2', 'livello2', 'sottocategoria'],
  l3: ['descrliv3', 'descrizioneliv3', 'livello3'],
  l4: ['descrliv4', 'descrizioneliv4', 'livello4'],
  materia: ['materia', 'materiale'],
  disc: ['disciplina'],
  sis: ['sistema'],
  att: ['attivita'],
  set: ['settoremerceologico', 'settore', 'capitolo'],
  kw: ['keywords', 'parolechiave', 'keyword'],
  tip: ['tipologia'],
}

/** Un numero da una cella: «12.5» (numero del foglio) o all'italiana «1.234,56». */
export function numero(s: string): number {
  const t = s.replace(/\s|€/g, '')
  if (/^-?\d+(\.\d+)?$/.test(t)) return parseFloat(t) || 0
  return parseFloat(t.replace(/\./g, '').replace(',', '.')) || 0
}

/** Spezza un codice nei suoi livelli: «VEN25-10.05.03.a» → VEN25-10, VEN25-10.05, … */
function livelliCodice(cod: string): string[] {
  const c = cod.replace(/\.-$/, '')
  const parti = c.split(/[-.]/).filter(Boolean)
  const out: string[] = []
  let acc = ''
  parti.forEach((p, k) => {
    if (k === 0) acc = p
    else { const sep = c.charAt(acc.length); acc = acc + (sep === '-' || sep === '.' ? sep : '.') + p }
    out.push(acc)
  })
  return out
}

/**
 * Un foglio qualunque: si cerca la riga d'intestazione (quella con più nomi di
 * colonna riconosciuti), poi una voce per ogni riga con codice e prezzo. Le
 * righe-capitolo (codice senza prezzo) danno le categorie; una voce con la
 * descrizione corta eredita quella del padre. Senza codice o prezzo
 * riconoscibili restituisce null: non è un listino che questo lettore sa leggere.
 */
export function righeDaGrigliaGenerica(raw: unknown[][], o: { regione?: string; anno?: string } = {}): { rows: PriceRow[]; regione: string | null; anno: string | null } | null {
  if (raw.length < 2) return null
  let hi = 0, migliore = 0
  for (let i = 0; i < Math.min(10, raw.length); i++) {
    const celle = (raw[i] || []).map(normH)
    let punti = 0
    for (const k in ALIAS) if (celle.some((c) => ALIAS[k].includes(c))) punti++
    if (punti > migliore) { migliore = punti; hi = i }
  }
  const hdr = (raw[hi] || []).map(normH)
  const C: Record<string, number> = {}
  for (const k in ALIAS) C[k] = ALIAS[k].map((a) => hdr.indexOf(a)).find((x) => x >= 0) ?? -1
  if (C.cod < 0 || C.prez < 0) return null
  const get = (r: unknown[], k: string): string => (C[k] >= 0 ? String(r[C[k]] ?? '').trim() : '')

  // le descrizioni dei padri e l'albero dei capitoli
  const descPadre: Record<string, string> = {}
  const capitoli: Record<string, string> = {}
  let ultimo = ''
  for (let i = hi + 1; i < raw.length; i++) {
    const r = raw[i] || []
    const cod = get(r, 'cod')
    if (cod) { ultimo = cod; continue }
    const testo = r.map((v) => String(v ?? '').trim()).filter(Boolean).join(' ').trim()
    if (testo && ultimo && !descPadre[ultimo]) descPadre[ultimo] = testo
  }
  for (let i = hi + 1; i < raw.length; i++) {
    const r = raw[i] || []
    const cod = get(r, 'cod'); if (!cod) continue
    const est = get(r, 'decl'), breve = get(r, 'descbreve')
    if (est.length > 60 && (!descPadre[cod] || est.length > descPadre[cod].length)) descPadre[cod] = est
    if (!numero(get(r, 'prez'))) { const d = (est || breve).trim(); if (d) capitoli[cod] = d }
  }
  const categorieEsplicite = C.disc >= 0 || C.sis >= 0 || C.set >= 0
  const padreDi = (cod: string): string => {
    let c = cod
    for (let k = 0; k < 6; k++) {
      const cut = c.replace(/[._\-\s][^._\-\s]*$/, '')
      if (cut === c || !cut) break
      c = cut
      if (descPadre[c]) return descPadre[c]
    }
    return ''
  }
  const categorieDi = (cod: string): { disc: string; sis: string; set: string } => {
    const liv = livelliCodice(cod)
    const d: string[] = []
    for (let k = 0; k < liv.length - 1; k++) if (capitoli[liv[k]]) d.push(capitoli[liv[k]])
    if (!d.length) return { disc: '', sis: '', set: '' }
    return { disc: d[0], sis: d.length >= 3 ? d[d.length - 2] : '', set: d.length > 1 ? d[d.length - 1] : '' }
  }

  const rows: PriceRow[] = []
  let regione: string | null = null, anno: string | null = null
  for (let i = hi + 1; i < raw.length; i++) {
    const r = raw[i] || []
    const cod = get(r, 'cod'); if (!cod) continue
    const p = numero(get(r, 'prez'))
    if (!p) continue
    if (!regione && cod.length >= 3) regione = REGIONI[cod.substring(0, 3).toUpperCase()] || null
    if (!anno) { const m = /20(\d{2})/.exec(cod); if (m) anno = '20' + m[1] }
    const lunga = get(r, 'decl'), breve = get(r, 'descbreve')
    const ereditata = !lunga || lunga.length < 60 ? padreDi(cod) : ''
    const base = lunga || breve
    const opera = /OPERA:\s*([^\n\r]+)/.exec(base)
    const prima = (lunga || '').split(/[\n\r]/)[0].trim()
    const ds = opera ? opera[1].trim().replace(/\s+/g, ' ') : breve ? breve.replace(/\s+/g, ' ') : prima.length > 220 ? prima.substring(0, 220) + '…' : prima
    // la voce figlia con la descrizione corta si legge con il contesto del padre
    let decl = lunga || ereditata || breve || ''
    const propria = (lunga || breve).trim()
    if (ereditata && ereditata.length >= 60 && propria && propria.length < 80 && !ereditata.toLowerCase().includes(propria.toLowerCase())) decl = `${ereditata}\n\n— ${propria}`
    else if (ereditata && breve && !lunga && !ereditata.toLowerCase().includes(breve.toLowerCase())) decl = `${ereditata}\n\n— ${breve}`
    let disc = get(r, 'disc'), sis = get(r, 'sis'), set = get(r, 'set')
    if (!categorieEsplicite) { const c = categorieDi(cod); disc = disc || c.disc; sis = sis || c.sis; set = set || c.set }
    rows.push({
      codice: cod, declaratoria: decl, desc_short: ds || cod, um: get(r, 'um').replace(/^[0-9\s]+/, '').trim(),
      prezzo: p, importo_netto: numero(get(r, 'netto')), ru: numero(get(r, 'ru')),
      liv1: get(r, 'l1'), liv2: get(r, 'l2'), liv3: get(r, 'l3'), liv4: get(r, 'l4'),
      materia: get(r, 'materia'), disciplina: disc, sistema: sis, attivita: get(r, 'att'), settore: set,
      keywords: get(r, 'kw'), tipologia: get(r, 'tip'),
      regione: o.regione || '', anno: o.anno || '',
    })
  }
  return { rows, regione, anno }
}

/* ── Il riconoscimento ──────────────────────────────────────────────────── */

/** Un file di testo (XML o XPWE) già letto. */
export function leggiPrezzarioTesto(nome: string, testo: string): PrezzarioLetto {
  const annoNome = annoDalNome(nome)
  const testa = testo.slice(0, 4096)
  if (/\.xpwe$/i.test(nome) || (testa.includes('<PweDocumento') && !testa.includes('PriMus.Document.XPWE'))) {
    const doc = parseXpwe(testo)
    const ed = edizioneDaNome(doc.fileNameDocumento || nome)
    const regione = ed.regione || nomeDalFile(doc.fileNameDocumento || nome), anno = ed.anno || annoNome
    const rows = righeDaElencoXpwe(doc, { regione, anno })
    if (!rows.length) throw new Error(`${nome}: nessuna voce di elenco prezzi nel file XPWE`)
    return { rows, regione, anno, formato: 'xpwe', tipo: 'privato' }
  }
  if (isVenetoAnalisi(testa)) throw new Error(`${nome} è un file di analisi prezzi, non un prezzario: arricchisce le voci del prezzario della stessa regione e anno`)
  const fam = FAMIGLIE_XML.find((f) => f.detect(testa))
  if (!fam) throw new Error(`${nome}: formato XML non riconosciuto (formati noti: EASY, Lombardia, Documento, Basilicata, Veneto, RFI, XPWE)`)
  const r = fam.parse(testo, { ...(annoNome ? { anno: annoNome } : {}) })
  if (!r.rows.length) throw new Error(`${nome}: nessuna voce riconosciuta`)
  const regione = r.regione || nomeDalFile(nome), anno = r.anno || annoNome
  return { rows: r.rows.map((x) => ({ ...x, regione: x.regione || regione, anno: x.anno || anno })), regione, anno, formato: fam.name, tipo: fam.categoria || 'pubblico' }
}

/** Un foglio (Excel o CSV) già letto in righe di celle. */
export function leggiPrezzarioGriglia(nome: string, griglia: unknown[][], o: { csv?: boolean } = {}): PrezzarioLetto {
  const annoNome = annoDalNome(nome)
  if (o.csv) {
    const r = parseCratere(griglia, { regione: 'Cratere Centro Italia', anno: annoNome || undefined })
    if (!r.rows.length) throw new Error(`${nome}: CSV non riconosciuto (atteso il Prezzario Unico del Cratere, separato da punto e virgola)`)
    return { rows: r.rows, regione: r.regione || 'Cratere Centro Italia', anno: r.anno || annoNome, formato: 'cratere', tipo: 'pubblico' }
  }
  if (isFvg(griglia)) {
    const r = parseFvg(griglia, { regione: 'Friuli V.G.', anno: annoNome || undefined })
    const anno = String(r.anno || annoNome).split('/')[0]
    return { rows: r.rows.map((x) => ({ ...x, regione: 'Friuli V.G.', anno })), regione: 'Friuli V.G.', anno, formato: 'fvg', tipo: 'pubblico' }
  }
  const g = righeDaGrigliaGenerica(griglia)
  if (g && g.rows.length) {
    const regione = g.regione || nomeDalFile(nome), anno = g.anno || annoNome
    return { rows: g.rows.map((x) => ({ ...x, regione, anno })), regione, anno, formato: 'generico', tipo: g.regione ? 'pubblico' : 'privato' }
  }
  const d = parseDei(griglia, { anno: annoNome || undefined })
  if (d.rows.length) {
    const regione = d.regione || 'Listino editoriale', anno = d.anno || annoNome
    return { rows: d.rows.map((x) => ({ ...x, regione, anno })), regione, anno, formato: 'editoriale', tipo: 'privato' }
  }
  throw new Error(`${nome}: nel foglio non trovo le colonne di un prezzario (codice, descrizione, unità di misura, prezzo)`)
}

/** Il lettore del foglio di calcolo (la libreria XLSX, caricata a richiesta). */
export interface LibXlsx {
  read: (d: unknown, o: Record<string, unknown>) => { SheetNames: string[]; Sheets: Record<string, unknown> }
  utils: { sheet_to_json: (ws: unknown, o: Record<string, unknown>) => unknown[][] }
}

/** Un file scelto dall'utente: si legge secondo il tipo. */
export async function leggiPrezzarioFile(file: File, xlsx: () => Promise<LibXlsx>): Promise<PrezzarioLetto> {
  const n = file.name.toLowerCase()
  if (n.endsWith('.xml') || n.endsWith('.xpwe')) return leggiPrezzarioTesto(file.name, await file.text())
  if (n.endsWith('.csv')) {
    const X = await xlsx()
    const wb = X.read(await file.text(), { type: 'string', FS: ';' })
    return leggiPrezzarioGriglia(file.name, X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' }), { csv: true })
  }
  if (n.endsWith('.xlsx') || n.endsWith('.xls')) {
    const X = await xlsx()
    const wb = X.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' })
    return leggiPrezzarioGriglia(file.name, X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' }))
  }
  throw new Error(`${file.name}: tipo di file non supportato (XML, XPWE, Excel, CSV)`)
}

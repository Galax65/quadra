/**
 * XPWE — formato di interscambio XML del computo metrico.
 *
 * Modulo PURO (nessun DOM), usato da Computo (import/export del computo) e da Contabilità
 * (import del computo come base contabile). Scritto da zero sulla struttura
 * pubblica del formato (radice `PweDocumento`, `PweDatiGenerali`,
 * `PweMisurazioni > PweElencoPrezzi / PweVociComputo`), lo stesso già letto da
 * `miu/engine/parsers/rfi.ts` per il solo elenco prezzi.
 *
 * Struttura essenziale:
 *  - `PweDGCapitoliCategorie`: tabelle ID → descrizione di Super/Categorie/Sub
 *    (organizzano il COMPUTO) e Super/Capitoli/Sub (organizzano l'ELENCO PREZZI);
 *  - `EPItem` (ID): Tariffa, DesRidotta/DesEstesa/DesBreve, UnMisura, Prezzo1,
 *    IncMDO, IncSIC, IDSpCap/IDCap/IDSbCap;
 *  - `VCItem` (ID): IDEP (→ EPItem), Quantita, IDSpCat/IDCat/IDSbCat e le righe
 *    `PweVCMisure > RGItem`: Descrizione, PartiUguali, Lunghezza, Larghezza,
 *    HPeso (numeri o FORMULE, es. "2*3,5+1"), Quantita, IDVV (vedi voce, -2 =
 *    nessuno), Flags (bit: 1 = riga NEGATIVA / in detrazione, 2 = riga di parziale,
 *    non somma; 32768 = vedi voce).
 */
import { makeParser, toArray, num } from '../xml-utils'
import type { MisurazioneRiga } from '../compositore/misurazioni'

type XmlNode = Record<string, unknown>

export interface XpweDatiGenerali {
  oggetto: string
  committente: string
  comune: string
  provincia: string
  impresa: string
  parteOpera: string
}

/** Qualità di una voce che il tracciato di interscambio non sa rappresentare. */
export interface EstensioneVoce {
  corpo?: boolean
  np?: boolean
  codiceOrig?: string
  analisiPrezzi?: boolean
  prezzoOfferto?: number
}

export interface XpweEp {
  id: string
  tariffa: string
  desRidotta: string
  desEstesa: string
  desBreve: string
  um: string
  prezzo: number
  /** Incidenza manodopera (%). */
  incMdo: number
  /** Incidenza sicurezza (%). */
  incSic: number
  /** Voce della sicurezza (Flags = 134217728 nell'XPWE). */
  sicurezza: boolean
  capitolo: string[]
}

export interface XpweRiga {
  descrizione: string
  partiUguali: number | null
  lunghezza: number | null
  larghezza: number | null
  hPeso: number | null
  quantita: number
  /** Formule originali dei fattori, quando non sono numeri semplici. */
  formule?: Partial<Record<'partiUguali' | 'lunghezza' | 'larghezza' | 'hPeso', string>>
}

export interface XpweVoce {
  id: string
  ep: XpweEp
  /** Super · Categoria · Sub del computo (vuoti assenti). */
  categoria: string[]
  /** Codice WBS della voce (CodiceWBS), '' se assente. */
  wbs: string
  righe: XpweRiga[]
  quantita: number
  /** Data della misura (DataMis, gg/mm/aaaa): nelle contabilità decide il SAL. */
  dataMis: string
}

export interface XpweDoc {
  /** TipoDocumento XPWE: 0 = elenco prezzi, 1 = computo, 2 = contabilità (misure datate). */
  tipoDocumento: number
  /** Nome del file d'origine (es. «2024-1 DEI_….dcf»), se presente. */
  fileNameDocumento?: string
  datiGenerali: XpweDatiGenerali
  /** Estensione Quadra (elemento fuori tracciato): qualità che l'XPWE non prevede. */
  estensioni?: Map<string, EstensioneVoce>
  elencoPrezzi: XpweEp[]
  voci: XpweVoce[]
  /** Avvisi non bloccanti (voci con IDEP inesistente, formule non valutabili…). */
  avvisi: string[]
  /** Ordine dei nomi delle categorie nel file, per livello [Super, Categoria, Sub]. */
  ordineCategorie?: string[][]
}

// arrotondamento commerciale (metà per eccesso, lontano dallo zero) robusto agli errori binari: 127,3 × 2,05 = 260,965 → 260,97
const round = (n: number, d = 2): number => { const k = 10 ** d; return Math.sign(n) * Math.round(Number((Math.abs(n) * k).toPrecision(15))) / k }
const text = (node: XmlNode | undefined, tag: string): string => {
  const v = node?.[tag]
  if (v == null || typeof v === 'object') return ''
  return String(v).trim()
}
const attr = (node: XmlNode, name: string): string => { const v = node['@_' + name]; return v == null ? '' : String(v) }

/**
 * Valuta una formula di misura XPWE: numeri con virgola o punto decimale,
 * + - * / e parentesi. Ritorna null se vuota, NaN se non valutabile.
 * Nessun `eval`: parser ricorsivo minimale.
 */
export function valutaFormula(src: string | number | null | undefined, puntoDecimale = false): number | null {
  if (src == null) return null
  if (typeof src === 'number') return Number.isFinite(src) ? src : NaN
  let s = String(src).trim()
  if (!s) return null
  s = s.replace(/^=/, '').replace(/\s+/g, '').replace(/x/gi, '*').replace(/:/g, '/')
  // Scritto a mano (italiano): "1.234,5" → "1234.5"; "3,5" → "3.5".
  // Nei file XPWE il punto è SEMPRE il separatore decimale ("0.200", "1.000+0.5"):
  // lì non va letto come separatore delle migliaia.
  if (!puntoDecimale) s = s.replace(/(\d)\.(?=\d{3}(\D|$))/g, '$1')
  s = s.replace(/,/g, '.')
  let i = 0
  const peek = (): string => s[i] ?? ''
  const expr = (): number => {
    let v = term()
    while (peek() === '+' || peek() === '-') { const op = s[i++]; const t = term(); v = op === '+' ? v + t : v - t }
    return v
  }
  const term = (): number => {
    let v = factor()
    while (peek() === '*' || peek() === '/') { const op = s[i++]; const f = factor(); v = op === '*' ? v * f : v / f }
    return v
  }
  const factor = (): number => {
    if (peek() === '-') { i++; return -factor() }
    if (peek() === '+') { i++; return factor() }
    if (peek() === '(') { i++; const v = expr(); if (peek() !== ')') throw new Error('parentesi'); i++; return v }
    const m = /^\d+(\.\d+)?|^\.\d+/.exec(s.slice(i))
    if (!m) throw new Error('numero')
    i += m[0].length
    return parseFloat(m[0])
  }
  try {
    const v = expr()
    return i === s.length && Number.isFinite(v) ? v : NaN
  } catch {
    return NaN
  }
}

/** Tabella `PweDG{tag}` → mappa ID → DesSintetica. */
function tabella(dgCapCat: XmlNode | undefined, tag: string): Map<string, string> {
  const out = new Map<string, string>()
  const wrapper = dgCapCat?.['PweDG' + tag] as XmlNode | undefined
  for (const item of toArray(wrapper?.['DG' + tag + 'Item'] as XmlNode | XmlNode[] | undefined)) {
    const id = attr(item, 'ID')
    const nome = text(item, 'DesSintetica')
    if (id && nome) out.set(id, nome)
  }
  return out
}

/** Legge un file XPWE (testo XML) in un modello neutro. Lancia se non è un XPWE. */
export function parseXpwe(xml: string): XpweDoc {
  const doc = makeParser({ parseTagValue: false }).parse(xml.replace(/^﻿/, '')) as XmlNode
  const pwe = doc['PweDocumento'] as XmlNode | undefined
  if (!pwe) throw new Error('Il file non è un documento XPWE (manca PweDocumento)')
  const avvisi: string[] = []

  const dg = pwe['PweDatiGenerali'] as XmlNode | undefined
  const prog = (dg?.['PweDGProgetto'] as XmlNode | undefined)?.['PweDGDatiGenerali'] as XmlNode | undefined
  const datiGenerali: XpweDatiGenerali = {
    oggetto: text(prog, 'Oggetto'), committente: text(prog, 'Committente'),
    comune: text(prog, 'Comune'), provincia: text(prog, 'Provincia'),
    impresa: text(prog, 'Impresa'), parteOpera: text(prog, 'ParteOpera'),
  }
  const cc = dg?.['PweDGCapitoliCategorie'] as XmlNode | undefined
  const spCap = tabella(cc, 'SuperCapitoli'), cap = tabella(cc, 'Capitoli'), sbCap = tabella(cc, 'SubCapitoli')
  const spCat = tabella(cc, 'SuperCategorie'), cat = tabella(cc, 'Categorie'), sbCat = tabella(cc, 'SubCategorie')

  // Estensione Quadra: la leggiamo se c'è, e se non c'è non manca nulla di
  // obbligatorio — il file resta un XPWE valido.
  const estensioni = new Map<string, EstensioneVoce>()
  const qv = (pwe['PweQuadra'] as XmlNode | undefined)?.['QVoce']
  for (const n of (Array.isArray(qv) ? qv : qv ? [qv] : []) as XmlNode[]) {
    const tariffa = String(n['@_Tariffa'] ?? '')
    if (!tariffa) continue
    const prezzo = Number(String(n['@_Prezzo'] ?? '').replace(',', '.'))
    estensioni.set(`${tariffa}\u0000${Number.isFinite(prezzo) ? round(prezzo, 2) : 0}`, {
      corpo: n['@_Corpo'] === '1' || undefined,
      np: n['@_NuovoPrezzo'] === '1' || undefined,
      codiceOrig: n['@_Derivata'] ? String(n['@_Derivata']) : undefined,
      analisiPrezzi: n['@_Analisi'] === '1' || undefined,
      prezzoOfferto: n['@_PrezzoOfferto'] != null ? Number(String(n['@_PrezzoOfferto']).replace(',', '.')) : undefined,
    })
  }

  const mis = pwe['PweMisurazioni'] as XmlNode | undefined
  const epById = new Map<string, XpweEp>()
  const elencoPrezzi: XpweEp[] = []
  for (const el of toArray((mis?.['PweElencoPrezzi'] as XmlNode | undefined)?.['EPItem'] as XmlNode | XmlNode[] | undefined)) {
    const ep: XpweEp = {
      id: attr(el, 'ID'),
      tariffa: text(el, 'Tariffa'),
      desRidotta: text(el, 'DesRidotta'),
      desEstesa: text(el, 'DesEstesa'),
      desBreve: text(el, 'DesBreve'),
      um: text(el, 'UnMisura'),
      prezzo: num(text(el, 'Prezzo1')),
      incMdo: num(text(el, 'IncMDO')),
      incSic: num(text(el, 'IncSIC')),
      sicurezza: text(el, 'Flags') === '134217728',
      capitolo: [spCap.get(text(el, 'IDSpCap')), cap.get(text(el, 'IDCap')), sbCap.get(text(el, 'IDSbCap'))].filter((x): x is string => !!x),
    }
    epById.set(ep.id, ep)
    elencoPrezzi.push(ep)
  }

  // prima passata: righe e quantità; la seconda risolve i «vedi voce» (IDVV)
  interface Grezza { id: string; ep: XpweEp; categoria: string[]; wbs: string; rg: XmlNode[]; quantitaFile: number; dataMis: string }
  const grezze: Grezza[] = []
  for (const vc of toArray((mis?.['PweVociComputo'] as XmlNode | undefined)?.['VCItem'] as XmlNode | XmlNode[] | undefined)) {
    const id = attr(vc, 'ID')
    const ep = epById.get(text(vc, 'IDEP'))
    if (!ep) { avvisi.push(`Voce di computo ${id}: articolo IDEP ${text(vc, 'IDEP')} non trovato nell'elenco prezzi, scartata`); continue }
    grezze.push({
      id, ep,
      categoria: [spCat.get(text(vc, 'IDSpCat')), cat.get(text(vc, 'IDCat')), sbCat.get(text(vc, 'IDSbCat'))].filter((x): x is string => !!x),
      wbs: text(vc, 'CodiceWBS'),
      rg: toArray((vc['PweVCMisure'] as XmlNode | undefined)?.['RGItem'] as XmlNode | XmlNode[] | undefined),
      quantitaFile: num(text(vc, 'Quantita')),
      dataMis: text(vc, 'DataMis'),
    })
  }

  const totali = new Map<string, number>()
  const voci: XpweVoce[] = []
  const risolvi = (g: Grezza, profondita = 0): XpweVoce => {
    const righe: XpweRiga[] = []
    for (const rg of g.rg) {
      const flags = Number(text(rg, 'Flags')) || 0
      if (flags & 2) continue // parziale: solo stampa, non somma
      // riga in DETRAZIONE (bit 1): la quantità è negativa anche se i fattori sono positivi
      const negativa = (flags & 1) === 1 || num(text(rg, 'Quantita')) < 0
      const fattore = (tag: string): number | null => {
        const v = valutaFormula(text(rg, tag), true)
        if (v != null && Number.isNaN(v)) { avvisi.push(`Voce ${g.ep.tariffa}: formula non valutabile in ${tag} («${text(rg, tag)}»)`); return null }
        return v
      }
      const pu = fattore('PartiUguali'), lu = fattore('Lunghezza'), la = fattore('Larghezza'), hp = fattore('HPeso')
      const fattori = [pu, lu, la, hp].filter((f): f is number => f != null)
      let q: number
      const idvv = text(rg, 'IDVV')
      const rif = idvv && idvv !== '-2' ? grezze.find(x => x.id === idvv) : undefined
      if (rif && profondita < 10) {
        const base = totali.get(rif.id) ?? risolvi(rif, profondita + 1).quantita
        q = fattori.reduce((p, f) => p * f, base)
      } else if (fattori.length) {
        q = fattori.reduce((p, f) => p * f, 1)
      } else {
        q = num(text(rg, 'Quantita'))
      }
      if (negativa) q = -Math.abs(q)
      const desc = text(rg, 'Descrizione') + (rif ? ` (vedi voce ${rif.ep.tariffa})` : '')
      if (!fattori.length && !q && !desc) continue
      if (rif) {
        // vedi voce: la quantità richiamata diventa un fattore esplicito, così il
        // prodotto dei fattori (come lo ricalcola Computo) resta uguale alla quantità
        const altri = fattori.length ? Math.abs(fattori.reduce((p, f) => p * f, 1)) : null
        const base = round(Math.abs(q) / (altri || 1), 4)
        // in detrazione il segno va sulle parti uguali, così il prodotto resta negativo
        const pu = negativa ? -(altri ?? 1) : altri
        righe.push({ descrizione: desc, partiUguali: pu, lunghezza: base, larghezza: null, hPeso: null, quantita: round(q) })
        continue
      }
      const formule: XpweRiga['formule'] = {}
      for (const [tg, k] of [['PartiUguali', 'partiUguali'], ['Lunghezza', 'lunghezza'], ['Larghezza', 'larghezza'], ['HPeso', 'hPeso']] as const) {
        const t = text(rg, tg).trim()
        if (t && !/^-?\d+(\.\d+)?$/.test(t)) formule[k] = t
      }
      // detrazione con fattori tutti positivi: il segno va sulle parti uguali (−1 se mancano)
      const puSegno = negativa && fattori.length && fattori.every((f) => f >= 0) ? -(pu ?? 1) : pu
      righe.push({ descrizione: desc, partiUguali: puSegno, lunghezza: lu, larghezza: la, hPeso: hp, quantita: round(q), ...(Object.keys(formule).length ? { formule } : {}) })
    }
    const quantita = righe.length ? round(righe.reduce((s, r) => s + r.quantita, 0)) : round(g.quantitaFile)
    totali.set(g.id, quantita)
    return { id: g.id, ep: g.ep, categoria: g.categoria, wbs: g.wbs, righe, quantita, dataMis: g.dataMis }
  }
  for (const g of grezze) voci.push(risolvi(g))

  const tipo = Number(text(pwe!, 'TipoDocumento'))
  const fileNameDocumento = text(pwe!, 'FileNameDocumento') || undefined
  // ordine delle tabelle del file (per ID): è la gerarchia definita nel documento d'origine
  const ordinate = (m: Map<string, string>): string[] => [...m.entries()].sort((a, b) => Number(a[0]) - Number(b[0])).map(([, n]) => n).filter((n, i, a) => a.indexOf(n) === i)
  const ordineCategorie = [ordinate(spCat), ordinate(cat), ordinate(sbCat)]
  return { tipoDocumento: Number.isFinite(tipo) && text(pwe!, 'TipoDocumento') !== '' ? tipo : 1, fileNameDocumento, datiGenerali, elencoPrezzi, voci, avvisi, ordineCategorie, ...(estensioni.size ? { estensioni } : {}) }
}

/** Voce di computo nel formato condiviso di Computo/Contabilità (sottoinsieme di CartItem/VoceImport). */
export interface VoceComputo {
  codice: string
  desc_short?: string
  declaratoria?: string
  um?: string
  prezzo?: number
  qty?: number | null
  categoria?: string
  /** Codice WBS (gerarchico a punti, es. "01.02.03"). */
  wbs?: string
  misurazioni?: MisurazioneRiga[]
  /** Voce degli oneri della sicurezza (non soggetta a ribasso). */
  sicurezza?: boolean
  /** Incidenza della manodopera sul prezzo (%), dal prezzario o dall'analisi. */
  incMdo?: number
  /** Data della misura (contabilità da XPWE). */
  dataMis?: string
  /** Nuovo prezzo (NP) e codice di prezzario da cui deriva. */
  np?: boolean
  codiceOrig?: string
  /** Prezzo determinato con analisi. */
  analisiPrezzi?: boolean
  /** Lavoro A CORPO (D.Lgs. 36/2023): prezzo complessivo fisso, contabilizzato a quote %. */
  corpo?: boolean
  /** Prezzo unitario OFFERTO dall'aggiudicatario (offerta a prezzi unitari). */
  prezzoOfferto?: number
}

/** Separatore dei livelli di categoria usato da Computo/Contabilità. */
export const CAT_SEP = ' · '

/** Voci di computo XPWE → voci condivise Computo/Contabilità (una per VCItem). */
export function xpweToVoci(doc: XpweDoc): VoceComputo[] {
  const est = doc.estensioni
  return doc.voci.map(v => ({
    ...(est?.get(`${v.ep.tariffa}\u0000${round(v.ep.prezzo ?? 0, 2)}`) ?? {}),
    codice: v.ep.tariffa,
    desc_short: v.ep.desRidotta || v.ep.desBreve || v.ep.desEstesa.slice(0, 120),
    declaratoria: v.ep.desEstesa || v.ep.desRidotta,
    um: v.ep.um,
    prezzo: v.ep.prezzo,
    qty: v.quantita,
    categoria: v.categoria.join(CAT_SEP) || undefined,
    wbs: v.wbs || undefined,
    sicurezza: v.ep.sicurezza || undefined,
    incMdo: v.ep.incMdo > 0 ? v.ep.incMdo : undefined,
    dataMis: v.dataMis || undefined,
    misurazioni: v.righe.map(r => ({
      descrizione: r.descrizione || undefined,
      n: r.partiUguali, l1: r.lunghezza, l2: r.larghezza, h: r.hPeso,
      quantita: r.quantita,
      ...(r.formule ? { formule: { n: r.formule.partiUguali, l1: r.formule.lunghezza, l2: r.formule.larghezza, h: r.formule.hPeso } } : {}),
    })),
  }))
}

// ── Scrittura ───────────────────────────────────────────────────────────────

const esc = (s: unknown): string => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const fmt = (n: number | null | undefined, d = 2): string => n == null || !Number.isFinite(n) ? '' : String(round(n, d))
const tag = (t: string, v: string): string => `<${t}>${v}</${t}>`

export interface BuildXpweOpts {
  datiGenerali?: Partial<XpweDatiGenerali>
  /**
   * Estensione Quadra: scrive, in un elemento che gli altri lettori ignorano,
   * quello che il tracciato di interscambio non sa dire — lavori a corpo, nuovi
   * prezzi con la voce di derivazione, prezzo offerto. Senza, quelle qualità si
   * perdono riaprendo il file. Metterla a false per un file di massima
   * compatibilità. */
  estensioni?: boolean
  /** Nome del programma generante (SourceNome). */
  sorgente?: string
  /** Data voci elenco prezzi (gg/mm/aaaa); default oggi. */
  data?: string
}

/**
 * Voci condivise Computo/Contabilità → testo XPWE in formato di interscambio.
 * Elenco prezzi: una voce per coppia codice+prezzo (la stessa tariffa a prezzi
 * diversi produce due articoli). Categorie del computo: ricavate da `categoria`
 * spezzata su `CAT_SEP` (fino a 3 livelli: Super, Categoria, Sub).
 */
export function buildXpwe(voci: VoceComputo[], opts: BuildXpweOpts = {}): string {
  const dg = opts.datiGenerali ?? {}
  const oggi = opts.data ?? new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const livelli: Map<string, number>[] = [new Map(), new Map(), new Map()]
  const idLivello = (k: number, nome: string): number => {
    const m = livelli[k]
    if (!m.has(nome)) m.set(nome, m.size + 1)
    return m.get(nome)!
  }
  const eps = new Map<string, { id: number; v: VoceComputo }>()
  const vcs: string[] = []
  let rgId = 0

  voci.forEach((v, i) => {
    const key = `${v.codice}\u0000${v.prezzo ?? 0}`
    if (!eps.has(key)) eps.set(key, { id: eps.size + 1, v })
    const idEp = eps.get(key)!.id
    const cat = (v.categoria ?? '').split(CAT_SEP).map(s => s.trim()).filter(Boolean).slice(0, 3)
    const ids = [0, 0, 0]
    cat.forEach((nome, k) => { ids[k] = idLivello(k, nome) })

    const righe = v.misurazioni?.length ? v.misurazioni : (v.qty != null ? [{ quantita: v.qty } as MisurazioneRiga] : [])
    const rg = righe.map((r) => {
      // riga in DETRAZIONE: fattori in valore assoluto e segno nel flag (bit 1), come d'uso nell'XPWE
      const neg = (r.quantita ?? 0) < 0
      const val = (x: number | null | undefined): string => fmt(x == null ? x : (neg ? Math.abs(x) : x), 3)
      return `<RGItem ID="${++rgId}">${tag('IDVV', '-2')}${tag('Descrizione', esc(r.descrizione ?? ''))}` +
        tag('PartiUguali', esc(r.formule?.n ?? val(r.n))) + tag('Lunghezza', esc(r.formule?.l1 ?? val(r.l1))) +
        tag('Larghezza', esc(r.formule?.l2 ?? val(r.l2))) + tag('HPeso', esc(r.formule?.h ?? val(r.h))) +
        tag('Quantita', fmt(r.quantita ?? 0)) + tag('Flags', neg ? '1' : '0') + '</RGItem>'
    }).join('')
    const qty = righe.reduce((s, r) => s + (r.quantita || 0), 0)
    vcs.push(`<VCItem ID="${i + 1}">${tag('IDEP', String(idEp))}${tag('Quantita', fmt(qty))}${tag('DataMis', esc(oggi))}${tag('Flags', '0')}` +
      `${tag('IDSpCat', String(ids[0]))}${tag('IDCat', String(ids[1]))}${tag('IDSbCat', String(ids[2]))}${tag('CodiceWBS', esc(v.wbs ?? ''))}` +
      `<PweVCMisure>${rg}</PweVCMisure></VCItem>`)
  })

  const tabellaXml = (sect: string, item: string, m: Map<string, number>): string =>
    `<${sect}>${[...m].map(([nome, id]) => `<${item} ID="${id}">${tag('DesSintetica', esc(nome))}${tag('DesEstesa', '')}${tag('Codice', '')}</${item}>`).join('')}</${sect}>`

  const epXml = [...eps.values()].map(({ id, v }) =>
    `<EPItem ID="${id}">${tag('TipoEP', '0')}${tag('Tariffa', esc(v.codice))}${tag('Articolo', '')}` +
    `${tag('DesRidotta', esc(v.desc_short ?? ''))}${tag('DesEstesa', esc(v.declaratoria ?? v.desc_short ?? ''))}${tag('DesBreve', esc((v.desc_short ?? '').slice(0, 250)))}` +
    `${tag('UnMisura', esc(v.um ?? ''))}${tag('Prezzo1', fmt(v.prezzo ?? 0))}${tag('Prezzo2', '0')}${tag('Prezzo3', '0')}${tag('Prezzo4', '0')}${tag('Prezzo5', '0')}` +
    `${v.incMdo ? tag('IncMDO', fmt(v.incMdo)) : ''}${tag('IDSpCap', '0')}${tag('IDCap', '0')}${tag('IDSbCap', '0')}${tag('Flags', v.sicurezza ? '134217728' : '0')}${tag('Data', esc(oggi))}${tag('AdrInternet', '')}<PweEPAnalisi/></EPItem>`,
  ).join('')

  // Estensione Quadra: elemento fuori dal tracciato, ignorato dagli altri
  // lettori, che conserva le qualità della voce che l'XPWE non prevede.
  const estese = (opts.estensioni ?? true)
    ? voci.filter((v) => v.corpo || v.np || v.analisiPrezzi || v.prezzoOfferto != null)
      .map((v) => `<QVoce Tariffa="${esc(v.codice)}" Prezzo="${fmt(v.prezzo ?? 0)}"` +
        (v.corpo ? ' Corpo="1"' : '') + (v.np ? ' NuovoPrezzo="1"' : '') +
        (v.codiceOrig ? ` Derivata="${esc(v.codiceOrig)}"` : '') +
        (v.analisiPrezzi ? ' Analisi="1"' : '') +
        (v.prezzoOfferto != null ? ` PrezzoOfferto="${fmt(v.prezzoOfferto)}"` : '') + '/>')
      .join('')
    : ''

  return '<?xml version="1.0" encoding="UTF-8"?>\n<?mso-application progid="PriMus.Document.XPWE"?>\n' +
    '<PweDocumento>' + tag('CopyRight', '') + tag('TipoDocumento', '1') + tag('TipoFormato', 'XMLPwe') + tag('Versione', '5.05') +
    tag('SourceVersione', '') + tag('SourceNome', esc(opts.sorgente ?? 'Quadra')) + tag('FileNameDocumento', '') +
    '<PweDatiGenerali><PweDGProgetto><PweDGDatiGenerali>' + tag('PercPrezzi', '0') +
    tag('Comune', esc(dg.comune ?? '')) + tag('Provincia', esc(dg.provincia ?? '')) + tag('Oggetto', esc(dg.oggetto ?? '')) +
    tag('Committente', esc(dg.committente ?? '')) + tag('Impresa', esc(dg.impresa ?? '')) + tag('ParteOpera', esc(dg.parteOpera ?? '')) +
    '</PweDGDatiGenerali></PweDGProgetto><PweDGCapitoliCategorie>' +
    '<PweDGSuperCapitoli/><PweDGCapitoli/><PweDGSubCapitoli/>' +
    tabellaXml('PweDGSuperCategorie', 'DGSuperCategorieItem', livelli[0]) +
    tabellaXml('PweDGCategorie', 'DGCategorieItem', livelli[1]) +
    tabellaXml('PweDGSubCategorie', 'DGSubCategorieItem', livelli[2]) +
    '</PweDGCapitoliCategorie></PweDatiGenerali>' +
    '<PweMisurazioni><PweElencoPrezzi>' + epXml + '</PweElencoPrezzi><PweVociComputo>' + vcs.join('') + '</PweVociComputo></PweMisurazioni>' +
    (estese ? '<PweQuadra Versione="1">' + estese + '</PweQuadra>' : '') +
    '</PweDocumento>\n'
}

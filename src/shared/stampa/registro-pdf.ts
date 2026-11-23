/**
 * Motore di stampa «da registro» in PDF (A4), condiviso da Computo e Contabilità.
 *
 * Disegna una tabella a colonne su più pagine con:
 *  - intestazione del documento (prima pagina) e intestazione corta sulle successive;
 *  - testata delle colonne ripetuta su ogni pagina, con gruppi (es. DIMENSIONI, IMPORTI);
 *  - testo che va a capo nella colonna descrittiva;
 *  - «A RIPORTARE» in fondo alla pagina e «RIPORTO» in cima alla successiva, con il
 *    progressivo degli importi (come gli elaborati di computo e contabilità);
 *  - gruppi di righe che non si separano (voce + sue misure + sommano, se ci stanno);
 *  - piè di pagina con «Pag. n di N».
 *
 * Modulo PURO: riceve il namespace di pdf-lib (`lib`) invece di importarlo, così nel
 * browser si usa la copia in `vendor/` caricata a runtime (offline, fuori dal bundle)
 * e nei test il pacchetto npm.
 *
 * CARATTERI E PDF/A-2b. Con fontkit a disposizione (nel browser lo carica
 * loadPdfLib) il testo è in Arimo INCORPORATO e il file esce PDF/A-2b
 * (pdfa.ts): si conserva e si vede uguale ovunque. Senza fontkit (i test che
 * leggono il testo grezzo) si ripiega su Helvetica standard, e il file non è
 * PDF/A: il risultato lo dice (`pdfa`). Il testo resta WinAnsi in entrambi i
 * casi: i caratteri fuori codifica si sostituiscono, mai un errore in stampa.
 *
 * FOGLIO. Formato, orientamento, margini e corpo vengono dalle impostazioni di
 * stampa (doc/stile-stampa.ts), le stesse degli atti HTML: chi le cambia, le
 * vede anche qui. Senza impostazioni resta il foglio storico del registro.
 */
import type { StileStampa } from '../doc/stile-stampa'
import { caratteriPdfA, rendiPdfA, salvaPdfA, trovaFontkit } from './pdfa'

/* Le impostazioni di stampa di chi stampa: ogni strumento dice dove leggerle
   (impostaStileStampaPdf), e ogni PDF le rispetta senza che i singoli atti
   debbano ricordarsi di passarle. Nei test, nessuno le imposta. */
let _stileCorrente: (() => StileStampa | undefined) | null = null
export function impostaStileStampaPdf(leggi: (() => StileStampa | undefined) | null): void { _stileCorrente = leggi }

const FORMATI_PT: Record<string, { w: number; h: number }> = {
  A4: { w: 595.28, h: 841.89 }, A3: { w: 841.89, h: 1190.55 }, Letter: { w: 612, h: 792 }, Legal: { w: 612, h: 1008 },
}
/**
 * Le larghezze delle colonne (in punti) sulla larghezza utile del foglio: se non
 * ci stanno si stringono tutte in proporzione; se avanza spazio (foglio
 * orizzontale, A3) va tutto alla colonna più larga — la descrizione — che così
 * va meno a capo. Le colonne dei numeri restano quelle.
 */
export function larghezzeColonne(colonne: { larghezza: number }[], utile: number): number[] {
  const somma = colonne.reduce((s, c) => s + c.larghezza * MM, 0)
  const k = somma > utile ? utile / somma : 1
  const w = colonne.map((c) => c.larghezza * MM * k)
  if (somma < utile && w.length) {
    let i = 0
    w.forEach((v, j) => { if (v > w[i]) i = j })
    w[i] += utile - somma
  }
  return w
}

/** Foglio e margini in punti, dalle impostazioni (o il foglio storico del registro). */
export function geometriaPdf(st?: StileStampa): { foglio: { w: number; h: number }; margini: { sx: number; dx: number; alto: number; basso: number } } {
  if (!st) return { foglio: { ...A4 }, margini: { ...MARGINE } }
  const f = FORMATI_PT[st.formato || 'A4'] || FORMATI_PT.A4
  const foglio = st.orientamento === 'orizzontale' ? { w: f.h, h: f.w } : { ...f }
  const m = st.margini || {}
  const mm = (v: number | undefined, d: number): number => Math.max(5, Math.min(60, v ?? d)) * MM
  return { foglio, margini: { sx: mm(m.sinistra, 15), dx: mm(m.destra, 15), alto: mm(m.sopra, 14), basso: mm(m.sotto, 14) } }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type PdfLib = any
type PdfFont = { widthOfTextAtSize(t: string, s: number): number }
type PdfPage = any

/** Studio che firma le stampe (dai dati di Amministrazione → Azienda): va nel piè di pagina. */
let studioStampe = ''
export function impostaStudioStampe(nome: string | null | undefined): void { studioStampe = String(nome ?? '').trim() }

export interface Colonna {
  chiave: string
  etichetta: string
  /** Larghezza in mm. */
  larghezza: number
  allinea?: 'sinistra' | 'destra' | 'centro'
  /** Etichetta di gruppo sopra più colonne contigue (es. «DIMENSIONI»). */
  gruppo?: string
}

export interface RigaTabella {
  celle: Partial<Record<string, string>>
  /** Colonna il cui testo va a capo (default: la colonna più larga). */
  aCapo?: string
  grassetto?: boolean
  corsivo?: boolean
  /** Importo che si somma al progressivo «a riportare» dopo questa riga. */
  importo?: number
  /** Testo su più colonne unite (titoli di categoria, totali). */
  unisci?: { da: string; a: string }
  /** Riferimento libero: il risultato dice in che pagina è finita la riga (`paginaDi`). */
  ref?: string
  /** Non separare questa riga dalla successiva a fine pagina. */
  legaASeguente?: boolean
  lineaSopra?: boolean
  /** Fondo grigio chiaro (titoli). */
  evidenzia?: boolean
  /** Spazio extra sotto la riga, in mm. */
  spazioDopo?: number
  /** Massimo di righe INIZIALI della colonna che va a capo: oltre, il testo si tronca con «…». */
  maxRighe?: number
  /** Con `maxRighe`: righe FINALI da conservare comunque (le sottovoci stanno in fondo
   *  alla descrizione). Il taglio cade in mezzo, segnato da «…» a fine e inizio riga. */
  righeFinali?: number
  /** Se la riga apre una pagina a metà di una voce, si ripete prima questa riga
   *  di richiamo (es. numero e tariffa della voce con «segue»). */
  richiamo?: Partial<Record<string, string>>
}

export interface OpzioniRegistro {
  /** Titolo del documento (es. «COMPUTO METRICO ESTIMATIVO»). */
  titolo: string
  /** Righe di intestazione sotto il titolo, prima pagina (oggetto, committente…). */
  intestazione?: string[]
  /** Intestazione corta ripetuta in testa alle pagine successive. */
  testataPagine?: string
  colonne: Colonna[]
  /** Colonna dove si scrive il progressivo di riporto. */
  colonnaRiporto: string
  /** Colonna dove si scrive l'etichetta «RIPORTO» / «A RIPORTARE». */
  colonnaEtichetta: string
  formatoImporto?: (n: number) => string
  /** Testo a sinistra nel piè di pagina. */
  piede?: string
  /** Corpo del testo in punti (default 7.5). */
  corpo?: number
  /** Foglio, margini, corpo, testata e piè: se assente, quelle di chi stampa (impostaStileStampaPdf). */
  stile?: StileStampa
  /** PDF/A-2b (default sì, se fontkit c'è). */
  pdfa?: boolean
  /** fontkit, se non è sulla pagina. */
  fontkit?: unknown
  /** Data del documento (default adesso): la stessa in Info e XMP. */
  data?: Date
  /** Niente «riporto / a riportare» (elenco prezzi, quadro economico). */
  senzaRiporti?: boolean
  /**
   * UN SOLO REGISTRO A PAGINE NUMERATE. Libretto e registro di contabilità non
   * sono un documento nuovo a ogni SAL: sono fogli che continuano, numerati di
   * seguito (art. 14 All. II.14, art. 2215 c.c.). Qui si dice da quale numero
   * riprende la numerazione: 1 (o assente) = primo foglio, e allora il piè
   * scrive «Pag. k di N»; oltre 1 = l'atto continua, e il piè scrive «Pag. k»
   * senza totale, perché il totale lo conosce solo il registro intero.
   */
  paginaIniziale?: number
  /**
   * Atto che CONTINUA: niente frontespizio (titolo + intestazione) sulla prima
   * pagina, si riprende dalla testata corta, come sui registri successivi al
   * primo. Chi stampa il 2° SAL non ristampa la copertina del registro.
   */
  senzaFrontespizio?: boolean
  /**
   * FOGLI IN BIANCO da aggiungere in coda fino ad arrivare a questo numero di
   * pagine: serve al registro da far **numerare, bollare e vidimare prima
   * dell'inizio dei lavori** (art. 2215 c.c.). Sono pagine vere, con la
   * testata delle colonne e la griglia vuota, non spazi lasciati a caso.
   */
  pagineVuoteMinime?: number
}

const MM = 72 / 25.4
const A4 = { w: 595.28, h: 841.89 }
const MARGINE = { sx: 15 * MM, dx: 15 * MM, alto: 14 * MM, basso: 14 * MM }
const PAD = 1.2 * MM

/** Numero all'italiana con separatore delle migliaia sempre presente (1.234,56). */
export function fmtNum(n: number, decimali = 2): string {
  if (!Number.isFinite(n)) return ''
  const neg = n < 0
  const [int, dec] = Math.abs(n).toFixed(decimali).split('.')
  const gruppi = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return (neg ? '-' : '') + gruppi + (dec ? ',' + dec : '')
}
export const fmtEuro = (n: number): string => fmtNum(n, 2)

const WINANSI_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'
/** Testo stampabile con i font standard: sostituisce ciò che WinAnsi non codifica. */
export function testoStampabile(s: string): string {
  return String(s ?? '')
    .replace(/[≤]/g, '<=').replace(/[≥]/g, '>=').replace(/[×✕]/g, 'x')
    .replace(/[−]/g, '-').replace(/[   ]/g, ' ')
    .replace(/\t/g, ' ')
    .split('').map(ch => {
      const c = ch.charCodeAt(0)
      if (ch === '\n') return ch
      if ((c >= 0x20 && c <= 0x7e) || (c >= 0xa1 && c <= 0xff) || WINANSI_EXTRA.includes(ch)) return ch
      return '?'
    }).join('')
}

/** Divide `testo` in righe che stanno in `larghezza` punti (a capo su spazi, parole lunghe spezzate). */
export function spezzaTesto(testo: string, font: PdfFont, corpo: number, larghezza: number): string[] {
  const out: string[] = []
  for (const par of testoStampabile(testo).split('\n')) {
    const parole = par.split(/ +/).filter(Boolean)
    if (!parole.length) { out.push(''); continue }
    let riga = ''
    for (let p of parole) {
      while (font.widthOfTextAtSize(p, corpo) > larghezza) {
        // parola più lunga della colonna: spezza a caratteri
        let k = p.length
        while (k > 1 && font.widthOfTextAtSize(p.slice(0, k), corpo) > larghezza) k--
        if (riga) { out.push(riga); riga = '' }
        out.push(p.slice(0, k)); p = p.slice(k)
      }
      const prova = riga ? riga + ' ' + p : p
      if (font.widthOfTextAtSize(prova, corpo) <= larghezza) riga = prova
      else { out.push(riga); riga = p }
    }
    out.push(riga)
  }
  return out
}

interface RigaMisurata { r: RigaTabella; righe: Record<string, string[]>; altezza: number }

/**
 * Genera il PDF. `lib` è il namespace di pdf-lib (`window.PDFLib` o `import * as lib from 'pdf-lib'`).
 * Ritorna i byte del file e il numero di pagine.
 */
export async function creaRegistroPdf(lib: PdfLib, opz: OpzioniRegistro, righe: RigaTabella[]): Promise<{ bytes: Uint8Array; pagine: number; paginaDi: Record<string, number>; pdfa: boolean }> {
  const doc = await lib.PDFDocument.create()
  doc.setTitle(testoStampabile(opz.titolo))
  doc.setCreator('Quadra')
  // il foglio di chi stampa: formato, margini, corpo (le stesse impostazioni degli atti HTML)
  const stile = opz.stile ?? _stileCorrente?.() ?? undefined
  const { foglio: A4, margini: MARGINE } = geometriaPdf(stile)
  // caratteri incorporati (PDF/A) se fontkit c'è; altrimenti quelli standard
  const fk = opz.pdfa === false ? null : trovaFontkit(lib, opz.fontkit)
  const incorporati = fk ? await caratteriPdfA(doc, lib, fk) : null
  const F = incorporati ?? {
    n: await doc.embedFont(lib.StandardFonts.Helvetica),
    b: await doc.embedFont(lib.StandardFonts.HelveticaBold),
    i: await doc.embedFont(lib.StandardFonts.HelveticaOblique),
  }
  const nero = lib.rgb(0, 0, 0), grigio = lib.rgb(0.45, 0.45, 0.45), fondo = lib.rgb(0.92, 0.92, 0.92), filo = lib.rgb(0.6, 0.6, 0.6)
  // il corpo scala con quello scelto per la stampa (10 pt = il corpo storico del registro)
  const corpo = (opz.corpo ?? 7.5) * ((stile?.corpo ?? 10) / 10)
  const interlinea = corpo * 1.22
  const fmt = opz.formatoImporto ?? fmtEuro

  // geometria colonne (scalate se la somma supera la larghezza utile)
  const utile = A4.w - MARGINE.sx - MARGINE.dx
  const larghezze = larghezzeColonne(opz.colonne, utile)
  const cols = opz.colonne.map((c, i) => ({ ...c, w: larghezze[i], x: 0 }))
  let x = MARGINE.sx
  for (const c of cols) { c.x = x; x += c.w }
  const xFine = x
  const colByKey = new Map(cols.map(c => [c.chiave, c]))
  const piuLarga = cols.reduce((a, b) => (b.w > a.w ? b : a)).chiave

  const fontDi = (r: RigaTabella): PdfFont => (r.grassetto ? F.b : r.corsivo ? F.i : F.n)
  const spanW = (r: RigaTabella): { x: number; w: number } | null => {
    if (!r.unisci) return null
    const a = colByKey.get(r.unisci.da)!, b = colByKey.get(r.unisci.a)!
    return { x: a.x, w: b.x + b.w - a.x }
  }

  const misura = (r: RigaTabella): RigaMisurata => {
    const font = fontDi(r)
    const out: Record<string, string[]> = {}
    let maxRighe = 1
    const sp = spanW(r)
    for (const c of cols) {
      const t = r.celle[c.chiave]
      if (t == null || t === '') continue
      const w = (sp && c.chiave === r.unisci!.da ? sp.w : c.w) - 2 * PAD
      const aCapo = (r.aCapo ?? piuLarga) === c.chiave || (sp && c.chiave === r.unisci!.da)
      let linee = aCapo ? spezzaTesto(t, font, corpo, w) : [testoStampabile(t)]
      const finali = Math.max(0, r.righeFinali ?? 0)
      if (aCapo && r.maxRighe && linee.length > r.maxRighe + finali) {
        const coda = finali ? linee.slice(-finali) : []
        linee = linee.slice(0, r.maxRighe)
        // ultima riga iniziale con «…» entro la larghezza
        let ult = linee[linee.length - 1]
        while (ult && font.widthOfTextAtSize(ult + ' …', corpo) > w) ult = ult.slice(0, -1)
        linee[linee.length - 1] = ult.replace(/\s+$/, '') + ' …'
        if (coda.length) {
          // prima riga finale preceduta da «…», sempre entro la larghezza
          let pr = coda[0]
          while (pr && font.widthOfTextAtSize('… ' + pr, corpo) > w) pr = pr.slice(1)
          coda[0] = '… ' + pr.replace(/^\s+/, '')
          linee = linee.concat(coda)
        }
      }
      out[c.chiave] = linee
      maxRighe = Math.max(maxRighe, linee.length)
    }
    return { r, righe: out, altezza: maxRighe * interlinea + 2 * PAD * 0.6 + (r.spazioDopo ?? 0) * MM }
  }

  // ── testata colonne (due livelli se ci sono gruppi) ──
  const haGruppi = cols.some(c => c.gruppo)
  const hTestata = (haGruppi ? 2 : 1) * (corpo + 4) + 2
  const disegnaTestata = (page: PdfPage, yTop: number): number => {
    const y0 = yTop
    const yBase = yTop - hTestata
    page.drawRectangle({ x: MARGINE.sx, y: yBase, width: xFine - MARGINE.sx, height: hTestata, color: fondo })
    const corpoT = corpo - 0.5
    for (let i = 0; i < cols.length; i++) {
      const c = cols[i]
      const grp = c.gruppo
      const yEtich = grp ? yBase + 3 : yBase + hTestata / 2 - corpoT / 3
      const testo = testoStampabile(c.etichetta)
      const tw = F.b.widthOfTextAtSize(testo, corpoT)
      page.drawText(testo, { x: c.x + Math.max(PAD, (c.w - tw) / 2), y: yEtich, size: corpoT, font: F.b, color: nero })
      if (grp && (i === 0 || cols[i - 1].gruppo !== grp)) {
        let j = i; while (j + 1 < cols.length && cols[j + 1].gruppo === grp) j++
        const gx = c.x, gw = cols[j].x + cols[j].w - c.x
        const gt = testoStampabile(grp), gtw = F.b.widthOfTextAtSize(gt, corpoT)
        page.drawText(gt, { x: gx + (gw - gtw) / 2, y: y0 - corpoT - 2, size: corpoT, font: F.b, color: nero })
        page.drawLine({ start: { x: gx, y: y0 - corpoT - 4 }, end: { x: gx + gw, y: y0 - corpoT - 4 }, thickness: 0.4, color: filo })
      }
    }
    page.drawRectangle({ x: MARGINE.sx, y: yBase, width: xFine - MARGINE.sx, height: hTestata, borderColor: nero, borderWidth: 0.6 })
    return yBase
  }

  // tratti di pagina in cui una riga a colonne unite non va attraversata dai filetti verticali
  const unite = new Map<PdfPage, { y0: number; y1: number; x0: number; x1: number }[]>()
  const disegnaRiga = (page: PdfPage, m: RigaMisurata, yTop: number): void => {
    const { r } = m
    const font = fontDi(r)
    const sp = spanW(r)
    if (sp) {
      const l = unite.get(page) ?? []
      l.push({ y0: yTop - m.altezza, y1: yTop, x0: sp.x, x1: sp.x + sp.w })
      unite.set(page, l)
    }
    if (r.evidenzia) page.drawRectangle({ x: MARGINE.sx, y: yTop - m.altezza + (r.spazioDopo ?? 0) * MM, width: xFine - MARGINE.sx, height: m.altezza - (r.spazioDopo ?? 0) * MM, color: fondo })
    if (r.lineaSopra) page.drawLine({ start: { x: MARGINE.sx, y: yTop }, end: { x: xFine, y: yTop }, thickness: 0.4, color: filo })
    for (const c of cols) {
      const linee = m.righe[c.chiave]
      if (!linee) continue
      const x0 = sp && c.chiave === r.unisci!.da ? sp.x : c.x
      const w = sp && c.chiave === r.unisci!.da ? sp.w : c.w
      linee.forEach((t, i) => {
        const y = yTop - PAD * 0.6 - corpo - i * interlinea + 1.5
        const tw = font.widthOfTextAtSize(t, corpo)
        const xx = c.allinea === 'destra' && !sp ? x0 + w - PAD - tw
          : c.allinea === 'centro' && !sp ? x0 + (w - tw) / 2 : x0 + PAD
        page.drawText(t, { x: xx, y, size: corpo, font, color: nero })
      })
    }
  }

  const rigaRiporto = (etichetta: string, valore: number): RigaMisurata => misura({
    celle: { [opz.colonnaEtichetta]: etichetta, [opz.colonnaRiporto]: fmt(valore) },
    grassetto: true, lineaSopra: true,
  })

  // ── impaginazione ──
  const misurate = righe.map(misura)
  // gruppi indivisibili (legaASeguente)
  const gruppi: RigaMisurata[][] = []
  let corrente: RigaMisurata[] = []
  for (const m of misurate) {
    corrente.push(m)
    if (!m.r.legaASeguente) { gruppi.push(corrente); corrente = [] }
  }
  if (corrente.length) gruppi.push(corrente)

  const pagine: PdfPage[] = []
  const paginaDi: Record<string, number> = {}
  let page: PdfPage
  let y = 0
  let yTabellaTop = 0
  let progressivo = 0
  let haImporti = false
  const hRiporto = interlinea + 2 * PAD * 0.6
  const limite = (): number => MARGINE.basso + 6 * MM + hRiporto // spazio per «a riportare» e piè

  const chiudiBordi = (p: PdfPage, yTop: number, yBot: number): void => {
    const buchi = unite.get(p) ?? []
    for (const c of cols.slice(1)) {
      // filetto verticale, interrotto dove passa una riga a colonne unite
      const tagli = buchi.filter(b => c.x > b.x0 + 0.5 && c.x < b.x1 - 0.5).sort((a, b) => b.y1 - a.y1)
      let y = yTop
      for (const t of tagli) {
        if (t.y1 < y) p.drawLine({ start: { x: c.x, y }, end: { x: c.x, y: Math.max(t.y1, yBot) }, thickness: 0.3, color: filo })
        y = Math.min(y, t.y0)
      }
      if (y > yBot) p.drawLine({ start: { x: c.x, y }, end: { x: c.x, y: yBot }, thickness: 0.3, color: filo })
    }
    p.drawRectangle({ x: MARGINE.sx, y: yBot, width: xFine - MARGINE.sx, height: yTop - yBot, borderColor: nero, borderWidth: 0.6 })
  }

  const nuovaPagina = (): void => {
    page = doc.addPage([A4.w, A4.h])
    pagine.push(page)
    y = A4.h - MARGINE.alto
    if (pagine.length === 1 && !opz.senzaFrontespizio && stile?.intestazione !== false) {
      const t = testoStampabile(opz.titolo)
      const tw = F.b.widthOfTextAtSize(t, 13)
      page.drawText(t, { x: (A4.w - tw) / 2, y: y - 13, size: 13, font: F.b, color: nero })
      y -= 13 + 4 * MM
      for (const riga of opz.intestazione ?? []) {
        for (const l of spezzaTesto(riga, F.n, 9, utile)) {
          page.drawText(l, { x: MARGINE.sx, y: y - 9, size: 9, font: F.n, color: nero })
          y -= 11.5
        }
      }
      y -= 3 * MM
    } else if (opz.testataPagine) {
      const t = spezzaTesto(opz.testataPagine, F.i, 7, utile)[0]
      page.drawText(t, { x: MARGINE.sx, y: y - 7, size: 7, font: F.i, color: grigio })
      y -= 7 + 2.5 * MM
    }
    yTabellaTop = y
    y = disegnaTestata(page, y)
    if (haImporti && pagine.length > 1) {
      const rr = rigaRiporto('R I P O R T O', progressivo)
      disegnaRiga(page, rr, y); y -= rr.altezza
    }
  }

  const fineFoglio = (): void => {
    if (haImporti) {
      const rr = rigaRiporto('A R I P O R T A R E', progressivo)
      disegnaRiga(page, rr, y); y -= rr.altezza
    }
    chiudiBordi(page, yTabellaTop - hTestata, y)
  }

  nuovaPagina()
  const altezzaUtilePagina = (A4.h - MARGINE.alto - (opz.testataPagine ? 7 + 2.5 * MM : 0)) - hTestata - hRiporto - limite()
  for (const g of gruppi) {
    const hG = g.reduce((s, m) => s + m.altezza, 0)
    // il gruppo (voce + misure + sommano) va a pagina nuova se non ci sta e lo spazio
    // rimasto è poco; altrimenti scorre e si spezza riga per riga
    const spazio = y - limite()
    if (hG > spazio && hG <= altezzaUtilePagina && spazio < Math.min(hG, 45 * MM)) {
      fineFoglio(); nuovaPagina()
    }
    for (const m of g) {
      if (y - m.altezza < limite()) {
        fineFoglio(); nuovaPagina()
        if (m.r.richiamo) { const rc = misura({ celle: m.r.richiamo, corsivo: true }); disegnaRiga(page, rc, y); y -= rc.altezza }
      }
      if (m.altezza > altezzaUtilePagina) {
        // riga più alta di una pagina intera: si spezza riga per riga
        const chiave = Object.keys(m.righe).reduce((a, b) => (m.righe[b].length > m.righe[a].length ? b : a))
        let resto = m.righe[chiave]
        while (resto.length) {
          const n = Math.max(1, Math.floor((y - limite() - 2 * PAD) / interlinea))
          const pezzo: RigaMisurata = { r: { ...m.r, importo: undefined }, righe: { ...m.righe, [chiave]: resto.slice(0, n) }, altezza: Math.min(n, resto.length) * interlinea + 2 * PAD * 0.6 }
          if (resto !== m.righe[chiave]) for (const kk of Object.keys(pezzo.righe)) if (kk !== chiave) delete pezzo.righe[kk]
          disegnaRiga(page, pezzo, y); y -= pezzo.altezza
          resto = resto.slice(n)
          if (resto.length) { fineFoglio(); nuovaPagina() }
        }
      } else {
        disegnaRiga(page, m, y); y -= m.altezza
      }
      if (m.r.ref) paginaDi[m.r.ref] = pagine.length
      if (m.r.importo != null && Number.isFinite(m.r.importo)) { progressivo += m.r.importo; haImporti = !opz.senzaRiporti }
    }
  }
  chiudiBordi(page, yTabellaTop - hTestata, y)

  // fogli in bianco in coda: il registro da vidimare prima dell'inizio dei lavori
  const minime = Math.max(0, Math.floor(opz.pagineVuoteMinime ?? 0))
  while (pagine.length < minime) {
    nuovaPagina()
    chiudiBordi(page, yTabellaTop - hTestata, limite())
  }

  // piè di pagina: «Pag. n di N» sul primo foglio, «Pag. n» su un atto che continua
  const N = pagine.length
  const p0 = Math.max(1, Math.floor(opz.paginaIniziale ?? 1))
  pagine.forEach((p, i) => {
    const t = p0 > 1 ? `Pag. ${p0 + i}` : `Pag. ${i + 1} di ${N}`
    const tw = F.n.widthOfTextAtSize(t, 7)
    p.drawText(t, { x: A4.w - MARGINE.dx - tw, y: MARGINE.basso - 2, size: 7, font: F.n, color: grigio })
    const piede = stile?.piede === false ? '' : [studioStampe, opz.piede].filter(Boolean).join(' · ')
    if (piede) p.drawText(spezzaTesto(piede, F.n, 7, utile * 0.7)[0], { x: MARGINE.sx, y: MARGINE.basso - 2, size: 7, font: F.n, color: grigio })
  })

  if (incorporati) {
    rendiPdfA(doc, lib, { titolo: testoStampabile(opz.titolo), creatore: 'Quadra', produttore: 'Quadra (pdf-lib)', data: opz.data ?? new Date() })
    return { bytes: await salvaPdfA(doc), pagine: N, paginaDi, pdfa: true }
  }
  return { bytes: await doc.save(), pagine: N, paginaDi, pdfa: false }
}

/**
 * La stessa tabella in HTML (anteprima a schermo, modifica, Word): colonne, gruppi,
 * righe con grassetto/corsivo/evidenza. Niente impaginazione né riporti.
 */
export function registroHtml(opz: OpzioniRegistro, righe: RigaTabella[]): string {
  const e = (t: unknown): string => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const cols = opz.colonne
  const al = (a?: string): string => (a === 'destra' ? 'right' : a === 'centro' ? 'center' : 'left')
  const gruppi: { nome: string; n: number }[] = []
  for (const c of cols) { const g = c.gruppo ?? ''; const u = gruppi[gruppi.length - 1]; if (u && u.nome === g) u.n++; else gruppi.push({ nome: g, n: 1 }) }
  const testa = (gruppi.some((g) => g.nome) ? `<tr>${gruppi.map((g) => `<th colspan="${g.n}" style="text-align:center">${e(g.nome)}</th>`).join('')}</tr>` : '') +
    `<tr>${cols.map((c) => `<th style="text-align:${al(c.allinea)}">${e(c.etichetta)}</th>`).join('')}</tr>`
  const corpo = righe.map((r) => {
    const st = [r.grassetto ? 'font-weight:700' : '', r.corsivo ? 'font-style:italic' : '', r.evidenzia ? 'background:#eee' : '', r.lineaSopra ? 'border-top:1px solid #000' : ''].filter(Boolean).join(';')
    if (r.unisci) {
      const i0 = cols.findIndex((c) => c.chiave === r.unisci!.da), i1 = cols.findIndex((c) => c.chiave === r.unisci!.a)
      const testo = cols.slice(i0, i1 + 1).map((c) => r.celle[c.chiave]).filter(Boolean).join(' ')
      return `<tr style="${st}">${cols.slice(0, i0).map(() => '<td></td>').join('')}<td colspan="${i1 - i0 + 1}">${e(testo)}</td>${cols.slice(i1 + 1).map((c) => `<td style="text-align:${al(c.allinea)}">${e(r.celle[c.chiave])}</td>`).join('')}</tr>`
    }
    return `<tr style="${st}">${cols.map((c) => `<td style="text-align:${al(c.allinea)};vertical-align:top">${e(r.celle[c.chiave])}</td>`).join('')}</tr>`
  }).join('')
  return `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"><title>${e(opz.titolo)}</title><style>body{font:12px/1.35 system-ui,sans-serif;margin:24px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #bbb;padding:3px 5px}th{font-size:10px;text-transform:uppercase}h1{font-size:16px}</style></head><body>` +
    `<h1>${e(opz.titolo)}</h1>${(opz.intestazione ?? []).map((x) => `<div>${e(x)}</div>`).join('')}<br><table><thead>${testa}</thead><tbody>${corpo}</tbody></table></body></html>`
}

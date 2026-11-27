/**
 * COMPUTO METRICO ESTIMATIVO in PDF, impaginazione «da elaborato»:
 *
 *   Num.Ord. | TARIFFA | DESIGNAZIONE DEI LAVORI | DIMENSIONI (par.ug. lung. larg. H/peso) |
 *   Quantità | IMPORTI (unitario, TOTALE)
 *
 * Per ogni voce: riga con numero, tariffa e descrizione estesa; righe di misura
 * (descrizione + fattori + quantità parziale); riga «SOMMANO um» con quantità totale,
 * prezzo e importo (che alimenta il riporto). Le voci sono raggruppate per categoria
 * (fino a tre livelli «Super · Categoria · Sub»), nell'ordine in cui compaiono; in
 * fondo il totale e il riepilogo per categorie.
 *
 * Modulo puro: usa `creaRegistroPdf` con pdf-lib iniettato.
 */
import { creaRegistroPdf, fmtEuro, fmtNum, type RigaTabella } from './registro-pdf'
import type { VoceComputo } from '../xpwe/xpwe'
import { CAT_SEP } from '../xpwe/xpwe'
import { intestazioneStampa, type DatiGenerali } from '../dati-generali'
import { titoliGruppo, type ModoOrdine } from '../ordine-computo'
import { importoQta } from '../importo'

/** Dati generali usati in intestazione (vedi src/shared/dati-generali.ts). */
export type DatiGeneraliComputo = Partial<DatiGenerali>

export interface OpzioniComputoPdf {
  /** Struttura WBS del progetto: codice → descrizione del nodo. */
  wbsNodi?: Record<string, string>
  /**
   * Come stampare la descrizione delle voci:
   *  - 'estesa' (default): la descrizione completa;
   *  - 'ridotta': solo la descrizione breve (una riga o poco più);
   *  - 'compatta': la descrizione estesa con le prime `righeMax` righe e le ultime
   *    `righeFinali` (dove stanno le sottovoci), il taglio in mezzo segnato da «…».
   */
  descrizione?: 'estesa' | 'ridotta' | 'compatta'
  /**
   * Con la descrizione estesa (o accorciata): stampa ANCHE la descrizione ridotta, in
   * grassetto sopra l'estesa (se l'estesa non comincia già con lei). Default: no.
   */
  conRidotta?: boolean
  /** Righe iniziali della descrizione in modalità 'compatta' (default 3). */
  righeMax?: number
  /** Righe finali della descrizione in modalità 'compatta' (default 2). */
  righeFinali?: number
  /** Raggruppamento con titoli: per categorie (default), per WBS o nessuno (ordine manuale). */
  raggruppa?: ModoOrdine
  /** Stampa la riga WBS sotto ogni voce (default sì, se la voce ha un codice WBS). */
  rigaWbs?: boolean
  /** Riepiloghi in fondo: per categorie, per WBS, entrambi (default) o nessuno. */
  riepilogo?: 'categorie' | 'wbs' | 'entrambi' | 'nessuno'
  /** Righe di misura sotto ogni voce (default sì). Senza: la voce porta solo la quantità — stampa sintetica. */
  misure?: boolean
  /** Computo metrico NON estimativo: solo misure e quantità, senza prezzi né importi. */
  senzaPrezzi?: boolean
  /** Titolo del documento al posto di «COMPUTO METRICO ESTIMATIVO» (es. «COMPUTO CONSUNTIVO»). */
  titolo?: string
}

const r2 = (n: number): number => { const x = Math.abs(n) * 100; return Math.sign(n) * Math.round(Number(x.toPrecision(15))) / 100 }
const fq = (n: number | null | undefined, d = 2): string => (n == null || !Number.isFinite(n) ? '' : fmtNum(n, d))

/**
 * Riepilogo per Supercategoria › Categoria › Subcategoria: ogni ramo con
 * l'importo suo e dei discendenti, nell'ordine in cui compaiono le voci.
 */
export function riepilogoCategorieAlbero(voci: VoceComputo[]): { percorso: string[]; livello: number; importo: number }[] {
  const m = new Map<string, { percorso: string[]; livello: number; importo: number }>()
  for (const v of voci) {
    const p = (v.categoria ?? '').split(CAT_SEP).map((x) => x.trim()).filter(Boolean)
    const parti = p.length ? p : ['(senza categoria)']
    for (let i = 1; i <= parti.length; i++) {
      const k = parti.slice(0, i).join('\u0000')
      const n = m.get(k) ?? { percorso: parti.slice(0, i), livello: i - 1, importo: 0 }
      n.importo = r2(n.importo + importoVoce(v))
      m.set(k, n)
    }
  }
  // ordine: padre prima dei figli, fratelli nell'ordine di prima comparsa
  const out: { percorso: string[]; livello: number; importo: number }[] = []
  const visita = (pre: string[]): void => {
    for (const n of m.values()) {
      if (n.livello === pre.length && pre.every((x, i) => n.percorso[i] === x)) { out.push(n); visita(n.percorso) }
    }
  }
  visita([])
  return out
}

const qtyVoce = (v: VoceComputo): number =>
  v.misurazioni?.length ? r2(v.misurazioni.reduce((s, m) => s + (m.quantita || 0), 0)) : r2(v.qty ?? 0)
export const importoVoce = (v: VoceComputo): number => importoQta(qtyVoce(v), v.prezzo, v.um)

/**
 * Riepilogo per WBS: importo di ogni nodo, sommando le voci del nodo e dei suoi
 * discendenti (il codice «01.02.03» contribuisce a «01», «01.02» e «01.02.03»).
 */
export function riepilogoWbs(voci: VoceComputo[], nodi: Record<string, string> = {}): { codice: string; descrizione: string; livello: number; importo: number }[] {
  const m = new Map<string, number>()
  for (const v of voci) {
    const c = (v.wbs ?? '').trim()
    if (!c) continue
    const parti = c.split('.')
    for (let i = 1; i <= parti.length; i++) {
      const k = parti.slice(0, i).join('.')
      m.set(k, r2((m.get(k) ?? 0) + importoVoce(v)))
    }
  }
  const cmp = (a: string, b: string): number => a.localeCompare(b, 'it', { numeric: true })
  return [...m].sort((a, b) => cmp(a[0], b[0])).map(([codice, importo]) => ({
    codice, descrizione: nodi[codice] ?? '', livello: codice.split('.').length - 1, importo,
  }))
}

/** Righe di tabella del computo (separate dal disegno, così sono verificabili nei test). */
export function righeComputo(voci: VoceComputo[], nodiWbs: Record<string, string> = {}, opz: OpzioniComputoPdf = {}): RigaTabella[] {
  const modo = opz.descrizione ?? 'estesa'
  const righe: RigaTabella[] = []
  let catPrec: string[] = []
  let n = 0
  // Gli oneri della sicurezza (non soggetti a ribasso) stanno in una sezione a sé, dopo i
  // lavori, qualunque categoria abbiano: dentro la sezione le categorie restano come titoli.
  // Sezioni come negli elaborati di gara: lavori a misura, lavori a corpo (prezzo fisso),
  // oneri della sicurezza (non soggetti a ribasso). Con una sola sezione nessun titolo.
  const misura = voci.filter((v) => !v.sicurezza && !v.corpo), corpo = voci.filter((v) => !v.sicurezza && v.corpo), sicurezza = voci.filter((v) => v.sicurezza)
  const tutte: [string, string, VoceComputo[]][] = [
    [corpo.length ? 'LAVORI A MISURA' : 'LAVORI', corpo.length ? 'Totale lavori a misura' : 'Totale lavori soggetti a ribasso', misura],
    ['LAVORI A CORPO', 'Totale lavori a corpo', corpo],
    ['ONERI DELLA SICUREZZA — non soggetti a ribasso', 'Totale oneri della sicurezza', sicurezza],
  ]
  const sezioni = tutte.filter(([, , l]) => l.length)
  if (sezioni.length < 2) sezioni.splice(0, sezioni.length, ['', '', voci])
  for (const [titolo, totLabel, sezione] of sezioni) {
  if (titolo) {
    catPrec = []
    righe.push({
      celle: { tariffa: titolo }, unisci: { da: 'tariffa', a: 'desc' },
      grassetto: true, evidenzia: true, legaASeguente: true, spazioDopo: 0.5,
    })
  }
  for (const v of sezione) {
    const cat = titoliGruppo(opz.raggruppa ?? 'categorie', v.categoria, v.wbs, nodiWbs)
    // titoli dei livelli di categoria che cambiano
    cat.forEach((nome, lv) => {
      if (catPrec[lv] === nome && cat.slice(0, lv).join() === catPrec.slice(0, lv).join()) return
      righe.push({
        celle: { tariffa: nome.toUpperCase() }, unisci: { da: 'tariffa', a: 'desc' },
        grassetto: lv === 0, corsivo: lv > 0, evidenzia: lv === 0, legaASeguente: true, spazioDopo: 0.5,
      })
    })
    catPrec = cat
    n++
    // come negli elaborati di computo: la descrizione estesa (la ridotta solo se manca l'estesa)
    const testo = (modo === 'ridotta' ? (v.desc_short || v.declaratoria || '') : (v.declaratoria || v.desc_short || '')).trim()
    const ridotta = (v.desc_short || '').trim()
    // descrizione ridotta in grassetto sopra l'estesa, se richiesta e se aggiunge qualcosa
    const titolo = opz.conRidotta && modo !== 'ridotta' && ridotta && testo && ridotta !== testo &&
      !testo.toLowerCase().startsWith(ridotta.toLowerCase()) ? ridotta : ''
    if (titolo) righe.push({ celle: { n: String(n), tariffa: v.codice, desc: titolo }, grassetto: true, legaASeguente: true })
    righe.push({
      celle: titolo ? { desc: testo } : { n: String(n), tariffa: v.codice, desc: testo || v.codice }, legaASeguente: true,
      maxRighe: modo === 'compatta' ? Math.max(1, opz.righeMax ?? 3) : undefined,
      righeFinali: modo === 'compatta' ? Math.max(0, opz.righeFinali ?? 2) : undefined,
    })
    if (v.wbs && opz.rigaWbs !== false && opz.raggruppa !== 'wbs') {
      const d = nodiWbs[v.wbs]
      righe.push({ celle: { desc: `WBS ${v.wbs}${d ? ' — ' + d : ''}` }, corsivo: true, legaASeguente: true })
    }
    const richiamo = { n: String(n), tariffa: v.codice, desc: 'segue: ' + (v.desc_short || v.codice) }
    for (const m of opz.misure === false ? [] : v.misurazioni ?? []) {
      righe.push({
        richiamo,
        celle: {
          desc: m.descrizione ?? '', pu: fq(m.n), lu: fq(m.l1), la: fq(m.l2), hp: fq(m.h), qta: fq(m.quantita),
        },
        corsivo: true, legaASeguente: true,
      })
    }
    const q = qtyVoce(v), imp = importoVoce(v)
    righe.push(opz.senzaPrezzi
      ? { celle: { desc: `SOMMANO ${v.um ?? ''}`.trim(), qta: fq(q) }, grassetto: true, spazioDopo: 1.5, richiamo }
      : {
        celle: { desc: `SOMMANO ${v.um ?? ''}`.trim(), qta: fq(q), unit: fq(v.prezzo ?? 0), tot: fq(imp) },
        grassetto: true, importo: imp, spazioDopo: 1.5, richiamo,
      })
  }
  if (totLabel && !opz.senzaPrezzi) {
    const tot = r2(sezione.reduce((x, v) => x + importoVoce(v), 0))
    righe.push({ celle: { desc: totLabel, tot: fq(tot) }, grassetto: true, lineaSopra: true, spazioDopo: 3 })
  }
  }
  return righe
}

/** Genera il PDF del computo. `lib` = namespace pdf-lib. */
export async function computoPdf(lib: unknown, voci: VoceComputo[], dg: DatiGeneraliComputo = {}, opz: OpzioniComputoPdf = {}): Promise<{ bytes: Uint8Array; pagine: number; totale: number }> {
  const totale = r2(voci.reduce((s, v) => s + importoVoce(v), 0))
  const data = dg.data || new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const righe = righeComputo(voci, opz.wbsNodi, opz)
  if (opz.senzaPrezzi) {
    // COMPUTO METRICO (non estimativo): niente prezzi, niente importi, niente riporti
    const { bytes, pagine } = await creaRegistroPdf(lib, {
      titolo: 'COMPUTO METRICO',
      intestazione: intestazioneStampa(dg, data),
      testataPagine: `Computo metrico${dg.oggetto ? ' — ' + dg.oggetto : ''}`,
      colonne: [
        { chiave: 'n', etichetta: 'Num.Ord.', larghezza: 10, allinea: 'centro' },
        { chiave: 'tariffa', etichetta: 'TARIFFA', larghezza: 22 },
        { chiave: 'desc', etichetta: 'DESIGNAZIONE DEI LAVORI', larghezza: 78 },
        { chiave: 'pu', etichetta: 'par.ug.', larghezza: 12, allinea: 'destra', gruppo: 'DIMENSIONI' },
        { chiave: 'lu', etichetta: 'lung.', larghezza: 13, allinea: 'destra', gruppo: 'DIMENSIONI' },
        { chiave: 'la', etichetta: 'larg.', larghezza: 13, allinea: 'destra', gruppo: 'DIMENSIONI' },
        { chiave: 'hp', etichetta: 'H/peso', larghezza: 13, allinea: 'destra', gruppo: 'DIMENSIONI' },
        { chiave: 'qta', etichetta: 'Quantità', larghezza: 19, allinea: 'destra' },
      ],
      colonnaRiporto: 'qta',
      colonnaEtichetta: 'desc',
      senzaRiporti: true,
      piede: 'Quadra — computo metrico',
    }, righe)
    return { bytes, pagine, totale }
  }

  const sic = r2(voci.filter((v) => v.sicurezza).reduce((x, v) => x + importoVoce(v), 0))
  const acorpo = r2(voci.filter((v) => !v.sicurezza && v.corpo).reduce((x, v) => x + importoVoce(v), 0))
  const scomponi = sic > 0 || acorpo > 0
  righe.push({ celle: { desc: 'T O T A L E  euro', tot: fmtEuro(totale) }, grassetto: true, lineaSopra: true, unisci: undefined, spazioDopo: scomponi ? 0 : 4, legaASeguente: scomponi })
  if (scomponi) {
    //: il totale si scompone in lavori a base d'asta (a misura / a corpo) e oneri della sicurezza
    const parti: [string, number][] = acorpo
      ? [['di cui: lavori a misura', r2(totale - sic - acorpo)], ['            lavori a corpo', acorpo]]
      : [['di cui: lavori soggetti a ribasso', r2(totale - sic)]]
    if (sic) parti.push(['            oneri della sicurezza non soggetti a ribasso', sic])
    parti.forEach(([d, v], i) => righe.push({ celle: { desc: d, tot: fmtEuro(v) }, legaASeguente: i < parti.length - 1, spazioDopo: i === parti.length - 1 ? 4 : undefined }))
  }
  const quali = opz.riepilogo ?? 'entrambi'
  // Riepiloghi divisi per sezioni come il corpo del computo: la sicurezza (non soggetta a
  // ribasso) ha la sua parte, evidenziata, con il suo subtotale; idem i lavori a corpo.
  const sezRiep: [string, VoceComputo[], boolean][] = [
    ['LAVORI A MISURA', voci.filter((v) => !v.sicurezza && !v.corpo), false],
    ['LAVORI A CORPO', voci.filter((v) => !v.sicurezza && v.corpo), false],
    ['ONERI DELLA SICUREZZA — non soggetti a ribasso', voci.filter((v) => v.sicurezza), true],
  ].filter(([, l]) => (l as VoceComputo[]).length) as [string, VoceComputo[], boolean][]
  const divisi = sezRiep.length > 1
  const titoloSez = (t: string, sic: boolean): void => {
    righe.push({ celle: { desc: t }, grassetto: true, evidenzia: sic, lineaSopra: true, legaASeguente: true })
  }
  const subtot = (l: VoceComputo[], t: string): void => {
    righe.push({ celle: { desc: `Totale ${t.split(' — ')[0].toLowerCase()}`, tot: fmtEuro(r2(l.reduce((x, v) => x + importoVoce(v), 0))) }, corsivo: true, spazioDopo: 1.5 })  // fine del blocco: qui può andare a pagina nuova
  }
  if ((quali === 'categorie' || quali === 'entrambi') && riepilogoCategorieAlbero(voci).some((c) => c.percorso[0] !== '(senza categoria)')) {
    righe.push({ celle: { tariffa: 'RIEPILOGO CATEGORIE' }, unisci: { da: 'tariffa', a: 'desc' }, grassetto: true, evidenzia: true, legaASeguente: true })
    let nSup = 0
    for (const [t, l, sic] of divisi ? sezRiep : [['', voci, false] as [string, VoceComputo[], boolean]]) {
      if (divisi) titoloSez(t, sic)
      riepilogoCategorieAlbero(l).forEach((c) => righe.push({
        celle: { n: c.livello === 0 ? String(++nSup) : '', desc: '   '.repeat(c.livello) + c.percorso[c.livello], tot: fmtEuro(c.importo) },
        grassetto: c.livello === 0, corsivo: c.livello === 2, legaASeguente: true,
      }))
      if (divisi) subtot(l, t)
    }
    righe.push({ celle: { desc: 'Totale categorie', tot: fmtEuro(totale) }, grassetto: true, lineaSopra: true, spazioDopo: 4 })
  }
  if ((quali === 'wbs' || quali === 'entrambi') && riepilogoWbs(voci, opz.wbsNodi).length) {
    righe.push({ celle: { tariffa: 'RIEPILOGO WBS' }, unisci: { da: 'tariffa', a: 'desc' }, grassetto: true, evidenzia: true, legaASeguente: true })
    for (const [t, l, sic] of divisi ? sezRiep : [['', voci, false] as [string, VoceComputo[], boolean]]) {
      const wbs = riepilogoWbs(l, opz.wbsNodi)
      if (!wbs.length) continue
      if (divisi) titoloSez(t, sic)
      wbs.forEach((w) => righe.push({
        celle: { tariffa: w.codice, desc: '› '.repeat(w.livello) + (w.descrizione || '—'), tot: fmtEuro(w.importo) },
        grassetto: w.livello === 0, legaASeguente: true,
      }))
      if (divisi) subtot(l, t)
    }
    righe.push({ celle: { desc: 'Totale WBS', tot: fmtEuro(totale) }, grassetto: true, lineaSopra: true })
  }

  const intestazione = intestazioneStampa(dg, data)

  const { bytes, pagine } = await creaRegistroPdf(lib, {
    titolo: opz.titolo || 'COMPUTO METRICO ESTIMATIVO',
    intestazione,
    testataPagine: `${opz.titolo ? opz.titolo.charAt(0) + opz.titolo.slice(1).toLowerCase() : 'Computo metrico estimativo'}${dg.oggetto ? ' — ' + dg.oggetto : ''}`,
    colonne: [
      { chiave: 'n', etichetta: 'Num.Ord.', larghezza: 10, allinea: 'centro' },
      { chiave: 'tariffa', etichetta: 'TARIFFA', larghezza: 22 },
      { chiave: 'desc', etichetta: 'DESIGNAZIONE DEI LAVORI', larghezza: 52 },
      { chiave: 'pu', etichetta: 'par.ug.', larghezza: 11, allinea: 'destra', gruppo: 'DIMENSIONI' },
      { chiave: 'lu', etichetta: 'lung.', larghezza: 12, allinea: 'destra', gruppo: 'DIMENSIONI' },
      { chiave: 'la', etichetta: 'larg.', larghezza: 12, allinea: 'destra', gruppo: 'DIMENSIONI' },
      { chiave: 'hp', etichetta: 'H/peso', larghezza: 12, allinea: 'destra', gruppo: 'DIMENSIONI' },
      { chiave: 'qta', etichetta: 'Quantità', larghezza: 15, allinea: 'destra' },
      { chiave: 'unit', etichetta: 'unitario', larghezza: 14, allinea: 'destra', gruppo: 'IMPORTI' },
      { chiave: 'tot', etichetta: 'TOTALE', larghezza: 20, allinea: 'destra', gruppo: 'IMPORTI' },
    ],
    colonnaRiporto: 'tot',
    colonnaEtichetta: 'desc',
    piede: 'Quadra — computo metrico estimativo',
  }, righe)
  return { bytes, pagine, totale }
}

/**
 * Stampe di PROGETTO oltre al computo: elenco prezzi unitari, stima dei lavori,
 * quadro economico. Stesso motore «da registro» del computo (registro-pdf).
 */
import { creaRegistroPdf, fmtEuro, fmtNum, type RigaTabella } from './registro-pdf'
import type { VoceComputo } from '../xpwe/xpwe'
import { intestazioneStampa, type DatiGenerali } from '../dati-generali'
import { importoVoce } from './computo-pdf'
import { titoliGruppo, type ModoOrdine } from '../ordine-computo'
import type { RisultatoQE } from '../quadro-economico'
import { prezzoOfferto, valutaOfferte, type Offerta } from '../offerte'

const r2 = (n: number): number => { const x = Math.abs(n) * 100; return Math.sign(n) * Math.round(Number(x.toPrecision(15))) / 100 }
const oggi = (): string => new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })

// ── numeri in lettere (prezzi dell'elenco: «euro (dieci/41)») ────────────────
const UNITA = ['zero', 'uno', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove', 'dieci',
  'undici', 'dodici', 'tredici', 'quattordici', 'quindici', 'sedici', 'diciassette', 'diciotto', 'diciannove']
const DECINE = ['', '', 'venti', 'trenta', 'quaranta', 'cinquanta', 'sessanta', 'settanta', 'ottanta', 'novanta']

function sotto1000(n: number): string {
  if (n < 20) return UNITA[n]
  if (n < 100) {
    const d = Math.floor(n / 10), u = n % 10
    let s = DECINE[d]
    if (u === 1 || u === 8) s = s.slice(0, -1) // ventuno, trentotto
    return u ? s + UNITA[u] : s
  }
  const c = Math.floor(n / 100), resto = n % 100
  let s = c === 1 ? 'cento' : UNITA[c] + 'cento'
  if (resto && Math.floor(resto / 10) === 8) s = s.slice(0, -1) // centottanta
  return resto ? s + sotto1000(resto) : s
}

/** Intero in lettere, all'italiana (es. 1250 → «milleduecentocinquanta»). */
export function interoInLettere(n: number): string {
  n = Math.floor(Math.abs(n))
  if (n < 1000) return sotto1000(n)
  const parti: string[] = []
  const miliardi = Math.floor(n / 1e9), milioni = Math.floor((n % 1e9) / 1e6), migliaia = Math.floor((n % 1e6) / 1000), resto = n % 1000
  if (miliardi) parti.push(miliardi === 1 ? 'unmiliardo' : sotto1000(miliardi) + 'miliardi')
  if (milioni) parti.push(milioni === 1 ? 'unmilione' : sotto1000(milioni) + 'milioni')
  if (migliaia) parti.push(migliaia === 1 ? 'mille' : sotto1000(migliaia) + 'mila')
  if (resto) parti.push(sotto1000(resto))
  return parti.join('')
}

/** Prezzo in lettere come negli elenchi prezzi: 10,41 → «dieci/41». */
export function prezzoInLettere(p: number): string {
  const c = Math.round(Math.abs(p) * 100)
  return `${interoInLettere(Math.floor(c / 100))}/${String(c % 100).padStart(2, '0')}`
}

/** Voci distinte dell'elenco prezzi (una per codice), in ordine di codice (A.2 prima di A.10). */
export function vociElenco(voci: VoceComputo[]): VoceComputo[] {
  const m = new Map<string, VoceComputo>()
  for (const v of voci) if (!m.has(v.codice)) m.set(v.codice, v)
  return [...m.values()].sort((a, b) => (a.codice || '').localeCompare(b.codice || '', 'it', { numeric: true, sensitivity: 'base' }))
}

const qtaVoce = (v: VoceComputo): number =>
  v.misurazioni?.length ? r2(v.misurazioni.reduce((s, m) => s + (m.quantita || 0), 0)) : r2(v.qty ?? 0)

export interface OpzioniStampaProgetto {
  /** Descrizione: estesa (default) o ridotta. */
  descrizione?: 'estesa' | 'ridotta'
  /** Titolo del documento (es. «ELENCO DEI NUOVI PREZZI»); default «ELENCO PREZZI UNITARI». */
  titolo?: string
}

const testoVoce = (v: VoceComputo, o: OpzioniStampaProgetto): string =>
  ((o.descrizione === 'ridotta' ? (v.desc_short || v.declaratoria) : (v.declaratoria || v.desc_short)) || v.codice).trim()

/** ELENCO PREZZI UNITARI: tariffa, descrizione, unità di misura, prezzo in cifre e in lettere. */
export async function elencoPrezziPdf(lib: unknown, voci: VoceComputo[], dg: Partial<DatiGenerali> = {}, o: OpzioniStampaProgetto = {}): Promise<{ bytes: Uint8Array; pagine: number; n: number }> {
  const elenco = vociElenco(voci)
  const righe: RigaTabella[] = []
  elenco.forEach((v, i) => {
    const origine = v.np ? [v.codiceOrig ? `derivato dall'articolo ${v.codiceOrig}` : '', v.analisiPrezzi ? 'prezzo determinato con analisi' : ''].filter(Boolean).join('; ') : ''
    righe.push({ celle: { n: String(i + 1), tariffa: v.codice, desc: testoVoce(v, o) + (origine && o.titolo ? ` (${origine})` : '') + (v.sicurezza ? ' [oneri della sicurezza]' : '') }, legaASeguente: true })
    righe.push({
      celle: { desc: `euro (${prezzoInLettere(v.prezzo ?? 0)})`, um: v.um ?? '', prezzo: fmtNum(v.prezzo ?? 0) },
      corsivo: true, spazioDopo: 1.5,
    })
  })
  const { bytes, pagine } = await creaRegistroPdf(lib, {
    titolo: o.titolo || 'ELENCO PREZZI UNITARI',
    intestazione: intestazioneStampa(dg, dg.data || oggi()),
    testataPagine: `${o.titolo ? o.titolo.charAt(0) + o.titolo.slice(1).toLowerCase() : 'Elenco prezzi unitari'}${dg.oggetto ? ' — ' + dg.oggetto : ''}`,
    colonne: [
      { chiave: 'n', etichetta: 'Num.Ord.', larghezza: 12, allinea: 'centro' },
      { chiave: 'tariffa', etichetta: 'TARIFFA', larghezza: 26 },
      { chiave: 'desc', etichetta: 'DESIGNAZIONE DEI LAVORI', larghezza: 100 },
      { chiave: 'um', etichetta: 'unità di misura', larghezza: 18, allinea: 'centro' },
      { chiave: 'prezzo', etichetta: 'PREZZO unitario', larghezza: 24, allinea: 'destra' },
    ],
    colonnaRiporto: 'prezzo',
    colonnaEtichetta: 'desc',
    senzaRiporti: true,
    piede: 'Quadra — elenco prezzi unitari',
  }, righe)
  return { bytes, pagine, n: elenco.length }
}

/** Riepilogo della manodopera: importo dei lavori, costo della manodopera e incidenza %. */
export function calcolaIncidenzaMdo(voci: VoceComputo[]): { righe: { v: VoceComputo; importo: number; pct: number | null; mdo: number }[]; totale: number; mdo: number; incidenza: number; senzaDato: number } {
  const righe = voci.map((v) => {
    const importo = importoVoce(v)
    const pct = v.incMdo && v.incMdo > 0 ? v.incMdo : null
    return { v, importo, pct, mdo: pct ? r2(importo * pct / 100) : 0 }
  })
  const totale = r2(righe.reduce((s, x) => s + x.importo, 0))
  const mdo = r2(righe.reduce((s, x) => s + x.mdo, 0))
  return { righe, totale, mdo, incidenza: totale ? r2(mdo / totale * 100) : 0, senzaDato: righe.filter((x) => x.pct == null && x.importo).length }
}

export interface OpzioniIncidenzaMdo {
  /** Titoli dei gruppi come nel computo: per categorie (default), per WBS o nessuno. */
  raggruppa?: ModoOrdine
  /** Riepiloghi in fondo: per categorie, per WBS, entrambi (default) o nessuno. */
  riepilogo?: 'categorie' | 'wbs' | 'entrambi' | 'nessuno'
  /** Struttura WBS del progetto: codice → descrizione del nodo. */
  wbsNodi?: Record<string, string>
}

/**
 * Riepilogo della manodopera per gruppo (categorie o WBS): ogni livello del percorso
 * con importo dei lavori, costo della manodopera e incidenza; padri prima dei figli,
 * nell'ordine di prima comparsa.
 */
export function riepilogoMdo(voci: VoceComputo[], modo: 'categorie' | 'wbs', nodiWbs: Record<string, string> = {}): { titolo: string; livello: number; importo: number; mdo: number; incidenza: number }[] {
  const c = calcolaIncidenzaMdo(voci)
  const mappa = new Map<string, { titolo: string; livello: number; importo: number; mdo: number }>()
  for (const x of c.righe) {
    let p = titoliGruppo(modo, x.v.categoria, x.v.wbs, nodiWbs)
    if (!p.length) p = [modo === 'wbs' ? '(senza WBS)' : '(senza categoria)']
    p.forEach((t, lv) => {
      const k = p.slice(0, lv + 1).join('\u0001')
      const n = mappa.get(k) ?? { titolo: t, livello: lv, importo: 0, mdo: 0 }
      n.importo += x.importo; n.mdo += x.mdo
      mappa.set(k, n)
    })
  }
  // padre prima dei figli: ordina per chiave rispettando la prima comparsa di ogni ramo
  const chiavi = [...mappa.keys()]
  const primo = new Map(chiavi.map((k, i) => [k, i]))
  chiavi.sort((a, b) => {
    const pa = a.split('\u0001'), pb = b.split('\u0001')
    for (let i = 0; i < Math.min(pa.length, pb.length); i++) {
      if (pa[i] === pb[i]) continue
      const ka = pa.slice(0, i + 1).join('\u0001'), kb = pb.slice(0, i + 1).join('\u0001')
      return (primo.get(ka) ?? 0) - (primo.get(kb) ?? 0)
    }
    return pa.length - pb.length
  })
  return chiavi.map((k) => {
    const n = mappa.get(k)!
    return { ...n, importo: r2(n.importo), mdo: r2(n.mdo), incidenza: n.importo ? r2(n.mdo / n.importo * 100) : 0 }
  })
}

/**
 * STIMA DELL'INCIDENZA DELLA MANODOPERA: per ogni voce importo, % di manodopera (dal
 * prezzario o dall'analisi prezzi) e costo della manodopera, con i titoli dei gruppi
 * come nel computo; in fondo il totale, l'incidenza e i riepiloghi scelti.
 */
export async function incidenzaManodoperaPdf(lib: unknown, voci: VoceComputo[], dg: Partial<DatiGenerali> = {}, opz: OpzioniIncidenzaMdo = {}): Promise<{ bytes: Uint8Array; pagine: number; incidenza: number; mdo: number; senzaDato: number }> {
  const c = calcolaIncidenzaMdo(voci)
  const nodi = opz.wbsNodi ?? {}
  const righe: RigaTabella[] = []
  let prec: string[] = []
  c.righe.forEach((x, i) => {
    const tit = titoliGruppo(opz.raggruppa ?? 'categorie', x.v.categoria, x.v.wbs, nodi)
    tit.forEach((nome, lv) => {
      if (prec[lv] === nome && tit.slice(0, lv).join() === prec.slice(0, lv).join()) return
      righe.push({
        celle: { tariffa: nome.toUpperCase() }, unisci: { da: 'tariffa', a: 'desc' },
        grassetto: lv === 0, corsivo: lv > 0, evidenzia: lv === 0, legaASeguente: true, spazioDopo: 0.5,
      })
    })
    prec = tit
    righe.push({
      celle: {
        n: String(i + 1), tariffa: x.v.codice, desc: x.v.desc_short || x.v.declaratoria || '', um: x.v.um ?? '',
        qta: fmtNum(x.v.qty ?? 0), imp: fmtNum(x.importo), pct: x.pct != null ? fmtNum(x.pct) : '—', mdo: x.pct != null ? fmtNum(x.mdo) : '',
      },
      importo: x.mdo, maxRighe: 2, spazioDopo: 1,
    })
  })
  righe.push({ celle: { desc: 'TOTALE', imp: fmtEuro(c.totale), mdo: fmtEuro(c.mdo) }, grassetto: true, lineaSopra: true, evidenzia: true, legaASeguente: true })
  righe.push({ celle: { desc: 'INCIDENZA DELLA MANODOPERA SUI LAVORI', pct: fmtNum(c.incidenza) + ' %' }, grassetto: true, legaASeguente: c.senzaDato > 0, spazioDopo: c.senzaDato ? 0 : 4 })
  if (c.senzaDato) righe.push({ celle: { desc: `${c.senzaDato} voci senza percentuale di manodopera (—): non entrano nel costo della manodopera.` }, corsivo: true, spazioDopo: 4 })
  const quali = opz.riepilogo ?? 'entrambi'
  const riepiloghi: ['categorie' | 'wbs', string][] = []
  if (quali === 'categorie' || quali === 'entrambi') riepiloghi.push(['categorie', 'RIEPILOGO PER CATEGORIE'])
  if (quali === 'wbs' || quali === 'entrambi') riepiloghi.push(['wbs', 'RIEPILOGO PER WBS'])
  for (const [modo, titolo] of riepiloghi) {
    const r = riepilogoMdo(voci, modo, nodi)
    // un riepilogo fatto solo di «(senza …)» non dice niente
    if (!r.some((g) => !g.titolo.startsWith('(senza'))) continue
    righe.push({ celle: { tariffa: titolo }, unisci: { da: 'tariffa', a: 'desc' }, grassetto: true, evidenzia: true, legaASeguente: true })
    r.forEach((g, i) => righe.push({
      celle: { desc: '   '.repeat(g.livello) + g.titolo, imp: fmtNum(g.importo), pct: fmtNum(g.incidenza), mdo: fmtNum(g.mdo) },
      grassetto: g.livello === 0, corsivo: g.livello === 2, legaASeguente: i < r.length - 1,
    }))
    righe.push({ celle: { desc: 'Totale', imp: fmtEuro(c.totale), pct: fmtNum(c.incidenza), mdo: fmtEuro(c.mdo) }, grassetto: true, lineaSopra: true, spazioDopo: 4 })
  }
  const { bytes, pagine } = await creaRegistroPdf(lib, {
    titolo: 'STIMA DELL\'INCIDENZA DELLA MANODOPERA',
    intestazione: intestazioneStampa(dg, dg.data || oggi()),
    testataPagine: `Incidenza manodopera${dg.oggetto ? ' — ' + dg.oggetto : ''}`,
    colonne: [
      { chiave: 'n', etichetta: 'N.', larghezza: 9, allinea: 'centro' },
      { chiave: 'tariffa', etichetta: 'TARIFFA', larghezza: 22 },
      { chiave: 'desc', etichetta: 'DESIGNAZIONE DEI LAVORI', larghezza: 58 },
      { chiave: 'um', etichetta: 'U.M.', larghezza: 11, allinea: 'centro' },
      { chiave: 'qta', etichetta: 'Quantità', larghezza: 17, allinea: 'destra' },
      { chiave: 'imp', etichetta: 'Importo lavori', larghezza: 22, allinea: 'destra' },
      { chiave: 'pct', etichetta: '% MDO', larghezza: 14, allinea: 'destra', gruppo: 'MANODOPERA' },
      { chiave: 'mdo', etichetta: 'Importo', larghezza: 21, allinea: 'destra', gruppo: 'MANODOPERA' },
    ],
    colonnaRiporto: 'mdo',
    colonnaEtichetta: 'desc',
    piede: 'Quadra — incidenza manodopera',
  }, righe)
  return { bytes, pagine, incidenza: c.incidenza, mdo: c.mdo, senzaDato: c.senzaDato }
}

/**
 * VERBALE DI CONCORDAMENTO DEI NUOVI PREZZI: i soli NP, con codice d'origine, descrizione,
 * unità di misura e prezzo in cifre e in lettere; in chiusura la formula e le firme.
 */
export async function verbaleNuoviPrezziPdf(lib: unknown, voci: VoceComputo[], dg: Partial<DatiGenerali> = {}): Promise<{ bytes: Uint8Array; pagine: number; n: number }> {
  const elenco = vociElenco(voci)
  const righe: RigaTabella[] = [{
    celle: { desc: 'I sottoscritti Direttore dei Lavori e rappresentante dell\'Impresa, per l\'esecuzione di lavorazioni non previste nel contratto, concordano i nuovi prezzi seguenti, determinati come indicato per ciascuno. Ai nuovi prezzi si applica il ribasso contrattuale.' },
    corsivo: true, spazioDopo: 3,
  }]
  elenco.forEach((v, i) => {
    const origine = [v.codiceOrig ? `derivato dall'articolo ${v.codiceOrig} del prezzario` : '', v.analisiPrezzi ? 'prezzo determinato con analisi' : ''].filter(Boolean).join('; ')
    righe.push({ celle: { n: String(i + 1), tariffa: v.codice, desc: testoVoce(v, {}) + (origine ? ` (${origine})` : '') }, legaASeguente: true })
    righe.push({ celle: { desc: `euro (${prezzoInLettere(v.prezzo ?? 0)})`, um: v.um ?? '', prezzo: fmtNum(v.prezzo ?? 0) }, corsivo: true, spazioDopo: 1.5 })
  })
  righe.push({ celle: { desc: 'Letto, confermato e sottoscritto.' }, spazioDopo: 6 })
  righe.push({ celle: { desc: 'Il Direttore dei Lavori ______________________        L\'Impresa ______________________' }, spazioDopo: 6 })
  righe.push({ celle: { desc: 'Visto: il Responsabile Unico del Progetto ______________________' } })
  const { bytes, pagine } = await creaRegistroPdf(lib, {
    titolo: 'VERBALE DI CONCORDAMENTO DEI NUOVI PREZZI',
    intestazione: intestazioneStampa(dg, dg.data || oggi()),
    testataPagine: `Verbale nuovi prezzi${dg.oggetto ? ' — ' + dg.oggetto : ''}`,
    colonne: [
      { chiave: 'n', etichetta: 'Num.Ord.', larghezza: 12, allinea: 'centro' },
      { chiave: 'tariffa', etichetta: 'TARIFFA', larghezza: 26 },
      { chiave: 'desc', etichetta: 'DESIGNAZIONE DEI LAVORI', larghezza: 100 },
      { chiave: 'um', etichetta: 'unità di misura', larghezza: 18, allinea: 'centro' },
      { chiave: 'prezzo', etichetta: 'PREZZO unitario', larghezza: 24, allinea: 'destra' },
    ],
    colonnaRiporto: 'prezzo',
    colonnaEtichetta: 'desc',
    senzaRiporti: true,
    piede: 'Quadra — verbale nuovi prezzi',
  }, righe)
  return { bytes, pagine, n: elenco.length }
}

/** STIMA DEI LAVORI: una riga per voce con quantità totale, prezzo, importo e incidenza. */
export async function stimaLavoriPdf(lib: unknown, voci: VoceComputo[], dg: Partial<DatiGenerali> = {}, o: OpzioniStampaProgetto = {}): Promise<{ bytes: Uint8Array; pagine: number; totale: number }> {
  const totale = r2(voci.reduce((s, v) => s + importoVoce(v), 0))
  const sic = r2(voci.filter(v => v.sicurezza).reduce((s, v) => s + importoVoce(v), 0))
  const righe: RigaTabella[] = voci.map((v, i) => {
    const imp = importoVoce(v)
    return {
      celle: {
        n: String(i + 1), tariffa: v.codice, desc: (o.descrizione === 'estesa' ? testoVoce(v, o) : (v.desc_short || v.declaratoria || v.codice)),
        um: v.um ?? '', qta: fmtNum(qtaVoce(v)), unit: fmtNum(v.prezzo ?? 0), tot: fmtNum(imp),
        inc: totale ? fmtNum(imp / totale * 100, 2) : '',
      },
      importo: imp,
    }
  })
  righe.push({ celle: { desc: 'T O T A L E  euro', tot: fmtEuro(totale) }, grassetto: true, lineaSopra: true, spazioDopo: 3 })
  if (sic > 0) {
    righe.push({ celle: { desc: 'di cui oneri della sicurezza (non soggetti a ribasso)', tot: fmtEuro(sic) }, corsivo: true })
    righe.push({ celle: { desc: 'Lavori soggetti a ribasso', tot: fmtEuro(r2(totale - sic)) }, corsivo: true })
  }
  const { bytes, pagine } = await creaRegistroPdf(lib, {
    titolo: 'STIMA DEI LAVORI',
    intestazione: intestazioneStampa(dg, dg.data || oggi()),
    testataPagine: `Stima dei lavori${dg.oggetto ? ' — ' + dg.oggetto : ''}`,
    colonne: [
      { chiave: 'n', etichetta: 'N.', larghezza: 9, allinea: 'centro' },
      { chiave: 'tariffa', etichetta: 'TARIFFA', larghezza: 22 },
      { chiave: 'desc', etichetta: 'DESIGNAZIONE DEI LAVORI', larghezza: 66 },
      { chiave: 'um', etichetta: 'U.M.', larghezza: 11, allinea: 'centro' },
      { chiave: 'qta', etichetta: 'Quantità', larghezza: 17, allinea: 'destra' },
      { chiave: 'unit', etichetta: 'unitario', larghezza: 16, allinea: 'destra', gruppo: 'IMPORTI' },
      { chiave: 'tot', etichetta: 'TOTALE', larghezza: 20, allinea: 'destra', gruppo: 'IMPORTI' },
      { chiave: 'inc', etichetta: 'incid. %', larghezza: 12, allinea: 'destra' },
    ],
    colonnaRiporto: 'tot',
    colonnaEtichetta: 'desc',
    piede: 'Quadra — stima dei lavori',
  }, righe)
  return { bytes, pagine, totale }
}

/** QUADRO ECONOMICO: A) lavori, B) somme a disposizione, totale dell'intervento. */
export async function quadroEconomicoPdf(lib: unknown, qe: RisultatoQE, dg: Partial<DatiGenerali> = {}): Promise<{ bytes: Uint8Array; pagine: number }> {
  const righe: RigaTabella[] = [
    { celle: { cod: 'A', desc: 'LAVORI' }, grassetto: true, evidenzia: true, unisci: { da: 'cod', a: 'desc' }, legaASeguente: true },
    { celle: { cod: 'A1', desc: 'Lavori (soggetti a ribasso)', parz: fmtEuro(qe.a1) } },
    { celle: { cod: 'A2', desc: 'Oneri della sicurezza (non soggetti a ribasso)', parz: fmtEuro(qe.a2) } },
    { celle: { desc: 'Totale lavori (A)', tot: fmtEuro(qe.a) }, grassetto: true, lineaSopra: true, spazioDopo: 3 },
    { celle: { cod: 'B', desc: 'SOMME A DISPOSIZIONE DELLA STAZIONE APPALTANTE' }, grassetto: true, evidenzia: true, unisci: { da: 'cod', a: 'desc' }, legaASeguente: true },
    ...qe.righeB.map(r => ({
      celle: {
        cod: r.codice,
        desc: r.descrizione + (r.tipo === 'percentuale' ? ` (${fmtNum(r.valore, r.valore % 1 ? 2 : 0)}% di ${r.base || 'A'})` : ''),
        parz: fmtEuro(r.importo),
      },
    } as RigaTabella)),
    { celle: { desc: 'Totale somme a disposizione (B)', tot: fmtEuro(qe.b) }, grassetto: true, lineaSopra: true, spazioDopo: 3 },
    { celle: { desc: 'TOTALE COMPLESSIVO DELL\'INTERVENTO (A + B)', tot: fmtEuro(qe.totale) }, grassetto: true, lineaSopra: true, evidenzia: true },
  ]
  return creaRegistroPdf(lib, {
    titolo: 'QUADRO ECONOMICO',
    intestazione: intestazioneStampa(dg, dg.data || oggi()),
    testataPagine: `Quadro economico${dg.oggetto ? ' — ' + dg.oggetto : ''}`,
    colonne: [
      { chiave: 'cod', etichetta: '', larghezza: 14, allinea: 'centro' },
      { chiave: 'desc', etichetta: 'DESCRIZIONE', larghezza: 110 },
      { chiave: 'parz', etichetta: 'parziali', larghezza: 28, allinea: 'destra', gruppo: 'IMPORTI' },
      { chiave: 'tot', etichetta: 'totali', larghezza: 28, allinea: 'destra', gruppo: 'IMPORTI' },
    ],
    colonnaRiporto: 'tot',
    colonnaEtichetta: 'desc',
    senzaRiporti: true,
    corpo: 9,
    piede: 'Quadra — quadro economico',
  }, righe)
}

/**
 * LISTA DELLE LAVORAZIONI E FORNITURE per l'offerta a prezzi unitari: designazione, unità
 * di misura e quantità, con le colonne del prezzo (in cifre e in lettere) e dell'importo
 * lasciate VUOTE per il concorrente. Gli oneri della sicurezza non sono offerti: si
 * riportano a parte, fuori dal ribasso.
 */
export async function listaLavorazioniPdf(lib: unknown, voci: VoceComputo[], dg: Partial<DatiGenerali> = {}, o: OpzioniStampaProgetto & { destinatario?: string; scadenza?: string } = {}): Promise<{ bytes: Uint8Array; pagine: number; n: number }> {
  const lavori = voci.filter((v) => !v.sicurezza)
  const sic = r2(voci.filter((v) => v.sicurezza).reduce((x, v) => x + importoVoce(v), 0))
  const righe: RigaTabella[] = []
  if (o.destinatario || o.scadenza || o.titolo) {
    // richiesta di offerta: destinatario e termine in testa
    if (o.destinatario) righe.push({ celle: { desc: `Spett.le ${o.destinatario}` }, grassetto: true, legaASeguente: true })
    righe.push({ celle: { desc: `Si chiede di formulare l'offerta indicando i prezzi unitari delle lavorazioni e forniture seguenti${o.scadenza ? `, entro il ${o.scadenza}` : ''}.` }, corsivo: true, spazioDopo: 3 })
  }
  lavori.forEach((v, i) => righe.push({
    celle: { n: String(i + 1), tariffa: v.codice, desc: testoVoce(v, o), um: v.um ?? '', qta: fmtNum(qtaVoce(v)), cifre: '', lettere: '', tot: '' },
    spazioDopo: 1.5,
  }))
  righe.push({ celle: { desc: 'PREZZO COMPLESSIVO OFFERTO (in cifre)', tot: '' }, grassetto: true, lineaSopra: true, legaASeguente: true, spazioDopo: 3 })
  righe.push({ celle: { desc: 'PREZZO COMPLESSIVO OFFERTO (in lettere) ____________________________________________' }, grassetto: true, legaASeguente: true, spazioDopo: 3 })
  righe.push({ celle: { desc: 'RIBASSO PERCENTUALE sull\'importo a base di gara ________ %' }, grassetto: true, spazioDopo: 3 })
  if (sic) righe.push({ celle: { desc: `Oneri della sicurezza non soggetti a ribasso: euro ${fmtNum(sic)}, da aggiungere al prezzo offerto.` }, corsivo: true, spazioDopo: 4 })
  righe.push({ celle: { desc: 'Data ______________          Il concorrente (timbro e firma) ______________________________' } })
  const { bytes, pagine } = await creaRegistroPdf(lib, {
    titolo: o.titolo || 'LISTA DELLE LAVORAZIONI E FORNITURE',
    intestazione: intestazioneStampa(dg, dg.data || oggi()),
    testataPagine: `${o.titolo ? 'Richiesta di offerta' : 'Lista delle lavorazioni e forniture'}${dg.oggetto ? ' — ' + dg.oggetto : ''}`,
    colonne: [
      { chiave: 'n', etichetta: 'N.', larghezza: 9, allinea: 'centro' },
      { chiave: 'tariffa', etichetta: 'TARIFFA', larghezza: 20 },
      { chiave: 'desc', etichetta: 'DESIGNAZIONE DELLE LAVORAZIONI', larghezza: 66 },
      { chiave: 'um', etichetta: 'U.M.', larghezza: 10, allinea: 'centro' },
      { chiave: 'qta', etichetta: 'Quantità', larghezza: 16, allinea: 'destra' },
      { chiave: 'cifre', etichetta: 'in cifre', larghezza: 16, allinea: 'destra', gruppo: 'PREZZO UNITARIO OFFERTO' },
      { chiave: 'lettere', etichetta: 'in lettere', larghezza: 26, gruppo: 'PREZZO UNITARIO OFFERTO' },
      { chiave: 'tot', etichetta: 'IMPORTO', larghezza: 18, allinea: 'destra' },
    ],
    colonnaRiporto: 'tot',
    colonnaEtichetta: 'desc',
    senzaRiporti: true,
    piede: 'Quadra — lista delle lavorazioni e forniture',
  }, righe)
  return { bytes, pagine, n: lavori.length }
}

/**
 * STIMA DELL'INCIDENZA DELLA SICUREZZA: le voci degli oneri della sicurezza con il loro
 * importo, il totale e l'incidenza sull'importo complessivo dei lavori.
 */
export async function incidenzaSicurezzaPdf(lib: unknown, voci: VoceComputo[], dg: Partial<DatiGenerali> = {}, o: OpzioniStampaProgetto = {}): Promise<{ bytes: Uint8Array; pagine: number; sicurezza: number; incidenza: number; n: number }> {
  const totale = r2(voci.reduce((x, v) => x + importoVoce(v), 0))
  const sv = voci.filter((v) => v.sicurezza)
  const sic = r2(sv.reduce((x, v) => x + importoVoce(v), 0))
  const inc = totale ? r2(sic / totale * 100) : 0
  const righe: RigaTabella[] = sv.map((v, i) => {
    const imp = importoVoce(v)
    return {
      celle: { n: String(i + 1), tariffa: v.codice, desc: testoVoce(v, { descrizione: o.descrizione ?? 'ridotta' }), um: v.um ?? '', qta: fmtNum(qtaVoce(v)), unit: fmtNum(v.prezzo ?? 0), tot: fmtNum(imp) },
      importo: imp, maxRighe: 3, spazioDopo: 1,
    }
  })
  righe.push({ celle: { desc: 'TOTALE ONERI DELLA SICUREZZA (non soggetti a ribasso)', tot: fmtEuro(sic) }, grassetto: true, lineaSopra: true, evidenzia: true, legaASeguente: true })
  righe.push({ celle: { desc: 'Importo complessivo dei lavori', tot: fmtEuro(totale) }, legaASeguente: true })
  righe.push({ celle: { desc: 'Lavori soggetti a ribasso', tot: fmtEuro(r2(totale - sic)) }, legaASeguente: true })
  righe.push({ celle: { desc: 'INCIDENZA DELLA SICUREZZA SUI LAVORI', tot: fmtNum(inc) + ' %' }, grassetto: true })
  const { bytes, pagine } = await creaRegistroPdf(lib, {
    titolo: 'STIMA DELL\'INCIDENZA DELLA SICUREZZA',
    intestazione: intestazioneStampa(dg, dg.data || oggi()),
    testataPagine: `Incidenza della sicurezza${dg.oggetto ? ' — ' + dg.oggetto : ''}`,
    colonne: [
      { chiave: 'n', etichetta: 'N.', larghezza: 9, allinea: 'centro' },
      { chiave: 'tariffa', etichetta: 'TARIFFA', larghezza: 22 },
      { chiave: 'desc', etichetta: 'DESIGNAZIONE', larghezza: 70 },
      { chiave: 'um', etichetta: 'U.M.', larghezza: 11, allinea: 'centro' },
      { chiave: 'qta', etichetta: 'Quantità', larghezza: 17, allinea: 'destra' },
      { chiave: 'unit', etichetta: 'unitario', larghezza: 16, allinea: 'destra', gruppo: 'IMPORTI' },
      { chiave: 'tot', etichetta: 'TOTALE', larghezza: 22, allinea: 'destra', gruppo: 'IMPORTI' },
    ],
    colonnaRiporto: 'tot',
    colonnaEtichetta: 'desc',
    piede: 'Quadra — incidenza della sicurezza',
  }, righe)
  return { bytes, pagine, sicurezza: sic, incidenza: inc, n: sv.length }
}

/**
 * QUADRO COMPARATIVO DELLE OFFERTE: per ogni voce il prezzo di progetto e i prezzi
 * offerti; in fondo importo, ribasso risultante e graduatoria al minor prezzo.
 * Fino a 5 offerenti per stampa (le colonne devono restare leggibili).
 */
export async function quadroComparativoOffertePdf(lib: unknown, voci: VoceComputo[], offerte: Offerta[], dg: Partial<DatiGenerali> = {}): Promise<{ bytes: Uint8Array; pagine: number; migliore: string | null }> {
  const off = offerte.slice(0, 5)
  const esiti = valutaOfferte(off, voci)
  const soggette = voci.filter((v) => !v.sicurezza)
  const kOff = (i: number): string => 'o' + i
  const righe: RigaTabella[] = soggette.map((v, n) => {
    const celle: Record<string, string> = { n: String(n + 1), tariffa: v.codice, desc: v.desc_short || v.declaratoria || v.codice, um: v.um ?? '', qta: fmtNum(qtaVoce(v)), base: fmtNum(v.prezzo ?? 0) }
    off.forEach((o, i) => { const p = prezzoOfferto(o, v); celle[kOff(i)] = p == null ? '—' : fmtNum(p) })
    return { celle, maxRighe: 2, spazioDopo: 1 }
  })
  const base = esiti[0]?.base ?? 0
  const riga = (desc: string, f: (e: typeof esiti[number]) => string, extra: Partial<RigaTabella> = {}, b = ''): void => {
    const celle: Record<string, string> = { desc, base: b }
    esiti.forEach((e, i) => { celle[kOff(i)] = f(e) })
    righe.push({ celle, legaASeguente: true, ...extra })
  }
  riga('IMPORTO (voci soggette a ribasso)', (e) => e.mancanti.length ? 'incompleta' : fmtNum(e.importo), { grassetto: true, lineaSopra: true, evidenzia: true }, fmtNum(base))
  riga('Ribasso risultante %', (e) => e.ribasso == null ? '' : fmtNum(e.ribasso, 4))
  riga('Graduatoria (minor prezzo)', (e) => e.posizione == null ? '—' : `${e.posizione}°`, { grassetto: true, legaASeguente: false })
  const sic = r2(voci.filter((v) => v.sicurezza).reduce((x, v) => x + importoVoce(v), 0))
  if (sic) righe.push({ celle: { desc: `Oneri della sicurezza non soggetti a ribasso: euro ${fmtNum(sic)}, uguali per tutti gli offerenti.` }, corsivo: true })
  const migliore = esiti.find((e) => e.posizione === 1)?.offerta.nome ?? null
  if (migliore) righe.push({ celle: { desc: `Offerta di minor prezzo: ${migliore}.` }, grassetto: true })
  const largh = Math.floor(78 / Math.max(1, off.length))
  const { bytes, pagine } = await creaRegistroPdf(lib, {
    titolo: 'QUADRO COMPARATIVO DELLE OFFERTE',
    intestazione: intestazioneStampa(dg, dg.data || oggi()),
    testataPagine: `Quadro comparativo delle offerte${dg.oggetto ? ' — ' + dg.oggetto : ''}`,
    colonne: [
      { chiave: 'n', etichetta: 'N.', larghezza: 7, allinea: 'centro' },
      { chiave: 'tariffa', etichetta: 'TARIFFA', larghezza: 18 },
      { chiave: 'desc', etichetta: 'DESIGNAZIONE', larghezza: 52 },
      { chiave: 'um', etichetta: 'U.M.', larghezza: 9, allinea: 'centro' },
      { chiave: 'qta', etichetta: 'Quantità', larghezza: 15, allinea: 'destra' },
      { chiave: 'base', etichetta: 'progetto', larghezza: 16, allinea: 'destra', gruppo: 'PREZZO UNITARIO' },
      ...off.map((o, i) => ({ chiave: kOff(i), etichetta: o.nome.slice(0, 18), larghezza: largh, allinea: 'destra' as const, gruppo: 'PREZZI OFFERTI' })),
    ],
    colonnaRiporto: 'base',
    colonnaEtichetta: 'desc',
    senzaRiporti: true,
    piede: 'Quadra — quadro comparativo delle offerte',
  }, righe)
  return { bytes, pagine, migliore }
}

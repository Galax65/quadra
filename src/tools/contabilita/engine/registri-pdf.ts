/**
 * Contabilità — LIBRETTO DELLE MISURE e REGISTRO DI CONTABILITÀ in PDF «da registro»:
 * pagine numerate, riporto / a riportare sulla colonna degli importi, intestazione
 * ripetuta. Stesso motore delle stampe del computo (src/shared/stampa/registro-pdf).
 * Le versioni HTML (libretto.ts, registro.ts) restano per l'anteprima a schermo.
 */
import { creaRegistroPdf,  fmtEuro, fmtNum, type RigaTabella, type OpzioniRegistro } from '../../../shared/stampa/registro-pdf'
import type { Appalto, Partita, Perizia, Sal, RigaSal, ListaEconomia } from './types'
import { calcolaSals, round2, eseguitoPartita, importoContrattualePartita, voceSoppressaInSal, voceVisibileInSal } from './contabilita'
import { economiaATuttoSal } from './economia'
import { partiteVigenti, quadroComparativo } from './perizie'
import { TITOLO_SEZIONE, sezioneDi, SEZIONI } from './doc-common'
import { leggiPreferenzeStampa, limiteRighe } from '../../../shared/stampe/preferenze'

const fatt = (v: number | null | undefined): string => (v == null ? '' : fmtNum(v))

/**
 * Continuità di un atto che prosegue: da quale pagina riprende la numerazione e
 * se il frontespizio va omesso (libretto e registro successivi al primo SAL non
 * sono documenti nuovi, sono fogli dello stesso registro).
 */
export interface Continuita { paginaIniziale?: number; continua?: boolean }

function intestazione(a: Appalto, sal: Sal): string[] {
  return [
    a.ente?.denominazione || '',
    `OGGETTO: ${a.oggetto || '—'}`,
    [a.cup ? 'CUP ' + a.cup : '', a.cig ? 'CIG ' + a.cig : ''].filter(Boolean).join(' · '),
    `IMPRESA: ${a.impresa?.denominazione || '—'}`,
    `Stato di avanzamento n. ${sal.numero}${sal.data ? ' del ' + sal.data : ''}`,
  ].filter(Boolean)
}

const ETICHETTA_FATTORE: Record<'n' | 'l1' | 'l2' | 'h', string> = { n: 'par.ug.', l1: 'lung.', l2: 'larg.', h: 'H/peso' }
/** Descrizione della misura con le formule originali: «Pulizia *(par.ug.=12+250+65)». */
function descMisura(m: { descrizione?: string; formule?: Partial<Record<'n' | 'l1' | 'l2' | 'h', string>> }): string {
  const f = m.formule ? (Object.keys(m.formule) as ('n' | 'l1' | 'l2' | 'h')[]).filter((k) => m.formule![k]).map((k) => `${ETICHETTA_FATTORE[k]}=${m.formule![k]}`) : []
  return [m.descrizione || '', f.length ? `*(${f.join('; ')})` : ''].filter(Boolean).join(' ')
}

/** Righe d'intestazione di una voce: titolo + descrizione estesa accorciata (prime e ultime righe). */
function righeVoce(n: number, p: Partita, extra: Partial<RigaTabella['celle']> = {}, ultima = false): RigaTabella[] {
  const out: RigaTabella[] = [{ celle: { n: String(n), tariffa: p.codice, desc: p.descrizione, ...(ultima ? extra : {}) }, grassetto: true, legaASeguente: !ultima || !!p.declaratoria }]
  // quante righe di declaratoria: lo decidono le preferenze di stampa, le stesse
  // del computo — non un numero scritto qui dentro
  const lim = limiteRighe(leggiPreferenzeStampa())
  if (p.declaratoria && leggiPreferenzeStampa().descrizione !== 'ridotta') out.push({ celle: { desc: p.declaratoria, ...(ultima ? {} : {}) }, ...lim, legaASeguente: true })
  return out
}

const contabilizzata = (p: Partita, r: RigaSal | undefined, salN: number): boolean =>
  voceSoppressaInSal(p, salN) || !!(r?.misurazioni?.length || r?.quantitaProgressiva || r?.quotaPct != null)

/**
 * Righe del libretto delle misure al SAL `sal`: SOLO QUANTITÀ (i prezzi stanno nel
 * registro), per sezioni, con le formule delle misure. Ogni SOMMANO porta `ref` =
 * id della partita, così il registro può richiamare la pagina del libretto.
 */
export function righeLibretto(partite: Partita[], sal: Sal): RigaTabella[] {
  const rigaById = new Map(sal.righe.map((r) => [r.partitaId, r]))
  const out: RigaTabella[] = []
  let n = 0
  for (const sez of SEZIONI) {
    const voci = partite.filter((p) => sezioneDi(p) === sez && voceVisibileInSal(p, sal.numero) && contabilizzata(p, rigaById.get(p.id), sal.numero))
    if (!voci.length) continue
    out.push({ celle: { tariffa: TITOLO_SEZIONE[sez] }, grassetto: true, evidenzia: true, unisci: { da: 'n', a: 'desc' }, legaASeguente: true })
    for (const p of voci) {
      const r = rigaById.get(p.id)
      n++
      if (voceSoppressaInSal(p, sal.numero)) {
        out.push({ celle: { n: String(n), tariffa: p.codice, desc: `${p.descrizione} — voce soppressa al SAL n. ${p.soppressaSal} (storno)`, qta: fmtNum(0) }, corsivo: true, ref: p.id })
        continue
      }
      out.push(...righeVoce(n, p))
      // DATA del rilevamento: la colonna «TARIFFA / DATA» dei libretti dice quando
      // la misura è stata presa, non quando si chiude il SAL
      const dataMis = r?.dataMisura || sal.data
      if (dataMis) out.push({ celle: { tariffa: dataMis }, legaASeguente: true })
      if (p.modalita === 'corpo') {
        // il libretto è atto di sole quantità: del corpo d'opera si scrive la quota eseguita, non l'importo
        out.push({ celle: { desc: 'Quota eseguita del corpo d\'opera', qta: r?.quotaPct == null ? '' : fmtNum(r.quotaPct) + ' %' }, grassetto: true, lineaSopra: true, spazioDopo: 2, ref: p.id })
        continue
      }
      const misure = r?.misurazioni?.length ? r.misurazioni : null
      if (misure) {
        for (const m of misure) {
          out.push({ celle: { desc: descMisura(m), pu: fatt(m.n), lun: fatt(m.l1), lar: fatt(m.l2), h: fatt(m.h), qta: fmtNum(m.quantita) }, corsivo: (m.quantita || 0) < 0, legaASeguente: true })
        }
      }
      const qta = misure ? misure.reduce((s, m) => s + (m.quantita || 0), 0) : (r?.quantitaProgressiva ?? 0)
      out.push({ celle: { desc: `SOMMANO ${p.um || ''}`.trim(), qta: fmtNum(qta) }, grassetto: true, lineaSopra: true, spazioDopo: 2, ref: p.id })
    }
  }
  return out
}

/** LIBRETTO DELLE MISURE del SAL n, in PDF (solo quantità, come d'uso). */
export async function librettoPdf(lib: unknown, appalto: Appalto, partite: Partita[], sal: Sal, cont?: Continuita): Promise<{ bytes: Uint8Array; pagine: number; paginaDi: Record<string, number> }> {
  const pv = partiteVigenti(partite, appalto.perizie, sal.numero)
  return creaRegistroPdf(lib, {
    titolo: 'LIBRETTO DELLE MISURE',
    intestazione: intestazione(appalto, sal),
    paginaIniziale: cont?.paginaIniziale,
    senzaFrontespizio: cont?.continua,
    testataPagine: `Libretto delle misure — SAL n. ${sal.numero}${appalto.oggetto ? ' — ' + appalto.oggetto : ''}`,
    colonne: [
      { chiave: 'n', etichetta: 'N.', larghezza: 9, allinea: 'centro' },
      { chiave: 'tariffa', etichetta: 'TARIFFA / DATA', larghezza: 22 },
      { chiave: 'desc', etichetta: 'DESIGNAZIONE DEI LAVORI E DELLE MISURE', larghezza: 77 },
      { chiave: 'pu', etichetta: 'par.ug.', larghezza: 15, allinea: 'destra', gruppo: 'DIMENSIONI' },
      { chiave: 'lun', etichetta: 'lung.', larghezza: 14, allinea: 'destra', gruppo: 'DIMENSIONI' },
      { chiave: 'lar', etichetta: 'larg.', larghezza: 13, allinea: 'destra', gruppo: 'DIMENSIONI' },
      { chiave: 'h', etichetta: 'H/peso', larghezza: 13, allinea: 'destra', gruppo: 'DIMENSIONI' },
      { chiave: 'qta', etichetta: 'Quantità', larghezza: 19, allinea: 'destra' },
    ],
    colonnaRiporto: 'qta',
    colonnaEtichetta: 'desc',
    senzaRiporti: true,
    piede: `Quadra — libretto delle misure SAL n. ${sal.numero}`,
  }, righeLibretto(pv, sal))
}

/**
 * REGISTRO DI CONTABILITÀ **IN BIANCO**, da far numerare, bollare e vidimare
 * prima dell'inizio dei lavori (art. 2215 c.c.; art. 14 All. II.14).
 *
 * È il foglio che nessun programma stampa e che in cantiere serve davvero: il
 * registro è uno solo, a pagine numerate, e la numerazione va apposta prima,
 * non dopo. Qui esce con il frontespizio dell'appalto, la dichiarazione di
 * vidimazione da firmare e il numero di fogli richiesto, numerati e già
 * rigati: le partite si scriveranno sopra, man mano.
 */
export async function registroInBiancoPdf(lib: unknown, appalto: Appalto, fogli: number): Promise<{ bytes: Uint8Array; pagine: number; paginaDi: Record<string, number> }> {
  const n = Math.max(1, Math.min(500, Math.floor(fogli) || 1))
  const righe: RigaTabella[] = [
    { celle: { desc: 'Il presente registro di contabilità si compone di ' + fmtNum(n, 0) + ' fogli, numerati progressivamente, da bollare e vidimare prima dell\'inizio dei lavori.' }, unisci: { da: 'n', a: 'imp' }, corsivo: true },
    { celle: { desc: ' ' }, unisci: { da: 'n', a: 'imp' } },
    { celle: { desc: 'Il Direttore dei Lavori ______________________________        L\'esecutore ______________________________' }, unisci: { da: 'n', a: 'imp' } },
    { celle: { desc: ' ' }, unisci: { da: 'n', a: 'imp' } },
    { celle: { desc: 'Data ______________________' }, unisci: { da: 'n', a: 'imp' } },
  ]
  return creaRegistroPdf(lib, {
    titolo: 'REGISTRO DI CONTABILITÀ',
    intestazione: [
      `OGGETTO: ${appalto.oggetto || '—'}`,
      `IMPRESA: ${appalto.impresa?.denominazione || '—'}`,
      `STAZIONE APPALTANTE: ${appalto.ente?.denominazione || '—'}`,
      appalto.cup || appalto.cig ? `${appalto.cup ? 'CUP ' + appalto.cup : ''}${appalto.cup && appalto.cig ? ' · ' : ''}${appalto.cig ? 'CIG ' + appalto.cig : ''}` : '',
      'Fogli numerati e vidimati prima dell\'inizio dei lavori (art. 2215 c.c.; art. 14 Allegato II.14 D.Lgs. 36/2023)',
    ].filter(Boolean),
    testataPagine: `Registro di contabilità — ${appalto.oggetto || 'lavori'}`,
    colonne: [
      { chiave: 'n', etichetta: 'N.', larghezza: 8, allinea: 'centro' },
      { chiave: 'tariffa', etichetta: 'TARIFFA', larghezza: 22 },
      { chiave: 'desc', etichetta: 'DESIGNAZIONE DEI LAVORI', larghezza: 68 },
      { chiave: 'rif', etichetta: 'SAL/pag.', larghezza: 17, allinea: 'centro', gruppo: 'LIBRETTO' },
      { chiave: 'qta', etichetta: 'Quantità', larghezza: 18, allinea: 'destra' },
      { chiave: 'prezzo', etichetta: 'unitario', larghezza: 18, allinea: 'destra', gruppo: 'IMPORTI' },
      { chiave: 'imp', etichetta: 'TOTALE', larghezza: 25, allinea: 'destra', gruppo: 'IMPORTI' },
    ],
    colonnaRiporto: 'imp',
    colonnaEtichetta: 'desc',
    senzaRiporti: true,
    pagineVuoteMinime: n,
    piede: 'Registro di contabilità in bianco — da vidimare',
  }, righe)
}

/** REGISTRO DI CONTABILITÀ a tutto il SAL n, in PDF, con il riepilogo del credito. */
export async function registroPdf(lib: unknown, appalto: Appalto, partite: Partita[], sals: Sal[], salNumero: number, liste?: ListaEconomia[], cont?: Continuita): Promise<{ bytes: Uint8Array; pagine: number; paginaDi: Record<string, number> }> {
  const sal = sals.find((s) => s.numero === salNumero)
  if (!sal) throw new Error(`SAL n. ${salNumero} inesistente`)
  const res = calcolaSals(appalto, partite, sals.filter((s) => s.numero <= salNumero), liste).find((r) => r.numero === salNumero)!
  const pv = partiteVigenti(partite, appalto.perizie, salNumero)
  const rigaById = new Map(sal.righe.map((r) => [r.partitaId, r]))
  // pagina del libretto di ogni voce (richiamo «SAL / pag.» come d'uso nel registro)
  const pagLib = (await librettoPdf(lib, appalto, partite, sal)).paginaDi
  const righe: RigaTabella[] = []
  let n = 0
  for (const sez of SEZIONI) {
    const voci = pv.filter((p) => sezioneDi(p) === sez && voceVisibileInSal(p, salNumero) && contabilizzata(p, rigaById.get(p.id), salNumero))
    if (!voci.length) continue
    righe.push({ celle: { tariffa: TITOLO_SEZIONE[sez] }, grassetto: true, evidenzia: true, unisci: { da: 'n', a: 'desc' }, legaASeguente: true })
    let parziale = 0
    for (const p of voci) {
      const r = rigaById.get(p.id)
      const imp = eseguitoPartita(p, r, salNumero)
      parziale += imp
      n++
      const corpo = p.modalita === 'corpo'
      const qta = corpo ? (r?.quotaPct == null ? '' : fmtNum(r.quotaPct) + ' %')
        : fmtNum(r?.misurazioni?.length ? r.misurazioni.reduce((s, m) => s + (m.quantita || 0), 0) : (r?.quantitaProgressiva ?? 0))
      righe.push(...righeVoce(n, p))
      righe.push({
        celle: {
          desc: voceSoppressaInSal(p, salNumero) ? 'voce soppressa (storno)' : `SOMMANO ${corpo ? 'a corpo' : (p.um || '')}`.trim(),
          rif: pagLib[p.id] ? `${salNumero} / ${pagLib[p.id]}` : '',
          qta,
          prezzo: corpo ? fmtNum(importoContrattualePartita(p)) : (p.prezzoUnitario == null ? '' : fmtNum(p.prezzoUnitario)),
          imp: fmtNum(imp),
        },
        grassetto: true, importo: imp, spazioDopo: 1.5, ref: p.id,
      })
    }
    righe.push({ celle: { desc: `Parziale ${TITOLO_SEZIONE[sez].toLowerCase()}`, imp: fmtEuro(Math.round(parziale * 100) / 100) }, corsivo: true, lineaSopra: true, spazioDopo: 3 })
  }
  const economia = economiaATuttoSal(liste, salNumero)
  if (economia > 0) righe.push({ celle: { tariffa: '—', desc: 'Lavori in economia (liste settimanali)', imp: fmtNum(economia) }, importo: economia })
  // il riepilogo del credito resta tutto su una pagina (ogni riga legata alla seguente):
  // niente «a riportare» in mezzo alla cascata
  const kv = (desc: string, v: string, bold = false): RigaTabella => ({ celle: { desc, imp: v }, grassetto: bold, legaASeguente: true })
  // Totale del registro: il contabilizzato LORDO (lavori e oneri della sicurezza),
  // cioè la somma delle partite iscritte sopra. Poi la cascata del credito.
  righe.push({ celle: { desc: `TOTALE a tutto il SAL n. ${salNumero} (lavori, somministrazioni e oneri della sicurezza)`, imp: fmtEuro(round2(res.lavoriEseguiti + res.oneriSicurezzaEseguiti)) }, grassetto: true, lineaSopra: true, evidenzia: true, spazioDopo: 3, legaASeguente: true })
  righe.push({ celle: { desc: 'Lavori eseguiti a tutto il SAL', imp: fmtEuro(res.lavoriEseguiti) }, grassetto: true, spazioDopo: 2, legaASeguente: true })
  if (res.ribassoImporto) righe.push(kv(`a dedurre: ribasso d'asta ${fmtNum(res.ribassoPct)} %`, '− ' + fmtEuro(res.ribassoImporto)))
  righe.push(kv('Oneri della sicurezza (non soggetti a ribasso)', fmtEuro(res.oneriSicurezzaEseguiti)))
  if (res.revisioneProgressiva) righe.push(kv('Compensazione per revisione prezzi (art. 60)', fmtEuro(res.revisioneProgressiva)))
  if (res.detrazioni) righe.push(kv('a dedurre: detrazioni', '− ' + fmtEuro(res.detrazioni)))
  righe.push(kv('Totale contabilizzato', fmtEuro(res.totaleContabilizzato), true))
  righe.push(kv('a dedurre: ritenuta di garanzia 0,50%', '− ' + fmtEuro(res.ritenuta)))
  if (res.anticipazione) righe.push(kv('a dedurre: recupero dell\'anticipazione', '− ' + fmtEuro(res.recuperoAnticipazione)))
  righe.push(kv('Credito netto progressivo dell\'impresa', fmtEuro(res.nettoProgressivo), true))
  righe.push(kv('a dedurre: certificati precedenti', '− ' + fmtEuro(res.salPrecedenti)))
  if (res.creditoSal !== res.importoSal) righe.push(kv('Credito dell\'impresa', fmtEuro(res.creditoSal)))
  righe.push({ celle: { desc: res.creditoSal !== res.importoSal ? `IMPORTO DEL PRESENTE STATO DI AVANZAMENTO (arrotondato a ${fmtEuro(appalto.arrotondamentoCertificato ?? 0)})` : 'IMPORTO DEL PRESENTE STATO DI AVANZAMENTO', imp: fmtEuro(res.importoSal) }, grassetto: true, lineaSopra: true, evidenzia: true })
  return creaRegistroPdf(lib, {
    titolo: 'REGISTRO DI CONTABILITÀ',
    intestazione: intestazione(appalto, sal),
    paginaIniziale: cont?.paginaIniziale,
    senzaFrontespizio: cont?.continua,
    testataPagine: `Registro di contabilità — a tutto il SAL n. ${salNumero}${appalto.oggetto ? ' — ' + appalto.oggetto : ''}`,
    colonne: [
      { chiave: 'n', etichetta: 'N.', larghezza: 8, allinea: 'centro' },
      { chiave: 'tariffa', etichetta: 'TARIFFA', larghezza: 22 },
      { chiave: 'desc', etichetta: 'DESIGNAZIONE DEI LAVORI', larghezza: 68 },
      { chiave: 'rif', etichetta: 'SAL/pag.', larghezza: 17, allinea: 'centro', gruppo: 'LIBRETTO' },
      { chiave: 'qta', etichetta: 'Quantità', larghezza: 18, allinea: 'destra' },
      { chiave: 'prezzo', etichetta: 'unitario', larghezza: 18, allinea: 'destra', gruppo: 'IMPORTI' },
      { chiave: 'imp', etichetta: 'TOTALE', larghezza: 25, allinea: 'destra', gruppo: 'IMPORTI' },
    ],
    colonnaRiporto: 'imp',
    colonnaEtichetta: 'desc',
    piede: `Quadra — registro di contabilità SAL n. ${salNumero}`,
  }, righe)
}

/**
 * SOMMARIO DEL REGISTRO DI CONTABILITÀ a tutto il SAL n: per ogni voce le
 * annotazioni di ogni SAL (quantità e importo del SAL, con richiamo «SAL / pag. registro»)
 * e il SOMMANO progressivo; parziali per sezione e totale dei lavori.
 */
export async function sommarioPdf(lib: unknown, appalto: Appalto, partite: Partita[], sals: Sal[], salNumero: number, liste?: ListaEconomia[]): Promise<{ bytes: Uint8Array; pagine: number; paginaDi: Record<string, number> }> {
  const sal = sals.find((s) => s.numero === salNumero)
  if (!sal) throw new Error(`SAL n. ${salNumero} inesistente`)
  const fino = [...sals].filter((s) => s.numero <= salNumero).sort((a, b) => a.numero - b.numero)
  const res = calcolaSals(appalto, partite, fino, liste)
  // progressivo (quantità o quota %) ed eseguito di ogni voce a ogni SAL
  const prog = new Map<number, Map<string, { q: number; imp: number }>>()
  for (const r of res) prog.set(r.numero, new Map(r.righe.map((x) => [x.partita.id, { q: x.progressivo ?? 0, imp: x.eseguito }])))
  // pagina del registro di ogni voce in ogni SAL
  const pagReg = new Map<number, Record<string, number>>()
  for (const s of fino) pagReg.set(s.numero, (await registroPdf(lib, appalto, partite, sals, s.numero, liste)).paginaDi)
  const pv = partiteVigenti(partite, appalto.perizie, salNumero)
  const righe: RigaTabella[] = []
  let n = 0, totale = 0
  for (const sez of SEZIONI) {
    const voci = pv.filter((p) => sezioneDi(p) === sez && voceVisibileInSal(p, salNumero) && (prog.get(salNumero)?.get(p.id)?.imp || fino.some((s) => pagReg.get(s.numero)?.[p.id])))
    if (!voci.length) continue
    righe.push({ celle: { tariffa: TITOLO_SEZIONE[sez] }, grassetto: true, evidenzia: true, unisci: { da: 'n', a: 'desc' }, legaASeguente: true })
    let parziale = 0
    for (const p of voci) {
      n++
      const corpo = p.modalita === 'corpo'
      const fq = (q: number): string => (corpo ? fmtNum(q) + ' %' : fmtNum(q))
      righe.push(...righeVoce(n, p))
      let prima = { q: 0, imp: 0 }
      for (const s of fino) {
        const ora = prog.get(s.numero)?.get(p.id) ?? prima
        const pag = pagReg.get(s.numero)?.[p.id]
        if (pag && (Math.abs(ora.q - prima.q) > 0.0001 || Math.abs(ora.imp - prima.imp) > 0.004)) {
          righe.push({ celle: { rif: `${s.numero} / ${pag}`, qta: fq(round2(ora.q - prima.q)), imp: fmtNum(round2(ora.imp - prima.imp)) }, legaASeguente: true })
        }
        prima = ora
      }
      const fin = prog.get(salNumero)?.get(p.id) ?? { q: 0, imp: 0 }
      parziale += fin.imp
      righe.push({
        celle: { desc: `SOMMANO al S.A.L. n. ${salNumero} ${corpo ? 'a corpo' : (p.um || '')}`.trim(), qta: fq(fin.q), prezzo: corpo ? fmtNum(importoContrattualePartita(p)) : (p.prezzoUnitario == null ? '' : fmtNum(p.prezzoUnitario)), imp: fmtNum(fin.imp) },
        grassetto: true, lineaSopra: true, importo: fin.imp, spazioDopo: 2, ref: p.id,
      })
    }
    parziale = round2(parziale); totale += parziale
    righe.push({ celle: { desc: `Parziale ${TITOLO_SEZIONE[sez].toLowerCase()}`, imp: fmtEuro(parziale) }, corsivo: true, lineaSopra: true, spazioDopo: 3 })
  }
  righe.push({ celle: { desc: `TOTALE a tutto il S.A.L. n. ${salNumero} (lavori, somministrazioni e oneri della sicurezza)`, imp: fmtEuro(round2(totale)) }, grassetto: true, lineaSopra: true, evidenzia: true })
  return creaRegistroPdf(lib, {
    titolo: 'SOMMARIO DEL REGISTRO DI CONTABILITÀ',
    intestazione: intestazione(appalto, sal),
    testataPagine: `Sommario del registro — a tutto il SAL n. ${salNumero}${appalto.oggetto ? ' — ' + appalto.oggetto : ''}`,
    colonne: [
      { chiave: 'n', etichetta: 'N.', larghezza: 8, allinea: 'centro' },
      { chiave: 'tariffa', etichetta: 'TARIFFA', larghezza: 22 },
      { chiave: 'desc', etichetta: 'INDICAZIONE DEI LAVORI E DELLE SOMMINISTRAZIONI', larghezza: 68 },
      { chiave: 'rif', etichetta: 'SAL/pag.', larghezza: 17, allinea: 'centro', gruppo: 'REGISTRO' },
      { chiave: 'qta', etichetta: 'Quantità', larghezza: 18, allinea: 'destra' },
      { chiave: 'prezzo', etichetta: 'unitario', larghezza: 18, allinea: 'destra', gruppo: 'IMPORTI' },
      { chiave: 'imp', etichetta: 'TOTALE', larghezza: 25, allinea: 'destra', gruppo: 'IMPORTI' },
    ],
    colonnaRiporto: 'imp',
    colonnaEtichetta: 'desc',
    piede: `Quadra — sommario del registro SAL n. ${salNumero}`,
  }, righe)
}

/** QUADRO COMPARATIVO della perizia in PDF: contratto vigente / perizia / differenza, voce per voce. */
export async function quadroComparativoPdf(lib: unknown, appalto: Appalto, partite: Partita[], pz: Perizia): Promise<{ bytes: Uint8Array; pagine: number; paginaDi: Record<string, number> }> {
  const q = quadroComparativo(partite, appalto.perizie, pz)
  const segno = (n: number): string => (n > 0 ? '+ ' : n < 0 ? '− ' : '') + fmtNum(Math.abs(n))
  const righe: RigaTabella[] = []
  let n = 0
  for (const sez of SEZIONI) {
    const voci = q.righe.filter((r) => sezioneDi(r.partita) === sez)
    if (!voci.length) continue
    righe.push({ celle: { tariffa: TITOLO_SEZIONE[sez] }, grassetto: true, evidenzia: true, unisci: { da: 'n', a: 'desc' }, legaASeguente: true })
    let ap = 0, ad = 0
    for (const r of voci) {
      n++
      const p = r.partita
      const corpo = p.modalita === 'corpo'
      const valori = {
        um: corpo ? 'a corpo' : (p.um || ''),
        qp: r.qtyPrima == null ? '' : fmtNum(r.qtyPrima), qd: r.qtyDopo == null ? '' : fmtNum(r.qtyDopo),
        pu: corpo ? '' : (p.prezzoUnitario == null ? '' : fmtNum(p.prezzoUnitario)),
        ip: fmtNum(r.importoPrima), id: fmtNum(r.importoDopo), diff: r.differenza ? segno(r.differenza) : '',
      }
      ap += r.importoPrima; ad += r.importoDopo
      const variata = Math.abs(r.differenza) >= 0.005
      righe.push({ celle: { n: String(n), tariffa: p.codice, desc: p.descrizione, ...(p.declaratoria ? {} : valori) }, grassetto: variata, legaASeguente: !!p.declaratoria, spazioDopo: p.declaratoria ? 0 : 1.5 })
      const limS = limiteRighe(leggiPreferenzeStampa())
      if (p.declaratoria && leggiPreferenzeStampa().descrizione !== 'ridotta') righe.push({ celle: { desc: p.declaratoria, ...valori }, ...limS, grassetto: false, spazioDopo: 1.5 })
    }
    righe.push({ celle: { desc: `Parziale ${TITOLO_SEZIONE[sez].toLowerCase()}`, ip: fmtEuro(round2(ap)), id: fmtEuro(round2(ad)), diff: segno(round2(ad - ap)) }, corsivo: true, lineaSopra: true, spazioDopo: 3 })
  }
  const kv = (k: string, v: string, gr = false): RigaTabella => ({ celle: { desc: k, diff: v }, grassetto: gr })
  righe.push({ celle: { desc: 'TOTALE LAVORI', ip: fmtEuro(q.totalePrima), id: fmtEuro(q.totaleDopo), diff: segno(q.differenza) }, grassetto: true, lineaSopra: true, evidenzia: true, spazioDopo: 3 })
  righe.push(kv('Maggiori lavori', '+ ' + fmtEuro(q.aumenti)))
  righe.push(kv('Minori lavori', '− ' + fmtEuro(q.diminuzioni)))
  righe.push(kv(`Variazione netta della perizia${q.variazionePct != null ? ` (${fmtNum(q.variazionePct)} %)` : ''}`, segno(q.differenza), true))
  if (q.variazioneSuContrattoPct != null) righe.push(kv(`Variazione cumulata sul contratto originario: ${fmtNum(q.variazioneSuContrattoPct)} %${q.oltreQuinto ? ' — OLTRE IL QUINTO D\'OBBLIGO (art. 120 c.9)' : ''}`, ''))
  return creaRegistroPdf(lib, {
    titolo: `QUADRO COMPARATIVO — PERIZIA DI VARIANTE N. ${pz.numero}`,
    intestazione: [`OGGETTO: ${appalto.oggetto || '—'}`, `IMPRESA: ${appalto.impresa?.denominazione || '—'}`, `Perizia n. ${pz.numero}, in vigore dal SAL n. ${pz.dalSal}`],
    testataPagine: `Quadro comparativo perizia n. ${pz.numero}${appalto.oggetto ? ' — ' + appalto.oggetto : ''}`,
    colonne: [
      { chiave: 'n', etichetta: 'N.', larghezza: 7, allinea: 'centro' },
      { chiave: 'tariffa', etichetta: 'TARIFFA', larghezza: 19 },
      { chiave: 'desc', etichetta: 'DESIGNAZIONE DEI LAVORI', larghezza: 49 },
      { chiave: 'um', etichetta: 'U.M.', larghezza: 10, allinea: 'centro' },
      { chiave: 'qp', etichetta: 'contratto', larghezza: 15, allinea: 'destra', gruppo: 'QUANTITÀ' },
      { chiave: 'qd', etichetta: 'perizia', larghezza: 15, allinea: 'destra', gruppo: 'QUANTITÀ' },
      { chiave: 'pu', etichetta: 'prezzo', larghezza: 14, allinea: 'destra' },
      { chiave: 'ip', etichetta: 'contratto', larghezza: 16, allinea: 'destra', gruppo: 'IMPORTI' },
      { chiave: 'id', etichetta: 'perizia', larghezza: 16, allinea: 'destra', gruppo: 'IMPORTI' },
      { chiave: 'diff', etichetta: 'differenza', larghezza: 19, allinea: 'destra', gruppo: 'IMPORTI' },
    ],
    colonnaRiporto: 'diff',
    colonnaEtichetta: 'desc',
    senzaRiporti: true,
    corpo: 7,
    piede: `Quadra — quadro comparativo perizia n. ${pz.numero}`,
  }, righe)
}

/**
 * CONFRONTO QUANTITÀ PROGETTO / ESEGUITO a tutto il SAL n: per ogni voce la quantità
 * (o quota % a corpo) di contratto — perizie vigenti comprese — contro l'eseguito,
 * con la differenza in quantità e in importo. Serve prima di ogni SAL e per le perizie.
 */
export function righeConfronto(appalto: Appalto, partite: Partita[], sals: Sal[], salNumero: number, liste?: ListaEconomia[]): { righe: RigaTabella[]; contratto: number; eseguito: number } {
  const fino = [...sals].filter((s) => s.numero <= salNumero).sort((a, b) => a.numero - b.numero)
  const res = calcolaSals(appalto, partite, fino, liste, appalto.perizie)
  const ultimo = res.find((r) => r.numero === salNumero)
  const prog = new Map((ultimo?.righe ?? []).map((x) => [x.partita.id, x]))
  const pv = partiteVigenti(partite, appalto.perizie, salNumero)
  const righe: RigaTabella[] = []
  let n = 0, totC = 0, totE = 0
  for (const sez of SEZIONI) {
    const voci = pv.filter((p) => sezioneDi(p) === sez && voceVisibileInSal(p, salNumero))
    if (!voci.length) continue
    righe.push({ celle: { tariffa: TITOLO_SEZIONE[sez] }, grassetto: true, evidenzia: true, unisci: { da: 'n', a: 'desc' }, legaASeguente: true })
    for (const p of voci) {
      n++
      const corpo = p.modalita === 'corpo'
      const contr = importoContrattualePartita(p)
      const x = prog.get(p.id)
      const eseg = x?.eseguito ?? 0
      const qC = corpo ? 100 : (p.qtyProgetto ?? 0)
      const qE = x?.progressivo ?? 0
      const dq = round2(qE - qC)
      const pct = qC ? round2(qE / qC * 100) : null
      totC += contr; totE += eseg
      const fq = (q: number): string => (corpo ? fmtNum(q) + ' %' : fmtNum(q))
      righe.push({
        celle: {
          n: String(n), tariffa: p.codice, desc: p.descrizione, um: corpo ? 'a corpo' : (p.um || ''),
          qc: fq(qC), qe: fq(qE), dq: (dq > 0 ? '+' : '') + fq(dq), pct: pct == null ? '' : fmtNum(pct) + ' %',
          ic: fmtNum(contr), ie: fmtNum(eseg), di: (eseg - contr > 0 ? '+' : '') + fmtNum(round2(eseg - contr)),
        },
        maxRighe: 2, spazioDopo: 1, corsivo: voceSoppressaInSal(p, salNumero),
      })
    }
  }
  totC = round2(totC); totE = round2(totE)
  righe.push({ celle: { desc: 'TOTALI', ic: fmtEuro(totC), ie: fmtEuro(totE), di: fmtEuro(round2(totE - totC)), pct: totC ? fmtNum(round2(totE / totC * 100)) + ' %' : '' }, grassetto: true, lineaSopra: true, evidenzia: true })
  return { righe, contratto: totC, eseguito: totE }
}

export function confrontoProgettoEseguitoDoc(appalto: Appalto, partite: Partita[], sals: Sal[], salNumero: number, liste?: ListaEconomia[]): { opz: OpzioniRegistro; righe: RigaTabella[] } & { contratto: number; eseguito: number } {
  const sal = sals.find((s) => s.numero === salNumero)
  if (!sal) throw new Error(`SAL n. ${salNumero} inesistente`)
  const { righe, contratto, eseguito } = righeConfronto(appalto, partite, sals, salNumero, liste)
  const opz: OpzioniRegistro = {
    titolo: 'CONFRONTO QUANTITÀ DI PROGETTO / ESEGUITE',
    intestazione: intestazione(appalto, sal),
    testataPagine: `Confronto progetto / eseguito a tutto il SAL n. ${salNumero}${appalto.oggetto ? ' — ' + appalto.oggetto : ''}`,
    colonne: [
      { chiave: 'n', etichetta: 'N.', larghezza: 7, allinea: 'centro' },
      { chiave: 'tariffa', etichetta: 'TARIFFA', larghezza: 19 },
      { chiave: 'desc', etichetta: 'DESIGNAZIONE', larghezza: 46 },
      { chiave: 'um', etichetta: 'U.M.', larghezza: 10, allinea: 'centro' },
      { chiave: 'qc', etichetta: 'progetto', larghezza: 16, allinea: 'destra', gruppo: 'QUANTITÀ' },
      { chiave: 'qe', etichetta: 'eseguita', larghezza: 16, allinea: 'destra', gruppo: 'QUANTITÀ' },
      { chiave: 'dq', etichetta: 'differenza', larghezza: 16, allinea: 'destra', gruppo: 'QUANTITÀ' },
      { chiave: 'pct', etichetta: 'esec. %', larghezza: 13, allinea: 'destra' },
      { chiave: 'ic', etichetta: 'progetto', larghezza: 19, allinea: 'destra', gruppo: 'IMPORTI' },
      { chiave: 'ie', etichetta: 'eseguito', larghezza: 19, allinea: 'destra', gruppo: 'IMPORTI' },
      { chiave: 'di', etichetta: 'differenza', larghezza: 19, allinea: 'destra', gruppo: 'IMPORTI' },
    ],
    colonnaRiporto: 'ie',
    colonnaEtichetta: 'desc',
    senzaRiporti: true,
    piede: `Quadra — confronto progetto / eseguito SAL n. ${salNumero}`,
  }
  return { opz, righe, contratto, eseguito }
}

/**
 * STATO FINALE DEI LAVORI: le quantità finali di ogni voce, valorizzate, per sezioni,
 * con la cascata finale (ribasso, sicurezza, detrazioni) e i certificati già emessi;
 * il residuo è il credito dell'impresa per la rata di saldo.
 */
export function statoFinaleDoc(appalto: Appalto, partite: Partita[], sals: Sal[], liste?: ListaEconomia[]): { opz: OpzioniRegistro; righe: RigaTabella[] } & { residuo: number } {
  if (!sals.length) throw new Error('Nessun SAL: lo stato finale si fa sull\'ultimo stato di avanzamento')
  const ordinati = [...sals].sort((a, b) => a.numero - b.numero)
  const ultimo = ordinati[ordinati.length - 1]
  const res = calcolaSals(appalto, partite, ordinati, liste, appalto.perizie)
  const fin = res[res.length - 1]
  const prog = new Map(fin.righe.map((x) => [x.partita.id, x]))
  const pv = partiteVigenti(partite, appalto.perizie, ultimo.numero)
  const righe: RigaTabella[] = []
  let n = 0
  for (const sez of SEZIONI) {
    const voci = pv.filter((p) => sezioneDi(p) === sez && voceVisibileInSal(p, ultimo.numero) && (prog.get(p.id)?.eseguito || voceSoppressaInSal(p, ultimo.numero)))
    if (!voci.length) continue
    righe.push({ celle: { tariffa: TITOLO_SEZIONE[sez] }, grassetto: true, evidenzia: true, unisci: { da: 'n', a: 'desc' }, legaASeguente: true })
    let parz = 0
    for (const p of voci) {
      n++
      const corpo = p.modalita === 'corpo'
      const x = prog.get(p.id)
      const q = x?.progressivo ?? 0
      parz += x?.eseguito ?? 0
      righe.push({
        celle: {
          n: String(n), tariffa: p.codice, desc: p.descrizione, um: corpo ? 'a corpo' : (p.um || ''),
          qta: corpo ? fmtNum(q) + ' %' : fmtNum(q),
          prezzo: corpo ? fmtNum(importoContrattualePartita(p)) : (p.prezzoUnitario == null ? '' : fmtNum(p.prezzoUnitario)),
          imp: fmtNum(x?.eseguito ?? 0),
        },
        importo: x?.eseguito ?? 0, maxRighe: 2, spazioDopo: 1,
      })
    }
    righe.push({ celle: { desc: `Parziale ${TITOLO_SEZIONE[sez].toLowerCase()}`, imp: fmtEuro(round2(parz)) }, corsivo: true, lineaSopra: true, spazioDopo: 3 })
  }
  const lega = { legaASeguente: true }
  righe.push({ celle: { desc: 'RIEPILOGO FINALE' }, grassetto: true, evidenzia: true, ...lega })
  righe.push({ celle: { desc: 'Lavori a misura', imp: fmtEuro(fin.lavoriMisura) }, ...lega })
  if (fin.lavoriCorpo) righe.push({ celle: { desc: 'Lavori a corpo', imp: fmtEuro(fin.lavoriCorpo) }, ...lega })
  if (fin.lavoriEconomia) righe.push({ celle: { desc: 'Lavori in economia', imp: fmtEuro(fin.lavoriEconomia) }, ...lega })
  if (fin.ribassoImporto) righe.push({ celle: { desc: `a dedurre ribasso d'asta del ${fmtNum(fin.ribassoPct, 4)} %`, imp: '−' + fmtEuro(fin.ribassoImporto) }, ...lega })
  if (fin.oneriSicurezzaEseguiti) righe.push({ celle: { desc: 'Oneri della sicurezza (non soggetti a ribasso)', imp: fmtEuro(fin.oneriSicurezzaEseguiti) }, ...lega })
  if (fin.detrazioni) righe.push({ celle: { desc: 'a dedurre detrazioni', imp: '−' + fmtEuro(fin.detrazioni) }, ...lega })
  righe.push({ celle: { desc: 'IMPORTO FINALE DEI LAVORI', imp: fmtEuro(fin.totaleContabilizzato) }, grassetto: true, lineaSopra: true, ...lega })
  let pagato = 0
  for (const r of res.slice(0, -1)) {
    pagato += r.importoSal
    righe.push({ celle: { desc: `a dedurre certificato di pagamento n. ${r.numero}${r.data ? ' del ' + r.data : ''}`, imp: '−' + fmtEuro(r.importoSal) }, ...lega })
  }
  const residuo = round2(fin.nettoProgressivo - pagato)
  righe.push({ celle: { desc: 'CREDITO RESIDUO DELL\'IMPRESA (netto, rata di saldo)', imp: fmtEuro(residuo) }, grassetto: true, lineaSopra: true, evidenzia: true })
  const opz: OpzioniRegistro = {
    titolo: 'STATO FINALE DEI LAVORI',
    intestazione: intestazione(appalto, ultimo).slice(0, -1).concat(`Stato finale (ultimo SAL n. ${ultimo.numero}${ultimo.data ? ' del ' + ultimo.data : ''})`),
    testataPagine: `Stato finale dei lavori${appalto.oggetto ? ' — ' + appalto.oggetto : ''}`,
    colonne: [
      { chiave: 'n', etichetta: 'N.', larghezza: 8, allinea: 'centro' },
      { chiave: 'tariffa', etichetta: 'TARIFFA', larghezza: 22 },
      { chiave: 'desc', etichetta: 'DESIGNAZIONE DEI LAVORI', larghezza: 74 },
      { chiave: 'um', etichetta: 'U.M.', larghezza: 12, allinea: 'centro' },
      { chiave: 'qta', etichetta: 'Quantità', larghezza: 19, allinea: 'destra' },
      { chiave: 'prezzo', etichetta: 'unitario', larghezza: 19, allinea: 'destra', gruppo: 'IMPORTI' },
      { chiave: 'imp', etichetta: 'TOTALE', larghezza: 26, allinea: 'destra', gruppo: 'IMPORTI' },
    ],
    colonnaRiporto: 'imp',
    colonnaEtichetta: 'desc',
    piede: 'Quadra — stato finale dei lavori',
  }
  return { opz, righe, residuo }
}

/**
 * REPORT DELLA SITUAZIONE CONTABILE (una pagina): contratto, eseguito a tutto l'ultimo
 * SAL, certificati emessi, ritenute, anticipazione, residuo da eseguire e da pagare.
 */
export function situazioneContabileDoc(appalto: Appalto, partite: Partita[], sals: Sal[], liste?: ListaEconomia[]): { opz: OpzioniRegistro; righe: RigaTabella[] } & {} {
  const ordinati = [...sals].sort((a, b) => a.numero - b.numero)
  const res = calcolaSals(appalto, partite, ordinati, liste, appalto.perizie)
  const fin = res[res.length - 1]
  const contr = round2(partiteVigenti(partite, appalto.perizie, fin?.numero ?? 1).reduce((x, p) => x + importoContrattualePartita(p), 0))
  const righe: RigaTabella[] = []
  const r = (desc: string, imp: string, extra: Partial<RigaTabella> = {}): void => { righe.push({ celle: { desc, imp }, legaASeguente: true, ...extra }) }
  r('CONTRATTO', '', { grassetto: true, evidenzia: true })
  r('Importo dei lavori di contratto (perizie comprese, al lordo del ribasso)', fmtEuro(contr))
  if (appalto.oneriSicurezza) r('Oneri della sicurezza a parte', fmtEuro(appalto.oneriSicurezza))
  r(`Ribasso d'asta`, fin ? fmtNum(fin.ribassoPct, 4) + ' %' : '')
  if (fin) {
    r(`AVANZAMENTO a tutto il SAL n. ${fin.numero}${fin.data ? ' del ' + fin.data : ''}`, '', { grassetto: true, evidenzia: true })
    r('Lavori eseguiti (lordi)', fmtEuro(fin.lavoriEseguiti))
    r('Avanzamento sui lavori di contratto', contr ? fmtNum(round2(fin.lavoriEseguiti / contr * 100)) + ' %' : '')
    r('Totale contabilizzato (netto ribasso, sicurezza, detrazioni)', fmtEuro(fin.totaleContabilizzato))
    r('Ritenuta di garanzia 0,5 %', fmtEuro(fin.ritenuta))
    if (fin.anticipazione) r('Anticipazione erogata / recuperata', `${fmtEuro(fin.anticipazione)} / ${fmtEuro(fin.recuperoAnticipazione)}`)
    r('CERTIFICATI DI PAGAMENTO', '', { grassetto: true, evidenzia: true })
    let pag = 0
    for (const x of res) { pag += x.importoSal; r(`Certificato n. ${x.numero}${x.data ? ' del ' + x.data : ''}`, fmtEuro(x.importoSal)) }
    r('Totale certificato (netto, IVA esclusa)', fmtEuro(round2(pag)), { grassetto: true, lineaSopra: true })
    r('RESIDUI', '', { grassetto: true, evidenzia: true })
    r('Lavori ancora da eseguire (lordi)', fmtEuro(round2(Math.max(0, contr - fin.lavoriEseguiti))))
    r('Ritenute da svincolare a collaudo', fmtEuro(fin.ritenuta), { legaASeguente: false })
  } else r('Nessuno stato di avanzamento registrato', '', { legaASeguente: false })
  const sal0 = ordinati[ordinati.length - 1] ?? { numero: 0, righe: [] }
  const opz: OpzioniRegistro = {
    titolo: 'SITUAZIONE CONTABILE DELL\'APPALTO',
    intestazione: intestazione(appalto, sal0 as Sal).slice(0, -1).concat(`Situazione al ${new Date().toLocaleDateString('it-IT')}`),
    testataPagine: `Situazione contabile${appalto.oggetto ? ' — ' + appalto.oggetto : ''}`,
    colonne: [
      { chiave: 'desc', etichetta: 'VOCE', larghezza: 140 },
      { chiave: 'imp', etichetta: 'IMPORTO', larghezza: 40, allinea: 'destra' },
    ],
    colonnaRiporto: 'imp',
    colonnaEtichetta: 'desc',
    senzaRiporti: true,
    piede: 'Quadra — situazione contabile',
  }
  return { opz, righe }
}

export async function confrontoProgettoEseguitoPdf(lib: unknown, appalto: Appalto, partite: Partita[], sals: Sal[], salNumero: number, liste?: ListaEconomia[]): Promise<{ bytes: Uint8Array; pagine: number } & { contratto: number; eseguito: number }> {
  const d = confrontoProgettoEseguitoDoc(appalto, partite, sals, salNumero, liste)
  const { bytes, pagine } = await creaRegistroPdf(lib, d.opz, d.righe)
  return { bytes, pagine, contratto: d.contratto, eseguito: d.eseguito }
}

export async function statoFinalePdf(lib: unknown, appalto: Appalto, partite: Partita[], sals: Sal[], liste?: ListaEconomia[]): Promise<{ bytes: Uint8Array; pagine: number } & { residuo: number }> {
  const d = statoFinaleDoc(appalto, partite, sals, liste)
  const { bytes, pagine } = await creaRegistroPdf(lib, d.opz, d.righe)
  return { bytes, pagine, residuo: d.residuo }
}

export async function situazioneContabilePdf(lib: unknown, appalto: Appalto, partite: Partita[], sals: Sal[], liste?: ListaEconomia[]): Promise<{ bytes: Uint8Array; pagine: number } & {}> {
  const d = situazioneContabileDoc(appalto, partite, sals, liste)
  const { bytes, pagine } = await creaRegistroPdf(lib, d.opz, d.righe)
  return { bytes, pagine }
}

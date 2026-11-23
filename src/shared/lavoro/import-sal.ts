/**
 * L'IMPORT DI UNA CONTABILITÀ XPWE NEI SAL — per un lavoro già avviato in
 * un altro programma che esporta le misure datate.
 *
 * Ogni misura del file ha una data (DataMis). Le date vicine (entro `giorni`)
 * vanno nello stesso SAL; si apre un SAL nuovo quando ne passano di più. Ogni
 * misura si abbina a una voce del contratto vigente con lo stesso codice e lo
 * stesso prezzo (prima quella della stessa categoria) e si AGGIUNGE alle sue
 * misure a tutto il SAL: i SAL successivi ripartono dal precedente, quindi le
 * misure restano progressive come nel libretto.
 *
 * Il primo gruppo va nel SAL in bozza, se c'è; gli altri SAL si emettono con
 * la data della loro ultima misura, e l'ultimo resta in bozza per controllarlo.
 *
 * Quello che il contratto non ha NON si inventa: si elenca come scartato (è
 * materia di una perizia, con i suoi nuovi prezzi). I lavori a corpo si
 * contabilizzano a quota %, che il file non dice: anche loro si elencano.
 */
import { sommaMisurazioni, type MisurazioneRiga } from '../compositore/misurazioni'
import { importoQta } from '../importo'
import {
  avanzamento, emetti, modificaRigaAvanzamento, nuovoSal, revisione, rigaDi, vigente, quantitaEseguita, prezzoIn, contratto, voceNelContrattoLibero,
  type Avanzamento, type Lavoro, type Revisione, type Voce,
} from './modello'

/** Una misura datata del file: la forma che dà xpweToVoci. */
export interface MisuraDatata {
  codice: string
  prezzo?: number | null
  um?: string
  desc_short?: string
  declaratoria?: string
  sicurezza?: boolean
  categoria?: string
  dataMis?: string
  misurazioni?: MisurazioneRiga[]
  qty?: number | null
}

/** «gg/mm/aaaa» → giorni dal 1970, per ordinare e misurare le distanze. */
export function giornoDi(dataIt: string | undefined): number | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((dataIt || '').trim())
  return m ? Math.floor(Date.UTC(+m[3], +m[2] - 1, +m[1]) / 86_400_000) : null
}

export interface GruppoSal { date: string[]; misure: number }

/** Le date del file raggruppate in SAL: un SAL nuovo quando fra due date passano più di `giorni`. */
export function proponiGruppi(misure: MisuraDatata[], giorni = 30): GruppoSal[] {
  const date = [...new Set(misure.map((m) => m.dataMis).filter((d): d is string => giornoDi(d) != null))]
    .sort((a, b) => giornoDi(a)! - giornoDi(b)!)
  const gruppi: GruppoSal[] = []
  let prec: number | null = null
  for (const d of date) {
    const g = giornoDi(d)!
    if (prec == null || g - prec > giorni) gruppi.push({ date: [], misure: 0 })
    gruppi[gruppi.length - 1].date.push(d)
    prec = g
  }
  const conta = new Map<string, number>()
  for (const m of misure) if (m.dataMis) conta.set(m.dataMis, (conta.get(m.dataMis) || 0) + 1)
  for (const g of gruppi) g.misure = g.date.reduce((t, d) => t + (conta.get(d) || 0), 0)
  // le misure senza data vanno nel primo SAL
  const senza = misure.filter((m) => giornoDi(m.dataMis) == null).length
  if (senza) { if (!gruppi.length) gruppi.push({ date: [], misure: 0 }); gruppi[0].misure += senza }
  return gruppi
}

/** La voce di contratto a cui va una misura: stesso codice e prezzo, prima la stessa categoria. */
export function abbinaVoce(r: Revisione, m: MisuraDatata): Voce | undefined {
  const cod = (m.codice || '').trim()
  if (!cod) return undefined
  const art = new Set(r.articoli
    .filter((a) => a.codice.trim() === cod && (m.prezzo == null || a.prezzo == null || Math.abs(a.prezzo - m.prezzo) < 0.005))
    .map((a) => a.id))
  const candidate = r.voci.filter((v) => art.has(v.articolo))
  return candidate.find((v) => (v.categoria || '') === (m.categoria || '')) ?? candidate[0]
}

export interface EsitoImportSal {
  lavoro: Lavoro
  /** I SAL toccati, in ordine (id). */
  sal: string[]
  abbinate: number
  /** Misure prima della data «dal»: già contabilizzate, saltate. */
  saltate: number
  /** Quello che il contratto non ha (o è a corpo): elencato, non importato. */
  scartate: { codice: string; descrizione: string; motivo: string }[]
}

/** Le righe di misura di una misura del file (una quantità sola diventa una riga). */
function righeDi(m: MisuraDatata): MisurazioneRiga[] {
  const con = (r: MisurazioneRiga): MisurazioneRiga => ({ ...r, descrizione: r.descrizione || m.dataMis || '' })
  if (m.misurazioni && m.misurazioni.length) return m.misurazioni.map(con)
  return [{ descrizione: m.dataMis || 'da XPWE', quantita: m.qty ?? 0 }]
}

/**
 * Importa le misure nei SAL. `dal`: le misure con data precedente si saltano
 * (sono già nei SAL emessi). Errori chiari se manca il contratto o se dopo il
 * SAL finale non si può più.
 */
export function importaMisureSal(l0: Lavoro, misure: MisuraDatata[], o: { giorni?: number; dal?: string } = {}): EsitoImportSal {
  if (!vigente(l0)) throw new Error('Prima si stipula il contratto: le misure si abbinano alle sue voci')
  if (l0.avanzamenti.some((a) => a.tipo !== 'sal')) throw new Error('Dopo il SAL finale non si importano altri SAL')
  const dal = giornoDi(o.dal)
  const prese = misure.filter((m) => dal == null || giornoDi(m.dataMis) == null || giornoDi(m.dataMis)! >= dal)
  const saltate = misure.length - prese.length
  const gruppi = proponiGruppi(prese, o.giorni ?? 30)
  const gruppoDi = new Map<string, number>()
  gruppi.forEach((g, i) => g.date.forEach((d) => gruppoDi.set(d, i)))
  const perGruppo = gruppi.map(() => [] as MisuraDatata[])
  for (const m of prese) perGruppo[m.dataMis && gruppoDi.has(m.dataMis) ? gruppoDi.get(m.dataMis)! : 0]?.push(m)

  let l = l0
  const sal: string[] = []
  const scartate: EsitoImportSal['scartate'] = []
  let abbinate = 0
  const ultimo = (): Avanzamento | undefined => [...l.avanzamenti].sort((a, b) => a.ordine - b.ordine).pop()
  const oggiDi = (g: GruppoSal): string => g.date[g.date.length - 1] || new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })

  gruppi.forEach((g, i) => {
    if (!perGruppo[i].length) return
    // il SAL di questo gruppo: quello in bozza, o uno nuovo dopo aver emesso il precedente
    let a = ultimo()
    if (a && a.stato === 'bozza' && i > 0 && sal.includes(a.id)) { l = emetti(l, a.id, a.data); a = ultimo() }
    if (!a || a.stato === 'emesso') { const s = nuovoSal(l, oggiDi(g)); l = s.lavoro; a = avanzamento(l, s.id) }
    else if (!sal.includes(a.id)) {
      // il SAL in bozza che c'era prende la data dell'ultima misura che riceve
      l = { ...l, avanzamenti: l.avanzamenti.map((x) => (x.id === a!.id ? { ...x, data: oggiDi(g) } : x)) }
    }
    sal.push(a.id)
    const aggiunte = new Map<string, MisurazioneRiga[]>()
    const libero = !!contratto(l)?.contratto?.libero
    for (const m of perGruppo[i]) {
      let v = abbinaVoce(revisione(l, a.leggeDa), m)
      const descrizione = (m.desc_short || '').trim()
      // senza computo, l'articolo misurato entra nel contratto (dall'elenco prezzi del file)
      if (!v && libero && m.codice) {
        const x = voceNelContrattoLibero(l, a.id, {
          codice: m.codice, descrizione: descrizione || m.codice, ...(m.declaratoria && m.declaratoria !== descrizione ? { estesa: m.declaratoria } : {}),
          um: m.um || '', prezzo: m.prezzo ?? null, origine: 'prezzario', ...(m.sicurezza ? { sicurezza: true } : {}),
        }, { ...(m.categoria ? { categoria: m.categoria } : {}) })
        l = x.lavoro
        v = revisione(l, a.leggeDa).voci.find((y) => y.id === x.voce)
      }
      if (!v) { scartate.push({ codice: m.codice, descrizione, motivo: 'non è nel contratto' }); continue }
      if (v.corpo) { scartate.push({ codice: m.codice, descrizione, motivo: 'lavoro a corpo: si contabilizza a quota %' }); continue }
      aggiunte.set(v.id, [...(aggiunte.get(v.id) || []), ...righeDi(m)])
      abbinate++
    }
    for (const [voceId, nuove] of aggiunte) {
      const riga = rigaDi(avanzamento(l, a.id), voceId)
      // una quantità scritta a mano diventa la prima riga, per non perderla
      const base: MisurazioneRiga[] = !riga.misure.length && riga.quantita ? [{ descrizione: 'quantità precedente', quantita: riga.quantita }] : []
      l = modificaRigaAvanzamento(l, a.id, voceId, { misure: [...base, ...riga.misure, ...nuove], quantita: undefined })
    }
  })
  return { lavoro: l, sal, abbinate, saltate, scartate }
}

/* ── Il confronto con un XPWE (e lo stato finale dal file) ─────────────────
   Per verificare i totali: le misure del file, sommate per voce del contratto
   (tutte le date: il file è la contabilità a tutto il SAL), accanto a quelle
   dell'avanzamento in Quadra. Non cambia niente. */

export interface RigaConfronto {
  voce: string
  codice: string
  descrizione: string
  um: string
  quadra: number
  file: number
  importoQuadra: number
  importoFile: number
}

export interface Confronto {
  righe: RigaConfronto[]
  /** Solo le righe che differiscono (quantità oltre il centesimo). */
  diverse: RigaConfronto[]
  lordoQuadra: number
  lordoFile: number
  scartate: EsitoImportSal['scartate']
}

const r2 = (n: number): number => Math.round(n * 100) / 100

/** Le misure del file raggruppate per voce di contratto (scarta quello che il contratto non ha, e i lavori a corpo). */
function misurePerVoce(r: Revisione, misure: MisuraDatata[]): { perVoce: Map<string, MisurazioneRiga[]>; scartate: EsitoImportSal['scartate'] } {
  const perVoce = new Map<string, MisurazioneRiga[]>()
  const scartate: EsitoImportSal['scartate'] = []
  for (const m of misure) {
    const v = abbinaVoce(r, m)
    const descrizione = (m.desc_short || '').trim()
    if (!v) { scartate.push({ codice: m.codice, descrizione, motivo: 'non è nel contratto' }); continue }
    if (v.corpo) { scartate.push({ codice: m.codice, descrizione, motivo: 'lavoro a corpo: si contabilizza a quota %' }); continue }
    perVoce.set(v.id, [...(perVoce.get(v.id) || []), ...righeDi(m)])
  }
  return { perVoce, scartate }
}

export function confrontaConXpwe(l: Lavoro, avId: string, misure: MisuraDatata[]): Confronto {
  const a = avanzamento(l, avId)
  const r = revisione(l, a.leggeDa)
  const { perVoce, scartate } = misurePerVoce(r, misure)
  const art = new Map(r.articoli.map((x) => [x.id, x]))
  const righe: RigaConfronto[] = []
  for (const v of r.voci) {
    const ar = art.get(v.articolo); if (!ar || v.corpo) continue
    const quadra = quantitaEseguita(rigaDi(a, v.id))
    const file = sommaMisurazioni(perVoce.get(v.id) || [])
    if (!quadra && !file) continue
    const p = prezzoIn(r, ar)
    righe.push({ voce: v.id, codice: ar.codice, descrizione: ar.descrizione, um: ar.um, quadra: r2(quadra), file: r2(file), importoQuadra: r2(importoQta(quadra, p, ar.um)), importoFile: r2(importoQta(file, p, ar.um)) })
  }
  const diverse = righe.filter((x) => Math.abs(x.quadra - x.file) >= 0.005)
  return {
    righe, diverse, scartate,
    lordoQuadra: r2(righe.reduce((t, x) => t + x.importoQuadra, 0)),
    lordoFile: r2(righe.reduce((t, x) => t + x.importoFile, 0)),
  }
}

/**
 * Le misure dello stato finale (in bozza) diventano quelle del file: tutte le
 * date, voce per voce del contratto. Le voci che il file non misura restano a
 * zero; i lavori a corpo tengono la loro quota.
 */
export function statoFinaleDaXpwe(l0: Lavoro, avId: string, misure: MisuraDatata[]): { lavoro: Lavoro; voci: number; scartate: EsitoImportSal['scartate'] } {
  const a = avanzamento(l0, avId)
  if (a.tipo !== 'salFinale') throw new Error('Si sostituiscono le misure dello stato finale')
  if (a.stato !== 'bozza') throw new Error('Lo stato finale è emesso: si legge, non si modifica')
  const r = revisione(l0, a.leggeDa)
  const { perVoce, scartate } = misurePerVoce(r, misure)
  let l = l0
  for (const v of r.voci) {
    if (v.corpo) continue
    l = modificaRigaAvanzamento(l, avId, v.id, { misure: perVoce.get(v.id) || [], quantita: undefined })
  }
  return { lavoro: l, voci: perVoce.size, scartate }
}

/**
 * Contabilità — IMPORTARE IN UN LAVORO GIÀ AVVIATO.
 *
 * L'import «di partenza» sostituisce tutto: il computo diventa il contratto e
 * nasce il primo libretto. Ma un lavoro vero non comincia sempre da lì. Capita
 * di ereditare una contabilità già avviata — SAL emessi, atti firmati — e di
 * doverla portare dentro per proseguire da dove si era; capita di dover
 * aggiungere le voci di una perizia, o un pezzo di computo arrivato dopo.
 *
 * In quei casi importare NON deve cancellare nulla: le voci nuove si
 * AGGIUNGONO all'elenco prezzi, con il SAL (o la perizia) da cui esistono, e
 * le voci che l'elenco ha già si riconoscono dal codice e non si duplicano —
 * al massimo portano le loro misure nel libretto indicato.
 *
 * Modulo PURO: decide e calcola, non tocca il DOM.
 */
import type { Partita, Sal } from './types'
import type { VoceImport } from './import'
import { importaComputo } from './import'
import { prossimoNumeroNP } from './nuovi-prezzi'
import type { MisurazioneRiga } from '../../../shared/compositore/misurazioni'

/** Chiave di riconoscimento di una voce: il codice, se c'è; altrimenti la descrizione. */
export const chiaveVoce = (codice?: string | null, descrizione?: string | null): string =>
  (codice || '').trim().toLowerCase() || (descrizione || '').trim().toLowerCase()

export interface AnteprimaAggiunta {
  /** Voci che l'elenco prezzi non ha ancora. */
  nuove: number
  /** Voci già in elenco, riconosciute dal codice: non si duplicano. */
  gia: number
  /** Quante portano misure con sé. */
  conMisure: number
  /** Codici già presenti con prezzo diverso: il prezzo di contratto NON si tocca. */
  prezziDiversi: { codice: string; inElenco: number | null; nelFile: number | null }[]
  /**
   * Voci già in elenco a cui MANCA la quantità di contratto e che questo file
   * può completare. Succede sempre quando il lavoro è stato ereditato da un
   * file di contabilità (che porta l'eseguito ma non il progetto) e poi si
   * importa il computo di contratto: senza questo, il contratto vigente resta
   * a zero e ogni perizia sembra tutta in aumento.
   */
  completabili: number
}

/** Che cosa succederebbe importando queste voci: si mostra PRIMA di importare. */
export function anteprimaAggiunta(voci: VoceImport[], partite: Partita[]): AnteprimaAggiunta {
  const esistenti = new Map(partite.map((p) => [chiaveVoce(p.codice, p.descrizione), p]))
  let nuove = 0, gia = 0, conMisure = 0, completabili = 0
  const prezziDiversi: AnteprimaAggiunta['prezziDiversi'] = []
  for (const v of voci) {
    const k = chiaveVoce(v.codice, v.desc_short || v.declaratoria)
    const p = esistenti.get(k)
    if (p) {
      gia++
      const inElenco = p.modalita === 'corpo' ? p.importoContrattuale ?? null : p.prezzoUnitario ?? null
      if (v.prezzo != null && inElenco != null && Math.abs(v.prezzo - inElenco) >= 0.005) {
        prezziDiversi.push({ codice: (v.codice || '').trim() || (v.desc_short || '').trim(), inElenco, nelFile: v.prezzo })
      }
      if (p.modalita !== 'corpo' && p.qtyProgetto == null && v.qty != null) completabili++
    } else nuove++
    if (v.misurazioni && v.misurazioni.length) conMisure++
  }
  return { nuove, gia, conMisure, prezziDiversi, completabili }
}

export interface EsitoAggiunta {
  /** Partite da aggiungere all'elenco (già pronte, con id e introdottaSal). */
  nuove: Partita[]
  /** Misure da portare nel contenitore scelto: id della partita → righe. */
  misure: { partitaId: string; righe: MisurazioneRiga[] }[]
  gia: number
  /** Voci già in elenco a cui questo file ha dato la quantità di contratto che mancava. */
  completate: number
}

/**
 * Prepara l'aggiunta: voci nuove con il loro SAL di comparsa, e le misure da
 * versare nel libretto (o nella perizia) indicato. Le voci già in elenco
 * conservano il loro prezzo: un file importato dopo non riscrive il contratto.
 */
export function preparaAggiunta(
  voci: VoceImport[],
  partite: Partita[],
  opt: {
    introdottaSal: number; conMisure: boolean; nuovoId: () => string
    /** Numero della perizia quando le voci entrano in una VARIANTE: lì non sono
     *  contratto — la quantità del file è quantità DI PERIZIA, e il contratto
     *  vigente non si muove finché quella perizia non viene approvata. */
    periziaN?: number | null
    /** Vero quando l'import NON crea contratto: una voce nuova entra in elenco
     *  senza quantità di progetto. Vale per il libretto di un SAL — misurare
     *  non pattuisce — e per ogni aggiunta a un lavoro già avviato. */
    fuoriContratto?: boolean
  },
): EsitoAggiunta {
  const esistenti = new Map(partite.map((p) => [chiaveVoce(p.codice, p.descrizione), p]))
  const costruite = importaComputo(voci, 'misura')
  const nuove: Partita[] = []
  const misure: EsitoAggiunta['misure'] = []
  let gia = 0
  let completate = 0
  costruite.forEach((p, i) => {
    const v = voci[i]
    const k = chiaveVoce(p.codice, p.descrizione)
    const vecchia = esistenti.get(k)
    const nata = { ...p, id: opt.nuovoId(), introdottaSal: opt.introdottaSal }
    if (!vecchia && opt.periziaN == null && opt.fuoriContratto) {
      /* Una voce che arriva in un libretto non diventa contratto: il contratto
         si pattuisce, non si misura. Entra in elenco senza quantità di
         progetto, e sarà una perizia a farne eventualmente contratto. */
      nata.qtyProgetto = null
    }
    if (!vecchia && opt.periziaN != null) {
      /* Voce nuova di una PERIZIA: nasce fuori dal contratto. La quantità del
         file è quantità di perizia, non di progetto, e ci pensa chi chiama a
         metterla nella variante; il contratto vigente non si muove finché
         quella perizia non è approvata. */
      nata.qtyProgetto = null
      const np = nata.np || { numero: prossimoNumeroNP([...partite, ...nuove]), stato: 'bozza' as const, origine: 'assimilazione' as const, base: { codice: p.codice, descrizione: p.descrizione, prezzo: p.prezzoUnitario ?? null, fonte: 'file di variante' } }
      nata.np = { ...np, periziaN: opt.periziaN }
    }
    const target = vecchia || nata
    if (vecchia) {
      gia++
      /* Il contratto non si riscrive mai — ma se la quantità di contratto MANCA
         (lavoro ereditato da un file di contabilità) questo file gliela dà: è
         l'unico modo perché il «contratto vigente» smetta di essere zero. */
      if (vecchia.modalita !== 'corpo' && vecchia.qtyProgetto == null && p.qtyProgetto != null) {
        vecchia.qtyProgetto = p.qtyProgetto
        if (vecchia.prezzoUnitario == null && p.prezzoUnitario != null) vecchia.prezzoUnitario = p.prezzoUnitario
        if (vecchia.prezzoContratto == null && p.prezzoContratto != null) vecchia.prezzoContratto = p.prezzoContratto
        completate++
      }
    } else { nuove.push(target); esistenti.set(k, target) }
    if (opt.conMisure && v?.misurazioni?.length) misure.push({ partitaId: target.id, righe: v.misurazioni.map((m) => ({ ...m })) })
  })
  return { nuove, misure, gia, completate }
}

/**
 * Il SAL in cui una voce importata adesso può comparire: il primo non firmato.
 * Gli atti già firmati non si toccano — una voce nuova non può entrare in un
 * libretto chiuso (D.M. 49/2018: niente abrasioni, niente ritocchi).
 */
export function salDiDestinazione(sals: Sal[]): number {
  const aperti = sals.filter((s) => !s.firmato).sort((a, b) => a.numero - b.numero)
  if (aperti.length) return aperti[0].numero
  const ultimo = [...sals].sort((a, b) => b.numero - a.numero)[0]
  return ultimo ? ultimo.numero + 1 : 1
}

/**
 * UNA TARIFFA, PIÙ PARTITE: la stessa voce di elenco può stare su più righe di
 * contratto (misurazioni distinte della stessa lavorazione). Un computo di
 * variante porta UNA quantità per tariffa, e non dice a quale delle gemelle
 * appartenga: va ripartita in modo che, se il totale non cambia, NESSUNA risulti
 * variata. Si riempie ciascuna fino alla sua quantità di contratto, nell'ordine,
 * e solo l'eccedenza (o la mancanza) finisce sull'ultima: così i maggiori e i
 * minori lavori sono quelli veri. Accoppiarle riga per riga, come si faceva,
 * inventava variazioni a coppie che si annullavano: totale giusto, quadro
 * comparativo sbagliato.
 */
export function ripartisciPerTariffa(contratto: (number | null | undefined)[], totale: number): number[] {
  const n = contratto.length
  if (!n) return []
  const out: number[] = []
  let resto = totale
  for (let i = 0; i < n; i++) {
    const base = contratto[i] ?? 0
    const quota = i === n - 1 ? Math.max(resto, 0) : Math.min(base, Math.max(resto, 0))
    out.push(Math.round(quota * 1e6) / 1e6)
    resto = Math.round((resto - quota) * 1e6) / 1e6
  }
  return out
}

/**
 * I DATI DELLA CONTABILITÀ di un lavoro: il contratto come atto, i tempi, i
 * pagamenti. L'anagrafica (oggetto, CUP, CIG, committente, impresa, RUP,
 * direttore dei lavori) sta nei dati generali: qui non si ripete.
 *
 * I TEMPI si contano dagli atti, non si presumono: dalla consegna e dai giorni
 * utili il termine contrattuale; con le sospensioni (chiuse dalla ripresa) e le
 * proroghe il termine vigente; con l'ultimazione il ritardo. Una sospensione
 * senza ripresa resta aperta e lo si dice; un termine che non si può calcolare
 * si dichiara tale, con il dato che manca (art. 121 D.Lgs. 36/2023).
 */
import { addDaysIt, giorniTraIt } from '../date-it'
import { nuovoId, type Lavoro } from './modello'

export interface Sospensione {
  id: string
  /** Verbale di sospensione (gg/mm/aaaa). */
  dal: string
  /** Verbale di ripresa; assente = ancora sospesi. */
  al?: string
  motivo?: string
}

export interface Proroga {
  id: string
  data?: string
  giorni: number
  motivo?: string
}

export interface DatiContabilita {
  /* Il contratto come atto. */
  numeroContratto?: string
  dataStipula?: string
  registrazione?: string
  /* I tempi. */
  dataConsegna?: string
  giorniUtili?: number | null
  sospensioni: Sospensione[]
  proroghe: Proroga[]
  dataUltimazione?: string
  /* I pagamenti. */
  /** Anticipazione del prezzo, % del contratto (art. 125 c. 1: di norma 20). */
  anticipazionePct?: number | null
  /** Penale per ritardo, per mille al giorno del netto contrattuale (0,3–1). */
  penalePerMille?: number | null
  ivaPct?: number | null
  /** Importo minimo di un SAL, se il capitolato lo fissa. */
  importoMinimoSal?: number | null
  /** Arrotondamento per difetto del credito del certificato (es. 100 €): il resto matura dopo. */
  arrotondamentoCertificato?: number | null
  /** Articolo del capitolato richiamato nel certificato di pagamento. */
  articoloCapitolato?: string
  /* La chiusura. */
  /** Iter del conto finale (art. 7 c. 3 e art. 18 All. II.14). */
  contoFinale?: { dataCompilazione?: string; dataInvito?: string; giorniTermine?: number | null; dataFirma?: string; esito?: 'firmatoConConferma' | 'firmatoSenzaConferma' | 'nonFirmato' }
  /** DURC: lo svincolo della ritenuta è subordinato alla regolarità contributiva. */
  durcRegolare?: boolean
  durcData?: string
  /** Contabilità semplificata (lavori sotto 40.000 €, art. 12 c. 11-bis All. II.14): fatture col visto del DL. */
  semplificata?: boolean
  fatture?: Fattura[]
  /** Accordo quadro (art. 59): importo massimo e contratti applicativi. */
  accordoQuadro?: { importoMassimo: number | null; applicativi: { numero: number; data?: string; oggetto?: string; importo: number }[] }
}

export interface Fattura {
  id: string
  numero?: string
  data?: string
  importo?: number | null
  oggetto?: string
  /** Data del visto del DL; assente = non ancora vistata. */
  vistoData?: string
  rilievi?: string
  /** Il visto sostituisce il certificato di regolare esecuzione. */
  sostituisceCre?: boolean
}

export const nuoviDatiContabilita = (): DatiContabilita => ({ sospensioni: [], proroghe: [] })

/** I dati della contabilità di un lavoro (vuoti, coi default, se non ancora scritti). */
export const datiContabilita = (l: Lavoro): DatiContabilita => ({ ...nuoviDatiContabilita(), ...(l.contabilita || {}) })

/** Cambia uno o più campi. */
export function impostaContabilita(l: Lavoro, patch: Partial<DatiContabilita>): Lavoro {
  return { ...l, contabilita: { ...datiContabilita(l), ...patch } }
}

export function aggiungiSospensione(l: Lavoro, s: Omit<Sospensione, 'id'>): Lavoro {
  const d = datiContabilita(l)
  if (d.sospensioni.some((x) => !x.al)) throw new Error("C'è già una sospensione senza ripresa: prima la ripresa")
  return impostaContabilita(l, { sospensioni: [...d.sospensioni, { ...s, id: nuovoId('sosp') }] })
}
export function modificaSospensione(l: Lavoro, id: string, patch: Partial<Omit<Sospensione, 'id'>>): Lavoro {
  const d = datiContabilita(l)
  return impostaContabilita(l, { sospensioni: d.sospensioni.map((x) => (x.id === id ? { ...x, ...patch } : x)) })
}
export function togliSospensione(l: Lavoro, id: string): Lavoro {
  return impostaContabilita(l, { sospensioni: datiContabilita(l).sospensioni.filter((x) => x.id !== id) })
}
export function aggiungiProroga(l: Lavoro, p: Omit<Proroga, 'id'>): Lavoro {
  return impostaContabilita(l, { proroghe: [...datiContabilita(l).proroghe, { ...p, id: nuovoId('prg') }] })
}
export function modificaProroga(l: Lavoro, id: string, patch: Partial<Omit<Proroga, 'id'>>): Lavoro {
  return impostaContabilita(l, { proroghe: datiContabilita(l).proroghe.map((x) => (x.id === id ? { ...x, ...patch } : x)) })
}
export function togliProroga(l: Lavoro, id: string): Lavoro {
  return impostaContabilita(l, { proroghe: datiContabilita(l).proroghe.filter((x) => x.id !== id) })
}

export interface TempiLavoro {
  termineContrattuale?: string
  /** Giorni di ogni sospensione (null se ancora aperta). */
  sospensioni: (Sospensione & { giorni: number | null })[]
  giorniSospensione: number
  sospensioneAperta: boolean
  giorniProroga: number
  termineVigente?: string
  /** Giorni che restano al termine vigente, alla data di lettura o all'ultimazione (negativi = ritardo). */
  residuo: number | null
  ritardo: number
  /** Che cosa manca per calcolare il termine, quando non si può. */
  nonCalcolabile?: string
}

/** Il quadro dei tempi alla data indicata (gg/mm/aaaa). */
export function tempiLavoro(l: Lavoro, oggi?: string): TempiLavoro {
  const d = datiContabilita(l)
  const termineContrattuale = d.dataConsegna && d.giorniUtili ? addDaysIt(d.dataConsegna, d.giorniUtili) || undefined : undefined
  const sospensioni = d.sospensioni
    .map((s) => ({ ...s, giorni: s.al ? giorniTraIt(s.dal, s.al) : null }))
    .map((s) => ({ ...s, giorni: s.giorni != null && s.giorni < 0 ? null : s.giorni }))
  const giorniSospensione = sospensioni.reduce((n, s) => n + (s.giorni ?? 0), 0)
  const sospensioneAperta = sospensioni.some((s) => !s.al)
  const giorniProroga = d.proroghe.reduce((n, p) => n + Math.max(0, Math.round(p.giorni || 0)), 0)
  const termineVigente = termineContrattuale ? addDaysIt(termineContrattuale, giorniSospensione + giorniProroga) || undefined : undefined
  const rif = d.dataUltimazione || oggi
  const residuo = termineVigente && rif ? -(giorniTraIt(termineVigente, rif) ?? 0) : null
  return {
    termineContrattuale, sospensioni, giorniSospensione, sospensioneAperta, giorniProroga, termineVigente,
    residuo, ritardo: residuo != null && residuo < 0 ? -residuo : 0,
    nonCalcolabile: termineVigente ? undefined : !d.dataConsegna ? 'manca la data di consegna dei lavori' : !d.giorniUtili ? "mancano i giorni utili per l'ultimazione" : undefined,
  }
}

/* ── Le fatture (contabilità semplificata) ───────────────────────────── */

export function aggiungiFattura(l: Lavoro, f: Omit<Fattura, 'id'>): Lavoro {
  return impostaContabilita(l, { fatture: [...(datiContabilita(l).fatture || []), { ...f, id: nuovoId('fatt') }] })
}
export function modificaFattura(l: Lavoro, id: string, patch: Partial<Omit<Fattura, 'id'>>): Lavoro {
  return impostaContabilita(l, { fatture: (datiContabilita(l).fatture || []).map((x) => (x.id === id ? { ...x, ...patch } : x)) })
}
export function togliFattura(l: Lavoro, id: string): Lavoro {
  return impostaContabilita(l, { fatture: (datiContabilita(l).fatture || []).filter((x) => x.id !== id) })
}

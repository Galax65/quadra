/**
 * DATI GENERALI del progetto (la scheda «Dati generali»): oggetto,
 * luogo, codici CUP/CIG, committente, figure tecniche, impresa, prezzario.
 *
 * Unica definizione condivisa: li compila Computo, li ricevono la Contabilità (che
 * completa i propri dati d'appalto senza ridigitarli), le stampe (intestazione) e
 * l'export/import XPWE (PweDGDatiGenerali).
 *
 * Parte pura (modello, normalizzazione, unione, intestazione di stampa) + un
 * costruttore di form DOM (`formDatiGenerali`) usato dentro il modal condiviso.
 */

/** Il computo PROMOSSO A CONTRATTO: come i prezzi di progetto sono diventati
 *  prezzi contrattuali. Viaggia con i dati generali verso la Contabilità. */
export interface ContrattoDatiGenerali {
  /** Ribasso d'asta in percentuale (non si applica agli oneri della sicurezza). */
  ribassoPct?: number | null
  /** Offerta a prezzi unitari: i prezzi delle voci sono già quelli offerti. */
  prezziOfferti?: boolean
  /** Data del contratto / aggiudicazione (gg/mm/aaaa). */
  data?: string
}

export interface DatiGenerali {
  oggetto: string
  /** Comune (o località) dei lavori. */
  comune: string
  provincia: string
  cup: string
  cig: string
  /** Stazione appaltante / committente. */
  committente: string
  indirizzoCommittente: string
  rup: string
  progettista: string
  direttoreLavori: string
  /** Coordinatore della sicurezza in fase di esecuzione. */
  cse: string
  impresa: string
  /** Prezzario di riferimento (es. «Prezzario regionale FVG 2026/1»). */
  prezzario: string
  /** Presente quando il computo è stato promosso a contratto (vedi sopra). */
  contratto?: ContrattoDatiGenerali
  /** Data degli elaborati (gg/mm/aaaa); vuota = data di stampa. */
  data: string
}

/** I campi di testo compilabili: tutto DatiGenerali tranne il blocco «contratto». */
export type CampoDatiGenerali = Exclude<keyof DatiGenerali, 'contratto'>

export const CAMPI_DATI_GENERALI: { chiave: CampoDatiGenerali; etichetta: string; gruppo: string; segnaposto?: string }[] = [
  { chiave: 'oggetto', etichetta: 'Oggetto dei lavori', gruppo: 'Opera', segnaposto: 'Lavori di …' },
  { chiave: 'comune', etichetta: 'Comune / località', gruppo: 'Opera', segnaposto: 'Comune' },
  { chiave: 'provincia', etichetta: 'Provincia', gruppo: 'Opera', segnaposto: 'UD' },
  { chiave: 'cup', etichetta: 'CUP', gruppo: 'Opera' },
  { chiave: 'cig', etichetta: 'CIG', gruppo: 'Opera' },
  { chiave: 'committente', etichetta: 'Committente / stazione appaltante', gruppo: 'Committente', segnaposto: 'Comune di …' },
  { chiave: 'indirizzoCommittente', etichetta: 'Indirizzo', gruppo: 'Committente' },
  { chiave: 'rup', etichetta: 'RUP', gruppo: 'Committente' },
  { chiave: 'progettista', etichetta: 'Progettista', gruppo: 'Tecnici' },
  { chiave: 'direttoreLavori', etichetta: 'Direttore dei lavori', gruppo: 'Tecnici' },
  { chiave: 'cse', etichetta: 'Coordinatore sicurezza (esecuzione)', gruppo: 'Tecnici' },
  { chiave: 'impresa', etichetta: 'Impresa esecutrice', gruppo: 'Impresa' },
  { chiave: 'prezzario', etichetta: 'Prezzario di riferimento', gruppo: 'Elaborati', segnaposto: 'Prezzario regionale … 2026' },
  { chiave: 'data', etichetta: 'Data degli elaborati', gruppo: 'Elaborati', segnaposto: 'gg/mm/aaaa' },
]

export function datiGeneraliVuoti(): DatiGenerali {
  return Object.fromEntries(CAMPI_DATI_GENERALI.map(c => [c.chiave, ''])) as unknown as DatiGenerali
}

/** Da un oggetto qualsiasi (progetto salvato, messaggio) a DatiGenerali completi e ripuliti. */
export function normalizzaDatiGenerali(raw: unknown): DatiGenerali {
  const out = datiGeneraliVuoti()
  if (raw && typeof raw === 'object') {
    for (const { chiave } of CAMPI_DATI_GENERALI) {
      const v = (raw as Record<string, unknown>)[chiave]
      if (typeof v === 'string') out[chiave] = v.trim()
      else if (typeof v === 'number') out[chiave] = String(v)
    }
  }
  return out
}

/** Completa `base` con i campi di `nuovi` SOLO dove `base` è vuoto (mai sovrascrivere). */
export function completaDatiGenerali(base: DatiGenerali, nuovi: Partial<DatiGenerali>): DatiGenerali {
  const out = { ...base }
  for (const { chiave } of CAMPI_DATI_GENERALI) {
    const v = (nuovi[chiave] ?? '').trim()
    if (!out[chiave] && v) out[chiave] = v
  }
  return out
}

export const datiGeneraliCompilati = (dg: Partial<DatiGenerali> | null | undefined): number =>
  dg ? CAMPI_DATI_GENERALI.filter(c => (dg[c.chiave] ?? '').trim()).length : 0

/** Righe d'intestazione per le stampe (solo i campi compilati). */
export function intestazioneStampa(dg: Partial<DatiGenerali>, dataStampa: string): string[] {
  const luogo = [dg.comune, dg.provincia ? `(${dg.provincia})` : ''].filter(Boolean).join(' ')
  const codici = [dg.cup ? `CUP ${dg.cup}` : '', dg.cig ? `CIG ${dg.cig}` : ''].filter(Boolean).join(' — ')
  return [
    dg.oggetto ? `OGGETTO: ${dg.oggetto}` : '',
    luogo ? `LUOGO: ${luogo}` : '',
    codici,
    dg.committente ? `COMMITTENTE: ${dg.committente}` : '',
    dg.rup ? `R.U.P.: ${dg.rup}` : '',
    dg.progettista ? `PROGETTISTA: ${dg.progettista}` : '',
    dg.direttoreLavori ? `DIRETTORE DEI LAVORI: ${dg.direttoreLavori}` : '',
    dg.impresa ? `IMPRESA: ${dg.impresa}` : '',
    dg.prezzario ? `PREZZARIO: ${dg.prezzario}` : '',
    `Data: ${dg.data || dataStampa}`,
  ].filter(Boolean)
}

/**
 * Form DOM dei dati generali, raggruppato per sezione. `onChange` riceve l'oggetto
 * aggiornato a ogni modifica (la copia passata non viene mutata).
 */
export function formDatiGenerali(dg: DatiGenerali, onChange: (dg: DatiGenerali) => void): HTMLElement {
  const stato = { ...dg }
  const root = document.createElement('div')
  root.className = 'dg-form'
  root.style.display = 'grid'
  root.style.gap = 'var(--sp-4)'
  const gruppi = [...new Set(CAMPI_DATI_GENERALI.map(c => c.gruppo))]
  for (const g of gruppi) {
    const fs = document.createElement('fieldset')
    fs.style.border = '0'; fs.style.padding = '0'; fs.style.margin = '0'
    fs.style.display = 'grid'; fs.style.gridTemplateColumns = 'repeat(auto-fit, minmax(200px, 1fr))'; fs.style.gap = 'var(--sp-2) var(--sp-3)'
    const lg = document.createElement('legend')
    lg.className = 'ehb-label'
    lg.style.fontWeight = '700'
    lg.style.marginBottom = 'var(--sp-2)'
    lg.textContent = g
    fs.appendChild(lg)
    for (const c of CAMPI_DATI_GENERALI.filter(x => x.gruppo === g)) {
      const f = document.createElement('label')
      f.className = 'ehb-field'
      if (c.chiave === 'oggetto' || c.chiave === 'committente' || c.chiave === 'prezzario') f.style.gridColumn = '1 / -1'
      const l = document.createElement('span')
      l.className = 'ehb-label'
      l.textContent = c.etichetta
      const inp = document.createElement('input')
      inp.className = 'ehb-input'
      inp.name = c.chiave
      inp.value = stato[c.chiave]
      if (c.segnaposto) inp.placeholder = c.segnaposto
      inp.addEventListener('input', () => { stato[c.chiave] = inp.value; onChange({ ...stato }) })
      inp.addEventListener('keydown', e => e.stopPropagation())
      f.append(l, inp)
      fs.appendChild(f)
    }
    root.appendChild(fs)
  }
  return root
}

/**
 * NUOVI PREZZI — le lavorazioni che il contratto non prevede.
 *
 * Quando in corso d'opera serve una lavorazione che l'elenco prezzi contrattuale
 * non ha, non si contabilizza al prezzo che capita: si determina un **nuovo
 * prezzo** in contraddittorio (All. II.14 art. 5 c. 7), per **assimilazione** da
 * una voce di contratto, **dai prezzari** vigenti o con **nuova analisi**, e lo
 * si assoggetta al **medesimo ribasso contrattuale**. Poi segue il suo iter:
 * *bozza* → *concordato* (verbale) → *approvato* (perizia).
 *
 * Qui stanno le regole pure: numerazione, derivazione del prezzo, stato, e le
 * tabelle che verbale ed elenco dei nuovi prezzi stampano.
 */
import { round2 } from './contabilita'
import type { NuovoPrezzo, OrigineNuovoPrezzo, Partita, StatoNuovoPrezzo } from './types'

export const STATO_NP: Record<StatoNuovoPrezzo, string> = {
  bozza: 'in bozza',
  concordato: 'concordato',
  approvato: 'approvato',
}
export const ORIGINE_NP: Record<OrigineNuovoPrezzo, string> = {
  prezzario: 'desunto dal prezzario',
  assimilazione: 'per assimilazione da voce di contratto',
  analisi: 'da nuova analisi',
}

/** Codice del nuovo prezzo: NP.01, NP.02… */
export const codiceNP = (numero: number): string => `NP.${String(numero).padStart(2, '0')}`

/** Le voci che sono nuovi prezzi, in ordine di numero. */
export const nuoviPrezzi = (partite: Partita[]): Partita[] =>
  partite.filter((p) => p.np).sort((a, b) => (a.np!.numero || 0) - (b.np!.numero || 0))

/** Il prossimo progressivo libero (non riusa i numeri già dati). */
export function prossimoNumeroNP(partite: Partita[]): number {
  const usati = partite.map((p) => p.np?.numero || 0)
  // anche i codici scritti a mano «NP.07» contano, per non duplicare la numerazione
  for (const p of partite) {
    const m = /^NP[.\s-]?(\d+)/i.exec(p.codice.trim())
    if (m) usati.push(Number(m[1]))
  }
  return Math.max(0, ...usati) + 1
}

/**
 * Il prezzo del nuovo prezzo: prezzo base meno il ribasso contrattuale.
 * Gli oneri della sicurezza non si ribassano, perciò chi chiama passa
 * `ribassoPct = null` per quelli.
 */
export function prezzoNP(base: number | null | undefined, ribassoPct: number | null | undefined): number | null {
  if (base == null || !Number.isFinite(base)) return null
  if (ribassoPct == null || !Number.isFinite(ribassoPct) || ribassoPct === 0) return round2(base)
  return round2(base * (1 - ribassoPct / 100))
}

export interface NuovoPrezzoInput {
  partite: Partita[]
  origine: OrigineNuovoPrezzo
  base?: NuovoPrezzo['base']
  ribassoPct?: number | null
  periziaN?: number | null
  motivazione?: string
}

/** La scheda di un nuovo prezzo appena nato: numerata, in bozza. */
export function schedaNP(i: NuovoPrezzoInput): NuovoPrezzo {
  return {
    numero: prossimoNumeroNP(i.partite),
    stato: 'bozza',
    origine: i.origine,
    ...(i.base ? { base: i.base } : {}),
    ...(i.ribassoPct != null ? { ribassoPct: i.ribassoPct } : {}),
    ...(i.periziaN != null ? { periziaN: i.periziaN } : {}),
    ...(i.motivazione ? { motivazione: i.motivazione } : {}),
  }
}

/**
 * Nuovo prezzo PER ASSIMILAZIONE: si parte da una voce di contratto (il prezzo
 * di contratto è già ribassato, quindi non si ribassa una seconda volta) e si
 * adatta descrizione e prezzo alla lavorazione effettiva.
 */
export function assimila(partite: Partita[], voce: Partita, periziaN?: number | null): { partita: Partita; np: NuovoPrezzo } {
  const np = schedaNP({
    partite,
    origine: 'assimilazione',
    base: { codice: voce.codice, descrizione: voce.descrizione, prezzo: voce.prezzoContratto ?? voce.prezzoUnitario ?? null, fonte: 'voce di contratto' },
    periziaN,
  })
  const partita: Partita = {
    id: '', // lo assegna chi chiama (uid del tool)
    modalita: 'misura',
    codice: codiceNP(np.numero),
    descrizione: voce.descrizione,
    ...(voce.declaratoria ? { declaratoria: voce.declaratoria } : {}),
    um: voce.um,
    categoria: voce.categoria,
    ...(voce.sicurezza ? { sicurezza: true } : {}),
    prezzoUnitario: voce.prezzoContratto ?? voce.prezzoUnitario ?? null,
    qtyProgetto: null,
    np,
  }
  return { partita, np }
}

/** Riga della tabella dei nuovi prezzi (verbale ed elenco). */
export interface RigaNP {
  codice: string
  descrizione: string
  um: string
  derivazione: string
  base: number | null
  ribasso: string
  prezzo: number | null
  stato: string
}

export function righeNP(partite: Partita[]): RigaNP[] {
  return nuoviPrezzi(partite).map((p) => {
    const np = p.np!
    const basi = [np.base?.codice, np.base?.fonte].filter(Boolean).join(' · ')
    return {
      codice: p.codice || codiceNP(np.numero),
      descrizione: p.declaratoria || p.descrizione,
      um: p.um || '',
      derivazione: [ORIGINE_NP[np.origine], basi].filter(Boolean).join(' — '),
      base: np.base?.prezzo ?? null,
      ribasso: np.ribassoPct != null && np.ribassoPct !== 0 ? `−${String(np.ribassoPct).replace('.', ',')}%` : '—',
      prezzo: p.prezzoUnitario ?? null,
      stato: STATO_NP[np.stato],
    }
  })
}

/** Quanti nuovi prezzi sono ancora da approvare (si contabilizzano in conto provvisorio). */
export const npDaApprovare = (partite: Partita[]): number =>
  nuoviPrezzi(partite).filter((p) => p.np!.stato !== 'approvato').length

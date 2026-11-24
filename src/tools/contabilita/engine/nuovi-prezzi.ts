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

export interface NuovoPrezzoInput {
  partite: Partita[]
  origine: OrigineNuovoPrezzo
  base?: NuovoPrezzo['base']
  ribassoPct?: number | null
  periziaN?: number | null
  motivazione?: string
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


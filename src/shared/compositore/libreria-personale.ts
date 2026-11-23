/**
 * LA LIBRERIA PERSONALE delle voci: descrizioni composte e analisi prezzi
 * dello studio, da riusare in ogni lavoro. Vive su questo dispositivo, nello
 * stesso archivio che usava il Computo («miu:libreria»): le voci già salvate
 * si ritrovano.
 */
import type { VocePronta } from './libreria'
import { voceProntaText } from './libreria'

export const CHIAVE_LIBRERIA = 'miu:libreria'

export function leggiLibreria(store: Pick<Storage, 'getItem'> = localStorage): VocePronta[] {
  try {
    const x = JSON.parse(store.getItem(CHIAVE_LIBRERIA) || '[]')
    return Array.isArray(x) ? x.filter((v): v is VocePronta => !!v && typeof v === 'object' && typeof v.nome === 'string' && typeof v.id === 'string') : []
  } catch { return [] }
}

export function scriviLibreria(voci: VocePronta[], store: Pick<Storage, 'setItem'> = localStorage): boolean {
  try { store.setItem(CHIAVE_LIBRERIA, JSON.stringify(voci)); return true } catch { return false }
}

/** Aggiunge in testa (la più recente prima); la stessa voce (stesso nome e testo) non si duplica. */
export function aggiungiALibreria(voci: VocePronta[], v: Omit<VocePronta, 'id'>, ora = Date.now()): VocePronta[] {
  const testo = (x: Pick<VocePronta, 'breve' | 'estesa'>): string => `${x.breve || ''}|${x.estesa || ''}`
  const resto = voci.filter((x) => !(x.nome === v.nome && testo(x) === testo(v)))
  return [{ ...v, id: 'lib' + ora.toString(36) }, ...resto]
}

/** Il testo di una voce della libreria (breve ed estesa), comunque sia stata salvata. */
export const testoLibreria = (v: VocePronta): { breve: string; estesa: string } => voceProntaText(v)

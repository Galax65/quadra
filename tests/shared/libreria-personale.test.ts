import { describe, it, expect } from 'vitest'
import { leggiLibreria, scriviLibreria, aggiungiALibreria, testoLibreria, CHIAVE_LIBRERIA } from '../../src/shared/compositore/libreria-personale'

/** La libreria personale dello studio: stesso archivio del vecchio Computo, senza doppioni. */
describe('la libreria personale', () => {
  it('si legge e si scrive; la stessa voce non si duplica; la più recente in testa', () => {
    const m = new Map<string, string>()
    const store = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) } }
    let lib = aggiungiALibreria(leggiLibreria(store), { nome: 'Massetto', um: 'm2', breve: 'Massetto', estesa: 'Massetto in cls' }, 1)
    lib = aggiungiALibreria(lib, { nome: 'Intonaco', um: 'm2', breve: 'Intonaco' }, 2)
    lib = aggiungiALibreria(lib, { nome: 'Massetto', um: 'm2', breve: 'Massetto', estesa: 'Massetto in cls' }, 3)
    expect(lib.map((x) => x.nome)).toEqual(['Massetto', 'Intonaco'])
    scriviLibreria(lib, store)
    expect(JSON.parse(m.get(CHIAVE_LIBRERIA)!)).toHaveLength(2)
    expect(testoLibreria(leggiLibreria(store)[0])).toEqual({ breve: 'Massetto', estesa: 'Massetto in cls' })
  })
})

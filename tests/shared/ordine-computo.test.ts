import { describe, expect, it } from 'vitest'
import { ordinaVoci, ordineManuale, titoliGruppo } from '../../src/shared/ordine-computo'

const K = ['a', 'b', 'c', 'd', 'e']

describe('ordine delle voci di computo', () => {
  it('manuale: prima le chiavi note, poi le nuove nell\'ordine di arrivo', () => {
    expect(ordineManuale(K, ['c', 'x', 'a'])).toEqual(['c', 'a', 'b', 'd', 'e'])
  })

  it('categorie: gruppi nell\'ordine di prima comparsa, senza categoria in coda, stabile', () => {
    const categoria = { a: 'Edile · Scavi', b: 'Verde', c: 'Edile · Murature', d: undefined, e: 'Edile · Scavi' }
    expect(ordinaVoci(K, 'categorie', { categoria })).toEqual(['a', 'e', 'c', 'b', 'd'])
    // spostare in testa una voce del Verde porta in testa tutto il suo gruppo
    expect(ordinaVoci(K, 'categorie', { categoria, ordine: ['b', 'a', 'c', 'd', 'e'] })).toEqual(['b', 'a', 'e', 'c', 'd'])
  })

  it('categorie: la voce con la sola Supercategoria precede le sue Categorie', () => {
    const categoria = { a: 'Edile · Scavi', b: 'Edile' }
    expect(ordinaVoci(['a', 'b'], 'categorie', { categoria })).toEqual(['b', 'a'])
  })

  it('wbs: codici in ordine numerico, senza WBS in coda', () => {
    const wbs = { a: '02', b: '01.10', c: '01.2', d: '', e: '01.2' }
    expect(ordinaVoci(K, 'wbs', { wbs })).toEqual(['c', 'e', 'b', 'a', 'd'])
  })

  it('titoli di gruppo: parti della categoria o nodi WBS con descrizione', () => {
    expect(titoliGruppo('categorie', 'Edile · Scavi', '01')).toEqual(['Edile', 'Scavi'])
    expect(titoliGruppo('wbs', 'Edile', '01.02', { '01': 'Opere', '01.02': 'Scavi' })).toEqual(['01 Opere', '01.02 Scavi'])
    expect(titoliGruppo('manuale', 'Edile', '01')).toEqual([])
  })
})


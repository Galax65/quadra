import { describe, expect, it } from 'vitest'
import { ordinaVoci, ordineManuale, scorriVoci, spostaVoci, titoliGruppo } from '../../src/shared/ordine-computo'

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

  it('sposta un blocco prima o dopo un bersaglio', () => {
    expect(spostaVoci(K, [], ['d', 'b'], 'a')).toEqual(['b', 'd', 'a', 'c', 'e'])
    expect(spostaVoci(K, [], ['a'], 'e', true)).toEqual(['b', 'c', 'd', 'e', 'a'])
    expect(spostaVoci(K, [], ['a'], 'a')).toEqual(K)
  })

  it('su/giù di una posizione, senza superare i bordi', () => {
    expect(scorriVoci(K, ['b', 'c'], -1)).toEqual(['b', 'c', 'a', 'd', 'e'])
    expect(scorriVoci(K, ['a'], -1)).toEqual(K)
    expect(scorriVoci(K, ['d', 'e'], 1)).toEqual(K)
    expect(scorriVoci(K, ['b'], 1)).toEqual(['a', 'c', 'b', 'd', 'e'])
  })

  it('titoli di gruppo: parti della categoria o nodi WBS con descrizione', () => {
    expect(titoliGruppo('categorie', 'Edile · Scavi', '01')).toEqual(['Edile', 'Scavi'])
    expect(titoliGruppo('wbs', 'Edile', '01.02', { '01': 'Opere', '01.02': 'Scavi' })).toEqual(['01 Opere', '01.02 Scavi'])
    expect(titoliGruppo('manuale', 'Edile', '01')).toEqual([])
  })
})

import { spostaElemento } from '../../src/shared/ordine-computo'
describe('spostamento delle righe di misura', () => {
  it('nella stessa voce, prima o dopo una riga', () => {
    const l = ['a', 'b', 'c', 'd']
    expect(spostaElemento(l, 0, l, 2).destinazione).toEqual(['b', 'a', 'c', 'd'])
    expect(spostaElemento(l, 0, l, 2, true).destinazione).toEqual(['b', 'c', 'a', 'd'])
    expect(spostaElemento(l, 3, l, 0).destinazione).toEqual(['d', 'a', 'b', 'c'])
  })
  it('da una voce a un\'altra', () => {
    const r = spostaElemento(['a', 'b'], 1, ['x'], 1)
    expect(r.sorgente).toEqual(['a'])
    expect(r.destinazione).toEqual(['x', 'b'])
  })
})

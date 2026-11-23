import { describe, it, expect } from 'vitest'
import { ripartisciPerTariffa } from '../../src/tools/contabilita/engine/import-aggiunta'

/**
 * Il quadro comparativo della perizia si legge per TARIFFA: se un articolo sta
 * su più partite di contratto, la quantità del computo di variante si ripartisce
 * riempiendo ciascuna fino al suo contratto. Verificato sul quadro comparativo
 * ufficiale di un lavoro concluso (maggiori e minori lavori tornavano solo così).
 */
describe('una tariffa su più partite di contratto', () => {
  it('se il totale non cambia, nessuna gemella risulta variata', () => {
    expect(ripartisciPerTariffa([43.86, 6.43], 50.29)).toEqual([43.86, 6.43])
  })

  it("l'eccedenza va sull'ultima: è lì che nasce il maggiore lavoro", () => {
    expect(ripartisciPerTariffa([10, 5], 20)).toEqual([10, 10])
  })

  it('la mancanza si sconta dalle ultime: minori lavori veri, non a coppie', () => {
    expect(ripartisciPerTariffa([10, 5], 12)).toEqual([10, 2])
    expect(ripartisciPerTariffa([10, 5], 7)).toEqual([7, 0])
  })

  it('una quantità azzerata azzera tutte le gemelle', () => {
    expect(ripartisciPerTariffa([2, 2, 2], 0)).toEqual([0, 0, 0])
  })

  it('una partita sola prende tutto, senza arrotondamenti strani', () => {
    expect(ripartisciPerTariffa([43.86], 50.29)).toEqual([50.29])
    expect(ripartisciPerTariffa([null], 3.33)).toEqual([3.33])
  })

  it('senza partite non ripartisce niente', () => {
    expect(ripartisciPerTariffa([], 10)).toEqual([])
  })
})

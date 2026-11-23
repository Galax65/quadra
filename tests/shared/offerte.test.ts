import { describe, it, expect } from 'vitest'
import { prezzoOfferto, valutaOfferte, vociConOfferta, leggiColonnaPrezzi, type Offerta } from '../../src/shared/offerte'

const voci: any[] = [
  { codice: 'A', prezzo: 10, qty: 100, um: 'm³' },
  { codice: 'B', prezzo: 50, qty: 20, um: 'm²' },
  { codice: 'S', prezzo: 5, qty: 40, um: 'm', sicurezza: true },
]
const o1: Offerta = { id: '1', nome: 'Alfa', prezzi: { A: 9, B: 45 } }
const o2: Offerta = { id: '2', nome: 'Beta', ribassoPct: 12.5 }
const o3: Offerta = { id: '3', nome: 'Gamma', prezzi: { A: 8 } }

describe('offerte e quadro comparativo', () => {
  it('prezzo offerto esplicito, da ribasso unico, sicurezza invariata', () => {
    expect(prezzoOfferto(o1, voci[0])).toBe(9)
    expect(prezzoOfferto(o2, voci[1])).toBe(43.75)
    expect(prezzoOfferto(o3, voci[1])).toBeNull()
    expect(prezzoOfferto(o1, voci[2])).toBe(5)
  })
  it('importo, ribasso risultante e graduatoria al minor prezzo', () => {
    const e = valutaOfferte([o1, o2, o3], voci)
    expect(e[0]).toMatchObject({ base: 2000, importo: 1800, ribasso: 10, posizione: 2 })
    expect(e[1]).toMatchObject({ importo: 1750, ribasso: 12.5, posizione: 1 })
    expect(e[2]).toMatchObject({ mancanti: ['B'], posizione: null, ribasso: null })
  })
  it('l\'aggiudicataria porta i suoi prezzi sulle voci (non sulla sicurezza)', () => {
    const v = vociConOfferta(voci, o1)
    expect(v.map((x) => x.prezzoOfferto)).toEqual([9, 45, undefined])
  })
  it('colonna di prezzi incollata da Excel', () => {
    expect(leggiColonnaPrezzi('1.234,56\n12,5\n\nabc\n€ 7\nA\t3,10')).toEqual([1234.56, 12.5, null, null, 7, 3.1])
  })
})

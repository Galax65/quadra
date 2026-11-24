import { describe, it, expect } from 'vitest'
import { valorizzaLista, economiaATuttoSal, listeATuttoSal, listaSoppressaInSal } from '../../src/tools/contabilita/engine/economia'
import type { ListaEconomia } from '../../src/tools/contabilita/engine/types'

const lista = (over: Partial<ListaEconomia> = {}): ListaEconomia => ({
  id: over.id || 'l1', numero: 1, salNumero: 1,
  operai: [{ qualifica: 'operaio comune', ore: 8, tariffaOraria: 25 }, { qualifica: 'specializzato', ore: 8, tariffaOraria: 30 }], // 200 + 240 = 440
  mezzi: [{ descrizione: 'escavatore', ore: 4, tariffaOraria: 50 }], // 200
  provviste: [{ descrizione: 'calcestruzzo', um: 'mc', quantita: 2, prezzoUnitario: 100 }], // 200
  ...over,
})

describe('Contabilità lavori in economia — valorizzazione', () => {
  it('valorizzaLista somma manodopera + noli + provviste', () => {
    const v = valorizzaLista(lista())
    expect(v.manodopera).toBe(440)
    expect(v.noli).toBe(200)
    expect(v.provviste).toBe(200)
    expect(v.totale).toBe(840)
  })
  it('campi mancanti non stimati (null → 0)', () => {
    const v = valorizzaLista(lista({ operai: [{ qualifica: 'x', ore: 8 }], mezzi: [], provviste: [] }))
    expect(v.totale).toBe(0) // tariffa assente → 0, non stimata
  })
})

describe('Contabilità lavori in economia — progressivo e storno', () => {
  it('economiaATuttoSal è progressiva per SAL di competenza', () => {
    const liste = [lista({ id: 'l1', salNumero: 1 }), lista({ id: 'l2', salNumero: 2 })] // 840 ciascuna
    expect(economiaATuttoSal(liste, 1)).toBe(840)
    expect(economiaATuttoSal(liste, 2)).toBe(1680)
  })
  it('una lista soppressa esce dalla contabilizzazione (storno)', () => {
    const l = lista({ id: 'l1', salNumero: 1, soppressaSal: 2 })
    expect(listaSoppressaInSal(l, 1)).toBe(false)
    expect(listaSoppressaInSal(l, 2)).toBe(true)
    expect(economiaATuttoSal([l], 1)).toBe(840) // prima dello storno resta
    expect(economiaATuttoSal([l], 2)).toBe(0)   // dallo storno in poi → 0
    expect(listeATuttoSal([l], 2)).toHaveLength(0)
  })
})


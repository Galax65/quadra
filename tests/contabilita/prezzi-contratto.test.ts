import { describe, expect, it } from 'vitest'
import { importaComputo } from '../../src/tools/contabilita/engine'
import type { VoceImport } from '../../src/tools/contabilita/engine/import'

/**
 * REGOLA DELLA CONTABILITÀ PUBBLICA: si contabilizza ai PREZZI DI CONTRATTO.
 * Il prezzo del computo di progetto (o quello offerto, che è il prezzo del
 * contratto) resta registrato sulla partita: è il riferimento contro cui si
 * misura qualunque scostamento, e il listino di oggi non c'entra.
 */
const voce = (v: Partial<VoceImport>): VoceImport => ({ codice: 'A.01', desc_short: 'Scavo', um: 'm3', prezzo: 10, qty: 100, ...v } as VoceImport)

describe('prezzi di contratto', () => {
  it('il prezzo del computo diventa il prezzo di contratto della partita', () => {
    const [p] = importaComputo([voce({})], 'misura')
    expect(p.prezzoUnitario).toBe(10)
    expect(p.prezzoContratto).toBe(10)
  })

  it('con offerta a prezzi unitari il contratto è il prezzo OFFERTO, non quello di listino', () => {
    const [p] = importaComputo([voce({ prezzoOfferto: 8.5 } as Partial<VoceImport>)], 'misura')
    expect(p.prezzoUnitario).toBe(8.5)
    expect(p.prezzoContratto).toBe(8.5)
    expect(p.prezzoBase).toBe(10)
  })

  it('una voce senza prezzo non inventa un prezzo di contratto', () => {
    const [p] = importaComputo([voce({ prezzo: 0 })], 'misura')
    expect(p.prezzoUnitario).toBeNull()
    expect(p.prezzoContratto).toBeNull()
  })
})

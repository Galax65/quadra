import { describe, it, expect } from 'vitest'
import { ribassoPct } from '../../src/tools/contabilita/engine/contabilita'
import { importoInLettere } from '../../src/tools/contabilita/engine/certificato'

describe('Contabilità contabilità — ribasso e riconciliazioni (numeri della KB)', () => {
  it('ribasso = (base − offerta)/base — esempio KB 30,5605%', () => {
    expect(ribassoPct(46517.74, 32301.70)).toBeCloseTo(30.5605, 3)
  })
  it('ribasso null se dati mancanti', () => {
    expect(ribassoPct(null, 100)).toBeNull()
    expect(ribassoPct(0, 0)).toBeNull()
  })
  it('riconciliazione lordo/netto: 2.690 × 1,10 = 2.959,00', () => {
    expect(Math.round(2690 * 1.10 * 100) / 100).toBe(2959)
  })
  it('importo in lettere (Diconsi)', () => {
    expect(importoInLettere(2959)).toBe('duemilanovecentocinquantanove/00')
    expect(importoInLettere(1000.5)).toBe('mille/50')
  })
})


import { describe, it, expect } from 'vitest'
import { rinumera, siglaRevisione, type Revisione } from '../../src/shared/revisioni'

describe('come si legge la catena', () => {

  it('le sigle restano allineate e i numeri non hanno buchi', () => {
    expect(siglaRevisione(3)).toBe('rev.03')
    const sbilenca: Revisione[] = [{ n: 0, tipo: 'pfte', etichetta: 'PFTE', stato: 'approvata' }, { n: 7, tipo: 'esecutivo', etichetta: 'Esecutivo', stato: 'bozza' }]
    expect(rinumera(sbilenca).map((r) => r.n)).toEqual([0, 1])
  })
})

import { describe, it, expect } from 'vitest'
import { capitoloDi, contrattoVigente, inVigoreAlla, perCapitoli, rinumera, siglaRevisione, type Revisione } from '../../src/shared/revisioni'

/**
 * La catena delle revisioni: la cronologia del lavoro, e soprattutto la regola
 * dei prezzi — un SAL legge dall'ultima revisione di contratto APPROVATA prima
 * di lui, e una perizia in bozza non è in vigore per nessuno.
 */
const catena: Revisione[] = [
  { n: 0, tipo: 'pfte', etichetta: 'PFTE', stato: 'approvata' },
  { n: 1, tipo: 'esecutivo', etichetta: 'Esecutivo', stato: 'approvata' },
  { n: 2, tipo: 'contratto', etichetta: 'Contratto', stato: 'approvata' },
  { n: 3, tipo: 'sal', etichetta: 'SAL n. 1', stato: 'approvata', leggeDa: 2 },
  { n: 4, tipo: 'perizia', etichetta: 'Perizia n. 1', stato: 'bozza' },
  { n: 5, tipo: 'sal', etichetta: 'SAL n. 2', stato: 'bozza' },
]

describe('i prezzi che un avanzamento legge', () => {
  it('vengono dal contratto finché la perizia è in bozza', () => {
    expect(inVigoreAlla(catena, 5)?.etichetta).toBe('Contratto')
    expect(contrattoVigente(catena)?.etichetta).toBe('Contratto')
  })

  it('vengono dalla perizia appena è approvata', () => {
    const dopo = catena.map((r) => (r.tipo === 'perizia' ? { ...r, stato: 'approvata' as const } : r))
    expect(inVigoreAlla(dopo, 5)?.etichetta).toBe('Perizia n. 1')
    // il SAL 1, che è prima della perizia, continua a leggere dal contratto
    expect(inVigoreAlla(dopo, 3)?.etichetta).toBe('Contratto')
  })

  it('un avanzamento non fa mai da riferimento a un altro', () => {
    const soloSal: Revisione[] = [{ n: 0, tipo: 'sal', etichetta: 'SAL n. 1', stato: 'approvata' }]
    expect(inVigoreAlla(soloSal, 1)).toBeNull()
  })
})

describe('come si legge la catena', () => {
  it('si divide in capitoli, nell ordine Computo · Contabilità · Perizie', () => {
    expect(perCapitoli(catena).map((g) => g.titolo)).toEqual(['Computo', 'Contabilità', 'Perizie'])
    expect(capitoloDi('perizia')).toBe('perizia')
    expect(capitoloDi('statofinale')).toBe('contabilita')
  })

  it('le sigle restano allineate e i numeri non hanno buchi', () => {
    expect(siglaRevisione(3)).toBe('rev.03')
    const sbilenca: Revisione[] = [{ n: 0, tipo: 'pfte', etichetta: 'PFTE', stato: 'approvata' }, { n: 7, tipo: 'esecutivo', etichetta: 'Esecutivo', stato: 'bozza' }]
    expect(rinumera(sbilenca).map((r) => r.n)).toEqual([0, 1])
  })
})

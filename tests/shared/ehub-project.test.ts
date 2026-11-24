import { describe, it, expect } from 'vitest'
import { bundleProgettoQuadra, parseProgettoQuadra, contaToolDelProgetto, QUADRA_PROJECT_KIND } from '../../src/shared/progetto-quadra'

/** Progetto Quadra: contenitore dello stato di tutti i tool (.ehub). */

const NOW = 1_700_000_000_000

describe('bundleProgettoQuadra', () => {
  it('costruisce il contenitore con kind/versione/ts e stati dei tool', () => {
    const b = bundleProgettoQuadra({ 'gamma': { v: 5 }, 'computo': { sel: ['a'] } }, { now: NOW, name: 'Cantiere X' })
    expect(b.kind).toBe(QUADRA_PROJECT_KIND)
    expect(b.v).toBe(1)
    expect(b.ts).toBe(NOW)
    expect(b.name).toBe('Cantiere X')
    expect(contaToolDelProgetto(b)).toBe(2)
  })

  it('scarta gli stati null/undefined', () => {
    const b = bundleProgettoQuadra({ 'gamma': { v: 5 }, 'tau-documenti': null as unknown as object }, { now: NOW })
    expect(contaToolDelProgetto(b)).toBe(1)
    expect('tau-documenti' in b.tools).toBe(false)
  })
})

describe('parseProgettoQuadra', () => {
  it('roundtrip bundle → JSON → parse', () => {
    const b = bundleProgettoQuadra({ 'gamma': { v: 5, circuits: [] } }, { now: NOW })
    const parsed = parseProgettoQuadra(JSON.stringify(b))
    expect(parsed).toEqual(b)
  })

  it('accetta un oggetto già parsato', () => {
    const parsed = parseProgettoQuadra({ tools: { 'computo': { sel: [] } } })
    expect(contaToolDelProgetto(parsed)).toBe(1)
    expect(parsed.kind).toBe(QUADRA_PROJECT_KIND)
  })

  it('rifiuta JSON malformato', () => {
    expect(() => parseProgettoQuadra('{not json')).toThrow(/JSON malformato/)
  })

  it('rifiuta un kind sbagliato', () => {
    expect(() => parseProgettoQuadra({ kind: 'qualcosaltro', tools: {} })).toThrow(/Non è un progetto Quadra/)
  })

  it('rifiuta l\'assenza di tools', () => {
    expect(() => parseProgettoQuadra({ kind: QUADRA_PROJECT_KIND })).toThrow(/privo di stati/)
  })
})

describe('file con la vecchia planimetria condivisa', () => {
  it('si apre: il campo `sharedPlan` dei tool di disegno si ignora', () => {
    const parsed = parseProgettoQuadra({ kind: QUADRA_PROJECT_KIND, v: 1, tools: { lavoro: { v: 5 } },
      sharedPlan: { dxf: { ref: '/Users/x/p.dxf', name: 'p.dxf', ts: NOW }, cavidotti: [], circuiti: [] } })
    expect('sharedPlan' in parsed).toBe(false)
    expect(contaToolDelProgetto(parsed)).toBe(1)
  })
})

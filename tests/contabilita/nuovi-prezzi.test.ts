import { describe, expect, it } from 'vitest'
import { codiceNP, nuoviPrezzi, righeNP } from '../../src/tools/contabilita/engine/nuovi-prezzi'
import { elencoNuoviPrezziHTML, tabellaNuoviPrezziHTML } from '../../src/tools/contabilita/engine/elenco-np'
import type { Appalto, Partita } from '../../src/tools/contabilita/engine/types'

/**
 * NUOVI PREZZI: numerazione, derivazione, ribasso, iter. Un nuovo prezzo è una
 * lavorazione che il contratto non prevede: si concorda, si assoggetta al
 * ribasso contrattuale e si approva con la perizia.
 */
const voce = (p: Partial<Partita>): Partita => ({ id: p.id || 'x', modalita: 'misura', codice: '', descrizione: '', ...p } as Partita)
const APPALTO = { oggetto: 'Lavori', ente: { denominazione: 'Comune' }, impresa: { denominazione: 'Impresa' }, modalita: 'misura' } as unknown as Appalto

describe('numerazione', () => {
  it('il codice è NP.01, NP.02…', () => {
    expect(codiceNP(1)).toBe('NP.01')
    expect(codiceNP(12)).toBe('NP.12')
  })
})

describe('elenco e verbale', () => {
  const partite = [
    voce({ id: 'c1', codice: 'A.01', descrizione: 'Scavo', um: 'mc', prezzoContratto: 8, prezzoUnitario: 8, qtyProgetto: 10 }),
    voce({ id: 'n1', codice: 'NP.01', descrizione: 'Intonaco decorato', um: 'mq', prezzoUnitario: 125.03,
      np: { numero: 1, stato: 'bozza', origine: 'prezzario', ribassoPct: 25, base: { codice: '25.5.PQ3.03', prezzo: 166.71, fonte: 'Friuli V.G. 2026/1' } } }),
    voce({ id: 'n2', codice: 'NP.02', descrizione: 'Rete elettrosaldata', um: 'kg', prezzoUnitario: 2.05,
      np: { numero: 2, stato: 'approvato', periziaN: 1, origine: 'assimilazione', base: { codice: 'A.02', prezzo: 2.05, fonte: 'voce di contratto' } } }),
  ]
  it('solo i nuovi prezzi entrano nell\'elenco, in ordine di numero', () => {
    expect(nuoviPrezzi(partite).map((p) => p.codice)).toEqual(['NP.01', 'NP.02'])
  })
  it('ogni riga dichiara da dove viene il prezzo', () => {
    const [r1, r2] = righeNP(partite)
    expect(r1.derivazione).toContain('desunto dal prezzario')
    expect(r1.derivazione).toContain('25.5.PQ3.03')
    expect(r1.base).toBe(166.71)
    expect(r1.ribasso).toBe('−25%')
    expect(r1.prezzo).toBe(125.03)
    expect(r1.stato).toBe('in bozza')
    expect(r2.derivazione).toContain('assimilazione')
    expect(r2.ribasso).toBe('—')
    expect(r2.stato).toBe('approvato')
  })
  it('la tabella e il documento riportano derivazione, ribasso e iter', () => {
    const t = tabellaNuoviPrezziHTML(partite)
    expect(t).toContain('NP.01')
    expect(t).toContain('−25%')
    expect(t).toContain('€ 125,03')
    const doc = elencoNuoviPrezziHTML(APPALTO, partite)
    expect(doc).toContain('Elenco dei Nuovi Prezzi')
    expect(doc).toContain('conto provvisorio')
    expect(doc).toContain('Allegato II.14')
  })
  it('senza nuovi prezzi la tabella lo dice invece di restare vuota', () => {
    expect(tabellaNuoviPrezziHTML([partite[0]])).toContain('Nessun nuovo prezzo')
  })
})

import { describe, expect, it } from 'vitest'
import { assimila, codiceNP, npDaApprovare, nuoviPrezzi, prezzoNP, prossimoNumeroNP, righeNP, schedaNP } from '../../src/tools/contabilita/engine/nuovi-prezzi'
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
  it('parte da 1 e non riusa i numeri già dati', () => {
    expect(prossimoNumeroNP([])).toBe(1)
    const con = [voce({ codice: 'NP.01', np: schedaNP({ partite: [], origine: 'analisi' }) })]
    expect(prossimoNumeroNP(con)).toBe(2)
  })
  it('tiene conto anche dei codici NP scritti a mano', () => {
    expect(prossimoNumeroNP([voce({ codice: 'NP.07' })])).toBe(8)
    expect(prossimoNumeroNP([voce({ codice: 'A.01' })])).toBe(1)
  })
  it('il codice è NP.01, NP.02…', () => {
    expect(codiceNP(1)).toBe('NP.01')
    expect(codiceNP(12)).toBe('NP.12')
  })
})

describe('derivazione del prezzo', () => {
  it('il prezzo base si assoggetta al ribasso contrattuale', () => {
    expect(prezzoNP(166.71, 25)).toBe(125.03)
    expect(prezzoNP(100, 12.35)).toBe(87.65)
  })
  it('senza ribasso il prezzo base resta tale (e la sicurezza passa null)', () => {
    expect(prezzoNP(50, null)).toBe(50)
    expect(prezzoNP(50, 0)).toBe(50)
  })
  it('senza prezzo base non si inventa un prezzo', () => {
    expect(prezzoNP(null, 25)).toBeNull()
  })
})

describe('assimilazione da una voce di contratto', () => {
  const contratto = voce({ id: 'c1', codice: 'A.01', descrizione: 'Acciaio B450C', um: 'kg', prezzoUnitario: 2.05, prezzoContratto: 2.05, qtyProgetto: 100 })
  it('nasce numerata, in bozza, col prezzo di contratto come base', () => {
    const { partita, np } = assimila([contratto], contratto, 3)
    expect(partita.codice).toBe('NP.01')
    expect(partita.um).toBe('kg')
    expect(partita.prezzoUnitario).toBe(2.05)
    expect(np.origine).toBe('assimilazione')
    expect(np.stato).toBe('bozza')
    expect(np.periziaN).toBe(3)
    expect(np.base).toMatchObject({ codice: 'A.01', prezzo: 2.05, fonte: 'voce di contratto' })
  })
  it('non ribassa due volte: il prezzo di contratto è già ribassato', () => {
    const { np } = assimila([contratto], contratto)
    expect(np.ribassoPct).toBeUndefined()
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
  it('conta quelli ancora da approvare (conto provvisorio)', () => {
    expect(npDaApprovare(partite)).toBe(1)
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

import { describe, it, expect } from 'vitest'
import {
  nuovoLavoro, nuovoComputo, chiudi, promuoviAContratto, nuovoSal, emetti, nuovaPerizia, modificaRigaAvanzamento,
  importaPerizia, importiPerizia, revisione, quantitaVoce, type Lavoro, type RigaImport,
} from '../../src/shared/lavoro'

/**
 * L'IMPORT DI UNA PERIZIA XPWE: la variante preparata con un altro programma entra nella
 * perizia in bozza. I prezzi di contratto restano quelli (un prezzo diverso è
 * un NP), le voci abbinate conservano l'identità (i SAL le ritrovano), quello
 * che è già contabilizzato non sparisce.
 */
const D = '01/01/2026'

function conPerizia(salSu?: 'v1' | 'v2'): { l: Lavoro; p: string } {
  let l = nuovoLavoro()
  const r = nuovoComputo(l, { fase: 'esecutivo', data: D }); l = r.lavoro
  l = {
    ...l, revisioni: l.revisioni.map((x) => ({
      ...x,
      articoli: [
        { id: 'a1', codice: 'A.01', descrizione: 'Scavo', um: 'm3', prezzo: 20, origine: 'prezzario' as const },
        { id: 'a2', codice: 'B.01', descrizione: 'Muratura', um: 'm2', prezzo: 50, origine: 'prezzario' as const },
      ],
      voci: [
        { id: 'v1', articolo: 'a1', misure: [], quantita: 10 },
        { id: 'v2', articolo: 'a2', misure: [], quantita: 4 },
      ],
    })),
  }
  l = chiudi(l, r.id, D)
  const c = promuoviAContratto(l, r.id, { data: D }); l = chiudi(c.lavoro, c.id, D)
  if (salSu) { const s = nuovoSal(l, D); l = modificaRigaAvanzamento(s.lavoro, s.id, salSu, { quantita: 1 }); l = emetti(l, s.id, D) }
  const p = nuovaPerizia(l, { data: D })
  return { l: p.lavoro, p: p.id }
}

const riga = (codice: string, prezzo: number, q: number, um = 'm3', descr = codice): RigaImport =>
  ({ articolo: { codice, descrizione: descr, um, prezzo, origine: 'prezzario' }, voce: { misure: [], quantita: q } })

describe('importa una perizia XPWE', () => {
  it('le voci di contratto si aggiornano e conservano l\'identità; i nuovi articoli sono NP', () => {
    const { l, p } = conPerizia()
    const e = importaPerizia(l, p, [riga('A.01', 20, 15), riga('B.01', 50, 4, 'm2'), riga('C.01', 30, 2, 'cad', 'Pozzetto')])
    const r = revisione(e.lavoro, p)
    expect(r.voci.map((v) => v.id).slice(0, 2)).toEqual(['v1', 'v2'])
    expect(quantitaVoce(r.voci[0])).toBe(15)
    expect(e).toMatchObject({ aggiornate: 2, nuove: 1, tolte: 0, np: [{ codice: 'C.01', descrizione: 'Pozzetto' }] })
    expect(r.articoli.find((a) => a.codice === 'C.01')?.origine).toBe('np')
    expect(importiPerizia(e.lavoro, p).differenza).toBe(160)   // +5 m3 × 20 + 2 × 30
  })

  it('un codice di contratto a un prezzo diverso diventa un NP che ne deriva, e si segnala', () => {
    const { l, p } = conPerizia()
    const e = importaPerizia(l, p, [riga('A.01', 22, 10), riga('B.01', 50, 4, 'm2')])
    expect(e.np).toEqual([{ codice: 'A.01', descrizione: 'A.01', prezzoDiverso: 20 }])
    const r = revisione(e.lavoro, p)
    const nuovo = r.articoli.find((a) => a.origine === 'np')!
    expect(nuovo.codiceOrig).toBe('A.01')
    expect(r.articoli.find((a) => a.id === 'a1')!.prezzo).toBe(20)    // il prezzo di contratto non cambia
    expect(e.tolte).toBe(1)  // la voce v1 al prezzo di contratto non c'è più nel file
  })

  it('le voci che il file non ha si tolgono, tranne quelle già contabilizzate', () => {
    const { l, p } = conPerizia('v2')
    const e = importaPerizia(l, p, [riga('A.01', 20, 12)])
    expect(e.tolte).toBe(0)
    expect(e.tenute).toEqual([{ codice: 'B.01', descrizione: 'Muratura', sal: 1 }])
    expect(revisione(e.lavoro, p).voci.map((v) => v.id)).toEqual(['v1', 'v2'])
  })

  it('«aggiungi» accoda le voci del file', () => {
    const { l, p } = conPerizia()
    const e = importaPerizia(l, p, [riga('A.01', 20, 3)], 'aggiungi')
    expect(revisione(e.lavoro, p).voci).toHaveLength(3)
    expect(e).toMatchObject({ aggiornate: 0, nuove: 1, tolte: 0 })
  })

  it('solo in una perizia in bozza', () => {
    const { l, p } = conPerizia()
    const ap = chiudi(l, p, D)
    expect(() => importaPerizia(ap, p, [])).toThrow(/approvata/)
    expect(() => importaPerizia(l, l.revisioni[0].id, [])).toThrow(/perizia/)
  })
})

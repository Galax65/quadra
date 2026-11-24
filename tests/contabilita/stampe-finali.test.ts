import { describe, expect, it } from 'vitest'
import { confrontoProgettoEseguitoDoc,    type Appalto, type Partita, type Sal } from '../../src/tools/contabilita/engine'

const P: Partita[] = [
  { id: 'm', modalita: 'misura', codice: 'A.01', descrizione: 'Scavo', um: 'm³', prezzoUnitario: 10, qtyProgetto: 100 },
  { id: 'c', modalita: 'corpo', codice: 'C.01', descrizione: 'Impianto', importoContrattuale: 1000 },
]
const A: Appalto = { oggetto: 'Percorso', ente: { denominazione: 'Comune' }, impresa: { denominazione: 'Impresa' }, modalita: 'misto', ribassoPct: 10 }
const SALS: Sal[] = [
  { numero: 1, data: '01/03/2026', righe: [{ partitaId: 'm', quantitaProgressiva: 40 }, { partitaId: 'c', quotaPct: 50 }] },
  { numero: 2, data: '01/05/2026', righe: [{ partitaId: 'm', quantitaProgressiva: 110 }, { partitaId: 'c', quotaPct: 100 }] },
]

describe('stampe di contabilità: confronto, stato finale, situazione', () => {
  it('confronto progetto / eseguito: quantità, differenza e percentuale', () => {
    const d = confrontoProgettoEseguitoDoc(A, P, SALS, 1)
    const scavo = d.righe.find((r) => r.celle.tariffa === 'A.01')!
    expect([scavo.celle.qc, scavo.celle.qe, scavo.celle.dq, scavo.celle.pct]).toEqual(['100,00', '40,00', '-60,00', '40,00 %'])
    expect([d.contratto, d.eseguito]).toEqual([2000, 900])
  })
  it('a fine lavori la quantità eseguita supera il progetto', () => {
    const d = confrontoProgettoEseguitoDoc(A, P, SALS, 2)
    expect(d.righe.find((r) => r.celle.tariffa === 'A.01')!.celle.dq).toBe('+10,00')
  })
})

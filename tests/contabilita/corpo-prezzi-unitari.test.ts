import { describe, expect, it } from 'vitest'
import { importaComputo, calcolaSals, totaleContrattuale, type Appalto, type Sal } from '../../src/tools/contabilita/engine'

const voci: any[] = [
  { codice: 'A', desc_short: 'Scavo', um: 'm³', prezzo: 10, qty: 100, prezzoOfferto: 9 },
  { codice: 'C', desc_short: 'Impianto', um: 'cad', prezzo: 1000, qty: 1, corpo: true, prezzoOfferto: 850 },
  { codice: 'S', desc_short: 'Recinzione', um: 'm', prezzo: 5, qty: 40, sicurezza: true, prezzoOfferto: 4 },
]

describe('voci a corpo dal computo e offerta a prezzi unitari', () => {
  const P = importaComputo(voci, 'misura')
  it('la voce a corpo diventa una partita a corpo con importo fisso al prezzo offerto', () => {
    const c = P.find((p) => p.codice === 'C')!
    expect([c.modalita, c.importoContrattuale, c.prezzoBase]).toEqual(['corpo', 850, 1000])
  })
  it('le voci a misura portano il prezzo offerto; la sicurezza resta al prezzo di progetto', () => {
    expect(P.find((p) => p.codice === 'A')!.prezzoUnitario).toBe(9)
    expect(P.find((p) => p.codice === 'S')!.prezzoUnitario).toBe(5)
  })
  it('a prezzi unitari il ribasso non si riapplica nel SAL', () => {
    const A: Appalto = { oggetto: 'x', ente: { denominazione: 'E' }, impresa: { denominazione: 'I' }, modalita: 'misto', prezziUnitari: true, baseAsta: 2000, importoOfferta: 1750 }
    const sal: Sal = { numero: 1, righe: P.map((p) => p.modalita === 'corpo' ? { partitaId: p.id, quotaPct: 100 } : { partitaId: p.id, quantitaProgressiva: p.qtyProgetto ?? 0 }) }
    const r = calcolaSals(A, P, [sal])[0]
    expect([r.ribassoPct, r.ribassoImporto, r.lavoriMisura, r.lavoriCorpo]).toEqual([0, 0, 900, 850])
    expect(totaleContrattuale(A, P)).toBe(1950) // 900 + 850 + sicurezza 200
  })
})

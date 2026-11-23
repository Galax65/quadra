/**
 * La penale si calcola sui giorni di ritardo rispetto al termine VIGENTE — non
 * a quello di contratto — e si ferma al 10% dell'ammontare netto contrattuale.
 * Dove il termine non è determinabile non si trattiene nulla: lo si dice.
 */
import { describe, it, expect } from 'vitest'
import { penale, penaleDovuta, penaleHTML, PENALE_TETTO_PCT } from '../../src/tools/contabilita/engine/penali'
import { tempi } from '../../src/tools/contabilita/engine/tempi'
import type { Appalto, Partita, Verbale } from '../../src/tools/contabilita/engine/types'

const partite: Partita[] = [
  { id: 'a', codice: 'A.01', descrizione: 'Lavorazione', um: 'm3', prezzoUnitario: 100, qtyProgetto: 1000, modalita: 'misura' },
]
const base: Appalto = {
  oggetto: 'Lavori di prova', ente: { denominazione: 'Comune di Prova' }, impresa: { denominazione: 'Impresa Y' },
  modalita: 'misura', dataConsegna: '17/11/2025', giorniUtili: 100, penalePerMille: 1,
}
const v = (tipo: Verbale['tipo'], data: string, extra: Partial<Verbale> = {}): Verbale => ({ id: `${tipo}-${data}`, tipo, data, ...extra })

describe('penale per il ritardo', () => {
  it('nessun ritardo, nessuna penale', () => {
    const p = penale(base, partite, tempi(base, [v('ultimazione', '20/02/2026')]))
    expect(p.giorni).toBe(0)
    expect(penaleDovuta(p)).toBe(false)
    expect(penaleHTML(p, tempi(base, [v('ultimazione', '20/02/2026')]))).toContain('nessuna penale')
  })
  it('un giorno di ritardo vale un millesimo del contratto', () => {
    const t = tempi(base, [v('ultimazione', '26/02/2026')])
    const p = penale(base, partite, t)
    expect(p.giorni).toBe(1)
    expect(p.giornaliera).toBe(100)
    expect(p.importo).toBe(100)
  })
  it('una sospensione sposta il termine e cancella il ritardo', () => {
    const atti = [v('sospensione', '01/12/2025'), v('ripresa', '15/12/2025'), v('ultimazione', '05/03/2026')]
    expect(penale(base, partite, tempi(base, atti)).giorni).toBe(0)
    // senza i verbali, lo stesso cantiere risulterebbe in ritardo di 8 giorni
    expect(penale(base, partite, tempi(base, [v('ultimazione', '05/03/2026')])).giorni).toBe(8)
  })
  it('la penale non supera il 10% dell\'ammontare netto contrattuale', () => {
    const t = tempi(base, [v('ultimazione', '31/12/2026')])
    const p = penale(base, partite, t)
    expect(p.giorni).toBeGreaterThan(100)
    expect(p.importo).toBe(p.tetto)
    expect(p.tetto).toBe(100000 * PENALE_TETTO_PCT / 100)
    expect(p.alTetto).toBe(true)
    expect(penaleHTML(p, t)).toContain('risoluzione del contratto')
  })
  it('millesimi fuori dai limiti di legge: si calcola e si segnala', () => {
    const p = penale({ ...base, penalePerMille: 3 }, partite, tempi(base, [v('ultimazione', '26/02/2026')]))
    expect(p.fuoriLimite).toBe(true)
    expect(p.giornaliera).toBe(300)
  })
  it('senza termine determinabile non si trattiene nulla', () => {
    const a = { ...base, dataConsegna: undefined, dataInizio: undefined }
    const p = penale(a, partite, tempi(a, []))
    expect(p.nonCalcolabile).toBeTruthy()
    expect(penaleDovuta(p)).toBe(false)
    expect(penaleHTML(p, tempi(a, []))).toContain('non calcolabile')
  })
  it('senza penale di contratto si applica il minimo di legge, non zero', () => {
    const p = penale({ ...base, penalePerMille: undefined }, partite, tempi(base, [v('ultimazione', '26/02/2026')]))
    expect(p.permille).toBe(0.3)
    expect(p.giornaliera).toBe(30)
  })
})

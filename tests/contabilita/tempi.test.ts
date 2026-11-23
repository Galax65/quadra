/**
 * I giorni si contano dagli atti. Una sospensione senza ripresa non somma
 * giorni presunti, un termine che non si può calcolare si dichiara tale, e il
 * ritardo è sempre misurato sul termine VIGENTE — quello spostato dalle
 * sospensioni e dalle proroghe — non su quello di contratto.
 */
import { describe, it, expect } from 'vitest'
import { tempi, periodiSospensione, tempiHTML } from '../../src/tools/contabilita/engine/tempi'
import type { Appalto, Verbale } from '../../src/tools/contabilita/engine/types'

const base: Appalto = {
  oggetto: 'Lavori di prova', ente: { denominazione: 'Comune di Prova' }, impresa: { denominazione: 'Impresa Y' },
  modalita: 'misura', dataConsegna: '17/11/2025', giorniUtili: 100,
}
const v = (tipo: Verbale['tipo'], data: string, extra: Partial<Verbale> = {}): Verbale =>
  ({ id: `${tipo}-${data}`, tipo, data, ...extra })

describe('tempi contrattuali', () => {
  it('il termine contrattuale è consegna più tempo utile', () => {
    const t = tempi(base, [])
    expect(t.termineContrattuale).toBe('25/02/2026')
    expect(t.termineVigente).toBe('25/02/2026')
  })
  it('una sospensione chiusa sposta il termine dei giorni effettivi', () => {
    const t = tempi(base, [v('sospensione', '01/12/2025', { motivo: 'avversità atmosferiche' }), v('ripresa', '15/12/2025')])
    expect(t.giorniSospensione).toBe(14)
    expect(t.termineVigente).toBe('11/03/2026')
    expect(t.sospensioni[0].motivo).toBe('avversità atmosferiche')
  })
  it('una sospensione aperta non somma giorni presunti: resta aperta e si dichiara', () => {
    const t = tempi(base, [v('sospensione', '01/12/2025')])
    expect(t.sospensioneAperta).toBe(true)
    expect(t.giorniSospensione).toBe(0)
    expect(tempiHTML(t)).toContain('in corso')
  })
  it('le proroghe concesse si sommano al termine', () => {
    const t = tempi(base, [v('proroga', '10/01/2026', { giorniProroga: 30, oggetto: 'istanza del 20/12' })])
    expect(t.giorniProroga).toBe(30)
    expect(t.termineVigente).toBe('27/03/2026')
  })
  it('sospensioni e proroghe insieme, nell\'ordine in cui spostano il termine', () => {
    const t = tempi(base, [
      v('sospensione', '01/12/2025'), v('ripresa', '15/12/2025'),
      v('proroga', '10/01/2026', { giorniProroga: 30 }),
    ])
    expect(t.termineVigente).toBe('10/04/2026')
  })
  it('il ritardo si misura sul termine vigente, alla data di ultimazione', () => {
    const t = tempi(base, [v('ultimazione', '10/03/2026')])
    expect(t.ritardo).toBe(13)
    expect(tempiHTML(t)).toContain('Ritardo di 13 giorni')
  })
  it('ultimazione nel termine: nessun ritardo', () => {
    const t = tempi(base, [v('sospensione', '01/12/2025'), v('ripresa', '15/12/2025'), v('ultimazione', '10/03/2026')])
    expect(t.ritardo).toBe(0)
    expect(t.residuo).toBe(1)
  })
  it('senza consegna il termine non è calcolabile, e si dice che cosa manca', () => {
    const t = tempi({ ...base, dataConsegna: undefined, dataInizio: undefined }, [])
    expect(t.termineVigente).toBeUndefined()
    expect(t.nonCalcolabile).toContain('consegna')
    expect(tempiHTML(t)).toContain('non calcolabile')
  })
  it('una ripresa che non chiude nessuna sospensione non inventa un periodo', () => {
    expect(periodiSospensione([v('ripresa', '15/12/2025')])).toEqual([])
  })
})

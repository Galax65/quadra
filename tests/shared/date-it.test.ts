import { describe, it, expect } from 'vitest'
import { isoToIt, itToISO, addDaysISO, addDaysIt, giorniTra } from '../../src/shared/date-it'

/** Una scadenza di legge sbagliata di un giorno è un errore vero: le date si
 *  convertono in un posto solo, e le conversioni si provano. */
describe('date all\'italiana', () => {
  it('converte nei due versi', () => {
    expect(isoToIt('2026-03-12')).toBe('12/03/2026')
    expect(itToISO('12/03/2026')).toBe('2026-03-12')
    expect(itToISO('1/3/2026')).toBe('2026-03-01')
  })
  it('non inventa date da stringhe incomplete', () => {
    expect(itToISO('12/03')).toBeNull()
    expect(itToISO('')).toBeNull()
    expect(itToISO(undefined)).toBeNull()
    expect(isoToIt(null)).toBe('')
  })
  it('somma i giorni attraversando mesi e anni', () => {
    expect(addDaysISO('2026-06-28', 5)).toBe('2026-07-03')
    expect(addDaysISO('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDaysISO('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDaysISO('2024-03-01', -1)).toBe('2024-02-29') // bisestile
  })
  it('somma i giorni restando in italiano', () => {
    expect(addDaysIt('01/06/2026', 15)).toBe('16/06/2026')
    expect(addDaysIt('', 15)).toBe('')
  })
  it('conta i giorni fra due date, anche a cavallo dell\'ora legale', () => {
    expect(giorniTra('2026-06-01', '2026-06-16')).toBe(15)
    expect(giorniTra('2026-06-16', '2026-06-01')).toBe(-15)
    expect(giorniTra('2026-03-28', '2026-03-30')).toBe(2)
    expect(giorniTra(null, '2026-06-01')).toBeNull()
  })
})

/**
 * Il ribasso del 5,086% diventato 5086%: un certificato di pagamento con milioni
 * di euro di segno sbagliato. La causa stava tutta qui — un numero letto con i
 * separatori di un paese invece che con quelli del sistema.
 */
import { describe, it, expect } from 'vitest'
import { leggiNumeroTesto, separatoriDiSistema } from '../../src/shared/campo-numero'

describe('numero scritto in un campo', () => {
  it('in un campo di testo valgono i separatori di sistema: italiano', () => {
    expect(leggiNumeroTesto('5,086', 'it-IT')).toBe(5.086)
    expect(leggiNumeroTesto('1.234,56', 'it-IT')).toBe(1234.56)
    expect(leggiNumeroTesto('102.843,01', 'it-IT')).toBe(102843.01)
  })
  it('in un campo di testo valgono i separatori di sistema: inglese', () => {
    expect(leggiNumeroTesto('5.086', 'en-US')).toBe(5.086)
    expect(leggiNumeroTesto('1,234.56', 'en-US')).toBe(1234.56)
  })
  it('i separatori si leggono dal sistema', () => {
    expect(separatoriDiSistema('it-IT').decimale).toBe(',')
    expect(separatoriDiSistema('en-US').decimale).toBe('.')
  })
})

describe('numeri scritti a mano, separatori ambigui', () => {
  it('dopo il separatore una o due cifre: è il decimale, in ogni lingua', () => {
    expect(leggiNumeroTesto('123,45', 'en-US')).toBe(123.45)
    expect(leggiNumeroTesto('123.45', 'it-IT')).toBe(123.45)
    expect(leggiNumeroTesto('0,5', 'en-US')).toBe(0.5)
  })
  it('due separatori diversi: l\'ultimo è il decimale', () => {
    expect(leggiNumeroTesto('1.234,56', 'en-US')).toBe(1234.56)
    expect(leggiNumeroTesto('1,234.56', 'it-IT')).toBe(1234.56)
  })
  it('tre cifre dopo il separatore: decide la lingua di sistema', () => {
    expect(leggiNumeroTesto('5.086', 'it-IT')).toBe(5086)
    expect(leggiNumeroTesto('5.086', 'en-US')).toBe(5.086)
    expect(leggiNumeroTesto('5,086', 'it-IT')).toBe(5.086)
    expect(leggiNumeroTesto('5,086', 'en-US')).toBe(5086)
  })
})

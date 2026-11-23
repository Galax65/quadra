import { describe, it, expect } from 'vitest'
import { importoQta } from '../../src/shared/importo'

describe('arrotondamento commerciale degli importi', () => {
  it('la metà del centesimo va per eccesso anche quando il binario la «perde»', () => {
    // 127,3 × 2,05 = 260,965 esatto: in virgola mobile 260,96499999… → deve dare 260,97
    expect(importoQta(127.3, 2.05)).toBe(260.97)
    expect(importoQta(95.5, 175.11)).toBe(16723.01) // 16.723,005
    expect(importoQta(1.005, 1)).toBe(1.01)
  })
  it('le detrazioni si arrotondano simmetriche (lontano dallo zero)', () => {
    expect(importoQta(-127.3, 2.05)).toBe(-260.97)
  })
  it('le voci in % dividono per cento', () => {
    expect(importoQta(100, 8016.52, '%')).toBe(8016.52)
  })
})

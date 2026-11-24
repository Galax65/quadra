import { describe, it, expect } from 'vitest'
import { normH } from '../../src/tools/computo/engine/codes'

describe('normH — normalizzazione intestazioni', () => {
  it('minuscolo, senza accenti, solo alfanumerico', () => {
    expect(normH('Unità di Misura')).toBe('unitadimisura')
    expect(normH('Descrizione (estesa)')).toBe('descrizioneestesa')
    expect(normH('Prezzo €')).toBe('prezzo')
  })
  it('robusto a null/undefined/numeri', () => {
    expect(normH(null)).toBe('')
    expect(normH(undefined)).toBe('')
    expect(normH(2025)).toBe('2025')
  })
})


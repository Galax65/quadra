// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { CAMPI_DATI_GENERALI, datiGeneraliVuoti, formDatiGenerali, intestazioneStampa, normalizzaDatiGenerali } from '../../src/shared/dati-generali'

describe('dati generali del progetto', () => {
  it('normalizza: tutti i campi presenti, stringhe ripulite, il resto ignorato', () => {
    const dg = normalizzaDatiGenerali({ oggetto: '  Percorso pedonale ', cup: 123, ignoto: 'x', rup: null })
    expect(Object.keys(dg).sort()).toEqual(CAMPI_DATI_GENERALI.map(c => c.chiave).sort())
    expect(dg.oggetto).toBe('Percorso pedonale')
    expect(dg.cup).toBe('123')
    expect(dg.rup).toBe('')
    expect(normalizzaDatiGenerali(undefined)).toEqual(datiGeneraliVuoti())
  })

  it('intestazione di stampa: solo i campi compilati, data di ripiego', () => {
    const righe = intestazioneStampa({ oggetto: 'Lavori', comune: 'Esempio', provincia: 'UD', cup: 'J12', cig: 'Z34', committente: 'Comune di Esempio' }, '14/11/2026')
    expect(righe).toEqual(['OGGETTO: Lavori', 'LUOGO: Esempio (UD)', 'CUP J12 — CIG Z34', 'COMMITTENTE: Comune di Esempio', 'Data: 14/11/2026'])
    expect(intestazioneStampa({ data: '01/03/2026' }, 'oggi')).toEqual(['Data: 01/03/2026'])
  })

  it('form: un campo per voce, la modifica arriva a onChange senza mutare l\'originale', () => {
    const iniziale = { ...datiGeneraliVuoti(), oggetto: 'A' }
    let ultimo = iniziale
    const el = formDatiGenerali(iniziale, (dg) => { ultimo = dg })
    const inputs = el.querySelectorAll('input')
    expect(inputs.length).toBe(CAMPI_DATI_GENERALI.length)
    const cup = el.querySelector('input[name="cup"]') as HTMLInputElement
    cup.value = 'J12B34'
    cup.dispatchEvent(new Event('input'))
    expect(ultimo.cup).toBe('J12B34')
    expect(ultimo.oggetto).toBe('A')
    expect(iniziale.cup).toBe('')
  })
})

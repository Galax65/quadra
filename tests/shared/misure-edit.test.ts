import { describe, expect, it } from 'vitest'
import { leggiCampo, impostaCampo, formulaPerSchermo, risolviVediVoce, misureATesto, testoAMisure, spostaRiga, copiaRighe } from '../../src/shared/compositore/misure-edit'
import type { MisurazioneRiga } from '../../src/shared/compositore/misurazioni'

describe('campi di misura con formule', () => {
  it('numeri semplici in italiano', () => {
    expect(leggiCampo('3,50')).toEqual({ valore: 3.5 })
    expect(leggiCampo('1.234,5')).toEqual({ valore: 1234.5 })
    expect(leggiCampo('')).toEqual({ valore: null })
  })
  it('espressioni: valore e formula in notazione XPWE', () => {
    expect(leggiCampo('12+250+65')).toEqual({ valore: 327, formula: '12+250+65' })
    expect(leggiCampo('2x3,5')).toEqual({ valore: 7, formula: '2*3.5' })
    expect(leggiCampo('=(4+2)/2')).toEqual({ valore: 3, formula: '(4+2)/2' })
    expect(leggiCampo('2+')).toEqual({ valore: null, errore: true })
    expect(formulaPerSchermo('2*3.5')).toBe('2*3,5')
  })
  it('impostaCampo ricalcola e toglie la formula se si scrive un numero', () => {
    const r: MisurazioneRiga = { quantita: 0, l1: 2 }
    impostaCampo(r, 'n', '1+2')
    expect(r.quantita).toBe(6)
    expect(r.formule).toEqual({ n: '1+2' })
    impostaCampo(r, 'n', '4')
    expect(r.quantita).toBe(8)
    expect(r.formule).toBeUndefined()
  })
})

describe('vedi voce', () => {
  it('un ciclo non blocca', () => {
    const qty: any = { a: { qty: 0, misurazioni: [{ vediVoce: 'b', quantita: 0 }] }, b: { qty: 0, misurazioni: [{ vediVoce: 'a', quantita: 0 }] } }
    expect(() => risolviVediVoce(qty)).not.toThrow()
  })
})

describe('copia e incolla', () => {
  it('andata e ritorno con le formule', () => {
    const righe: MisurazioneRiga[] = [{ descrizione: 'muro nord', n: 2, l1: 4.5, l2: null, h: 3, quantita: 27 }, { descrizione: 'pulizia', n: 327, formule: { n: '12+250+65' }, quantita: 327 }]
    const t = misureATesto(righe)
    expect(t.split('\n')[0]).toBe('muro nord\t2\t4,5\t\t3\t27')
    const back = testoAMisure(t)
    expect(back[0]).toMatchObject({ descrizione: 'muro nord', n: 2, l1: 4.5, l2: null, h: 3, quantita: 27 })
    expect(back[1]).toMatchObject({ n: 327, formule: { n: '12+250+65' }, quantita: 327 })
  })
  it('da Excel: intestazione scartata, quantità ricalcolata', () => {
    const r = testoAMisure('Descrizione\tN\tL1\tL2\tH\tQ\r\nPiano terra\t1\t10\t5\t\t999\r\n\r\nvani\t-2\t1,2\t\t2,1')
    expect(r).toHaveLength(2)
    expect(r[0]).toMatchObject({ descrizione: 'Piano terra', n: 1, l1: 10, l2: 5, h: null, quantita: 50 })
    expect(r[1].quantita).toBe(-5.04)
  })
  it('sposta e copia', () => {
    const a = [1, 2, 3]
    expect(spostaRiga(a, 0, 1)).toBe(1); expect(a).toEqual([2, 1, 3])
    const r: MisurazioneRiga[] = [{ quantita: 1, formule: { n: '1' } }]
    const c = copiaRighe(r); c[0].formule!.n = '2'
    expect(r[0].formule!.n).toBe('1')
  })
})


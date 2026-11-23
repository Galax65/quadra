import { describe, it, expect } from 'vitest'
import { isFvg, parseFvg } from '../../src/tools/computo/engine/parsers/fvg'

// Estratto della struttura del prezzario FVG 2026/1 (descrizioni accorciate).
const grid: unknown[][] = [
  ['       Prezzario regionale dei lavori pubblici Friuli Venezia Giulia 2026/1  (descrizioni estese)'],
  ['Codice', 'Breve', 'Estesa', 'Voce', 'Cod. U.M.', 'Des. U.M.', 'Prezzo', 'Pz. Man.', '% Man.'],
  ['01', 'OPERE PROVVISIONALI', '', '', '', '', '', '', ''],
  ['01.1', 'PUNTELLAZIONI', '', '', '', '', '', '', ''],
  ['01.1.AB1', 'PUNTELLAZIONE LAVORI EDILIZI', '', '', '', '', '', '', ''],
  ['01.1.AB1.01', 'PUNTELLAZIONE DI STRUTTURE ORIZZONTALI', 'Puntellazione di strutture orizzontali di qualsiasi tipo.', 'x', '', '', '', '', ''],
  ['01.1.AB1.01.A', 'Puntellazione di travi e solai', '', '', 'M2', 'm²', '27.32', '7.96', '29.13'],
  ['01.1.AB1.01.B', 'Per ogni metro in più oltre i primi 3 m', '', '', 'M2', 'm²', '9.8', '3.18', '32.48'],
  ['01.1.AB1.02', 'PUNTELLAZIONI DI STRUTTURE VERTICALI', 'Puntellazioni di strutture murarie verticali.', 'x', 'M2', 'm²', '62.09', '7.96', '12.82'],
  ['', '', '', '', '', '', '', '', ''],
]

describe('parseFvg — prezzario Friuli Venezia Giulia (xlsx descrizioni estese)', () => {
  const res = parseFvg(grid)

  it('riconosce il formato', () => {
    expect(isFvg(grid)).toBe(true)
    expect(isFvg([['Codice', 'Descrizione', 'UM', 'Prezzo']])).toBe(false)
  })

  it('edizione dal titolo, regione di default', () => {
    expect(res.anno).toBe('2026/1')
    expect(res.regione).toBe('Friuli V.G.')
  })

  it('una riga per ogni codice con prezzo, a 4 o 5 segmenti', () => {
    expect(res.rows.map(r => r.codice)).toEqual(['01.1.AB1.01.A', '01.1.AB1.01.B', '01.1.AB1.02'])
  })

  it('sottovoce: eredita la descrizione estesa della voce madre', () => {
    const r = res.rows[0]
    expect(r.prezzo).toBeCloseTo(27.32, 2)
    expect(r.ru).toBeCloseTo(29.13, 2)
    expect(r.um).toBe('m²')
    expect(r.declaratoria).toBe('Puntellazione di strutture orizzontali di qualsiasi tipo. – Puntellazione di travi e solai')
    expect(r.desc_short).toBe('PUNTELLAZIONE DI STRUTTURE ORIZZONTALI: Puntellazione di travi e solai')
    expect([r.liv1, r.liv2, r.liv3]).toEqual(['OPERE PROVVISIONALI', 'PUNTELLAZIONI', 'PUNTELLAZIONE LAVORI EDILIZI'])
  })

  it('voce a 4 segmenti con prezzo proprio: usa la sua estesa', () => {
    const r = res.rows[2]
    expect(r.declaratoria).toBe('Puntellazioni di strutture murarie verticali.')
    expect(r.desc_short).toBe('PUNTELLAZIONI DI STRUTTURE VERTICALI')
    expect(r.liv4).toBe('')
  })
})

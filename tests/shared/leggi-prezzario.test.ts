import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as XLSX from 'xlsx'
import { leggiPrezzarioTesto, leggiPrezzarioGriglia, righeDaGrigliaGenerica, numero } from '../../src/shared/prezzari/leggi-file'
import { buildXpwe } from '../../src/shared/xpwe/xpwe'

/**
 * «PORTA IL TUO PREZZARIO» in «Lavoro» (tappa 8): gli stessi lettori della
 * pipeline dei prezzari, per XML regionali, XPWE, Excel e CSV. Un file che
 * nessuno riconosce si dice, non diventa un prezzario vuoto.
 */
describe('i prezzari XML regionali: le famiglie della pipeline', () => {
  it('Veneto: riconosciuto dalle prime righe, con regione e anno dal contenuto', () => {
    const xml = readFileSync(resolve(__dirname, '../computo/fixtures/veneto-sample.xml'), 'utf-8')
    const p = leggiPrezzarioTesto('prezzario.xml', xml)
    expect(p).toMatchObject({ formato: 'veneto', regione: 'Veneto', anno: '2025', tipo: 'pubblico' })
    expect(p.rows.map((r) => r.codice)).toEqual(['VEN25-01.02.01.00', 'VEN25-01.02.02.00'])
  })

  it('un file di analisi prezzi o un XML sconosciuto: errore chiaro', () => {
    expect(() => leggiPrezzarioTesto('a.xml', '<?xml version="1.0"?><analisiPrezzi></analisiPrezzi>')).toThrow(/analisi prezzi, non un prezzario/)
    expect(() => leggiPrezzarioTesto('a.xml', '<?xml version="1.0"?><qualcosa/>')).toThrow(/non riconosciuto/)
  })
})

describe('un elenco prezzi XPWE', () => {
  it('le voci, con anno dal nome del file', () => {
    const x = buildXpwe([{ codice: 'A.01', desc_short: 'Scavo', declaratoria: 'Scavo di sbancamento', um: 'm3', prezzo: 12.5, qty: 1 }])
    const p = leggiPrezzarioTesto('Listino 2026.xpwe', x)
    expect(p).toMatchObject({ formato: 'xpwe', anno: '2026', tipo: 'privato' })
    expect(p.rows[0]).toMatchObject({ codice: 'A.01', prezzo: 12.5, um: 'm3' })
  })
})

describe('un foglio Excel', () => {
  it('il listino di un fornitore: colonne riconosciute dalle intestazioni, anche sotto un titolo', () => {
    const griglia = [
      ['Listino Rossi Srl — gennaio 2026'],
      ['Codice', 'Descrizione', 'U.M.', 'Prezzo unitario'],
      ['R-01', 'Tubo PVC 110', 'm', '12,50'],
      ['R-02', 'Pozzetto 40x40', 'cad', 85],
      ['', 'riga di nota senza codice', '', ''],
      ['R-03', 'Voce senza prezzo', 'cad', ''],
    ]
    const p = leggiPrezzarioGriglia('rossi-2026.xlsx', griglia)
    expect(p).toMatchObject({ formato: 'generico', regione: 'rossi', anno: '2026', tipo: 'privato' })   // senza regione: il nome del file
    expect(p.rows.map((r) => [r.codice, r.desc_short, r.um, r.prezzo])).toEqual([['R-01', 'Tubo PVC 110', 'm', 12.5], ['R-02', 'Pozzetto 40x40', 'cad', 85]])
  })

  it('la voce figlia con la descrizione corta eredita quella del padre; la regione dalla sigla del codice', () => {
    const lunga = 'Scavo di sbancamento eseguito con mezzi meccanici in terreni di qualsiasi natura e consistenza'
    const g = righeDaGrigliaGenerica([
      ['Codice', 'Declaratoria', 'U.M.', 'Prezzo'],
      ['VEN25-01.02', lunga, '', ''],
      ['VEN25-01.02.a', 'fino a 2 m', 'm3', 9.8],
    ])!
    expect(g.regione).toBe('Veneto')
    expect(g.rows[0].declaratoria).toBe(`${lunga}\n\n— fino a 2 m`)
  })

  it('senza le colonne di un prezzario: errore chiaro', () => {
    expect(() => leggiPrezzarioGriglia('x.xlsx', [['a', 'b'], ['c', 'd']])).toThrow(/colonne di un prezzario/)
  })

  it('dal file vero (xlsx) alle righe', () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Codice', 'Descrizione', 'UM', 'Prezzo'], ['F.1', 'Cavo FG16', 'm', 1.234]]), 'L')
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
    const rb = XLSX.read(new Uint8Array(buf), { type: 'array' })
    const griglia = XLSX.utils.sheet_to_json(rb.Sheets[rb.SheetNames[0]], { header: 1, defval: '' }) as unknown[][]
    expect(leggiPrezzarioGriglia('cavi.xlsx', griglia).rows[0].prezzo).toBe(1.234)
  })
})

describe('i numeri delle celle', () => {
  it('numero del foglio o scritto all\'italiana', () => {
    expect([numero('12.5'), numero('1234.567'), numero('1.234,56'), numero('€ 85,00'), numero('')]).toEqual([12.5, 1234.567, 1234.56, 85, 0])
  })
})

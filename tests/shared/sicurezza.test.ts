import { describe, it, expect } from 'vitest'
import { capitoloSicurezza, rigaDiSicurezza, voceDiSicurezza } from '../../src/shared/sicurezza'
import { righeComputo } from '../../src/shared/stampa/computo-pdf'

describe('oneri della sicurezza dal capitolo del prezzario', () => {
  it('riconosce i capitoli della sicurezza di cantiere, non gli impianti di sicurezza', () => {
    expect(capitoloSicurezza('IMPIANTI ED ATTREZZATURE PER LA TUTELA DELLA SALUTE E LA PROTEZIONE DEI LAVORATORI NEL CANTIERE')).toBe(true)
    expect(capitoloSicurezza('Oneri della sicurezza')).toBe(true)
    expect(capitoloSicurezza('COSTI DELLA SICUREZZA')).toBe(true)
    expect(capitoloSicurezza('SISTEMI DI SICUREZZA ELETTRICI')).toBe(false)
    expect(capitoloSicurezza('SISTEMI DI SICUREZZA MECCANICI')).toBe(false)
  })
  it('la scelta manuale vince sul capitolo', () => {
    const riga = { liv1: 'IMPIANTI ED ATTREZZATURE PER LA TUTELA DELLA SALUTE E LA PROTEZIONE DEI LAVORATORI NEL CANTIERE' }
    expect(rigaDiSicurezza(riga)).toBe(true)
    expect(voceDiSicurezza(undefined, undefined, riga)).toBe(true)
    expect(voceDiSicurezza(false, undefined, riga)).toBe(false)
    expect(voceDiSicurezza(true, undefined, { liv1: 'MURATURE' })).toBe(true)
    expect(voceDiSicurezza(undefined, true, null)).toBe(true)
  })
  it('nel computo gli oneri della sicurezza stanno in una sezione a sé, dopo i lavori', () => {
    const righe = righeComputo([
      { codice: '99.1', desc_short: 'Recinzione', prezzo: 4.34, qty: 120, um: 'm²', sicurezza: true, categoria: 'Edificio' },
      { codice: '22.1', desc_short: 'Muratura', prezzo: 80, qty: 10, um: 'm²', categoria: 'Edificio' },
    ] as any)
    const t = righe.map((r) => r.celle.tariffa || r.celle.desc)
    expect(t.indexOf('LAVORI')).toBeLessThan(t.indexOf('22.1'))
    expect(t.indexOf('22.1')).toBeLessThan(t.indexOf('ONERI DELLA SICUREZZA — non soggetti a ribasso'))
    expect(t.indexOf('ONERI DELLA SICUREZZA — non soggetti a ribasso')).toBeLessThan(t.indexOf('99.1'))
    // la categoria si ripete come titolo dentro la sezione
    expect(t.filter((x) => x === 'EDIFICIO')).toHaveLength(2)
    expect(righe.find((r) => r.celle.desc === 'Totale oneri della sicurezza')?.celle.tot).toBe('520,80')
  })
})

describe('riepilogo con la sicurezza a parte', () => {
  it('il computo con categorie e sicurezza si stampa con i riepiloghi divisi', async () => {
    const lib = await import('pdf-lib')
    const { computoPdf } = await import('../../src/shared/stampa/computo-pdf')
    const voci: any[] = [
      { codice: '22.1', desc_short: 'Muratura', prezzo: 80, qty: 10, um: 'm²', categoria: 'Edificio · Murature', wbs: '01' },
      { codice: '99.1', desc_short: 'Recinzione', prezzo: 4.34, qty: 120, um: 'm²', sicurezza: true, categoria: 'Edificio · Recinzioni', wbs: '02' },
    ]
    const r = await computoPdf(lib, voci, {}, { riepilogo: 'entrambi' })
    expect(r.totale).toBe(1320.8)
    expect(r.pagine).toBeGreaterThan(0)
  })
})

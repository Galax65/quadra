import { describe, it, expect } from 'vitest'
import {
  totaleSottoComputo, quadraturaSottoComputo, eseguitoSottoComputo, quotaDaSottoComputo,
  quotaAttestata, sottoComputoCongelato, haSottoComputo, corpiConSottoComputo, librettoSottoComputiHTML,
} from '../../src/tools/contabilita/engine/sotto-computo'
import { eseguitoPartita, calcolaSals } from '../../src/tools/contabilita/engine/contabilita'
import type { Appalto, Partita, Sal } from '../../src/tools/contabilita/engine/types'

/**
 * In un appalto a corpo la domanda è sempre «da dove viene quel 35%?». Il
 * sotto-computo è la risposta: il corpo si scompone, si misura quanto di
 * ciascuna lavorazione è eseguito, e la quota ne discende. Due cose contano:
 * che l'importo non passi per una percentuale arrotondata, e che una
 * scomposizione già usata da un SAL firmato non si possa più cambiare.
 */
const corpo = (): Partita => ({
  id: 'c1', modalita: 'corpo', codice: 'C.1', descrizione: 'Struttura in c.a.', importoContrattuale: 120000, introdottaSal: 1,
  sottoComputo: [
    { id: 's1', codice: 'A.1', descrizione: 'Fondazioni', um: 'mc', qty: 200, prezzo: 180 },
    { id: 's2', codice: 'A.2', descrizione: 'Pilastri e travi', um: 'mc', qty: 150, prezzo: 320 },
    { id: 's3', codice: 'A.3', descrizione: 'Solai', um: 'mq', qty: 600, prezzo: 60 },
  ],
})
const sal = (x: Partial<Sal> = {}): Sal => ({
  numero: 1, data: '01/07/2026',
  righe: [{ partitaId: 'c1', quotaPct: 40.67, sotto: [{ voceId: 's1', quantitaProgressiva: 200 }, { voceId: 's2', quantitaProgressiva: 40 }] }],
  ...x,
})
const appalto: Appalto = { oggetto: 'Palestra', ente: { denominazione: 'Comune' }, impresa: { denominazione: 'Impresa' }, modalita: 'corpo' }

describe('il sotto-computo di un corpo', () => {
  it('somma le lavorazioni e quadra con l\'importo del corpo', () => {
    expect(totaleSottoComputo(corpo())).toBe(120000)
    expect(quadraturaSottoComputo(corpo()).quadra).toBe(true)
  })
  it('se non quadra lo dice, e non riscala di nascosto', () => {
    const p = corpo(); p.sottoComputo![0].qty = 100 // −18.000
    const q = quadraturaSottoComputo(p)
    expect(q.quadra).toBe(false)
    expect(q.scostamento).toBe(-18000)
    expect(totaleSottoComputo(p)).toBe(102000)
  })
  it('misura l\'eseguito lavorazione per lavorazione', () => {
    expect(eseguitoSottoComputo(corpo(), sal().righe[0])).toBe(48800)
  })
  it('la quota discende dal rapporto fra eseguito e totale', () => {
    expect(quotaDaSottoComputo(corpo(), sal().righe[0])).toBe(40.67)
  })
  it('senza scomposizione non si inventa una quota', () => {
    const p: Partita = { id: 'x', modalita: 'corpo', codice: 'C.2', descrizione: 'Impianti', importoContrattuale: 1000 }
    expect(haSottoComputo(p)).toBe(false)
    expect(quotaDaSottoComputo(p, sal().righe[0])).toBeNull()
  })
  it('le misure di dettaglio valgono quanto la quantità scritta a mano', () => {
    const s = sal()
    s.righe[0].sotto![1] = { voceId: 's2', misurazioni: [{ descrizione: 'pilastri', quantita: 25 }, { descrizione: 'travi', quantita: 15 }] }
    expect(eseguitoSottoComputo(corpo(), s.righe[0])).toBe(48800)
  })
})

describe("l'importo non passa per la percentuale arrotondata", () => {
  it('vale l\'eseguito misurato, non quota% × corpo', () => {
    // 40,67% di 120.000 darebbe 48.804: quattro euro nati da un arrotondamento
    expect(eseguitoPartita(corpo(), sal().righe[0], 1)).toBe(48800)
  })
  it('senza sotto-computo resta la quota attestata', () => {
    const p: Partita = { id: 'c1', modalita: 'corpo', codice: 'C.1', descrizione: 'Corpo', importoContrattuale: 120000 }
    expect(eseguitoPartita(p, { partitaId: 'c1', quotaPct: 40.67 }, 1)).toBe(48804)
  })
  it('il SAL complessivo usa lo stesso importo', () => {
    const res = calcolaSals(appalto, [corpo()], [sal()])
    expect(res[0].lavoriEseguiti).toBe(48800)
  })
})

describe('quando un SAL firmato lo usa, la scomposizione si congela', () => {
  it('un SAL firmato che ne registra l\'avanzamento la blocca', () => {
    expect(sottoComputoCongelato(corpo(), [sal({ firmato: true })])).toBe(true)
  })
  it('finché i SAL sono aperti si può correggere', () => {
    expect(sottoComputoCongelato(corpo(), [sal()])).toBe(false)
  })
  it('negli atti vale la quota attestata nel SAL, non quella ricalcolata dopo', () => {
    const s = sal({ firmato: true })
    s.righe[0].quotaPct = 40.67
    const dopo = corpo(); dopo.sottoComputo![2].prezzo = 100 // qualcuno cambia il prezzo dopo
    expect(quotaAttestata(dopo, s.righe[0])).toBe(40.67)
  })
})

describe('il libretto dei sotto-computi', () => {
  it('stampa le lavorazioni, l\'eseguito e la quota che ne discende', () => {
    const html = librettoSottoComputiHTML(appalto, [corpo()], sal())
    expect(html).toContain('Fondazioni')
    expect(html).toContain('48.800,00')
    expect(html).toContain('40,67%')
    expect(html).toContain('dimostra')
  })
  it('dichiara lo scarto quando la scomposizione di oggi non darebbe la quota attestata', () => {
    const s = sal({ firmato: true })
    const dopo = corpo(); dopo.sottoComputo![1].prezzo = 400
    const html = librettoSottoComputiHTML(appalto, [dopo], s)
    expect(html).toContain('Negli atti vale l\'attestazione del SAL')
  })
  it('compare solo per i corpi davvero scomposti', () => {
    const semplice: Partita = { id: 'x', modalita: 'corpo', codice: 'C.9', descrizione: 'Impianti', importoContrattuale: 500 }
    expect(corpiConSottoComputo([corpo(), semplice], 1).map((p) => p.id)).toEqual(['c1'])
  })
})

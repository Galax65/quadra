/**
 * Il giornale dà conto anche degli ATTI del periodo: ordini di servizio,
 * sospensioni, stati di avanzamento, riserve. Non li ricopia — sarebbero due
 * verità diverse dello stesso fatto — li intercala alle annotazioni, alla loro
 * data, dichiarandoli per quello che sono.
 */
import { describe, it, expect } from 'vitest'
import { vociGiornale, vociNelPeriodo, giornaleHTML } from '../../src/tools/contabilita/engine/giornale'
import type { Appalto, RigaGiornale, Sal, Verbale, Riserva } from '../../src/tools/contabilita/engine/types'

const a: Appalto = { oggetto: 'Lavori di prova', ente: { denominazione: 'Comune di Prova' }, impresa: { denominazione: 'Impresa Y' }, modalita: 'misura', direttoreLavori: 'ing. Prova' }
const righe: RigaGiornale[] = [
  { data: '18/11/2025', meteo: 'sereno', manodopera: '2 operai', mezzi: 'escavatore', lavorazioni: 'Scavo di sbancamento' },
  { data: '05/12/2025', lavorazioni: 'Getto della platea' },
]
const verbali: Verbale[] = [
  { id: 'v1', tipo: 'consegna', data: '17/11/2025' },
  { id: 'v2', tipo: 'sospensione', data: '01/12/2025', motivo: 'gelo' },
]
const sals: Sal[] = [{ numero: 1, data: '09/01/2026', righe: [], firmato: true }]
const riserve: Riserva[] = [{ numero: 1, data: '09/01/2026', oggetto: 'Maggiori oneri per il gelo' }]

describe('giornale dei lavori', () => {
  it('annotazioni e atti stanno insieme, in ordine di data', () => {
    const v = vociGiornale(righe, sals, verbali, riserve)
    expect(v.map((x) => x.data)).toEqual(['17/11/2025', '18/11/2025', '01/12/2025', '05/12/2025', '09/01/2026', '09/01/2026'])
    expect(v[0].origine).toBe('atto')
    expect(v[1].origine).toBe('annotazione')
  })
  it('gli atti si riconoscono e portano il loro motivo', () => {
    const v = vociGiornale(righe, sals, verbali, riserve)
    const sosp = v.find((x) => x.testo.includes('sospensione'))
    expect(sosp?.origine).toBe('atto')
    expect(sosp?.note).toBe('gelo')
  })
  it('il periodo si può restringere', () => {
    const v = vociNelPeriodo(vociGiornale(righe, sals, verbali, riserve), '01/12/2025', '31/12/2025')
    expect(v.length).toBe(2)
  })
  it('la stampa raggruppa per mese e conta che cosa contiene', () => {
    const h = giornaleHTML(a, righe, sals, verbali, riserve)
    expect(h).toContain('Novembre 2025')
    expect(h).toContain('Dicembre 2025')
    expect(h).toContain('2 annotazioni')
    expect(h).toContain('4 atti richiamati')
  })
  it('senza annotazioni lo dice, invece di stampare una tabella vuota', () => {
    expect(giornaleHTML(a, [])).toContain('Nessuna annotazione')
  })
})

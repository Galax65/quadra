import { describe, expect, it } from 'vitest'
import * as lib from 'pdf-lib'
import { registroInBiancoPdf, registroInBiancoHtml } from '../../src/tools/contabilita/engine'
import type { Appalto } from '../../src/tools/contabilita/engine'

/**
 * Il registro di contabilità è UNO SOLO, a fogli numerati, bollati e vidimati
 * PRIMA dell'inizio dei lavori (art. 2215 c.c.). È il foglio che serve in
 * cantiere e che nessun programma stampa: pagine vere, rigate e numerate, da
 * far firmare prima di scriverci sopra.
 */
const A: Appalto = {
  oggetto: 'Rifacimento copertura', ente: { denominazione: 'Comune' }, impresa: { denominazione: 'Impresa' },
  modalita: 'misura', cig: 'ABC123', cup: 'X11',
}

describe('registro in bianco da vidimare', () => {
  it('produce esattamente i fogli richiesti', async () => {
    expect((await registroInBiancoPdf(lib, A, 8)).pagine).toBe(8)
    expect((await registroInBiancoPdf(lib, A, 1)).pagine).toBe(1)
  })
  it('non scende sotto un foglio né sale oltre il limite ragionevole', async () => {
    expect((await registroInBiancoPdf(lib, A, 0)).pagine).toBe(1)
    expect((await registroInBiancoPdf(lib, A, -5)).pagine).toBe(1)
    expect((await registroInBiancoPdf(lib, A, 900)).pagine).toBe(500)
  }, 60000)
  it('è un PDF vero, non un file vuoto', async () => {
    const r = await registroInBiancoPdf(lib, A, 3)
    expect(r.bytes.length).toBeGreaterThan(1000)
    expect(new TextDecoder().decode(r.bytes.slice(0, 5))).toBe('%PDF-')
  })
  it('a schermo mostra la dichiarazione di vidimazione e quanti fogli saranno', () => {
    const html = registroInBiancoHtml(A, 12)
    expect(html).toContain('12 fogli')
    expect(html).toContain('vidimare')
    expect(html).toContain("PRIMA dell'inizio dei lavori")
    expect(html).toContain('Il Direttore dei Lavori')
  })
})

import { describe, it, expect } from 'vitest'
import { ammissibilitaSemplificata, inSemplificata, totaliFatture, corrispondenza, vistoFatturaHTML, notaSemplificata, SOGLIA_SEMPLIFICATA } from '../../src/tools/contabilita/engine/semplificata'
import type { Appalto, Fattura, Partita, Sal } from '../../src/tools/contabilita/engine/types'

/**
 * Contabilità semplificata (art. 12 c. 11-bis All. II.14): consentita **solo
 * per i lavori** sotto i 40.000 euro, e solo previa verifica della
 * corrispondenza fra lavoro svolto e fatturato. «Semplificata» non vuol dire
 * «senza verifica»: è proprio la verifica che la norma chiede.
 */
const partite = (prezzo: number): Partita[] => [
  { id: 'a', modalita: 'misura', codice: 'A.1', descrizione: 'Scavo', um: 'mc', prezzoUnitario: prezzo, qtyProgetto: 100, introdottaSal: 1 },
]
const appalto = (x: Partial<Appalto> = {}): Appalto => ({
  oggetto: 'Manutenzione', ente: { denominazione: 'Comune' }, impresa: { denominazione: 'Impresa' }, modalita: 'misura', ivaPct: 10, ...x,
})
const sals = (qty: number): Sal[] => [{ numero: 1, data: '01/07/2026', righe: [{ partitaId: 'a', quantitaProgressiva: qty }] }]

describe('quando è ammessa', () => {
  it('lavori sotto i 40.000: ammessa', () => {
    const am = ammissibilitaSemplificata(appalto(), partite(300))
    expect(am.ammessa).toBe(true)
    expect(am.importo).toBe(30000)
  })
  it('lavori sopra la soglia: non ammessa, e dice l\'importo', () => {
    const am = ammissibilitaSemplificata(appalto(), partite(500))
    expect(am.ammessa).toBe(false)
    expect(am.motivo).toContain('50.000,00')
  })
  it('esattamente 40.000 non è «inferiore a»: non ammessa', () => {
    expect(ammissibilitaSemplificata(appalto(), partite(400)).ammessa).toBe(false)
    expect(SOGLIA_SEMPLIFICATA).toBe(40000)
  })
  it('servizi e forniture: mai, anche sotto soglia', () => {
    const am = ammissibilitaSemplificata(appalto({ tipologia: 'servizi' }), partite(100))
    expect(am.ammessa).toBe(false)
    expect(am.motivo).toContain('certificato di regolare esecuzione')
  })
  it('senza importo contrattuale non si può decidere', () => {
    expect(ammissibilitaSemplificata(appalto(), []).motivo).toContain('non è ancora determinato')
  })
  it('attiva solo se scelta E ammessa', () => {
    expect(inSemplificata(appalto({ contabilitaSemplificata: true }), partite(300))).toBe(true)
    expect(inSemplificata(appalto({ contabilitaSemplificata: true }), partite(500))).toBe(false)
    expect(inSemplificata(appalto(), partite(300))).toBe(false)
  })
})

describe('fatture e verifica della corrispondenza', () => {
  const fatture: Fattura[] = [
    { id: 'f1', numero: '1/2026', data: '10/07/2026', importo: 12000, vistoData: '12/07/2026' },
    { id: 'f2', numero: '2/2026', data: '10/08/2026', importo: 6000 },
  ]
  it('somma fatturato e vistato', () => {
    expect(totaliFatture(fatture)).toEqual({ fatturato: 18000, vistato: 12000, daVistare: 6000 })
  })
  it('confronta il fatturato con i lavori contabilizzati', () => {
    const c = corrispondenza(appalto(), partite(300), sals(50), fatture)
    expect(c.eseguito).toBe(15000)
    expect(c.fatturato).toBe(18000)
    expect(c.scostamento).toBe(3000)
  })
  it('il visto avverte quando il fatturato eccede l\'eseguito', () => {
    const html = vistoFatturaHTML(appalto({ contabilitaSemplificata: true }), fatture[1], partite(300), sals(50), fatture)
    expect(html).toContain("eccede l'eseguito")
    expect(html).toContain('3.000,00')
  })
  it('dichiara di sostituire il CRE solo quando lo si è scelto', () => {
    const base = { ...fatture[0] }
    expect(vistoFatturaHTML(appalto(), base, partite(300), sals(50), fatture)).toContain('<b>non sostituisce</b>')
    expect(vistoFatturaHTML(appalto(), { ...base, sostituisceCre: true }, partite(300), sals(50), fatture)).toContain('sostituisce il certificato di regolare esecuzione')
  })
  it('se la semplificata non è ammessa, il visto lo dice in testa', () => {
    const html = vistoFatturaHTML(appalto(), fatture[0], partite(500), sals(50), fatture)
    expect(html).toContain('non può sostituire il certificato di regolare esecuzione')
  })
  it('scrive l\'importo in lettere, come gli altri atti di pagamento', () => {
    expect(vistoFatturaHTML(appalto(), fatture[0], partite(300), sals(50), fatture)).toContain('dodicimila/00')
  })
})

describe('la dichiarazione sugli atti', () => {
  it('compare solo quando il regime è davvero attivo', () => {
    expect(notaSemplificata(appalto({ contabilitaSemplificata: true }), partite(300))).toContain('art. 12 c. 11-bis')
    expect(notaSemplificata(appalto({ contabilitaSemplificata: true }), partite(500))).toBe('')
    expect(notaSemplificata(appalto(), partite(300))).toBe('')
  })
})

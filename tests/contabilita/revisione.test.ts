import { describe, expect, it } from 'vitest'
import { calcolaSals, compensazioneRevisione, parametriRevisione, type Appalto, type Partita, type Sal } from '../../src/tools/contabilita/engine'

const P: Partita[] = [{ id: 'm', modalita: 'misura', codice: 'A.01', descrizione: 'Scavo', um: 'm³', prezzoUnitario: 100, qtyProgetto: 100 }]
const base = (x: Partial<Appalto> = {}): Appalto => ({ oggetto: 'x', ente: { denominazione: 'E' }, impresa: { denominazione: 'I' }, modalita: 'misura', ...x })

describe('revisione prezzi (art. 60, All. II.2-bis)', () => {
  it('soglie e quote di default: lavori 3% / 90%, servizi e forniture 5% / 80%', () => {
    expect(parametriRevisione(base())).toEqual({ sogliaPct: 3, quotaPct: 90 })
    expect(parametriRevisione(base({ tipologia: 'forniture' }))).toEqual({ sogliaPct: 5, quotaPct: 80 })
  })

  it('sotto soglia niente; sopra soglia il 90% dell\'eccedenza, anche in diminuzione', () => {
    const a = base({ revisione: { attiva: true, indiceBase: 100 } })
    expect(compensazioneRevisione(a, 10_000, 102.5).importo).toBe(0)
    const su = compensazioneRevisione(a, 10_000, 108) // +8% → (8−3)×90% = 4,5%
    expect(su.attivata).toBe(true)
    expect(su.importo).toBe(450)
    expect(compensazioneRevisione(a, 10_000, 95).importo).toBe(-180) // −5% → −(2×90%) = −1,8%
    expect(compensazioneRevisione(base(), 10_000, 108).importo).toBe(0) // clausola non attiva
  })

  it('nei SAL si applica ai soli lavori del periodo, con l\'indice del SAL, e cumula', () => {
    const sals: Sal[] = [
      { numero: 1, righe: [{ partitaId: 'm', quantitaProgressiva: 40 }], indiceRevisione: 102 },
      { numero: 2, righe: [{ partitaId: 'm', quantitaProgressiva: 100 }], indiceRevisione: 110 },
    ]
    const r = calcolaSals(base({ revisione: { attiva: true, indiceBase: 100 } }), P, sals)
    expect(r[0].revisioneSal).toBe(0)
    expect(r[1].revisioneSal).toBe(378) // 6.000 × (10−3)×90% = 6,3%
    expect(r[1].revisioneProgressiva).toBe(378)
    expect(r[1].totaleEseguito).toBe(10_378)
  })
})

describe('certificato arrotondato per difetto (come d’uso)', () => {
  it('il credito si arrotonda a 100 €, la differenza matura nel certificato successivo', () => {
    const P2: Partita[] = [{ id: 'm', modalita: 'misura', codice: 'A.01', descrizione: 'x', um: 'm', prezzoUnitario: 10, qtyProgetto: 1000 }]
    const sals: Sal[] = [
      { numero: 1, righe: [{ partitaId: 'm', quantitaProgressiva: 123.45 }] },
      { numero: 2, righe: [{ partitaId: 'm', quantitaProgressiva: 300 }] },
    ]
    const r = calcolaSals(base({ arrotondamentoCertificato: 100 }), P2, sals)
    expect(r[0].creditoSal).toBe(1228.33)   // 1.234,50 − 0,5%
    expect(r[0].importoSal).toBe(1200)
    expect(r[1].salPrecedenti).toBe(1200)
    expect(r[1].creditoSal).toBe(1785)      // 2.985,00 − 1.200,00
    expect(r[1].importoSal).toBe(1700)
  })
})

describe('totale contrattuale con sicurezza in partita', () => {
  it('ribassa solo i lavori, non i costi della sicurezza', async () => {
    const { totaleContrattuale } = await import('../../src/tools/contabilita/engine/contabilita')
    const partite: any[] = [
      { id: 'a', codice: 'A', descrizione: 'Scavo', um: 'm³', modalita: 'misura', prezzoUnitario: 100, qtyProgetto: 1000 },
      { id: 's', codice: 'S', descrizione: 'Sicurezza', um: '%', modalita: 'misura', prezzoUnitario: 5000, qtyProgetto: 100, sicurezza: true },
    ]
    // 100.000 × 0,99 + 5.000 (UM % → 5000×100/100)
    expect(totaleContrattuale({ ribassoPct: 1 } as any, partite)).toBe(104000)
  })
})

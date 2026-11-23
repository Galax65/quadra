import { describe, expect, it } from 'vitest'
import * as lib from 'pdf-lib'
import { elencoPrezziPdf, interoInLettere, prezzoInLettere, quadroEconomicoPdf, stimaLavoriPdf, vociElenco } from '../../src/shared/stampa/progetto-pdf'
import { calcolaQE, normalizzaQE, righeBPredefinite } from '../../src/shared/quadro-economico'
import type { VoceComputo } from '../../src/shared/xpwe/xpwe'

const VOCI: VoceComputo[] = [
  { codice: 'A.01', desc_short: 'Scavo', declaratoria: 'Scavo di sbancamento', um: 'm³', prezzo: 10.41, qty: 100 },
  { codice: 'B.02', desc_short: 'Cordolo', um: 'm', prezzo: 25.5, qty: 4 },
  { codice: 'A.01', desc_short: 'Scavo', um: 'm³', prezzo: 10.41, qty: 20 },
  { codice: 'S.01', desc_short: 'Recinzione di cantiere', um: 'm', prezzo: 12, qty: 50, sicurezza: true },
]

describe('numeri in lettere', () => {
  it('interi e prezzi all\'italiana', () => {
    expect(interoInLettere(21)).toBe('ventuno')
    expect(interoInLettere(38)).toBe('trentotto')
    expect(interoInLettere(180)).toBe('centottanta')
    expect(interoInLettere(1250)).toBe('milleduecentocinquanta')
    expect(interoInLettere(2001)).toBe('duemilauno')
    expect(interoInLettere(1_000_000)).toBe('unmilione')
    expect(prezzoInLettere(10.41)).toBe('dieci/41')
    expect(prezzoInLettere(0.5)).toBe('zero/50')
  })
})

describe('quadro economico', () => {
  it('A1, A2 e somme a disposizione a percentuale o importo, anche su altre righe B', () => {
    const qe = normalizzaQE({ sicurezzaExtra: 400, righeB: [
      { codice: 'B1', descrizione: 'IVA lavori', tipo: 'percentuale', valore: 10, base: 'A' },
      { codice: 'B2', descrizione: 'Spese tecniche', tipo: 'importo', valore: 1000 },
      { codice: 'B3', descrizione: 'Cassa', tipo: 'percentuale', valore: 4, base: 'B2' },
      { codice: 'B4', descrizione: 'IVA tecnica', tipo: 'percentuale', valore: 22, base: 'B2+B3' },
    ] })
    const r = calcolaQE(qe, 10_000, 600)
    expect(r.a1).toBe(9400)
    expect(r.a2).toBe(1000)
    expect(r.a).toBe(10400)
    expect(r.righeB.map(x => x.importo)).toEqual([1040, 1000, 40, 228.8])
    expect(r.b).toBe(2308.8)
    expect(r.totale).toBe(12708.8)
  })
  it('senza dati propone le somme a disposizione tipiche', () => {
    expect(normalizzaQE(undefined).righeB).toEqual(righeBPredefinite())
  })
})

describe('stampe di progetto', () => {
  it('l\'elenco prezzi ha una voce per codice', async () => {
    expect(vociElenco(VOCI).map(v => v.codice)).toEqual(['A.01', 'B.02', 'S.01'])
    const r = await elencoPrezziPdf(lib, VOCI)
    expect(r.n).toBe(3)
    expect(r.pagine).toBe(1)
  })
  it('stima lavori e quadro economico si generano', async () => {
    const s = await stimaLavoriPdf(lib, VOCI)
    expect(s.totale).toBe(r2(1041 + 102 + 208.2 + 600))
    const q = await quadroEconomicoPdf(lib, calcolaQE(normalizzaQE(undefined), s.totale, 600))
    expect(q.pagine).toBe(1)
    expect(q.bytes.length).toBeGreaterThan(1000)
  })
})
function r2(n: number): number { return Math.round(n * 100) / 100 }

describe('verbale dei nuovi prezzi', () => {
  it('stampa i NP con il codice d\'origine', async () => {
    const lib = await import('pdf-lib')
    const { verbaleNuoviPrezziPdf } = await import('../../src/shared/stampa/progetto-pdf')
    const r = await verbaleNuoviPrezziPdf(lib, [{ codice: 'NP.001', desc_short: 'Gradini', um: 'cad', prezzo: 260, np: true, codiceOrig: 'A.01' }] as any, { oggetto: 'Prova' })
    expect(r.n).toBe(1)
    expect(r.pagine).toBe(1)
  })
})

describe('incidenza della manodopera', () => {
  it('costo e incidenza dalla % di manodopera delle voci', async () => {
    const lib = await import('pdf-lib')
    const { calcolaIncidenzaMdo, incidenzaManodoperaPdf } = await import('../../src/shared/stampa/progetto-pdf')
    const voci: any[] = [
      { codice: 'A', desc_short: 'Scavo', um: 'm³', prezzo: 10, qty: 100, incMdo: 40 },
      { codice: 'B', desc_short: 'Muro', um: 'm²', prezzo: 50, qty: 20, incMdo: 30 },
      { codice: 'C', desc_short: 'Fornitura', um: 'cad', prezzo: 100, qty: 1 },
    ]
    const c = calcolaIncidenzaMdo(voci)
    // 1000×40% + 1000×30% = 700 su 2100
    expect([c.totale, c.mdo, c.incidenza, c.senzaDato]).toEqual([2100, 700, 33.33, 1])
    const r = await incidenzaManodoperaPdf(lib, voci, {})
    expect(r.pagine).toBe(1)
  })
})

describe('incidenza della manodopera: titoli e riepiloghi come nel computo', () => {
  const voci: any[] = [
    { codice: 'A', desc_short: 'Scavo', prezzo: 10, qty: 100, incMdo: 40, categoria: 'Edificio · Opere edili · Scavi', wbs: '01.01' },
    { codice: 'B', desc_short: 'Quadro', prezzo: 50, qty: 20, incMdo: 30, categoria: 'Cabina · Impianti', wbs: '02' },
    { codice: 'C', desc_short: 'Muro', prezzo: 100, qty: 1, incMdo: 50, categoria: 'Edificio · Opere edili · Murature', wbs: '01.02' },
  ]
  it('riepilogo per categorie: padri prima dei figli, con importo, manodopera e %', async () => {
    const { riepilogoMdo } = await import('../../src/shared/stampa/progetto-pdf')
    const r = riepilogoMdo(voci, 'categorie')
    expect(r.map((g) => [g.livello, g.titolo])).toEqual([
      [0, 'Edificio'], [1, 'Opere edili'], [2, 'Scavi'], [2, 'Murature'], [0, 'Cabina'], [1, 'Impianti'],
    ])
    expect(r[0]).toMatchObject({ importo: 1100, mdo: 450, incidenza: 40.91 })
  })
  it('riepilogo per WBS con le descrizioni dei nodi', async () => {
    const { riepilogoMdo } = await import('../../src/shared/stampa/progetto-pdf')
    const r = riepilogoMdo(voci, 'wbs', { '01': 'Edile', '02': 'Elettrico' })
    expect(r.map((g) => g.titolo)).toEqual(['01 Edile', '01.01', '01.02', '02 Elettrico'])
    expect(r[3]).toMatchObject({ importo: 1000, mdo: 300, incidenza: 30 })
  })
  it('il PDF si genera con ogni combinazione di ordine e riepilogo', async () => {
    const lib = await import('pdf-lib')
    const { incidenzaManodoperaPdf } = await import('../../src/shared/stampa/progetto-pdf')
    for (const raggruppa of ['categorie', 'wbs', 'manuale'] as const) {
      for (const riepilogo of ['entrambi', 'categorie', 'wbs', 'nessuno'] as const) {
        const r = await incidenzaManodoperaPdf(lib, voci, {}, { raggruppa, riepilogo })
        expect(r.incidenza).toBe(35.71) // (400+300+50)/2100
      }
    }
  })
})

describe('stampe di progetto: lista lavorazioni, elenco NP, incidenza sicurezza, computo senza prezzi', () => {
  const voci: any[] = [
    { codice: 'A.01', desc_short: 'Scavo', um: 'm³', prezzo: 10, qty: 100 },
    { codice: 'NP.001', desc_short: 'Muro speciale', um: 'm²', prezzo: 55.5, qty: 10, np: true, codiceOrig: 'B.02' },
    { codice: '99.1', desc_short: 'Recinzione', um: 'm', prezzo: 5, qty: 40, sicurezza: true },
  ]
  it('lista delle lavorazioni: senza le voci di sicurezza, prezzi vuoti', async () => {
    const lib = await import('pdf-lib')
    const { listaLavorazioniPdf } = await import('../../src/shared/stampa/progetto-pdf')
    const r = await listaLavorazioniPdf(lib, voci, {})
    expect(r.n).toBe(2)
    expect(r.pagine).toBe(1)
  })
  it('incidenza della sicurezza sui lavori', async () => {
    const lib = await import('pdf-lib')
    const { incidenzaSicurezzaPdf } = await import('../../src/shared/stampa/progetto-pdf')
    const r = await incidenzaSicurezzaPdf(lib, voci, {})
    // 200 su 1000 + 555 + 200 = 1755
    expect([r.n, r.sicurezza, r.incidenza]).toEqual([1, 200, 11.4])
  })
  it('elenco dei nuovi prezzi con titolo proprio', async () => {
    const lib = await import('pdf-lib')
    const { elencoPrezziPdf } = await import('../../src/shared/stampa/progetto-pdf')
    const r = await elencoPrezziPdf(lib, voci.filter((v) => v.np), {}, { titolo: 'ELENCO DEI NUOVI PREZZI' })
    expect(r.n).toBe(1)
  })
  it('computo senza prezzi: nessun importo nelle righe', async () => {
    const lib = await import('pdf-lib')
    const { computoPdf, righeComputo } = await import('../../src/shared/stampa/computo-pdf')
    const righe = righeComputo(voci, {}, { senzaPrezzi: true })
    expect(righe.some((x) => x.celle.tot || x.celle.unit || x.importo)).toBe(false)
    const r = await computoPdf(lib, voci, {}, { senzaPrezzi: true })
    expect(r.pagine).toBeGreaterThan(0)
  })
})

describe('computo: descrizione ridotta inclusa a scelta', () => {
  const v: any[] = [
    { codice: 'A', desc_short: 'Muratura in blocchi', declaratoria: 'Fornitura e posa di blocchi di argilla…', prezzo: 10, qty: 1 },
    { codice: 'B', desc_short: 'SCAVO', declaratoria: 'SCAVO di sbancamento…', prezzo: 10, qty: 1 },
  ]
  it('di default solo l\'estesa', async () => {
    const { righeComputo } = await import('../../src/shared/stampa/computo-pdf')
    expect(righeComputo(v).some((r) => r.celle.desc === 'Muratura in blocchi')).toBe(false)
  })
  it('con conRidotta: ridotta in grassetto sopra l\'estesa, non ripetuta se l\'estesa comincia con lei', async () => {
    const { righeComputo } = await import('../../src/shared/stampa/computo-pdf')
    const r = righeComputo(v, {}, { conRidotta: true })
    const i = r.findIndex((x) => x.celle.desc === 'Muratura in blocchi')
    expect(r[i]).toMatchObject({ grassetto: true, celle: { n: '1', tariffa: 'A' } })
    expect(r[i + 1].celle.desc).toMatch(/^Fornitura e posa/)
    expect(r.some((x) => x.celle.desc === 'SCAVO')).toBe(false)
  })
})

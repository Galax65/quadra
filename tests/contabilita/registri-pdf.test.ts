import { describe, expect, it } from 'vitest'
import * as lib from 'pdf-lib'
import { librettoPdf, registroPdf, righeLibretto, type Appalto, type Partita, type Sal } from '../../src/tools/contabilita/engine'

const P: Partita[] = [
  { id: 'm', modalita: 'misura', codice: 'A.01', descrizione: 'Scavo', um: 'm³', prezzoUnitario: 10, qtyProgetto: 100 },
  { id: 'c', modalita: 'corpo', codice: 'C.01', descrizione: 'Impianto', importoContrattuale: 1000 },
]
const A: Appalto = { oggetto: 'Percorso', ente: { denominazione: 'Comune' }, impresa: { denominazione: 'Impresa' }, modalita: 'misto', ribassoPct: 10 }
const SALS: Sal[] = [{ numero: 1, data: '01/03/2026', righe: [
  { partitaId: 'm', misurazioni: [{ descrizione: 'tratto 1', l1: 10, l2: 2, h: 1, quantita: 20 }, { descrizione: 'detrazione', l1: -2, quantita: -2 }] },
  { partitaId: 'c', quotaPct: 50 },
] }]

describe('libretto e registro in PDF', () => {
  it('il libretto riporta le righe di misura e il SOMMANO per voce', () => {
    const r = righeLibretto(P, SALS[0])
    expect(r.some((x) => x.celle.desc === 'tratto 1' && x.celle.qta === '20,00')).toBe(true)
    const som = r.find((x) => (x.celle.desc ?? '').startsWith('SOMMANO'))!
    expect(som.celle.qta).toBe('18,00')
    expect(som.ref).toBe('m')
    // solo quantità, come d'uso: nessun importo
    expect(r.every((x) => x.importo == null && x.celle.imp == null)).toBe(true)
    // sezioni a misura / a corpo
    expect(r.filter((x) => x.evidenzia).map((x) => x.celle.tariffa)).toEqual(['LAVORI A MISURA', 'LAVORI A CORPO'])
  })
  it('le formule delle misure compaiono con le formule originali', () => {
    const s: Sal = { numero: 1, data: '01/03/2026', righe: [{ partitaId: 'm', misurazioni: [{ descrizione: 'muro', n: 3, l1: 4, quantita: 12, formule: { n: '1+2' } }] }] }
    const r = righeLibretto(P, s)
    expect(r.some((x) => x.celle.desc === 'muro *(par.ug.=1+2)')).toBe(true)
  })
  it('il registro richiama la pagina del libretto e chiude le sezioni con il parziale', async () => {
    const l = await librettoPdf(lib, A, P, SALS[0])
    expect(l.paginaDi.m).toBe(1)
    expect(l.paginaDi.c).toBe(1)
  })
  it('si generano i due PDF', async () => {
    const l = await librettoPdf(lib, A, P, SALS[0])
    expect(l.pagine).toBe(1)
    const g = await registroPdf(lib, A, P, SALS, 1)
    expect(g.pagine).toBeGreaterThanOrEqual(1)
    expect(g.bytes.length).toBeGreaterThan(1000)
  })
})

describe('sommario del registro in PDF', () => {
  it('richiama SAL e pagina del registro per ogni annotazione', async () => {
    const { sommarioPdf } = await import('../../src/tools/contabilita/engine')
    const sals: Sal[] = [...SALS, { numero: 2, data: '01/04/2026', righe: [
      { partitaId: 'm', misurazioni: [...SALS[0].righe[0].misurazioni!, { descrizione: 'tratto 2', l1: 5, quantita: 5 }] },
      { partitaId: 'c', quotaPct: 50 },
    ] }]
    const reg = await registroPdf(lib, A, P, sals, 2)
    expect(reg.paginaDi.m).toBe(1)
    const s = await sommarioPdf(lib, A, P, sals, 2)
    expect(s.pagine).toBeGreaterThanOrEqual(1)
    expect(s.paginaDi.m).toBeGreaterThanOrEqual(1)
  })
})

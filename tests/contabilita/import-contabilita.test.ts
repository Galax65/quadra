import { describe, expect, it } from 'vitest'
import { parseXpwe, xpweToVoci, valutaFormula } from '../../src/shared/xpwe/xpwe'
import { importoVoce } from '../../src/shared/stampa/computo-pdf'
import { importoQta } from '../../src/shared/importo'
import { calcolaSals, contabilitaDaVoci, proponiSal, type Appalto } from '../../src/tools/contabilita/engine'

// Contabilità XPWE fittizia con i casi reali che il collaudo ha fatto emergere:
// decimali col punto («0.200», «1.000+0.5»), vedi voce su quantità arrotondata,
// voce di sicurezza in «%», misure datate.
const EP = (id: number, tar: string, um: string, prezzo: number, flags = 0): string =>
  `<EPItem ID="${id}"><TipoEP>0</TipoEP><Tariffa>${tar}</Tariffa><DesRidotta>Voce ${tar}</DesRidotta><DesEstesa>Voce ${tar}</DesEstesa><UnMisura>${um}</UnMisura><Prezzo1>${prezzo}</Prezzo1><Flags>${flags}</Flags></EPItem>`
const RG = (pu: string, l: string, w: string, h: string, idvv = '-2', q = '0'): string =>
  `<RGItem ID="1"><IDVV>${idvv}</IDVV><Descrizione>riga</Descrizione><PartiUguali>${pu}</PartiUguali><Lunghezza>${l}</Lunghezza><Larghezza>${w}</Larghezza><HPeso>${h}</HPeso><Quantita>${q}</Quantita><Flags>0</Flags></RGItem>`
const VC = (id: number, ep: number, data: string, righe: string): string =>
  `<VCItem ID="${id}"><IDEP>${ep}</IDEP><Quantita>0</Quantita><DataMis>${data}</DataMis><Flags>0</Flags><PweVCMisure>${righe}</PweVCMisure></VCItem>`
const XML = `<?xml version="1.0"?><PweDocumento><TipoDocumento>2</TipoDocumento><PweDatiGenerali><PweDGProgetto><PweDGDatiGenerali><Oggetto>Prova</Oggetto></PweDGDatiGenerali></PweDGProgetto></PweDatiGenerali>
<PweMisurazioni><PweElencoPrezzi>${EP(1, 'A.01', 'm3', 154.78)}${EP(2, 'B.02', 'm3', 302)}${EP(3, 'C.03', 'Kg', 2.25)}${EP(4, 'D.04', 'm2', 70.16)}${EP(9, 'SIC', '%', 4876.86, 134217728)}</PweElencoPrezzi>
<PweVociComputo>
${VC(2, 1, '12/12/2023', RG('', '120.00', '', '0.200') + RG('', '9.50', '', '0.500'))}
${VC(6, 2, '23/05/2024', RG('', '6.50', '0.700', '0.300'))}
${VC(7, 3, '23/05/2024', RG('', '', '', '70.000', '6'))}
${VC(8, 4, '12/12/2023', RG('', '11+16', '', '1.000+0.5'))}
${VC(9, 9, '06/03/2026', RG('60.00', '', '', ''))}
</PweVociComputo></PweMisurazioni></PweDocumento>`

describe('collaudo XPWE di contabilità (dati fittizi)', () => {
  const doc = parseXpwe(XML)
  const voci = xpweToVoci(doc)

  it('nel file il punto è il separatore decimale', () => {
    expect(valutaFormula('0.200', true)).toBe(0.2)
    expect(valutaFormula('1.000+0.5', true)).toBe(1.5)
    expect(valutaFormula('1.000', false)).toBe(1000) // scritto a mano all'italiana: migliaia
    expect(voci.map((v) => v.qty)).toEqual([28.75, 1.37, 95.9, 40.5, 60])
  })

  it('vedi voce sulla quantità arrotondata  (1,37 × 70 = 95,90)', () => {
    expect(voci[2].qty).toBe(95.9)
  })

  it('voce in «%»: importo = quantità × prezzo / 100', () => {
    expect(importoQta(60, 4876.86, '%')).toBe(2926.12)
    expect(importoVoce(voci[4])).toBe(2926.12)
    expect(voci[4].sicurezza).toBe(true)
  })

  it('tipo documento e date delle misure', () => {
    expect(doc.tipoDocumento).toBe(2)
    expect(voci[0].dataMis).toBe('12/12/2023')
    expect([...proponiSal(voci.map((v) => v.dataMis || ''))]).toEqual([['12/12/2023', 1], ['23/05/2024', 2], ['06/03/2026', 3]])
  })

  it('SAL progressivi; la sicurezza non subisce il ribasso', () => {
    const e = contabilitaDaVoci(voci, [], proponiSal(voci.map((v) => v.dataMis || '')))
    expect(e.nuove).toBe(5)
    expect(e.sals.map((s) => s.righe.length)).toEqual([2, 4, 5])
    const A: Appalto = { oggetto: 'x', ente: { denominazione: 'E' }, impresa: { denominazione: 'I' }, modalita: 'misura', ribassoPct: 10 }
    const r = calcolaSals(A, e.partite, e.sals)
    const lavori = 4449.93 + 2841.48 + 413.74 + 215.78
    expect(r[2].lavoriEseguiti).toBe(Math.round(lavori * 100) / 100)
    expect(r[2].oneriSicurezzaEseguiti).toBe(2926.12)
    expect(r[2].ribassoImporto).toBe(Math.round(lavori * 10) / 100)
  })
})

describe('nessun accorpamento automatico delle voci ripetute', () => {
  const voci: any[] = [
    { codice: 'A.01', desc_short: 'Scavo', um: 'm3', prezzo: 10, dataMis: '13/08/2020', categoria: 'Opere edili · Scavi', misurazioni: [{ descrizione: 'edificio', quantita: 43.86 }] },
    { codice: 'A.01', desc_short: 'Scavo', um: 'm3', prezzo: 10, dataMis: '03/12/2020', categoria: 'Impianti · Idrico', misurazioni: [{ descrizione: 'tubazioni', quantita: 6.43 }] },
    { codice: 'B.01', desc_short: 'Lattoneria', um: 'm', prezzo: 5, dataMis: '03/12/2020', categoria: 'Opere edili · Coperture', misurazioni: [{ descrizione: 'copertine', quantita: 32 }] },
    { codice: 'B.01', desc_short: 'Lattoneria', um: 'm', prezzo: 5, dataMis: '03/12/2020', categoria: 'Opere edili · Coperture', misurazioni: [{ descrizione: 'grondaia', quantita: 7.7 }] },
  ]
  const mappa = new Map([['13/08/2020', 1], ['03/12/2020', 2]])
  const e = contabilitaDaVoci(voci, [], mappa)
  it('ogni voce del file resta una voce, anche a parità di articolo e categoria', () => {
    expect(e.partite).toHaveLength(4)
    expect(e.partite.filter((p) => p.codice === 'A.01')).toHaveLength(2)
    expect(e.partite.filter((p) => p.codice === 'B.01')).toHaveLength(2)
    expect(e.partite.map((p) => p.categoria)).toContain('Impianti · Idrico')
  })
  it('ogni voce porta la sua misura, con la sua designazione', () => {
    const ultimo = e.sals[e.sals.length - 1]
    expect(ultimo.righe).toHaveLength(4)
    const desc = ultimo.righe.flatMap((r) => (r.misurazioni || []).map((m) => m.descrizione))
    expect(desc.sort()).toEqual(['copertine', 'edificio', 'grondaia', 'tubazioni'])
    const tot = ultimo.righe.flatMap((r) => r.misurazioni || []).reduce((s, m) => s + (m.quantita || 0), 0)
    expect(Math.round(tot * 100) / 100).toBe(89.99)
  })
  it('le quantità non si perdono e il primo SAL ha solo le sue misure', () => {
    expect(e.sals[0].righe).toHaveLength(1)
    expect(e.sals[0].righe[0].misurazioni?.[0].quantita).toBe(43.86)
  })
  it('ogni voce si abbina a una partita di progetto diversa, per categoria', () => {
    const prog: any[] = [
      { id: 'p1', modalita: 'misura', codice: 'A.01', descrizione: 'Scavo', um: 'm3', prezzoUnitario: 10, qtyProgetto: 50, categoria: 'Impianti · Idrico' },
      { id: 'p2', modalita: 'misura', codice: 'A.01', descrizione: 'Scavo', um: 'm3', prezzoUnitario: 10, qtyProgetto: 44, categoria: 'Opere edili · Scavi' },
    ]
    const r = contabilitaDaVoci(voci, prog, mappa)
    expect(r.abbinate).toBe(2)
    expect(r.nuove).toBe(2)
    expect(r.partite.filter((p) => p.codice === 'A.01').map((p) => p.id).sort()).toEqual(['p1', 'p2'])
  })
})

import { describe, expect, it } from 'vitest'
import { parseXpwe, xpweToVoci, valutaFormula } from '../../src/shared/xpwe/xpwe'
import { importoVoce } from '../../src/shared/stampa/computo-pdf'
import { importoQta } from '../../src/shared/importo'

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

})


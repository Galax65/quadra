import { describe, it, expect } from 'vitest'
import { parseXpwe } from '../../src/shared/xpwe/xpwe'
import { edizioneDaNome, righeDaElencoXpwe } from '../../src/tools/computo/engine/parsers/xpwe-elenco'

// XPWE sintetico «solo elenco prezzi» (TipoDocumento 0), come quello esportato da un listino
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<PweDocumento><TipoDocumento>0</TipoDocumento><FileNameDocumento>C:\\Listini\\2024-1 DEI_Ristrutturazione.dcf</FileNameDocumento>
<PweDatiGenerali><PweDGCapitoliCategorie>
<PweDGSuperCapitoli><DGSuperCapitoliItem ID="1"><DesSintetica>Opere edili</DesSintetica></DGSuperCapitoliItem></PweDGSuperCapitoli>
<PweDGCapitoli><DGCapitoliItem ID="2"><DesSintetica>Demolizioni</DesSintetica></DGCapitoliItem></PweDGCapitoli>
</PweDGCapitoliCategorie></PweDatiGenerali>
<PweMisurazioni><PweElencoPrezzi>
<EPItem ID="1"><TipoEP>0</TipoEP><Tariffa>A.01</Tariffa><DesRidotta>Demolizione tramezzi</DesRidotta><DesEstesa>Demolizione di tramezzi in laterizio, compreso carico e trasporto</DesEstesa><UnMisura>m²</UnMisura><Prezzo1>12.5</Prezzo1><IncMDO>0.65</IncMDO><IDSpCap>1</IDSpCap><IDCap>2</IDCap></EPItem>
<EPItem ID="2"><TipoEP>0</TipoEP><Tariffa>A</Tariffa><DesRidotta>Titolo senza prezzo</DesRidotta><Prezzo1>0</Prezzo1></EPItem>
</PweElencoPrezzi><PweVociComputo></PweVociComputo></PweMisurazioni></PweDocumento>`

describe('XPWE elenco prezzi (TipoDocumento 0) come prezzario', () => {
  const doc = parseXpwe(XML)
  it('edizione dal nome del file d\'origine', () => {
    expect(edizioneDaNome(doc.fileNameDocumento!)).toEqual({ regione: 'Listino editoriale', anno: '2024' })
  })
  it('gli articoli con prezzo diventano righe del prezzario, con descrizione estesa e U.M.', () => {
    const r = righeDaElencoXpwe(doc, { regione: 'Listino editoriale', anno: '2024' })
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ codice: 'A.01', desc_short: 'Demolizione tramezzi', um: 'm²', prezzo: 12.5, regione: 'Listino editoriale', anno: '2024' })
    expect(r[0].declaratoria).toContain('carico e trasporto')
  })
})

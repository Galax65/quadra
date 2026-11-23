import { describe, it, expect } from 'vitest'
import { parseXpwe, xpweToVoci, buildXpwe, valutaFormula } from '../../src/shared/xpwe/xpwe'

// Computo XPWE minimale nello stile di un export XPWE (TipoDocumento=1).
const XPWE = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="PriMus.Document.XPWE"?>
<PweDocumento>
  <TipoDocumento>1</TipoDocumento><TipoFormato>XMLPwe</TipoFormato><Versione>5.05</Versione>
  <PweDatiGenerali>
    <PweDGProgetto><PweDGDatiGenerali>
      <Comune>Esempio</Comune><Provincia>UD</Provincia><Oggetto>Sistemazione percorso pedonale</Oggetto>
      <Committente>Comune di Esempio</Committente><Impresa/>
    </PweDGDatiGenerali></PweDGProgetto>
    <PweDGCapitoliCategorie>
      <PweDGSuperCategorie><DGSuperCategorieItem ID="1"><DesSintetica>OPERE STRADALI</DesSintetica></DGSuperCategorieItem></PweDGSuperCategorie>
      <PweDGCategorie><DGCategorieItem ID="3"><DesSintetica>Scavi</DesSintetica></DGCategorieItem></PweDGCategorie>
      <PweDGSubCategorie/>
    </PweDGCapitoliCategorie>
  </PweDatiGenerali>
  <PweMisurazioni>
    <PweElencoPrezzi>
      <EPItem ID="10"><Tariffa>10.5.CD1.01.A</Tariffa><DesRidotta>Stesa terra: manuale</DesRidotta>
        <DesEstesa>Esecuzione di stesa e modellazione di terra di coltivo &amp; rifinitura</DesEstesa>
        <UnMisura>m³</UnMisura><Prezzo1>32.21</Prezzo1><IncMDO>79.06</IncMDO><Flags>0</Flags></EPItem>
      <EPItem ID="11"><Tariffa>SIC.01</Tariffa><DesRidotta>Recinzione di cantiere</DesRidotta><DesEstesa/>
        <UnMisura>m</UnMisura><Prezzo1>12,50</Prezzo1><Flags>134217728</Flags></EPItem>
    </PweElencoPrezzi>
    <PweVociComputo>
      <VCItem ID="1"><IDEP>10</IDEP><Quantita>0</Quantita><IDSpCat>1</IDSpCat><IDCat>3</IDCat><IDSbCat>0</IDSbCat><CodiceWBS>01.02</CodiceWBS>
        <PweVCMisure>
          <RGItem ID="1"><IDVV>-2</IDVV><Descrizione>tratto A</Descrizione><PartiUguali>2</PartiUguali><Lunghezza>10,5</Lunghezza><Larghezza>1.2</Larghezza><HPeso>0,3</HPeso><Quantita>7.56</Quantita><Flags>0</Flags></RGItem>
          <RGItem ID="2"><IDVV>-2</IDVV><Descrizione>tratto B</Descrizione><PartiUguali/><Lunghezza>4+3</Lunghezza><Larghezza>(1+1)/2</Larghezza><HPeso>0.3</HPeso><Quantita>0</Quantita><Flags>0</Flags></RGItem>
          <RGItem ID="3"><IDVV>-2</IDVV><Descrizione>Sommano parziale</Descrizione><Quantita>9.66</Quantita><Flags>2</Flags></RGItem>
          <RGItem ID="4"><IDVV>-2</IDVV><Descrizione>a dedurre</Descrizione><PartiUguali>-1</PartiUguali><Lunghezza>2</Lunghezza><Larghezza>1</Larghezza><HPeso>0.3</HPeso><Quantita>-0.6</Quantita><Flags>0</Flags></RGItem>
        </PweVCMisure></VCItem>
      <VCItem ID="2"><IDEP>11</IDEP><Quantita>0</Quantita><IDSpCat>1</IDSpCat><IDCat>0</IDCat><IDSbCat>0</IDSbCat>
        <PweVCMisure>
          <RGItem ID="5"><IDVV>1</IDVV><Descrizione>perimetro</Descrizione><PartiUguali>2</PartiUguali><Quantita>0</Quantita><Flags>0</Flags></RGItem>
        </PweVCMisure></VCItem>
      <VCItem ID="3"><IDEP>99</IDEP><Quantita>1</Quantita></VCItem>
    </PweVociComputo>
  </PweMisurazioni>
</PweDocumento>`

describe('valutaFormula — formule di misura XPWE', () => {
  it('numeri con virgola o punto, operatori e parentesi', () => {
    expect(valutaFormula('3,5')).toBeCloseTo(3.5)
    expect(valutaFormula('2*3+1')).toBe(7)
    expect(valutaFormula('(1+1)/2')).toBe(1)
    expect(valutaFormula('-2*1,5')).toBe(-3)
    expect(valutaFormula('1.234,5')).toBeCloseTo(1234.5)
    expect(valutaFormula('')).toBeNull()
    expect(Number.isNaN(valutaFormula('2*abc'))).toBe(true)
  })
})

describe('parseXpwe — computo XPWE', () => {
  const doc = parseXpwe(XPWE)

  it('dati generali ed elenco prezzi', () => {
    expect(doc.datiGenerali.oggetto).toBe('Sistemazione percorso pedonale')
    expect(doc.datiGenerali.comune).toBe('Esempio')
    expect(doc.elencoPrezzi).toHaveLength(2)
    expect(doc.elencoPrezzi[0].desEstesa).toContain('& rifinitura')
    expect(doc.elencoPrezzi[0].incMdo).toBeCloseTo(79.06)
    expect(doc.elencoPrezzi[1].prezzo).toBeCloseTo(12.5)
    expect(doc.elencoPrezzi[1].sicurezza).toBe(true)
  })

  it('misure: formule valutate, parziale ignorato, detrazione sottratta', () => {
    const v = doc.voci[0]
    expect(v.categoria).toEqual(['OPERE STRADALI', 'Scavi'])
    expect(v.righe.map(r => r.quantita)).toEqual([7.56, 2.1, -0.6])
    expect(v.quantita).toBeCloseTo(9.06, 2)
  })

  it('vedi voce: quantità della voce richiamata × fattori', () => {
    const v = doc.voci[1]
    expect(v.righe[0].quantita).toBeCloseTo(18.12, 2)
    expect(v.righe[0].descrizione).toContain('vedi voce 10.5.CD1.01.A')
  })

  it('voce con IDEP inesistente scartata con avviso', () => {
    expect(doc.voci).toHaveLength(2)
    expect(doc.avvisi.some(a => a.includes('IDEP 99'))).toBe(true)
  })

  it('non-XPWE → errore chiaro', () => {
    expect(() => parseXpwe('<foo/>')).toThrow(/XPWE/)
  })
})

describe('xpweToVoci / buildXpwe — andata e ritorno', () => {
  const voci = xpweToVoci(parseXpwe(XPWE))

  it('voci condivise Computo/Contabilità', () => {
    expect(voci[0]).toMatchObject({ codice: '10.5.CD1.01.A', um: 'm³', prezzo: 32.21, qty: 9.06, categoria: 'OPERE STRADALI · Scavi' })
    expect(voci[0].misurazioni?.[0]).toMatchObject({ descrizione: 'tratto A', n: 2, l1: 10.5, l2: 1.2, h: 0.3, quantita: 7.56 })
  })

  it('riletto, il computo esportato ha le stesse quantità e categorie', () => {
    const xml = buildXpwe(voci, { datiGenerali: { oggetto: 'Prova <&>' } })
    expect(xml).toContain('PriMus.Document.XPWE')
    const back = parseXpwe(xml)
    expect(back.datiGenerali.oggetto).toBe('Prova <&>')
    expect(back.voci.map(v => v.quantita)).toEqual(voci.map(v => v.qty))
    expect(back.voci.map(v => v.categoria)).toEqual([['OPERE STRADALI', 'Scavi'], ['OPERE STRADALI']])
    expect(back.elencoPrezzi.map(e => e.tariffa)).toEqual(['10.5.CD1.01.A', 'SIC.01'])
  })

  it('il codice WBS si legge e si riscrive', () => {
    expect(voci[0].wbs).toBe('01.02')
    expect(voci[1].wbs).toBeUndefined()
    expect(parseXpwe(buildXpwe(voci)).voci[0].wbs).toBe('01.02')
  })

  it('voce senza misure: una riga con la quantità', () => {
    const back = parseXpwe(buildXpwe([{ codice: 'A', prezzo: 10, qty: 3, um: 'cad' }]))
    expect(back.voci[0].quantita).toBe(3)
  })
})

describe('righe in detrazione (Flags bit 1)', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<PweDocumento><TipoDocumento>1</TipoDocumento><PweMisurazioni><PweElencoPrezzi>
<EPItem ID="1"><TipoEP>0</TipoEP><Tariffa>A</Tariffa><DesRidotta>Intonaco</DesRidotta><UnMisura>m2</UnMisura><Prezzo1>10</Prezzo1></EPItem>
<EPItem ID="2"><TipoEP>0</TipoEP><Tariffa>B</Tariffa><DesRidotta>Tinta</DesRidotta><UnMisura>m2</UnMisura><Prezzo1>5</Prezzo1></EPItem>
</PweElencoPrezzi><PweVociComputo>
<VCItem ID="1"><IDEP>1</IDEP><Quantita>40.00</Quantita><PweVCMisure>
<RGItem ID="1"><IDVV>-2</IDVV><Descrizione>pareti</Descrizione><PartiUguali/><Lunghezza>20</Lunghezza><Larghezza/><HPeso>2.5</HPeso><Quantita>50.00</Quantita><Flags>0</Flags></RGItem>
<RGItem ID="2"><IDVV>-2</IDVV><Descrizione>a dedurre porte</Descrizione><PartiUguali>2</PartiUguali><Lunghezza>2</Lunghezza><Larghezza/><HPeso>2.5</HPeso><Quantita>-10.00</Quantita><Flags>1</Flags></RGItem>
</PweVCMisure></VCItem>
<VCItem ID="2"><IDEP>2</IDEP><Quantita>20.00</Quantita><PweVCMisure>
<RGItem ID="3"><IDVV>-2</IDVV><Descrizione>pareti</Descrizione><PartiUguali/><Lunghezza>30</Lunghezza><Larghezza/><HPeso/><Quantita>30.00</Quantita><Flags>0</Flags></RGItem>
<RGItem ID="4"><IDVV>1</IDVV><Descrizione>meno intonaco</Descrizione><PartiUguali/><Lunghezza/><Larghezza/><HPeso/><Quantita>-40.00</Quantita><Flags>32769</Flags></RGItem>
<RGItem ID="5"><IDVV>-2</IDVV><Descrizione>più</Descrizione><PartiUguali/><Lunghezza>30</Lunghezza><Larghezza/><HPeso/><Quantita>30.00</Quantita><Flags>0</Flags></RGItem>
</PweVCMisure></VCItem>
</PweVociComputo></PweMisurazioni></PweDocumento>`
  const d = parseXpwe(xml)
  it('una riga con Flags 1 si sottrae anche se i fattori sono positivi', () => {
    expect(d.voci[0].righe[1]).toMatchObject({ partiUguali: -2, quantita: -10 })
    expect(d.voci[0].quantita).toBe(40)
  })
  it('un «vedi voce» in detrazione (Flags 32769) sottrae la quantità richiamata', () => {
    expect(d.voci[1].righe[1]).toMatchObject({ partiUguali: -1, lunghezza: 40, quantita: -40 })
    expect(d.voci[1].quantita).toBe(20)
  })
  it('in scrittura la detrazione esce con fattori positivi e Flags 1, e si rilegge uguale', () => {
    const voci = xpweToVoci(d)
    const out = buildXpwe(voci)
    expect(out).toMatch(/<PartiUguali>2<\/PartiUguali><Lunghezza>2<\/Lunghezza><Larghezza><\/Larghezza><HPeso>2\.5<\/HPeso><Quantita>-10<\/Quantita><Flags>1<\/Flags>/)
    const r = parseXpwe(out)
    expect(r.voci.map((v) => v.quantita)).toEqual([40, 20])
  })
})

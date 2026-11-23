import { describe, it, expect } from 'vitest'
import * as lib from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { creaRegistroPdf, geometriaPdf, impostaStileStampaPdf, larghezzeColonne, type RigaTabella } from '../../src/shared/stampa/registro-pdf'
import { profiloSRGB, xmpPdfA } from '../../src/shared/stampa/pdfa'

/**
 * PDF/A-2b (tappa 9 di Docs/06-Interfaccia-unica.md). Un atto che si conserva
 * deve portarsi dentro tutto quello che serve a vederlo uguale fra vent'anni:
 * i caratteri, il profilo colore, i metadati che dichiarano che cos'è. Qui si
 * apre il file prodotto e si controlla che ci sia davvero.
 *
 * Non sostituisce un validatore (veraPDF): ne verifica i requisiti che il
 * programma deve mettere di suo, così che un cambio del motore non li perda.
 */
const COLONNE = [
  { chiave: 'desc', etichetta: 'DESCRIZIONE', larghezza: 120 },
  { chiave: 'tot', etichetta: 'IMPORTO', larghezza: 40, allinea: 'destra' as const },
]
const righe = (n: number, testo = 'Voce'): RigaTabella[] => Array.from({ length: n }, (_, i) => ({ celle: { desc: `${testo} ${i + 1}`, tot: '10,00' }, importo: 10 }))
const opz = { titolo: 'COMPUTO «METRICO» — PROVA', colonne: COLONNE, colonnaRiporto: 'tot', colonnaEtichetta: 'desc' }
const DATA = new Date(Date.UTC(2026, 10, 23, 9, 30, 0))

async function pdfa(extra: Record<string, unknown> = {}, r = righe(60)) {
  const out = await creaRegistroPdf(lib, { ...opz, fontkit, data: DATA, ...extra }, r)
  const doc = await lib.PDFDocument.load(out.bytes, { updateMetadata: false })
  return { ...out, doc, grezzo: Buffer.from(out.bytes).toString('latin1') }
}

describe('il PDF esce PDF/A-2b', () => {
  it('lo dichiara nei metadati XMP, che stanno nel catalogo e non sono compressi', async () => {
    const { pdfa: ok, doc } = await pdfa()
    expect(ok).toBe(true)
    const meta = doc.catalog.lookup(lib.PDFName.of('Metadata')) as lib.PDFRawStream
    expect(meta.dict.get(lib.PDFName.of('Filter'))).toBeUndefined()
    const x = Buffer.from(meta.getContents()).toString('utf8')
    expect(x).toContain('<pdfaid:part>2</pdfaid:part>')
    expect(x).toContain('<pdfaid:conformance>B</pdfaid:conformance>')
    expect(x).toContain('COMPUTO «METRICO» — PROVA'.replace('«', '«'))
  })

  it('Info e XMP dicono le stesse cose: titolo, programma, produttore, date', async () => {
    const { doc } = await pdfa()
    expect(doc.getTitle()).toBe('COMPUTO «METRICO» — PROVA')
    expect(doc.getCreator()).toBe('Quadra')
    expect(doc.getProducer()).toBe('Quadra (pdf-lib)')
    expect(doc.getCreationDate()?.toISOString()).toBe(DATA.toISOString())
    expect(doc.getModificationDate()?.toISOString()).toBe(DATA.toISOString())
    const x = Buffer.from((doc.catalog.lookup(lib.PDFName.of('Metadata')) as lib.PDFRawStream).getContents()).toString('utf8')
    expect(x).toContain('<xmp:CreateDate>2026-11-23T09:30:00Z</xmp:CreateDate>')
    expect(x).toContain('<xmp:ModifyDate>2026-11-23T09:30:00Z</xmp:ModifyDate>')
    expect(x).toContain('<pdf:Producer>Quadra (pdf-lib)</pdf:Producer>')
    expect(x).toContain('<xmp:CreatorTool>Quadra</xmp:CreatorTool>')
  })

  it('ha un intento di output sRGB con il suo profilo colore', async () => {
    const { doc } = await pdfa()
    const intenti = doc.catalog.lookup(lib.PDFName.of('OutputIntents'), lib.PDFArray)
    expect(intenti.size()).toBe(1)
    const oi = intenti.lookup(0, lib.PDFDict)
    expect(oi.get(lib.PDFName.of('S'))).toBe(lib.PDFName.of('GTS_PDFA1'))
    const prof = oi.lookup(lib.PDFName.of('DestOutputProfile')) as lib.PDFRawStream
    expect((prof.dict.get(lib.PDFName.of('N')) as lib.PDFNumber).asNumber()).toBe(3)
  })

  it('ogni carattere è incorporato: niente Helvetica di sistema', async () => {
    const { doc, grezzo } = await pdfa()
    expect(grezzo).not.toMatch(/\/BaseFont\s*\/Helvetica/)
    const fonts = doc.context.enumerateIndirectObjects()
      .map(([, o]) => o).filter((o): o is lib.PDFDict => o instanceof lib.PDFDict && o.get(lib.PDFName.of('Type')) === lib.PDFName.of('FontDescriptor'))
    expect(fonts.length).toBeGreaterThanOrEqual(2) // normale e grassetto
    for (const fd of fonts) expect(fd.get(lib.PDFName.of('FontFile2'))).toBeDefined()
  })

  it("ha l'identificativo del file nel trailer, ed è cifrato in nessun modo", async () => {
    const { grezzo } = await pdfa()
    expect(grezzo).toMatch(/\/ID\s*\[\s*<[0-9A-F]{32}>\s*<[0-9A-F]{32}>\s*\]/)
    expect(grezzo).not.toContain('/Encrypt')
    expect(grezzo).not.toContain('/JavaScript')
    expect(grezzo.slice(0, 8)).toBe('%PDF-1.7')
  })

  it('un carattere che il font non ha non finisce sul glifo vuoto: si stampa lo stesso', async () => {
    const r = await pdfa({}, [{ celle: { desc: 'Spessore ≤ 3 cm, √2 e ≥ 4 ☃', tot: '1,00' }, importo: 1 }])
    expect(r.pdfa).toBe(true)
    expect(r.pagine).toBe(1)
  })

  it('senza fontkit si ripiega sui caratteri standard, e il file non si dice PDF/A', async () => {
    const r = await creaRegistroPdf(lib, opz, righe(3))
    expect(r.pdfa).toBe(false)
    expect(Buffer.from(r.bytes).toString('latin1')).not.toContain('pdfaid')
  })
})

describe('il profilo colore sRGB', () => {
  const p = profiloSRGB()
  const dv = new DataView(p.buffer, p.byteOffset, p.byteLength)
  const sig = (o: number): string => String.fromCharCode(...p.slice(o, o + 4))
  it('è un profilo ICC v2 ben formato: dimensione dichiarata, firma, classe e spazio colore', () => {
    expect(dv.getUint32(0)).toBe(p.length)
    expect(p[8]).toBe(2)            // versione 2.x: PDF/A-2 accetta fino alla 4
    expect(sig(12)).toBe('mntr')
    expect(sig(16)).toBe('RGB ')
    expect(sig(20)).toBe('XYZ ')
    expect(sig(36)).toBe('acsp')
  })
  it('ha i tag di un profilo a matrice, tutti dentro il file e allineati', () => {
    const n = dv.getUint32(128)
    const tag = Array.from({ length: n }, (_, i) => ({ sig: sig(132 + i * 12), off: dv.getUint32(136 + i * 12), len: dv.getUint32(140 + i * 12) }))
    expect(tag.map((t) => t.sig).sort()).toEqual(['bTRC', 'bXYZ', 'cprt', 'desc', 'gTRC', 'gXYZ', 'rTRC', 'rXYZ', 'wtpt'])
    for (const t of tag) {
      expect(t.off % 4).toBe(0)
      expect(t.off + t.len).toBeLessThanOrEqual(p.length)
    }
  })
})

describe('XMP', () => {
  it('protegge i caratteri speciali del titolo', () => {
    expect(xmpPdfA({ titolo: 'A & B <c>', creatore: 'Q', produttore: 'Q', data: DATA })).toContain('A &amp; B &lt;c&gt;')
  })
})

describe('il foglio segue le impostazioni di stampa', () => {
  it('formato, orientamento e margini', () => {
    const g = geometriaPdf({ formato: 'A3', orientamento: 'orizzontale', margini: { sinistra: 20, destra: 15, sopra: 15, sotto: 15 } })
    expect(Math.round(g.foglio.w)).toBe(1191)
    expect(Math.round(g.foglio.h)).toBe(842)
    expect(g.margini.sx).toBeCloseTo(20 * 72 / 25.4, 3)
    // senza impostazioni resta il foglio storico del registro
    expect(Math.round(geometriaPdf().foglio.w)).toBe(595)
  })

  it('il PDF usa il foglio scelto, e chi stampa lo imposta una volta per tutti gli atti', async () => {
    impostaStileStampaPdf(() => ({ formato: 'A4', orientamento: 'orizzontale' }))
    try {
      const { doc } = await pdfa()
      const { width, height } = doc.getPage(0).getSize()
      expect(width).toBeGreaterThan(height)
    } finally { impostaStileStampaPdf(null) }
  })

  it('un corpo più grande fa più pagine', async () => {
    const piccolo = await creaRegistroPdf(lib, { ...opz, stile: { corpo: 8 } }, righe(200))
    const grande = await creaRegistroPdf(lib, { ...opz, stile: { corpo: 14 } }, righe(200))
    expect(grande.pagine).toBeGreaterThan(piccolo.pagine)
  })
})

describe('su un foglio più largo la tabella si allarga', () => {
  const MM = 72 / 25.4
  const cols = [{ larghezza: 20 }, { larghezza: 90 }, { larghezza: 30 }]
  it('lo spazio in più va alla colonna più larga, la descrizione', () => {
    const w = larghezzeColonne(cols, 200 * MM)
    expect(w[0]).toBeCloseTo(20 * MM, 5)
    expect(w[1]).toBeCloseTo(150 * MM, 5)
    expect(w[2]).toBeCloseTo(30 * MM, 5)
  })
  it('se non ci stanno si stringono tutte in proporzione, e occupano la larghezza utile', () => {
    const w = larghezzeColonne(cols, 70 * MM)
    expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(70 * MM, 5)
    expect(w[1] / w[0]).toBeCloseTo(90 / 20, 5)
  })
})

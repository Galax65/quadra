import { describe, it, expect } from 'vitest'
import * as lib from 'pdf-lib'
import { creaRegistroPdf, fmtNum, spezzaTesto, testoStampabile, type RigaTabella } from '../../src/shared/stampa/registro-pdf'
import { computoPdf, righeComputo, riepilogoCategorie, riepilogoWbs, importoVoce } from '../../src/shared/stampa/computo-pdf'
import type { VoceComputo } from '../../src/shared/xpwe/xpwe'

const COLONNE = [
  { chiave: 'desc', etichetta: 'DESCRIZIONE', larghezza: 120 },
  { chiave: 'tot', etichetta: 'IMPORTO', larghezza: 40, allinea: 'destra' as const },
]

/** Testo estratto (grezzo) dagli stream di contenuto, per verificare cosa è stampato. */
async function testi(bytes: Uint8Array): Promise<string[]> {
  const doc = await lib.PDFDocument.load(bytes)
  return doc.getPages().map(p => {
    const contents = (p.node.Contents() as unknown as { asArray?: () => unknown[] })
    const streams = contents?.asArray ? contents.asArray() : [contents]
    return streams.map(s => {
      const st = (s instanceof lib.PDFRef ? doc.context.lookup(s) : s) as lib.PDFRawStream
      return Buffer.from(lib.decodePDFRawStream(st).decode()).toString('latin1')
    }).join('\n')
  })
}
/** Le stringhe in un content stream sono hex (<...>) con i font standard: le decodifica. */
const visibile = (s: string): string => s.replace(/<([0-9A-Fa-f]+)>/g, (_, h: string) => Buffer.from(h, 'hex').toString('latin1'))

describe('formattazione e testo', () => {
  it('importi all\'italiana con migliaia sempre separate', () => {
    expect(fmtNum(3524.42)).toBe('3.524,42')
    expect(fmtNum(1234567.5)).toBe('1.234.567,50')
    expect(fmtNum(-2)).toBe('-2,00')
    expect(fmtNum(0.3, 3)).toBe('0,300')
  })
  it('sostituisce i caratteri non stampabili con i font standard', () => {
    expect(testoStampabile('m² ≥ 3 × 2 — €')).toBe('m² >= 3 x 2 — €')
    expect(testoStampabile('αβ')).toBe('??')
  })
  it('manda a capo entro la larghezza e spezza le parole troppo lunghe', async () => {
    const doc = await lib.PDFDocument.create()
    const f = await doc.embedFont(lib.StandardFonts.Helvetica)
    const righe = spezzaTesto('uno due tre quattro cinque sei sette', f, 10, 60)
    expect(righe.length).toBeGreaterThan(1)
    for (const r of righe) expect(f.widthOfTextAtSize(r, 10)).toBeLessThanOrEqual(60)
    const lunga = spezzaTesto('x'.repeat(80), f, 10, 60)
    expect(lunga.join('')).toBe('x'.repeat(80))
  })
})

describe('creaRegistroPdf — pagine, riporti, numerazione', () => {
  it('su più pagine scrive A RIPORTARE e RIPORTO con lo stesso progressivo', async () => {
    const righe: RigaTabella[] = Array.from({ length: 120 }, (_, i) => ({ celle: { desc: `Voce ${i + 1}`, tot: '10,00' }, importo: 10 }))
    const { bytes, pagine } = await creaRegistroPdf(lib, { titolo: 'PROVA', colonne: COLONNE, colonnaRiporto: 'tot', colonnaEtichetta: 'desc' }, righe)
    expect(pagine).toBeGreaterThan(1)
    const t = (await testi(bytes)).map(visibile)
    // pagina 1: chiude con «a riportare» = somma delle voci in quella pagina
    const voci1 = (t[0].match(/Voce \d+/g) ?? []).length
    expect(t[0]).toContain('A R I P O R T A R E')
    expect(t[0]).toContain(fmtNum(voci1 * 10))
    // pagina 2: apre con lo stesso riporto
    expect(t[1]).toContain('R I P O R T O')
    expect(t[1]).toContain(fmtNum(voci1 * 10))
    // ultima pagina: nessun «a riportare»; numerazione «Pag. n di N»
    expect(t[pagine - 1]).not.toContain('A R I P O R T A R E')
    expect(t[0]).toContain(`Pag. 1 di ${pagine}`)
    expect(t[pagine - 1]).toContain(`Pag. ${pagine} di ${pagine}`)
  })

  it('senza importi non stampa riporti', async () => {
    const righe: RigaTabella[] = Array.from({ length: 120 }, (_, i) => ({ celle: { desc: `Riga ${i}` } }))
    const { bytes } = await creaRegistroPdf(lib, { titolo: 'PROVA', colonne: COLONNE, colonnaRiporto: 'tot', colonnaEtichetta: 'desc' }, righe)
    const t = (await testi(bytes)).map(visibile).join('\n')
    expect(t).not.toContain('R I P O R T')
  })
})

const VOCI: VoceComputo[] = [
  { codice: 'A.01', desc_short: 'Scavo', declaratoria: 'Scavo di sbancamento in terreno di qualsiasi natura', um: 'm³', prezzo: 10, categoria: 'OPERE STRADALI · Scavi',
    misurazioni: [{ descrizione: 'tratto A', n: 2, l1: 10, l2: 1.5, h: 0.5, quantita: 15 }, { descrizione: 'a dedurre', n: -1, l1: 2, l2: 1, h: 0.5, quantita: -1 }] },
  { codice: 'B.02', desc_short: 'Cordolo', um: 'm', prezzo: 25.5, qty: 4, categoria: 'OPERE STRADALI · Finiture' },
  { codice: 'C.03', desc_short: 'Semina', um: 'm²', prezzo: 2, qty: 100, categoria: 'OPERE A VERDE' },
]

describe('computo metrico estimativo', () => {
  it('importi: quantità dalle misure (detrazioni comprese) × prezzo', () => {
    expect(importoVoce(VOCI[0])).toBe(140)
    expect(importoVoce(VOCI[1])).toBe(102)
    expect(riepilogoCategorie(VOCI)).toEqual([{ categoria: 'OPERE STRADALI', importo: 242 }, { categoria: 'OPERE A VERDE', importo: 200 }])
  })

  it('righe: titoli di categoria, voce con estesa, misure, SOMMANO con importo', () => {
    const r = righeComputo(VOCI)
    const titoli = r.filter(x => x.unisci).map(x => x.celle.tariffa)
    expect(titoli).toEqual(['OPERE STRADALI', 'SCAVI', 'FINITURE', 'OPERE A VERDE'])
    const voce1 = r.find(x => x.celle.tariffa === 'A.01')!
    expect(voce1.celle.desc).toBe('Scavo di sbancamento in terreno di qualsiasi natura')
    const sommano = r.filter(x => x.importo != null)
    expect(sommano.map(x => x.importo)).toEqual([140, 102, 200])
    expect(sommano[0].celle.desc).toBe('SOMMANO m³')
    expect(sommano[0].celle.qta).toBe('14,00')
    // le righe di misura richiamano la voce se finiscono a pagina nuova
    expect(r.find(x => x.celle.desc === 'a dedurre')?.richiamo?.tariffa).toBe('A.01')
  })

  it('PDF: totale, riepilogo categorie e dati generali stampati', async () => {
    const { bytes, pagine, totale } = await computoPdf(lib, VOCI, { oggetto: 'Lavori di prova', committente: 'Comune di Prova', data: '14/11/2026' })
    expect(totale).toBe(442)
    expect(pagine).toBe(1)
    const t = visibile((await testi(bytes)).join('\n'))
    expect(t).toContain('COMPUTO METRICO ESTIMATIVO')
    expect(t).toContain('OGGETTO: Lavori di prova')
    expect(t).toContain('RIEPILOGO CATEGORIE')
    expect(t).toContain('442,00')
  })

  it('WBS: riga sotto la voce e riepilogo che somma i nodi padre', async () => {
    const voci = VOCI.map((v, i) => ({ ...v, wbs: ['01.01', '01.02', '02'][i] }))
    const nodi = { '01': 'Viabilità', '01.01': 'Scavi', '02': 'Verde' }
    expect(riepilogoWbs(voci, nodi)).toEqual([
      { codice: '01', descrizione: 'Viabilità', livello: 0, importo: 242 },
      { codice: '01.01', descrizione: 'Scavi', livello: 1, importo: 140 },
      { codice: '01.02', descrizione: '', livello: 1, importo: 102 },
      { codice: '02', descrizione: 'Verde', livello: 0, importo: 200 },
    ])
    expect(righeComputo(voci, nodi).some(r => r.celle.desc === 'WBS 01.01 — Scavi')).toBe(true)
    const t = visibile((await testi((await computoPdf(lib, voci, {}, { wbsNodi: nodi })).bytes)).join('\n'))
    expect(t).toContain('RIEPILOGO WBS')
    expect(t).toContain('Viabilit')
    // scelta del riepilogo in stampa
    const solo = async (riepilogo: 'categorie' | 'wbs' | 'nessuno'): Promise<string> =>
      visibile((await testi((await computoPdf(lib, voci, {}, { wbsNodi: nodi, riepilogo })).bytes)).join('\n'))
    const c = await solo('categorie'); expect(c).toContain('RIEPILOGO CATEGORIE'); expect(c).not.toContain('RIEPILOGO WBS')
    const w = await solo('wbs'); expect(w).toContain('RIEPILOGO WBS'); expect(w).not.toContain('RIEPILOGO CATEGORIE')
    const n = await solo('nessuno'); expect(n).not.toContain('RIEPILOGO')
  })

  it('descrizioni: estesa, ridotta o compatta (troncata con «…»)', async () => {
    const lunga = { ...VOCI[0], declaratoria: 'Scavo di sbancamento ' + 'in terreno di qualsiasi natura e consistenza '.repeat(12) }
    expect(righeComputo([lunga])[2].celle.desc).toContain('qualsiasi natura')
    const rid = righeComputo([lunga], {}, { descrizione: 'ridotta' })
    expect(rid.find(r => r.celle.tariffa === 'A.01')!.celle.desc).toBe('Scavo')
    const comp = righeComputo([lunga], {}, { descrizione: 'compatta', righeMax: 3, righeFinali: 1 })
    expect(comp.find(r => r.celle.tariffa === 'A.01')!.maxRighe).toBe(3)
    expect(comp.find(r => r.celle.tariffa === 'A.01')!.righeFinali).toBe(1)
    const piena = await computoPdf(lib, [lunga])
    const sub = { ...lunga, declaratoria: lunga.declaratoria + ' SOTTOVOCE: profondità fino a 2 m' }
    const corta = await computoPdf(lib, [sub], {}, { descrizione: 'compatta', righeMax: 3, righeFinali: 1 })
    const t = visibile((await testi(corta.bytes)).join('\n'))
    expect(t).toContain('\x85') // «…» in WinAnsi
    expect(t).toContain('profondit') // l'ultima riga (la sottovoce) resta
    expect(corta.bytes.length).toBeLessThan(piena.bytes.length)
  })

  it('raggruppa per WBS: titoli dei nodi al posto delle categorie', () => {
    const voci = [{ ...VOCI[0], wbs: '01.02', categoria: 'Edile' }]
    const r = righeComputo(voci, { '01': 'Opere', '01.02': 'Scavi' }, { raggruppa: 'wbs' })
    expect(r[0].celle.tariffa).toBe('01 OPERE')
    expect(r[1].celle.tariffa).toBe('01.02 SCAVI')
    expect(r.some(x => (x.celle.desc ?? '').startsWith('WBS '))).toBe(false)
    expect(righeComputo(voci, {}, { raggruppa: 'manuale' })[0].celle.tariffa).toBe(VOCI[0].codice)
  })
})

describe('riepilogo categorie su tre livelli', () => {
  it('Super › Categoria › Sub con importi cumulati, padre prima dei figli', async () => {
    const { riepilogoCategorieAlbero } = await import('../../src/shared/stampa/computo-pdf')
    const v = [
      { codice: 'A', prezzo: 10, qty: 1, categoria: 'Strade · Scavi · A mano' },
      { codice: 'B', prezzo: 5, qty: 1, categoria: 'Verde' },
      { codice: 'C', prezzo: 2, qty: 1, categoria: 'Strade · Scavi' },
    ] as any
    expect(riepilogoCategorieAlbero(v).map((r) => [r.percorso.join('>'), r.importo])).toEqual([
      ['Strade', 12], ['Strade>Scavi', 12], ['Strade>Scavi>A mano', 10], ['Verde', 5],
    ])
  })
})

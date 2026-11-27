// @vitest-environment jsdom
/**
 * OPZIONI DI STAMPA DEGLI ELABORATI: copertina non numerata, luogo-data-firme
 * in calce, computo sintetico (senza righe di misura), scelte di contenuto
 * del pannello dell'anteprima.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import * as lib from 'pdf-lib'
import { creaRegistroPdf, conElaborato, type RigaTabella } from '../../src/shared/stampa/registro-pdf'
import { righeComputo } from '../../src/shared/stampa/computo-pdf'
import { cambiaPreferenza, pannelloContenutoHTML } from '../../src/shared/ui/anteprima-pdf'
import { leggiPreferenzeStampa, PREFERENZE_STAMPA_DEFAULT } from '../../src/shared/stampe/preferenze'
import type { VoceComputo } from '../../src/shared/xpwe/xpwe'

async function testi(bytes: Uint8Array): Promise<string[]> {
  const doc = await lib.PDFDocument.load(bytes)
  return doc.getPages().map(p => {
    const contents = (p.node.Contents() as unknown as { asArray?: () => unknown[] })
    const streams = contents?.asArray ? contents.asArray() : [contents]
    return streams.map(s => {
      const st = (s instanceof lib.PDFRef ? doc.context.lookup(s) : s) as lib.PDFRawStream
      return Buffer.from(lib.decodePDFRawStream(st).decode()).toString('latin1')
    }).join('\n').replace(/<([0-9A-Fa-f]+)>/g, (_, h: string) => Buffer.from(h, 'hex').toString('latin1'))
  })
}

const OPZ = { titolo: 'ELENCO DI PROVA', colonne: [{ chiave: 'desc', etichetta: 'DESCRIZIONE', larghezza: 120 }, { chiave: 'tot', etichetta: 'IMPORTO', larghezza: 40, allinea: 'destra' as const }], colonnaRiporto: 'tot', colonnaEtichetta: 'desc', pdfa: false }
const RIGHE: RigaTabella[] = [{ celle: { desc: 'voce uno', tot: '10,00' } }]

describe('copertina e chiusura', () => {
  it('firme e luogo-data in calce all\'ultima pagina', async () => {
    const out = await creaRegistroPdf(lib, { ...OPZ, chiusura: { luogoData: 'Udine, 27/11/2026', firme: [{ ruolo: 'Il Progettista', nome: 'Ing. Verdi' }] } }, RIGHE)
    const t = (await testi(out.bytes)).join('\n')
    expect(out.pagine).toBe(1)
    expect(t).toContain('Udine, 27/11/2026')
    expect(t).toContain('Il Progettista')
    expect(t).toContain('Ing. Verdi')
  })
  it('la copertina è una pagina in più, fuori dalla numerazione', async () => {
    const out = await creaRegistroPdf(lib, { ...OPZ, copertina: { righe: ['OGGETTO: scuola'], ente: 'Comune di Prova' } }, RIGHE)
    const t = await testi(out.bytes)
    expect(out.pagine).toBe(2)
    expect(t[0]).toContain('ELENCO DI PROVA')
    expect(t[0]).toContain('COMUNE DI PROVA')
    expect(t[0]).not.toContain('Pag.')
    expect(t[1]).toContain('Pag. 1 di 1')
  })
  it('conElaborato vale solo per la durata della stampa', async () => {
    const dentro = await conElaborato({ chiusura: { firme: [{ ruolo: 'Il DL' }] } }, () => creaRegistroPdf(lib, OPZ, RIGHE))
    const fuori = await creaRegistroPdf(lib, OPZ, RIGHE)
    expect((await testi(dentro.bytes)).join()).toContain('Il DL')
    expect((await testi(fuori.bytes)).join()).not.toContain('Il DL')
  })
})

describe('computo sintetico', () => {
  const voci: VoceComputo[] = [{ codice: 'A.1', desc_short: 'Scavo', um: 'm³', prezzo: 10, misurazioni: [{ descrizione: 'tratto nord', l1: 2, l2: 3, quantita: 6 }, { descrizione: 'tratto sud', quantita: 4 }] } as VoceComputo]
  it('con le misure: una riga per misura', () => {
    expect(righeComputo(voci, {}, {}).some((r) => r.celle.desc === 'tratto nord')).toBe(true)
  })
  it('senza misure: la voce porta solo la quantità', () => {
    const r = righeComputo(voci, {}, { misure: false })
    expect(r.some((x) => x.celle.desc === 'tratto nord')).toBe(false)
    expect(r.find((x) => String(x.celle.desc).startsWith('SOMMANO'))?.celle.qta).toBe('10,00')
  })
})

describe('il pannello «Contenuto»', () => {
  beforeEach(() => localStorage.clear())
  it('le scelte si salvano nelle preferenze di stampa', () => {
    cambiaPreferenza('misure', 'no')
    cambiaPreferenza('senzaPrezzi', 'no')
    cambiaPreferenza('luogo', '  Udine ')
    cambiaPreferenza('righeMax', '99')
    const p = leggiPreferenzeStampa()
    expect(p.misure).toBe(false)
    expect(p.senzaPrezzi).toBe(true)
    expect(p.luogo).toBe('Udine')
    expect(p.righeMax).toBe(20)
  })
  it('per un elaborato qualunque: solo copertina e firme', () => {
    const h = pannelloContenutoHTML(PREFERENZE_STAMPA_DEFAULT, 'elaborato')
    expect(h).toContain('data-pref="copertina"')
    expect(h).toContain('data-pref="firme"')
    expect(h).not.toContain('data-pref="misure"')
  })
  it('per il computo anche descrizione, misure, riepiloghi e prezzi', () => {
    const h = pannelloContenutoHTML(PREFERENZE_STAMPA_DEFAULT, 'computo')
    for (const c of ['descrizione', 'righeMax', 'misure', 'rigaWbs', 'riepilogo', 'senzaPrezzi']) expect(h).toContain(`data-pref="${c}"`)
  })
})

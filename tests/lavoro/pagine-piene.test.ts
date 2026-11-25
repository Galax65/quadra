import { describe, it, expect } from 'vitest'
import { nuovoLavoro } from '../../src/shared/lavoro'
import { paginaDati } from '../../src/tools/lavoro/dati-pagina'
import { paginaPrezzario, cercaRighe, righeVisibili, nuovoStatoPrezzario, BLOCCO } from '../../src/tools/lavoro/prezzario-pagina'
import type { PriceRow } from '../../src/tools/computo/engine/types'
import type { PrezzarioDisponibile } from '../../src/shared/prezzari/archivio'

/**
 * A TUTTA PAGINA, NON IN UNA FINESTRA: i dati del lavoro e i prezzari si
 * scrivono e si consultano in pagina, come «Contratto, tempi e pagamenti».
 */
const riga = (codice: string, desc: string, um: string, prezzo: number, disciplina = ''): PriceRow =>
  ({ codice, declaratoria: desc, desc_short: desc, um, prezzo, importo_netto: 0, ru: 0, liv1: '', liv2: '', liv3: '', liv4: '', materia: '', disciplina, sistema: '', attivita: '', settore: '', keywords: '', tipologia: '', regione: '', anno: '' }) as PriceRow

const PREZZARI: PrezzarioDisponibile[] = [
  { id: 'arc:listino.xlsx', nome: 'Listino studio', regione: null, anno: null, n: 3, origine: 'archivio', filename: 'listino.xlsx' },
  { id: 'pkg:fvg-2026', nome: 'Friuli Venezia Giulia 2026', regione: 'FVG', anno: '2026', n: 3, origine: 'installato' },
]
const righe = (): PriceRow[] => [
  riga('A.01', 'Scavo di sbancamento', 'm3', 8.5, 'Edile'),
  riga('A.02', 'Scavo a sezione obbligata', 'm3', 12, 'Edile'),
  riga('B.01', 'Cavo elettrico FG16', 'm', 3.2, 'Impianti'),
]

describe('i dati del lavoro a tutta pagina', () => {
  it('ogni campo si salva da solo, raggruppato come nelle stampe', () => {
    const l = { ...nuovoLavoro(), dati: { ...nuovoLavoro().dati, oggetto: 'Scuola media' } }
    const h = paginaDati(l)
    expect(h).toContain('lv-page')
    expect(h).toContain("lvDato('oggetto',this.value)")
    expect(h).toContain('value="Scuola media"')
    for (const g of ['Opera', 'Committente', 'Tecnici', 'Impresa', 'Elaborati']) expect(h).toContain(`<h2>${g}</h2>`)
  })
})

describe('il prezzario a tutta pagina', () => {
  it('la ricerca vuole tutte le parole; i filtri si sommano', () => {
    expect(cercaRighe(righe(), 'scavo m3')).toEqual([0, 1])
    expect(cercaRighe(righe(), 'sezione scavo')).toEqual([1])
    const st = { ...nuovoStatoPrezzario(), righe: righe(), filtri: { disciplina: 'Impianti' } }
    expect(righeVisibili(st)).toEqual([2])
  })

  it('un prezzario dell\'archivio si modifica sul posto', () => {
    const st = { ...nuovoStatoPrezzario(), id: 'arc:listino.xlsx', righe: righe() }
    const h = paginaPrezzario(st, { prezzari: PREZZARI, destinazione: 'computo rev.00' })
    expect(h).toContain("lvPpSet(0,'prezzo',this.value)")
    expect(h).toContain('lvPpNuova()')
    expect(h).toContain('lvPpTogli(')
    expect(h).toContain('lvPpPrendi(0)')
  })

  it('uno installato si consulta, e si modifica solo in copia', () => {
    const st = { ...nuovoStatoPrezzario(), id: 'pkg:fvg-2026', righe: righe() }
    const h = paginaPrezzario(st, { prezzari: PREZZARI })
    expect(h).not.toContain('lvPpSet(')
    expect(h).not.toContain('lvPpTogli(')
    expect(h).toContain('lvPpCopia()')
    // senza revisione aperta, niente «＋»
    expect(h).not.toContain('lvPpPrendi(')
  })

  it('di un prezzario grande si mostra un blocco alla volta', () => {
    const molte = Array.from({ length: BLOCCO + 50 }, (_, i) => riga(`X.${i}`, `Voce ${i}`, 'm', 1))
    const h = paginaPrezzario({ ...nuovoStatoPrezzario(), id: 'arc:listino.xlsx', righe: molte }, { prezzari: PREZZARI })
    expect(h.match(/lvPpSet\(\d+,'codice'/g)?.length).toBe(BLOCCO)
    expect(h).toContain('lvPpAltre()')
  })
})

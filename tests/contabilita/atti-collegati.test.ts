import { describe, it, expect } from 'vitest'
import { ordineIscrizione, rifLibretto, paginaIniziale, pagineEmesse, atoContinua, notaSeguito } from '../../src/tools/contabilita/engine/atti-rif'
import { librettoHTML, registroHTML, sommarioHTML } from '../../src/tools/contabilita/engine'
import { rifRC } from '../../src/tools/contabilita/engine/sommario'
import type { Appalto, Partita, Sal, Consegna } from '../../src/tools/contabilita/engine/types'

/**
 * GLI ATTI CONTABILI SI RICHIAMANO FRA LORO. È il difetto che in cantiere si
 * paga più caro: un registro che non dice da quale libretto viene la partita, o
 * un sommario che non dice a quale numero del registro corrisponde l'importo,
 * non è verificabile da un terzo. E libretto e registro sono UN SOLO registro a
 * pagine numerate: al secondo SAL continuano, non ricominciano.
 */
const appalto = (): Appalto => ({
  oggetto: 'Lavori di prova', ente: { denominazione: 'Comune X' }, impresa: { denominazione: 'Impresa Y' }, modalita: 'misura',
})
const partite = (): Partita[] => [
  { id: 'a', modalita: 'misura', codice: 'A.1', descrizione: 'Scavo', um: 'mc', prezzoUnitario: 10, qtyProgetto: 100, categoria: 'Opere edili', introdottaSal: 1 },
  { id: 'b', modalita: 'misura', codice: 'B.1', descrizione: 'Muratura', um: 'mq', prezzoUnitario: 20, qtyProgetto: 50, categoria: 'Opere edili', introdottaSal: 1 },
  // voce nuova, entrata in contabilità solo col secondo SAL
  { id: 'c', modalita: 'misura', codice: 'NP.01', descrizione: 'Rinforzo', um: 'mq', prezzoUnitario: 30, categoria: 'Strutture', introdottaSal: 2 },
]
const sals = (): Sal[] => [
  { numero: 1, data: '01/06/2026', righe: [{ partitaId: 'a', quantitaProgressiva: 40 }, { partitaId: 'b', quantitaProgressiva: 10 }] },
  { numero: 2, data: '01/07/2026', righe: [{ partitaId: 'a', quantitaProgressiva: 70 }, { partitaId: 'b', quantitaProgressiva: 30 }, { partitaId: 'c', quantitaProgressiva: 5 }] },
]

describe('numero d\'ordine di iscrizione', () => {
  it('numera le partite nell\'ordine in cui entrano in contabilità', () => {
    const ord = ordineIscrizione(partite())
    expect(ord.get('a')).toBe(1)
    expect(ord.get('b')).toBe(2)
    expect(ord.get('c')).toBe(3)
  })
  it('non cambia il numero di una voce quando ne entrano altre dopo', () => {
    const p = partite()
    const prima = ordineIscrizione(p).get('a')
    p.push({ id: 'd', modalita: 'misura', codice: 'NP.02', descrizione: 'Altro', prezzoUnitario: 5, introdottaSal: 3 })
    expect(ordineIscrizione(p).get('a')).toBe(prima)
  })
  it('le voci delle perizie vengono dopo quelle del contratto, anche se elencate prima', () => {
    const p: Partita[] = [
      { id: 'np', modalita: 'misura', codice: 'NP.01', descrizione: 'Nuova', prezzoUnitario: 1, introdottaSal: 3 },
      { id: 'c1', modalita: 'misura', codice: 'A.1', descrizione: 'Contratto', prezzoUnitario: 1, introdottaSal: 1 },
    ]
    const ord = ordineIscrizione(p)
    expect(ord.get('c1')).toBe(1)
    expect(ord.get('np')).toBe(2)
  })
})

describe('richiami fra gli atti', () => {
  it('il registro dice da quale libretto e da quale numero viene la partita', () => {
    expect(rifLibretto(2, 7)).toBe('LM 2 · n. 7')
    expect(rifLibretto(2, 7, 4)).toBe('LM 2 · n. 7 · pag. 4')
  })
  it('il libretto stampa la colonna del numero d\'ordine', () => {
    const html = librettoHTML(appalto(), partite(), sals()[0])
    expect(html).toContain('>N.<')
    expect(html).toContain("numero d'ordine di iscrizione")
  })
  it('il registro stampa il richiamo al libretto, non il codice della voce', () => {
    const html = registroHTML(appalto(), partite(), sals())
    expect(html).toContain('Rif. libretto')
    expect(html).toContain('LM 1 · n. 1')
    expect(html).toContain('LM 2 · n. 3') // la voce entrata col secondo SAL
  })
  it('il sommario richiama i numeri d\'ordine del registro di ogni categoria', () => {
    const html = sommarioHTML(appalto(), partite(), sals(), 2)
    expect(html).toContain('RC n. 1, 2')
    expect(html).toContain('RC n. 3')
  })
  it('il richiamo si contrae su molti numeri contigui e non inventa i mancanti', () => {
    expect(rifRC([3, 4, 5, 6])).toBe('RC n. 3÷6')
    expect(rifRC([3, 9, 20, 21])).toBe('RC n. 3÷21 (4 voci)')
    expect(rifRC([])).toBe('—')
    expect(rifRC([0, 0])).toBe('—')
  })
})

describe('un solo registro, pagine che continuano', () => {
  const emesso = (tipo: string, salNumero: number, pagine?: number): Consegna =>
    ({ id: tipo + salNumero, tipo, label: tipo, data: '01/06/2026', salNumero, ts: 0, ...(pagine ? { pagine } : {}) })

  it('il primo atto parte da pagina 1 e non dichiara di seguire nulla', () => {
    expect(paginaIniziale([], 'libretto', 1)).toBe(1)
    expect(atoContinua([], 'libretto', 1)).toBe(false)
    expect(notaSeguito([], 'libretto', 1, 'Libretto delle misure')).toBeNull()
  })
  it('il secondo atto riprende dalla pagina dopo quelle già emesse', () => {
    const c = [emesso('libretto', 1, 4)]
    expect(pagineEmesse(c, 'libretto', 2)).toBe(4)
    expect(paginaIniziale(c, 'libretto', 2)).toBe(5)
    expect(atoContinua(c, 'libretto', 2)).toBe(true)
    expect(notaSeguito(c, 'libretto', 2, 'Libretto delle misure')).toContain('pagine da 5')
  })
  it('somma le pagine di tutti gli atti precedenti dello stesso tipo', () => {
    const c = [emesso('libretto', 1, 4), emesso('libretto', 2, 3), emesso('registro', 1, 9)]
    expect(paginaIniziale(c, 'libretto', 3)).toBe(8)
    expect(paginaIniziale(c, 'registro', 2)).toBe(10)
  })
  it('se le pagine di un atto precedente non si conoscono, non si inventa un numero', () => {
    const c = [emesso('libretto', 1)]
    expect(pagineEmesse(c, 'libretto', 2)).toBeNull()
    expect(paginaIniziale(c, 'libretto', 2)).toBe(1)
    // continua comunque: il «segue» si dichiara, il numero di pagina no
    expect(atoContinua(c, 'libretto', 2)).toBe(true)
    const nota = notaSeguito(c, 'libretto', 2, 'Libretto delle misure')
    expect(nota).toContain('Segue dal Libretto delle misure n. 1')
    expect(nota).not.toContain('pagine da')
  })
  it('il libretto del secondo SAL stampa la nota di continuità', () => {
    const html = librettoHTML(appalto(), partite(), sals()[1], undefined, [emesso('libretto', 1, 4)])
    expect(html).toContain('pagine da 5')
  })
  it('il registro dichiara di essere uno solo, a fogli numerati e vidimati', () => {
    const html = registroHTML(appalto(), partite(), sals())
    expect(html).toContain('Un solo registro')
    expect(html).toContain('vidimati')
  })
})

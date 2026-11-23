import { describe, expect, it } from 'vitest'
import { snapshotComputo, confrontaRevisione, confrontoRevisioniHTML, FASI_COMPUTO, elencoDellaRevisione, naturaDi, rinominaRevisione, revisioneDiProgetto, ultimaDiComputo, type VoceRev } from '../../src/tools/computo/engine/revisioni'

/**
 * REVISIONI DEL COMPUTO: un lavoro ha una successione di computi (PFTE, definitivo,
 * esecutivo, contratto) e ciò che conta è il confronto fra due di essi. La revisione
 * è una fotografia autonoma — con i prezzi di allora — così il raffronto resta
 * leggibile anche se nel frattempo le voci sono state rinominate o riprezzate.
 */
const voci = (): VoceRev[] => [
  { _key: 'a', codice: 'A.01', desc_short: 'Scavo', um: 'mc', prezzo: 10, qty: 100 },
  { _key: 'b', codice: 'A.02', desc_short: 'Calcestruzzo', um: 'mc', prezzo: 120, qty: 10 },
]
const rev = (v: VoceRev[]) => snapshotComputo(v, { id: 'r1', nome: 'PFTE', fase: 'PFTE', data: '01/03/2026' })

describe('revisioni del computo', () => {
  it('la fotografia porta con sé prezzi, quantità e totale', () => {
    const r = rev(voci())
    expect(r.voci).toHaveLength(2)
    expect(r.totale).toBe(2200)
    expect(r.voci[0]).toMatchObject({ codice: 'A.01', descrizione: 'Scavo', um: 'mc', prezzo: 10, qty: 100, importo: 1000 })
    expect(FASI_COMPUTO).toContain('esecutivo')
  })

  it('la quantità è la somma delle misure, se ci sono', () => {
    const r = rev([{ _key: 'a', codice: 'A.01', desc_short: 'Scavo', um: 'mc', prezzo: 10, qty: 0, misurazioni: [{ descrizione: 'x', quantita: 30 }, { descrizione: 'y', quantita: 12.5 }] }])
    expect(r.voci[0].qty).toBe(42.5)
    expect(r.totale).toBe(425)
  })

  it('un computo immutato non mostra variazioni', () => {
    const c = confrontaRevisione(rev(voci()), voci())
    expect(c.differenza).toBe(0)
    expect(c.righe.every((x) => x.stato === 'invariata')).toBe(true)
    expect(c.variate + c.nuove + c.soppresse).toBe(0)
  })

  it('riconosce quantità variate, voci nuove e voci soppresse', () => {
    const r = rev(voci())
    const ora: VoceRev[] = [
      { _key: 'a', codice: 'A.01', desc_short: 'Scavo', um: 'mc', prezzo: 10, qty: 130 },   // +300
      { _key: 'c', codice: 'A.09', desc_short: 'Drenaggio', um: 'm', prezzo: 25, qty: 40 }, // nuova +1000
    ]
    const c = confrontaRevisione(r, ora)
    expect(c.variate).toBe(1)
    expect(c.soppresse).toBe(1)   // A.02 non c'è più
    expect(c.nuove).toBe(1)
    expect(c.totalePrima).toBe(2200)
    expect(c.totaleDopo).toBe(2300)
    expect(c.differenza).toBe(100)
    expect(c.variazionePct).toBeCloseTo(4.55, 2)
    expect(c.righe.find((x) => x.codice === 'A.02')!.importoDopo).toBe(0)
    expect(c.righe.find((x) => x.codice === 'A.09')!.importoPrima).toBe(0)
  })

  it('un prezzo cambiato è una variazione, a quantità ferma', () => {
    const c = confrontaRevisione(rev(voci()), [
      { _key: 'a', codice: 'A.01', desc_short: 'Scavo', um: 'mc', prezzo: 12, qty: 100 },
      { _key: 'b', codice: 'A.02', desc_short: 'Calcestruzzo', um: 'mc', prezzo: 120, qty: 10 },
    ])
    expect(c.differenza).toBe(200)
    expect(c.righe[0].stato).toBe('variata')
    expect(c.righe[0].prezzoPrima).toBe(10)
    expect(c.righe[0].prezzoDopo).toBe(12)
  })

  it('se la chiave interna cambia (voce ricomposta) riaggancia per codice', () => {
    const c = confrontaRevisione(rev(voci()), [
      { _key: 'cmp:7', codice: 'A.01', desc_short: 'Scavo di fondazione', um: 'mc', prezzo: 10, qty: 100 },
      { _key: 'b', codice: 'A.02', desc_short: 'Calcestruzzo', um: 'mc', prezzo: 120, qty: 10 },
    ])
    expect(c.nuove).toBe(0)
    expect(c.soppresse).toBe(0)
    expect(c.differenza).toBe(0)
    expect(c.righe[0].descrizione).toBe('Scavo di fondazione') // la descrizione mostrata è quella di adesso
  })

  it('il quadro comparativo è un documento stampabile autonomo', () => {
    const r = rev(voci())
    const html = confrontoRevisioniHTML(r, confrontaRevisione(r, voci()), { oggetto: 'Lavori di somma urgenza', committente: 'Comune X' })
    expect(html).toContain('</html>')
    expect(html).toContain('Quadro comparativo delle revisioni')
    expect(html).toContain('PFTE')
    expect(html).toContain('Comune X')
    expect(html).toContain('A.01')
  })
})

/**
 * REVISIONI MEMORIZZATE, NON DERIVATE (tappa 7 di Docs/06-Interfaccia-unica.md):
 * ogni revisione resta nel file con il SUO elenco prezzi e le sue misure; si
 * rinomina senza che cambi il contenuto; e una revisione di progetto può
 * esistere senza essere una revisione di computo.
 */
describe('revisioni memorizzate', () => {
  const conProvenienza = (): VoceRev[] => [
    { _key: 'a', codice: 'A.01', desc_short: 'Scavo', um: 'mc', prezzo: 10, qty: 0, regione: 'Veneto', anno: '2026', misurazioni: [{ descrizione: 'platea', quantita: 30 }] },
    { _key: 'a2', codice: 'A.01', desc_short: 'Scavo', um: 'mc', prezzo: 10, qty: 5, regione: 'Veneto', anno: '2026' },
    { _key: 'n', codice: 'NP.001', desc_short: 'Pozzetto speciale', um: 'cad', prezzo: 250, qty: 2, np: true, analisiPrezzi: true, codiceOrig: 'B.07' },
  ]

  it("congela l'elenco prezzi con la sua provenienza, e le misure di ogni voce", () => {
    const r = snapshotComputo(conProvenienza(), { id: 'r', nome: 'Esecutivo', fase: 'esecutivo', data: '01/04/2026' })
    expect(r.natura).toBe('computo')
    expect(r.elenco).toEqual([
      { codice: 'A.01', descrizione: 'Scavo', um: 'mc', prezzo: 10, provenienza: 'Veneto 2026', usi: 2 },
      { codice: 'NP.001', descrizione: 'Pozzetto speciale', um: 'cad', prezzo: 250, provenienza: 'nuovo prezzo · analisi', np: true, analisi: true, codiceOrig: 'B.07', usi: 1 },
    ])
    expect(r.voci[0].misurazioni).toEqual([{ descrizione: 'platea', quantita: 30 }])
  })

  it("l'elenco congelato non segue le modifiche fatte dopo ai prezzi del progetto", () => {
    const voci = conProvenienza()
    const r = snapshotComputo(voci, { id: 'r', nome: 'E', fase: 'esecutivo', data: '' })
    voci[0].prezzo = 99
    voci[0].misurazioni![0].quantita = 1
    expect(elencoDellaRevisione(r)[0].prezzo).toBe(10)
    expect(r.voci[0].misurazioni![0].quantita).toBe(30)
  })

  it("le revisioni salvate prima, senza elenco, se lo ricavano dalle voci", () => {
    const vecchia = rev(voci())
    delete (vecchia as { elenco?: unknown }).elenco
    delete (vecchia as { natura?: unknown }).natura
    expect(naturaDi(vecchia)).toBe('computo')
    expect(elencoDellaRevisione(vecchia).map((a) => [a.codice, a.prezzo])).toEqual([['A.01', 10], ['A.02', 120]])
  })

  it('si rinomina: cambiano nome, fase, data e note, il contenuto resta, e il nome di prima si ricorda', () => {
    const r = rev(voci())
    const n = rinominaRevisione(r, { nome: '  Esecutivo dopo la CdS ', fase: 'esecutivo', note: 'prescrizioni' }, '20/11/2026')
    expect(n.nome).toBe('Esecutivo dopo la CdS')
    expect(n.fase).toBe('esecutivo')
    expect(n.note).toBe('prescrizioni')
    expect(n.rinomine).toEqual([{ da: 'PFTE', il: '20/11/2026' }])
    expect(n.voci).toBe(r.voci)          // lo stesso contenuto, non una copia rifatta
    expect(n.totale).toBe(r.totale)
    expect(r.nome).toBe('PFTE')           // l'originale non si tocca
    expect(rinominaRevisione(n, { note: '' }, 'x').note).toBeUndefined()
    expect(rinominaRevisione(n, { fase: 'contratto' }, 'x').rinomine).toHaveLength(1) // senza cambio di nome, niente traccia
    expect(() => rinominaRevisione(r, { nome: '   ' }, 'x')).toThrow()
  })

  it('una revisione di progetto non fotografa niente: poggia sull\'ultima revisione di computo', () => {
    const c1 = { ...rev(voci()), id: 'c1', ts: 1 }
    const p1 = revisioneDiProgetto({ id: 'p1', nome: 'Tavole aggiornate', fase: 'definitivo', data: '02/05/2026', ts: 2 }, ultimaDiComputo([c1]))
    expect(p1).toMatchObject({ natura: 'progetto', voci: [], computoDi: 'c1', totale: c1.totale })
    expect(elencoDellaRevisione(p1)).toEqual([])
    // l'ultima di COMPUTO, non l'ultima in assoluto
    expect(ultimaDiComputo([c1, p1])!.id).toBe('c1')
    expect(ultimaDiComputo([c1, p1], 1)).toBeNull()
    // senza computo congelato prima, la revisione di progetto esiste lo stesso
    expect(revisioneDiProgetto({ id: 'p0', nome: 'Avvio', fase: 'PFTE', data: '' }, null)).toMatchObject({ natura: 'progetto', totale: 0 })
    expect(revisioneDiProgetto({ id: 'p0', nome: 'Avvio', fase: 'PFTE', data: '' }, null).computoDi).toBeUndefined()
  })

  it('resta nel file: elenco, misure e storico dei nomi sopravvivono al salvataggio', () => {
    const r = rinominaRevisione(snapshotComputo(conProvenienza(), { id: 'r', nome: 'E', fase: 'esecutivo', data: '' }), { nome: 'E2' }, 'oggi')
    expect(JSON.parse(JSON.stringify(r))).toEqual(r)
  })
})

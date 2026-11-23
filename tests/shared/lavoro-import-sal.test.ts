import { describe, it, expect } from 'vitest'
import {
  nuovoLavoro, nuovoComputo, chiudi, promuoviAContratto, nuovoSal, emetti, importiAvanzamento, quantitaEseguita, rigaDi,
  importaMisureSal, proponiGruppi, abbinaVoce, revisione, nuovoSalFinale, confrontaConXpwe, statoFinaleDaXpwe, type Lavoro,
} from '../../src/shared/lavoro'

/**
 * L'IMPORT DI UNA CONTABILITÀ XPWE NEI SAL: un lavoro avviato con un altro programma si
 * continua qui. Le date vicine fanno un SAL; le misure si abbinano alle voci
 * del contratto e restano progressive; quello che il contratto non ha si
 * elenca, non si inventa.
 */
const D = '01/01/2026'

function contratto(): Lavoro {
  let l = nuovoLavoro()
  const r = nuovoComputo(l, { fase: 'esecutivo', data: D }); l = r.lavoro
  l = {
    ...l, revisioni: l.revisioni.map((x) => ({
      ...x,
      articoli: [
        { id: 'a1', codice: 'A.01', descrizione: 'Scavo', um: 'm3', prezzo: 20, origine: 'prezzario' as const },
        { id: 'a2', codice: 'B.01', descrizione: 'Muratura', um: 'm2', prezzo: 50, origine: 'prezzario' as const },
        { id: 'a3', codice: 'C.01', descrizione: 'Impianto', um: 'a corpo', prezzo: 1000, origine: 'prezzario' as const },
      ],
      voci: [
        { id: 'v1', articolo: 'a1', misure: [], quantita: 100, categoria: 'Scavi' },
        { id: 'v2', articolo: 'a2', misure: [], quantita: 40 },
        { id: 'v3', articolo: 'a3', misure: [], quantita: 1, corpo: true },
      ],
    })),
  }
  l = chiudi(l, r.id, D)
  const c = promuoviAContratto(l, r.id, { data: D, ribassoPct: 10 })
  return chiudi(c.lavoro, c.id, D)
}

const FILE = [
  { codice: 'A.01', prezzo: 20, dataMis: '10/02/2026', misurazioni: [{ descrizione: 'platea', n: null, l1: 10, l2: 2, h: 1, quantita: 20 }] },
  { codice: 'A.01', prezzo: 20, dataMis: '15/02/2026', qty: 5 },
  { codice: 'B.01', prezzo: 50, dataMis: '20/05/2026', qty: 12 },
  { codice: 'A.01', prezzo: 20, dataMis: '22/05/2026', qty: 10 },
  { codice: 'Z.99', prezzo: 7, dataMis: '22/05/2026', qty: 3, desc_short: 'Opera extra' },
  { codice: 'C.01', prezzo: 1000, dataMis: '22/05/2026', qty: 1 },
]

describe('importa una contabilità XPWE nei SAL', () => {
  it('le date vicine fanno un SAL, quelle lontane un altro', () => {
    const g = proponiGruppi(FILE)
    expect(g.map((x) => x.date)).toEqual([['10/02/2026', '15/02/2026'], ['20/05/2026', '22/05/2026']])
    expect(g.map((x) => x.misure)).toEqual([2, 4])
    expect(proponiGruppi(FILE, 200)).toHaveLength(1)
  })

  it('si abbina per codice e prezzo, prima la stessa categoria', () => {
    const l = contratto()
    const r = revisione(l, l.revisioni[1].id)
    expect(abbinaVoce(r, { codice: 'A.01', prezzo: 20 })?.id).toBe('v1')
    expect(abbinaVoce(r, { codice: 'A.01', prezzo: 21 })).toBeUndefined()
    expect(abbinaVoce(r, { codice: 'Z.99' })).toBeUndefined()
  })

  it('due SAL: il primo emesso, il secondo in bozza; misure progressive; il resto elencato', () => {
    const e = importaMisureSal(contratto(), FILE)
    const [s1, s2] = e.sal.map((id) => e.lavoro.avanzamenti.find((a) => a.id === id)!)
    expect([s1.n, s1.stato, s1.data]).toEqual([1, 'emesso', '15/02/2026'])
    expect([s2.n, s2.stato, s2.data]).toEqual([2, 'bozza', '22/05/2026'])
    expect(quantitaEseguita(rigaDi(s1, 'v1'))).toBe(25)
    expect(quantitaEseguita(rigaDi(s2, 'v1'))).toBe(35)   // 25 del SAL 1 + 10
    expect(quantitaEseguita(rigaDi(s2, 'v2'))).toBe(12)
    expect(rigaDi(s1, 'v1').misure[1].descrizione).toBe('15/02/2026')
    expect(e.abbinate).toBe(4)
    expect(e.scartate.map((x) => [x.codice, x.motivo])).toEqual([['Z.99', 'non è nel contratto'], ['C.01', 'lavoro a corpo: si contabilizza a quota %']])
    // SAL 1: 25 × 20 = 500 lordo → 450 netto; SAL 2: (35 × 20 + 12 × 50) = 1300 → 1170, in questo SAL 720
    expect(importiAvanzamento(e.lavoro, s2.id)).toMatchObject({ lordo: 1300, netto: 1170, precedente: 450, questo: 720 })
  })

  it('il primo gruppo va nel SAL in bozza; le misure già contabilizzate si saltano con «dal»', () => {
    let l = contratto()
    const s = nuovoSal(l, D); l = s.lavoro
    const e = importaMisureSal(l, FILE, { dal: '01/05/2026' })
    expect(e.sal[0]).toBe(s.id)
    expect(e.saltate).toBe(2)
    expect(e.lavoro.avanzamenti).toHaveLength(1)
    expect(quantitaEseguita(rigaDi(e.lavoro.avanzamenti[0], 'v1'))).toBe(10)
  })

  it('senza contratto o dopo il SAL finale non si importa', () => {
    expect(() => importaMisureSal(nuovoLavoro(), FILE)).toThrow(/contratto/)
    let l = contratto()
    const s = nuovoSal(l, D); l = emetti(s.lavoro, s.id, D)
    expect(() => importaMisureSal(l, FILE)).not.toThrow()
  })
})

describe('il SAL finale e un XPWE: confronto dei totali, o le misure dal file', () => {
  /** SAL 1 e 2 dal file, poi lo stato finale che riparte dal SAL 2. */
  function conFinale(): { l: Lavoro; fin: string } {
    const e = importaMisureSal(contratto(), FILE)
    let l = emetti(e.lavoro, e.sal[1], D)
    const f = nuovoSalFinale(l, D); l = f.lavoro
    return { l, fin: f.id }
  }

  it('stesse misure: nessuna differenza, stessi totali', () => {
    const { l, fin } = conFinale()
    const c = confrontaConXpwe(l, fin, FILE)
    expect(c.diverse).toEqual([])
    expect(c.lordoQuadra).toBe(1300)
    expect(c.lordoFile).toBe(1300)
    expect(c.scartate.map((x) => x.codice)).toEqual(['Z.99', 'C.01'])
  })

  it('una misura in più nel file: la differenza voce per voce e nei totali; non cambia niente', () => {
    const { l, fin } = conFinale()
    const c = confrontaConXpwe(l, fin, [...FILE, { codice: 'B.01', prezzo: 50, dataMis: '30/06/2026', qty: 3 }])
    expect(c.diverse).toEqual([expect.objectContaining({ codice: 'B.01', quadra: 12, file: 15, importoQuadra: 600, importoFile: 750 })])
    expect(c.lordoFile - c.lordoQuadra).toBe(150)
    expect(quantitaEseguita(rigaDi(l.avanzamenti.find((a) => a.id === fin)!, 'v2'))).toBe(12)
  })

  it('«sostituisci»: lo stato finale prende le misure del file, senza contarle due volte', () => {
    const { l, fin } = conFinale()
    const e = statoFinaleDaXpwe(l, fin, [...FILE, { codice: 'B.01', prezzo: 50, dataMis: '30/06/2026', qty: 3 }])
    const a = e.lavoro.avanzamenti.find((x) => x.id === fin)!
    expect(quantitaEseguita(rigaDi(a, 'v1'))).toBe(35)
    expect(quantitaEseguita(rigaDi(a, 'v2'))).toBe(15)
    expect(() => statoFinaleDaXpwe(emetti(e.lavoro, fin, D), fin, FILE)).toThrow(/emesso/)
  })
})

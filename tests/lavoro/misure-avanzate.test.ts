import { describe, it, expect } from 'vitest'
import {
  nuovoLavoro, nuovoComputo, aggiungiArticolo, aggiungiVoce, modificaVoce, eliminaVoce, spostaVoce, revisione, quantitaVoce, type Lavoro,
} from '../../src/shared/lavoro'
import { testoAMisure, misureATesto } from '../../src/shared/compositore/misure-edit'

/**
 * LE MISURE come nel vecchio Computo: «vedi voce» (la quantità di un'altra
 * voce entra come L1, e la segue), righe incollate da Excel, l'ordine delle
 * voci.
 */
const D = '01/01/2026'
function tre(): { l: Lavoro; rev: string; v: string[] } {
  let l = nuovoLavoro()
  const r = nuovoComputo(l, { fase: 'esecutivo', data: D }); l = r.lavoro
  const v: string[] = []
  for (const c of ['A', 'B', 'C']) {
    const a = aggiungiArticolo(l, r.id, { codice: c, descrizione: c, um: 'm2', prezzo: 1, origine: 'manuale' }); l = a.lavoro
    const x = aggiungiVoce(l, r.id, { articolo: a.id }); l = x.lavoro; v.push(x.id)
  }
  return { l, rev: r.id, v }
}

describe('vedi voce', () => {
  it('la quantità della voce richiamata entra come L1 e la segue, anche a catena', () => {
    let { l, rev, v } = tre()
    l = modificaVoce(l, rev, v[0], { misure: [{ descrizione: 'pavimento', l1: 10, l2: 5, quantita: 50 }] })
    l = modificaVoce(l, rev, v[1], { misure: [{ descrizione: 'come il pavimento', vediVoce: v[0], quantita: 0 }] })
    l = modificaVoce(l, rev, v[2], { misure: [{ descrizione: 'metà della B', n: 0.5, vediVoce: v[1], quantita: 0 }] })
    const q = () => revisione(l, rev).voci.map(quantitaVoce)
    expect(q()).toEqual([50, 50, 25])
    l = modificaVoce(l, rev, v[0], { misure: [{ descrizione: 'pavimento', l1: 10, l2: 6, quantita: 60 }] })
    expect(q()).toEqual([60, 60, 30])
  })

  it('una voce richiamata non si toglie finché ci sono richiami', () => {
    let { l, rev, v } = tre()
    l = modificaVoce(l, rev, v[1], { misure: [{ vediVoce: v[0], quantita: 0 }] })
    expect(() => eliminaVoce(l, rev, v[0])).toThrow(/richiamata/)
  })
})

describe("l'ordine delle voci", () => {
  it('si sposta prima di un\'altra, o in fondo', () => {
    let { l, rev, v } = tre()
    l = spostaVoce(l, rev, v[2], v[0])
    expect(revisione(l, rev).voci.map((x) => x.id)).toEqual([v[2], v[0], v[1]])
    l = spostaVoce(l, rev, v[2], null)
    expect(revisione(l, rev).voci.map((x) => x.id)).toEqual([v[0], v[1], v[2]])
  })
})

describe('copia e incolla con Excel', () => {
  it('le righe vanno e tornano: descrizione e fattori, formule comprese', () => {
    const righe = testoAMisure('piano terra\t2\t5,5\t3\npiano primo\t\t12+3\t2')
    // par.ug. vuote: la cella tiene il posto, L1 = 12+3, L2 = 2 (prima scivolavano: par.ug. 15, L1 2)
    expect(righe.map((r) => [r.descrizione, r.n, r.l1, r.l2, r.quantita])).toEqual([['piano terra', 2, 5.5, 3, 33], ['piano primo', null, 15, 2, 30]])
    expect(righe[1].formule).toEqual({ l1: '12+3' })
    expect(testoAMisure(misureATesto(righe)).map((r) => [r.n, r.l1, r.l2, r.quantita])).toEqual([[2, 5.5, 3, 33], [null, 15, 2, 30]])
  })
})

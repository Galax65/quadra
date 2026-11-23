import { describe, it, expect } from 'vitest'
import * as lib from 'pdf-lib'
import {
  nuovoLavoro, nuovaContabilitaLibera, voceNelContrattoLibero, nuovoSal, emetti, modificaRigaAvanzamento, importiAvanzamento, importiContratto,
  contratto, revisione, vociEccedenti, importaMisureSal, aggiungiLista, modificaLista, alberoLavoro,
} from '../../src/shared/lavoro'
import { vociConsuntivo } from '../../src/tools/lavoro/consuntivo'
import { contabilitaMotore } from '../../src/tools/lavoro/motore-contabilita'
import { calcolaSal } from '../../src/tools/contabilita/engine'
import { computoPdf } from '../../src/shared/stampa/computo-pdf'
import { paginaAvanzamento, paginaRevisione } from '../../src/tools/lavoro/schermata'

/**
 * LA CONTABILITÀ DA ZERO (lavori privati): un contratto a misura senza
 * computo; l'elenco prezzi cresce dal SAL; il computo consuntivo si stampa
 * come il computo, per il committente o per controllo.
 */
const D = '01/03/2026'
const vista = () => ({ q: '', ordine: 'manuale' as const, aperte: new Set<string>() })

describe('la contabilità senza computo', () => {
  it('il contratto è in vigore subito; nel SAL ogni articolo misurato entra nel contratto', () => {
    let l = nuovoLavoro({ oggetto: 'Villa Rossi' })
    const c = nuovaContabilitaLibera(l, { data: D, ribassoPct: 5, importoPattuito: 20000 }); l = c.lavoro
    expect(revisione(l, c.id)).toMatchObject({ tipo: 'contratto', stato: 'chiusa', contratto: { libero: true, importoPattuito: 20000 } })
    expect(importiContratto(revisione(l, c.id))).toMatchObject({ baseAsta: 20000, contrattuale: 19000 })
    expect(paginaRevisione(l, revisione(l, c.id), vista())).toContain('Contratto a misura, senza computo')
    const s = nuovoSal(l, D); l = s.lavoro
    let x = voceNelContrattoLibero(l, s.id, { codice: 'PAV.01', descrizione: 'Pavimento in gres', um: 'm2', prezzo: 45, origine: 'prezzario' }); l = x.lavoro
    l = modificaRigaAvanzamento(l, s.id, x.voce, { misure: [{ descrizione: 'soggiorno', l1: 6, l2: 5, quantita: 30 }] })
    // lo stesso articolo si riusa, non si duplica
    x = voceNelContrattoLibero(l, s.id, { codice: 'PAV.01', descrizione: 'Pavimento in gres', um: 'm2', prezzo: 45, origine: 'prezzario' })
    expect(x.nuovo).toBe(false)
    expect(revisione(l, c.id).articoli).toHaveLength(1)
    expect(importiAvanzamento(l, s.id)).toMatchObject({ lordo: 1350, netto: 1282.5 })
    // niente «oltre il contratto»: non c'è una quantità di riferimento
    expect(vociEccedenti(l, l.avanzamenti[0])).toEqual([])
    expect(paginaAvanzamento(l, l.avanzamenti[0], vista())).toContain('＋ Voce libera')
    // il motore conta allo stesso modo
    const m = contabilitaMotore(l)!
    expect(calcolaSal(m.appalto, m.partite, m.sals, 1, m.liste, m.perizie)!.totaleEseguito).toBe(1282.5)
    // emesso il SAL, non si aggiunge più
    l = emetti(l, s.id, D)
    expect(() => voceNelContrattoLibero(l, s.id, { codice: 'X', descrizione: 'x', um: 'm', prezzo: 1, origine: 'manuale' })).toThrow(/emesso/)
  })

  it('con un computo, un prezzo nuovo nel SAL non entra: è una perizia', async () => {
    const m = await import('../../src/shared/lavoro')
    let l = m.nuovoLavoro()
    const r = m.nuovoComputo(l, { fase: 'esecutivo', data: D }); l = r.lavoro
    const a = m.aggiungiArticolo(l, r.id, { codice: 'A', descrizione: 'x', um: 'm', prezzo: 1, origine: 'manuale' }); l = a.lavoro
    l = m.aggiungiVoce(l, r.id, { articolo: a.id, quantita: 1 }).lavoro
    l = m.chiudi(l, r.id, D)
    l = m.promuoviAContratto(l, r.id, { data: D }).lavoro
    const s = nuovoSal(l, D); l = s.lavoro
    expect(() => voceNelContrattoLibero(l, s.id, { codice: 'B', descrizione: 'y', um: 'm', prezzo: 2, origine: 'manuale' })).toThrow(/perizia/)
  })

  it('una contabilità XPWE in un lavoro vuoto: il contratto dal suo elenco, i SAL dalle misure', () => {
    let l = nuovaContabilitaLibera(nuovoLavoro(), { data: D }).lavoro
    const e = importaMisureSal(l, [
      { codice: 'A.01', desc_short: 'Scavo', um: 'm3', prezzo: 20, dataMis: '10/03/2026', qty: 10 },
      { codice: 'B.01', desc_short: 'Muratura', um: 'm2', prezzo: 50, dataMis: '20/05/2026', qty: 4 },
      { codice: 'A.01', desc_short: 'Scavo', um: 'm3', prezzo: 20, dataMis: '22/05/2026', qty: 5 },
    ])
    l = e.lavoro
    expect(e.scartate).toEqual([])
    expect(e.sal).toHaveLength(2)
    expect(revisione(l, contratto(l)!.id).articoli.map((a) => a.codice)).toEqual(['A.01', 'B.01'])
    expect(importiAvanzamento(l, e.sal[1])).toMatchObject({ lordo: 500 })   // 15 m3 × 20 + 4 m2 × 50
  })
})

describe('il computo consuntivo, come il computo', () => {
  it('le voci contabilizzate a tutto il SAL, con le misure e i lavori in economia; si stampa', async () => {
    let l = nuovoLavoro({ oggetto: 'Villa Rossi' })
    l = nuovaContabilitaLibera(l, { data: D }).lavoro
    const s = nuovoSal(l, D); l = s.lavoro
    const x = voceNelContrattoLibero(l, s.id, { codice: 'PAV.01', descrizione: 'Pavimento', um: 'm2', prezzo: 45, origine: 'prezzario' }); l = x.lavoro
    l = modificaRigaAvanzamento(l, s.id, x.voce, { misure: [{ descrizione: 'soggiorno', l1: 6, l2: 5, quantita: 30 }] })
    const ls = aggiungiLista(l, D, 1); l = modificaLista(ls.lavoro, ls.id, { operai: [{ qualifica: 'operaio', ore: 8, tariffaOraria: 30 }] })
    const v = vociConsuntivo(l, s.id)
    expect(v.map((y) => [y.codice, y.qty, y.prezzo])).toEqual([['PAV.01', 30, 45], ['EC.01', 1, 240]])
    expect(v[0].misurazioni).toHaveLength(1)
    const out = await computoPdf(lib, v, { oggetto: 'Villa Rossi' }, { titolo: 'COMPUTO CONSUNTIVO' })
    expect(out.totale).toBe(1590)
    expect(out.pagine).toBeGreaterThan(0)
    expect(alberoLavoro(l).find((x) => x.id === 'contabilita')!.nodi[0].documenti!.map((d) => d.tipo)).toContain('consuntivo-pdf')
  })
})

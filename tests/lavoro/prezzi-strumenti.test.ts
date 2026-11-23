import { describe, it, expect } from 'vitest'
import {
  nuovoLavoro, nuovoComputo, aggiungiArticolo, modificaArticolo, revisione, variaPrezzi, confrontaConPrezzario, applicaPrezzario, rendiNuovoPrezzo, type Lavoro,
} from '../../src/shared/lavoro'

/**
 * I PREZZI DELL'ELENCO come nel vecchio Computo: storico di ogni cambio (e il
 * listino alla prima modifica), variazione in blocco, aggiornamento dal
 * prezzario per codice, nuovi prezzi.
 */
const D = '01/01/2026'
function elenco(): { l: Lavoro; rev: string; a: string[] } {
  let l = nuovoLavoro()
  const r = nuovoComputo(l, { fase: 'esecutivo', data: D }); l = r.lavoro
  const a: string[] = []
  for (const [c, p, sic] of [['A.01', 20, false], ['B.01', 50, false], ['S.01', 5, true]] as const) {
    const x = aggiungiArticolo(l, r.id, { codice: c, descrizione: c, um: 'm', prezzo: p, origine: 'prezzario', ...(sic ? { sicurezza: true } : {}) }); l = x.lavoro; a.push(x.id)
  }
  return { l, rev: r.id, a }
}

describe('i prezzi dell\'elenco', () => {
  it('ogni cambio resta nello storico; il listino si conserva alla prima modifica', () => {
    let { l, rev, a } = elenco()
    l = modificaArticolo(l, rev, a[0], { prezzo: 22 }, 'trattativa')
    l = modificaArticolo(l, rev, a[0], { prezzo: 21 })
    const x = revisione(l, rev).articoli[0]
    expect(x.prezzoListino).toBe(20)
    expect(x.storico!.map((s) => [s.da, s.a, s.nota])).toEqual([[20, 22, 'trattativa'], [22, 21, undefined]])
  })

  it('variazione in blocco: tutti tranne la sicurezza', () => {
    const { l, rev } = elenco()
    const x = variaPrezzi(l, rev, 10)
    expect(x.n).toBe(2)
    expect(revisione(x.lavoro, rev).articoli.map((y) => y.prezzo)).toEqual([22, 55, 5])
  })

  it('dal prezzario dell\'anno nuovo, per codice: solo i diversi; applicati entrano nello storico', () => {
    const { l, rev } = elenco()
    const diff = confrontaConPrezzario(revisione(l, rev), [{ codice: 'A.01', prezzo: 21, anno: 2026 }, { codice: 'A.01', prezzo: 20.5, anno: 2025 }, { codice: 'B.01', prezzo: 50 }])
    expect(diff.map((d) => [d.codice, d.attuale, d.nuovo, d.diffPct])).toEqual([['A.01', 20, 21, 5]])
    const l2 = applicaPrezzario(l, rev, diff, 'dal prezzario 2026')
    expect(revisione(l2, rev).articoli[0].storico![0].nota).toBe('dal prezzario 2026')
  })

  it('rendi nuovo prezzo: NP.nn con il codice da cui nasce', () => {
    const { l, rev, a } = elenco()
    const x = rendiNuovoPrezzo(l, rev, a[1])
    expect(x.codice).toBe('NP.01')
    expect(revisione(x.lavoro, rev).articoli[1]).toMatchObject({ codice: 'NP.01', origine: 'np', codiceOrig: 'B.01' })
  })
})

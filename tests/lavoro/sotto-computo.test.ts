import { describe, it, expect } from 'vitest'
import {
  nuovoLavoro, nuovoComputo, aggiungiArticolo, aggiungiVoce, modificaVoce, chiudi, promuoviAContratto, nuovoSal, emetti, revisione,
  impostaSottoComputo, eseguitoSotto, quotaDaSotto, totaleSotto, sottoCongelato, importiAvanzamento, type Lavoro,
} from '../../src/shared/lavoro'
import { contabilitaMotore } from '../../src/tools/lavoro/motore-contabilita'
import { calcolaSal } from '../../src/tools/contabilita/engine'
import { librettoSottoComputiHTML } from '../../src/tools/contabilita/engine/sotto-computo'
import { paginaRevisione, paginaAvanzamento } from '../../src/tools/lavoro/schermata'

/**
 * I LAVORI A CORPO col SOTTO-COMPUTO (dalla vecchia Contabilità): la quota del
 * SAL discende dall'eseguito delle lavorazioni; il sotto-computo si congela
 * quando un SAL emesso l'ha usato.
 */
const D = '01/01/2026'
const vista = () => ({ q: '', ordine: 'manuale' as const, aperte: new Set<string>() })

function corpo(): { l: Lavoro; rev: string; voce: string } {
  let l = nuovoLavoro()
  const r = nuovoComputo(l, { fase: 'esecutivo', data: D }); l = r.lavoro
  const a = aggiungiArticolo(l, r.id, { codice: 'C.01', descrizione: 'Impianto elettrico', um: 'a corpo', prezzo: 10000, origine: 'manuale' }); l = a.lavoro
  const v = aggiungiVoce(l, r.id, { articolo: a.id, quantita: 1 }); l = v.lavoro
  l = modificaVoce(l, r.id, v.id, { corpo: true })
  l = impostaSottoComputo(l, r.id, v.id, [
    { id: 's1', descrizione: 'Quadri', um: 'cad', qty: 2, prezzo: 2000 },     // 4000
    { id: 's2', descrizione: 'Linee', um: 'm', qty: 600, prezzo: 10 },        // 6000
  ])
  return { l, rev: r.id, voce: v.id }
}

describe('il sotto-computo dei lavori a corpo', () => {
  it('nel computo: lavorazioni, totale, quadratura col corpo', () => {
    const { l, rev, voce } = corpo()
    const v = revisione(l, rev).voci[0]
    expect(totaleSotto(v)).toBe(10000)
    const vi = vista(); vi.aperte.add(voce)
    expect(paginaRevisione(l, revisione(l, rev), vi)).toContain('quadra')
  })

  it('nel SAL: la quota discende dall\'eseguito; il motore conta allo stesso modo; il libretto dei sotto-computi', () => {
    let { l, rev, voce } = corpo()
    l = chiudi(l, rev, D)
    l = promuoviAContratto(l, rev, { data: D }).lavoro
    const s = nuovoSal(l, D); l = s.lavoro
    l = eseguitoSotto(l, s.id, voce, 's1', 2)      // 4000
    l = eseguitoSotto(l, s.id, voce, 's2', 150)    // 1500
    const a = l.avanzamenti[0]
    expect(a.righe[0].quotaPct).toBe(55)
    expect(quotaDaSotto(revisione(l, a.leggeDa).voci[0], a.righe[0])).toBe(55)
    expect(importiAvanzamento(l, s.id).lavori).toBe(5500)
    const m = contabilitaMotore(l)!
    expect(calcolaSal(m.appalto, m.partite, m.sals, 1, m.liste, m.perizie)!.lavoriCorpo).toBe(5500)
    expect(librettoSottoComputiHTML(m.appalto, m.partite, m.sals[0])).toContain('Linee')
    const vi = vista(); vi.aperte.add(voce)
    expect(paginaAvanzamento(l, a, vi)).toContain('quota 55,00 %')
    // emesso, il sotto-computo è congelato
    l = emetti(l, s.id, D)
    expect(sottoCongelato(l, voce)).toBe(true)
  })

  it('solo per i lavori a corpo', () => {
    let l = nuovoLavoro()
    const r = nuovoComputo(l, { fase: 'esecutivo', data: D }); l = r.lavoro
    const a = aggiungiArticolo(l, r.id, { codice: 'A', descrizione: 'x', um: 'm', prezzo: 1, origine: 'manuale' }); l = a.lavoro
    const v = aggiungiVoce(l, r.id, { articolo: a.id }); l = v.lavoro
    expect(() => impostaSottoComputo(l, r.id, v.id, [])).toThrow(/a corpo/)
  })
})

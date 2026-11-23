import { describe, it, expect } from 'vitest'
import {
  nuovoLavoro, nuovoComputo, aggiungiArticolo, aggiungiVoce, chiudi, revisione, impostaQE, impostaOfferte, promuoviAContratto, contratto, importiContratto, type Lavoro,
} from '../../src/shared/lavoro'
import { paginaQE, paginaOfferte } from '../../src/tools/lavoro/progetto-pagine'
import { normalizzaQE } from '../../src/shared/quadro-economico'
import type { VoceComputo } from '../../src/shared/xpwe/xpwe'

/**
 * QUADRO ECONOMICO e OFFERTE di una revisione di computo (portati dal vecchio
 * Computo): i calcoli condivisi, le pagine, e il contratto dall'offerta.
 */
const D = '01/01/2026'
function computo(): { l: Lavoro; id: string; voci: VoceComputo[] } {
  let l = nuovoLavoro()
  const r = nuovoComputo(l, { fase: 'esecutivo', data: D }); l = r.lavoro
  const a = aggiungiArticolo(l, r.id, { codice: 'A.01', descrizione: 'Scavo', um: 'm3', prezzo: 20, origine: 'prezzario' }); l = a.lavoro
  const s = aggiungiArticolo(l, r.id, { codice: 'S.01', descrizione: 'Recinzione', um: 'm', prezzo: 5, origine: 'prezzario', sicurezza: true }); l = s.lavoro
  l = aggiungiVoce(l, r.id, { articolo: a.id, quantita: 100 }).lavoro
  l = aggiungiVoce(l, r.id, { articolo: s.id, quantita: 20 }).lavoro
  const voci: VoceComputo[] = [{ codice: 'A.01', um: 'm3', prezzo: 20, qty: 100 }, { codice: 'S.01', um: 'm', prezzo: 5, qty: 20, sicurezza: true }]
  return { l, id: r.id, voci }
}

describe('il quadro economico', () => {
  it('A dal computo; le somme a disposizione proposte; il totale', () => {
    const { l, id } = computo()
    const h = paginaQE(revisione(l, id))
    expect(h).toContain('€ 2.000,00')   // A1
    expect(h).toContain('€ 100,00')     // A2
    expect(h).toContain('IVA sui lavori')
    const l2 = impostaQE(l, id, { ...normalizzaQE(undefined), righeB: [{ codice: 'B1', descrizione: 'IVA', tipo: 'percentuale', valore: 10, base: 'A' }] })
    expect(paginaQE(revisione(l2, id))).toContain('€ 2.310,00')   // 2100 + 210
  })
})

describe('le offerte e il contratto dall\'offerta', () => {
  it('graduatoria al minor prezzo; i prezzi mancanti si dicono', () => {
    const { l, id, voci } = computo()
    const l2 = impostaOfferte(l, id, [
      { id: 'o1', nome: 'Rossi Srl', ribassoPct: 10 },
      { id: 'o2', nome: 'Bianchi Spa', ribassoPct: 15 },
      { id: 'o3', nome: 'Verdi', prezzi: {} },
    ])
    const h = paginaOfferte(l2, revisione(l2, id), voci)
    expect(h).toContain('migliore')
    expect(h).toContain('1 prezzo mancante')
    expect(h).toContain('ribasso 15,0000%')
  })

  it('a computo consegnato, l\'offerta migliore fa il contratto (prezzi per articolo)', () => {
    const { l: l0, id, voci } = computo()
    let l = chiudi(l0, id, D)
    l = impostaOfferte(l, id, [{ id: 'o1', nome: 'Rossi Srl', prezzi: { 'A.01': 18 } }])
    expect(paginaOfferte(l, revisione(l, id), voci)).toContain('lvOffContratto(')
    // quello che fa «→ Contratto»: i prezzi dell'offerta, per articolo
    const r = revisione(l, id)
    const prezziOfferti = Object.fromEntries(r.articoli.filter((a) => !a.sicurezza).map((a) => [a.id, 18]))
    l = promuoviAContratto(l, id, { data: D, offerente: 'Rossi Srl', prezziOfferti }).lavoro
    expect(importiContratto(contratto(l)!)).toMatchObject({ baseAsta: 2000, contrattuale: 1900, ribassoRisultante: 10 })
  })
})

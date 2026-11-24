import { describe, it, expect } from 'vitest'
import * as lib from 'pdf-lib'
import {
  nuovoLavoro, nuovoComputo, aggiungiArticolo, aggiungiVoce, chiudi, promuoviAContratto, nuovoSal, emetti, nuovoSalFinale, nuovoCre,
  modificaRigaAvanzamento, impostaContabilita, aggiungiFattura, datiContabilita, type Lavoro,
} from '../../src/shared/lavoro'
import { contabilitaMotore } from '../../src/tools/lavoro/motore-contabilita'
import {
  situazioneContabilePdf, confrontoProgettoEseguitoPdf, frontespizioHTML, salAOA, registroAOA, sommarioAOA, pacchettoAperto, calcolaSal, vistoFatturaHTML,
} from '../../src/tools/contabilita/engine'
import { consuntivoHTML } from '../../src/tools/contabilita/engine/consuntivo'
import { penale, penaleHTML } from '../../src/tools/contabilita/engine/penali'
import { tempi } from '../../src/tools/contabilita/engine/tempi'
import { statoSvincolo, svincoloHTML } from '../../src/tools/contabilita/engine/svincolo'

/**
 * Le stampe della contabilità portate dalla vecchia Contabilità: escono dal
 * motore con i dati del lavoro, compresi quelli della chiusura (conto
 * finale, DURC, CRE approvato, contabilità semplificata).
 */
const D = '01/03/2026'
function chiuso(): Lavoro {
  let l = nuovoLavoro({ oggetto: 'Scuola', committente: 'Comune di Prova', impresa: 'Edile Srl' })
  const r = nuovoComputo(l, { fase: 'esecutivo', data: D }); l = r.lavoro
  const a = aggiungiArticolo(l, r.id, { codice: 'A.01', descrizione: 'Scavo', um: 'm3', prezzo: 20, origine: 'prezzario' }); l = a.lavoro
  const v = aggiungiVoce(l, r.id, { articolo: a.id, quantita: 100 }); l = v.lavoro
  l = chiudi(l, r.id, D)
  l = promuoviAContratto(l, r.id, { data: D, ribassoPct: 10 }).lavoro
  l = impostaContabilita(l, { dataConsegna: '01/03/2026', giorniUtili: 30, penalePerMille: 1, dataUltimazione: '10/04/2026', durcRegolare: true, durcData: '15/05/2026', semplificata: true })
  const s = nuovoSal(l, D); l = modificaRigaAvanzamento(s.lavoro, s.id, v.id, { quantita: 40 }); l = emetti(l, s.id, '15/03/2026')
  const f = nuovoSalFinale(l, '10/04/2026'); l = modificaRigaAvanzamento(f.lavoro, f.id, v.id, { quantita: 100 }); l = emetti(l, f.id, '12/04/2026')
  const c = nuovoCre(l, '01/05/2026'); l = emetti(c.lavoro, c.id, '10/05/2026')
  return aggiungiFattura(l, { numero: '12', data: '20/04/2026', importo: 1800, oggetto: 'Scavi', vistoData: '25/04/2026' })
}

describe('le stampe della chiusura e i file', () => {
  it('situazione, confronto, consuntivo, copertina', async () => {
    const m = contabilitaMotore(chiuso())!
    expect((await situazioneContabilePdf(lib, m.appalto, m.partite, m.sals, m.liste)).pagine).toBeGreaterThan(0)
    expect((await confrontoProgettoEseguitoPdf(lib, m.appalto, m.partite, m.sals, 1, m.liste)).pagine).toBeGreaterThan(0)
    expect(consuntivoHTML(m.appalto, m.partite, m.sals, 2, m.liste)).toContain('Scavo')
    expect(frontespizioHTML(m.appalto, m.partite)).toContain('Scuola')
  })

  it('penale: 30 giorni dalla consegna, ultimazione con 10 giorni di ritardo', () => {
    const m = contabilitaMotore(chiuso())!
    const t = tempi(m.appalto, m.verbali, '20/05/2026')
    expect(t.termineVigente).toBe('31/03/2026')
    expect(t.ritardo).toBe(10)
    const p = penale(m.appalto, m.partite, t)
    expect(penaleHTML(p, t)).toMatch(/penale/i)
  })

  it('svincolo: CRE approvato e DURC regolare, la ritenuta si svincola', () => {
    const m = contabilitaMotore(chiuso())!
    expect(m.appalto.collaudo).toMatchObject({ tipo: 'cre', dataApprovazione: '10/05/2026' })
    const res = calcolaSal(m.appalto, m.partite, m.sals, 2, m.liste, m.perizie)!
    const s = statoSvincolo(m.appalto, res.ritenuta)
    expect(svincoloHTML(s)).toMatch(/svincol/i)
  })

  it('Excel di SAL, registro, sommario; formato aperto; visto sulla fattura', () => {
    const l = chiuso()
    const m = contabilitaMotore(l)!
    expect(salAOA(m.appalto, m.partite, m.sals, 1, m.liste).length).toBeGreaterThan(3)
    expect(registroAOA(m.appalto, m.partite, m.sals, m.liste).length).toBeGreaterThan(3)
    expect(sommarioAOA(m.appalto, m.partite, m.sals, 1, m.liste).length).toBeGreaterThan(3)
    const file = pacchettoAperto({ appalto: m.appalto, partite: m.partite, sals: m.sals })
    expect(file.map((f) => f.nome)).toEqual(expect.arrayContaining([expect.stringMatching(/\.csv$/)]))
    const f = datiContabilita(l).fatture![0]
    expect(vistoFatturaHTML(m.appalto, f, m.partite, m.sals, datiContabilita(l).fatture, m.liste)).toContain('12')
  })
})


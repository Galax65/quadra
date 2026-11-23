// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { webcrypto } from 'node:crypto'
import {
  nuovoLavoro, nuovoComputo, aggiungiArticolo, aggiungiVoce, chiudi, promuoviAContratto, nuovoSal, emetti, riapriAvanzamento,
  modificaRigaAvanzamento, firmaAvanzamento, registraConsegna, attiDi, type Lavoro,
} from '../../src/shared/lavoro'
import { contabilitaMotore } from '../../src/tools/lavoro/motore-contabilita'
import { improntaSal, verificaSal, librettoHTML, registroHTML, salHTML, certificatoHTML, partiteVigenti } from '../../src/tools/contabilita/engine'
import { fondiAtti } from '../../src/shared/doc/fascicolo'

/**
 * FIRMA DEL SAL e FASCICOLO (portati dalla vecchia Contabilità): il SAL emesso
 * porta l'impronta degli atti; se si riapre e si cambia, la verifica lo dice.
 * Gli atti si fondono in un documento solo; ogni atto prodotto si registra.
 */
const g = globalThis as { crypto?: { subtle?: unknown } }
if (!g.crypto?.subtle) g.crypto = webcrypto as never
const D = '01/01/2026'

function conSal(): { l: Lavoro; sal: string; voce: string } {
  let l = nuovoLavoro({ oggetto: 'Scuola' })
  const r = nuovoComputo(l, { fase: 'esecutivo', data: D }); l = r.lavoro
  const a = aggiungiArticolo(l, r.id, { codice: 'A.01', descrizione: 'Scavo', um: 'm3', prezzo: 20, origine: 'prezzario' }); l = a.lavoro
  const v = aggiungiVoce(l, r.id, { articolo: a.id, quantita: 10 }); l = v.lavoro
  l = chiudi(l, r.id, D)
  l = promuoviAContratto(l, r.id, { data: D, ribassoPct: 10 }).lavoro
  const s = nuovoSal(l, D); l = s.lavoro
  l = modificaRigaAvanzamento(l, s.id, v.id, { quantita: 4 })
  return { l, sal: s.id, voce: v.id }
}

describe('la firma del SAL con impronta', () => {
  it('integro finché non si cambia; riaperto e cambiato, la verifica lo dice e la riapertura resta scritta', async () => {
    let { l, sal, voce } = conSal()
    l = emetti(l, sal, D)
    const m = contabilitaMotore(l)!
    const h = (await improntaSal(m.appalto, m.partite, m.sals, 1, m.liste))!
    l = firmaAvanzamento(l, sal, h)
    let m2 = contabilitaMotore(l)!
    expect((await verificaSal(m2.appalto, m2.partite, m2.sals, 1, m2.liste)).esito).toBe('integro')
    // si riapre: la riapertura resta, con l'impronta che aveva
    l = riapriAvanzamento(l, sal)
    expect(l.avanzamenti[0].sblocchi).toEqual([expect.objectContaining({ impronta: h })])
    l = modificaRigaAvanzamento(l, sal, voce, { quantita: 5 })
    l = emetti(l, sal, D)
    l = firmaAvanzamento(l, sal, h)   // anche rimettendo la vecchia impronta, gli atti non tornano
    m2 = contabilitaMotore(l)!
    expect((await verificaSal(m2.appalto, m2.partite, m2.sals, 1, m2.liste)).esito).toBe('modificato')
  })

  it('si firma solo un avanzamento emesso', () => {
    const { l, sal } = conSal()
    expect(() => firmaAvanzamento(l, sal, 'x')).toThrow(/emesso/)
  })
})

describe('il fascicolo e il registro degli atti', () => {
  it('libretto, registro, SAL e certificato in un documento, uno per pagina', () => {
    const { l: l0, sal } = conSal()
    const l = emetti(l0, sal, D)
    const m = contabilitaMotore(l)!
    const pv = partiteVigenti(m.partite, m.perizie, 1)
    const h = fondiAtti([librettoHTML(m.appalto, pv, m.sals[0], m.liste), registroHTML(m.appalto, pv, m.sals), salHTML(m.appalto, m.partite, m.sals, 1), certificatoHTML(m.appalto, m.partite, m.sals, 1)])
    expect((h.match(/class="atto-seguente"/g) || []).length).toBe(3)
    expect(h).toContain('break-before:page')
  })

  it('un atto prodotto si registra una volta per tipo e SAL (la ristampa lo aggiorna)', () => {
    let { l } = conSal()
    l = registraConsegna(l, { tipo: 'certificato', label: 'Certificato n. 1', data: D, salNumero: 1, impronta: 'aaa' })
    l = registraConsegna(l, { tipo: 'certificato', label: 'Certificato n. 1', data: D, salNumero: 1, impronta: 'bbb' })
    l = registraConsegna(l, { tipo: 'libretto', label: 'Libretto n. 1', data: D, salNumero: 1 })
    expect(attiDi(l).consegne.map((c) => [c.tipo, c.impronta])).toEqual([['certificato', 'bbb'], ['libretto', undefined]])
    expect(contabilitaMotore(l)!.consegne).toHaveLength(2)
  })
})

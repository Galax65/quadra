import { describe, it, expect } from 'vitest'
import {
  nuovoLavoro, impostaContabilita, aggiungiSospensione, modificaSospensione, aggiungiProroga, tempiLavoro, datiContabilita, alberoLavoro,
} from '../../src/shared/lavoro'
import { paginaContabilita } from '../../src/tools/lavoro/contabilita'

/**
 * I DATI DELLA CONTABILITÀ: il contratto come atto, i tempi, i pagamenti. I
 * tempi si contano dagli atti: consegna + giorni utili, più le sospensioni
 * chiuse dalla ripresa e le proroghe, danno il termine vigente.
 */
describe('i tempi del lavoro', () => {
  it('consegna + giorni utili + sospensioni + proroghe = termine vigente; il ritardo all\'ultimazione', () => {
    let l = impostaContabilita(nuovoLavoro(), { dataConsegna: '01/03/2026', giorniUtili: 100 })
    expect(tempiLavoro(l).termineContrattuale).toBe('09/06/2026')
    l = aggiungiSospensione(l, { dal: '01/04/2026', motivo: 'meteo' })
    let t = tempiLavoro(l)
    expect(t.sospensioneAperta).toBe(true)
    expect(() => aggiungiSospensione(l, { dal: '05/04/2026' })).toThrow(/ripresa/)
    l = modificaSospensione(l, datiContabilita(l).sospensioni[0].id, { al: '21/04/2026' })
    l = aggiungiProroga(l, { data: '01/06/2026', giorni: 15 })
    t = tempiLavoro(l)
    expect([t.giorniSospensione, t.giorniProroga, t.termineVigente]).toEqual([20, 15, '14/07/2026'])
    l = impostaContabilita(l, { dataUltimazione: '24/07/2026' })
    expect(tempiLavoro(l)).toMatchObject({ ritardo: 10, residuo: -10 })
  })

  it('senza consegna o giorni utili il termine non si calcola, e si dice perché', () => {
    expect(tempiLavoro(nuovoLavoro()).nonCalcolabile).toMatch(/consegna/)
    expect(tempiLavoro(impostaContabilita(nuovoLavoro(), { dataConsegna: '01/03/2026' })).nonCalcolabile).toMatch(/giorni utili/)
  })

  it('la ritenuta non si sceglie: è quella di legge (0,50%), e la pagina lo dice', () => {
    expect('ritenutaPct' in datiContabilita(nuovoLavoro())).toBe(false)
  })
})

describe('la pagina e la sidebar', () => {
  it('sotto DATI DEL LAVORO: contratto, tempi e pagamenti, con il termine vigente', () => {
    const l = impostaContabilita(nuovoLavoro(), { dataConsegna: '01/03/2026', giorniUtili: 100 })
    const dati = alberoLavoro(l).find((s) => s.id === 'dati')!
    expect(dati.nodi[1]).toMatchObject({ apre: { cosa: 'contabilita' }, etichetta: 'Contratto, tempi e pagamenti', nota: 'termine 09/06/2026' })
    const s = aggiungiSospensione(l, { dal: '01/04/2026' })
    expect(alberoLavoro(s).find((x) => x.id === 'dati')!.nodi[1].nota).toBe('lavori sospesi')
  })

  it('la pagina: i tre riquadri, il quadro dei tempi, la penale col ritardo', () => {
    let l = impostaContabilita(nuovoLavoro(), { dataConsegna: '01/03/2026', giorniUtili: 100, penalePerMille: 1, dataUltimazione: '19/06/2026' })
    l = aggiungiProroga(l, { giorni: 0 })
    const h = paginaContabilita(l, '23/11/2026')
    expect(h).toContain('Il contratto')
    expect(h).toContain('I tempi')
    expect(h).toContain('I pagamenti')
    expect(h).toContain("Termine vigente per l'ultimazione")
    expect(h).toContain('09/06/2026')
    expect(h).toContain('ritardo 10 giorni')
    expect(h).toContain('lvSospNuova()')
  })
})

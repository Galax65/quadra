import { describe, it, expect } from 'vitest'
import { nuovoLavoro, nuovoComputo, aggiungiArticolo, aggiungiVoce, modificaVoce, chiudi, revisione, cambiaStruttura, strutturaDi, type Lavoro } from '../../src/shared/lavoro'
import { rinominaCategoria, eliminaCategoria, ricodificaWbs, modelloDaProgetto, applicaModello } from '../../src/shared/struttura-computo'
import { paginaStruttura } from '../../src/tools/lavoro/struttura-pagina'

/**
 * LA STRUTTURA del computo (dal vecchio Computo): categorie e WBS, rami e
 * nodi che valgono per tutte le loro voci, modelli da riusare.
 */
const D = '01/01/2026'
function conCategorie(): { l: Lavoro; rev: string; v: string[] } {
  let l = nuovoLavoro()
  const r = nuovoComputo(l, { fase: 'esecutivo', data: D }); l = r.lavoro
  const a = aggiungiArticolo(l, r.id, { codice: 'A', descrizione: 'Scavo', um: 'm3', prezzo: 10, origine: 'manuale' }); l = a.lavoro
  const v: string[] = []
  for (const [cat, wbs] of [['Edile · Scavi', '01.01'], ['Edile · Murature', '01.02'], ['Impianti · Elettrico', '02']]) {
    const x = aggiungiVoce(l, r.id, { articolo: a.id, quantita: 1 }); l = modificaVoce(x.lavoro, r.id, x.id, { categoria: cat, wbs }); v.push(x.id)
  }
  return { l, rev: r.id, v }
}

describe('categorie e WBS', () => {
  it('rinominare un ramo vale per tutte le sue voci; togliere lo leva alle voci', () => {
    let { l, rev } = conCategorie()
    l = cambiaStruttura(l, rev, (x) => { rinominaCategoria(x.categoria, x.s.dichiarate, ['Edile'], 'Opere edili') })
    expect(revisione(l, rev).voci.map((v) => v.categoria)).toEqual(['Opere edili · Scavi', 'Opere edili · Murature', 'Impianti · Elettrico'])
    l = cambiaStruttura(l, rev, (x) => { eliminaCategoria(x.categoria, x.s.dichiarate, ['Impianti']) })
    expect(revisione(l, rev).voci[2].categoria).toBeUndefined()
  })

  it('un ramo senza voci si dichiara; la WBS si ricodifica coi figli; la pagina li mostra', () => {
    let { l, rev } = conCategorie()
    l = cambiaStruttura(l, rev, (x) => { x.s.dichiarate.push('Finiture · Pavimenti'); x.s.wbsNodi['01'] = 'Opere edili' })
    l = cambiaStruttura(l, rev, (x) => { ricodificaWbs(x.wbs, x.s.wbsNodi, '01', '03') })
    expect(revisione(l, rev).voci.map((v) => v.wbs)).toEqual(['03.01', '03.02', '02'])
    expect(strutturaDi(revisione(l, rev)).wbsNodi).toEqual({ '03': 'Opere edili' })
    const h = paginaStruttura(revisione(l, rev), [])
    expect(h).toContain('Pavimenti')
    expect(h).toContain('Opere edili')
  })

  it('i modelli: dalla struttura di un lavoro a un altro', () => {
    const { l, rev } = conCategorie()
    const r = revisione(l, rev)
    const m = modelloDaProgetto('Scuole', Object.fromEntries(r.voci.map((v) => [v.id, v.categoria])), r.voci.map((v) => v.id), [], Object.fromEntries(r.voci.map((v) => [v.id, v.wbs])), {})
    let l2 = nuovoLavoro()
    const r2 = nuovoComputo(l2, { fase: 'PFTE', data: D }); l2 = r2.lavoro
    l2 = cambiaStruttura(l2, r2.id, (x) => { applicaModello(m, x.s.dichiarate, x.s.wbsNodi) })
    expect(strutturaDi(revisione(l2, r2.id)).dichiarate).toEqual(['Edile · Scavi', 'Edile · Murature', 'Impianti · Elettrico'])
  })

  it('a revisione consegnata la struttura si legge soltanto', () => {
    const { l: l0, rev } = conCategorie()
    const l = chiudi(l0, rev, D)
    expect(() => cambiaStruttura(l, rev, () => undefined)).toThrow(/consegnata/)
    expect(paginaStruttura(revisione(l, rev), [])).toContain('sola lettura')
  })
})

import { describe, it, expect } from 'vitest'
import { nuovoLavoro, nuovoComputo, aggiungiArticolo, aggiungiVoce, modificaVoce, cambiaStruttura, revisione, alberoLavoro, type Lavoro } from '../../src/shared/lavoro'
import { paginaRevisione, vociVisibili, type Vista } from '../../src/tools/lavoro/schermata'
import { scelteStruttura } from '../../src/tools/lavoro/struttura-pagina'

/**
 * CATEGORIE E WBS: si organizzano in una pagina loro, l'ordine dato lì vale
 * nelle viste raggruppate, e sulla riga della voce non stanno (lo dice
 * l'intestazione del gruppo).
 */
const D = '01/01/2026'
const vista = (ordine: Vista['ordine']): Vista => ({ q: '', ordine, aperte: new Set() })
function lavoro(): { l: Lavoro; rev: string } {
  let l = nuovoLavoro()
  const r = nuovoComputo(l, { fase: 'esecutivo', data: D }); l = r.lavoro
  const a = aggiungiArticolo(l, r.id, { codice: 'A', descrizione: 'Voce', um: 'm', prezzo: 1, origine: 'manuale' }); l = a.lavoro
  // in ordine di inserimento: Impianti, poi Edile, poi Arredi (alfabetico sarebbe Arredi, Edile, Impianti)
  for (const [cat, wbs] of [['Impianti', '02'], ['Edile', '01.02'], ['Arredi', '03'], ['Edile', '01.01']]) {
    const x = aggiungiVoce(l, r.id, { articolo: a.id, quantita: 1 }); l = modificaVoce(x.lavoro, r.id, x.id, { categoria: cat, wbs })
  }
  l = cambiaStruttura(l, r.id, (x) => { x.s.wbsNodi['01'] = 'Opere edili' })
  return { l, rev: r.id }
}
const cat = (l: Lavoro, rev: string, o: Vista['ordine']): string[] => vociVisibili(revisione(l, rev), vista(o)).map((x) => `${x.voce.categoria}`)

describe('categorie e WBS', () => {
  it('la vista per categorie segue l\'ordine della struttura, non l\'alfabeto', () => {
    const { l, rev } = lavoro()
    expect(cat(l, rev, 'categorie')).toEqual(['Impianti', 'Edile', 'Edile', 'Arredi'])
    // spostato «Arredi» in testa nella pagina Categorie e WBS, la vista lo segue
    const l2 = cambiaStruttura(l, rev, (x) => { x.s.ordineLivelli = [['Arredi', 'Impianti', 'Edile']] })
    expect(cat(l2, rev, 'categorie')).toEqual(['Arredi', 'Impianti', 'Edile', 'Edile'])
  })

  it('la vista per WBS va per codice, e il titolo del gruppo porta la descrizione del nodo', () => {
    const { l, rev } = lavoro()
    expect(vociVisibili(revisione(l, rev), vista('wbs')).map((x) => x.voce.wbs)).toEqual(['01.01', '01.02', '02', '03'])
    expect(paginaRevisione(l, revisione(l, rev), vista('wbs'))).toContain('WBS 02')
  })

  it('sulla riga della voce non c\'è l\'etichetta di categoria o WBS', () => {
    const { l, rev } = lavoro()
    const h = paginaRevisione(l, revisione(l, rev), vista('manuale'))
    expect(h).not.toContain('title="Categoria:')
    expect(h).not.toContain('lv-chip is-wbs')
  })

  it('le scelte per la voce sono i rami e i nodi della struttura, in ordine', () => {
    const { l, rev } = lavoro()
    const s = scelteStruttura(revisione(l, rev))
    expect(s.categorie.map((x) => x.valore)).toEqual(['Impianti', 'Edile', 'Arredi'])
    expect(s.wbs.map((x) => x.valore)).toEqual(['01', '01.01', '01.02', '02', '03'])
    expect(s.wbs[0].etichetta).toContain('Opere edili')
  })

  it('la pagina sta nella sidebar, sotto DATI DEL LAVORO', () => {
    const { l, rev } = lavoro()
    const dati = alberoLavoro(l).find((x) => x.id === 'dati')!
    expect(dati.nodi.some((n) => n.apre.cosa === 'pagina' && n.apre.id === `struttura:${rev}` && n.etichetta === 'Categorie e WBS')).toBe(true)
  })
})

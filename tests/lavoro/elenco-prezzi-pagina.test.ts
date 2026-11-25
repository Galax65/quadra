import { describe, it, expect } from 'vitest'
import { nuovoLavoro, nuovoComputo, aggiungiArticolo, aggiungiVoce, chiudi, revisione, togliArticolo, promuoviAContratto, nuovaPerizia, alberoLavoro, type Lavoro } from '../../src/shared/lavoro'
import { paginaElencoPrezzi, righeElenco, corrispondeRicerca, nuovoStatoElenco } from '../../src/tools/lavoro/elenco-prezzi-pagina'

/**
 * L'ELENCO PREZZI A TUTTA PAGINA: gli articoli di una revisione si
 * consultano e (se la revisione è aperta) si correggono sul posto; quelli
 * che nessuna voce usa si vedono e si possono togliere.
 */
const D = '01/01/2026'
function lavoro(): { l: Lavoro; rev: string; usato: string; libero: string } {
  let l = nuovoLavoro()
  const r = nuovoComputo(l, { fase: 'esecutivo', data: D }); l = r.lavoro
  const a = aggiungiArticolo(l, r.id, { codice: 'A.01', descrizione: 'Scavo di sbancamento', um: 'm3', prezzo: 10, origine: 'manuale' }); l = a.lavoro
  const b = aggiungiArticolo(l, r.id, { codice: 'S.01', descrizione: 'Recinzione di cantiere', um: 'm', prezzo: 5, origine: 'manuale', sicurezza: true }); l = b.lavoro
  l = aggiungiVoce(l, r.id, { articolo: a.id, quantita: 3 }).lavoro
  return { l, rev: r.id, usato: a.id, libero: b.id }
}

describe('elenco prezzi a tutta pagina', () => {
  it('elenca gli articoli con le voci che li usano e il loro importo', () => {
    const { l, rev } = lavoro()
    const r = righeElenco(revisione(l, rev), 'tutti')
    expect(r.map((x) => [x.codice, x.usi, x.importo])).toEqual([['A.01', 1, 30], ['S.01', 0, 0]])
    expect(righeElenco(revisione(l, rev), 'inutilizzati').map((x) => x.codice)).toEqual(['S.01'])
    expect(righeElenco(revisione(l, rev), 'sicurezza').map((x) => x.codice)).toEqual(['S.01'])
  })

  it('in una revisione aperta i campi si scrivono, e si toglie solo ciò che non si usa', () => {
    const { l, rev } = lavoro()
    const h = paginaElencoPrezzi(l, revisione(l, rev), nuovoStatoElenco())
    expect(h).toContain("lvElSet(")
    expect(h).toContain('Scavo di sbancamento')
    // il ✕ c'è solo sulla riga non usata
    expect(h.match(/lvElTogli\(/g)?.length).toBe(1)
  })

  it('una revisione consegnata si consulta soltanto', () => {
    const { l: l0, rev } = lavoro()
    const l = chiudi(l0, rev, D)
    const h = paginaElencoPrezzi(l, revisione(l, rev), nuovoStatoElenco())
    expect(h).not.toContain('lvElSet(')
    expect(h).not.toContain('lvElTogli(')
    expect(h).toContain('sola lettura')
  })

  it('togliArticolo rifiuta un articolo usato da una voce', () => {
    const { l, rev, usato, libero } = lavoro()
    expect(() => togliArticolo(l, rev, usato)).toThrow(/usato da 1 voce/)
    const dopo = togliArticolo(l, rev, libero)
    expect(revisione(dopo, rev).articoli.map((a) => a.codice)).toEqual(['A.01'])
  })

  it('in perizia il prezzo degli articoli di contratto non si scrive', () => {
    const { l: l0, rev } = lavoro()
    let l = chiudi(l0, rev, D)
    l = promuoviAContratto(l, rev, { data: D, ribassoPct: 10 }).lavoro
    const p = nuovaPerizia(l, { data: D }); l = p.lavoro
    const h = paginaElencoPrezzi(l, revisione(l, p.id), nuovoStatoElenco())
    expect(h).not.toContain("'prezzo',this.value")
    expect(h).toContain('lvElNP(')
  })

  it('la ricerca vuole tutte le parole, in qualunque ordine', () => {
    expect(corrispondeRicerca('a.01 scavo di sbancamento', 'sbanc scavo')).toBe(true)
    expect(corrispondeRicerca('a.01 scavo di sbancamento', 'scavo muro')).toBe(false)
    expect(corrispondeRicerca('qualunque', '  ')).toBe(true)
  })

  it('la sidebar ha il nodo dell\'elenco prezzi del lavoro', () => {
    const { l, rev } = lavoro()
    const sez = alberoLavoro(l).find((s) => s.id === 'prezzi')!
    expect(sez.nodi[0]).toMatchObject({ apre: { cosa: 'pagina', id: `elenco:${rev}` }, etichetta: 'Elenco prezzi del lavoro' })
  })
})

import { describe, it, expect } from 'vitest'
import { ordinaVoci } from '../../src/shared/ordine-computo'
import { alberoCategorie, spostaNelLivello } from '../../src/shared/struttura-computo'

const categoria = {
  a: 'Impianti · Elettrici', b: 'Opere edili · Scavi', c: 'Opere edili · Demolizioni', d: 'Impianti · Meccanici',
}
const chiavi = ['a', 'b', 'c', 'd'] // ordine manuale: prima comparsa Impianti, poi Opere edili

describe('ordine definito della struttura (Super › Categoria › Sub)', () => {
  it('senza ordine definito vale la prima comparsa', () => {
    expect(ordinaVoci(chiavi, 'categorie', { categoria })).toEqual(['a', 'd', 'b', 'c'])
  })
  it('con l\'ordine definito i gruppi seguono la struttura, a ogni livello', () => {
    const ordineLivelli = [['Opere edili', 'Impianti'], ['Demolizioni', 'Scavi', 'Meccanici', 'Elettrici'], []]
    expect(ordinaVoci(chiavi, 'categorie', { categoria, ordineLivelli })).toEqual(['c', 'b', 'd', 'a'])
  })
  it('i nomi non elencati vengono dopo quelli elencati', () => {
    expect(ordinaVoci(chiavi, 'categorie', { categoria, ordineLivelli: [['Opere edili'], [], []] })).toEqual(['b', 'c', 'a', 'd'])
  })
  it('l\'albero della struttura segue lo stesso ordine, anche per i rami senza voci', () => {
    const t = alberoCategorie(categoria, chiavi, {}, ['Sicurezza · Recinzioni'], [['Sicurezza', 'Opere edili', 'Impianti'], [], []])
    expect(t.map((n) => n.nome)).toEqual(['Sicurezza', 'Opere edili', 'Impianti'])
  })
  it('↑ ↓ spostano un nome fra i suoi pari nell\'ordine del livello', () => {
    expect(spostaNelLivello(['A', 'B', 'C', 'X'], ['A', 'B', 'C'], 'C', -1)).toEqual(['A', 'C', 'B', 'X'])
    expect(spostaNelLivello([], ['Scavi', 'Demolizioni'], 'Scavi', 1)).toEqual(['Demolizioni', 'Scavi'])
    expect(spostaNelLivello(['A'], ['A', 'B'], 'A', -1)).toEqual(['A'])
  })
})

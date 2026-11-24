import { describe, expect, it } from 'vitest'
import { alberoCategorie, appiattisci, rinominaCategoria, eliminaCategoria, alberoWbs, ricodificaWbs, eliminaWbs, prossimoCodiceWbs, modelloDaProgetto, applicaModello, normalizzaModelli } from '../../src/shared/struttura-computo'

const base = () => ({
  categoria: { a: 'Strade · Scavi', b: 'Strade · Pavimentazioni', c: 'Legno · Parapetti', d: 'Strade · Scavi · A mano' } as Record<string, string | undefined>,
  ordine: ['a', 'c', 'b', 'd'],
  importi: { a: 100, b: 50, c: 30, d: 20 },
})

describe('albero delle categorie', () => {
  it('conteggi, importi e ordine a schermo', () => {
    const { categoria, ordine, importi } = base()
    const t = alberoCategorie(categoria, ordine, importi, ['Impianti · Illuminazione'])
    expect(t.map((n) => [n.nome, n.voci, n.importo])).toEqual([['Strade', 3, 170], ['Legno', 1, 30], ['Impianti', 0, 0]])
    expect(appiattisci(t).map((n) => n.percorso.join('/'))).toContain('Strade/Scavi/A mano')
  })
  it('rinomina (con fusione) ed elimina', () => {
    const { categoria } = base(); const dich = ['Strade · Scavi · Meccanici']
    expect(rinominaCategoria(categoria, dich, ['Strade', 'Scavi'], 'Movimenti terra')).toBe(2)
    expect(categoria.d).toBe('Strade · Movimenti terra · A mano')
    expect(dich).toEqual(['Strade · Movimenti terra · Meccanici'])
    expect(rinominaCategoria(categoria, dich, ['Strade', 'Pavimentazioni'], 'Movimenti terra')).toBe(1)
    expect(categoria.b).toBe('Strade · Movimenti terra')
    expect(eliminaCategoria(categoria, dich, ['Strade', 'Movimenti terra'])).toBe(3)
    expect(categoria.a).toBe('Strade'); expect(categoria.d).toBe('Strade')
    expect(eliminaCategoria(categoria, dich, ['Legno'])).toBe(1)
    expect(categoria.c).toBeUndefined()
  })
})

describe('WBS', () => {
  it('albero con nodi impliciti e importi cumulati', () => {
    const t = alberoWbs({ a: '01.01', b: '01.02', c: '02' }, { '01': 'Strade', '01.01': 'Scavi' }, { a: 10, b: 5, c: 1 })
    expect(t.map((n) => [n.codice, n.importo, n.implicito])).toEqual([['01', 15, false], ['01.01', 10, false], ['01.02', 5, true], ['02', 1, true]])
  })
  it('ricodifica con i figli, rifiuta codici occupati', () => {
    const w: Record<string, string | undefined> = { a: '01.01', b: '01.02', c: '02' }
    const n: Record<string, string> = { '01': 'Strade', '01.01': 'Scavi' }
    expect(ricodificaWbs(w, n, '01', '02').errore).toMatch(/già usato/)
    expect(ricodificaWbs(w, n, '01', '03')).toEqual({ voci: 2 })
    expect(w).toEqual({ a: '03.01', b: '03.02', c: '02' })
    expect(n).toEqual({ '03': 'Strade', '03.01': 'Scavi' })
    expect(ricodificaWbs(w, n, '03', '03.01').errore).toBeTruthy()
    expect(prossimoCodiceWbs(n, w)).toBe('01')
    expect(prossimoCodiceWbs(n, w, '03')).toBe('03.03')
    expect(eliminaWbs(w, n, '03')).toBe(2)
    expect(n).toEqual({})
  })
})

describe('modelli di struttura', () => {
  it('dal progetto e applicazione a un altro', () => {
    const { categoria, ordine } = base()
    const m = modelloDaProgetto('Strade comunali', categoria, ordine, [], { a: '01.01' }, { '01': 'Strade' }, 1000)
    expect(m.categorie).toEqual(['Strade · Scavi · A mano', 'Strade · Pavimentazioni', 'Legno · Parapetti'])
    expect(m.wbs).toEqual({ '01': 'Strade', '01.01': '' })
    const dich: string[] = ['Legno · Parapetti']; const nodi: Record<string, string> = { '01.01': 'Scavi' }
    expect(applicaModello(m, dich, nodi)).toEqual({ categorie: 2, wbs: 1 })
    expect(nodi).toEqual({ '01.01': 'Scavi', '01': 'Strade' })
    expect(normalizzaModelli([m, null, { x: 1 }])).toHaveLength(1)
  })
})

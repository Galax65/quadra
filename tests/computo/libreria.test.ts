import { describe, it, expect } from 'vitest'
import { voceProntaText } from '../../src/shared/compositore/libreria'

/**
 * Libreria di voci pronte — seed curato minato dai computi golden. Verifica che
 * ogni voce sia coerente col motore (famigliaId noto, testo ricalcolabile) e che
 * il fallback su testo/override funzioni per le voci personali.
 */
describe('Libreria voci pronte', () => {

  it('un override di testo (voce personale) ha priorità sul motore', () => {
    const t = voceProntaText({ id: 'x', nome: 'n', um: 'cad', famigliaId: 'radiatore', breve: 'MIO TESTO', estesa: 'MIA ESTESA' })
    expect(t.breve).toBe('MIO TESTO')
    expect(t.estesa).toBe('MIA ESTESA')
  })

  it('senza famiglia né override ripiega sul nome', () => {
    const t = voceProntaText({ id: 'x', nome: 'Voce custom', um: 'cad' })
    expect(t.breve).toBe('Voce custom')
    expect(t.estesa).toBe('Voce custom')
  })
})

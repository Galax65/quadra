import { describe, it, expect } from 'vitest'
import { migraAppIdStorici, migrateHubState, sourceForApp } from '../../src/hub/engine/project-state'

/**
 * I tool portavano nomi di lettere greche, e i loro identificativi lo dicevano
 * ancora: `miu-price-list`, `beta-contabilita`, `alfa-control-center`. Ora si
 * chiamano col loro nome — ma i progetti salvati prima portano le vecchie
 * chiavi, e devono aprirsi come prima. È la stessa promessa fatta ai file
 * `.ehub`: il nome cambia, il lavoro di chi usa il programma no.
 */
describe('identificativi storici dei tool', () => {
  it('traduce le vecchie chiavi di un progetto salvato', () => {
    const tradotto = migraAppIdStorici({
      'miu-price-list': { qty: { a: 1 } },
      'beta-contabilita': { partite: [] },
      'alfa-control-center': { x: 1 },
    })
    expect(Object.keys(tradotto).sort()).toEqual(['amministrazione', 'computo', 'contabilita'])
    expect(tradotto.computo).toEqual({ qty: { a: 1 } })
  })
  it('lascia intatta ogni altra chiave', () => {
    expect(migraAppIdStorici({ 'tau-documenti': { a: 1 } })).toEqual({ 'tau-documenti': { a: 1 } })
  })
  it('se ci sono entrambe, vince la chiave nuova: non si sovrascrive il recente col vecchio', () => {
    const t = migraAppIdStorici({ computo: { nuovo: true }, 'miu-price-list': { vecchio: true } })
    expect(t.computo).toEqual({ nuovo: true })
  })
  it('un progetto salvato con le vecchie chiavi si apre con le nuove', () => {
    const st = migrateHubState({ id: 'p1', name: 'Prova', tools: { 'beta-contabilita': { partite: [1] } } })
    expect(Object.keys(st.tools)).toEqual(['contabilita'])
  })
  it("l'etichetta di relay del Computo resta quella storica: la ascoltano gli altri tool", () => {
    expect(sourceForApp('computo')).toBe('pricelist')
    expect(sourceForApp('contabilita')).toBe('contabilita')
  })
})

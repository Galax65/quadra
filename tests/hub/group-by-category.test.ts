import { describe, it, expect } from 'vitest'
import { APP_REGISTRY, groupByCategory, CATEGORY_ORDER } from '../../src/hub/data/registry'

/**
 * Raggruppamento tematico dei tool nell'hub: Lavoro (lo strumento unico, dal
 * computo alla contabilità) e Amministrazione. Helper PURO — opera sul
 * registry GREZZO (non filtrato per visibilità: quello è compito di
 * isToolVisible/enabledApps, non di groupByCategory).
 */
describe('groupByCategory', () => {
  it('ogni tool ha una categoria valida', () => {
    for (const a of APP_REGISTRY) expect(CATEGORY_ORDER).toContain(a.category)
  })
  it('raggruppa in Lavoro e Amministrazione, in ordine', () => {
    const g = groupByCategory(APP_REGISTRY)
    expect(g.map(x => x.key)).toEqual(['lavoro', 'amministrazione'])
    expect(g[0].apps.map(a => a.id)).toEqual(['lavoro'])
    expect(g[1].apps.map(a => a.id)).toEqual(['amministrazione'])
    expect(g[0].label).toBe('Lavoro')
    expect(g[1].label).toBe('Amministrazione')
  })
  it('i gruppi vuoti (dopo un filtro) sono omessi — ricerca trasversale', () => {
    const solo = groupByCategory(APP_REGISTRY.filter(a => a.id === 'amministrazione'))
    expect(solo).toHaveLength(1)
    expect(solo[0].key).toBe('amministrazione')
  })
})

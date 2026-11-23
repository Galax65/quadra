import { describe, expect, it } from 'vitest'
import { APP_REGISTRY, type AppDef } from '../../src/hub/data/registry'
import { filterApps, parseVersionFromFilename, resolveFiles } from '../../src/hub/engine'

describe('parseVersionFromFilename', () => {
  it('estrae la versione dai filename dei tool', () => {
    expect(parseVersionFromFilename('phi_v6_12.html')).toBe('6.12')
    expect(parseVersionFromFilename('PriceList_v2_4.html')).toBe('2.4')
    expect(parseVersionFromFilename('LightCalc_Road_v0_4.html')).toBe('0.4')
    expect(parseVersionFromFilename('phi_v4_3_2.html')).toBe('4.3.2')
  })
  it('è case-insensitive sull\'estensione e tollera maiuscole', () => {
    expect(parseVersionFromFilename('phi_v6_12.HTML')).toBe('6.12')
  })
  it('ritorna null senza segmento di versione', () => {
    expect(parseVersionFromFilename('phi.html')).toBeNull()
    expect(parseVersionFromFilename('readme.html')).toBeNull()
  })
})

describe('resolveFiles', () => {
  // Copia del registry per non sporcare lo stato condiviso tra test.
  const reg = (): AppDef[] => APP_REGISTRY.map((a) => ({ ...a, resolvedFile: undefined }))

  it('risolve il file STABILE (senza versione) di ogni tool', () => {
    const files = ['Lavoro.html', 'Amministrazione.html', 'Quadra.html', 'rumore.txt']
    const out = resolveFiles(files, reg())
    const byId = Object.fromEntries(out.map((a) => [a.id, a]))
    expect(byId['lavoro'].resolvedFile).toBe('Lavoro.html')
    expect(byId['amministrazione'].resolvedFile).toBe('Amministrazione.html')
  })

  it('lascia resolvedFile null quando il file non è nella cartella', () => {
    const out = resolveFiles(['solo_questo.html'], reg())
    for (const a of out) expect(a.resolvedFile).toBeNull()
  })

  it('cartella parziale → resolvedFile misti (presenti risolti, assenti null)', () => {
    const out = resolveFiles(['Lavoro.html'], reg())
    const byId = Object.fromEntries(out.map((a) => [a.id, a]))
    expect(byId['lavoro'].resolvedFile).toBe('Lavoro.html')
    expect(byId['amministrazione'].resolvedFile).toBeNull()
  })

  it('è idempotente: ri-scansionare la stessa cartella dà lo stesso esito', () => {
    const r = reg()
    const first = resolveFiles(['Amministrazione.html', 'Lavoro.html'], r).map((a) => [a.id, a.resolvedFile])
    const second = resolveFiles(['Amministrazione.html', 'Lavoro.html'], r).map((a) => [a.id, a.resolvedFile])
    expect(second).toEqual(first)
  })

  it('una ri-scansione con cartella diversa aggiorna resolvedFile (no stato residuo)', () => {
    const r = reg()
    resolveFiles(['Amministrazione.html'], r)
    // Seconda scansione: Amministrazione sparito, Lavoro comparso → lo stato precedente non deve "appiccicarsi".
    const out = resolveFiles(['Lavoro.html'], r)
    const byId = Object.fromEntries(out.map((a) => [a.id, a]))
    expect(byId['amministrazione'].resolvedFile).toBeNull()
    expect(byId['lavoro'].resolvedFile).toBe('Lavoro.html')
  })

  it('Computo e Contabilità non ci sono più: «Lavoro» li ha presi in sé (tappa 8)', () => {
    expect(APP_REGISTRY.map((a) => a.id)).toEqual(['lavoro', 'amministrazione'])
  })
})

describe('filterApps', () => {
  it('query vuota → tutte le app (stesso riferimento)', () => {
    expect(filterApps(APP_REGISTRY, '')).toBe(APP_REGISTRY)
    expect(filterApps(APP_REGISTRY, '   ')).toBe(APP_REGISTRY)
  })
  it('filtra per nome, tagline e tag (case-insensitive)', () => {
    // «Lavoro» tiene computo e contabilità: lo trova chi cerca l'una o l'altra
    expect(filterApps(APP_REGISTRY, 'libretto').map((a) => a.id)).toEqual(['lavoro'])
    expect(filterApps(APP_REGISTRY, 'PREZZARIO').map((a) => a.id)).toEqual(['lavoro'])
    expect(filterApps(APP_REGISTRY, 'utenti').map((a) => a.id)).toEqual(['amministrazione'])
  })
  it('ritorna vuoto senza match', () => {
    expect(filterApps(APP_REGISTRY, 'zzz-nessuno')).toEqual([])
  })

  it('è robusto a query con spazi al contorno e maiuscole estreme', () => {
    expect(filterApps(APP_REGISTRY, '  LIBRETTO  ').map((a) => a.id)).toEqual(['lavoro'])
    expect(filterApps(APP_REGISTRY, 'PrEzZaRiO').map((a) => a.id)).toEqual(['lavoro'])
  })

  it('un termine condiviso da più tag ritorna tutte le app che lo portano', () => {
    // Costruisce un mini-registry con un tag comune per verificare il ranking/coerenza
    // del match su tag senza dipendere dai dati reali.
    const apps = [
      { ...APP_REGISTRY[0], id: 'a', name: 'Alpha', tagline: '', tags: ['comune'] },
      { ...APP_REGISTRY[0], id: 'b', name: 'Beta', tagline: 'comune nel tagline', tags: [] },
      { ...APP_REGISTRY[0], id: 'c', name: 'Gamma', tagline: '', tags: ['altro'] },
    ]
    expect(filterApps(apps, 'comune').map((a) => a.id)).toEqual(['a', 'b'])
  })

  it('match sul nome dello strumento', () => {
    expect(filterApps(APP_REGISTRY, 'computo').map((a) => a.id)).toEqual(['lavoro'])
    expect(filterApps(APP_REGISTRY, 'lavoro').map((a) => a.id)).toEqual(['lavoro'])
    expect(filterApps(APP_REGISTRY, 'amministrazione').map((a) => a.id)).toEqual(['amministrazione'])
  })
})

describe('invarianti registry', () => {
  it('ogni app ha id univoco', () => {
    const ids = APP_REGISTRY.map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('ogni app ha file univoco', () => {
    const files = APP_REGISTRY.map((a) => a.file)
    expect(new Set(files).size).toBe(files.length)
  })
  it('ogni status è stable o beta', () => {
    for (const a of APP_REGISTRY) expect(['stable', 'beta']).toContain(a.status)
  })
  it('ogni app ha i campi minimi non vuoti (id/name/file/logoType/tags)', () => {
    for (const a of APP_REGISTRY) {
      expect(a.id).toBeTruthy()
      expect(a.name).toBeTruthy()
      expect(a.file).toMatch(/\.html$/i)
      expect(a.logoType).toBeTruthy()
      expect(Array.isArray(a.tags)).toBe(true)
    }
  })
})

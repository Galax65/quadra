import { describe, it, expect } from 'vitest'
import {
  emptyHubProjectState,
  migrateHubState,
  setToolProject,
  projectStateMessages,
  sourceForApp,
  ensureProjectId,
  setProjectIdentity,
} from '../../src/hub/engine/project-state'

/**
 * PROGETTO E.HUB A ISTANZA UNICA: stato per-appId GENERICO (niente più campi
 * hard-coded phiProject/pricelistComputo/tauComputo; inclusi pi/lambda), identità id/name,
 * relay con `source` derivato da mappa di configurazione. Reducer PURO.
 */
describe('hub project-state', () => {
  it('lo stato di progetto non porta più la planimetria condivisa dei tool di disegno', () => {
    expect('sharedPlan' in emptyHubProjectState()).toBe(false)
    expect('sharedPlan' in migrateHubState({ tools: {}, sharedPlan: { dxf: null, cavidotti: [], circuiti: [] } })).toBe(false)
  })
  it('source per appId: storici mappati, nuovi = appId stesso', () => {
    expect(sourceForApp('computo')).toBe('pricelist')
    // tool senza alias storico: l'appId È il source, nessun hard-code
    expect(sourceForApp('contabilita')).toBe('contabilita')
    expect(sourceForApp('delta-pages')).toBe('delta-pages')
  })

  it('migra il VECCHIO shape {pricelistComputo,...} → mappa per appId', () => {
    const st = migrateHubState({ pricelistComputo: { a: 1 }, tauComputo: { b: 2 } })
    expect(st.tools['computo']).toEqual({ a: 1 })
    expect(st.tools['tau-documenti']).toEqual({ b: 2 })
    expect(st.id).toBeNull()
  })

  it('migra il NUOVO shape {id,name,tools} preservandolo', () => {
    const st = migrateHubState({ id: 'p-1', name: 'Casa', tools: { pi: { x: 1 } } })
    expect(st.id).toBe('p-1')
    expect(st.name).toBe('Casa')
    expect(st.tools.pi).toEqual({ x: 1 })
  })

  it('input non valido → stato vuoto', () => {
    expect(migrateHubState(null)).toEqual(emptyHubProjectState())
    expect(migrateHubState('x')).toEqual(emptyHubProjectState())
  })

  it('setToolProject è generico e immutabile (incluso pi/lambda)', () => {
    const a = emptyHubProjectState()
    const b = setToolProject(a, 'pi', { fronte: 1 })
    expect(a.tools.pi).toBeUndefined() // input non mutato
    expect(b.tools.pi).toEqual({ fronte: 1 })
    const c = setToolProject(b, 'lightcalc-road', { lux: 2 })
    expect(c.tools['lightcalc-road']).toEqual({ lux: 2 })
    // project null rimuove la voce
    const d = setToolProject(c, 'pi', null)
    expect(d.tools.pi).toBeUndefined()
    expect(d.tools['lightcalc-road']).toEqual({ lux: 2 })
  })

  it('projectStateMessages: un relay per tool con source corretto, marcato REPLAY', () => {
    const st = setToolProject(setToolProject(emptyHubProjectState(), 'gamma', { d: 1 }), 'pi', { f: 2 })
    const msgs = projectStateMessages(st)
    expect(msgs).toHaveLength(2)
    const gamma = msgs.find(m => m.appId === 'gamma')!
    expect(gamma.type).toBe('hub:project-state')
    expect(gamma.source).toBe('gamma')
    expect(gamma.project).toEqual({ d: 1 })
    const pi = msgs.find(m => m.appId === 'pi')!
    expect(pi.source).toBe('pi')
    // I messaggi di replica sono REPLAY → i consumatori non li applicano in automatico.
    expect(msgs.every(m => m.replay === true)).toBe(true)
  })

  it('ensureProjectId genera un id stabile solo se mancante', () => {
    const a = ensureProjectId(emptyHubProjectState(), () => 'ID1')
    expect(a.id).toBe('ID1')
    const b = ensureProjectId(a, () => 'ID2') // già presente → invariato
    expect(b.id).toBe('ID1')
  })

  it('setProjectIdentity aggiorna id/name senza toccare i tool', () => {
    const st = setToolProject(emptyHubProjectState(), 'pi', { f: 1 })
    const out = setProjectIdentity(st, 'p-9', 'Villa')
    expect(out.id).toBe('p-9')
    expect(out.name).toBe('Villa')
    expect(out.tools.pi).toEqual({ f: 1 })
  })
})

import { describe, it, expect } from 'vitest'
import { PARTI, chiaveDi, parteDi, inventario, esporta, valida, anteprima, importa } from '../../src/shared/memoria-studio'
import type { Store, MemoriaStudio, ParteMemoria } from '../../src/shared/memoria-studio'

function storeFinto(dati: Record<string, string> = {}): Store & { dati: Record<string, string> } {
  return { dati, getItem: k => (k in dati ? dati[k] : null), setItem: (k, v) => { dati[k] = v } }
}
const leggi = (s: { dati: Record<string, string> }, k: string) => JSON.parse(s.dati[k])

describe('memoria dello studio — cosa è conoscenza e cosa no', () => {
  it('le PREFERENZE non sono memoria: non si esportano', () => {
    const chiavi = PARTI.map(p => p.chiave)
    // tema, vista, sidebar: sono abitudini di una persona su una macchina, non sapere dello
    // studio. Portarsele dietro imporrebbe al collega la propria interfaccia col proprio sapere.
    for (const k of ['miu:rail-slim', 'miu:tipopanel-collapsed', 'miu:sidebar-collapsed', 'hub:auth']) {
      expect(chiavi).not.toContain(k)
    }
  })

  it('niente parti di funzioni che Quadra non ha più (blocchi CAD, profili DXF)', () => {
    expect(PARTI.map(p => p.id)).toEqual(['libreria-voci', 'categorie', 'modelli-struttura'])
    expect(PARTI.some(p => /dxf|cad|blocc/i.test(p.cosa))).toBe(false)
  })

  it('i tool si chiamano col loro nome, non con una lettera greca', () => {
    expect(PARTI.map(p => p.tool).sort()).toEqual(['Amministrazione', 'Computo', 'Computo'])
  })

  it('una parte compartimentata per studio usa la chiave del SUO studio', () => {
    const p: ParteMemoria = { id: 'x', nome: 'X', cosa: '', chiave: 'hub:x:{company}', fusione: 'oggetto', tool: 'Amministrazione' }
    expect(chiaveDi(p, 'studio-a')).toBe('hub:x:studio-a')
    expect(chiaveDi(p, null)).toBe('hub:x:anon')
    // le parti non compartimentate restano com'erano
    expect(chiaveDi(parteDi('libreria-voci')!, 'studio-a')).toBe('miu:libreria')
  })
})

describe('memoria — esporta ciò che c\'è, non ciò che potrebbe esserci', () => {
  const store = storeFinto({
    'miu:libreria': JSON.stringify([{ id: 'v1', nome: 'Plafoniera speciale', analisiPrezzi: { totale: 42 } }]),
    'miu:catdb': JSON.stringify({ sp: ['Edificio A'], cat: ['Impianti elettrici'], sb: [] }),
    'hub:modelli-struttura': JSON.stringify([{ id: 'm1', nome: 'Strade', categorie: [], wbs: {} }]),
  })

  it('l\'inventario dice quanto sa questa macchina', () => {
    const m = Object.fromEntries(inventario(store, 'studio-a').map(x => [x.parte.id, x.n]))
    expect(m['libreria-voci']).toBe(1)
    expect(m['categorie']).toBe(2)      // gli elementi dei rami, non i rami
    expect(m['modelli-struttura']).toBe(1)
  })

  it('una parte mai usata su questa macchina conta zero, e si vede', () => {
    const m = Object.fromEntries(inventario(storeFinto({}), 'studio-a').map(x => [x.parte.id, x.n]))
    expect(m['libreria-voci']).toBe(0)
  })

  it('le parti VUOTE non finiscono nel file (sarebbero rumore)', () => {
    const store2 = storeFinto({ 'miu:catdb': JSON.stringify({ sp: ['A'], cat: [], sb: [] }) })
    const dump = esporta(store2, { companyId: 'studio-a', studio: 'Studio Demo' })
    expect(Object.keys(dump.parti)).toEqual(['categorie'])
    expect(dump.schema).toBe('ehub/memoria-studio@1')
    expect(dump.studio).toBe('Studio Demo')
  })

  it('si può esportare una parte sola (le Analisi Prezzi…)', () => {
    const dump = esporta(store, { companyId: 'studio-a', parti: ['libreria-voci'] })
    expect(Object.keys(dump.parti)).toEqual(['libreria-voci'])
    // e l'Analisi Prezzi ci viaggia dentro, che è il punto
    expect((dump.parti['libreria-voci'] as any[])[0].analisiPrezzi.totale).toBe(42)
  })
})

describe('memoria — importare UNISCE, non cancella', () => {
  const file: MemoriaStudio = {
    schema: 'ehub/memoria-studio@1',
    studio: 'Studio Demo',
    esportata: '2026-07-11T00:00:00.000Z',
    parti: {
      'categorie': { sp: ['Edificio A', 'Esterni'], cat: ['Strutture'] },
      'libreria-voci': [{ id: 'v1', nome: 'dal collega' }],
    },
  }

  it('il collega AGGIUNGE, non sovrascrive: il mio lavoro resta', () => {
    const store = storeFinto({
      'miu:catdb': JSON.stringify({ sp: ['Mio'], cat: [], sb: ['Mia sub'] }),
      'miu:libreria': JSON.stringify([{ id: 'v0', nome: 'mia' }]),
    })
    importa(store, file, { companyId: 'studio-a' })
    // il vocabolario si fonde ramo per ramo: i miei nomi restano (e prima), i suoi si aggiungono
    expect(leggi(store, 'miu:catdb').sb).toEqual(['Mia sub'])
    expect(leggi(store, 'miu:catdb').sp).toEqual(['Mio', 'Edificio A', 'Esterni'])
    expect(leggi(store, 'miu:catdb').cat).toEqual(['Strutture'])
    // la libreria tiene entrambe le voci
    expect(leggi(store, 'miu:libreria').map((v: any) => v.id).sort()).toEqual(['v0', 'v1'])
  })

  it('«sostituisci» esiste, ma va chiesto: è l\'eccezione', () => {
    const store = storeFinto({ 'miu:catdb': JSON.stringify({ sp: ['Mio'] }) })
    importa(store, file, { companyId: 'studio-a', modo: 'sostituisci' })
    expect(leggi(store, 'miu:catdb').sp).toEqual(['Edificio A', 'Esterni'])
  })

  it('si guarda PRIMA di importare: quante voci, e di che tipo', () => {
    const m = Object.fromEntries(anteprima(file).map(x => [x.parte.id, x.n]))
    expect(m['categorie']).toBe(3)
    expect(m['libreria-voci']).toBe(1)
  })

  it('un file che non è una memoria non può toccare nulla', () => {
    expect(valida({ pippo: 1 })).toBe(false)
    expect(valida(null)).toBe(false)
    expect(valida(file)).toBe(true)
  })

  it('una parte SCONOSCIUTA (file vecchio o di una versione futura) si salta, non rompe', () => {
    const store = storeFinto()
    const altro = { ...file, parti: { ...file.parti, 'profili-collaboratori': { x: 1 }, 'roba-del-2030': { x: 1 } } } as MemoriaStudio
    const esiti = importa(store, altro, { companyId: 'studio-a' })
    expect(esiti.map(e => e.parte.id)).not.toContain('roba-del-2030')
    expect(esiti.map(e => e.parte.id)).not.toContain('profili-collaboratori')
    expect(esiti.length).toBe(2) // le due parti note sono entrate lo stesso
  })
})

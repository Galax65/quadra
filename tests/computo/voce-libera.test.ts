// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { sommaMisurazioni } from '../../src/shared/compositore/misurazioni'
import { impostaCampo } from '../../src/shared/compositore/misure-edit'
import { resolve } from 'node:path'

/**
 * VOCE LIBERA nel computo: capita di avere la misura prima della voce (un vano
 * rilevato in cantiere). Si apre una riga vuota, ci si fissa la misura, e
 * l'articolo di prezzario si assegna dopo — senza perdere nulla.
 */
if (typeof localStorage === 'undefined') {
  const store = new Map<string, string>()
  ;(globalThis as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() { return store.size },
  }
}
const ROOT = resolve(__dirname, '../..')
let S: { custom: Map<string, Record<string, unknown>>; qty: Record<string, { misurazioni?: unknown[]; qty: number }> }
let ov: { addVoceLibera: () => string; assegnaCodiciNP: () => void }

beforeEach(async () => {
  document.body.innerHTML = readFileSync(resolve(ROOT, 'src/tools/computo/index.html'), 'utf8').replace(/[\s\S]*<body>/, '').replace(/<\/body>[\s\S]*/, '')
  localStorage.clear()
  // @ts-expect-error — moduli JS legacy senza dichiarazioni
  const stato = await import('../../src/tools/computo/legacy/stato.js')
  // @ts-expect-error — modulo JS legacy senza dichiarazioni
  await import('../../src/tools/computo/legacy/index.js')
  S = stato.S as never
  // @ts-expect-error — modulo JS legacy senza dichiarazioni
  ov = await import('../../src/tools/computo/legacy/computo-overlay.js')
  S.custom.clear()
})

describe('voce libera', () => {
  it('nasce vuota, misurabile, e non è un nuovo prezzo finché resta vuota', () => {
    const key = ov.addVoceLibera()
    const it = S.custom.get(key)!
    expect(it.libera).toBe(true)
    expect(it.codice).toBeUndefined()
    expect(S.qty[key].misurazioni).toHaveLength(1)
    // la numerazione dei nuovi prezzi la salta: non è un NP, è un posto per la misura
    ov.assegnaCodiciNP()
    expect(S.custom.get(key)!.codice).toBeUndefined()
  })

  it('una volta descritta diventa un nuovo prezzo con il suo codice', () => {
    const key = ov.addVoceLibera()
    S.custom.get(key)!.desc_short = 'Vano scala, rilievo in cantiere'
    ov.assegnaCodiciNP()
    expect(S.custom.get(key)!.codice).toMatch(/^NP\.\d{3}$/)
    expect(S.custom.get(key)!.np).toBe(true)
  })

  it('le misure scritte sulla voce libera restano quando le si assegna un articolo', () => {
    const key = ov.addVoceLibera()
    const righe = (S.qty[key].misurazioni ?? []) as NonNullable<Parameters<typeof sommaMisurazioni>[0]>
    const riga = righe[0]!
    impostaCampo(riga, 'l1', '3,2')
    impostaCampo(riga, 'l2', '2,5')
    expect(sommaMisurazioni(righe)).toBeCloseTo(8, 3)
    // assegnazione dall'esterno (come fa la modifica rapida dopo la ricerca nel prezzario)
    const it = S.custom.get(key)!
    S.custom.set(key, { ...it, codice: '25.5.PQ3.03', desc_short: 'INTONACO CIVILE', um: 'm²', prezzo: 166.71, libera: undefined })
    expect(sommaMisurazioni((S.qty[key].misurazioni ?? []) as NonNullable<Parameters<typeof sommaMisurazioni>[0]>)).toBeCloseTo(8, 3)
    expect(S.qty[key].misurazioni).toHaveLength(1)
  })
})

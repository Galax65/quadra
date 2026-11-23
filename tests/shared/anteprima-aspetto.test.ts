// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { anteprimaPdf, anteprimaHTML, chiudiAnteprimaPdf, ePdfA, pannelloAspettoHTML } from '../../src/shared/ui/anteprima-pdf'
import { leggiPreferenzeStampa, salvaPreferenzeStampa, PREFERENZE_STAMPA_DEFAULT } from '../../src/shared/stampe/preferenze'
import { IMPIANTO_STANDARD, eImpiantoStandard } from '../../src/shared/doc/stile-stampa'

/**
 * L'ANTEPRIMA PERSONALIZZABILE (tappa 9 di Docs/06-Interfaccia-unica.md):
 * foglio, margini, carattere e corpo si cambiano guardando il documento, e il
 * documento si rifà. Le scelte sono le preferenze di stampa di tutto il programma.
 */
if (typeof localStorage === 'undefined' || !localStorage.setItem) {
  const store = new Map<string, string>()
  ;(globalThis as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k), clear: () => store.clear(), key: () => null, get length() { return store.size },
  }
}
let n = 0
URL.createObjectURL = vi.fn(() => `blob:prova-${++n}`)
URL.revokeObjectURL = vi.fn()

const PDF_A = new TextEncoder().encode('%PDF-1.7 ... <pdfaid:part>2</pdfaid:part><pdfaid:conformance>B</pdfaid:conformance> ...')
const PDF = new TextEncoder().encode('%PDF-1.7 nient\'altro')
const attesa = () => new Promise((r) => setTimeout(r, 0))

beforeEach(() => {
  chiudiAnteprimaPdf()
  salvaPreferenzeStampa({ ...PREFERENZE_STAMPA_DEFAULT, stile: { ...IMPIANTO_STANDARD } })
})

describe("il pannello «Aspetto»", () => {
  it('c\'è solo se chi apre l\'anteprima sa rifare il documento', () => {
    anteprimaPdf(PDF, { titolo: 'Atto', nomeFile: 'atto' })
    expect(document.querySelector('[data-az="aspetto"]')).toBeNull()
    anteprimaPdf(PDF, { titolo: 'Atto', nomeFile: 'atto', rifai: async () => PDF })
    expect(document.querySelector('[data-az="aspetto"]')).not.toBeNull()
  })

  it('si apre e si chiude, e resta aperto da un documento all\'altro', () => {
    anteprimaPdf(PDF, { titolo: 'A', nomeFile: 'a', rifai: async () => PDF })
    const pan = () => document.querySelector('.ehb-anteprima__aspetto') as HTMLElement
    expect(pan().hidden).toBe(true)
    ;(document.querySelector('[data-az="aspetto"]') as HTMLElement).click()
    expect(pan().hidden).toBe(false)
    anteprimaPdf(PDF, { titolo: 'B', nomeFile: 'b', rifai: async () => PDF })
    expect(pan().hidden).toBe(false)
    ;(document.querySelector('[data-az="aspetto"]') as HTMLElement).click()
  })

  it('una modifica si salva nelle preferenze di stampa e il documento si rifà', async () => {
    const rifai = vi.fn(async () => '<html>nuovo</html>')
    anteprimaHTML('<html>vecchio</html>', { titolo: 'Atto', nomeFile: 'atto', estensione: 'html', rifai })
    const frame = document.querySelector('iframe') as HTMLIFrameElement
    const prima = frame.src
    const sel = document.querySelector('[data-stile="orientamento"]') as HTMLSelectElement
    sel.value = 'orizzontale'
    sel.dispatchEvent(new Event('change', { bubbles: true }))
    await attesa(); await attesa()
    expect(leggiPreferenzeStampa().stile.orientamento).toBe('orizzontale')
    expect(rifai).toHaveBeenCalledTimes(1)
    expect(frame.src).not.toBe(prima)
    const m = document.querySelector('[data-stile="margine.sinistra"]') as HTMLInputElement
    m.value = '30'
    m.dispatchEvent(new Event('change', { bubbles: true }))
    await attesa(); await attesa()
    expect(leggiPreferenzeStampa().stile.margini?.sinistra).toBe(30)
  })

  it('«↺ Impianto standard» riporta al foglio standard, e da standard è spento', async () => {
    salvaPreferenzeStampa({ ...PREFERENZE_STAMPA_DEFAULT, stile: { ...IMPIANTO_STANDARD, corpo: 13, formato: 'A3' } })
    anteprimaPdf(PDF, { titolo: 'Atto', nomeFile: 'atto', rifai: async () => PDF })
    const std = document.querySelector('[data-az="standard"]') as HTMLButtonElement
    expect(std.disabled).toBe(false)
    std.click()
    await attesa(); await attesa()
    expect(eImpiantoStandard(leggiPreferenzeStampa().stile)).toBe(true)
    expect((document.querySelector('[data-az="standard"]') as HTMLButtonElement).disabled).toBe(true)
  })

  it('i margini non escono da 5–60 mm e il corpo da 6–16 pt', async () => {
    anteprimaPdf(PDF, { titolo: 'A', nomeFile: 'a', rifai: async () => PDF })
    const m = document.querySelector('[data-stile="margine.sopra"]') as HTMLInputElement
    m.value = '500'; m.dispatchEvent(new Event('change', { bubbles: true }))
    const c = document.querySelector('[data-stile="corpo"]') as HTMLInputElement
    c.value = '2'; c.dispatchEvent(new Event('change', { bubbles: true }))
    await attesa()
    expect(leggiPreferenzeStampa().stile.margini?.sopra).toBe(60)
    expect(leggiPreferenzeStampa().stile.corpo).toBe(6)
  })

  it('dice che nei PDF il carattere è il lineare incorporato', () => {
    expect(pannelloAspettoHTML(IMPIANTO_STANDARD)).toContain('lineare incorporato')
  })
})

describe('il marchio PDF/A', () => {
  it('si legge dai metadati del file', () => {
    expect(ePdfA(PDF_A)).toBe(true)
    expect(ePdfA(PDF)).toBe(false)
  })
  it('l\'anteprima lo mostra solo quando il PDF lo è davvero', () => {
    anteprimaPdf(PDF_A, { titolo: 'A', nomeFile: 'a' })
    expect(document.querySelector('.ehb-anteprima__pdfa')?.textContent).toBe('PDF/A-2b')
    anteprimaPdf(PDF, { titolo: 'A', nomeFile: 'a' })
    expect(document.querySelector('.ehb-anteprima__pdfa')).toBeNull()
  })
})

describe("l'impianto standard", () => {
  it('A4 verticale, 15 mm e 20 a sinistra, lineare 10 pt, testata e piè', () => {
    expect(IMPIANTO_STANDARD).toEqual({ formato: 'A4', orientamento: 'verticale', margini: { sopra: 15, sotto: 15, sinistra: 20, destra: 15 }, corpo: 10, carattere: 'sans', intestazione: true, piede: true })
    expect(eImpiantoStandard(undefined)).toBe(true)
    expect(eImpiantoStandard({ margini: { sinistra: 15 } })).toBe(false)
  })
})

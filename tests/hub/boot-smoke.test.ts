// @vitest-environment jsdom
/**
 * L'HUB SI AVVIA DAVVERO — gemello di tests/gamma/boot-smoke.test.ts e
 * tests/pi/boot-smoke.test.ts.
 *
 * Tutti gli altri test di `tests/hub/` leggono `main.js` come TESTO: asseriscono
 * su pattern del sorgente senza mai eseguirlo. Su un tool questo lasciò passare un
 * ReferenceError a inizio file che teneva il tool completamente morto, con ~40
 * test verdi. Prima di spezzare `main.js` in moduli serve quindi qualcosa che lo
 * ESEGUA: un import mancante o una riga di boot finita nel modulo sbagliato deve
 * far fallire qualcosa.
 *
 * Il test è scritto e verde SUL MONOLITE, così è una rete indipendente dal
 * refactor che verrà dopo.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../..')
const errors: unknown[] = []

beforeAll(async () => {
  const html = readFileSync(resolve(ROOT, 'src/hub/index.html'), 'utf8')
  document.body.innerHTML = html.replace(/[\s\S]*<body[^>]*>/, '').replace(/<\/body>[\s\S]*/, '')
  if (typeof localStorage === 'undefined') {
    const store = new Map<string, string>()
    ;(globalThis as { localStorage: Storage }).localStorage = {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(), key: () => null, get length() { return store.size },
    }
  }
  // La risoluzione dei file dei tool passa da fetch (edizione web): in jsdom non
  // esiste, e senza stub `initFolder` fallirebbe per un motivo estraneo all'hub.
  ;(globalThis as { fetch?: unknown }).fetch = async () => ({ ok: true, text: async () => '' })
  window.addEventListener('error', (e) => errors.push(e))
  window.addEventListener('unhandledrejection', (e) => errors.push(e))
  try {
    // @ts-expect-error — modulo JS senza dichiarazioni di tipo
    await import('../../src/hub/main.js')
  } catch (e) {
    errors.push(e)
  }
  document.dispatchEvent(new Event('DOMContentLoaded'))
  await new Promise((r) => setTimeout(r, 0)) // initFolder è async
})

describe('hub — avvio reale in jsdom', () => {
  it('i moduli valutano e la coda di boot gira senza errori', () => {
    expect(errors, errors.map(String).join('\n')).toEqual([])
  })

  it('gli handler degli attributi inline sono su window', () => {
    const w = window as unknown as Record<string, unknown>
    // Un campione per ogni famiglia dell'Object.assign finale: se un modulo non
    // rientra nel barrel, almeno una di queste sparisce.
    for (const fn of [
      'launchApp', 'goHome', 'filterList', 'reloadApp', 'closeSession',
      'setTheme', 'setPalette', 'toggleTheme', 'toggleSidebar',
      'toggleSettings', 'setDensity', 'setFont', 'setTextSize', 'setUiScale', 'setMotion', 'setShadow',
      'openGuide', 'startHubTour', 'openLegal', 'openCredits',
      'openAppearance',
      'openBackup', 'backupEsporta', 'backupImporta',
      'saveProgettoQuadra', 'saveProgettoQuadraAs', 'openProgettoQuadra', 'newProgettoQuadra',
    ]) {
      expect(typeof w[fn], `window.${fn}`).toBe('function')
    }
  })

  it('il boot ha renderizzato la lista dei tool e le card di benvenuto', () => {
    expect(document.querySelectorAll('.nav-item').length, 'voci di navigazione').toBeGreaterThan(0)
    expect(document.getElementById('stat-n')?.textContent, 'contatore tool').not.toBe('')
    expect(document.querySelector('#welcome-cards')?.children.length, 'card di benvenuto').toBeGreaterThan(0)
  })

  it('all\'avvio si apre subito Lavoro, con l\'albero: niente schermata di scelta', async () => {
    await new Promise((r) => setTimeout(r, 50))
    expect(document.getElementById('welcome')?.classList.contains('hidden'), 'benvenuto nascosto').toBe(true)
    expect(document.getElementById('nav-lavoro')?.classList.contains('active') || !!document.querySelector('#frames iframe'), 'Lavoro aperto').toBe(true)
    expect(document.getElementById('sidebar')?.classList.contains('collapsed'), 'sidebar aperta').toBe(false)
  })

  it('il toggle chiude e riapre la sidebar', () => {
    const w = window as unknown as { toggleSidebar: () => void }
    const sidebar = document.getElementById('sidebar')!
    const prima = sidebar.classList.contains('collapsed')
    w.toggleSidebar()
    expect(sidebar.classList.contains('collapsed')).toBe(!prima)
    w.toggleSidebar()
    expect(sidebar.classList.contains('collapsed')).toBe(prima)
  })

  it('«home» torna a Lavoro, non a una schermata di benvenuto', async () => {
    const w = window as unknown as { launchApp: (id: string) => Promise<void>, goHome: () => void }
    await w.launchApp('lavoro')
    expect(document.getElementById('welcome')?.classList.contains('hidden'), 'benvenuto nascosto').toBe(true)
    expect(document.getElementById('app-bar')?.classList.contains('visible'), 'barra app visibile').toBe(true)
    expect(document.querySelectorAll('#frames iframe').length, 'iframe del tool creato').toBeGreaterThan(0)
    // «Lavoro» porta l'identità visiva del computo (segno e colore): è da lì che un lavoro comincia
    expect(document.getElementById('app-bar')?.dataset.tool).toBe('computo')
    await w.launchApp('amministrazione')
    w.goHome()
    await new Promise((r) => setTimeout(r, 0))
    expect(document.getElementById('welcome')?.classList.contains('hidden'), 'benvenuto ancora nascosto').toBe(true)
    expect(document.getElementById('nav-lavoro')?.classList.contains('active'), 'di nuovo in Lavoro').toBe(true)
  })

  it('il tema di suite si applica e il toggle lo commuta', () => {
    const w = window as unknown as { setTheme: (m: string) => void, toggleTheme: () => void }
    w.setTheme('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    w.toggleTheme()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })
})

// @vitest-environment jsdom
import { describe, it, expect, beforeAll, vi } from 'vitest'

/**
 * I DATI DEL LAVORO STANNO IN UN POSTO SOLO.
 * Oggetto, luogo, CUP/CIG, committente, RUP, progettista, DL, impresa e il
 * contratto sono gli stessi per il Computo e per la Contabilità: si scrivono
 * una volta, da qualunque strumento, e viaggiano. Questo test guarda la
 * direzione che mancava — dalla Contabilità verso gli altri.
 */
type Win = typeof globalThis & Record<string, (...a: unknown[]) => unknown>
const w = (): Win => window as unknown as Win
const IDS = ['btnTheme', 'btnGuide', 'bAppSummary', 'bComputoSummary', 'bFasiList', 'bTimeline', 'bConsegne', 'bModalHost', 'toast', 'bPaginaT', 'bPaginaAct', 'bPaginaBody']
const inviati: Record<string, unknown>[] = []

beforeAll(async () => {
  document.documentElement.setAttribute('data-tool', 'contabilita')
  document.body.innerHTML = `${IDS.map((id) => `<div id="${id}"></div>`).join('')}
    <input id="bDataCorrente" type="text"><input id="bDataCorrenteCal" type="date">
    <input id="bXlsFile" type="file"><input id="bLogoFile" type="file"><section id="bPagina" hidden></section>`
  document.getElementById('bPagina')!.append(document.getElementById('bPaginaT')!, document.getElementById('bPaginaAct')!, document.getElementById('bPaginaBody')!)
  Object.defineProperty(navigator, 'clipboard', { value: { readText: vi.fn().mockResolvedValue('') }, configurable: true })
  // l'hub è il padre: qui lo ascoltiamo
  vi.spyOn(window.parent, 'postMessage').mockImplementation((m: unknown) => { inviati.push(m as Record<string, unknown>) })
  await import('../../src/tools/contabilita/main')
})

const ultimoProgetto = (): Record<string, unknown> | undefined => {
  const m = [...inviati].reverse().find((x) => x.type === 'app:project-update')
  return m?.project as Record<string, unknown> | undefined
}

describe('i dati scritti in contabilità', () => {
  it('viaggiano verso gli altri strumenti con le stesse chiavi dei dati generali', () => {
    w().setApp('oggetto', 'Lavori di prova')
    w().setApp('cig', 'Z1234ABCD')
    w().setApp('comune', 'Comune di Prova')
    w().setApp('progettista', 'arch. Tizio')
    w().setEnte('denominazione', 'Comune di Prova')
    const dg = ultimoProgetto()?.datiGenerali as Record<string, unknown>
    expect(dg).toBeTruthy()
    expect(dg.oggetto).toBe('Lavori di prova')
    expect(dg.cig).toBe('Z1234ABCD')
    expect(dg.comune).toBe('Comune di Prova')
    expect(dg.progettista).toBe('arch. Tizio')
    expect(dg.committente).toBe('Comune di Prova')
  })

  it('portano anche il contratto: il ribasso non si ridigita di là', () => {
    w().setAppNum('ribassoPct', '5,086')
    const dg = ultimoProgetto()?.datiGenerali as { contratto?: { ribassoPct?: number } }
    expect(dg.contratto?.ribassoPct).toBeCloseTo(5.086, 3)
  })
})

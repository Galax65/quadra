// @vitest-environment jsdom
import { describe, it, expect, beforeAll, vi } from 'vitest'

/**
 * UNA SOLA INTERFACCIA DI STAMPA.
 * Non un pulsante per ogni combinazione — di lavoro, PDF, Word, ODT, solo
 * questo atto, tutti gli atti — ma una domanda sola, sempre la stessa: che
 * cosa, come, in che formato. Questo test è lì perché la barra dell'atto era
 * arrivata a sei pulsanti di stampa diversi.
 */
type Win = typeof globalThis & Record<string, (...a: unknown[]) => unknown>
const w = (): Win => window as unknown as Win
const IDS = ['btnTheme', 'btnGuide', 'bAppSummary', 'bComputoSummary', 'bFasiList', 'bTimeline', 'bConsegne', 'bModalHost', 'toast', 'bPaginaT', 'bPaginaAct', 'bPaginaBody']

beforeAll(async () => {
  document.documentElement.setAttribute('data-tool', 'contabilita')
  document.body.innerHTML = `${IDS.map((id) => `<div id="${id}"></div>`).join('')}
    <input id="bDataCorrente" type="text"><input id="bDataCorrenteCal" type="date">
    <input id="bXlsFile" type="file"><input id="bLogoFile" type="file"><section id="bPagina" hidden></section>`
  document.getElementById('bPagina')!.append(document.getElementById('bPaginaT')!, document.getElementById('bPaginaAct')!, document.getElementById('bPaginaBody')!)
  Object.defineProperty(navigator, 'clipboard', { value: { readText: vi.fn().mockResolvedValue('') }, configurable: true })
  await import('../../src/tools/contabilita/main')
  window.dispatchEvent(new MessageEvent('message', { data: { type: 'hub:restore-state', state: {
    v: 1,
    appalto: { oggetto: 'Lavori di prova', ente: { denominazione: 'Comune X' }, impresa: { denominazione: 'Impresa Y' }, modalita: 'misura', dataInizio: '01/06/2026' },
    partite: [{ id: 'p1', modalita: 'misura', codice: 'M1', descrizione: 'Scavo', um: 'mc', prezzoUnitario: 10, qtyProgetto: 100, introdottaSal: 1 }],
    sals: [{ numero: 1, data: '01/06/2026', righe: [{ partitaId: 'p1', quantitaProgressiva: 40 }] }],
  } } }))
})

describe('la barra di un atto', () => {
  it('ha UN solo comando di stampa, non uno per formato', () => {
    w().openEditor('sal-1', 'registro')
    const act = document.getElementById('bPaginaAct')!
    const stampe = [...act.querySelectorAll('button')].filter((b) => /stampa|pdf|word|odt|emetti/i.test(b.textContent || ''))
    expect(stampe).toHaveLength(1)
    expect(stampe[0].textContent).toContain('Stampa')
  })
})

describe('la finestra di stampa', () => {
  it('chiede le tre cose sempre nello stesso ordine: che cosa, come, formato', () => {
    w().openEditor('sal-1', 'registro')
    w().apriStampaAtto()
    const host = document.getElementById('bModalHost')!
    const legend = [...host.querySelectorAll('legend')].map((l) => l.textContent)
    expect(legend).toEqual(['Che cosa', 'Come', 'Formato'])
    const fmt = [...host.querySelectorAll('input[name="st-fmt"]')].map((i) => (i as HTMLInputElement).value)
    expect(fmt).toEqual(['pagina', 'pdf', 'docx', 'odt'])
  })

  it('è la stessa finestra anche per il fascicolo di una tappa', () => {
    w().stampaAttiSal(1)
    const host = document.getElementById('bModalHost')!
    expect([...host.querySelectorAll('legend')].map((l) => l.textContent)).toEqual(['Che cosa', 'Come', 'Formato'])
    // partendo dalla tappa la scelta è già «tutti gli atti», e si può chiedere lo zip
    const cosa = host.querySelector('input[name="st-cosa"]:checked') as HTMLInputElement
    expect(cosa.value).toBe('tappa')
    expect((document.getElementById('stUnico') as HTMLElement).hidden).toBe(false)
  })
})

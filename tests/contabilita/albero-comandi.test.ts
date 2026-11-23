// @vitest-environment jsdom
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { albero } from './_albero'

/**
 * IL LAVORO CRESCE DALL'ALBERO, e si corregge da lì.
 *
 * Una tappa aperta per sbaglio — tre perizie di variante create con tre clic —
 * si cancella da dov'è. E un SAL appena aperto si apre DOVE SI MISURA, non
 * sull'anteprima di un atto che non ha ancora niente da dire.
 */
type Win = typeof globalThis & Record<string, (...a: unknown[]) => unknown>
const w = (): Win => window as unknown as Win
const IDS = ['btnTheme', 'btnGuide', 'bAppSummary', 'bComputoSummary', 'bFasiList', 'bTimeline', 'bConsegne', 'bModalHost', 'toast', 'bPaginaT', 'bPaginaAct', 'bPaginaBody', 'bDrawer']
const titolo = (): string => document.getElementById('bPaginaT')!.textContent || ''

beforeAll(async () => {
  document.documentElement.setAttribute('data-tool', 'contabilita')
  document.body.innerHTML = `${IDS.map((id) => `<div id="${id}"></div>`).join('')}
    <input id="bDataCorrente" type="text"><input id="bDataCorrenteCal" type="date">
    <input id="bXlsFile" type="file"><input id="bLogoFile" type="file"><section id="bPagina" hidden></section>`
  document.getElementById('bPagina')!.append(document.getElementById('bPaginaT')!, document.getElementById('bPaginaAct')!, document.getElementById('bPaginaBody')!)
  await import('../../src/tools/contabilita/main')
})

function contratto(): void {
  w().chiudiPagina()
  window.dispatchEvent(new MessageEvent('message', { data: { type: 'hub:restore-state', state: {
    v: 1,
    appalto: { oggetto: 'Prova', ente: {}, impresa: {}, modalita: 'misura' },
    partite: [{ id: 'c1', codice: 'A.01', descrizione: 'Scavo', um: 'm³', prezzo: 10, qtyProgetto: 100, modalita: 'misura' }],
    sals: [],
  } } }))
}

describe('creare e disfare dall\'albero', () => {
  it('un SAL nuovo si apre sulle Misurazioni', () => {
    contratto()
    w().nuovoSalOggi()
    expect(titolo()).toContain('Misurazioni')
  })

  it("una perizia si può aprire anche prima del primo SAL, e vale dal SAL n. 1", async () => {
    contratto()
    w().nuovaPerizia()
    const pz = (await albero()).find((r) => r.fase === 'perizia-1')
    expect(pz).toBeTruthy()
    expect(pz!.stato).toBe('bozza')
  })

  it('le perizie in bozza si eliminano dall\'albero; quelle approvate no', async () => {
    contratto()
    w().nuovaPerizia()
    w().nuovaPerizia()
    expect((await albero()).filter((r) => r.fase.startsWith('perizia-')).length).toBe(2)
    const pz2 = (await albero()).find((r) => r.fase === 'perizia-2')!
    expect(pz2.elimina).toBe('elimina-perizia-2')
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    w().delPerizia(2)
    expect((await albero()).filter((r) => r.fase.startsWith('perizia-')).length).toBe(1)
  })

  it('si elimina solo l\'ULTIMO SAL, e solo se non è firmato', async () => {
    contratto()
    w().nuovoSalOggi()
    w().nuovoSalOggi()
    const rami = await albero()
    expect(rami.find((r) => r.fase === 'sal-2')!.elimina).toBe('elimina-sal-2')
    // il primo regge il secondo: non si tocca
    expect(rami.find((r) => r.fase === 'sal-1')!.elimina).toBeUndefined()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    w().firmaSal(1)
    w().delSal(2)
    expect((await albero()).some((r) => r.fase === 'sal-2')).toBe(false)
    expect((await albero()).find((r) => r.fase === 'sal-1')!.elimina).toBeUndefined()
  })

  it('senza contratto l\'albero offre due strade distinte, non «importa» per partire da zero', async () => {
    w().chiudiPagina()
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'hub:restore-state', state: {
      v: 1, appalto: { oggetto: '', ente: {}, impresa: {}, modalita: 'misura' }, partite: [], sals: [],
    } } }))
    await new Promise((r) => setTimeout(r, 0))
  })
})

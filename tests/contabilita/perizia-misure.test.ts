// @vitest-environment jsdom
import { describe, it, expect, beforeAll, vi } from 'vitest'

/**
 * UNA SOLA INTERFACCIA PER MISURARE, IN OGNI FASE: computo di progetto, libretto
 * del SAL e perizia di variante usano la stessa tabella (par.ug. × L1 × L2 × H),
 * le stesse formule e gli stessi tasti. Cambia solo il «contesto» in cui le misure
 * finiscono: un numero = il SAL n, 'pz<n>' = la perizia n.
 */
type Win = typeof globalThis & Record<string, (...a: unknown[]) => unknown>
const w = (): Win => window as unknown as Win
const IDS = ['btnTheme', 'btnGuide', 'bAppSummary', 'bComputoSummary', 'bFasiList', 'bTimeline', 'bConsegne', 'bModalHost', 'toast', 'bPaginaT', 'bPaginaAct', 'bPaginaBody', 'bDrawer']
const pagina = (): string => document.getElementById('bPaginaBody')!.innerHTML
const qta = (pid: string): string => document.getElementById(`bpzq-${pid}`)?.textContent || ''
const diff = (pid: string): string => document.getElementById(`bpz-d-${pid}`)?.textContent || ''
const totali = (): string => (document.getElementById('bPzTot')?.textContent || '').replace(/\s+/g, ' ')
const righeMisura = (): number => document.querySelectorAll('#bPaginaBody .b-misure-row [data-mis-qt]').length

beforeAll(async () => {
  document.documentElement.setAttribute('data-tool', 'contabilita')
  document.body.innerHTML = `${IDS.map((id) => `<div id="${id}"></div>`).join('')}
    <input id="bDataCorrente" type="text"><input id="bDataCorrenteCal" type="date">
    <input id="bXlsFile" type="file"><input id="bLogoFile" type="file"><section id="bPagina" hidden></section>`
  document.getElementById('bPagina')!.append(document.getElementById('bPaginaT')!, document.getElementById('bPaginaAct')!, document.getElementById('bPaginaBody')!)
  Object.defineProperty(navigator, 'clipboard', { value: { readText: vi.fn().mockResolvedValue('') }, configurable: true })
  await import('../../src/tools/contabilita/main')
})

function lavoro(opts: { approvata?: boolean } = {}): void {
  w().chiudiPagina()
  window.dispatchEvent(new MessageEvent('message', { data: { type: 'hub:restore-state', state: {
    v: 1,
    appalto: {
      oggetto: 'Lavori', ente: { denominazione: 'Comune X' }, impresa: { denominazione: 'Impresa Y' }, modalita: 'misto', dataInizio: '01/06/2026',
      perizie: [{ numero: 1, data: '01/09/2026', dalSal: 2, voci: [], approvata: !!opts.approvata }],
    },
    partite: [
      { id: 'c1', modalita: 'misura', codice: 'A.01', descrizione: 'Scavo', um: 'mc', prezzoUnitario: 10, prezzoContratto: 10, qtyProgetto: 100, introdottaSal: 1,
        misurazioniProgetto: [{ descrizione: 'edificio', n: 2, l1: 5, l2: 5, h: 2, quantita: 100 }] },
      { id: 'k1', modalita: 'corpo', codice: 'C.01', descrizione: 'Impianto', importoContrattuale: 1000, introdottaSal: 1 },
    ],
    sals: [{ numero: 1, data: '01/06/2026', righe: [] }, { numero: 2, data: '01/10/2026', righe: [] }],
  } } }))
  w().vaiA('perizia-1')
}

describe('la perizia si misura come il libretto', () => {
  it('la voce a misura offre «▸ dettaglia», quella a corpo solo l\'importo', () => {
    lavoro()
    expect(pagina()).toContain("dettagliaMisure('pz1','c1')")
    expect(pagina()).toContain("setVocePerizia(1,'k1'")
    expect(pagina()).not.toContain("dettagliaMisure('pz1','k1')")
  })

  it('«dettaglia» apre la stessa tabella e parte dalle misure di progetto', () => {
    lavoro()
    w().dettagliaMisure('pz1', 'c1')
    expect(pagina()).toContain('Misure di perizia (par.ug. × L1 × L2 × H)')
    expect(pagina()).toContain('Nuova quantità di contratto')
    expect(righeMisura()).toBe(1)          // la riga del computo di progetto
    expect(qta('c1')).toBe('100')
    expect(pagina()).toContain("apriMisureProgetto('pz1','c1')")
  })

  it('le misure fanno la nuova quantità di contratto, con le formule del computo', () => {
    lavoro()
    w().dettagliaMisure('pz1', 'c1')
    w().addMisura('pz1', 'c1', false)
    w().setMisura('pz1', 'c1', 1, 'n', '2')
    w().setMisura('pz1', 'c1', 1, 'l1', '3,5')
    w().setMisura('pz1', 'c1', 1, 'h', '1,5')
    expect(qta('c1')).toBe('110,5')        // 100 + 2 × 3,5 × 1,5
    expect(diff('c1')).toContain('105,00')  // 10,5 mc × 10 €
    expect(totali()).toContain('€ 2.105,00')
  })

  it('la riga in detrazione sottrae, come nel libretto', () => {
    lavoro()
    w().dettagliaMisure('pz1', 'c1')
    w().addMisura('pz1', 'c1', true)
    w().setMisura('pz1', 'c1', 1, 'l1', '20')
    expect(qta('c1')).toBe('80')
    expect(diff('c1')).toContain('200,00')
  })

  it('la quantità si può ancora scrivere a mano, con la virgola', () => {
    lavoro()
    w().setVocePerizia(1, 'c1', '123,45')
    expect(diff('c1')).toContain('234,50')  // (123,45 − 100) × 10
    w().setVocePerizia(1, 'c1', '')          // svuotato = invariata
    expect(diff('c1')).toBe('—')
  })

  it('la perizia è la griglia condivisa, nella fase «perizia», e il tasto destro arriva alla voce', () => {
    lavoro()
    const t = document.querySelector('#bPaginaBody table.ehb-gr[data-fase="perizia"]')
    expect(t).not.toBeNull()
    expect([...t!.querySelectorAll('thead th')].map((th) => th.textContent)).toEqual(['', 'Codice', 'Designazione', 'Contratto vigente', 'Perizia', 'Differenza'])
    // il contesto 'pz1' è fra virgolette: prima chiudeva l'attributo a metà e il menu non partiva
    const riga = [...t!.querySelectorAll('tr.ehb-gr-voce')].find((tr) => tr.textContent?.includes('A.01'))!
    expect(riga.getAttribute('oncontextmenu')).toBe(`rigaMenu(event,'c1',"pz1")`)
  })

  it('una perizia approvata non si misura più', () => {
    lavoro({ approvata: true })
    w().dettagliaMisure('pz1', 'c1')
    expect(righeMisura()).toBe(0)
    expect(document.getElementById('toast')!.textContent).toContain('riportala in bozza')
  })
})

// @vitest-environment jsdom
import { describe, it, expect, beforeAll, vi } from 'vitest'

/**
 * IMPORTARE IN QUALUNQUE PUNTO. Il caso vero: una contabilità ereditata, con
 * SAL già firmati, e un file che porta il pregresso più qualche voce nuova.
 * L'import deve aggiungere, non azzerare, e non deve poter toccare un atto
 * firmato.
 */
type Win = typeof globalThis & Record<string, (...a: unknown[]) => unknown>
const w = (): Win => window as unknown as Win
const IDS = ['btnTheme', 'btnGuide', 'bAppSummary', 'bComputoSummary', 'bFasiList', 'bTimeline', 'bConsegne', 'bScadenze', 'bModalHost', 'toast', 'bPaginaT', 'bPaginaAct', 'bPaginaBody', 'bDrawer']

const voci = [
  { codice: 'A.1', desc_short: 'Scavo', um: 'mc', prezzo: 11, qty: 10, misurazioni: [{ descrizione: 'tratto nord', l1: 10, l2: 2, quantita: 20 }] },
  { codice: 'C.7', desc_short: 'Intonaco', um: 'mq', prezzo: 22, qty: 30, misurazioni: [{ descrizione: 'parete', quantita: 30 }] },
]

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
    appalto: { oggetto: 'Lavoro ereditato', ente: { denominazione: 'Comune' }, impresa: { denominazione: 'Impresa' }, modalita: 'misura', dataInizio: '01/06/2026' },
    partite: [{ id: 'a', modalita: 'misura', codice: 'A.1', descrizione: 'Scavo', um: 'mc', prezzoUnitario: 10, prezzoContratto: 10, introdottaSal: 1 }],
    sals: [
      { numero: 1, data: '01/07/2026', righe: [{ partitaId: 'a', quantitaProgressiva: 50 }], firmato: true, dataFirma: '02/07/2026' },
      { numero: 2, data: '01/10/2026', righe: [] },
    ],
  } } }))
  // il computo arriva dall'altro strumento, come nell'uso reale
  window.dispatchEvent(new MessageEvent('message', { data: { type: 'hub:project-state', source: 'pricelist', project: { name: 'computo', items: voci } } }))
})

const modale = (): string => document.getElementById('bModalHost')!.textContent || ''

describe('import su un lavoro già avviato', () => {
  it('non importa alla cieca: apre la scelta e dice che cosa cambia', () => {
    w().importMiu()
    const t = modale()
    expect(t).toContain('il lavoro è già avviato')
    // la scelta è esplicita: si aggiunge, oppure si cancella tutto e si importa pulito
    expect(t).toContain('Come importare')
    expect(t).toContain("Aggiungi a quello che c'è")
    expect(t).toContain('Cancella tutto e importa pulito')
    expect(t).toContain('Articoli nuovi')
  })
  it('avverte che il prezzo di contratto non viene riscritto dal file', () => {
    expect(modale()).toContain('resta il prezzo di contratto')
  })
  it('con SAL firmati non offre di ricominciare da capo', () => {
    expect(modale()).not.toContain('Ricomincia da questo computo')
  })
  it('propone solo i contenitori aperti: il SAL firmato non è fra questi', () => {
    const t = modale()
    expect(t).toContain('Libretto del SAL n. 2')
    expect(t).not.toContain('Libretto del SAL n. 1')
  })
  it('aggiunge gli articoli nuovi e porta le misure nel libretto aperto', () => {
    w().confermaAggiunta()
    const t = document.getElementById('toast')!.textContent || ''
    expect(t).toContain('1 articolo aggiunto')
    expect(t).toContain('1 già presente')
    expect(t).toContain('misure portate in 2 voci')
  })
  it('importando di nuovo lo stesso computo non duplica nulla', () => {
    w().importMiu()
    expect(modale()).toMatch(/Articoli nuovi per l'elenco\s*0/)
  })

  it('si possono importare anche solo alcune voci del file', () => {
    w().importMiu()
    expect(modale()).toContain('Quali voci importare')
    expect(modale()).toContain('già in elenco')
    w().segnaImport(false)
    expect(modale()).toContain('0 selezionate')
    w().confermaAggiunta()
    expect(document.getElementById('toast')!.textContent).toContain('Nessuna voce selezionata')
    w().toggleImport(1, true)
    w().confermaAggiunta()
  })
})

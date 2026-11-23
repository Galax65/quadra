// @vitest-environment jsdom
import { describe, it, expect, beforeAll, vi } from 'vitest'

/**
 * L'ELENCO PREZZI È UN'AREA, NON UN CASSETTO. Una cosa è il prezzario (archivio
 * del programma), un'altra l'elenco prezzi di questo lavoro: articoli, prezzo,
 * provenienza. Si gestisce per sé, senza passare da un libretto, ed è
 * trasversale: le stesse voci che il computo misura in progetto.
 */
type Win = typeof globalThis & Record<string, (...a: unknown[]) => unknown>
const w = (): Win => window as unknown as Win
const IDS = ['btnTheme', 'btnGuide', 'bAppSummary', 'bComputoSummary', 'bFasiList', 'bTimeline', 'bConsegne', 'bScadenze', 'bModalHost', 'toast', 'bPaginaT', 'bPaginaAct', 'bPaginaBody', 'bDrawer']

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
    appalto: { oggetto: 'Lavori', ente: { denominazione: 'Comune' }, impresa: { denominazione: 'Impresa' }, modalita: 'misura', dataInizio: '01/06/2026' },
    partite: [
      { id: 'p1', modalita: 'misura', codice: 'A.1', descrizione: 'Scavo', um: 'mc', prezzoUnitario: 10, prezzoContratto: 10, qtyProgetto: 100, introdottaSal: 1 },
      { id: 'p2', modalita: 'misura', codice: 'A.2', descrizione: 'Muratura', um: 'mq', prezzoUnitario: 48, prezzoContratto: 50, qtyProgetto: 50, introdottaSal: 1 },
      { id: 'p3', modalita: 'misura', codice: 'B.9', descrizione: 'Mai misurata', um: 'ml', prezzoUnitario: 7, prezzoContratto: 7, introdottaSal: 1 },
    ],
    sals: [{ numero: 1, data: '01/07/2026', righe: [{ partitaId: 'p1', quantitaProgressiva: 40 }] }],
  } } }))
})

const corpo = (): string => document.getElementById('bPaginaBody')!.innerHTML
const testo = (): string => document.getElementById('bPaginaBody')!.textContent || ''

describe('area Elenco prezzi', () => {
  it('si apre a tutta pagina e distingue elenco e prezzario', () => {
    w().apriElencoPrezzi()
    expect(document.getElementById('bPagina')!.hidden).toBe(false)
    expect(document.getElementById('bPaginaT')!.textContent).toContain('Elenco prezzi')
    expect(testo()).toContain("I prezzari caricati — regionali o privati — sono un'altra cosa")
  })
  it('elenca gli articoli nell\'ordine di iscrizione, con prezzo e provenienza', () => {
    w().apriElencoPrezzi()
    const t = testo()
    expect(t).toContain('A.1'); expect(t).toContain('A.2'); expect(t).toContain('B.9')
    expect(t).toContain('contratto')
  })
  it('dice dove ogni voce è misurata, e quali non lo sono ancora', () => {
    w().apriElencoPrezzi()
    expect(testo()).toContain('SAL 1')
    expect(testo()).toContain('non misurata')
  })
  it('segnala il prezzo che in contabilità si scosta dal contratto', () => {
    w().apriElencoPrezzi()
    expect(corpo()).toContain('Prezzo in contabilità diverso da quello di contratto')
  })
  it('la ricerca filtra per codice, descrizione o categoria', () => {
    w().apriElencoPrezzi()
    w().epFiltra('muratura')
    const t = testo()
    expect(t).toContain('A.2')
    expect(t).not.toContain('Scavo')
    w().epFiltra('')
  })
  it('una voce mai misurata si può eliminare; una già contabilizzata no', () => {
    w().apriElencoPrezzi()
    w().epElimina('p3')
    expect(document.getElementById('bPaginaBody')!.textContent).not.toContain('Mai misurata')
    w().epElimina('p1')
    expect(document.getElementById('toast')!.textContent).toContain('si storna dal libretto')
    expect(document.getElementById('bPaginaBody')!.textContent).toContain('Scavo')
  })
  it('aggiunge una voce a mano senza passare da un libretto', () => {
    w().apriElencoPrezzi()
    const prima = (document.getElementById('bPaginaBody')!.textContent || '').length
    w().epVoceAMano()
    w().apriElencoPrezzi()
    expect((document.getElementById('bPaginaBody')!.textContent || '').length).toBeGreaterThan(prima)
    expect(document.getElementById('bPaginaBody')!.textContent).toContain('(da definire)')
  })
  it('il prezzario si apre come archivio a parte, con la voce diretta all\'elenco', () => {
    w().apriElencoPrezzi()
    w().epDalPrezzario()
    const d = document.getElementById('bDrawer')!
    expect(d.hidden).toBe(false)
    expect(d.textContent).toContain('Prezzari del programma')
    expect(d.textContent).toContain("entra nell'elenco prezzi")
    w().chiudiCassetto()
  })
})

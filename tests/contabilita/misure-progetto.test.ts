// @vitest-environment jsdom
import { describe, it, expect, beforeAll, vi } from 'vitest'

/**
 * Contabilizzare un progetto: le misure sono già nel computo. «Dettaglia» le
 * prende quando la quantità coincide, il prospetto «↧ Misure di progetto» le
 * porta una per una, e nessuna riga si prende due volte per sbaglio.
 */
type Win = typeof globalThis & Record<string, (...a: unknown[]) => unknown>
const w = (): Win => window as unknown as Win
const IDS = ['btnTheme', 'btnGuide', 'bAppSummary', 'bComputoSummary', 'bFasiList', 'bTimeline', 'bConsegne', 'bModalHost', 'toast', 'bPaginaT', 'bPaginaAct', 'bPaginaBody', 'bDrawer']

beforeAll(async () => {
  document.documentElement.setAttribute('data-tool', 'contabilita')
  document.body.innerHTML = `${IDS.map((id) => `<div id="${id}"></div>`).join('')}
    <input id="bDataCorrente" type="text"><input id="bDataCorrenteCal" type="date">
    <input id="bXlsFile" type="file"><input id="bLogoFile" type="file"><section id="bPagina" hidden></section>`
  document.getElementById('bPagina')!.append(document.getElementById('bPaginaT')!, document.getElementById('bPaginaAct')!, document.getElementById('bPaginaBody')!)
  Object.defineProperty(navigator, 'clipboard', { value: { readText: vi.fn().mockResolvedValue('') }, configurable: true })
  await import('../../src/tools/contabilita/main')
})

function seed(qtySal1: number): void {
  const state = {
    v: 1,
    appalto: { oggetto: 'Contabilità da progetto', ente: { denominazione: 'Comune X' }, impresa: { denominazione: 'Impresa Y' }, modalita: 'misura', dataInizio: '01/06/2026' },
    partite: [{
      id: 'p1', modalita: 'misura', codice: 'M1', descrizione: 'Scavo', um: 'mc', prezzoUnitario: 10, qtyProgetto: 50, introdottaSal: 1,
      misurazioniProgetto: [
        { descrizione: 'edificio', n: 2, l1: 5, l2: 2, h: 1, quantita: 20 },
        { descrizione: 'tubazioni', n: 1, l1: 30, l2: 1, h: 1, quantita: 30 },
      ],
    }],
    sals: [{ numero: 1, data: '01/06/2026', righe: [{ partitaId: 'p1', quantitaProgressiva: qtySal1 }] }],
  }
  window.dispatchEvent(new MessageEvent('message', { data: { type: 'hub:restore-state', state } }))
}
const corpo = (): string => document.getElementById('bPaginaBody')!.innerHTML
const misure = (): number => document.querySelectorAll('[data-mis-key="p1"] .ehb-mis-riga').length
const totale = (): string => document.querySelector('[data-mis-key="p1"] [data-mis-tot]')!.textContent || ''

describe('misure di progetto → libretto', () => {
  it('il libretto lavora a tutta pagina e offre il cassetto delle misure di progetto', () => {
    seed(50)
    w().openEditor('sal-1', 'misure')
    expect(document.getElementById('bPagina')!.hidden).toBe(false)
    expect(corpo()).toContain('dettagliaMisure(1,')
  })

  it('«dettaglia» prende le misure di progetto quando la quantità coincide', () => {
    seed(50)
    w().openEditor('sal-1', 'misure')
    w().dettagliaMisure(1, 'p1')
    expect(misure()).toBe(2)
    expect(corpo()).toContain('edificio')
    expect(corpo()).toContain('tubazioni')
    expect(totale()).toContain('50')
  })

  it('se l\'eseguito è meno del progetto, «dettaglia» non inventa: una riga sola', () => {
    seed(20)
    w().openEditor('sal-1', 'misure')
    w().dettagliaMisure(1, 'p1')
    expect(misure()).toBe(1)
    expect(totale()).toContain('20')
    // il prospetto resta a disposizione per prendere le righe eseguite
    expect(corpo()).toContain('apriMisureProgetto(1,')
  })

  it('dal prospetto si prende una riga per volta, e la riga «da computo» si fa da parte', () => {
    seed(20)
    w().openEditor('sal-1', 'misure')
    w().dettagliaMisure(1, 'p1')
    w().prendiMisuraProgetto(1, 'p1', 0)
    expect(misure()).toBe(1)
    expect(corpo()).toContain('edificio')
    expect(totale()).toContain('20')
    w().prendiMisuraProgetto(1, 'p1', 1)
    expect(misure()).toBe(2)
    expect(totale()).toContain('50')
  })

  it('«prendi tutte» non ripete quelle già nel libretto', () => {
    seed(50)
    w().openEditor('sal-1', 'misure')
    w().dettagliaMisure(1, 'p1') // già prese entrambe
    w().apriMisureProgetto(1, 'p1')
    expect(document.getElementById('bDrawer')!.innerHTML).toContain('Già nel libretto')
    w().prendiMisureProgetto(1, 'p1')
    expect(misure()).toBe(2)
    expect(totale()).toContain('50')
  })

  it('le misure del libretto sono copie: correggerle non tocca il computo di progetto', () => {
    seed(50)
    w().openEditor('sal-1', 'misure')
    w().dettagliaMisure(1, 'p1')
    w().setMisura(1, 'p1', 0, 'l1', '4') // 2 × 4 × 2 × 1 = 16 invece di 20
    const stato = JSON.parse(JSON.stringify((window as unknown as { __betaStato?: unknown }).__betaStato ?? {}))
    void stato
    w().apriMisureProgetto(1, 'p1')
    // nel cassetto la riga di progetto è rimasta com'era (2 × 5 × 2 × 1)
    const cassetto = document.getElementById('bDrawer')!.innerHTML
    expect(cassetto).toContain('2 × 5 × 2 × 1')
    w().chiudiCassetto()
  })
})

/**
 * Trascinamento: una misura si prende e si posa dove serve (come nel computo),
 * e dal cassetto una misura di progetto entra nel punto in cui la si lascia.
 */
describe('trascinamento delle misure nel libretto', () => {
  const evento = (sopra: boolean): DragEvent => ({
    preventDefault() {}, stopPropagation() {}, clientY: sopra ? 0 : 1000,
    dataTransfer: { setData() {}, effectAllowed: '' },
  } as unknown as DragEvent)
  const cella = (): HTMLElement => ({
    getBoundingClientRect: () => ({ top: 0, height: 20 }) as DOMRect,
    classList: { add() {}, remove() {}, toggle() {} },
  } as unknown as HTMLElement)
  const designazioni = (): string[] => [...document.querySelectorAll('[data-mis-key="p1"] [data-mis-input$=":descrizione"]')].map((i) => (i as HTMLInputElement).value)

  it('una riga di misura si sposta sopra un\'altra', () => {
    seed(50)
    w().openEditor('sal-1', 'misure')
    w().dettagliaMisure(1, 'p1')
    expect(designazioni()).toEqual(['edificio', 'tubazioni'])
    // prende «tubazioni» (indice 1) e la posa SOPRA «edificio» (indice 0)
    w().misDragStart(evento(true), 1, 'p1', 1)
    w().misDrop(evento(true), 1, 'p1', 0, cella())
    expect(designazioni()).toEqual(['tubazioni', 'edificio'])
  })

  it('una misura di progetto trascinata entra nel punto scelto, una volta sola', () => {
    seed(20)
    w().openEditor('sal-1', 'misure')
    w().dettagliaMisure(1, 'p1') // una riga «da computo»
    w().apriMisureProgetto(1, 'p1')
    w().progDragStart(evento(true), 'p1', 1) // «tubazioni»
    w().misDrop(evento(true), 1, 'p1', 0, cella()) // posata sopra la prima riga
    expect(designazioni()[0]).toBe('tubazioni')
    expect(document.querySelectorAll('[data-mis-key="p1"] .ehb-mis-riga')).toHaveLength(1)
    // il progetto non si è mosso: la riga è ancora nel cassetto, segnata come presa
    expect(document.getElementById('bDrawer')!.innerHTML).toContain('Già nel libretto')
  })

  it('su un SAL firmato non si sposta nulla', () => {
    seed(50)
    w().openEditor('sal-1', 'misure')
    w().dettagliaMisure(1, 'p1')
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    w().firmaSal(1)
    const prima = designazioni()
    w().misDragStart(evento(true), 1, 'p1', 1)
    w().misDrop(evento(true), 1, 'p1', 0, cella())
    expect(designazioni()).toEqual(prima)
  })
})

/**
 * Contabilità DA ZERO: senza computo importato. Le voci si creano nel libretto —
 * libere (prima la misura, l'articolo dopo) o dall'elenco prezzi — come in un
 * computo. La differenza con il computo è che qui il SAL congela gli atti.
 */
describe('contabilità da zero', () => {
  function vuota(): void {
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'hub:restore-state', state: {
      v: 1, appalto: { oggetto: 'Lavori in economia', ente: { denominazione: 'Comune X' }, impresa: { denominazione: 'Impresa Y' }, modalita: 'misura', dataInizio: '01/06/2026' },
      partite: [], sals: [],
    } } }))
  }

  it('si apre un SAL e il libretto anche senza computo', () => {
    vuota()
    w().nuovoSalOggi()
    w().openEditor('sal-1', 'misure')
    expect(document.getElementById('bPagina')!.hidden).toBe(false)
    expect(document.getElementById('bPaginaBody')!.innerHTML).toContain('addVoceLibera(1)')
  })

  it('la voce libera nasce misurabile e senza articolo', () => {
    vuota(); w().nuovoSalOggi(); w().openEditor('sal-1', 'misure')
    w().addVoceLibera(1)
    const corpo = document.getElementById('bPaginaBody')!.innerHTML
    expect(corpo).toContain('voce libera')
    expect(corpo).toContain('⌕ assegna voce')
    expect(document.querySelectorAll('.ehb-mis-riga')).toHaveLength(1)
  })

  it('assegnare l\'articolo non tocca le misure già scritte', () => {
    vuota(); w().nuovoSalOggi(); w().openEditor('sal-1', 'misure')
    w().addVoceLibera(1)
    const pid = (document.getElementById('bPaginaBody')!.innerHTML.match(/apriVoceEdit\('([^']+)'/) || [])[1]!
    w().setMisura(1, pid, 0, 'l1', '3,2')
    w().setMisura(1, pid, 0, 'l2', '2,5')
    const tot = document.querySelector(`[data-mis-key="${pid}"] [data-mis-tot]`)!.textContent
    expect(tot).toContain('8')
    w().apriVoceEdit(pid, 1)
    ;(document.getElementById('bve-cod') as HTMLInputElement).value = '25.5.PQ3.03'
    ;(document.getElementById('bve-desc') as HTMLInputElement).value = 'INTONACO CIVILE'
    ;(document.getElementById('bve-um') as HTMLInputElement).value = 'm2'
    ;(document.getElementById('bve-prezzo') as HTMLInputElement).value = '166,71'
    w().salvaVoceEdit()
    const corpo = document.getElementById('bPaginaBody')!.innerHTML
    expect(corpo).toContain('25.5.PQ3.03')
    expect(corpo).toContain('INTONACO CIVILE')
    expect(corpo).not.toContain('voce libera —')
    expect(document.querySelector(`[data-mis-key="${pid}"] [data-mis-tot]`)!.textContent).toContain('8')
  })
})

/**
 * In contabilità il prezzo è quello di CONTRATTO: il prezzario serve a trovare
 * la voce, non a riprezzarla. Un articolo che in contratto non c'è è un nuovo
 * prezzo, e si vede.
 */
describe('prezzi di contratto nel libretto', () => {
  function conContratto(): void {
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'hub:restore-state', state: {
      v: 1, appalto: { oggetto: 'Lavori', ente: { denominazione: 'Comune X' }, impresa: { denominazione: 'Impresa Y' }, modalita: 'misura', dataInizio: '01/06/2026' },
      partite: [{ id: 'p1', modalita: 'misura', codice: 'A.01', descrizione: 'Scavo', um: 'mc', prezzoUnitario: 8.5, prezzoContratto: 8.5, qtyProgetto: 100, introdottaSal: 1 }],
      sals: [{ numero: 1, data: '01/06/2026', righe: [{ partitaId: 'p1', quantitaProgressiva: 40 }] }],
    } } }))
  }

  it('cambiare il prezzo in libretto segnala «fuori contratto» e offre il ritorno', () => {
    conContratto()
    w().openEditor('sal-1', 'misure')
    expect(document.getElementById('bPaginaBody')!.innerHTML).not.toContain('b-fuori')
    w().setPrezzo('p1', '12')
    w().openEditor('sal-1', 'misure')
    const corpo = document.getElementById('bPaginaBody')!.innerHTML
    expect(corpo).toContain('b-fuori')
    expect(corpo).toContain('ripristinaPrezzoContratto')
    w().ripristinaPrezzoContratto('p1')
    expect(document.getElementById('bPaginaBody')!.innerHTML).not.toContain('b-fuori')
  })

  it('il prezzo di contratto resta il riferimento anche dopo una correzione', () => {
    conContratto()
    w().openEditor('sal-1', 'misure')
    w().setPrezzo('p1', '9,20')
    w().apriVoceEdit('p1', 1)
    expect(document.getElementById('bModalHost')!.innerHTML).toContain('di contratto')
    w().closeModal()
  })
})

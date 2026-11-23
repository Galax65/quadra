// @vitest-environment jsdom
import { describe, it, expect, beforeAll, vi } from 'vitest'

/**
 * Un SAL non è un documento solo: è il fascicolo che si firma insieme. Gli atti
 * si producono tutti in una volta — in un unico stampato oppure uno per file,
 * perché chi li trasmette spesso deve protocollarli separatamente — e in
 * entrambi i casi vengono registrati tutti nello storico.
 */
type Win = typeof globalThis & Record<string, (...a: unknown[]) => unknown>
const w = (): Win => window as unknown as Win
const IDS = ['btnTheme', 'btnGuide', 'bAppSummary', 'bComputoSummary', 'bFasiList', 'bTimeline', 'bConsegne', 'bModalHost', 'toast', 'bPaginaT', 'bPaginaAct', 'bPaginaBody']
let stampato = ''

beforeAll(async () => {
  document.documentElement.setAttribute('data-tool', 'contabilita')
  document.body.innerHTML = `${IDS.map((id) => `<div id="${id}"></div>`).join('')}
    <input id="bDataCorrente" type="text"><input id="bDataCorrenteCal" type="date">
    <input id="bXlsFile" type="file"><input id="bLogoFile" type="file"><section id="bPagina" hidden></section>`
  document.getElementById('bPagina')!.append(document.getElementById('bPaginaT')!, document.getElementById('bPaginaAct')!, document.getElementById('bPaginaBody')!)
  Object.defineProperty(navigator, 'clipboard', { value: { readText: vi.fn().mockResolvedValue('') }, configurable: true })
  await import('../../src/tools/contabilita/main')
  // la finestra di stampa: si raccoglie l'HTML prodotto invece di aprirla
  /* L'anteprima sta dentro il programma, in un iframe con un blob: qui si
     legge da lì invece che da una finestra separata. */
  window.open = ((): unknown => ({ document: { open: () => {}, write: (h: string) => { stampato = h }, close: () => {} } })) as unknown as typeof window.open
  const BlobVero = globalThis.Blob
  globalThis.Blob = class extends BlobVero {
    constructor(parti: BlobPart[], opz?: BlobPropertyBag) {
      super(parti, opz)
      if (opz?.type === 'text/html') stampato = parti.map(String).join('')
    }
  } as unknown as typeof Blob
  URL.createObjectURL = (): string => 'blob:finto'
  URL.revokeObjectURL = (): void => {}
  window.dispatchEvent(new MessageEvent('message', { data: { type: 'hub:restore-state', state: {
    v: 1,
    appalto: { oggetto: 'Lavori di prova', ente: { denominazione: 'Comune X' }, impresa: { denominazione: 'Impresa Y' }, modalita: 'misura', dataInizio: '01/06/2026' },
    partite: [{ id: 'p1', modalita: 'misura', codice: 'M1', descrizione: 'Scavo', um: 'mc', prezzoUnitario: 10, qtyProgetto: 100, introdottaSal: 1 }],
    sals: [{ numero: 1, data: '01/06/2026', righe: [{ partitaId: 'p1', quantitaProgressiva: 40 }] }],
  } } }))
})

describe('fascicolo del SAL', () => {
  it('produce i cinque atti in un unico stampato, uno per pagina', () => {
    w().produciAttiSal(1, true)
    expect(stampato).toContain('Libretto delle misure')
    expect(stampato).toContain('Registro di contabilità')
    expect(stampato).toContain('Sommario')
    expect(stampato).toContain('Certificato di Pagamento')
    // quattro salti pagina = cinque atti
    expect(stampato.match(/class="atto-seguente"/g)).toHaveLength(4)
    expect(stampato).toContain('page-break-before:always')
    // la barra «Chiudi / Stampa» resta una sola, quella del primo atto
    expect(stampato.match(/class="doc-bar"/g)).toHaveLength(1)
  })

  it('li registra tutti nello storico dei documenti consegnati', () => {
    const storico = document.getElementById('bConsegne')!.textContent || ''
    for (const atto of ['Libretto delle misure', 'Registro di contabilità', 'Sommario', 'SAL n. 1', 'Certificato di pagamento']) {
      expect(storico, `manca «${atto}» nello storico`).toContain(atto)
    }
  })

  it('senza computo non stampa nulla', () => {
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'hub:restore-state', state: { v: 1, appalto: { oggetto: 'Vuoto', ente: {}, impresa: {}, modalita: 'misura' }, partite: [], sals: [{ numero: 1, data: '01/06/2026', righe: [] }] } } }))
    stampato = ''
    w().stampaAttiSal(1)
    expect(stampato).toBe('')
  })
})

describe('un file per ogni atto', () => {
  /* Gli atti separati NON aprono più cinque finestre: escono insieme, in un
     archivio zip. È sempre una operazione sola — chi trasmette ha i suoi file
     da protocollare, chi stampa non deve chiudere cinque schede. */
  it('produce gli atti separati in un unico archivio e li registra tutti', async () => {
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'hub:restore-state', state: {
      v: 1,
      appalto: { oggetto: 'Lavori di prova', ente: { denominazione: 'Comune X' }, impresa: { denominazione: 'Impresa Y' }, modalita: 'misura', dataInizio: '01/06/2026' },
      partite: [{ id: 'p1', modalita: 'misura', codice: 'M1', descrizione: 'Scavo', um: 'mc', prezzoUnitario: 10, qtyProgetto: 100, introdottaSal: 1 }],
      sals: [{ numero: 1, data: '01/06/2026', righe: [{ partitaId: 'p1', quantitaProgressiva: 40 }] }],
      consegne: [],
    } } }))
    // JSZip finto: raccoglie i file invece di comprimerli davvero
    const dentro: Record<string, string> = {}
    ;(window as unknown as { JSZip: unknown }).JSZip = class {
      file(nome: string, contenuto: string | Blob): void { dentro[nome] = typeof contenuto === 'string' ? contenuto : '[blob]' }
      async generateAsync(): Promise<Blob> { return new Blob(['zip']) }
    }
    await w().produciAttiTappa('sal-1', { unico: false, fmt: 'pagina', lavoro: false })
    const nomi = Object.keys(dentro)
    expect(nomi.length).toBeGreaterThanOrEqual(5)
    // ogni documento è completo per conto suo: non è un pezzo di fascicolo
    for (const n of nomi) expect(dentro[n]).toContain('<!doctype html>')
    expect(Object.values(dentro).join('')).not.toContain('class="atto-seguente"')
    const storico = document.getElementById('bConsegne')!.textContent || ''
    expect(storico).toContain('Libretto delle misure')
    expect(storico).toContain('Certificato di pagamento')
  })
})

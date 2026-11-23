// @vitest-environment jsdom
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { testoAlbero } from './_albero'

/**
 * LA PERIZIA È UNA TAPPA DEL LAVORO, non una finestra: sta nella cronologia, ci
 * si lavora a tutta pagina e ha un ITER. Finché è in bozza non cambia il
 * contratto (i suoi lavori restano in conto provvisorio); approvata, le nuove
 * quantità valgono come contratto dal SAL indicato e i suoi nuovi prezzi
 * diventano definitivi (All. II.14 art. 5 c. 7, art. 120 D.Lgs. 36/2023).
 */
type Win = typeof globalThis & Record<string, (...a: unknown[]) => unknown>
const w = (): Win => window as unknown as Win
const IDS = ['btnTheme', 'btnGuide', 'bAppSummary', 'bComputoSummary', 'bFasiList', 'bTimeline', 'bConsegne', 'bModalHost', 'toast', 'bPaginaT', 'bPaginaAct', 'bPaginaBody', 'bDrawer']
const pagina = (): string => document.getElementById('bPaginaBody')!.innerHTML
const titolo = (): string => document.getElementById('bPaginaT')!.textContent || ''
const aperta = (): boolean => !document.getElementById('bPagina')!.hidden
/* La cronologia sta nell'albero pubblicato verso l'hub, non più in una
   striscia disegnata in pagina. */
const linea = testoAlbero

beforeAll(async () => {
  document.documentElement.setAttribute('data-tool', 'contabilita')
  document.body.innerHTML = `${IDS.map((id) => `<div id="${id}"></div>`).join('')}
    <input id="bDataCorrente" type="text"><input id="bDataCorrenteCal" type="date">
    <input id="bXlsFile" type="file"><input id="bLogoFile" type="file"><section id="bPagina" hidden></section>`
  document.getElementById('bPagina')!.append(document.getElementById('bPaginaT')!, document.getElementById('bPaginaAct')!, document.getElementById('bPaginaBody')!)
  Object.defineProperty(navigator, 'clipboard', { value: { readText: vi.fn().mockResolvedValue('') }, configurable: true })
  await import('../../src/tools/contabilita/main')
})

/** Lavoro con due voci di contratto, un nuovo prezzo e una perizia in bozza. */
function lavoro(opts: { approvata?: boolean; firmato?: boolean } = {}): void {
  w().chiudiPagina()
  window.dispatchEvent(new MessageEvent('message', { data: { type: 'hub:restore-state', state: {
    v: 1,
    appalto: {
      oggetto: 'Lavori', ente: { denominazione: 'Comune X' }, impresa: { denominazione: 'Impresa Y' },
      modalita: 'misura', dataInizio: '01/06/2026', ribassoPct: 20,
      perizie: [{ numero: 1, data: '01/09/2026', dalSal: 2, oggetto: 'Maggiori scavi', voci: [{ partitaId: 'c1', qty: 150 }], ...(opts.approvata ? { approvata: true } : { approvata: false }) }],
    },
    partite: [
      { id: 'c1', modalita: 'misura', codice: 'A.01', descrizione: 'Scavo di fondazione', um: 'mc', prezzoUnitario: 8, prezzoContratto: 8, qtyProgetto: 100, introdottaSal: 1 },
      { id: 'c2', modalita: 'misura', codice: 'A.02', descrizione: 'Calcestruzzo', um: 'mc', prezzoUnitario: 120, prezzoContratto: 120, qtyProgetto: 30, introdottaSal: 1 },
      { id: 'n1', modalita: 'misura', codice: 'NP.01', descrizione: 'Lavorazione non prevista', um: 'mq', prezzoUnitario: 44, qtyProgetto: 10, introdottaSal: 2,
        np: { numero: 1, stato: 'concordato', periziaN: 1, origine: 'prezzario', base: { codice: 'X.9', descrizione: 'base', prezzo: 55, fonte: 'Prezzario' }, ribassoPct: 20 } },
    ],
    sals: [
      { numero: 1, data: '01/06/2026', firmato: true, dataFirma: '05/06/2026', righe: [{ partitaId: 'c1', quantitaProgressiva: 40 }] },
      { numero: 2, data: '01/10/2026', firmato: !!opts.firmato, righe: [{ partitaId: 'c1', quantitaProgressiva: 120 }, { partitaId: 'n1', quantitaProgressiva: 10 }] },
    ],
  } } }))
}

describe('la perizia come tappa del lavoro', () => {
  it("ha un ramo nella cronologia, con quadro comparativo ed elenco NP fra i suoi atti", async () => {
    lavoro()
    const t = await linea()
    expect(t).toContain('Perizia n. 1')
    expect(t).toContain('Quadro comparativo')
    expect(t).toContain('Elenco dei nuovi prezzi della perizia')
  })

  it('si apre a tutta pagina dalla linea del tempo, come il libretto', () => {
    lavoro()
    w().vaiA('perizia-1')
    expect(aperta()).toBe(true)
    expect(titolo()).toContain('Perizia di variante n. 1')
    expect(pagina()).toContain('in bozza')
    expect(pagina()).toContain('Approva la perizia')
    expect(pagina()).toContain('NP.01') // i nuovi prezzi della perizia sono in pagina
  })

  it("la cronologia la segnala in bozza, e senza riserve quando è approvata", async () => {
    lavoro()
    expect(await linea()).toContain('Perizia n. 1 (bozza)')
    lavoro({ approvata: true })
    const t = await linea()
    expect(t).toContain('Perizia n. 1')
    expect(t).not.toContain('Perizia n. 1 (bozza)')
  })
})

describe('iter della perizia', () => {
  it("l'approvazione chiude la perizia e rende definitivi i suoi nuovi prezzi", () => {
    lavoro()
    w().vaiA('perizia-1')
    expect(pagina()).toContain('1 in attesa')
    w().approvaPerizia(1)
    expect(pagina()).toContain('Perizia n. 1 approvata')
    expect(pagina()).toContain('1 nuovo prezzo approvato')
    expect(pagina()).toContain('b-locked') // approvata = sola lettura
    expect(pagina()).toContain('is-approvato')
  })

  it('torna in bozza, e solo se nessun SAL firmato la applica già', () => {
    lavoro({ approvata: true, firmato: true })
    w().vaiA('perizia-1')
    w().riapriPerizia(1)
    expect(pagina()).toContain('approvata') // SAL 2 firmato: non si riapre
    lavoro({ approvata: true })
    w().vaiA('perizia-1')
    w().riapriPerizia(1)
    expect(pagina()).toContain('in bozza')
    expect(pagina()).toContain('is-concordato') // il NP torna provvisorio
  })

  it('una perizia nuova nasce in bozza e si apre come tappa', async () => {
    lavoro({ approvata: true })
    w().nuovaPerizia()
    expect(titolo()).toContain('Perizia di variante n. 2')
    expect(pagina()).toContain('in bozza')
    expect(await linea()).toContain('Perizia n. 2 (bozza)')
  })
})

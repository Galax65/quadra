// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest'
import { albero } from './_albero'

/**
 * SI MISURA IN UN POSTO SOLO.
 *
 * Libretto, registro, sommario, stato di avanzamento e certificato sono gli
 * ATTI: mostrano le stesse misure e gli stessi prezzi, e quello che si vede è
 * esattamente quello che si emette. Erano invece cinque schermate di lavoro che
 * raccontavano le stesse righe in cinque modi, ognuna con i suoi campi, e non
 * si capiva quale facesse testo.
 *
 * Adesso c'è una schermata dove si misura («Misurazioni»), una dove si scrivono
 * i dati che gli atti non calcolano («Dati del SAL»), e cinque anteprime.
 */
type Win = typeof globalThis & Record<string, (...a: unknown[]) => unknown>
const w = (): Win => window as unknown as Win
const IDS = ['btnTheme', 'btnGuide', 'bAppSummary', 'bComputoSummary', 'bFasiList', 'bTimeline', 'bConsegne', 'bModalHost', 'toast', 'bPaginaT', 'bPaginaAct', 'bPaginaBody', 'bDrawer']
const pagina = (): string => document.getElementById('bPaginaBody')!.innerHTML
const titolo = (): string => document.getElementById('bPaginaT')!.textContent || ''

beforeAll(async () => {
  document.documentElement.setAttribute('data-tool', 'contabilita')
  document.body.innerHTML = `${IDS.map((id) => `<div id="${id}"></div>`).join('')}
    <input id="bDataCorrente" type="text"><input id="bDataCorrenteCal" type="date">
    <input id="bXlsFile" type="file"><input id="bLogoFile" type="file"><section id="bPagina" hidden></section>`
  document.getElementById('bPagina')!.append(document.getElementById('bPaginaT')!, document.getElementById('bPaginaAct')!, document.getElementById('bPaginaBody')!)
  await import('../../src/tools/contabilita/main')
})

function lavoro(): void {
  w().chiudiPagina()
  window.dispatchEvent(new MessageEvent('message', { data: { type: 'hub:restore-state', state: {
    v: 1,
    appalto: { oggetto: 'Prova', ente: { denominazione: 'Comune di Prova' }, impresa: {}, modalita: 'misura', ribassoPct: 10 },
    partite: [{ id: 'c1', codice: 'A.01', descrizione: 'Scavo', um: 'm³', prezzo: 10, qtyProgetto: 100, modalita: 'misura' }],
    sals: [{ numero: 1, data: '01/03/2026', righe: [{ partitaId: 'c1', quantitaProgressiva: 40 }] }],
  } } }))
}

describe('una schermata per misurare, cinque anteprime per gli atti', () => {
  it('aprendo il SAL si arriva dove si misura, non su un documento', () => {
    lavoro()
    w().vaiA('sal-1')
    expect(titolo()).toContain('Misurazioni')
    expect(pagina()).not.toContain('b-docview')
  })

  it('i cinque atti sono anteprime: il foglio, e nessun campo da compilare', () => {
    lavoro()
    for (const tipo of ['libretto', 'registro', 'sommario', 'sal', 'certificato']) {
      w().openEditor('sal-1', tipo)
      expect(pagina(), tipo).toContain('b-docview')
      expect(pagina(), tipo).not.toContain('<input')
      expect(pagina(), tipo).not.toContain('<textarea')
    }
  })

  it("ogni anteprima dice dove si scrive ciò che mostra", () => {
    lavoro()
    w().openEditor('sal-1', 'libretto')
    expect(pagina()).toContain('Misurazioni')
    w().openEditor('sal-1', 'certificato')
    expect(pagina()).toContain('Dati del SAL')
  })

  it('«Dati del SAL» raccoglie tutto ciò che si scriveva sparso nei tre atti', () => {
    lavoro()
    w().openEditor('sal-1', 'datisal')
    const h = pagina()
    expect(h).toContain('Detrazioni')          // stava nel SAL
    expect(h).toContain('Iscrivi riserva')     // stava nel registro
    expect(h).toContain('Sottoscrizione del registro')
    expect(h).toContain('Formula del certificato') // stava nel certificato
  })

  it("l'albero distingue le schermate di lavoro dalle anteprime", async () => {
    lavoro()
    w().chiudiPagina()
    const sal = (await albero()).find((r) => r.fase === 'sal-1')!
    const lav = sal.atti.filter((a) => a.lavoro).map((a) => a.label)
    expect(lav).toEqual(['Misurazioni', 'Dati del SAL'])
    expect(sal.atti.filter((a) => !a.lavoro).map((a) => a.label)).toContain('Libretto delle misure')
  })

  it('anche la perizia separa il computo di variante dall\'atto', async () => {
    lavoro()
    w().nuovaPerizia()
    w().chiudiPagina()
    const pz = (await albero()).find((r) => r.fase === 'perizia-1')
    expect(pz?.atti.filter((a) => a.lavoro).map((a) => a.label)).toEqual(['Computo di variante'])
    w().openEditor('perizia-1', 'perizia')
    expect(pagina()).toContain('b-docview')
  })
})

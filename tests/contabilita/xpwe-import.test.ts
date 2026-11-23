// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest'

/**
 * Contabilità — import di un computo .xpwe dal pulsante della modale «Importa»:
 * il file scelto diventa l'insieme delle partite e completa l'oggetto
 * dell'appalto se ancora vuoto.
 */
const IDS = ['btnTheme', 'btnGuide', 'bAppSummary', 'bComputoSummary', 'bFasiList', 'bTimeline', 'bConsegne', 'bModalHost', 'toast', 'bPaginaT', 'bPaginaAct', 'bPaginaBody']
type Win = typeof globalThis & Record<string, (...a: unknown[]) => unknown>

const XPWE = `<?xml version="1.0" encoding="UTF-8"?><PweDocumento><PweDatiGenerali><PweDGProgetto><PweDGDatiGenerali>
<Oggetto>Sottopasso di esempio</Oggetto><Committente>Comune di Esempio</Committente></PweDGDatiGenerali></PweDGProgetto>
<PweDGCapitoliCategorie><PweDGSuperCategorie><DGSuperCategorieItem ID="1"><DesSintetica>OPERE CIVILI</DesSintetica></DGSuperCategorieItem></PweDGSuperCategorie></PweDGCapitoliCategorie></PweDatiGenerali>
<PweMisurazioni><PweElencoPrezzi>
<EPItem ID="1"><Tariffa>ZZ.TEST.01</Tariffa><DesRidotta>Scavo di sbancamento</DesRidotta><UnMisura>m³</UnMisura><Prezzo1>10</Prezzo1></EPItem>
</PweElencoPrezzi><PweVociComputo>
<VCItem ID="1"><IDEP>1</IDEP><IDSpCat>1</IDSpCat><PweVCMisure><RGItem ID="1"><IDVV>-2</IDVV><Descrizione>rampa</Descrizione><Lunghezza>20</Lunghezza><Larghezza>5</Larghezza><HPeso>1,5</HPeso></RGItem></PweVCMisure></VCItem>
</PweVociComputo></PweMisurazioni></PweDocumento>`

beforeAll(async () => {
  document.documentElement.setAttribute('data-tool', 'contabilita')
  document.body.innerHTML = `${IDS.map((id) => `<div id="${id}"></div>`).join('')}
    <input id="bDataCorrente" type="text"><input id="bDataCorrenteCal" type="date">
    <input id="bLogoFile" type="file"><input id="bXpweFile" type="file">
    <section id="bPagina" hidden></section>`
  document.getElementById('bPagina')!.append(document.getElementById('bPaginaT')!, document.getElementById('bPaginaAct')!, document.getElementById('bPaginaBody')!)
  await import('../../src/tools/contabilita/main')
})

describe('Contabilità — import XPWE', () => {
  it('la modale di import offre il file XPWE', () => {
    ;(window as unknown as Win).openImport()
    expect(document.getElementById('bModalHost')!.innerHTML).toContain('Importa un file XPWE')
    expect(typeof (window as unknown as Win).pickXpwe).toBe('function')
  })

  it('il file scelto diventa il computo contabile', async () => {
    const inp = document.getElementById('bXpweFile') as HTMLInputElement
    const file = new File([XPWE], 'esempio.xpwe', { type: 'application/xml' })
    Object.defineProperty(inp, 'files', { value: [file], configurable: true })
    inp.dispatchEvent(new Event('change'))
    await new Promise(r => setTimeout(r, 50))
    const riepilogo = document.getElementById('bComputoSummary')!.textContent || ''
    expect(riepilogo).toMatch(/1\s*voc|1\s*partit|ZZ\.TEST\.01|1\.500|1500/)
    expect(document.getElementById('toast')!.textContent).toContain('esempio.xpwe')
    expect(document.getElementById('bPaginaT')!.textContent).toContain('Sottopasso di esempio')
  })
})

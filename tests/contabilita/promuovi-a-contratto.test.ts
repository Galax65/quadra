// @vitest-environment jsdom
import { describe, it, expect, beforeAll, vi } from 'vitest'

/**
 * PROMUOVI A CONTRATTO: il Computo dichiara come i prezzi di progetto sono
 * diventati prezzi di contratto (ribasso d'asta o prezzi offerti).
 *
 * IL RIBASSO SI APPLICA UNA VOLTA SOLA, ALLA FINE. La contabilità si tiene ai
 * prezzi di elenco del progetto andato in appalto — è a quei prezzi che si
 * scrivono libretto e registro — e il ribasso si deduce sul totale dei lavori
 * del SAL. Gli ONERI DELLA SICUREZZA non lo subiscono mai (All. II.14; art. 41
 * c. 13 del codice). L'unica eccezione è l'offerta a PREZZI UNITARI, dove ogni
 * prezzo è già quello offerto e non c'è nulla da dedurre.
 *
 * Questi test stanno qui perché il ribasso era finito nei prezzi E nella
 * cascata del SAL: applicato due volte.
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

const VOCI = [
  { codice: 'A.01', desc_short: 'Scavo', um: 'm3', prezzo: 100, qty: 10 },
  { codice: 'S.01', desc_short: 'Recinzione di cantiere', um: 'm', prezzo: 50, qty: 20, sicurezza: true },
]
function dalComputo(contratto?: Record<string, unknown>): void {
  window.dispatchEvent(new MessageEvent('message', { data: { type: 'hub:restore-state', state: { v: 1, appalto: { oggetto: '', ente: {}, impresa: {}, modalita: 'misura' }, partite: [], sals: [] } } }))
  window.dispatchEvent(new MessageEvent('message', { data: { type: 'hub:project-state', source: 'pricelist', project: {
    items: VOCI, datiGenerali: { oggetto: 'Lavori di prova', committente: 'Comune X', impresa: 'Impresa Y', ...(contratto ? { contratto } : {}) }, ts: Date.now(),
  } } }))
  w().importMiu()
}
describe('promuovi a contratto', () => {
  it('senza ribasso i prezzi restano quelli di progetto', () => {
    dalComputo()
    // il pannello dice il CONTRATTO: le voci di contratto, non la somma di tutto l'elenco
    expect(document.getElementById('bComputoSummary')!.textContent).toContain('Voci di contratto2')
    w().setLibSolo('tutte')
    w().openEditor('sal-1', 'misure')
    const corpo = document.getElementById('bPaginaBody')!.innerHTML
    expect(corpo).toContain('value="100"')
    expect(corpo).toContain('value="50"')
  })

  it('col ribasso i prezzi NON si toccano: restano quelli di progetto', () => {
    dalComputo({ ribassoPct: 20, data: '10/03/2026' })
    w().setLibSolo('tutte')
    w().openEditor('sal-1', 'misure')
    const corpo = document.getElementById('bPaginaBody')!.innerHTML
    expect(corpo).toContain('value="100"')  // prezzo di elenco, non 80
    expect(corpo).toContain('value="50"')
    expect(corpo).not.toContain('value="80"')
  })

  it('il ribasso sta nei dati dell\'appalto e si deduce nel SAL, una volta sola', () => {
    dalComputo({ ribassoPct: 20 })
    w().openDati()
    expect(document.getElementById('bModalHost')!.innerHTML).toContain('20')
    w().closeModal()
    // misuro tutto lo scavo: 10 m3 × 100 = 1.000 lordi
    w().setLibSolo('tutte')
    w().openEditor('sal-1', 'misure')
    const pid = (document.getElementById('bPaginaBody')!.innerHTML.match(/data-pid="([^"]+)"/) || [])[1]
    expect(pid).toBeTruthy()
    w().setSalQta(1, pid, '10')
    w().setLibSolo('tutte')
    w().openEditor('sal-1', 'sal')
    const sal = document.getElementById('bPagina')!.textContent || ''
    /* 10 m3 × € 100 = 1.000 lordi, meno il 20% = 800 netti. Se il ribasso
       fosse anche nei prezzi, qui si leggerebbe 640: applicato due volte. */
    expect(sal).toContain('€ 800,00')
    expect(sal).not.toContain('€ 640,00')
  })

  it('con offerta a prezzi unitari il ribasso non si applica', () => {
    dalComputo({ prezziOfferti: true, ribassoPct: 20 })
    w().setLibSolo('tutte')
    w().openEditor('sal-1', 'misure')
    expect(document.getElementById('bPaginaBody')!.innerHTML).toContain('value="100"')
  })
})

/**
 * L'ATTO DI CONTRATTO (tappa 8): se nel Computo c'è, la Contabilità importa
 * QUELLO — il computo scelto, fotografato — e non il computo di adesso, che
 * nel frattempo può essere andato avanti.
 */
describe("si importa l'atto, non il computo di adesso", () => {
  it('le voci e il ribasso vengono dall\'atto', () => {
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'hub:restore-state', state: { v: 1, appalto: { oggetto: '', ente: {}, impresa: {}, modalita: 'misura' }, partite: [], sals: [] } } }))
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'hub:project-state', source: 'pricelist', project: {
      // il computo di adesso ha preso un'altra strada: un prezzo diverso e una voce in più
      items: [{ codice: 'A.01', desc_short: 'Scavo', um: 'm3', prezzo: 777, qty: 10 }, { codice: 'Z.99', desc_short: 'Aggiunta dopo', um: 'cad', prezzo: 1, qty: 1 }],
      datiGenerali: { oggetto: 'Lavori di prova' },
      contratto: { fonte: { tipo: 'revisione', id: 'r', nome: 'rev.01 Esecutivo' }, ribassoPct: 15, data: '01/04/2026', ts: 1, voci: VOCI, baseAsta: 1000, sicurezza: 1000, importo: 1850 },
      ts: Date.now(),
    } } }))
    w().importMiu()
    w().setLibSolo('tutte')
    w().openEditor('sal-1', 'misure')
    const corpo = document.getElementById('bPaginaBody')!.innerHTML
    expect(corpo).toContain('value="100"')
    expect(corpo).not.toContain('777')
    expect(corpo).not.toContain('Z.99')
    w().openDati()
    const dati = document.getElementById('bModalHost')!.innerHTML
    expect(dati).toContain('15')
    expect(dati).toContain('01/04/2026')   // la data dell'atto diventa la data di stipula
    w().closeModal()
  })
})

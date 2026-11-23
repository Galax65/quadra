// @vitest-environment jsdom
/**
 * LA CRONOLOGIA DEL LAVORO racconta i fatti nell'ordine in cui sono accaduti:
 * le fasi di progetto congelate nel Computo, il contratto, le perizie DOVE
 * valgono — fra il SAL precedente e quello da cui entrano in vigore — e i SAL.
 *
 * Non è più una striscia disegnata al centro della pagina (era la stessa
 * navigazione dell'albero, fatta due volte): è l'ALBERO che la Contabilità
 * pubblica verso l'hub, ed è lì che l'ordine va verificato.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { alberoDelComputo, unisciAlberi, type RamoLavoro } from '../../src/shared/revisioni'
const IDS = ['btnTheme', 'btnGuide', 'bAppSummary', 'bComputoSummary', 'bFasiList', 'bTimeline', 'bConsegne', 'bModalHost', 'toast', 'bPaginaT', 'bPaginaAct', 'bPaginaBody']

beforeAll(async () => {
  document.documentElement.setAttribute('data-tool', 'contabilita')
  document.body.innerHTML = `${IDS.map((id) => `<div id="${id}"></div>`).join('')}
    <input id="bDataCorrente" type="text"><input id="bDataCorrenteCal" type="date">
    <input id="bXlsFile" type="file"><input id="bLogoFile" type="file"><section id="bPagina" hidden></section>`
  document.getElementById('bPagina')!.append(document.getElementById('bPaginaT')!, document.getElementById('bPaginaAct')!, document.getElementById('bPaginaBody')!)
  Object.defineProperty(navigator, 'clipboard', { value: { readText: vi.fn().mockResolvedValue('') }, configurable: true })
  await import('../../src/tools/contabilita/main')
})

/* L'albero pubblicato verso l'hub: in jsdom window.parent è window stessa, e
   il messaggio torna indietro qui. */
let _albero: RamoLavoro[] = []
window.addEventListener('message', (ev) => {
  const d = (ev as MessageEvent).data as { type?: string; project?: { albero?: RamoLavoro[] } }
  if (d?.type === 'app:project-update' && d.project?.albero) _albero = d.project.albero
})
/* postMessage consegna in un giro di eventi: si aspetta un tick. */
const testo = async (): Promise<string> => {
  await new Promise((r) => setTimeout(r, 0))
  return _albero.map((r) => r.etichetta).join(' | ')
}

describe('linea del tempo del lavoro', () => {
  it('la perizia sta fra il SAL precedente e quello da cui vale', async () => {
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'hub:restore-state', state: {
      v: 1,
      appalto: {
        oggetto: 'Lavori di prova', ente: { denominazione: 'Comune X' }, impresa: { denominazione: 'Impresa Y' }, modalita: 'misura',
        perizie: [{ numero: 1, data: '18/11/2026', dalSal: 2, voci: [], approvata: false }],
      },
      partite: [{ id: 'p1', modalita: 'misura', codice: 'M1', descrizione: 'Scavo', um: 'mc', prezzoUnitario: 10, qtyProgetto: 100, introdottaSal: 1 }],
      sals: [
        { numero: 1, data: '09/04/2026', righe: [{ partitaId: 'p1', quantitaProgressiva: 40 }], firmato: true },
        { numero: 2, data: '09/07/2026', righe: [{ partitaId: 'p1', quantitaProgressiva: 70 }] },
      ],
    } } }))
    const t = await testo()
    const iSal1 = t.indexOf('SAL n. 1'), iPz = t.indexOf('Perizia n. 1'), iSal2 = t.indexOf('SAL n. 2')
    expect(iSal1).toBeGreaterThan(-1)
    expect(iPz).toBeGreaterThan(iSal1)
    expect(iSal2).toBeGreaterThan(iPz)
  })
  it('le fasi di progetto congelate nel Computo aprono la catena', async () => {
    const revisioni = [
      { id: 'r1', nome: 'PFTE', fase: 'PFTE', data: '10/01/2026', voci: 1, totale: 150000 },
      { id: 'r2', nome: 'Progetto esecutivo', fase: 'esecutivo', data: '03/03/2026', voci: 1, totale: 170356.74 },
    ]
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'hub:project-state', source: 'pricelist', project: {
      items: [{ codice: 'M1', desc_short: 'Scavo', um: 'mc', prezzo: 10, qty: 100 }], revisioni,
    } } }))
    await testo()
    /* I rami delle revisioni li pubblica il Computo, che le tiene e le apre: la
       Contabilità non li ridisegna, ma li CONTA — il contratto viene dopo di loro. */
    expect(_albero.some((r) => r.etichetta === 'PFTE')).toBe(false)
    expect(_albero.find((r) => r.etichetta === 'Contratto')?.rev).toBe(2)
    // e nell'albero unito dell'hub il progetto apre la catena, prima del contratto
    const computo = alberoDelComputo({ voci: 1, totale: 1000, revisioni, eur: (n) => String(n) })
    const tutto = unisciAlberi({ contabilita: { rami: _albero }, computo: { rami: computo.rami } }).rami.map((r) => r.etichetta)
    expect(tutto.indexOf('PFTE')).toBeLessThan(tutto.indexOf('Contratto'))
    expect(tutto.indexOf('Progetto esecutivo')).toBeLessThan(tutto.indexOf('Contratto'))
    expect(computo.rami.find((r) => r.etichetta === 'Progetto esecutivo')?.rev).toBe(1)
  })
})

// @vitest-environment jsdom
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { albero } from './_albero'

/**
 * IL CASSETTO È L'ELENCO PREZZI DEL LAVORO: le voci che il lavoro conosce
 * (contratto + nuovi prezzi), le misure di progetto della voce aperta e il
 * prezzario, che serve solo a creare nuovi prezzi.
 */
type Win = typeof globalThis & Record<string, (...a: unknown[]) => unknown>
const w = (): Win => window as unknown as Win
const IDS = ['btnTheme', 'btnGuide', 'bAppSummary', 'bComputoSummary', 'bFasiList', 'bTimeline', 'bConsegne', 'bModalHost', 'toast', 'bPaginaT', 'bPaginaAct', 'bPaginaBody', 'bDrawer']
const cassetto = (): string => document.getElementById('bDrawer')!.innerHTML
const voci = (): number => document.querySelectorAll('#bCassettoLista .b-pmis').length
const righeLibretto = (): number => [...document.querySelectorAll('#bPaginaBody tbody tr')].filter((r) => /delVoce\(/.test(r.innerHTML)).length

beforeAll(async () => {
  document.documentElement.setAttribute('data-tool', 'contabilita')
  document.body.innerHTML = `${IDS.map((id) => `<div id="${id}"></div>`).join('')}
    <input id="bDataCorrente" type="text"><input id="bDataCorrenteCal" type="date">
    <input id="bXlsFile" type="file"><input id="bLogoFile" type="file"><section id="bPagina" hidden></section>`
  document.getElementById('bPagina')!.append(document.getElementById('bPaginaT')!, document.getElementById('bPaginaAct')!, document.getElementById('bPaginaBody')!)
  Object.defineProperty(navigator, 'clipboard', { value: { readText: vi.fn().mockResolvedValue('') }, configurable: true })
  await import('../../src/tools/contabilita/main')
})

function lavoro(): void {
  window.dispatchEvent(new MessageEvent('message', { data: { type: 'hub:restore-state', state: {
    v: 1,
    appalto: { oggetto: 'Lavori', ente: { denominazione: 'Comune X' }, impresa: { denominazione: 'Impresa Y' }, modalita: 'misura', dataInizio: '01/06/2026', ribassoPct: 20 },
    partite: [
      { id: 'c1', modalita: 'misura', codice: 'A.01', descrizione: 'Scavo di fondazione', um: 'mc', prezzoUnitario: 8, prezzoContratto: 8, qtyProgetto: 100, introdottaSal: 1, misurazioniProgetto: [{ descrizione: 'edificio', n: 2, l1: 5, l2: 5, h: 2, quantita: 100 }] },
      { id: 'c2', modalita: 'misura', codice: 'A.02', descrizione: 'Calcestruzzo', um: 'mc', prezzoUnitario: 120, prezzoContratto: 120, qtyProgetto: 30, introdottaSal: 1 },
      { id: 'n1', modalita: 'misura', codice: 'NP.01', descrizione: 'Lavorazione non prevista', um: 'mq', prezzoUnitario: 44, qtyProgetto: null, introdottaSal: 2 },
    ],
    sals: [{ numero: 1, data: '01/06/2026', righe: [{ partitaId: 'c1', quantitaProgressiva: 40 }] }],
  } } }))
  w().setLibSolo('tutte')
  w().openEditor('sal-1', 'misure')
}

describe('cassetto: elenco prezzi del lavoro', () => {
  it('la scheda «Contratto» elenca le voci del lavoro con il loro prezzo', () => {
    lavoro()
    w().apriCassetto(1, 'contratto')
    expect(cassetto()).toContain('Elenco prezzi del lavoro')
    expect(voci()).toBe(3)
    expect(cassetto()).toContain('A.01')
    expect(cassetto()).toContain('NP.01')
  })

  it('il nuovo prezzo è marcato NP, le voci di contratto no', () => {
    lavoro()
    w().apriCassetto(1, 'contratto')
    const righe = [...document.querySelectorAll('#bCassettoLista .b-pmis')].map((x) => x.innerHTML)
    expect(righe.filter((h) => h.includes('b-np'))).toHaveLength(1)
    expect(righe.find((h) => h.includes('NP.01'))).toContain('b-np')
    expect(righe.find((h) => h.includes('A.01'))).not.toContain('b-np')
  })

  it('la ricerca filtra per codice o parole', () => {
    lavoro()
    w().apriCassetto(1, 'contratto')
    w().cercaCassetto('calce')
    expect(voci()).toBe(1)
    w().cercaCassetto('A.0')
    expect(voci()).toBe(2)
    w().cercaCassetto('')
    expect(voci()).toBe(3)
  })

  it('＋ ripete una voce già nel libretto; una voce non ancora visibile la porta dentro', () => {
    lavoro()
    const prima = righeLibretto()
    w().apriCassetto(1, 'contratto')
    w().portaNelLibretto(1, 'c2') // c2 è già nel libretto del SAL 1: si ripete
    expect(righeLibretto()).toBe(prima + 1)
    expect(document.getElementById('bPaginaBody')!.innerHTML).toContain('voce ripetuta')
    w().portaNelLibretto(1, 'n1') // n1 nasce al SAL 2: portarla qui la rende misurabile
    expect(righeLibretto()).toBe(prima + 2)
  })

  it('la scheda «Progetto» mostra le misure della voce aperta e dice quando non ce ne sono', () => {
    lavoro()
    w().apriCassetto(1, 'progetto', 'c1')
    expect(cassetto()).toContain('edificio')
    expect(cassetto()).toContain('2 × 5 × 5 × 2')
    w().apriCassetto(1, 'progetto', 'c2')
    expect(cassetto()).toContain('non ha misure di progetto')
  })

  it('su un SAL firmato il cassetto non offre comandi', () => {
    lavoro()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    w().firmaSal(1)
    w().apriCassetto(1, 'contratto')
    expect(cassetto()).toContain('sola lettura')
    expect(cassetto()).not.toContain('portaNelLibretto')
  })
})

/**
 * LA CRONOLOGIA DEL LAVORO: contratto · perizie · SAL · conto finale. È il filo
 * che tiene insieme progetto ed esecuzione, e vive nell'ALBERO che la
 * Contabilità pubblica verso l'hub — non più in una striscia disegnata al
 * centro della pagina, che era la stessa navigazione fatta due volte.
 */
describe('la cronologia del lavoro', () => {
  const rami = async (): Promise<string[]> =>
    (await albero()).filter((r) => r.fase !== 'avvio' || r.etichetta !== 'Dati generali')
      .map((r) => `${r.etichetta}${r.stato ? ` (${r.stato})` : ''}${r.rev != null ? ` rev${r.rev}` : ''}`)

  it('senza computo il contratto è ancora in bozza', async () => {
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'hub:restore-state', state: { v: 1, appalto: { oggetto: '', ente: {}, impresa: {}, modalita: 'misura' }, partite: [], sals: [] } } }))
    const t = await rami()
    expect(t[0]).toContain('Contratto')
    expect(t[0]).toContain('bozza')
  })

  it('col contratto conta le voci, e c\'è un ramo per ogni SAL più la chiusura', async () => {
    lavoro()
    w().chiudiPagina()
    const t = await rami()
    const alb = await albero()
    expect(alb.find((r) => r.etichetta === 'Contratto')?.stato).toBe('approvata')
    expect(t.some((x) => x.includes('SAL n. 1'))).toBe(true)
    expect(t[t.length - 1]).toContain('Ultimazione')
  })

  it('il SAL firmato si distingue da quello aperto', async () => {
    lavoro()
    w().chiudiPagina()
    expect((await albero()).find((x) => x.etichetta === 'SAL n. 1')?.stato).toBe('bozza')
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    w().firmaSal(1)
    expect((await albero()).find((x) => x.etichetta === 'SAL n. 1')?.stato).toBe('approvata')
  })

  it('cliccando un SAL si apre DOVE SI MISURA, non su un\'anteprima di stampa', () => {
    lavoro()
    w().chiudiPagina()
    w().vaiA('sal-1')
    expect(document.getElementById('bPagina')!.hidden).toBe(false)
    expect(document.getElementById('bPaginaT')!.textContent).toContain('Misurazioni')
  })
})

/**
 * I NUOVI PREZZI nell'interfaccia: assimilazione dal cassetto, iter che avanza,
 * atto che compare nella catena quando ce n'è bisogno.
 */
describe('nuovi prezzi nel libretto', () => {
  const npPid = (): string => {
    const m = document.getElementById('bPaginaBody')!.innerHTML.match(/apriNP\('([^']+)'/)
    return m ? m[1] : ''
  }

  it('≈ crea un nuovo prezzo per assimilazione, numerato e in bozza', () => {
    lavoro()
    const prima = righeLibretto()
    w().apriCassetto(1, 'contratto')
    w().assimilaVoce(1, 'c1')
    const corpo = document.getElementById('bPaginaBody')!.innerHTML
    expect(righeLibretto()).toBe(prima + 1)
    expect(corpo).toContain('nuovo prezzo n.')
    expect(corpo).toContain('in bozza')
    expect(corpo).toContain('NP.0')
  })

  it('l\'iter avanza: bozza → concordato → approvato', () => {
    lavoro()
    w().assimilaVoce(1, 'c1')
    const pid = npPid()
    expect(pid).toBeTruthy()
    w().statoNP(pid, 'concordato')
    expect(document.getElementById('bPaginaBody')!.innerHTML).toContain('concordato')
    w().statoNP(pid, 'approvato')
    expect(document.getElementById('bPaginaBody')!.innerHTML).toContain('approvato')
  })

  it('la scheda del nuovo prezzo ricalcola il prezzo dal base e dal ribasso', () => {
    lavoro()
    w().assimilaVoce(1, 'c1')
    const pid = npPid()
    w().setNPCampo(pid, 'base', '200')
    w().setNPCampo(pid, 'ribassoPct', '20')
    w().apriNP(pid, 1)
    const scheda = document.getElementById('bModalHost')!.innerHTML
    expect(scheda).toContain('nuovo prezzo n.')
    expect(scheda).toContain('160,00')   // 200 − 20%
    w().closeModal()
  })

  it('l\'atto «Elenco dei nuovi prezzi» compare fra gli atti del SAL solo quando ce ne sono', async () => {
    const atti = async (): Promise<string> =>
      (await albero()).flatMap((r) => r.atti.map((a) => a.label)).join(' | ')
    lavoro()
    w().chiudiPagina()
    expect(await atti()).not.toContain('Elenco dei nuovi prezzi')
    w().vaiA('sal-1')
    w().assimilaVoce(1, 'c1')
    w().chiudiPagina()
    expect(await atti()).toContain('Elenco dei nuovi prezzi')
  })
})

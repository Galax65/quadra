// @vitest-environment jsdom
/**
 * DOPO LE PROVE DELL'UTENTE (seguito della tappa 8):
 *  - un computo si importa nella FASE che è (un esecutivo non deve passare dal PFTE);
 *  - passando di fase si riparte, se si vuole, da una REVISIONE congelata;
 *  - la colonna dei prezzi ha due schede: l'elenco del progetto e il prezzario.
 * E2E sul codice vero del Computo (moduli legacy in jsdom).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { snapshotComputo, revisioneDiProgetto, rinominaRevisione, elencoDellaRevisione, naturaDi, ultimaDiComputo, confrontaRevisione, FASI_COMPUTO } from '../../src/tools/computo/engine/revisioni'
import { importoVoce } from '../../src/shared/stampa/computo-pdf'

if (typeof localStorage === 'undefined') {
  const store = new Map<string, string>()
  ;(globalThis as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k), clear: () => store.clear(), key: () => null, get length() { return store.size },
  }
}

const ROOT = resolve(__dirname, '../..')
type W = Window & typeof globalThis & Record<string, any>

async function setup() {
  const html = readFileSync(resolve(ROOT, 'src/tools/computo/index.html'), 'utf8')
  document.body.innerHTML = html.replace(/[\s\S]*<body>/, '').replace(/<\/body>[\s\S]*/, '')
  localStorage.clear()
  const { barraVoci } = await import('../../src/shared/ui/barra-voci')
  const w = window as unknown as W
  w.ehbBarraVoci = barraVoci
  // il modello delle revisioni lo espone main.ts: qui lo si espone a mano, come fa l'app
  w.miuRevisioni = { FASI: FASI_COMPUTO, snapshot: snapshotComputo, progetto: revisioneDiProgetto, rinomina: rinominaRevisione, elenco: elencoDellaRevisione, natura: naturaDi, ultimaDiComputo, confronta: confrontaRevisione, importoVoce }
  // @ts-expect-error — modulo JS legacy senza dichiarazioni
  const stato = await import('../../src/tools/computo/legacy/stato.js')
  // @ts-expect-error — modulo JS legacy senza dichiarazioni
  await import('../../src/tools/computo/legacy/index.js')
  // @ts-expect-error — modulo JS legacy senza dichiarazioni
  const ov = await import('../../src/tools/computo/legacy/computo-overlay.js')
  w.importComputoXpwe = ov.importComputoXpwe
  w.congelaComputoInCorso = ov.congelaComputoInCorso
  const S = stato.S as any
  S.custom.clear(); S.sel.clear(); S.revisioni = []; S.faseProgetto = 'PFTE'; S.archive.length = 0
  for (const k of Object.keys(S.qty)) delete S.qty[k]
  return { w, S }
}

/** Una voce composta già misurata nel computo in corso. */
function voce(w: W, S: any, codice: string, prezzo: number, qty: number): string {
  const k = w.nextCustomKey()
  S.custom.set(k, { codice, desc_short: codice, declaratoria: '', um: 'm', prezzo })
  S.qty[k] = { qty, um: 'm', source: 'manual' }
  return k
}
const codici = (S: any): string[] => [...S.custom.values()].map((v: any) => v.codice).sort()
const clicca = (sel: string) => (document.querySelector(sel) as HTMLElement).click()

describe("un computo si importa nella fase che è", () => {
  let w: W, S: any
  beforeEach(async () => {
    ;({ w, S } = await setup())
    w.miuXpwe = {
      parseXpwe: () => ({ datiGenerali: {}, avvisi: [] }),
      xpweToVoci: () => [{ codice: 'E.01', desc_short: 'Scavo esecutivo', um: 'm3', prezzo: 12, qty: 5 }, { codice: 'E.02', desc_short: 'Getto', um: 'm3', prezzo: 90, qty: 2, sicurezza: true }],
    }
  })
  const file = { name: 'esecutivo.xpwe', text: async () => '<xpwe/>' } as unknown as File

  it("si sceglie la fase: un esecutivo entra come esecutivo, senza passare dal PFTE", async () => {
    const p = w.importComputoXpwe(file)
    await new Promise((r) => setTimeout(r, 0))
    expect(document.getElementById('fase-overlay')).not.toBeNull()
    ;(document.querySelector('input[name="imp-fase"][value="esecutivo"]') as HTMLInputElement).checked = true
    clicca('#fase-overlay [data-esito="si"]')
    await p
    expect(S.faseProgetto).toBe('esecutivo')
    expect(codici(S)).toEqual(['E.01', 'E.02'])
    expect(S.revisioni).toHaveLength(0)            // niente revisioni finte del PFTE
    expect(Object.values(S.sicurezza || {})).toContain(true) // la sicurezza viaggia con la voce
  })

  it("se il computo non è vuoto, prima lo si congela e poi lo si sostituisce", async () => {
    voce(w, S, 'P.01', 10, 3)
    const p = w.importComputoXpwe(file)
    await new Promise((r) => setTimeout(r, 0))
    ;(document.querySelector('input[name="imp-fase"][value="definitivo"]') as HTMLInputElement).checked = true
    clicca('#fase-overlay [data-esito="si"]')
    await p
    expect(S.revisioni.map((r: any) => [r.nome, r.fase, r.voci.length])).toEqual([['PFTE', 'PFTE', 1]])
    expect(codici(S)).toEqual(['E.01', 'E.02'])
    expect(S.faseProgetto).toBe('definitivo')
  })

  it('annullando non cambia niente', async () => {
    voce(w, S, 'P.01', 10, 3)
    const p = w.importComputoXpwe(file)
    await new Promise((r) => setTimeout(r, 0))
    clicca('#fase-overlay [data-esito="no"]')
    await p
    expect(codici(S)).toEqual(['P.01'])
    expect(S.faseProgetto).toBe('PFTE')
  })
})

describe('passando di fase si riparte da una revisione', () => {
  it("l'esecutivo riparte dal definitivo congelato, non da quello rimasto sul tavolo", async () => {
    const { w, S } = await setup()
    voce(w, S, 'D.01', 10, 3)
    S.faseProgetto = 'definitivo'
    const def = w.congelaComputoInCorso()
    expect(def.nome).toBe('Definitivo')
    // dopo il congelamento il computo è andato avanti per conto suo
    voce(w, S, 'X.99', 1, 1)
    w.apriCambioFase('esecutivo')
    ;(document.querySelector(`input[name="cf-da"][value="${def.id}"]`) as HTMLInputElement).checked = true
    ;(document.getElementById('cf-congela') as HTMLInputElement).checked = false
    w.applicaCambioFase()
    expect(S.faseProgetto).toBe('esecutivo')
    expect(codici(S)).toEqual(['D.01'])
    expect([...S.custom.values()][0].prezzo).toBe(10)
    expect(Object.values(S.qty).map((q: any) => q.qty)).toEqual([3])
    expect(S.revisioni).toHaveLength(1) // la revisione resta com'era
  })

  it('congelando prima, il computo di adesso non va perso', async () => {
    const { w, S } = await setup()
    voce(w, S, 'A.01', 10, 3)
    w.apriCambioFase('definitivo')
    w.applicaCambioFase()
    expect(S.faseProgetto).toBe('definitivo')
    expect(S.revisioni.map((r: any) => r.nome)).toEqual(['PFTE'])
    expect(codici(S)).toEqual(['A.01']) // «dal computo in corso»: si continua da qui
  })

  it('la fase si rimette a posto anche all\'indietro, se era sbagliata', async () => {
    const { w, S } = await setup()
    S.faseProgetto = 'esecutivo'
    w.apriCambioFase('PFTE')
    w.applicaCambioFase()
    expect(S.faseProgetto).toBe('PFTE')
  })
})

describe('la colonna dei prezzi: progetto e prezzario', () => {
  it('due schede; nel prezzario si cerca e con ＋ la voce entra nel computo', async () => {
    const { w, S } = await setup()
    S.archive.push({ filename: 'veneto.xlsx', regione: 'Veneto', anno: '2026', loaded: true, rows: [
      { codice: 'V.01', desc_short: 'Scavo di sbancamento', declaratoria: 'Scavo di sbancamento in terreno', um: 'm3', prezzo: 8, regione: 'Veneto', anno: '2026' },
      { codice: 'V.02', desc_short: 'Calcestruzzo', declaratoria: 'Calcestruzzo C25/30', um: 'm3', prezzo: 110, regione: 'Veneto', anno: '2026' },
    ] })
    w.setStep('misura')
    expect([...document.querySelectorAll('.ep-scheda')].map((b) => b.textContent?.trim().split(' ')[0])).toEqual(['Progetto', 'Prezzario'])
    w.epScheda('prezzario')
    expect(document.getElementById('ep-pz-q')).not.toBeNull()
    expect(document.querySelector('.ep-scheda.is-on')!.textContent).toContain('Prezzario')
    w.epPzCerca('sbanca')
    await new Promise((r) => setTimeout(r, 200))
    const righe = [...document.querySelectorAll('#ep-pz-righe .ep-row--pz')]
    expect(righe.map((r) => r.querySelector('.ep-code')!.textContent)).toEqual(['V.01'])
    const k = w.rowKey(S.archive[0].rows[0])
    w.epPzAggiungi(k)
    expect([...S.custom.values()].map((v: any) => v.codice)).toContain('V.01')
    // la scheda scelta si ricorda
    expect(w.epFloatState().scheda).toBe('prezzario')
    w.epScheda('progetto')
  })

  it('senza prezzari caricati lo dice, e porta a caricarne uno', async () => {
    const { w } = await setup()
    w.setStep('misura')
    w.epScheda('prezzario')
    expect(document.getElementById('ep-float-body')!.textContent).toContain('Nessun prezzario caricato')
    w.epScheda('progetto')
  })
})

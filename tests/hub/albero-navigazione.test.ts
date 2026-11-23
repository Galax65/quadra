import { describe, it, expect } from 'vitest'
import { parseHubMessage } from '../../src/shared/bus'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { alberoDelComputo, faseRevisioneComputo, idRevisioneComputo, perCapitoliAlbero, tipoRevisioneComputo, TITOLO_RAMO, unisciAlberi, type RamoLavoro } from '../../src/shared/revisioni'

/**
 * L'ALBERO È LA NAVIGAZIONE. Due messaggi la reggono: «vai alla tappa» e «apri
 * questo atto». Erano nel contratto del bus ma non nella lista dei tipi
 * ammessi, così cliccare una revisione lanciava lo strumento e basta: si
 * finiva sempre sulla stessa schermata e sembrava che la sidebar non servisse.
 */
describe('i messaggi di navigazione passano il bus', () => {
  it('«vai a» arriva al tool, ma solo con una fase', () => {
    expect(parseHubMessage({ type: 'hub:vai-a', fase: 'sal-2' })).toEqual({ type: 'hub:vai-a', fase: 'sal-2' })
    expect(parseHubMessage({ type: 'hub:vai-a' })).toBeNull()
    expect(parseHubMessage({ type: 'hub:vai-a', fase: '' })).toBeNull()
  })

  it('«apri documento» vuole la fase E il tipo di atto', () => {
    expect(parseHubMessage({ type: 'hub:apri-documento', fase: 'sal-1', tipo: 'libretto' }))
      .toEqual({ type: 'hub:apri-documento', fase: 'sal-1', tipo: 'libretto' })
    expect(parseHubMessage({ type: 'hub:apri-documento', fase: 'sal-1' })).toBeNull()
    expect(parseHubMessage({ type: 'hub:apri-documento', tipo: 'libretto' })).toBeNull()
  })
})

describe("i capitoli dell'albero", () => {
  const ramo = (fase: string, capitolo: RamoLavoro['capitolo']): RamoLavoro =>
    ({ fase, etichetta: fase, capitolo, tool: 'contabilita', atti: [] })

  it('vanno nell\'ordine in cui il lavoro accade, e i vuoti spariscono', () => {
    const g = perCapitoliAlbero([
      ramo('chiusura', 'chiusura'), ramo('sal-1', 'contabilita'),
      ramo('avvio', 'lavoro'), ramo('contratto', 'computo'),
    ])
    expect(g.map((x) => x.capitolo)).toEqual(['lavoro', 'computo', 'contabilita', 'chiusura'])
    expect(g.map((x) => x.titolo)).toEqual(['Lavoro', 'Computo', 'Contabilità', 'Chiusura'])
    expect(perCapitoliAlbero([ramo('sal-1', 'contabilita')]).map((x) => x.capitolo)).toEqual(['contabilita'])
  })

  it('ogni capitolo ha un titolo, perizie comprese', () => {
    expect(Object.keys(TITOLO_RAMO).sort()).toEqual(['chiusura', 'computo', 'contabilita', 'lavoro', 'perizia'])
  })
})

/**
 * UN ALBERO SOLO PER DUE STRUMENTI (tappa 6 di Docs/06-Interfaccia-unica.md).
 * Il Computo pubblica il progetto (computo in corso e revisioni congelate), la
 * Contabilità il resto; l'hub li unisce. Prima i rami li pubblicava solo la
 * Contabilità, e le revisioni del Computo non comparivano da nessuna parte.
 */
describe("l'albero del Computo", () => {
  const eur = (n: number): string => `€ ${n}`
  const revisioni = [
    { id: 'a', nome: 'PFTE', fase: 'PFTE', data: '10/01/2026', voci: 3, totale: 100 },
    { id: 'b', nome: 'Esecutivo', fase: 'esecutivo', voci: 1, totale: 120 },
  ]

  it('ogni revisione congelata è un ramo, numerato come nella catena, che il Computo apre', () => {
    const { rami } = alberoDelComputo({ voci: 4, totale: 130, revisioni, eur })
    expect(rami.map((r) => [r.fase, r.rev, r.tool, r.stato])).toEqual([
      ['rev-a', 0, 'computo', 'approvata'],
      ['rev-b', 1, 'computo', 'approvata'],
      ['computo', undefined, 'computo', 'bozza'],
    ])
    expect(rami[0].nota).toBe('3 voci')
    expect(rami[1].nota).toBe('1 voce')
    expect(rami[0].atti.map((a) => a.tipo)).toEqual(['elenco', 'confronto', 'quadro', 'scheda'])
    expect(idRevisioneComputo(rami[0].fase)).toBe('a')
    expect(idRevisioneComputo('sal-1')).toBeNull()
    expect(faseRevisioneComputo('x')).toBe('rev-x')
  })

  it('il computo in corso ha le sue schermate di lavoro, e nessuna stampa: si stampa dalla testata', () => {
    const corrente = alberoDelComputo({ voci: 0, totale: 0, revisioni: [], eur }).rami[0]
    expect(corrente.etichetta).toBe('PFTE · in corso')
    expect(corrente.atti.map((a) => a.tipo)).toEqual(['misura', 'ep', 'categorizza', 'dati'])
    expect(corrente.atti.every((a) => a.lavoro)).toBe(true)
  })

  it('si congela una revisione dall\'albero, solo quando c\'è qualcosa da congelare', () => {
    // col computo vuoto non c'è niente da congelare né da promuovere: si può solo chiudere la fase
    expect(alberoDelComputo({ voci: 0, totale: 0, revisioni: [], eur }).azioni.map((a) => a.comando)).toEqual(['importa-xpwe', 'fase-successiva'])
    const az = alberoDelComputo({ voci: 2, totale: 10, revisioni: [], eur }).azioni.find((a) => a.comando === 'nuova-revisione')
    expect(az).toMatchObject({ capitolo: 'computo', tool: 'computo', comando: 'nuova-revisione' })
  })
})

describe("l'hub unisce i rami dei due strumenti", () => {
  const ramo = (fase: string, capitolo: RamoLavoro['capitolo'], tool?: RamoLavoro['tool']): RamoLavoro =>
    ({ fase, etichetta: fase, capitolo, tool: tool as RamoLavoro['tool'], atti: [] })

  it('il progetto viene prima del contratto, qualunque strumento abbia parlato per primo', () => {
    const u = unisciAlberi({
      contabilita: { rami: [ramo('avvio', 'lavoro'), ramo('contratto', 'computo'), ramo('sal-1', 'contabilita')], azioni: [{ capitolo: 'contabilita', etichetta: '＋ SAL', comando: 'nuovo-sal' }] },
      computo: { rami: [ramo('rev-a', 'computo'), ramo('computo', 'computo')], azioni: [{ capitolo: 'computo', etichetta: '＋ Congela', comando: 'nuova-revisione' }] },
    })
    const computo = perCapitoliAlbero(u.rami).find((g) => g.capitolo === 'computo')!
    expect(computo.rami.map((r) => r.fase)).toEqual(['rev-a', 'computo', 'contratto'])
    // chi non dice da che strumento viene, viene da chi l'ha pubblicato
    expect(u.rami.find((r) => r.fase === 'rev-a')!.tool).toBe('computo')
    expect(u.rami.find((r) => r.fase === 'sal-1')!.tool).toBe('contabilita')
    expect(u.azioni.map((a) => a.tool)).toEqual(['computo', 'contabilita'])
  })

  it('i rami e i comandi tornano allo strumento che li ha pubblicati', () => {
    const nav = readFileSync(resolve(__dirname, '../../src/hub/ui/revisioni-nav.js'), 'utf8')
    expect(nav).toContain('unisciAlberi(perTool)')
    expect(nav).toMatch(/comandoAlbero\('\$\{escHtml\(a\.comando\)\}','\$\{escHtml\(a\.tool \|\| 'contabilita'\)\}'\)/)
    const bus = readFileSync(resolve(__dirname, '../../src/hub/ui/bus.js'), 'utf8')
    expect(bus).toContain('setAlberoLavoro(msg.project.albero, msg.project.azioniAlbero, msg.appId)')
    // il Computo pubblica i suoi rami e apre le tappe che tiene
    const computo = readFileSync(resolve(__dirname, '../../src/tools/computo/legacy/computo-overlay.js'), 'utf8')
    expect(computo).toContain('albero:ramo.rami, azioniAlbero:ramo.azioni')
    const idx = readFileSync(resolve(__dirname, '../../src/tools/computo/legacy/index.js'), 'utf8')
    expect(idx).toContain("m.type==='hub:vai-a'")
    expect(idx).toContain("m.type==='hub:apri-documento'")
    expect(idx).toContain("m.comando==='nuova-revisione'")
  })

  it('in home una voce sola, «Lavoro», che carica entrambi gli strumenti', () => {
    const nav = readFileSync(resolve(__dirname, '../../src/hub/ui/navigazione.js'), 'utf8')
    expect(nav).toContain('onclick="apriLavoro()"')
    expect(nav).not.toContain('flow.map(sectionHTML).join(sep)')
    const progetto = readFileSync(resolve(__dirname, '../../src/hub/ui/progetto.js'), 'utf8')
    expect(progetto).toContain('for (const id of ids.slice(1)) await launchApp(id)')
    expect(progetto.match(/azzeraAlbero\(\)/g)?.length).toBe(2)
  })
})

describe('revisioni di progetto e nomi che cambiano (tappa 7)', () => {
  it('il tipo nella catena viene dalla fase memorizzata, non dal nome', () => {
    expect(tipoRevisioneComputo('PFTE', 'Qualunque nome')).toBe('pfte')
    expect(tipoRevisioneComputo('definitivo', 'PFTE rivisto')).toBe('definitivo') // rinominata: non cambia posto
    expect(tipoRevisioneComputo('esecutivo', 'Definitivo bis')).toBe('esecutivo')
    // le revisioni vecchie, senza fase, si leggono ancora dal nome
    expect(tipoRevisioneComputo(undefined, 'Progetto di fattibilità')).toBe('pfte')
    expect(tipoRevisioneComputo('', 'Definitivo')).toBe('definitivo')
  })

  it("una revisione di progetto è un ramo con la sua scheda, e dice su quale computo poggia", () => {
    const { rami } = alberoDelComputo({ voci: 1, totale: 10, eur: (n) => `€ ${n}`, revisioni: [
      { id: 'c', nome: 'Esecutivo', fase: 'esecutivo', voci: 4, totale: 100, articoli: 3 },
      { id: 'p', nome: 'Tavole aggiornate', fase: 'esecutivo', voci: 0, totale: 100, natura: 'progetto', computoDi: 'c' },
      { id: 'q', nome: 'Relazione', fase: 'PFTE', voci: 0, totale: 0, natura: 'progetto' },
    ] })
    expect(rami[0].nota).toBe('4 voci · 3 prezzi')
    expect(rami[1].nota).toBe('revisione di progetto')
    expect(rami[1].stati).toEqual([{ etichetta: 'Computo', valore: 'invariato (rev.00)' }])
    expect(rami[1].leggeDa).toBeUndefined() // lo dice già la riga di stato: niente doppione
    expect(rami[1].atti.map((a) => a.tipo)).toEqual(['scheda', 'confronto'])
    // senza computo su cui poggiare non c'è niente da confrontare
    expect(rami[2].atti.map((a) => a.tipo)).toEqual(['scheda'])
    expect(rami[2].stati![0].valore).toBe('non congelato')
  })
})

describe('le fasi del progetto e il contratto, nell\'albero (tappa 8)', () => {
  const eur = (n: number): string => `€ ${n}`
  it('il computo in corso porta il nome della sua fase, e la fase si chiude dall\'albero', () => {
    const def = alberoDelComputo({ voci: 3, totale: 30, revisioni: [], eur, fase: 'definitivo' })
    expect(def.rami.at(-1)!.etichetta).toBe('Definitivo · in corso')
    expect(def.azioni.map((a) => [a.comando, a.etichetta])).toEqual([
      ['importa-xpwe', '⇩ Importa un computo…'],
      ['nuova-revisione', '＋ Congela una revisione'],
      ['fase-successiva', "⇥ Passa all'esecutivo…"],
      ['promuovi-contratto', '→ Promuovi a contratto'],
    ])
    // dopo l'esecutivo non c'è un'altra fase: c'è il contratto
    const es = alberoDelComputo({ voci: 3, totale: 30, revisioni: [], eur, fase: 'esecutivo' })
    expect(es.azioni.map((a) => a.comando)).toEqual(['importa-xpwe', 'nuova-revisione', 'promuovi-contratto'])
  })
  it('si promuove anche a computo vuoto, se c\'è una revisione di computo da cui partire', () => {
    const a = alberoDelComputo({ voci: 0, totale: 0, eur, fase: 'esecutivo', revisioni: [{ id: 'x', nome: 'Esecutivo', voci: 4, totale: 100 }] })
    expect(a.azioni.map((x) => x.comando)).toContain('promuovi-contratto')
  })
  it('promosso, il ramo dice da dove viene il contratto e l\'azione diventa «rifai»', () => {
    const a = alberoDelComputo({ voci: 3, totale: 30, revisioni: [], eur, fase: 'esecutivo', contratto: { descrizione: 'rev.01 Esecutivo · ribasso 12%', importo: 26 } })
    expect(a.rami.at(-1)!.stati).toContainEqual({ etichetta: 'Contratto da', valore: 'rev.01 Esecutivo · ribasso 12%' })
    expect(a.azioni.find((x) => x.comando === 'promuovi-contratto')!.etichetta).toBe('→ Rifai la promozione a contratto')
  })
})

describe("dall'albero si arriva dove si clicca", () => {
  it('lo strumento che tiene la tappa viene portato davanti, anche se era già caricato', () => {
    const nav = readFileSync(resolve(__dirname, '../../src/hub/ui/revisioni-nav.js'), 'utf8')
    const alTool = nav.slice(nav.indexOf('function alTool('), nav.indexOf('function alTool(') + 600)
    // prima: «if (!gia) launchApp» — al riquadro nascosto arrivava il comando, e non si vedeva niente
    expect(alTool).not.toMatch(/if \(!gia\) window\.launchApp/)
    expect(alTool).toContain('window.launchApp?.(tool);')
  })
  it("un computo si importa nel Computo (che chiede la fase), il contratto nella Contabilità", () => {
    const imp = alberoDelComputo({ voci: 0, totale: 0, revisioni: [], eur: String }).azioni.find((a) => a.comando === 'importa-xpwe')!
    expect(imp).toMatchObject({ capitolo: 'computo', tool: 'computo' })
    const idx = readFileSync(resolve(__dirname, '../../src/tools/computo/legacy/index.js'), 'utf8')
    expect(idx).toContain("m.comando==='importa-xpwe') chiediFileXpwe()")
    const cont = readFileSync(resolve(__dirname, '../../src/tools/contabilita/main.ts'), 'utf8')
    expect(cont).toContain("capitolo: 'contabilita', etichetta: '⇩ Importa il contratto…', comando: 'importa-computo'")
    expect(cont).not.toContain("capitolo: 'computo', etichetta: '↧ Importa un computo'")
  })
})

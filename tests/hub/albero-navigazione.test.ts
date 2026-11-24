import { describe, it, expect } from 'vitest'
import { parseHubMessage } from '../../src/shared/bus'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { perCapitoliAlbero, TITOLO_RAMO, unisciAlberi, type RamoLavoro } from '../../src/shared/revisioni'

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

describe("dall'albero si arriva dove si clicca", () => {
  it('lo strumento che tiene la tappa viene portato davanti, anche se era già caricato', () => {
    const nav = readFileSync(resolve(__dirname, '../../src/hub/ui/revisioni-nav.js'), 'utf8')
    const alTool = nav.slice(nav.indexOf('function alTool('), nav.indexOf('function alTool(') + 600)
    // prima: «if (!gia) launchApp» — al riquadro nascosto arrivava il comando, e non si vedeva niente
    expect(alTool).not.toMatch(/if \(!gia\) window\.launchApp/)
    expect(alTool).toContain('window.launchApp?.(tool);')
  })

})

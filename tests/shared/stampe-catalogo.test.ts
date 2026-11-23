import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { stampeDelComputo, stampeDellaContabilita, stampeHTML, AREE } from '../../src/shared/stampe/catalogo'

/**
 * LE STAMPE DEL LAVORO sono un elenco solo. Chi firma le carte non pensa «quelle
 * del Computo» e «quelle della Contabilità»: pensa alle carte del lavoro. Il
 * catalogo sta nel layer condiviso, i comandi restano negli strumenti.
 */
describe('catalogo delle stampe', () => {
  it('il Computo porta progetto, gara e interscambio', () => {
    const v = stampeDelComputo({ vociNelComputo: 10, conAnalisi: true })
    expect(v.every((x) => x.tool === 'computo')).toBe(true)
    expect([...new Set(v.map((x) => x.area))].sort()).toEqual(['dati', 'gara', 'progetto'])
    expect(v.map((x) => x.id)).toContain('computo-pdf')
    expect(v.map((x) => x.id)).toContain('lista-lavorazioni')
    expect(v.every((x) => x.pronta)).toBe(true)
  })

  it('col computo vuoto le stampe restano in elenco, ma spente e con il motivo', () => {
    const v = stampeDelComputo({ vociNelComputo: 0 })
    const computo = v.find((x) => x.id === 'computo-pdf')!
    expect(computo.pronta).toBe(false)
    expect(computo.motivo).toContain('vuoto')
    // il quadro economico e le offerte si aprono comunque: sono schermate di lavoro
    expect(v.find((x) => x.id === 'quadro-economico')!.pronta).toBe(true)
  })

  it('la Contabilità genera un fascicolo per ogni SAL, col suo stato', () => {
    const v = stampeDellaContabilita({
      sals: [{ numero: 1, firmato: true }, { numero: 2 }], conPartite: true, conPerizie: true,
      prodotte: { 'atti-1': { data: '05/06/2026', impronta: 'ab'.repeat(32) } },
    })
    const uno = v.find((x) => x.id === 'atti-1')!
    expect(uno.titolo).toBe('Atti del SAL n. 1')
    expect(uno.nota).toContain('firmato')
    expect(uno.prodottaIl).toBe('05/06/2026')
    expect(v.find((x) => x.id === 'atti-2')!.prodottaIl).toBeUndefined()
    expect(v.map((x) => x.id)).toContain('perizie')
    expect(v.map((x) => x.id)).toContain('registro-atti')
    expect(v.map((x) => x.id)).toContain('export-aperto')
  })

  it('senza SAL lo dice, invece di non mostrare nulla', () => {
    const v = stampeDellaContabilita({ sals: [], conPartite: false, conPerizie: false })
    const atti = v.find((x) => x.id === 'atti-0')!
    expect(atti.pronta).toBe(false)
    expect(atti.motivo).toContain('nessun SAL')
    expect(v.find((x) => x.id === 'perizie')).toBeUndefined()
  })
})

describe('la griglia', () => {
  const tutte = () => [...stampeDelComputo({ vociNelComputo: 0 }), ...stampeDellaContabilita({ sals: [{ numero: 1 }], conPartite: true, conPerizie: false })]

  it('raggruppa per area e salta i gruppi vuoti', () => {
    const html = stampeHTML(stampeDelComputo({ vociNelComputo: 5 }).filter((v) => v.area === 'progetto'), { tool: 'computo' })
    expect(html).toContain('Progetto')
    expect(html).not.toContain('Contabilità')
    expect(AREE.map((a) => a.id)).toEqual(['progetto', 'gara', 'contabilita', 'dati'])
  })

  it('le stampe dello strumento aperto chiamano il loro comando', () => {
    const html = stampeHTML(tutte(), { tool: 'contabilita', vaiAllAltro: "vai('%s')" })
    expect(html).toContain('onclick="stampaAttiSal(1)"')
  })

  it('quelle dell\'altro strumento ci portano, e non si spengono mai', () => {
    const html = stampeHTML(tutte(), { tool: 'contabilita', vaiAllAltro: "vai('%s')" })
    expect(html).toContain("onclick=\"vai('computo-pdf')\"")   // computo vuoto, ma apribile di là
    expect(html).toContain('in Computo')
    // spenta solo una stampa del PROPRIO strumento che non si può produrre
    const soloMie = stampeHTML(stampeDelComputo({ vociNelComputo: 0 }), { tool: 'computo' })
    expect(soloMie).toContain('is-vuota')
  })

  it('mostra quando un atto è già stato prodotto e con quale impronta', () => {
    const html = stampeHTML(stampeDellaContabilita({
      sals: [{ numero: 1, firmato: true }], conPartite: true, conPerizie: false,
      prodotte: { 'atti-1': { data: '05/06/2026', impronta: 'deadbeef' + '0'.repeat(56) } },
    }), { tool: 'contabilita' })
    expect(html).toContain('prodotto il 05/06/2026')
    expect(html).toContain('deadbeef…')
  })
})

/**
 * UN SOLO PULSANTE, SEMPRE LÌ. Le stampe non sono una fase del lavoro: non si
 * «arriva» alle stampe dopo aver computato. Si stampa quando serve, da dove si
 * è, e il pulsante si chiama allo stesso modo nei due strumenti.
 */
describe('il pulsante delle stampe', () => {
  const leggi = (p: string): string => readFileSync(resolve(__dirname, '../..', p), 'utf8')

  it('esiste UNA VOLTA SOLA per schermata, mai due elenchi per la stessa operazione', () => {
    expect((leggi('src/tools/contabilita/index.html').match(/apriStampe\(\)/g) || []).length).toBe(0)
    /* Anche il Computo non ne ha più in pagina: la cricca è arrivata a zero.
       Il comando sta nella testata di fase, come nella Contabilità. */
    expect((leggi('src/tools/computo/index.html').match(/apriStampe\(\)/g) || []).length).toBe(0)
    expect(leggi('src/tools/computo/legacy/computo-overlay.js')).toContain("stampa: { onclick:'apriStampe()'")
    // nella Contabilità il comando vive nella TESTATA DI FASE, insieme al nome
    // della fase e al suo stato: si stampa da dove si è, non tornando indietro.
    const m = leggi('src/tools/contabilita/main.ts')
    expect(m).toContain("stampa: { onclick: 'apriStampaAtto()' }")
    // l'etichetta è una sola, scritta nella testata condivisa
    expect(leggi('src/shared/griglia/testata.ts')).toContain('⎙ Stampa…')
    expect(m).toContain("onclick=\"apriStampe()\"")
  })

  it("l'elenco prezzi nella Contabilità è una colonna, non un pulsante che apre una finestra", () => {
    const h = leggi('src/tools/contabilita/index.html')
    expect(h).toContain('id="bDrawer"')
    expect(h).not.toContain('id="btnElencoPrezzi"')
    // e si apre da solo dove si lavora con le voci
    expect(leggi('src/tools/contabilita/main.ts')).toContain("apriCassetto(ctx, 'contratto')")
  })

  it("nel Computo l'elenco prezzi del progetto si apre dal binario, non da un pulsante in testata", () => {
    const h = leggi('src/tools/computo/index.html')
    const testata = h.match(/<div class="ehb-hdr__actions">[\s\S]*?<\/div>/)?.[0] ?? ''
    expect(testata).not.toContain('id="btnElencoPrezzi"')
    const rail = h.match(/<nav id="miu-rail"[\s\S]*?<\/nav>/)?.[0] ?? ''
    expect(rail).toContain('onclick="apriElencoPrezzi()"')
  })

  it('nel Computo le stampe sono uscite dal binario delle fasi', () => {
    const h = leggi('src/tools/computo/index.html')
    expect(h).not.toContain("setStep('esporta')")
    expect(leggi('src/tools/computo/legacy/index.js')).toContain("const MIU_STEPS = ['cerca','misura','categorizza']")
  })
})

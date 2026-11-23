/**
 * UNA SOLA SCHERMATA DI STAMPE. Le carte di un lavoro sono un elenco solo —
 * progetto, gara, contabilità, interscambio — e si vedono tutte da tutti e due
 * gli strumenti. Quelle dell'altro strumento portano lì con la stampa già
 * scelta: per questo ogni riga porta il proprio id.
 */
import { describe, it, expect } from 'vitest'
import { stampeDelComputo, stampeDellaContabilita, stampeHTML, AREE } from '../../src/shared/stampe/catalogo'

const tutte = (vociNelComputo = 120): ReturnType<typeof stampeDelComputo> => [
  ...stampeDelComputo({ vociNelComputo }),
  ...stampeDellaContabilita({ sals: [{ numero: 1, firmato: true }, { numero: 2 }], conPartite: true, conPerizie: true }),
]

describe('la schermata delle stampe', () => {
  it('raccoglie le quattro aree del lavoro, da entrambi gli strumenti', () => {
    const v = tutte()
    for (const a of AREE) expect(v.some((x) => x.area === a.id), a.id).toBe(true)
    expect(v.some((x) => x.tool === 'computo')).toBe(true)
    expect(v.some((x) => x.tool === 'contabilita')).toBe(true)
  })
  it('ogni stampa porta il suo id, così chi arriva dall\'altro strumento la ritrova', () => {
    const html = stampeHTML(tutte(), { tool: 'contabilita', vaiAllAltro: "vaiAlComputo('%s')" })
    for (const v of tutte()) expect(html).toContain(`data-stampa="${v.id}"`)
  })
  it('le stampe dell\'altro strumento si aprono di là, con il loro id', () => {
    const html = stampeHTML(tutte(), { tool: 'contabilita', vaiAllAltro: "vaiAlComputo('%s')" })
    expect(html).toContain("vaiAlComputo(&quot;computo-pdf&quot;)".replace(/&quot;/g, "'"))
    expect(html).toContain('is-altrove')
  })
  it('dal Computo si vedono gli atti del SAL, con il loro numero', () => {
    const html = stampeHTML(tutte(), { tool: 'computo', vaiAllAltro: "vaiAllaContabilita('%s')" })
    expect(html).toContain('Atti del SAL n. 1')
    expect(html).toContain('Atti del SAL n. 2')
    expect(html).toContain("vaiAllaContabilita('atti-1')")
  })
  it('con il computo vuoto le sue stampe ci sono, e dicono perché non si possono fare', () => {
    const v = stampeDelComputo({ vociNelComputo: 0 })
    expect(v.length).toBeGreaterThan(5)
    expect(v.filter((x) => x.pronta === false).length).toBeGreaterThan(0)
    expect(stampeHTML(v, { tool: 'computo' })).toContain('is-vuota')
  })
})

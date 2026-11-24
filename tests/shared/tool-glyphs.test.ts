import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  TOOL_GLYPH_PATHS, TOOL_GLYPH_VIEWBOX, TOOL_GLYPH_KEY,
  toolGlyphSvg, toolGlyphSvgById,
} from '../../src/shared/ui/glyphs'
import { renderDocPage } from '../../src/shared/doc'
import { hubSource } from '../hub/hub-src'

/**
 * GOLDEN SET delle icone dei tool, VETTORIALI: squadra graduata = Computo,
 * registro = Contabilità, cursori = Amministrazione. Non sono caratteri di font
 * (che cadevano su un ripiego diverso per ogni sistema) ma path SVG: coerenti
 * ovunque. I tool della suite sono TRE: nessuna icona per tool che non esistono.
 */

const SRC = resolve(__dirname, '../..')

describe('path delle icone dei tool', () => {
  it('espone i tre tool con path non vuoti e viewBox condiviso', () => {
    for (const k of ['computo', 'amministrazione', 'contabilita'] as const) {
      expect(TOOL_GLYPH_PATHS[k]).toMatch(/^M[\d.]/)
      expect(TOOL_GLYPH_PATHS[k].length).toBeGreaterThan(30)
    }
    // gabbia em condivisa → glifi mutuamente coerenti
    expect(TOOL_GLYPH_VIEWBOX).toBe('0 -800 600 1000')
  })

  it('mappa i tool-id della suite (miu→mu…) alla chiave giusta', () => {
    expect(TOOL_GLYPH_KEY.miu).toBe('computo')
    expect(TOOL_GLYPH_KEY.contabilita).toBe('contabilita')
    expect(TOOL_GLYPH_KEY.amministrazione).toBe('amministrazione')
    // i tool ereditati e rimossi non hanno più un'icona
    expect(TOOL_GLYPH_KEY.delta).toBeUndefined()
    expect(TOOL_GLYPH_KEY.chi).toBeUndefined()
  })
})

describe('helper SVG', () => {
  it('toolGlyphSvg produce un <svg> con path a currentColor', () => {
    const svg = toolGlyphSvg('computo')
    expect(svg).toContain('<svg')
    expect(svg).toContain('ehb-glyph-svg')
    expect(svg).toContain(`viewBox="${TOOL_GLYPH_VIEWBOX}"`)
    expect(svg).toContain('fill="currentColor"')
    expect(svg).toContain(TOOL_GLYPH_PATHS.computo)
  })

  it('toolGlyphSvgById risolve i tool noti e restituisce \'\' per gli ignoti', () => {
    expect(toolGlyphSvgById('computo')).toContain(TOOL_GLYPH_PATHS.computo)
    expect(toolGlyphSvgById('hub')).toBe('')
    expect(toolGlyphSvgById('boh')).toBe('')
  })
})

describe('l\'hub monta i glifi vettoriali (non più caratteri)', () => {
  const mainJs = hubSource()
  const componentsCss = readFileSync(resolve(SRC, 'src/shared/ui/components.css'), 'utf8')

  it('logoHTML usa toolGlyphSvgById', () => {
    expect(mainJs).toMatch(/toolGlyphSvgById\(m\.tool\)/)
  })
  it('la CSS dimensiona il glifo SVG su --logo-size', () => {
    expect(componentsCss).toMatch(/\.ehb-logo__glyph svg\s*\{[\s\S]*var\(--logo-size\)/)
  })
})

describe('gli header dei tool usano lo STESSO path (guardia non-divergenza)', () => {
  const cases: [string, keyof typeof TOOL_GLYPH_PATHS][] = [
    ['amministrazione', 'amministrazione'],
  ]
  it.each(cases)('src/tools/%s/index.html: logo E nome col path canonico, niente greco nudo', (tool, key) => {
    const html = readFileSync(resolve(SRC, `src/tools/${tool}/index.html`), 'utf8')
    // il logo dell'header usa il path canonico (il nome è testo semplice in Quadra)
    const occ = html.split(TOOL_GLYPH_PATHS[key]).length - 1
    expect(occ).toBeGreaterThanOrEqual(1)
    // il glifo non è più il carattere greco nudo, né nel logo né nel nome brand
    expect(html).not.toMatch(/ehb-logo__glyph">[φπμλτ]</)
    expect(html).not.toMatch(/ehb-hdr__brand-name">[φπμλτ] /)
  })
})

describe('i nomi dei tool sono testo, e coerenza nei DOCUMENTI (PDF)', () => {
  it('l\'hub scrive il nome del tool come testo, senza vettorializzare lettere', () => {
    const mainJs = hubSource()
    expect(mainJs).not.toMatch(/nameWithGlyph/)
    expect(mainJs).toMatch(/nav-name">\$\{escHtml\(app\.name\)\}/)
  })

  it('il documento (renderDocPage) usa il cartiglio GOLDEN STANDARD: brand Quadra + tag testo, niente chip/glifo', () => {
    const page = renderDocPage({
      tool: 'computo', kicker: 'k', title: 't',
      bodyHTML: '<p>x</p>',
      footer: { fields: [], disc: 'd' },
    })
    expect(page).toContain('ehub-brand')                    // brand Quadra, header e footer (come piCartiglioHTML)
    expect(page).toContain('>Computo<')                        // nome tool in chiaro, niente carattere greco nudo
    expect(page).not.toMatch(/class="glyph">μ</)
    expect(page).not.toContain('dochead__tool"><span class="glyph"')  // niente più chip/glifo su sfondo pieno
  })
})

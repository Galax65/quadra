import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { hubSource } from './hub-src'

/**
 * LA SIDEBAR SI CHIUDE SOLO SE GLIELO SI CHIEDE.
 *
 * Prima un clic su una zona «morta» la collassava. Con l'albero del lavoro
 * dentro, le zone morte sono i titoli dei capitoli e le righe di stato: si
 * cercava di leggere a che prezzi lavora un SAL e la sidebar si chiudeva in
 * faccia. Ora restano il suo pulsante e il tasto B.
 */
const SRC = resolve(__dirname, '../..')
const mainJs = hubSource()
const html = readFileSync(resolve(SRC, 'src/hub/index.html'), 'utf8')
const css = readFileSync(resolve(SRC, 'src/hub/styles/hub.css'), 'utf8')

describe('la sidebar non si collassa da sola', () => {
  it('nessun listener di click su #sidebar che la collassi', () => {
    expect(mainJs).not.toMatch(/getElementById\('sidebar'\)[\s\S]{0,160}addEventListener\('click'/)
  })

  it('restano i due modi espliciti: il pulsante e il tasto B', () => {
    expect(html).toContain('onclick="toggleSidebar()"')
    expect(hubSource()).toMatch(/toggleSidebar/)
  })

  it("niente cursore a mano sull'intera sidebar: non è tutta un pulsante", () => {
    expect(css).not.toMatch(/#sidebar\{[^}]*cursor:pointer/)
  })
})

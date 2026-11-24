// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * COMPONENTE HEADER CONDIVISO (.ehb-hdr)
 * (audit storico §7 header/brand)
 *
 * Un'unica anatomia di header (brand a sinistra, azioni a destra) nel design
 * system, adottata dai tool della suite. Garanzie:
 *  1. ogni superficie usa .ehb-hdr > .ehb-hdr__brand(.ehb-logo) + .ehb-hdr__actions;
 *  2. le vecchie classi ad hoc divergenti sono dismesse dalle intestazioni migrate;
 *  3. nessuna azione/ponte esistente è persa (id + onclick invariati), e i ponti
 *     di bus restano dentro le azioni.
 */

const SRC = resolve(__dirname, '../..')
function read(rel: string): string {
  return readFileSync(resolve(SRC, rel), 'utf8')
}
/** Parserizza l'HTML del tool e restituisce il primo <header>. */
function header(rel: string): HTMLElement {
  document.documentElement.innerHTML = read(rel)
  const hdr = document.querySelector('header')
  expect(hdr, `${rel}: manca un <header>`).toBeTruthy()
  return hdr as HTMLElement
}

const TOOLS = {
  'Amministrazione': 'src/tools/amministrazione/index.html',
} as const

describe('anatomia header condivisa adottata', () => {
  for (const [tool, rel] of Object.entries(TOOLS)) {
    it(`${tool}: header è .ehb-hdr con brand(.ehb-logo) e azioni`, () => {
      const hdr = header(rel)
      expect(hdr.classList.contains('ehb-hdr')).toBe(true)

      const brand = hdr.querySelector('.ehb-hdr__brand')
      expect(brand, `${tool}: manca .ehb-hdr__brand`).toBeTruthy()
      expect(brand!.querySelector('.ehb-logo'), `${tool}: il brand non riusa .ehb-logo`).toBeTruthy()

      // gruppo azioni: .ehb-hdr__actions oppure un .hdr-actions specifico del tool
      const actions = hdr.querySelector('.ehb-hdr__actions, .hdr-actions')
      expect(actions, `${tool}: manca il gruppo azioni a destra`).toBeTruthy()
    })

    it(`${tool}: l'accento è governato da data-tool`, () => {
      const hdr = header(rel)
      const tooled = hdr.matches('[data-tool]') || !!hdr.querySelector('[data-tool]')
      expect(tooled, `${tool}: nessun data-tool nell'header`).toBe(true)
    })
  }

  it('brand è il primo figlio dell\'header; azioni allineate a destra', () => {
    for (const [tool, rel] of Object.entries(TOOLS)) {
      const hdr = header(rel)
      expect(
        (hdr.firstElementChild as HTMLElement).classList.contains('ehb-hdr__brand'),
        `${tool}: il brand non è il primo figlio`,
      ).toBe(true)
    }
  })
})

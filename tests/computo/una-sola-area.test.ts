import { describe, it, expect } from 'vitest'
import fs from 'node:fs'

/**
 * UNA SOLA AREA ALLA VOLTA. Computo, Elenco prezzi, Stampe e Compositore sono
 * quattro schermate intere montate allo stesso livello: se due restano aperte
 * insieme vince quella montata per ultima e il pulsante dell'altra sembra
 * morto. È successo davvero — «Stampe» non rispondeva più mentre si lavorava
 * al computo, e la stampa chiesta dalla Contabilità veniva sepolta dal computo
 * appena il progetto si ricaricava. Questo test presidia l'invariante nel
 * sorgente, dove il difetto è nato.
 */
const src = fs.readFileSync('src/tools/computo/legacy/index.js', 'utf8')

describe('le schermate intere si escludono', () => {
  it("c'è una sola funzione che spegne le aree, con l'elenco completo", () => {
    expect(src).toContain('const AREE_PIENE =')
    for (const id of ['cart-overlay', 'ep-overlay', 'export-overlay', 'componi-overlay']) {
      expect(src).toContain(`'${id}'`)
    }
    expect(src).toContain('function chiudiAree(')
  })
  it('ogni ingresso la chiama prima di aprirsi', () => {
    for (const [fn, area] of [['setStep', 'cart-overlay'], ['apriStampe', 'export-overlay'], ['apriElencoPrezzi', 'ep-overlay']] as const) {
      const corpo = src.slice(src.indexOf(`function ${fn}(`), src.indexOf(`function ${fn}(`) + 400)
      expect(corpo, fn).toContain('chiudiAree(')
      if (fn !== 'setStep') expect(corpo, fn).toContain(area)
    }
  })
  it('la stampa chiesta dall\'altro strumento sopravvive al ripristino del progetto', () => {
    expect(src).toContain('_attesaDaAltrove')
    expect(src).toContain('function applicaAttesa(')
    // e il ripristino la riapplica
    const restore = src.slice(src.indexOf("m.type==='hub:restore-state'"), src.indexOf("m.type==='hub:restore-state'") + 320)
    expect(restore).toContain('applicaAttesa')
  })
})

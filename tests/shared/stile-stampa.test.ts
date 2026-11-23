/**
 * Le impostazioni di stampa non toccano i generatori degli atti: diventano un
 * foglio di stile sovrapposto al documento già prodotto. Così ogni atto le
 * rispetta, anche quelli che verranno, e un margine non può cambiare un importo.
 */
import { describe, it, expect } from 'vitest'
import { applicaStileStampa, stileStampaCSS, STILE_STAMPA_DEFAULT } from '../../src/shared/doc/stile-stampa'

const pagina = '<!doctype html><html><head><title>x</title></head><body><p>atto</p></body></html>'

describe('impostazioni di stampa', () => {
  it('senza impostazioni il documento resta quello', () => {
    expect(applicaStileStampa(pagina, undefined)).toBe(pagina)
  })
  it('formato, orientamento e margini finiscono nella regola di pagina', () => {
    const css = stileStampaCSS({ formato: 'A3', orientamento: 'orizzontale', margini: { sopra: 20, destra: 25, sotto: 18, sinistra: 30 } })
    expect(css).toContain('size:A3 landscape')
    expect(css).toContain('margin:20mm 25mm 18mm 30mm')
  })
  it('il corpo del testo scala anche le tabelle', () => {
    const css = stileStampaCSS({ corpo: 12 })
    expect(css).toContain('font-size:12pt')
    expect(css).toContain('11.04pt')
  })
  it('testata e cartiglio si possono togliere, per la carta intestata', () => {
    expect(stileStampaCSS({ intestazione: false })).toContain('.dochead')
    expect(stileStampaCSS({ piede: false })).toContain('.docfoot')
    expect(stileStampaCSS({ corpo: 10 })).not.toContain('display:none')
  })
  it('il foglio di stile entra nella testata del documento, senza toccarne il corpo', () => {
    const out = applicaStileStampa(pagina, { corpo: 11 })
    expect(out).toContain('<style id="stile-stampa">')
    expect(out.indexOf('stile-stampa')).toBeLessThan(out.indexOf('<body>'))
    expect(out).toContain('<p>atto</p>')
  })
  it('i valori predefiniti sono quelli di un atto su A4', () => {
    expect(STILE_STAMPA_DEFAULT.formato).toBe('A4')
    expect(STILE_STAMPA_DEFAULT.margini.sopra).toBe(15)
    expect(STILE_STAMPA_DEFAULT.margini.sinistra).toBe(20) // il lato che si rilega
  })
})

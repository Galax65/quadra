import { describe, it, expect } from 'vitest'
import { statoRiserva, riserveRegistroHTML, firmaEsecutoreNota, riserveAperte, importoRiserveAperte, GIORNI_ESPLICITAZIONE } from '../../src/tools/contabilita/engine/riserve'
import type { Riserva, Sal } from '../../src/tools/contabilita/engine/types'

/**
 * Le riserve si perdono sui termini. Il programma deve saper dire, a una data
 * data, se una riserva è ancora in tempo — e non deve inventare una scadenza
 * quando la data di iscrizione manca.
 */
const r = (x: Partial<Riserva>): Riserva => ({ numero: 1, oggetto: 'Maggiori oneri', ...x })

describe('termini della riserva (art. 7 All. II.14)', () => {
  it('iscritta oggi: quindici giorni per esplicitarla', () => {
    const st = statoRiserva(r({ data: '01/06/2026' }), '2026-06-01')
    expect(st.stato).toBe('daEsplicitare')
    expect(st.scadenza).toBe('16/06/2026')
    expect(st.giorniResidui).toBe(GIORNI_ESPLICITAZIONE)
  })
  it('a cinque giorni dal termine segnala la scadenza imminente', () => {
    expect(statoRiserva(r({ data: '01/06/2026' }), '2026-06-12').stato).toBe('inScadenza')
  })
  it('oltre il termine, senza esplicitazione, il termine è scaduto', () => {
    const st = statoRiserva(r({ data: '01/06/2026' }), '2026-06-20')
    expect(st.stato).toBe('decaduta')
    expect(st.nota).toContain('scaduto')
  })
  it('esplicitata nei termini: in regola', () => {
    const st = statoRiserva(r({ data: '01/06/2026', dataEsplicitazione: '10/06/2026', importo: 12000 }), '2026-07-01')
    expect(st.stato).toBe('esplicitata')
    expect(st.nota).toContain('9 giorni')
  })
  it('esplicitata in ritardo: lo dice, non lo nasconde', () => {
    const st = statoRiserva(r({ data: '01/06/2026', dataEsplicitazione: '30/06/2026' }), '2026-07-01')
    expect(st.stato).toBe('decaduta')
    expect(st.nota).toContain('decadenza')
  })
  it('senza data di iscrizione non calcola nessuna scadenza', () => {
    const st = statoRiserva(r({}), '2026-06-01')
    expect(st.giorniResidui).toBeNull()
    expect(st.nota).toContain('non è calcolabile')
    expect(st.scadenza).toBe('')
  })
  it('definita in corso d\'opera o rinunciata: fuori dai termini', () => {
    expect(statoRiserva(r({ data: '01/06/2026', esito: 'definita', notaEsito: 'accordo bonario' }), '2026-12-01').stato).toBe('definita')
    expect(statoRiserva(r({ data: '01/06/2026', esito: 'rinunciata' }), '2026-12-01').stato).toBe('rinunciata')
  })
})

describe('riserve aperte', () => {
  const lista = [r({ numero: 1, importo: 10000 }), r({ numero: 2, importo: 5000, esito: 'definita' }), r({ numero: 3, importo: null })]
  it('conta solo quelle non definite né rinunciate', () => {
    expect(riserveAperte(lista).map((x) => x.numero)).toEqual([1, 3])
  })
  it('somma solo le pretese quantificate', () => {
    expect(importoRiserveAperte(lista)).toBe(10000)
  })
})

describe('la sezione riserve del registro', () => {
  it('senza riserve dichiara la decadenza e i termini, non tace', () => {
    const html = riserveRegistroHTML([])
    expect(html).toContain('non risultano riserve iscritte')
    expect(html).toContain('a pena di decadenza')
    expect(html).toContain('conto finale')
  })
  it('stampa iscrizione, domande dell\'esecutore e deduzioni del DL', () => {
    const html = riserveRegistroHTML([r({ data: '01/06/2026', salNumero: 1, attoIscrizione: 'Registro al SAL n. 1', esplicitazione: 'maggiori oneri per sospensione', controdeduzioni: 'non riconosciuta: la sospensione era prevista', importo: 12000, dataEsplicitazione: '10/06/2026' })], '2026-07-01')
    expect(html).toContain('Registro al SAL n. 1')
    expect(html).toContain('maggiori oneri per sospensione')
    expect(html).toContain('Deduzioni motivate del DL')
    expect(html).toContain('12.000,00')
  })
  it('una pretesa non quantificata si legge come tale', () => {
    expect(riserveRegistroHTML([r({ data: '01/06/2026', importo: null })])).toContain('non quantificata')
  })
})

describe('firma dell\'esecutore sul registro', () => {
  const sal = (x: Partial<Sal>): Sal => ({ numero: 1, righe: [], ...x })
  it('non sottoposto: il registro non dice nulla sulla firma', () => {
    expect(firmaEsecutoreNota(sal({}))).toBe('')
  })
  it('firma con riserva: indica il termine di quindici giorni, con la data', () => {
    const t = firmaEsecutoreNota(sal({ firmaEsecutore: 'conRiserva', dataFirmaEsecutore: '01/06/2026' }))
    expect(t).toContain('CON RISERVA')
    expect(t).toContain('16/06/2026')
  })
  it('rifiuto di firma: verbale e comunicazione immediata alla stazione appaltante', () => {
    const t = firmaEsecutoreNota(sal({ firmaEsecutore: 'rifiutata', dataFirmaEsecutore: '01/06/2026' }))
    expect(t).toContain('RIFIUTATO')
    expect(t).toContain('verbale')
    expect(t).toContain('immediata comunicazione')
  })
  it('firma senza riserve: accettazione del credito progressivo', () => {
    expect(firmaEsecutoreNota(sal({ firmaEsecutore: 'senzaRiserve' }))).toContain('senza riserve')
  })
})

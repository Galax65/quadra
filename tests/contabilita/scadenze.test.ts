import { describe, it, expect } from 'vitest'
import { scadenze, scadenzeUrgenti, scadenziarioHTML, GIORNI_CERTIFICATO, GIORNI_PAGAMENTO } from '../../src/tools/contabilita/engine/scadenze'
import type { Appalto, Sal, Riserva } from '../../src/tools/contabilita/engine/types'

/**
 * I termini di legge sono la parte della contabilità che costa di più quando
 * si sbaglia, e nessuno li ricalcola a mano senza errori. Il programma li legge
 * dagli atti; dove la data di partenza manca, lo dice invece di presumerla.
 */
const appalto = (x: Partial<Appalto> = {}): Appalto => ({
  oggetto: 'Lavori', ente: { denominazione: 'Comune' }, impresa: { denominazione: 'Impresa' }, modalita: 'misura',
  dataInizio: '01/06/2026', ...x,
})
const sal = (x: Partial<Sal>): Sal => ({ numero: 1, righe: [], ...x })
const trova = (l: ReturnType<typeof scadenze>, id: string) => l.find((x) => x.id === id)!

describe('certificato di pagamento e pagamento', () => {
  it('sette giorni dal SAL per il certificato, trenta per il pagamento', () => {
    const l = scadenze({ appalto: appalto(), sals: [sal({ data: '01/07/2026' })] }, '2026-07-02')
    expect(trova(l, 'cert-1').entro).toBe('08/07/2026')
    expect(trova(l, 'cert-1').giorni).toBe(GIORNI_CERTIFICATO - 1)
    expect(trova(l, 'pag-1').entro).toBe('31/07/2026')
    expect(trova(l, 'pag-1').giorni).toBe(GIORNI_PAGAMENTO - 1)
  })
  it('oltre il termine lo segna come ritardo, con i giorni', () => {
    const l = scadenze({ appalto: appalto(), sals: [sal({ data: '01/07/2026' })] }, '2026-07-20')
    expect(trova(l, 'cert-1').stato).toBe('scaduta')
    expect(trova(l, 'cert-1').nota).toContain('12 giorni')
  })
  it('certificato emesso nei termini: assolto, coi giorni effettivi', () => {
    const l = scadenze({ appalto: appalto(), sals: [sal({ data: '01/07/2026', dataCertificato: '05/07/2026' })] }, '2026-07-20')
    expect(trova(l, 'cert-1').stato).toBe('fatto')
    expect(trova(l, 'cert-1').nota).toContain('4 giorni dal SAL')
  })
  it('certificato emesso in ritardo: lo dichiara anche se è stato emesso', () => {
    const l = scadenze({ appalto: appalto(), sals: [sal({ data: '01/07/2026', dataCertificato: '20/07/2026' })] }, '2026-08-01')
    expect(trova(l, 'cert-1').stato).toBe('scaduta')
    expect(trova(l, 'cert-1').nota).toContain('oltre i 7 giorni')
  })
  it('senza data del SAL non calcola nessun termine e dice cosa manca', () => {
    const l = scadenze({ appalto: appalto(), sals: [sal({})] }, '2026-07-02')
    expect(trova(l, 'cert-1').stato).toBe('nonCalcolabile')
    expect(trova(l, 'cert-1').nota).toContain('manca la data del SAL')
  })
  it('pagato: risulta assolto con la sua data', () => {
    const l = scadenze({ appalto: appalto(), sals: [sal({ data: '01/07/2026', dataPagamento: '15/07/2026' })] }, '2026-09-01')
    expect(trova(l, 'pag-1').stato).toBe('fatto')
    expect(trova(l, 'pag-1').nota).toContain('15/07/2026')
  })
})

describe('anticipazione', () => {
  it('quindici giorni dall\'inizio dei lavori, solo se è prevista', () => {
    const senza = scadenze({ appalto: appalto(), sals: [] }, '2026-06-02')
    expect(senza.some((x) => x.id === 'anticipazione')).toBe(false)
    const con = scadenze({ appalto: appalto({ anticipazionePct: 20 }), sals: [] }, '2026-06-02')
    expect(trova(con, 'anticipazione').entro).toBe('16/06/2026')
    expect(trova(con, 'anticipazione').cosa).toContain('20%')
  })
  it('erogata: risulta assolta quando l\'atto è stato emesso', () => {
    const l = scadenze({ appalto: appalto({ anticipazionePct: 20 }), sals: [], consegne: [{ id: 'x', tipo: 'anticipazione', label: 'Anticipazione', data: '05/06/2026', ts: 0 }] }, '2026-07-01')
    expect(trova(l, 'anticipazione').stato).toBe('fatto')
  })
})

describe('riserve e conto finale', () => {
  const ris = (x: Partial<Riserva>): Riserva => ({ numero: 1, oggetto: 'Oneri', ...x })
  it('la riserva non esplicitata entra nello scadenziario con i suoi quindici giorni', () => {
    const l = scadenze({ appalto: appalto(), sals: [], riserve: [ris({ data: '01/06/2026' })] }, '2026-06-10')
    expect(trova(l, 'ris-1').entro).toBe('16/06/2026')
    expect(trova(l, 'ris-1').stato).toBe('aperta')
  })
  it('la riserva già esplicitata esce dallo scadenziario', () => {
    const l = scadenze({ appalto: appalto(), sals: [], riserve: [ris({ data: '01/06/2026', dataEsplicitazione: '05/06/2026' })] }, '2026-06-10')
    expect(l.some((x) => x.id === 'ris-1')).toBe(false)
  })
  it('il conto finale compare col certificato di ultimazione e vuole trenta giorni dall\'invito', () => {
    const l = scadenze({ appalto: appalto({ contoFinale: { dataInvito: '01/10/2026' } }), sals: [], verbali: [{ id: 'u', tipo: 'ultimazione', data: '20/09/2026' }] }, '2026-10-05')
    expect(trova(l, 'contofinale').entro).toBe('31/10/2026')
  })
  it('conto finale non firmato nel termine: assolto, ma con la conseguenza scritta', () => {
    const l = scadenze({ appalto: appalto({ contoFinale: { dataInvito: '01/10/2026', esito: 'nonFirmato' } }), sals: [], verbali: [{ id: 'u', tipo: 'ultimazione' }] }, '2026-12-01')
    expect(trova(l, 'contofinale').stato).toBe('fatto')
    expect(trova(l, 'contofinale').nota).toContain('definitivamente accettato')
  })
})

describe('ordine e urgenze', () => {
  it('i ritardi vengono prima, poi le scadenze imminenti, poi il resto', () => {
    const l = scadenze({
      appalto: appalto({ anticipazionePct: 20 }),
      sals: [sal({ numero: 1, data: '01/06/2026' }), sal({ numero: 2, data: '01/11/2026' })],
    }, '2026-11-03')
    expect(l[0].stato).toBe('scaduta')
    const stati = l.map((x) => x.stato)
    expect(stati.indexOf('scaduta')).toBeLessThan(stati.lastIndexOf('aperta'))
    expect(scadenzeUrgenti(l).every((x) => x.stato === 'scaduta' || x.stato === 'inScadenza')).toBe(true)
  })
  it('lo scadenziario stampato dichiara di essere un foglio di lavoro', () => {
    const l = scadenze({ appalto: appalto(), sals: [sal({ data: '01/07/2026' })] }, '2026-07-02')
    const html = scadenziarioHTML(appalto(), l, '02/07/2026')
    expect(html).toContain('foglio di lavoro')
    expect(html).toContain('08/07/2026')
    expect(html).toContain('non viene presunto')
  })
})

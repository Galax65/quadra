import { describe, it, expect } from 'vitest'
import { attoSottomissioneHTML, formaAtto, quadroEconomicoPerizia } from '../../src/tools/contabilita/engine/sottomissione'
import type { Appalto, Partita, Perizia } from '../../src/tools/contabilita/engine/types'

/**
 * La perizia va accompagnata dall'atto con cui l'esecutore si impegna, e la
 * FORMA di quell'atto dipende da quanto vale la variazione: entro il quinto è
 * un atto di sottomissione, unilaterale, che l'esecutore può accettare o
 * respingere con motivato dissenso; oltre il quinto non si impone più nulla,
 * serve un accordo.
 */
const partite = (): Partita[] => [
  { id: 'a', modalita: 'misura', codice: 'A.1', descrizione: 'Scavo', um: 'mc', prezzoUnitario: 10, qtyProgetto: 1000, introdottaSal: 1 },
]
const appalto = (pz: Perizia): Appalto => ({
  oggetto: 'Lavori di prova', ente: { denominazione: 'Comune' }, impresa: { denominazione: 'Impresa Rossi' },
  modalita: 'misura', ivaPct: 10, perizie: [pz], numeroContratto: '12/2026', dataStipula: '01/05/2026',
})
const perizia = (qty: number): Perizia => ({ numero: 1, data: '01/09/2026', dalSal: 2, oggetto: 'Maggiori scavi', voci: [{ partitaId: 'a', qty }] })

describe('quale atto serve', () => {
  it('entro il quinto: atto di sottomissione', () => {
    const pz = perizia(1150) // +15%
    expect(formaAtto(partite(), appalto(pz), pz)).toBe('sottomissione')
  })
  it('oltre il quinto: atto aggiuntivo', () => {
    const pz = perizia(1250) // +25%
    expect(formaAtto(partite(), appalto(pz), pz)).toBe('aggiuntivo')
  })
  it('anche una variazione in diminuzione oltre il quinto vuole l\'accordo', () => {
    const pz = perizia(700) // −30%
    expect(formaAtto(partite(), appalto(pz), pz)).toBe('aggiuntivo')
  })
})

describe("l'atto di sottomissione (entro il quinto)", () => {
  const pz = perizia(1150)
  const html = attoSottomissioneHTML(appalto(pz), partite(), pz)
  it('obbliga agli stessi patti e prezzi del contratto originario', () => {
    expect(html).toContain('si obbliga a eseguire')
    expect(html).toContain('agli stessi patti, prezzi e condizioni del contratto originario')
  })
  it('lascia aperta la strada del motivato dissenso', () => {
    expect(html).toContain('motivato dissenso')
    expect(html).toContain('per accettazione')
  })
  it('dichiara la maggiore spesa e la percentuale sul contratto', () => {
    expect(html).toContain('maggiore')
    expect(html).toContain('1.500,00') // 150 mc in più × 10 €
    expect(html).toContain('15,00%')
  })
  it('richiama il contratto e la perizia per numero e data', () => {
    expect(html).toContain('12/2026')
    expect(html).toContain('perizia di variante n. 1')
    expect(html).toContain('01/09/2026')
  })
})

describe("l'atto aggiuntivo (oltre il quinto)", () => {
  const pz = perizia(1250)
  const html = attoSottomissioneHTML(appalto(pz), partite(), pz)
  it('dice che la variazione non è imponibile e che serve un accordo', () => {
    expect(html).toContain('non può essere imposta')
    expect(html).toContain('natura di <b>accordo</b>')
    expect(html).toContain('Atto aggiuntivo')
  })
  it('non chiede la firma «per accettazione o dissenso»: è un contratto', () => {
    expect(html).not.toContain('motivato dissenso</b>, che si allega')
  })
})

describe('quadro economico della perizia', () => {
  const pz = perizia(1150)
  it('ricalcola i lavori e l\'IVA, prima e dopo', () => {
    const qe = quadroEconomicoPerizia(appalto(pz), partite(), pz)
    expect(qe[0]).toMatchObject({ prima: 10000, dopo: 11500 })
    expect(qe[1]).toMatchObject({ prima: 1000, dopo: 1150 })
    expect(qe[2]).toMatchObject({ prima: 11000, dopo: 12650 })
  })
  it('le somme a disposizione restano da confermare, non si inventano', () => {
    const qe = quadroEconomicoPerizia(appalto(pz), partite(), pz)
    expect(qe[3].prima).toBeNull()
    expect(qe[3].dopo).toBeNull()
    expect(qe[3].nota).toContain('da confermare')
  })
})

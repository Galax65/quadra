import { describe, expect, it } from 'vitest'
import { allineaQuotaCorpo, calcolaSals, partiteVigenti, perizieAl, periziaApprovata, quadroComparativo, type Appalto, type Partita, type Perizia, type Sal } from '../../src/tools/contabilita/engine'

const P: Partita[] = [
  { id: 'm', modalita: 'misura', codice: 'A.01', descrizione: 'Scavo', um: 'm³', prezzoUnitario: 10, qtyProgetto: 100 },
  { id: 'c', modalita: 'corpo', codice: 'C.01', descrizione: 'Impianto', importoContrattuale: 1000 },
]
const base = (x: Partial<Appalto> = {}): Appalto => ({ oggetto: 'x', ente: { denominazione: 'E' }, impresa: { denominazione: 'I' }, modalita: 'misto', ...x })

describe('perizie di variante', () => {
  const pz = { numero: 1, dalSal: 2, voci: [{ partitaId: 'm', qty: 130 }, { partitaId: 'c', importo: 1250 }] }

  it('il contratto vigente cambia dal SAL della perizia', () => {
    expect(partiteVigenti(P, [pz], 1)[1].importoContrattuale).toBe(1000)
    expect(partiteVigenti(P, [pz], 2)[0].qtyProgetto).toBe(130)
    expect(partiteVigenti(P, [pz], 2)[1].importoContrattuale).toBe(1250)
    expect(P[1].importoContrattuale).toBe(1000) // l'originale non cambia
  })

  it('quadro comparativo: maggiori e minori lavori, variazione e quinto d\'obbligo', () => {
    const q = quadroComparativo(P, [pz], pz)
    expect(q.totalePrima).toBe(2000)
    expect(q.totaleDopo).toBe(2550)
    expect(q.aumenti).toBe(550)
    expect(q.variazionePct).toBe(27.5)
    expect(q.oltreQuinto).toBe(true)
  })

  it('allineamento a corpo: stesso maturato sul nuovo importo', () => {
    expect(allineaQuotaCorpo(50, 1000, 1250)).toBe(40)
    expect(allineaQuotaCorpo(null, 1000, 1250)).toBe(null)
    expect(allineaQuotaCorpo(100, 1000, 800)).toBe(100)
  })

  it('i SAL usano il contratto vigente: prima e dopo la perizia', () => {
    const sals: Sal[] = [
      { numero: 1, righe: [{ partitaId: 'c', quotaPct: 50 }] },
      { numero: 2, righe: [{ partitaId: 'c', quotaPct: 40 }] },
    ]
    const r = calcolaSals(base({ perizie: [pz] }), P, sals)
    expect(r[0].lavoriCorpo).toBe(500)
    expect(r[1].lavoriCorpo).toBe(500) // 40% di 1250
  })
})

describe('anticipazione (art. 125)', () => {
  it('si recupera con la stessa % sull\'importo contabilizzato, mai oltre l\'erogato', () => {
    const sals: Sal[] = [{ numero: 1, righe: [{ partitaId: 'm', quantitaProgressiva: 50 }] }, { numero: 2, righe: [{ partitaId: 'm', quantitaProgressiva: 100 }, { partitaId: 'c', quotaPct: 100 }] }]
    const r = calcolaSals(base({ anticipazionePct: 20 }), P, sals)
    expect(r[0].anticipazione).toBe(400)          // 20% di 2000
    expect(r[0].recuperoAnticipazione).toBe(100)  // 20% di 500
    expect(r[0].nettoProgressivo).toBe(round(500 - 2.5 - 100))
    expect(r[1].recuperoAnticipazione).toBe(400)  // a fine lavori: tutta
    const senza = calcolaSals(base(), P, sals)
    expect(senza[0].recuperoAnticipazione).toBe(0)
  })
})
function round(n: number): number { return Math.round(n * 100) / 100 }

describe('quadro comparativo in PDF', () => {
  it('si genera con i totali della perizia', async () => {
    const lib = await import('pdf-lib')
    const { quadroComparativoPdf } = await import('../../src/tools/contabilita/engine')
    const partite: any[] = [{ id: 'a', modalita: 'misura', codice: 'A', descrizione: 'Scavo', um: 'm³', prezzoUnitario: 10, qtyProgetto: 100 }]
    const pz: any = { numero: 1, dalSal: 2, voci: [{ partitaId: 'a', qty: 120 }] }
    const r = await quadroComparativoPdf(lib, { oggetto: 'X', ente: { denominazione: 'E' }, impresa: { denominazione: 'I' }, modalita: 'misura', perizie: [pz] } as any, partite, pz)
    expect(r.pagine).toBe(1)
  })
})

/**
 * ITER DELLA PERIZIA (art. 120): finché la perizia non è APPROVATA dalla stazione
 * appaltante non cambia il contratto — i lavori che introduce si contabilizzano in
 * conto provvisorio. `approvata` assente vale approvata, così i lavori già in corso
 * non cambiano di significato quando si aggiorna il programma.
 */
describe('perizia in bozza: non è ancora contratto', () => {
  const uno: Partita[] = [
    { id: 'c1', modalita: 'misura', codice: 'A.01', descrizione: 'Scavo', um: 'mc', prezzoUnitario: 10, qtyProgetto: 100, introdottaSal: 1 },
  ]
  const pz = (approvata?: boolean): Perizia => ({ numero: 1, dalSal: 2, voci: [{ partitaId: 'c1', qty: 150 }], ...(approvata == null ? {} : { approvata }) })

  it('una perizia in bozza non entra nel contratto vigente', () => {
    expect(periziaApprovata(pz(false))).toBe(false)
    expect(perizieAl([pz(false)], 5)).toHaveLength(0)
    expect(partiteVigenti(uno, [pz(false)], 5)[0].qtyProgetto).toBe(100)
  })

  it('approvata, vale dal SAL indicato in poi', () => {
    expect(perizieAl([pz(true)], 5)).toHaveLength(1)
    expect(partiteVigenti(uno, [pz(true)], 5)[0].qtyProgetto).toBe(150)
    expect(partiteVigenti(uno, [pz(true)], 1)[0].qtyProgetto).toBe(100)
  })

  it('senza il campo (lavori già in corso) resta approvata', () => {
    expect(periziaApprovata(pz())).toBe(true)
    expect(partiteVigenti(uno, [pz()], 5)[0].qtyProgetto).toBe(150)
  })

  it('il quadro comparativo confronta col contratto DAVVERO in vigore', () => {
    const pz1: Perizia = { numero: 1, dalSal: 2, voci: [{ partitaId: 'c1', qty: 150 }], approvata: false }
    const pz2: Perizia = { numero: 2, dalSal: 3, voci: [{ partitaId: 'c1', qty: 200 }], approvata: false }
    // la prima è in bozza: il «prima» della seconda resta il contratto originario
    const q = quadroComparativo(uno, [pz1, pz2], pz2)
    expect(q.totalePrima).toBe(1000)
    expect(q.totaleDopo).toBe(2000)
    // approvata la prima, il «prima» della seconda diventa 1.500
    const q2 = quadroComparativo(uno, [{ ...pz1, approvata: true }, pz2], pz2)
    expect(q2.totalePrima).toBe(1500)
  })
})

/**
 * Misure di perizia: la nuova quantità di contratto è la SOMMA delle misure
 * quando ci sono (si misura come nel libretto); `qty` resta per i file vecchi.
 */
describe('la quantità di perizia viene dalle misure', () => {
  const due: Partita[] = [{ id: 'm1', modalita: 'misura', codice: 'A.01', descrizione: 'Scavo', um: 'mc', prezzoUnitario: 10, qtyProgetto: 100, introdottaSal: 1 }]

  it('con le misure vince la loro somma', () => {
    const pz: Perizia = { numero: 1, dalSal: 1, voci: [{ partitaId: 'm1', qty: 100, misurazioni: [{ descrizione: 'a', quantita: 70 }, { descrizione: 'b', quantita: 55.5 }] }] }
    expect(partiteVigenti(due, [pz], 1)[0].qtyProgetto).toBe(125.5)
    expect(quadroComparativo(due, [pz], pz).differenza).toBe(255)
  })

  it('senza misure vale la quantità scritta a mano', () => {
    const pz: Perizia = { numero: 1, dalSal: 1, voci: [{ partitaId: 'm1', qty: 120 }] }
    expect(partiteVigenti(due, [pz], 1)[0].qtyProgetto).toBe(120)
  })

  it('una perizia che tocca solo gli importi non cancella le quantità di quella prima', () => {
    const corpo: Partita[] = [...due, { id: 'k1', modalita: 'corpo', codice: 'C.01', descrizione: 'Impianto', importoContrattuale: 1000, introdottaSal: 1 }]
    const pz1: Perizia = { numero: 1, dalSal: 1, voci: [{ partitaId: 'm1', qty: 130 }] }
    const pz2: Perizia = { numero: 2, dalSal: 1, voci: [{ partitaId: 'k1', importo: 1200 }] }
    const v = partiteVigenti(corpo, [pz1, pz2], 2)
    expect(v[0].qtyProgetto).toBe(130)
    expect(v[1].importoContrattuale).toBe(1200)
  })
})

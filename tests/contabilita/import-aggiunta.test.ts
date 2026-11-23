import { describe, it, expect } from 'vitest'
import { anteprimaAggiunta, preparaAggiunta, salDiDestinazione, chiaveVoce } from '../../src/tools/contabilita/engine/import-aggiunta'
import type { Partita, Sal } from '../../src/tools/contabilita/engine/types'
import type { VoceImport } from '../../src/tools/contabilita/engine/import'

/**
 * Un lavoro vero non comincia sempre dal computo di progetto: si eredita una
 * contabilità già avviata, arriva dopo un pezzo di computo, si aggiungono le
 * voci di una perizia. Importare, lì, non può voler dire cancellare.
 */
const partite = (): Partita[] => [
  { id: 'a', modalita: 'misura', codice: 'A.1', descrizione: 'Scavo', um: 'mc', prezzoUnitario: 10, prezzoContratto: 10, introdottaSal: 1 },
  { id: 'b', modalita: 'misura', codice: 'A.2', descrizione: 'Muratura', um: 'mq', prezzoUnitario: 48, prezzoContratto: 48, introdottaSal: 1 },
]
const voci: VoceImport[] = [
  { codice: 'A.1', desc_short: 'Scavo', um: 'mc', prezzo: 11, qty: 10, misurazioni: [{ descrizione: 'tratto nord', l1: 10, l2: 2, quantita: 20 }] },
  { codice: 'C.7', desc_short: 'Intonaco', um: 'mq', prezzo: 22, qty: 30, misurazioni: [{ descrizione: 'parete', quantita: 30 }] },
  { codice: 'C.8', desc_short: 'Tinteggiatura', um: 'mq', prezzo: 9, qty: 30 },
]

describe('anteprima: si vede prima che cosa cambia', () => {
  it('conta articoli nuovi, già presenti e voci che portano misure', () => {
    const a = anteprimaAggiunta(voci, partite())
    expect(a.nuove).toBe(2)
    expect(a.gia).toBe(1)
    expect(a.conMisure).toBe(2)
  })
  it('segnala i prezzi diversi, senza cambiarli', () => {
    const a = anteprimaAggiunta(voci, partite())
    expect(a.prezziDiversi).toHaveLength(1)
    expect(a.prezziDiversi[0]).toMatchObject({ codice: 'A.1', inElenco: 10, nelFile: 11 })
  })
  it('riconosce una voce senza codice dalla descrizione', () => {
    expect(chiaveVoce('', 'Scavo a mano')).toBe('scavo a mano')
    expect(chiaveVoce(' A.1 ', 'altro')).toBe('a.1')
  })
})

describe('aggiunta: niente si cancella', () => {
  let n = 0
  const nuovoId = (): string => `n${++n}`
  it('aggiunge solo gli articoli che mancano, col SAL da cui esistono', () => {
    const e = preparaAggiunta(voci, partite(), { introdottaSal: 3, conMisure: false, nuovoId })
    expect(e.nuove.map((p) => p.codice)).toEqual(['C.7', 'C.8'])
    expect(e.nuove.every((p) => p.introdottaSal === 3)).toBe(true)
    expect(e.gia).toBe(1)
  })
  it('il prezzo di contratto di una voce già in elenco non viene riscritto', () => {
    const p = partite()
    const e = preparaAggiunta(voci, p, { introdottaSal: 3, conMisure: false, nuovoId })
    expect(e.nuove.some((x) => x.codice === 'A.1')).toBe(false)
    expect(p.find((x) => x.codice === 'A.1')!.prezzoUnitario).toBe(10)
  })
  it('le misure vanno alla partita giusta, anche per una voce già in elenco', () => {
    const e = preparaAggiunta(voci, partite(), { introdottaSal: 3, conMisure: true, nuovoId })
    expect(e.misure).toHaveLength(2)
    expect(e.misure[0].partitaId).toBe('a') // A.1 era già in elenco: le misure vanno sulla sua partita
    expect(e.misure[0].righe[0].descrizione).toBe('tratto nord')
  })
  it('senza misure chieste, nessuna misura viene portata', () => {
    expect(preparaAggiunta(voci, partite(), { introdottaSal: 1, conMisure: false, nuovoId }).misure).toHaveLength(0)
  })
  it('importando due volte lo stesso file non si duplica nulla', () => {
    const p = partite()
    const primo = preparaAggiunta(voci, p, { introdottaSal: 2, conMisure: false, nuovoId })
    p.push(...primo.nuove)
    const secondo = preparaAggiunta(voci, p, { introdottaSal: 2, conMisure: false, nuovoId })
    expect(secondo.nuove).toHaveLength(0)
    expect(secondo.gia).toBe(3)
  })
})

describe('dove possono comparire le voci importate', () => {
  const sal = (numero: number, firmato?: boolean): Sal => ({ numero, righe: [], firmato })
  it('il primo libretto aperto', () => {
    expect(salDiDestinazione([sal(1, true), sal(2)])).toBe(2)
  })
  it('se sono tutti firmati, il SAL successivo: un atto chiuso non si tocca', () => {
    expect(salDiDestinazione([sal(1, true), sal(2, true)])).toBe(3)
  })
  it('senza SAL, il primo', () => {
    expect(salDiDestinazione([])).toBe(1)
  })
})

describe('un contratto senza quantità di progetto', () => {
  /* Un lavoro ereditato da un file di CONTABILITÀ porta l'eseguito ma non il
     progetto: il contratto vigente resta zero e ogni perizia sembra tutta in
     aumento. Importando poi il computo di contratto, le quantità mancanti
     devono arrivare sulle voci che ci sono già — senza mai riscrivere un
     contratto che c'è. */
  const voceComputo = { codice: 'A1', desc_short: 'Scavo', um: 'mc', prezzo: 10, qty: 100 }

  it('completa le quantità mancanti e lo dice prima di farlo', () => {
    const partite = [{ id: 'x', modalita: 'misura', codice: 'A1', descrizione: 'Scavo', um: 'mc', prezzoUnitario: 10, qtyProgetto: null, introdottaSal: 1 }] as never[]
    expect(anteprimaAggiunta([voceComputo], partite).completabili).toBe(1)
    const esito = preparaAggiunta([voceComputo], partite, { introdottaSal: 1, conMisure: false, nuovoId: () => 'n1' })
    expect(esito.nuove).toHaveLength(0)
    expect(esito.completate).toBe(1)
    expect((partite[0] as unknown as { qtyProgetto: number }).qtyProgetto).toBe(100)
  })

  it('una quantità di contratto che c\'è già non si tocca', () => {
    const partite = [{ id: 'x', modalita: 'misura', codice: 'A1', descrizione: 'Scavo', um: 'mc', prezzoUnitario: 10, qtyProgetto: 80, introdottaSal: 1 }] as never[]
    expect(anteprimaAggiunta([voceComputo], partite).completabili).toBe(0)
    const esito = preparaAggiunta([voceComputo], partite, { introdottaSal: 1, conMisure: false, nuovoId: () => 'n1' })
    expect(esito.completate).toBe(0)
    expect((partite[0] as unknown as { qtyProgetto: number }).qtyProgetto).toBe(80)
  })
})

describe('voci importate DENTRO una perizia', () => {
  /* Il caso che rovinava i conti: si importa il computo di variante nella
     perizia e il «contratto vigente» cresceva, perché le voci nuove entravano
     in contratto con la loro quantità di progetto. Una perizia in bozza non è
     contratto: le sue voci sono nuovi prezzi, e la quantità è di variante. */
  const variante = [
    { codice: 'A1', desc_short: 'Scavo', um: 'mc', prezzo: 10, qty: 120 },   // già in contratto
    { codice: 'B9', desc_short: 'Opera nuova', um: 'mq', prezzo: 25, qty: 40 }, // nuova
  ]
  const contratto = (): never[] => ([{ id: 'x', modalita: 'misura', codice: 'A1', descrizione: 'Scavo', um: 'mc', prezzoUnitario: 10, prezzoContratto: 10, qtyProgetto: 100, introdottaSal: 1 }] as never[])

  it('la voce nuova nasce fuori dal contratto, come nuovo prezzo della perizia', () => {
    const partite = contratto()
    const esito = preparaAggiunta(variante, partite, { introdottaSal: 2, conMisure: false, nuovoId: () => 'n1', periziaN: 1 })
    expect(esito.nuove).toHaveLength(1)
    const nuova = esito.nuove[0] as unknown as { qtyProgetto: number | null; np?: { periziaN?: number | null; numero: number } }
    expect(nuova.qtyProgetto).toBeNull()        // non è contratto
    expect(nuova.np?.periziaN).toBe(1)          // è un nuovo prezzo di questa perizia
    expect(nuova.np?.numero).toBeGreaterThan(0) // con il suo progressivo NP
  })

  it('senza perizia, invece, la stessa voce entra in contratto con la sua quantità', () => {
    const partite = contratto()
    const esito = preparaAggiunta(variante, partite, { introdottaSal: 2, conMisure: false, nuovoId: () => 'n1' })
    const nuova = esito.nuove[0] as unknown as { qtyProgetto: number | null; np?: unknown }
    expect(nuova.qtyProgetto).toBe(40)
    expect(nuova.np).toBeUndefined()
  })
})

describe('importare nel libretto di un SAL', () => {
  /* Misurare non pattuisce: una voce che arriva in un libretto entra in elenco
     prezzi ma NON diventa contratto. Sarà semmai una perizia a farne contratto.
     Senza questa regola, un file di contabilità importato in corsa gonfiava il
     contratto con lavorazioni mai pattuite. */
  it('la voce nuova entra in elenco senza quantità di contratto', () => {
    const partite = [{ id: 'x', modalita: 'misura', codice: 'A1', descrizione: 'Scavo', um: 'mc', prezzoUnitario: 10, qtyProgetto: 100, introdottaSal: 1 }] as never[]
    const esito = preparaAggiunta(
      [{ codice: 'C7', desc_short: 'Lavorazione non prevista', um: 'mq', prezzo: 30, qty: 50 }],
      partite,
      { introdottaSal: 2, conMisure: false, nuovoId: () => 'n1', fuoriContratto: true },
    )
    const nuova = esito.nuove[0] as unknown as { qtyProgetto: number | null }
    expect(nuova.qtyProgetto).toBeNull()
  })
})

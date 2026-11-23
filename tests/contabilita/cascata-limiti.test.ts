import { describe, it, expect } from 'vitest'
import { calcolaSals, eseguitoPartita } from '../../src/tools/contabilita/engine/contabilita'
import { importoQta } from '../../src/shared/importo'
import type { Appalto, ListaEconomia, Partita, Sal } from '../../src/tools/contabilita/engine/types'

/**
 * I CASI LIMITE DELLA CASCATA DEL SAL.
 *
 * È la parte del programma in cui un errore si traduce in euro pagati o non
 * pagati a un'impresa, e in un certificato che qualcuno firma. Qui stanno i
 * casi che in un lavoro normale non si incontrano mai — e che in un lavoro
 * vero prima o poi arrivano tutti: detrazioni più grandi dell'eseguito,
 * arrotondamenti che mangiano il resto, anticipazione che si esaurisce, SAL
 * che tornano indietro per uno storno, voci espresse in percentuale.
 */
const A = (x: Partial<Appalto> = {}): Appalto => ({
  oggetto: 'Lavori', ente: { denominazione: 'Comune' }, impresa: { denominazione: 'Impresa' },
  modalita: 'misura', ivaPct: 10, ...x,
})
const P = (x: Partial<Partita> = {}): Partita[] => [
  { id: 'a', modalita: 'misura', codice: 'A.1', descrizione: 'Scavo', um: 'mc', prezzoUnitario: 10, qtyProgetto: 1000, introdottaSal: 1, ...x },
]
const S = (...qta: number[]): Sal[] => qta.map((q, i) => ({ numero: i + 1, data: `0${i + 1}/07/2026`, righe: [{ partitaId: 'a', quantitaProgressiva: q }] }))

describe('detrazioni più grandi dell\'eseguito', () => {
  const sals = S(100)
  sals[0].detrazioni = 2000 // eseguito 1.000
  const r = calcolaSals(A(), P(), sals)[0]
  it('il contabilizzato va in negativo, e si vede', () => {
    expect(r.totaleEseguito).toBe(1000)
    expect(r.totaleContabilizzato).toBe(-1000)
  })
  it('la ritenuta NON diventa negativa: non si restituisce una garanzia mai trattenuta', () => {
    expect(r.ritenuta).toBe(0)
  })
  it('il credito resta negativo di quanto dovuto, senza interessi di arrotondamento', () => {
    expect(r.importoSal).toBe(-1000)
  })
})

describe('arrotondamento del certificato', () => {
  it('arrotonda per difetto e lascia il resto maturare nel SAL successivo', () => {
    const res = calcolaSals(A({ arrotondamentoCertificato: 100 }), P(), S(15.04, 30))
    // SAL 1: eseguito 150,40 → ritenuta 0,75 → credito 149,65 → certificato 100
    expect(res[0].creditoSal).toBe(149.65)
    expect(res[0].importoSal).toBe(100)
    // SAL 2: il resto di 49,65 non è perso, torna nel credito successivo
    expect(res[1].salPrecedenti).toBe(100)
    expect(res[1].importoSal).toBe(100)
    // il credito del 2° SAL porta con sé il resto non certificato nel 1°
    expect(res[1].creditoSal).toBeCloseTo(198.5, 2)
  })
  it('un credito inferiore all\'arrotondamento non certifica nulla, e nulla si perde', () => {
    const res = calcolaSals(A({ arrotondamentoCertificato: 100 }), P(), S(4))
    expect(res[0].creditoSal).toBeCloseTo(39.8, 2)
    expect(res[0].importoSal).toBe(0)
  })
  it('un credito NEGATIVO non si arrotonda per difetto: certificare −100 per un −50 sarebbe trattenere più del dovuto', () => {
    const sals = S(10)
    sals[0].detrazioni = 150 // eseguito 100 → contabilizzato −50
    const r = calcolaSals(A({ arrotondamentoCertificato: 100 }), P(), sals)[0]
    expect(r.totaleContabilizzato).toBe(-50)
    expect(r.importoSal).toBe(-50)
  })
})

describe('anticipazione', () => {
  const app = A({ anticipazionePct: 20 })
  it('si recupera con la stessa percentuale, e mai oltre quanto erogato', () => {
    const res = calcolaSals(app, P(), S(100, 500, 1000))
    expect(res[0].anticipazione).toBe(2000) // 20% di 10.000
    expect(res[0].recuperoAnticipazione).toBe(200) // 20% di 1.000
    expect(res[1].recuperoAnticipazione).toBe(1000)
    expect(res[2].recuperoAnticipazione).toBe(2000) // esaurita, non va oltre
  })
  it('esaurita l\'anticipazione, i SAL successivi non recuperano più nulla di nuovo', () => {
    const res = calcolaSals(app, P(), S(1000, 1000))
    expect(res[0].recuperoAnticipazione).toBe(2000)
    expect(res[1].recuperoAnticipazione).toBe(2000)
    expect(res[1].importoSal).toBe(0) // nessun lavoro in più: nessun credito in più
  })
  it('su un contabilizzato negativo non si recupera anticipazione', () => {
    const sals = S(10)
    sals[0].detrazioni = 500
    expect(calcolaSals(app, P(), sals)[0].recuperoAnticipazione).toBe(0)
  })
})

describe('un SAL che torna indietro (storno di una voce già contabilizzata)', () => {
  it('il credito del SAL può essere negativo, e il progressivo scende', () => {
    const partite = P()
    partite.push({ id: 'b', modalita: 'misura', codice: 'B.1', descrizione: 'Demolizione', um: 'mq', prezzoUnitario: 50, qtyProgetto: 100, introdottaSal: 1, soppressaSal: 2 })
    const sals: Sal[] = [
      { numero: 1, data: '01/07/2026', righe: [{ partitaId: 'a', quantitaProgressiva: 100 }, { partitaId: 'b', quantitaProgressiva: 40 }] },
      { numero: 2, data: '01/08/2026', righe: [{ partitaId: 'a', quantitaProgressiva: 100 }, { partitaId: 'b', quantitaProgressiva: 40 }] },
    ]
    const res = calcolaSals(A(), partite, sals)
    expect(res[0].lavoriEseguiti).toBe(3000) // 1.000 + 2.000
    expect(res[1].lavoriEseguiti).toBe(1000) // la voce stornata non c'è più
    expect(res[1].importoSal).toBeLessThan(0)
    // e il progressivo dei due SAL torna uguale al netto del secondo
    expect(res[1].salPrecedenti + res[1].importoSal).toBeCloseTo(res[1].nettoProgressivo, 2)
  })
})

describe('ribasso, sicurezza ed economie: chi si ribassa e chi no', () => {
  const partite: Partita[] = [
    { id: 'a', modalita: 'misura', codice: 'A.1', descrizione: 'Scavo', um: 'mc', prezzoUnitario: 10, qtyProgetto: 1000, introdottaSal: 1 },
    { id: 's', modalita: 'misura', codice: 'S.1', descrizione: 'Recinzione di cantiere', um: 'ml', prezzoUnitario: 20, qtyProgetto: 100, sicurezza: true, introdottaSal: 1 },
  ]
  const liste: ListaEconomia[] = [{ id: 'l1', numero: 1, data: '01/07/2026', salNumero: 1, operai: [{ ore: 10, tariffaOraria: 30 }], mezzi: [], provviste: [] }]
  const sals: Sal[] = [{ numero: 1, data: '01/07/2026', righe: [{ partitaId: 'a', quantitaProgressiva: 100 }, { partitaId: 's', quantitaProgressiva: 50 }] }]
  const r = calcolaSals(A({ ribassoPct: 10 }), partite, sals, liste)[0]
  it('il ribasso prende i lavori, non la sicurezza né le economie', () => {
    expect(r.lavoriMisura).toBe(1000)
    expect(r.lavoriEconomia).toBe(300)
    expect(r.ribassoImporto).toBe(100) // 10% di 1.000: le economie e la sicurezza restano fuori
  })
  it('le voci di sicurezza vanno con gli oneri, al prezzo pieno', () => {
    expect(r.oneriSicurezzaEseguiti).toBe(1000) // 50 ml × 20 €
  })
})

describe('voci espresse in percentuale', () => {
  it('importo = quantità × prezzo / 100, come nei programmi di contabilità', () => {
    expect(importoQta(50, 2000, '%')).toBe(1000)
    expect(importoQta(100, 2000, '%')).toBe(2000)
  })
  it('un\'unità normale non viene divisa per cento', () => {
    expect(importoQta(50, 2000, 'mq')).toBe(100000)
  })
})

describe('casi degeneri', () => {
  it('nessun SAL: nessun risultato, niente eccezioni', () => {
    expect(calcolaSals(A(), P(), [])).toEqual([])
  })
  it('SAL senza righe: tutto a zero', () => {
    const r = calcolaSals(A(), P(), [{ numero: 1, righe: [] }])[0]
    expect(r.lavoriEseguiti).toBe(0)
    expect(r.ritenuta).toBe(0)
    expect(r.importoSal).toBe(0)
  })
  it('SAL fuori ordine: si calcolano comunque in sequenza', () => {
    const sals: Sal[] = [
      { numero: 2, data: '01/08/2026', righe: [{ partitaId: 'a', quantitaProgressiva: 200 }] },
      { numero: 1, data: '01/07/2026', righe: [{ partitaId: 'a', quantitaProgressiva: 100 }] },
    ]
    const res = calcolaSals(A(), P(), sals)
    expect(res.map((x) => x.numero)).toEqual([1, 2])
    expect(res[1].salPrecedenti).toBeGreaterThan(0)
  })
  it('quantità nulla o assente non vale zero per caso: vale zero', () => {
    expect(eseguitoPartita(P()[0], { partitaId: 'a' })).toBe(0)
    expect(eseguitoPartita(P()[0], undefined)).toBe(0)
  })
  it('prezzo assente: l\'importo è zero, non NaN', () => {
    const p = P({ prezzoUnitario: null })[0]
    expect(eseguitoPartita(p, { partitaId: 'a', quantitaProgressiva: 100 })).toBe(0)
  })
  it('la somma dei certificati non supera mai il netto progressivo', () => {
    const res = calcolaSals(A({ arrotondamentoCertificato: 100, anticipazionePct: 20 }), P(), S(33.3, 71.7, 100))
    let somma = 0
    for (const r of res) { somma = Math.round((somma + r.importoSal) * 100) / 100; expect(somma).toBeLessThanOrEqual(r.nettoProgressivo + 0.005) }
  })
})

describe('revisione prezzi: la soglia e il segno', () => {
  const conRevisione = (indiceBase: number): Appalto => A({ revisione: { attiva: true, indiceBase } })
  const salConIndice = (qta: number[], indici: (number | null)[]): Sal[] =>
    qta.map((q, i) => ({ numero: i + 1, data: `0${i + 1}/07/2026`, righe: [{ partitaId: 'a', quantitaProgressiva: q }], indiceRevisione: indici[i] }))

  it('sotto la soglia del 3% non compensa nulla, ma la variazione si legge lo stesso', () => {
    const r = calcolaSals(conRevisione(100), P(), salConIndice([100], [102]))[0]
    expect(r.variazioneIndicePct).toBe(2)
    expect(r.revisioneSal).toBe(0)
  })
  it('sopra la soglia compensa il 90% della sola eccedenza', () => {
    // indice +5% su base 100: eccedenza 2 punti, riconosciuto 1,8% su 1.000 = 18
    const r = calcolaSals(conRevisione(100), P(), salConIndice([100], [105]))[0]
    expect(r.variazioneIndicePct).toBe(5)
    expect(r.revisioneSal).toBe(18)
    expect(r.totaleEseguito).toBe(1018)
  })
  it('in diminuzione opera al contrario: la clausola vale nei due sensi', () => {
    const r = calcolaSals(conRevisione(100), P(), salConIndice([100], [95]))[0]
    expect(r.revisioneSal).toBe(-18)
  })
  it('si applica alla quota eseguita IN QUESTO SAL, non al progressivo', () => {
    const res = calcolaSals(conRevisione(100), P(), salConIndice([100, 150], [105, 105]))
    expect(res[0].revisioneSal).toBe(18) // su 1.000
    expect(res[1].revisioneSal).toBe(9) // su 500, non su 1.500
    expect(res[1].revisioneProgressiva).toBe(27)
  })
  it('senza indice del periodo non si compensa e non si indovina', () => {
    const r = calcolaSals(conRevisione(100), P(), salConIndice([100], [null]))[0]
    expect(r.variazioneIndicePct).toBeNull()
    expect(r.revisioneSal).toBe(0)
  })
  it('clausola non attiva: nessuna compensazione, qualunque indice', () => {
    const r = calcolaSals(A(), P(), salConIndice([100], [130]))[0]
    expect(r.revisioneSal).toBe(0)
  })
})

describe('oneri della sicurezza: la quota segue l\'avanzamento e non lo supera', () => {
  it('a metà lavori, metà oneri', () => {
    const r = calcolaSals(A({ oneriSicurezza: 2000 }), P(), S(500))[0]
    expect(r.oneriSicurezzaEseguiti).toBe(1000)
  })
  it('eseguito oltre il contrattuale: gli oneri non superano il pattuito', () => {
    const r = calcolaSals(A({ oneriSicurezza: 2000 }), P(), S(1500))[0]
    expect(r.oneriSicurezzaEseguiti).toBe(2000)
  })
  it('nulla eseguito: nessun onere liquidato', () => {
    const r = calcolaSals(A({ oneriSicurezza: 2000 }), P(), S(0))[0]
    expect(r.oneriSicurezzaEseguiti).toBe(0)
  })
  it('gli oneri non si ribassano', () => {
    const r = calcolaSals(A({ oneriSicurezza: 2000, ribassoPct: 10 }), P(), S(1000))[0]
    expect(r.oneriSicurezzaEseguiti).toBe(2000)
    expect(r.ribassoImporto).toBe(1000) // solo sui 10.000 di lavori
  })
})

describe('IVA e totale lordo', () => {
  it("l'IVA si calcola sull'importo certificato, non sul credito prima dell'arrotondamento", () => {
    const r = calcolaSals(A({ arrotondamentoCertificato: 100, ivaPct: 22 }), P(), S(15.04))[0]
    expect(r.importoSal).toBe(100)
    expect(r.iva).toBe(22)
    expect(r.totaleLordo).toBe(122)
  })
  it('IVA a zero è un valore, non un campo mancante', () => {
    const r = calcolaSals(A({ ivaPct: 0 }), P(), S(100))[0]
    expect(r.iva).toBe(0)
    expect(r.totaleLordo).toBe(r.importoSal)
  })
})

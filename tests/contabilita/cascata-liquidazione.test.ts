/**
 * REGRESSIONE SULLA CASCATA DI LIQUIDAZIONE, verificata contro gli atti di un
 * lavoro reale (dati qui inventati, cifre nella stessa forma): lavori a misura
 * al lordo, ribasso sui soli lavori, costi della sicurezza non ribassati,
 * ritenuta di garanzia 0,50%, credito arrotondato per difetto a 100 euro.
 *
 * I documenti devono raccontare la stessa cascata: il registro e il sommario
 * chiudono sul contabilizzato LORDO (lavori + sicurezza), il SAL e il
 * certificato sull'importo da liquidare.
 */
import { describe, it, expect } from 'vitest'
import { calcolaSals } from '../../src/tools/contabilita/engine/contabilita'
import { registroHTML } from '../../src/tools/contabilita/engine/registro'
import { sommarioHTML } from '../../src/tools/contabilita/engine/sommario'
import { salHTML } from '../../src/tools/contabilita/engine/sal'
import { certificatoHTML } from '../../src/tools/contabilita/engine/certificato'
import type { Appalto, Partita, Sal } from '../../src/tools/contabilita/engine/types'

const appalto: Appalto = {
  oggetto: 'Edificio per sosta e ricovero autisti',
  ente: { denominazione: 'Comune di Prova' },
  impresa: { denominazione: 'Costruzioni Delta S.r.l.' },
  modalita: 'misura',
  ribassoPct: 5.086, ivaPct: 0, arrotondamentoCertificato: 100,
  dataStipula: '16/09/2025', numeroContratto: '2311',
  dataConsegna: '17/11/2025', giorniUtili: 100, articoloCapitolato: '2.18',
  direttoreLavori: 'ing. Prova', rup: 'arch. Prova',
}

const lavori: Partita = {
  id: 'm1', codice: '11.7.CP1.01.A', descrizione: 'Scavo di fondazione',
  um: 'm3', prezzoUnitario: 1, qtyProgetto: 200000, modalita: 'misura', categoria: 'Opere edili',
}
const sicurezza: Partita = {
  id: 's1', codice: 'SIC.SPCL', descrizione: 'Costi della sicurezza (apprestamenti del PSC)',
  um: '%', prezzoUnitario: 8016.52, qtyProgetto: 100, modalita: 'misura', categoria: 'Sicurezza', sicurezza: true,
}
const sal: Sal[] = [{
  numero: 1, data: '09/04/2026',
  righe: [
    { partitaId: 'm1', quantitaProgressiva: 101597.01 },
    { partitaId: 's1', quantitaProgressiva: 80 },
  ],
}]

describe('cascata di liquidazione del primo avanzamento', () => {
  const r = calcolaSals(appalto, [lavori, sicurezza], sal)[0]
  it('i lavori restano al lordo e la sicurezza non subisce il ribasso', () => {
    expect(r.lavoriMisura).toBe(101597.01)
    expect(r.oneriSicurezzaEseguiti).toBe(6413.22)
    expect(r.ribassoImporto).toBe(5167.22)
  })
  it('il contabilizzato è lavori netti più sicurezza', () => {
    expect(r.totaleContabilizzato).toBe(102843.01)
  })
  it('la ritenuta è lo 0,50% del contabilizzato e il credito si arrotonda per difetto', () => {
    expect(r.ritenuta).toBe(514.22)
    expect(r.nettoProgressivo).toBe(102328.79)
    expect(r.importoSal).toBe(102300)
    expect(r.iva).toBe(0)
  })
  it('il registro chiude sul lordo, sicurezza compresa', () => {
    const h = registroHTML(appalto, [lavori, sicurezza], sal)
    expect(h).toContain('108.010,23')
    expect(h).toContain('Totale contabilizzato a tutto il SAL n. 1')
  })
  it('il sommario è voce per voce e chiude come il registro', () => {
    const h = sommarioHTML(appalto, [lavori, sicurezza], sal, 1)
    expect(h).toContain('LAVORI A MISURA')
    expect(h).toContain('COSTI DELLA SICUREZZA')
    expect(h).toContain('SOMMANO al SAL n. 1')
    expect(h).toContain('101.597,01')
    expect(h).toContain('6.413,22')
    expect(h).toContain('108.010,23')
  })
  it('il SAL porta i dati generali e l\'importo da liquidare', () => {
    const h = salHTML(appalto, [lavori, sicurezza], sal, 1)
    expect(h).toContain('Dati generali')
    expect(h).toContain('rep. n. 2311')
    expect(h).toContain('102.300,00')
    expect(h).not.toContain("Ribasso d'asta non indicato")
  })
  it('il certificato liquida la rata e la scrive in lettere', () => {
    const h = certificatoHTML(appalto, [lavori, sicurezza], sal, 1)
    expect(h).toContain('102.300,00')
    expect(h).toContain('514,22')
    expect(h).toContain('centoduemilatrecento/00')
  })
  it('senza ribasso indicato gli atti lo dichiarano invece di liquidare il lordo', () => {
    const h = salHTML({ ...appalto, ribassoPct: null }, [lavori, sicurezza], sal, 1)
    expect(h).toContain("Ribasso d'asta non indicato")
    const c = certificatoHTML({ ...appalto, ribassoPct: null }, [lavori, sicurezza], sal, 1)
    expect(c).toContain("Ribasso d'asta non indicato")
  })
})

describe('il ribasso si scrive come è stato offerto', () => {
  it('cinque virgola zero ottantasei, non cinque virgola zero nove', () => {
    const h = certificatoHTML(appalto, [lavori, sicurezza], sal, 1)
    expect(h).toContain('5,086%')
    expect(h).not.toContain('5,09%')
  })
  it("l'oggetto dei lavori non si taglia a metà parola", () => {
    const lungo = { ...appalto, oggetto: "LAVORI DI REALIZZAZIONE SERVIZI COMPLEMENTARI DELL'AUTOSTAZIONE EDIFICIO PER SOSTA E RICOVERO AUTISTI" }
    const h = certificatoHTML(lungo, [lavori, sicurezza], sal, 1)
    expect(h).not.toContain("DELL'AUTOSTAZI<")
    expect(h).toContain("DELL'AUTOSTAZIONE")
  })
})

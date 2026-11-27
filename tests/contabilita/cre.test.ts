/**
 * CERTIFICATO DI REGOLARE ESECUZIONE (art. 28 All. II.14): i contenuti minimi
 * del c. 2 (lett. a–f), il termine di tre mesi dall'ultimazione (c. 3) e il
 * richiamo ai limiti d'importo per sostituire il collaudo (c. 1).
 */
import { describe, it, expect } from 'vitest'
import { creHTML, scadenzaCre } from '../../src/tools/contabilita/engine'
import type { Appalto, Partita, Sal, Verbale } from '../../src/tools/contabilita/engine/types'
import { partiteDiProva } from './_fixture'

const appalto: Appalto = {
  oggetto: 'Manutenzione straordinaria scuola', cup: 'C11', cig: 'Z0A',
  ente: { denominazione: 'Comune di Prova' },
  impresa: { denominazione: 'Impresa Edile srl', indirizzo: 'Via Po 3' },
  rup: 'Ing. Rossi', direttoreLavori: 'Arch. Bianchi', numeroContratto: '45', dataStipula: '10/02/2026',
  baseAsta: 100000, importoOfferta: 80000, oneriSicurezza: 2000, ivaPct: 10, modalita: 'misto', giorniUtili: 120,
  perizie: [{ numero: 1, data: '01/05/2026', dataApprovazione: '10/05/2026', dalSal: 1, voci: [] }],
}
const partite: Partita[] = partiteDiProva()
const sals: Sal[] = [{ numero: 1, data: '01/06/2026', righe: [{ partitaId: partite[0].id, quantitaProgressiva: 50 }, { partitaId: partite[1].id, quotaPct: 100 }] }]
const verbali: Verbale[] = [{ id: 'c', tipo: 'consegna', data: '01/03/2026' }, { id: 'u', tipo: 'ultimazione', data: '20/06/2026' }]

describe('CRE — art. 28 Allegato II.14', () => {
  const html = creHTML(appalto, partite, sals, verbali, undefined, { data: '15/07/2026' })
  it('a) contratto e atti aggiuntivi', () => {
    expect(html).toContain('n. 45')
    expect(html).toContain('stipulato in data 10/02/2026')
    expect(html).toContain('Perizia di variante n. 1')
  })
  it('b) esecutore, c) direttore dei lavori', () => {
    expect(html).toContain('Impresa Edile srl')
    expect(html).toContain('Arch. Bianchi')
  })
  it('d) tempo prescritto e date effettive', () => {
    expect(html).toContain('01/03/2026')
    expect(html).toContain('120 giorni')
    expect(html).toContain('20/06/2026')
  })
  it('e) importo a saldo, in cifre e in lettere', () => {
    expect(html).toContain('IMPORTO A SALDO')
    expect(html).toContain('Diconsi euro')
  })
  it('f) la certificazione, firmata dal DL e vistata dal RUP', () => {
    expect(html).toContain('regolarmente eseguiti')
    expect(html).toContain('Il Direttore dei Lavori')
    expect(html).toContain('ne prende atto e ne conferma la completezza')
  })
  it('entro tre mesi dall\'ultimazione: nessun avviso', () => {
    expect(scadenzaCre('20/06/2026')).toBe('20/09/2026')
    expect(scadenzaCre('30/11/2026')).toBe('28/02/2027')
    expect(html).not.toContain('oltre il termine di tre mesi')
  })
  it('oltre i tre mesi: avviso sull\'atto', () => {
    expect(creHTML(appalto, partite, sals, verbali, undefined, { data: '01/10/2026' })).toContain('oltre il termine di tre mesi')
  })
  it('senza certificato di ultimazione: avviso', () => {
    expect(creHTML(appalto, partite, sals, [verbali[0]], undefined, { data: '15/07/2026' })).toContain('certificato di ultimazione dei lavori')
  })
  it('oltre 1 milione: richiama i casi dell\'art. 28 c. 1 lett. b)', () => {
    const grande = creHTML({ ...appalto, baseAsta: 2_000_000, importoOfferta: 1_800_000 }, partite, sals, verbali)
    expect(grande).toContain('art. 28 c. 1 lett. b)')
    expect(html).not.toContain('art. 28 c. 1 lett. b)')
  })
})

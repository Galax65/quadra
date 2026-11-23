import { describe, expect, it } from 'vitest'
import { datiContratto, datiContrattoHTML, certificatoHTML, type Appalto, type Partita, type Sal } from '../../src/tools/contabilita/engine'

const P: Partita[] = [
  { id: 'a', modalita: 'misura', codice: 'A', descrizione: 'Scavo', um: 'm³', prezzoUnitario: 100, qtyProgetto: 1000 },
  { id: 's', modalita: 'misura', codice: 'S', descrizione: 'Sicurezza', um: '%', prezzoUnitario: 5000, qtyProgetto: 100, sicurezza: true },
]
const A: Appalto = { oggetto: 'Percorso', ente: { denominazione: 'Comune' }, impresa: { denominazione: 'Impresa' }, modalita: 'misura', ribassoPct: 1, dataStipula: '10/01/2024', numeroContratto: '12/2024' }

describe('dati del contratto', () => {
  it('progetto, ribasso, contratto e sicurezza', () => {
    const d = datiContratto(A, P)
    expect(d.importoProgetto).toBe(105000)
    expect(d.sicurezza).toBe(5000)
    expect(d.importoContratto).toBe(104000)
    expect(d.importoConPerizie).toBeNull()
  })
  it('compaiono nel certificato di pagamento', () => {
    const sals: Sal[] = [{ numero: 1, data: '01/03/2024', righe: [{ partitaId: 'a', quantitaProgressiva: 100 }] }]
    const html = certificatoHTML(A, P, sals, 1)
    expect(html).toContain('Dati del contratto')
    expect(html).toContain('n. 12/2024 del 10/01/2024')
    expect(datiContrattoHTML(A, P)).toContain('104.000,00')
  })
})

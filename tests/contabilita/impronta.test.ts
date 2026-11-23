import { describe, expect, it } from 'vitest'
import { testoCanonicoSal, improntaSal, improntaTesto, verificaSal, improntaCorta, ALGO_IMPRONTA, type Appalto, type Partita, type Sal } from '../../src/tools/contabilita/engine'

/**
 * IMPRONTA DEL FASCICOLO (All. II.14 art. 12 c. 10): alla firma si sigilla ciò che
 * gli atti del SAL affermano. Il testo su cui si calcola l'hash è CANONICO — lo
 * stesso fascicolo dà sempre la stessa impronta — e copre i numeri della
 * contabilità, non la cronaca del file (note e sblocchi non contano).
 */
const appalto = (): Appalto => ({
  oggetto: 'Lavori', ente: { denominazione: 'Comune X' }, impresa: { denominazione: 'Impresa Y' }, modalita: 'misura', cig: 'Z123',
})
const partite = (): Partita[] => [
  { id: 'c1', modalita: 'misura', codice: 'A.01', descrizione: 'Scavo', um: 'mc', prezzoUnitario: 10, qtyProgetto: 100, introdottaSal: 1 },
  { id: 'k1', modalita: 'corpo', codice: 'C.01', descrizione: 'Impianto', importoContrattuale: 1000, introdottaSal: 1 },
]
const sals = (): Sal[] => [{
  numero: 1, data: '01/06/2026',
  righe: [
    { partitaId: 'c1', misurazioni: [{ descrizione: 'edificio', n: 2, l1: 5, l2: 5, h: 2, quantita: 100 }] },
    { partitaId: 'k1', quotaPct: 40 },
  ],
}]

describe('testo canonico del fascicolo', () => {
  it('riporta appalto, SAL, voci e misure in righe stabili', () => {
    const t = testoCanonicoSal(appalto(), partite(), sals(), 1)
    const righe = t.split('\n')
    expect(righe[0]).toBe('QUADRA-FASCICOLO-SAL|v1')
    expect(righe[1]).toContain('Comune X')
    expect(t).toContain('voce|A.01|Scavo|mc|misura|prezzo=10.00')
    expect(t).toContain('  misura|edificio|2.000|5.000|5.000|2.000|100.000')
    expect(t).toContain('quota=40.000')
    expect(t).toContain('eseguito=400.00')   // 40% di 1.000
  })

  it('lo stesso fascicolo dà sempre lo stesso testo', () => {
    expect(testoCanonicoSal(appalto(), partite(), sals(), 1)).toBe(testoCanonicoSal(appalto(), partite(), sals(), 1))
  })

  it('note e sblocchi NON entrano: non sono i numeri della contabilità', () => {
    const base = testoCanonicoSal(appalto(), partite(), sals(), 1)
    const s2 = sals(); s2[0].note = 'una nota qualsiasi'; s2[0].sblocchi = [{ data: '02/06/2026', motivo: 'correzione' }]
    expect(testoCanonicoSal(appalto(), partite(), s2, 1)).toBe(base)
  })

  it('una misura corretta cambia il testo', () => {
    const s2 = sals(); s2[0].righe[0].misurazioni![0].h = 2.5; s2[0].righe[0].misurazioni![0].quantita = 125
    expect(testoCanonicoSal(appalto(), partite(), s2, 1)).not.toBe(testoCanonicoSal(appalto(), partite(), sals(), 1))
  })
})

describe('impronta e verifica', () => {
  it('è un SHA-256 esadecimale, stabile e sensibile a una virgola', async () => {
    const h = await improntaSal(appalto(), partite(), sals(), 1)
    expect(h).toMatch(/^[0-9a-f]{64}$/)
    expect(await improntaSal(appalto(), partite(), sals(), 1)).toBe(h)
    const s2 = sals(); s2[0].righe[1].quotaPct = 40.01
    expect(await improntaSal(appalto(), partite(), s2, 1)).not.toBe(h)
    expect(ALGO_IMPRONTA).toBe('SHA-256')
  })

  it('senza crypto.subtle non inventa un\'impronta: dice che non si può', async () => {
    expect(await improntaTesto('x', undefined as never)).toMatch(/^[0-9a-f]{64}$/) // qui il sistema ce l'ha
    // simulo un ambiente senza digest passandone uno che non c'è
    const senza = await (async (): Promise<string | null> => {
      const salva = globalThis.crypto
      Object.defineProperty(globalThis, 'crypto', { value: {}, configurable: true })
      try { return await improntaTesto('x') } finally { Object.defineProperty(globalThis, 'crypto', { value: salva, configurable: true }) }
    })()
    expect(senza).toBeNull()
  })

  it('verifica: integro se nulla è cambiato, modificato se qualcosa lo è', async () => {
    const a = appalto(); const p = partite(); const s = sals()
    s[0].firmato = true; s[0].dataFirma = '05/06/2026'
    s[0].impronta = (await improntaSal(a, p, s, 1))!
    expect((await verificaSal(a, p, s, 1)).esito).toBe('integro')
    s[0].righe[0].misurazioni![0].quantita = 101
    const v = await verificaSal(a, p, s, 1)
    expect(v.esito).toBe('modificato')
    expect(v.attesa).toBe(s[0].impronta)
    expect(v.trovata).not.toBe(v.attesa)
  })

  it('un SAL senza sigillo non si verifica; firmato senza impronta non è un allarme', async () => {
    const s = sals()
    expect((await verificaSal(appalto(), partite(), s, 1)).esito).toBe('non-firmato')
    s[0].firmato = true
    expect((await verificaSal(appalto(), partite(), s, 1)).esito).toBe('senza-impronta')
  })

  it('anche un SAL SBLOCCATO col sigillo si verifica: è lì che serve saperlo', async () => {
    const a = appalto(); const p = partite(); const s = sals()
    s[0].firmato = true; s[0].impronta = (await improntaSal(a, p, s, 1))!
    // il DL sblocca per correggere una misura: il sigillo resta e non torna più
    s[0].firmato = false
    s[0].sblocchi = [{ data: '06/06/2026', motivo: 'correzione' }]
    expect((await verificaSal(a, p, s, 1)).esito).toBe('integro')
    s[0].righe[0].misurazioni![0].quantita = 110
    expect((await verificaSal(a, p, s, 1)).esito).toBe('modificato')
  })

  it('l\'impronta corta si legge in interfaccia', () => {
    expect(improntaCorta('a'.repeat(64))).toBe('aaaaaaaa…aaaaaaaa')
    expect(improntaCorta(null)).toBe('—')
  })
})

import { describe, expect, it } from 'vitest'
import {
  registroAttiHTML, pacchettoAperto, vociCsv, misureCsv, salCsv, improntedCsv, eseguitoCsv, righeDi,
  improntaSal, type Appalto, type Partita, type Sal, type Consegna, type Verifica,
} from '../../src/tools/contabilita/engine'

/**
 * CONTABILITÀ DIGITALE (All. II.14 art. 12 c. 10): autenticità e provenienza dei
 * dati. Due documenti lo attestano: il REGISTRO DEGLI ATTI (cosa è stato prodotto,
 * con quale impronta, e se i fascicoli firmati sono ancora quelli) e l'EXPORT IN
 * FORMATO APERTO (la contabilità resta leggibile senza il programma).
 */
const appalto = (): Appalto => ({
  oggetto: 'Recupero del sentiero', ente: { denominazione: 'Comune X' }, impresa: { denominazione: 'Impresa Y' },
  modalita: 'misto', cig: 'Z123', direttoreLavori: 'arch. A', rup: 'ing. B',
})
const partite = (): Partita[] => [
  { id: 'c1', modalita: 'misura', codice: 'A.01', descrizione: 'Scavo', um: 'mc', prezzoUnitario: 8, prezzoContratto: 8, qtyProgetto: 100, introdottaSal: 1, categoria: 'Opere edili' },
  { id: 'k1', modalita: 'corpo', codice: 'C.01', descrizione: 'Impianto', importoContrattuale: 1000, introdottaSal: 1 },
  { id: 'n1', modalita: 'misura', codice: 'NP.01', descrizione: 'Rivestimento', um: 'mq', prezzoUnitario: 44, qtyProgetto: 10, introdottaSal: 2, sicurezza: false,
    np: { numero: 1, stato: 'concordato', periziaN: null, origine: 'prezzario', base: { codice: 'X.9', descrizione: 'b', prezzo: 55, fonte: 'Prezzario' }, ribassoPct: 20 } },
]
const sals = (): Sal[] => [
  { numero: 1, data: '01/06/2026', firmato: true, dataFirma: '05/06/2026', impronta: 'a'.repeat(64), improntaAlgo: 'SHA-256',
    righe: [{ partitaId: 'c1', misurazioni: [{ descrizione: 'edificio', n: 2, l1: 5, l2: 5, h: 2, quantita: 100 }] }, { partitaId: 'k1', quotaPct: 40 }] },
  { numero: 2, data: '01/10/2026', righe: [{ partitaId: 'c1', quantitaProgressiva: 120 }, { partitaId: 'n1', quantitaProgressiva: 10 }] },
]
const consegne = (): Consegna[] => [
  { id: 'd1', tipo: 'libretto', label: 'Libretto delle misure', data: '01/06/2026', salNumero: 1, ts: 1_750_000_000_000, impronta: 'b'.repeat(64) },
  { id: 'd2', tipo: 'sal', label: 'SAL n. 1', data: '01/06/2026', salNumero: 1, ts: 1_750_000_060_000 },
]
const dati = () => ({ appalto: appalto(), partite: partite(), sals: sals(), consegne: consegne(), economia: [] })

describe('registro degli atti prodotti', () => {
  it('elenca gli atti con la loro impronta e i sigilli dei SAL firmati', () => {
    const html = registroAttiHTML(appalto(), consegne(), sals(), [])
    expect(html).toContain('Registro degli atti prodotti')
    expect(html).toContain('Libretto delle misure')
    expect(html).toContain('aaaaaaaa…aaaaaaaa')   // sigillo del SAL 1, in forma corta
    expect(html).toContain('bbbbbbbb…bbbbbbbb')   // impronta del libretto prodotto
    expect(html).toContain('SHA-256')
    expect(html).toContain('art. 12 c. 10')
    expect(html).not.toContain('SAL n. 2')         // il SAL 2 non è firmato: nessun sigillo
  })

  it('dice a chiare lettere se un fascicolo è stato modificato dopo la firma', () => {
    const v: Verifica[] = [{ salNumero: 1, esito: 'modificato', attesa: 'a'.repeat(64), trovata: 'c'.repeat(64) }]
    const html = registroAttiHTML(appalto(), consegne(), sals(), v)
    expect(html).toContain('MODIFICATO dopo la firma')
    expect(html).toContain('Attenzione')
    expect(registroAttiHTML(appalto(), consegne(), sals(), [{ salNumero: 1, esito: 'integro' }])).not.toContain('Attenzione')
  })

  it('non si spaccia per una firma digitale', () => {
    expect(registroAttiHTML(appalto(), [], [], [])).toContain('non</b> è una firma digitale')
  })
})

describe('export in formato aperto', () => {
  it('produce leggimi, JSON e le viste in CSV', () => {
    const file = pacchettoAperto(dati())
    expect(file.map((f) => f.nome)).toEqual([
      'LEGGIMI.txt', 'contabilita.json', 'voci.csv', 'misure.csv', 'eseguito.csv', 'sal.csv', 'impronte.csv',
    ])
    const json = JSON.parse(file.find((f) => f.nome === 'contabilita.json')!.testo)
    expect(json.formato).toBe('quadra-contabilita-aperta')
    expect(json.partite).toHaveLength(3)
    expect(json.sals).toHaveLength(2)
  })

  it('il leggimi spiega i file e dichiara le impronte', () => {
    const l = pacchettoAperto(dati())[0].testo
    expect(l).toContain('Recupero del sentiero')
    expect(l).toContain('misure.csv')
    expect(l).toContain('SAL n. 1 firmato il 05/06/2026')
    expect(l).toContain('a'.repeat(64))
    expect(l).toContain('firma digitale')  // lo dichiara: l'impronta non sostituisce la firma
  })

  it('i CSV usano il punto e virgola e la virgola decimale', () => {
    const v = vociCsv(dati())
    expect(v.split('\r\n')[0]).toBe('"Codice";"Designazione";"U.M.";"Modalità";"Prezzo di contratto";"Prezzo applicato";"Quantità di progetto / importo a corpo";"Categoria";"Sicurezza";"Nuovo prezzo";"Introdotta al SAL";"Soppressa al SAL"')
    expect(v).toContain('"A.01";"Scavo";"mc";"misura";8,00;8,00;100,000;"Opere edili"')
    expect(v).toContain('"NP 1 concordato"')
    expect(v).toContain('"C.01";"Impianto";"";"corpo";;;1000,00')
  })

  it('misure.csv è il libretto riga per riga, con il SAL e la voce', () => {
    const m = misureCsv(dati())
    expect(m).toContain('1;"01/06/2026";"A.01";"Scavo";"mc";1;"edificio";2,000;5,000;5,000;2,000;100,000;8,00')
    expect(m).toContain('"quota a corpo %"')                       // il corpo non ha misure: si dichiara
    expect(m).toContain('2;"01/10/2026";"A.01";"Scavo";"mc";;"quantità a tutto il SAL"')
    expect(righeDi({ nome: 'misure.csv', testo: m })).toBe(4)      // SAL 1: misura + quota a corpo · SAL 2: due quantità
  })

  it('sal.csv porta la cascata e il sigillo di ogni SAL', () => {
    const s = salCsv(dati())
    expect(s.split('\r\n')[0]).toContain('"Importo del SAL (netto IVA)";"Stato";"Firmato il";"Impronta SHA-256"')
    expect(s).toContain('"firmato";"05/06/2026";"' + 'a'.repeat(64) + '"')
    expect(s).toContain('"aperto"')
  })

  it('impronte.csv distingue i sigilli dagli atti prodotti', () => {
    const i = improntedCsv(dati())
    expect(i).toContain('"sigillo SAL";1;"05/06/2026"')
    expect(i).toContain('"atto prodotto"')
    expect(i).toContain('"Libretto delle misure"')
  })

  it('eseguito.csv riepiloga per voce a tutto l\'ultimo SAL', async () => {
    const e = eseguitoCsv(dati())
    expect(e.split('\r\n')[0]).toContain('Eseguito a tutto il SAL n. 2')
    expect(e).toContain('"A.01";"Scavo";"mc";8,00;100,000;960,00')  // 120 mc × 8
    // e l'impronta del fascicolo resta calcolabile sugli stessi dati
    expect(await improntaSal(appalto(), partite(), sals(), 2)).toMatch(/^[0-9a-f]{64}$/)
  })

  it('una contabilità vuota non rompe l\'export', () => {
    const file = pacchettoAperto({ appalto: appalto(), partite: [], sals: [] })
    expect(file).toHaveLength(7)
    expect(file.find((f) => f.nome === 'LEGGIMI.txt')!.testo).toContain('Nessun SAL firmato')
  })
})

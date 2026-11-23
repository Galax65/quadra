/**
 * GIRO DI ANDATA E RITORNO DELL'XPWE: quello che Quadra scrive, Quadra lo
 * rilegge identico. È la prova che il tracciato di interscambio non perde per
 * strada le misure, le categorie, la WBS, la sicurezza, i lavori a corpo e i
 * nuovi prezzi — le cose che, se si perdono, se ne accorge solo chi riapre il
 * file dall'altra parte, a contabilità già chiusa.
 */
import { describe, it, expect } from 'vitest'
import { buildXpwe, parseXpwe, xpweToVoci, type VoceComputo } from '../../src/shared/xpwe/xpwe'
import { importoQta } from '../../src/shared/importo'

const voci: VoceComputo[] = [
  {
    codice: '01.A01.001', desc_short: 'Scavo di sbancamento', declaratoria: 'Scavo di sbancamento eseguito con mezzi meccanici, compreso il carico.',
    um: 'm3', prezzo: 12.45, categoria: 'Opere edili · Movimenti di terra', wbs: '01.02',
    misurazioni: [
      { descrizione: 'lato nord', n: 2, l1: 12.5, l2: 3, h: 1.2, quantita: 2 * 12.5 * 3 * 1.2 },
      { descrizione: 'lato sud', n: 1, l1: 8, l2: 3, h: 1.2, quantita: 1 * 8 * 3 * 1.2 },
    ],
  },
  {
    codice: '02.B02.010', desc_short: 'Calcestruzzo per fondazioni', um: 'm3', prezzo: 145.9,
    categoria: 'Strutture', wbs: '02.01', misurazioni: [{ descrizione: 'platea', n: 1, l1: 10, l2: 6, h: 0.3, quantita: 10 * 6 * 0.3 }],
    incMdo: 28.5,
  },
  {
    codice: 'NP.01', desc_short: 'Nuovo prezzo di variante', um: 'm2', prezzo: 33.7, qty: 120,
    np: true, codiceOrig: '01.A01.001', analisiPrezzi: true, categoria: 'Opere edili',
  },
  {
    codice: 'SIC.01', desc_short: 'Apprestamenti del PSC', um: '%', prezzo: 8016.52, qty: 100,
    sicurezza: true, categoria: 'Sicurezza',
  },
  {
    codice: 'CORPO.01', desc_short: "Corpo d'opera: impianto elettrico", um: 'a corpo', prezzo: 24500, qty: 1,
    corpo: true, categoria: 'Impianti',
  },
  {
    codice: '03.C01.005', desc_short: 'Soglie in pietra', um: 'm2', prezzo: 358.21, qty: 1.53,
    categoria: 'Opere edili', prezzoOfferto: 340.3,
  },
]

const ritorno = (v: VoceComputo[]): VoceComputo[] => xpweToVoci(parseXpwe(buildXpwe(v, { datiGenerali: { oggetto: 'Lavori di prova', committente: 'Comune di Prova' } })))

describe('XPWE: andata e ritorno', () => {
  const out = ritorno(voci)
  const di = (c: string): VoceComputo | undefined => out.find((v) => v.codice === c)

  it('tornano tutte le voci, con codice, descrizione, unità e prezzo', () => {
    expect(out.length).toBe(voci.length)
    for (const v of voci) {
      const r = di(v.codice)
      expect(r, v.codice).toBeTruthy()
      expect(r?.desc_short).toBe(v.desc_short)
      expect(r?.um).toBe(v.um)
      expect(r?.prezzo).toBeCloseTo(v.prezzo as number, 2)
    }
  })
  it('le righe di misura tornano fattore per fattore', () => {
    const r = di('01.A01.001')
    expect(r?.misurazioni?.length).toBe(2)
    expect(r?.misurazioni?.[0]).toMatchObject({ n: 2, l1: 12.5, l2: 3, h: 1.2 })
    expect(r?.misurazioni?.[0].descrizione).toBe('lato nord')
  })
  it('le quantità calcolate dalle misure coincidono al centesimo', () => {
    const atteso = 2 * 12.5 * 3 * 1.2 + 1 * 8 * 3 * 1.2
    const r = di('01.A01.001')
    const qty = (r?.misurazioni || []).reduce((n, m) => n + (m.quantita || 0), 0)
    expect(Math.round(qty * 100) / 100).toBe(Math.round(atteso * 100) / 100)
    expect(Math.round((r?.qty || 0) * 100) / 100).toBe(Math.round(atteso * 100) / 100)
  })
  it('la declaratoria estesa non si perde', () => {
    expect(di('01.A01.001')?.declaratoria).toContain('mezzi meccanici')
  })
  it('categorie e WBS restano attaccate alla voce', () => {
    expect(di('01.A01.001')?.categoria).toBe('Opere edili · Movimenti di terra')
    expect(di('01.A01.001')?.wbs).toBe('01.02')
    expect(di('02.B02.010')?.wbs).toBe('02.01')
  })
  it('le voci di sicurezza restano di sicurezza', () => {
    expect(di('SIC.01')?.sicurezza).toBe(true)
    expect(di('01.A01.001')?.sicurezza).toBeFalsy()
  })
  it("i lavori a corpo restano a corpo", () => {
    expect(di('CORPO.01')?.corpo).toBe(true)
  })
  it('i nuovi prezzi restano nuovi prezzi, con la voce di derivazione', () => {
    expect(di('NP.01')?.np).toBe(true)
    expect(di('NP.01')?.codiceOrig).toBe('01.A01.001')
    expect(di('NP.01')?.analisiPrezzi).toBe(true)
  })
  it('il prezzo offerto non si perde', () => {
    expect(di('03.C01.005')?.prezzoOfferto).toBeCloseTo(340.3, 2)
  })
  it('senza estensione il file resta di sola compatibilità, e lo si sa', () => {
    const solo = xpweToVoci(parseXpwe(buildXpwe(voci, { estensioni: false })))
    expect(solo.find((v) => v.codice === 'CORPO.01')?.corpo).toBeUndefined()
    expect(solo.length).toBe(voci.length)
  })
  it('gli importi del computo coincidono al centesimo', () => {
    const tot = (lista: VoceComputo[]): number => Math.round(lista.reduce((n, v) => {
      const q = (v.misurazioni || []).length ? (v.misurazioni || []).reduce((s, m) => s + (m.quantita || 0), 0) : (v.qty ?? 0)
      return n + (importoQta(q, v.prezzo, v.um) || 0)
    }, 0) * 100) / 100
    expect(tot(out)).toBe(tot(voci))
  })
  it('i dati generali sopravvivono al giro', () => {
    const doc = parseXpwe(buildXpwe(voci, { datiGenerali: { oggetto: 'Lavori di prova', committente: 'Comune di Prova' } }))
    expect(doc.datiGenerali.oggetto).toBe('Lavori di prova')
    expect(doc.datiGenerali.committente).toBe('Comune di Prova')
  })
})

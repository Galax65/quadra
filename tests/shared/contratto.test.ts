import { describe, it, expect } from 'vitest'
import {
  FASI_PROGETTO, allaFase, descriviContratto, faseDi, faseSuccessiva, promuoviAContratto, sullaFase, vociDaRevisione,
} from '../../src/shared/contratto'
import type { VoceComputo } from '../../src/shared/xpwe/xpwe'

/**
 * LE FASI DEL PROGETTO E LA PROMOZIONE A CONTRATTO (tappa 8 di
 * Docs/06-Interfaccia-unica.md). Il computo in corso è il computo di una fase;
 * il contratto è un atto: QUALE computo, COME, fotografato.
 */
describe('le fasi del progetto', () => {
  it('si attraversano in ordine, e dopo l\'esecutivo viene il contratto', () => {
    expect([...FASI_PROGETTO]).toEqual(['PFTE', 'definitivo', 'esecutivo'])
    expect(faseSuccessiva('PFTE')).toBe('definitivo')
    expect(faseSuccessiva('definitivo')).toBe('esecutivo')
    expect(faseSuccessiva('esecutivo')).toBeNull()
  })
  it('un computo salvato prima delle fasi comincia dal PFTE', () => {
    expect(faseDi(undefined)).toBe('PFTE')
    expect(faseDi('boh')).toBe('PFTE')
    expect(faseDi('esecutivo')).toBe('esecutivo')
  })
  it('si dicono in italiano', () => {
    expect(allaFase('esecutivo')).toBe("all'esecutivo")
    expect(allaFase('definitivo')).toBe('al definitivo')
    expect(sullaFase('esecutivo')).toBe("sull'esecutivo")
  })
})

const VOCI: VoceComputo[] = [
  { codice: 'A.01', desc_short: 'Scavo', um: 'm3', prezzo: 100, qty: 10 },
  { codice: 'A.02', desc_short: 'Getto', um: 'm3', prezzo: 200, qty: 0, misurazioni: [{ descrizione: 'platea', quantita: 5 }] },
  { codice: 'S.01', desc_short: 'Recinzione', um: 'm', prezzo: 50, qty: 20, sicurezza: true },
]
const fonte = { tipo: 'revisione' as const, id: 'r2', nome: 'rev.01 Esecutivo', fase: 'esecutivo' }

describe('la promozione a contratto', () => {
  it('col ribasso: base d\'asta ribassata, sicurezza intatta, prezzi di progetto nelle voci', () => {
    const a = promuoviAContratto({ fonte, voci: VOCI, data: '10/03/2026', ts: 1, ribassoPct: 20 })
    expect(a.baseAsta).toBe(2000)          // 10×100 + 5×200
    expect(a.sicurezza).toBe(1000)
    expect(a.importo).toBe(2600)           // 2000 − 20% + 1000
    expect(a.ribassoPct).toBe(20)
    expect(a.prezziOfferti).toBeUndefined()
    expect(a.voci.map((v) => v.prezzo)).toEqual([100, 200, 50])
    expect(a.fonte).toEqual(fonte)
  })

  it('con l\'offerta: ogni voce porta il suo prezzo offerto, e il ribasso non si applica una seconda volta', () => {
    const offerta = { id: 'o1', nome: 'Impresa Rossi', prezzi: { 'A.01': 90 }, ribassoPct: 10 }
    const a = promuoviAContratto({ fonte, voci: VOCI, data: '', ts: 1, ribassoPct: 20, offerta })
    expect(a.prezziOfferti).toBe(true)
    expect(a.offerente).toBe('Impresa Rossi')
    expect(a.ribassoPct).toBeUndefined()
    const po = a.voci.map((v) => (v as { prezzoOfferto?: number }).prezzoOfferto)
    expect(po).toEqual([90, 180, undefined])  // A.01 offerto, A.02 col ribasso dell'offerta, la sicurezza no
    expect(a.importo).toBe(10 * 90 + 5 * 180 + 1000)
  })

  it('senza offerta, un prezzo offerto rimasto sulle voci non entra nel contratto', () => {
    const conVecchio = VOCI.map((v) => ({ ...v, prezzoOfferto: 1 }))
    const a = promuoviAContratto({ fonte, voci: conVecchio, data: '', ts: 1, ribassoPct: 5 })
    expect(a.voci.every((v) => (v as { prezzoOfferto?: number }).prezzoOfferto === undefined)).toBe(true)
  })

  it('è una fotografia: cambiare il computo dopo non cambia il contratto', () => {
    const voci = VOCI.map((v) => ({ ...v }))
    const a = promuoviAContratto({ fonte, voci, data: '', ts: 1 })
    voci[0].prezzo = 999
    expect(a.voci[0].prezzo).toBe(100)
    expect(a.importo).toBe(3000)
  })

  it('non nasce da un computo vuoto, né con un ribasso del 100%', () => {
    expect(() => promuoviAContratto({ fonte, voci: [], data: '', ts: 1 })).toThrow(/non ha voci/)
    expect(() => promuoviAContratto({ fonte, voci: VOCI, data: '', ts: 1, ribassoPct: 100 })).toThrow()
  })

  it('una revisione congelata torna un computo, con misure, categorie e sicurezza', () => {
    const v = vociDaRevisione([{ key: 'k', codice: 'A.01', descrizione: 'Scavo', um: 'm3', prezzo: 10, qty: 3, sicurezza: true, categoria: 'Scavi', misurazioni: [{ descrizione: 'x', quantita: 3 }] }])
    expect(v[0]).toEqual({ _key: 'k', codice: 'A.01', desc_short: 'Scavo', um: 'm3', prezzo: 10, qty: 3, categoria: 'Scavi', sicurezza: true, misurazioni: [{ descrizione: 'x', quantita: 3 }] })
  })

  it('si descrive in una riga: da dove viene e come', () => {
    expect(descriviContratto({ fonte, ribassoPct: 12.5 })).toBe('rev.01 Esecutivo · ribasso 12,5%')
    expect(descriviContratto({ fonte, prezziOfferti: true, offerente: 'Rossi' })).toBe('rev.01 Esecutivo · prezzi unitari di Rossi')
    expect(descriviContratto({ fonte })).toBe('rev.01 Esecutivo · senza ribasso')
  })
})

describe('fase e contratto restano nel file del progetto', () => {
  it('il Computo li salva e li ripristina nel .ehub', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const idx = readFileSync(resolve(__dirname, '../../src/tools/computo/legacy/index.js'), 'utf8')
    expect(idx).toContain("faseProgetto:S.faseProgetto||'PFTE'")
    expect(idx).toContain('contratto:S.contratto?JSON.parse(JSON.stringify(S.contratto)):null')
    expect(idx).toContain('S.faseProgetto=faseDi(state&&state.faseProgetto)')
    // e il contratto viaggia intero verso la Contabilità
    const ov = readFileSync(resolve(__dirname, '../../src/tools/computo/legacy/computo-overlay.js'), 'utf8')
    expect(ov).toContain('contratto:S.contratto||null')
  })
})

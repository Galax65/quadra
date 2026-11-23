import { describe, expect, it } from 'vitest'
import { articoli, stessoArticolo, modificaArticolo, ripristinaListino, rendiNuovoPrezzo, prossimoNP, variaPrezzi, confrontaConListino, applicaListino, type VoceElenco } from '../../src/shared/elenco-articoli'

const mk = (): Map<string, VoceElenco> => new Map<string, VoceElenco>([
  ['k1', { codice: 'A.01', desc_short: 'Scavo', um: 'm³', prezzo: 10, regione: 'FVG', anno: 2024 }],
  ['k2', { codice: 'A.01', desc_short: 'Scavo', um: 'm³', prezzo: 10, regione: 'FVG', anno: 2024 }],
  ['k3', { codice: 'B.02', desc_short: 'Muro', um: 'm²', prezzo: 50, regione: 'FVG', anno: 2024 }],
  ['k4', { codice: 'NP.001', desc_short: 'Gradini', um: 'cad', prezzo: 260, np: true }],
  ['k5', { desc_short: 'Composta', um: 'cad', prezzo: 5, analisiPrezzi: {} }],
])

describe('articoli dell\'elenco prezzi', () => {
  it('una riga per articolo, con gli usi nel computo', () => {
    const a = articoli(mk(), { k1: { qty: 2 }, k2: { qty: 3 }, k3: { qty: 0 } })
    expect(a.map((x) => [x.codice, x.chiavi.length, x.usi, x.quantita])).toEqual([['A.01', 2, 2, 5], ['B.02', 1, 0, 0], ['NP.001', 1, 0, 0], ['', 1, 0, 0]])
    expect(a[2].np).toBe(true); expect(a[3].analisi).toBe(true)
  })
  it('la modifica vale per tutte le voci dello stesso articolo, con storico e listino', () => {
    const v = mk()
    expect(stessoArticolo(v, 'k2')).toEqual(['k1', 'k2'])
    modificaArticolo(v, 'k2', { prezzo: 12, desc_short: 'Scavo a mano' }, { nota: 'terreno roccioso', data: '15/11/2026' })
    expect(v.get('k1')).toMatchObject({ prezzo: 12, desc_short: 'Scavo a mano', prezzoListino: 10 })
    expect(v.get('k1')!.storicoPrezzi).toEqual([{ data: '15/11/2026', da: 10, a: 12, nota: 'terreno roccioso' }])
    expect(articoli(v)[0].variazionePct).toBe(20)
    modificaArticolo(v, 'k1', { prezzo: 11 }, { data: '16/11/2026' })
    expect(v.get('k2')!.prezzoListino).toBe(10)
    ripristinaListino(v, 'k1', { data: '17/11/2026' })
    expect(v.get('k2')!.prezzo).toBe(10)
    expect(v.get('k2')!.storicoPrezzi).toHaveLength(3)
    expect(articoli(v)[0].variazionePct).toBeNull()
  })
  it('nuovo prezzo: codice NP successivo su tutte le copie, codice d\'origine conservato', () => {
    const v = mk()
    expect(prossimoNP(v.values())).toBe('NP.002')
    const r = rendiNuovoPrezzo(v, 'k1')
    expect(r).toEqual({ codice: 'NP.002', chiavi: ['k1', 'k2'] })
    expect(v.get('k2')).toMatchObject({ codice: 'NP.002', codiceOrig: 'A.01', np: true })
    expect(stessoArticolo(v, 'k1')).toEqual(['k1', 'k2'])
  })
  it('variazione % in blocco, salta le analisi', () => {
    const v = mk(); const a = articoli(v)
    expect(variaPrezzi(v, a.map((x) => x.id), 10, { data: 'x' })).toBe(3)
    expect(v.get('k1')!.prezzo).toBe(11); expect(v.get('k3')!.prezzo).toBe(55); expect(v.get('k4')!.prezzo).toBe(286)
    expect(v.get('k5')!.prezzo).toBe(5)
  })
  it('aggiornamento dal prezzario caricato, per codice e anno più recente', () => {
    const v = mk()
    const c = confrontaConListino(articoli(v), [
      { codice: 'A.01', prezzo: 10.5, anno: 2025, regione: 'FVG' }, { codice: 'A.01', prezzo: 9, anno: 2023 },
      { codice: 'B.02', prezzo: 50, anno: 2025 }, { codice: 'NP.001', prezzo: 1 },
    ])
    expect(c.map((x) => [x.codice, x.attuale, x.nuovo, x.diffPct])).toEqual([['A.01', 10, 10.5, 5]])
    expect(applicaListino(v, c, { data: 'x' })).toBe(1)
    expect(v.get('k2')).toMatchObject({ prezzo: 10.5, prezzoListino: 10.5, anno: 2025 })
    expect(v.get('k2')!.storicoPrezzi![0].nota).toBe('aggiornato al prezzario FVG 2025')
  })
})

describe('analisi prezzi: quantità di riferimento, arrotondamento, aggiornamento righe', () => {
  it('prezzo = totale ÷ quantità di riferimento, arrotondato', async () => {
    const { calcolaAnalisi, aggiornaRigheDaListino, incidenzaManodopera } = await import('../../src/shared/compositore/analisi-prezzi')
    const a: any = { id: 'x', codice: 'AP1', descrizioneBreve: 'Muretto', um: 'm', speseGeneraliPct: 15, utileImpresaPct: 10,
      righe: [{ tipo: 'manodopera', descrizione: 'Operaio', um: 'h', quantita: 10, prezzoUnitario: 30, fonte: { codice: 'RU.01', regione: 'FVG', anno: '2024' } },
        { tipo: 'materiale', descrizione: 'Pietra', um: 'm³', quantita: 2, prezzoUnitario: 50 }] }
    // (300+100)×1,15×1,10 = 506 per 1 m
    expect(calcolaAnalisi(a).prezzoUnitario).toBe(506)
    a.quantitaRiferimento = 10
    const t = calcolaAnalisi(a)
    expect([t.totaleAnalisi, t.prezzoUnitario]).toEqual([506, 50.6])
    expect(incidenzaManodopera(t)).toBe(59.29)
    a.arrotondamento = 1
    expect(calcolaAnalisi(a).prezzoUnitario).toBe(51)
    const ch = aggiornaRigheDaListino(a, [{ codice: 'RU.01', prezzo: 32, anno: 2025, regione: 'FVG' }, { codice: 'RU.01', prezzo: 31, anno: 2023 }])
    expect(ch).toEqual([{ indice: 0, da: 30, a: 32 }])
    expect(a.righe[0].fonte.anno).toBe('2025')
  })
})

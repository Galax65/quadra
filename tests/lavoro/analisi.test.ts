import { describe, it, expect } from 'vitest'
import {
  nuovoLavoro, nuovoComputo, chiudi, aggiungiVoce, promuoviAContratto, nuovaPerizia, aggiungiArticolo, revisione,
  analisiDi, nuovaAnalisi, modificaAnalisi, aggiungiRigaAnalisi, modificaRigaAnalisi, togliRigaAnalisi, duplicaAnalisi, togliAnalisi,
  applicaAnalisi, usiAnalisi, tipoDaVoce, alberoLavoro, importiPerizia, type Lavoro,
} from '../../src/shared/lavoro'
import { calcolaAnalisi } from '../../src/shared/compositore/analisi-prezzi'
import { paginaAnalisi } from '../../src/tools/lavoro/analisi-pagina'
import { analisiPrezziHTML, fascicoloAnalisiHTML } from '../../src/tools/computo/engine/analisi-prezzi-report'

/**
 * L'ANALISI PREZZI in «Lavoro»: un prezzo composto (manodopera, materiali,
 * noli, varie + spese generali + utile), del lavoro, applicato alla revisione
 * aperta come articolo «da analisi», collegato.
 */
const D = '01/01/2026'

function conAnalisi(): { l: Lavoro; id: string } {
  let l = nuovoLavoro()
  const a = nuovaAnalisi(l, { descrizioneBreve: 'Massetto in cls', um: 'm2' }); l = a.lavoro
  l = aggiungiRigaAnalisi(l, a.id, { tipo: 'manodopera', descrizione: 'Operaio specializzato', um: 'h', quantita: 0.5, prezzoUnitario: 36 })   // 18
  l = aggiungiRigaAnalisi(l, a.id, { tipo: 'materiale', descrizione: 'Calcestruzzo', um: 'm3', quantita: 0.06, prezzoUnitario: 120 })        // 7,20
  return { l, id: a.id }
}

describe("l'analisi: righe, spese generali, utile, prezzo", () => {
  it('codice proposto; costo diretto + 15% SG + 10% utile', () => {
    const { l, id } = conAnalisi()
    const a = analisiDi(l)[0]
    expect(a.codice).toBe('AP.01')
    const t = calcolaAnalisi(a)
    expect([t.costoDiretto, t.speseGenerali, t.utileImpresa, t.prezzoUnitario]).toEqual([25.2, 3.78, 2.9, 31.88])
    // riferita a 10 m2 e arrotondata a 5 centesimi
    const l2 = modificaAnalisi(modificaRigaAnalisi(l, id, 1, { quantita: 0.6 }), id, { quantitaRiferimento: 10, arrotondamento: 0.05 })
    expect(calcolaAnalisi(analisiDi(l2)[0]).prezzoUnitario).toBe(11.4)   // (18 + 72) × 1,15 × 1,10 = 113,85 ÷ 10 = 11,385 → 11,40
    expect(() => modificaAnalisi(l, id, { speseGeneraliPct: 120 })).toThrow()
    expect(analisiDi(togliRigaAnalisi(l, id, 0))[0].righe).toHaveLength(1)
  })

  it('duplica con un codice nuovo; elimina', () => {
    const { l, id } = conAnalisi()
    const d = duplicaAnalisi(l, id)
    expect(analisiDi(d.lavoro).map((a) => a.codice)).toEqual(['AP.01', 'AP.02'])
    expect(analisiDi(togliAnalisi(d.lavoro, id))).toHaveLength(1)
  })

  it('il tipo di una voce di prezzario: ore = manodopera, noli dalla descrizione', () => {
    expect(tipoDaVoce({ um: 'h', descrizione: 'Operaio comune' })).toBe('manodopera')
    expect(tipoDaVoce({ um: 'h', descrizione: 'Nolo di escavatore' })).toBe('nolo')
    expect(tipoDaVoce({ um: 'm3', descrizione: 'Sabbia' })).toBe('materiale')
  })
})

describe("applicata alla revisione aperta: un articolo «da analisi», collegato", () => {
  it('nasce, poi si aggiorna; la pagina dice dove il prezzo è rimasto indietro', () => {
    let { l, id } = conAnalisi()
    const r = nuovoComputo(l, { fase: 'esecutivo', data: D }); l = r.lavoro
    let x = applicaAnalisi(l, id, r.id); l = x.lavoro
    expect(x.nuovo).toBe(true)
    const art = revisione(l, r.id).articoli[0]
    expect(art).toMatchObject({ codice: 'AP.01', origine: 'analisi', analisi: id, prezzo: 31.88, um: 'm2' })
    l = modificaRigaAnalisi(l, id, 0, { quantita: 1 })
    expect(usiAnalisi(l, id)[0].aggiornato).toBe(false)
    expect(paginaAnalisi(l, analisiDi(l)[0], revisione(l, r.id))).toContain("diverso dall'analisi")
    x = applicaAnalisi(l, id, r.id); l = x.lavoro
    expect(x.nuovo).toBe(false)
    expect(revisione(l, r.id).articoli).toHaveLength(1)
    expect(usiAnalisi(l, id)[0].aggiornato).toBe(true)
    // revisione chiusa: non si applica
    l = aggiungiVoce(l, r.id, { articolo: revisione(l, r.id).articoli[0].id, quantita: 3 }).lavoro
    l = chiudi(l, r.id, D)
    expect(() => applicaAnalisi(l, id, r.id)).toThrow(/chiusa/)
  })

  it('in perizia fa un nuovo prezzo; non tocca il prezzo di un articolo di contratto', () => {
    let { l, id } = conAnalisi()
    const r = nuovoComputo(l, { fase: 'esecutivo', data: D }); l = r.lavoro
    const ar = aggiungiArticolo(l, r.id, { codice: 'AP.01', descrizione: 'Massetto', um: 'm2', prezzo: 30, origine: 'prezzario' }); l = ar.lavoro
    l = aggiungiVoce(l, r.id, { articolo: ar.id, quantita: 3 }).lavoro
    l = chiudi(l, r.id, D)
    l = promuoviAContratto(l, r.id, { data: D, ribassoPct: 10 }).lavoro
    const p = nuovaPerizia(l, { data: D }); l = p.lavoro
    expect(() => applicaAnalisi(l, id, p.id)).toThrow(/prezzo di contratto/)
    l = modificaAnalisi(l, id, { codice: 'NP.AP.01' })
    l = applicaAnalisi(l, id, p.id).lavoro
    expect(revisione(l, p.id).articoli.find((a) => a.codice === 'NP.AP.01')?.origine).toBe('analisi')
    expect(importiPerizia(l, p.id).variate).toBe(0)   // nessuna voce ancora: l'articolo è in elenco
  })
})

describe('la sidebar, la pagina, la stampa', () => {
  it('ANALISI PREZZI elenca le analisi con il prezzo; la pagina ha righe e quadro; si stampa', () => {
    const { l } = conAnalisi()
    const sez = alberoLavoro(l).find((s) => s.id === 'analisi')!
    expect(sez.nodi[0]).toMatchObject({ apre: { cosa: 'pagina' }, etichetta: 'AP.01 Massetto in cls', nota: '€ 31,88 al m2' })
    const a = analisiDi(l)[0]
    const h = paginaAnalisi(l, a, null)
    expect(h).toContain('Incidenza della manodopera')
    expect(h).toContain('€ 31,88')
    expect(h).toContain('serve una revisione aperta')
    expect(analisiPrezziHTML(a)).toContain('Massetto in cls')
    expect(fascicoloAnalisiHTML([a])).toContain('Indice delle analisi')
  })
})

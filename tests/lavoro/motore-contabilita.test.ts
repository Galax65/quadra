import { describe, it, expect } from 'vitest'
import {
  nuovoLavoro, nuovoComputo, chiudi, promuoviAContratto, nuovoSal, emetti, nuovaPerizia, nuovoSalFinale,
  modificaVoce, modificaArticolo, voceDaArticolo, modificaRigaAvanzamento, importiAvanzamento, impostaContabilita, type Lavoro,
} from '../../src/shared/lavoro'
import { contabilitaMotore } from '../../src/tools/lavoro/motore-contabilita'
import * as lib from 'pdf-lib'
import {
  calcolaSal, librettoPdf, registroPdf, sommarioPdf, statoFinalePdf, quadroComparativoPdf,
  salHTML, certificatoHTML, contoFinaleHTML, relazioneFinaleHTML, attoSottomissioneHTML, verbaleHTML, elencoNuoviPrezziHTML,
} from '../../src/tools/contabilita/engine'
import { periziaHTML } from '../../src/tools/contabilita/engine/perizia-atto'

/**
 * LE STAMPE CONTABILI le fa il motore della Contabilità: il lavoro si traduce
 * nei suoi dati. La prova che la traduzione è fedele: il motore fa gli stessi
 * conti della schermata, SAL per SAL, perizie e NP compresi.
 */
const D = '01/01/2026'

function catena(np: { soggetto?: boolean } = {}): { l: Lavoro; sal: string[]; perizia: string } {
  let l = nuovoLavoro({ oggetto: 'Scuola', committente: 'Comune di Prova', impresa: 'Edile Srl' })
  const r = nuovoComputo(l, { fase: 'esecutivo', data: D }); l = r.lavoro
  l = {
    ...l, revisioni: l.revisioni.map((x) => ({
      ...x,
      articoli: [
        { id: 'a1', codice: 'A.01', descrizione: 'Scavo', um: 'm3', prezzo: 20, origine: 'prezzario' as const },
        { id: 's1', codice: 'S.01', descrizione: 'Recinzione', um: 'm', prezzo: 5, origine: 'prezzario' as const, sicurezza: true },
      ],
      voci: [
        { id: 'v1', articolo: 'a1', misure: [], quantita: 10 },
        { id: 'v2', articolo: 's1', misure: [], quantita: 20 },
      ],
    })),
  }
  l = chiudi(l, r.id, D)
  const c = promuoviAContratto(l, r.id, { data: D, ribassoPct: 10 }); l = c.lavoro
  l = impostaContabilita(l, { anticipazionePct: 0 })
  const s1 = nuovoSal(l, D); l = s1.lavoro
  l = modificaRigaAvanzamento(l, s1.id, 'v1', { quantita: 4 })
  l = modificaRigaAvanzamento(l, s1.id, 'v2', { quantita: 10 })
  l = emetti(l, s1.id, D)
  const p = nuovaPerizia(l, { data: D }); l = p.lavoro
  l = modificaVoce(l, p.id, 'v1', { quantita: 15 })
  const n = voceDaArticolo(l, p.id, { codice: 'NP.01', descrizione: 'Pozzetto', um: 'cad', prezzo: 50, origine: 'np' }); l = n.lavoro
  l = modificaVoce(l, p.id, n.id, { quantita: 2 })
  if (np.soggetto === false) l = modificaArticolo(l, p.id, n.articolo, { soggettoRibasso: false })
  l = chiudi(l, p.id, D)
  const s2 = nuovoSal(l, D); l = s2.lavoro
  l = modificaRigaAvanzamento(l, s2.id, 'v1', { quantita: 12 })
  l = modificaRigaAvanzamento(l, s2.id, n.id, { quantita: 2 })
  l = emetti(l, s2.id, D)
  const f = nuovoSalFinale(l, D); l = f.lavoro
  l = modificaRigaAvanzamento(l, f.id, 'v1', { quantita: 15 })
  l = modificaRigaAvanzamento(l, f.id, 'v2', { quantita: 20 })
  return { l, sal: [s1.id, s2.id, f.id], perizia: p.id }
}

describe('il motore della Contabilità fa gli stessi conti della schermata', () => {
  for (const caso of [{ nome: 'NP ribassato', np: {} }, { nome: 'NP non soggetto a ribasso', np: { soggetto: false } }]) {
    it(`SAL 1, SAL 2 dopo la perizia, stato finale — ${caso.nome}`, () => {
      const { l, sal } = catena(caso.np)
      const m = contabilitaMotore(l)!
      for (const id of sal) {
        const a = l.avanzamenti.find((x) => x.id === id)!
        const mine = importiAvanzamento(l, id)
        const suo = calcolaSal(m.appalto, m.partite, m.sals, a.n, undefined, m.perizie)!
        expect({ sal: a.n, lordo: suo.lavoriEseguiti + suo.oneriSicurezzaEseguiti, netto: suo.totaleEseguito })
          .toEqual({ sal: a.n, lordo: mine.lordo, netto: mine.netto })
      }
    })
  }

  it('le partite: il contratto, più il NP dal SAL della perizia; la perizia con le nuove quantità', () => {
    const { l } = catena()
    const m = contabilitaMotore(l)!
    expect(m.partite.map((p) => [p.codice, p.introdottaSal ?? 1])).toEqual([['A.01', 1], ['S.01', 1], ['NP.01', 2]])
    expect(m.perizie).toHaveLength(1)
    expect(m.perizie[0]).toMatchObject({ numero: 1, dalSal: 2, approvata: true })
    expect(m.perizie[0].voci.find((v) => v.partitaId === 'v1')!.qty).toBe(15)
    expect(m.appalto).toMatchObject({ oggetto: 'Scuola', ribassoPct: 10, oneriSicurezza: 0, ente: { denominazione: 'Comune di Prova' } })
  })

  it('il certificato: ritenuta 0,5% e credito del SAL', () => {
    const { l } = catena()
    const m = contabilitaMotore(l)!
    const s1 = calcolaSal(m.appalto, m.partite, m.sals, 1, undefined, m.perizie)!
    // SAL 1: scavo 4 × 20 = 80 → 72 netti; sicurezza 10 × 5 = 50 → 122; ritenuta 0,61
    expect([s1.totaleEseguito, s1.ritenuta, s1.importoSal]).toEqual([122, 0.61, 121.39])
  })
})

describe('le stampe contabili del lavoro escono dal motore', () => {
  it('SAL: libretto, registro e sommario in PDF; SAL e certificato in HTML, con gli importi giusti', async () => {
    const { l } = catena()
    const m = contabilitaMotore(l)!
    for (const n of [1, 2, 3]) {
      const sal = m.sals.find((x) => x.numero === n)!
      expect((await librettoPdf(lib, m.appalto, m.partite, sal)).pagine).toBeGreaterThan(0)
      expect((await registroPdf(lib, m.appalto, m.partite, m.sals, n)).pagine).toBeGreaterThan(0)
      expect((await sommarioPdf(lib, m.appalto, m.partite, m.sals, n)).pagine).toBeGreaterThan(0)
    }
    const h = salHTML(m.appalto, m.partite, m.sals, 1)
    expect(h).toContain('Scuola')
    const cert = certificatoHTML(m.appalto, m.partite, m.sals, 1)
    expect(cert).toMatch(/121,39/)
  })

  it('stato finale, conto finale, relazione', async () => {
    const { l } = catena()
    const m = contabilitaMotore(l)!
    expect((await statoFinalePdf(lib, m.appalto, m.partite, m.sals)).pagine).toBeGreaterThan(0)
    expect(contoFinaleHTML(m.appalto, m.partite, m.sals)).toContain('Scuola')
    expect(relazioneFinaleHTML(m.appalto, m.partite, m.sals)).toContain('Scuola')
  })

  it('la perizia: atto, quadro comparativo, verbale ed elenco dei nuovi prezzi, atto di sottomissione', async () => {
    const { l } = catena()
    const m = contabilitaMotore(l)!
    const pz = m.perizie[0]
    expect(periziaHTML(m.appalto, m.partite, pz)).toContain('NP.01')
    expect((await quadroComparativoPdf(lib, m.appalto, m.partite, pz)).pagine).toBeGreaterThan(0)
    const np = m.partite.filter((p) => p.np)
    expect(np.map((p) => [p.codice, p.np!.numero, p.np!.stato, p.np!.periziaN])).toEqual([['NP.01', 1, 'approvato', 1]])
    expect(elencoNuoviPrezziHTML(m.appalto, np)).toContain('Pozzetto')
    expect(verbaleHTML(m.appalto, { id: 'v', tipo: 'nuoviprezzi', data: D }, np)).toContain('Pozzetto')
    expect(attoSottomissioneHTML(m.appalto, m.partite, pz)).toContain('Scuola')
  })
})

describe('le liste in economia: nei conti della schermata e del motore', () => {
  it('una lista nel SAL 2: lordo e netto crescono del suo valore, senza ribasso', async () => {
    const m = await import('../../src/shared/lavoro')
    let { l } = catena()
    const e = m.aggiungiLista(l, '15/03/2026', 2); l = e.lavoro
    // il SAL 2 è già emesso nella catena di prova: la lista si scrive solo se il SAL è aperto, quindi la si prepara prima
    l = { ...l, atti: { ...m.attiDi(l), economie: m.attiDi(l).economie.map((x) => ({ ...x, operai: [{ qualifica: 'operaio comune', ore: 8, tariffaOraria: 30 }], provviste: [{ descrizione: 'sabbia', um: 'm3', quantita: 2, prezzoUnitario: 25 }] })) } }
    expect(m.valoreLista(m.attiDi(l).economie[0])).toEqual({ manodopera: 240, noli: 0, provviste: 50, totale: 290 })
    const mot = contabilitaMotore(l)!
    for (const id of l.avanzamenti.filter((a) => a.tipo !== 'cre').map((a) => a.id)) {
      const a = l.avanzamenti.find((x) => x.id === id)!
      const mine = importiAvanzamento(l, id)
      const suo = calcolaSal(mot.appalto, mot.partite, mot.sals, a.n, mot.liste, mot.perizie)!
      expect({ n: a.n, lordo: r2(suo.lavoriEseguiti + suo.oneriSicurezzaEseguiti), netto: suo.totaleEseguito }).toEqual({ n: a.n, lordo: mine.lordo, netto: mine.netto })
    }
    expect(importiAvanzamento(l, l.avanzamenti[0].id).economia).toBe(0)
    expect(importiAvanzamento(l, l.avanzamenti[1].id).economia).toBe(290)
  })

  it('una lista di un SAL emesso non si cambia', async () => {
    const m = await import('../../src/shared/lavoro')
    let { l } = catena()
    l = { ...l, atti: { ...m.nuoviAtti(), economie: [{ id: 'e1', numero: 1, data: D, salNumero: 1, operai: [], mezzi: [], provviste: [] }] } }
    expect(() => m.modificaLista(l, 'e1', { note: 'x' })).toThrow(/già emesso/)
  })
})

const r2 = (n: number): number => Math.round(n * 100) / 100

describe('le detrazioni del SAL: nei conti della schermata e nel certificato', () => {
  it('si tolgono dal contabilizzato; il SAL dopo parte dal netto con le detrazioni', async () => {
    const m = await import('../../src/shared/lavoro')
    let l = m.nuovoLavoro()
    const r = m.nuovoComputo(l, { fase: 'esecutivo', data: D }); l = r.lavoro
    const a = m.aggiungiArticolo(l, r.id, { codice: 'A.01', descrizione: 'Scavo', um: 'm3', prezzo: 20, origine: 'prezzario' }); l = a.lavoro
    const v = m.aggiungiVoce(l, r.id, { articolo: a.id, quantita: 100 }); l = v.lavoro
    l = m.chiudi(l, r.id, D)
    l = m.promuoviAContratto(l, r.id, { data: D, ribassoPct: 10 }).lavoro
    const s = m.nuovoSal(l, D); l = m.modificaRigaAvanzamento(s.lavoro, s.id, v.id, { quantita: 50 })
    l = m.datiAvanzamento(l, s.id, { detrazioni: 100, note: 'tratto non conforme' })
    const mine = m.importiAvanzamento(l, s.id)
    expect(mine).toMatchObject({ lordo: 1000, detrazioni: 100, netto: 800 })
    const mot = contabilitaMotore(l)!
    expect(calcolaSal(mot.appalto, mot.partite, mot.sals, 1, mot.liste, mot.perizie)!.totaleContabilizzato).toBe(800)
    l = m.emetti(l, s.id, D)
    expect(() => m.datiAvanzamento(l, s.id, { detrazioni: 1 })).toThrow(/emesso/)
  })
})

import { describe, it, expect } from 'vitest'
import {
  nuovoLavoro, nuovoComputo, rinumera, descrivi, chiudi, riapri, promuoviAContratto, nuovoSal, emetti, riapriAvanzamento,
  nuovaPerizia, nuovoSalFinale, nuovoCre, vigente, modificabile, numeroDi, numeroProposto, sigla, quantitaVoce, importiRevisione,
  alberoLavoro, revisione, type Lavoro,
} from '../../src/shared/lavoro'

/**
 * IL LAVORO (tappa 1 di Docs/07-Un-lavoro-un-modulo.md). Il test principale
 * rifà la catena dell'esempio di chi usa il programma, dal PFTE al CRE, e
 * controlla che la sidebar esca come l'ha disegnata:
 *
 *   COMPUTO      PFTE rev.00 · PFTE rev.01 · Esecutivo rev.02 · Esecutivo rev.05
 *   CONTRATTO    rev.06
 *   CONTABILITÀ  SAL 1 rev.06 · SAL 2 rev.06 · Perizia rev.07 · SAL 3 rev.07 ·
 *                SAL 4 rev.07 · SAL finale rev.07 · CRE rev.07
 */
const D = '01/01/2026'

/** Un computo con una voce misurata: scavo, 10 m3 a € 20, più la sicurezza. */
function conVoci(l: Lavoro, id: string): Lavoro {
  return {
    ...l,
    revisioni: l.revisioni.map((r) => (r.id !== id ? r : {
      ...r,
      articoli: [
        { id: 'a1', codice: 'A.01', descrizione: 'Scavo', um: 'm3', prezzo: 20, origine: 'prezzario' },
        { id: 's1', codice: 'S.01', descrizione: 'Recinzione', um: 'm', prezzo: 5, origine: 'prezzario', sicurezza: true },
      ],
      voci: [
        { id: 'v1', articolo: 'a1', misure: [{ descrizione: 'platea', quantita: 6 }, { descrizione: 'cordolo', quantita: 4 }] },
        { id: 'v2', articolo: 's1', misure: [], quantita: 20 },
      ],
    })),
  }
}

function catenaDellEsempio(): Lavoro {
  let l = nuovoLavoro({ oggetto: 'Scuola di via Roma' })
  let r = nuovoComputo(l, { fase: 'PFTE', data: D }); l = conVoci(r.lavoro, r.id); l = chiudi(l, r.id, D)
  r = nuovoComputo(l, { fase: 'PFTE', data: D, da: r.id }); l = chiudi(r.lavoro, r.id, D)
  r = nuovoComputo(l, { fase: 'esecutivo', data: D, da: r.id }); l = chiudi(r.lavoro, r.id, D)
  // rev.05: in mezzo, revisioni del progetto che non hanno toccato il computo
  r = nuovoComputo(l, { fase: 'esecutivo', data: D, da: r.id, numero: 5 }); l = chiudi(r.lavoro, r.id, D)
  const c = promuoviAContratto(l, r.id, { data: D, ribassoPct: 12.35 }); l = chiudi(c.lavoro, c.id, D)
  let s = nuovoSal(l, D); l = emetti(s.lavoro, s.id, D)
  s = nuovoSal(l, D); l = emetti(s.lavoro, s.id, D)
  const p = nuovaPerizia(l, { data: D }); l = chiudi(p.lavoro, p.id, D)
  s = nuovoSal(l, D); l = emetti(s.lavoro, s.id, D)
  s = nuovoSal(l, D); l = emetti(s.lavoro, s.id, D)
  s = nuovoSalFinale(l, D); l = emetti(s.lavoro, s.id, D)
  s = nuovoCre(l, D); l = s.lavoro
  return l
}

describe('la catena di un lavoro, dal PFTE al CRE', () => {
  const l = catenaDellEsempio()
  const albero = alberoLavoro(l)
  const righe = (id: string): string[] => albero.find((s) => s.id === id)!.nodi.map((n) => `${n.etichetta} ${n.sigla ?? ''}`.trim())

  it('la sidebar è quella disegnata', () => {
    // le sezioni disegnate da chi usa il programma, più gli atti del cantiere in coda
    expect(albero.map((s) => s.titolo)).toEqual(['DATI DEL LAVORO', 'ANALISI PREZZI', 'ELENCO PREZZI', 'COMPUTO', 'CONTRATTO', 'CONTABILITÀ', 'CANTIERE'])
    expect(righe('computo')).toEqual(['PFTE rev.00', 'PFTE rev.01', 'Esecutivo rev.02', 'Esecutivo rev.05'])
    expect(righe('contratto')).toEqual(['Contratto rev.06'])
    expect(righe('contabilita')).toEqual([
      'SAL 1 rev.06', 'SAL 2 rev.06', 'Perizia di variante rev.07', 'SAL 3 rev.07', 'SAL 4 rev.07', 'SAL finale rev.07', 'CRE rev.07',
    ])
    expect(albero[0].nodi[0].etichetta).toBe('Scuola di via Roma')
  })

  it('i SAL non hanno un numero proprio: portano quello da cui leggono i prezzi', () => {
    const sal = l.avanzamenti.filter((a) => a.tipo === 'sal')
    expect(sal.map((a) => numeroDi(l, a.id))).toEqual([6, 6, 7, 7])
    expect(vigente(l)!.tipo).toBe('perizia')
  })

  it('le tappe chiuse sono in sola lettura, e lo dicono', () => {
    const computo = albero.find((s) => s.id === 'computo')!.nodi[0]
    expect(computo.stato).toBe('chiusa')
    expect(computo.nota).toContain('consegnata')
    expect(albero.find((s) => s.id === 'contratto')!.nodi[0].nota).toContain('ribasso 12,35%')   // in vigore: la sidebar dice l'offerta
    const cre = albero.find((s) => s.id === 'contabilita')!.nodi.at(-1)!
    expect(cre.stato).toBe('aperta')
    expect(modificabile(l, l.revisioni[0].id)).toBe(false)
  })

  it('sotto ogni tappa, i suoi documenti', () => {
    const sal = albero.find((s) => s.id === 'contabilita')!.nodi[0]
    expect(sal.documenti!.map((d) => d.tipo)).toEqual(['fascicolo', 'consuntivo-pdf', 'libretto', 'registro', 'sommario', 'sal', 'certificato'])
    expect(albero.find((s) => s.id === 'computo')!.nodi[0].documenti!.map((d) => d.tipo)).toContain('computo-metrico')
  })

  it('il contratto porta voci, prezzi e ribasso del computo da cui nasce', () => {
    const c = l.revisioni.find((r) => r.tipo === 'contratto')!
    expect(c.contratto).toEqual({ ribassoPct: 12.35 })
    expect(c.voci).toHaveLength(2)
    expect(revisione(l, c.da!).numero).toBe(5)
  })
})

describe('la numerazione', () => {
  it('è proposta in ordine, ma si può scegliere, e può saltare', () => {
    let l = nuovoLavoro()
    expect(numeroProposto(l)).toBe(0)
    const a = nuovoComputo(l, { fase: 'PFTE', data: D }); l = a.lavoro
    expect(numeroProposto(l)).toBe(1)
    const b = nuovoComputo(l, { fase: 'PFTE', data: D, numero: 4 }); l = b.lavoro
    expect(revisione(l, b.id).numero).toBe(4)
    expect(numeroProposto(l)).toBe(5)
  })

  it('resta unica e in ordine lungo la catena', () => {
    let l = nuovoLavoro()
    const a = nuovoComputo(l, { fase: 'PFTE', data: D }); l = a.lavoro
    const b = nuovoComputo(l, { fase: 'PFTE', data: D, numero: 5 }); l = b.lavoro
    expect(() => nuovoComputo(l, { fase: 'PFTE', data: D, numero: 5 })).toThrow(/già usato/)
    expect(() => nuovoComputo(l, { fase: 'PFTE', data: D, numero: 3 })).toThrow(/dopo rev.05/)
    expect(() => rinumera(l, b.id, 0)).toThrow(/già usato/)
    expect(() => rinumera(l, a.id, 6)).toThrow(/prima di rev.05/)
    l = rinumera(l, a.id, 2)
    expect(revisione(l, a.id).numero).toBe(2)
    expect(() => rinumera(l, a.id, -1)).toThrow()
  })

  it('rinumerare il contratto lo segue sui SAL', () => {
    let l = nuovoLavoro()
    const a = nuovoComputo(l, { fase: 'esecutivo', data: D }); l = chiudi(conVoci(a.lavoro, a.id), a.id, D)
    const c = promuoviAContratto(l, a.id, { data: D }); l = chiudi(c.lavoro, c.id, D)
    const s = nuovoSal(l, D); l = s.lavoro
    l = rinumera(l, c.id, 10)
    expect(numeroDi(l, s.id)).toBe(10)
    expect(sigla(numeroDi(l, s.id))).toBe('rev.10')
  })
})

describe('chiudere e riaprire', () => {
  const base = (): { l: Lavoro; id: string } => {
    const a = nuovoComputo(nuovoLavoro(), { fase: 'esecutivo', data: D })
    return { l: conVoci(a.lavoro, a.id), id: a.id }
  }

  it('un computo vuoto non si consegna; consegnato non si modifica', () => {
    const v = nuovoComputo(nuovoLavoro(), { fase: 'PFTE', data: D })
    expect(() => chiudi(v.lavoro, v.id, D)).toThrow(/senza voci/)
    const { l, id } = base()
    const c = chiudi(l, id, '02/02/2026')
    expect(modificabile(c, id)).toBe(false)
    expect(revisione(c, id).chiusaIl).toBe('02/02/2026')
  })

  it('si riapre finché niente di chiuso ci poggia sopra', () => {
    let { l, id } = base()
    l = chiudi(l, id, D)
    expect(modificabile(riapri(l, id), id)).toBe(true)
    const c = promuoviAContratto(l, id, { data: D }); l = chiudi(c.lavoro, c.id, D)
    expect(() => riapri(l, id)).toThrow(/contratto stipulato/)
    const s = nuovoSal(l, D); l = emetti(s.lavoro, s.id, D)
    expect(() => riapri(l, c.id)).toThrow(/SAL n. 1 emesso/)
  })

  it('il contratto nasce da un computo consegnato, una volta sola, con ribasso o prezzi offerti', () => {
    let { l, id } = base()
    expect(() => promuoviAContratto(l, id, { data: D })).toThrow(/Prima si consegna/)
    l = chiudi(l, id, D)
    expect(() => promuoviAContratto(l, id, { data: D, ribassoPct: 10, prezziOfferti: { a1: 18 } })).toThrow(/due volte/)
    expect(() => promuoviAContratto(l, id, { data: D, ribassoPct: 100 })).toThrow()
    const c = promuoviAContratto(l, id, { data: D, prezziOfferti: { a1: 18 }, offerente: 'Rossi' })
    expect(importiRevisione(revisione(c.lavoro, c.id)).lavori).toBe(180) // 10 m3 × 18 offerto
    expect(() => promuoviAContratto(c.lavoro, id, { data: D })).toThrow(/c'è già/)
    expect(() => nuovoComputo(c.lavoro, { fase: 'esecutivo', data: D })).toThrow(/perizia/)
  })

  it('i SAL si emettono in ordine; uno nuovo solo dopo aver emesso il precedente, e parte dalle sue misure', () => {
    let { l, id } = base()
    l = chiudi(l, id, D)
    expect(() => nuovoSal(l, D)).toThrow(/contratto/)
    const c = promuoviAContratto(l, id, { data: D })
    // il contratto nasce in vigore: niente stipula, il SAL si apre subito
    expect(revisione(c.lavoro, c.id).stato).toBe('chiusa')
    l = c.lavoro
    const s1 = nuovoSal(l, D); l = s1.lavoro
    l = { ...l, avanzamenti: l.avanzamenti.map((a) => (a.id === s1.id ? { ...a, righe: [{ voce: 'v1', misure: [{ quantita: 4 }] }] } : a)) }
    expect(() => nuovoSal(l, D)).toThrow(/Prima si emette il SAL n. 1/)
    l = emetti(l, s1.id, D)
    const s2 = nuovoSal(l, D); l = s2.lavoro
    expect(l.avanzamenti.find((a) => a.id === s2.id)!.righe).toEqual([{ voce: 'v1', misure: [{ quantita: 4 }] }])
    expect(() => riapriAvanzamento(l, s1.id)).toThrow(/solo l'ultimo/)
  })

  it('una perizia alla volta, e il CRE solo dopo il SAL finale emesso', () => {
    let { l, id } = base()
    l = chiudi(l, id, D)
    const c = promuoviAContratto(l, id, { data: D }); l = chiudi(c.lavoro, c.id, D)
    const p = nuovaPerizia(l, { data: D }); l = p.lavoro
    expect(() => nuovaPerizia(l, { data: D })).toThrow(/già una perizia/)
    expect(vigente(l)!.tipo).toBe('contratto') // in bozza non vale ancora
    expect(() => nuovoCre(l, D)).toThrow(/SAL finale/)
    const f = nuovoSalFinale(l, D); l = f.lavoro
    expect(() => nuovoCre(l, D)).toThrow(/emette il SAL finale/)
    expect(() => nuovoSal(l, D)).toThrow(/SAL finale/)
  })

  it('fase, nome e data si correggono anche a revisione chiusa', () => {
    let { l, id } = base()
    l = chiudi(l, id, D)
    l = descrivi(l, id, { fase: 'definitivo', nome: 'Definitivo dopo la CdS' })
    expect(revisione(l, id)).toMatchObject({ fase: 'definitivo', nome: 'Definitivo dopo la CdS', stato: 'chiusa' })
  })
})

describe('quantità e importi', () => {
  it('la quantità è la somma delle misure, o quella scritta', () => {
    expect(quantitaVoce({ misure: [{ quantita: 2.5 }, { quantita: -0.5 }] })).toBe(2)
    expect(quantitaVoce({ misure: [], quantita: 7 })).toBe(7)
  })
  it('lavori e sicurezza separati, ai prezzi della revisione', () => {
    const a = nuovoComputo(nuovoLavoro(), { fase: 'PFTE', data: D })
    const l = conVoci(a.lavoro, a.id)
    expect(importiRevisione(revisione(l, a.id))).toEqual({ lavori: 200, sicurezza: 100, totale: 300 })
  })
})

describe('le voci si scrivono solo in una revisione aperta', () => {
  it('articoli, voci, misure: aggiungere, cambiare, ripetere, togliere', async () => {
    const m = await import('../../src/shared/lavoro')
    let l = nuovoLavoro()
    const r = nuovoComputo(l, { fase: 'PFTE', data: D }); l = r.lavoro
    const a = m.aggiungiArticolo(l, r.id, { codice: 'A.01', descrizione: 'Scavo', um: 'm3', prezzo: 10, origine: 'manuale' }); l = a.lavoro
    const v = m.aggiungiVoce(l, r.id, { articolo: a.id }); l = v.lavoro
    l = m.modificaVoce(l, r.id, v.id, { misure: [{ descrizione: 'platea', l1: 2, l2: 3, quantita: 6 }], categoria: 'Scavi' })
    const d = m.duplicaVoce(l, r.id, v.id); l = d.lavoro
    expect(revisione(l, r.id).voci.map((x) => x.id)).toEqual([v.id, d.id])
    expect(revisione(l, r.id).voci[1].misure[0].quantita).toBe(6)
    l = m.modificaArticolo(l, r.id, a.id, { prezzo: 12 })
    expect(importiRevisione(revisione(l, r.id)).lavori).toBe(144) // il prezzo vale per tutte e due le voci
    l = m.eliminaVoce(l, r.id, d.id)
    expect(revisione(l, r.id).voci).toHaveLength(1)
    expect(revisione(l, r.id).articoli).toHaveLength(1) // l'articolo resta nell'elenco
    // consegnata: niente si scrive più, qualunque cosa arrivi
    l = chiudi(l, r.id, D)
    expect(() => m.modificaVoce(l, r.id, v.id, { quantita: 1 })).toThrow(/consegnata: si legge/)
    expect(() => m.aggiungiArticolo(l, r.id, { codice: 'X', descrizione: 'x', um: 'm', prezzo: 1, origine: 'manuale' })).toThrow(/consegnata/)
    expect(() => m.eliminaVoce(l, r.id, v.id)).toThrow()
  })

  it('le voci di un XPWE: un articolo per codice, unità e prezzo; ogni voce con le sue misure', async () => {
    const m = await import('../../src/shared/lavoro')
    const r = nuovoComputo(nuovoLavoro(), { fase: 'esecutivo', data: D })
    const art = (prezzo: number) => ({ codice: 'A.01', descrizione: 'Scavo', um: 'm3', prezzo, origine: 'prezzario' as const })
    const l = m.caricaVoci(r.lavoro, r.id, [
      { articolo: art(10), voce: { misure: [{ quantita: 2 }] } },
      { articolo: art(10), voce: { misure: [{ quantita: 3 }] } },
      { articolo: art(11), voce: { misure: [], quantita: 1 } },
    ])
    const rev = revisione(l, r.id)
    expect(rev.articoli).toHaveLength(2)
    expect(rev.voci.map((v) => quantitaVoce(v))).toEqual([2, 3, 1])
    expect(rev.voci[0].articolo).toBe(rev.voci[1].articolo)
  })
})

describe('i prezzari del lavoro', () => {
  it('una voce da un prezzario: l\'articolo entra una volta, le voci quante servono', async () => {
    const m = await import('../../src/shared/lavoro')
    let l = nuovoLavoro()
    const r = nuovoComputo(l, { fase: 'PFTE', data: D }); l = r.lavoro
    const art = { codice: 'V.01', descrizione: 'Scavo', um: 'm3', prezzo: 8, origine: 'prezzario' as const, prezzario: 'pkg:veneto-2026' }
    const a = m.voceDaArticolo(l, r.id, art); l = a.lavoro
    const b = m.voceDaArticolo(l, r.id, art, { categoria: 'Scavi' }); l = b.lavoro
    expect(a.nuovo).toBe(true)
    expect(b.nuovo).toBe(false)
    expect(b.articolo).toBe(a.articolo)
    expect(m.elencoArticoli(revisione(l, r.id))).toEqual([expect.objectContaining({ codice: 'V.01', usi: 2 })])
    // stesso codice ma prezzo diverso: un altro articolo
    expect(m.voceDaArticolo(l, r.id, { ...art, prezzo: 9 }).nuovo).toBe(true)
  })
  it('il lavoro ricorda i prezzari da cui pesca, una volta sola', async () => {
    const m = await import('../../src/shared/lavoro')
    let l = m.registraPrezzario(nuovoLavoro(), { id: 'pkg:veneto-2026', nome: 'Veneto 2026' })
    l = m.registraPrezzario(l, { id: 'pkg:veneto-2026', nome: 'Veneto 2026' })
    expect(l.prezzari).toHaveLength(1)
    expect(alberoLavoro(l).find((s) => s.id === 'prezzi')!.nodi.map((n) => n.etichetta)).toEqual(['Veneto 2026'])
  })
})

describe('il SAL misura l\'eseguito e ne fa i conti', () => {
  /** Contratto: scavo 10 m3 × 20 (lavori 200), recinzione 20 m × 5 (sicurezza 100), ribasso 10%. */
  async function conContratto() {
    const m = await import('../../src/shared/lavoro')
    let l = nuovoLavoro()
    const r = nuovoComputo(l, { fase: 'esecutivo', data: D }); l = chiudi(conVoci(r.lavoro, r.id), r.id, D)
    const c = promuoviAContratto(l, r.id, { data: D, ribassoPct: 10 }); l = chiudi(c.lavoro, c.id, D)
    return { m, l, c: c.id }
  }

  it('il contratto: base d\'asta, sicurezza fuori dal ribasso, importo contrattuale', async () => {
    const { m, l, c } = await conContratto()
    expect(m.importiContratto(revisione(l, c))).toEqual({ baseAsta: 200, sicurezza: 100, ribassoPct: 10, ribassoRisultante: null, contrattuale: 280 })
  })

  it('a tutto il SAL lordo e netto; in questo SAL la differenza col precedente', async () => {
    const { m, l: l0 } = await conContratto()
    let l = l0
    const s1 = nuovoSal(l, D); l = s1.lavoro
    l = m.modificaRigaAvanzamento(l, s1.id, 'v1', { misure: [{ descrizione: 'platea', quantita: 4 }] })
    l = m.modificaRigaAvanzamento(l, s1.id, 'v2', { quantita: 20 })
    let i = m.importiAvanzamento(l, s1.id)
    expect(i).toMatchObject({ lavori: 80, sicurezza: 100, lordo: 180, ribassoPct: 10, netto: 172, precedente: 0, questo: 172, misurate: 2, voci: 2 })
    l = emetti(l, s1.id, D)
    expect(() => m.modificaRigaAvanzamento(l, s1.id, 'v1', { quantita: 1 })).toThrow(/emesso: si legge/)
    const s2 = nuovoSal(l, D); l = s2.lavoro
    // il SAL 2 parte dalle misure del SAL 1, e si aggiunge
    expect(m.quantitaEseguita(m.rigaDi(avanzamentoDi(l, s2.id), 'v1'))).toBe(4)
    l = m.modificaRigaAvanzamento(l, s2.id, 'v1', { misure: [{ descrizione: 'platea', quantita: 4 }, { descrizione: 'cordolo', quantita: 6 }] })
    i = m.importiAvanzamento(l, s2.id)
    expect(i).toMatchObject({ lavori: 200, lordo: 300, netto: 280, precedente: 172, questo: 108 })
  })

  it('i lavori a corpo si contabilizzano a quota %', async () => {
    const m = await import('../../src/shared/lavoro')
    let l = nuovoLavoro()
    const r = nuovoComputo(l, { fase: 'esecutivo', data: D }); l = conVoci(r.lavoro, r.id)
    l = m.modificaVoce(l, r.id, 'v1', { corpo: true })
    l = chiudi(l, r.id, D)
    const c = promuoviAContratto(l, r.id, { data: D }); l = chiudi(c.lavoro, c.id, D)
    const s = nuovoSal(l, D); l = s.lavoro
    l = m.modificaRigaAvanzamento(l, s.id, 'v1', { quotaPct: 25 })
    expect(m.importiAvanzamento(l, s.id).lavori).toBe(50) // 25% di 200
    expect(() => m.modificaRigaAvanzamento(l, s.id, 'v1', { quotaPct: 120 })).toThrow()
    expect(() => m.modificaRigaAvanzamento(l, s.id, 'nessuna', { quantita: 1 })).toThrow(/non è nel contratto/)
  })

  it('con i prezzi offerti il ribasso è già nei prezzi', async () => {
    const m = await import('../../src/shared/lavoro')
    let l = nuovoLavoro()
    const r = nuovoComputo(l, { fase: 'esecutivo', data: D }); l = chiudi(conVoci(r.lavoro, r.id), r.id, D)
    const c = promuoviAContratto(l, r.id, { data: D, prezziOfferti: { a1: 18 } }); l = chiudi(c.lavoro, c.id, D)
    const s = nuovoSal(l, D); l = s.lavoro
    l = m.modificaRigaAvanzamento(l, s.id, 'v1', { quantita: 10 })
    expect(m.importiAvanzamento(l, s.id)).toMatchObject({ lavori: 180, ribassoPct: 0, netto: 180 })
    expect(m.importiContratto(revisione(l, c.id))).toMatchObject({ baseAsta: 200, ribassoPct: null, ribassoRisultante: 10, contrattuale: 280 })
  })

  it("l'offerta (ribasso o prezzi unitari) si corregge finché nessun SAL è emesso", async () => {
    const m = await import('../../src/shared/lavoro')
    let l = nuovoLavoro()
    const r = nuovoComputo(l, { fase: 'esecutivo', data: D }); l = chiudi(conVoci(r.lavoro, r.id), r.id, D)
    const c = promuoviAContratto(l, r.id, { data: D, ribassoPct: 5 }); l = c.lavoro
    l = m.impostaRibasso(l, c.id, 12.35)
    expect(revisione(l, c.id).contratto!.ribassoPct).toBe(12.35)
    expect(() => m.impostaRibasso(l, c.id, 100)).toThrow()
    // si passa ai prezzi unitari: il ribasso se ne va, la sicurezza non si offre
    l = m.impostaPrezziUnitari(l, c.id)
    l = m.impostaPrezzoOfferto(l, c.id, 'a1', 18)
    expect(revisione(l, c.id).contratto).toEqual({ prezziOfferti: { a1: 18 } })
    expect(() => m.impostaPrezzoOfferto(l, c.id, 's1', 4)).toThrow(/sicurezza/)
    expect(m.importiContratto(revisione(l, c.id))).toMatchObject({ baseAsta: 200, ribassoPct: null, ribassoRisultante: 10, contrattuale: 280 })
    // con un SAL aperto si corregge ancora; emesso, no
    const s = nuovoSal(l, D); l = s.lavoro
    l = m.impostaPrezzoOfferto(l, c.id, 'a1', 17.5)
    l = emetti(l, s.id, D)
    expect(m.offertaModificabile(l)).toBe(false)
    expect(() => m.impostaRibasso(l, c.id, 1)).toThrow(/SAL emesso/)
  })
})

function avanzamentoDi(l: Lavoro, id: string) { return l.avanzamenti.find((a) => a.id === id)! }

describe('perizia, SAL finale e CRE (tappa 5)', () => {
  async function contrattoStipulato() {
    const m = await import('../../src/shared/lavoro')
    let l = nuovoLavoro()
    const r = nuovoComputo(l, { fase: 'esecutivo', data: D }); l = chiudi(conVoci(r.lavoro, r.id), r.id, D)
    const c = promuoviAContratto(l, r.id, { data: D, ribassoPct: 10 }); l = chiudi(c.lavoro, c.id, D)
    return { m, l, c: c.id }
  }

  it('la perizia si confronta col vigente e con l\'originario, al netto del ribasso', async () => {
    const { m, l: l0 } = await contrattoStipulato()
    let l = l0
    const p = nuovaPerizia(l, { data: D }); l = p.lavoro
    l = m.modificaVoce(l, p.id, 'v1', { misure: [{ descrizione: 'platea', quantita: 15 }] })
    const i = m.importiPerizia(l, p.id)
    expect(i).toMatchObject({ prima: 280, dopo: 370, differenza: 90, aumenti: 90, diminuzioni: 0, variate: 1, originario: 280, oltreQuinto: true })
    expect(i.variazionePct).toBeCloseTo(32.14, 2)
    expect(i.perVoce.get('v1')).toEqual({ prima: 180, dopo: 270, qPrima: 10 })
  })

  it('un nuovo prezzo in perizia conta come voce variata; entro il quinto niente allarme', async () => {
    const { m, l: l0 } = await contrattoStipulato()
    let l = l0
    const p = nuovaPerizia(l, { data: D }); l = p.lavoro
    const np = m.voceDaArticolo(l, p.id, { codice: 'NP.01', descrizione: 'Pozzetto', um: 'cad', prezzo: 50, origine: 'np' }); l = np.lavoro
    l = m.modificaVoce(l, p.id, np.id, { quantita: 1 })
    const i = m.importiPerizia(l, p.id)
    expect(i).toMatchObject({ variate: 1, differenza: 45, oltreQuinto: false })
  })

  it('in perizia non si toglie una voce già contabilizzata', async () => {
    const { m, l: l0 } = await contrattoStipulato()
    let l = l0
    const s = nuovoSal(l, D); l = s.lavoro
    l = m.modificaRigaAvanzamento(l, s.id, 'v1', { quantita: 3 }); l = emetti(l, s.id, D)
    const p = nuovaPerizia(l, { data: D }); l = p.lavoro
    expect(() => m.eliminaVoce(l, p.id, 'v1')).toThrow(/già contabilizzata nel SAL n. 1/)
    expect(() => m.eliminaVoce(l, p.id, 'v2')).not.toThrow()
  })

  it('i prezzi offerti passano alla perizia', async () => {
    const m = await import('../../src/shared/lavoro')
    let l = nuovoLavoro()
    const r = nuovoComputo(l, { fase: 'esecutivo', data: D }); l = chiudi(conVoci(r.lavoro, r.id), r.id, D)
    const c = promuoviAContratto(l, r.id, { data: D, prezziOfferti: { a1: 18 } }); l = chiudi(c.lavoro, c.id, D)
    const p = nuovaPerizia(l, { data: D }); l = p.lavoro
    expect(m.importiPerizia(l, p.id)).toMatchObject({ prima: 280, dopo: 280, variate: 0 })
  })

  it('dopo la perizia approvata il SAL ne porta i prezzi; il conto finale chiude i conti', async () => {
    const { m, l: l0 } = await contrattoStipulato()
    let l = l0
    const s1 = nuovoSal(l, D); l = s1.lavoro
    l = m.modificaRigaAvanzamento(l, s1.id, 'v1', { quantita: 5 }); l = emetti(l, s1.id, D)   // 100 lordo → 90 netto
    const p = nuovaPerizia(l, { data: D }); l = p.lavoro
    l = m.modificaVoce(l, p.id, 'v1', { misure: [{ descrizione: 'platea', quantita: 15 }] }); l = chiudi(l, p.id, D)
    const s2 = nuovoSal(l, D); l = s2.lavoro
    expect(l.avanzamenti.find((a) => a.id === s2.id)!.leggeDa).toBe(p.id)
    l = emetti(l, s2.id, D)
    const f = nuovoSalFinale(l, D); l = f.lavoro
    l = m.modificaRigaAvanzamento(l, f.id, 'v1', { quantita: 15 })
    l = m.modificaRigaAvanzamento(l, f.id, 'v2', { quantita: 20 })
    expect(m.contoFinale(l)).toEqual({ lordo: 400, sicurezza: 100, netto: 370, neiSal: 90, credito: 280 })
    l = emetti(l, f.id, D)
    const cre = nuovoCre(l, D); l = cre.lavoro
    expect(l.avanzamenti.find((a) => a.id === cre.id)!.leggeDa).toBe(p.id)
  })
})

describe('in perizia i prezzi di contratto non cambiano', () => {
  it('il prezzo di contratto è fisso, quello di un NP si concorda', async () => {
    const m = await import('../../src/shared/lavoro')
    let l = nuovoLavoro()
    const r = nuovoComputo(l, { fase: 'esecutivo', data: D }); l = chiudi(conVoci(r.lavoro, r.id), r.id, D)
    const c = promuoviAContratto(l, r.id, { data: D }); l = chiudi(c.lavoro, c.id, D)
    const p = nuovaPerizia(l, { data: D }); l = p.lavoro
    expect(() => m.modificaArticolo(l, p.id, 'a1', { prezzo: 25 })).toThrow(/nuovo prezzo/)
    expect(() => m.modificaArticolo(l, p.id, 'a1', { descrizione: 'Scavo a sezione' })).not.toThrow()
    const np = m.voceDaArticolo(l, p.id, { codice: 'NP.01', descrizione: 'Pozzetto', um: 'cad', prezzo: 50, origine: 'np' }); l = np.lavoro
    expect(() => m.modificaArticolo(l, p.id, np.articolo, { prezzo: 55 })).not.toThrow()
  })
})

describe('la perizia approvata e il SAL in bozza', () => {
  it('il SAL in bozza passa ai prezzi e al numero della perizia; riaperta la perizia, torna indietro', async () => {
    const m = await import('../../src/shared/lavoro')
    let l = nuovoLavoro()
    const r = nuovoComputo(l, { fase: 'esecutivo', data: D }); l = chiudi(conVoci(r.lavoro, r.id), r.id, D)
    const c = promuoviAContratto(l, r.id, { data: D }); l = chiudi(c.lavoro, c.id, D)
    const s1 = nuovoSal(l, D); l = emetti(s1.lavoro, s1.id, D)
    const s2 = nuovoSal(l, D); l = s2.lavoro
    const p = nuovaPerizia(l, { data: D }); l = p.lavoro
    l = chiudi(l, p.id, D)
    const sal = (id: string) => l.avanzamenti.find((a) => a.id === id)!
    expect(sal(s2.id).leggeDa).toBe(p.id)
    expect(sal(s1.id).leggeDa).toBe(c.id)            // l'emesso resta com'era
    expect(numeroDi(l, s2.id)).toBe(revisione(l, p.id).numero)
    l = riapri(l, p.id)
    expect(sal(s2.id).leggeDa).toBe(c.id)
    expect(m.vigente(l)?.id).toBe(c.id)
  })
})

describe('gli importi in calce sono lordi; il ribasso a parte', () => {
  it('la perizia: lordi ai prezzi di progetto e NP, e i netti col ribasso su lavori e NP (mai sulla sicurezza)', async () => {
    const m = await import('../../src/shared/lavoro')
    let l = nuovoLavoro()
    const r = nuovoComputo(l, { fase: 'esecutivo', data: D }); l = chiudi(conVoci(r.lavoro, r.id), r.id, D)
    const c = promuoviAContratto(l, r.id, { data: D, ribassoPct: 10 }); l = c.lavoro
    const p = nuovaPerizia(l, { data: D }); l = p.lavoro
    l = m.modificaVoce(l, p.id, 'v1', { misure: [{ descrizione: 'platea', quantita: 15 }] })     // +5 m3 × 20 = +100
    const np = m.voceDaArticolo(l, p.id, { codice: 'NP.01', descrizione: 'Pozzetto', um: 'cad', prezzo: 50, origine: 'np' }); l = np.lavoro
    l = m.modificaVoce(l, p.id, np.id, { quantita: 2 })                                         // +100
    const i = m.importiPerizia(l, p.id)
    expect(i.lordo).toEqual({ prima: 300, dopo: 500, differenza: 200, aumenti: 200, diminuzioni: 0 })
    expect([i.prima, i.dopo, i.differenza, i.ribassoPct]).toEqual([280, 460, 180, 10])           // il NP è ribassato
  })

  it('il SAL: in questo SAL lordo e netto', async () => {
    const m = await import('../../src/shared/lavoro')
    let l = nuovoLavoro()
    const r = nuovoComputo(l, { fase: 'esecutivo', data: D }); l = chiudi(conVoci(r.lavoro, r.id), r.id, D)
    const c = promuoviAContratto(l, r.id, { data: D, ribassoPct: 10 }); l = c.lavoro
    const s1 = nuovoSal(l, D); l = m.modificaRigaAvanzamento(s1.lavoro, s1.id, 'v1', { quantita: 4 }); l = emetti(l, s1.id, D)
    const s2 = nuovoSal(l, D); l = m.modificaRigaAvanzamento(s2.lavoro, s2.id, 'v1', { quantita: 10 })
    expect(m.importiAvanzamento(l, s2.id)).toMatchObject({ lordo: 200, precedenteLordo: 80, questoLordo: 120, netto: 180, questo: 108 })
  })
})

describe('il ribasso sui nuovi prezzi: voce per voce', () => {
  /** Contratto (scavo 10 m3 × 20 + sicurezza 100); perizia con un NP 2 × 50. */
  async function conNp(o: { ribassoPct?: number; prezziOfferti?: Record<string, number> }) {
    const m = await import('../../src/shared/lavoro')
    let l = nuovoLavoro()
    const r = nuovoComputo(l, { fase: 'esecutivo', data: D }); l = chiudi(conVoci(r.lavoro, r.id), r.id, D)
    const c = promuoviAContratto(l, r.id, { data: D, ...o }); l = c.lavoro
    const p = nuovaPerizia(l, { data: D }); l = p.lavoro
    const np = m.voceDaArticolo(l, p.id, { codice: 'NP.01', descrizione: 'Pozzetto', um: 'cad', prezzo: 50, origine: 'np' }); l = np.lavoro
    l = m.modificaVoce(l, p.id, np.id, { quantita: 2 })
    return { m, l, p: p.id, art: np.articolo }
  }

  it('ribasso unico: il NP è ribassato per default; segnato «non soggetto», no', async () => {
    const { m, l: l0, p, art } = await conNp({ ribassoPct: 10 })
    expect(m.importiPerizia(l0, p).differenza).toBe(90)            // 100 × 0,9
    const l = m.modificaArticolo(l0, p, art, { soggettoRibasso: false })
    expect(m.importiPerizia(l, p).differenza).toBe(100)
    expect(m.importiPerizia(l, p).lordo.differenza).toBe(100)       // il lordo non cambia
  })

  it('prezzi unitari: il NP vale il prezzo concordato; segnato «soggetto», prende il ribasso che risulta dall\'offerta', async () => {
    const { m, l: l0, p, art } = await conNp({ prezziOfferti: { a1: 18 } })   // offerta 180 su 200: risulta il 10%
    expect(m.importiPerizia(l0, p).differenza).toBe(100)
    const l = m.modificaArticolo(l0, p, art, { soggettoRibasso: true })
    expect(m.ribassoRisultante(m.contratto(l)!)).toBe(10)
    expect(m.importiPerizia(l, p).differenza).toBe(90)
  })

  it('tutti i NP di una perizia in un colpo; e nel SAL il netto segue la voce', async () => {
    const { m, l: l0, p } = await conNp({ ribassoPct: 10 })
    let l = m.impostaRibassoNp(l0, p, false)
    expect(revisione(l, p).articoli.filter((a) => a.origine === 'np').every((a) => a.soggettoRibasso === false)).toBe(true)
    expect(revisione(l, p).articoli.find((a) => a.id === 'a1')!.soggettoRibasso).toBeUndefined()
    l = chiudi(l, p, D)
    const s = nuovoSal(l, D); l = s.lavoro
    const npVoce = revisione(l, p).voci.find((v) => revisione(l, p).articoli.find((a) => a.id === v.articolo)?.origine === 'np')!
    l = m.modificaRigaAvanzamento(l, s.id, npVoce.id, { quantita: 2 })
    l = m.modificaRigaAvanzamento(l, s.id, 'v1', { quantita: 5 })
    // scavo 100 ribassato → 90; NP 100 non ribassato → 100
    expect(m.importiAvanzamento(l, s.id)).toMatchObject({ lordo: 200, netto: 190 })
  })
})

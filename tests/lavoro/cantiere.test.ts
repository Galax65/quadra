import { describe, it, expect } from 'vitest'
import {
  nuovoLavoro, nuovoComputo, aggiungiArticolo, aggiungiVoce, modificaVoce, chiudi, promuoviAContratto, nuovoSal, emetti,
  impostaContabilita, aggiungiSospensione, modificaSospensione, aggiungiGiorno, modificaGiorno, aggiungiAtto, verbaliDi,
  aggiungiRiserva, modificaRiserva, aggiungiLista, modificaLista, attiDi, alberoLavoro, datiContabilita, type Lavoro,
} from '../../src/shared/lavoro'
import { paginaGiornale, paginaVerbali, paginaRiserve, paginaEconomie, paginaScadenze, prospettoRiserveHTML } from '../../src/tools/lavoro/cantiere'
import { contabilitaMotore } from '../../src/tools/lavoro/motore-contabilita'
import { giornaleHTML, verbaleHTML, listaEconomiaHTML } from '../../src/tools/contabilita/engine'

/**
 * GLI ATTI DEL CANTIERE in «Lavoro»: giornale, verbali e ordini, riserve,
 * liste in economia, scadenziario. I verbali dei tempi nascono dai tempi
 * (niente doppioni); le stampe le fa il motore della Contabilità.
 */
const D = '01/03/2026'

function inVigore(): Lavoro {
  let l = nuovoLavoro({ oggetto: 'Scuola', committente: 'Comune di Prova' })
  const r = nuovoComputo(l, { fase: 'esecutivo', data: D }); l = r.lavoro
  const a = aggiungiArticolo(l, r.id, { codice: 'A.01', descrizione: 'Scavo', um: 'm3', prezzo: 20, origine: 'prezzario' }); l = a.lavoro
  const v = aggiungiVoce(l, r.id, { articolo: a.id }); l = modificaVoce(v.lavoro, r.id, v.id, { quantita: 10 })
  l = chiudi(l, r.id, D)
  return promuoviAContratto(l, r.id, { data: D, ribassoPct: 10 }).lavoro
}

describe('i verbali: quelli dei tempi si ricavano, gli altri si scrivono', () => {
  it('consegna, sospensione e ripresa dai tempi; l\'ordine di servizio numerato', () => {
    let l = impostaContabilita(inVigore(), { dataConsegna: '05/03/2026', giorniUtili: 100 })
    l = aggiungiSospensione(l, { dal: '01/04/2026', motivo: 'meteo' })
    l = modificaSospensione(l, datiContabilita(l).sospensioni[0].id, { al: '15/04/2026' })
    l = aggiungiAtto(l, 'ordine', '10/03/2026', { oggetto: 'Recinzione' }).lavoro
    l = aggiungiAtto(l, 'ordine', '20/03/2026').lavoro
    const v = verbaliDi(l)
    expect(v.map((x) => [x.tipo, x.data, x.numero, !!x.ricavato])).toEqual([
      ['consegna', '05/03/2026', 1, true], ['ordine', '10/03/2026', 1, false], ['ordine', '20/03/2026', 2, false],
      ['sospensione', '01/04/2026', 1, true], ['ripresa', '15/04/2026', 1, true],
    ])
    const h = paginaVerbali(l)
    expect(h).toContain('dai tempi')
    expect(h).toContain('lvAttoNuovo(&#39;ordine&#39;)')
    // la stampa del motore
    const m = contabilitaMotore(l)!
    expect(verbaleHTML(m.appalto, m.verbali.find((x) => x.tipo === 'sospensione')!, m.partite)).toContain('sospensione')
  })
})

describe('il giornale dei lavori', () => {
  it('un giorno per data, in ordine; la stampa richiama gli atti del giorno', () => {
    let l = impostaContabilita(inVigore(), { dataConsegna: '05/03/2026' })
    const g2 = aggiungiGiorno(l, { data: '06/03/2026', lavorazioni: 'Scavo' }); l = g2.lavoro
    l = aggiungiGiorno(l, { data: '05/03/2026', meteo: 'sereno', lavorazioni: 'Consegna e picchettamento' }).lavoro
    expect(() => aggiungiGiorno(l, { data: '05/03/2026' })).toThrow(/c'è già/)
    l = modificaGiorno(l, g2.id, { manodopera: '3 operai' })
    expect(attiDi(l).giornale.map((x) => x.data)).toEqual(['05/03/2026', '06/03/2026'])
    expect(paginaGiornale(l)).toContain('3 operai')
    const m = contabilitaMotore(l)!
    const h = giornaleHTML(m.appalto, m.giornale, m.sals, m.verbali, m.riserve)
    expect(h).toContain('picchettamento')
    expect(h).toMatch(/[Cc]onsegna/)
  })
})

describe('le riserve', () => {
  it('numerate; lo stato dice i 15 giorni; la pagina e il prospetto', () => {
    let l = inVigore()
    const r = aggiungiRiserva(l, { oggetto: 'Maggiori oneri per terreno roccioso', data: '01/04/2026', importo: 12000 }); l = r.lavoro
    expect(attiDi(l).riserve[0].numero).toBe(1)
    let h = paginaRiserve(l, '2026-04-20')
    expect(h).toContain('termine scaduto')   // 19 giorni senza esplicitazione
    l = modificaRiserva(l, r.id, { dataEsplicitazione: '10/04/2026', esplicitazione: 'Roccia non prevista' })
    h = paginaRiserve(l, '2026-04-20')
    expect(h).toContain('esplicitata')
    expect(h).toContain('€ 12.000,00')
    expect(prospettoRiserveHTML(contabilitaMotore(l)!, '2026-04-20', '20/04/2026')).toContain('Maggiori oneri')
  })
})

describe('le liste in economia', () => {
  it('righe di operai, mezzi, provviste; valore; stampa', () => {
    let l = inVigore()
    const s = nuovoSal(l, D); l = s.lavoro
    const e = aggiungiLista(l, '09/03/2026', 1); l = e.lavoro
    l = modificaLista(l, e.id, { operai: [{ qualifica: 'operaio specializzato', ore: 8, tariffaOraria: 35 }], mezzi: [{ descrizione: 'escavatore', ore: 4, tariffaOraria: 60 }] })
    const h = paginaEconomie(l)
    expect(h).toContain('€ 520,00')
    expect(listaEconomiaHTML(contabilitaMotore(l)!.appalto, contabilitaMotore(l)!.liste[0])).toContain('escavatore')
    // emesso il SAL, la lista è chiusa
    l = emetti(l, s.id, D)
    expect(paginaEconomie(l)).toContain('🔒 nel SAL emesso')
    expect(() => modificaLista(l, e.id, { note: 'x' })).toThrow(/già emesso/)
  })
})

describe('lo scadenziario e la sidebar', () => {
  it('i termini dagli atti; la sezione CANTIERE dal contratto in poi', () => {
    let l = inVigore()
    const s = nuovoSal(l, D); l = emetti(s.lavoro, s.id, '01/03/2026')
    const h = paginaScadenze(l, contabilitaMotore(l), '2026-03-05')
    expect(h).toContain('Scadenziario')
    expect(h).toMatch(/certificato/i)
    const sez = alberoLavoro(l).find((x) => x.id === 'cantiere')!
    expect(sez.nodi.map((n) => n.etichetta)).toEqual(['Giornale dei lavori', 'Verbali e ordini di servizio', 'Riserve', 'Liste in economia', 'Scadenziario', 'Registro degli atti'])
    expect(alberoLavoro(nuovoLavoro()).some((x) => x.id === 'cantiere')).toBe(false)
  })
})

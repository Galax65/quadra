import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { paginaRevisione, paginaVuota, vociVisibili, type Vista } from '../../src/tools/lavoro/schermata'
import { daXpwe } from '../../src/tools/lavoro/xpwe'
import { nuovoLavoro, nuovoComputo, aggiungiArticolo, aggiungiVoce, modificaVoce, chiudi, revisione, type Lavoro } from '../../src/shared/lavoro'

/**
 * LA SCHERMATA UNICA (tappa 2 di Docs/07-Un-lavoro-un-modulo.md): ogni tappa
 * si apre nella stessa pagina, fatta coi moduli condivisi. Aperta si scrive,
 * consegnata si legge e basta — e si vede.
 */
const D = '01/01/2026'
const vista = (): Vista => ({ q: '', ordine: 'manuale', aperte: new Set() })

function unComputo(): { l: Lavoro; id: string; voce: string } {
  let l = nuovoLavoro({ oggetto: 'Scuola' })
  const r = nuovoComputo(l, { fase: 'esecutivo', data: D }); l = r.lavoro
  const a = aggiungiArticolo(l, r.id, { codice: 'A.01', descrizione: 'Scavo', um: 'm3', prezzo: 10, origine: 'prezzario' }); l = a.lavoro
  const v = aggiungiVoce(l, r.id, { articolo: a.id }); l = v.lavoro
  l = modificaVoce(l, r.id, v.id, { misure: [{ descrizione: 'platea', l1: 2, l2: 3, quantita: 6 }], categoria: 'Scavi' })
  return { l, id: r.id, voce: v.id }
}

describe('la stessa pagina per ogni tappa', () => {
  it('è fatta coi moduli condivisi: testata, barra, griglia, piede', () => {
    const { l, id } = unComputo()
    const h = paginaRevisione(l, revisione(l, id), vista())
    expect(h).toContain('class="ehb-testata"')
    expect(h).toContain('class="ehb-barra"')
    expect(h).toContain('class="ehb-gr"')
    expect(h).toContain('class="ehb-piede"')
    expect(h).toContain('⎙ Stampa…')
    expect(h).toContain('Computo · Esecutivo')
    expect(h).toContain('rev.00')
    expect(h).toContain('€ 60,00')
  })

  it('aperta si scrive: campi, comandi, consegna', () => {
    const { l, id, voce } = unComputo()
    const v = vista(); v.aperte.add(voce)
    const h = paginaRevisione(l, revisione(l, id), v)
    expect(h).toContain('class="ehb-gr-campo')     // il prezzo si scrive
    expect(h).toContain('lvDuplica(')
    expect(h).toContain('✓ Consegna…')
    expect(h).toContain('＋ misura')
    expect(h).not.toContain('sola lettura')
  })

  it('consegnata si legge e basta: niente campi, niente comandi, e lo dice', () => {
    const { l: l0, id, voce } = unComputo()
    const l = chiudi(l0, id, D)
    const v = vista(); v.aperte.add(voce)
    const h = paginaRevisione(l, revisione(l, id), v)
    expect(h).not.toContain('class="ehb-gr-campo')
    expect(h).not.toContain('lvDuplica(')
    expect(h).not.toContain('＋ misura')
    expect(h).not.toContain('✓ Consegna…')
    expect(h).toContain('🔒 sola lettura')
    expect(h).toContain('consegnata')
    expect(h).toContain('＋ Nuova revisione…')
    expect(h).toContain('class="lv-page is-chiusa"')
  })

  it('il tasto destro su ogni voce', () => {
    const { l, id } = unComputo()
    expect(paginaRevisione(l, revisione(l, id), vista())).toContain('oncontextmenu="lvMenuVoce(event,')
  })

  it('la ricerca e l\'ordine per categorie', () => {
    const { l, id } = unComputo()
    const r = revisione(l, id)
    expect(vociVisibili(r, { ...vista(), q: 'scav' })).toHaveLength(1)
    expect(vociVisibili(r, { ...vista(), q: 'getto' })).toHaveLength(0)
    expect(paginaRevisione(l, r, { ...vista(), ordine: 'categorie' })).toContain('ehb-gr-gruppo')
  })

  it('un lavoro senza revisioni dice le due strade', () => {
    const h = paginaVuota(nuovoLavoro({ oggetto: 'Scuola' }))
    expect(h).toContain('Scuola')
    expect(h).toContain('lvNuovoComputo()')
    expect(h).toContain('lvImportaXpwe()')
  })
})

describe('una voce XPWE diventa articolo e voce', () => {
  it('codice, descrizioni, prezzo, provenienza, misure, categoria, sicurezza', () => {
    const x = daXpwe({ codice: 'NP.01', desc_short: 'Pozzetto', declaratoria: 'Pozzetto in cls 60x60', um: 'cad', prezzo: 250, np: true, codiceOrig: 'B.07',
      misurazioni: [{ descrizione: 'piazzale', quantita: 3 }], categoria: 'Fognature', sicurezza: true })
    expect(x.articolo).toEqual({ codice: 'NP.01', descrizione: 'Pozzetto', estesa: 'Pozzetto in cls 60x60', um: 'cad', prezzo: 250, origine: 'np', codiceOrig: 'B.07', sicurezza: true })
    expect(x.voce).toEqual({ misure: [{ descrizione: 'piazzale', quantita: 3 }], categoria: 'Fognature' })
    expect(daXpwe({ codice: 'A', um: 'm', prezzo: 1, qty: 7 }).voce).toEqual({ misure: [], quantita: 7 })
  })
})

describe('lo strumento è registrato e la sidebar lo segue', () => {
  const leggi = (p: string): string => readFileSync(resolve(__dirname, '../..', p), 'utf8')
  it('registry, build e copia degli artefatti lo conoscono', () => {
    expect(leggi('src/hub/data/registry.ts')).toContain("id: 'lavoro'")
    expect(leggi('vite.config.ts')).toContain("lavoro: { Lavoro:")
    expect(leggi('scripts/build-web.mjs')).toContain("'lavoro'")
    expect(leggi('scripts/place-builds.mjs')).toContain("'Lavoro.html'")
  })
  it("l'hub disegna l'albero a sezioni che lo strumento pubblica, e la card «Lavoro» apre lui", () => {
    expect(leggi('src/hub/ui/bus.js')).toContain('setSezioniLavoro(msg.project.sezioni')
    expect(leggi('src/hub/ui/revisioni-nav.js')).toContain('if (sezioni) { renderSezioni(')
    expect(leggi('src/hub/ui/navigazione.js')).toContain("await launchApp('lavoro')")
    expect(leggi('src/tools/lavoro/main.ts')).toContain('sezioni: alberoLavoro(L)')
  })
})

describe('contratto e SAL nella stessa pagina (tappa 4)', () => {
  async function catena() {
    const m = await import('../../src/shared/lavoro')
    const { paginaAvanzamento } = await import('../../src/tools/lavoro/schermata')
    const { l: l0, id, voce } = unComputo()
    let l = chiudi(l0, id, D)
    const c = m.promuoviAContratto(l, id, { data: D, ribassoPct: 10 }); l = c.lavoro
    return { m, paginaAvanzamento, l, c: c.id, voce }
  }

  it('il contratto nasce in vigore: piede del contratto, offerta correggibile, SAL subito', async () => {
    const { l, c } = await catena()
    const h = paginaRevisione(l, revisione(l, c), vista())
    expect(h).toContain('Importo contrattuale')
    expect(h).toContain('ribasso 10,0000%')
    expect(h).not.toContain('Stipula')
    expect(h).toContain('＋ SAL n. 1…')
    expect(h).toContain('% Ribasso…')
    expect(h).not.toContain('⇩ XPWE')
  })

  it('il computo consegnato propone il contratto, finché non c\'è', async () => {
    const { l: l0, id } = unComputo()
    const l = chiudi(l0, id, D)
    expect(paginaRevisione(l, revisione(l, id), vista())).toContain('→ Contratto…')
    const { l: l2 } = await catena()
    const computo = l2.revisioni.find((r) => r.tipo === 'computo')!
    expect(paginaRevisione(l2, computo, vista())).not.toContain('→ Contratto…')
  })

  it("il SAL: si scrive l'eseguito, si legge il contratto, il piede fa i conti", async () => {
    const { m, paginaAvanzamento, l: l0, c, voce } = await catena()
    let l = chiudi(l0, c, D)
    const s = m.nuovoSal(l, D); l = s.lavoro
    l = m.modificaRigaAvanzamento(l, s.id, voce, { quantita: 4 })
    const a = l.avanzamenti[0]
    const h = paginaAvanzamento(l, a, { ...vista(), mostra: 'misurate' })
    expect(h).toContain('SAL n. 1')
    expect(h).toContain('rev.01')                 // porta il numero del contratto
    expect(h).toContain('Eseguito a tutto il SAL') // la colonna che si scrive
    expect(h).toContain('contratto 6,00 m3')      // la quantità di contratto, accanto
    expect(h).toContain('Totale contabilizzato a tutto il SAL n. 1')
    expect(h).toContain('€ 40,00')
    expect(h).toContain('✓ Emetti…')
    expect(h).toContain('lvSalQta(')
    expect(h).toContain('MOSTRA')
  })

  it('emesso: sola lettura, e propone il SAL successivo', async () => {
    const { m, paginaAvanzamento, l: l0, c, voce } = await catena()
    let l = chiudi(l0, c, D)
    const s = m.nuovoSal(l, D); l = s.lavoro
    l = m.modificaRigaAvanzamento(l, s.id, voce, { quantita: 4 })
    l = m.emetti(l, s.id, D)
    const h = paginaAvanzamento(l, l.avanzamenti[0], vista())
    expect(h).not.toContain('lvSalQta(')
    expect(h).toContain('🔒 sola lettura')
    expect(h).toContain('＋ SAL n. 2…')
    expect(h).toContain('↺ Riapri')
  })

  it("nel SAL l'eseguito oltre il contratto si vede", async () => {
    const { m, paginaAvanzamento, l: l0, c, voce } = await catena()
    let l = chiudi(l0, c, D)
    const s = m.nuovoSal(l, D); l = s.lavoro
    l = m.modificaRigaAvanzamento(l, s.id, voce, { quantita: 9 })
    expect(paginaAvanzamento(l, l.avanzamenti[0], vista())).toContain('oltre il contratto')
  })
})

describe('perizia, SAL finale e CRE nella stessa pagina (tappa 5)', () => {
  async function stipulato() {
    const m = await import('../../src/shared/lavoro')
    const { paginaAvanzamento } = await import('../../src/tools/lavoro/schermata')
    const { l: l0, id, voce } = unComputo()
    let l = chiudi(l0, id, D)
    const c = m.promuoviAContratto(l, id, { data: D, ribassoPct: 10 }); l = m.chiudi(c.lavoro, c.id, D)
    return { m, paginaAvanzamento, l, voce }
  }

  it('la perizia: confronto col vigente, voci variate, approvazione, prezzo di contratto fisso', async () => {
    const { m, l: l0, voce } = await stipulato()
    let l = l0
    const p = m.nuovaPerizia(l, { data: D }); l = p.lavoro
    l = m.modificaVoce(l, p.id, voce, { misure: [{ descrizione: 'platea', quantita: 9 }] })
    const h = paginaRevisione(l, revisione(l, p.id), { ...vista(), mostra: 'variate' })
    expect(h).toContain('Perizia di variante')
    expect(h).toContain('Differenza sul contratto vigente')
    expect(h).toContain('vigente 6,00 m3 → +3,00')
    expect(h).toContain("oltre il quinto d'obbligo")
    expect(h).toContain('✓ Approva…')
    expect(h).toContain('Variate')
    expect(h).not.toContain('lvSetPrezzo(')
  })

  it('il SAL finale e il CRE: stato finale, conto finale, credito residuo; il CRE si legge', async () => {
    const { m, paginaAvanzamento, l: l0, voce } = await stipulato()
    let l = l0
    const s = m.nuovoSal(l, D); l = s.lavoro
    l = m.modificaRigaAvanzamento(l, s.id, voce, { quantita: 2 }); l = m.emetti(l, s.id, D)   // 20 → 18 netto
    let h = paginaAvanzamento(l, l.avanzamenti[0], vista())
    expect(h).toContain('⚑ SAL finale…')
    const f = m.nuovoSalFinale(l, D); l = f.lavoro
    l = m.modificaRigaAvanzamento(l, f.id, voce, { quantita: 6 })                          // 60 → 54 netto
    h = paginaAvanzamento(l, l.avanzamenti[1], vista())
    expect(h).toContain('Stato finale dei lavori')
    expect(h).toContain('credito residuo € 36,00')
    l = m.emetti(l, f.id, D)
    expect(paginaAvanzamento(l, l.avanzamenti[1], vista())).toContain('＋ CRE…')
    const c = m.nuovoCre(l, D); l = c.lavoro
    h = paginaAvanzamento(l, l.avanzamenti[2], vista())
    expect(h).toContain('Certificato di regolare esecuzione')
    expect(h).toContain("Credito residuo dell'impresa")
    expect(h).toContain('€ 36,00')
    expect(h).toContain('✓ Approva…')
    expect(h).not.toContain('lvSalQta(')
  })
})

describe('le voci del SAL oltre il contratto: in blu', () => {
  it('la riga, l\'etichetta con l\'eccedenza, il conto nel piede, il filtro; si ridetermina con la perizia', async () => {
    const m = await import('../../src/shared/lavoro')
    const { paginaAvanzamento } = await import('../../src/tools/lavoro/schermata')
    const { l: l0, id, voce } = unComputo()       // contratto: 6 m3
    let l = chiudi(l0, id, D)
    const c = m.promuoviAContratto(l, id, { data: D }); l = c.lavoro
    const s = m.nuovoSal(l, D); l = s.lavoro
    l = m.modificaRigaAvanzamento(l, s.id, voce, { quantita: 8 })
    const a = l.avanzamenti[0]
    expect(m.vociEccedenti(l, a)).toEqual([expect.objectContaining({ codice: 'A.01', contratto: 6, eseguito: 8 })])
    const h = paginaAvanzamento(l, a, vista())
    expect(h).toContain('lv-voce is-eccede')
    expect(h).toContain('oltre il contratto +2,00 m3')
    expect(h).toContain('1 oltre il contratto')
    expect(h).toContain('Oltre il contratto (1)')
    // la perizia ridetermina la quantità: il SAL dopo non eccede più
    l = m.emetti(l, s.id, D)
    const p = m.nuovaPerizia(l, { data: D }); l = p.lavoro
    l = m.modificaVoce(l, p.id, voce, { misure: [{ descrizione: 'platea', quantita: 9 }] })
    l = m.chiudi(l, p.id, D)
    const s2 = m.nuovoSal(l, D); l = s2.lavoro
    expect(m.vociEccedenti(l, l.avanzamenti[1])).toEqual([])
  })
})

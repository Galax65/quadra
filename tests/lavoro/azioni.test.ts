// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  nuovoLavoro, nuovoComputo, aggiungiArticolo, aggiungiVoce, modificaVoce, chiudi, promuoviAContratto, nuovoSal, emetti, nuovaPerizia,
  modificaRigaAvanzamento, type Lavoro,
} from '../../src/shared/lavoro'
import { azioniTappa, type AzioneTappa } from '../../src/tools/lavoro/azioni'
import { apriMenuContestuale, chiudiMenuContestuale } from '../../src/shared/ui/components/menu'

/**
 * IL TASTO DESTRO OVUNQUE (tappa 7): ogni tappa ha le sue azioni, giuste per
 * il suo stato, le stesse nella pagina e nella sidebar; il menu è uno solo.
 */
const D = '01/01/2026'
const azioni = (l: Lavoro, id: string): string[] => azioniTappa(l, id).filter((v): v is Exclude<AzioneTappa, 'sep'> => v !== 'sep').map((v) => v.comando.split(':')[1])

function computo(): { l: Lavoro; id: string; voce: string } {
  let l = nuovoLavoro()
  const r = nuovoComputo(l, { fase: 'esecutivo', data: D }); l = r.lavoro
  const a = aggiungiArticolo(l, r.id, { codice: 'A.01', descrizione: 'Scavo', um: 'm3', prezzo: 10, origine: 'prezzario' }); l = a.lavoro
  const v = aggiungiVoce(l, r.id, { articolo: a.id }); l = v.lavoro
  l = modificaVoce(l, r.id, v.id, { quantita: 6 })
  return { l, id: r.id, voce: v.id }
}

describe('le azioni di ogni tappa, per il suo stato', () => {
  it('computo aperto: voce, import, consegna; consegnato: contratto, nuova revisione, riapri', () => {
    const { l, id } = computo()
    expect(azioni(l, id)).toEqual(['apri', 'stampa', 'struttura', 'qe', 'offerte', 'voce', 'xpwe', 'varia-prezzi', 'prezzi-prezzario', 'consegna', 'descrivi'])
    const c = chiudi(l, id, D)
    expect(azioni(c, id)).toEqual(['apri', 'stampa', 'struttura', 'qe', 'offerte', 'promuovi', 'nuova-da', 'descrivi', 'riapri'])
  })

  it('contratto: offerta correggibile e SAL n. 1; poi il SAL emesso propone il successivo e il finale', () => {
    const { l: l0, id, voce } = computo()
    const c = promuoviAContratto(chiudi(l0, id, D), id, { data: D, ribassoPct: 10 })
    let l = c.lavoro
    expect(azioni(l, c.id)).toEqual(['apri', 'stampa', 'ribasso', 'prezzi-unitari', 'sal'])
    const s = nuovoSal(l, D); l = modificaRigaAvanzamento(s.lavoro, s.id, voce, { quantita: 2 })
    expect(azioni(l, s.id)).toEqual(['apri', 'stampa', 'xpwe-sal', 'dati-sal', 'emetti'])
    l = emetti(l, s.id, D)
    expect(azioni(l, s.id)).toEqual(['apri', 'stampa', 'confronta', 'sal', 'sal-finale', 'riapri'])
    expect(azioni(l, c.id)).not.toContain('ribasso')    // c'è un SAL emesso: l'offerta non si cambia più
    const p = nuovaPerizia(l, { data: D })
    expect(azioni(p.lavoro, p.id)).toEqual(['apri', 'stampa', 'struttura', 'voce', 'xpwe', 'ribasso-np', 'consegna', 'descrivi'])
  })

  it('i nodi dei dati e dei prezzari: aprire', () => {
    const { l } = computo()
    expect(azioni(l, 'dati')).toEqual(['apri'])
    expect(azioni(l, 'prezzario:x')).toEqual(['apri'])
    expect(azioni(l, 'nessuna')).toEqual([])
  })
})

describe('il menu condiviso', () => {
  it('si apre, si usa da tastiera, esegue e si chiude; niente separatori doppi o ai bordi', () => {
    const fatto: string[] = []
    apriMenuContestuale(10, 10, ['sep', { etichetta: 'Uno', azione: () => fatto.push('uno') }, 'sep', 'sep', { etichetta: 'Due', azione: () => fatto.push('due'), disabilitato: true }, { etichetta: 'Tre', azione: () => fatto.push('tre') }, 'sep'], { titolo: 'Prova' })
    const m = document.getElementById('ehb-menu')!
    expect(m.querySelectorAll('.ehb-menu__sep')).toHaveLength(1)
    expect(document.activeElement?.textContent).toBe('Uno')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
    expect(document.activeElement?.textContent).toBe('Tre')        // salta quella disattivata
    ;(document.activeElement as HTMLButtonElement).click()
    expect(fatto).toEqual(['tre'])
    expect(document.getElementById('ehb-menu')).toBeNull()
  })

  it('Esc chiude; un menu senza voci non si apre', () => {
    apriMenuContestuale(0, 0, [{ etichetta: 'Uno', azione: () => undefined }])
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(document.getElementById('ehb-menu')).toBeNull()
    apriMenuContestuale(0, 0, ['sep'])
    expect(document.getElementById('ehb-menu')).toBeNull()
    chiudiMenuContestuale()
  })
})

describe('il tasto destro è collegato ovunque', () => {
  const leggi = (p: string): string => readFileSync(resolve(__dirname, '../..', p), 'utf8')
  it('pagina, voci, misure, elenco prezzi, sidebar (nodi, sezioni, documenti)', () => {
    const sch = leggi('src/tools/lavoro/schermata.ts')
    expect(sch).toContain('oncontextmenu="lvMenuPagina(event)"')
    expect(sch).toContain('oncontextmenu="lvMenuVoce(event,')
    expect(sch).toContain('lvMisMenu(event,')
    expect(leggi('src/tools/lavoro/prezzi.ts')).toContain('oncontextmenu="lvPzMenu(event,this)"')
    const nav = leggi('src/hub/ui/revisioni-nav.js')
    expect(nav).toContain("oncontextmenu=\"menuNodoLavoro(event,")
    expect(nav).toContain("oncontextmenu=\"menuSezioneLavoro(event,")
    expect(nav).toContain("oncontextmenu=\"menuDocLavoro(event,")
    // un solo menu: nessun menu locale nello strumento
    expect(leggi('src/tools/lavoro/main.ts')).not.toContain("'lv-menu'")
  })
})

describe('⊞ ⊟ nella sidebar', () => {
  it("lavorano sull'albero di «Lavoro»: sezioni e documenti", () => {
    const nav = readFileSync(resolve(__dirname, '../..', 'src/hub/ui/revisioni-nav.js'), 'utf8')
    const f = nav.slice(nav.indexOf('export function espandiRami'))
    expect(f).toContain('if (sezioni)')
    expect(f).toContain('sezChiuse.clear()')
    expect(f).toContain('docAperti.clear()')
  })
})

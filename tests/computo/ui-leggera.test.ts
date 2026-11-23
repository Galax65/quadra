// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { JSDOM } from 'jsdom'
import { computoSource } from './computo-src'

/**
 * Schermata leggera di Computo — implementazione del mockup approvato
 * (docs/mockups/miu-schermata-leggera/index.html).
 *
 * Un solo controllo primario per fascia (header, filtri, export, colonne
 * tabella, sidebar), il resto dietro un popover/drawer aperto al bisogno —
 * nessuna funzione tolta, solo messa in quiete. Convenzione dei test DOM di
 * Computo: contratto su markup/sorgente inline (computoSource()) + jsdom, come
 * search-wiring.test.ts/macro-filter.test.ts.
 */

const html = computoSource()
const indexDom = (): Document => new JSDOM(html).window.document

describe('header alleggerito — popover "⋯ Altro"', () => {
  it('tema e guida restano sempre a vista (come in ogni altro tool); le azioni secondarie vivono in #more-menu-pop', () => {
    const doc = indexDom()
    const actions = doc.querySelector('.ehb-hdr__actions')!
    expect(actions.querySelector('#theme-toggle')).toBeTruthy()
    expect(actions.querySelector('#guide-btn')).toBeTruthy()
    expect(actions.querySelector('#more-btn')).toBeTruthy()
    const pop = doc.getElementById('more-menu-pop')!
    expect(pop).toBeTruthy()
    expect(pop.querySelector('#guide-btn'), '#guide-btn NON deve essere nel popover ⋯ Altro').toBeNull()
    for (const id of ['carts-btn', 'drop-zone', 'folder-btn']) {
      expect(pop.querySelector(`#${id}`), `#${id} nel popover ⋯ Altro`).toBeTruthy()
    }
  })

  it('toggleMoreMenu/onMoreMenuOutside/onMoreMenuKey esistono, mirror di setViewMenu', () => {
    expect(html).toContain('function setMoreMenu(')
    expect(html).toContain('function toggleMoreMenu(')
    expect(html).toContain('function onMoreMenuOutside(')
    expect(html).toContain('function onMoreMenuKey(')
  })

  it('le funzioni del popover sono esposte su window per gli onclick inline', () => {
    expect(html).toMatch(/Object\.assign\(window,\s*\{[\s\S]*toggleMoreMenu[\s\S]*\}\)/)
  })
})

describe('filtri alleggeriti — "Filtri ▾" + drawer', () => {
  it('#filtri-btn sostituisce il vecchio #filter-toggle; niente id #filter-toggle residuo', () => {
    const doc = indexDom()
    expect(doc.getElementById('filtri-btn')).toBeTruthy()
    expect(doc.getElementById('filter-toggle')).toBeFalsy()
  })

  it('#macro-chips resta discendente di #filter-bar e PRIMA di .filter-grid (invariato)', () => {
    const doc = indexDom()
    const bar = doc.getElementById('filter-bar')!
    const chips = doc.getElementById('macro-chips')!
    expect(chips.closest('#filter-bar')).toBe(bar)
    const order = [...bar.querySelectorAll('#macro-chips, .filter-grid')]
    expect(order[0].id).toBe('macro-chips')
  })

  it('#filtri-drawer contiene mini-search, reset, macro-chips e filter-grid', () => {
    const doc = indexDom()
    const drawer = doc.getElementById('filtri-drawer')!
    expect(drawer.querySelector('#filter-mini-search')).toBeTruthy()
    expect(drawer.querySelector('#btn-reset')).toBeTruthy()
    expect(drawer.querySelector('#macro-chips')).toBeTruthy()
    expect(drawer.querySelector('.filter-grid')).toBeTruthy()
  })

  it('#cart-btn (Computo Metrico) resta SEMPRE visibile fuori dal drawer filtri', () => {
    const doc = indexDom()
    const drawer = doc.getElementById('filtri-drawer')!
    expect(drawer.querySelector('#cart-btn')).toBeFalsy()
    expect(doc.getElementById('cart-btn')).toBeTruthy()
  })

  it('main.ts collega #filtri-btn/#filtri-drawer con makeAccordion, default collassato', () => {
    const mainTs = require('node:fs').readFileSync(
      require('node:path').resolve(__dirname, '../../src/tools/computo/main.ts'), 'utf8',
    )
    expect(mainTs).toContain("document.getElementById('filtri-btn')")
    expect(mainTs).toContain("document.getElementById('filtri-drawer')")
    expect(mainTs).toContain("localStorage.setItem('pricelist:filters-collapsed', '1')")
  })

  it('countActiveFiltri/updateFiltriBtnLabel esistono e sono richiamati da doFilter', () => {
    expect(html).toContain('function countActiveFiltri(')
    expect(html).toContain('function updateFiltriBtnLabel(')
    const doFilter = html.slice(html.indexOf('function doFilter('), html.indexOf('function countActiveFiltri('))
    expect(doFilter).toContain('updateFiltriBtnLabel();')
  })
})

describe('export: un solo elenco, dalla testata di fase', () => {
  it('il popover «Esporta ▾» non c\'è più: era un secondo elenco delle stesse stampe', () => {
    const doc = indexDom()
    for (const id of ['export-menu-wrap', 'export-menu-btn', 'export-menu-pop', 'goto-esporta-btn']) {
      expect(doc.getElementById(id), `#${id}`).toBeNull()
    }
  })

  it('copy-btn resta sempre visibile nella toolbar di ricerca, famiglia Esporta', () => {
    const doc = indexDom()
    const el = doc.getElementById('copy-btn')
    expect(el).toBeTruthy()
    expect(el!.getAttribute('style') || '').not.toContain('display:none')
    expect(el!.className).toContain('ehb-btn-fam-export')
  })

  it('Σ Analisi Prezzi (search-hero) resta visibile fuori da ogni overflow — non è una voce secondaria', () => {
    const doc = indexDom()
    const hero = doc.getElementById('search-hero')!
    expect(hero.querySelector('#ap-compose-btn')).toBeTruthy()
    expect(doc.getElementById('more-menu-pop')!.querySelector('#ap-compose-btn')).toBeFalsy()
  })

  it('#export-overlay (accesso completo dal binario) resta intatto, non sostituito dal popover', () => {
    const doc = indexDom()
    expect(doc.getElementById('export-overlay')).toBeTruthy()
    // la griglia non è più scritta a mano: la riempie openExport() dal catalogo
    // condiviso con la Contabilità (shared/stampe/catalogo.ts)
    expect(doc.getElementById('export-panels')).toBeTruthy()
    const cat = readFileSync(resolve(__dirname, '../../src/shared/stampe/catalogo.ts'), 'utf8')
    for (const atteso of ['exportFascicoloAP()', 'exportFascicoloAPPdf()', 'exportComputoPdf()', 'exportComputoXpwe()']) {
      expect(cat).toContain(atteso)
    }
  })
})

describe('tabella — toggle "Colonne · tutte/meno" nel view-menu esistente', () => {
  it('#columns-switch è dentro #view-menu-pop (nessun nuovo popover)', () => {
    const doc = indexDom()
    const pop = doc.getElementById('view-menu-pop')!
    expect(pop.querySelector('#columns-switch')).toBeTruthy()
  })

  it('setColumns esiste, persiste in plColumns e applica .cols-lean su #dtable', () => {
    expect(html).toContain('function setColumns(')
    const setColumns = html.slice(html.indexOf('function setColumns('), html.indexOf('function setColumns(') + 400)
    expect(setColumns).toContain("localStorage.setItem('plColumns'")
    expect(setColumns).toContain("classList.toggle('cols-lean'")
  })

  it('.cols-lean nasconde regione/anno/disciplina/importo netto, non la descrizione', () => {
    const css = require('node:fs').readFileSync(
      require('node:path').resolve(__dirname, '../../src/tools/computo/styles/pricelist.css'), 'utf8',
    )
    expect(css).toMatch(/#dtable\.cols-lean[\s\S]*display:\s*none/)
    expect(css).not.toMatch(/#dtable\.cols-lean[\s\S]{0,400}\.td\b[\s\S]{0,50}display:\s*none/)
  })
})

describe('sidebar collassata — mostra il prezzario attivo', () => {
  it('#sidebar-collapsed-label esiste ed è aggiornato da renderSidebar/loadItem', () => {
    const doc = indexDom()
    expect(doc.getElementById('sidebar-collapsed-label')).toBeTruthy()
    expect(html).toContain('function activePrezzarioLabel(')
    expect(html).toContain('function updateSidebarCollapsedLabel(')
    const renderSidebar = html.slice(html.indexOf('function renderSidebar('), html.indexOf('function renderSidebar(') + 400)
    expect(renderSidebar).toContain('updateSidebarCollapsedLabel();')
  })

  it('activePrezzarioLabel replicata: usa regione+anno, o filename, o "Prezzari" senza prezzario attivo', () => {
    function activePrezzarioLabel(archive: { regione?: string; anno?: string; filename?: string }[], active: number): string {
      const item = archive[active]
      if (!item) return 'Prezzari'
      if (item.regione && item.regione !== 'Sconosciuta') return item.anno && item.anno !== '—' ? `${item.regione} ${item.anno}` : item.regione
      return item.filename || 'Prezzari'
    }
    expect(activePrezzarioLabel([], 0)).toBe('Prezzari')
    expect(activePrezzarioLabel([{ regione: 'Veneto', anno: '2026' }], 0)).toBe('Veneto 2026')
    expect(activePrezzarioLabel([{ regione: 'Sconosciuta', filename: 'listino.xlsx' }], 0)).toBe('listino.xlsx')
  })

  it('la meccanica di collasso (makeCollapse su #sidebar) resta invariata', () => {
    const mainTs = require('node:fs').readFileSync(
      require('node:path').resolve(__dirname, '../../src/tools/computo/main.ts'), 'utf8',
    )
    expect(mainTs).toContain("makeCollapse(")
    expect(mainTs).toContain("'miu:sidebar-collapsed'")
  })
})

describe('selezione dei risultati — il dock "Da copiare"', () => {
  it('le voci selezionate hanno un pannello proprio (#sel-dock), non un contatore nella results-bar', () => {
    const doc = indexDom()
    const bar = doc.getElementById('results-bar')!
    expect(bar.querySelector('#btn-sel-all'), '"Seleziona tutti filtrati" resta nella barra').toBeTruthy()
    expect(doc.getElementById('sel-count'), 'il vecchio contatore è sostituito dal dock').toBeNull()

    const dock = doc.getElementById('sel-dock')!
    expect(dock).toBeTruthy()
    expect(dock.hasAttribute('hidden'), 'a selezione vuota il dock non occupa spazio').toBe(true)
    // conteggio + totale, la mini-lista da cui togliere una voce, e il comando di copia
    for (const id of ['sel-dock-n', 'sel-dock-tot', 'sel-dock-list', 'sel-dock-cta', 'sel-dock-clear', 'sel-dock-fold']) {
      expect(dock.querySelector('#' + id), `#${id} manca nel dock`).toBeTruthy()
    }
    expect(doc.getElementById('sel-dock-cta')!.getAttribute('onclick')).toContain('showCopyPopup()')
    expect(doc.getElementById('sel-dock-clear')!.getAttribute('onclick')).toContain('clearSearchSel()')
  })

  it('renderSelDock disegna le voci da S.searchSel e le rende removibili una a una', () => {
    const fn = html.slice(html.indexOf('function renderSelDock('), html.indexOf('function renderSelDock(') + 1800)
    expect(fn).toContain('S.searchSel.size')
    expect(fn).toContain('rowsBySearchSel()')
    expect(fn, 'la ✕ di riga toglie la voce dalla selezione').toContain('_selSet(li.dataset.key,false)')
  })

  it('updateCartInfo ridisegna il dock a ogni variazione di selezione', () => {
    const updateCartInfo = html.slice(html.indexOf('function updateCartInfo('), html.indexOf('function updateCartInfo(') + 1800)
    expect(updateCartInfo).toContain('renderSelDock()')
  })
})

/**
 * COMPORRE UN PREZZO È UN LAVORO, non una domanda a cui rispondere e chiudere:
 * il compositore (descrizione e analisi prezzi) vive a tutta pagina sotto il
 * binario, come il libretto e la perizia della Contabilità — non in una
 * finestra sospesa sopra il computo.
 */
describe('il compositore sta a tutta pagina', () => {
  it('#componi-overlay è una vista-passo, non un modal centrato', () => {
    const doc = indexDom()
    const ov = doc.getElementById('componi-overlay')!
    expect(ov.className.split(/\s+/)).toContain('miu-step')
    // niente chiusura cliccando «fuori»: a tutta pagina un fuori non c'è
    expect(ov.getAttribute('onclick')).toBeNull()
  })

  it('il titolo dice quale lavoro si sta facendo', () => {
    expect(indexDom().getElementById('cmp-title')).toBeTruthy()
    const src = readFileSync(resolve(__dirname, '../../src/tools/computo/legacy/compositore.js'), 'utf8')
    expect(src).toContain("Σ Analisi del prezzo")
    expect(src).toContain("✎ Compositore di descrizione")
  })

  it("l'analisi di un nuovo prezzo della Contabilità si compone qui, non in una copia", () => {
    const beta = readFileSync(resolve(__dirname, '../../src/tools/contabilita/main.ts'), 'utf8')
    expect(beta).toContain('componiAnalisiNelComputo')
    expect(beta).toContain("sessionStorage.setItem('quadra:apri-analisi'")
    const miu = readFileSync(resolve(__dirname, '../../src/tools/computo/legacy/index.js'), 'utf8')
    expect(miu).toContain("openComponi(null,null,'analisi')")
  })
})

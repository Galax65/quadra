import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * CONTROLLI PROGETTO — Nuovo/Apri/Salva in un posto solo (il piede della sidebar).
 *
 * In passato i pulsanti erano in 2 contesti (app-bar + welcome), poi
 * RIPRISTINATI anche nella sidebar (3 contesti). Su richiesta utente la
 * duplicazione nella welcome screen è stata rimossa (comprimeva lo spazio
 * verticale di #welcome-cards fino al clipping): i pulsanti restano SOLO in
 * app-bar (tool aperto) e sidebar footer (sempre raggiungibili dal rail).
 * L'avvio rapido della home (.wlc-start) riusa gli stessi onclick "Nuovo progetto"/
 * "Apri progetto" come TERZO contesto (nessuna logica duplicata) — "Salva
 * progetto" non compare nel gate (non c'è ancora nulla da salvare). Questo
 * test blinda i contesti e l'hook dirty (.js-save-project).
 */

const HTML = readFileSync(
  resolve(__dirname, '../../src/hub/index.html'),
  'utf-8',
)

/** Conta le occorrenze non sovrapposte di un literal in una stringa. */
function count(haystack: string, needle: string): number {
  let n = 0
  let i = haystack.indexOf(needle)
  while (i !== -1) {
    n++
    i = haystack.indexOf(needle, i + needle.length)
  }
  return n
}

describe('hub index.html — controlli progetto Quadra (sidebar + avvio rapido)', () => {
  // la barra in alto (#app-bar) resta sotto la pagina del tool, che occupa
  // tutto lo spazio: i suoi pulsanti erano invisibili e doppioni della sidebar
  it('Apri e Nuovo: sidebar + avvio rapido in home', () => {
    expect(count(HTML, 'onclick="openProgettoQuadra()"')).toBe(2)
    expect(count(HTML, 'onclick="newProgettoQuadra()"')).toBe(2)
  })

  it('Salva progetto una volta sola (sidebar)', () => {
    expect(count(HTML, 'onclick="saveProgettoQuadra()"')).toBe(1)
    expect(count(HTML, 'js-save-project')).toBe(1)
  })

  it('la sidebar ha il blocco #side-proj nel footer', () => {
    expect(HTML).toContain('id="side-proj"')
    expect(count(HTML, 'class="side-proj-btn"')).toBe(3) // Nuovo + Apri + Salva con nome (sidebar)
    expect(count(HTML, 'class="side-proj-btn js-save-project"')).toBe(1) // Salva (sidebar)
  })

  it('mantiene #sidebar-footer e #stat-row (con la versione)', () => {
    expect(HTML).toContain('id="sidebar-footer"')
    expect(HTML).toContain('id="stat-row"')
    expect(HTML).toContain('id="stat-hubver"')
  })

  it('niente più pulsanti nella barra coperta (.proj-act / .bar-act)', () => {
    expect(HTML).not.toContain('class="proj-act')
    expect(HTML).not.toContain('class="bar-act"')
    expect(HTML).not.toContain('id="bar-actions"')
  })

  it('conserva l\'input file nascosto #ehub-file con il suo handler', () => {
    expect(HTML).toContain('id="ehub-file"')
    expect(HTML).toContain('onchange="onEhubFile(this)"')
  })
})

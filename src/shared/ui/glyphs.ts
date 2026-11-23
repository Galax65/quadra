/**
 * GOLDEN SET delle icone dei tool, come VETTORIALI.
 *
 * Le icone dei tool sono pittogrammi disegnati nello stesso spazio glifo:
 * squadra graduata = Computo, registro = Contabilità, cursori di regolazione =
 * Amministrazione. Le chiavi interne (`mu`, `beta`, `alfa`) restano quelle
 * storiche per non rompere bus e progetti già salvati.
 *
 * Sono path SVG, non caratteri di font: identici su ogni sistema e in OGNI
 * output (welcome card, nav, header, PDF, DXF), immuni dal font-loading e dal
 * fallback di sistema. Regola: l'icona di un tool è SEMPRE questo vettoriale.
 *
 * Il marchio Quadra NON è qui: ha il suo tracciato dedicato, in `./brand-mark`
 * (è un LOGO, non l'icona di un tool).
 *
 * viewBox condiviso `0 -800 600 1000`: baseline a y=0, advance monospace 600,
 * gabbia em 1000 → i glifi occupano lo stesso spazio di un carattere di font
 * (height 1em, width .6em) e restano mutuamente coerenti.
 */

export type ToolGlyphKey = 'computo' | 'amministrazione' | 'contabilita'

export const TOOL_GLYPH_VIEWBOX = '0 -800 600 1000'

/** Path SVG (asse Y già ribaltato per lo spazio SVG) — JetBrains Mono ExtraBold. */
export const TOOL_GLYPH_PATHS: Record<ToolGlyphKey, string> = {
  computo: 'M560 -40L40 -40L40 -560ZM130 -330L130 -130L330 -130ZM40 -460L110 -460L110 -480L40 -480ZM40 -390L85 -390L85 -410L40 -410ZM40 -320L110 -320L110 -340L40 -340ZM40 -250L85 -250L85 -270L40 -270ZM40 -180L110 -180L110 -200L40 -200Z',
  // Amministrazione: cursori di regolazione.
  amministrazione: 'M62 -492H538A22 22 0 0 1 560 -470V-470A22 22 0 0 1 538 -448H62A22 22 0 0 1 40 -470V-470A22 22 0 0 1 62 -492ZM120 -470A70 70 0 1 1 260 -470A70 70 0 1 1 120 -470ZM62 -322H538A22 22 0 0 1 560 -300V-300A22 22 0 0 1 538 -278H62A22 22 0 0 1 40 -300V-300A22 22 0 0 1 62 -322ZM340 -300A70 70 0 1 1 480 -300A70 70 0 1 1 340 -300ZM62 -152H538A22 22 0 0 1 560 -130V-130A22 22 0 0 1 538 -108H62A22 22 0 0 1 40 -130V-130A22 22 0 0 1 62 -152ZM190 -130A70 70 0 1 1 330 -130A70 70 0 1 1 190 -130Z',
  // Contabilità: registro di contabilità (pagina rigata con costola).
  contabilita: 'M110 -570H490A40 40 0 0 1 530 -530V-70A40 40 0 0 1 490 -30H110A40 40 0 0 1 70 -70V-530A40 40 0 0 1 110 -570ZM150 -570V-30H172V-570ZM225 -470V-440H465V-470ZM225 -390V-360H465V-390ZM225 -310V-280H465V-310ZM225 -230V-200H465V-230ZM225 -150V-120H365V-150Z',
}

/**
 * Tool-id della suite (data-tool / registry dell'hub) → chiave del glifo.
 * Le chiavi `miu`, `mu`, `alfa`, `beta` sono i nomi storici, di quando i tool
 * portavano lettere greche: restano qui per i documenti già prodotti, che
 * dentro l'HTML si portano ancora quel `data-tool`. Non se ne scrivono di nuovi.
 */
export const TOOL_GLYPH_KEY: Record<string, ToolGlyphKey> = {
  computo: 'computo',
  contabilita: 'contabilita',
  amministrazione: 'amministrazione',
  miu: 'computo',
  mu: 'computo',
  alfa: 'amministrazione',
  beta: 'contabilita',
}

/** SVG inline del glifo (fill:currentColor → eredita l'accento del contenitore). */
export function toolGlyphSvg(key: ToolGlyphKey, cls = ''): string {
  const cl = cls ? ` ${cls}` : ''
  return `<svg class="ehb-glyph-svg${cl}" viewBox="${TOOL_GLYPH_VIEWBOX}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="${TOOL_GLYPH_PATHS[key]}" fill="currentColor"/></svg>`
}

/** Come sopra, ma partendo dal tool-id (ritorna '' se non è un tool con glifo). */
export function toolGlyphSvgById(toolId: string, cls = ''): string {
  const key = TOOL_GLYPH_KEY[toolId]
  return key ? toolGlyphSvg(key, cls) : ''
}

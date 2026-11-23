/**
 * MARCHIO Quadra come GOLDEN STANDARD, unica fonte.
 *
 * Il marchio è un riquadro diviso in quattro (il «quadro» del computo, le righe e le
 * colonne di misura) con la coda di una Q che termina nel punto rosso identitario.
 * Qui vive il suo path canonico + il punto, così da
 * essere SEMPRE FEDELE IN OGNI ISTANZA — welcome, header, e OUTPUT (PDF/CAD),
 * dove il `<text>` di un font non renderebbe mai uguale.
 *
 * `src/hub/index.html` tiene lo stesso path inline (per evitare il flash a caricamento):
 * un test di guardia (tests/shared/brand-mark) verifica che NON divergano da qui.
 */

export const QUADRA_MARK_VIEWBOX = '40 40 920 920'

/** Tracciato golden del marchio (fill:currentColor). */
export const QUADRA_MARK_PATH =
  'M230 80H650A150 150 0 0 1 800 230V650A150 150 0 0 1 650 800H230A150 150 0 0 1 80 650V230A150 150 0 0 1 230 80ZM240 185A55 55 0 0 0 185 240V640A55 55 0 0 0 240 695H640A55 55 0 0 0 695 640V240A55 55 0 0 0 640 185ZM424 185H456V695H424ZM185 424H695V456H185ZM692.4 607.6L892.4 807.6L807.6 892.4L607.6 692.4Z'

/** Punto rosso identitario del marchio. */
export const QUADRA_MARK_DOT = { cx: 862, cy: 862, r: 88, fill: '#e5484d' }

/** SVG inline del marchio Quadra (path a currentColor + punto rosso). */
export function ehubMarkSvg(cls = ''): string {
  const cl = cls ? ` ${cls}` : ''
  const d = QUADRA_MARK_DOT
  return `<svg class="ehb-mark-svg${cl}" viewBox="${QUADRA_MARK_VIEWBOX}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="${QUADRA_MARK_PATH}" fill="currentColor"/><circle cx="${d.cx}" cy="${d.cy}" r="${d.r}" fill="${d.fill}"/></svg>`
}

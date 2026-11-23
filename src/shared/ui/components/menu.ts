/**
 * IL MENU DEL TASTO DESTRO — uno solo, per tutta la suite (tappa 7 di
 * Docs/07-Un-lavoro-un-modulo.md). Lo usano la pagina di «Lavoro» (voci,
 * misure, elenco prezzi, la tappa) e la sidebar dell'hub (i nodi dell'albero),
 * così il tasto destro si comporta dappertutto allo stesso modo.
 *
 *  - si apre dove si è cliccato, ma sempre dentro lo schermo;
 *  - si usa anche da tastiera: frecce, Inizio/Fine, Invio o Spazio, Esc;
 *  - si chiude con un clic fuori, con Esc, scorrendo, o lasciando la finestra,
 *    e restituisce il fuoco a dov'era;
 *  - una voce può essere separatore, pericolosa (rossa) o disattivata (con il
 *    perché nel titolo).
 */

export interface VoceMenu {
  etichetta: string
  azione: () => void
  /** Spiegazione al passaggio del mouse (e perché è disattivata). */
  titolo?: string
  pericolo?: boolean
  disabilitato?: boolean
}
export type RigaMenu = VoceMenu | 'sep'

const ID = 'ehb-menu'
let _chiudi: (() => void) | null = null

const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

/** Chiude il menu aperto, se c'è. */
export function chiudiMenuContestuale(): void { _chiudi?.() }

/** Apre il menu alle coordinate della finestra (clientX/clientY). Senza voci non apre niente. */
export function apriMenuContestuale(x: number, y: number, righe: RigaMenu[], o: { titolo?: string } = {}): void {
  chiudiMenuContestuale()
  // niente separatori in testa, in coda o doppi
  const pulite = righe.filter((r, i, a) => r !== 'sep' || (i > 0 && i < a.length - 1 && a[i - 1] !== 'sep'))
  const voci = pulite.filter((r): r is VoceMenu => r !== 'sep')
  if (!voci.length) return

  const prima = document.activeElement as HTMLElement | null
  const m = document.createElement('div')
  m.id = ID
  m.className = 'ehb-menu'
  m.setAttribute('role', 'menu')
  if (o.titolo) m.setAttribute('aria-label', o.titolo)
  m.innerHTML = (o.titolo ? `<div class="ehb-menu__t">${esc(o.titolo)}</div>` : '') + pulite.map((r) => (r === 'sep'
    ? '<div class="ehb-menu__sep" role="separator"></div>'
    : `<button type="button" role="menuitem" class="ehb-menu__v${r.pericolo ? ' is-pericolo' : ''}"${r.disabilitato ? ' disabled aria-disabled="true"' : ''}${r.titolo ? ` title="${esc(r.titolo)}"` : ''}>${esc(r.etichetta)}</button>`)).join('')
  document.body.appendChild(m)

  const bottoni = [...m.querySelectorAll<HTMLButtonElement>('.ehb-menu__v')]
  bottoni.forEach((b, i) => b.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation()
    if (voci[i].disabilitato) return
    chiudi(false)
    voci[i].azione()
  }))

  // dentro lo schermo: a sinistra o sopra del punto se non ci sta
  const r = m.getBoundingClientRect()
  const vw = window.innerWidth, vh = window.innerHeight
  m.style.left = `${Math.max(4, x + r.width > vw - 4 ? x - r.width : x)}px`
  m.style.top = `${Math.max(4, y + r.height > vh - 4 ? Math.max(4, vh - r.height - 4) : y)}px`

  const attivi = (): HTMLButtonElement[] => bottoni.filter((b) => !b.disabled)
  const sposta = (d: number): void => {
    const a = attivi(); if (!a.length) return
    const i = a.indexOf(document.activeElement as HTMLButtonElement)
    a[(i + d + a.length) % a.length].focus()
  }
  const tasti = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') { e.preventDefault(); chiudi(true) }
    else if (e.key === 'ArrowDown') { e.preventDefault(); sposta(1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sposta(-1) }
    else if (e.key === 'Home') { e.preventDefault(); attivi()[0]?.focus() }
    else if (e.key === 'End') { e.preventDefault(); attivi().at(-1)?.focus() }
    else if (e.key === 'Tab') { e.preventDefault(); sposta(e.shiftKey ? -1 : 1) }
  }
  const fuori = (e: Event): void => { if (!m.contains(e.target as Node)) chiudi(false) }
  const via = (): void => chiudi(false)

  function chiudi(ridaiFuoco: boolean): void {
    m.remove()
    document.removeEventListener('keydown', tasti, true)
    document.removeEventListener('mousedown', fuori, true)
    document.removeEventListener('contextmenu', fuori, true)
    window.removeEventListener('scroll', via, true)
    window.removeEventListener('blur', via)
    window.removeEventListener('resize', via)
    _chiudi = null
    if (ridaiFuoco) prima?.focus?.()
  }
  _chiudi = () => chiudi(false)
  document.addEventListener('keydown', tasti, true)
  // il clic che ha aperto il menu non deve chiuderlo: si ascolta dal giro dopo
  setTimeout(() => {
    if (_chiudi === null) return
    document.addEventListener('mousedown', fuori, true)
    document.addEventListener('contextmenu', fuori, true)
    window.addEventListener('scroll', via, true)
    window.addEventListener('blur', via)
    window.addEventListener('resize', via)
  }, 0)
  attivi()[0]?.focus()
}

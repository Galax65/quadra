/* Modal condiviso Quadra — dialog su backdrop. Usa `.ehb-modal-backdrop` /
   `.ehb-modal` di components.css. Nessuna dipendenza. */

export interface ModalAction {
  label: string
  variant?: 'accent' | 'ghost' | ''
  /** Valore risolto dalla promise quando si clicca questa azione. */
  value?: unknown
}

export interface ModalOptions {
  title?: string
  /** Testo semplice del corpo (alternativo a `body`). */
  message?: string
  /** Nodo DOM custom da inserire nel corpo (ha precedenza su `message`). */
  body?: Node
  actions?: ModalAction[]
  /** Chiudibile con click sul backdrop / Esc (default true). */
  dismissible?: boolean
}

/** Apre un modal. Risolve col `value` dell'azione cliccata (o undefined se chiuso). */
export function openModal(opts: ModalOptions = {}): Promise<unknown> {
  const { title, message, body, actions = [], dismissible = true } = opts
  return new Promise((resolve) => {
    const backdrop = document.createElement('div')
    backdrop.className = 'ehb-modal-backdrop'

    const modal = document.createElement('div')
    modal.className = 'ehb-modal'
    modal.setAttribute('role', 'dialog')
    modal.setAttribute('aria-modal', 'true')

    if (title) {
      const h = document.createElement('h2')
      h.className = 'ehb-h2'
      h.textContent = title
      modal.appendChild(h)
    }
    if (body) {
      const wrap = document.createElement('div')
      wrap.style.margin = 'var(--sp-3) 0 var(--sp-5)'
      wrap.appendChild(body)
      modal.appendChild(wrap)
    } else if (message) {
      const p = document.createElement('p')
      p.className = 'ehb-muted'
      p.style.margin = 'var(--sp-3) 0 var(--sp-5)'
      p.textContent = message
      modal.appendChild(p)
    }

    let settled = false
    const close = (value: unknown) => {
      if (settled) return
      settled = true
      document.removeEventListener('keydown', onKey)
      backdrop.remove()
      resolve(value)
    }
    const onKey = (e: KeyboardEvent) => {
      if (dismissible && e.key === 'Escape') close(undefined)
    }

    if (actions.length) {
      const bar = document.createElement('div')
      bar.style.cssText = 'display:flex;gap:var(--sp-3);justify-content:flex-end'
      for (const a of actions) {
        const btn = document.createElement('button')
        btn.className = 'ehb-btn' + (a.variant ? ' ehb-btn--' + a.variant : '')
        btn.textContent = a.label
        btn.onclick = () => close(a.value)
        bar.appendChild(btn)
      }
      modal.appendChild(bar)
    }

    backdrop.appendChild(modal)
    if (dismissible) {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) close(undefined)
      })
    }
    document.addEventListener('keydown', onKey)
    document.body.appendChild(backdrop)
  })
}

/** Conferma sì/no. Risolve true se confermato, false altrimenti. */
export interface CampoModal {
  /** Chiave con cui il valore torna indietro. */
  nome: string
  etichetta: string
  valore?: string
  segnaposto?: string
  /** `text` (default) o `number`. */
  tipo?: 'text' | 'number'
  /** Nota sotto al campo. */
  nota?: string
}


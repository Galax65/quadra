/* Collassa/espandi un pannello laterale Quadra. Aggiunge/toglie una classe
   (default 'collapsed') sul pannello e persiste lo stato. Lo strip/affordance
   di espansione è gestito dal CSS del tool. Condiviso dai tool con sidebar. */

export interface CollapseOptions {
  /** Classe applicata quando collassato (default 'collapsed'). */
  collapsedClass?: string
  /** Chiave localStorage per persistere lo stato (opzionale). */
  storageKey?: string
  /** Callback a ogni cambio (es. per ridisegnare canvas). */
  onChange?: (collapsed: boolean) => void
}

export interface CollapseHandle {
  toggle: () => void
  set: (collapsed: boolean) => void
  isCollapsed: () => boolean
}


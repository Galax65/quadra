/**
 * Registry della CLI «quadra» — FONTE DI VERITÀ dei comandi batch della suite.
 * Da qui nascono il dispatch (quadra.ts) e l'help (`npm run quadra -- help [--json]`). I moduli
 * comando NON hanno side-effect all'import (requisito: questo file è importato
 * anche da sync-docs e dai test).
 *
 * Per aggiungere un comando: nuovo modulo in commands/ (pattern `tool:azione`),
 * voce qui sotto, `npm run sync:docs` — tests/cli/registry.test.ts fa da
 * guardia su nomi/descrizioni/esempi.
 */
import { betaAtti } from './commands/beta-atti'
import { miuCerca } from './commands/miu-cerca'
import { miuElenco } from './commands/miu-elenco'
import type { ComandoCli } from './types'

export const COMANDI: ComandoCli[] = [
  betaAtti,
  miuElenco,
  miuCerca,
]

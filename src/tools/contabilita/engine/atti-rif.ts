/**
 * Contabilità — RIFERIMENTI INCROCIATI FRA GLI ATTI e CONTINUITÀ DELLE PAGINE.
 *
 * Gli atti contabili non sono fogli indipendenti: si richiamano l'uno con
 * l'altro, ed è quel richiamo che rende la contabilità verificabile da un
 * terzo (collaudatore, revisore, giudice).
 *
 *  - il REGISTRO trascrive le partite del LIBRETTO e deve dire da quale
 *    libretto e da quale numero vengono (art. 14 All. II.14);
 *  - il SOMMARIO riepiloga le partite del registro e deve dire a quale SAL e a
 *    quale numero d'ordine del registro corrispondono (art. 15);
 *  - libretto e registro sono UN SOLO registro a pagine numerate e vidimate
 *    (art. 2215 c.c.): al secondo SAL non ricominciano da pagina 1 né
 *    ristampano il frontespizio, continuano.
 *
 * Qui stanno le due funzioni pure che servono a tutti gli atti: il numero
 * d'ordine di iscrizione di ogni partita e la pagina da cui un atto riprende.
 * Nessun numero inventato: se le pagine già emesse non si conoscono, la
 * numerazione riparte da 1 e l'atto non dichiara un «segue» falso.
 */
import type { Consegna, Partita } from './types'

/**
 * NUMERO D'ORDINE DI ISCRIZIONE di ogni partita nel registro di contabilità.
 * È il numero con cui la partita entra in contabilità e NON cambia più: le
 * voci si iscrivono nell'ordine in cui compaiono (prima quelle del contratto,
 * poi quelle introdotte dalle perizie, SAL per SAL). Una voce soppressa
 * conserva il suo numero — negli atti pubblici non si cancella nulla.
 */
export function ordineIscrizione(partite: Partita[]): Map<string, number> {
  const ord = new Map<string, number>()
  const perSal = [...partite].map((p, i) => ({ p, i, sal: p.introdottaSal ?? 1 }))
  perSal.sort((a, b) => (a.sal - b.sal) || (a.i - b.i))
  perSal.forEach((x, k) => ord.set(x.p.id, k + 1))
  return ord
}

/** Numero d'ordine di una partita (1 se sconosciuta: non si inventa un buco). */
export const nOrdine = (ord: Map<string, number>, pid: string): number => ord.get(pid) ?? 0

/**
 * Richiamo al libretto da scrivere nel registro: «LM 2 · n. 17» — numero del
 * libretto (= il SAL che l'ha prodotto) e numero d'ordine della partita.
 * Con `pagina` noto (solo nella stampa PDF, che impagina davvero) aggiunge
 * «pag. 4».
 */
export function rifLibretto(salN: number, ordine: number, pagina?: number | null): string {
  const base = `LM ${salN}${ordine ? ` · n. ${ordine}` : ''}`
  return pagina ? `${base} · pag. ${pagina}` : base
}

/** Richiamo al registro da scrivere nel sommario: «SAL 2 · RC n. 17». */
export function rifRegistro(salN: number, ordine: number, pagina?: number | null): string {
  const base = `SAL ${salN}${ordine ? ` · RC n. ${ordine}` : ''}`
  return pagina ? `${base} · pag. ${pagina}` : base
}

/** Pagine già emesse per un atto (libretto/registro) nei SAL precedenti. */
export function pagineEmesse(consegne: Consegna[] | undefined, tipo: string, salN: number): number | null {
  const prec = (consegne || []).filter((c) => c.tipo === tipo && (c.salNumero ?? 0) < salN)
  if (!prec.length) return 0
  // basta una emissione senza conteggio delle pagine e la continuità non è dimostrabile
  if (prec.some((c) => !c.pagine)) return null
  return prec.reduce((n, c) => n + (c.pagine || 0), 0)
}

/**
 * Pagina da cui riprende l'atto del SAL `salN`: 1 per il primo atto o quando le
 * pagine precedenti non si conoscono (allora non si dichiara un «segue»).
 */
export function paginaIniziale(consegne: Consegna[] | undefined, tipo: string, salN: number): number {
  const p = pagineEmesse(consegne, tipo, salN)
  return p == null ? 1 : p + 1
}

/** Vero quando l'atto continua un atto già emesso: niente frontespizio. */
export function atoContinua(consegne: Consegna[] | undefined, tipo: string, salN: number): boolean {
  return (consegne || []).some((c) => c.tipo === tipo && (c.salNumero ?? 0) < salN)
}

/**
 * Nota di continuità da stampare in testa a un atto che non è il primo:
 * «Segue dal Libretto n. 1 — pagine da 5». Senza il conteggio delle pagine dice
 * soltanto da dove segue, perché il numero non lo si indovina.
 */
export function notaSeguito(consegne: Consegna[] | undefined, tipo: string, salN: number, etichetta: string): string | null {
  if (!atoContinua(consegne, tipo, salN)) return null
  const pag = pagineEmesse(consegne, tipo, salN)
  const prec = (consegne || []).filter((c) => c.tipo === tipo && (c.salNumero ?? 0) < salN)
    .map((c) => c.salNumero).filter((n): n is number => n != null).sort((a, b) => b - a)[0]
  const da = prec != null ? ` n. ${prec}` : ''
  return pag == null
    ? `Segue dal ${etichetta}${da}: fogli dello stesso registro, numerati di seguito.`
    : `Segue dal ${etichetta}${da} — pagine da ${pag + 1}. Fogli dello stesso registro, numerati di seguito (art. 2215 c.c.).`
}

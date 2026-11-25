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
import type { Consegna, Partita, RigaSal, Sal } from './types'

/** La riga del SAL scrive davvero qualcosa per la voce (quantità, quota o misure non nulle)? */
export function rigaConEseguito(r: RigaSal | undefined): boolean {
  if (!r) return false
  if (r.misurazioni?.length && r.misurazioni.some((m) => Math.abs(m.quantita || 0) > 1e-9)) return true
  if (r.quantitaProgressiva) return true
  if (r.quotaPct) return true
  return !!r.sotto?.some((x) => x.quantitaProgressiva || x.misurazioni?.some((m) => Math.abs(m.quantita || 0) > 1e-9))
}

/**
 * NUMERO D'ORDINE DI ISCRIZIONE di ogni partita nel registro di contabilità.
 * È il numero con cui la partita entra in contabilità e NON cambia più.
 *
 * Con i SAL (il caso degli atti): si numerano SOLO le voci contabilizzate,
 * progressivamente, nell'ordine in cui entrano in contabilità — prima quelle
 * del primo SAL che le misura, nell'ordine dell'elenco, poi quelle del SAL
 * dopo, e così via. Una voce del contratto mai contabilizzata non ha numero
 * (e non sta nel registro). Una voce soppressa dopo essere stata
 * contabilizzata conserva il suo numero — negli atti pubblici non si cancella
 * nulla.
 *
 * Senza SAL: tutte le partite, prima quelle del contratto, poi quelle
 * introdotte dalle perizie, SAL per SAL.
 */
export function ordineIscrizione(partite: Partita[], sals?: Sal[]): Map<string, number> {
  const ord = new Map<string, number>()
  if (sals) {
    const perId = new Map(partite.map((p, i) => [p.id, i]))
    let k = 0
    for (const s of [...sals].sort((a, b) => a.numero - b.numero)) {
      const nuove = s.righe.filter((r) => perId.has(r.partitaId) && !ord.has(r.partitaId) && rigaConEseguito(r))
        .sort((a, b) => (perId.get(a.partitaId)! - perId.get(b.partitaId)!))
      for (const r of nuove) ord.set(r.partitaId, ++k)
    }
    return ord
  }
  const perSal = [...partite].map((p, i) => ({ p, i, sal: p.introdottaSal ?? 1 }))
  perSal.sort((a, b) => (a.sal - b.sal) || (a.i - b.i))
  perSal.forEach((x, k) => ord.set(x.p.id, k + 1))
  return ord
}

/** SAL in cui ogni voce è entrata in contabilità (il libretto da cui il registro la trascrive). */
export function salDiIscrizione(sals: Sal[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const s of [...sals].sort((a, b) => a.numero - b.numero)) {
    for (const r of s.righe) if (!m.has(r.partitaId) && rigaConEseguito(r)) m.set(r.partitaId, s.numero)
  }
  return m
}

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

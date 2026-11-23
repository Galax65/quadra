/**
 * DATE ALL'ITALIANA — un posto solo per gg/mm/aaaa.
 *
 * Gli atti pubblici sono scritti in date italiane («12/03/2026»), i calcoli si
 * fanno in ISO («2026-03-12»): servono entrambe, e servono identiche in tutti
 * gli strumenti, perché una scadenza di legge sbagliata di un giorno è un
 * errore vero. Niente libreria: solo conversioni e differenze in giorni.
 */
const pad = (n: number): string => String(n).padStart(2, '0')

/** Oggi in ISO (fuso locale, non UTC: la data di cantiere è quella del posto). */
export function oggiISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** «2026-03-12» → «12/03/2026»; vuoto se la data non c'è. */
export function isoToIt(iso?: string | null): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return d && m && y ? `${d}/${m}/${y}` : ''
}

/** «12/03/2026» → «2026-03-12»; null se non è una data italiana completa. */
export function itToISO(it?: string | null): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((it || '').trim())
  return m ? `${m[3]}-${pad(+m[2])}-${pad(+m[1])}` : null
}

/** ISO + n giorni (n anche negativo). */
export function addDaysISO(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + n)
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}

/** Data italiana + n giorni, in italiano; vuoto se la data di partenza non c'è. */
export function addDaysIt(it?: string | null, n = 0): string {
  const iso = itToISO(it)
  return iso ? isoToIt(addDaysISO(iso, n)) : ''
}

/** Giorni da `aISO` a `bISO` (positivo se b è dopo a); null se una manca. */
export function giorniTra(aISO?: string | null, bISO?: string | null): number | null {
  if (!aISO || !bISO) return null
  const [ay, am, ad] = aISO.split('-').map(Number)
  const [by, bm, bd] = bISO.split('-').map(Number)
  if (!ay || !by) return null
  const a = Date.UTC(ay, am - 1, ad), b = Date.UTC(by, bm - 1, bd)
  return Math.round((b - a) / 86400000)
}

/** Giorni tra due date in formato italiano (dd/mm/yyyy); null se una manca o non è valida. */
export function giorniTraIt(a?: string | null, b?: string | null): number | null {
  return giorniTra(itToISO(a), itToISO(b))
}

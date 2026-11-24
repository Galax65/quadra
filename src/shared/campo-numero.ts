/**
 * Lettura dei numeri scritti nell'interfaccia, con i separatori DELLA LINGUA DI
 * SISTEMA e non di un paese solo.
 *
 * Perché serve: un `<input type="number">` restituisce il valore in forma
 * canonica — punto decimale, mai separatori delle migliaia — qualunque lingua
 * usi chi digita. Chi scrive «5,086» su un computer italiano ottiene la stringa
 * «5.086»: letta con le regole italiane diventa cinquemilaottantasei, e un
 * ribasso del 5,086% si trasforma in un ribasso del 5086%, con un certificato
 * di pagamento da milioni di euro di segno sbagliato. È successo davvero, ed è
 * il motivo per cui campi numerici e campi di testo hanno due letture distinte.
 */

/** Separatori della lingua di sistema (o di quella indicata, per le prove). */
export function separatoriDiSistema(locale?: string): { decimale: string; migliaia: string } {
  try {
    const parti = new Intl.NumberFormat(locale).formatToParts(12345.6)
    return {
      decimale: parti.find((p) => p.type === 'decimal')?.value || '.',
      migliaia: parti.find((p) => p.type === 'group')?.value || ',',
    }
  } catch {
    return { decimale: '.', migliaia: ',' }
  }
}

const pulisci = (v: string | null | undefined): string => String(v ?? '').trim().replace(/[\s  ]/g, '')

/**
 * Valore di un campo di TESTO in cui si scrive un numero: qui valgono i
 * separatori della lingua di sistema, perché è così che l'utente li digita ed è
 * così che il programma glieli ha mostrati.
 */
export function leggiNumeroTesto(v: string | null | undefined, locale?: string): number | null {
  const s = pulisci(v)
  if (!s) return null
  const { decimale } = separatoriDiSistema(locale)
  const sep = s.match(/[.,]/g) || []
  let s2 = s
  if (sep.length) {
    const ultimo = Math.max(s.lastIndexOf('.'), s.lastIndexOf(','))
    const dopo = s.length - ultimo - 1
    const car = s[ultimo]
    // Un separatore delle migliaia è SEMPRE seguito da tre cifre: se ne seguono
    // una o due, quello è il decimale, in qualunque lingua. Con tre cifre resta
    // l'ambiguità («5.086»): decide la lingua di sistema.
    const decimaleQui = dopo !== 3 ? true : (sep.length === 1 && car === decimale)
    s2 = decimaleQui
      ? s.slice(0, ultimo).replace(/[.,]/g, '') + '.' + s.slice(ultimo + 1)
      : s.replace(/[.,]/g, '')
  }
  const n = Number(s2)
  return Number.isFinite(n) ? n : null
}

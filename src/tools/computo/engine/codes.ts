/**
 * Helper puri e generici (indipendenti dal formato) su intestazioni e codici voce.
 * Estratti fedelmente da PriceList_v2_3.html; riusati dal parser legacy e dai
 * futuri parser per-famiglia.
 */

/** Normalizza un'intestazione per il confronto: minuscolo, senza accenti, solo [a-z0-9]. */
export function normH(s: unknown): string {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

/**
 * Anteprima breve a una riga: prima riga del testo, spazi compattati, troncata a `max`.
 * Riusata dai parser per generare `desc_short` quando manca una descrizione sintetica.
 */
export function firstLinePreview(text: string, max = 220): string {
  const firstLine = (text || '').split(/[\n\r]/)[0].trim().replace(/\s+/g, ' ')
  return firstLine.length > max ? firstLine.substring(0, max) + '…' : firstLine
}


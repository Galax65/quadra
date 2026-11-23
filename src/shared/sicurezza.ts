/**
 * Oneri della sicurezza (D.Lgs. 81/2008, all. XV; D.Lgs. 36/2023): voci NON soggette a
 * ribasso. Si riconoscono dal capitolo del prezzario («Impianti ed attrezzature per la
 * tutela della salute e la protezione dei lavoratori nel cantiere», «Oneri della sicurezza»,
 * «Costi della sicurezza»…) e si possono sempre segnare o togliere a mano voce per voce.
 */
const RE_SICUREZZA = /protezione dei lavoratori|tutela della salute|sicurezza (nel|del|in|nei|dei) cantier|(oneri|costi|apprestamenti) (della|per la|di) sicurezza|^\s*sicurezza\s*$/i

/** Vero se un testo di capitolo indica la sicurezza di cantiere (non gli impianti di sicurezza). */
export function capitoloSicurezza(testo: string | undefined | null): boolean {
  return !!testo && RE_SICUREZZA.test(String(testo))
}

/** Vero se una riga di prezzario appartiene a un capitolo della sicurezza. */
export function rigaDiSicurezza(r: { liv1?: string; liv2?: string; liv3?: string; disciplina?: string; sistema?: string; settore?: string; capitolo?: string } | null | undefined): boolean {
  if (!r) return false
  return [r.liv1, r.liv2, r.liv3, r.disciplina, r.sistema, r.settore, r.capitolo].some(capitoloSicurezza)
}

/**
 * Sicurezza effettiva di una voce del computo: la scelta manuale (`segnata`: true/false)
 * vince; altrimenti il flag della voce composta o, per una riga di prezzario, il capitolo.
 */
export function voceDiSicurezza(segnata: boolean | undefined, flagVoce: boolean | undefined, riga?: Parameters<typeof rigaDiSicurezza>[0]): boolean {
  if (segnata === true || segnata === false) return segnata
  if (flagVoce) return true
  return rigaDiSicurezza(riga)
}

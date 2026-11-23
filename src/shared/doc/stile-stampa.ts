/**
 * IMPOSTAZIONI DI STAMPA degli atti: formato del foglio, orientamento, margini,
 * carattere e corpo, intestazione e piè di pagina.
 *
 * Non si toccano i generatori degli atti: questi valori diventano un foglio di
 * stile che si sovrappone a quello del documento, applicato al testo HTML già
 * prodotto. Così ogni atto — presente e futuro — li rispetta senza che nessuno
 * debba ricordarsi di passarli.
 */
export interface StileStampa {
  formato?: 'A4' | 'A3' | 'Letter' | 'Legal'
  orientamento?: 'verticale' | 'orizzontale'
  /** Margini del foglio in millimetri. */
  margini?: { sopra?: number; sotto?: number; sinistra?: number; destra?: number }
  /** Corpo del testo in punti (il resto del documento scala di conseguenza). */
  corpo?: number
  carattere?: 'sans' | 'serif' | 'mono'
  /** Testata (ente, titolo dell'atto, dati in alto a destra). */
  intestazione?: boolean
  /** Cartiglio a piè di pagina (campi, disclaimer, numerazione). */
  piede?: boolean
}

/**
 * L'IMPIANTO STANDARD: il foglio da cui si parte e a cui si torna («↺ Standard»).
 *
 * Nessuna norma fissa i margini di un computo o di un registro; c'è però una
 * consuetudine degli elaborati di progetto e degli atti contabili, ed è questa:
 *  - A4 verticale (UNI EN ISO 216), il foglio di registri, fascicoli e protocollo;
 *  - margine SINISTRO di 20 mm: è il lato che si rilega, si fora o si cuce nel
 *    registro vidimato, e il testo non deve finirci dentro;
 *  - 15 mm sugli altri tre lati;
 *  - carattere lineare a 10 pt (Arimo, con le metriche di Arial: le stesse
 *    righe e gli stessi a capo su ogni computer), incorporato nei PDF;
 *  - testata e cartiglio presenti: ente, atto, numerazione delle pagine.
 * I PDF escono inoltre PDF/A-2b, il formato da conservazione (stampa/pdfa.ts).
 */
export const IMPIANTO_STANDARD: Required<Omit<StileStampa, 'margini'>> & { margini: Required<NonNullable<StileStampa['margini']>> } = {
  formato: 'A4',
  orientamento: 'verticale',
  margini: { sopra: 15, sotto: 15, sinistra: 20, destra: 15 },
  corpo: 10,
  carattere: 'sans',
  intestazione: true,
  piede: true,
}
/** I valori di partenza delle impostazioni: l'impianto standard. */
export const STILE_STAMPA_DEFAULT = IMPIANTO_STANDARD

/** Vero se le impostazioni sono quelle dell'impianto standard. */
export function eImpiantoStandard(s?: StileStampa): boolean {
  if (!s) return true
  const d = IMPIANTO_STANDARD, m = { ...d.margini, ...(s.margini || {}) }
  return (s.formato ?? d.formato) === d.formato && (s.orientamento ?? d.orientamento) === d.orientamento
    && (s.corpo ?? d.corpo) === d.corpo && (s.carattere ?? d.carattere) === d.carattere
    && (s.intestazione ?? true) && (s.piede ?? true)
    && m.sopra === d.margini.sopra && m.sotto === d.margini.sotto && m.sinistra === d.margini.sinistra && m.destra === d.margini.destra
}

const FAMIGLIA: Record<NonNullable<StileStampa['carattere']>, string> = {
  sans: 'var(--sans)', serif: 'var(--serif)', mono: 'var(--mono)',
}

/** Foglio di stile che realizza le impostazioni: nient'altro che differenze. */
export function stileStampaCSS(s?: StileStampa): string {
  if (!s) return ''
  const d = STILE_STAMPA_DEFAULT
  const m = { ...d.margini, ...(s.margini || {}) }
  const formato = s.formato || d.formato
  const orient = (s.orientamento || d.orientamento) === 'orizzontale' ? ' landscape' : ''
  const corpo = s.corpo || d.corpo
  const fam = FAMIGLIA[s.carattere || d.carattere]
  const righe: string[] = [
    `@page { size:${formato}${orient}; margin:${m.sopra}mm ${m.destra}mm ${m.sotto}mm ${m.sinistra}mm; }`,
    `body { font-family:${fam}; font-size:${corpo}pt; padding:${m.sopra}mm ${m.destra}mm 0 ${m.sinistra}mm; }`,
    // le tabelle degli atti hanno corpi propri in millimetri: si riscalano col testo
    `.dtable, .dtable th, .dtable td { font-size:${(corpo * 0.92).toFixed(2)}pt; }`,
    `.sub { font-size:${(corpo * 0.82).toFixed(2)}pt; }`,
  ]
  if (s.intestazione === false) righe.push('.dochead, .doc-ente, .docente, .dochead__meta { display:none !important; }')
  if (s.piede === false) righe.push('.docfoot { display:none !important; }')
  return righe.join('\n')
}

/**
 * Applica le impostazioni a un atto già prodotto, inserendo il foglio di stile
 * in coda alla testata. Se non c'è nulla da cambiare, il documento resta quello.
 */
export function applicaStileStampa(html: string, s?: StileStampa): string {
  const css = stileStampaCSS(s)
  if (!css) return html
  const stile = `<style id="stile-stampa">\n${css}\n</style>`
  return html.includes('</head>') ? html.replace('</head>', `${stile}</head>`) : stile + html
}

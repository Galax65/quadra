/**
 * LA TESTATA DI FASE — dove sono, a che prezzi lavoro, a che punto è.
 *
 * Le stesse tre informazioni in ogni schermata, nello stesso posto, in Computo
 * e in Contabilità: il nome della fase con la sua revisione, che cosa è (con la
 * data), e le pastiglie dello stato («progetto · prezzi rev.00 · in bozza»). A
 * destra le azioni proprie della schermata e UN SOLO comando di stampa
 * (Docs/06-Interfaccia-unica.md §3, regola 2): la stampa non è una fase a cui si
 * arriva, si stampa da dove si è.
 */

const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

export interface Pastiglia {
  testo: string
  /** 'fase' = il capitolo del lavoro (colore della fase); 'bozza' = non ancora valido. */
  tono?: 'fase' | 'bozza'
}

export interface TestataFase {
  /** Il nome della schermata: «Computo metrico», «Libretto delle misure»… */
  titolo: string
  /** La sigla della revisione (rev.03). */
  revisione?: string
  /** Che cosa è, in chiaro: «SAL n. 2 · 01/10/2026», «12 voci». */
  sottotitolo?: string
  /** id del sottotitolo, per aggiornarlo senza ridisegnare la testata. */
  idSottotitolo?: string
  pastiglie?: Pastiglia[]
}

/** Il comando di stampa della schermata: uno, sempre lo stesso, sempre qui. */
export interface StampaTestata {
  onclick: string
  titolo?: string
}

/** La parte sinistra: nome, revisione, sottotitolo, pastiglie. */
export function testataTitoloHtml(t: TestataFase): string {
  const pastiglie = (t.pastiglie || []).filter((p) => p.testo)
    .map((p) => `<span class="ehb-pastiglia${p.tono ? ' is-' + p.tono : ''}">${esc(p.testo)}</span>`).join('')
  return `<span class="ehb-testata__t">${esc(t.titolo)}</span>`
    + (t.revisione ? `<span class="ehb-testata__n">${esc(t.revisione)}</span>` : '')
    + (t.sottotitolo ? `<span class="ehb-testata__s"${t.idSottotitolo ? ` id="${esc(t.idSottotitolo)}"` : ''}>${esc(t.sottotitolo)}</span>` : '')
    + pastiglie
}

/** La parte destra: le azioni della schermata, poi la stampa. */
export function testataAzioniHtml(o: { azioni?: string; stampa?: StampaTestata }): string {
  const stampa = o.stampa
    ? `<button class="ehb-btn ehb-btn--sm ehb-btn--accent-soft ehb-testata__stampa" onclick="${esc(o.stampa.onclick)}" title="${esc(o.stampa.titolo || 'Stampa: che cosa, come e in che formato — una domanda sola, sempre la stessa')}">⎙ Stampa…</button>`
    : ''
  return (o.azioni || '') + stampa
}

/** La testata intera, per chi non ha già i suoi due contenitori. */
export function testataHtml(t: TestataFase & { azioni?: string; stampa?: StampaTestata; id?: string }): string {
  return `<div class="ehb-testata"${t.id ? ` id="${esc(t.id)}"` : ''}><div class="ehb-testata__tit">${testataTitoloHtml(t)}</div><div class="ehb-testata__act">${testataAzioniHtml(t)}</div></div>`
}

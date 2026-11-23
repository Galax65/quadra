/**
 * IL PIEDE — i valori di controllo, in calce e sempre visibili.
 *
 * Che cosa ci va lo decide la fase (fase.ts, `calce`): totale di progetto,
 * contabilizzato a tutto il SAL, maggiori e minori lavori della perizia. Qui si
 * decide solo come si vede, uguale in ogni fase: una sintesi a sinistra, il
 * numero che conta a destra, e sotto le righe che lo spiegano.
 */
import type { Calce, DescrittoreFase, Formatta } from './fase'

export interface OpzioniPiede {
  /** Comandi a sinistra, prima della sintesi (es. «Svuota computo»). HTML già pronto. */
  azioni?: string
  /** Comandi a destra, dopo il numero (es. «Chiudi»). HTML già pronto. */
  coda?: string
  /** id del contenitore, per ridisegnare solo il piede. */
  id?: string
}

/** Il piede di una calce già calcolata. */
export function piedeHtml(c: Calce, o: OpzioniPiede = {}): string {
  return `<div class="ehb-piede"${o.id ? ` id="${o.id}"` : ''}>
    ${o.azioni ? `<div class="ehb-piede__az">${o.azioni}</div>` : ''}
    <div class="ehb-piede__sx">${c.sintesi || ''}</div>
    <div class="ehb-piede__dx">
      <div class="ehb-piede__lab">${c.etichetta}</div>
      <div class="ehb-piede__n${c.allarme ? ' is-allarme' : ''}">${c.valore}</div>
      ${(c.sotto || []).filter(Boolean).map((s) => `<div class="ehb-piede__sub">${s}</div>`).join('')}
    </div>
    ${o.coda ? `<div class="ehb-piede__az">${o.coda}</div>` : ''}
  </div>`
}

/** Il piede di una fase: la fase calcola i valori, il piede li dispone. */
export function piedeFaseHtml<V>(fase: DescrittoreFase<V>, valori: V, eur: Formatta, o: OpzioniPiede = {}): string {
  return piedeHtml(fase.calce(valori, eur), o)
}

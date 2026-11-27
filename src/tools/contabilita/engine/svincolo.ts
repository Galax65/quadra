/**
 * SVINCOLO DELLA RITENUTA DI GARANZIA (art. 11 c. 6 D.Lgs. 36/2023).
 *
 * Lo 0,50% trattenuto su ogni certificato non è dell'impresa finché non
 * ricorrono due condizioni, entrambe: l'APPROVAZIONE del certificato di
 * collaudo (o del certificato di regolare esecuzione) da parte della stazione
 * appaltante, e il DURC regolare. Mancando l'una o l'altro, la somma resta
 * trattenuta — e il conto finale deve dire perché, non lasciare un numero in
 * fondo a una colonna.
 */
import { escHtml } from '../../../shared/doc/doc'
import { eur } from '../../../shared/format'
import type { Appalto } from './types'

export interface StatoSvincolo {
  /** Ritenuta complessivamente maturata sui certificati. */
  maturata: number
  svincolabile: boolean
  /** Le condizioni mancanti, in parole. */
  mancano: string[]
  /** Data a cui lo svincolo può essere disposto (approvazione del collaudo). */
  data?: string
  /** Collaudo o certificato di regolare esecuzione. */
  attoLabel: string
}

export function statoSvincolo(appalto: Appalto, ritenutaMaturata: number): StatoSvincolo {
  const c = appalto.collaudo || {}
  const attoLabel = c.tipo === 'cre' ? 'certificato di regolare esecuzione' : 'certificato di collaudo'
  const mancano: string[] = []
  if (!c.dataApprovazione) mancano.push(`l'approvazione del ${attoLabel} da parte della stazione appaltante`)
  if (appalto.durc?.regolare !== true) mancano.push('il documento unico di regolarità contributiva in corso di validità')
  return {
    maturata: ritenutaMaturata,
    svincolabile: mancano.length === 0 && ritenutaMaturata > 0,
    mancano,
    data: c.dataApprovazione,
    attoLabel,
  }
}

/** Prospetto dello svincolo per il conto finale e lo stato finale. */
export function svincoloHTML(s: StatoSvincolo): string {
  if (!s.maturata) return ''
  return `
    <h2 class="sec-h">Ritenuta di garanzia</h2>
    <table class="dtable"><tbody>
      <tr><td>Ritenute dello 0,50% operate sui certificati di pagamento</td><td class="num">${eur(s.maturata)}</td></tr>
      <tr><td>${escHtml(s.attoLabel.charAt(0).toUpperCase() + s.attoLabel.slice(1))} approvato il</td><td class="num">${s.data ? escHtml(s.data) : '<i class="nd">—</i>'}</td></tr>
      <tr class="tot"><td>${s.svincolabile ? 'Somma da svincolare in favore dell\'esecutore' : 'Somma che resta trattenuta'}</td><td class="num">${eur(s.maturata)}</td></tr>
    </tbody></table>
    ${s.svincolabile
      ? `<p class="note">Ricorrono le condizioni dell'art. 11 c. 6 D.Lgs. 36/2023: le ritenute possono essere svincolate in sede di liquidazione finale.</p>`
      : `<p class="warn"><b>Le ritenute non si svincolano:</b> manca ${s.mancano.join(' e manca ')}. Lo svincolo avviene soltanto in sede di liquidazione finale, dopo l'approvazione del ${escHtml(s.attoLabel)} e previo rilascio del DURC (art. 125 c. 2 D.Lgs. 36/2023).</p>`}`
}

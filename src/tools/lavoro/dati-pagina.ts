/**
 * I DATI DEL LAVORO A TUTTA PAGINA — oggetto, luogo, CUP e CIG, committente,
 * tecnici, impresa, prezzario di riferimento: quello che va nelle testate di
 * tutte le stampe. Era una finestra con «Salva»; ora è una pagina come
 * «Contratto, tempi e pagamenti», e ogni campo si salva da solo uscendone.
 *
 * Modulo PURO: riceve il lavoro e restituisce HTML; `lvDato` lo espone main.ts.
 */
import { testataHtml } from '../../shared/griglia'
import { CAMPI_DATI_GENERALI, normalizzaDatiGenerali } from '../../shared/dati-generali'
import type { Lavoro } from '../../shared/lavoro'

const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

/** I campi larghi prendono la riga intera; gli altri si affiancano. */
const LARGHI = new Set(['oggetto', 'committente', 'indirizzoCommittente', 'prezzario'])
const STRETTI: Record<string, string> = { provincia: '80px', cup: '200px', cig: '160px', data: '130px' }

const NOTA_GRUPPO: Record<string, string> = {
  Opera: 'In testa a ogni stampa: computo, elenco prezzi, atti della contabilità.',
  Committente: 'La stazione appaltante e il responsabile del procedimento.',
  Tecnici: 'I nomi che firmano gli elaborati e gli atti.',
  Impresa: 'L\'esecutore: compare nei SAL, nei certificati e nei verbali.',
  Elaborati: 'Il prezzario dichiarato nelle stampe e la data degli elaborati (vuota = data di stampa).',
}

export function paginaDati(l: Lavoro): string {
  const dg = normalizzaDatiGenerali(l.dati)
  const gruppi = [...new Set(CAMPI_DATI_GENERALI.map((c) => c.gruppo))]
  const riquadri = gruppi.map((g) => {
    const campi = CAMPI_DATI_GENERALI.filter((c) => c.gruppo === g).map((c) => {
      const stile = LARGHI.has(c.chiave) ? ' style="flex:1 1 100%"' : STRETTI[c.chiave] ? ` style="flex:0 0 ${STRETTI[c.chiave]}"` : ''
      return `<label class="lv-f"${stile}><span>${esc(c.etichetta)}</span><input name="${c.chiave}" value="${esc(dg[c.chiave])}"${c.segnaposto ? ` placeholder="${esc(c.segnaposto)}"` : ''} onchange="lvDato('${c.chiave}',this.value)"></label>`
    }).join('')
    return `<section class="lv-ct">
        <h2>${esc(g)}</h2>
        ${NOTA_GRUPPO[g] ? `<p class="lv-nota">${esc(NOTA_GRUPPO[g])}</p>` : ''}
        <div class="lv-righe">${campi}</div>
      </section>`
  }).join('')
  return `<section class="lv-page lv-dati">
    ${testataHtml({ titolo: 'Dati del lavoro', sottotitolo: 'vanno nelle testate di tutte le stampe · si salvano da soli', pastiglie: [{ testo: 'dati', tono: 'fase' }] })}
    <div class="lv-body lv-dati__corpo">${riquadri}</div>
  </section>`
}

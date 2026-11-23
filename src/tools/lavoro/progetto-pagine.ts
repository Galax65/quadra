/**
 * LE PAGINE DEL PROGETTO di una revisione di computo: il QUADRO ECONOMICO
 * (A lavori e sicurezza dal computo, B somme a disposizione) e le OFFERTE di
 * gara con il quadro comparativo e la graduatoria; dall'offerta migliore nasce
 * il contratto. Modulo PURO; i calcoli sono quelli condivisi
 * (quadro-economico.ts, offerte.ts).
 */
import { testataHtml } from '../../shared/griglia'
import { calcolaQE, normalizzaQE } from '../../shared/quadro-economico'
import { valutaOfferte } from '../../shared/offerte'
import { importiRevisione, contratto, sigla, type Lavoro, type Revisione } from '../../shared/lavoro'
import type { VoceComputo } from '../../shared/xpwe/xpwe'
import { eur, fmt } from './schermata'

const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
const q = (s: string): string => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
const num = (n: number | null | undefined): string => (n == null ? '' : String(n).replace('.', ','))

function pagina(titolo: string, sottotitolo: string, corpo: string, stampa: { onclick: string; titolo: string }): string {
  return `<section class="lv-page lv-dati">
    ${testataHtml({ titolo, sottotitolo, pastiglie: [{ testo: 'progetto', tono: 'fase' }], stampa })}
    <div class="lv-body lv-dati__corpo">${corpo}</div>
  </section>`
}

/* ── Il quadro economico ──────────────────────────────────────────────── */

export function paginaQE(r: Revisione): string {
  const qe = normalizzaQE(r.qe)
  const imp = importiRevisione(r)
  const t = calcolaQE(qe, imp.totale, imp.sicurezza)
  const id = r.id
  const righe = t.righeB.map((x, i) => `<tr>
      <td><input value="${esc(x.codice)}" onchange="lvQE(${q(id)},${i},'codice',this.value)" style="width:56px"></td>
      <td><input value="${esc(x.descrizione)}" onchange="lvQE(${q(id)},${i},'descrizione',this.value)"></td>
      <td><select onchange="lvQE(${q(id)},${i},'tipo',this.value)"><option value="importo"${x.tipo === 'importo' ? ' selected' : ''}>importo €</option><option value="percentuale"${x.tipo === 'percentuale' ? ' selected' : ''}>% di</option></select></td>
      <td><input value="${num(x.valore)}" inputmode="decimal" onchange="lvQE(${q(id)},${i},'valore',this.value)" style="width:90px"></td>
      <td>${x.tipo === 'percentuale' ? `<input value="${esc(x.base || 'A')}" onchange="lvQE(${q(id)},${i},'base',this.value)" style="width:70px" title="A, A1, A2 o il codice di una riga B prima (anche B2+B3)">` : ''}</td>
      <td class="lv-ct-n">${eur(x.importo)}</td>
      <td><button class="ehb-icon-btn" title="Togli la riga" onclick="lvQETogli(${q(id)},${i})">✕</button></td>
    </tr>`).join('')
  return pagina(`Quadro economico — ${sigla(r.numero)}`, `totale dell'intervento ${eur(t.totale)}`, `
    <section class="lv-ct">
      <h2>A) Lavori</h2>
      <table class="lv-cfr lv-ct-quadro"><tbody>
        <tr><th>A1 Lavori (dal computo, senza la sicurezza)</th><td>${eur(t.a1)}</td></tr>
        <tr><th>A2 Oneri della sicurezza non soggetti a ribasso</th><td>${eur(t.a2)}</td></tr>
        <tr class="is-ok"><th>A) Totale lavori</th><td>${eur(t.a)}</td></tr>
      </tbody></table>
      <label class="lv-f" style="max-width:340px"><span>Sicurezza da PSC non computata a voci €</span><input value="${num(qe.sicurezzaExtra)}" inputmode="decimal" onchange="lvQESic(${q(id)},this.value)"></label>
    </section>
    <section class="lv-ct">
      <h2>B) Somme a disposizione della stazione appaltante</h2>
      <table class="lv-ct-tab"><thead><tr><th>Codice</th><th>Descrizione</th><th>Tipo</th><th>Valore</th><th>Base</th><th>Importo</th><th></th></tr></thead><tbody>${righe}</tbody></table>
      <button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="lvQENuova(${q(id)})">＋ Riga</button>
      <table class="lv-cfr lv-ct-quadro"><tbody>
        <tr><th>B) Totale somme a disposizione</th><td>${eur(t.b)}</td></tr>
        <tr class="is-ok"><th>Totale dell'intervento (A + B)</th><td>${eur(t.totale)}</td></tr>
      </tbody></table>
      <p class="lv-nota">Le percentuali si calcolano su A, A1, A2 o su righe B che vengono prima (es. «B2+B3» per l'IVA sulle spese tecniche con la cassa).</p>
    </section>`, { onclick: `lvStampaRev(${q(id)},'quadro-economico')`, titolo: 'Il quadro economico, da stampare' })
}

/* ── Le offerte di gara ───────────────────────────────────────────────── */

export function paginaOfferte(l: Lavoro, r: Revisione, voci: VoceComputo[]): string {
  const offerte = r.offerte || []
  const esiti = valutaOfferte(offerte, voci)
  const id = r.id
  const puoContratto = r.tipo === 'computo' && r.stato === 'chiusa' && !contratto(l)
  const scheda = (i: number): string => {
    const o = offerte[i], e = esiti[i]
    const conPrezzi = Object.keys(o.prezzi || {}).length
    return `<div class="lv-atto">
      <div class="lv-atto__t"><b>${esc(o.nome || `Offerta ${i + 1}`)}</b>
        ${e.posizione ? `<span class="lv-chip${e.posizione === 1 ? ' is-var' : ''}">${e.posizione === 1 ? 'migliore' : `${e.posizione}ª`}</span>` : ''}
        ${e.mancanti.length ? `<span class="lv-chip is-oltre" title="${esc(e.mancanti.join(', '))}">${e.mancanti.length} prezz${e.mancanti.length === 1 ? 'o' : 'i'} mancant${e.mancanti.length === 1 ? 'e' : 'i'}</span>` : ''}
        <span class="lv-atto__az">${puoContratto && !e.mancanti.length ? `<button class="ehb-btn ehb-btn--sm ehb-btn--accent-soft" onclick="lvOffContratto(${q(id)},${i})" title="Il contratto nasce da questa offerta: con il suo ribasso o i suoi prezzi">→ Contratto</button>` : ''}<button class="ehb-icon-btn" title="Togli l'offerta" onclick="lvOffTogli(${q(id)},${i})">✕</button></span></div>
      <div class="lv-righe">
        <label class="lv-f"><span>Offerente</span><input value="${esc(o.nome)}" onchange="lvOff(${q(id)},${i},'nome',this.value)"></label>
        <label class="lv-f"><span>Data</span><input value="${esc(o.data || '')}" placeholder="gg/mm/aaaa" class="lv-ct-data" onchange="lvOff(${q(id)},${i},'data',this.value)"></label>
        <label class="lv-f"><span>Ribasso unico %</span><input value="${num(o.ribassoPct)}" inputmode="decimal" style="width:110px" onchange="lvOff(${q(id)},${i},'ribassoPct',this.value)"></label>
      </div>
      <label class="lv-f"><span>Prezzi unitari offerti (incolla una colonna da Excel, una riga per voce nell'ordine del computo)${conPrezzi ? ` — ${conPrezzi} prezzi` : ''}</span><textarea rows="2" placeholder="12,50&#10;85,00&#10;…" onchange="lvOffPrezzi(${q(id)},${i},this.value)"></textarea></label>
      <p class="lv-nota">Importo offerto ${eur(e.importo)} su ${eur(e.base)}${e.ribasso != null ? ` · ribasso ${fmt(e.ribasso, 4)}%` : ''}${o.note ? ` · ${esc(o.note)}` : ''}</p>
    </div>`
  }
  return pagina(`Offerte — ${sigla(r.numero)}`, `${offerte.length} offert${offerte.length === 1 ? 'a' : 'e'}`, `
    <section class="lv-ct">
      <p class="lv-nota">Le offerte ricevute su questo computo: a ribasso unico, o a prezzi unitari (incollati da Excel). La graduatoria è al minor prezzo, tra le offerte complete; la sicurezza non si offre.${puoContratto ? ' Dall\'offerta scelta nasce il contratto, con «→ Contratto».' : r.tipo === 'computo' && r.stato !== 'chiusa' ? ' Per farne il contratto, prima si consegna il computo.' : ''}</p>
      <button class="ehb-btn ehb-btn--sm" onclick="lvOffNuova(${q(id)})">＋ Offerta</button>
      ${offerte.map((_, i) => scheda(i)).join('') || '<p class="lv-nota">Nessuna offerta.</p>'}
    </section>`, { onclick: `lvStampaRev(${q(id)},'quadro-offerte')`, titolo: 'Il quadro comparativo delle offerte' })
}

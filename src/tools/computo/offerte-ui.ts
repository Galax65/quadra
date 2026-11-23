/**
 * Computo — finestra OFFERTE: richiesta di offerta, offerte ricevute (prezzi per voce o
 * ribasso unico), quadro comparativo, aggiudicazione (offerta a prezzi unitari).
 * La logica sta in src/shared/offerte.ts; qui solo la finestra.
 */
import { openModal } from '../../shared/ui/components/modal'
import { valutaOfferte, prezzoOfferto, leggiColonnaPrezzi, type Offerta } from '../../shared/offerte'
import { listaLavorazioniPdf, quadroComparativoOffertePdf } from '../../shared/stampa/progetto-pdf'
import type { VoceComputo } from '../../shared/xpwe/xpwe'
import type { DatiGenerali } from '../../shared/dati-generali'

interface StatoMiu { offerte?: Offerta[]; aggiudicata?: string | null; datiGenerali?: Partial<DatiGenerali> }
interface Win {
  miuStato?: () => StatoMiu
  miuVociComputo?: () => VoceComputo[]
  miuScaricaPdf?: (b: Uint8Array, n: string) => void
  miuPubblica?: () => void
  PDFLib?: unknown
  toast?: (m: string, t?: string) => void
}
const W = window as unknown as Win
const esc = (t: unknown): string => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const euro = (n: number): string => '€ ' + n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const num = (s: string): number | null => { const t = String(s).trim().replace(/\./g, '').replace(',', '.'); if (!t) return null; const n = Number(t); return Number.isFinite(n) ? n : null }

/** Prezzi voce per voce di un'offerta: tabella da compilare o colonna incollata da Excel. */
async function modificaPrezzi(o: Offerta, voci: VoceComputo[]): Promise<void> {
  const soggette = voci.filter((v) => !v.sicurezza)
  const corpo = document.createElement('div')
  corpo.style.display = 'grid'; corpo.style.gap = 'var(--sp-2)'
  corpo.innerHTML = `<p class="ehb-muted" style="margin:0">Prezzi unitari offerti da <b>${esc(o.nome)}</b>. Le caselle vuote usano il ribasso unico${o.ribassoPct != null ? ` (${String(o.ribassoPct).replace('.', ',')} %)` : ' (non indicato: voce mancante)'}.</p>` +
    `<details><summary style="cursor:pointer">Incolla una colonna da Excel</summary><textarea class="ehb-input" name="incolla" rows="4" placeholder="un prezzo per riga, nell'ordine delle voci"></textarea>` +
    `<button class="ehb-btn ehb-btn--sm" type="button" data-incolla>Applica la colonna</button></details>` +
    `<div style="max-height:52vh;overflow:auto"><table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr>` +
    `<th style="text-align:left">Tariffa</th><th style="text-align:left">Designazione</th><th>U.M.</th><th style="text-align:right">Q.tà</th><th style="text-align:right">Progetto</th><th style="text-align:right">Offerto</th></tr></thead><tbody>` +
    soggette.map((v, i) => `<tr style="border-top:1px solid var(--border)"><td>${esc(v.codice)}</td><td>${esc((v.desc_short || v.declaratoria || '').slice(0, 90))}</td><td style="text-align:center">${esc(v.um)}</td>` +
      `<td style="text-align:right">${(v.qty ?? 0).toLocaleString('it-IT')}</td><td style="text-align:right">${(v.prezzo ?? 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</td>` +
      `<td style="text-align:right"><input class="ehb-input" data-i="${i}" style="width:90px;text-align:right" inputmode="decimal" value="${o.prezzi?.[v.codice] != null ? String(o.prezzi[v.codice]).replace('.', ',') : ''}"></td></tr>`).join('') +
    `</tbody></table></div>`
  corpo.addEventListener('keydown', (e) => e.stopPropagation())
  corpo.querySelector('[data-incolla]')!.addEventListener('click', () => {
    const col = leggiColonnaPrezzi((corpo.querySelector('textarea') as HTMLTextAreaElement).value)
    corpo.querySelectorAll<HTMLInputElement>('input[data-i]').forEach((inp, i) => { if (col[i] != null) inp.value = String(col[i]).replace('.', ',') })
  })
  const aperta = openModal({ title: `Prezzi offerti — ${o.nome}`, body: corpo, actions: [{ label: 'Annulla', variant: 'ghost', value: false }, { label: 'Salva i prezzi', variant: 'accent', value: true }] })
  const m = corpo.closest('.ehb-modal') as HTMLElement | null
  if (m) { m.style.width = 'min(980px, 96vw)'; m.style.maxWidth = '96vw' }
  const esito = await aperta
  if (esito !== true) return
  const prezzi: Record<string, number> = {}
  corpo.querySelectorAll<HTMLInputElement>('input[data-i]').forEach((inp) => {
    const v = soggette[Number(inp.dataset.i)]; const n = num(inp.value)
    if (v && n != null) prezzi[v.codice] = n
  })
  o.prezzi = prezzi
}

async function pdfLib(): Promise<unknown> {
  const w = window as unknown as { loadPdfLib?: () => Promise<void> }
  if (!W.PDFLib && w.loadPdfLib) await w.loadPdfLib()
  return W.PDFLib
}

export async function apriOfferte(loadPdf: () => Promise<void>): Promise<void> {
  const S = W.miuStato?.(); const voci = W.miuVociComputo?.() ?? []
  if (!S) return
  if (!voci.length) { W.toast?.('Il computo è vuoto', 'warn'); return }
  S.offerte = S.offerte ?? []
  const corpo = document.createElement('div')
  corpo.style.display = 'grid'; corpo.style.gap = 'var(--sp-3)'
  corpo.addEventListener('keydown', (e) => e.stopPropagation())
  const disegna = (): void => {
    const esiti = valutaOfferte(S.offerte!, voci)
    corpo.innerHTML =
      `<section style="display:grid;gap:var(--sp-2)"><b>1 · Richiesta di offerta</b>` +
      `<div style="display:flex;gap:var(--sp-2);flex-wrap:wrap;align-items:end">` +
      `<label class="ehb-field" style="flex:1;min-width:200px"><span class="ehb-label">Destinatario (impresa o fornitore)</span><input class="ehb-input" name="dest"></label>` +
      `<label class="ehb-field" style="width:150px"><span class="ehb-label">Entro il</span><input class="ehb-input" name="scad" placeholder="gg/mm/aaaa"></label>` +
      `<button class="ehb-btn" type="button" data-az="richiesta">Richiesta di offerta (PDF)</button></div></section>` +
      `<section style="display:grid;gap:var(--sp-2)"><b>2 · Offerte ricevute</b>` +
      (esiti.length ? `<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr><th style="text-align:left">Offerente</th><th>Prezzi</th><th style="text-align:right">Importo</th><th style="text-align:right">Ribasso</th><th>Grad.</th><th></th></tr></thead><tbody>` +
        esiti.map((e) => {
          const o = e.offerta; const agg = S.aggiudicata === o.id
          const nPrezzi = Object.keys(o.prezzi ?? {}).length
          return `<tr style="border-top:1px solid var(--border)${agg ? ';background:var(--accent-soft, transparent)' : ''}"><td><b>${esc(o.nome)}</b>${agg ? ' <span class="cm-np-tag">aggiudicataria</span>' : ''}</td>` +
            `<td style="text-align:center">${nPrezzi ? `${nPrezzi} per voce` : ''}${o.ribassoPct != null ? `${nPrezzi ? ' + ' : ''}ribasso ${String(o.ribassoPct).replace('.', ',')} %` : ''}</td>` +
            `<td style="text-align:right">${e.mancanti.length ? `<span title="Voci senza prezzo: ${esc(e.mancanti.join(', '))}">incompleta (${e.mancanti.length})</span>` : euro(e.importo)}</td>` +
            `<td style="text-align:right">${e.ribasso == null ? '' : e.ribasso.toLocaleString('it-IT', { maximumFractionDigits: 4 }) + ' %'}</td><td style="text-align:center">${e.posizione ? e.posizione + '°' : '—'}</td>` +
            `<td style="white-space:nowrap"><button class="ehb-btn ehb-btn--sm ehb-btn--ghost" type="button" data-az="prezzi" data-id="${o.id}">Prezzi…</button>` +
            `<button class="ehb-btn ehb-btn--sm ehb-btn--ghost" type="button" data-az="aggiudica" data-id="${o.id}" ${e.mancanti.length ? 'disabled title="Offerta incompleta"' : ''}>${agg ? 'Togli aggiudicazione' : 'Aggiudica'}</button>` +
            `<button class="ehb-icon-btn" type="button" data-az="togli" data-id="${o.id}" title="Elimina l'offerta">✕</button></td></tr>`
        }).join('') + `</tbody></table>` : `<p class="ehb-muted" style="margin:0">Nessuna offerta inserita.</p>`) +
      `<div style="display:flex;gap:var(--sp-2);flex-wrap:wrap;align-items:end">` +
      `<label class="ehb-field" style="flex:1;min-width:200px"><span class="ehb-label">Nuovo offerente</span><input class="ehb-input" name="nome"></label>` +
      `<label class="ehb-field" style="width:170px"><span class="ehb-label">Ribasso unico %</span><input class="ehb-input" name="rib" inputmode="decimal"></label>` +
      `<button class="ehb-btn" type="button" data-az="aggiungi">＋ Aggiungi</button></div></section>` +
      `<section style="display:grid;gap:var(--sp-2)"><b>3 · Confronto e aggiudicazione</b>` +
      `<div style="display:flex;gap:var(--sp-2);flex-wrap:wrap"><button class="ehb-btn" type="button" data-az="quadro" ${esiti.length ? '' : 'disabled'}>Quadro comparativo (PDF)</button></div>` +
      `<p class="ehb-muted" style="margin:0">Con un'offerta <b>aggiudicata</b>, i suoi prezzi unitari passano alla Contabilità come prezzi di contratto (offerta a prezzi unitari): il ribasso risulta dai prezzi, non si applica di nuovo. Gli oneri della sicurezza restano al prezzo di progetto.</p></section>`
  }
  corpo.addEventListener('click', async (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLButtonElement>('button[data-az]'); if (!b) return
    const az = b.dataset.az, id = b.dataset.id
    const o = S.offerte!.find((x) => x.id === id)
    try {
      if (az === 'aggiungi') {
        const nome = (corpo.querySelector('input[name="nome"]') as HTMLInputElement).value.trim()
        if (!nome) { W.toast?.('Scrivi il nome dell\'offerente', 'warn'); return }
        const rib = num((corpo.querySelector('input[name="rib"]') as HTMLInputElement).value)
        const nuova: Offerta = { id: 'off' + Date.now().toString(36), nome, ribassoPct: rib, prezzi: {} }
        S.offerte!.push(nuova)
        if (rib == null) await modificaPrezzi(nuova, voci)
      } else if (az === 'prezzi' && o) await modificaPrezzi(o, voci)
      else if (az === 'togli' && o) { S.offerte = S.offerte!.filter((x) => x !== o); if (S.aggiudicata === o.id) S.aggiudicata = null }
      else if (az === 'aggiudica' && o) S.aggiudicata = S.aggiudicata === o.id ? null : o.id
      else if (az === 'richiesta') {
        await loadPdf()
        const dest = (corpo.querySelector('input[name="dest"]') as HTMLInputElement).value.trim()
        const scad = (corpo.querySelector('input[name="scad"]') as HTMLInputElement).value.trim()
        const r = await listaLavorazioniPdf(await pdfLib(), voci, S.datiGenerali ?? {}, { titolo: 'RICHIESTA DI OFFERTA', destinatario: dest || undefined, scadenza: scad || undefined })
        W.miuScaricaPdf?.(r.bytes, 'Richiesta-offerta' + (dest ? '-' + dest.replace(/[^\w]+/g, '-') : ''))
        return
      } else if (az === 'quadro') {
        await loadPdf()
        const r = await quadroComparativoOffertePdf(await pdfLib(), voci, S.offerte!, S.datiGenerali ?? {})
        W.miuScaricaPdf?.(r.bytes, 'Quadro-comparativo-offerte')
        if (S.offerte!.length > 5) W.toast?.('Nel quadro entrano le prime 5 offerte', 'warn')
        return
      }
      W.miuPubblica?.()
      disegna()
    } catch (e) { W.toast?.('Errore: ' + ((e as Error)?.message || e), 'warn') }
  })
  disegna()
  const aperta = openModal({ title: 'Offerte', body: corpo, actions: [{ label: 'Chiudi', variant: 'accent', value: true }] })
  // finestra larga: la tabella delle offerte ha sei colonne
  const m = corpo.closest('.ehb-modal') as HTMLElement | null
  if (m) { m.style.width = 'min(980px, 96vw)'; m.style.maxWidth = '96vw' }
  await aperta
  W.miuPubblica?.()
}

export { prezzoOfferto }

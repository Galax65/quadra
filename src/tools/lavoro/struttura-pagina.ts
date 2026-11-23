/**
 * LA STRUTTURA DI UNA REVISIONE — categorie (Supercategoria › Categoria ›
 * Subcategoria) e WBS, con voci e importi, e i modelli di struttura da
 * riusare fra progetti. Le funzioni sono quelle condivise
 * (struttura-computo.ts); qui la pagina. Modulo PURO.
 */
import { testataHtml } from '../../shared/griglia'
import { alberoCategorie, alberoWbs, appiattisci, type ModelloStruttura } from '../../shared/struttura-computo'
import { strutturaDi, quantitaVoce, prezzoIn, sigla, type Revisione } from '../../shared/lavoro'
import { importoQta } from '../../shared/importo'
import { eur } from './schermata'

const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
/** Un percorso di categoria in un attributo onclick: JSON tra apici singoli, con gli apici protetti. */
const pj = (p: string[]): string => `'${JSON.stringify(p).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
const q = (s: string): string => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

export function paginaStruttura(r: Revisione, modelli: ModelloStruttura[]): string {
  const scrive = r.stato === 'aperta'
  const st = strutturaDi(r)
  const art = new Map(r.articoli.map((a) => [a.id, a]))
  const importi: Record<string, number> = {}
  for (const v of r.voci) { const a = art.get(v.articolo); if (a) importi[v.id] = importoQta(quantitaVoce(v), prezzoIn(r, a), a.um) }
  const categoria = Object.fromEntries(r.voci.map((v) => [v.id, v.categoria]))
  const wbs = Object.fromEntries(r.voci.map((v) => [v.id, v.wbs]))
  const nodi = appiattisci(alberoCategorie(categoria, r.voci.map((v) => v.id), importi, st.dichiarate, st.ordineLivelli))
  const LIV = ['Supercategoria', 'Categoria', 'Subcategoria']
  const righeCat = nodi.map((n) => `<tr class="lv-str-l${n.livello}">
      <td style="padding-left:${8 + n.livello * 22}px">${scrive ? `<input value="${esc(n.nome)}" onchange="lvStrRinomina(${pj(n.percorso)},this.value)" title="${LIV[n.livello] || ''}: il nuovo nome vale per tutte le sue voci">` : esc(n.nome)}</td>
      <td class="lv-ct-n">${n.voci || '—'}</td><td class="lv-ct-n">${n.importo ? eur(n.importo) : '—'}</td>
      <td class="lv-str-az">${scrive ? `
        <button class="ehb-icon-btn" title="Su" onclick="lvStrSposta(${pj(n.percorso)},-1)">↑</button>
        <button class="ehb-icon-btn" title="Giù" onclick="lvStrSposta(${pj(n.percorso)},1)">↓</button>
        ${n.livello < 2 ? `<button class="ehb-icon-btn" title="Un ramo dentro" onclick="lvStrNuova(${pj(n.percorso)})">＋</button>` : ''}
        <button class="ehb-icon-btn" title="Togli il ramo: le sue voci restano senza questa categoria" onclick="lvStrElimina(${pj(n.percorso)})">✕</button>` : ''}</td>
    </tr>`).join('')
  const w = alberoWbs(wbs, st.wbsNodi, importi)
  const righeWbs = w.map((n) => `<tr>
      <td style="padding-left:${8 + n.livello * 18}px">${scrive ? `<input value="${esc(n.codice)}" style="width:110px" onchange="lvWbsCodice(${q(n.codice)},this.value)" title="Cambiare il codice porta con sé i figli e le voci">` : esc(n.codice)}</td>
      <td>${scrive ? `<input value="${esc(n.descrizione)}" placeholder="${n.implicito ? 'nodo senza descrizione' : ''}" onchange="lvWbsDescr(${q(n.codice)},this.value)">` : esc(n.descrizione)}</td>
      <td class="lv-ct-n">${n.voci || '—'}</td><td class="lv-ct-n">${n.importo ? eur(n.importo) : '—'}</td>
      <td class="lv-str-az">${scrive ? `<button class="ehb-icon-btn" title="Un nodo figlio" onclick="lvWbsNuovo(${q(n.codice)})">＋</button><button class="ehb-icon-btn" title="Togli il nodo e i figli: le voci restano senza WBS" onclick="lvWbsElimina(${q(n.codice)})">✕</button>` : ''}</td>
    </tr>`).join('')
  return `<section class="lv-page lv-dati">
    ${testataHtml({ titolo: `Struttura — ${sigla(r.numero)}`, sottotitolo: `${nodi.length} rami · ${w.length} nodi WBS${scrive ? '' : ' · in sola lettura'}`, pastiglie: [{ testo: 'struttura', tono: 'fase' }] })}
    <div class="lv-body lv-dati__corpo">
      <section class="lv-ct">
        <h2>Categorie</h2>
        <p class="lv-nota">Supercategoria › Categoria › Subcategoria, con voci e importi. Rinominare, spostare o togliere un ramo vale per tutte le sue voci; la categoria della singola voce si sceglie con ✎ sulla voce.</p>
        ${righeCat ? `<table class="lv-ct-tab lv-str"><thead><tr><th>Ramo</th><th>Voci</th><th>Importo</th><th></th></tr></thead><tbody>${righeCat}</tbody></table>` : '<p class="lv-nota">Nessuna categoria.</p>'}
        ${scrive ? `<button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="lvStrNuova('[]')">＋ Supercategoria</button>` : ''}
      </section>
      <section class="lv-ct">
        <h2>WBS</h2>
        <p class="lv-nota">I codici a punti (01, 01.02…) e la descrizione di ogni nodo: le stampe raggruppate per WBS li usano.</p>
        ${righeWbs ? `<table class="lv-ct-tab lv-str"><thead><tr><th>Codice</th><th>Descrizione</th><th>Voci</th><th>Importo</th><th></th></tr></thead><tbody>${righeWbs}</tbody></table>` : '<p class="lv-nota">Nessun nodo WBS.</p>'}
        ${scrive ? `<button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="lvWbsNuovo('')">＋ Nodo</button>` : ''}
      </section>
      <section class="lv-ct">
        <h2>Modelli di struttura</h2>
        <p class="lv-nota">Una struttura da riusare in un altro lavoro: si salva da qui e si applica a una revisione aperta (aggiunge i rami e i nodi che mancano). I modelli si gestiscono anche in Amministrazione.</p>
        ${modelli.length ? `<table class="lv-ct-tab"><tbody>${modelli.map((m) => `<tr><td><b>${esc(m.nome)}</b><div class="lv-nota">${m.categorie.length} rami · ${Object.keys(m.wbs).length} nodi WBS</div></td><td class="lv-str-az">${scrive ? `<button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="lvModApplica(${q(m.id)})">Applica</button>` : ''}</td></tr>`).join('')}</tbody></table>` : '<p class="lv-nota">Nessun modello salvato.</p>'}
        <button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="lvModSalva()">⭳ Salva questa struttura come modello…</button>
      </section>
    </div>
  </section>`
}

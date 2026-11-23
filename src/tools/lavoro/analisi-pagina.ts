/**
 * LA PAGINA DI UN'ANALISI PREZZI — si apre dalla sezione ANALISI PREZZI della
 * sidebar. Testata, dati dell'analisi, righe (manodopera, materiali, noli,
 * varie: a mano o dal prezzario a destra), quadro dei totali fino al prezzo
 * unitario, e dove il prezzo è applicato. Modulo PURO.
 */
import { testataHtml } from '../../shared/griglia'
import { calcolaAnalisi, incidenzaManodopera, type AnalisiPrezzi, type AnalisiRigaTipo } from '../../shared/compositore/analisi-prezzi'
import { usiAnalisi, sigla, type Lavoro, type Revisione } from '../../shared/lavoro'
import { eur, fmt } from './schermata'

const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
const q = (s: string): string => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
const num = (n: number | null | undefined): string => (n == null ? '' : String(n).replace('.', ','))

export const TIPI_RIGA: [AnalisiRigaTipo, string][] = [['manodopera', 'Manodopera'], ['materiale', 'Materiali'], ['nolo', 'Noli e trasporti'], ['varie', 'Varie']]
const ARROTONDAMENTI: [string, string][] = [['0.01', 'al centesimo'], ['0.05', 'a 5 centesimi'], ['0.1', 'a 10 centesimi'], ['1', "all'euro"]]

export function paginaAnalisi(l: Lavoro, a: AnalisiPrezzi, aperta: Revisione | null): string {
  const t = calcolaAnalisi(a)
  const id = a.id
  const campo = (k: string, etichetta: string, v: string, extra = ''): string =>
    `<label class="lv-f"><span>${esc(etichetta)}</span><input value="${esc(v)}" onchange="lvAp(${q(id)},'${k}',this.value)" ${extra}></label>`
  const cella = (i: number, k: string, v: string, extra = ''): string => `<input value="${esc(v)}" onchange="lvApRiga(${q(id)},${i},'${k}',this.value)" ${extra}>`
  const righe = a.righe.map((r, i) => `<tr>
      <td><select onchange="lvApRiga(${q(id)},${i},'tipo',this.value)">${TIPI_RIGA.map(([v, e]) => `<option value="${v}"${r.tipo === v ? ' selected' : ''}>${esc(e)}</option>`).join('')}</select></td>
      <td>${cella(i, 'descrizione', r.descrizione)}${r.fonte ? `<div class="lv-nota" title="Prezzo elementare dal prezzario">${esc(r.fonte.codice)} · ${esc(r.fonte.regione)} ${esc(r.fonte.anno)}</div>` : ''}</td>
      <td>${cella(i, 'um', r.um, 'style="width:60px"')}</td>
      <td>${cella(i, 'quantita', num(r.quantita), 'inputmode="decimal" style="width:80px"')}</td>
      <td>${cella(i, 'prezzoUnitario', num(r.prezzoUnitario), 'inputmode="decimal" style="width:90px"')}</td>
      <td class="lv-ct-n">${eur((r.quantita || 0) * (r.prezzoUnitario || 0))}</td>
      <td><button class="ehb-icon-btn" title="Togli la riga" onclick="lvApRigaTogli(${q(id)},${i})">✕</button></td>
    </tr>`).join('')
  const usi = usiAnalisi(l, id)
  const quadro = `<table class="lv-cfr lv-ct-quadro"><tbody>
      <tr><th>Manodopera</th><td>${eur(t.totManodopera)}</td></tr>
      <tr><th>Materiali</th><td>${eur(t.totMateriali)}</td></tr>
      <tr><th>Noli e trasporti</th><td>${eur(t.totNoli)}</td></tr>
      ${t.totVarie ? `<tr><th>Varie</th><td>${eur(t.totVarie)}</td></tr>` : ''}
      <tr><th>Costo diretto</th><td>${eur(t.costoDiretto)}</td></tr>
      <tr><th>Spese generali ${fmt(a.speseGeneraliPct, 1)}%</th><td>${eur(t.speseGenerali)}</td></tr>
      <tr><th>Utile d'impresa ${fmt(a.utileImpresaPct, 1)}%</th><td>${eur(t.utileImpresa)}</td></tr>
      <tr><th>Totale dell'analisi${t.quantitaRiferimento !== 1 ? ` (per ${fmt(t.quantitaRiferimento)} ${esc(a.um)})` : ''}</th><td>${eur(t.totaleAnalisi)}</td></tr>
      <tr class="is-ok"><th>Prezzo unitario${a.um ? ` al ${esc(a.um)}` : ''}</th><td>${eur(t.prezzoUnitario)}</td></tr>
      <tr><th>Incidenza della manodopera</th><td>${fmt(incidenzaManodopera(t))}%</td></tr>
    </tbody></table>`
  const doveUsata = usi.length
    ? `<ul class="lv-nota">${usi.map((u) => `<li>${esc(sigla(u.numero))}: ${u.prezzo != null ? eur(u.prezzo) : '—'}${u.aggiornato ? ' ✓' : ` — <b>diverso dall'analisi</b>${u.aperta ? ' (si riapplica qui sotto)' : ' (revisione chiusa: resta com\'è)'}`}</li>`).join('')}</ul>`
    : '<p class="lv-nota">Non ancora applicata a una revisione.</p>'
  return `<section class="lv-page lv-dati" oncontextmenu="lvMenuAnalisi(event,${q(id)})">
    ${testataHtml({ titolo: `${a.codice} — ${a.descrizioneBreve}`, sottotitolo: `analisi prezzi · ${eur(t.prezzoUnitario)}${a.um ? ` al ${a.um}` : ''}`, pastiglie: [{ testo: 'analisi', tono: 'fase' }], stampa: { onclick: `lvApStampa(${q(id)})`, titolo: "La stampa dell'analisi" } })}
    <div class="lv-body lv-dati__corpo">
      <section class="lv-ct">
        <div class="lv-righe">
          ${campo('codice', 'Codice', a.codice, 'style="width:110px"')}
          ${campo('descrizioneBreve', 'Descrizione', a.descrizioneBreve)}
          ${campo('um', 'U.M.', a.um, 'style="width:70px"')}
        </div>
        <label class="lv-f"><span>Descrizione estesa</span><textarea rows="3" onchange="lvAp(${q(id)},'descrizioneEstesa',this.value)">${esc(a.descrizioneEstesa || '')}</textarea></label>
        <div class="lv-righe">
          ${campo('quantitaRiferimento', 'Analisi riferita a (quantità)', num(a.quantitaRiferimento ?? 1), 'inputmode="decimal" style="width:120px"')}
          <label class="lv-f"><span>Arrotondamento</span><select onchange="lvAp(${q(id)},'arrotondamento',this.value)">${ARROTONDAMENTI.map(([v, e]) => `<option value="${v}"${String(a.arrotondamento || 0.01) === v ? ' selected' : ''}>${esc(e)}</option>`).join('')}</select></label>
          ${campo('speseGeneraliPct', 'Spese generali %', num(a.speseGeneraliPct), 'inputmode="decimal" style="width:100px"')}
          ${campo('utileImpresaPct', "Utile d'impresa %", num(a.utileImpresaPct), 'inputmode="decimal" style="width:100px"')}
        </div>
      </section>
      <section class="lv-ct">
        <h2>Le righe</h2>
        ${a.righe.length ? `<table class="lv-ct-tab"><thead><tr><th>Tipo</th><th>Descrizione</th><th>U.M.</th><th>Quantità</th><th>€ unit.</th><th>Importo</th><th></th></tr></thead><tbody>${righe}</tbody></table>` : '<p class="lv-nota">Nessuna riga: aggiungile qui, o pescale dal prezzario a destra con «＋».</p>'}
        <div class="lv-righe">
          ${TIPI_RIGA.map(([v, e]) => `<button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="lvApRigaNuova(${q(id)},'${v}')">＋ ${esc(e)}</button>`).join('')}
          <button class="ehb-btn ehb-btn--sm" onclick="lvPzApri('prezzario')" title="Il prezzario a destra: «＋» aggiunge la voce come riga dell'analisi">≡ Dal prezzario</button>
          ${a.righe.some((r) => r.fonte) ? `<button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="lvApAggiorna(${q(id)})" title="Riprende i prezzi elementari dal prezzario scelto a destra (stesso codice)">⟳ Prezzi dal prezzario</button>` : ''}
        </div>
      </section>
      <section class="lv-ct">
        <h2>Il prezzo</h2>
        ${quadro}
        <h3>Dove è applicata</h3>
        ${doveUsata}
        <div class="lv-righe">
          ${aperta ? `<button class="ehb-btn ehb-btn--sm ehb-btn--accent-soft" onclick="lvApApplica(${q(id)})" title="Un articolo «da analisi» nell'elenco prezzi della revisione aperta, a questo prezzo">→ Nell'elenco prezzi di ${esc(sigla(aperta.numero))}</button>` : '<span class="lv-nota">Per applicarla serve una revisione aperta (un computo in lavorazione o una perizia in bozza).</span>'}
          <button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="lvApDuplica(${q(id)})">⧉ Duplica</button>
          <button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="lvLibSalvaAnalisi(${q(id)})" title="Da riusare in altri lavori">★ Nella libreria</button>
          <button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="lvApTogli(${q(id)})">✕ Elimina</button>
        </div>
      </section>
    </div>
  </section>`
}

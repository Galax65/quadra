// Computo — REVISIONI DEL COMPUTO (versioni del progetto).
// Un lavoro ha una successione di computi — PFTE, definitivo, esecutivo, contratto —
// e quello che serve davvero, quando si discute con l'ente o con l'impresa, è il
// CONFRONTO fra due di essi. Qui il computo di adesso si congela in una revisione
// (nome, fase, data: una fotografia con i prezzi di allora) e la si confronta.
// Il modello puro sta in engine/revisioni.ts, esposto su window.miuRevisioni.
import { S } from './stato.js';
import { publishComputo } from './computo-overlay.js';

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const eur = (n) => '€ ' + (n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' });
const qt = (n) => (n || 0).toLocaleString('it-IT', { maximumFractionDigits: 3, useGrouping: 'always' });
const plur = (n, s1, s2) => `${n} ${n === 1 ? s1 : s2}`;
const toast = (m, t) => (window.toast ? window.toast(m, t) : undefined);
const api = () => window.miuRevisioni || null;
const oggiIt = () => new Date().toLocaleDateString('it-IT');
const revisioni = () => (S.revisioni = Array.isArray(S.revisioni) ? S.revisioni : []);
const vociOra = () => (typeof window.miuVociComputo === 'function' ? window.miuVociComputo() : []);
const revById = (id) => revisioni().find((r) => r.id === id);
const pubblica = () => { try { publishComputo(); } catch (e) { /* computo non pronto */ } };

export function chiudiRevisioni() { const ov = document.getElementById('revisioni-overlay'); if (ov) ov.remove(); }

// ── Elenco delle revisioni ──────────────────────────────────────────────────
// Due nature (engine/revisioni.ts): la revisione DI COMPUTO fotografa voci, misure
// ed elenco prezzi; quella DI PROGETTO registra che il progetto è cambiato senza
// che cambi il computo, e dice su quale revisione di computo poggia.
const naturaDi = (r) => (api() && api().natura ? api().natura(r) : (r.natura || 'computo'));
const ordinate = () => revisioni().slice().sort((x, y) => (x.ts || 0) - (y.ts || 0));
/** «rev.03»: il numero è la posizione nel tempo, e non cambia rinominando. */
const siglaDi = (r) => `rev.${String(ordinate().indexOf(r)).padStart(2, '0')}`;
/** La revisione di computo da confrontare: lei stessa, o quella su cui poggia il progetto. */
const daConfrontare = (r) => (naturaDi(r) === 'progetto' ? revById(r.computoDi) : r);

export function apriRevisioni() {
  const a = api();
  if (!a) { toast('Modulo revisioni non pronto, riprova tra un attimo', 'warn'); return; }
  chiudiRevisioni();
  const voci = vociOra();
  const totOra = voci.reduce((s, v) => s + a.importoVoce(v), 0);
  const righe = ordinate().reverse().map((r) => {
    const progetto = naturaDi(r) === 'progetto';
    const base = daConfrontare(r);
    const c = base ? a.confronta(base, voci) : null;
    const nArt = progetto ? 0 : a.elenco(r).length;
    const cosa = progetto
      ? `revisione di progetto · computo ${base ? 'come ' + esc(siglaDi(base)) : 'non congelato'}`
      : `${esc(String(r.voci.length))} voci · elenco di ${nArt} prezzi`;
    return `<tr>
      <td style="white-space:nowrap;font-family:var(--mono);font-size:11px;color:var(--text3)">${esc(siglaDi(r))}</td>
      <td><b>${esc(r.nome)}</b><br><span style="font-size:11px;color:var(--text3)">${esc(r.fase)}${r.data ? ' · ' + esc(r.data) : ''} · ${cosa}${(r.rinomine || []).length ? ` · prima «${esc(r.rinomine[r.rinomine.length - 1].da)}»` : ''}</span></td>
      <td style="text-align:right">${eur(r.totale)}</td>
      <td style="text-align:right">${!c || c.differenza === 0 ? '—' : (c.differenza > 0 ? '+ ' : '− ') + eur(Math.abs(c.differenza))}</td>
      <td style="white-space:nowrap">
        <button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="schedaRevisione('${esc(r.id)}')" title="Rinomina: nome, fase, data e note della revisione" aria-label="Rinomina">✎</button>
        ${base ? `<button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="confrontaRevisione('${esc(r.id)}')" title="Confronta col computo di adesso, voce per voce" aria-label="Confronta">⇄</button>` : ''}
        ${progetto ? '' : `<button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="elencoRevisione('${esc(r.id)}')" title="L'elenco prezzi congelato con questa revisione" aria-label="Elenco prezzi">≡</button>`}
        <button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="eliminaRevisione('${esc(r.id)}')" title="Elimina la revisione" aria-label="Elimina">✕</button>
      </td></tr>`;
  }).join('');
  const ov = document.createElement('div');
  ov.id = 'revisioni-overlay'; ov.className = 'overlay open'; ov.style.zIndex = '10060';
  ov.onclick = (e) => { if (e.target === ov) chiudiRevisioni(); };
  ov.innerHTML = `<div id="qe-box" style="max-width:980px;width:min(980px,94vw)">
    <div class="qe-hd"><h3>⧗ Revisioni del progetto</h3><span class="cmp-sp"></span><button class="cmp-close" onclick="chiudiRevisioni()">Esc ✕</button></div>
    <div class="qe-body">
      <p style="margin:0 0 10px;font-size:12px;color:var(--text3)">Una revisione resta nel file, con un nome che si può correggere. Quella <b>di computo</b> congela voci, misure ed elenco prezzi di adesso; quella <b>di progetto</b> registra che sono cambiati gli elaborati mentre il computo è rimasto lo stesso.</p>
      <div style="display:flex;gap:14px;margin:0 0 10px;font-size:12px;flex-wrap:wrap">
        <label><input type="radio" name="rev-natura" value="computo" checked> Revisione di computo <span style="color:var(--text3)">(voci, misure, elenco prezzi)</span></label>
        <label><input type="radio" name="rev-natura" value="progetto"> Revisione di progetto <span style="color:var(--text3)">(il computo non cambia)</span></label>
      </div>
      <div style="display:flex;align-items:flex-end;gap:8px;margin:0 0 12px;flex-wrap:wrap">
        <label class="qe-f" style="flex:1 1 180px"><span>Nome della revisione</span><input id="rev-nome" placeholder="es. Progetto esecutivo"></label>
        <label class="qe-f"><span>Fase</span><select id="rev-fase">${a.FASI.map((f) => `<option value="${esc(f)}">${esc(f)}</option>`).join('')}</select></label>
        <label class="qe-f"><span>Data</span><input id="rev-data" value="${esc(oggiIt())}" placeholder="gg/mm/aaaa"></label>
        <button class="ehb-btn ehb-btn--accent-soft" onclick="creaRevisione()" title="Registra la revisione">＋ Registra la revisione</button>
      </div>
      <label class="qe-f" style="margin:0 0 12px"><span>Note (facoltative)</span><input id="rev-note" placeholder="es. dopo le prescrizioni della conferenza di servizi"></label>
      <div style="font-size:12px;color:var(--text3);margin:0 0 6px">Computo di adesso: <b>${esc(String(voci.length))}</b> voci · <b>${eur(totOra)}</b></div>
      <table class="dtable" style="width:100%">
        <thead><tr><th></th><th>Revisione</th><th style="text-align:right">Totale</th><th style="text-align:right">Differenza a oggi</th><th></th></tr></thead>
        <tbody>${righe || '<tr><td colspan="5" style="color:var(--text3)">Nessuna revisione: congela il computo per fissare questa fase.</td></tr>'}</tbody>
      </table>
    </div>
    <div class="qe-ft"><button class="ehb-btn ehb-btn--ghost" onclick="chiudiRevisioni()">Chiudi</button></div>
  </div>`;
  document.body.appendChild(ov);
  setTimeout(() => { const el = document.getElementById('rev-nome'); if (el) el.focus(); }, 0);
}

export function creaRevisione() {
  const a = api(); if (!a) return;
  const g = (id) => (document.getElementById(id) || {}).value || '';
  const natura = (document.querySelector('input[name="rev-natura"]:checked') || {}).value || 'computo';
  const fase = g('rev-fase') || 'altro';
  const nome = g('rev-nome').trim() || `${fase} ${g('rev-data') || oggiIt()}`;
  const meta = { id: 'rev' + Date.now().toString(36), nome, fase, data: g('rev-data') || oggiIt(), note: g('rev-note').trim() || undefined, ts: Date.now() };
  let rev;
  if (natura === 'progetto') {
    rev = a.progetto(meta, a.ultimaDiComputo(revisioni()));
  } else {
    const voci = vociOra();
    if (!voci.length) { toast('Nessuna voce da congelare: registra una revisione di progetto, se è cambiato solo il progetto', 'warn'); return; }
    rev = a.snapshot(voci, meta);
  }
  revisioni().push(rev);
  pubblica();
  apriRevisioni();
  toast(natura === 'progetto'
    ? `Revisione di progetto «${nome}» registrata: il computo resta quello`
    : `Revisione «${nome}» congelata: ${rev.voci.length} voci, ${rev.elenco.length} prezzi, ${eur(rev.totale)}`, 'ok');
}

export function eliminaRevisione(id) {
  const r = revById(id); if (!r) return;
  const appoggiate = revisioni().filter((x) => x.computoDi === id);
  if (!confirm(`Eliminare la revisione «${r.nome}»? Il computo di adesso non cambia.${appoggiate.length ? `\n\n${appoggiate.length} revision${appoggiate.length === 1 ? 'e di progetto poggia' : 'i di progetto poggiano'} su questa: resteranno senza computo di riferimento.` : ''}`)) return;
  S.revisioni = revisioni().filter((x) => x.id !== id);
  pubblica();
  apriRevisioni();
}

// ── Scheda: nome, fase, data e note si correggono; il contenuto no ─────────
export function schedaRevisione(id) {
  const a = api(); const r = revById(id); if (!a || !r) return;
  chiudiRevisioni();
  const progetto = naturaDi(r) === 'progetto';
  const base = daConfrontare(r);
  const ov = document.createElement('div');
  ov.id = 'revisioni-overlay'; ov.className = 'overlay open'; ov.style.zIndex = '10060';
  ov.onclick = (e) => { if (e.target === ov) chiudiRevisioni(); };
  ov.innerHTML = `<div id="qe-box" style="max-width:620px">
    <div class="qe-hd"><h3>${esc(siglaDi(r))} · ${esc(r.nome)}</h3><span class="cmp-sp"></span><button class="cmp-close" onclick="chiudiRevisioni()">Esc ✕</button></div>
    <div class="qe-body">
      <p style="margin:0 0 10px;font-size:12px;color:var(--text3)">${progetto
        ? `Revisione <b>di progetto</b>: ${base ? `il computo è quello della ${esc(siglaDi(base))} «${esc(base.nome)}»` : 'nessun computo congelato prima di lei'}.`
        : `Revisione <b>di computo</b>: ${esc(String(r.voci.length))} voci, elenco di ${a.elenco(r).length} prezzi, ${eur(r.totale)}.`}
        Si correggono nome, fase, data e note; il contenuto resta quello congelato.</p>
      <label class="qe-f" style="margin:0 0 8px"><span>Nome</span><input id="revs-nome" value="${esc(r.nome)}"></label>
      <div style="display:flex;gap:8px;margin:0 0 8px">
        <label class="qe-f"><span>Fase</span><select id="revs-fase">${a.FASI.map((f) => `<option value="${esc(f)}"${f === r.fase ? ' selected' : ''}>${esc(f)}</option>`).join('')}</select></label>
        <label class="qe-f"><span>Data</span><input id="revs-data" value="${esc(r.data || '')}" placeholder="gg/mm/aaaa"></label>
      </div>
      <label class="qe-f" style="margin:0 0 8px"><span>Note</span><input id="revs-note" value="${esc(r.note || '')}"></label>
      ${(r.rinomine || []).length ? `<p style="margin:8px 0 0;font-size:11px;color:var(--text3)">Nomi precedenti: ${r.rinomine.map((x) => `«${esc(x.da)}» (fino al ${esc(x.il)})`).join(', ')}</p>` : ''}
    </div>
    <div class="qe-ft"><button class="ehb-btn ehb-btn--ghost" onclick="apriRevisioni()">‹ Revisioni</button><button class="ehb-btn ehb-btn--accent-soft" onclick="salvaSchedaRevisione('${esc(r.id)}')">Salva</button></div>
  </div>`;
  document.body.appendChild(ov);
  setTimeout(() => { const el = document.getElementById('revs-nome'); if (el) { el.focus(); el.select(); } }, 0);
}

export function salvaSchedaRevisione(id) {
  const a = api(); const r = revById(id); if (!a || !r) return;
  const g = (k) => (document.getElementById(k) || {}).value;
  let nuova;
  try { nuova = a.rinomina(r, { nome: g('revs-nome') || '', fase: g('revs-fase') || r.fase, data: g('revs-data') ?? r.data, note: g('revs-note') ?? '' }, oggiIt()); }
  catch (e) { toast(e.message || 'Nome non valido', 'warn'); return; }
  S.revisioni = revisioni().map((x) => (x.id === id ? nuova : x));
  pubblica();
  apriRevisioni();
  toast(nuova.nome !== r.nome ? `Revisione rinominata: «${r.nome}» → «${nuova.nome}»` : 'Revisione aggiornata', 'ok');
}

// ── L'elenco prezzi congelato con la revisione ─────────────────────────────
export function elencoRevisione(id) {
  const a = api(); const r = revById(id); if (!a || !r) return;
  chiudiRevisioni();
  const art = a.elenco(r);
  const righe = art.map((x) => `<tr>
      <td class="code">${esc(x.codice || '—')}${x.np ? ' <span class="cm-np-tag">NP</span>' : ''}</td>
      <td>${esc(x.descrizione)}${x.codiceOrig ? ` <span style="font-size:10px;color:var(--text3)">da ${esc(x.codiceOrig)}</span>` : ''}</td>
      <td style="text-align:right">${esc(x.um)}</td>
      <td style="text-align:right">${eur(x.prezzo)}</td>
      <td style="font-size:11px;color:var(--text3)">${esc(x.provenienza)}</td>
      <td style="text-align:right">${esc(String(x.usi))}</td>
    </tr>`).join('');
  const ov = document.createElement('div');
  ov.id = 'revisioni-overlay'; ov.className = 'overlay open'; ov.style.zIndex = '10060';
  ov.onclick = (e) => { if (e.target === ov) chiudiRevisioni(); };
  ov.innerHTML = `<div id="qe-box" style="max-width:1000px">
    <div class="qe-hd"><h3>≡ Elenco prezzi · ${esc(siglaDi(r))} ${esc(r.nome)}</h3><span class="cmp-sp"></span><button class="cmp-close" onclick="chiudiRevisioni()">Esc ✕</button></div>
    <div class="qe-body">
      <p style="margin:0 0 10px;font-size:12px;color:var(--text3)">I prezzi com'erano al ${esc(r.data || 'congelamento')}: non seguono le modifiche fatte dopo all'elenco del progetto. ${esc(String(art.length))} articoli.</p>
      <div style="max-height:56vh;overflow:auto">
        <table class="dtable" style="width:100%">
          <thead><tr><th>Codice</th><th>Designazione</th><th style="text-align:right">U.M.</th><th style="text-align:right">Prezzo</th><th>Provenienza</th><th style="text-align:right">Voci</th></tr></thead>
          <tbody>${righe || '<tr><td colspan="6" style="color:var(--text3)">Nessun articolo.</td></tr>'}</tbody>
        </table>
      </div>
    </div>
    <div class="qe-ft"><button class="ehb-btn ehb-btn--ghost" onclick="apriRevisioni()">‹ Revisioni</button></div>
  </div>`;
  document.body.appendChild(ov);
}

// ── Confronto revisione → computo di adesso ─────────────────────────────────
const SEGNO = { nuova: '＋ nuova', soppressa: '✕ soppressa', variata: 'variata', invariata: '' };

export function confrontaRevisione(id) {
  const a = api(); const r0 = revById(id); if (!a || !r0) return;
  const r = daConfrontare(r0);
  if (!r) { toast('Questa revisione di progetto non poggia su un computo congelato: non c\'è niente da confrontare', 'warn'); return; }
  chiudiRevisioni();
  const c = a.confronta(r, vociOra());
  const righe = c.righe.map((x) => `<tr${x.stato === 'invariata' ? ' style="color:var(--text3)"' : ''}>
      <td class="code">${esc(x.codice)}</td>
      <td>${esc(x.descrizione)}${SEGNO[x.stato] ? ` <span style="font-size:10px;color:var(--text3)">${esc(SEGNO[x.stato])}</span>` : ''}</td>
      <td style="text-align:right">${esc(x.um)}</td>
      <td style="text-align:right">${x.qtyPrima == null ? '' : qt(x.qtyPrima)}</td>
      <td style="text-align:right">${x.qtyDopo == null ? '' : qt(x.qtyDopo)}</td>
      <td style="text-align:right">${eur(x.importoPrima)}</td>
      <td style="text-align:right">${eur(x.importoDopo)}</td>
      <td style="text-align:right">${x.differenza === 0 ? '—' : (x.differenza > 0 ? '+ ' : '− ') + eur(Math.abs(x.differenza))}</td>
    </tr>`).join('');
  const ov = document.createElement('div');
  ov.id = 'revisioni-overlay'; ov.className = 'overlay open'; ov.style.zIndex = '10060';
  ov.onclick = (e) => { if (e.target === ov) chiudiRevisioni(); };
  ov.innerHTML = `<div id="qe-box" style="max-width:1040px">
    <div class="qe-hd"><h3>⇄ ${esc(r.nome)} → computo di adesso</h3><span class="cmp-sp"></span><button class="cmp-close" onclick="chiudiRevisioni()">Esc ✕</button></div>
    <div class="qe-body">
      <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:12px;margin:0 0 10px">
        <span>${esc(r.nome)}: <b>${eur(c.totalePrima)}</b></span>
        <span>Adesso: <b>${eur(c.totaleDopo)}</b></span>
        <span>Differenza: <b>${c.differenza === 0 ? '—' : (c.differenza > 0 ? '+ ' : '− ') + eur(Math.abs(c.differenza))}${c.variazionePct != null ? ` (${c.variazionePct.toLocaleString('it-IT')} %)` : ''}</b></span>
        <span style="color:var(--text3)">${esc(plur(c.variate, 'variata', 'variate'))} · ${esc(plur(c.nuove, 'nuova', 'nuove'))} · ${esc(plur(c.soppresse, 'soppressa', 'soppresse'))}</span>
      </div>
      <div style="max-height:52vh;overflow:auto">
        <table class="dtable" style="width:100%">
          <thead><tr><th>Codice</th><th>Descrizione</th><th style="text-align:right">U.M.</th><th style="text-align:right">Q.tà allora</th><th style="text-align:right">Q.tà adesso</th><th style="text-align:right">Importo allora</th><th style="text-align:right">Importo adesso</th><th style="text-align:right">Differenza</th></tr></thead>
          <tbody>${righe}</tbody>
        </table>
      </div>
    </div>
    <div class="qe-ft"><button class="ehb-btn ehb-btn--ghost" onclick="apriRevisioni()">‹ Revisioni</button><button class="ehb-btn ehb-btn--accent-soft" onclick="stampaConfrontoRevisione('${esc(r.id)}')">⎙ Quadro comparativo</button></div>
  </div>`;
  document.body.appendChild(ov);
}

export function stampaConfrontoRevisione(id) {
  const a = api(); const r0 = revById(id); const r = r0 ? daConfrontare(r0) : null; if (!a || !r) return;
  const html = a.confrontoHTML(r, a.confronta(r, vociOra()), S.datiGenerali || {});
  const w = window.open('', '_blank');
  if (!w) { toast('Finestra bloccata: consenti i popup per aprire il quadro comparativo', 'warn'); return; }
  w.document.open(); w.document.write(html); w.document.close();
}

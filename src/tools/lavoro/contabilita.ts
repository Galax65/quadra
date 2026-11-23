/**
 * LA PAGINA DEI DATI DELLA CONTABILITÀ — sotto DATI DEL LAVORO nella sidebar:
 * il contratto come atto, i tempi (consegna, giorni utili, sospensioni,
 * proroghe, ultimazione) con il quadro che ne esce, i pagamenti.
 *
 * Modulo PURO: riceve il lavoro e la data di lettura, restituisce HTML. Ogni
 * campo salva da solo (lvCt, lvSosp, lvProroga in main.ts).
 */
import { testataHtml } from '../../shared/griglia'
import {
  contratto, datiContabilita, importiContratto, offertaModificabile, sigla, tempiLavoro,
  type Lavoro,
} from '../../shared/lavoro'
import { eur, fmt } from './schermata'

const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
const q = (s: string): string => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
const num = (n: number | null | undefined): string => (n == null ? '' : String(n).replace('.', ','))
const giorni = (n: number): string => `${n} ${n === 1 ? 'giorno' : 'giorni'}`

/** Un campo che salva da solo: chiave del dato, etichetta, valore, attributi. */
const campo = (chiave: string, etichetta: string, valore: string, extra = ''): string =>
  `<label class="lv-f"><span>${esc(etichetta)}</span><input value="${esc(valore)}" onchange="lvCt('${chiave}',this.value)" ${extra}></label>`
const data = (chiave: string, etichetta: string, valore?: string): string =>
  campo(chiave, etichetta, valore || '', 'placeholder="gg/mm/aaaa" style="width:120px"')
const dataCF = (chiave: string, etichetta: string, valore?: string): string =>
  `<label class="lv-f"><span>${esc(etichetta)}</span><input value="${esc(valore || '')}" placeholder="gg/mm/aaaa" style="width:120px" onchange="lvCtCF('${chiave}',this.value)"></label>`

export function paginaContabilita(l: Lavoro, oggi: string): string {
  const d = datiContabilita(l)
  const t = tempiLavoro(l, oggi)
  const c = contratto(l)
  const ic = c ? importiContratto(c) : null

  const offerta = c && ic ? `<p class="lv-nota">Contratto ${esc(sigla(c.numero))} del ${esc(c.data)}: ${ic.ribassoPct != null ? `ribasso <b>${fmt(ic.ribassoPct, 4)}%</b>` : '<b>offerta a prezzi unitari</b>'} · importo contrattuale <b>${eur(ic.contrattuale)}</b> (sicurezza ${eur(ic.sicurezza)}).
      <button class="lv-pz-link" onclick="lvApri('${c.id}')">${offertaModificabile(l) ? "Apri il contratto: l'offerta si corregge finché nessun SAL è emesso" : 'Apri il contratto'}</button></p>`
    : '<p class="lv-nota">Il contratto nasce da un computo consegnato («→ Contratto…»); qui si scrivono i suoi estremi.</p>'

  const sosp = t.sospensioni.map((s) => `<tr>
      <td><input value="${esc(s.dal)}" placeholder="gg/mm/aaaa" onchange="lvSosp(${q(s.id)},'dal',this.value)"></td>
      <td><input value="${esc(s.al || '')}" placeholder="in corso" onchange="lvSosp(${q(s.id)},'al',this.value)"></td>
      <td><input value="${esc(s.motivo || '')}" placeholder="motivo (es. condizioni meteo)" onchange="lvSosp(${q(s.id)},'motivo',this.value)"></td>
      <td class="lv-ct-n">${s.giorni == null ? '<i>in corso</i>' : giorni(s.giorni)}</td>
      <td><button class="ehb-icon-btn" title="Togli" onclick="lvSospTogli(${q(s.id)})">✕</button></td>
    </tr>`).join('')
  const prg = d.proroghe.map((p) => `<tr>
      <td><input value="${esc(p.data || '')}" placeholder="gg/mm/aaaa" onchange="lvProroga(${q(p.id)},'data',this.value)"></td>
      <td><input value="${num(p.giorni)}" inputmode="numeric" onchange="lvProroga(${q(p.id)},'giorni',this.value)"></td>
      <td><input value="${esc(p.motivo || '')}" placeholder="motivo" onchange="lvProroga(${q(p.id)},'motivo',this.value)"></td>
      <td class="lv-ct-n">${giorni(Math.max(0, Math.round(p.giorni || 0)))}</td>
      <td><button class="ehb-icon-btn" title="Togli" onclick="lvProrogaTogli(${q(p.id)})">✕</button></td>
    </tr>`).join('')

  const quadro = `<table class="lv-cfr lv-ct-quadro"><tbody>
      <tr><th>Consegna dei lavori</th><td>${esc(d.dataConsegna || '—')}</td></tr>
      <tr><th>Termine contrattuale${d.giorniUtili ? ` (${giorni(d.giorniUtili)})` : ''}</th><td>${esc(t.termineContrattuale || '—')}</td></tr>
      ${t.giorniSospensione ? `<tr><th>+ sospensioni</th><td>${giorni(t.giorniSospensione)}</td></tr>` : ''}
      ${t.giorniProroga ? `<tr><th>+ proroghe</th><td>${giorni(t.giorniProroga)}</td></tr>` : ''}
      <tr class="is-ok"><th>Termine vigente per l'ultimazione</th><td>${t.termineVigente ? esc(t.termineVigente) : `<i>non calcolabile${t.nonCalcolabile ? `: ${esc(t.nonCalcolabile)}` : ''}</i>`}</td></tr>
      ${t.residuo != null ? `<tr class="${t.ritardo ? 'is-diff' : ''}"><th>${d.dataUltimazione ? `Ultimazione il ${esc(d.dataUltimazione)}` : `Al ${esc(oggi)}`}</th><td>${t.ritardo ? `ritardo ${giorni(t.ritardo)}` : `${d.dataUltimazione ? 'nei termini, ' : ''}${giorni(t.residuo)} al termine`}</td></tr>` : ''}
    </tbody></table>
    ${t.sospensioneAperta ? '<p class="lv-nota"><b>Lavori sospesi</b>: il termine vigente si calcola con la data di ripresa.</p>' : ''}
    ${t.ritardo && d.penalePerMille && ic ? `<p class="lv-nota">Penale: ${fmt(d.penalePerMille, 2)}‰ × ${giorni(t.ritardo)} × ${eur(ic.contrattuale)} = <b>${eur(Math.min(ic.contrattuale * d.penalePerMille / 1000 * t.ritardo, ic.contrattuale * 0.1))}</b>${ic.contrattuale * d.penalePerMille / 1000 * t.ritardo > ic.contrattuale * 0.1 ? ' (al massimo il 10% del contratto)' : ''}.</p>` : ''}`

  return `<section class="lv-page lv-dati">
    ${testataHtml({ titolo: 'Contratto, tempi e pagamenti', sottotitolo: 'i dati della contabilità: si salvano da soli', pastiglie: [{ testo: 'contabilità', tono: 'fase' }] })}
    <div class="lv-body lv-dati__corpo">
      <section class="lv-ct">
        <h2>Il contratto</h2>
        ${offerta}
        <div class="lv-righe">
          ${campo('numeroContratto', 'Numero / repertorio', d.numeroContratto || '', 'style="width:160px"')}
          ${data('dataStipula', 'Data di stipula', d.dataStipula)}
          ${campo('registrazione', 'Registrazione (luogo, data, numero)', d.registrazione || '')}
        </div>
      </section>

      <section class="lv-ct">
        <h2>I tempi</h2>
        <div class="lv-righe">
          ${data('dataConsegna', 'Consegna dei lavori', d.dataConsegna)}
          ${campo('giorniUtili', 'Giorni utili', num(d.giorniUtili), 'inputmode="numeric" style="width:100px"')}
          ${data('dataUltimazione', 'Ultimazione (certificato)', d.dataUltimazione)}
        </div>
        <h3>Sospensioni</h3>
        ${sosp ? `<table class="lv-ct-tab"><thead><tr><th>Sospesi il</th><th>Ripresi il</th><th>Motivo</th><th></th><th></th></tr></thead><tbody>${sosp}</tbody></table>` : '<p class="lv-nota">Nessuna sospensione.</p>'}
        <button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="lvSospNuova()"${t.sospensioneAperta ? ' disabled title="Prima la ripresa della sospensione in corso"' : ''}>＋ Sospensione</button>
        <h3>Proroghe</h3>
        ${prg ? `<table class="lv-ct-tab"><thead><tr><th>Concessa il</th><th>Giorni</th><th>Motivo</th><th></th><th></th></tr></thead><tbody>${prg}</tbody></table>` : '<p class="lv-nota">Nessuna proroga.</p>'}
        <button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="lvProrogaNuova()">＋ Proroga</button>
        <h3>Il quadro</h3>
        ${quadro}
      </section>

      <section class="lv-ct">
        <h2>I pagamenti</h2>
        <div class="lv-righe">
          ${campo('anticipazionePct', 'Anticipazione %', num(d.anticipazionePct), 'inputmode="decimal" placeholder="es. 20" style="width:110px"')}
          ${campo('penalePerMille', 'Penale ‰ al giorno', num(d.penalePerMille), 'inputmode="decimal" placeholder="0,3 – 1" style="width:120px"')}
          ${campo('ivaPct', 'IVA %', num(d.ivaPct), 'inputmode="decimal" placeholder="es. 10" style="width:90px"')}
          ${campo('importoMinimoSal', 'Importo minimo di un SAL €', num(d.importoMinimoSal), 'inputmode="decimal" style="width:160px"')}
          ${campo('arrotondamentoCertificato', 'Arrotondamento del certificato €', num(d.arrotondamentoCertificato), 'inputmode="decimal" placeholder="es. 100" style="width:180px"')}
          ${campo('articoloCapitolato', 'Articolo del capitolato', d.articoloCapitolato || '', 'placeholder="art. 27 CSA" style="width:160px"')}
        </div>
        <p class="lv-nota">Anticipazione (art. 125 c. 1 D.Lgs. 36/2023) e penale (fra 0,3 e 1 per mille al giorno, al massimo il 10%) entrano nel certificato di pagamento e nel conto finale. La ritenuta a garanzia è quella di legge, lo 0,50% su ogni certificato: si svincola con il collaudo o il CRE approvato e il DURC regolare. L'arrotondamento è per difetto: il resto matura nel certificato dopo.</p>
      </section>

      <section class="lv-ct">
        <h2>La chiusura</h2>
        <h3>Il conto finale</h3>
        <div class="lv-righe">
          ${dataCF('dataCompilazione', 'Compilato dal DL il', d.contoFinale?.dataCompilazione)}
          ${dataCF('dataInvito', "Invito del RUP all'esecutore", d.contoFinale?.dataInvito)}
          <label class="lv-f"><span>Termine per firmare (giorni, max 30)</span><input value="${num(d.contoFinale?.giorniTermine)}" inputmode="numeric" style="width:110px" onchange="lvCtCF('giorniTermine',this.value)"></label>
          ${dataCF('dataFirma', 'Firmato il (o termine scaduto)', d.contoFinale?.dataFirma)}
          <label class="lv-f"><span>Esito</span><select onchange="lvCtCF('esito',this.value)">${[['', '—'], ['firmatoConConferma', 'firmato, riserve confermate'], ['firmatoSenzaConferma', 'firmato senza confermarle (accettato)'], ['nonFirmato', 'non firmato nel termine (accettato)']].map(([v, t]) => `<option value="${v}"${(d.contoFinale?.esito || '') === v ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
        </div>
        <h3>DURC</h3>
        <div class="lv-righe">
          <label class="lv-f lv-f--spunta"><input type="checkbox"${d.durcRegolare ? ' checked' : ''} onchange="lvCt('durcRegolare',this.checked?'1':'')"><span>Regolarità contributiva verificata</span></label>
          ${data('durcData', 'DURC del', d.durcData)}
        </div>
        <h3>Accordo quadro (art. 59)</h3>
        <label class="lv-f lv-f--spunta"><input type="checkbox"${d.accordoQuadro ? ' checked' : ''} onchange="lvAq(this.checked)"><span>L'appalto è un accordo quadro: un importo massimo, e i contratti applicativi che lo impegnano</span></label>
        ${d.accordoQuadro ? (() => {
          const aq = d.accordoQuadro
          const impegnato = aq.applicativi.reduce((t, x) => t + (x.importo || 0), 0)
          const max = aq.importoMassimo || 0
          return `<div class="lv-righe"><label class="lv-f"><span>Importo massimo €</span><input value="${num(aq.importoMassimo)}" inputmode="decimal" style="width:160px" onchange="lvAqMax(this.value)"></label></div>
            ${aq.applicativi.length ? `<table class="lv-ct-tab"><thead><tr><th>N.</th><th>Data</th><th>Oggetto</th><th>Importo €</th><th></th></tr></thead><tbody>
              ${aq.applicativi.map((x, i) => `<tr><td>${x.numero}</td><td><input value="${esc(x.data || '')}" placeholder="gg/mm/aaaa" class="lv-ct-data" onchange="lvAqApp(${i},'data',this.value)"></td><td><input value="${esc(x.oggetto || '')}" onchange="lvAqApp(${i},'oggetto',this.value)"></td><td><input value="${num(x.importo)}" inputmode="decimal" style="width:120px" onchange="lvAqApp(${i},'importo',this.value)"></td><td><button class="ehb-icon-btn" title="Togli" onclick="lvAqTogli(${i})">✕</button></td></tr>`).join('')}
            </tbody></table>` : '<p class="lv-nota">Nessun contratto applicativo.</p>'}
            <button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="lvAqNuovo()">＋ Contratto applicativo</button>
            <p class="lv-nota${max && impegnato > max ? ' lv-eccede' : ''}">Impegnato ${eur(impegnato)}${max ? ` su ${eur(max)} (${fmt(impegnato / max * 100)}%) · residuo ${eur(max - impegnato)}${impegnato > max ? ' — <b>oltre l\'importo massimo</b>' : ''}` : ''}</p>`
        })() : ''}
        <h3>Contabilità semplificata</h3>
        <label class="lv-f lv-f--spunta"><input type="checkbox"${d.semplificata ? ' checked' : ''} onchange="lvCt('semplificata',this.checked?'1':'')"><span>Lavori sotto 40.000 €: la contabilità si tiene in forma semplificata, con il visto del DL sulle fatture (art. 12 c. 11-bis All. II.14)</span></label>
        ${d.semplificata ? `
          ${(d.fatture || []).length ? `<table class="lv-ct-tab"><thead><tr><th>N.</th><th>Data</th><th>Oggetto</th><th>Importo €</th><th>Visto il</th><th>Rilievi</th><th></th></tr></thead><tbody>
            ${(d.fatture || []).map((f) => `<tr>
              <td><input value="${esc(f.numero || '')}" onchange="lvFatt(${q(f.id)},'numero',this.value)" style="width:70px"></td>
              <td><input value="${esc(f.data || '')}" placeholder="gg/mm/aaaa" class="lv-ct-data" onchange="lvFatt(${q(f.id)},'data',this.value)"></td>
              <td><input value="${esc(f.oggetto || '')}" onchange="lvFatt(${q(f.id)},'oggetto',this.value)"></td>
              <td><input value="${num(f.importo)}" inputmode="decimal" style="width:100px" onchange="lvFatt(${q(f.id)},'importo',this.value)"></td>
              <td><input value="${esc(f.vistoData || '')}" placeholder="non vistata" class="lv-ct-data" onchange="lvFatt(${q(f.id)},'vistoData',this.value)"></td>
              <td><input value="${esc(f.rilievi || '')}" onchange="lvFatt(${q(f.id)},'rilievi',this.value)"></td>
              <td><button class="ehb-btn ehb-btn--sm ehb-btn--ghost" title="Il visto sulla fattura" onclick="lvFattStampa(${q(f.id)})">⎙</button><button class="ehb-icon-btn" title="Togli" onclick="lvFattTogli(${q(f.id)})">✕</button></td>
            </tr>`).join('')}</tbody></table>` : '<p class="lv-nota">Nessuna fattura.</p>'}
          <button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="lvFattNuova()">＋ Fattura</button>` : ''}
      </section>
    </div>
  </section>`
}

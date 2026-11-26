/**
 * LA SCHERMATA UNICA — tappa 2 di Docs/07-Un-lavoro-un-modulo.md.
 *
 * Una tappa del lavoro si apre sempre qui: testata, barra, griglia delle voci
 * con le misure di dettaglio, piede. Cambia solo quello che si scrive e se si
 * può ancora scrivere: una revisione consegnata si legge e basta. Tutto è fatto
 * con i moduli condivisi (griglia, celle, tabella delle misure, barra, testata,
 * piede): qui si decide solo che cosa ci va.
 *
 * Modulo PURO: riceve il lavoro e lo stato della vista, restituisce HTML. I
 * comandi sono funzioni globali `lv…` che main.ts espone.
 */
import {
  FASE_PROGETTO, FASE_CONTRATTO, FASE_SAL, FASE_PERIZIA, OPZ_ORDINE, grigliaHtml, rigaDettaglioHtml, righeFoglioHtml, piedeFaseHtml, piedeHtml, testataHtml, barraVoci,
  type RigaGriglia, type RigaVoce, type Cella, type AzioniMisure,
} from '../../shared/griglia'
import {
  NOME_FASE, importiRevisione, importiContratto, importiAvanzamento, prezzoIn, quantitaVoce, quantitaEseguita, rigaDi, misurata, contratto,
  numeroDi, revisione, sigla, strutturaDi, vociEccedenti, totaleSotto, quotaDaSotto, importiPerizia, contoFinale, vigente, offertaModificabile, ribassoArticolo, type ImportiPerizia, type Lavoro, type Revisione, type Voce, type Articolo, type Avanzamento,
} from '../../shared/lavoro'
import { importoQta } from '../../shared/importo'
import { CAT_SEP } from '../../shared/xpwe/xpwe'
import { ordinaVoci } from '../../shared/ordine-computo'

const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
/** Un id dentro un attributo onclick tra apici singoli. */
const q = (s: string): string => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

export const fmt = (n: number, dec = 2): string => (Number.isFinite(n) ? n : 0).toLocaleString('it-IT', { minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: 'always' } as unknown as Intl.NumberFormatOptions)
export const eur = (n: number): string => '€ ' + fmt(n)
const numIn = (n: number | null | undefined): string => (n == null || n === 0 ? '' : String(n).replace('.', ','))

/** Lo stato della vista: non è un dato del lavoro, non va nel file. */
export interface Vista {
  q: string
  ordine: 'manuale' | 'categorie' | 'wbs'
  /** Solo voci: le misure si nascondono, ogni voce sta su una riga (si riaprono una per una). */
  soloVoci?: boolean
  /** Con «solo voci»: le voci riaperte una per una. */
  aperte: Set<string>
  /** Nel foglio (misure a vista): le voci chiuse una per una. */
  chiuse?: Set<string>
  /** Il pannello prezzi a destra è aperto. */
  prezziAperti?: boolean
  /** Nel SAL: solo le voci misurate, quelle oltre il contratto, o tutto. In perizia: solo le variate, o tutto. */
  mostra?: 'misurate' | 'eccedenti' | 'variate' | 'tutte'
}

/** Le misure di una voce sono a vista? Nel foglio sì, salvo le chiuse; con «solo voci» no, salvo le riaperte. */
export function misureAVista(vista: Vista, id: string): boolean {
  return vista.soloVoci ? vista.aperte.has(id) : !vista.chiuse?.has(id)
}

/** I comandi delle righe di misura di una voce: gli stessi nel computo e nel libretto. */
function azioniMisure(id: string, extra: Partial<AzioniMisure> = {}): AzioniMisure {
  return {
    set: (i, c) => `lvMisSet(${q(id)},${i},'${c}',this.value)`,
    tasti: (i, c) => `lvMisTasti(event,${q(id)},${i},'${c}')`,
    duplica: (i) => `lvMisDuplica(${q(id)},${i})`,
    elimina: (i) => `lvMisElimina(${q(id)},${i})`,
    menu: (i) => `lvMisMenu(event,${q(id)},${i})`,
    incollaQui: (i) => `lvMisIncolla(event,${q(id)},${i})`,
    aggiungi: `lvMisAggiungi(${q(id)},1)`,
    detrazione: `lvMisAggiungi(${q(id)},-1)`,
    ...extra,
  }
}

/** Che cosa dice la testata di una revisione: nome, fase, stato. */
export function titoloRevisione(r: Revisione): string {
  if (r.tipo === 'contratto') return 'Contratto'
  if (r.tipo === 'perizia') return r.nome || 'Perizia di variante'
  return r.nome ? `Computo · ${r.nome}` : `Computo · ${NOME_FASE[r.fase || 'PFTE']}`
}
export function statoRevisione(r: Revisione): string {
  if (r.stato === 'aperta') return r.tipo === 'contratto' ? 'in definizione' : r.tipo === 'perizia' ? 'in bozza' : 'in lavorazione'
  return r.tipo === 'contratto' ? 'in vigore' : r.tipo === 'perizia' ? 'approvata' : 'consegnata'
}

/* ── La griglia ───────────────────────────────────────────────────────── */

/** Accanto a un nuovo prezzo (o a un articolo segnato): se il ribasso d'asta lo tocca. */
function chipRibasso(c: Revisione | null, r: Revisione, a: Articolo): string[] {
  if (!c || a.sicurezza || !(a.origine === 'np' || a.origine === 'analisi' || a.soggettoRibasso != null)) return []
  const rib = ribassoArticolo(c, r, a)
  const scelto = a.soggettoRibasso != null ? ' (scelto)' : ''
  return [rib
    ? `<span class="lv-chip" title="Il ribasso d'asta si applica a questo prezzo${scelto}">ribassato ${fmt(rib, rib % 1 ? 2 : 0)}%</span>`
    : `<span class="lv-chip" title="Il ribasso d'asta non si applica a questo prezzo${scelto}">non ribassato</span>`]
}

/** In perizia, accanto alla voce: com'era nel vigente e di quanto cambia. */
function chipPerizia(v: Voce, a: Articolo, cfr: ImportiPerizia): string[] {
  const x = cfr.perVoce.get(v.id)
  if (!x) return []
  if (x.qPrima == null) return ['<span class="lv-chip is-var" title="Voce che il contratto vigente non aveva">nuova in perizia</span>']
  const d = quantitaVoce(v) - x.qPrima
  return [`<span class="lv-chip is-var" title="Quantità nel contratto vigente e variazione">vigente ${fmt(x.qPrima)} ${esc(a.um)} → ${d >= 0 ? '+' : '−'}${fmt(Math.abs(d))}</span>`]
}

/** Il sotto-computo di una voce a corpo, sotto le sue misure: lavorazioni, importi, quadratura col corpo. */
function sottoComputoHtml(r: Revisione, v: Voce, a: Articolo, scrive: boolean): string {
  const sc = v.sottoComputo || []
  const corpo = importoQta(quantitaVoce(v), prezzoIn(r, a), a.um)
  const tot = totaleSotto(v)
  const cella = (i: number, k: string, val: string, extra = ''): string => scrive ? `<input value="${esc(val)}" onchange="lvSc(${q(v.id)},${i},'${k}',this.value)" ${extra}>` : esc(val)
  const nIn = (x: number | null | undefined): string => (x == null ? '' : String(x).replace('.', ','))
  return `<div class="lv-sc">
    <div class="ehb-mis-titolo">Sotto-computo del corpo d'opera — la quota del SAL si ricava da qui</div>
    ${sc.length ? `<table class="lv-ct-tab"><thead><tr><th>Codice</th><th>Lavorazione</th><th>U.M.</th><th>Quantità</th><th>€ unit.</th><th>Importo</th><th></th></tr></thead><tbody>
      ${sc.map((x, i) => `<tr><td>${cella(i, 'codice', x.codice || '', 'style="width:80px"')}</td><td>${cella(i, 'descrizione', x.descrizione)}</td><td>${cella(i, 'um', x.um || '', 'style="width:50px"')}</td><td>${cella(i, 'qty', nIn(x.qty), 'inputmode="decimal" style="width:80px"')}</td><td>${cella(i, 'prezzo', nIn(x.prezzo), 'inputmode="decimal" style="width:80px"')}</td><td class="lv-ct-n">${eur((x.qty || 0) * (x.prezzo || 0))}</td><td>${scrive ? `<button class="ehb-icon-btn" title="Togli" onclick="lvScTogli(${q(v.id)},${i})">✕</button>` : ''}</td></tr>`).join('')}
    </tbody></table>` : `<p class="lv-nota">${scrive ? 'Nessuna lavorazione: senza sotto-computo la quota del SAL si scrive a mano.' : 'Nessun sotto-computo.'}</p>`}
    ${scrive ? `<button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="lvScNuova(${q(v.id)})">＋ Lavorazione</button>` : ''}
    ${sc.length ? `<p class="lv-nota">Sotto-computo ${eur(tot)} su corpo ${eur(corpo)}${Math.abs(tot - corpo) >= 0.005 ? ` — <b>non quadra</b> (${tot > corpo ? '+' : '−'} ${eur(Math.abs(tot - corpo))}): la quota si misura sul sotto-computo` : ' — quadra'}</p>` : ''}
  </div>`
}

function rigaVoce(r: Revisione, v: Voce, a: Articolo, vista: Vista, n: number, cfr?: ImportiPerizia, offerta?: boolean, c: Revisione | null = null): RigaVoce {
  const scrive = r.stato === 'aperta'
  const qty = quantitaVoce(v)
  const misure = v.misure.length
  const aperta = misureAVista(vista, v.id)
  const quantita: Cella = misure
    ? { tipo: 'misurata', valore: fmt(qty), um: a.um, misure, id: `lv-q-${v.id}` }
    : scrive
      ? { tipo: 'campo', valore: numIn(v.quantita), um: a.um, segnaposto: '—', isola: true, comando: `lvSetQta(${q(v.id)},this.value)`, titolo: 'Quantità (virgola decimale, anche formule). Per il dettaglio scrivi le misure: «＋ misura»', id: `lv-q-${v.id}` }
      : { tipo: 'numero', testo: `${fmt(qty)} ${a.um}`.trim(), muto: !qty }
  // in perizia il prezzo di contratto è fisso: si scrive solo quello dei nuovi prezzi
  // nel contratto a prezzi unitari si scrive il prezzo OFFERTO (finché nessun SAL è emesso)
  const offerto = r.tipo === 'contratto' && !!r.contratto?.prezziOfferti && !a.sicurezza
  const prezzo: Cella = offerto && offerta
    ? { tipo: 'campo', valore: r.contratto!.prezziOfferti![a.id] != null ? fmt(r.contratto!.prezziOfferti![a.id]) : '', segnaposto: a.prezzo ? fmt(a.prezzo) : '—', isola: true, comando: `lvSetOfferto(${q(a.id)},this.value)`, titolo: "Prezzo unitario offerto dall'impresa: vuoto = vale il prezzo di progetto", id: `lv-p-${v.id}` }
    : scrive && (r.tipo !== 'perizia' || a.origine === 'np')
    ? { tipo: 'campo', valore: a.prezzo ? fmt(a.prezzo) : '', segnaposto: '—', isola: true, comando: `lvSetPrezzo(${q(a.id)},this.value)`, titolo: "Prezzo dell'articolo: vale per tutte le voci che lo usano", id: `lv-p-${v.id}` }
    : { tipo: 'numero', testo: a.prezzo ? fmt(prezzoIn(r, a)) : '—' }
  const meta: string[] = []
  if (a.sicurezza) meta.push('<span class="lv-chip is-sic" title="Oneri della sicurezza: non soggetti a ribasso">sicurezza</span>')
  if (v.corpo) meta.push('<span class="lv-chip" title="Lavoro a corpo">a corpo</span>')
  // categoria e WBS non stanno sulla riga della voce: le dice l'intestazione del
  // gruppo, nelle viste per categoria e per WBS; nell'ordine manuale la riga resta libera
  if (cfr) meta.push(...chipPerizia(v, a, cfr))
  if (r.tipo !== 'computo') meta.push(...chipRibasso(c, r, a))
  if (offerto) {
    const off = r.contratto!.prezziOfferti![a.id]
    meta.push(off != null
      ? `<span class="lv-chip" title="Prezzo di progetto">progetto ${eur(a.prezzo ?? 0)}</span>`
      : '<span class="lv-chip is-oltre" title="Manca il prezzo offerto: vale quello di progetto">prezzo offerto mancante</span>')
  }
  // l'ordine manuale si cambia trascinando la voce
  const trascina = scrive && vista.ordine === 'manuale' ? ` draggable="true" ondragstart="lvDragVoce(event,${q(v.id)})" ondragover="lvDragSopra(event)" ondrop="lvDropVoce(event,${q(v.id)})" ondragend="lvDragFine(event)"` : ''
  const importo: Cella = { tipo: 'numero', testo: fmt(importoQta(qty, prezzoIn(r, a), a.um)), id: `lv-i-${v.id}` }
  const testa: RigaVoce['celle'] = {
    codice: { tipo: 'codice', codice: a.codice, senza: '✎ libera', tono: a.origine === 'np' ? 'np' : !a.codice ? 'libera' : undefined, ...(a.origine === 'np' ? { etichetta: 'NP' } : {}) },
    designazione: {
      tipo: 'designazione', testo: a.descrizione, vuoto: 'voce libera — scrivi la descrizione con ✎',
      meta,
      // i comandi della voce, accanto ai suoi dati: modifica, ripeti, togli
      azioni: scrive ? `<span class="lv-voce-az"><button class="ehb-icon-btn" onclick="lvModificaVoce(${q(v.id)})" title="Codice, descrizione, unità, prezzo, categoria, WBS">✎</button><button class="ehb-icon-btn" onclick="lvDuplica(${q(v.id)})" title="Ripeti la voce: lo stesso articolo, con misure proprie">⧉</button><button class="ehb-icon-btn is-pericolo" onclick="lvElimina(${q(v.id)})" title="Togli la voce dal${r.tipo === 'perizia' ? 'la perizia' : ' computo'} (l'articolo resta nell'elenco prezzi)">✕</button></span>` : '',
    },
  }
  // nel foglio la quantità sta sulla riga SOMMANO, sotto le sue misure
  const qSommano: Cella = misure ? { tipo: 'numero', testo: fmt(qty), id: `lv-q-${v.id}` } : quantita
  const etichettaVediVoce = (k: string): string => { const x = r.voci.find((y) => y.id === k); const ar = x && r.articoli.find((z) => z.id === x.articolo); return ar ? `${ar.codice || 'voce'} ${fmt(quantitaVoce(x!))} ${ar.um}` : 'voce tolta' }
  return {
    classe: aperta ? 'lv-voce is-foglio' : 'lv-voce',
    attributi: `data-voce="${esc(v.id)}" oncontextmenu="lvMenuVoce(event,${q(v.id)})"${trascina}`,
    sel: `<span class="lv-n"${trascina ? ' title="Trascina per spostare la voce" style="cursor:grab"' : ''}>${n}</span><button class="lv-piega" onclick="lvToggleMisure(${q(v.id)})" title="${aperta ? 'Nascondi' : 'Mostra'} le misure" aria-expanded="${aperta}">${aperta ? '▾' : '▸'}</button>`,
    celle: aperta ? testa : { ...testa, quantita, prezzo, importo },
    dopo: aperta
      ? righeFoglioHtml(FASE_PROGETTO, {
          righe: v.misure, um: a.um, fmt: (x) => fmt(x), soloLettura: !scrive, conSelezione: true,
          attributi: `data-voce="${esc(v.id)}" oncontextmenu="lvMenuVoce(event,${q(v.id)})"`,
          etichettaVediVoce,
          azioni: azioniMisure(v.id, { vediVoce: (i) => `lvMisVediVoce(${q(v.id)},${i})` }),
          sommano: { quantita: qSommano, prezzo, importo },
        }) + (v.corpo ? rigaDettaglioHtml(FASE_PROGETTO, { conSelezione: true, attributi: `data-voce="${esc(v.id)}"`, contenuto: sottoComputoHtml(r, v, a, scrive) }) : '')
      : '',
  }
}

/** Le voci a schermo, filtrate dalla ricerca e ordinate come si è scelto. */
export function vociVisibili(r: Revisione, vista: Vista): { voce: Voce; articolo: Articolo; n: number }[] {
  const art = new Map(r.articoli.map((a) => [a.id, a]))
  const tutte = r.voci.map((v, i) => ({ voce: v, articolo: art.get(v.articolo)!, n: i + 1 })).filter((x) => x.articolo)
  const s = vista.q.trim().toLowerCase()
  const cercate = s ? tutte.filter((x) => `${x.articolo.codice} ${x.articolo.descrizione} ${x.voce.categoria || ''}`.toLowerCase().includes(s)) : tutte
  if (vista.ordine === 'manuale') return cercate
  // l'ordine è quello della STRUTTURA (pagina «Categorie e WBS»: rami spostati con ↑↓,
  // WBS per codice), non quello alfabetico; dentro un gruppo, l'ordine del computo
  const st = strutturaDi(r)
  const ids = cercate.map((x) => x.voce.id)
  const ordinati = ordinaVoci(ids, vista.ordine, {
    ordine: r.voci.map((v) => v.id),
    categoria: Object.fromEntries(cercate.map((x) => [x.voce.id, x.voce.categoria || ''])),
    wbs: Object.fromEntries(cercate.map((x) => [x.voce.id, x.voce.wbs || ''])),
    ordineLivelli: st.ordineLivelli,
  })
  const per = new Map(cercate.map((x) => [x.voce.id, x]))
  return ordinati.map((k) => per.get(k)!)
}

export function grigliaRevisione(r: Revisione, vista: Vista, cfr?: ImportiPerizia, offerta?: boolean, c: Revisione | null = null): string {
  const soloVariate = !!cfr && vista.mostra === 'variate'
  const vis = vociVisibili(r, vista).filter((x) => !soloVariate || cfr!.perVoce.has(x.voce.id) || (!!vista.soloVoci && vista.aperte.has(x.voce.id)))
  const righe: RigaGriglia[] = []
  let gruppo: string | null = null
  for (const x of vis) {
    if (vista.ordine !== 'manuale') {
      const g = vista.ordine === 'wbs'
        ? (x.voce.wbs ? `WBS ${x.voce.wbs}${strutturaDi(r).wbsNodi[x.voce.wbs] ? ` — ${strutturaDi(r).wbsNodi[x.voce.wbs]}` : ''}` : 'Senza WBS')
        : (x.voce.categoria ? x.voce.categoria.split(CAT_SEP).join(' › ') : 'Senza categoria')
      if (g !== gruppo) { gruppo = g; righe.push({ tipo: 'gruppo', titolo: g }) }
    }
    righe.push(rigaVoce(r, x.voce, x.articolo, vista, x.n, cfr, offerta, c))
  }
  return grigliaHtml({
    fase: FASE_PROGETTO, righe, selezione: {}, idCorpo: 'lv-corpo',
    vuoto: vista.q ? 'Nessuna voce corrisponde alla ricerca.'
      : soloVariate ? 'Nessuna voce variata: cambia le quantità in «Tutto il contratto», o porta un nuovo prezzo con «＋» dall\'elenco a destra.'
      : r.stato === 'aperta' ? 'Computo vuoto: «＋ Voce libera» nella barra, oppure «⇩ XPWE» per importarne uno.' : 'Questa revisione non ha voci.',
  })
}

/* ── La pagina intera ─────────────────────────────────────────────────── */

export function paginaRevisione(l: Lavoro, r: Revisione, vista: Vista): string {
  const scrive = r.stato === 'aperta'
  // l'offerta del contratto (ribasso o prezzi offerti) si corregge finché nessun SAL è emesso
  const offerta = r.tipo === 'contratto' && offertaModificabile(l)
  const imp = importiRevisione(r)
  const testata = testataHtml({
    titolo: titoloRevisione(r),
    revisione: sigla(r.numero),
    sottotitolo: `${r.voci.length} voc${r.voci.length === 1 ? 'e' : 'i'} · ${r.data}`,
    pastiglie: [
      { testo: r.tipo === 'computo' ? 'progetto' : r.tipo, tono: 'fase' },
      { testo: statoRevisione(r), ...(scrive ? { tono: 'bozza' as const } : {}) },
      ...(scrive ? [] : [{ testo: offerta ? '🔒 voci · offerta correggibile' : '🔒 sola lettura' }]),
    ],
    stampa: { onclick: 'lvStampa()', titolo: 'Le stampe di questa revisione: computo metrico, elenco prezzi, stima dei lavori' },
  })
  const perizia = r.tipo === 'perizia'
  const cfr = perizia ? importiPerizia(l, r.id) : undefined
  const ultimoAv = [...l.avanzamenti].sort((x, y) => x.ordine - y.ordine).pop()
  const salDopo = !ultimoAv || (ultimoAv.tipo === 'sal' && ultimoAv.stato === 'emesso')
  const extra = perizia
    ? (scrive
      ? [{ etichetta: '✓ Approva…', titolo: 'La perizia approvata diventa il contratto vigente: i SAL successivi ne portano prezzi e numero', onclick: 'lvConsegna()', stile: 'accent' as const }]
      : [
          ...(vigente(l)?.id === r.id && salDopo ? [{ etichetta: `＋ SAL n. ${(ultimoAv?.n ?? 0) + 1}…`, titolo: 'Il SAL successivo, ai prezzi di questa perizia', onclick: 'lvNuovoSal()', stile: 'accent' as const }] : []),
          ...(vigente(l)?.id === r.id && ultimoAv && ultimoAv.stato === 'bozza' && ultimoAv.tipo !== 'cre'
            ? [{ etichetta: `→ ${titoloAvanzamento(ultimoAv)}`, titolo: `Il ${titoloAvanzamento(ultimoAv)} è in bozza e misura già ai prezzi di questa perizia: si emette quello, poi si apre il successivo`, onclick: `lvApri('${ultimoAv.id}')`, stile: 'accent' as const }]
            : []),
          { etichetta: '↺ Riapri', titolo: 'Torna in bozza (se nessun SAL ne ha già usato i prezzi)', onclick: 'lvRiapri()', stile: 'ghost' as const },
        ])
    : r.tipo === 'contratto'
    ? (scrive
      // un contratto ancora «in definizione» (file di prima): si mette in vigore
      ? [{ etichetta: '✓ In vigore…', titolo: 'Il contratto entra in vigore: da qui si apre il SAL', onclick: 'lvConsegna()', stile: 'accent' as const }]
      : l.avanzamenti.length ? [] : [{ etichetta: '＋ SAL n. 1…', titolo: 'Apre il primo stato di avanzamento: si misura l\'eseguito nella stessa griglia', onclick: 'lvNuovoSal()', stile: 'accent' as const }])
    : scrive
      ? [{ etichetta: '✓ Consegna…', titolo: 'Chiude la revisione: da qui si legge e non si modifica più. Si può riaprire finché niente ci poggia sopra.', onclick: 'lvConsegna()', stile: 'accent' as const }]
      : [
          ...(r.tipo === 'computo' && !contratto(l) ? [{ etichetta: '→ Contratto…', titolo: 'Questo computo consegnato diventa contratto: si fissa il ribasso d\'asta', onclick: 'lvPromuovi()', stile: 'accent' as const }] : []),
          ...(r.tipo === 'computo' && !contratto(l) ? [{ etichetta: '＋ Nuova revisione…', titolo: 'Una revisione nuova, copiata da questa: ci si lavora sopra, questa resta com\'è', onclick: 'lvNuovaDaQuesta()', stile: 'ghost' as const }] : []),
          { etichetta: '↺ Riapri', titolo: 'Torna in lavorazione (se niente ci poggia sopra)', onclick: 'lvRiapri()', stile: 'ghost' as const },
        ]
  const barra = barraVoci({
    cerca: { valore: vista.q, onInput: 'lvCerca(this.value)', placeholder: perizia ? '⌕ cerca nella perizia' : r.tipo === 'contratto' ? '⌕ cerca nel contratto' : '⌕ cerca nel computo' },
    // in perizia la barra mostra variate/tutte al posto dell'ordine: la prima riga resta una
    ...(perizia ? {} : { ordine: { valore: vista.ordine, opzioni: OPZ_ORDINE, onclickTpl: "lvOrdine('%v')" } }),
    ...(perizia ? { mostra: { valore: vista.mostra === 'variate' ? 'variate' : 'tutte', opzioni: FASE_PERIZIA.mostra || [], onclickTpl: "lvMostra('%v')" } } : {}),
    espandi: { tutteAperte: !vista.soloVoci, onclick: 'lvEspandiTutte()' },
    aggiungi: [
      { etichetta: '≡ Prezzi', attiva: !!vista.prezziAperti, titolo: vista.prezziAperti ? "Chiudi la colonna dei prezzi a destra" : "Apri a destra i prezzi da cui pescare: elenco del progetto, prezzario, altro progetto", onclick: 'lvPzAlterna()' },
      ...(scrive ? [{ etichetta: '＋ Voce libera', titolo: 'Una voce nuova: codice, descrizione e prezzo si scrivono con ✎', onclick: 'lvVoceLibera()' }, { etichetta: '★ Dalla libreria', titolo: 'Una voce salvata nella libreria dello studio', onclick: "lvLibInserisci('voci')" }] : []),
    ],
    dati: scrive && (r.tipo === 'computo' || perizia) ? [{ etichetta: '⇩ XPWE', titolo: perizia ? 'Importa la perizia preparata con un altro programma (XPWE): i prezzi di contratto restano, gli articoli nuovi sono NP' : 'Importa un computo XPWE (da un altro programma) in questa revisione', onclick: 'lvImportaXpwe()', stile: 'ghost' }] : [],
    strumenti: perizia && scrive ? [
      { etichetta: '% Ribasso NP…', titolo: "Il ribasso d'asta su tutti i nuovi prezzi di questa perizia: come da contratto, soggetti o non soggetti", onclick: 'lvRibassoNp()', stile: 'ghost' },
    ] : offerta ? [
      { etichetta: '% Ribasso…', titolo: "Offerta a ribasso: il ribasso d'asta si deduce sul totale dei lavori di ogni SAL, mai sulla sicurezza", onclick: 'lvRibasso()', stile: 'ghost' },
      ...(r.contratto?.libero ? [{ etichetta: '€ Importo pattuito…', titolo: 'L\'importo pattuito col committente, se c\'è: il riferimento del lavoro', onclick: 'lvImportoPattuito()', stile: 'ghost' as const }] : []),
      ...(r.contratto?.prezziOfferti || r.contratto?.libero ? [] : [{ etichetta: '€ Prezzi unitari…', titolo: "Offerta a prezzi unitari: si scrive il prezzo offerto di ogni articolo, e il ribasso non si applica più", onclick: 'lvPrezziUnitari()', stile: 'ghost' as const }]),
    ] : [],
    extra,
    altro: { onclick: 'lvMenuAltro(event)', titolo: 'Tutte le azioni della revisione: elenco prezzi, struttura, quadro economico, varia i prezzi… (anche col tasto destro)' },
    aiuto: { onclick: 'lvAiuto()', titolo: 'Come si lavora in questa schermata' },
  })
  const ic = r.tipo === 'contratto' ? importiContratto(r) : null
  // la perizia si consegna a prezzi di progetto e NP, LORDI; il ribasso si scrive a parte
  const segno = (n: number): string => `${n >= 0 ? '+ ' : '− '}${eur(Math.abs(n))}`
  const piede = r.tipo === 'contratto' && r.contratto?.libero
    ? piedeHtml({
        sintesi: `Contratto a misura, senza computo · <b>${r.articoli.length}</b> articol${r.articoli.length === 1 ? 'o' : 'i'} in elenco${r.contratto.ribassoPct ? ` · ribasso ${fmt(r.contratto.ribassoPct, 4)}%` : ''}`,
        etichetta: r.contratto.importoPattuito ? 'Importo pattuito' : 'Importo',
        valore: r.contratto.importoPattuito ? eur(r.contratto.importoPattuito) : 'a misura',
        sotto: ['l\'elenco prezzi cresce dai SAL: si misura quello che si fa'],
      }, { id: 'lv-piede' })
    : cfr
    ? piedeHtml({
        sintesi: `<b>${cfr.variate}</b> voci variate su ${cfr.voci}`
          + `<span class="ehb-piede__muto"> · maggiori lavori ${eur(cfr.lordo.aumenti)} · minori ${eur(cfr.lordo.diminuzioni)}</span>`
          + `<div class="ehb-piede__muto">Contratto vigente ${eur(cfr.lordo.prima)} → con la perizia ${eur(cfr.lordo.dopo)}</div>`,
        etichetta: 'Differenza sul contratto vigente',
        valore: segno(cfr.lordo.differenza),
        sotto: [
          cfr.ribassoPct ? `al netto del ribasso ${fmt(cfr.ribassoPct, 4)}%: ${eur(cfr.prima)} → ${eur(cfr.dopo)} (${segno(cfr.differenza)})` : '',
          `sul contratto originario ${cfr.variazionePct == null ? '—' : `${cfr.variazionePct >= 0 ? '+' : '−'}${fmt(Math.abs(cfr.variazionePct))}%`}${cfr.oltreQuinto ? " — oltre il quinto d'obbligo" : ''}`,
        ],
        allarme: cfr.oltreQuinto,
      }, { id: 'lv-piede' })
    : ic
    ? piedeFaseHtml(FASE_CONTRATTO, {
        baseAsta: ic.baseAsta, contrattuale: ic.contrattuale, sicurezza: ic.sicurezza,
        ribasso: ic.ribassoPct != null ? `${fmt(ic.ribassoPct, 4)}%` : ic.ribassoRisultante != null ? `${fmt(ic.ribassoRisultante, 2)}% risultante dai prezzi offerti` : null,
      }, eur, { id: 'lv-piede' })
    : piedeFaseHtml(FASE_PROGETTO, {
        totale: imp.totale,
        sotto: [`lavori ${eur(imp.lavori)}${imp.sicurezza ? ` · sicurezza ${eur(imp.sicurezza)}` : ''}`],
      }, eur, { id: 'lv-piede' })
  return `<section class="lv-page${scrive ? '' : ' is-chiusa'}" oncontextmenu="lvMenuPagina(event)" data-stato="${r.stato}">
    ${testata}
    <div class="lv-body" id="lv-body">${barra}${grigliaRevisione(r, vista, cfr, offerta, contratto(l))}</div>
    ${piede}
  </section>`
}

/** Il lavoro appena aperto, senza revisioni: due strade, dette come sono. */
export function paginaVuota(l: Lavoro): string {
  return `<section class="lv-page lv-vuoto">
    <div class="lv-vuoto__box">
      <h1>${esc(l.dati.oggetto ? String(l.dati.oggetto) : 'Un lavoro nuovo')}</h1>
      <p>Il lavoro comincia da un computo, in una fase qualunque: PFTE, definitivo o esecutivo. Quando è pronto si <b>consegna</b> come revisione; da un computo consegnato nasce il contratto, e dal contratto la contabilità.</p>
      <p>Per un lavoro privato si può partire dalla <b>contabilità</b>, senza computo: si misura quello che si fa, e l'elenco prezzi cresce misurando.</p>
      <div class="lv-vuoto__az">
        <button class="ehb-btn ehb-btn--accent-soft" onclick="lvNuovoComputo()">＋ Nuovo computo…</button>
        <button class="ehb-btn" onclick="lvImportaXpwe()">⇩ Importa un computo XPWE…</button>
        <button class="ehb-btn" onclick="lvContabilitaLibera()">＋ Contabilità senza computo…</button>
        <button class="ehb-btn ehb-btn--ghost" onclick="lvContabilitaXpwe()">⇩ Contabilità da un file XPWE…</button>
        <button class="ehb-btn ehb-btn--ghost" onclick="lvApriDati()">Dati del lavoro…</button>
      </div>
    </div>
  </section>`
}

/* ── Il SAL: la stessa pagina, si scrive l'eseguito ─────────────────────── */

export function titoloAvanzamento(a: Avanzamento): string {
  return a.tipo === 'sal' ? `SAL n. ${a.n}` : a.tipo === 'salFinale' ? 'SAL finale' : 'Certificato di regolare esecuzione'
}

function rigaSal(a: Avanzamento, r: Revisione, v: Voce, ar: Articolo, vista: Vista, n: number, c: Revisione | null = null): RigaVoce {
  const scrive = a.stato === 'bozza' && a.tipo !== 'cre'
  const riga = rigaDi(a, v.id)
  const aperta = misureAVista(vista, v.id)
  const qtyContratto = quantitaVoce(v)
  const eseguito = quantitaEseguita(riga)
  const qSotto = v.corpo ? quotaDaSotto(v, riga) : null
  const quantita: Cella = v.corpo && qSotto != null
    ? { tipo: 'numero', testo: `${fmt(riga.quotaPct ?? qSotto)} %`, muto: false }
    : v.corpo
    ? (scrive
      ? { tipo: 'campo', percento: true, valore: riga.quotaPct != null ? String(riga.quotaPct).replace('.', ',') : '', segnaposto: '%', isola: true, comando: `lvSalQuota(${q(v.id)},this.value)`, titolo: 'Lavoro a corpo: quota eseguita a tutto il SAL, in %', id: `lv-q-${v.id}` }
      : { tipo: 'numero', testo: `${fmt(riga.quotaPct ?? 0)} %` })
    : riga.misure.length
      ? { tipo: 'misurata', valore: fmt(eseguito), um: ar.um, misure: riga.misure.length, id: `lv-q-${v.id}` }
      : scrive
        ? { tipo: 'campo', valore: numIn(riga.quantita), um: ar.um, segnaposto: '—', isola: true, comando: `lvSalQta(${q(v.id)},this.value)`, titolo: "Eseguito a tutto il SAL. Per il dettaglio scrivi le misure: «＋ misura»", id: `lv-q-${v.id}` }
        : { tipo: 'numero', testo: `${fmt(eseguito)} ${ar.um}`.trim(), muto: !eseguito }
  const prezzo = prezzoIn(r, ar)
  const importo = v.corpo ? importoQta(qtyContratto, prezzo, ar.um) * (riga.quotaPct ?? 0) / 100 : importoQta(eseguito, prezzo, ar.um)
  // la voce che supera il contratto si vede in blu
  const eccede = !v.corpo && eseguito > qtyContratto + 1e-9
  const meta = [
    `<span class="lv-chip" title="Quantità di contratto">contratto ${v.corpo ? 'a corpo' : `${fmt(qtyContratto)} ${esc(ar.um)}`}</span>`,
    ...(ar.sicurezza ? ['<span class="lv-chip is-sic">sicurezza</span>'] : []),
    ...chipRibasso(c, r, ar),
    ...(eccede ? [`<span class="lv-chip is-eccede" title="L'eseguito supera la quantità di contratto: si può contabilizzare, ma la quantità si ridetermina solo con una perizia">oltre il contratto +${fmt(eseguito - qtyContratto)} ${esc(ar.um)}</span>`] : []),
  ]
  // nel foglio (misure a vista) le voci a misura portano le loro righe e la riga SOMMANO
  const foglio = aperta && !v.corpo
  const testa: RigaVoce['celle'] = {
    codice: { tipo: 'codice', codice: ar.codice, tono: ar.origine === 'np' ? 'np' : undefined, ...(ar.origine === 'np' ? { etichetta: 'NP' } : {}) },
    designazione: { tipo: 'designazione', testo: ar.descrizione, meta },
  }
  const numeri: RigaVoce['celle'] = {
    quantita,
    prezzo: { tipo: 'numero', testo: v.corpo ? fmt(importoQta(qtyContratto, prezzo, ar.um)) : fmt(prezzo), muto: v.corpo },
    importo: { tipo: 'numero', testo: fmt(importo), id: `lv-i-${v.id}` },
  }
  return {
    classe: (eccede ? 'lv-voce is-eccede' : 'lv-voce') + (foglio ? ' is-foglio' : ''),
    attributi: `data-voce="${esc(v.id)}" oncontextmenu="lvMenuVoce(event,${q(v.id)})"`,
    sel: `<span class="lv-n">${n}</span>${v.corpo && !v.sottoComputo?.length ? '' : `<button class="lv-piega" onclick="lvToggleMisure(${q(v.id)})" title="${aperta ? 'Chiudi' : 'Apri'} ${v.corpo ? 'il sotto-computo' : 'le misure'}" aria-expanded="${aperta}">${aperta ? '▾' : '▸'}</button>`}`,
    celle: foglio ? testa : { ...testa, ...numeri },
    dopo: aperta && v.corpo && v.sottoComputo?.length ? rigaDettaglioHtml(FASE_SAL, {
      conSelezione: true, attributi: `data-voce="${esc(v.id)}"`,
      contenuto: `<div class="lv-sc"><div class="ehb-mis-titolo">Sotto-computo: eseguito a tutto il SAL di ogni lavorazione — quota ${fmt(qSotto ?? 0)} %</div>
        <table class="lv-ct-tab"><thead><tr><th>Lavorazione</th><th>Previsto</th><th>Eseguito</th><th>Importo eseguito</th></tr></thead><tbody>
        ${v.sottoComputo.map((x) => { const e = riga.sotto?.find((y) => y.voceId === x.id); const qe = e?.quantita ?? 0
          return `<tr><td>${esc(x.codice ? x.codice + ' ' : '')}${esc(x.descrizione)}</td><td class="lv-ct-n">${fmt(x.qty || 0)} ${esc(x.um || '')}</td><td>${scrive ? `<input value="${qe ? String(qe).replace('.', ',') : ''}" inputmode="decimal" style="width:90px" onchange="lvScEseg(${q(v.id)},${q(x.id)},this.value)">` : `${fmt(qe)}`}</td><td class="lv-ct-n">${eur(qe * (x.prezzo || 0))}</td></tr>` }).join('')}
        </tbody></table></div>`,
    }) : foglio ? righeFoglioHtml(FASE_SAL, {
      righe: riga.misure, um: ar.um, fmt: (x) => fmt(x), soloLettura: !scrive, conSelezione: true,
      attributi: `data-voce="${esc(v.id)}" oncontextmenu="lvMenuVoce(event,${q(v.id)})"`,
      etichetta: `A TUTTO IL SAL${ar.um ? ' ' + ar.um : ''}`,
      azioni: azioniMisure(v.id),
      sommano: { ...numeri, quantita: riga.misure.length ? { tipo: 'numero', testo: fmt(eseguito), id: `lv-q-${v.id}` } : quantita },
    }) : '',
  }
}

export function paginaAvanzamento(l: Lavoro, a: Avanzamento, vista: Vista): string {
  const cre = a.tipo === 'cre'
  // contabilità senza computo: l'elenco prezzi cresce dal SAL
  const libero = !!contratto(l)?.contratto?.libero
  // il CRE certifica lo stato finale: le misure si leggono, non si scrivono
  const scrive = a.stato === 'bozza' && !cre
  const r = revisione(l, a.leggeDa)
  const art = new Map(r.articoli.map((x) => [x.id, x]))
  const mostra = vista.mostra === 'tutte' ? 'tutte' : vista.mostra === 'eccedenti' ? 'eccedenti' : 'misurate'
  const eccedenti = vociEccedenti(l, a)
  const s = vista.q.trim().toLowerCase()
  const tutte = r.voci.map((v, i) => ({ v, ar: art.get(v.articolo)!, n: i + 1 })).filter((x) => x.ar)
  const vis = tutte
    .filter((x) => mostra === 'tutte' || (mostra === 'eccedenti' ? eccedenti.some((e) => e.voce === x.v.id) : misurata(rigaDi(a, x.v.id))) || (vista.soloVoci && vista.aperte.has(x.v.id)))
    .filter((x) => !s || `${x.ar.codice} ${x.ar.descrizione} ${x.v.categoria || ''}`.toLowerCase().includes(s))
  const imp = importiAvanzamento(l, a.id)
  const ultimo = !l.avanzamenti.some((x) => x.ordine > a.ordine)
  const titolo = titoloAvanzamento(a)
  const bozza = a.stato === 'bozza'
  const testata = testataHtml({
    titolo, revisione: sigla(numeroDi(l, a.id)),
    sottotitolo: `${a.data} · prezzi di ${r.tipo === 'contratto' ? 'contratto' : 'perizia'} ${sigla(r.numero)}`,
    pastiglie: [
      { testo: 'contabilità', tono: 'fase' },
      { testo: bozza ? 'in bozza' : cre ? 'approvato' : 'emesso', ...(bozza ? { tono: 'bozza' as const } : {}) },
      ...(scrive ? [] : [{ testo: '🔒 sola lettura' }]),
    ],
    stampa: { onclick: 'lvStampa()', titolo: cre ? 'Le stampe del CRE: certificato, relazione sul conto finale' : a.tipo === 'salFinale' ? 'Le stampe dello stato finale: libretto, registro, stato finale, conto finale' : 'Le stampe di questo SAL: libretto, registro, SAL, certificato' },
  })
  const extra = bozza
    ? [cre
        ? { etichetta: '✓ Approva…', titolo: 'Il certificato di regolare esecuzione si approva: il lavoro è chiuso', onclick: 'lvEmetti()', stile: 'accent' as const }
        : { etichetta: '✓ Emetti…', titolo: a.tipo === 'salFinale' ? 'Lo stato finale si emette: dopo viene il CRE' : 'Il SAL si emette: da qui è in sola lettura, e si può aprire il successivo', onclick: 'lvEmetti()', stile: 'accent' as const }]
    : [
        ...(ultimo && a.tipo === 'sal' && !l.revisioni.some((x) => x.tipo === 'perizia' && x.stato === 'aperta' && x.ordine < a.ordine)
          ? [{ etichetta: `＋ SAL n. ${a.n + 1}…`, titolo: 'Il SAL successivo: riparte dalle misure di questo', onclick: 'lvNuovoSal()', stile: 'accent' as const },
             { etichetta: '⚑ SAL finale…', titolo: "Lo stato finale dei lavori: l'ultimo avanzamento, riparte dalle misure di questo", onclick: 'lvSalFinale()', stile: 'ghost' as const }]
          : []),
        ...(ultimo && a.tipo === 'salFinale' ? [{ etichetta: '＋ CRE…', titolo: 'Il certificato di regolare esecuzione, sullo stato finale', onclick: 'lvCre()', stile: 'accent' as const }] : []),
        ...(ultimo ? [{ etichetta: '↺ Riapri', titolo: 'Torna in bozza (è l\'ultimo: niente dopo parte dalle sue quantità)', onclick: 'lvRiapri()', stile: 'ghost' as const }] : []),
      ]
  const barra = barraVoci({
    cerca: { valore: vista.q, onInput: 'lvCerca(this.value)', placeholder: cre ? '⌕ cerca nello stato finale' : '⌕ cerca nel SAL' },
    strumenti: scrive && a.tipo !== 'cre' ? [{ etichetta: '✎ Dati del SAL…', titolo: 'Detrazioni (lavorazioni non conformi o in contestazione) e note', onclick: 'lvDatiSal()', stile: 'ghost' }]
      : cre && a.stato === 'bozza' ? [{ etichetta: '✎ Relazione…', titolo: 'Il testo della relazione sul conto finale', onclick: 'lvDatiSal()', stile: 'ghost' }] : [],
    mostra: { valore: mostra, opzioni: [...(FASE_SAL.mostra || []), ...(eccedenti.length ? [{ valore: 'eccedenti', etichetta: `Oltre il contratto (${eccedenti.length})`, titolo: 'Le voci il cui eseguito supera la quantità di contratto: si rideterminano solo con una perizia' }] : [])], onclickTpl: "lvMostra('%v')" },
    dati: scrive && a.tipo === 'sal'
      ? [{ etichetta: '⇩ XPWE', titolo: 'Importa le misure datate di una contabilità XPWE: le date vicine fanno un SAL, le misure si abbinano alle voci del contratto', onclick: 'lvImportaXpweSal()', stile: 'ghost' }]
      : a.tipo === 'salFinale' && scrive
        ? [{ etichetta: '⇩ XPWE', titolo: 'Una contabilità XPWE: confronta i totali con lo stato finale, o ne prende le misure', onclick: 'lvConfrontaXpwe()', stile: 'ghost' }]
        : !cre ? [{ etichetta: '⇄ XPWE', titolo: 'Confronta le misure di questo avanzamento con una contabilità XPWE: voce per voce e nei totali, senza cambiare niente', onclick: 'lvConfrontaXpwe()', stile: 'ghost' }] : [],
    espandi: { tutteAperte: !vista.soloVoci, onclick: 'lvEspandiTutte()' },
    aggiungi: [
      { etichetta: '≡ Prezzi', attiva: !!vista.prezziAperti, titolo: cre ? "L'elenco prezzi vigente, a destra" : libero ? 'I prezzi a destra: contratto, prezzario, altro progetto — «＋» misura la voce nel SAL' : "L'elenco prezzi di contratto, a destra: «＋» porta la voce nel libretto", onclick: 'lvPzAlterna()' },
      ...(libero && scrive ? [{ etichetta: '＋ Voce libera', titolo: 'Un articolo nuovo: entra nel contratto e si misura in questo SAL', onclick: 'lvVoceLibera()' }] : []),
    ],
    extra,
    altro: { onclick: 'lvMenuAltro(event)', titolo: 'Tutte le azioni di questo avanzamento: stampe, dati, confronto XPWE, riapri… (anche col tasto destro)' },
    aiuto: { onclick: 'lvAiuto()', titolo: 'Come si lavora in questa schermata' },
  })
  const righe: RigaGriglia[] = vis.map((x) => rigaSal(a, r, x.v, x.ar, vista, x.n, contratto(l)))
  const griglia = grigliaHtml({
    fase: FASE_SAL, righe, selezione: {}, idCorpo: 'lv-corpo',
    vuoto: s ? 'Nessuna voce corrisponde alla ricerca.'
      : libero && !r.voci.length ? 'Contabilità senza computo: si misura quello che si fa. «＋» dal prezzario o da un altro progetto a destra, o «＋ Voce libera»: l\'articolo entra nel contratto.'
      : mostra === 'misurate' ? 'Ancora nessuna voce misurata in questo SAL: «Tutto il contratto» in MOSTRA, oppure «＋» dall\'elenco prezzi a destra.' : 'Il contratto non ha voci.',
  })
  const cf = a.tipo === 'sal' ? null : contoFinale(l)
  const rib = imp.ribassoPct ? `, ribasso ${fmt(imp.ribassoPct, 4)}%` : ''
  const piede = cf && cre
    ? piedeHtml({
        sintesi: `Conto finale <b>${eur(cf.netto)}</b><span class="ehb-piede__muto"> · lordo ${eur(cf.lordo)}${rib} · già nei SAL ${eur(cf.neiSal)}</span>`,
        etichetta: "Credito residuo dell'impresa",
        valore: eur(cf.credito),
        sotto: [`di cui sicurezza a tutto lo stato finale ${eur(cf.sicurezza)}`],
      }, { id: 'lv-piede' })
    : cf
    ? piedeHtml({
        sintesi: `<b>${imp.misurate}</b> voci misurate su ${imp.voci}${vis.length !== imp.voci ? ` · ${vis.length} mostrate` : ''}<span class="ehb-piede__muto"> · già nei SAL ${eur(cf.neiSal)}</span>`,
        etichetta: 'Stato finale dei lavori',
        valore: eur(cf.lordo),
        sotto: [`di cui sicurezza ${eur(cf.sicurezza)} · netto ${eur(cf.netto)}${rib} · credito residuo ${eur(cf.credito)}`],
      }, { id: 'lv-piede' })
    // importi LORDI, ai prezzi di contratto; il netto del ribasso a parte
    : piedeHtml({
        sintesi: `<b>${imp.misurate}</b> voci misurate su ${imp.voci}${vis.length !== imp.voci ? ` · ${vis.length} mostrate` : ''}`
          + (eccedenti.length ? ` · <span class="lv-eccede">${eccedenti.length} oltre il contratto</span>` : '')
          + (imp.economia ? `<span class="ehb-piede__muto"> · in economia ${eur(imp.economia)}</span>` : '')
          + (imp.detrazioni ? `<span class="ehb-piede__muto"> · detrazioni − ${eur(imp.detrazioni)}</span>` : '')
          + (a.n > 1 ? `<span class="ehb-piede__muto"> · in questo SAL ${eur(imp.questoLordo)}</span>` : ''),
        etichetta: `Totale contabilizzato a tutto il SAL n. ${a.n}`,
        valore: eur(imp.lordo),
        sotto: [
          `di cui sicurezza ${eur(imp.sicurezza)}`,
          imp.ribassoPct
            ? `al netto del ribasso ${fmt(imp.ribassoPct, 4)}%: ${eur(imp.netto)} · in questo SAL ${eur(imp.questo)}`
            : (a.n > 1 ? `in questo SAL ${eur(imp.questo)}` : ''),
        ],
      }, { id: 'lv-piede' })
  return `<section class="lv-page${scrive ? '' : ' is-chiusa'}" oncontextmenu="lvMenuPagina(event)" data-stato="${a.stato}">
    ${testata}
    <div class="lv-body" id="lv-body">${barra}${griglia}</div>
    ${piede}
  </section>`
}

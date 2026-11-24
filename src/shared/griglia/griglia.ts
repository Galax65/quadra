/**
 * LA GRIGLIA DELLE VOCI — una sola tabella per computo, libretto e perizia.
 *
 * Il descrittore di fase (fase.ts) decide le colonne, il loro ordine, quale si
 * scrive e quale si confronta; la griglia le dispone sempre allo stesso modo.
 * Lo strumento riempie le celle (i suoi campi, i suoi chip, i suoi comandi) e
 * non tocca la struttura: così le due schermate non possono più divergere
 * nell'ordine delle colonne, nelle intestazioni, nei titoli di gruppo o nella
 * riga di dettaglio delle misure.
 *
 * Il modulo è PURO (niente DOM, niente stato): riceve righe e restituisce HTML,
 * come la tabella delle misure (shared/compositore/misure-tabella.ts) che la
 * griglia ospita nella riga di dettaglio.
 *
 * Convenzioni di aggancio:
 *  - `table.ehb-gr[data-fase]`         la griglia, con la fase che la governa
 *  - `td.ehb-gr-c--<colonna>`          ogni cella, per colonna
 *  - `td.ehb-gr-c--scrive`             la colonna che in questa fase si scrive
 *  - `td.ehb-gr-c--confronto`          la colonna con cui si confronta
 *  - `tr.ehb-gr-gruppo` / `-sezione` / `-totale` / `-dett`   righe di servizio
 */
import { COLONNE_MISURA, COLONNE_NUMERICHE, type IdColonna, type StrutturaFase } from './fase'
import { campoMisuraHtml, TASTI_MISURE, type AzioniMisure } from '../compositore/misure-tabella'
import { sommaMisurazioni, type MisurazioneRiga } from '../compositore/misurazioni'
import { cellaVoceHtml, classiCella, type CellaVoce } from './celle'

const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

/**
 * Una cella: DESCRITTA (celle.ts — codice, designazione, campo, misurata,
 * numero, comandi), che è la forma normale; oppure HTML già pronto, per i
 * contenuti che la griglia non conosce ancora.
 */
export type Cella = CellaVoce | string | { html: string; id?: string; attributi?: string; titolo?: string }

export interface RigaVoce {
  tipo?: 'voce'
  celle: Partial<Record<IdColonna, Cella>>
  /** Classi in più sul <tr> (selezione, storno…). */
  classe?: string
  /** Voce piegata su una riga: designazione troncata, dati nascosti. */
  compatta?: boolean
  /** Attributi in più sul <tr> (data-key, gestori di eventi…): HTML già pronto. */
  attributi?: string
  /** Contenuto della cella di selezione (casella, apri/chiudi misure). */
  sel?: string
  /** Righe che seguono la voce (dettaglio delle misure, sotto-computo): HTML già pronto. */
  dopo?: string
}

export interface RigaGruppo {
  tipo: 'gruppo'
  titolo: string
  /** 0 = Supercategoria, 1 = Categoria, 2 = Subcategoria. */
  livello?: number
  /** Coda in tono minore (es. «· 4 voci»). */
  nota?: string
  /** HTML prima del titolo (maniglia di trascinamento). */
  prima?: string
  classe?: string
  attributi?: string
}

export interface RigaSezione {
  tipo: 'sezione'
  titolo: string
  /** Lavori a corpo o oneri della sicurezza: le sezioni che vanno in fondo. */
  tono?: 'corpo' | 'sicurezza'
  classe?: string
}

export interface RigaTotale {
  tipo: 'totale'
  titolo: string
  /** Il valore, sotto la colonna dell'importo (o della differenza). */
  valore: string
}

/** Una riga già composta (per i casi che la griglia non conosce ancora). */
export interface RigaLibera { tipo: 'html'; html: string }

export type RigaGriglia = RigaVoce | RigaGruppo | RigaSezione | RigaTotale | RigaLibera

export interface OpzioniGriglia {
  fase: StrutturaFase
  righe: RigaGriglia[]
  /** Colonna di selezione in testa; `tutte` = onchange della casella «tutte». */
  selezione?: { tutte?: string }
  /** Messaggio quando non c'è nessuna riga. */
  vuoto?: string
  /** id del <tbody> (per gli aggiornamenti mirati del tool). */
  idCorpo?: string
  /** Classi in più sulla tabella. */
  classe?: string
}

type Fase = StrutturaFase

/** Quante colonne ha la griglia di una fase (serve alle righe che le occupano tutte). */
export function colonneGriglia(fase: Fase, conSelezione = false): number {
  return fase.colonne.length + (conSelezione ? 1 : 0)
}

function cellaHtml(fase: Fase, id: IdColonna, c: Cella | undefined): string {
  if (c && typeof c === 'object' && 'tipo' in c) return cellaVoceHtml(fase, id, c)
  const o = typeof c === 'string' || c == null ? { html: c ?? '' } : c
  return `<td class="${classiCella(fase, id)}"${o.id ? ` id="${esc(o.id)}"` : ''}${o.titolo ? ` title="${esc(o.titolo)}"` : ''}${o.attributi ? ' ' + o.attributi : ''}>${o.html}</td>`
}

/** La riga di una voce: le celle nell'ordine della fase, quelle mancanti vuote. */
export function rigaVoceHtml(fase: Fase, r: RigaVoce, conSelezione = false): string {
  const sel = conSelezione ? `<td class="ehb-gr-c ehb-gr-c--sel">${r.sel || ''}</td>` : ''
  return `<tr class="ehb-gr-voce${r.compatta ? ' is-compatta' : ''}${r.classe ? ' ' + r.classe : ''}"${r.attributi ? ' ' + r.attributi : ''}>${sel}${fase.colonne.map((c) => cellaHtml(fase, c.id, r.celle[c.id])).join('')}</tr>${r.dopo || ''}`
}

/** Titolo di un gruppo (categoria, WBS, capitolo): occupa tutta la riga. */
export function rigaGruppoHtml(fase: Fase, g: Omit<RigaGruppo, 'tipo'>, conSelezione = false): string {
  const lv = g.livello ?? 0
  return `<tr class="ehb-gr-gruppo ehb-gr-gruppo--lv${lv}${g.classe ? ' ' + g.classe : ''}"${g.attributi ? ' ' + g.attributi : ''}><td colspan="${colonneGriglia(fase, conSelezione)}">${g.prima || ''}${esc(g.titolo)}${g.nota ? `<span class="ehb-gr-nota">${esc(g.nota)}</span>` : ''}</td></tr>`
}

/** Sezione a sé (lavori a corpo, oneri della sicurezza): in fondo, come in stampa. */
export function rigaSezioneHtml(fase: Fase, s: Omit<RigaSezione, 'tipo'>, conSelezione = false): string {
  return `<tr class="ehb-gr-sezione${s.tono ? ' ehb-gr-sezione--' + s.tono : ''}${s.classe ? ' ' + s.classe : ''}"><td colspan="${colonneGriglia(fase, conSelezione)}">${esc(s.titolo)}</td></tr>`
}

/** Totale di un gruppo, allineato sotto la colonna dell'importo (o della differenza). */
export function rigaTotaleHtml(fase: Fase, t: Omit<RigaTotale, 'tipo'>, conSelezione = false): string {
  const ids = fase.colonne.map((c) => c.id)
  let i = ids.indexOf('importo')
  if (i < 0) i = ids.indexOf('differenza')
  if (i < 0) i = ids.length - 1
  const prima = i + (conSelezione ? 1 : 0)
  const dopo = ids.length - i - 1
  return `<tr class="ehb-gr-totale"><td colspan="${prima}" class="ehb-gr-num">${esc(t.titolo)}</td><td class="ehb-gr-c ehb-gr-num">${esc(t.valore)}</td>${dopo ? `<td colspan="${dopo}"></td>` : ''}</tr>`
}

/* ── Il foglio: le misure nella griglia, come nei programmi di computo ──── */

/**
 * Le misure di una voce DENTRO la griglia, una riga ciascuna, nelle stesse
 * colonne della voce: la descrizione sotto la designazione, par.ug. × lung. ×
 * larg. × H/peso nelle loro colonne, la quantità parziale sotto la quantità.
 * Sotto, la riga SOMMANO porta il totale, il prezzo e l'importo. È il foglio
 * di computo dei programmi di contabilità (PriMus): si scrive come in una
 * tabella di calcolo, senza aprire finestre o pannelli.
 */
export interface OpzioniFoglio {
  righe: MisurazioneRiga[]
  um?: string
  fmt: (n: number) => string
  soloLettura?: boolean
  azioni: AzioniMisure
  /** Etichetta del richiamo «vedi voce» di una riga. */
  etichettaVediVoce?: (chiave: string) => string
  /** Attributi su ogni <tr> (data-voce…), per ritrovare le righe della voce. */
  attributi?: string
  conSelezione?: boolean
  /** Le celle della riga SOMMANO: quantità, prezzo, importo (o confronto/differenza). */
  sommano: Partial<Record<IdColonna, Cella>>
  /** Etichetta della riga SOMMANO (default «SOMMANO <um>»). */
  etichetta?: string
  /** Comandi in più, a sinistra nella riga SOMMANO (HTML già pronto). */
  comandi?: string
}

function rigaMisuraFoglio(f: Fase, o: OpzioniFoglio, i: number): string {
  const m = o.righe[i]
  const a = o.azioni
  const neg = (m.quantita || 0) < 0
  const tr = a.trascina
  const cella = (id: IdColonna): string => {
    const c = classiCella(f, id) + ' ehb-gr-mis-c'
    if (id === 'designazione') {
      const vv = m.vediVoce && o.etichettaVediVoce ? `<span class="ehb-mis-vv" title="La quantità di quella voce entra come Lung.">↪ ${esc(o.etichettaVediVoce(m.vediVoce))}</span>` : ''
      // i comandi della riga stanno sulla designazione, e compaiono passandoci sopra
      // fuori dal giro del Tab: col Tab si passa di cella in cella, come in un foglio
      const cmd = o.soloLettura ? '' : `<span class="ehb-gr-mis-cmd">${a.vediVoce ? `<button class="ehb-icon-btn" tabindex="-1" onclick="${esc(a.vediVoce(i))}" title="Vedi voce: la quantità di un'altra voce entra come lunghezza">↪</button>` : ''}<button class="ehb-icon-btn" tabindex="-1" onclick="${esc(a.duplica(i))}" title="Duplica la riga (Ctrl+D)">⧉</button><button class="ehb-icon-btn is-pericolo" tabindex="-1" onclick="${esc(a.elimina(i))}" title="Elimina la riga (Ctrl+Canc)">✕</button></span>`
      return `<td class="${c}">${vv}${campoMisuraHtml(o, i, 'descrizione')}${cmd}</td>`
    }
    const mis = COLONNE_MISURA.find((x) => x.id === id)
    if (mis) return `<td class="${c}">${campoMisuraHtml(o, i, mis.campo)}</td>`
    if (id === 'quantita') return `<td class="${c} ehb-gr-mis-qt" data-mis-qt>${esc(o.fmt(m.quantita || 0))}</td>`
    return `<td class="${c}"></td>`
  }
  const sel = o.conSelezione
    ? `<td class="ehb-gr-c ehb-gr-c--sel ehb-gr-mis-c">${tr && !o.soloLettura ? `<span class="ehb-gr-mis-drag" draggable="true" ondragstart="${esc(tr.inizio(i))}" ondragend="${esc(tr.fine)}" title="Trascina la riga">⠿</span>` : ''}</td>`
    : ''
  return `<tr class="ehb-gr-mis${neg ? ' is-neg' : ''}"${o.attributi ? ' ' + o.attributi : ''}${a.menu && !o.soloLettura ? ` oncontextmenu="${esc(a.menu(i))}"` : ''}${tr ? ` ondragover="${esc(tr.sopra)}" ondragleave="${esc(tr.esce)}" ondrop="${esc(tr.rilascia(i))}"` : ''}>${sel}${f.colonne.map((c) => cella(c.id)).join('')}</tr>`
}

/** Le righe di misura e la riga SOMMANO di una voce: HTML di <tr> da mettere dopo la voce. */
export function righeFoglioHtml(f: Fase, o: OpzioniFoglio): string {
  const righe = o.righe.map((_, i) => rigaMisuraFoglio(f, o, i)).join('')
  const ids = f.colonne.map((c) => c.id)
  const iDes = ids.indexOf('designazione')
  // la designazione si allarga sulle colonne delle misure: lì stanno i comandi e «SOMMANO»
  let span = 1
  while (iDes + span < ids.length && COLONNE_MISURA.some((x) => x.id === ids[iDes + span])) span++
  const a = o.azioni
  const tot = sommaMisurazioni(o.righe)
  const comandi = o.soloLettura ? '' : `<span class="ehb-gr-som-az">
      <button class="ehb-gr-som-b" onclick="${esc(a.aggiungi)}" title="Una riga di misura in fondo (Invio sull'ultima riga fa lo stesso)">＋ misura</button>
      ${a.detrazione ? `<button class="ehb-gr-som-b is-neg" onclick="${esc(a.detrazione)}" title="Una riga in detrazione (parti uguali negative)">− detrazione</button>` : ''}
      ${o.comandi || ''}
      <span class="ehb-gr-som-tasti" tabindex="-1" title="${esc(TASTI_MISURE)}">⌨</span>
    </span>`
  const etichetta = o.etichetta ?? `SOMMANO${o.um ? ' ' + o.um : ''}`
  const celle = ids.map((id, k) => {
    if (k === iDes) return `<td class="${classiCella(f, id)} ehb-gr-som-des" colspan="${span}">${comandi}<span class="ehb-gr-som-lab">${esc(etichetta)}${o.righe.length > 1 ? `<span class="ehb-gr-som-n"> · ${o.righe.length} righe</span>` : ''}</span></td>`
    if (k > iDes && k < iDes + span) return ''
    const c = o.sommano[id]
    if (id === 'quantita' && c === undefined) return `<td class="${classiCella(f, id)}" data-mis-tot>${esc(o.fmt(tot))}</td>`
    return cellaHtml(f, id, c)
  }).join('')
  const sel = o.conSelezione ? '<td class="ehb-gr-c ehb-gr-c--sel"></td>' : ''
  return `${righe}<tr class="ehb-gr-sommano"${o.attributi ? ' ' + o.attributi : ''}>${sel}${celle}</tr>`
}

/**
 * La riga di dettaglio sotto una voce: a tutta larghezza, ospita la tabella
 * delle misure o il sotto-computo. Il tool sceglie il contenuto, non la forma.
 */
export function rigaDettaglioHtml(fase: Fase, o: { contenuto: string; classe?: string; attributi?: string; conSelezione?: boolean }): string {
  return `<tr class="ehb-gr-dett${o.classe ? ' ' + o.classe : ''}"${o.attributi ? ' ' + o.attributi : ''}><td colspan="${colonneGriglia(fase, o.conSelezione)}">${o.contenuto}</td></tr>`
}

function rigaHtml(o: OpzioniGriglia, r: RigaGriglia): string {
  const s = !!o.selezione
  switch (r.tipo) {
    case 'gruppo': return rigaGruppoHtml(o.fase, r, s)
    case 'sezione': return rigaSezioneHtml(o.fase, r, s)
    case 'totale': return rigaTotaleHtml(o.fase, r, s)
    case 'html': return r.html
    default: return rigaVoceHtml(o.fase, r, s)
  }
}

/** La griglia intera: intestazione dalla fase, righe dal tool. */
export function grigliaHtml(o: OpzioniGriglia): string {
  const f = o.fase
  const s = !!o.selezione
  const th = (id: IdColonna, titolo: string, aiuto?: string): string =>
    `<th class="ehb-gr-h ehb-gr-h--${id}${COLONNE_NUMERICHE.has(id) ? ' ehb-gr-num' : ''}${f.scrive === id ? ' ehb-gr-h--scrive' : ''}"${aiuto ? ` title="${esc(aiuto)}"` : ''}>${esc(titolo)}</th>`
  const testa = (s ? `<th class="ehb-gr-h ehb-gr-h--sel">${o.selezione?.tutte ? `<input type="checkbox" class="ehb-gr-selbox" onchange="${esc(o.selezione.tutte)}" title="Seleziona tutte le voci a schermo">` : ''}</th>` : '')
    + f.colonne.map((c) => th(c.id, c.titolo, c.aiuto)).join('')
  const corpo = o.righe.length
    ? o.righe.map((r) => rigaHtml(o, r)).join('')
    : `<tr class="ehb-gr-vuoto"><td colspan="${colonneGriglia(f, s)}">${esc(o.vuoto || 'Nessuna voce.')}</td></tr>`
  return `<table class="ehb-gr${o.classe ? ' ' + o.classe : ''}" data-fase="${esc(f.fase)}"><thead><tr>${testa}</tr></thead><tbody${o.idCorpo ? ` id="${esc(o.idCorpo)}"` : ''}>${corpo}</tbody></table>`
}

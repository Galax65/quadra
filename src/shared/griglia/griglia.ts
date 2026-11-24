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
import { COLONNE_NUMERICHE, type IdColonna, type StrutturaFase } from './fase'
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

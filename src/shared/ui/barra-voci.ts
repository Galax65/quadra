/*
  La barra delle voci: UNA sola, per tutte le schermate che sono un computo —
  il computo di progetto, il libretto delle misure di un SAL, la perizia di
  variante. Stessi comandi, stesso ordine, stessa posizione: chi impara una
  schermata le sa tutte.

  L'ordine degli slot è fisso e non va cambiato per convenienza di una pagina:
    ⌕ cerca · VISTA · ORDINA · MOSTRA · espandi/collassa | + voce dal prezzario
    · + voce libera · + nuovo prezzo | ⇩ importa XPWE · ⇧ esporta XPWE
    | ⧗ revisioni · ☰ struttura · ⎙ stampe | campi della pagina | azioni di fase | ?
  Uno slot che su una pagina non ha senso resta vuoto: gli altri non si spostano.
*/

export interface AzioneBarra {
  etichetta: string
  titolo: string
  /** JS inline, come nel resto dei tool (le pagine sono self-contained). */
  onclick: string
  stile?: 'normale' | 'ghost' | 'accent'
  disabilitata?: boolean
  /** Un interruttore acceso (es. la colonna dei prezzi aperta): aria-pressed. */
  attiva?: boolean
}

export interface OpzioneOrdine { valore: string; etichetta: string; titolo: string }

export interface BarraVociOpts {
  /** ⌕ ricerca testuale sulle voci della pagina. */
  cerca?: { valore: string; onInput: string; placeholder?: string }
  /** VISTA: tabella / elenco / capitoli. */
  viste?: { valore: string; opzioni: OpzioneOrdine[]; onclickTpl: string }
  /** ORDINA: manuale / categorie / WBS, o quello che la pagina offre. */
  ordine?: { valore: string; opzioni: OpzioneOrdine[]; onclickTpl: string }
  /** MOSTRA: che sottoinsieme di voci tenere a schermo (misurate / variate / tutte). */
  mostra?: { valore: string; opzioni: OpzioneOrdine[]; onclickTpl: string }
  /** ⊞ / ⊟ apri o chiudi tutte le misure. */
  espandi?: { tutteAperte: boolean; onclick: string }
  /** Come si aggiunge una voce: prezzario, voce libera, nuovo prezzo. */
  aggiungi?: AzioneBarra[]
  /** Scambio dati: importa / esporta XPWE. Stessa posizione ovunque. */
  dati?: AzioneBarra[]
  /** Strumenti del lavoro: revisioni, struttura, stampe. Stessa posizione ovunque. */
  strumenti?: AzioneBarra[]
  /** Campi propri della pagina (data del libretto, ecc.): HTML già pronto. */
  campi?: string
  /** Azioni proprie della pagina, dopo gli slot comuni. */
  extra?: AzioneBarra[]
  /** ⋯ Altro: tutte le azioni della pagina (le stesse del tasto destro), in un menu. */
  altro?: { onclick: string; titolo?: string }
  /** ? aiuto contestuale. */
  aiuto?: { onclick: string; titolo?: string }
}

const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))

/**
 * L'etichetta divisa in segno e parole («⇩ XPWE» → «⇩» + «XPWE»): quando la
 * barra è stretta (un portatile con albero e colonna dei prezzi aperti) i
 * comandi di servizio mostrano solo il segno, e il nome resta nel title.
 */
function etichettaHtml(t: string): string {
  const m = /^(\S{1,2})\s+(.+)$/u.exec(t)
  return m && !/[A-Za-zÀ-ÿ0-9]/.test(m[1]) ? `<span class="ehb-barra__i">${esc(m[1])}</span><span class="ehb-barra__t"> ${esc(m[2])}</span>` : esc(t)
}
function btn(a: AzioneBarra): string {
  const cls = a.stile === 'accent' ? ' ehb-btn--accent-soft' : a.stile === 'ghost' ? ' ehb-btn--ghost' : ''
  return `<button class="ehb-btn ehb-btn--sm${cls}" onclick="${esc(a.onclick)}" title="${esc(a.titolo || a.etichetta)}" aria-label="${esc(a.etichetta)}"${a.attiva != null ? ` aria-pressed="${a.attiva}"` : ''}${a.disabilitata ? ' disabled' : ''}>${etichettaHtml(a.etichetta)}</button>`
}

/** La barra, identica su computo, libretto e perizia. */
export function barraVoci(o: BarraVociOpts): string {
  const cerca = o.cerca
    ? `<input type="search" class="ehb-barra__q" value="${esc(o.cerca.valore)}" placeholder="${esc(o.cerca.placeholder || '⌕ cerca')}" oninput="${esc(o.cerca.onInput)}" autocomplete="off">`
    : ''
  const seg = (lab: string, g: { valore: string; opzioni: OpzioneOrdine[]; onclickTpl: string } | undefined): string =>
    g && g.opzioni.length
      ? `<span class="ehb-seg"><span class="ehb-seg__lab">${esc(lab)}</span>${g.opzioni.map((x) =>
          `<button class="ehb-seg__b${g.valore === x.valore ? ' is-on' : ''}" onclick="${esc(g.onclickTpl.replace('%v', x.valore))}" title="${esc(x.titolo)}">${esc(x.etichetta)}</button>`).join('')}</span>`
      : ''
  const viste = seg('VISTA', o.viste)
  const ordine = seg('ORDINA', o.ordine)
  const mostra = seg('MOSTRA', o.mostra)
  const espandi = o.espandi
    ? btn({ etichetta: o.espandi.tutteAperte ? '☰ Solo voci' : '▤ Con le misure', titolo: o.espandi.tutteAperte ? 'Nasconde le misure: una riga per voce' : 'Mostra le misure di tutte le voci, come nel foglio di computo', onclick: o.espandi.onclick, stile: 'ghost' })
    : ''
  const grp = (a: AzioneBarra[] | undefined, nome = ''): string => (a && a.length ? `<span class="ehb-barra__g${nome ? ' ehb-barra__g--' + nome : ''}">${a.map(btn).join('')}</span>` : '')
  const altro = o.altro ? btn({ etichetta: '⋯ Altro', titolo: o.altro.titolo || 'Tutte le azioni di questa pagina (anche col tasto destro)', onclick: o.altro.onclick, stile: 'ghost' }) : ''
  const aiuto = o.aiuto ? btn({ etichetta: '?', titolo: o.aiuto.titolo || 'Come funziona questa schermata', onclick: o.aiuto.onclick, stile: 'ghost' }) : ''
  /* Due righe, sempre le stesse: sopra come si guarda (cerca, vista, ordine,
     mostra), sotto che cosa si fa. I comandi stanno su UNA riga sola, che non va
     mai a capo: quando lo spazio manca si compattano (vedi components.css). */
  return `<div class="ehb-barra"><div class="ehb-barra__r1">${cerca}${viste}${ordine}${mostra}${espandi}</div>`
    + `<div class="ehb-barra__r2">${grp(o.aggiungi, 'aggiungi')}${grp(o.dati, 'dati')}${grp(o.strumenti, 'strumenti')}${o.campi || ''}${grp(o.extra, 'extra')}${altro}${aiuto}</div></div>`
}

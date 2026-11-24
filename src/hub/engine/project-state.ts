/**
 * PROGETTO E.HUB A ISTANZA UNICA. PURO, NESSUN DOM.
 *
 * L'hub possiede UN solo «progetto corrente»: identità (`id`/`name`) + lo stato di progetto
 * DERIVATO/condiviso di ogni tool, come MAPPA GENERICA per `appId` (niente più campi hard-coded
 * `phiProject`/`pricelistComputo`/`tauComputo`; inclusi `pi`/`lambda` e qualsiasi tool del
 * registry). Questo modulo è il reducer puro di quello stato: l'hub (`main.js`) lo usa come unica
 * fonte di verità, così lo stato non si frammenta in più istanze incoerenti.
 *
 * Il `source` semantico del relay `hub:project-state` (per cui i tool consumatori filtrano)
 * è derivato dall'appId via una MAPPA DI CONFIGURAZIONE, non da rami di controllo per-tool:
 * aggiungere un tool non richiede nuovi `if`.
 */

/** Stato del progetto Quadra corrente: identità + stato per-appId (generico). */
export interface HubProjectState {
  /** identità stabile del progetto corrente (null finché non aperto/salvato). */
  id: string | null
  /** nome del progetto (es. dal file .ehub); null se senza nome. */
  name: string | null
  /** stato di progetto condiviso per appId (payload relayati cross-tool). */
  tools: Record<string, unknown>
}

/**
 * Etichetta `source` del relay per appId — MAPPA DI CONFIGURAZIONE (non rami di controllo).
 * I tool consumatori storici filtrano per queste etichette; i nuovi tool usano l'appId stesso.
 */
export const SOURCE_BY_APP: Record<string, string> = {
  // Solo i tool il cui `source` storico differisce dall'appId: senza voce qui,
  // sourceForApp() ripiega sull'appId stesso.
  computo: 'pricelist',
}

/**
 * I tool portavano nomi di lettere greche e i loro identificativi lo dicevano
 * ancora: `miu-price-list`, `beta-contabilita`, `alfa-control-center`.
 * Ora si chiamano col loro nome. I progetti già salvati portano le vecchie
 * chiavi: si traducono all'apertura, così un file del mese scorso si apre come
 * prima. Non si scrive più niente con le vecchie chiavi.
 */
export const APP_ID_STORICI: Record<string, string> = {
  'miu-price-list': 'computo',
  'beta-contabilita': 'contabilita',
  'alfa-control-center': 'amministrazione',
}

/** Traduce le chiavi storiche di uno stato di progetto, lasciando intatto il resto. */
export function migraAppIdStorici(tools: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(tools)) {
    const nuovo = APP_ID_STORICI[k] || k
    // una chiave nuova già presente vince su quella storica: non si sovrascrive il recente col vecchio
    if (nuovo in out) continue
    out[nuovo] = v
  }
  return out
}

/** `source` del relay per un appId (default: l'appId stesso, nessun hard-code di controllo). */
export function sourceForApp(appId: string): string {
  return SOURCE_BY_APP[appId] || appId
}

/** Stato di progetto vuoto. */
export function emptyHubProjectState(): HubProjectState {
  return { id: null, name: null, tools: {} }
}

/**
 * Migra un oggetto salvato (localStorage) al nuovo shape. Riconosce sia il NUOVO shape
 * (`{id,name,tools}`) sia il VECCHIO hard-coded (`{phiProject,pricelistComputo,tauComputo}`),
 * così l'aggiornamento non perde lo stato già persistito. Input non valido → stato vuoto.
 */
export function migrateHubState(saved: unknown): HubProjectState {
  const st = emptyHubProjectState()
  if (!saved || typeof saved !== 'object') return st
  const o = saved as Record<string, unknown>
  if (o.tools && typeof o.tools === 'object') {
    st.tools = migraAppIdStorici({ ...(o.tools as Record<string, unknown>) })
    st.id = typeof o.id === 'string' ? o.id : null
    st.name = typeof o.name === 'string' ? o.name : null
    return st
  }
  // legacy: i campi hard-coded delle prime versioni → mappa per appId.
  if (o.pricelistComputo) st.tools.computo = o.pricelistComputo
  if (o.tauComputo) st.tools['tau-documenti'] = o.tauComputo
  return st
}

/**
 * Aggiorna lo stato di progetto di UN appId (generico, nessun ramo per-tool). `project` nullo
 * rimuove la voce. Ritorna un NUOVO stato (immutabile, non muta l'input).
 */
export function setToolProject(st: HubProjectState, appId: string, project: unknown): HubProjectState {
  const id = (appId || '').trim()
  if (!id) return st
  const tools = { ...st.tools }
  if (project == null) delete tools[id]
  else tools[id] = project
  return { ...st, tools }
}

/** Messaggio di relay `hub:project-state` per un appId (source derivato dalla mappa). */
export interface ProjectStateMessage {
  type: 'hub:project-state'
  source: string
  project: unknown
  appId: string
  /**
   * REPLAY = ri-trasmissione dello stato già noto (caricamento tool / `app:request-state`),
   * NON una nuova azione dell'utente. I tool consumatori usano questo flag per NON applicare in
   * automatico (clobber) ciò che è solo un replay: ingeriscono on-demand. Un push FRESCO (relay di
   * un `app:project-update`) non porta questo flag.
   */
  replay: true
}

/**
 * Messaggi `hub:project-state` per REPLICARE lo stato corrente a un frame (uno per ogni tool con
 * stato presente). Usato al caricamento di un tool e in risposta a `app:request-state`: sono tutti
 * REPLAY (`replay:true`), così i consumatori non li scambiano per nuove azioni utente.
 */
export function projectStateMessages(st: HubProjectState): ProjectStateMessage[] {
  return Object.keys(st.tools).map(appId => ({
    type: 'hub:project-state',
    source: sourceForApp(appId),
    project: st.tools[appId],
    appId,
    replay: true,
  }))
}

/** Garantisce un id stabile al progetto (lo genera con `gen` se mancante). Immutabile. */
export function ensureProjectId(st: HubProjectState, gen: () => string): HubProjectState {
  return st.id ? st : { ...st, id: gen() }
}

/** Identità del progetto corrente (id+name), senza toccare i tool. Immutabile. */
export function setProjectIdentity(st: HubProjectState, id: string | null, name: string | null): HubProjectState {
  return { ...st, id, name }
}

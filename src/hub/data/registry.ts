/* =====================================================================
   APP REGISTRY — elenco dei tool dell'hub. Aggiungi nuovi tool qui.
   Estratto FEDELMENTE dal monolite EHub_v3_5_0.html. Single source of truth.
   `version` e `resolvedFile` sono popolati a runtime da resolveFiles()
   (vedi engine/resolve.ts) in base ai file trovati nella cartella.
   ===================================================================== */

export type LogoType = 'lavoro' | 'amministrazione' | string
export type AppStatus = 'stable' | 'beta'

/** Tematica del tool per il raggruppamento nell'hub. `amministrazione`
 *  è popolata SOLO da tool `adminOnly` — vuota (quindi omessa da groupByCategory)
 *  per qualunque profilo non-admin. `lavoro` è dove si lavora: dal computo alla
 *  contabilità, in uno strumento solo. */
export type AppCategory = 'lavoro' | 'amministrazione'

/**
 * Ordine ed etichette delle tematiche. Il computo e la contabilità stanno davanti
 * perché sono il lavoro di tutti i giorni; l'amministrazione in coda, e solo per
 * chi è admin.
 */
export const CATEGORY_ORDER: AppCategory[] = ['lavoro', 'amministrazione']
export const CATEGORY_LABELS: Record<AppCategory, string> = {
  'lavoro': 'Lavoro',
  'amministrazione': 'Amministrazione',
}

export interface AppNote {
  icon: string
  text: string
  beta?: boolean
}

export interface AppDef {
  id: string
  name: string
  tagline: string
  /** Versione rilevata dal filename (null finché non risolta). */
  /** Nome file HTML STABILE (senza versione) che l'hub scopre nella cartella. */
  file: string
  /** Cartella sorgente in `src/tools/` (es. 'gamma' per Gamma.html). OBBLIGATORIA:
   *  è la fonte unica del legame tool↔cartella per i doc generati
   *  ([scripts/sync-docs.ts]) e per le guardie di build ([tests/web]). Campo
   *  richiesto apposta: un tool nuovo senza `srcDir` non compila, quindi la
   *  documentazione non può restare indietro. */
  srcDir: string
  logoType: LogoType
  tags: string[]
  status: AppStatus
  /** Integrazioni con altri tool (glifo + tooltip accanto al nome nella welcome-card). Una card può averne più di una. */
  notes?: AppNote[]
  /** Tematica del tool (raggruppamento nell'hub). */
  category: AppCategory
  /** File HTML risolto nella cartella (= `file` se presente, null se assente). */
  resolvedFile?: string | null
  /** true = visibile SOLO al profilo admin (di sistema o aziendale) — divieto
   *  assoluto, nessun opt-in possibile. Vedi engine/visibility.ts::isToolVisible. */
  adminOnly?: boolean
}

/** Un gruppo tematico di tool (per il render a sezioni dell'hub). */
export interface AppGroup {
  key: AppCategory
  label: string
  apps: AppDef[]
}

/**
 * Raggruppa i tool per TEMATICA nell'ordine `CATEGORY_ORDER`, preservando l'ordine interno della
 * lista in ingresso. I gruppi vuoti (es. dopo un filtro di ricerca) sono omessi.
 * PURO e testabile. La ricerca/tag resta trasversale: si filtra prima, poi si raggruppa.
 */
export function groupByCategory(apps: AppDef[]): AppGroup[] {
  return CATEGORY_ORDER
    .map(key => ({ key, label: CATEGORY_LABELS[key], apps: apps.filter(a => a.category === key) }))
    .filter(g => g.apps.length > 0)
}

export const APP_REGISTRY: AppDef[] = [
  /* L'ORDINE CONTA: groupByCategory preserva l'ordine di questa lista dentro ogni
     categoria, quindi è qui che si decide come appaiono le card nell'hub. */
  /* LAVORO: lo strumento unico (Docs/07-Un-lavoro-un-modulo.md). Computo e
     contabilità sono tappe della stessa catena, nella stessa schermata: i due
     strumenti di prima sono usciti (tappa 8); i loro motori (prezzari, XPWE,
     contabilità) restano, e li usa Lavoro. */
  {
    id: 'lavoro',
    name: 'Lavoro',
    tagline: 'Dal progetto alla contabilità, in una schermata sola',
    file: 'Lavoro.html',
    srcDir: 'lavoro',
    logoType: 'lavoro',
    // anche le parole di Computo e Contabilità, che erano strumenti a sé: chi le cerca arriva qui
    tags: ['lavoro', 'computo', 'revisioni', 'contratto', 'contabilità', 'sal', 'perizia', 'misure', 'progetto', 'esecutivo', 'pfte',
      'prezzario', 'elenco prezzi', 'xpwe', 'excel', 'wbs', 'libretto', 'registro', 'certificato', 'pagamento', 'appalti', 'direttore lavori'],
    status: 'beta',
    category: 'lavoro',
  },
  {
    id: 'amministrazione',
    name: 'Amministrazione',
    tagline: 'Centro di controllo dell\'hub',
    file: 'Amministrazione.html',
    srcDir: 'amministrazione',
    logoType: 'amministrazione',
    tags: ['admin', 'amministrazione', 'utenti', 'statistiche'],
    status: 'stable',
    category: 'amministrazione',
    adminOnly: true,
  },
  // ── AGGIUNGI NUOVI TOOL QUI ──
  // Campi: id, name, tagline, file (nome stabile), srcDir (cartella in src/tools/),
  //        logoType, tags, status, category
  // Dopo aver aggiunto una voce: `npm run sync:docs` (riallinea README e Docs). Vedi Docs/04.
  // resolvedFile viene popolato automaticamente da resolveFiles()
]

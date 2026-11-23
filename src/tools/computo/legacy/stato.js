// Computo — STATO CONDIVISO estratto da legacy/index.js (STEP 2 refactor stato).
// Oggetti/array/Set CONST: mutati per proprietà da tutti i moduli (import-safe).
// Le var RIASSEGNATE per intero hanno un setter: le letture e le mutazioni di
// proprietà restano invariate nei moduli (live-binding ESM), solo la riassegnazione
// passa dal setter (un import non è riassegnabile da un altro modulo).

export const CAT_SEP=' · ';
export const CAT_LIVELLI=['sp','cat','sb'];
export const CAT_LIVELLO_LABEL={ sp:'Supercategorie', cat:'Categorie', sb:'Sottocategorie' };
export const AP_TIPO_LETTERA = { manodopera:'A', materiale:'B', nolo:'C', varie:'D' };
export const CMP_ACC_DEFAULT = {
  inizio:true, materiali:true, caratteristiche:true, prezzario:false,
  macro_impianti_elettrici:false, macro_impianti_speciali:false, macro_impianti_meccanici:false, macro_impianti_antincendio:false,
};

export const S = {
  archive: [],      // [{filename,regione,anno,format,loaded,rows,handle}]
  allRows: [],
  filtered: [],
  sel: new Set(),        // LEGACY/import: voci di prezzario referenziate nel computo (import + progetti vecchi) — vedi cartRows()
  searchSel: new Set(),  // selezione NEI RISULTATI di ricerca (transitoria): serve al bottone «＋ Aggiungi», NON è il computo
  page: 1, pp: 25,
  view: 'table',      // 'table' | 'tree' | 'list'
  density: 'normal',  // 'normal' | 'compact' | 'ultra'
  descLines: 3,       // righe max descrizioni voce (viste Capitoli/Elenco): 1|2|3|5|99
  columns: 'tutte',   // 'tutte' | 'meno' — schermata leggera: nasconde regione/anno/disciplina/imp.netto in tabella
  treeVoce: 'compatta',// 'compatta' | 'espansa' — stile delle voci foglia nella vista Capitoli
  treeOpen: new Set(),// capitoli espansi nella vista albero
  sortCol: 'codice', sortDir: 1,
  expandedReg: new Set(),      // regioni APERTE dall'utente (default = compatto/chiuso)
  collapsedGroup: new Set(),   // gruppi top-level chiusi (pubblici/privati)
  active: null,   // indice del prezzario attualmente visualizzato (uno solo a video)
  qty: {},          // chiave voce → {qty, um} (quantità e righe di misura delle voci di computo)
  custom: new Map(), // voci composte SENZA voce di prezzario reale — chiave 'cmp:<n>' → {desc_short,declaratoria,um,prezzo,famigliaId,famNome}
  datiGenerali: {}, // dati generali del progetto (oggetto, committente, CUP…) — vedi src/shared/dati-generali.ts
  wbs: {},          // chiave voce → codice WBS (es. "01.02.03") del computo
  corpo: {},        // chiave voce → true: lavoro A CORPO (prezzo complessivo fisso, contabilizzato a quote %)
  offerte: [],      // offerte ricevute (src/shared/offerte.ts): richiesta, quadro comparativo, aggiudicazione
  aggiudicata: null, // id dell'offerta aggiudicataria (offerta a prezzi unitari)
  sicurezza: {},    // chiave voce → true/false: scelta MANUALE «oneri della sicurezza» (vince sul capitolo del prezzario)
  wbsNodi: {},      // codice WBS → descrizione del nodo (struttura WBS del progetto)
  ordineCat: [[],[],[]], // ordine DEFINITO dei nomi per livello [Super, Cat, Sub] (Struttura, import XPWE)
  catDichiarate: [], // rami di categoria «Super · Cat · Sub» dichiarati senza voci (Struttura, modelli)
  ordine: [],       // ordine MANUALE delle voci di computo (chiavi) — vedi ordine.js
  ordinamento: 'categorie', // 'manuale' | 'categorie' | 'wbs': ordine a schermo e in stampa
  revisioni: [],    // versioni congelate del computo (PFTE/definitivo/esecutivo/contratto) — vedi legacy/revisioni.js
  faseProgetto: 'PFTE', // la FASE del computo in corso: PFTE → definitivo → esecutivo (shared/contratto.ts)
  contratto: null,  // l'ATTO di promozione a contratto: quale computo, come, voci fotografate (shared/contratto.ts)
  categoria: {},    // chiave voce → nome CATEGORIA (assegnazione MANUALE nel computo metrico; i capitoli sono dell'Elenco Prezzi, altro documento)
};

export const CART_SEL = new Set();  // mai riassegnato: solo .add/.delete

export let CMP = { fam:null, custom:null, misura:null, materiale:null, posa:null, opzioni:[], famQ:'', edBreve:null, edEstesa:null, genBreve:'', genEstesa:'', acc:{...CMP_ACC_DEFAULT}, mode:'desc', analisi:null, editingLibId:null };
export const setCMP = v => (CMP = v);
// MIU_LIBRERIA parte vuoto qui e viene popolato al boot da index.js con
// `setMiuLibreria(loadLibreria())` (loadLibreria legge localStorage e vive in index.js).
export let MIU_LIBRERIA = [];
export const setMiuLibreria = v => (MIU_LIBRERIA = v);
export let CART_MODE = 'misura';
export const setCartMode = v => (CART_MODE = v);
export let CART_VIEW = 'tabella';
export const setCartView = v => (CART_VIEW = v);
export const CART_CAP_OPEN = new Set(); // capitoli espansi nella vista "Capitoli" del Computo — separato da S.treeOpen (browser prezzario)
export let _phiPresetQty = null;
export const setPhiPresetQty = v => (_phiPresetQty = v);
export let AP_REF_Q = '';
export const setApRefQ = v => (AP_REF_Q = v);
export let AP_SEARCH_Q = { manodopera:'', materiale:'', nolo:'', varie:'' };
export const setApSearchQ = v => (AP_SEARCH_Q = v);
export let AP_JUST_ADDED = null;
export const setApJustAdded = v => (AP_JUST_ADDED = v);
export let CART_QUERY = '';
export const setCartQuery = v => (CART_QUERY = v);
export let _phiSearchTimer = null;
export const setPhiSearchTimer = v => (_phiSearchTimer = v);

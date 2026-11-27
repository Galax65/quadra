/**
 * Contabilità — modello dati della CONTABILITÀ dei lavori pubblici (D.Lgs. 36/2023,
 * Allegato II.14). Tipi PURI (nessun DOM), condivisi da import/motore/documenti.
 *
 * Due modalità di contabilizzazione, che possono anche CONVIVERE (appalto misto):
 *  - **a misura**: quantità fisiche effettive × prezzo unitario (il corrispettivo
 *    varia con l'eseguito); mappa sulle `MisurazioneRiga` del computo di Computo.
 *  - **a corpo**: corrispettivo fisso, si contabilizza la quota % dell'aliquota
 *    del corpo d'opera eseguita a ogni SAL.
 */
import type { MisurazioneRiga } from '../../../shared/compositore/misurazioni'

export type Modalita = 'misura' | 'corpo'
/** Modalità dell'appalto: una delle due, o «misto» (partite di entrambe). */
export type ModalitaAppalto = Modalita | 'misto'

/** Una parte del contratto: la stazione appaltante (ente) o l'impresa esecutrice. */
export interface ParteContratto {
  denominazione: string
  indirizzo?: string
  codiceFiscale?: string
  partitaIva?: string
  /** Rappresentante/legale (impresa) o responsabile (ente). */
  rappresentante?: string
  /** Logo (data URL) — usato per la testata istituzionale dei documenti (ente). */
  logo?: string
}

/** Metadati e dati economici dell'appalto (frontespizio + base dei calcoli). */
export interface Appalto {
  oggetto: string
  cup?: string
  cig?: string
  /** Stazione appaltante — testata istituzionale dei documenti (il Comune/ente). */
  ente: ParteContratto
  /** Impresa esecutrice. */
  impresa: ParteContratto
  rup?: string
  direttoreLavori?: string
  /* Dati del PROGETTO: gli stessi che il Computo chiama «dati generali». Stanno
     qui perché il lavoro ha una sola anagrafica, scritta da qualunque strumento
     e letta da tutti — nelle intestazioni di stampa servono a entrambi. */
  comune?: string
  provincia?: string
  progettista?: string
  /** Coordinatore della sicurezza in fase di esecuzione. */
  cse?: string
  /** Prezzario di riferimento (es. «Prezzario regionale FVG 2026/1»). */
  prezzario?: string
  /** Importo a base d'asta (soggetto a ribasso). */
  baseAsta?: number | null
  /** Importo offerto (ribassato) — se noto, deriva il ribasso. */
  importoOfferta?: number | null
  /** Ribasso % — se inserito a mano prevale; altrimenti derivato da base/offerta. */
  ribassoPct?: number | null
  /** Oneri per la sicurezza (NON soggetti a ribasso). */
  oneriSicurezza?: number | null
  /**
   * Offerta A PREZZI UNITARI: le partite portano i prezzi offerti dall'aggiudicatario, il
   * ribasso è solo «risultante» (base − offerta) e NON si applica di nuovo nel SAL.
   */
  prezziUnitari?: boolean
  /** Aliquota IVA % (default 10 nei lavori pubblici; verificare per appalto). */
  ivaPct?: number | null
  dataStipula?: string
  /** Numero/repertorio del contratto (riportato su SAL e certificati). */
  numeroContratto?: string
  /** Registrazione del contratto (luogo, data, numero): dato generale di testa degli atti. */
  registrazione?: { luogo?: string; data?: string; numero?: string }
  /** Data dell'offerta dell'aggiudicatario. */
  dataOfferta?: string
  /** Data del verbale di consegna dei lavori. */
  dataConsegna?: string
  /** Data di consegna/avvio dei lavori (inizio della cronologia di cantiere). */
  dataInizio?: string
  /** Giorni utili contrattuali per l'ultimazione. */
  giorniUtili?: number | null
  /** Data utile per l'ultimazione secondo il contratto. */
  dataUltimazionePrevista?: string
  /** Nuova data di ultimazione dopo proroghe e sospensioni (se concesse). */
  nuovaDataUltimazione?: string
  /** Somme a disposizione della stazione appaltante nel quadro economico. */
  sommeADisposizione?: number | null
  /** Incidenza della manodopera stimata negli atti di gara (art. 41 c. 14). */
  importoManodopera?: number | null
  /** Penale giornaliera per il ritardo, in per mille dell'ammontare netto
   *  contrattuale: il contratto la fissa fra 0,3 e 1 (art. 126 c. 1). */
  penalePerMille?: number | null
  /** Collaudo o certificato di regolare esecuzione: senza la sua APPROVAZIONE
   *  la ritenuta di garanzia non si svincola (art. 11 c. 6). */
  collaudo?: { tipo?: 'collaudo' | 'cre'; data?: string; dataApprovazione?: string }
  /** DURC: lo svincolo della ritenuta è subordinato alla regolarità contributiva. */
  durc?: { regolare?: boolean; data?: string }
  /** Articolo del capitolato richiamato nella formula del certificato di pagamento. */
  articoloCapitolato?: string
  /**
   * Anticipazione del prezzo (art. 125 c.1 D.Lgs. 36/2023): % del valore del contratto
   * (di norma 20, elevabile fino a 30). Si recupera su ogni certificato con la stessa
   * percentuale applicata all'importo contabilizzato. null/0 = nessuna anticipazione.
   */
  anticipazionePct?: number | null
  /**
   * Arrotondamento per difetto del credito del certificato di pagamento (es. 100 =
   * «credito arrotondato a 100 euro»). Il resto non pagato resta
   * nel credito e matura nei certificati successivi. null/0 = nessun arrotondamento.
   */
  arrotondamentoCertificato?: number | null
  /**
   * Perizie di variante approvate (atti aggiuntivi al contratto): modificano quantità
   * e importi contrattuali dal loro SAL in poi. Vivono con l'appalto, così ogni
   * documento (libretto, registro, SAL, certificato, conto finale) le vede.
   */
  perizie?: Perizia[]
  modalita: ModalitaAppalto
  /** Oggetto del contratto: lavori (default), servizi, forniture (cambia DL/DEC e soglie di revisione). */
  tipologia?: TipologiaAppalto
  /** Clausola di revisione dei prezzi (art. 60 e Allegato II.2-bis D.Lgs. 36/2023). */
  revisione?: RevisionePrezzi
  /** Iter di sottoscrizione del conto finale (date e esito): art. 7 c. 3, art. 12 c. 1 lett. e) All. II.14. */
  contoFinale?: ContoFinaleIter
  /**
   * CONTABILITÀ SEMPLIFICATA (art. 12 c. 11-bis All. II.14, introdotto dal
   * D.Lgs. 209/2024): per i **lavori di importo inferiore a 40.000 euro** è
   * consentito tenere la contabilità in forma semplificata, previa verifica
   * del direttore dei lavori della corrispondenza fra il lavoro svolto e
   * quanto fatturato; il certificato di regolare esecuzione può essere
   * sostituito dal **visto del DL sulle fatture di spesa**. Vale solo per i
   * lavori: per servizi e forniture il certificato serve comunque.
   */
  contabilitaSemplificata?: boolean
  /** Accordo quadro (art. 59): importo massimo e contratti applicativi. */
  accordoQuadro?: AccordoQuadro
}

export type TipologiaAppalto = 'lavori' | 'servizi' | 'forniture'

/**
 * SOTTOSCRIZIONE DEL CONTO FINALE (art. 7 c. 3 e art. 12 c. 1 lett. e) All. II.14).
 *
 * È l'ultimo passaggio in cui una pretesa dell'impresa può restare viva: il RUP
 * invita l'esecutore a prendere cognizione del conto finale e a firmarlo entro
 * un termine non superiore a TRENTA GIORNI, e in quella sede l'esecutore deve
 * CONFERMARE le riserve già iscritte nel registro per le quali non siano
 * intervenute procedure conciliative. Se non firma nel termine, o firma senza
 * confermare le domande, il conto finale si ha come da lui definitivamente
 * accettato. Perciò queste tre date non sono burocrazia: decidono chi paga.
 */
export interface ContoFinaleIter {
  /** Data di compilazione del conto finale da parte del DL. */
  dataCompilazione?: string
  /** Data dell'invito del RUP a prenderne cognizione (fa decorrere i 30 giorni). */
  dataInvito?: string
  /** Termine assegnato in giorni (non superiore a 30). */
  giorniTermine?: number | null
  /** Data della firma (o della scadenza del termine senza firma). */
  dataFirma?: string
  esito?: EsitoContoFinale
}

/** Come si chiude il conto finale: firmato con conferma delle riserve, firmato
 *  senza confermarle (= accettato), o non firmato nel termine (= accettato). */
export type EsitoContoFinale = 'firmatoConConferma' | 'firmatoSenzaConferma' | 'nonFirmato'

/**
 * Revisione prezzi (art. 60 come modificato dal D.Lgs. 209/2024, All. II.2-bis):
 * si attiva quando la variazione dell'indice (indice sintetico del progetto per i
 * lavori) supera la soglia — 3% lavori, 5% servizi e forniture — e opera nella misura
 * del 90% (lavori) o dell'80% (servizi/forniture) della parte eccedente, applicata
 * alle prestazioni eseguite dopo l'attivazione. Gli indici li inserisce il DL per SAL.
 */
export interface RevisionePrezzi {
  attiva: boolean
  /** Indice di riferimento (mese del termine per l'aggiudicazione). */
  indiceBase: number | null
  /** Descrizione dell'indice (es. «Indice sintetico di progetto, ISTAT TOL»). */
  descrizioneIndice?: string
  /** Soglia % (default dalla tipologia: 3 lavori, 5 servizi/forniture). */
  sogliaPct?: number | null
  /** Quota % riconosciuta dell'eccedenza (default 90 lavori, 80 servizi/forniture). */
  quotaPct?: number | null
}

/** Accordo quadro: tetto dell'importo e contratti applicativi stipulati. */
export interface AccordoQuadro {
  importoMassimo: number | null
  applicativi: ContrattoApplicativo[]
}
export interface ContrattoApplicativo {
  numero: number
  data?: string
  oggetto?: string
  importo: number
}

/** Documento effettivamente generato/consegnato (storico del cantiere). */
export interface Consegna {
  id: string
  /** Tipo tecnico del documento (giornale, libretto, sal, certificato, …). */
  tipo: string
  /** Etichetta leggibile (es. «SAL n. 2»). */
  label: string
  /** Data di riferimento del documento (gg/mm/aaaa). */
  data: string
  /** SAL di riferimento, se pertinente. */
  salNumero?: number
  /** Timestamp di generazione. */
  ts: number
  /** Impronta del documento prodotto (SHA-256 del suo HTML), per il registro degli atti. */
  impronta?: string
  /**
   * Pagine occupate dall'atto quando è stato stampato in PDF (l'unica stampa che
   * impagina davvero). Serve a far CONTINUARE la numerazione di libretto e
   * registro all'atto successivo: un solo registro a pagine numerate, non un
   * documento nuovo a ogni SAL. Assente = pagine non conteggiate (stampa HTML):
   * la continuità non si dichiara a vanvera.
   */
  pagine?: number
}

/**
 * Una PARTITA contabile: una voce a misura oppure un corpo d'opera a corpo.
 * `modalita` discrimina quali campi contano. `qtyProgetto`/`importoContrattuale`
 * vengono dall'import del computo (Computo / XPWE / Excel).
 */
export interface Partita {
  id: string
  modalita: Modalita
  codice: string
  descrizione: string
  /** Descrizione estesa (declaratoria), per libretto e registro. */
  declaratoria?: string
  um?: string
  /** Percorso categoria "Liv1 · Liv2 · Liv3" (categorie di lavorazioni omogenee). */
  categoria?: string
  /** Codice WBS gerarchico (es. "01.02.03"), come nel computo di progetto. */
  wbs?: string
  /** Voce degli ONERI DELLA SICUREZZA: non soggetta a ribasso, sommata agli oneri. */
  sicurezza?: boolean
  /**
   * Lavoro NON soggetto al ribasso d'asta pur non essendo sicurezza: un nuovo
   * prezzo per analisi che il contratto non assoggetta (D.Lgs. 36/2023, parere
   * MIT 3545/2025) — la voce su un rigo di ribasso a 0%.
   */
  nonRibassata?: boolean
  // ── a misura ──
  prezzoUnitario?: number | null
  /** Prezzo di CONTRATTO (dal computo di progetto o dalla perizia): resta come
   *  riferimento, così si vede subito se in contabilità è stato toccato. */
  prezzoContratto?: number | null
  /** Prezzo di progetto (a base di gara), se il contratto è a prezzi unitari offerti. */
  prezzoBase?: number | null
  /** Quantità di progetto (dal computo); base indicativa, l'eseguito la sostituisce a SAL. */
  qtyProgetto?: number | null
  /** Righe di misura di progetto (dal computo), riferimento per il libretto. */
  misurazioniProgetto?: MisurazioneRiga[]
  // ── a corpo ──
  /** Importo contrattuale del corpo d'opera (fisso). */
  importoContrattuale?: number | null
  /**
   * SOTTO-COMPUTO del corpo d'opera: le lavorazioni in cui il corpo si
   * scompone, con quantità e prezzi. Serve a rispondere alla domanda che in
   * un appalto a corpo si fa a ogni SAL — «da dove viene quel 35%?» — perché
   * la quota non si stima a occhio: si misura su ciò che del corpo è stato
   * davvero eseguito (art. 12 All. II.14, libretto dei sotto-computi).
   * Assente = la quota si attesta direttamente in percentuale.
   */
  sottoComputo?: VoceSottoComputo[]
  // ── tracciabilità contabile (atti pubblici: niente cancellazioni) ──
  /**
   * SAL di prima comparsa della voce (le voci da computo = 1). Un nuovo prezzo
   * introdotto in corso d'opera compare solo dal proprio SAL in avanti: non
   * inquina i libretti già prodotti.
   */
  introdottaSal?: number
  /**
   * SAL in cui la voce è stata SOPPRESSA (stornata): da questo SAL in poi il suo
   * eseguito è azzerato con una detrazione tracciata. La voce NON si cancella —
   * resta negli atti precedenti che l'hanno contabilizzata (D.M. 49/2018 art. 14:
   * niente abrasioni, si porta in detrazione con annotazione).
   */
  soppressaSal?: number
  /** Scheda del NUOVO PREZZO, quando la voce non è in contratto (vedi NuovoPrezzo). */
  np?: NuovoPrezzo
}

/**
 * NUOVO PREZZO (All. II.14 art. 5 c. 7; art. 120 D.Lgs. 36/2023).
 *
 * Una lavorazione non prevista in contratto non si contabilizza al prezzo che
 * capita: si determina in contraddittorio — **per assimilazione** da una voce
 * contrattuale, **dai prezzari** vigenti, o con **nuova analisi** — si assoggetta
 * al **medesimo ribasso contrattuale** e segue un suo iter: concordata col
 * verbale, approvata con la perizia. Finché non è approvata si contabilizza in
 * conto provvisorio. La scheda tiene insieme numero, iter e derivazione: è ciò
 * che il verbale e l'elenco dei nuovi prezzi devono poter stampare.
 */
export interface NuovoPrezzo {
  /** Progressivo del lavoro: NP.01, NP.02… */
  numero: number
  stato: StatoNuovoPrezzo
  /** Perizia che lo introduce; assente finché la perizia non c'è. */
  periziaN?: number | null
  origine: OrigineNuovoPrezzo
  /** Da dove nasce il prezzo: voce contrattuale assimilata o riga di prezzario. */
  base?: {
    codice?: string
    descrizione?: string
    /** Prezzo di partenza PRIMA del ribasso (listino, o prezzo di contratto). */
    prezzo?: number | null
    /** Prezzario e anno, oppure «voce di contratto». */
    fonte?: string
  }
  /** Ribasso contrattuale applicato al prezzo base (%). */
  ribassoPct?: number | null
  /** Perché serve: va nel verbale di concordamento. */
  motivazione?: string
  /** Data del concordamento in contraddittorio. */
  dataConcordamento?: string
}

/** bozza → concordato (verbale) → approvato (perizia). */
export type StatoNuovoPrezzo = 'bozza' | 'concordato' | 'approvato'
export type OrigineNuovoPrezzo = 'prezzario' | 'assimilazione' | 'analisi'

/**
 * Una lavorazione del SOTTO-COMPUTO di un corpo d'opera: è una voce di computo
 * a tutti gli effetti (descrizione, unità, quantità, prezzo), ma vive dentro il
 * corpo e non ha vita contabile propria — concorre solo a determinare la quota
 * di avanzamento del corpo.
 */
export interface VoceSottoComputo {
  id: string
  codice?: string
  descrizione: string
  um?: string
  /** Quantità prevista dal progetto per questa lavorazione. */
  qty?: number | null
  prezzo?: number | null
}

/** Avanzamento di una voce del sotto-computo a un dato SAL. */
export interface AvanzamentoSotto {
  voceId: string
  /** Quantità eseguita a tutto il SAL (progressiva). */
  quantitaProgressiva?: number | null
  /** Misure di dettaglio, come nel libretto. */
  misurazioni?: MisurazioneRiga[]
}

/** Stato di una partita a un dato SAL (attestazione del DL, mai stimata dal tool). */
export interface RigaSal {
  partitaId: string
  /** a misura: quantità PROGRESSIVA eseguita a tutto il SAL. */
  quantitaProgressiva?: number | null
  /**
   * Data del rilevamento delle misure di questa partita. Il libretto la stampa
   * accanto alla tariffa — è la colonna «DATA» degli atti contabili, e dice
   * quando la misura è stata presa in contraddittorio. Assente: vale la data
   * del SAL.
   */
  dataMisura?: string
  /** a misura: dettaglio libretto (righe di misura) a tutto il SAL — opzionale. */
  misurazioni?: MisurazioneRiga[]
  /** a corpo: quota % (0..100) dell'aliquota del corpo eseguita a tutto il SAL. */
  quotaPct?: number | null
  /**
   * a corpo: avanzamento delle lavorazioni del sotto-computo. Quando c'è, la
   * quota % non si scrive a mano: si ricava da qui, e il libretto dei
   * sotto-computi la dimostra riga per riga.
   */
  sotto?: AvanzamentoSotto[]
}

/** Uno Stato di Avanzamento Lavori: quote/quantità progressive + detrazioni. */
export interface Sal {
  numero: number
  data?: string
  righe: RigaSal[]
  /** Detrazioni per lavorazioni non conformi/in contestazione (progressive). */
  detrazioni?: number | null
  note?: string
  /**
   * Atti del SAL firmati: libretto, registro e SAL non si modificano più (atti pubblici,
   * D.M. 49/2018: niente abrasioni). Per correggere si sblocca esplicitamente, e resta traccia.
   */
  firmato?: boolean
  dataFirma?: string
  /**
   * IMPRONTA del fascicolo al momento della firma (contabilità digitale:
   * autenticità e provenienza dei dati, All. II.14 art. 12 c. 10). È l'hash di un
   * testo canonico che riassume ciò che gli atti di questo SAL affermano: se
   * qualcuno sblocca e corregge, l'impronta ricalcolata non torna e il registro
   * degli atti lo dice. Assente = SAL firmato prima che questa funzione esistesse.
   */
  impronta?: string
  /** Algoritmo dell'impronta (oggi sempre SHA-256), scritto per non doverlo indovinare domani. */
  improntaAlgo?: string
  /** Data e ora (ISO) in cui l'impronta è stata calcolata. */
  improntaTs?: number
  /** Storico degli sblocchi (data e motivo), per trasparenza. */
  sblocchi?: { data: string; motivo?: string }[]
  /**
   * FIRMA DELL'ESECUTORE sul registro di contabilità a questo SAL. Non è un
   * dettaglio: la firma «con riserva» apre i quindici giorni per esplicitare le
   * riserve, e il RIFIUTO di firmare obbliga il DL a farne verbale e a
   * informarne subito la stazione appaltante (art. 7 All. II.14). Assente =
   * non ancora sottoposto all'esecutore.
   */
  firmaEsecutore?: FirmaEsecutore
  /** Data della firma (o del rifiuto) dell'esecutore. */
  dataFirmaEsecutore?: string
  /** Valore dell'indice di revisione prezzi riferito a questo SAL (se la clausola è attiva). */
  indiceRevisione?: number | null
  /**
   * Data del CERTIFICATO DI PAGAMENTO di questo SAL. Il RUP lo emette entro
   * SETTE GIORNI dall'adozione dello stato di avanzamento (art. 12 c. 1 lett. d) All. II.14),
   * previa verifica della regolarità contributiva: da questa data decorre il
   * termine di pagamento.
   */
  dataCertificato?: string
  /**
   * Data del pagamento (emissione del mandato): di regola entro TRENTA GIORNI
   * dall'adozione del SAL, salvo il termine diverso, e comunque non superiore a
   * sessanta, pattuito e giustificato nel contratto (art. 125 D.Lgs. 36/2023).
   */
  dataPagamento?: string
  /** Numero del certificato di pagamento, se diverso dal numero del SAL. */
  numeroCertificato?: number | null
}

/** Firma dell'esecutore sul registro: senza riserve, con riserva, o rifiutata. */
export type FirmaEsecutore = 'senzaRiserve' | 'conRiserva' | 'rifiutata'

/**
 * PERIZIA DI VARIANTE (art. 120 D.Lgs. 36/2023): nuove quantità (a misura) o nuovi
 * importi (a corpo) delle partite, in vigore dal SAL `dalSal` in poi. I SAL precedenti
 * restano calcolati sul contratto originario (o sulla perizia allora vigente).
 * Le partite nuove (nuovi prezzi) si aggiungono come partite con `introdottaSal`.
 */
export interface VocePerizia {
  partitaId: string
  /** a misura: nuova quantità contrattuale. */
  qty?: number | null
  /** a corpo: nuovo importo contrattuale del corpo d'opera. */
  importo?: number | null
  /**
   * Misure di dettaglio della nuova quantità (par.ug. × L1 × L2 × H), scritte con
   * la stessa interfaccia del computo e del libretto. Se ci sono, la quantità della
   * perizia è la loro somma: `qty` resta allineata e vale da sola per i file vecchi.
   */
  misurazioni?: MisurazioneRiga[]
}
export interface Perizia {
  numero: number
  data?: string
  oggetto?: string
  /** Motivazione (art. 120 c.1 lett. …) e note. */
  motivazione?: string
  /** Primo SAL in cui valgono le nuove quantità/importi. */
  dalSal: number
  voci: VocePerizia[]
  /** Importo dell'atto di sottomissione / aggiuntivo, se diverso dal calcolato (solo nota). */
  note?: string
  /**
   * Perizia APPROVATA dalla stazione appaltante: solo allora le nuove quantità
   * valgono come contratto (e i suoi nuovi prezzi smettono di essere provvisori).
   * Assente = approvata: le perizie dei progetti già in corso restano valide.
   */
  approvata?: boolean
  dataApprovazione?: string
}

/** Riga del giornale dei lavori (art. 12): annotazione giornaliera. */
export interface RigaGiornale {
  data?: string
  meteo?: string
  manodopera?: string
  mezzi?: string
  lavorazioni?: string
  note?: string
}

/**
 * RISERVA dell'esecutore (art. 115 c. 2 D.Lgs. 36/2023; art. 7 All. II.14).
 *
 * Una riserva non è una lamentela: è un atto a forma vincolata, e il vincolo è
 * quasi tutto sui tempi. Va iscritta nel PRIMO ATTO IDONEO a riceverla
 * (di norma il registro di contabilità alla firma del SAL), a pena di
 * decadenza; va poi ESPLICITATA — domande e quantificazione — entro
 * QUINDICI GIORNI dall'iscrizione, sempre a pena di decadenza; il DL risponde
 * con le proprie deduzioni motivate; e va infine CONFERMATA alla firma del
 * conto finale, o si ha per abbandonata.
 *
 * Questi campi tengono insieme i quattro momenti, così che il programma possa
 * dire al DL che cosa scade e quando — e stamparlo sul registro.
 */
export interface Riserva {
  numero: number
  /** Data di iscrizione (quella che fa decorrere i 15 giorni). */
  data?: string
  salNumero?: number
  oggetto: string
  /** Importo della pretesa (quantificazione), come esplicitata dall'esecutore. */
  importo?: number | null
  /** Controdeduzioni motivate del DL. */
  controdeduzioni?: string
  /** Atto su cui la riserva è stata iscritta (es. «Registro di contabilità al SAL n. 2»). */
  attoIscrizione?: string
  /** Data dell'esplicitazione (domande e quantificazione): entro 15 gg dall'iscrizione. */
  dataEsplicitazione?: string
  /** Domande e ragioni dell'esecutore (il contenuto dell'esplicitazione). */
  esplicitazione?: string
  /** Confermata alla firma del conto finale (art. 7 c. 3): altrimenti si ha per abbandonata. */
  confermataContoFinale?: boolean
  /** Esito: definita in corso d'opera (accordo bonario/transazione) o rinunciata. */
  esito?: EsitoRiserva
  /** Nota sull'esito (atto, data, importo riconosciuto). */
  notaEsito?: string
}

/** Come finisce una riserva: aperta, definita in corso d'opera, rinunciata, decaduta. */
export type EsitoRiserva = 'aperta' | 'definita' | 'rinunciata' | 'decaduta'

/**
 * Verbali e comunicazioni del Direttore dei Lavori che vivono IN PARALLELO alla
 * contabilità (D.M. 49/2018 artt. 5, 13; D.Lgs. 36/2023 artt. 120-121 e All.
 * II.14). Sono atti pubblici datati che si collocano sulla cronologia di cantiere
 * e costituiscono allegati obbligatori del conto finale.
 */
export type VerbaleTipo =
  | 'consegna'      // verbale di consegna dei lavori (unica/parziale/urgenza)
  | 'ordine'        // ordine di servizio (DL → esecutore)
  | 'sospensione'   // verbale di sospensione dei lavori
  | 'proroga'       // concessione di proroga del termine (art. 121 c. 1)
  | 'ripresa'       // verbale di ripresa dei lavori
  | 'nuoviprezzi'   // verbale di concordamento nuovi prezzi
  | 'accertamento'  // processo verbale di accertamento (fatti/prove/anomalie)
  | 'ultimazione'   // certificato di ultimazione dei lavori
  | 'relazioneRup'  // relazione/comunicazione al RUP

/** Un verbale/comunicazione del DL. `tipo` discrimina quali campi opzionali contano. */
export interface Verbale {
  id: string
  tipo: VerbaleTipo
  /** Data di riferimento dell'atto (gg/mm/aaaa) — lo colloca sulla timeline. */
  data?: string
  /** Progressivo per tipo (es. «Ordine di servizio n. 3»). */
  numero?: number
  /** Oggetto/titolo dell'atto. */
  oggetto?: string
  /** Corpo libero (paragrafi separati da a-capo). */
  testo?: string
  // ── campi per-tipo (usati solo dai tipi pertinenti) ──
  /** consegna: modalità della consegna. */
  consegnaMod?: 'unica' | 'parziale' | 'urgenza'
  /** sospensione: durata stimata in giorni · ripresa: giorni residui contrattuali. */
  giorniDurata?: number | null
  /** sospensione: motivo/causa della sospensione. */
  motivo?: string
  /** proroga: giorni concessi sul termine contrattuale. */
  giorniProroga?: number | null
}

/**
 * LAVORI IN ECONOMIA (liste settimanali: prassi dell'ex D.M. 49/2018 art. 14):
 * lavorazioni eseguite su ordine del DL e contabilizzate non a misura/corpo ma
 * per risorse effettivamente impiegate, tramite le LISTE SETTIMANALI di operai,
 * mezzi/noli e provviste, valorizzate e firmate in contraddittorio (duplice copia,
 * una in bollo). Confluiscono nel libretto/registro/SAL del SAL di competenza.
 */
export interface RigaOperaio { qualifica?: string; nominativo?: string; ore?: number | null; tariffaOraria?: number | null; lavorazione?: string }
export interface RigaMezzo { descrizione: string; ore?: number | null; tariffaOraria?: number | null }
export interface RigaProvvista { descrizione: string; um?: string; quantita?: number | null; prezzoUnitario?: number | null }

/** Una lista settimanale in economia (atto pubblico datato). */
export interface ListaEconomia {
  id: string
  /** Progressivo della lista. */
  numero?: number
  /** Settimana di riferimento (gg/mm/aaaa). */
  data?: string
  /** SAL di competenza: la lista confluisce nel libretto/registro di questo SAL. */
  salNumero?: number
  /** Riferimento all'ordine di servizio del DL che ha disposto i lavori in economia. */
  ordineRef?: string
  operai: RigaOperaio[]
  mezzi: RigaMezzo[]
  provviste: RigaProvvista[]
  note?: string
  /** SAL in cui la lista è stata soppressa (stornata): niente cancellazioni (come le partite). */
  soppressaSal?: number
}

/**
 * FATTURA DI SPESA dell'esecutore, con il **visto del direttore dei lavori**.
 * Nella contabilità semplificata è l'atto che chiude il giro: il DL verifica
 * che il lavoro svolto corrisponda a quanto fatturato — tenendo conto dei
 * lavori effettivamente eseguiti — e appone il visto, che può sostituire il
 * certificato di regolare esecuzione (art. 12 c. 11-bis All. II.14).
 */
export interface Fattura {
  id: string
  /** Numero della fattura, come lo scrive l'impresa. */
  numero?: string
  /** Data della fattura (gg/mm/aaaa). */
  data?: string
  /** Importo imponibile della fattura (netto IVA). */
  importo?: number | null
  /** Che cosa fattura (descrizione sintetica delle lavorazioni). */
  oggetto?: string
  /** Data in cui il DL ha apposto il visto; assente = non ancora vistata. */
  vistoData?: string
  /** Rilievi del DL, se il visto non è pieno. */
  rilievi?: string
  /** Il visto sostituisce il certificato di regolare esecuzione (art. 12 c. 11-bis). */
  sostituisceCre?: boolean
}

/** Stato completo del tool (serializzabile per .ehub / bozza locale). */
export interface StatoBeta {
  v: 1
  appalto: Appalto
  partite: Partita[]
  sals: Sal[]
  giornale?: RigaGiornale[]
  riserve?: Riserva[]
  /** Testo libero delle «vicende dell'esecuzione» per la relazione finale. */
  relazione?: string
  /** Verbali e comunicazioni del DL (consegna, sospensione, ordini di servizio, …). */
  verbali?: Verbale[]
  /** Liste settimanali dei lavori in economia. */
  economia?: ListaEconomia[]
  /** Storico dei documenti consegnati. */
  consegne?: Consegna[]
  /** Fatture di spesa dell'esecutore, con il visto del DL (contabilità semplificata). */
  fatture?: Fattura[]
}

# Novità di Quadra

## 0.11.0 — 18 novembre 2026

**Il ribasso si applica una volta sola, e il computo resta il contratto**

### I conti
- **Il ribasso d'asta veniva applicato due volte.** All'import i prezzi unitari venivano ribassati, e poi la cascata del SAL deduceva di nuovo il ribasso sul totale dei lavori. Ora la contabilità si tiene ai **prezzi di elenco del progetto esecutivo**: libretto e registro si scrivono a quei prezzi, e il ribasso si deduce **una volta sola, sul totale dei lavori del SAL**. Gli oneri della sicurezza non lo subiscono.
- Stessa regola per i **nuovi prezzi** presi dal prezzario: entrano al loro valore, chiaramente identificati come NP, e il medesimo ribasso li raggiunge alla fine con tutto il resto (All. II.14 art. 5 c. 7). La scheda del NP continua a dichiarare a quale ribasso è assoggettato.
- Resta l'eccezione dell'**offerta a prezzi unitari**: lì ogni prezzo è già quello offerto e non c'è nulla da dedurre.

### Il computo è il contratto, non la contabilità
- Usare il computo come contratto **non riversa più tutte le misurazioni** nel primo libretto. Entrano gli articoli — elenco prezzi, quantità e misure di progetto come riferimento — e il libretto nasce **vuoto**: le quantità eseguite le scrive il direttore dei lavori, prendendo se vuole le misure di progetto dal cassetto, o tutte insieme con «↻ Dal computo» se lo decide lui. Riempirlo da soli significava contabilizzare l'intero appalto al primo SAL.
- L'import ora chiede **come** importare: *aggiungere a quello che c'è*, oppure *cancellare tutto e importare pulito* — con una conferma, e non disponibile quando ci sono SAL firmati, perché un atto firmato non si cancella.

### Interfaccia
- **L'anteprima di stampa non è più una pagina bianca.** Il visore PDF di Chromium è un plugin e in Electron era spento: il documento era perfetto, non si vedeva. E se il visore mancasse, l'anteprima lo dice invece di restare bianca.
- **Codici leggibili**: la casella di selezione ereditava la larghezza dei campi dentro le tabelle e si mangiava la colonna, finendo sopra il codice.
- **Il tasto destro funziona anche nel libretto e in perizia**, come nel computo: assegna categoria, assegna WBS, apri le misure, deseleziona, elimina/storna. Maiusc o Ctrl sul clic aggiungono la riga alla selezione.

## 0.10.0 — 18 novembre 2026

**Il flusso smette di avere buchi**

Questa versione nasce da una verifica guidata sul programma vero, non a memoria: dove il lavoro si inceppava, perché, e che cosa serviva per non incepparsi più.

### Il ponte col Computo non è più muto
- Promuovi il computo a contratto e la Contabilità **lo dice**: «Pronto nel Computo · 125 voci · ribasso 5,086% — ⇩ Usa come contratto», un clic e le partite sono dentro. Prima riceveva tutto e scriveva «nessun computo importato», offrendo solo un file da cercare.
- Un lavoro ereditato da un file di **contabilità** non porta le quantità di progetto: il contratto vigente restava a zero e ogni perizia sembrava tutta in aumento. Ora il computo di contratto importato dopo **completa le quantità che mancano**, senza mai riscrivere un contratto che c'è già, e lo dice prima di farlo.

### I dati del lavoro stanno in un posto solo
- Oggetto, comune, CUP/CIG, committente, RUP, progettista, coordinatore, direttore dei lavori, impresa, prezzario e contratto si scrivono **una volta sola, da uno qualunque dei due strumenti**, e viaggiano nell'altro. Prima andavano solo dal Computo in qua: chi correggeva il CIG nella contabilità se lo ritrovava vecchio nelle stampe del computo.

### Lavorare su più voci insieme
- Casella di selezione su ogni riga di libretto e perizia, **Maiusc** per prendere un intervallo, «tutte» in testata. Sulla selezione: **categoria**, **WBS** (anche progressiva: `01.02.*` numera da sola) ed **elimina / storna**, che applica in fila la regola di sempre — si elimina ciò che non è ancora contabilizzato, si storna il resto.

### Un altro lavoro come sorgente di voci
- Trascini un file **.quadra** (anche salvato col formato di prima) o un XPWE sulla finestra e lo apri **in sola lettura**: le sue voci si cercano come un prezzario e si pescano una alla volta. Il file sorgente non viene mai scritto. Su un programma vuoto, invece, un XPWE trascinato diventa il lavoro.

### La perizia è una schermata vera
- Il cassetto in perizia ha le stesse schede del libretto — **Contratto · Prezzario · Altro lavoro**: prima mostrava solo le misure di progetto. Una voce pescata dal prezzario entra **nella perizia** come nuovo prezzo di quella perizia, col ribasso contrattuale applicato, invece di finire nel libretto del SAL.
- Il **totale resta in fondo alla finestra** anche scorrendo (era chiuso in un contenitore alto quanto lui) e la barra dei comandi si ferma esatta sotto la testata.

### Non si esce più portandosi via il lavoro
- Alla chiusura, se ci sono modifiche non ancora in un file .quadra, il programma chiede: **Salva · Esci senza salvare · Annulla**.

## 0.9.0 — 18 novembre 2026

**Una sola interfaccia per ogni operazione**

Il filo di questa versione è uno: se due schermate fanno la stessa cosa, sono la stessa schermata. Chi impara il computo sa già usare il libretto e la perizia.

### La barra delle voci è una sola
- Computo, libretto di ogni SAL e perizia hanno ora **gli stessi comandi, nello stesso ordine, nella stessa posizione**: ricerca · vista (Tabella, Elenco, Capitoli) · ordinamento (Manuale, Categorie, WBS) · espandi tutte · voce dal prezzario, voce libera, nuovo prezzo · importa ed esporta XPWE · revisioni, struttura, stampe · guida. Uno slot che su una pagina non serve resta vuoto: gli altri non si spostano.
- In coda restano i soli pulsanti della fase: *Promuovi a contratto* nel computo, *Data* e *↻ Dal computo* nel libretto, *Allinea le quote a corpo* e *Quadro comparativo* in perizia.
- **Importa ed esporta XPWE ci sono su ogni schermata**, anche sul libretto di un SAL e sulla perizia, e la schermata da cui si parte è la destinazione proposta dell'import.
- In contabilità arrivano le **viste** (una riga per voce, o raggruppate per capitolo con il totale di ognuno), l'**ordinamento per WBS** — il codice WBS ora viaggia con le voci importate — e il pannello **Struttura** per assegnare categoria e WBS.
- In fondo a ogni schermata, sempre, il totale: nel SAL la cascata dell'importo, in perizia la differenza sul contratto vigente.

### Una sola interfaccia di stampa
- Al posto di sei pulsanti diversi (di lavoro, PDF, Word, ODT, solo questo atto, emetti gli atti del SAL) **un solo comando**: `⎙ Stampa…`, che apre sempre la stessa finestra con tre domande — **che cosa** (questo atto o tutti gli atti della tappa), **come** (definitiva, registrata con l'impronta, oppure copia di lavoro), **in che formato** (pagina, PDF da registro, Word, ODT).
- **Prima l'anteprima, poi la stampa**, dappertutto: anche i PDF del Computo ora si guardano prima e si stampano o si salvano dagli stessi due pulsanti.
- Il **fascicolo di una tappa resta una sola operazione** anche a file separati: esce un archivio zip con un documento per atto, invece di cinque schede da chiudere a mano.
- Le impostazioni di stampa (foglio, margini, carattere, testata) stanno dentro quella finestra e valgono per tutto il programma.
- Ogni atto si apre allo stesso modo, a tutta pagina: prima alcuni erano finestre e altri pagine, con barre diverse.

### La perizia è un atto, non una tabella
- La stampa della perizia è ora **l'atto**: motivazione (con l'avviso quando manca — senza motivazione la variante non è legittima), che cosa cambia, quadro economico di raffronto, nuovi prezzi, firme. Il **quadro comparativo** è un suo elaborato e si stampa a parte.
- Quando le voci vengono da un file di contabilità, che non porta le quantità di progetto, la perizia lo **dice** e offre il rimedio, invece di mostrare un contratto vigente a zero.

### La cronologia segue i fatti
- A parità di data una **perizia che vale dal SAL n precede quel SAL**, e il SAL aperto dopo la perizia le viene subito dopo.

### I due elenchi prezzi si distinguono
- Il binario del Computo non è più una procedura numerata ma cinque aree: **EP prezzari** (i listini caricati, col loro numero: restano finché non li togli o li aggiorni) · **EP progetto** (gli articoli di questo lavoro, col loro numero) · Dati generali · Misure · Categorie / WBS.
- L'area Elenco prezzi dichiara **quale versione è in vigore** e mostra la catena: contratto → perizia n. 1 → … I SAL già firmati restano ai prezzi di allora.
- Guida e tour dicono la stessa cosa delle schermate.

## 0.8.7 — 18 novembre 2026

**Una sola schermata per tutte le stampe del lavoro**

- Le carte di un lavoro sono un elenco solo — progetto, gara, contabilità, interscambio — e adesso si vedono **tutte da tutti e due gli strumenti**, nella stessa schermata e con le stesse quattro aree. Dal Computo si vedono gli atti di ogni SAL con il loro numero; dalla Contabilità si vedono computo, elenco prezzi, incidenze, quadro economico, lista delle lavorazioni ed esportazioni.
- Le stampe dell'altro strumento **portano lì con la stampa già scelta**: si apre quello strumento e parte quella stampa, invece di lasciare chi la cercava a ritrovarla in un altro elenco.
- Nessuna tappa della catena è obbligatoria: le fasi di progetto compaiono solo se esistono (chi non ha il PFTE non lo vede), e i passi non ancora fatti restano in grigio senza chiedere niente.

## 0.8.6 — 18 novembre 2026

**Una sola interfaccia: stampe, inserimento voci, catena del lavoro**

### Le preferenze di stampa sono una sola, per tutte le stampe
- Erano tre — quelle del computo, quelle degli atti contabili e lo stile del foglio — e non si parlavano: le **prime 3 e le ultime 2 righe** impostate nel computo non valevano nel libretto, che ne stampava 4 e 3 scritte dentro il codice. Ora descrizione, righe iniziali e finali, formato, margini, carattere, corpo, testata e cartiglio stanno in un posto solo e valgono per **ogni stampa**, di progetto e di contabilità.
- Il **ribasso** si stampa e si legge con le cifre che ha davvero: 5,086%, non 5,09% — anche nella linea del tempo.

### Il computo consuntivo si stampa dalla contabilità
- Nuova stampa: la contabilità letta come un computo — quantità eseguite, prezzi di contratto, categorie, misure del libretto — con le stampe del progetto. Serve al direttore dei lavori per controllare, e l'atto dichiara che **non è un atto contabile**.

### Come si aggiunge una voce: sempre allo stesso modo
- Le tre strade — **dall'elenco prezzi, voce libera, nuovo prezzo** — sono una barra sola sopra l'elenco, dove si sta lavorando, uguale nel libretto del SAL e nella perizia. Prima stavano in fondo alla pagina, e nella perizia non c'erano affatto: per introdurre una lavorazione nuova bisognava passare dal libretto.
- Nella perizia si può **importare un XPWE dentro la perizia aperta**: il confronto si fa col contratto vigente e il risultato sostituisce le sue voci, senza perderne numero e data. È il modo di allineare un lavoro già avviato con un altro programma.

### La catena del lavoro racconta tutto il lavoro
- In testa alla catena compaiono le **fasi di progetto** congelate nel Computo (PFTE, definitivo, esecutivo…), con nome e data: la storia non comincia alla firma del contratto.
- La **perizia sta dove vale**, fra il SAL precedente e quello da cui entra in vigore, non più in testa a tutto.

### Gli atti del SAL: un file per atto, o un fascicolo unico
- Si sceglie. Un file per atto serve a protocollarli e firmarli separatamente; il fascicolo unico resta per chi lo preferisce. In entrambi i casi gli atti vengono registrati nello storico allo stesso modo.

## 0.8.5 — 18 novembre 2026

**Tempi, penali, svincolo della ritenuta, giornale dei lavori, giro di ritorno dell'XPWE**

### I tempi contrattuali si contano dagli atti, in un posto solo
- Nuovo modulo dei tempi: consegna, tempo utile, **sospensioni e riprese periodo per periodo**, **proroghe concesse**, termine vigente, giorni residui o di ritardo. Una sospensione senza verbale di ripresa non somma giorni presunti: resta aperta e lo si dichiara; un termine che non si può calcolare dice quale dato manca.
- Nuovo atto **«Concessione di proroga»** (art. 121 c. 1) con i giorni concessi e l'istanza dell'esecutore.
- Lo **stato di avanzamento** porta il prospetto dei tempi: la catena che va dal termine di contratto a quello vigente, con i periodi uno per uno. Senza i periodi, «+45 giorni di sospensione» è un numero di cui nessuno può rispondere.

### Penale per il ritardo (art. 126)
- Penale giornaliera in per mille dell'ammontare netto contrattuale (il contratto la fissa fra 0,3 e 1), contata sui giorni di ritardo rispetto al **termine vigente** — non a quello di contratto, altrimenti una sospensione regolarmente verbalizzata si trasformerebbe in una trattenuta.
- Ricondotta al **tetto del 10%**, con l'avviso che oltre quella soglia il RUP valuta la risoluzione del contratto. Entra come detrazione nel conto finale, con il prospetto del calcolo.

### Svincolo della ritenuta di garanzia (art. 125 c. 2)
- Le ritenute dello 0,50% si svincolano **soltanto** in liquidazione finale, dopo l'approvazione del certificato di collaudo (o di regolare esecuzione) e con DURC regolare. Il conto finale dice se si svincola e, quando no, **quale delle due condizioni manca** — invece di lasciare un numero in fondo a una colonna.

### Il giornale dei lavori dà conto anche degli atti
- Era un diario a mano. Ora le annotazioni del direttore dei lavori e gli **atti già redatti** — ordini di servizio, sospensioni e riprese, proroghe, stati di avanzamento, riserve iscritte — stanno insieme, in ordine di data e raggruppati per mese, con gli atti dichiarati come tali.
- Non vengono ricopiati (sarebbero due verità diverse dello stesso fatto): restano negli atti che li portano, e il giornale ne dà conto alla loro data. La stampa si può restringere a un periodo.

### Giro di andata e ritorno dell'XPWE
- Quello che Quadra scrive, Quadra lo rilegge identico: misure fattore per fattore, quantità e importi al centesimo, categorie, WBS, declaratorie, voci di sicurezza. Verificato anche su una contabilità reale: 125 voci e 159 misure del computo, 78 voci e 103 misure della contabilità, totali invariati.
- Il tracciato di interscambio non sa rappresentare i **lavori a corpo**, i **nuovi prezzi** con la voce da cui derivano, l'analisi prezzi e il **prezzo offerto**: prima si perdevano riaprendo il file. Ora viaggiano in un elemento che gli altri lettori ignorano, e si possono escludere per un file di massima compatibilità.

## 0.8.4 — 18 novembre 2026

**Due avanzamenti aperti insieme: si può, ma il programma lo dice**

- Il SAL successivo si apre anche quando il precedente non è firmato — il cantiere va avanti anche mentre un avanzamento aspetta una firma — ma il nuovo parte dalle **quantità progressive** di quello prima: se quello cambia ancora, il nuovo è partito da un numero che non c'è più. Ora il programma lo chiede prima di aprirlo, e il riquadro «E adesso» lo scrive accanto al pulsante.
- Resta invariato ciò che la firma comporta davvero: libretto, registro e stato di avanzamento in sola lettura, fascicolo sigillato con l'impronta, e una base che non si muove più sotto l'avanzamento seguente.

## 0.8.3 — 17 novembre 2026

**Impostazioni di stampa, e i passi che vengono dopo un avanzamento**

### Impostazioni di stampa
- Nuova finestra **⚙ Impostazioni di stampa**, accanto ai pulsanti di stampa di ogni atto: formato del foglio (A4, A3, Letter, Legal), orientamento, i quattro margini in millimetri, carattere (lineare, graziato, monospazio) e corpo in punti, **testata** e **piè di pagina** da togliere o rimettere — togliere la testata serve a stampare su carta intestata già prestampata.
- Si sceglie anche **quante righe di declaratoria** stampare all'inizio e alla fine quando la descrizione è parziale, e se stampare le date dei rilevamenti nel libretto. Il taglio avviene su parola intera e dichiara l'omissione con […].
- Le impostazioni valgono per **tutti gli atti**, in anteprima e in stampa definitiva, e restano nel programma: non entrano nel file del lavoro e non toccano il documento registrato nello storico, perché è su quello che si calcola l'impronta. Margini e carattere non cambiano un atto.

### E adesso: il SAL successivo e la perizia
- In fondo alla catena documentale compare il riquadro **«E adesso»** con i passi possibili dopo un avanzamento: **＋ Stato di avanzamento n. (successivo)**, **＋ Perizia di variante**, verbale del DL, import di voci. Erano comandi del solo pannello di sinistra, che sparisce quando si apre un atto a tutta pagina: chi aveva appena firmato il SAL non li trovava più.
- Il riquadro dice anche che cosa comporta il passo: una perizia in bozza non cambia il contratto, e vale dal SAL successivo in poi lasciando intatti gli avanzamenti firmati.

### Il ribasso si scrive come è stato offerto
- **5,086%**, non 5,09%: la percentuale del ribasso si stampa con le cifre decimali che ha davvero (fino a cinque). Arrotondarla in un atto contabile significa dichiarare una condizione contrattuale diversa da quella pattuita.
- L'**oggetto dei lavori** nella riga di testata non si taglia più a metà parola: si accorcia su parola intera, con i puntini, e manda a capo invece di finire fuori pagina.

## 0.8.2 — 17 novembre 2026

**Il 5,086% letto come 5086%, e gli atti che vanno a pagina nuova per ogni voce**

### I numeri si leggono con i separatori del sistema
- Un campo numerico restituisce sempre il valore in forma canonica — punto decimale, mai separatori delle migliaia — qualunque lingua usi chi digita: «5,086» scritto su un computer italiano torna al programma come «5.086». Veniva letto con le regole italiane, cioè **cinquemilaottantasei**: il ribasso d'asta diventava 5086% e il certificato di pagamento chiudeva a meno cinque milioni di euro.
- Adesso i numeri hanno **due letture distinte**: canonica per i campi numerici, e con i separatori **della lingua di sistema** per i campi di testo, dove un separatore seguito da una o due cifre è sempre decimale e solo l'ambiguità vera (tre cifre) la decide la lingua.
- Un **ribasso fuori da 0 e 100** non è un ribasso: l'atto lo dichiara non plausibile e scrive di non liquidare gli importi finché il dato non è corretto.

### Stampe: continuità e quanto testo portare
- Gli atti **non vanno più a pagina nuova per ogni voce**. Una riga più alta dello spazio rimasto lasciava mezzo foglio bianco: ora le righe di testo si spezzano, mentre le righe SOMMANO, di richiamo e di totale restano intere, perché vanno lette tutte insieme.
- Si sceglie **quanto testo stampare** — descrizione breve, inizio e fine della declaratoria, oppure intera — e, nel libretto, **se stampare le date dei rilevamenti**. La scelta sta accanto ai pulsanti di stampa dell'atto e si ricorda.

### Dove si è arrivati, mentre si misura
- Il **libretto a schermo** ha il totale di quello che si sta misurando: voci misurate sul totale, eseguito a tutto il SAL, di cui costi della sicurezza, quanto è stato contabilizzato in questo avanzamento e l'importo che andrebbe in certificato.

### Perizia: si crea mentre si importa
- Un computo di variante non aveva dove andare finché la perizia non esisteva. Nella finestra di import, **«＋ Crea una perizia di variante e usala come destinazione»**: la apre in bozza dal SAL successivo all'ultimo e ci versa dentro le misure del file.

### Correzioni minori
- Il registro non elenca più i **certificati oltre il SAL in corso**, e un credito nullo o negativo lo dichiara invece di scriverlo come importo da certificare.
- In **Amministrazione** sono spariti due conteggi rimasti dal programma di partenza (planimetria condivisa, cavidotti e circuiti): al loro posto le voci di computo e gli stati di avanzamento del progetto aperto.

## 0.8.1 — 17 novembre 2026

**Verifica su un lavoro vero: le cifre tornano al centesimo**

Confronto delle stampe di Quadra con quelle di un SAL già emesso con un altro programma, sulla stessa contabilità. Le differenze trovate erano tre, e nessuna era un errore di calcolo: erano dati del contratto che la contabilità non porta con sé, e documenti che dicevano più o meno di quanto devono dire.

### Il ribasso d'asta non sta nella contabilità: va chiesto
- Il tracciato XPWE di una contabilità contiene committente, impresa, oggetto e opera: **non il ribasso d'asta**, che è una condizione del contratto. Finché non è indicato, gli importi restano al lordo — e un lordo letto come netto è un errore di liquidazione, non un dato incompleto.
- Subito dopo l'import Quadra chiede **ribasso, IVA, arrotondamento del certificato, contratto e tempi**; finché mancano resta un promemoria fisso nel pannello dell'appalto, e **stato di avanzamento e certificato lo dichiarano in testa all'atto**.

### Un libretto è un solo lavoro, non sei
- L'import della contabilità metteva ogni **data di misura** in un SAL diverso: sei giornate di rilievo diventavano sei avanzamenti. Adesso le misure vanno tutte nel **SAL n. 1** e ciascuna conserva la sua data nel libretto, dove deve stare. Chi ha davvero più SAL nel file li separa a mano, in un pannello a parte.

### Il libretto delle misure non ha prezzi
- Niente prezzi né importi, né a schermo né in PDF, nemmeno per le voci a corpo: il libretto è l'atto delle **quantità**, la valorizzazione è del registro.
- Ci entrano **solo le voci misurate**: le quantità ancora da rilevare non sono una scrittura contabile.
- Colonne come d'uso (par.ug., lunghezza, larghezza, H/peso, positivi, negativi), riga **SOMMANO** per voce e **data del rilevamento** sotto la tariffa.

### Registro, sommario, stato di avanzamento, certificato
- **Registro**: il totale comprende i **costi della sicurezza** (prima restavano fuori dal totale pur essendo iscritti fra le partite); la quantità progressiva si legge anche quando viene dalle righe di misura; nuova annotazione dei **certificati di pagamento emessi**.
- **Sommario**: rifatto **voce per voce** — richiamo al SAL e al numero d'ordine del registro, quantità contabilizzata in ciascun avanzamento, riga SOMMANO al SAL con prezzo unitario e importo, parziale di sezione e totale. Il riepilogo per gruppi di lavorazioni omogenee resta, in coda.
- **Stato di avanzamento**: riquadro **Dati generali** come sugli atti d'uso — contratto e sua registrazione, offerta, consegna, inizio, giorni utili, data utile per l'ultimazione (calcolata se non indicata), **giorni e numero di sospensioni contati dai verbali** di sospensione e ripresa, nuova data di ultimazione, importi di progetto, somme a disposizione, sicurezza, manodopera, variante, anticipazione. Un importo di contratto a zero si scrive «non indicato»: a zero non esiste.
- **Certificato di pagamento**: elenco dei **certificati precedenti** (numero, data, importo), così la detrazione si può verificare; le lavorazioni in economia entrano nella cascata come nello stato di avanzamento.

### Due strade che non portavano da nessuna parte
- Dal Computo il pulsante **Stampe** non apriva più nulla, e la stampa del computo metrico chiesta dalla Contabilità riportava al Computo senza aprire niente: quattro pannelli a tutta pagina si sovrapponevano. Adesso l'apertura di un'area chiude le altre, e la stampa attesa viene riaperta anche dopo il ripristino dello stato.

## 0.8.0 — 17 novembre 2026

**Gli atti si richiamano fra loro, i termini si vedono, l'elenco prezzi è un'area**

Questa versione nasce dalle questioni che tornano più spesso sui forum di settore: non errori di calcolo, ma atti che non si riescono a verificare e termini di legge mancati.

### Gli atti contabili si richiamano fra loro
- **Numero d'ordine di iscrizione** di ogni partita, stabile nel tempo: il libretto lo stampa, il registro lo richiama («LM 2 · n. 7»), il sommario richiama per ogni categoria il SAL e i numeri d'ordine del registro. Prima la colonna «Rif. libretto» del registro mostrava il codice della voce: non era un richiamo, era un'altra cosa.
- **Un solo registro, a fogli numerati e vidimati** (art. 14 All. II.14; art. 2215 c.c.): libretto e registro dei SAL successivi al primo **continuano la numerazione** e non ristampano il frontespizio. Le pagine già emesse le sa lo storico degli atti; se non le sa, la numerazione riparte da 1 e nessun atto dichiara un «segue» che non può dimostrare.
- **L'anticipazione come prima annotazione del registro**, fuori dal credito: è una somma già corrisposta, non un lavoro eseguito.

### Le riserve come vuole l'art. 7
- Iscrizione nel primo atto idoneo, **esplicitazione entro quindici giorni** con domande e quantificazione, deduzioni motivate del DL, **conferma alla firma del conto finale**. Quadra calcola la scadenza, segnala quando è vicina e dichiara il ritardo quando c'è — e quando manca la data di iscrizione dice che il termine non è calcolabile, invece di inventarlo.
- **Firma dell'esecutore sul registro**: senza riserve, con riserva (e allora partono i quindici giorni), oppure **rifiutata** — e in quel caso il programma crea il **verbale di rifiuto**, che va comunicato subito alla stazione appaltante.
- Il **conto finale** dice il termine di trenta giorni dall'invito del RUP, elenca le riserve da confermare una per una e scrive la conseguenza: chi non firma, o firma senza confermare, ha accettato.

### Scadenziario dei termini di legge
- Pannello sempre visibile con quello che scade davvero: **certificato di pagamento entro 7 giorni** dal SAL, **pagamento entro 30**, **anticipazione entro 15** dall'inizio dei lavori, **riserve entro 15** dall'iscrizione, **conto finale entro 30** dall'invito. I ritardi in testa; da ogni riga si va al punto del lavoro dove l'adempimento si compie.
- **Date del certificato e del pagamento** sul SAL, stampate sull'atto. Se la data del certificato manca, l'atto dichiara che il termine non è verificabile invece di far finta che sia quella del SAL.
- Lo scadenziario si stampa, ed è dichiarato **foglio di lavoro**, non atto contabile. I termini si leggono alla **data corrente** del programma, non all'orologio di sistema: la contabilità si scrive anche a mesi di distanza.

### L'elenco prezzi è un'area, nei due strumenti
- Una cosa è il **prezzario** (l'archivio regionale o del fornitore, che si apre a parte e da cui si pesca), un'altra l'**elenco prezzi di questo lavoro**. Adesso l'elenco ha il suo pulsante in testata, **nello stesso posto e con lo stesso nome** in Computo e in Contabilità, accanto alle Stampe.
- In Contabilità è una schermata nuova: articoli in ordine di iscrizione, prezzo di contratto e prezzo in contabilità (segnalato quando si scostano), provenienza (contratto, prezzario, nuovo prezzo con il suo iter, perizia) e i SAL in cui ogni voce è misurata. Si aggiunge una voce a mano o si pesca dal prezzario: entra **in elenco**, senza misure. Si elimina solo ciò che non è misurato in nessun SAL; il resto si storna dal libretto.
- Nel Computo l'elenco prezzi esce dalla finestrella e diventa una **schermata intera**. Il pannello flottante resta per chi lavora accanto alle misure.

### Atti che mancavano, e una soglia che decide
- **Atto di sottomissione / atto aggiuntivo** della perizia. Entro il quinto d'obbligo è un atto **unilaterale** che l'esecutore sottoscrive «per accettazione o con motivato dissenso» (art. 5 c. 6 All. II.14) e che lo obbliga agli stessi patti, prezzi e condizioni del contratto, salvi i nuovi prezzi concordati; oltre il quinto non si impone più nulla e serve un **atto aggiuntivo** bilaterale (art. 120 c. 9). Quadra sceglie la forma dal quadro comparativo e stampa il **quadro economico aggiornato** — le somme a disposizione restano dichiarate «da confermare», perché vivono nel quadro economico del progetto.
- **Contabilità semplificata** (art. 12 c. 11-bis, dal D.Lgs. 209/2024): per i lavori sotto i 40.000 euro il certificato di regolare esecuzione può essere sostituito dal **visto del DL sulle fatture**. L'interruttore si accende solo dove la norma lo consente — sopra soglia, o per servizi e forniture, resta spento e il programma dice perché. Attivo, le **fatture** entrano nella cronologia con il loro visto, e il visto non è un timbro: la norma chiede prima la verifica della corrispondenza fra lavoro svolto e fatturato, e Quadra la calcola e la mette davanti.
- **Registro di contabilità in bianco**: il registro è uno solo e le sue pagine vanno numerate, bollate e vidimate **prima** dell'inizio dei lavori (art. 2215 c.c.). Ora si stampano i fogli veri, rigati e numerati, con la dichiarazione di vidimazione da firmare.
- **Libretto dei sotto-computi**: in un appalto a corpo, da dove viene quel 35%? Un corpo d'opera si scompone nelle lavorazioni che lo formano; a ogni avanzamento si misura quanto di ciascuna è eseguito, e la quota ne discende invece di essere stimata. L'importo del corpo è l'eseguito **misurato**, non la percentuale arrotondata moltiplicata per il corpo; se la scomposizione non quadra con l'importo contrattuale il programma lo dice; e una scomposizione già usata da un SAL firmato si **congela**, perché cambiarla falsificherebbe una percentuale già attestata.

### Due errori di calcolo trovati e corretti
Cercando i casi limite della cascata del SAL — quelli che in un lavoro normale non si incontrano mai e in un lavoro vero arrivano tutti:
- **la ritenuta dello 0,50% non diventa più negativa.** Con detrazioni maggiori dell'eseguito il progressivo va sotto zero e la ritenuta veniva *restituita*: una garanzia mai trattenuta tornava all'impresa.
- **un credito negativo non si arrotonda più per difetto.** Con l'arrotondamento del certificato a 100 €, un credito di −50 diventava un certificato di −100: cinquanta euro trattenuti in più di quanto dovuto in quel certificato.
Attorno a questi, trentadue prove sui casi limite: detrazioni oltre l'eseguito, resto dell'arrotondamento che matura nel certificato successivo, anticipazione che si esaurisce, SAL che torna indietro per uno storno, ribasso che non tocca sicurezza ed economie, voci in percentuale, soglia e segno della revisione prezzi, oneri della sicurezza che non superano il pattuito.

### Importare in qualunque punto
- Quando il lavoro è già avviato — SAL emessi, magari firmati — l'import **aggiunge, non azzera**. Prima di procedere si vede che cosa cambierà: quanti articoli sono nuovi, quanti ci sono già, quali voci importare (una per una, con filtro e «tutte / nessuna»), e dove versare le misure (un libretto aperto o una perizia in bozza: i SAL firmati non compaiono).
- Se il file porta per una voce già in elenco un prezzo diverso, **resta quello di contratto**: un file importato dopo non riscrive il contratto. Reimportare lo stesso file non duplica nulla.

## 0.7.0 — 17 novembre 2026

**Contabilità digitale: il fascicolo firmato si sigilla, e si verifica** (quarto e ultimo passo del flusso unico)

- **Sigillo alla firma.** Quando firmi un SAL, Quadra calcola l'**impronta SHA-256** di ciò che gli atti affermano — voci, misure, quantità, prezzi, importi, detrazioni — e la scrive accanto alla data di firma. Il testo su cui si calcola è *canonico*: lo stesso fascicolo dà sempre la stessa impronta, e una virgola diversa la cambia. Note e sblocchi non contano: il sigillo copre i numeri della contabilità, non la cronaca del file.
- **Verifica.** «⟳ Verifica i fascicoli firmati» ricalcola le impronte e dice se i fascicoli sono ancora quelli: *integro* o **modificato dopo la firma**. Si verifica anche un SAL **sbloccato** che porta un sigillo — è lì che la domanda conta davvero.
- Nuovo atto **«Registro degli atti prodotti»** (All. II.14 art. 12 c. 10): tutti i documenti stampati con data e impronta, i sigilli dei SAL con l'esito della verifica, e un avviso in chiaro se un fascicolo risulta modificato. Dichiara anche quello che un'impronta **non** è: non è una firma digitale e non sostituisce la sottoscrizione del DL e del RUP.
- **Export in formato aperto**: un pacchetto zip con `contabilita.json` (tutti i dati), le viste in CSV (`voci`, `misure`, `eseguito`, `sal`, `impronte`) e un **LEGGIMI** che spiega com'è fatto e dichiara le impronte. CSV col punto e virgola e la virgola decimale: si apre in Excel o LibreOffice italiano con un doppio clic. Serve a una cosa sola: che la contabilità resti leggibile anche senza Quadra.
- Se l'ambiente non può calcolare l'impronta (una pagina servita in http semplice), Quadra **lo dice** e firma senza sigillo, invece di scrivere un'impronta finta.

## 0.6.2 — 17 novembre 2026

**Il programma si chiama Quadra, e lo dice in ogni punto**

- **I file si chiamano col loro nome**: `Quadra.html`, `Computo.html`, `Contabilita.html`, `Amministrazione.html` (prima `EHub.html`, `miu.html`, `Beta.html`, `Alfa.html`). È quello che si legge nella barra dell'indirizzo quando Quadra gira da browser.
- **Via le lettere greche dall'interfaccia**: il pannello della memoria di studio diceva «μ» e «α» al posto di *Computo* e *Amministrazione*; il compositore mostrava «thesaurus μ» e una briciola di navigazione «μ ▸ …». Ora i tool si chiamano Computo, Contabilità e Amministrazione, dappertutto — anche nei commenti del codice, con una guardia nei test perché non tornino.
- **Via i riferimenti a due strumenti che Quadra non ha**: la guida rapida prometteva ancora «δ Copertine» e «χ Refs» (copertine degli elaborati e smistamento layer DXF, rimossi), e il design system teneva i loro colori e le loro icone. Tolti insieme alla categoria «Progettazione», che era vuota.
- **La riga di comando** si invoca con `npm run quadra` (prima `npm run ehub`), e un progetto si chiama `progetto.quadra`.
- **Correzioni**: le segnalazioni di sicurezza e i link alle release puntavano al repository da cui Quadra deriva, non a quello di Quadra; la pagina principale su GitHub parlava ancora della versione 0.1.
- I progetti salvati prima di questa versione **si aprono come sempre** (`.ehub` compresi): è cambiato il nome, non il formato. L'avviso di copyright di Open E.Hub resta in LICENSE e nei crediti, come vuole la licenza MIT.

## 0.6.1 — 17 novembre 2026

**Si misura in un modo solo, in ogni fase**

- Anche la **perizia** si misura come il computo e come il libretto: la nuova quantità di contratto si apre con **«▸ dettaglia»** nella stessa tabella (par.ug. × L1 × L2 × H), con le stesse formule, gli stessi tasti, lo stesso trascinamento delle righe, la **riga in detrazione** e il **«↧ Misure di progetto»** per partire da quelle del computo. La quantità è la somma delle misure; si può ancora scrivere a mano, con la virgola.
- Le voci **a corpo** restano con il loro importo: un corpo d'opera non si misura.
- Una perizia **approvata** è in sola lettura anche nelle misure: prima si riporta in bozza.
- Sotto il cofano i comandi delle misure parlano di **contesto** (il SAL n, oppure la perizia n), così non esistono più due interfacce da tenere allineate.

## 0.6.0 — 17 novembre 2026

**Le versioni del progetto** (terzo passo del flusso unico)

- **La perizia è una tappa del lavoro, non una finestra.** Sta nella cronologia alla sua data, si apre **a tutta pagina** dalla linea del tempo come il libretto, e porta con sé quadro comparativo, voci variate e i **suoi** nuovi prezzi.
- **Iter della perizia**: *in bozza* → *approvata*. Finché è in bozza **non cambia il contratto**: le quantità di contratto restano quelle di prima e i suoi nuovi prezzi si contabilizzano in conto provvisorio. All'approvazione le nuove quantità valgono come contratto **dal SAL indicato in poi** e i nuovi prezzi della perizia diventano **definitivi** in un colpo solo.
- Si **riporta in bozza** per correggerla, ma non se un SAL firmato la applica già: prima si sblocca quel SAL. All'approvazione, se la variazione supera il **quinto d'obbligo** (art. 120 c. 9), Quadra lo dice e chiede conferma.
- Un nuovo prezzo creato quando la variante non è ancora redatta resta «in formazione» e si **aggancia da sé** alla perizia che apri dopo.
- Nuovo atto **«Elenco dei nuovi prezzi della perizia»**, accanto al quadro comparativo, nella scheda della perizia.
- **Revisioni del computo** (μ): il computo di adesso si **congela** in una revisione con nome, fase (*PFTE, definitivo, esecutivo, contratto, perizia*) e data — una fotografia con i prezzi di allora — e si **confronta** col computo di adesso voce per voce: quantità allora e adesso, importi, differenze, voci variate, nuove e soppresse, con **quadro comparativo stampabile**. Le revisioni viaggiano nel file di progetto.
- La scheda a tutta pagina non ripete più il proprio titolo nell'intestazione.

## 0.5.0 — 17 novembre 2026

**I nuovi prezzi diventano un oggetto vero** (secondo passo del flusso unico)

- Una voce non prevista in contratto nasce **nuovo prezzo numerato**: codice **NP.01, NP.02…**, con la sua **derivazione** dichiarata — *per assimilazione da voce di contratto*, *desunto dal prezzario*, *da nuova analisi* — il **prezzo base**, il **ribasso contrattuale applicato** e il prezzo risultante.
- Nuovo comando **≈** nell'elenco prezzi del lavoro: crea un nuovo prezzo **per assimilazione** da una voce di contratto (il prezzo di contratto è già ribassato e non si ribassa due volte).
- **Iter del nuovo prezzo**: *in bozza* → *concordato* (verbale) → *approvato* (perizia), visibile sulla voce e modificabile dalla scheda **⚖ NP**, dove si scrivono anche prezzo base, ribasso e **motivazione** (che finisce nel verbale). Finché non è approvato, le sue lavorazioni restano **in conto provvisorio**.
- Nuovo atto **«Elenco dei nuovi prezzi»**, che compare nella catena documentale solo quando ce ne sono: tabella con derivazione, prezzo base, ribasso, prezzo e iter, e il conto di quelli ancora da approvare.
- Il **verbale di concordamento nuovi prezzi** ora porta con sé la stessa tabella: prima dichiarava la regola senza i prezzi che concordava.
- ＋ sull'elenco prezzi del lavoro **ripete** una voce già nel libretto; una voce nata in un SAL successivo, portata qui, comincia da questo SAL.

## 0.4.0 — 16 novembre 2026

**Un flusso solo: dal computo al conto finale** (primo passo del piano scritto in «Quadra — il flusso unico»)

- **Linea del tempo del lavoro**: una barra sola — *Contratto · perizie · SAL 1, 2, 3… · Conto finale* — in testa alla catena documentale **e** dentro il libretto. Dice dove sei (SAL aperto, SAL firmato, ribasso applicato) e porta dove serve con un clic.
- **Il cassetto è l'elenco prezzi del lavoro**, a tre schede: **Contratto** (le voci che il lavoro conosce, col loro prezzo, cercabili; ＋ le porta nel libretto o le ripete, e si trascinano fra le voci), **Progetto** (le misure con cui la voce è stata computata), **Prezzario** (solo per i nuovi prezzi).
- **«→ Promuovi a contratto»** nel Computo: si dichiara il **ribasso d'asta** (o l'offerta a prezzi unitari) e la Contabilità importa già ai **prezzi di contratto**; gli **oneri della sicurezza non si ribassano**.
- **Nuovi prezzi**: una voce presa dal prezzario che in contratto non c'è entra come **NP** con il **ribasso contrattuale già applicato** (All. II.14 art. 5 c. 7), dichiarato nel messaggio; è marcata NP nell'elenco prezzi del lavoro — ma solo se un contratto c'è.
- Ribasso e numeri dell'appalto si scrivono con la **virgola decimale**.
- Correzione: chiedere «il SAL è firmato?» per disegnare una schermata non fa più comparire l'avviso di blocco; firma e sblocco aggiornano subito la linea del tempo.

## 0.3.4 — 16 novembre 2026

**Correzioni alla 0.3.3**
- **Il riquadro bianco a destra sparisce.** Il cassetto delle misure di progetto restava visibile anche da chiuso (vuoto) e copriva l'elenco prezzi e i comandi in alto: ora da chiuso non occupa nulla.
- **Partire da zero si può davvero**: in «Importa computo» c'è il comando **«⊕ Parti da zero (senza computo)»**, che apre il primo SAL e porta dritto al libretto, dove le voci si creano libere o dall'elenco prezzi.
- La voce scelta dall'elenco prezzi compare subito nel libretto (prima bisognava riaprirlo).

**La contabilità si fa ai prezzi di contratto**
- Il prezzo del computo di progetto (o quello **offerto**, che è il prezzo del contratto) resta registrato su ogni voce come **prezzo di contratto**.
- Una voce presa dall'elenco prezzi che **è già in contratto** entra al prezzo di contratto, non a quello di listino di oggi (il prezzario serve a trovare la voce, non a riprezzarla); se in contratto non c'è, entra dichiarata come **nuovo prezzo** del SAL, da approvare.
- Se in libretto un prezzo viene cambiato, la voce lo dichiara «**fuori contratto**» e offre il ritorno al prezzo contrattuale con un clic.

## 0.3.3 — 16 novembre 2026

**Voce libera: prima la misura, l'articolo dopo**
- Computo: nuovo **«＋ Voce libera»** — una riga vuota su cui fissare subito una misura (un vano rilevato in cantiere, una quantità da non perdere). Finché resta vuota non è un nuovo prezzo e non prende un codice NP; l'articolo si assegna dopo con «⌕ assegna voce», che apre la modifica rapida sulla **ricerca nel prezzario**: misure, categoria e WBS restano dov'erano.
- Contabilità: stesso comando nel libretto, e **«✎»** su ogni voce per correggere codice, descrizione, unità e prezzo — con la ricerca nel prezzario che riempie i campi.

**Una contabilità può nascere da zero**
- Non serve più un computo importato: si apre il SAL, si apre il libretto e le voci si creano lì, libere o dall'elenco prezzi, esattamente come in un computo. Il computo di progetto resta la via comoda quando c'è, non un obbligo.

## 0.3.2 — 16 novembre 2026

**Le misure si trascinano, come nel computo**
- Nel libretto le righe di misura si **trascinano** per riordinarle, anche da una voce all'altra: stessa presa, stesso segno del punto di rilascio del Computo.
- Le misure di progetto vivono ora in un **cassetto** a fianco del libretto (non più una finestra): resta aperto mentre lavori, mostra designazione, fattori e quantità di ogni riga, segna quelle già prese e si **trascina** una riga nella tabella — entra come copia nel punto in cui la lasci. Restano il ＋ per riga e «↧ Prendi tutte».

## 0.3.1 — 16 novembre 2026

**Il libretto lavora a tutta pagina**
- Il Libretto delle misure non è più una finestra: occupa la pagina come il Computo, con la barra degli atti in testa e «← Catena documentale» per tornare. Gli altri atti restano schede.
- L'intestazione della tabella resta visibile anche qui, scorrendo le voci.

**Le misure del progetto entrano nel libretto**
- «▸ dettaglia» su una voce computata in progetto: se la quantità coincide, le **misure di progetto** entrano già fatte (restano correggibili con quello che il cantiere ha eseguito).
- Nuovo prospetto **«↧ Misure di progetto»** su ogni voce: si prendono tutte o una per volta. Le righe già nel libretto sono segnalate e non si ripetono per sbaglio; quelle prese sono copie, il computo di progetto non si tocca.

**Il SAL si stampa come fascicolo**
- Nuovo comando **«⎙ Atti del SAL»** (in testa al libretto e sulla fase): produce in un solo stampato **libretto, registro di contabilità, sommario, stato di avanzamento e certificato di pagamento**, uno per pagina, e li registra tutti nello storico. «⎙ Solo il libretto» resta per il singolo atto.

## 0.3.0 — 16 novembre 2026

**Misurare è lo stesso gesto, ovunque**
- La tabella delle misure è ora **un solo componente** per tutta la suite: il Computo e il Libretto delle misure montano la stessa interfaccia (designazione · par.ug. · L1 · L2 · H/peso · quantità), le stesse formule, gli stessi tasti, lo stesso copia/incolla. Un tasto nuovo o una colonna in più arrivano in tutti e due per costruzione.
- Anche nel libretto il campo mostra il **risultato** e, entrandoci, la **formula** da correggere — come nel computo.
- Le righe di misura del libretto hanno ora gli stessi comandi del computo (duplica, elimina, detrazione) e lo stesso promemoria dei tasti.

**L'elenco prezzi anche in contabilità**
- Nuovo pulsante **«⌕ Voce dall'elenco prezzi»** nel libretto: si sceglie il prezzario installato, si cerca per codice o per parole e la voce entra nel libretto con codice, descrizione, unità, prezzo e categoria del prezzario, pronta da misurare. Se non è in contratto è un **nuovo prezzo**, introdotto da quel SAL.
- La ricerca mette davanti le voci riconoscibili dal codice e dal titolo, non quelle che nominano le stesse parole solo dentro la declaratoria.

## 0.2.8 — 16 novembre 2026

**Interfaccia della Contabilità**
- La scheda non salta più in cima a ogni modifica: aggiungendo, spostando, duplicando o incollando una riga di misura la vista resta dov'era.
- L'intestazione delle tabelle (codice, designazione, prezzo, eseguito, importo) **resta visibile** mentre si scorre un libretto o un registro lungo.
- La riga che si sta compilando è evidenziata, e le righe si illuminano al passaggio del mouse.
- **Prezzi e quantità si scrivono all'italiana**, con la virgola decimale e anche come formula (prima il prezzo appariva «60.59»).
- Schede della catena documentale: il riferimento all'articolo non va più a capo; quelle non ancora disponibili dicono «serve il computo» invece di invitare a modificarle.
- Nuova striscia dei **primi passi** (1 dati appalto · 2 importa il computo · 3 apri il primo SAL): segnala dove sei e sparisce da sola quando il lavoro è avviato.

**Computo**
- Il suggerimento accanto alla ricerca non viene più tagliato a destra quando la finestra è stretta.

## 0.2.7 — 16 novembre 2026
- **Voci ripetute in contabilità**: l'import di una contabilità XPWE non accorpa più nulla — ogni voce del file resta una voce del libretto, anche se ripete lo stesso articolo nella stessa categoria e nello stesso SAL (la grondaia misurata due volte in giorni diversi resta due annotazioni, come nell'originale). Ciascuna si abbina a una partita di progetto ancora libera, preferendo quella della stessa categoria.
- Libretto: pulsante **⧉ ripeti la voce** — crea una seconda annotazione dello stesso articolo con misure proprie (la quantità di contratto resta sulla prima). Accorpare o ripetere una voce è una scelta del direttore dei lavori, non dell'import.
- La voce ripetuta è segnalata come «voce ripetuta» e non più come «nuovo prezzo».
- **Import XPWE: decide il file.** Una contabilità con misure datate entra come contabilità — resta da scegliere solo come ripartire le date nei SAL; un file senza date di misura entra come computo. Il bivio «computo o contabilità?» al momento dell'import non c'è più: se della contabilità appena importata ti servono solo voci, prezzi e quantità come contratto, il comando «↺ Usa «…» come computo» è lì, in «Importa computo», da dare quando vuoi.
- Correzione: aprendo un SAL nuovo, le misure riportate dal SAL precedente erano le stesse (non una copia) — scrivere nel libretto nuovo cambiava anche quello già prodotto. Ora ogni SAL ha le sue.

## 0.2.6 — 16 novembre 2026
- **Arrotondamento degli importi**: la metà del centesimo va sempre per eccesso (127,30 × 2,05 = 260,97, non 260,96), anche in negativo. Vale in tutto il programma: computo, stampe, contabilità, Excel.
- Categorizza: le voci sono raggruppate nell'ordine della Struttura (non più alfabetico).
- Riepiloghi del computo (categorie e WBS) divisi come il corpo: lavori a misura, lavori a corpo e **oneri della sicurezza evidenziati**, ognuno col suo subtotale.
- Nel riepilogo, il titolo di una sezione non resta più in fondo alla pagina separato dalle sue righe.
- **Libretto delle misure**: si compila come il computo — stesse colonne (designazione · par.ug. · L1 · L2 · H/peso), stesse formule (`12+250+65`, `2x3,5`, segno meno per le detrazioni), stessi tasti (Invio nuova riga, ↑ ↓ fra i campi, Alt+↑↓ sposta, Ctrl+D duplica, Ctrl+Canc elimina), duplica riga, copia/incolla fra voci e da Excel.
- Import di una contabilità XPWE: lo stesso articolo misurato in **categorie diverse** resta due voci distinte, come nel libretto d'origine (prima si fondevano in una sola).

## 0.2.5 — 16 novembre 2026
- Stampa del computo: casella «Includi anche la descrizione ridotta» (in grassetto sopra l'estesa; non ripetuta se l'estesa comincia già con lei). La scelta resta memorizzata.

## 0.2.4 — 16 novembre 2026
- **Ordine della struttura** (Super › Categoria › Sub): definito in Struttura con ↑ ↓ (anche per i rami senza voci) o preso dal file XPWE importato; vale a schermo, in stampa, nei riepiloghi, nel pannello di Categorizza e nei modelli.
- Categorizza: la × sulla chip toglie davvero una categoria non usata (anche se arrivava da un import, dalla struttura o dall'elenco predefinito); se è usata lo dice e non la toglie.
- La pillola «Elenco Prezzi» non copre più l'ultima voce del computo.
- Misure in detrazione: evidenziate in rosso anche mentre si scrivono; l'aiuto tasti spiega il segno meno.

## 0.2.3 — 16 novembre 2026
- XPWE: le righe di misura **in detrazione** (anche i «vedi voce» negativi) si leggono col segno meno; in esportazione escono con fattori positivi e segno nel flag della riga.
- Computo: dopo aver trascinato una voce (o qualsiasi modifica) la vista resta dov'era, non torna in cima.

## 0.2.2 — 16 novembre 2026
- All'uscita si ricordano dimensione e posizione della finestra (anche massimizzata o a schermo intero); se lo schermo non c'è più, la finestra si riapre al centro.

## 0.2.1 — 16 novembre 2026
- Testi dell'interfaccia, guide e documentazione resi neutri: si parla del formato XPWE e degli usi degli atti contabili, senza riferimenti ad altri programmi.
- Nuovo file `ROADMAP.md` con le tappe verso la 1.0 e lo sviluppo successivo.

## 0.2.0 — 15 novembre 2026

**Computo**
- Lavori **a corpo**: chip «◫ a corpo» sulla voce; sezione «Lavori a corpo» a schermo e in stampa.
- **Oneri della sicurezza** riconosciuti dal capitolo del prezzario (es. FVG cap. 99) e interruttore «⛑ sicurezza» su ogni voce; sezione a sé, totale scomposto.
- **Offerte**: richiesta di offerta, offerte per voce o a ribasso unico (anche incollate da Excel), quadro comparativo con graduatoria al minor prezzo, aggiudicazione (offerta a prezzi unitari).
- Nuove stampe: computo **senza prezzi**, **lista delle lavorazioni e forniture**, **elenco nuovi prezzi**, **incidenza della sicurezza**; incidenza manodopera con ordine e riepiloghi a scelta. Pulsante «⎙ Stampe» nel computo.
- Elenchi prezzi in formato **.xpwe** (listini editoriali) letti come prezzari privati; listini del materiale elettrico tolti; regioni senza prezzari raccolte.
- Categorie e WBS scelte da elenco quando la struttura è predisposta; WBS trascinabili dal pannello.
- Unità di misura nelle misurazioni; «Collassa tutte» chiude anche le misure; sotto il totale la quota a corpo, la sicurezza e l'offerta aggiudicata.

**Contabilità**
- Voci a corpo del Computo → corpi d'opera (appalto misto); **offerta a prezzi unitari**: prezzi offerti come prezzi di contratto, ribasso solo risultante.
- Sicurezza, a corpo e prezzi offerti passano dal Computo (prima solo via XPWE): reimportare i computi già importati.
- Nuove stampe: **confronto progetto / eseguito** e **situazione contabile** per ogni SAL, **stato finale dei lavori**.

## 0.1.x — novembre 2026
Prime versioni pubbliche: computo con misure, categorie e WBS, elenco prezzi e analisi, stampe di progetto, contabilità con libretto, registro, sommario, SAL, certificati, perizie e conto finale; import/export XPWE.

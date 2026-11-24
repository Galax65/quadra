# Quadra — un lavoro, un modulo

Proposta di riprogettazione dopo le prove del 23/11/2026. Prende il posto
delle tappe residue di [06-Interfaccia-unica.md](06-Interfaccia-unica.md), che
aveva reso Computo e Contabilità **uguali**; qui diventano **la stessa cosa**.

## 1. La critica, in una riga

«L'interfaccia deve essere non uguale ma la stessa.» Quando questo documento è
nato c'erano ancora due programmi (due riquadri, due codici: l'interfaccia di
Computo e quella di Contabilità, oggi tolte — ne restano solo i motori) che si
somigliavano; ogni miglioria andava fatta due volte, e il flusso del lavoro si
leggeva a fatica dalla sidebar.

## 2. L'idea

**Quadra è l'hub di un lavoro**, dalla progettazione all'esecuzione. Un lavoro
è una **catena di revisioni**; ogni revisione si apre **nella stessa
schermata**, che cambia solo in quello che si scrive e in quello che si può
ancora modificare.

```
DATI DEL LAVORO
ANALISI PREZZI
ELENCO PREZZI
   Prezzario Veneto 2026
   Prezzario editoriale 2025
COMPUTO
   PFTE        rev.00   consegnata
   PFTE        rev.01   consegnata
   Esecutivo   rev.02   consegnata
   Esecutivo   rev.05   in lavorazione
CONTRATTO      rev.06   (dall'Esecutivo rev.05, ribasso 12,35%)
CONTABILITÀ
   SAL 1       rev.06   emesso
   SAL 2       rev.06   emesso
   Perizia di variante  rev.07
   SAL 3       rev.07
   SAL 4       rev.07
   SAL finale  rev.07
   CRE         rev.07
```

Tutti i rami sono **collassabili**; sotto ogni voce, collassati, i suoi
**documenti** (le stampe di quella tappa). In evidenza: i computi nelle fasi e
revisioni, il contratto, i SAL, il conto finale.

### Le regole della numerazione

- Il **numero di revisione è un numero**, proposto in ordine cronologico ma
  **liberamente modificabile**, e può saltare (rev.02 → rev.05: in mezzo ci
  sono state revisioni che non hanno toccato il computo).
- Le **fasi di progetto** (PFTE, definitivo, esecutivo) possono avere quante
  revisioni si vuole.
- Il **contratto** prende una revisione nuova; i **SAL** non ne hanno una
  propria: **portano la revisione da cui leggono i prezzi** (quella del
  contratto) finché una **perizia** non ne apre una nuova, e da lì i SAL
  successivi portano quella della perizia.

### Gli stati

| Tappa | Aperta | Chiusa |
|---|---|---|
| Revisione di computo | in lavorazione — si scrive | **consegnata** — solo lettura |
| Contratto | in definizione (ribasso) | **stipulato** — solo lettura |
| SAL | in bozza — si misura | **emesso** — solo lettura |
| Perizia | in bozza | **approvata** — solo lettura |

Chiudere è un **atto esplicito** (consegna, stipula, emissione, approvazione);
riaprire anche, e resta a verbale.

## 3. Un modulo per ogni cosa, uno solo

| Cosa | Oggi | Domani |
|---|---|---|
| La schermata delle misure | due (Computo, Contabilità) | **una**: testata, barra, griglia, misure, piede |
| Il pannello dei prezzi a destra | due, con schede diverse | **uno**: *Progetto / Contratto* · *Prezzario* · *Altro progetto* |
| Le stampe | catalogo condiviso, due modi di aprirlo | **una** finestra: l'elenco degli atti della tappa aperta, l'anteprima, «Aa Aspetto» |
| Il tasto destro | in alcuni punti | **ovunque**: righe, misure, pannello prezzi, nodi dell'albero, intestazioni |
| La navigazione | albero unito da due strumenti | **un albero**, letto da un modello solo |

Concretamente: **un solo strumento, «Lavoro»** (una cartella nuova sotto `src/tools/`), che
sostituisce Computo e Contabilità nel registry. I motori restano e si riusano:
il motore della contabilità (`src/tools/contabilita/engine/`, ~6.000 righe
TypeScript già separate dall'interfaccia: SAL, registro, certificati, perizie,
atti), quello del computo (prezzari, analisi, revisioni, XPWE), e il layer
condiviso già costruito (griglia, celle, barra, piede, testata, anteprima,
PDF/A). Si riscrive **l'interfaccia**, una volta sola.

## 4. Il modello dati: un lavoro

```
Lavoro
  anagrafica          (dati generali, ente, impresa, RUP, DL…)
  prezzari[]          (i prezzari caricati: ELENCO PREZZI nella sidebar)
  analisi[]           (ANALISI PREZZI)
  articoli            (l'elenco prezzi del lavoro: un articolo per codice)
  revisioni[]         ogni tappa della catena:
     { numero, tipo: computo | contratto | perizia,
       fase?: PFTE | definitivo | esecutivo,
       stato: aperta | chiusa, data, nome,
       voci[] con misure, prezzi dell'elenco della revisione,
       contratto?: { da: numero, ribasso | prezzi offerti } }
  avanzamenti[]       i SAL, il SAL finale, il CRE:
     { tipo: sal | salFinale | cre, numero SAL, legge da: numero revisione,
       stato: bozza | emesso, misure per voce }
  atti[]              gli atti prodotti (storico con impronta)
```

**Niente conversione dei progetti di prima** (decisione del 23/11/2026: non ce
n'erano da salvare). Il Lavoro è il formato del file da qui in avanti.

## 5. Le tappe

Si va per la strada migliore anche se, nel mezzo, il programma resta a metà
(decisione del 23/11/2026): Computo e Contabilità escono appena «Lavoro» li
sostituisce. I **dati del lavoro** (ente, impresa, RUP, DL, CUP…) stanno in cima
alla sidebar, sopra ANALISI PREZZI.

1. ~~**Il modello «Lavoro»**~~ — **fatto** (`src/shared/lavoro/`): la catena
   di revisioni (computo, contratto, perizia) e avanzamenti (SAL, SAL finale,
   CRE); numerazione libera ma unica e in ordine; chiusure e riaperture con le
   loro regole (non si riapre ciò su cui poggia qualcosa di chiuso); contratto
   con ribasso o prezzi offerti; SAL che portano il numero da cui leggono i
   prezzi; l'albero della sidebar. `tests/shared/lavoro.test.ts` rifà la catena
   dell'esempio, dal PFTE rev.00 al CRE rev.07.
2. ~~**Lo strumento «Lavoro» con la schermata unica**~~ — **fatto** per le
   revisioni di computo (`src/tools/lavoro/`): la stessa pagina per ogni tappa
   (testata, barra, griglia con le misure inline, piede, tutti condivisi);
   voci libere e da XPWE, misure con le formule, categorie e WBS, sicurezza e
   a corpo; consegna in sola lettura e riapertura; revisione nuova da una
   consegnata, in qualunque fase, col numero proposto e modificabile; stampe
   del computo (computo metrico, elenco prezzi, stima) con anteprima e PDF/A;
   tasto destro sulle voci. La sidebar dell'hub disegna l'albero a sezioni che
   lo strumento pubblica, e la card «Lavoro» in home apre lui. Computo e
   Contabilità restano nel registry finché le tappe 3–5 non li coprono.
3. ~~**Il pannello prezzi unico**~~ — **fatto** (`src/tools/lavoro/prezzi.ts`):
   una colonna a destra per ogni tappa, tre schede — *Progetto* (che diventa
   *Contratto* quando la tappa lo è) con l'elenco della revisione e quante voci
   usano ogni articolo; *Prezzario* con tutti i prezzari del programma
   (l'archivio dell'utente e quelli installati, caricatore spostato in
   `src/shared/prezzari/carica.ts` e condiviso con la Contabilità); *Altro
   progetto* da un altro file di lavoro. Doppio clic o «＋»: la voce entra con
   la riga di misura aperta; a revisione chiusa si consulta e basta. Nella
   sidebar ELENCO PREZZI elenca i prezzari usati dal lavoro e «＋ Prezzario…»;
   ANALISI PREZZI apre i nuovi prezzi e le analisi della revisione.
   *Resta*: l'import dei prezzari regionali in **Excel/XML** passa ancora dal
   vecchio Computo (i suoi lettori sono codice legacy da portare nel layer
   condiviso); in XPWE si importa da qui. L'editor delle analisi prezzi (il
   compositore) non è ancora in «Lavoro».
4. ~~**Contratto e SAL nella stessa schermata**~~ — **fatto**. *Rivisto*: niente
   più stipula come passaggio. Il contratto nasce **in vigore** da «→ Contratto…»,
   con il ribasso (e il SAL n. 1 si apre subito) o a prezzi unitari (il prezzo
   offerto si scrive nella colonna del prezzo); l'offerta si corregge finché
   nessun SAL è emesso. La base d'asta è ai prezzi di progetto; con i prezzi
   offerti si dichiara il ribasso che ne risulta. I dati della contabilità
   (repertorio, stipula, registrazione; consegna, giorni utili, sospensioni,
   proroghe, ultimazione, con il termine vigente e il ritardo; anticipazione,
   ritenuta, penale, IVA) stanno in DATI DEL LAVORO → «Contratto, tempi e
   pagamenti» (`src/shared/lavoro/contabilita.ts`).
   Prima versione: Da un computo
   consegnato «→ Contratto…» (dalla barra o dalla sidebar): numero proposto,
   data, ribasso d'asta. Il contratto si apre nella stessa pagina, col piede
   del contratto (base d'asta, ribasso, importo contrattuale, sicurezza non
   ribassata) e «✓ Stipula…». Il SAL si apre nella stessa pagina e nella stessa
   griglia: si scrive l'eseguito a tutto il SAL (misure, quantità, o quota % per
   i lavori a corpo), accanto la quantità di contratto e l'avviso «oltre il
   contratto»; MOSTRA misurate / tutto il contratto; il piede fa i conti
   (contabilizzato a tutto il SAL, sicurezza, in questo SAL al netto del ribasso).
   «✓ Emetti…» lo chiude; il successivo riparte dalle sue misure. Nel SAL il
   pannello prezzi è l'elenco di contratto e «＋» porta la voce nel libretto.
   *Restano* (tappe 5–6): ritenute, anticipazione e certificato di pagamento
   (dal motore della Contabilità, con le stampe), SAL finale e CRE
   nell'interfaccia (il modello li ha già), i prezzi offerti nella finestra
   del contratto.
5. ~~**Perizia, SAL finale, CRE**~~ — **fatto**. La perizia di variante
   (dalla sidebar, sotto CONTABILITÀ) è una revisione nuova copiata dal
   vigente, nella stessa pagina: accanto a ogni voce la quantità vigente e la
   variazione, MOSTRA variate / tutto il contratto, i prezzi di contratto fissi
   (si concordano solo i nuovi prezzi: in perizia ogni articolo nuovo è NP),
   una voce già contabilizzata non si toglie. Il piede confronta col vigente e
   con l'originario, al netto del ribasso, e avvisa oltre il quinto d'obbligo.
   «✓ Approva…» la fa vigente: i SAL successivi ne portano prezzi e numero.
   Il SAL finale si apre dopo l'ultimo SAL emesso (stato finale, credito
   residuo); il CRE lo certifica in sola lettura col conto finale e
   «✓ Approva…». *Restano* le ritenute e il certificato di pagamento (tappa 6).
   **Import di una contabilità XPWE nei SAL** (`src/shared/lavoro/import-sal.ts`),
   per un lavoro avviato con un altro programma: «⇩ XPWE» nel SAL in bozza o «⇩ Importa una
   contabilità XPWE…» nella sidebar. Le date vicine (giorni a scelta) fanno un
   SAL, emessi tutti tranne l'ultimo; ogni misura si abbina alla voce di
   contratto con lo stesso codice e prezzo e si aggiunge, progressiva; «Solo le
   misure dal» salta quelle già nei SAL emessi. Le voci che il contratto non
   ha, e i lavori a corpo, si elencano e non si importano.
   **Confronto con un XPWE**: in ogni SAL emesso «⇄ XPWE» mette le misure del
   file (tutte le date, sommate per voce di contratto) accanto a quelle di
   Quadra, voce per voce e nei totali lordi, senza cambiare niente. Nello stato
   finale in bozza «⇩ XPWE» confronta, oppure prende le misure del file.
   **Import di una perizia XPWE** (`src/shared/lavoro/import-perizia.ts`):
   «⇩ XPWE» nella perizia in bozza, o «⇩ Importa una perizia XPWE…» nella
   sidebar (crea la perizia se non c'è). Ogni voce si abbina all'articolo di
   contratto con lo stesso codice e prezzo; un articolo nuovo, o un codice di
   contratto a un prezzo diverso, entra come NP e si segnala. Il file è la
   perizia intera (le voci abbinate conservano l'identità, così i SAL le
   ritrovano) oppure si aggiunge; una voce già contabilizzata non si toglie.
   All'approvazione il SAL in bozza passa ai prezzi della perizia.
   **Importi in calce lordi**, come nella prassi: perizia e SAL mostrano gli importi
   ai prezzi di progetto e NP, e a parte il netto del ribasso (salvo prezzi
   unitari). **Ribasso sui NP voce per voce** (`ribassoArticolo`): col ribasso
   unico i NP sono ribassati per default (un solo rigo di ribasso), con i
   prezzi unitari no; ogni NP si può segnare soggetto o non soggetto (✎, o
   «% Ribasso NP…» per tutti), come un rigo di ribasso a 0% (
   id40732; D.Lgs. 36/2023 e parere MIT 3545/2025 per i NP per analisi).
6. **Le stampe dalla stessa finestra** per ogni tappa, e i documenti come
   figli collassati nell'albero. **In buona parte fatto**: le stampe contabili
   le fa il motore della Contabilità, a cui il lavoro si traduce
   (`src/tools/lavoro/motore-contabilita.ts`: partite del contratto, NP dal SAL
   della perizia, perizie con le nuove quantità, SAL a tutto il SAL; un test
   verifica che il motore faccia gli stessi conti della schermata). SAL:
   libretto, registro, sommario (PDF), SAL e certificato di pagamento con
   ritenuta, anticipazione, IVA. SAL finale: libretto, registro, stato finale,
   conto finale. CRE: relazione sul conto finale. Perizia: atto, quadro
   comparativo, verbale ed elenco dei nuovi prezzi, atto di sottomissione,
   computo di perizia. Le stampe di una tappa non chiusa escono come bozza.
   Il motore ha imparato la partita «non ribassata» (NP non soggetto).
   *Restano*: la stampa del CRE (il motore non l'ha), la lista delle
   lavorazioni del contratto, la ritenuta diversa dallo 0,50% (il motore la
   tiene fissa).
7. ~~**Il tasto destro ovunque**~~ — **fatto**. Un solo menu
   (`src/shared/ui/components/menu.ts`: tastiera, chiusura con clic fuori o
   Esc, sempre dentro lo schermo), usato dalla pagina e dalla sidebar. Le
   azioni di ogni tappa per il suo stato sono un elenco solo
   (`src/tools/lavoro/azioni.ts`): la pagina lo apre col tasto destro sulla
   testata o su un punto vuoto, la sidebar lo riceve con l'albero e rimanda il
   comando scelto («t:<azione>:<id>»). Tasto destro anche su voci (misure,
   modifica, ripeti, eseguito come da contratto, mostra nell'elenco prezzi,
   copia il codice, togli), righe di misura (riga sotto, in detrazione,
   duplica, elimina), righe dell'elenco prezzi, titoli di sezione e documenti
   della sidebar. Nei campi di testo resta il menu del sistema.
8. ~~**Uscita di Computo e Contabilità** dal registry~~ — **fatto**. La home e
   la sidebar parlano solo di «Lavoro» (categorie dell'hub: Lavoro,
   Amministrazione). Prima, l'import dei prezzari è passato in «Lavoro»
   (`src/shared/prezzari/leggi-file.ts`): XML regionali con le stesse famiglie
   della pipeline (elenco unico in `parsers/famiglie.ts`), XPWE, Excel (FVG,
   listino di fornitore riconosciuto dalle intestazioni, prezzari editoriali), CSV del Cratere.
   Restano nel repository i **motori** che «Lavoro» usa (parser dei prezzari,
   XPWE, motore della contabilità e le sue stampe) e, fermi, i sorgenti delle
   due interfacce: contengono funzioni **non ancora portate**, che dall'hub
   oggi non si raggiungono —
   - dalla Contabilità: giornale dei lavori; verbali e ordini di servizio
     (consegna, sospensione e ripresa come atti, accertamento, ultimazione,
     relazione al RUP); riserve; liste in economia; registro degli atti con
     impronta e firma dei SAL; scadenziario; revisione prezzi (tappa 9);
     accordo quadro; sotto-computo dei lavori a corpo; export Excel;
   - dal Computo: l'editor delle analisi prezzi (compositore); quadro
     economico e stampe di incidenza manodopera e sicurezza; modelli di
     struttura e editor delle categorie; confronto fra prezzari.
   Si portano in «Lavoro» una per volta; quando non resta niente, le due
   cartelle d'interfaccia si cancellano.
8bis. **Il programma completo**: ogni funzione dei due strumenti vecchi in
   «Lavoro» (richiesta del 23/11/2026). Fuori, per ultime: la revisione prezzi
   (tappa 9) e l'ottimizzazione dell'interfaccia. L'elenco da spuntare:

   *Fatto*
   - [x] prezzari regionali XML/Excel, XPWE, listini, CSV (import)
   - [x] giornale dei lavori; verbali e ordini di servizio (quelli dei tempi
     ricavati); riserve; liste in economia (nei conti del SAL); scadenziario
   - [x] analisi prezzi: righe a mano o dal prezzario, spese generali, utile,
     quantità di riferimento, arrotondamento, applicata all'elenco prezzi;
     stampa e fascicolo
   - [x] stampe: computo, elenco prezzi, stima; libretto, registro, sommario,
     SAL, certificato; perizia, quadro comparativo, nuovi prezzi, atto di
     sottomissione; stato finale, conto finale, relazione finale

   *Da fare — computo*
   - [x] incidenza della manodopera e della sicurezza (stampe)
   - [x] elenco e verbale dei nuovi prezzi del computo
   - [x] quadro economico (pagina della revisione e stampa)
   - [x] lista delle lavorazioni; offerte con graduatoria e quadro
     comparativo; il contratto nasce dall'offerta scelta
   - [x] computo in Excel; computo in XPWE (export); fascicolo analisi in Excel
   - [x] voci del SAL oltre il contratto in blu, filtro, avviso all'emissione
   - [x] contrasto di righe di misura e voci
   - [x] struttura: editor di categorie e WBS, modelli di struttura
   - [x] libreria personale di voci e analisi (lo stesso archivio del Computo)
   - [—] compositore guidato e voce da scheda tecnica: vivono del catalogo delle
     famiglie, che questa build non distribuisce (vuoto anche nel vecchio
     Computo): non si portano funzioni che non producono niente
   - [x] filtri del prezzario a cascata (disciplina › sistema › settore)
   - [x] contabilità senza computo (lavori privati): contratto a misura in
     vigore subito, l'elenco prezzi cresce dal SAL; contabilità XPWE in un
     lavoro vuoto; computo consuntivo stampato come il computo
   - [x] confronto di un codice fra i prezzari; variazione dei prezzi in blocco;
     prezzi dal prezzario dell'anno nuovo; storico; rendi nuovo prezzo
   - [x] misure: vedi voce, incolla da Excel, copia da un altro computo;
     ordine delle voci col trascinamento

   *Da fare — contabilità*
   - [x] registro in bianco da vidimare
   - [x] fascicolo degli atti del SAL e della perizia (un documento)
   - [x] firma del SAL con impronta; registro degli atti prodotti e verifica
   - [x] export degli atti in DOCX e ODT
   - [x] dati del SAL: detrazioni e note (la data del certificato è quella di emissione)
   - [x] situazione contabile; confronto progetto/eseguito; computo consuntivo;
     computo di variante (computo metrico della perizia); copertina
   - [x] lavori a corpo: sotto-computo, quota dall'eseguito, libretto dei sotto-computi
   - [x] contabilità semplificata: fatture con il visto del DL
   - [x] penale per ritardo e svincolo della ritenuta (CRE approvato, DURC);
     iter del conto finale; arrotondamento del certificato; articolo del CSA
   - [x] accordo quadro
   - [x] export: Excel di SAL, registro e sommario; contabilità in formato
     aperto (zip JSON/CSV)

9. **Revisione prezzi** (art. 60), che a quel punto è una tappa della catena
   come la perizia.

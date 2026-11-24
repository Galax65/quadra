# Quadra — una sola interfaccia

Piano della riprogettazione dell'interfaccia, e la ragione per cui si fa.
Nasce da una critica precisa: *«si dovrebbe eliminare questa dicotomia tra
computo e contabilità, i programmi più diffusi hanno la stessa interfaccia per computo o
contabilità, perché noi non lo facciamo? non due interfacce simili ma la stessa
interfaccia»*.

Per l'architettura com'è oggi vedi [01-Panoramica-e-Architettura.md](01-Panoramica-e-Architettura.md);
questo documento dice dove sta andando.

## 1. La diagnosi

Il problema non sono i dettagli: **esistono due programmi che si somigliano**
invece di uno solo. Da lì discende il resto.

- **Due barre, due tabelle, due linguaggi.** Computo e Contabilità sono due
  bundle con due `main.ts`. Ogni miglioria va fatta due volte, e la seconda
  volta viene diversa.
- **L'accento cambia colore cambiando strumento** (verde → porpora). È il
  segnale più forte che l'interfaccia manda, e dice: «sei in un altro
  programma».
- **La navigazione stava in tre posti**: sidebar, linea del tempo, muro di
  schede al centro. Nessuno dei tre la diceva tutta, e i pulsanti si ripetevano.
  *(Risolto: resta l'albero.)*

## 2. L'idea

**Computo, libretto e perizia sono lo stesso oggetto**: un elenco di voci con
una quantità, prezzate da un elenco prezzi. Un lavoro è **una catena di fasi, e
ogni fase è un computo**:

| Fase | Che cos'è | Prezzi | Quantità che si edita |
|---|---|---|---|
| PFTE rev.00… | computo | elenco proprio | di progetto |
| Esecutivo rev.03… | computo | elenco proprio | di progetto |
| **Contratto** rev.05 | l'esecutivo scelto + ribasso o prezzi offerti | congelato qui | di contratto |
| SAL n | libretto delle misure | legge dal contratto vigente | eseguite |
| Perizia n | computo di variante | contratto + NP | di variante |
| SAL finale | libretto | contratto vigente | finali |

Cambia solo **quale colonna si scrive** e **quale si confronta**. Tutto il resto
— ricerca, viste, ordinamenti, misure di dettaglio, categorie e WBS,
import/export, stampe — è identico, e va scritto una volta sola.

## 3. Il layout, sempre lo stesso

```
┌─────────────┬──────────────────────────────────────┬───────────────┐
│  ALBERO     │  TESTATA  fase · rev · stato · azioni│ ELENCO PREZZI │
│  DEL LAVORO ├──────────────────────────────────────┤  sempre a     │
│             │  BARRA  cerca·VISTA·ORDINA·MOSTRA    │  fianco,      │
│  Lavoro     │         ＋voce · dati · strumenti    │  ricercabile  │
│  Progetto   ├──────────────────────────────────────┤  e sfogliabile│
│  Contratto  │                                      │               │
│  Contabilità│   LA TABELLA DELLE VOCI              │  [sorgenti]   │
│  Perizie    │   (la stessa in ogni fase)           │  ▸ articolo   │
│  Chiusura   │                                      │  ▸ articolo   │
│             ├──────────────────────────────────────┤  doppio clic  │
│             │  PIEDE  i valori di controllo        │  o trascina   │
└─────────────┴──────────────────────────────────────┴───────────────┘
```

Tre regole che tengono insieme il disegno:

1. **L'albero è l'unica navigazione.** Un ramo è una fase, le sue foglie sono le
   **schermate di lavoro** di quella fase (due o tre, non dieci). Tutto il resto
   è una stampa. Il lavoro cresce da lì (＋ SAL, ＋ perizia) e si corregge da lì
   (✕ sulle tappe ancora disfacibili).
2. **Una sola interfaccia di stampa**, nella testata. Un pulsante solo per
   schermata, che apre l'elenco degli atti di quella fase.
3. **I valori di controllo stanno in calce, sempre visibili**, e cambiano con la
   fase: totale di progetto, ribasso, contabilizzato e residuo, maggiori e
   minori lavori.

## 4. L'estetica

- **Un accento solo** per tutto il programma. Il colore dice la **fase**, non lo
  strumento: progetto (verde), contratto (ocra), contabilità (porpora), perizia
  (viola).
- **Densità da computo**: righe da 30 px, codici in monospazio, numeri tabulari
  a destra, descrizioni su una riga.
- **Niente riquadri dentro riquadri.** Tre superfici: fondo, pannello, riga
  attiva.
- **Il campo che si scrive si vede**: solo la quantità della fase ha l'aspetto
  di un campo; gli altri numeri sono testo.
- **Le anteprime sono fogli**, non riquadri di testo nell'applicazione: margini
  da A4, carta bianca anche col tema scuro.

## 5. Le tappe

Ognuna è rilasciabile da sola e non rompe quella prima.

1. ~~Il guscio: fase al centro, elenco prezzi a fianco, cruscotto, via il muro
   di schede~~ — **fatto**.
2. ~~L'albero come unica navigazione, che cresce col lavoro~~ — **fatto**.
3. ~~Si misura in un posto solo: gli atti diventano anteprime~~ — **fatto**.
4. ~~**La griglia condivisa**~~ — **fatto**: `src/shared/griglia/`. Il
   **descrittore di fase** (`fase.ts`: progetto, contratto, SAL, perizia) dice
   quali colonne e in che ordine, quale si scrive, quale si confronta, che cosa
   offre MOSTRA e quali valori stanno in calce; la **griglia** (`griglia.ts`)
   dispone intestazione, voci, gruppi, sezioni, totali e riga di dettaglio; il
   **piede** (`piede.ts`) i valori di controllo. Viste, ordinamenti e ricerca
   sono gli stessi; barra e misure di dettaglio sono riesportate da lì. Il
   libretto, la perizia e il computo disegnano le voci con la stessa griglia
   (`tests/shared/griglia.test.ts` lo presidia). Le celle le riempie ancora
   ciascuno strumento: portarle dentro la griglia è il lavoro della tappa 5.
5. ~~**Il Computo passa allo stesso guscio**~~ — **fatto**: stessa testata, stessa barra, stesso
   piede, elenco prezzi come colonna. Testata di fase e piede sono
   quelli condivisi (`src/shared/griglia/testata.ts`, `piede.ts`); i pulsanti
   «Stampe» in pagina sono scesi a zero (via «⎙ Stampe» in testata e il menu
   «Esporta ▾», le cui voci sono tutte nel catalogo) e si stampa solo da
   «⎙ Stampa…».
   L'elenco prezzi del progetto è una **colonna** a destra, come nella
   Contabilità: non si trascina più e non diventa una pillola; si allarga dal
   bordo, si chiude con ✕ e si riapre da «≡ Elenco prezzi» nella barra.
   **Le celle** sono anch'esse della griglia (`src/shared/griglia/celle.ts`):
   lo strumento dice *che cosa* (codice, designazione, campo, quantità
   misurata, numero, comandi) e la cella viene uguale nel computo, nel libretto
   e nella perizia — il campo ha l'aspetto di un campo solo nella colonna che
   la fase scrive, niente stili in linea, la voce piegata è uno stato della
   griglia. Restano HTML dello strumento solo i chip e i comandi propri.
6. ~~**L'albero comune ai due strumenti**~~ — **fatto**. Ogni strumento
   pubblica i rami che tiene: il Computo il computo in corso (con le sue
   schermate di lavoro) e le revisioni congelate (confronto e quadro
   comparativo), la Contabilità contratto, SAL, perizie e chiusura. L'hub li
   unisce (`unisciAlberi` in `src/shared/revisioni.ts`) e rimanda ogni clic e
   ogni comando allo strumento che ha pubblicato il ramo. Le revisioni del
   Computo restano nella catena della Contabilità per la numerazione (il
   contratto viene dopo di loro), ma non le ridisegna più lei. In home c'è una
   voce sola, «Lavoro», che carica entrambi gli strumenti e apre quello della
   fase in corso; aprendo un progetto si caricano tutti, così l'albero è intero
   da subito.
7. ~~**Revisioni memorizzate, non derivate**~~ — **fatto**
   (oggi nel modello di Lavoro, `src/shared/lavoro/`). Una revisione di computo congela
   voci, **misure** ed **elenco prezzi** (ogni articolo con il prezzo di allora
   e la sua provenienza: prezzario, nuovo prezzo, analisi), e resta nel file;
   le revisioni salvate prima ricavano l'elenco dalle loro voci. Si
   **rinomina** — nome, fase, data, note — senza toccarne il contenuto, e il
   nome di prima resta in memoria; il numero (rev.nn) è la posizione nel
   tempo e non cambia. La Contabilità legge il tipo dalla **fase memorizzata**,
   non dal nome: rinominare non sposta una revisione nella catena. Esiste la
   **revisione di progetto** (cambiano gli elaborati, non il computo): non
   fotografa niente, poggia sull'ultima revisione di computo e lo dice
   nell'albero («Computo invariato (rev.00)»).
8. ~~**PFTE ed Esecutivo come fasi vere**~~ — **fatto** (oggi nel modello di Lavoro, `src/shared/lavoro/`).
   Il computo in corso è il computo di una **fase** (PFTE → definitivo →
   esecutivo): si legge in testata e nell'albero («Esecutivo · in corso»), e
   «⇥ Passa all'esecutivo» chiude la fase congelandola in una revisione con
   quel nome. La **promozione a contratto è un atto**: si sceglie quale computo
   (quello in corso o una revisione congelata — si propone l'ultimo
   esecutivo) e come (ribasso d'asta o prezzi unitari dell'offerta
   aggiudicata, mai entrambi), si vede subito l'importo contrattuale, e il
   risultato si fotografa e resta nel file. La Contabilità importa l'atto, non
   il computo di adesso, e il ramo del contratto dice da dove viene
   («Promosso da rev.01 Esecutivo · ribasso 12%»).
9. ~~**Anteprima di stampa personalizzabile** e **PDF/A-2b**~~ — **fatto**.
   L'aspetto si decide **guardando**: ogni anteprima ha il pannello «Aa
   Aspetto» (foglio, orientamento, margini, carattere, corpo, testata, piè) e
   il documento si rifà sotto gli occhi (`src/shared/ui/anteprima-pdf.ts`). Le
   scelte sono le preferenze di stampa di tutto il programma e ora valgono
   **anche per i PDF**, che prima uscivano sempre su A4 con margini fissi; su un
   foglio più largo la descrizione prende lo spazio in più. «↺ Impianto
   standard» torna all'impianto di partenza (`IMPIANTO_STANDARD` in
   `src/shared/doc/stile-stampa.ts`): A4 verticale, 15 mm e **20 a sinistra**
   per la rilegatura, lineare 10 pt. I PDF escono **PDF/A-2b**
   (`src/shared/stampa/pdfa.ts`): Arimo incorporato al posto di Helvetica,
   nessun glifo mancante, profilo sRGB costruito nel codice, XMP coerente col
   dizionario Info, identificativo nel trailer; l'anteprima lo dichiara.
   `tests/shared/pdfa.test.ts` ne controlla la struttura; **resta da passare
   i file a veraPDF**, che qui non è stato possibile eseguire.

10. **Revisione prezzi secondo il codice dei contratti** — *in programma*.
    Come nei programmi più diffusi, e sarà una funzione d'uso frequente: la clausola di
    revisione dei prezzi dell'art. 60 del D.Lgs. 36/2023 (e del suo allegato,
    come modificati dal correttivo D.Lgs. 209/2024). Da definire sul testo
    vigente: soglia di variazione, quota riconosciuta, indici di riferimento e
    periodicità. Nella catena è una tappa di contratto, accanto alle perizie:
    cambia i prezzi da cui leggono i SAL successivi, e il ramo dell'albero deve
    dirlo («SAL n. 4 · prezzi rev.07 — revisione prezzi»).

**Dopo le prime prove** (seguito della tappa 8): un computo si **importa nella
fase che è** (PFTE, definitivo o esecutivo), congelando prima quello che c'era;
il **cambio di fase** chiede da dove ripartire — il computo in corso o una
revisione congelata (l'esecutivo dal definitivo approvato); la **colonna dei
prezzi** ha due schede, «Progetto» e «Prezzario», e dal prezzario si pesca
senza lasciare il computo. Le revisioni restano fotografie: si correggono nome,
fase, data e note, non il contenuto.

## 6. Che cosa NON si prende dai concorrenti

- Da ComputoLab, il ventaglio piatto di schede per documento: dice che cosa
  esiste, non **quale elenco prezzi legge ogni tappa**, che è il punto su cui si
  sbaglia una contabilità. *(Di ComputoLab si prendono le schede accendibili
  dalle Preferenze e il PDF/A verificato.)*
- Da Blumatica, le voci «Stampe Progettazione» e «Stampe Contabilità»
  nell'albero: sarebbero una seconda via per stampare, e la via dev'essere una.
  *(Di Blumatica si prendono le righe di stato sotto ogni ramo — già fatte — e
  le revisioni dei prezzi di contratto come nodi.)*

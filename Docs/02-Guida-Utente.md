# 02 — Guida Utente (ELI5)

Questa guida spiega come **usare** Quadra, con parole semplici. Non serve sapere niente di
programmazione. *(Il numero di strumenti e i loro «primi passi» sono generati dal codice:
vedi i blocchi automatici più sotto.)*

Quadra è un programma per il **computo metrico estimativo** e la **contabilità dei lavori
pubblici** (D.Lgs. 36/2023, Allegato II.14): il computo, il contratto, i SAL e le perizie
stanno nello stesso strumento, **Lavoro**, senza ridigitare nulla, e tutto si salva in un unico
file di progetto **`.quadra`**. Funziona su Mac e Windows, senza account e senza internet.

## 1. Avviare l'app

- **Mac:** doppio click su `Quadra.app` (di solito in *Applicazioni*).
- **Windows:** doppio click sull'icona Quadra (dopo aver lanciato l'installer una volta).

Non c'è login: Quadra è per un singolo studio, quindi si apre direttamente sulla home, con
accesso a tutti gli strumenti. Il pannello **Amministrazione** (Impostazioni → Centro di controllo) resta
lo strumento per gestire gli utenti dello studio (elenco locale) e il nome/logo dello studio per
le intestazioni dei documenti generati.

> La prima volta l'app trova da sola i suoi strumenti. Non devi configurare niente.

## 2. La schermata principale (il hub)

A sinistra c'è la **barra laterale** con l'elenco dei tool (raggruppati per tema) e, in fondo,
**Impostazioni** e i comandi di **progetto**. Al centro c'è la **home** con una **card** per
ogni strumento.

```
┌──────┬──────────────────────────────────────────────────────┐
│ [▦]  │                      [▦]  Quadra                      │
│      │              COMPUTO E CONTABILITÀ LAVORI            │
│ ◺    │        [ Nuovo progetto ]  [ Apri progetto… ]        │
│ ⚙    │                                                      │
│      │   ┌──────────────────────────────────────────┐       │
│ Nuovo│   │ ◺ Lavoro — computo, contratto, SAL, …    │       │
│ Apri │   └──────────────────────────────────────────┘       │
│ Salva│              ( ⚙ Amministrazione )                    │
└──────┴──────────────────────────────────────────────────────┘
```

All'avvio c'è già un **progetto vuoto** pronto: si comincia subito, il nome del file si sceglie
al primo salvataggio.

- **Clicca una card** (o una voce della barra) per aprire lo strumento: si apre *dentro* la
  stessa finestra.
- I tool ancora in prova hanno la targhetta **`beta`**; gli altri sono stabili (nessuna targhetta).
- Per **tornare alla home** clicca il logo **Quadra** in alto a sinistra o premi `Esc`.
- In fondo alla home trovi i **Protip** a rotazione (suggerimenti d'uso), i **Crediti** e le
  **Note legali**.

## 3. Scorciatoie da tastiera

| Tasto | Azione |
|---|---|
| `/` | Vai subito alla ricerca dei tool |
| `B` | Mostra/nascondi la barra laterale |
| `T` | Cambia tema chiaro/scuro |
| `Esc` | Torna alla home |
| `Cmd/Ctrl + C / V / X` | Copia / Incolla / Taglia (funzionano normalmente) |

> 💡 Ogni strumento ha in alto a destra il **pulsante Guida rosso `? Guida`**: aprilo per la
> guida specifica di quel tool. Tema e Guida stanno **sempre nello stesso posto**, in tutti i tool.

## 4. Aspetto e tema

- Il **tema chiaro/scuro** è unico per tutta la suite: all'inizio segue il tuo sistema
  operativo, poi puoi fissarlo a mano. Il **toggle del tema** è in alto in ogni strumento.
- Da **Impostazioni → Aspetto** (barra laterale) scegli **palette** colori, **font**,
  **dimensione del testo**, **densità**, **ombre** e **animazioni**: valgono per tutta la suite.

## 5. Gli strumenti, in breve

<!-- AUTO:tools:list:START -->
<!-- ⚙️ generato da `npm run sync:docs` (fonte: src/hub/data/registry.ts) — NON editare a mano -->
Strumenti: **2** (Quadra v0.17.0).

- **Lavoro** — Dal progetto alla contabilità, in una schermata sola _(beta)_
- **Amministrazione** — Centro di controllo dell'hub _(stabile)_
<!-- AUTO:tools:list:END -->

Come si usano, in pratica:

- **Lavoro** — un lavoro intero in una schermata sola: computo e sue revisioni, contratto,
  SAL, perizie, stato finale e CRE. La sidebar è l'albero del lavoro; ogni tappa si apre nella
  stessa pagina, con la stessa griglia delle voci, lo stesso elenco prezzi a destra e le stesse
  stampe. Il dettaglio è in [07-Un-lavoro-un-modulo.md](07-Un-lavoro-un-modulo.md).
- **Amministrazione** — utenti dello studio, statistiche, manutenzione (solo per chi amministra).

### Lavoro, passo per passo

1. **Dati del lavoro** (sidebar, in alto): i dati generali (oggetto, committente, CUP, CIG,
   impresa, tecnici) e «Contratto, tempi e pagamenti» (repertorio, consegna, giorni utili,
   sospensioni e proroghe con il termine vigente, anticipazione, ritenuta, penale, IVA).
2. **Il computo**: «＋ Nuovo computo…» in una fase (PFTE, definitivo, esecutivo), oppure
   «⇩ Importa un computo XPWE…». Le voci si aggiungono dall'**elenco prezzi a destra** (schede
   *Progetto*, *Prezzario*, *Altro progetto*: doppio clic o «＋») o con «＋ Voce libera».
   Le misure si scrivono **come nel foglio di computo** (PriMus): sotto ogni voce, una riga per
   misura nelle colonne Par.ug. · Lung. · Larg. · H/peso, e la riga **SOMMANO** con quantità,
   prezzo e importo. Tab = cella accanto, Invio = riga sotto (dall'ultima ne apre una nuova),
   ↑↓ = stessa colonna, Esc = annulla; formule come `2x3,5` o `12+250+65`; una detrazione è una
   riga con le parti uguali negative («− detrazione»). «☰ Solo voci» mostra una riga per voce.
3. **Consegna** («✓ Consegna…»): la revisione si chiude e da lì si legge soltanto. Per cambiarla
   se ne fa una nuova («＋ Nuova revisione…», numero proposto e modificabile).
4. **Contratto** («→ Contratto…» su un computo consegnato): con il ribasso d'asta, e il SAL n. 1
   si apre subito; oppure a prezzi unitari, scrivendo il prezzo offerto di ogni articolo.
   L'offerta si corregge finché nessun SAL è emesso.
5. **SAL**: nella stessa griglia si scrive l'eseguito a tutto il SAL (misure, quantità, o quota %
   dei lavori a corpo); «✓ Emetti…» lo chiude e il successivo riparte dalle sue misure. Un lavoro
   avviato con un altro programma si continua importandone la contabilità XPWE nei SAL.
6. **Perizia di variante** (sidebar, CONTABILITÀ): una revisione nuova del contratto, a mano o
   importata da XPWE; i nuovi prezzi sono NP (ribassati o no, voce per voce); il piede confronta
   con il contratto vigente e con l'originario e avvisa oltre il quinto d'obbligo.
   «✓ Approva…» la fa vigente: i SAL successivi ne portano prezzi e numero.
7. **SAL finale e CRE**: lo stato finale dei lavori (si può confrontare con un XPWE per
   verificare i totali), poi il certificato di regolare esecuzione con il conto finale.

**Le stampe** stanno sotto ogni tappa, nella sidebar, e in «⎙ Stampa…» in testata: computo,
elenco prezzi e stima dei lavori; libretto, registro, sommario, SAL e certificato di pagamento;
atto di perizia, quadro comparativo, verbale ed elenco dei nuovi prezzi, atto di sottomissione;
stato finale, conto finale. Una tappa non chiusa stampa in bozza.

**Il tasto destro** funziona ovunque: sulle tappe della sidebar, sulla pagina, sulle voci, sulle
righe di misura e sull'elenco prezzi.

**I prezzari** non sono nel programma (dati regionali o di fornitore): si importano dall'elenco
prezzi, scheda *Prezzario* → «⇩ Importa un prezzario…» — XML o .xlsx regionale come si scarica
dal portale, XPWE, il listino di un fornitore in .xlsx, il CSV del Cratere — e restano
nell'archivio del programma.

## 5bis. Primi passi (tour guidato)

Al primo accesso parte da solo un breve **tour guidato** (skippabile). Lo riapri quando vuoi dal
bottone **Guida** (barra laterale nell'hub, o `? Guida` in alto in ogni tool) → **Rivedi il tour**.

<!-- AUTO:tours:coverage:START -->
<!-- ⚙️ generato da `npm run sync:docs` (fonte: src/hub/data/tour.ts + src/tools/*/data/tour.ts) — NON editare a mano -->
Hanno un tour guidato (▶ nell'hub) e i "primi passi" qui sotto: .

Non ancora coperti da un tour: Lavoro · Amministrazione.
<!-- AUTO:tours:coverage:END -->

I "primi passi" qui sotto **sono** gli step di quei tour: stessa fonte, nessuna doppia scrittura.

**Home**

<!-- AUTO:guide:home:START -->
<!-- ⚙️ generato da `npm run sync:docs` (fonte: src/hub/data/tour.ts) — NON editare a mano -->
- **Benvenuto in Quadra** — È il programma per il computo metrico e la contabilità dei lavori: ogni tool copre un pezzo del flusso e si passano dati fra loro senza doverli ridigitare.
- **Cerca un tool** — Digita per filtrare l’elenco qui sotto, o premi / per metterti subito a fuoco sulla ricerca.
- **I tool, raggruppati per tema** — Le card sono raggruppate per area: Lavoro (dal computo alla contabilità) e, per chi amministra, Amministrazione. Clicca una card per aprirla.
- **Progetto Quadra** — Salva/Apri un file .quadra per portarti dietro lo stato di tutti i tool insieme. "Nuovo progetto" riparte da zero.
- **La Guida resta sempre qui** — Da qui puoi riaprire la guida rapida e rivedere questo tour quando vuoi.
<!-- AUTO:guide:home:END -->

## 6. Da dove entrano i dati (il flusso)

- **XPWE** — un computo, un elenco prezzi, una contabilità con le misure datate, una perizia:
  «Lavoro» li importa ognuno nella sua tappa, e con un XPWE si confrontano i totali di un SAL.
- **Prezzari** — dall'archivio del programma, condiviso da tutti i lavori.
- **Altro progetto** — gli articoli di un altro lavoro, con il loro prezzo, dalla scheda
  *Altro progetto* dell'elenco prezzi.

## 7. Il Progetto Quadra (file `.quadra`)

In fondo alla barra laterale (e nella home) trovi i comandi di progetto:

- **Nuovo progetto** — riparte da zero azzerando tutti i tool.
- **Salva progetto** — mette insieme in un **unico file `.quadra`** lo stato di *tutti* i tool:
  elenco prezzi del progetto con le sole voci usate (non i prezzari interi), misure, categorie,
  WBS, ordine, quadro economico, contabilità.
- **Apri progetto** — ripristina tutto: riprendi esattamente da dove avevi lasciato. I vecchi
  file `.ehub` si aprono ancora.

## 8. I miei dati si salvano? Servono account o internet?

Gli strumenti lavorano sui file che apri tu (prezzari .xlsx/XML, XPWE, PDF, `.quadra`). Le preferenze (tema,
aspetto, utenti locali, ultimo stato) restano **sul tuo computer**: non viene inviato niente su
internet e **non serve un account** cloud per usare l'app.

## 9. "L'app dice che è danneggiata / Windows mi avvisa"

Non è rotta: è solo che l'app **non è firmata digitalmente**.
- **Mac** ("è danneggiata"): vedi la soluzione in [doc 05](05-Manutenzione-e-Troubleshooting.md#mac).
- **Windows** (avviso SmartScreen): clicca *Ulteriori informazioni → Esegui comunque*.

Se costruisci l'app **in locale** (vedi doc 03) il problema non compare proprio.

---

➡️ Prossimo: [03 — Build e Release](03-Build-e-Release.md)

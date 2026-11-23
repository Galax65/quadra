# Quadra — roadmap

Dove sta andando Quadra, versione per versione. Le novità già rilasciate sono in [CHANGELOG.md](CHANGELOG.md).

## Numerazione delle versioni

- **0.x.y** — `y` cresce con correzioni e piccoli ritocchi, `x` con un gruppo di funzioni nuove.
- **0.9** — *release candidate*: nessuna funzione nuova, solo uso reale e correzioni.
- **1.0** — lo stesso codice della 0.9, dopo un periodo d'uso senza errori su importi e stampe.
- Le funzioni di computo assistito (AI, modello BIM) arrivano **dopo la 1.0**: prima un programma di contabilità affidabile, poi l'assistenza.

## Verso la 1.0

### 0.2 — funzioni complete ✓
Computo con misure, categorie, WBS, lavori a corpo e oneri della sicurezza; offerte e quadro comparativo; stampe di progetto e di contabilità complete; appalto misto e offerta a prezzi unitari in contabilità.

### 0.3 — un'opera reale dall'inizio alla fine
- [ ] Un intervento reale condotto interamente in Quadra: computo → gara (lista delle lavorazioni o offerte) → contratto → almeno due SAL con certificati di pagamento → stato finale e conto finale.
- [ ] Verifica degli importi al centesimo contro atti già prodotti e controllati (vedi la checklist in fondo). Ogni differenza va spiegata o corretta.
- [ ] Raccolta di ciò che manca o rallenta il lavoro: diventa la lista della 0.4.

### 0.4 — interoperabilità e Windows
- [ ] Giro completo del formato di interscambio **XPWE**: esportazione da Quadra e rilettura senza perdite (misure, categorie, WBS, sicurezza, lavori a corpo, nuovi prezzi).
- [ ] Backup e ripristino di un progetto completo su un altro computer.
- [ ] Prova completa su **Windows**: installazione, apertura e salvataggio dei progetti, stampe PDF.
- [ ] Correzioni emerse dalla 0.3.

### 0.5 – 0.8 — secondo le priorità
- [ ] **Lettura IFC** (primo passo verso il modello BIM, vedi «Dopo la 1.0»).
- [ ] **Firma del codice** per macOS: installazione senza passaggi manuali.
- [ ] Libretto dei ferri.
- [ ] Giornale dei lavori collegato alla contabilità.
- [ ] Lavori a corpo con percentuale di avanzamento per sottocomputo (aliquote dei corpi d'opera).
- [ ] Cronoprogramma.
- [ ] Versione **iPad** via web (Safari / PWA): comandi touch, uso offline.

### 0.9 — release candidate
- [ ] Nessuna funzione nuova: solo uso reale e correzione degli errori.

### 1.0
- [ ] Lo stesso codice della 0.9, se nel periodo di prova non emergono errori su importi o stampe.

## Dopo la 1.0 — modello BIM e computo assistito

Dopo la 1.0 il centro dello sviluppo è il **computo dal modello** e l'**assistenza dell'AI**. Ogni passo è utile anche da solo.

### IFC bidirezionale
- [ ] **Lettura**: Quadra apre l'IFC (IFC4 / IFC2x3) esportato dal software di modellazione: elementi con GUID, tipo, piano, classificazione, materiali e strati, quantità e proprietà. Ogni riga di misura ricorda l'elemento da cui proviene.
- [ ] **Assegnazione**: regole e AI propongono la voce di prezzario per elemento o materiale; il tecnico conferma.
- [ ] **Scrittura verso il modello**: codice della voce, prezzo e stato dell'assegnazione restituiti come proprietà dedicate, per vederli e filtrarli nel software di modellazione.
- [ ] **Confronto tra versioni del modello**: due IFC confrontati per GUID → misure aggiunte, variate, eliminate; il computo si aggiorna senza perdere le scelte manuali (voci aggiunte a mano, nuovi prezzi, categorie, scelte di gara).
- [ ] Prezzari e regole di assegnazione condivisi tra computo dal modello e computo tradizionale.

### Associazione semiautomatica delle voci
- [ ] Da una descrizione libera («massetto in sabbia e cemento 5 cm») proporre le voci di prezzario più adatte, con il perché.
- [ ] Da un elenco di lavorazioni (foglio di calcolo, capitolato, relazione) proporre la voce per ogni riga: si accetta, se ne sceglie un'altra o si crea un nuovo prezzo.
- [ ] Controlli di coerenza: unità di misura incompatibili, voci duplicate, lavorazioni senza le voci collegate.

### Computo dai disegni
- [ ] **PDF vettoriali**: lettura di quote, superfici, lunghezze e conteggi con la scala della tavola; ogni misura proposta porta tavola e posizione, e si apre il disegno evidenziato per verificarla.
- [ ] **DWG / DXF**: layer, polilinee chiuse (aree), lunghezze, blocchi (conteggi), testi.
- [ ] **Tavole scansionate**: riconoscimento assistito, solo come proposta da verificare.

### Dati di progetto
- [ ] Lettura di relazioni e capitolato: proposta della struttura (categorie, WBS) e delle lavorazioni da computare.
- [ ] Confronto computo / capitolato: lavorazioni descritte e non computate, o computate e non descritte.

### Fotografie e cantiere
- [ ] Fotografie datate e geolocalizzate collegate a voci, misure e SAL; documentazione fotografica del SAL in PDF.
- [ ] Proposta di avanzamento delle lavorazioni (anche a corpo) dalle fotografie, da confermare da parte del direttore dei lavori.
- [ ] Fotografie a supporto di riserve, verbali e giornale dei lavori.

### Principi
- **L'AI propone, il tecnico conferma.** Ogni proposta resta segnata come tale e porta la sua fonte (modello, tavola, pagina, fotografia) finché non viene accettata.
- Negli atti contabili non entra nulla che non sia stato attestato dal direttore dei lavori.
- I dati di progetto non escono dal computer senza una scelta esplicita dell'utente; dove possibile, elaborazione in locale.

## Checklist di verifica degli importi (0.3)

Stesso intervento, stessi prezzi, stesse misure: confrontare con atti già prodotti e controllati.

- **Computo**: totale lavori; totali per categoria e per WBS; quantità di ogni voce; totale della sicurezza; scomposizione misura / corpo / sicurezza.
- **Elenco prezzi e nuovi prezzi**: prezzi in cifre e in lettere; codici dei nuovi prezzi e origine.
- **Contratto**: base di gara, importo offerto, ribasso (4 decimali), importo contrattuale, oneri della sicurezza.
- **Per ogni SAL**: quantità progressive del libretto; importi del registro (pagina per pagina, riporti); lavori a misura, a corpo, in economia; ribasso; sicurezza liquidata; ritenuta dello 0,5 %; anticipazione e recupero; certificato di pagamento (importo, IVA, arrotondamento, importo in lettere).
- **Sommario**: richiami SAL / pagina del registro e totali per voce.
- **Perizia di variante**: quadro comparativo (contratto / perizia / differenza) e nuovo importo.
- **Chiusura**: stato finale, credito residuo, conto finale.
- **Arrotondamenti**: dove i risultati differiscono, annotare la regola applicata (per voce, per riga di misura, per totale).

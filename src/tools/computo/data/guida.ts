/** Computo — sezione della guida unica condivisa (prezzari + computo metrico). */
import type { GuideSection } from '../../../shared/ui/guide'

export const MIU_GUIDE: GuideSection = {
  id: 'miu',
  title: 'Computo — Prezzari e computo metrico',
  tool: 'computo',
  order: 40,
  updatedAt: '2026-11-15',
  chapters: [
    {
      id: 'come-funziona',
      title: 'Come funziona',
      bodyHtml: `<p class="ehb-guide__lead">I prezzari servono a <b>consultare</b> e a pescare le voci. Il <b>Computo Metrico è del tuo progetto</b> e ha il suo <b>Elenco Prezzi</b>: le voci che aggiungi ci restano, indipendenti dalla ricerca, e le puoi modificare.</p>
      <p>In testa alla barra filtri c'è il toggle <b>Rapida / Completa</b>: <b>Rapida</b> (default) è la
        sola consultazione — cerca, seleziona, copia l'Elenco Prezzi, un solo passo; il
        dock <b>Da copiare</b> mostra conteggio, totale e la mini-lista delle voci scelte,
        con la ✕ per togliere quella sbagliata senza ricercarla, e una maniglia per regolarne
        l'altezza. <b>Completa</b> è il computo intero, con tutte le aree nel binario. Passare da una
        all'altra non perde nulla: la Rapida nasconde soltanto, il computo resta popolato. Se il
        computo è già popolato — sessione ripresa, .quadra, distinta importata — Computo si apre in Completa,
        finché non scegli tu.</p>
      <p><b>Il binario in alto sono le aree del computo</b>, non una procedura a passi: ci vai quando ti servono, nell'ordine che vuoi.<br>
      <b>EP prezzari</b> (i listini caricati, regionali o privati, da cui peschi le voci) · <b>EP progetto</b> (gli articoli di questo lavoro, col loro prezzo e la provenienza) · <b>Dati generali</b> · <b>Misure</b> · <b>Categorie / WBS</b>. Le <b>stampe</b> stanno in testata, sempre raggiungibili. <b>Esc</b> torna agli EP prezzari.</p>`,
    },
    {
      id: 'cerca-componi',
      title: 'EP prezzari — cerca o componi',
      bodyHtml: `<ul>
        <li><b>Porta il tuo prezzario</b>: trascinalo <b>ovunque nella finestra</b> (o usa <b>⋯ Altro → Trascina file</b> per sfogliare). Se è disponibile in più formati scegli l'<b>.xml</b>: Computo ha un parser dedicato per ogni famiglia di prezzario e ne legge i campi veri (codice, articolazione, unità di misura). Dell'<b>.xlsx</b> legge il <b>primo foglio</b> deducendo le colonne dalle intestazioni — funziona, ma perde di più. Anche un elenco prezzi <b>.xpwe</b> (es. il DEI) si carica allo stesso modo, tra i prezzari privati.</li>
        <li><b>Carica</b> uno o più prezzari dalla lista a sinistra. Un prezzario che trascini nella finestra viene letto una volta e <b>salvato su questo computer</b>: al prossimo avvio è di nuovo nell'elenco e l'ultimo usato si riapre da solo (✕ accanto al nome per toglierlo). Restano in cache, ma quello <b>APERTO</b> (che consulti, e su cui cercano i motori di match dell'import) è <b>sempre uno solo alla volta</b>. Clicca un altro prezzario nella lista per passare a quello.</li>
        <li><b>Cerca in linguaggio naturale</b>: scrivi come lo chiami tu — «passerella a filo», «tubo corrugato», «valvola a sfera» — non serve la dicitura esatta del prezzario. Le più pertinenti salgono in alto. La ricerca per <b>codice</b> funziona come sempre. I <b>chip macrocategoria</b> (Elettrici / Speciali / Meccanici / Antincendio) e i <b>filtri</b> restringono il campo; <b>✕ Reset filtri</b> azzera tutto.</li>
        <li><b>Aggiungi le voci al computo</b> con <b>＋ Aggiungi al computo</b>. Seleziona prima le righe (<b>clic</b>, <b>Shift+clic</b> per un intervallo, <b>trascina</b> per un blocco; da tastiera <b>↑↓</b> + <b>Spazio</b>, <b>Ctrl/⌘+A</b> tutte), oppure apri il dettaglio con <b>doppio clic</b>. <b>Importante</b>: la selezione serve solo a scegliere — <b>deselezionare o rifare la ricerca NON toglie nulla dal computo</b>. Un <b>✓</b> accanto al codice segnala le voci già dentro.</li>
        <li><b>✎ Componi descrizione</b> (accanto alla ricerca): quando il prezzario non ha la voce che ti serve, scegli una famiglia e le sue caratteristiche a chip — o crea una <b>famiglia personalizzata</b> — e ottieni una descrizione breve+estesa in stile computo. Con <b>Σ Analisi Prezzi</b> componi il prezzo unitario (manodopera + materiale + noli, Spese Generali e Utile d'Impresa): la riga manodopera propone da sola una <b>tariffa CCNL pertinente</b> in base alla macrocategoria della voce, e il fascicolo mostra l'<b>incidenza % manodopera</b> sul prezzo unitario. Puoi anche importare una <b>scheda tecnica PDF</b> — il riconoscimento è ottimizzato per produttori raggruppati per comparto (illuminazione, meccanica/frigo, elettrogeni, UPS, ACS, elettrico/EV, TVCC…).</li>
        <li><b>Libreria voci</b>: dal Compositore/Analisi Prezzi puoi salvare una voce composta in libreria (personale, o «di studio») e riusarla senza ricomporla.</li>
      </ul>`,
    },
    {
      id: 'misura',
      title: 'Misure',
      bodyHtml: `<ul>
        <li>Qui c'è il <b>Computo Metrico</b> con il suo <b>Elenco Prezzi</b>. Scrivi la quantità, o apri <b>▸ Misure</b> sulla voce per le righe di misura: <b>par.ug. × L1 × L2 × H/peso</b>, negative per le detrazioni.</li>
        <li><b>Formule</b> nei campi: <code>12+250+65</code>, <code>2x3,5</code>, <code>(4+2)/2</code>. Nel campo vedi il risultato (in corsivo se viene da una formula), entrando vedi la formula. Le formule si salvano, passano nell'XPWE e si stampano nel libretto.</li>
        <li><b>↪ Vedi voce</b>: la riga prende come L1 la quantità di un'altra voce del computo e si aggiorna da sola (con par.ug. 0,5 ne prendi la metà).</li>
        <li><b>Copia / Incolla</b> righe fra voci, anche <b>da e verso Excel</b> (colonne descrizione, par.ug., L1, L2, H). <b>Da altro computo…</b> copia le misure da un XPWE o da un progetto Quadra.</li>
        <li>Tastiera: <b>Invio</b> nuova riga · <b>↑ ↓</b> campo sopra/sotto · <b>Alt+↑ ↓</b> sposta la riga · <b>Ctrl+D</b> duplica · <b>Ctrl+Canc</b> elimina · <b>Esc</b> chiude. Righe e voci si <b>trascinano</b> con la maniglia ⠿.</li>
        <li><b>ORDINA</b>: manuale (trascinando), per <b>Categorie</b> o per <b>WBS</b>; <b>Collassa tutte</b> mostra una riga per voce.</li>
        <li><b>✎ modifica</b> una voce: descrizione, U.M. e prezzo sono dell'<b>articolo</b> e cambiano su tutte le voci di computo con lo stesso codice. Il prezzario resta intatto.</li>
        <li><b>⧉ Duplica</b> (tasto destro): la stessa voce in più sottocategorie; le copie restano lo stesso articolo.</li>
      </ul>`,
    },
    {
      id: 'struttura',
      title: 'Struttura: categorie, WBS e modelli',
      bodyHtml: `<p><b>☰ Struttura</b> apre l'albero del progetto con voci e importi di ogni ramo.</p>
      <ul>
        <li><b>Categorie</b> (Supercategoria › Categoria › Subcategoria): rinomina un ramo su tutte le voci (con un nome già esistente i due rami si fondono), elimina un ramo (le voci salgono al livello sopra), sposta un gruppo con ↑ ↓, aggiungi rami vuoti che poi trovi fra le scelte.</li>
        <li><b>WBS</b>: codice e descrizione dei nodi; cambiare un codice lo cambia nei figli e nelle voci; ＋ aggiunge un nodo col primo codice libero.</li>
        <li><b>Modelli</b>: salva la struttura come modello e applicala a un altro progetto (aggiunge solo ciò che manca). In <b>Amministrazione → Modelli</b> li rinomini, duplichi, esporti e importi.</li>
      </ul>`,
    },
    {
      id: 'categorizza',
      title: 'Categorie / WBS',
      bodyHtml: `<p>Assegna alle voci <b>Supercategoria</b>, <b>Categoria</b> e <b>Subcategoria</b> e il codice <b>WBS</b>. Trascina i nomi dal <b>Database categorie</b> sulla voce, o scrivili a mano; col <b>tasto destro</b> assegni a tutta la selezione. <b>Ogni livello è indipendente</b>. <b>✕</b> toglie la categoria dalla voce.</p>`,
    },
    {
      id: 'prezzi',
      title: 'EP progetto — elenco prezzi, nuovi prezzi e analisi',
      bodyHtml: `<ul>
        <li>Nel pannello <b>Elenco Prezzi</b> c'è una riga per <b>articolo</b> (×2 = usato in due voci di computo), con filtro per codice o descrizione.</li>
        <li>Cambiando un prezzo di prezzario resta il <b>prezzo di listino</b> (▲▼ e % nel pannello) con lo <b>storico</b> e il motivo; <b>Ripristina il prezzo di listino</b> lo riporta indietro.</li>
        <li><b>Lavori a corpo</b>: la chip <b>◫ a corpo</b> sulla voce la rende a corpo (prezzo complessivo fisso, D.Lgs. 36/2023): in stampa va nella sezione «Lavori a corpo» e in Contabilità diventa un corpo d'opera contabilizzato a quote %.</li>
        <li><b>Offerte</b> (Esporta → <b>Offerte e quadro comparativo</b>): stampa la <b>richiesta di offerta</b>, inserisci le offerte ricevute (prezzi voce per voce, anche incollati da Excel, o un ribasso unico), stampa il <b>quadro comparativo</b> con graduatoria al minor prezzo e <b>aggiudica</b>: con l'offerta a prezzi unitari i prezzi offerti passano alla Contabilità.</li>
        <li><b>Altre stampe</b>: computo <b>senza prezzi</b> (opzione nella stampa del computo), <b>lista delle lavorazioni e forniture</b> per l'offerta, <b>elenco nuovi prezzi</b>, <b>incidenza della sicurezza</b>. Il pulsante <b>⎙ Stampe</b> nel computo le raccoglie tutte.</li>
        <li><b>Oneri della sicurezza</b>: le voci dei capitoli della sicurezza di cantiere (es. FVG cap. 99) sono riconosciute da sole e portano il bollino <b>SICUREZZA</b>. Per segnarne o toglierne una: <b>✎ modifica</b> → «Oneri della sicurezza», oppure clic destro sulle voci selezionate → <b>⛑ Oneri della sicurezza</b>, oppure clic sul bollino per toglierlo. In stampa stanno in una sezione a sé, non soggetta a ribasso.</li>
        <li><b>Rendi nuovo prezzo</b> (nella modifica) dà il codice NP.nnn e conserva il codice d'origine; <b>Verbale NP</b> stampa il verbale di concordamento dei nuovi prezzi.</li>
        <li><b>Aggiorna prezzi…</b>: variazione % in blocco, oppure aggiornamento dai <b>prezzari caricati</b> (es. l'anno nuovo), analisi comprese.</li>
        <li><b>Σ Analisi Prezzi</b>: manodopera, materiali, noli, spese generali e utile; <b>Analisi per</b> N unità (il prezzo è il totale diviso N) e <b>Arrotonda a</b> 0,01 · 0,05 · 0,10 · 1 €. Le percentuali sono quelle del prezzario regionale o del capitolato.</li>
      </ul>`,
    },
    {
      id: 'esporta',
      title: 'Stampe ed export',
      bodyHtml: `<p><b>Stampa del computo</b> in PDF: descrizione estesa, ridotta o «prime e ultime righe» (le sottovoci in fondo restano visibili), ordine a schermo, per categorie o WBS, riepilogo finale per categorie e/o WBS. Poi <b>Elenco prezzi</b> (con i prezzi in lettere), <b>Stima dei lavori</b>, <b>Incidenza manodopera</b> (costo della manodopera voce per voce, dalla % del prezzario o dell'analisi), <b>Quadro economico</b>, <b>Verbale nuovi prezzi</b>, i fascicoli <b>Σ Analisi Prezzi</b> e l'export <b>XPWE</b>.</p>
      <details><summary>Perché una voce non si trova nella ricerca?</summary><div>O è nel prezzario <b>chiuso</b> (carica quello giusto prima), oppure il termine cercato è troppo di nicchia per il match naturale — prova col <b>codice</b> esatto, oppure componila da zero con <b>✎ Componi descrizione</b>.</div></details>
      <details><summary>Se cambio il prezzo di una voce usata più volte?</summary><div>Cambia su tutte le voci di computo con lo stesso codice: il prezzo è dell'articolo dell'elenco prezzi. Il prezzario di partenza non cambia.</div></details>
      <details><summary>Cambiando prezzario perdo le voci già aggiunte al computo?</summary><div>No: l'Elenco Prezzi contiene copie, non collegamenti alla ricerca — il computo resta invariato qualunque prezzario tu apra o chiuda dopo. Per allinearti a un prezzario nuovo usa <b>Aggiorna prezzi…</b>.</div></details>
      <details><summary>Posso provare con dei dati di esempio?</summary><div>Sì: nella cartella <code>esempi/</code> del progetto ci sono un computo e una contabilità dimostrativi in XPWE (dati inventati). Trascina il computo nella finestra.</div></details>`,
    },
  ],
  footNote: 'Il computo resta tuo anche cambiando prezzario: l\'Elenco Prezzi contiene <b>copie</b> delle voci, non collegamenti alla ricerca. Salvi tutto nel progetto Quadra (o come «Computo» a parte, dal pulsante <b>Computi</b>).',
}

/** Quadra — sezione «panoramica» della guida unica condivisa. */
import type { GuideSection } from '../../shared/ui/guide'

export const HUB_GUIDE: GuideSection = {
  id: 'hub',
  title: 'Quadra — Panoramica della suite',
  tool: 'hub',
  order: 5,
  updatedAt: '2026-11-15',
  chapters: [
    {
      id: 'cos-e',
      title: 'Cos\'è Quadra',
      bodyHtml: `<p class="ehb-guide__lead">Quadra è il programma per il computo metrico e la contabilità dei lavori: ogni tool copre un pezzo del flusso, e si passano dati tra loro senza doverli ridigitare.</p>`,
    },
    {
      id: 'flusso',
      title: 'Il flusso tra i tool',
      bodyHtml: `<ul>
        <li><b>Computo</b> — prezzari, computo metrico con misure, categorie e WBS, elenco prezzi e nuovi prezzi, analisi prezzi, stampe PDF e XPWE.</li>
        <li><b>Computo → Contabilità</b>: dal Computo (o da un XPWE) la <b>Contabilità</b> redige libretto delle misure, registro, sommario, SAL, certificati di pagamento, perizie e verbali del DL.</li>
        <li><b>Amministrazione</b> — utenti, intestazioni dei documenti, modelli di struttura (categorie e WBS), backup della configurazione.</li>
      </ul>`,
    },
    {
      id: 'progetto',
      title: 'Progetto Quadra (.quadra)',
      bodyHtml: `<p><b>Nuovo progetto</b> riparte da zero azzerando tutti i tool; <b>Salva progetto</b> mette insieme lo stato di TUTTI i tool aperti in un unico file <code>.quadra</code>; <b>Apri progetto</b> lo ripristina, così riprendi esattamente da dove avevi lasciato, in ogni tool. <b>Salva con nome…</b> scegli tu nome e cartella di destinazione.</p>
      <p>Questi quattro pulsanti vivono in un solo posto per volta: nella <b>sidebar</b> (sempre raggiungibili, anche a sidebar collassata) e nella <b>barra in alto</b> quando un tool è aperto — non più duplicati nella schermata iniziale, per lasciare più spazio alle card dei tool.</p>`,
    },
    {
      id: 'accesso',
      title: 'Accesso e profili',
      bodyHtml: `<p>All'avvio entri come <b>azienda</b> — scegliendo il tuo <b>utente</b> dall'elenco — oppure come <b>amministratore</b>. Con un profilo aziendale il <b>logo dell'azienda</b> compare nelle <b>intestazioni dei documenti</b> generati dai tool. L'<b>amministratore</b> gestisce gli utenti e le impostazioni dell'organizzazione dal tool <b>Amministrazione Centro di controllo</b> (si apre dal pulsante «Admin» in Impostazioni), non da un pannello dentro l'hub — e vede la barra delle <b>novità</b> che agli altri profili resta nascosta.</p>`,
    },
    {
      id: 'guida',
      title: 'Come funziona questa guida',
      bodyHtml: `<p>Il pulsante rosso <b>? Guida</b> (o <b>F1</b>) apre lo stesso visore ovunque nella suite, ma con un comportamento diverso a seconda di dove lo premi: <b>da dentro un tool</b> mostra <b>solo la sua sezione</b> — non l'intero manuale con gli altri tool sullo sfondo — con un link <b>«Vedi il manuale completo →»</b> in fondo per chi vuole comunque sfogliare tutto. <b>Dall'hub</b> (qui), F1 apre sempre il <b>manuale completo</b>: tutte le sezioni nell'indice a sinistra, colorate con l'accento del tool, capitoli chiusi finché non li apri — così la guida resta leggera anche con tanti tool.</p>`,
    },
    {
      id: 'backup-dati',
      title: 'Backup dati: cosa NON viaggia col Progetto',
      bodyHtml: `<p>Alcune cose valgono per lo studio, non per un singolo progetto: le <b>voci composte</b> salvate in Libreria con le loro <b>Analisi Prezzi</b>, il <b>vocabolario delle categorie</b> e i <b>modelli di struttura</b> (categorie e WBS). Vivono <b>solo sul computer su cui lavori</b>, non nel file <code>.quadra</code>: un collega con un altro PC non le eredita, e se il disco si rompe vanno perse.</p>
      <p>Da <b>Impostazioni → Backup dati</b> le esporti in un file e le importi su un altro PC: importare <b>unisce</b>, non cancella quello che c'è già.</p>`,
    },
    {
      id: 'aspetto',
      title: 'Aspetto',
      bodyHtml: `<p>Da <b>Impostazioni → Aspetto</b> (sidebar) scegli <b>palette</b> colori (5: ardesia, carbonio, pergamena, notturno, inchiostro), <b>font</b> (5, JetBrains Mono di default), <b>densità</b> (normale/compatta), <b>intensità ombre</b> e <b>animazioni</b> dell'interfaccia, comuni a tutta la suite; la <b>dimensione del testo</b> si regola con continuità da uno <b>slider</b> (usa A− / A+ per passi fini). Il tema chiaro/scuro resta separato, sempre in alto a destra in ogni tool.</p>`,
    },
    {
      id: 'schermi-piccoli',
      title: 'Su schermi piccoli',
      bodyHtml: `<p>L'interfaccia si <b>adatta</b> a tablet e finestre strette: sotto i ~768&nbsp;px la barra laterale si comprime e, nei tool con un'area di disegno, i pannelli laterali diventano <b>a scomparsa</b> per lasciare tutta la larghezza al disegno — si riaprono col loro pulsante e tornano fissi appena la finestra si allarga.</p>
      <details><summary>Perché nella guida di un tool vedo solo quel tool e non tutti gli altri?</summary><div>È voluto: da dentro un tool la guida resta focalizzata, senza le sezioni degli altri tool sullo sfondo. Se vuoi consultare anche gli altri, usa il link «Vedi il manuale completo →» in fondo al pannello, oppure apri la guida dall'hub.</div></details>
      <details><summary>«Nuovo progetto» cancella anche la Libreria voci o i modelli di struttura?</summary><div>No: sono dati dello studio (vedi capitolo «Backup dati»), non fanno parte del Progetto — restano anche dopo un «Nuovo progetto» o cambiando file .quadra.</div></details>
      <details><summary>Che differenza c'è tra profilo azienda e amministratore?</summary><div>Il profilo azienda personalizza i documenti col logo aziendale; l'amministratore in più accede al tool Amministrazione Centro di controllo per gestire utenti e impostazioni dell'organizzazione, e vede la barra delle novità.</div></details>`,
    },
  ],
  footNote: 'In ogni tool il pulsante rosso <b>? Guida</b> (o <b>F1</b>) apre questo manuale — sulla sola sezione del tool se lo apri da lì, completo se lo apri dall\'hub · in fondo alla home trovi <b>Crediti</b> e <b>Note legali</b>.',
}

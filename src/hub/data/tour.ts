import type { Tour } from '../../shared/ui/components/tour'

export const HUB_TOUR: Tour = {
  id: 'home',
  steps: [
    {
      selector: '#brand-mark',
      title: 'Benvenuto in Quadra',
      text: 'È il programma per il computo metrico e la contabilità dei lavori: ogni tool copre un pezzo del flusso e si passano dati fra loro senza doverli ridigitare.',
    },
    {
      selector: '#search-wrap',
      title: 'Cerca un tool',
      text: 'Digita per filtrare l’elenco qui sotto, o premi / per metterti subito a fuoco sulla ricerca.',
    },
    {
      selector: '#welcome-cards',
      title: 'I tool, raggruppati per tema',
      text: 'Le card sono raggruppate per area: Lavoro (dal computo alla contabilità) e, per chi amministra, Amministrazione. Clicca una card per aprirla.',
    },
    {
      selector: '#side-proj',
      title: 'Progetto Quadra',
      text: 'Salva/Apri un file .quadra per portarti dietro lo stato di tutti i tool insieme. "Nuovo progetto" riparte da zero.',
    },
    {
      selector: '.side-proj-btn--guide',
      title: 'La Guida resta sempre qui',
      text: 'Da qui puoi riaprire la guida rapida e rivedere questo tour quando vuoi.',
    },
  ],
}

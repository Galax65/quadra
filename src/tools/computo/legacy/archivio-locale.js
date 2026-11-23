// Computo — ARCHIVIO PREZZARI: ponte verso l'archivio del PROGRAMMA.
// L'implementazione sta in shared/prezzari/archivio.ts ed è la stessa che usa la
// Contabilità: un prezzario importato qui si trova anche di là, perché lo scaffale
// è uno solo (IndexedDB per origine, non per strumento). Questo file resta per non
// toccare gli import dello script legacy.
export {
  salvaPrezzario, elencoPrezzariSalvati, righePrezzarioSalvato,
  dimenticaPrezzarioSalvato, ricordaUltimo, ultimoPrezzario,
} from '../../../shared/prezzari/archivio'

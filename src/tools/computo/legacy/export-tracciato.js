/* Computo legacy — helper di testo per gli export (padding, latin-1, XML, U.M.).

   Lo stato condiviso sta in stato.js, le funzioni degli altri moduli si importano
   per nome: gli import circolari sono sicuri perché i nomi si usano solo dentro i
   corpi funzione (live-binding ESM), come già fanno computo.js e compositore.js. */

export function pad(s,len){return String(s||'').substring(0,len).padEnd(len,' ');}

export function padN(n,len){ return String(Math.max(0,Math.round(n))).padStart(len,'0').slice(-len); }



// converte una stringa in bytes latin-1 per il download
export function latin1Bytes(str){
  const out=new Uint8Array(str.length);
  for(let i=0;i<str.length;i++){ out[i]=str.charCodeAt(i)&0xff; }
  return out;
}


// Utility XML generiche (escape/sanitize) e etichetta unità, usate da chi genera
// export in formato XML/Excel a partire dalle righe del computo.
export function xmlEsc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
// Rimuove i caratteri di controllo ILLEGALI in XML 1.0 (C0 tranne TAB/LF/CR): se finiscono
// grezzi in un file XML/Excel non è ben formato e l'import viene rifiutato in blocco.
export function sanitizeXmlText(s){return String(s==null?'':s).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,'');}

export function umLabel(um){
  // etichetta unità per la riga SOMMANO
  const u=(um||'').trim();
  return u||'cad';
}

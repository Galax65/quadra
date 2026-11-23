// Computo legacy — ESPORTAZIONI: builder di contenuti per l'interscambio
// (Elenco Prezzi TSV, binario→bytes per xlsx). Estratti da index.js nello STEP 2 dello split.

function buildTSVContent(rows){
  const q=s=>'"'+String(s||'').replace(/"/g,'""').replace(/[\r\n]+/g,' ').trim()+'"';
  const price=n=>'"'+(Number(n)||0).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})+'"';
  // Incidenza manodopera (%) — vuota se il prezzario non la fornisce
  const pct=n=>(n==null||n===''||!isFinite(Number(n)))?'""':'"'+Number(n).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})+'"';
  const _n=t=>String(t||'').replace(/\s+/g,' ').trim();
  const lines=rows.map(r=>{
    // Sintetica = breve LEGGIBILE. Data-driven (come combineDesc): se la declaratoria
    // è "PADRE — foglia" (la contiene in coda, stile Basilicata) usa quella, così non
    // resta il frammento orfano "fino a kg 1.200…". Altrimenti la desc_short.
    // No-op sui prezzari con desc_short già completa (Veneto/Lombardia/Piemonte/…).
    const s=_n(r.desc_short), e=_n(r.declaratoria);
    const sintetica=(s&&e&&e!==s&&!e.startsWith(s)&&e.endsWith(s)) ? e : (s||e);
    const estesa=e||s;
    return [q(r.codice), q(sintetica), q(estesa), q(r.um), price(r.prezzo), pct(r.ru)].join('\t');
  });
  const regSet=[...new Set(rows.map(r=>r.regione))];
  const regLabel=(regSet.length===1?regSet[0]:'MultiReg').substring(0,20);
  const annoSet=[...new Set(rows.map(r=>r.anno).filter(a=>a&&a!=='—'))];
  const annoLabel=annoSet.length===1?annoSet[0]:'';
  return { content:lines.join('\r\n')+'\r\n', regLabel, annoLabel };
}


function b64ToUint8(b64){
  const bin=atob(b64); const u=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i);
  return u;
}

export { buildTSVContent, b64ToUint8 }

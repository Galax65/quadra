// Computo legacy — modulo categorie.js (STEP 2 split). Le funzioni chiamate si
// importano da index.js (barrel), lo stato da stato.js. Import circolari sicuri:
// i nomi si usano solo nei corpi funzione (live-binding ESM).
import { CAT_LIVELLI, CAT_LIVELLO_LABEL, CAT_SEP, S } from './stato.js'
import {
  CAT_DB, CAT_DB_ORIGIN, CAT_LIVELLO_HINT, CAT_PALETTE, CAT_PANEL_FILTER, esc, openCatPopover, persistCatDb,
  persistCatDbOrigin, refreshCartOverlayIfOpen, refreshCatDbGroups, setCatDbFilter, setCategoria, setCategoriaLivello
} from './index.js'

function catChipDragOver(ev,slot){
  ev.stopPropagation();
  const lv=CAT_LIVELLI[slot];
  if(!ev.dataTransfer.types.includes('text/catlv:'+lv)) return; // niente preventDefault → drop bloccato dal browser
  ev.preventDefault();
  ev.currentTarget.classList.add('drop-target');
}

function catChipDrop(ev,key,slot){
  ev.preventDefault();
  ev.stopPropagation();
  ev.currentTarget.classList.remove('drop-target');
  // una chip WBS dal pannello: va nel codice WBS della voce, non nelle categorie
  if(ev.dataTransfer.types.includes('text/wbs')){ setWbs(key, ev.dataTransfer.getData('text/wbs')); return; }
  const liv=(slot!=null&&slot>=0)?slot:null;
  const format=liv!=null?('text/catlv:'+CAT_LIVELLI[liv]):'text/catlv';
  let d; try{ d=JSON.parse(ev.dataTransfer.getData(format)||'null'); }catch(e){ d=null; }
  if(!d||!d.nome) return;
  setCategoriaLivello(key, liv!=null?liv:Math.max(0,CAT_LIVELLI.indexOf(d.lv)), d.nome);
}

// Nomi ammessi al livello `livello` secondo la struttura predisposta nel progetto
// (Struttura → Categorie, o un modello applicato): solo i rami coerenti con i livelli
// superiori già scelti per la voce.
function catOpzioniDichiarate(key,livello){
  const rami=(Array.isArray(S.catDichiarate)?S.catDichiarate:[]).map(r=>String(r).split(CAT_SEP).map(x=>x.trim()).filter(Boolean));
  if(!rami.length) return [];
  const p=categoriaSlots(S.categoria[key]);
  const out=[];
  for(const r of rami){
    if(r.length<=livello) continue;
    let ok=true; for(let i=0;i<livello;i++) if(p[i] && r[i]!==p[i]){ ok=false; break; }
    if(ok && !out.includes(r[livello])) out.push(r[livello]);
  }
  return out;
}

function catChipEdit(el,key,livello){
  if(el.querySelector('input,select')) return;
  const opzioni=el.dataset.libero?[]:catOpzioniDichiarate(key,livello);
  if(opzioni.length){
    // struttura predisposta: si sceglie da elenco, «＋ altro…» per un nome fuori struttura
    const cur=categoriaSlots(S.categoria[key])[livello]||'';
    el.classList.add('editing');
    el.innerHTML=`<select>
      <option value="">— vuoto —</option>
      ${opzioni.map(n=>`<option value="${esc(n)}"${n===cur?' selected':''}>${esc(n)}</option>`).join('')}
      ${cur&&!opzioni.includes(cur)?`<option value="${esc(cur)}" selected>${esc(cur)} (fuori struttura)</option>`:''}
      <option value="__altro">＋ altro…</option></select>`;
    const sel=el.querySelector('select');
    sel.focus();
    let done=false;
    sel.addEventListener('click',e=>e.stopPropagation());
    sel.addEventListener('keydown',e=>{ e.stopPropagation(); if(e.key==='Escape'){ done=true; refreshCartOverlayIfOpen(); } });
    sel.addEventListener('change',()=>{
      done=true;
      if(sel.value==='__altro'){ el.innerHTML=''; el.dataset.libero='1'; catChipEdit(el,key,livello); return; }
      setCategoriaLivello(key,livello,sel.value);
    });
    sel.addEventListener('blur',()=>{ if(!done){ done=true; refreshCartOverlayIfOpen(); } });
    return;
  }
  const p=categoriaSlots(S.categoria[key]);
  const cur=p[livello]||'';
  el.classList.add('editing');
  el.innerHTML=`<input list="catdb-dl-${livello}" value="${esc(cur)}">`;
  const inp=el.querySelector('input');
  inp.focus(); inp.select();
  let done=false;
  const commit=()=>{ if(done) return; done=true; setCategoriaLivello(key,livello,inp.value); };
  inp.addEventListener('keydown',e=>{
    e.stopPropagation();
    if(e.key==='Enter') commit();
    else if(e.key==='Escape'){ done=true; refreshCartOverlayIfOpen(); }
  });
  inp.addEventListener('blur',commit);
  inp.addEventListener('click',e=>e.stopPropagation());
}

function catChips3Html(key){
  const ek=key.replace(/'/g,"\\'");
  const p=categoriaSlots(S.categoria[key]); // posizionale: ogni chip mostra SOLO il suo livello
  const labels=['Supercategoria','Categoria','Subcategoria'];
  return `<div class="cat3">${[0,1,2].map(i=>{
    const v=p[i]||'';
    const color=(i===0&&v)?categoriaColor(v):'';
    return `<span class="cat3-chip${v?'':' empty'}" ${color?`style="--chip-color:${color}"`:''}
      title="${labels[i]}${v?': '+esc(v):''} — clic per sceglierla (dalla struttura del progetto, se predisposta) o digitarla, o trascina qui una chip dello stesso livello"
      onclick="event.stopPropagation();catChipEdit(this,'${ek}',${i})"
      ondragover="catChipDragOver(event,${i})"
      ondragleave="this.classList.remove('drop-target')"
      ondrop="catChipDrop(event,'${ek}',${i})">${v?esc(v):'+'}</span>`;
  }).join('<span class="cat3-sep">›</span>')}</div>`;
}

// ── WBS (Work Breakdown Structure) ─────────────────────────────────────────
// Ogni voce del computo può avere un codice WBS gerarchico a punti ("01.02.03").
// Si digita «codice descrizione» (es. «01.02 Scavi»): il codice va sulla voce, la
// descrizione nella struttura WBS del progetto (S.wbsNodi), riusabile dalle altre voci.
function wbsChipHtml(key){
  const ek=key.replace(/'/g,"\\'");
  const c=(S.wbs[key]||'').trim();
  const d=c?(S.wbsNodi[c]||''):'';
  return `<span class="cat3-chip wbs-chip${c?'':' empty'}"
    title="WBS${c?': '+esc(c)+(d?' — '+esc(d):''):''} — clic per sceglierla dalla struttura WBS (o scriverne una nuova, es. 01.02 Scavi)"
    ondragover="if(event.dataTransfer.types.includes('text/wbs')){event.preventDefault();event.stopPropagation();this.classList.add('drop-target')}"
    ondragleave="this.classList.remove('drop-target')"
    ondrop="catChipDrop(event,'${ek}',-1)"
    onclick="event.stopPropagation();wbsChipEdit(this,'${ek}')">WBS ${c?esc(c):'+'}</span>`;
}
function wbsDatalistHtml(){
  const opts=Object.keys(S.wbsNodi||{}).sort().map(c=>`<option value="${esc(c)}">${esc(S.wbsNodi[c]||'')}</option>`).join('');
  return `<datalist id="wbs-dl">${opts}</datalist>`;
}
function setWbs(key,testo){
  const t=String(testo||'').trim();
  if(!t){ delete S.wbs[key]; }
  else {
    const m=t.match(/^(\S+)\s*(.*)$/);
    const codice=m[1], descr=(m[2]||'').trim();
    S.wbs[key]=codice;
    S.wbsNodi=S.wbsNodi||{};
    if(descr || !(codice in S.wbsNodi)) S.wbsNodi[codice]=descr||S.wbsNodi[codice]||'';
  }
  refreshCartOverlayIfOpen();
}
// Con una struttura WBS predisposta (Struttura → WBS, o un modello applicato) la WBS
// si SCEGLIE da elenco; «＋ nuovo nodo…» resta come uscita per scriverne uno a mano.
function wbsChipEdit(el,key){
  if(el.querySelector('input,select')) return;
  const nodi=S.wbsNodi||{};
  const codici=Object.keys(nodi).sort((a,b)=>a.localeCompare(b,'it',{numeric:true}));
  if(codici.length && !el.dataset.libero){
    const cur=S.wbs[key]||'';
    el.classList.add('editing');
    el.innerHTML=`<select>
      <option value="">— nessuna WBS —</option>
      ${codici.map(c=>`<option value="${esc(c)}"${c===cur?' selected':''}>${esc(c)}${nodi[c]?' — '+esc(nodi[c]):''}</option>`).join('')}
      <option value="__nuovo">＋ nuovo nodo…</option></select>`;
    const sel=el.querySelector('select');
    sel.focus();
    let done=false;
    sel.addEventListener('click',e=>e.stopPropagation());
    sel.addEventListener('keydown',e=>{ e.stopPropagation(); if(e.key==='Escape'){ done=true; refreshCartOverlayIfOpen(); } });
    sel.addEventListener('change',()=>{
      if(sel.value==='__nuovo'){ done=true; el.innerHTML=''; el.dataset.libero='1'; wbsChipEdit(el,key); return; }
      done=true; setWbs(key,sel.value);
    });
    sel.addEventListener('blur',()=>{ if(!done){ done=true; refreshCartOverlayIfOpen(); } });
    return;
  }
  const cur=S.wbs[key]||'';
  el.classList.add('editing');
  el.innerHTML=`<input list="wbs-dl" value="${esc(cur)}" placeholder="01.02 Scavi">`;
  const inp=el.querySelector('input');
  inp.focus(); inp.select();
  let done=false;
  const commit=()=>{ if(done) return; done=true; setWbs(key,inp.value); };
  inp.addEventListener('keydown',e=>{
    e.stopPropagation();
    if(e.key==='Enter') commit();
    else if(e.key==='Escape'){ done=true; refreshCartOverlayIfOpen(); }
  });
  inp.addEventListener('blur',commit);
  inp.addEventListener('click',e=>e.stopPropagation());
}

function catClearBtnHtml(key){
  if(!(S.categoria[key]||'').trim()) return '';
  const ek=key.replace(/'/g,"\\'");
  return `<button class="cat-clear" title="Togli la categoria da questa voce" onclick="event.stopPropagation();setCategoria('${ek}','')">✕</button>`;
}

function catDbAdd(livello,nome,origine){
  nome=(nome||'').trim();
  if(!nome||!CAT_DB[livello]) return;
  if(!CAT_DB[livello].includes(nome)){ CAT_DB[livello].push(nome); persistCatDb(); }
  // un nome nascosto con × torna visibile se lo si riusa
  const nasc=catDbNascoste(); if(nasc[livello]&&nasc[livello].includes(nome)){ nasc[livello]=nasc[livello].filter(x=>x!==nome); try{ localStorage.setItem('miu:catdb-nascoste', JSON.stringify(nasc)); }catch(e){} }
  // la provenienza si registra solo la prima volta (la prima fonte che l'ha
  // introdotta nel vocabolario) — un riuso manuale successivo non la declassa.
  if(origine && !CAT_DB_ORIGIN[livello][nome]){ CAT_DB_ORIGIN[livello][nome]=origine; persistCatDbOrigin(); }
}

function catDbAll(){
  const g=window.CATEGORIE_GOLDEN||{sp:[],cat:[],sb:[]};
  const out={sp:[],cat:[],sb:[]}, seen={sp:new Set(),cat:new Set(),sb:new Set()};
  const push=(lv,n)=>{ n=(n||'').trim(); if(n&&!seen[lv].has(n)){ seen[lv].add(n); out[lv].push(n); } };
  const normSp=n=>(window.normalizzaAmbito?window.normalizzaAmbito(n):n);
  // Golden è già curato/normalizzato in origine — invariato (tranne i nomi nascosti con ×).
  const nasc=catDbNascoste();
  for(const lv of CAT_LIVELLI) (g[lv]||[]).forEach(n=>{ if(!nasc[lv].includes(n)) push(lv,n); });
  // CAT_DB (vocabolario imparato): normalizza la Supercategoria SOLO per le
  // voci non arrivate da un import esterno — quelle restano letterali
  // (imperativo), col pallino di provenienza a segnalarle nel pannello.
  for(const lv of CAT_LIVELLI) (CAT_DB[lv]||[]).forEach(n=>{
    const literal = lv==='sp' && catDbOrigine(lv,n)==='esterno';
    push(lv, literal?n:(lv==='sp'?normSp(n):n));
  });
  // Categorie già assegnate nel computo corrente: letterali sempre (sono
  // ESATTAMENTE ciò che è scritto sulla voce, di origine esterna o no — l'elenco qui
  // serve a riprendere in fretta un valore già usato, non a generalizzarlo).
  for(const r of (S.catDichiarate||[])){ // rami dichiarati in Struttura / da un modello
    const p=categoriaSlots(r); CAT_LIVELLI.forEach((lv,i)=>{ if(p[i]) push(lv,p[i]); });
  }
  for(const k in S.categoria){
    const p=categoriaSlots(S.categoria[k]); // POSIZIONALE: il sotto resta nel livello sotto
    CAT_LIVELLI.forEach((lv,i)=>{ if(p[i]) push(lv,p[i]); });
  }
  // prima i nomi nell'ordine definito della struttura, poi gli altri in ordine alfabetico
  const ord=Array.isArray(S.ordineCat)?S.ordineCat:[];
  CAT_LIVELLI.forEach((lv,i)=>{ const l=ord[i]||[];
    out[lv].sort((a,b)=>{ const ia=l.indexOf(a), ib=l.indexOf(b);
      if(ia>=0||ib>=0) return ia<0?1:ib<0?-1:ia-ib;
      return a.localeCompare(b,'it'); }); });
  return out;
}

function catDbDatalistsHtml(){
  const db=catDbAll();
  return CAT_LIVELLI.map((lv,i)=>`<datalist id="catdb-dl-${i}">${db[lv].map(n=>`<option value="${esc(n)}">`).join('')}</datalist>`).join('');
}

function catDbDragStart(ev){
  const el=ev.currentTarget;
  const payload=JSON.stringify({ lv:el.dataset.lv, nome:el.dataset.nome });
  // due formati: uno generico (per il drop sull'INTERA riga, va al livello di
  // provenienza) e uno per-livello (per il drop su una CHIP specifica — il
  // browser permette il drop solo se il dragover fa preventDefault, e lo fa
  // solo quando i tipi coincidono: una Sottocategoria non può più finire nello
  // slot Supercategoria trascinandola sopra).
  ev.dataTransfer.setData('text/catlv', payload);
  ev.dataTransfer.setData('text/catlv:'+el.dataset.lv, payload);
}

function catDbFeedPath(cat,origine){
  // POSIZIONALE: un valore con solo la Sottocategoria non deve finire nella lista
  // Supercategorie (era il bug: categoriaParts compattava e il sotto diventava super).
  const s=categoriaSlots(cat);
  CAT_LIVELLI.forEach((lv,i)=>{
    if(!s[i]) return;
    const nome=(lv==='sp' && origine!=='esterno' && window.normalizzaAmbito) ? window.normalizzaAmbito(s[i]) : s[i];
    catDbAdd(lv,nome,origine);
  });
}

function catDbGroupsHtml(){
  const db=catDbAll();
  const f=CAT_PANEL_FILTER.trim().toLowerCase();
  return CAT_LIVELLI.map((lv,i)=>{
    const items=db[lv].filter(n=>!f||n.toLowerCase().includes(f));
    return `<div class="catdb-group">
      <div class="catdb-group-hd">${CAT_LIVELLO_LABEL[lv]} <span class="catdb-group-hint">· ${CAT_LIVELLO_HINT[lv]}</span></div>
      <div class="catdb-chips">${items.map(n=>{
        const daEsterno=catDbOrigine(lv,n)==='esterno';
        return `<span class="catdb-chip${daEsterno?' from-esterno':''}" draggable="true" data-lv="${lv}" data-nome="${esc(n)}"
          ondragstart="catDbDragStart(event)" ${i===0?`style="--chip-color:${categoriaColor(n)}"`:''}
          title="${daEsterno?'Voce con codice originale, importata da fuori Computo — ':''}Trascina su una voce (o sulla chip del livello) per assegnare">${daEsterno?'<span class="from-esterno-dot" title="Da un import esterno"></span>':''}${esc(n)}<span class="catdb-x" draggable="false" title="Rimuovi «${esc(n)}» dal database" onmousedown="event.stopPropagation()" onclick="event.stopPropagation();catDbRemove('${lv}','${esc(n).replace(/'/g,"\\'")}')">×</span></span>`;
      }).join('')||'<span class="catdb-none">nessuna</span>'}</div>
      <input class="catdb-add" placeholder="+ nuova…" onkeydown="event.stopPropagation();if(event.key==='Enter'){catDbAdd('${lv}',this.value,'manuale');this.value='';refreshCatDbGroups();}">
    </div>`;
  }).join('');
}

// Gruppo WBS del pannello: i nodi della struttura WBS del progetto (S.wbsNodi),
// trascinabili sulle voci come le categorie; «+ nuova…» accetta «codice descrizione».
function wbsDbGroupHtml(){
  const f=CAT_PANEL_FILTER.trim().toLowerCase();
  const nodi=S.wbsNodi||{};
  const cod=Object.keys(nodi).sort((a,b)=>a.localeCompare(b,'it',{numeric:true}))
    .filter(c=>!f||(c+' '+(nodi[c]||'')).toLowerCase().includes(f));
  return `<div class="catdb-group">
    <div class="catdb-group-hd">WBS <span class="catdb-group-hint">· struttura del progetto</span></div>
    <div class="catdb-chips">${cod.map(c=>`<span class="catdb-chip" draggable="true" data-wbs="${esc(c)}"
        ondragstart="event.dataTransfer.setData('text/wbs',this.dataset.wbs)"
        title="Trascina su una voce per assegnarle la WBS ${esc(c)}${nodi[c]?' — '+esc(nodi[c]):''}"><b>${esc(c)}</b>${nodi[c]?'&nbsp;'+esc(nodi[c]):''}</span>`).join('')
      ||'<span class="catdb-none">nessuna — scrivi qui sotto «01 Demolizioni»</span>'}</div>
    <input class="catdb-add" placeholder="+ nuova… es. 01.02 Scavi" onkeydown="event.stopPropagation();if(event.key==='Enter'){wbsDbAdd(this.value);this.value='';}">
  </div>`;
}
function wbsDbAdd(testo){
  const m=String(testo||'').trim().match(/^(\S+)\s*(.*)$/);
  if(!m) return;
  S.wbsNodi=S.wbsNodi||{};
  S.wbsNodi[m[1]]=(m[2]||'').trim()||S.wbsNodi[m[1]]||'';
  refreshCartOverlayIfOpen();
}

function catDbOrigine(livello,nome){ return (CAT_DB_ORIGIN[livello]||{})[nome]||null; }

function catDbPanelHtml(){
  return `<div class="catdb-panel">
    <div class="catdb-hd">▤ Database categorie</div>
    <input class="catdb-search" placeholder="Cerca…" value="${esc(CAT_PANEL_FILTER)}"
      onkeydown="event.stopPropagation()" oninput="setCatDbFilter(this.value)">
    <div id="catdb-groups">${catDbGroupsHtml()}${wbsDbGroupHtml()}</div>
    <div class="catdb-hint"><span class="from-esterno-dot" style="display:inline-block;vertical-align:1px"></span> = da un import esterno — le altre sono nel database (minato o digitato a mano). I nomi nuovi che usi si aggiungono da soli e restano per i prossimi computi.</div>
  </div>`;
}

// × sulla chip del pannello: toglie il nome dall'elenco. Se è usato da voci del computo
// non si può (va prima tolto dalle voci); altrimenti sparisce dal database imparato, dai
// rami dichiarati (Struttura, modelli, import) e, se è un nome predefinito, viene nascosto.
function catDbRemove(livello,nome){
  const i=CAT_LIVELLI.indexOf(livello);
  const usata=Object.values(S.categoria||{}).filter(c=>categoriaSlots(c)[i]===nome).length;
  if(usata){ window.toast?.(`«${nome}» è usata da ${usata} voc${usata===1?'e':'i'}: toglila prima dalle voci (✕ sulla voce) o rinominala in Struttura`,'warn'); return; }
  CAT_DB[livello]=(CAT_DB[livello]||[]).filter(x=>x!==nome);
  if(CAT_DB_ORIGIN[livello]) delete CAT_DB_ORIGIN[livello][nome];
  if(Array.isArray(S.catDichiarate)){
    // i rami che contengono il nome a quel livello si accorciano al livello sopra
    const nuovi=[];
    for(const r of S.catDichiarate){ const p=categoriaSlots(r); if(p[i]===nome){ const su=p.slice(0,i).filter(Boolean); if(su.length) nuovi.push(su.join(CAT_SEP)); } else nuovi.push(r); }
    S.catDichiarate=[...new Set(nuovi)];
  }
  if(Array.isArray(S.ordineCat)&&S.ordineCat[i]) S.ordineCat[i]=S.ordineCat[i].filter(x=>x!==nome);
  const nascoste=catDbNascoste(); if(!nascoste[livello].includes(nome)){ nascoste[livello].push(nome); try{ localStorage.setItem('miu:catdb-nascoste', JSON.stringify(nascoste)); }catch(e){} }
  persistCatDb(); persistCatDbOrigin(); refreshCatDbGroups();
  window.toast?.(`«${nome}» tolta dall'elenco`,'ok');
}
// nomi predefiniti nascosti dall'utente (tornano se li riusa: vedi catDbAdd)
function catDbNascoste(){ try{ const x=JSON.parse(localStorage.getItem('miu:catdb-nascoste')||'null'); if(x&&x.sp) return x; }catch(e){} return {sp:[],cat:[],sb:[]}; }

function categoriaChipHtml(key){
  const ek=key.replace(/'/g,"\\'");
  const cat=S.categoria[key]||'';
  if(!cat) return `<button class="cat-chip empty" onclick="event.stopPropagation();openCatPopover(this.getBoundingClientRect(),['${ek}'])">+ categoria</button>`;
  const parts=categoriaParts(cat), color=categoriaColor(cat), tail=parts.slice(1).join(' › ');
  return `<span class="cat-chip-wrap"><button class="cat-chip" style="--chip-color:${color}" onclick="event.stopPropagation();openCatPopover(this.getBoundingClientRect(),['${ek}'])" title="${esc(categoriaLabel(cat))}">
    <span class="dot"></span><span class="path"><b>${esc(parts[0])}</b>${tail?' <span class="sub">› '+esc(tail)+'</span>':''}</span>
  </button>${catClearBtnHtml(key)}</span>`;
}

function categoriaColor(cat){
  const l1=categoriaParts(cat)[0]; if(!l1) return '';
  let h=0; for(let i=0;i<l1.length;i++) h=(h*31+l1.charCodeAt(i))>>>0;
  return CAT_PALETTE[h%CAT_PALETTE.length];
}

function categoriaDaDistinta(it){
  if(!it) return '';
  return [it.ambiente, it.disciplina, it.capitolo].filter(Boolean).join(CAT_SEP);
}

function categoriaHeaderRow(cat){
  return `<tr class="cart-cat-head"><td colspan="6" style="padding:9px 4px 4px;font-size:9.5px;text-transform:uppercase;letter-spacing:.6px;color:var(--text3);font-weight:800;border-top:2px solid var(--border)">${esc(cat)}</td></tr>`;
}

function categoriaLabel(cat){ return categoriaParts(cat).join(' › '); }

function categoriaParts(cat){ return (cat||'').split(CAT_SEP).filter(Boolean); }

function categoriaSlots(cat){
  const a=(cat||'').split(CAT_SEP);
  return [ (a[0]||'').trim(), (a[1]||'').trim(), (a[2]||'').trim() ];
}

function categorieUsate(){
  const seen=new Set(); const out=[];
  for(const k in S.categoria){ const v=S.categoria[k]; if(v && !seen.has(v)){ seen.add(v); out.push(v); } }
  return out;
}

export {
  wbsChipHtml, wbsDatalistHtml, wbsChipEdit, setWbs, wbsDbGroupHtml, wbsDbAdd,
  catChipDragOver, catChipDrop, catChipEdit, catChips3Html, catClearBtnHtml, catDbAdd, catDbAll, catDbDatalistsHtml,
  catDbDragStart, catDbFeedPath, catDbGroupsHtml, catDbOrigine, catDbPanelHtml, catDbRemove, categoriaChipHtml, categoriaColor,
  categoriaDaDistinta, categoriaHeaderRow, categoriaLabel, categoriaParts, categoriaSlots, categorieUsate
}

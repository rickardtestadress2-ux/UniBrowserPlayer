javascript:(function(){
  if(window._subIv) clearInterval(window._subIv);
  if(window._subObs) window._subObs.disconnect();

  let D=document, C=e=>D.createElement(e);
  window._subDel=window._subDel||0;
  window._subSiz=window._subSiz||100;
  window._subIdx=(window._subIdx!==undefined)?window._subIdx:-1;
  window._detectedSubs = window._detectedSubs || [];

  // Hjälpfunktion för att spara unika undertext-URL:er
  let addSubUrl = u => {
    if ((u.includes('.m3u8') || u.includes('.mpd') || u.includes('.vtt')) && !window._detectedSubs.includes(u)) {
      window._detectedSubs.push(u);
    }
  };

  // Funktion för att skanna nätverksloggen
  let scanResources = () => {
    (performance.getEntriesByType('resource')||[]).forEach(e => addSubUrl(e.name));
  };

  // PerformanceObserver som extra komplement om webbläsaren stöder det
  if (window.PerformanceObserver) {
    window._subObs = new PerformanceObserver(list => {
      list.getEntries().forEach(e => addSubUrl(e.name));
    });
    try { window._subObs.observe({ entryTypes: ['resource'] }); } catch(e){}
  }

  // Skapa stilregler (skapas i head men syns inte på sidan)
  if(!D.getElementById('sub-s')){
    let s=C('style');
    s.id='sub-s';
    s.innerHTML='#sub-ctrl,.sub-b,.sub-i{all:initial!;box-sizing:border-box!;font:600 13px/1.2 sans-serif!;color:#fff!}#sub-ctrl{z-index:2147483647!;display:flex!;background:#111e!;backdrop-filter:blur(16px)!;border:1px solid #fff3!;border-radius:20px!;position:absolute!;top:20px!;right:20px!;padding:6px 10px!;gap:4px!;align-items:center!;user-select:none!;transition:opacity .3s!}#sub-ctrl.h{opacity:0!;pointer-events:none!}.sub-b{color:#fff!;cursor:pointer!;padding:6px 8px!;border-radius:10px!;background:transparent!;border:none!;display:flex!;align-items:center!;touch-action:manipulation!}.sub-b:hover{background:#ffffff22!}.sub-i{font-size:12px!;opacity:.8!;min-width:38px!;text-align:center!}.sub-d{border-left:1px solid #fff3!;margin:0 2px!;height:14px!}'.replace(/!/g,'!important');
    D.head.append(s);
  }

  let cS=D.getElementById('sub-style')||C('style');
  cS.id='sub-style';
  D.head.append(cS);
  let updS=()=>{cS.innerHTML=`::cue{font-size:${window._subSiz}%!important;opacity:1!important;visibility:visible!important;display:block!important;}`};
  updS();

  let parseVTT=t=>{
    let c=[],lines=t.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n'),i=0,rg=/(\d{2}:)?(\d{2}):(\d{2})[\.,](\d{3})\s*-->\s*(\d{2}:)?(\d{2}):(\d{2})[\.,](\d{3})/,toS=(h,m,s,ms)=>(parseInt(h||0)*3600)+parseInt(m)*60+parseInt(s)+parseFloat('0.'+ms);
    while(i<lines.length){
      let m=lines[i].match(rg);
      if(m){
        let st=toS(m[1]?m[1].slice(0,-1):0,m[2],m[3],m[4]),et=toS(m[5]?m[5].slice(0,-1):0,m[6],m[7],m[8]);
        i++;let txt=[];
        while(i<lines.length&&lines[i].trim()!==''){txt.push(lines[i].trim());i++}
        c.push({st,et,txt:txt.join('\n')})
      }
      i++;
    }
    return c;
  };

  let addCues=(cues,lbl)=>{
    let v=D.querySelector('video');
    if(!v||!cues.length)return alert('Inga undertextrader kunde tolkas');
    let t=v.addTextTrack('subtitles',lbl||'EXT','sv');
    cues.forEach(c=>{try{t.addCue(new VTTCue(c.st,c.et,c.txt))}catch(e){}});
    let tr=[...v.textTracks||[]];
    window._subIdx=tr.indexOf(t);
    tr.forEach((x,i)=>{x.mode=i===window._subIdx?'showing':'disabled'});
    updL();
  };

  let loadUrl=async(u)=>{
    let v=D.querySelector('video');
    if(!v||!u)return;
    try{
      let bUrl=u.substring(0,u.lastIndexOf('/')+1);
      if(u.includes('.mpd')){
        let txt=await fetch(u).then(r=>r.text()),xml=new DOMParser().parseFromString(txt,'text/xml'),aSets=[...xml.querySelectorAll('AdaptationSet')].filter(a=>a.getAttribute('contentType')==='text'||a.getAttribute('mimeType')?.includes('vtt'));
        for(let a of aSets){
          let b=a.querySelector('BaseURL');
          if(b){
            let sUrl=new URL(b.textContent.trim(),bUrl).href,vt=await fetch(sUrl).then(r=>r.text());
            addCues(parseVTT(vt),'DASH');
          }
        }
      }else if(u.includes('.m3u8')){
        let txt=await fetch(u).then(r=>r.text());
        if(txt.includes('#EXT-X-MEDIA:TYPE=SUBTITLES')){
          let m=[...txt.matchAll(/#EXT-X-MEDIA:TYPE=SUBTITLES[^]*?URI="([^"]+)"(?:[^]*?NAME="([^"]+)")?/g)];
          for(let x of m){
            let sUri=new URL(x[1],bUrl).href,sName=x[2]||'HLS',mTxt=await fetch(sUri).then(r=>r.text()),mBase=sUri.substring(0,sUri.lastIndexOf('/')+1),urls=mTxt.split('\n').filter(l=>l.trim()&&!l.startsWith('#')).map(l=>new URL(l.trim(),mBase).href),cues=[];
            for(let u2 of urls){
              if(u2.includes('.vtt')||u2.includes('sub')){
                let vt=await fetch(u2).then(r=>r.text()).catch(()=>'');
                cues.push(...parseVTT(vt));
              }
            }
            if(cues.length)addCues(cues,sName);
          }
        }else{
          let urls=txt.split('\n').filter(l=>l.trim()&&!l.startsWith('#')).map(l=>new URL(l.trim(),bUrl).href),cues=[];
          for(let u2 of urls){
            let vt=await fetch(u2).then(r=>r.text()).catch(()=>'');
            cues.push(...parseVTT(vt));
          }
          addCues(cues,'HLS');
        }
      }else{
        let vt=await fetch(u).then(r=>r.text());
        addCues(parseVTT(vt),'VTT');
      }
    }catch(e){
      alert('Ett fel uppstod vid hämtning: '+e.message);
    }
  };

  let syncCues=t=>{
    if(!t||!t.cues)return;
    try{
      for(let c of t.cues){
        if(c._s===undefined)c._s=c.startTime;
        if(c._e===undefined)c._e=c.endTime;
        let targetStart=c._s+window._subDel,targetEnd=c._e+window._subDel;
        if(Math.abs(c.startTime-targetStart)>0.01)c.startTime=targetStart;
        if(Math.abs(c.endTime-targetEnd)>0.01)c.endTime=targetEnd;
      }
    }catch(e){}
  };

  let updL=()=>{
    let v=D.querySelector('video'),lbl=D.querySelector('#sub-lbl'),ccBtn=D.querySelector('#sub-cc');
    if(!v||!lbl)return;
    let tr=[...v.textTracks||[]];
    if(window._subIdx<0||!tr.length||!tr[window._subIdx]){
      lbl.innerText='OFF';
      if(ccBtn)ccBtn.style.opacity='.5';
    }else{
      let t=tr[window._subIdx];
      lbl.innerText=(t.language||t.label||('Spår '+(window._subIdx+1))).toUpperCase().slice(0,3);
      if(ccBtn)ccBtn.style.opacity='1';
    }
  };

  let buildUI=w=>{
    let ctrl=C('div');
    ctrl.id='sub-ctrl';
    let pd=e=>{e.preventDefault();e.stopPropagation();w.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))};
    let mk=(html,fn,id)=>{
      let b=C('button');
      b.className='sub-b';
      if(id)b.id=id;
      b.innerHTML=html;
      b.onpointerdown=e=>{pd(e);fn()};
      return b;
    };
    let ccBtn=mk('<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 4H5c-1.1 0-2 .9-2 2v12c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v1c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1zm7 0h-1.5v-.5h-2v3h2V13H18v1c0 .55-.45 1-1 1h-3c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1z"/></svg><span id="sub-lbl" style="margin-left:4px">OFF</span>',()=>{
      let v=D.querySelector('video');
      if(!v)return;
      let tr=[...v.textTracks||[]];
      if(!tr.length)return alert('Inga undertexter hittades');
      window._subIdx=(window._subIdx+2)%(tr.length+1)-1;
      tr.forEach((t,i)=>{
        t.mode=i===window._subIdx?'showing':'disabled';
        if(i===window._subIdx)syncCues(t);
      });
      updL();
    },'sub-cc');

    let addBtn=mk('<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>',()=>{
      let detected = window._detectedSubs[window._detectedSubs.length - 1] || '';
      let input=prompt('Klistra in URL till .m3u8, .mpd eller .vtt-fil:', detected);
      if(input)loadUrl(input.trim());
    });

    let sLbl=C('span');
    sLbl.className='sub-i';
    let updSyncLbl=()=>{sLbl.innerText=(window._subDel>=0?'+':'')+window._subDel.toFixed(1)+'s'};
    updSyncLbl();
    let shSync=d=>{
      window._subDel+=d;
      updSyncLbl();
      let v=D.querySelector('video');
      if(!v)return;
      let tr=[...v.textTracks||[]];
      if(window._subIdx>=0&&tr[window._subIdx])syncCues(tr[window._subIdx]);
    };
    let div=()=>Object.assign(C('div'),{className:'sub-d'});
    ctrl.append(ccBtn,addBtn,div(),mk('-0.5s',()=>shSync(-0.5)),sLbl,mk('+0.5s',()=>shSync(0.5)),div(),mk('A-',()=>{window._subSiz=Math.max(50,window._subSiz-15);updS()}),mk('A+',()=>{window._subSiz=Math.min(250,window._subSiz-15);updS()}));
    w.append(ctrl);
    updL();
  };

  // Huvudloopen körs var 250ms
  window._subIv=setInterval(()=>{
    // 1. Skanna efter spellistor/undertexter i nätverksloggen på varje tick
    scanResources();

    // 2. Avbryt (visar inget UI) om ingen videospelare hittats i DOM ännu
    let v=D.querySelector('video');
    if(!v) return;

    let w=v.parentElement;
    if(!w) return;

    if(getComputedStyle(w).position==='static') w.style.position='relative';
    if(!D.getElementById('sub-ctrl')) buildUI(w);

    let m=D.querySelector('.v');
    let c=D.getElementById('sub-ctrl');
    if(c && m) c.classList.toggle('h', m.classList.contains('h'));

    let tr=[...v.textTracks||[]];
    if(window._subIdx<0&&tr.length>0){
      let activeN=tr.findIndex(t=>t.mode==='showing');
      if(activeN>=0)window._subIdx=activeN;
    }
    updL();
    if(window._subIdx>=0&&tr[window._subIdx]){
      let active=tr[window._subIdx];
      if(active.mode!=='showing')active.mode='showing';
      syncCues(active);
    }
  }, 250);
})();

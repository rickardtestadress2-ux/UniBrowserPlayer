javascript:(function(){
  if(window._subIv) clearInterval(window._subIv);
  if(window._subObs) window._subObs.disconnect();

  let D=document, C=e=>D.createElement(e);
  window._subDel=window._subDel||0;
  window._subSiz=window._subSiz||100;
  window._subIdx=(window._subIdx!==undefined)?window._subIdx:-1;
  window._detectedSubs = window._detectedSubs || [];
  window._loadedSubs = window._loadedSubs || new Set();

  let addSubUrl = u => {
    if ((u.includes('.m3u8') || u.includes('.mpd') || u.includes('.vtt')) && !window._detectedSubs.includes(u)) {
      window._detectedSubs.push(u);
    }
  };

  let scanResources = () => {
    (performance.getEntriesByType('resource')||[]).forEach(e => addSubUrl(e.name));
  };

  if (window.PerformanceObserver) {
    window._subObs = new PerformanceObserver(list => {
      list.getEntries().forEach(e => addSubUrl(e.name));
    });
    try { window._subObs.observe({ entryTypes: ['resource'] }); } catch(e){}
  }

  if(!D.getElementById('sub-s')){
    let s=C('style');
    s.id='sub-s';
    s.innerHTML='#sub-ctrl,.sub-b,.sub-i{all:initial!;box-sizing:border-box!;font:600 13px/1.2 -apple-system,BlinkMacSystemFont,sans-serif!;color:#fff!}#sub-ctrl{z-index:2147483647!;display:flex!;background:rgba(17,30,30,.85)!;backdrop-filter:blur(16px)!;-webkit-backdrop-filter:blur(16px)!;border:1px solid rgba(255,255,255,.2)!;border-radius:20px!;position:absolute!;top:15px!;right:15px!;padding:6px 10px!;gap:4px!;align-items:center!;user-select:none!;opacity:0!;pointer-events:none!;transition:opacity .3s!}#sub-ctrl.sub-show{opacity:1!;pointer-events:auto!}.sub-b{color:#fff!;cursor:pointer!;padding:6px 8px!;border-radius:10px!;background:transparent!;border:none!;display:flex!;align-items:center!;touch-action:manipulation!}.sub-b:active{background:rgba(255,255,255,.25)!}.sub-i{font-size:12px!;opacity:.8!;min-width:38px!;text-align:center!}.sub-d{border-left:1px solid rgba(255,255,255,.2)!;margin:0 2px!;height:14px!}'.replace(/!/g,'!important');
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
    if(!v||!cues.length)return;
    let t=v.addTextTrack('subtitles',lbl||'EXT','sv');
    cues.forEach(c=>{try{t.addCue(new VTTCue(c.st,c.et,c.txt))}catch(e){}});
    let tr=[...v.textTracks||[]];
    window._subIdx=tr.indexOf(t);
    tr.forEach((x,i)=>{x.mode=i===window._subIdx?'showing':'disabled'});
    updL();
  };

  let loadUrl=async(u)=>{
    let v=D.querySelector('video');
    if(!v||!u||window._loadedSubs.has(u))return;

    let isDRM = false, allParsedCues = [], isSubTrack = false;

    try{
      let bUrl=u.substring(0,u.lastIndexOf('/')+1);
      if(u.includes('.mpd')){
        let txt=await fetch(u).then(r=>r.text());
        let xml=new DOMParser().parseFromString(txt,'text/xml');
        let aSets=[...xml.querySelectorAll('AdaptationSet')].filter(a=>a.getAttribute('contentType')==='text'||a.getAttribute('mimeType')?.includes('vtt')||a.getAttribute('mimeType')?.includes('ttml'));
        if(aSets.length) {
          isSubTrack = true;
          if(txt.includes('ContentProtection') || txt.includes('cenc:')) isDRM = true;
          for(let a of aSets){
            let b=a.querySelector('BaseURL');
            if(b){
              let sUrl=new URL(b.textContent.trim(),bUrl).href,vt=await fetch(sUrl).then(r=>r.text());
              let parsed = parseVTT(vt);
              allParsedCues.push(...parsed);
              addCues(parsed,'DASH');
            }
          }
        }
      }else if(u.includes('.m3u8')){
        let txt=await fetch(u).then(r=>r.text());

        if(txt.includes('#EXT-X-MEDIA:TYPE=SUBTITLES')){
          isSubTrack = true;
          if(txt.includes('#EXT-X-KEY') || txt.includes('KEYFORMAT')) isDRM = true;
          
          let lines = txt.split('\n');
          for(let line of lines) {
            if(line.includes('#EXT-X-MEDIA:') && line.includes('TYPE=SUBTITLES')) {
              let uriMatch = line.match(/URI="([^"]+)"/);
              let nameMatch = line.match(/NAME="([^"]+)"/);
              if(uriMatch) {
                let sUri = new URL(uriMatch[1], bUrl).href;
                let sName = nameMatch ? nameMatch[1] : 'HLS';
                let mTxt = await fetch(sUri).then(r=>r.text()).catch(()=>'');
                if(mTxt.includes('#EXT-X-KEY')) isDRM = true;
                let mBase = sUri.substring(0, sUri.lastIndexOf('/')+1);
                let urls = mTxt.split('\n').filter(l=>l.trim()&&!l.startsWith('#')).map(l=>new URL(l.trim(),mBase).href);
                let cues = [];
                for(let u2 of urls){
                  let vt = await fetch(u2).then(r=>r.text()).catch(()=>'');
                  cues.push(...parseVTT(vt));
                }
                allParsedCues.push(...cues);
                if(cues.length) addCues(cues, sName);
              }
            }
          }
        }else{
          let lines = txt.split('\n').filter(l=>l.trim()&&!l.startsWith('#'));
          let isVideo = lines.some(l => l.includes('.ts') || l.includes('.m4s') || l.includes('.mp4'));
          
          if(isVideo) {
            window._loadedSubs.add(u);
            return;
          }

          let isSubPlaylist = lines.some(l => l.includes('.vtt') || l.includes('sub') || l.includes('caption')) || txt.includes('WEBVTT');
          if(isSubPlaylist) {
            isSubTrack = true;
            if(txt.includes('#EXT-X-KEY')) isDRM = true;
            let urls=lines.map(l=>new URL(l.trim(),bUrl).href),cues=[];
            for(let u2 of urls){
              let vt=await fetch(u2).then(r=>r.text()).catch(()=>'');
              cues.push(...parseVTT(vt));
            }
            allParsedCues.push(...cues);
            if(cues.length)addCues(cues,'HLS');
          }
        }
      }else{
        let vt=await fetch(u).then(r=>r.text());
        if(vt.includes('WEBVTT') || vt.includes('-->')) {
          isSubTrack = true;
          let cues = parseVTT(vt);
          allParsedCues.push(...cues);
          if(cues.length)addCues(cues,'VTT');
        }
      }

      window._loadedSubs.add(u);

      if (isSubTrack) {
        if (isDRM || allParsedCues.length === 0) {
          alert('Undertext-URL:\n' + u + '\n\nFel: Undertexterna är DRM-skyddade/krypterade eller saknar läsbara undertextrader.');
        } else {
          let sampleText = allParsedCues.slice(0, 3).map((c, i) => `${i + 1}. ${c.txt.replace(/\n/g, ' ')}`).join('\n');
          alert('Undertext hittades och lästes in!\n\nLänk:\n' + u + '\n\nUtdrag ur undertexten:\n' + sampleText);
        }
      }
    }catch(e){
      window._loadedSubs.add(u);
      if(isSubTrack) alert('Undertext-URL:\n' + u + '\n\nFelmeddelande: ' + e.message);
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
      lbl.innerText=tr.length?`OFF (${tr.length})`:'SÖKER...';
      if(ccBtn)ccBtn.style.opacity='.6';
    }else{
      let t=tr[window._subIdx];
      lbl.innerText=(t.language||t.label||('SPÅR '+(window._subIdx+1))).toUpperCase().slice(0,6);
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
    let ccBtn=mk('<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 4H5c-1.1 0-2 .9-2 2v12c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v1c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1zm7 0h-1.5v-.5h-2v3h2V13H18v1c0 .55-.45 1-1 1h-3c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1z"/></svg><span id="sub-lbl" style="margin-left:4px">SÖKER...</span>',()=>{
      let v=D.querySelector('video');
      if(!v)return;
      let tr=[...v.textTracks||[]];
      if(!tr.length)return;
      window._subIdx=(window._subIdx+2)%(tr.length+1)-1;
      tr.forEach((t,i)=>{
        t.mode=i===window._subIdx?'showing':'disabled';
        if(i===window._subIdx)syncCues(t);
      });
      updL();
    },'sub-cc');

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

    ctrl.append(ccBtn,div(),mk('-0.5s',()=>shSync(-0.5)),sLbl,mk('+0.5s',()=>shSync(0.5)),div(),mk('A-',()=>{window._subSiz=Math.max(50,window._subSiz-15);updS()}),mk('A+',()=>{window._subSiz=Math.min(250,window._subSiz-15);updS()}));
    w.append(ctrl);

    let triggerShow=()=>{
      window._subShowUI=true;
      clearTimeout(window._subHideT);
      window._subHideT=setTimeout(()=>{window._subShowUI=false},3000);
    };
    w.addEventListener('pointermove',triggerShow);
    w.addEventListener('touchstart',triggerShow);

    updL();
  };

  window._subIv=setInterval(()=>{
    scanResources();

    let v=D.querySelector('video');
    if(!v) return;

    let latest=[...window._detectedSubs].reverse().find(u=>u.includes('.m3u8')||u.includes('.mpd')||u.includes('.vtt'));
    if(latest&&!window._loadedSubs.has(latest)) loadUrl(latest);

    let w=v.parentElement;
    if(!w) return;

    if(getComputedStyle(w).position==='static') w.style.position='relative';
    if(!D.getElementById('sub-ctrl')) buildUI(w);

    let m=D.querySelector('.v');
    let c=D.getElementById('sub-ctrl');

    let isVisible = m ? !m.classList.contains('h') : !!window._subShowUI;
    if(c) c.classList.toggle('sub-show', isVisible);

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

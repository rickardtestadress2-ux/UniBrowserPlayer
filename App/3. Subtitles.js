(function(){
  if(window._subIv) clearInterval(window._subIv);
  if(window._subObs) window._subObs.disconnect();

  let D=document, C=e=>D.createElement(e);
  window._subDel=window._subDel||0;
  window._subSiz=window._subSiz||100;
  window._subIdx=(window._subIdx!==undefined)?window._subIdx:0;
  window._detectedSubs = window._detectedSubs || [];
  window._loadedSubs = window._loadedSubs || new Set();
  window._allCues = window._allCues || [];

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
    s.innerHTML='#sub-ctrl,.sub-b,.sub-i{all:initial!;box-sizing:border-box!;font:600 13px/1.2 -apple-system,BlinkMacSystemFont,sans-serif!;color:#fff!}#sub-ctrl{z-index:2147483647!;display:flex!;background:rgba(17,30,30,.85)!;backdrop-filter:blur(16px)!;-webkit-backdrop-filter:blur(16px)!;border:1px solid rgba(255,255,255,.2)!;border-radius:20px!;position:absolute!;top:15px!;right:15px!;padding:6px 10px!;gap:4px!;align-items:center!;user-select:none!;opacity:0!;pointer-events:none!;transition:opacity .3s!}#sub-ctrl.sub-show{opacity:1!;pointer-events:auto!}.sub-b{color:#fff!;cursor:pointer!;padding:6px 8px!;border-radius:10px!;background:transparent!;border:none!;display:flex!;align-items:center!;touch-action:manipulation!}.sub-b:active{background:rgba(255,255,255,.25)!}.sub-i{font-size:12px!;opacity:.8!;min-width:38px!;text-align:center!}.sub-d{border-left:1px solid rgba(255,255,255,.2)!;margin:0 2px!;height:14px!}#sub-overlay{position:absolute!;bottom:8%!;left:5%!;right:5%!;text-align:center!;z-index:2147483646!;pointer-events:none!}#sub-overlay span{background:rgba(0,0,0,.75)!;color:#fff!;padding:4px 8px!;border-radius:4px!;font-weight:600!;line-height:1.4!;display:inline-block!;white-space:pre-wrap!}#sub-overlay img{max-width:85%!;max-height:25vh!;display:inline-block!;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.8))!}'.replace(/!/g,'!important');
    D.head.append(s);
  }

  let parseVTT=(t, timeOffset=0, baseUrl='')=>{
    let c=[],lines=t.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n'),i=0,rg=/(\d{2}:)?(\d{2}):(\d{2})[\.,](\d{3})\s*-->\s*(\d{2}:)?(\d{2}):(\d{2})[\.,](\d{3})/,toS=(h,m,s,ms)=>(parseInt(h||0)*3600)+parseInt(m)*60+parseInt(s)+parseFloat('0.'+ms);
    while(i<lines.length){
      let m=lines[i].match(rg);
      if(m){
        let st=toS(m[1]?m[1].slice(0,-1):0,m[2],m[3],m[4]) + timeOffset;
        let et=toS(m[5]?m[5].slice(0,-1):0,m[6],m[7],m[8]) + timeOffset;
        i++;let txt=[];
        while(i<lines.length&&lines[i].trim()!==''){
          let l=lines[i].trim();
          if(l.match(/\.(png|jpg|jpeg|webp)($|\#|\?)/i) || l.startsWith('http')){
            try { l = 'IMG:' + new URL(l, baseUrl).href; } catch(e){}
          }
          txt.push(l);
          i++;
        }
        c.push({st,et,txt:txt.join('\n')});
      }
      i++;
    }
    return c;
  };

  let appendUniqueCues = newCues => {
    let added = 0;
    for (let nc of newCues) {
      if (!window._allCues.some(c => Math.abs(c.st - nc.st) < 0.2 && c.txt === nc.txt)) {
        window._allCues.push(nc);
        added++;
      }
    }
    window._allCues.sort((a,b) => a.st - b.st);
    return added;
  };

  let loadUrl=async(u)=>{
    let v=D.querySelector('video');
    if(!v||!u||window._loadedSubs.has(u))return;

    window._loadedSubs.add(u);
    let newlyAdded = 0, isSubTrack = false;

    try{
      let bUrl=u.substring(0,u.lastIndexOf('/')+1);
      if(u.includes('.m3u8')){
        let txt=await fetch(u).then(r=>r.text());
        if(txt.includes('#EXT-X-MEDIA:TYPE=SUBTITLES')){
          isSubTrack = true;
          let lines = txt.split('\n');
          for(let line of lines) {
            if(line.includes('#EXT-X-MEDIA:') && line.includes('TYPE=SUBTITLES')){
              let uriMatch = line.match(/URI="([^"]+)"/);
              if(uriMatch) {
                let sUri = new URL(uriMatch[1], bUrl).href;
                let mTxt = await fetch(sUri).then(r=>r.text()).catch(()=>'');
                let mBase = sUri.substring(0, sUri.lastIndexOf('/')+1);
                let urls = mTxt.split('\n').filter(l=>l.trim()&&!l.startsWith('#')).map(l=>new URL(l.trim(),mBase).href);
                let currentOffset = 0;
                for(let u2 of urls){
                  let vt = await fetch(u2).then(r=>r.text()).catch(()=>'');
                  let parsed = parseVTT(vt, currentOffset, u2);
                  if(parsed.length) {
                    newlyAdded += appendUniqueCues(parsed);
                    let lastCue = parsed[parsed.length-1];
                    if(lastCue && lastCue.et > currentOffset) currentOffset = lastCue.et;
                  }
                }
              }
            }
          }
        } else {
          let lines = txt.split('\n').filter(l=>l.trim()&&!l.startsWith('#'));
          let isVideo = lines.some(l => l.includes('.ts') || l.includes('.m4s') || l.includes('.mp4'));
          if(isVideo) return;

          isSubTrack = true;
          let urls = lines.map(l=>new URL(l.trim(),bUrl).href);
          let currentOffset = 0;
          for(let u2 of urls){
            let vt = await fetch(u2).then(r=>r.text()).catch(()=>'');
            let parsed = parseVTT(vt, currentOffset, u2);
            if(parsed.length){
              newlyAdded += appendUniqueCues(parsed);
              let lastCue = parsed[parsed.length-1];
              if(lastCue && lastCue.et > currentOffset) currentOffset = lastCue.et;
            }
          }
        }
      }else if(u.includes('.vtt')){
        let vt=await fetch(u).then(r=>r.text());
        if(vt.includes('WEBVTT')||vt.includes('-->')){
          isSubTrack = true;
          let parsed = parseVTT(vt, 0, u);
          newlyAdded += appendUniqueCues(parsed);
        }
      }

      if (isSubTrack && newlyAdded > 0) {
        let sample = window._allCues.slice(-3).map((c, i) => `[${c.st.toFixed(0)}s] ${c.txt.replace(/\n/g, ' ')}`).join('\n');
        alert('Nya undertexter fylldes på!\nTotalt i minnet: ' + window._allCues.length + ' rader\n\nSenaste raderna:\n' + sample);
      }
    }catch(e){}
  };

  let buildUI=w=>{
    let ctrl=C('div'); ctrl.id='sub-ctrl';
    let ov=C('div'); ov.id='sub-overlay'; ov.innerHTML='<span id="sub-txt" style="display:none"></span><img id="sub-img" style="display:none" />';
    w.append(ctrl, ov);

    let pd=e=>{e.preventDefault();e.stopPropagation();w.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))};
    let mk=(html,fn,id)=>{
      let b=C('button'); b.className='sub-b'; if(id)b.id=id; b.innerHTML=html;
      b.onpointerdown=e=>{pd(e);fn()}; return b;
    };
    let ccBtn=mk('CC ON',()=>{ window._subIdx = window._subIdx === 0 ? -1 : 0; },'sub-cc');
    let sLbl=C('span'); sLbl.className='sub-i';
    let updSyncLbl=()=>{sLbl.innerText=(window._subDel>=0?'+':'')+window._subDel.toFixed(1)+'s'}; updSyncLbl();
    let shSync=d=>{ window._subDel+=d; updSyncLbl(); };
    let div=()=>Object.assign(C('div'),{className:'sub-d'});

    ctrl.append(ccBtn,div(),mk('-0.5s',()=>shSync(-0.5)),sLbl,mk('+0.5s',()=>shSync(0.5)),div(),mk('A-',()=>{window._subSiz=Math.max(50,window._subSiz-15);}),mk('A+',()=>{window._subSiz=Math.min(250,window._subSiz+15);}));

    let triggerShow=()=>{
      window._subShowUI=true; clearTimeout(window._subHideT);
      window._subHideT=setTimeout(()=>{window._subShowUI=false},3000);
    };
    w.addEventListener('pointermove',triggerShow);
    w.addEventListener('touchstart',triggerShow);
  };

  window._subIv=setInterval(()=>{
    scanResources();
    let v=D.querySelector('video'); if(!v)return;

    for (let u of window._detectedSubs) {
      if (!window._loadedSubs.has(u)) {
        loadUrl(u);
      }
    }

    let w=v.parentElement; if(!w)return;
    if(getComputedStyle(w).position==='static') w.style.position='relative';
    if(!D.getElementById('sub-ctrl')) buildUI(w);

    let m=D.querySelector('.v'); let c=D.getElementById('sub-ctrl');
    let isVisible=m?!m.classList.contains('h'):!!window._subShowUI;
    if(c) c.classList.toggle('sub-show',isVisible);

    let txtElem=D.querySelector('#sub-txt'), imgElem=D.querySelector('#sub-img');
    if(txtElem && imgElem){
      txtElem.style.fontSize=window._subSiz+'%';
      if(window._subIdx>=0&&window._allCues.length){
        let now=v.currentTime-window._subDel;
        let activeCue=window._allCues.find(c=>now>=c.st&&now<=c.et);
        if(activeCue){
          if(activeCue.txt.startsWith('IMG:')){
            let imgUrl=activeCue.txt.replace('IMG:','').split('#')[0];
            if(imgElem.src!==imgUrl)imgElem.src=imgUrl;
            imgElem.style.display='inline-block';
            txtElem.style.display='none';
          }else{
            txtElem.innerText=activeCue.txt;
            txtElem.style.display='inline-block';
            imgElem.style.display='none';
          }
        }else{
          txtElem.style.display='none';
          imgElem.style.display='none';
        }
      }else{
        txtElem.style.display='none';
        imgElem.style.display='none';
      }
    }
  },250);
})();

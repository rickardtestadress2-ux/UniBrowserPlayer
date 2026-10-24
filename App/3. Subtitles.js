(function () {
  // 1. Reset any existing interval to avoid duplicate instances
  if (window._subIv) clearInterval(window._subIv);

  let D = document,
      C = (e) => D.createElement(e);

  // Initialize global configuration state on window
  window._subDel = window._subDel || 0;                                 // Subtitle delay offset in seconds
  window._subSiz = window._subSiz || 100;                               // Subtitle font size percentage
  window._subIdx = window._subIdx !== undefined ? window._subIdx : -1;  // Selected track index (-1 = OFF)

  // 2. Inject default UI CSS styles if not already present
  if (!D.getElementById('sub-s')) {
    let s = C('style');
    s.id = 'sub-s';
    s.innerHTML = `
      #sub-ctrl, .sub-b, .sub-i {
        all: initial !important;
        box-sizing: border-box !important;
        font: 600 13px/1.2 sans-serif !important;
        color: #fff !important;
      }
      #sub-ctrl {
        z-index: 2147483647 !important;
        display: flex !important;
        background: #111e !important;
        backdrop-filter: blur(16px) !important;
        border: 1px solid #fff3 !important;
        border-radius: 20px !important;
        position: absolute !important;
        top: 20px !important;
        right: 20px !important;
        padding: 6px 10px !important;
        gap: 4px !important;
        align-items: center !important;
        user-select: none !important;
        transition: opacity .3s !important;
      }
      #sub-ctrl.h {
        opacity: 0 !important;
        pointer-events: none !important;
      }
      .sub-b {
        color: #fff !important;
        cursor: pointer !important;
        padding: 6px 8px !important;
        border-radius: 10px !important;
        background: transparent !important;
        border: none !important;
        display: flex !important;
        align-items: center !important;
        touch-action: manipulation !important;
      }
      .sub-b:hover {
        background: #ffffff22 !important;
      }
      .sub-i {
        font-size: 12px !important;
        opacity: .8 !important;
        min-width: 38px !important;
        text-align: center !important;
      }
      .sub-d {
        border-left: 1px solid #fff3 !important;
        margin: 0 2px !important;
        height: 14px !important;
      }
    `;
    D.head.append(s);
  }

  // 3. Inject CSS rule for subtitle sizing (`::cue`)
  let cS = D.getElementById('sub-style') || C('style');
  cS.id = 'sub-style';
  D.head.append(cS);

  let updS = () => {
    cS.innerHTML = `::cue {
      font-size: ${window._subSiz}% !important;
      opacity: 1 !important;
      visibility: visible !important;
      display: block !important;
    }`;
  };
  updS();

  // 4. Adjust cue timing based on current delay (_subDel)
  let syncCues = (t) => {
    if (!t || !t.cues) return;
    try {
      for (let c of t.cues) {
        if (c._s === undefined) c._s = c.startTime; // Store original start time
        if (c._e === undefined) c._e = c.endTime;   // Store original end time
        let targetStart = c._s + window._subDel,
            targetEnd = c._e + window._subDel;
        if (Math.abs(c.startTime - targetStart) > 0.01) c.startTime = targetStart;
        if (Math.abs(c.endTime - targetEnd) > 0.01) c.endTime = targetEnd;
      }
    } catch (e) {}
  };

  // 5. Construct overlay controller UI
  let buildUI = (w) => {
    let ctrl = C('div');
    ctrl.id = 'sub-ctrl';

    let pd = (e) => {
      e.preventDefault();
      e.stopPropagation();
      w.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    };

    let mk = (html, fn) => {
      let b = C('button');
      b.className = 'sub-b';
      b.innerHTML = html;
      b.onpointerdown = (e) => {
        pd(e);
        fn();
      };
      return b;
    };

    // Subtitle track toggle button
    let ccBtn = mk(
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 4H5c-1.1 0-2 .9-2 2v12c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v1c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1zm7 0h-1.5v-.5h-2v3h2V13H18v1c0 .55-.45 1-1 1h-3c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1z"/></svg><span id="sub-lbl" style="margin-left:4px">OFF</span>',
      () => {
        let v = D.querySelector('video');
        if (!v) return;
        let tr = [...(v.textTracks || [])];
        if (!tr.length) return alert('Inga undertexter hittades'); // "No subtitles found" (Swedish)

        // Cycle through subtitle tracks (-1 for OFF, 0 to N-1 for tracks)
        window._subIdx = (window._subIdx + 2) % (tr.length + 1) - 1;
        tr.forEach((t, i) => {
          t.mode = i === window._subIdx ? 'showing' : 'disabled';
          if (i === window._subIdx) syncCues(t);
        });
        updL();
      }
    );

    let updL = () => {
      let v = D.querySelector('video'),
          lbl = ctrl.querySelector('#sub-lbl');
      if (!v || !lbl) return;
      let tr = [...(v.textTracks || [])];
      if (window._subIdx < 0 || !tr.length || !tr[window._subIdx]) {
        lbl.innerText = 'OFF';
        ccBtn.style.opacity = '.5';
      } else {
        let t = tr[window._subIdx];
        lbl.innerText = (t.language || t.label || 'Spår ' + (window._subIdx + 1))
          .toUpperCase()
          .slice(0, 3);
        ccBtn.style.opacity = '1';
      }
    };

    let sLbl = C('span');
    sLbl.className = 'sub-i';
    let updSyncLbl = () => {
      sLbl.innerText = (window._subDel >= 0 ? '+' : '') + window._subDel.toFixed(1) + 's';
    };
    updSyncLbl();

    let shSync = (d) => {
      window._subDel += d;
      updSyncLbl();
      let v = D.querySelector('video');
      if (!v) return;
      let tr = [...(v.textTracks || [])];
      if (window._subIdx >= 0 && tr[window._subIdx]) syncCues(tr[window._subIdx]);
    };

    let div = () => Object.assign(C('div'), { className: 'sub-d' });

    // Assemble control bar elements: CC Toggle, Sync -0.5s / +0.5s, Subtitle Size A- / A+
    ctrl.append(
      ccBtn,
      div(),
      mk('-0.5s', () => shSync(-0.5)),
      sLbl,
      mk('+0.5s', () => shSync(0.5)),
      div(),
      mk('A-', () => {
        window._subSiz = Math.max(50, window._subSiz - 15);
        updS();
      }),
      mk('A+', () => {
        window._subSiz = Math.min(250, window._subSiz + 15);
        updS();
      })
    );

    w.append(ctrl);
    updL();
  };

  // 6. Polling interval (every 250ms) to ensure overlay stays attached and synced
  window._subIv = setInterval(() => {
    let v = D.querySelector('video'),
        m = D.querySelector('.v');
    if (!v || !m) return;
    let w = v.parentElement;
    if (!w) return;

    if (getComputedStyle(w).position === 'static') w.style.position = 'relative';
    if (!D.getElementById('sub-ctrl')) buildUI(w);

    let c = D.getElementById('sub-ctrl');
    if (c) c.classList.toggle('h', m.classList.contains('h'));

    let tr = [...(v.textTracks || [])];
    if (window._subIdx >= 0 && tr[window._subIdx]) {
      let active = tr[window._subIdx];
      if (active.mode !== 'showing') active.mode = 'showing';
      syncCues(active);
    }
  }, 250);
})();

(function () {
  let D = document,
    Q = e => D.querySelector(e),
    C = e => D.createElement(e),
    d = Q('.d');
  if (!d) return;
  D.getElementById('f')?.remove();

  let s = D.getElementById('f-s') || C('style');
  if (!s.id) {
    s.id = 'f-s';
    // Ändrat: 'display:none!' till 'display:none' för .vl
    s.innerHTML = '#f,.v,.vb,.vp,.vl{all:initial!;box-sizing:border-box!;z-index:2147483647!;display:flex!}.v,.vp{position:absolute!;transition:opacity .3s!}.v{background:#111e!;backdrop-filter:blur(16px)!;border:1px solid #fff3!;border-radius:20px!;bottom:70px!;right:20px!;padding:8px 16px!;gap:15px!;align-items:center!;user-select:none!}.v.h,.vp.h{opacity:0!;pointer-events:none!}.vb,#f{color:#fff!;cursor:pointer!;padding:10px!;border-radius:50%!;touch-action:manipulation!}.vl{font:bold 11px sans-serif!;cursor:pointer!;padding:4px 6px!;display:none;align-items:center!}.vp{bottom:10px!;left:20px!;right:20px!;height:30px!;touch-action:none!}.vp::before,.vpb{position:absolute!;top:12px!;height:6px!;border-radius:3px!}.vp::before{content:"";left:0!;right:0!;background:#fff5!}.vpb{left:0!;background:red!;pointer-events:none!}:fullscreen{background:#000!;width:100vw!;height:100vh!}:fullscreen video{width:100vw!;height:100vh!;object-fit:contain!;position:absolute!;top:0!;left:0!;z-index:1!}'.replace(/!/g, '!important');
    D.head.append(s);
  }

  let b = C('button');
  b.id = 'f';
  b.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>';
  d.append(b);

  b.onclick = e => {
    e.preventDefault();
    let v = Q('video');
    if (!v) return;

    let pd = x => x && (x.stopPropagation(), x.preventDefault()),
      w = v.parentElement;
    if (!w) return;
    w.style.position = 'relative';

    let init = () => {
      v.removeAttribute('controls');
      D.querySelectorAll('.v,.vp').forEach(x => x.remove());

      let i = p => `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="${p}"/></svg>`,
        pI = i("M5 3l14 9-14 9z"),
        sI = i("M6 4h4v16H6zm8 0h4v16h-4z"),
        ov = C('div'),
        ht,
        dr = 0,
        el = [ov, bar = C('div')],
        fill = C('div');

      bar.className = 'vp';
      fill.className = 'vpb';
      bar.append(fill);
      ov.className = 'v';

      let rt = () => {
        el.forEach(x => x.classList.remove('h'));
        clearTimeout(ht);
        if (!dr && !v.paused) ht = setTimeout(() => el.forEach(x => x.classList.add('h')), 3e3);
      },
      mk = (S, fn, cl = 'vb') => Object.assign(C('button'), {
        className: cl,
        innerHTML: S,
        onpointerdown: c => { rt(); fn && (pd(c), fn()); }
      }),
      rw = mk(i("M11 19l-9-7 9-7v14zm11 0l-9-7 9-7v14z")),
      pBtn = mk(v.paused ? pI : sI, () => v.paused ? v.play() : v.pause()),
      ff = mk(i("M13 19l9-7-9-7v14zM2 19l9-7-9-7v14z")),
      liveBtn = mk('● LIVE', () => { G().e > 0 && (v.currentTime = G().e - .2); }, 'vl'),
      G = () => {
        let d = v.duration,
          // Ändrat: Hanterar även duration > 24h (86400 sek) som live
          L = !isFinite(d) || d <= 0 || d > 86400,
          k = v.seekable?.length ? v.seekable : v.buffered,
          s = k?.length ? k.start(0) : 0,
          e = L || !d ? (k?.length ? k.end(k.length - 1) : 0) : d;
        return { L, s, e, d: Math.max(0, e - s) };
      },
      upd = () => {
        let { L, s, e, d } = G(), c = v.currentTime;
        fill.style.width = d ? Math.max(0, Math.min(100, (c - s) / d * 100)) + '%' : L ? '100%' : '0%';
        liveBtn.style.display = L ? 'inline-flex' : 'none';
        if (L) liveBtn.style.color = !e || e - c < 4 ? '#ff4444' : '#888';
      },
      h = (b, f) => {
        let S, I, U = c => { clearInterval(I); dr = 0; rt(); pd(c); };
        b.onpointerdown = c => {
          rt(); dr = 1; pd(c);
          let { L, s, e, d } = G();
          if (!d && !L) return;
          S = Date.now();
          let r = () => {
            rt();
            let { L, s, e, d } = G(), m = (Date.now() - S) / 1e3;
            if (d > 0) v.currentTime = Math.max(s, Math.min(e - (L ? .2 : 0), v.currentTime + (f ? 2.5 : -2.5) * (m > 5 ? 8 : m > 3 ? 4 : m > 1.5 ? 2 : 1))), upd();
            else if (L && f && e > 0) v.currentTime = e - .2, upd();
          };
          r();
          I = setInterval(r, 750);
          b.setPointerCapture(c.pointerId);
        };
        b.onpointerup = b.onpointercancel = U;
      };

      h(rw, 0);
      h(ff, 1);
      v.onplay = () => pBtn.innerHTML = sI;
      v.onpause = () => pBtn.innerHTML = pI;
      ov.append(rw, pBtn, ff, liveBtn);
      w.append(ov, bar);
      upd();
      rt();
      w.onpointerdown = rt;

      let t = 0,
        updX = x => {
          let { L, s, e, d } = G();
          if (d <= 0) return L ? e : 0;
          let r = bar.getBoundingClientRect(),
            p = Math.max(0, Math.min(1, r?.width ? (x - r.left) / r.width : 0));
          fill.style.width = p * 100 + '%';
          return L && p >= .98 ? e - .2 : s + p * d;
        };

      bar.onpointerdown = x => { rt(); dr = 1; t = updX(x.clientX); bar.setPointerCapture(x.pointerId); pd(x); };
      bar.onpointermove = x => dr == 1 && (t = updX(x.clientX), rt(), pd(x));
      bar.onpointerup = bar.onpointercancel = x => dr == 1 && (dr = 2, (G().d > 0 || (G().L && G().e > 0)) && (v.currentTime = t), rt(), pd(x));

      let E = (f, r) => ['timeupdate', 'loadedmetadata', 'play', 'durationchange', 'seeked', 'progress'].forEach(e => v[r ? 'removeEventListener' : 'addEventListener'](e, f));
      v._h && E(v._h, 1);
      v._h = e => { (e.type == 'seeked' && dr == 2 || dr == 2 && e.type == 'timeupdate') && (dr = 0); dr || upd(); };
      E(v._h);
    };

    let req = w.requestFullscreen?.();
    req?.then ? req.then(init).catch(x => x) : setTimeout(() => D.fullscreenElement && init(), 300);
  };

  if (!window._f) {
    window._f = 1;
    D.addEventListener('fullscreenchange', () => !D.fullscreenElement && D.querySelectorAll('.v,.vp').forEach(x => x.remove()));
  }
})();

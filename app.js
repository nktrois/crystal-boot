(function () {
  'use strict';
  const { createScene, drawFrame, progressAt } = window.Crystal;
  const $ = (id) => document.getElementById(id);

  const defaults = { text: 'CRYSTAL', hl: true, palette: 'synthwave', ending: 'pass', sun: true, grid: true, size: '1280x720', duration: 6.5, fps: 20, colors: 256, loop: true };
  const state = { ...defaults };
  let scene = null, cache = {}, start = 0, raf = 0, busy = false;
  const canvas = $('preview'), ctx = canvas.getContext('2d');

  function readURL() {
    const p = new URLSearchParams(location.search);
    if (p.has('text')) state.text = p.get('text').slice(0, 24);
    if (p.has('palette') && window.Crystal.PALETTES[p.get('palette')]) state.palette = p.get('palette');
    if (['pass', 'hold'].includes(p.get('ending'))) state.ending = p.get('ending');
    for (const k of ['hl', 'sun', 'grid', 'loop']) if (p.has(k)) state[k] = p.get(k) !== '0';
    if (/^\d{2,4}x\d{2,4}$/.test(p.get('size') || '')) state.size = p.get('size');
    const col = Number(p.get('colors')); if ([256, 64, 32, 16].includes(col)) state.colors = col;
    const d = Number(p.get('duration')); if (d >= 2 && d <= 20) state.duration = d;
    const f = Number(p.get('fps')); if ([10, 15, 20, 25, 30].includes(f)) state.fps = f;
  }

  function writeControls() {
    $('text').value = state.text;
    for (const k of ['palette', 'ending', 'duration']) $(k).value = state[k];
    $('fps').value = String(state.fps);
    for (const k of ['hl', 'sun', 'grid', 'loop']) $(k).checked = state[k];
    $('colors').value = String(state.colors);
    const known = [...$('size').options].some(o => o.value === state.size);
    $('size').value = known ? state.size : 'custom';
    $('customSize').classList.toggle('hidden', known);
    if (!known) { const [w, h] = state.size.split('x'); $('customW').value = w; $('customH').value = h; }
  }

  function dims() {
    if (document.body.classList.contains('kiosk')) return { w: innerWidth, h: innerHeight };
    const [w, h] = state.size.split('x').map(Number);
    return { w, h };
  }

  function fitCanvas() {
    const { w, h } = dims();
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; cache = {}; }
    if (document.body.classList.contains('kiosk')) { const vw = innerWidth, vh = innerHeight; if (canvas.width !== vw || canvas.height !== vh) { canvas.width = vw; canvas.height = vh; cache = {}; } canvas.style.width = vw + 'px'; canvas.style.height = vh + 'px'; return; }
    const box = $('stage').getBoundingClientRect();
    const k = Math.min(box.width / w, box.height / h);
    canvas.style.width = Math.floor(w * k) + 'px';
    canvas.style.height = Math.floor(h * k) + 'px';
    canvas.style.imageRendering = k > 1.5 ? 'pixelated' : 'auto';
    $('info').textContent = `${w} × ${h} · ${state.duration} s · ${state.fps} images/s`;
  }

  function render(c, cch, w, h, t) {
    drawFrame(c, scene, cch, {
      width: w, height: h, dpr: 1, caption: state.hl ? 'HL' : '', palette: state.palette, sun: state.sun, grid: state.grid,
      progress: progressAt(t, state.ending), clock: t * state.duration / 6.5, facing: state.ending === 'hold'
    });
  }

  function loop(now) {
    const { w, h } = dims();
    const t = (now - start) / (state.duration * 1000);
    if (t >= 1) {
      render(ctx, cache, w, h, 1);
      if (state.loop && !busy) { if (t >= 1 + 1 / state.duration) start = now; }
      else return;
    } else {
      render(ctx, cache, w, h, Math.max(0, t));
    }
    raf = requestAnimationFrame(loop);
  }

  function replay() {
    cancelAnimationFrame(raf);
    scene = createScene(state.text || ' ');
    fitCanvas();
    start = performance.now();
    raf = requestAnimationFrame(loop);
  }

  function slug() {
    return (window.CrystalFont.normalize(state.text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'crystal') + '-boot';
  }

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  function setBusy(on, label) {
    busy = on;
    $('gifBtn').disabled = on; $('videoBtn').disabled = on; $('headerBtn').disabled = on;
    $('progress').hidden = !on; $('progressBar').style.width = '0';
    $('status').textContent = label || '';
  }

  const tick = () => new Promise(r => setTimeout(r, 0));

  // Renders every frame, reduces it to a shared palette and hands the indexes to onFrame.
  async function renderIndexed(onFrame) {
    const { quantize, applyPalette } = window.gifenc;
    const { w, h } = dims();
    const frames = Math.max(2, Math.round(state.duration * state.fps));
    const off = document.createElement('canvas'); off.width = w; off.height = h;
    const c = off.getContext('2d', { willReadFrequently: true }), cch = {};
    $('status').textContent = 'Préparation des couleurs…';
    const samples = [];
    for (const t of [.15, .35, .5, .7, .9, 1]) {
      render(c, cch, w, h, t);
      const d = c.getImageData(0, 0, w, h).data;
      const step = Math.max(4, Math.floor(d.length / 4 / 60000) * 4);
      for (let i = 0; i < d.length; i += step) samples.push(d[i], d[i + 1], d[i + 2], 255);
    }
    const palette = quantize(new Uint8Array(samples), state.colors, { format: 'rgb565' });
    for (let i = 0; i < frames; i++) {
      render(c, cch, w, h, i / (frames - 1));
      onFrame(applyPalette(c.getImageData(0, 0, w, h).data, palette, 'rgb565'), i, palette);
      $('progressBar').style.width = ((i + 1) / frames * 100).toFixed(1) + '%';
      $('status').textContent = `Image ${i + 1} / ${frames}`;
      if (i % 2 === 0) await tick();
    }
    return { w, h, frames, palette };
  }

  async function exportGif() {
    setBusy(true, '');
    try {
      const gif = window.gifenc.GIFEncoder();
      const delay = Math.round(1000 / state.fps);
      const { w, h } = await renderIndexed((index, i, palette) => {
        gif.writeFrame(index, dims().w, dims().h, { palette: i === 0 ? palette : undefined, delay, repeat: state.loop ? 0 : -1 });
      });
      gif.finish();
      const blob = new Blob([gif.bytes()], { type: 'image/gif' });
      download(blob, slug() + '.gif');
      setBusy(false, `GIF ${w} × ${h} prêt : ${sizeText(blob.size)}.`);
    } catch (e) {
      setBusy(false, 'Échec du GIF : ' + (e.message || e) + '. Essaie une taille plus petite.');
    }
  }

  async function exportHeader() {
    setBusy(true, '');
    try {
      const list = [];
      const { w, h, palette } = await renderIndexed(index => list.push(index.slice()));
      const out = window.CrystalExport.buildHeader({ title: state.text, width: w, height: h, fps: state.fps, loop: state.loop, palette, frames: list });
      download(new Blob([out.text], { type: 'text/plain' }), 'crystal_boot.h');
      const warn = out.bytes > 1200000 ? ' Gros pour un ESP32 : réduis la taille, la durée, les images/s ou les couleurs, ou choisis un schéma de partition « Huge APP ».' : '';
      setBusy(false, `crystal_boot.h prêt : ${sizeText(out.bytes)} dans le firmware.${warn}`);
    } catch (e) {
      setBusy(false, 'Échec de l’export : ' + (e.message || e));
    }
  }

  function sizeText(bytes) {
    return bytes >= 1048576 ? (bytes / 1048576).toFixed(1) + ' Mo' : Math.round(bytes / 1024) + ' Ko';
  }

  function videoType() {
    if (!window.MediaRecorder) return null;
    for (const t of ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']) {
      if (MediaRecorder.isTypeSupported(t)) return t;
    }
    return null;
  }

  async function exportVideo() {
    const type = videoType();
    if (!type) { $('status').textContent = 'Ce navigateur ne sait pas enregistrer de vidéo. Utilise le GIF.'; return; }
    const { w, h } = dims();
    const frames = Math.max(2, Math.round(state.duration * state.fps));
    const off = document.createElement('canvas'); off.width = w; off.height = h;
    const c = off.getContext('2d'), cch = {};
    render(c, cch, w, h, 0);
    const stream = off.captureStream(0), track = stream.getVideoTracks()[0];
    const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: Math.round(w * h * state.fps * 0.4) });
    const chunks = [];
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    const done = new Promise(r => { rec.onstop = r; });
    setBusy(true, 'Enregistrement en temps réel…');
    rec.start();
    const step = 1000 / state.fps, t0 = performance.now();
    for (let i = 0; i < frames; i++) {
      render(c, cch, w, h, i / (frames - 1));
      if (track.requestFrame) track.requestFrame();
      $('progressBar').style.width = ((i + 1) / frames * 100).toFixed(1) + '%';
      const wait = t0 + (i + 1) * step - performance.now();
      await new Promise(r => setTimeout(r, Math.max(0, wait)));
    }
    rec.stop(); await done;
    const ext = type.startsWith('video/mp4') ? 'mp4' : 'webm';
    const blob = new Blob(chunks, { type: type.split(';')[0] });
    download(blob, slug() + '.' + ext);
    setBusy(false, `Vidéo ${ext.toUpperCase()} prête : ${sizeText(blob.size)}.`);
  }

  function shareLink() {
    const url = new URL(location.href); url.search = '';
    for (const [k, v] of Object.entries(state)) if (v !== defaults[k]) url.searchParams.set(k, typeof v === 'boolean' ? (v ? '1' : '0') : String(v));
    return url.toString();
  }

  function bind() {
    $('text').addEventListener('input', () => { state.text = $('text').value; replay(); });
    for (const k of ['palette', 'ending']) $(k).addEventListener('change', () => { state[k] = $(k).value; replay(); });
    const customSize = () => {
      const w = Math.max(64, Math.min(3840, Math.round(Number($('customW').value) || 240)));
      const h = Math.max(64, Math.min(3840, Math.round(Number($('customH').value) || 135)));
      $('customW').value = w; $('customH').value = h; state.size = `${w}x${h}`; replay();
    };
    $('size').addEventListener('change', () => {
      const custom = $('size').value === 'custom';
      $('customSize').classList.toggle('hidden', !custom);
      if (custom) customSize(); else { state.size = $('size').value; replay(); }
    });
    $('customW').addEventListener('change', customSize);
    $('customH').addEventListener('change', customSize);
    $('colors').addEventListener('change', () => { state.colors = Number($('colors').value); });
    for (const k of ['hl', 'sun', 'grid', 'loop']) $(k).addEventListener('change', () => { state[k] = $(k).checked; replay(); });
    $('duration').addEventListener('change', () => {
      const d = Number($('duration').value);
      state.duration = d >= 2 && d <= 20 ? d : defaults.duration; $('duration').value = state.duration; replay();
    });
    $('fps').addEventListener('change', () => { state.fps = Number($('fps').value); fitCanvas(); });
    $('replay').addEventListener('click', replay);
    $('fullscreen').addEventListener('click', () => { const s = $('stage'); (s.requestFullscreen || s.webkitRequestFullscreen || (() => {})).call(s); });
    document.addEventListener('fullscreenchange', () => setTimeout(fitCanvas, 50));
    $('gifBtn').addEventListener('click', () => { if (!busy) exportGif(); });
    $('videoBtn').addEventListener('click', () => { if (!busy) exportVideo(); });
    $('headerBtn').addEventListener('click', () => { if (!busy) exportHeader(); });
    $('copyLink').addEventListener('click', async () => {
      const link = shareLink();
      try { await navigator.clipboard.writeText(link); $('status').textContent = 'Lien copié.'; }
      catch { window.prompt('Copie ce lien :', link); }
    });
    window.addEventListener('resize', fitCanvas);
  }

  readURL();
  if (new URLSearchParams(location.search).get('kiosk') === '1') {
    document.body.classList.add('kiosk');
    document.addEventListener('dblclick', () => document.body.classList.remove('kiosk'));
  }
  writeControls();
  bind();
  replay();
})();

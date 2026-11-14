(function (root) {
  'use strict';
  const Font = root.CrystalFont || (typeof require === 'function' ? require('./font.js') : null);

  const PALETTES = {
    synthwave: {
      bg: '#07060f', grid: '#4ff2e0', sun: ['#ffd76e', '#ff4fb0', '#6b1fa8'],
      ink: ['#3a2a78', '#6b3fc0', '#4fb8e8', '#4ff2e0', '#fff4fb', '#ff4fb0', '#ff86cf']
    },
    amber: {
      bg: '#0b0703', grid: '#ffb000', sun: ['#fff1b8', '#ffb000', '#7a3300'],
      ink: ['#4a2a00', '#7a4a00', '#c07a10', '#ffb000', '#fff4d6', '#ff8c1a', '#ffc65c']
    },
    terminal: {
      bg: '#020803', grid: '#33ff66', sun: ['#d8ffd0', '#33ff66', '#0b4d1a'],
      ink: ['#0d3b16', '#14662a', '#1fa83f', '#33ff66', '#eaffea', '#7dff9a', '#a8ffb8']
    },
    ice: {
      bg: '#04070d', grid: '#8fd3ff', sun: ['#ffffff', '#8fd3ff', '#1d3f8a'],
      ink: ['#1b2a4a', '#2c4f8a', '#4f8fd8', '#8fd3ff', '#ffffff', '#c6e8ff', '#e2f3ff']
    }
  };

  // Diamond cubic basis: eight atoms per cell, four tetrahedral bonds per atom.
  function buildLattice(points) {
    const atoms = [], bonds = [], dedup = new Set();
    const basis = [[0,0,0],[0,.5,.5],[.5,0,.5],[.5,.5,0],[.25,.25,.25],[.25,.75,.75],[.75,.25,.75],[.75,.75,.25]];
    for (let i = -1; i < 2; i++) for (let j = -1; j < 2; j++) for (let k = -1; k < 2; k++) for (const b of basis) {
      const p = [(i + b[0] - .375) * 3.1, (j + b[1] - .375) * 3.1, (k + b[2] - .375) * 3.1];
      const id = p.join(',');
      if (!dedup.has(id)) { dedup.add(id); atoms.push(p); }
    }
    for (let a = 0; a < atoms.length; a++) for (let b = a + 1; b < atoms.length; b++) {
      if (Math.abs(Math.hypot(...atoms[a].map((v, i) => v - atoms[b][i])) - 1.34234) < .015) bonds.push([atoms[a], atoms[b]]);
    }
    for (const [a, b] of bonds) for (let s = 0; s < 10; s++) {
      const t = s / 10;
      points.push([...a.map((v, i) => v + (b[i] - v) * t), 0, .55 + s % 3 * .1]);
    }
    for (const a of atoms) for (let ring = 0; ring < 4; ring++) for (let s = 0; s < 8; s++) {
      const phi = Math.PI * ring / 3, theta = s * Math.PI / 4, r = .19;
      points.push([a[0] + r * Math.sin(phi) * Math.cos(theta), a[1] + r * Math.cos(phi), a[2] + r * Math.sin(phi) * Math.sin(theta), 1, .5 + .5 * Math.sin(phi) * Math.cos(theta - .5)]);
    }
    return { atoms: atoms.length, bonds: bonds.length };
  }

  function buildText(points, text) {
    const rows = Font.lines(text);
    if (!rows.length) return rows;
    const longest = Math.max(...rows.map(r => r.length));
    const scale = Math.min(1, 5.5 / longest) * (rows.length > 1 ? .7 : 1);
    rows.forEach((line, li) => {
      const shift = rows.length > 1 ? (li === 0 ? 4.8 : -4.8) : 0;
      const center = (line.length * 7 - 2) / 2;
      [...line].forEach((ch, k) => Font.glyph(ch).forEach((row, y) => [...row].forEach((bit, x) => {
        if (bit !== '1') return;
        for (let u = 0; u < 3; u++) for (let v = 0; v < 3; v++) for (const z of [3.9, 4.25, 4.6]) {
          points.push([(k * 7 + x + u / 3 - center) * .42 * scale, (3 - y - v / 3 + shift) * .52 * scale, z, 2, z > 4.5 ? 1 : .46]);
        }
      })));
    });
    return rows;
  }

  // Three orbital shells give a larger silhouette and streaks during the fly-through.
  function buildOrbits(points) {
    for (let orbit = 0; orbit < 3; orbit++) for (let s = 0; s < 550; s++) {
      const a = s / 550 * Math.PI * 2, r = 6.1, x = Math.cos(a) * r, y = Math.sin(a) * r;
      const angle = orbit * Math.PI / 3 + .3;
      points.push([x, y * Math.cos(angle), y * Math.sin(angle), 3, .5 + .4 * Math.sin(a)]);
    }
  }

  function createScene(text) {
    const points = [];
    const lattice = buildLattice(points);
    const lines = buildText(points, text);
    buildOrbits(points);
    return { points, lines, lattice };
  }

  // Camera progress for a time fraction t in [0, 1].
  // 'pass' flies through the crystal; 'hold' settles on the text and stays there.
  function progressAt(t, ending) {
    t = Math.max(0, Math.min(1, t));
    if (ending === 'hold') return t < .7 ? t / .7 * .52 : .52;
    return t;
  }

  function drawFrame(ctx, scene, cache, opts) {
    const width = opts.width, height = opts.height, dpr = opts.dpr || 1;
    const pal = PALETTES[opts.palette] || PALETTES.synthwave;
    const t = Math.max(0, Math.min(1, opts.progress));
    const clock = opts.clock == null ? t : opts.clock;
    const arrival = Math.min(1, t / .50), rush = Math.max(0, (t - .56) / .44);
    const ease = 1 - Math.pow(1 - arrival, 3);
    const distance = 34 - 16 * ease - 11 * (rush * rush * (3 - 2 * rush));
    const facing = opts.facing ? 1 : 0;
    const yaw = -.62 * (1 - ease) + (.09 + clock * .10) * (1 - facing * ease) + facing * ease * .015 * Math.sin(clock * 3);
    const pitch = .27 * (1 - ease) + .05 * (1 - facing * ease * .6);
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cx = Math.cos(pitch), sx = Math.sin(pitch);
    const m = Math.min(width, height);
    const font = m >= 1000 ? 8 : m >= 400 ? 9 : Math.max(3, Math.round(m / 45)), cell = font * .61, line = font * 1.13;
    const k = Math.max(.3, Math.min(1.5, width / 1280));
    const cols = Math.ceil(width / cell), rows = Math.ceil(height / line), total = cols * rows;
    if (!cache.depths || cache.depths.length !== total) {
      cache.depths = new Float32Array(total); cache.glyphs = new Uint8Array(total); cache.colors = new Uint8Array(total);
    }
    const { depths, glyphs, colors } = cache;
    depths.fill(-Infinity); glyphs.fill(0); colors.fill(0);
    const focal = Math.min(width * .90, height * 1.45);
    const ramp = ' .,:;+=*#%@';

    for (const p of scene.points) {
      const x = p[0], y = p[1], z = p[2], type = p[3], light = p[4];
      const xx = x * cy + z * sy, zz = -x * sy + z * cy;
      const yy = y * cx - zz * sx, zr = y * sx + zz * cx;
      const d = distance - zr; if (d < .8) continue;
      const scale = focal / d;
      const col = Math.floor((width / 2 + xx * scale) / cell), row = Math.floor((height * .46 - yy * scale) / line);
      if (col < 0 || col >= cols || row < 0 || row >= rows) continue;
      const id = row * cols + col; if (zr <= depths[id]) continue; depths[id] = zr;
      const depth = Math.min(1, Math.max(.15, (zr + 8) / 15));
      glyphs[id] = type === 0 ? 2 + Math.round(depth * 3) : type === 3 ? 2 + Math.round(depth * 2) : Math.min(9, Math.round(3 + light * 5 + depth));
      colors[id] = type === 2 ? (light > .8 ? 4 : 6) : type === 3 ? 5 : Math.min(3, Math.floor(depth * 4));
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = pal.bg; ctx.fillRect(0, 0, width, height);

    if (opts.sun !== false) {
      const r = Math.min(width, height) * .36 * (.7 + .3 * ease), sxc = width / 2, syc = height * .46 + (1 - ease) * height * .22;
      const o = Math.min(1, arrival * 1.6) * (1 - rush) * .42;
      if (o > .01) {
        const g = ctx.createLinearGradient(0, syc - r, 0, syc + r);
        g.addColorStop(0, pal.sun[0]); g.addColorStop(.55, pal.sun[1]); g.addColorStop(1, pal.sun[2]);
        ctx.save(); ctx.globalAlpha = o; ctx.beginPath(); ctx.arc(sxc, syc, r, 0, Math.PI * 2); ctx.clip();
        ctx.fillStyle = g; ctx.fillRect(sxc - r, syc - r, r * 2, r * 2); ctx.fillStyle = pal.bg;
        const sk = Math.max(.35, r / 260); for (let i = 0; i < 7; i++) { const y = syc + r * (.05 + i * .14), h = (2 + i * 1.7) * sk; ctx.fillRect(sxc - r, y + ((clock * 40) % 6) * sk, r * 2, h); }
        ctx.restore();
      }
    }
    if (opts.grid !== false) {
      ctx.save(); ctx.globalAlpha = .32 * (1 - rush); ctx.strokeStyle = pal.grid; ctx.lineWidth = 1;
      const hz = height * .74; ctx.beginPath();
      for (let i = -14; i <= 14; i++) { ctx.moveTo(width / 2 + i * 18 * k, hz); ctx.lineTo(width / 2 + i * 150 * k, height); }
      for (let i = 0; i < 9; i++) { const z = ((i + clock * 14) % 9) / 9, y = hz + (height - hz) * z * z; ctx.moveTo(0, y); ctx.lineTo(width, y); }
      ctx.stroke(); ctx.restore();
    }

    // Each glyph is drawn once into an atlas, then copied: much faster than fillText.
    const key = [font, dpr, opts.palette].join('|');
    if (cache.atlasKey !== key) {
      const aw = Math.ceil(cell * dpr) + 1, ah = Math.ceil(line * dpr) + 1;
      const atlas = (typeof OffscreenCanvas !== 'undefined') ? new OffscreenCanvas(aw * ramp.length, ah * pal.ink.length) : Object.assign(document.createElement('canvas'), { width: aw * ramp.length, height: ah * pal.ink.length });
      const a = atlas.getContext('2d');
      a.font = `${font * dpr}px ui-monospace, SFMono-Regular, Consolas, "DejaVu Sans Mono", monospace`; a.textBaseline = 'top';
      // Below 6 px a character is unreadable: draw a dot whose size follows the glyph density instead.
      pal.ink.forEach((c, ci) => {
        a.fillStyle = c;
        for (let g = 1; g < ramp.length; g++) {
          if (font >= 6) { a.fillText(ramp[g], g * aw, ci * ah); continue; }
          const f = g / (ramp.length - 1), sw = Math.max(1, Math.round((aw - 1) * (.4 + .6 * f))), shh = Math.max(1, Math.round((ah - 1) * (.3 + .7 * f)));
          a.globalAlpha = .45 + .55 * f; a.fillRect(g * aw + Math.floor((aw - 1 - sw) / 2), ci * ah + Math.floor((ah - 1 - shh) / 2), sw, shh); a.globalAlpha = 1;
        }
      });
      Object.assign(cache, { atlas, atlasW: aw, atlasH: ah, atlasKey: key });
    }
    const { atlas, atlasW, atlasH } = cache;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (let i = 0; i < total; i++) if (glyphs[i]) {
      ctx.drawImage(atlas, glyphs[i] * atlasW, colors[i] * atlasH, atlasW, atlasH, Math.round(i % cols * cell * dpr), Math.round(Math.floor(i / cols) * line * dpr), atlasW, atlasH);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const mark = Font.normalize(opts.caption || '');
    const alpha = Math.min(1, Math.max(0, (t - .12) / .2));
    if (mark && alpha > 0) drawMark(ctx, mark, width, height, pal, alpha);
  }

  // The signature uses the same 5x7 block font as the crystal, drawn as pixels with a coloured drop.
  function drawMark(ctx, text, width, height, pal, alpha) {
    const px = Math.max(1, Math.round(Math.min(width, height) / 130));
    const cols = text.length * 6 - 1, rows = 6;
    const x0 = Math.round(width / 2 - cols * px / 2);
    const y0 = Math.round(height - Math.max(rows * px + 3 * px, height * .05) - rows * px);
    ctx.save();
    ctx.globalAlpha = alpha * .55;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(x0 - 2 * px, y0 - 2 * px, (cols + 4) * px, (rows + 4) * px);
    ctx.globalAlpha = alpha;
    const layers = px > 1 ? [[px, pal.ink[5]], [0, pal.ink[4]]] : [[0, pal.ink[4]]];
    for (const [d, colour] of layers) {
      ctx.fillStyle = colour;
      [...text].forEach((ch, k) => Font.glyph(ch).slice(0, rows).forEach((row, y) => [...row].forEach((bit, x) => {
        if (bit === '1') ctx.fillRect(x0 + (k * 6 + x) * px + d, y0 + y * px + d, px, px);
      })));
    }
    ctx.restore();
  }

  const api = { PALETTES, createScene, drawFrame, progressAt };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Crystal = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

const test = require('node:test');
const assert = require('node:assert/strict');
const Font = require('../font.js');
const Crystal = require('../crystal.js');

test('every glyph is 5 columns wide and 6 or 7 rows tall', () => {
  for (const [ch, rows] of Object.entries(Font.GLYPHS)) {
    assert.ok(rows.length === 6 || rows.length === 7, ch);
    for (const r of rows) assert.match(r, /^[01]{5}$/, ch);
  }
});

test('the full alphabet and digits are covered', () => {
  for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') assert.ok(Font.GLYPHS[ch], ch);
});

test('text is normalized: accents, case, unsupported characters', () => {
  assert.equal(Font.normalize('  Élodie  été!  '), 'ELODIE ETE!');
  assert.equal(Font.normalize('a<b>c'), 'ABC');
});

test('long text splits into two balanced lines', () => {
  assert.deepEqual(Font.lines('Hello World'), ['HELLO', 'WORLD']);
  assert.deepEqual(Font.lines('Crystal'), ['CRYSTAL']);
  assert.deepEqual(Font.lines(''), []);
});

test('the diamond lattice has the expected atoms and bonds', () => {
  const s = Crystal.createScene('A');
  assert.equal(s.lattice.atoms, 216);
  assert.equal(s.lattice.bonds, 333);
});

test('text adds points, empty text adds none', () => {
  const empty = Crystal.createScene('').points.length;
  assert.ok(Crystal.createScene('HELLO WORLD').points.length > empty);
});

test('hold ending stops the camera before the fly-through', () => {
  assert.equal(Crystal.progressAt(1, 'hold'), .52);
  assert.equal(Crystal.progressAt(1, 'pass'), 1);
  assert.equal(Crystal.progressAt(-1, 'pass'), 0);
});

const Exp = require('../export.js');

test('RGB565 conversion', () => {
  assert.equal(Exp.rgb565(255, 255, 255), 0xffff);
  assert.equal(Exp.rgb565(255, 0, 0), 0xf800);
  assert.equal(Exp.rgb565(0, 255, 0), 0x07e0);
  assert.equal(Exp.rgb565(0, 0, 255), 0x001f);
});

test('run-length encoding round-trips, runs never exceed 255', () => {
  const f = new Uint8Array(1000);
  for (let i = 0; i < f.length; i++) f[i] = i < 600 ? 0 : (i % 7 === 0 ? 3 : 1);
  const enc = Exp.encodeFrame(f);
  for (let i = 0; i < enc.length; i += 2) assert.ok(enc[i] >= 1 && enc[i] <= 255);
  assert.deepEqual(Exp.decodeFrame(enc, 0, enc.length, f.length), f);
});

test('the Arduino header declares sizes, palette, offsets and data', () => {
  const w = 4, h = 2, frames = [new Uint8Array(8), new Uint8Array([0, 1, 1, 1, 2, 2, 0, 0])];
  const { text } = Exp.buildHeader({ title: 'Quark', width: w, height: h, fps: 10, loop: true, palette: [[0, 0, 0], [255, 0, 0], [255, 255, 255]], frames });
  assert.match(text, /#define CRYSTAL_BOOT_WIDTH 4/);
  assert.match(text, /#define CRYSTAL_BOOT_FRAMES 2/);
  assert.match(text, /crystal_boot_palette\[3\]/);
  assert.match(text, /crystal_boot_offsets\[3\] PROGMEM = \{\n  0, 2, 10\n\}/);
});

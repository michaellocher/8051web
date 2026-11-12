/** 2-Port-Anzeigen des Handbuchs: 16 LEDs, 2×7-Segment, 4×7-Segment (Daten + Select), Punktmatrix. */
import { board, digit, el, rowY, setLit, wire, type DeviceDef } from '../kit.ts';
import { LampBank, label, selectButton } from './b2util.ts';
import { DotMatrix, SEG2_BIT_NAMES, SEG2_OF_BIT, led16Bit, led16Port, mux4Masks } from './disp2p.logic.ts';

const bitOf = (pins: readonly number[], port: number, bit: number) => (((pins[port] ?? 0) >> bit) & 1) === 1;

// ───────────── 16 LEDs ─────────────
const leds16: DeviceDef = {
  id: 'leds16', name: '16 LEDs (oben/unten)', group: '2-Port-Modelle', ports: 2, width: 200,
  desc: '16 Leuchtdioden über 2 Ports: PORT-oben D0–D7 = LED 0–7, PORT-unten D0–D7 = LED 0–7. 1 = rote Anzeige, 0 = weiße Anzeige. '
    + 'Der Knopf „?“ schaltet das Layout um (Ring oder 4×4-Feld).',
  create() {
    const svg = board(200, 2);
    for (let i = 0; i < 8; i++) {
      wire(svg, i, 28); wire(svg, 9 + i, 28);
      label(svg, 2, rowY(i) - 3, `D${i}`); label(svg, 2, rowY(9 + i) - 3, `D${i}`);
    }
    label(svg, 34, 14, 'PORT oben', 'dev-text'); label(svg, 34, 330, 'PORT unten', 'dev-text');
    const ring = el('g', {}, svg);
    const grid = el('g', {}, svg);
    grid.style.display = 'none';
    const cx = 122, cy = 170, r = 62;
    const ringLeds = Array.from({ length: 16 }, (_, i) => {
      const port = led16Port(i), bit = led16Bit(i);
      // oben: von links über den Scheitel nach rechts; unten: von rechts über den Boden nach links
      const a = port === 0 ? Math.PI + ((bit + 0.5) / 8) * Math.PI : ((bit + 0.5) / 8) * Math.PI;
      return el('circle', { cx: cx + r * Math.cos(a), cy: cy + r * Math.sin(a), r: 9, class: 'l16' }, ring);
    });
    label(ring, cx - r + 15, cy - 3, '0', 'dev-text', 'middle'); label(ring, cx + r - 15, cy - 3, '7', 'dev-text', 'middle');
    label(ring, cx + r - 15, cy + 12, '0', 'dev-text', 'middle'); label(ring, cx - r + 15, cy + 12, '7', 'dev-text', 'middle');
    const gridLeds = Array.from({ length: 16 }, (_, i) => {
      const port = led16Port(i), bit = led16Bit(i);
      const x = 56 + (bit % 4) * 33, y = (port === 0 ? 100 : 182) + Math.floor(bit / 4) * 33;
      return el('rect', { x, y, width: 30, height: 30, rx: 3, class: 'l16' }, grid);
    });
    const bank = (els: SVGElement[]) => new LampBank(els, (i, p) => bitOf(p, led16Port(i), led16Bit(i)));
    const banks = [bank(ringLeds), bank(gridLeds)];
    const sel = selectButton(svg, 164, 316, 28, 18, '?', () => {
      const showGrid = ring.style.display !== 'none';
      ring.style.display = showGrid ? 'none' : '';
      grid.style.display = showGrid ? '' : 'none';
    });
    sel.g.setAttribute('aria-label', 'Layout umschalten');
    return {
      svg, drive: () => 0xff,
      sample(p, c) { banks.forEach((b) => b.sample(p, c)); },
      render() { banks.forEach((b) => b.render()); },
    };
  },
};

// ───────────── 2×7-Segment, direkt ─────────────
const seg2: DeviceDef = {
  id: '2x7seg', name: '2 × 7-Segment (direkt)', group: '2-Port-Modelle', ports: 2, width: 160,
  desc: 'Zweistellige 7-Segment-Anzeige mit Direktansteuerung: PORT-oben = linke Ziffer, PORT-unten = rechte Ziffer. '
    + 'Je Port: D0 = dp, D1 = c, D2 = d, D3 = e, D4 = b, D5 = a, D6 = f, D7 = g (1 = Segment leuchtet).',
  create() {
    const svg = board(160, 2);
    const segs: SVGElement[] = [];
    for (let port = 0; port < 2; port++) {
      const base = port * 9;
      for (let bit = 0; bit < 8; bit++) {
        wire(svg, base + bit, 44);
        label(svg, 2, rowY(base + bit) - 3, `D${bit} ${SEG2_BIT_NAMES[bit]}`);
      }
      segs.push(...digit(svg, 82, port === 0 ? 14 : 194, 1.5));
      label(svg, 120, port === 0 ? 140 : 320, port === 0 ? 'oben (links)' : 'unten (rechts)', 'dev-tiny', 'middle');
    }
    // Lampenindex = Port * 8 + Segment (a … g, dp)
    const bank = new LampBank(segs, (i, p) => {
      const seg = i & 7;
      const bit = SEG2_OF_BIT.indexOf(seg as 0);
      return bitOf(p, i >> 3, bit);
    });
    return { svg, drive: () => 0xff, sample(p, c) { bank.sample(p, c); }, render() { bank.render(); } };
  },
};

// ───────────── 4×7-Segment, Daten + Select ─────────────
const mux4: DeviceDef = {
  id: '4x7mux', name: '4 × 7-Segment (Daten + Select)', group: '2-Port-Modelle', ports: 2, width: 296,
  desc: 'Vierstellige 7-Segment-Anzeige für Multiplexbetrieb. PORT-oben (Select, low-aktiv): D0 = Stelle ganz rechts … D3 = Stelle ganz links (0 = Anzeige an, 1 = aus). '
    + 'PORT-unten (Daten): D0 = a, D1 = b, D2 = c, D3 = d, D4 = e, D5 = f, D6 = g, D7 = dp. Der Datenwert erscheint auf der gewählten Stelle.',
  create() {
    const svg = board(296, 2);
    const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'dp'];
    const x0 = 88, dx = 52, top = 120;
    // Stelle pos (0 = rechts) liegt auf dem Bildschirm an Position 3 − pos
    const cxOf = (pos: number) => x0 + (3 - pos) * dx + 20;
    for (let pos = 0; pos < 4; pos++) {
      wire(svg, pos, 32, false);
      label(svg, 2, rowY(pos) - 3, `S${pos}`);
      const x = cxOf(pos) + 8, y = rowY(pos);
      el('path', { d: `M32 ${y} H${x} V${top - 2}`, class: 'dev-wire dev-nofill' }, svg);
    }
    for (let i = 0; i < 8; i++) { wire(svg, 9 + i, 32, false); label(svg, 2, rowY(9 + i) - 3, `D${i} ${names[i]}`); }
    label(svg, 36, 96, 'Select', 'dev-text'); label(svg, 36, 176, 'Daten', 'dev-text');
    const segs: SVGElement[] = [];
    for (let pos = 0; pos < 4; pos++) segs.push(...digit(svg, x0 + (3 - pos) * dx, top, 0.9));
    [3, 2, 1, 0].forEach((pos, k) => label(svg, x0 + k * dx + 20, top + 84, `S${pos}`, 'dev-tiny', 'middle'));
    label(svg, 72, 236, 'Select: 0 = Stelle an, 1 = aus', 'dev-tiny');
    label(svg, 72, 250, 'Daten parallel an allen Stellen;', 'dev-tiny');
    label(svg, 72, 262, 'nur die gewählte Stelle leuchtet.', 'dev-tiny');
    const bank = new LampBank(segs, (i, p) => ((mux4Masks(p[0] ?? 0xff, p[1] ?? 0)[i >> 3]! >> (i & 7)) & 1) === 1);
    return { svg, drive: () => 0xff, sample(p, c) { bank.sample(p, c); }, render() { bank.render(); } };
  },
};

// ───────────── Punktmatrix 7×5 ─────────────
const dotmatrix: DeviceDef = {
  id: 'dotmatrix', name: 'Punktmatrix 7×5', group: '2-Port-Modelle', ports: 2, width: 190,
  desc: '7×5-Punktmatrix mit LED-Kathoden an den Spalten. PORT-oben: D0–D4 = Spalten C1–C5 (low-aktiv), PORT-unten: D0–D6 = Zeilen R1–R7 (high-aktiv). '
    + 'Ein Punkt leuchtet, wenn Zeile = 1 und Spalte = 0. Die Spaltendaten werden gespeichert, bis sie überschrieben werden: '
    + 'erst Spalten sperren (1), dann Zeilen setzen, dann die Spalte aktivieren (0).',
  create() {
    const svg = board(190, 2);
    const mx0 = 100, step = 19;
    const top = rowY(9) - 14;
    el('rect', { x: mx0 - 14, y: top, width: step * 5 + 8, height: rowY(15) + 14 - top, rx: 4, class: 'd2p-board' }, svg);
    for (let c = 0; c < 5; c++) {
      wire(svg, c, 30); label(svg, 2, rowY(c) - 3, `C${c + 1}`, 'dev-text');
      const x = mx0 + c * step;
      el('path', { d: `M30 ${rowY(c)} H${x} V${top + 10}`, class: 'dev-wire dev-nofill' }, svg);
    }
    for (let r = 0; r < 7; r++) {
      wire(svg, 9 + r, mx0 - 14); label(svg, 2, rowY(9 + r) - 3, `R${r + 1}`, 'dev-text');
    }
    const dots: SVGElement[][] = [];
    for (let c = 0; c < 5; c++) {
      dots.push([]);
      for (let r = 0; r < 7; r++) dots[c]!.push(el('circle', { cx: mx0 + c * step, cy: rowY(9 + r), r: 7, class: 'd2p-dot' }, svg));
    }
    const m = new DotMatrix();
    return {
      svg, drive: () => 0xff,
      sample([pa = 0xff, pb = 0xff]) { m.update(pa, pb); },
      render() { for (let c = 0; c < 5; c++) for (let r = 0; r < 7; r++) setLit(dots[c]![r]!, m.dot(c, r) ? 1 : 0); },
    };
  },
};

export const DISP2P_DEVICES: readonly DeviceDef[] = [leds16, seg2, mux4, dotmatrix];

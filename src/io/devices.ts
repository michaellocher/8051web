/** Grundgeräte der Bauteilebibliothek: Schalter, LEDs, 7-Segment-Anzeigen und LCD (Handbuch-Gruppen „Schalter, Tasten …" und „LED, Anzeigen …"). */
import {
  Integrator, bcdDecoderBox, board, digit, el, led, rowY, setLit, toggleSwitch, wire, type DeviceDef,
} from './kit.ts';
import { SevenSegment, SwitchBank, decodeSegments } from './lib/basic.logic.ts';
import { Hd44780 } from './lib/lcd.logic.ts';
import { selectButton } from './lib/b2util.ts';

/**
 * Schiebeschalter für die Bits `bits` der Bank zeichnen (Draht, Schalter, Beschriftung). Zusätzlich lassen
 * sich die Schalter mit den PC-Tasten 0, 1, 2 … (in Reihenfolge von `bits`) umlegen, wenn das Gerät den Fokus hat.
 */
function switchColumn(svg: SVGSVGElement, bank: SwitchBank, bits: readonly number[], x: number, onInput: () => void) {
  const updates = bits.map((bit, n) => {
    wire(svg, bit, x - 4, true);
    return toggleSwitch(svg, x, rowY(bit), `S${n}`, () => bank.get(bit), (v) => { bank.set(bit, v); onInput(); });
  });
  svg.setAttribute('tabindex', '0');
  svg.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const n = /^[0-9]$/.test(e.key) ? Number(e.key) : -1;
    const bit = bits[n];
    if (bit === undefined) return;
    e.preventDefault();
    bank.toggle(bit);
    updates[n]!();
    onInput();
  });
}

const leds: DeviceDef = {
  id: 'leds', name: '8 Leuchtdioden', group: 'Schalter & LEDs', ports: 1, width: 120,
  desc: 'D0–D7 (Px.0–Px.7) steuern je eine LED: 1 = rote Anzeige, 0 = graue Anzeige.',
  create() {
    const svg = board(120, 1, 'LED');
    const lamps = Array.from({ length: 8 }, (_, i) => { wire(svg, i, 60); return led(svg, 70, rowY(i), 7, 'red'); });
    let pins = 0xff;
    const integ = new Integrator(8);
    return {
      svg,
      drive: () => 0xff,
      sample([p = 0xff], c) { pins = p; integ.tick(c); for (let i = 0; i < 8; i++) integ.add(i, ((p >> i) & 1) === 1, c); },
      render() { integ.resolve((i) => ((pins >> i) & 1) === 1).forEach((b, i) => setLit(lamps[i]!, b)); },
    };
  },
};

const switches: DeviceDef = {
  id: 'switches', name: '8 Schalter', group: 'Schalter & LEDs', ports: 1, width: 130,
  desc: '8-Bit-Schiebeschalter an D0–D7 (Px.0–Px.7). Die Schalter lassen sich mit der Maus oder – bei fokussiertem Gerät – mit den PC-Tasten 0–7 umlegen. Stellung 0 zieht den Pin auf Masse; zum Lesen die Bits vorher auf 1 setzen.',
  create(onInput) {
    const svg = board(130, 1, 'S');
    const bank = new SwitchBank(0xff);
    switchColumn(svg, bank, [0, 1, 2, 3, 4, 5, 6, 7], 28, onInput);
    return { svg, drive: () => bank.pins(), sample() {}, render() {} };
  },
};

const swled: DeviceDef = {
  id: 'swled', name: '4 Schalter + 4 LEDs', group: 'Schalter & LEDs', ports: 1, width: 130,
  desc: 'D0–D3 (Px.0–Px.3): Schalter S0–S3 (Eingänge), umlegbar mit der Maus oder den PC-Tasten 0–3 bei fokussiertem Gerät. D4–D7 (Px.4–Px.7): LEDs (Ausgänge, 1 = rote Anzeige, 0 = graue Anzeige).',
  create(onInput) {
    const svg = board(130, 1);
    const bank = new SwitchBank(0x0f);
    switchColumn(svg, bank, [0, 1, 2, 3], 28, onInput);
    const lamps = [4, 5, 6, 7].map((i) => { wire(svg, i, 60); return led(svg, 70, rowY(i), 7, 'red'); });
    let pins = 0xff;
    const integ = new Integrator(4);
    return {
      svg,
      drive: () => bank.pins(),
      sample([p = 0xff], c) { pins = p; integ.tick(c); for (let i = 0; i < 4; i++) integ.add(i, ((p >> (4 + i)) & 1) === 1, c); },
      render() { integ.resolve((i) => ((pins >> (4 + i)) & 1) === 1).forEach((b, i) => setLit(lamps[i]!, b)); },
    };
  },
};

const sevenSeg: DeviceDef = {
  id: '7seg', name: '7-Segment-Anzeige', group: 'Anzeigen', ports: 1, width: 130,
  desc: '7-Segment-Anzeige mit Direktansteuerung: D0 = a, D1 = b, D2 = c, D3 = d, D4 = e, D5 = f, D6 = g, D7 = DP. Der aktive Pegel ist mit dem Schalter unter der Anzeige wählbar (Voreinstellung „0 - aktiv": ein Segment leuchtet bei 0).',
  create() {
    const svg = board(130, 1, '7-Seg');
    for (let i = 0; i < 8; i++) wire(svg, i, 54);
    const segs = digit(svg, 64, 20, 1);
    for (const [i, n] of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'dp'].entries()) {
      const t = el('text', { x: 4, y: rowY(i) - 3, class: 'dev-tiny' }, svg); t.textContent = n;
    }
    const model = new SevenSegment();
    const btn = selectButton(svg, 64, 118, 62, 20, '', () => { model.toggleLevel(); upd(); });
    const upd = () => { btn.setText(`${model.activeLevel} - aktiv`); btn.setActive(model.activeLevel === 1); };
    upd();
    let pins = 0xff;
    const integ = new Integrator(8);
    const litAt = (i: number) => ((model.lit(pins) >> i) & 1) === 1;
    return {
      svg,
      drive: () => 0xff,
      sample([p = 0xff], c) { pins = p; integ.tick(c); for (let i = 0; i < 8; i++) integ.add(i, litAt(i), c); },
      render() { integ.resolve(litAt).forEach((b, i) => setLit(segs[i]!, b)); },
    };
  },
};

const bcd7seg: DeviceDef = {
  id: 'bcd7seg', name: '7-Segment + Decoder + 3 Schalter', group: 'Anzeigen', ports: 1, width: 170,
  desc: '1-stellige 7-Segment-Anzeige mit BCD-Decoder: D0–D3 (Px.0–Px.3) = Wert, wird als 7-Segment-Muster angezeigt (Werte über 9 als A–F). D5–D7 (Px.5–Px.7): Schiebeschalter S0–S2 (Eingänge, frei verwendbar; PC-Tasten 0–2 bei fokussiertem Gerät). D4 ist unbelegt.',
  create(onInput) {
    const svg = board(170, 1);
    for (let i = 0; i < 4; i++) wire(svg, i, 40);
    bcdDecoderBox(svg, 40, 5);
    el('line', { x1: 74, y1: 40, x2: 92, y2: 40, class: 'dev-wire' }, svg);
    const segs = digit(svg, 98, 8, 0.85);
    const bank = new SwitchBank(0xe0);
    switchColumn(svg, bank, [5, 6, 7], 42, onInput);
    let pins = 0xff;
    return {
      svg,
      drive: () => bank.pins(),
      sample([p = 0xff]) { pins = p; },
      render() {
        const pattern = decodeSegments(pins & 0x0f);
        segs.forEach((s, i) => setLit(s, (pattern >> i) & 1));
      },
    };
  },
};

const twoDigit: DeviceDef = {
  id: '2x7bcd', name: '2 × 7-Segment + Decoder', group: 'Anzeigen', ports: 1, width: 180,
  desc: '2-stellige 7-Segment-Anzeige mit BCD-Decodern: D0–D3 (Px.0–Px.3) = rechte Ziffer (Einer), D4–D7 (Px.4–Px.7) = linke Ziffer (Zehner). Werte über 9 werden als A–F angezeigt.',
  create() {
    const svg = board(180, 1);
    for (let i = 0; i < 8; i++) wire(svg, i, 36);
    bcdDecoderBox(svg, 36, 85); bcdDecoderBox(svg, 36, 5);
    const hi = digit(svg, 80, 42, 0.95);
    const lo = digit(svg, 128, 42, 0.95);
    let pins = 0xff;
    return {
      svg,
      drive: () => 0xff,
      sample([p = 0xff]) { pins = p; },
      render() {
        const show = (segs: SVGElement[], v: number) => {
          const pattern = decodeSegments(v);
          segs.forEach((s, i) => setLit(s, (pattern >> i) & 1));
        };
        show(lo, pins & 0x0f); show(hi, pins >> 4);
      },
    };
  },
};

// ── LCD HD44780 ──
const lcd: DeviceDef = {
  id: 'lcd', name: 'LCD 2×16 (HD44780)', group: 'Anzeigen', ports: 1, width: 300,
  desc: 'LCD 2 Zeilen × 16 Zeichen mit HD44780/KS0066, fest im 4-Bit-Interface (2 Zeilen, 5×7-Font). D0–D3 (Px.0–Px.3) = D4–D7 des Controllers, Px.4 = R/W, Px.6 = E, Px.7 = RS (Px.5 unbenutzt). Übernahme mit fallender Flanke an E. Eigene Zeichen (CGRAM) werden nicht unterstützt.',
  create() {
    const svg = board(300, 1);
    const names: Record<number, string> = { 0: 'D4', 1: 'D5', 2: 'D6', 3: 'D7', 4: 'R/W', 6: 'E', 7: 'RS' };
    for (const [i, n] of Object.entries(names)) {
      wire(svg, Number(i), 30);
      const t = el('text', { x: 4, y: rowY(Number(i)) - 3, class: 'dev-tiny' }, svg); t.textContent = n;
    }
    el('rect', { x: 32, y: 34, width: 262, height: 74, rx: 6, class: 'lcd-frame' }, svg);
    el('rect', { x: 40, y: 42, width: 246, height: 58, rx: 3, class: 'lcd-glass' }, svg);
    const cells: SVGTextElement[] = [];
    const cursors: SVGRectElement[] = [];
    for (let r = 0; r < 2; r++) for (let c = 0; c < 16; c++) {
      el('rect', { x: 44 + c * 15, y: 47 + r * 26, width: 13, height: 22, class: 'lcd-cell' }, svg);
      cells.push(el('text', { x: 50.5 + c * 15, y: 64 + r * 26, class: 'lcd-char', 'text-anchor': 'middle' }, svg));
      cursors.push(el('rect', { x: 44 + c * 15, y: 66 + r * 26, width: 13, height: 2, class: 'lcd-cursor' }, svg));
    }
    const ctrl = new Hd44780();
    return {
      svg,
      drive: (_i, latch) => ctrl.drive(latch),
      write(_i, v) { ctrl.write(v); },
      sample() {},
      render() {
        const blink = ctrl.blinkOn && Math.floor(performance.now() / 500) % 2 === 0;
        if (!ctrl.dirty && !ctrl.cursorOn && !ctrl.blinkOn) return;
        ctrl.dirty = false;
        for (let r = 0; r < 2; r++) for (let c = 0; c < 16; c++) {
          const cell = cells[r * 16 + c]!;
          cell.textContent = ctrl.displayOn ? Hd44780.glyph(ctrl.charAt(r, c)) : '';
          const isCur = ctrl.displayOn && ctrl.addrAt(r, c) === ctrl.ac;
          cell.classList.toggle('blink', isCur && blink);
          cursors[r * 16 + c]!.classList.toggle('on', isCur && ctrl.cursorOn);
        }
      },
    };
  },
};

export const BASIC_DEVICES: readonly DeviceDef[] = [leds, switches, swled, sevenSeg, bcd7seg, twoDigit, lcd];

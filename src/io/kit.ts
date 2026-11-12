/**
 * Bausatz für Geräte der Bauteilebibliothek: Schnittstellen, SVG-Helfer, Bedienelemente.
 *
 * Geometrie: Jede Pin-Zeile ist 20 Einheiten hoch. Ein 1-Port-Gerät hat die Höhe 160
 * (Pins .0–.7), ein 2-Port-Gerät 340 (Port A: Zeilen 0–7, Lücke, Port B: Zeilen 9–16).
 * So fluchten die Anschlussdrähte mit den Pin-Anzeigen des Port-Blocks.
 */

const NS = 'http://www.w3.org/2000/svg';
export const ROW = 20;

type Attrs = Record<string, string | number>;
export function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Attrs = {}, parent?: Element): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  parent?.append(e);
  return e;
}
export const rowY = (i: number) => i * ROW + ROW / 2;

export interface Device {
  readonly svg: SVGSVGElement;
  /** Externer Pegel für den i-ten angeschlossenen Port (0xFF = zieht nicht) */
  drive(i: number, latch: number): number;
  /** Nach jedem Befehl: aktuelle Pinpegel und verstrichene Zyklen */
  sample(pins: readonly number[], cycles: number): void;
  /** Schreibzugriff auf ein Port-Latch (für flankengesteuerte Geräte) */
  write?(i: number, latch: number): void;
  render(): void;
  /** Nur bei `usesP3`: Pegel, den das Gerät an P3 anlegt (z. B. INT0/INT1 auf Low ziehen) */
  driveP3?(): number;
  setRunning?(running: boolean): void;
  destroy?(): void;
}

export interface DeviceDef {
  readonly id: string;
  readonly name: string;
  readonly group: string;
  readonly ports: 1 | 2;
  readonly desc: string;
  readonly width: number;
  /**
   * Gerät nutzt zusätzlich Port 3 (wie im Original z. B. Freigabe über P3.6/P3.7 oder
   * Auslösen von INT0/INT1): `sample` erhält dann als letztes Element die Pins von P3,
   * und `driveP3` wird beim Lesen von P3 berücksichtigt.
   */
  readonly usesP3?: boolean;
  create(onInput: () => void): Device;
}

// ───────────────────────── Hilfen ─────────────────────────
export function board(width: number, ports: 1 | 2, label?: string): SVGSVGElement {
  const h = ports === 1 ? 8 * ROW : 17 * ROW;
  const svg = el('svg', { viewBox: `0 0 ${width} ${h}`, class: 'device-svg' });
  svg.style.aspectRatio = `${width} / ${h}`;
  el('rect', { x: 0.5, y: 0.5, width: width - 1, height: h - 1, rx: 6, class: 'dev-board' }, svg);
  if (label) {
    const t = el('text', { x: width - 6, y: h - 6, class: 'dev-label', 'text-anchor': 'end' }, svg);
    t.textContent = label;
  }
  return svg;
}

export function wire(svg: SVGSVGElement, row: number, x2: number, input = false) {
  const y = rowY(row);
  el('line', { x1: 0, y1: y, x2, y2: y, class: 'dev-wire' }, svg);
  if (input) el('path', { d: `M5 ${y - 3.5} L0 ${y} L5 ${y + 3.5}`, class: 'dev-arrow' }, svg);
  else el('path', { d: `M${x2 - 6} ${y - 3.5} L${x2 - 1} ${y} L${x2 - 6} ${y + 3.5}`, class: 'dev-arrow' }, svg);
}

/** Zeitintegrierte Helligkeit (für Multiplex-Anzeigen und PWM) */
export class Integrator {
  readonly on: Float64Array;
  readonly level: Float64Array;
  total = 0;
  constructor(n: number) {
    this.on = new Float64Array(n);
    this.level = new Float64Array(n);
  }
  add(i: number, lit: boolean, cycles: number) {
    if (lit) this.on[i]! += cycles;
  }
  tick(cycles: number) { this.total += cycles; }
  /** Helligkeit 0..1 je Element; bei wenig Laufzeit zählt der aktuelle Zustand */
  resolve(current: (i: number) => boolean): Float64Array {
    const integrate = this.total >= 2000;
    for (let i = 0; i < this.level.length; i++) {
      this.level[i] = integrate ? Math.min(1, (this.on[i]! / this.total) ** 0.45) : current(i) ? 1 : 0;
    }
    this.on.fill(0);
    this.total = 0;
    return this.level;
  }
}

export const setLit = (e: SVGElement, b: number) => {
  e.style.setProperty('--lit', b.toFixed(3));
  e.classList.toggle('on', b > 0.02);
};

export function led(svg: SVGSVGElement, cx: number, cy: number, r: number, color: string): SVGCircleElement {
  return el('circle', { cx, cy, r, class: `dev-led ${color}` }, svg);
}

/** Kippschalter: Klick wechselt den Pegel (1 = offen/High, 0 = gegen Masse) */
export function toggleSwitch(svg: SVGSVGElement, x: number, y: number, label: string, get: () => boolean, set: (v: boolean) => void) {
  const g = el('g', { class: 'dev-switch', transform: `translate(${x} ${y})`, tabindex: 0, role: 'switch' }, svg);
  el('rect', { x: 0, y: -7, width: 30, height: 14, rx: 7, class: 'sw-track' }, g);
  const knob = el('circle', { cx: 7, cy: 0, r: 5.5, class: 'sw-knob' }, g);
  const t = el('text', { x: 38, y: 4, class: 'dev-text' }, g);
  const update = () => {
    const v = get();
    knob.setAttribute('cx', v ? '23' : '7');
    g.classList.toggle('high', v);
    g.setAttribute('aria-checked', String(v));
    t.textContent = `${label} = ${v ? 1 : 0}`;
  };
  const flip = () => { set(!get()); update(); };
  g.addEventListener('click', flip);
  g.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); } });
  update();
  return update;
}

/** Taster (nur solange gedrückt aktiv) */
export function pushButton(svg: SVGSVGElement, x: number, y: number, w: number, h: number, label: string, onChange: (down: boolean) => void, cls = '') {
  const g = el('g', { class: `dev-btn ${cls}`, transform: `translate(${x} ${y})`, tabindex: 0, role: 'button' }, svg);
  el('rect', { x: 0, y: 0, width: w, height: h, rx: 4 }, g);
  const t = el('text', { x: w / 2, y: h / 2 + 4, 'text-anchor': 'middle' }, g);
  t.textContent = label;
  const set = (down: boolean) => { g.classList.toggle('down', down); onChange(down); };
  g.addEventListener('pointerdown', (e) => { try { g.setPointerCapture(e.pointerId); } catch { /* synthetische Ereignisse */ } set(true); });
  g.addEventListener('pointerup', () => set(false));
  g.addEventListener('pointercancel', () => set(false));
  g.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); set(true); } });
  g.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') set(false); });
  return g;
}

// 7-Segment-Geometrie (Ziffer ca. 40×70)
export const SEG_PATHS = [
  'M6 2 h28 l-4 6 h-20 z', // a
  'M36 4 v29 l-5 -3 v-20 z', // b
  'M36 37 v29 l-5 -5 v-21 z', // c
  'M6 68 h28 l-4 -6 h-20 z', // d
  'M4 37 v29 l5 -5 v-21 z', // e
  'M4 4 v29 l5 -3 v-20 z', // f
  'M7 35 l4 -3 h18 l4 3 l-4 3 h-18 z', // g
];
export function digit(svg: SVGSVGElement, x: number, y: number, scale = 1): SVGElement[] {
  const g = el('g', { transform: `translate(${x} ${y}) scale(${scale})`, class: 'seg-digit' }, svg);
  el('rect', { x: -4, y: -4, width: 50, height: 80, rx: 4, class: 'seg-bg' }, g);
  const segs: SVGElement[] = SEG_PATHS.map((d) => el('path', { d, class: 'seg' }, g));
  segs.push(el('circle', { cx: 42, cy: 67, r: 3, class: 'seg' }, g));
  return segs;
}
export const SEVEN_SEG = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f, 0x77, 0x7c, 0x39, 0x5e, 0x79, 0x71];


export function bcdDecoderBox(svg: SVGSVGElement, x: number, y: number) {
  el('rect', { x, y, width: 34, height: 70, class: 'dev-chip' }, svg);
  el('line', { x1: x + 34, y1: y, x2: x, y2: y + 70, class: 'dev-chip-line' }, svg);
  const t1 = el('text', { x: x + 4, y: y + 14, class: 'dev-tiny dev-chip-text' }, svg); t1.textContent = 'BCD';
  const t2 = el('text', { x: x + 30, y: y + 64, class: 'dev-tiny dev-chip-text', 'text-anchor': 'end' }, svg); t2.textContent = '7Seg';
}

export function trafficLight(svg: SVGSVGElement, x: number, y: number, n: 2 | 3, s = 1): SVGCircleElement[] {
  const g = el('g', { transform: `translate(${x} ${y}) scale(${s})` }, svg);
  el('rect', { x: 0, y: 0, width: 22, height: n * 20 + 4, rx: 5, class: 'tl-housing' }, g);
  const colors = n === 3 ? ['red', 'yellow', 'green'] : ['red', 'green'];
  const lamps = colors.map((c, i) => el('circle', { cx: 11, cy: 12 + i * 20, r: 7.5, class: `dev-led ${c}` }, g));
  return lamps;
}

export function keyHandler(svg: SVGSVGElement, map: Record<string, number>, set: (k: number | undefined) => void) {
  svg.setAttribute('tabindex', '0');
  svg.addEventListener('keydown', (e) => { const k = map[e.key.toLowerCase()]; if (k !== undefined && !e.repeat) { e.preventDefault(); set(k); } });
  svg.addEventListener('keyup', (e) => { if (map[e.key.toLowerCase()] !== undefined) set(undefined); });
}

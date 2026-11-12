/** SVG-Hilfen für die Geräte der Erweiterung 1 (nutzt den Bausatz kit.ts). */
import { Integrator, el, rowY, setLit, wire, type Device } from '../kit.ts';
import { Ticker, type PortLogic } from './b1-common.ts';

export type Pin = [row: number, label: string, input?: boolean];

/** Zeichnet Anschlussdrähte samt Kurzbezeichnung links am Gerät. */
export function pinRows(svg: SVGSVGElement, pins: readonly Pin[], x2: number) {
  for (const [row, label, input] of pins) {
    wire(svg, row, x2, input === true);
    const t = el('text', { x: input === true ? 9 : 4, y: rowY(row) - 3, class: 'dev-tiny' }, svg);
    t.textContent = label;
  }
}

/** Beschriftung in der Szene */
export function sceneText(svg: Element, x: number, y: number, text: string, cls = '', anchor = 'start') {
  const t = el('text', { x, y, class: `b1-txt ${cls}`, 'text-anchor': anchor }, svg);
  t.textContent = text;
  return t;
}

/** Roter Störungs-Hinweis, die Meldung steht im Tooltip. */
export function faultBadge(svg: SVGSVGElement, x: number, y: number): (msg: string | undefined) => void {
  const g = el('g', { class: 'b1-fault', transform: `translate(${x} ${y})` }, svg);
  g.style.display = 'none';
  const title = el('title', {}, g);
  el('rect', { x: 0, y: 0, width: 50, height: 13, rx: 3 }, g);
  sceneText(g, 25, 9.5, 'STÖRUNG', 'b1-fault-txt', 'middle');
  let last: string | undefined;
  return (msg) => {
    if (msg === last) return;
    last = msg;
    g.style.display = msg ? '' : 'none';
    title.textContent = msg ?? '';
  };
}

/** Ventilsymbol (Schmetterling); .open = grün, sonst rot */
export function valve(svg: SVGSVGElement, x: number, y: number, label: string): (open: boolean) => void {
  const g = el('g', { class: 'b1-valve', transform: `translate(${x} ${y})` }, svg);
  el('path', { d: 'M-7 -6 L7 6 L7 -6 L-7 6 Z' }, g);
  sceneText(g, 0, -9, label, 'b1-small', 'middle');
  return (open) => g.classList.toggle('open', open);
}

/** Rohrleitung; flow() schaltet die Fließanimation */
export function pipe(svg: SVGSVGElement, d: string): (flowing: boolean) => void {
  el('path', { d, class: 'b1-pipe' }, svg);
  const f = el('path', { d, class: 'b1-flow' }, svg);
  return (on) => f.classList.toggle('on', on);
}

/** Umschalter mit zwei Stellungen */
export function choice(svg: SVGSVGElement, x: number, y: number, w: number, labels: readonly [string, string], get: () => boolean, set: (v: boolean) => void) {
  const g = el('g', { class: 'b1-choice', transform: `translate(${x} ${y})`, tabindex: 0, role: 'switch' }, svg);
  const half = w / 2;
  const r0 = el('rect', { x: 0, y: 0, width: half, height: 15, rx: 3 }, g);
  const r1 = el('rect', { x: half, y: 0, width: half, height: 15, rx: 3 }, g);
  sceneText(g, half / 2, 10.5, labels[0], 'b1-choice-txt', 'middle');
  sceneText(g, half * 1.5, 10.5, labels[1], 'b1-choice-txt', 'middle');
  const update = () => {
    const v = get();
    r0.classList.toggle('sel', !v);
    r1.classList.toggle('sel', v);
    g.setAttribute('aria-checked', String(v));
  };
  const flip = () => { set(!get()); update(); };
  g.addEventListener('click', flip);
  g.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); } });
  update();
  return update;
}

/** Koppelt eine Port-Logik an das Geräte-Interface (Zeitbasis: Zyklen = µs). */
export function bindLogic(svg: SVGSVGElement, logic: PortLogic, render: () => void): Device {
  const ticker = new Ticker();
  const dev: Device = {
    svg,
    drive: (i, latch) => logic.drive(i, latch),
    sample(pins, cycles) {
      const t = ticker.advance(cycles);
      logic.setPins(pins, t);
      ticker.flush((dt) => logic.step(dt));
    },
    render,
  };
  const p3 = logic.driveP3;
  return p3 ? { ...dev, driveP3: () => p3.call(logic) } : dev;
}

/** Gruppe von Lampen mit zeitintegrierter Helligkeit (Multiplex/PWM); `isLit(i, pins)` sagt, ob Lampe i leuchtet. */
export class LampBank {
  readonly #integ: Integrator;
  #pins: readonly number[] = [];
  readonly #els: readonly SVGElement[];
  readonly #lit: (i: number, pins: readonly number[]) => boolean;
  constructor(els: readonly SVGElement[], isLit: (i: number, pins: readonly number[]) => boolean) {
    this.#els = els;
    this.#lit = isLit;
    this.#integ = new Integrator(els.length);
  }
  sample(pins: readonly number[], cycles: number) {
    this.#pins = pins;
    this.#integ.tick(cycles);
    for (let i = 0; i < this.#els.length; i++) this.#integ.add(i, this.#lit(i, pins), cycles);
  }
  render() {
    this.#integ.resolve((i) => this.#lit(i, this.#pins)).forEach((b, i) => setLit(this.#els[i]!, b));
  }
}

/** Kleiner Textbaustein (Klasse dev-tiny/dev-text) */
export function label(svg: SVGElement, x: number, y: number, text: string, cls = 'dev-tiny', anchor: 'start' | 'middle' | 'end' = 'start') {
  const t = el('text', { x, y, class: cls, 'text-anchor': anchor }, svg);
  t.textContent = text;
  return t;
}

/** Schiebeschalter wie im Original: Knopf rechts + roter Balken links = 1, Knopf links + grau = 0. */
export function slideSwitch(svg: SVGSVGElement, x: number, y: number, get: () => boolean, set: (v: boolean) => void, w = 56, h = 18) {
  const g = el('g', { class: 'dm-slide', transform: `translate(${x} ${y})`, tabindex: 0, role: 'switch' }, svg);
  const on = el('rect', { x: 0, y: 0, width: w / 2, height: h, class: 'dm-slide-on' }, g);
  el('rect', { x: w / 2, y: 0, width: w / 2, height: h, class: 'dm-slide-off' }, g);
  const knob = el('rect', { x: 1.5, y: 1.5, width: w / 2 - 3, height: h - 3, rx: 2, class: 'dm-slide-knob' }, g);
  const update = () => {
    const v = get();
    knob.setAttribute('x', String(v ? w / 2 + 1.5 : 1.5));
    on.classList.toggle('lit', v);
    g.setAttribute('aria-checked', String(v));
  };
  const flip = () => { set(!get()); update(); };
  g.addEventListener('click', flip);
  g.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); } });
  update();
  return update;
}

/** Warnton (Rechteckschwingung) über Web Audio; nur aktiv, solange `on(true)` gilt. */
export class Beeper {
  #ctx: AudioContext | undefined;
  #osc: OscillatorNode | undefined;
  #gain: GainNode | undefined;
  on(active: boolean, hz = 880) {
    if (active === (this.#osc !== undefined)) return;
    try {
      if (active) {
        this.#ctx ??= new AudioContext();
        void this.#ctx.resume();
        this.#osc = this.#ctx.createOscillator();
        this.#gain = this.#ctx.createGain();
        this.#osc.type = 'square';
        this.#osc.frequency.value = hz;
        this.#gain.gain.value = 0.04;
        this.#osc.connect(this.#gain).connect(this.#ctx.destination);
        this.#osc.start();
      } else {
        this.#osc?.stop();
        this.#osc?.disconnect();
        this.#gain?.disconnect();
        this.#osc = undefined;
        this.#gain = undefined;
      }
    } catch { /* kein Audio verfügbar */ }
  }
  destroy() { this.on(false); void this.#ctx?.close().catch(() => {}); this.#ctx = undefined; }
}

export const lit = (e: SVGElement, on: boolean) => setLit(e, on ? 1 : 0);

/** Einfaches Auto in der Draufsicht/Seitenansicht (Gruppe, Ursprung links oben, 26 × 14) */
export function carShape(svg: SVGSVGElement, cls: string): SVGGElement {
  const g = el('g', { class: `b1-car ${cls}` }, svg);
  el('rect', { x: 0, y: 4, width: 26, height: 8, rx: 2, class: 'b1-car-body' }, g);
  el('path', { d: 'M6 4 L9 0 H18 L21 4 Z', class: 'b1-car-body' }, g);
  el('circle', { cx: 6, cy: 12, r: 2.6, class: 'b1-wheel' }, g);
  el('circle', { cx: 20, cy: 12, r: 2.6, class: 'b1-wheel' }, g);
  return g;
}

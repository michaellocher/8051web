/** Gemeinsame Hilfen der Geräte aus Erweiterung 2. */
import { Integrator, el, setLit } from '../kit.ts';

/** Gruppe von Lampen/Segmenten mit zeitintegrierter Helligkeit; `lit(i, pins)` sagt, ob Element i leuchtet. */
export class LampBank {
  readonly #integ: Integrator;
  #pins: readonly number[] = [];
  readonly #els: readonly SVGElement[];
  readonly #lit: (i: number, pins: readonly number[]) => boolean;
  constructor(els: readonly SVGElement[], lit: (i: number, pins: readonly number[]) => boolean) {
    this.#els = els;
    this.#lit = lit;
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

/** Umschaltbarer Knopf (rastet ein, `active` hebt ihn hervor). */
export function selectButton(svg: SVGElement, x: number, y: number, w: number, h: number, text: string, onClick: () => void) {
  const g = el('g', { class: 'dev-btn b2-sel', transform: `translate(${x} ${y})`, tabindex: 0, role: 'button' }, svg);
  el('rect', { x: 0, y: 0, width: w, height: h, rx: 3 }, g);
  const t = el('text', { x: w / 2, y: h / 2 + 3.5, 'text-anchor': 'middle' }, g);
  t.textContent = text;
  g.addEventListener('click', onClick);
  g.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === ' ' || (e as KeyboardEvent).key === 'Enter') { e.preventDefault(); onClick(); } });
  return {
    g,
    setActive: (a: boolean) => g.classList.toggle('active', a),
    setText: (s: string) => { t.textContent = s; },
  };
}

/** Segment-Maske (a–g, dp = Bit 7) auf die 8 Segmentelemente einer Ziffer anwenden */
export function showMask(segs: readonly SVGElement[], mask: number) {
  segs.forEach((s, i) => setLit(s, (mask >> i) & 1));
}

/** Kreissektor-Ring (Winkel in Grad, 0 = oben, im Uhrzeigersinn) */
export function annulusSector(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
  const p = (r: number, a: number) => {
    const t = (a * Math.PI) / 180;
    return `${(cx + r * Math.sin(t)).toFixed(2)} ${(cy - r * Math.cos(t)).toFixed(2)}`;
  };
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${p(r1, a0)} A${r1} ${r1} 0 ${large} 1 ${p(r1, a1)} L${p(r0, a1)} A${r0} ${r0} 0 ${large} 0 ${p(r0, a0)} Z`;
}

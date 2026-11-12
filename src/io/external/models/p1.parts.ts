/** Gemeinsame Zeichenelemente für die Modelle des Modellpakets 1 (Motoren, Lüfter, Drehzahlwächter …). */
import { el } from '../../kit.ts';

export function rect(svg: Element, x: number, y: number, w: number, h: number, cls: string, rx = 0): SVGRectElement {
  return el('rect', { x, y, width: w, height: h, rx, class: cls }, svg);
}

/** Drehstrommotor (blau, mit Kühlrippen, Welle und Kupplung); Ursprung links oben, 96 × 60 */
export function blueMotor(svg: Element, x: number, y: number, flip = false, scale = 1) {
  const g = el('g', { class: 'p1-motor', transform: `translate(${x} ${y}) scale(${scale})${flip ? ' translate(96 0) scale(-1 1)' : ''}` }, svg);
  rect(g, 0, 4, 12, 44, 'p1-mot-cap', 4);
  rect(g, 12, 0, 56, 52, 'p1-mot-body', 6);
  for (let i = 0; i < 8; i++) el('line', { x1: 18 + i * 6.5, y1: 3, x2: 18 + i * 6.5, y2: 49, class: 'p1-mot-rib' }, g);
  rect(g, 68, 6, 6, 40, 'p1-mot-flange');
  rect(g, 10, 52, 56, 5, 'p1-mot-foot');
  rect(g, 74, 22, 12, 8, 'p1-shaft');
  const coupling = el('g', {}, g);
  rect(coupling, 86, 14, 10, 24, 'p1-coupling', 2);
  const mark = el('rect', { x: 88, y: 16, width: 6, height: 5, class: 'p1-mot-mark' }, coupling);
  return {
    g,
    update(angle: number, on: boolean) {
      g.classList.toggle('on', on);
      mark.setAttribute('y', String(16 + 9 + Math.sin((angle * Math.PI) / 180) * 8));
    },
  };
}

/** Lüfter/Ventilator mit Gehäuse und drehenden Flügeln */
export function fan(svg: Element, cx: number, cy: number, r: number) {
  const g = el('g', { class: 'p1-fan', transform: `translate(${cx} ${cy})` }, svg);
  el('circle', { cx: 0, cy: 0, r, class: 'p1-fan-housing' }, g);
  el('circle', { cx: 0, cy: 0, r: r * 0.82, class: 'p1-fan-inner' }, g);
  const rot = el('g', {}, g);
  for (let i = 0; i < 6; i++) {
    el('path', { d: `M0 0 Q${r * 0.25} ${-r * 0.35} ${r * 0.12} ${-r * 0.78} Q${-r * 0.2} ${-r * 0.5} 0 0`, class: 'p1-fan-blade', transform: `rotate(${i * 60})` }, rot);
  }
  el('circle', { cx: 0, cy: 0, r: r * 0.14, class: 'p1-fan-hub' }, g);
  return {
    g,
    update(angle: number, on: boolean, failed = false) {
      rot.setAttribute('transform', `rotate(${angle})`);
      g.classList.toggle('on', on);
      g.classList.toggle('failed', failed);
    },
  };
}

/** Drehzahlwächter („n“-Kasten mit Lampe), Ursprung links oben, 34 × 34 */
export function nBox(svg: Element, x: number, y: number) {
  const g = el('g', { class: 'p1-nbox', transform: `translate(${x} ${y})` }, svg);
  rect(g, 4, -8, 22, 7, 'p1-nbox-top', 1);
  rect(g, 0, 0, 34, 34, 'p1-nbox-body', 3);
  el('text', { x: 17, y: 24, class: 'm-label', 'text-anchor': 'middle' }, g).textContent = 'n';
  return { g, set(on: boolean) { g.classList.toggle('on', on); } };
}

/** Störungs-Taster (Blitzsymbol): schaltet im Modell einen Fehler ein/aus */
export function faultButton(svg: Element, x: number, y: number, title: string, onToggle: () => void) {
  const g = el('g', { class: 'p1-fault', transform: `translate(${x} ${y})`, tabindex: 0, role: 'button', 'aria-label': title }, svg);
  el('title', {}, g).textContent = title;
  rect(g, 0, 0, 32, 28, 'p1-fault-face', 3);
  el('path', { d: 'M19 3 L8 16 H15 L12 25 L24 11 H17 Z', class: 'p1-bolt' }, g);
  g.addEventListener('click', onToggle);
  g.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onToggle(); } });
  return { g, set(on: boolean) { g.classList.toggle('on', on); } };
}

/** Absperrventil (zwei Dreiecke) mit Rohrstücken links/rechts */
export function bowtie(svg: Element, x: number, y: number, pipeLen = 34) {
  const g = el('g', { class: 'p1-bow', transform: `translate(${x} ${y})` }, svg);
  const pl = rect(g, -pipeLen - 22, -5, pipeLen, 10, 'p1-bow-pipe');
  const pr = rect(g, 22, -5, pipeLen, 10, 'p1-bow-pipe');
  el('path', { d: 'M-22 -14 L0 0 L-22 14 Z', class: 'p1-bow-tri' }, g);
  el('path', { d: 'M22 -14 L0 0 L22 14 Z', class: 'p1-bow-tri' }, g);
  void pl; void pr;
  return { g, set(open: boolean) { g.classList.toggle('open', open); } };
}

/** Pfeil „Zeile“ mit Text für Statusanzeigen im Modellfenster */
export function frame(svg: Element, x: number, y: number, w: number, h: number, title = '') {
  rect(svg, x, y, w, h, 'm-panel', 10);
  if (title) el('text', { x: x + w / 2, y: y + 20, class: 'm-label', 'text-anchor': 'middle' }, svg).textContent = title;
}

/** Text in beliebigem SVG-Container */
export function txt(parent: Element, x: number, y: number, text: string, cls = 'm-label', anchor: 'start' | 'middle' | 'end' = 'start') {
  const t = el('text', { x, y, class: cls, 'text-anchor': anchor }, parent);
  t.textContent = text;
  return t;
}

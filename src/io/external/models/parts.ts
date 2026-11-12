/** Wiederverwendbare Zeichenelemente für Modellfenster (Taster, Sensorlampen, Ventile …). */
import { el } from '../../kit.ts';

/** Leuchttaster im Bedienfeld; meldet gedrückt/losgelassen */
export function panelButton(svg: SVGSVGElement, x: number, y: number, tag: string, label: string, cls: string,
  onChange: (down: boolean) => void, io = '', w = 40): SVGGElement {
  const g = el('g', { class: `m-button ${cls}`, transform: `translate(${x} ${y})`, tabindex: 0, role: 'button', 'aria-label': `${tag} ${label}`.trim() }, svg);
  el('rect', { x: 0, y: 0, width: w, height: 40, rx: 6, class: 'm-btn-face' }, g);
  if (w === 40) {
    el('text', { x: 52, y: 17, class: 'm-label' }, g).textContent = label;
    el('text', { x: 52, y: 33, class: 'm-io' }, g).textContent = [tag, io].filter(Boolean).join(' · ');
  } else {
    el('text', { x: w / 2, y: 25, class: 'm-label light', 'text-anchor': 'middle' }, g).textContent = label;
  }
  const set = (d: boolean) => { g.classList.toggle('down', d); onChange(d); };
  g.addEventListener('pointerdown', (e) => { try { g.setPointerCapture(e.pointerId); } catch { /* synthetische Ereignisse */ } set(true); });
  g.addEventListener('pointerup', () => set(false));
  g.addEventListener('pointercancel', () => set(false));
  g.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); set(true); } });
  g.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') set(false); });
  return g;
}

/** Rastender Schalter im Bedienfeld */
export function panelSwitch(svg: SVGSVGElement, x: number, y: number, tag: string, label: string,
  onChange: (on: boolean) => void, io = ''): SVGGElement {
  const g = el('g', { class: 'm-switch', transform: `translate(${x} ${y})`, tabindex: 0, role: 'switch', 'aria-label': `${tag} ${label}`.trim() }, svg);
  el('rect', { x: 0, y: 6, width: 44, height: 24, rx: 12, class: 'm-sw-track' }, g);
  const knob = el('circle', { cx: 12, cy: 18, r: 9, class: 'm-sw-knob' }, g);
  el('text', { x: 54, y: 17, class: 'm-label' }, g).textContent = label;
  el('text', { x: 54, y: 33, class: 'm-io' }, g).textContent = [tag, io].filter(Boolean).join(' · ');
  let on = false;
  const flip = () => { on = !on; knob.setAttribute('cx', on ? '32' : '12'); g.classList.toggle('on', on); g.setAttribute('aria-checked', String(on)); onChange(on); };
  g.addEventListener('click', flip);
  g.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); } });
  return g;
}

/** Sensor-/Meldelampe mit Beschriftung */
export function lamp(svg: SVGSVGElement, x: number, y: number, tag: string, io = '', color: 'green' | 'red' | 'yellow' = 'green'): SVGCircleElement {
  const c = el('circle', { cx: x, cy: y, r: 7, class: `m-lamp ${color}` }, svg);
  el('text', { x, y: y - 12, class: 'm-label small', 'text-anchor': 'middle' }, svg).textContent = tag;
  if (io) el('text', { x, y: y + 20, class: 'm-io', 'text-anchor': 'middle' }, svg).textContent = io;
  return c;
}

/** Magnetventil-Symbol (leuchtet, wenn bestromt) */
export function valveSymbol(svg: SVGSVGElement, x: number, y: number, tag: string, io = ''): SVGGElement {
  const g = el('g', { class: 'm-valve', transform: `translate(${x} ${y})` }, svg);
  el('rect', { x: 0, y: 0, width: 22, height: 22, class: 'm-valve-coil' }, g);
  el('path', { d: 'M4 18 L18 4', class: 'm-valve-line' }, g);
  el('text', { x: 28, y: 10, class: 'm-label small' }, g).textContent = tag;
  if (io) el('text', { x: 28, y: 22, class: 'm-io' }, g).textContent = io;
  return g;
}

/** Motor-Symbol (Kreis mit M), dreht sich über `setAngle` */
export function motorSymbol(svg: SVGSVGElement, x: number, y: number, tag: string, io = '', r = 20) {
  const g = el('g', { class: 'm-motor-sym', transform: `translate(${x} ${y})` }, svg);
  el('circle', { cx: 0, cy: 0, r, class: 'm-motor-body' }, g);
  const rot = el('g', {}, g);
  el('path', { d: `M0 ${-r + 4} L4 ${-r + 12} L-4 ${-r + 12} Z`, class: 'm-motor-mark' }, rot);
  el('text', { x: 0, y: 5, class: 'm-label light', 'text-anchor': 'middle' }, g).textContent = 'M';
  el('text', { x: r + 6, y: -4, class: 'm-label small' }, g).textContent = tag;
  if (io) el('text', { x: r + 6, y: 10, class: 'm-io' }, g).textContent = io;
  return {
    g,
    update(on: boolean, angle: number) { g.classList.toggle('on', on); rot.setAttribute('transform', `rotate(${angle})`); },
  };
}

/** Beschriftung */
export function label(svg: SVGSVGElement, x: number, y: number, text: string, cls = 'm-label', anchor: 'start' | 'middle' | 'end' = 'start') {
  const t = el('text', { x, y, class: cls, 'text-anchor': anchor }, svg);
  t.textContent = text;
  return t;
}

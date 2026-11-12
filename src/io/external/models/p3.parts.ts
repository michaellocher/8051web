/** Zeichenhilfen für Modellpaket 2, Teil 2 (nur DOM/SVG; Klassen siehe src/styles/pack3.css). */
import { el } from '../../kit.ts';
import { rc, tx } from './p2.parts.ts';

/** Förderband mit zwei Umlenkrollen und laufendem Streifenmuster; Ursprung links oben */
export function belt(p: Element, x: number, y: number, w: number, h = 26) {
  const g = el('g', { transform: `translate(${x} ${y})` }, p);
  rc(g, 0, 0, w, h, 'p3-belt', h / 2);
  const stripe = el('line', { x1: h, y1: h / 2, x2: w - h, y2: h / 2, class: 'p3-belt-stripe' }, g);
  const rollers = [h / 2, w - h / 2].map((cx) => {
    const r = el('g', { transform: `translate(${cx} ${h / 2})` }, g);
    el('circle', { cx: 0, cy: 0, r: h / 2 + 2, class: 'p3-roller' }, r);
    const spin = el('g', {}, r);
    el('line', { x1: -h / 2 + 3, y1: 0, x2: h / 2 - 3, y2: 0, class: 'p3-roller-x' }, spin);
    el('line', { x1: 0, y1: -h / 2 + 3, x2: 0, y2: h / 2 - 3, class: 'p3-roller-x' }, spin);
    return spin;
  });
  return {
    g,
    /** phase: Weg in px; dir: +1 vorwärts (nach rechts) */
    update(phase: number) {
      stripe.setAttribute('stroke-dashoffset', String(-phase % 27));
      for (const r of rollers) r.setAttribute('transform', `rotate(${(phase * 3) % 360})`);
    },
  };
}

/** Gehende Person (Strichfigur), Ursprung = Fußpunkt */
export function person(p: Element, scale = 1) {
  const g = el('g', { transform: `scale(${scale})` }, p);
  el('circle', { cx: 0, cy: -34, r: 6, class: 'p3-person-head' }, g);
  el('path', { d: 'M0 -27 V-10 M0 -22 L-8 -12 M0 -22 L8 -14 M0 -10 L-7 0 M0 -10 L7 0', fill: 'none', stroke: '#2b3440', 'stroke-width': 4, 'stroke-linecap': 'round' }, g);
  return g;
}

/** Warndreieck mit Ausrufezeichen; Mitte = (x, y) */
export function warnTriangle(p: Element, x: number, y: number, s = 1) {
  const g = el('g', { transform: `translate(${x} ${y}) scale(${s})` }, p);
  el('path', { d: 'M0 -16 L17 14 H-17 Z', class: 'p3-warn' }, g);
  rc(g, -1.8, -6, 3.6, 12, 'p3-warn-mark');
  el('circle', { cx: 0, cy: 10, r: 2, class: 'p3-warn-mark' }, g);
  return g;
}

/** Meldungsfeld mit bis zu `rows` Textzeilen */
export function msgBox(p: Element, x: number, y: number, w: number, h: number, title = '') {
  rc(p, x, y, w, h, 'p3-msgbox', 3);
  if (title) tx(p, x + 8, y - 8, title, 'm-label');
  const rows = Math.floor((h - 8) / 15);
  const lines = Array.from({ length: rows }, (_, i) => tx(p, x + 8, y + 17 + i * 15, '', 'p3-msg'));
  return {
    set(list: readonly string[]) {
      const tail = list.slice(-rows);
      lines.forEach((l, i) => { l.textContent = tail[i] ?? ''; });
    },
  };
}

/** Segment-Taster (Umschalter ohne Ex-Anschluss), z. B. Drehrichtungswahl */
export function segButton(p: Element, x: number, y: number, w: number, h: number, label: string, onClick: () => void) {
  const g = el('g', { class: 'p3-seg-btn', transform: `translate(${x} ${y})`, tabindex: 0, role: 'button', 'aria-label': label }, p);
  rc(g, 0, 0, w, h, '', 5);
  tx(g, w / 2, h / 2 + 4, label, 'm-label small', 'middle');
  g.addEventListener('click', onClick);
  g.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onClick(); } });
  return { g, set(sel: boolean) { g.classList.toggle('sel', sel); } };
}

/** Kleine Sensorlampe als Kästchen (grün = betätigt) mit Beschriftung rechts */
export function sensorBox(p: Element, x: number, y: number, tag: string, io: string, side: 'right' | 'left' = 'right') {
  const r = rc(p, x - 8, y - 6, 16, 12, 'p3-sensor', 2);
  const tl = side === 'right' ? x + 14 : x - 14, an = side === 'right' ? 'start' : 'end';
  tx(p, tl, y - 1, tag, 'm-label small', an);
  tx(p, tl, y + 11, io, 'm-io', an);
  return r;
}

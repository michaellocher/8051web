/** Zeichenhilfen für Modellpaket 2 (nur DOM/SVG). */
import { el } from '../../kit.ts';

export const rc = (p: Element, x: number, y: number, w: number, h: number, cls: string, rx = 0) =>
  el('rect', { x, y, width: w, height: h, rx, class: cls }, p);

export const tx = (p: Element, x: number, y: number, text: string, cls = 'm-label', anchor: 'start' | 'middle' | 'end' = 'start') => {
  const t = el('text', { x, y, class: cls, 'text-anchor': anchor }, p);
  t.textContent = text;
  return t;
};

export const ln = (p: Element, x1: number, y1: number, x2: number, y2: number, cls: string) => el('line', { x1, y1, x2, y2, class: cls }, p);

/** Schmetterlings-Ventil (zwei Dreiecke), grün = offen */
export function bow(p: Element, x: number, y: number, tag: string, io: string, vertical = false) {
  const g = el('g', { class: 'p2-bow', transform: `translate(${x} ${y})${vertical ? ' rotate(90)' : ''}` }, p);
  el('path', { d: 'M-14 -10 L0 0 L-14 10 Z M14 -10 L0 0 L14 10 Z', class: 'p2-bow-body' }, g);
  const lab = el('g', { transform: vertical ? 'translate(0 0)' : '' }, p);
  const lx = vertical ? x + 20 : x, ly = vertical ? y - 4 : y + 24;
  tx(lab, lx, ly, tag, 'm-label small', vertical ? 'start' : 'middle');
  tx(lab, lx, ly + 11, io, 'm-io', vertical ? 'start' : 'middle');
  return g;
}

/** Ein 7-Segment-Ziffernanzeige (0–9), Segmente a–g */
const SEGS = ['abcdef', 'bc', 'abdeg', 'abcdg', 'bcfg', 'acdfg', 'acdefg', 'abc', 'abcdefg', 'abcdfg'];
export function digit(p: Element, x: number, y: number, w = 30, h = 52) {
  const g = el('g', { transform: `translate(${x} ${y})` }, p);
  rc(g, -6, -6, w + 12, h + 12, 'p2-digit-bg', 4);
  const t = 5, hh = h / 2;
  const geo: Record<string, [number, number, number, number]> = {
    a: [t, 0, w - 2 * t, t], d: [t, h - t, w - 2 * t, t], g: [t, hh - t / 2, w - 2 * t, t],
    f: [0, t, t, hh - t - 2], b: [w - t, t, t, hh - t - 2], e: [0, hh + 2, t, hh - t - 2], c: [w - t, hh + 2, t, hh - t - 2],
  };
  const segs = Object.fromEntries(Object.entries(geo).map(([k, v]) => [k, rc(g, v[0], v[1], v[2], v[3], 'p2-seg', 1.5)]));
  return (n: number) => { for (const [k, s] of Object.entries(segs)) s.classList.toggle('on', SEGS[n]?.includes(k) ?? false); };
}

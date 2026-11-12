import { el } from '../../kit.ts';
import type { ModelView } from '../frame.ts';
import { BARRIER_DX, BARRIER_X0, BELT_END, KIND_LEN, type Bin, type Kind, type SortCfg, type SortPlant } from './sortbase.logic.ts';
import { panelButton } from './parts.ts';
import { rect, txt } from './p1.parts.ts';

const BELT_Y = 170, BELT_H = 70;
const POOL = 16;

/** Gemeinsame Zeichnung der Sortieranlagen */
export function sortView(cfg: SortCfg): ModelView {
  let boxes: SVGRectElement[];
  let beams: SVGLineElement[];
  let rods: SVGRectElement[];
  let blades: SVGRectElement[];
  let binTexts: Partial<Record<Bin, SVGTextElement>>;
  let stats: SVGTextElement;
  const binX = (b: Bin) => (b === 'end' ? 678 : cfg.pushers.find((p) => p.bin === b)!.x);
  const binColor: Record<Bin, Kind> = { z1: 'small', z2: 'medium', end: cfg.endWants };
  return {
    mount(svg, logic) {
      const L = logic as SortPlant;
      rect(svg, 0, 0, 720, 460, 'm-bg');
      // Band, Seitenbänder
      rect(svg, 0, BELT_Y, BELT_END, BELT_H, 'm-belt');
      for (const p of cfg.pushers) rect(svg, p.x - 26, BELT_Y + BELT_H, 52, 160, 'p1-sidebelt');
      // Lichtschranken
      beams = [];
      for (let i = 0; i < cfg.barriers; i++) {
        const x = BARRIER_X0 + i * BARRIER_DX;
        rect(svg, x - 8, BELT_Y - 26, 16, 10, 'p1-sens-s', 1);
        rect(svg, x - 8, BELT_Y + BELT_H + 14, 16, 10, 'p1-sens-r', 1);
        beams.push(el('line', { x1: x, y1: BELT_Y - 16, x2: x, y2: BELT_Y + BELT_H + 14, class: 'p1-beam' }, svg));
        txt(svg, x, BELT_Y - 32, `S${i + 1}`, 'm-label small', 'middle');
        txt(svg, x, BELT_Y + BELT_H + 38 + (i % 2) * 12, `Ex.${i}`, 'm-io', 'middle');
      }
      // Zylinder
      rods = []; blades = [];
      cfg.pushers.forEach((p, i) => {
        rect(svg, p.x - 9, 64, 18, 66, 'm-cyl', 3);
        rods.push(rect(svg, p.x - 3, 130, 6, 30, 'm-rod'));
        blades.push(rect(svg, p.x - 12, 158, 24, 6, 'm-jaw'));
        txt(svg, p.x, 50, `Z${i + 1}`, 'm-label', 'middle');
        txt(svg, p.x, 28, `Ax.${i}`, 'm-io', 'middle');
      });
      // Behälter
      binTexts = {};
      const bins: Bin[] = [...cfg.pushers.map((p) => p.bin), 'end'];
      for (const b of bins) {
        const x = binX(b), y = b === 'end' ? 300 : 392;
        el('path', { d: `M${x - 32} ${y} V${y + 56} H${x + 32} V${y}`, class: 'p1-bin' }, svg);
        rect(svg, x - 8, y + 36, 16, 12, `p1-box-${binColor[b]}`);
        binTexts[b] = txt(svg, x, y + 74, '', 'm-label small', 'middle');
      }
      stats = txt(svg, 20, 120, '', 'm-label small');
      boxes = Array.from({ length: POOL }, () => rect(svg, 0, 0, 20, 30, 'p1-box-small', 2));
      // Bedienung: Teile auflegen
      txt(svg, 20, 300, 'Teil auflegen', 'm-label small');
      cfg.kinds.forEach((k, i) => {
        panelButton(svg, 20, 312 + i * 46, '', ({ small: 'klein', medium: 'mittel', large: 'groß' } as const)[k], 'm-btn-grey', (d) => L.input(`feed-${k}`, d), '', 110);
      });
    },
    render(logic) {
      const L = logic as SortPlant;
      const ex = L.ex;
      beams.forEach((b, i) => b.classList.toggle('cut', ((ex >> i) & 1) === 1));
      L.cyl.forEach((c, i) => {
        rods[i]!.setAttribute('height', String(30 + c.pos * 46));
        blades[i]!.setAttribute('y', String(158 + c.pos * 46));
      });
      boxes.forEach((r, i) => {
        const b = L.boxes[i];
        r.style.display = b ? '' : 'none';
        if (!b) return;
        const len = KIND_LEN[b.kind];
        r.setAttribute('class', `p1-box-${b.kind}`);
        if (b.state === 'belt') {
          r.setAttribute('x', String(b.x)); r.setAttribute('y', String(BELT_Y + 20)); r.setAttribute('width', String(len)); r.setAttribute('height', '30');
        } else {
          const w = Math.min(len, 40);
          r.setAttribute('x', String(b.x + len / 2 - w / 2)); r.setAttribute('width', String(w));
          r.setAttribute('y', String(BELT_Y + 20 + b.prog * 190)); r.setAttribute('height', '30');
        }
      });
      for (const b of ['z1', 'z2', 'end'] as const) {
        const t = binTexts[b];
        if (t) { const c = L.bins[b]; t.textContent = `${c.small + c.medium + c.large} Teile`; }
      }
      stats.textContent = `richtig: ${L.count('z1') + L.count('z2') + L.count('end') - L.wrong} · falsch: ${L.wrong}`;
    },
  };
}

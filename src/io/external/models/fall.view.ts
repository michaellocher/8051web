import { el } from '../../kit.ts';
import type { ExternalModelDef, ModelView } from '../frame.ts';
import { CAPACITY, FallLogic, fallY } from './fall.logic.ts';
import { lamp, panelButton, valveSymbol } from './parts.ts';
import { digit, rc, tx } from './p2.parts.ts';

const X0 = 420, W = 70, D = 130, H = 28, TOP = 292;

const view = (): ModelView => {
  let r: {
    rod: SVGRectElement; head: SVGRectElement; stack: SVGRectElement[]; table: SVGRectElement; flying: SVGRectElement[]; bin: SVGRectElement[];
    lamp: SVGCircleElement; valve: SVGGElement; digit: (n: number) => void; count: SVGTextElement; beam: SVGLineElement;
  };
  return {
    mount(svg, logic) {
      const L = logic as FallLogic;
      rc(svg, 0, 0, 720, 460, 'm-bg');
      // Bedienfeld
      rc(svg, 20, 20, 380, 150, 'm-panel', 12);
      const setPreset = digit(svg, 52, 46, 30, 52);
      panelButton(svg, 102, 34, '', '▲', 'm-btn-grey', (d) => L.input('up', d), '', 44);
      panelButton(svg, 102, 80, '', '▼', 'm-btn-grey', (d) => L.input('down', d), '', 44);
      tx(svg, 36, 126, 'S0 Vorwahl · Ex.0–3', 'm-io');
      panelButton(svg, 170, 34, 'S1', 'START', 'm-btn-green', (d) => L.input('start', d), 'Ex.4');
      panelButton(svg, 170, 84, 'S2', 'RESET', 'm-btn-blue', (d) => L.input('reset', d), 'Ex.5');
      panelButton(svg, 290, 34, 'S3', 'STOP', 'm-btn-red', (d) => L.input('stop', d), 'Ex.6');
      // Tisch und Schacht
      const table = rc(svg, 150, 320, 435, 12, 'm-steel');
      rc(svg, 412, 40, 8, 252, 'p4-wall'); rc(svg, 490, 40, 8, 252, 'p4-wall');
      rc(svg, 412, 36, 86, 6, 'p4-wall');
      const stack = Array.from({ length: CAPACITY }, (_, k) => rc(svg, X0, TOP - H * (k + 1), W, H - 2, 'p4-part', 2));
      // Zylinder
      rc(svg, 190, 292, 140, 28, 'm-cyl', 4);
      tx(svg, 260, 311, 'Z1', 'm-label light', 'middle');
      const rod = rc(svg, 330, 301, 90, 10, 'm-rod');
      const head = rc(svg, 412, 292, 8, 28, 'p4-pad');
      // Teil auf dem Tisch und fallende Teile
      const flying = Array.from({ length: 4 }, () => rc(svg, X0, TOP, W, H - 2, 'p4-part', 2));
      // Behälter
      rc(svg, 572, 395, 128, 55, 'p4-bin-bg');
      const bin = Array.from({ length: 10 }, (_, i) => rc(svg, 580 + (i % 5) * 24, 432 - Math.floor(i / 5) * 16, 22, 14, 'p4-part', 2));
      el('path', { d: 'M572 385 V450 H700 V385', class: 'p4-bin' }, svg);
      // Lichtschranke
      const beam = el('line', { x1: 590, y1: 350, x2: 686, y2: 350, class: 'p4-beam' }, svg);
      rc(svg, 580, 344, 10, 12, 'p2-sensor');
      const lmp = lamp(svg, 700, 350, 'B1', 'Ex.7');
      // Ventil
      const valve = valveSymbol(svg, 200, 380, 'Y1', 'Ax.0');
      tx(svg, 200, 430, 'Zylinder Z1 (Feder-Rückstellung)', 'm-io');
      const count = tx(svg, 200, 452, '', 'm-label small');
      r = { rod, head, stack, table, flying, bin, lamp: lmp, valve, digit: setPreset, count, beam };
    },
    render(logic, ax) {
      const L = logic as FallLogic;
      const front = X0 + D * L.cyl.pos;
      r.head.setAttribute('x', String(front - 8));
      r.rod.setAttribute('width', String(front - 8 - 330));
      r.stack.forEach((s, k) => { s.style.display = k < L.magazine ? '' : 'none'; });
      // Teil auf dem Tisch
      const fl = r.flying;
      const on = L.px !== null;
      fl[0]!.style.display = on ? '' : 'none';
      if (on) { fl[0]!.setAttribute('x', String(X0 + D * L.px!)); fl[0]!.setAttribute('y', String(TOP)); }
      L.falling.slice(0, 3).forEach((t, i) => {
        const e = fl[i + 1]!;
        e.style.display = '';
        e.setAttribute('x', String(X0 + D + 5 + 12 * t * 8 / 2));
        e.setAttribute('y', String(fallY(t)));
      });
      for (let i = L.falling.length; i < 3; i++) fl[i + 1]!.style.display = 'none';
      r.bin.forEach((b, i) => { b.style.display = i < Math.min(10, L.binCount) ? '' : 'none'; });
      r.lamp.classList.toggle('on', L.barrier);
      r.beam.classList.toggle('cut', L.barrier);
      r.valve.classList.toggle('on', (ax & 1) === 1);
      r.digit(L.preset);
      r.count.textContent = `Im Behälter: ${L.binCount} · Im Magazin: ${L.magazine}`;
    },
  };
};

export const fall: ExternalModelDef = {
  id: 'ext-fall',
  name: 'Fallmagazin',
  group: 'Modellpaket 2',
  desc: 'Aus dem Schacht schiebt ein Zylinder so viele Teile in den Behälter, wie mit der Ziffer vorgewählt sind (Vorwahl Ex.0–3). Zähle die Teile mit der Lichtschranke; RESET füllt das Magazin auf.',
  ax: ['Y1 Zylinder ausfahren (Teil ausschieben)', '', '', '', '', '', '', ''],
  ex: ['S0 Vorwahl Bit 0 (Wert 1)', 'S0 Vorwahl Bit 1 (Wert 2)', 'S0 Vorwahl Bit 2 (Wert 4)', 'S0 Vorwahl Bit 3 (Wert 8)', 'S1 Taster START', 'S2 Taster RESET', 'S3 Taster STOP', 'B1 Lichtschranke Auswurf'],
  width: 720,
  height: 460,
  createLogic: () => new FallLogic(),
  createView: view,
};

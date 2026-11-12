import { el } from '../../kit.ts';
import type { ExternalModelDef, ModelView } from '../frame.ts';
import { KompensationLogic } from './kompensation.logic.ts';
import { panelButton } from './parts.ts';
import { ln, rc, tx } from './p2.parts.ts';

const XS = [96, 222, 348, 474];

const view = (): ModelView => {
  let r: { k: SVGGElement[]; c: SVGGElement[]; bars: SVGRectElement[]; load: SVGTextElement; net: SVGTextElement; cos: SVGTextElement; needle: SVGLineElement; phases: SVGLineElement[] };
  return {
    mount(svg, logic) {
      const L = logic as KompensationLogic;
      rc(svg, 0, 0, 720, 460, 'm-bg');
      // Sammelschienen
      const names = ['L1', 'L2', 'L3'];
      const phases: SVGLineElement[] = [];
      names.forEach((n, i) => {
        tx(svg, 14, 52 + i * 22, n, 'm-label');
        phases.push(ln(svg, 40, 48 + i * 22, 548, 48 + i * 22, 'p2-bus'));
      });
      const k: SVGGElement[] = [], c: SVGGElement[] = [];
      XS.forEach((x, n) => {
        for (let p = 0; p < 3; p++) {
          const px = x + p * 16;
          ln(svg, px, 48 + p * 22, px, 330, 'p2-wire-dark');
          el('circle', { cx: px, cy: 48 + p * 22, r: 3.5, class: 'p2-dot' }, svg);
          rc(svg, px - 5, 120, 10, 34, 'p2-fuse');
        }
        tx(svg, x - 42, 140, `F${n + 1}`, 'm-label');
        // Schütz: Spule + Schaltkontakte
        const g = el('g', { class: 'p2-contactor' }, svg);
        rc(g, x - 62, 182, 44, 22, 'p2-coil');
        ln(g, x - 62, 204, x - 18, 182, 'p2-wire-dark');
        for (let p = 0; p < 3; p++) {
          const px = x + p * 16;
          el('rect', { x: px - 5, y: 170, width: 10, height: 44, class: 'p2-gap' }, g);
          ln(g, px, 180, px + 8, 208, 'p2-blade-line open');
          ln(g, px, 176, px, 208, 'p2-blade-line shut');
        }
        tx(svg, x - 42, 170, `K${n + 1}`, 'm-label');
        tx(svg, x - 42, 230, `Ax.${n}`, 'm-io');
        k.push(g);
        // Kondensator (Dreieckschaltung vereinfacht)
        const cg = el('g', { class: 'p2-cap' }, svg);
        rc(cg, x - 8, 290, 72, 66, 'p2-cap-box', 3);
        ln(cg, x + 6, 318, x + 44, 318, 'p2-wire-dark');
        ln(cg, x + 6, 328, x + 44, 328, 'p2-wire-dark');
        ln(cg, x + 25, 330, x + 25, 346, 'p2-wire-dark');
        ln(cg, x + 25, 300, x + 25, 318, 'p2-wire-dark');
        tx(svg, x + 25, 380, `C${n + 1}`, 'm-label', 'middle');
        tx(svg, x + 25, 394, '5 kvar', 'm-io', 'middle');
        c.push(cg);
      });
      // Bedienfeld
      rc(svg, 560, 40, 150, 130, 'm-panel', 10);
      panelButton(svg, 572, 50, 'S1', '+', 'm-btn-grey', (d) => L.input('plus', d), 'Ex.0', 40);
      panelButton(svg, 572, 104, 'S2', '–', 'm-btn-grey', (d) => L.input('minus', d), 'Ex.1', 40);
      // Messanzeige
      rc(svg, 560, 190, 150, 230, 'm-panel', 10);
      tx(svg, 635, 210, 'Blindleistung', 'm-label small', 'middle');
      const bars: SVGRectElement[] = [];
      for (let i = 0; i < 4; i++) bars.push(rc(svg, 612, 330 - i * 22, 46, 18, 'p2-bar', 2));
      tx(svg, 635, 226, 'Last (kvar)', 'm-io', 'middle');
      const load = tx(svg, 635, 242, '', 'm-label', 'middle');
      tx(svg, 635, 262, 'Netto (kvar)', 'm-io', 'middle');
      const net = tx(svg, 635, 278, '', 'm-label', 'middle');
      // Zeiger cos φ
      el('path', { d: 'M600 388 A35 35 0 0 1 670 388', class: 'p2-arc' }, svg);
      const needle = ln(svg, 635, 388, 635, 358, 'p2-needle');
      const cos = tx(svg, 635, 412, '', 'm-label small', 'middle');
      r = { k, c, bars, load, net, cos, needle, phases };
    },
    render(logic) {
      const L = logic as KompensationLogic;
      L.stages.forEach((on, i) => {
        r.k[i]!.classList.toggle('on', on);
        r.c[i]!.classList.toggle('on', on);
      });
      r.load.textContent = `${L.load}`;
      r.net.textContent = `${L.net > 0 ? '+' : ''}${L.net} ${L.net > 0 ? 'ind.' : L.net < 0 ? 'kap.' : ''}`;
      r.net.classList.toggle('p2-bad', Math.abs(L.net) >= 2.5);
      r.cos.textContent = `cos φ = ${L.cosPhi.toFixed(2).replace('.', ',')}`;
      r.needle.setAttribute('transform', `rotate(${Math.max(-60, Math.min(60, L.net * 3))} 635 388)`);
      r.bars.forEach((b, i) => b.classList.toggle('on', i < L.loadStep));
    },
  };
};

export const kompensation: ExternalModelDef = {
  id: 'ext-kompensation',
  name: 'Blindleistungskompensation',
  group: 'Modellpaket 2',
  desc: 'Vier Kondensatorstufen (je 5 kvar) kompensieren die Blindleistung einer induktiven Last. Mit + / − wird die Last verändert. Entladezeit der Kondensatoren (2 s) beachten, sonst Schaltstoß.',
  ax: ['K1 Schütz Stufe C1', 'K2 Schütz Stufe C2', 'K3 Schütz Stufe C3', 'K4 Schütz Stufe C4', '', '', '', ''],
  ex: ['S1 Taster + (mehr Last)', 'S2 Taster − (weniger Last)', 'L Blindleistung induktiv', 'C Blindleistung kapazitiv', '', '', '', ''],
  width: 720,
  height: 460,
  createLogic: () => new KompensationLogic(),
  createView: view,
};

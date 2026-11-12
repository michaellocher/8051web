import { el } from '../../kit.ts';
import type { ExternalModelDef, ModelView } from '../frame.ts';
import { ZweitankLogic } from './zweitank.logic.ts';
import { lamp, panelButton } from './parts.ts';
import { bow, rc, tx } from './p2.parts.ts';

const T1 = { x: 80, y: 80, w: 160, h: 150 };
const T2 = { x: 440, y: 290, w: 160, h: 130 };

const view = (): ModelView => {
  let r: {
    w1: SVGRectElement; w2: SVGRectElement; s1: SVGLineElement; s2: SVGLineElement; s3: SVGLineElement;
    v: SVGGElement[]; lamps: SVGCircleElement[]; h1: SVGCircleElement; pipes: SVGPathElement[];
  };
  return {
    mount(svg, logic) {
      const L = logic as ZweitankLogic;
      rc(svg, 0, 0, 720, 460, 'm-bg');
      // Rohre
      const pipeIn = el('path', { d: 'M10 40 H160 V82', class: 'p2-pipe' }, svg);
      const pipe12 = el('path', { d: `M${T1.x + T1.w / 2} ${T1.y + T1.h} V262 H520 V${T2.y - 6}`, class: 'p2-pipe' }, svg);
      const pipeOut = el('path', { d: `M${T2.x + T2.w} ${T2.y + T2.h - 24} H710`, class: 'p2-pipe' }, svg);
      // Becken
      for (const [t, name] of [[T1, 'Becken 1'], [T2, 'Becken 2']] as const) {
        rc(svg, t.x, t.y, t.w, t.h, 'm-tank');
        tx(svg, t.x + t.w + 10, t.y + 16, name, 'm-label');
      }
      const w1 = rc(svg, T1.x + 2, T1.y + T1.h - 2, T1.w - 4, 0, 'm-liquid');
      const w2 = rc(svg, T2.x + 2, T2.y + T2.h - 2, T2.w - 4, 0, 'm-liquid');
      for (const t of [T1, T2]) el('rect', { x: t.x, y: t.y, width: t.w, height: t.h, class: 'p2-outline' }, svg);
      // Strahlen
      const s1 = el('line', { x1: 160, y1: 82, x2: 160, y2: T1.y + T1.h, class: 'p2-stream' }, svg);
      const s2 = el('line', { x1: 520, y1: T2.y - 6, x2: 520, y2: T2.y + T2.h, class: 'p2-stream' }, svg);
      const s3 = el('line', { x1: 640, y1: T2.y + T2.h - 24, x2: 700, y2: T2.y + T2.h - 24, class: 'p2-stream' }, svg);
      // Ventile
      const v = [bow(svg, 34, 40, 'V1', 'Ax.0'), bow(svg, 340, 262, 'V2', 'Ax.1'), bow(svg, 650, T2.y + T2.h - 24, 'V3', 'Ax.2')];
      // Sensoren (Füllstand)
      const lamps = [
        lamp(svg, T1.x - 24, T1.y + T1.h * 0.1, 'S3', 'Ex.3'),
        lamp(svg, T1.x - 24, T1.y + T1.h * 0.92, 'S4', 'Ex.4'),
        lamp(svg, T2.x - 24, T2.y + T2.h * 0.1, 'S5', 'Ex.5'),
        lamp(svg, T2.x - 24, T2.y + T2.h * 0.92, 'S6', 'Ex.6'),
      ];
      // Entnahme-Taster
      panelButton(svg, 560, 200, 'S2', 'Entnahme', 'm-btn-yellow', (d) => L.input('entnahme', d), 'Ex.2', 40);
      // Bedienfeld
      rc(svg, 430, 16, 270, 130, 'm-panel', 10);
      panelButton(svg, 446, 28, 'S0', 'EIN', 'm-btn-green', (d) => L.input('ein', d), 'Ex.0');
      panelButton(svg, 446, 82, 'S1', 'AUS', 'm-btn-red', (d) => L.input('aus', d), 'Ex.1');
      const h1 = lamp(svg, 650, 60, 'H1 Anlage EIN', 'Ax.3', 'green');
      r = { w1, w2, s1, s2, s3, v, lamps, h1, pipes: [pipeIn, pipe12, pipeOut] };
    },
    render(logic) {
      const L = logic as ZweitankLogic;
      r.w1.setAttribute('y', String(T1.y + T1.h - 2 - L.level1 * (T1.h - 4)));
      r.w1.setAttribute('height', String(L.level1 * (T1.h - 4)));
      r.w2.setAttribute('y', String(T2.y + T2.h - 2 - L.level2 * (T2.h - 4)));
      r.w2.setAttribute('height', String(L.level2 * (T2.h - 4)));
      r.s1.style.display = L.v1 ? '' : 'none';
      r.s2.style.display = L.v2 && L.level1 > 0 && L.level2 < 1 ? '' : 'none';
      r.s3.style.display = L.v3 && L.level2 > 0 ? '' : 'none';
      r.s1.setAttribute('y2', String(T1.y + T1.h - L.level1 * (T1.h - 4)));
      r.s2.setAttribute('y2', String(T2.y + T2.h - L.level2 * (T2.h - 4)));
      r.pipes[0]!.classList.toggle('on', L.v1);
      r.pipes[1]!.classList.toggle('on', L.v2 && L.level1 > 0);
      r.pipes[2]!.classList.toggle('on', L.v3 && L.level2 > 0);
      [L.v1, L.v2, L.v3].forEach((on, i) => r.v[i]!.classList.toggle('on', on));
      [3, 4, 5, 6].forEach((b, i) => r.lamps[i]!.classList.toggle('on', ((L.ex >> b) & 1) === 1));
      r.h1.classList.toggle('on', L.lamp);
    },
  };
};

export const zweitank: ExternalModelDef = {
  id: 'ext-zweitank',
  name: 'Zweitanksystem',
  group: 'Modellpaket 2',
  desc: 'Becken 1 wird über V1 gefüllt, V2 füllt Becken 2 um, V3 entnimmt aus Becken 2. Vier Füllstandssensoren melden voll bzw. nicht leer. Überlaufen und Trockenlaufen vermeiden.',
  ax: ['V1 Zulaufventil Becken 1', 'V2 Ventil Becken 1 → 2', 'V3 Entnahmeventil Becken 2', 'H1 Meldelampe Anlage EIN', '', '', '', ''],
  ex: ['S0 Taster EIN', 'S1 Taster AUS', 'S2 Taster Entnahme', 'S3 Becken 1 voll', 'S4 Becken 1 nicht leer', 'S5 Becken 2 voll', 'S6 Becken 2 nicht leer', ''],
  width: 720,
  height: 460,
  createLogic: () => new ZweitankLogic(),
  createView: view,
};

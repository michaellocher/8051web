import { el } from '../../kit.ts';
import type { ExternalModelDef, ModelView } from '../frame.ts';
import { MischerLogic } from './mischer.logic.ts';
import { lamp, panelButton } from './parts.ts';
import { bow, ln, rc, tx } from './p2.parts.ts';
import { sensorBox } from './p3.parts.ts';

const TL = 270, TR = 450, TT = 130, TB = 400, CX = 360; // Behälter
const TH = TB - TT;
let uid = 0;

const view = (): ModelView => {
  let r: {
    v: SVGGElement[]; v3: SVGGElement; pipes: SVGPathElement[]; outPipe: SVGPathElement; streams: SVGLineElement[];
    l1: SVGRectElement; l2: SVGRectElement; lm: SVGRectElement; heater: SVGPathElement; stir: SVGGElement; blade: SVGRectElement;
    motor: SVGCircleElement; temp: SVGTextElement; sens: SVGRectElement[]; alarm: SVGCircleElement;
  };
  return {
    mount(svg, logic) {
      const L = logic as MischerLogic;
      const id = `p3-mix-clip-${++uid}`;
      rc(svg, 0, 0, 720, 460, 'm-bg');
      // Zulaufleitungen (grob/fein je Komponente)
      const pipes = [
        el('path', { d: `M0 40 H330 V${TT - 2}`, class: 'p3-pipe' }, svg),
        el('path', { d: `M0 90 H346 V${TT - 2}`, class: 'p3-pipe' }, svg),
        el('path', { d: `M720 40 H390 V${TT - 2}`, class: 'p3-pipe' }, svg),
        el('path', { d: `M720 90 H374 V${TT - 2}`, class: 'p3-pipe' }, svg),
      ];
      const outPipe = el('path', { d: `M${CX} ${TB - 2} V420 H720`, class: 'p3-pipe' }, svg);
      // Behälter
      const cap = `M${TL} ${TT + 70} A90 70 0 0 1 ${TR} ${TT + 70} V${TB - 70} A90 70 0 0 1 ${TL} ${TB - 70} Z`;
      el('clipPath', { id }, svg).append(el('path', { d: cap }));
      el('path', { d: cap, fill: '#fff' }, svg);
      const lq = el('g', { 'clip-path': `url(#${id})` }, svg);
      const l1 = rc(lq, TL, TB, TR - TL, 0, 'p3-water');
      const l2 = rc(lq, TL, TB, TR - TL, 0, 'p3-paint');
      const lm = rc(lq, TL, TB, TR - TL, 0, 'p3-mixed');
      lm.style.fill = '#7fae4a';
      const streams = [330, 346, 390, 374].map((x, i) => el('line', { x1: x, y1: TT - 2, x2: x, y2: TB, class: `p3-stream${i > 1 ? ' paint' : ''}` }, svg));
      el('path', { d: cap, class: 'p3-wall' }, svg);
      // Heizung (außen links)
      const heater = el('path', { d: 'M284 292 H262 L242 302 L262 312 L242 322 L262 332 L242 342 L262 352 H284', class: 'p3-heater' }, svg);
      tx(svg, 236, 326, 'H', 'm-label', 'end');
      tx(svg, 236, 340, 'Ax.5', 'm-io', 'end');
      // Rührwerk
      const stir = el('g', {}, svg);
      el('line', { x1: CX, y1: 205, x2: CX, y2: 345, stroke: '#6b737b', 'stroke-width': 7 }, stir);
      const blade = rc(stir, CX - 30, 340, 60, 12, 'p3-stirrer', 3);
      const motor = el('circle', { cx: CX, cy: 190, r: 17, class: 'm-motor-body' }, svg);
      tx(svg, CX, 195, 'M', 'm-label light', 'middle');
      tx(svg, CX + 24, 188, 'Ax.6', 'm-io');
      const temp = tx(svg, CX + 14, 290, '', 'm-label');
      // Ventile
      const v = [bow(svg, 160, 40, 'V1.1', 'Ax.0'), bow(svg, 160, 90, 'V1.2', 'Ax.1'), bow(svg, 560, 40, 'V2.1', 'Ax.2'), bow(svg, 560, 90, 'V2.2', 'Ax.3')];
      const v3 = bow(svg, 580, 420, 'V3', 'Ax.4');
      // Sensoren
      const sens = [
        sensorBox(svg, 232, 118, 'QI1', 'Ex.0', 'left'), sensorBox(svg, 488, 118, 'QI2', 'Ex.1'),
        sensorBox(svg, 232, 230, 'TIS max', 'Ex.2', 'left'), sensorBox(svg, 488, 395, 'LIS1 min', 'Ex.3'),
        sensorBox(svg, 488, 162, 'LIS2 max', 'Ex.4'),
      ];
      for (const [x1, x2, y] of [[240, TL + 4, 118], [TR - 4, 480, 118], [240, TL, 230], [TR, 480, 395], [TR, 480, 162]] as const) ln(svg, x1, y, x2, y, 'p3-tick');
      // Bedienfeld
      rc(svg, 14, 150, 170, 60, 'm-panel', 10);
      panelButton(svg, 24, 160, 'S1', 'START', 'm-btn-green', (d) => L.input('s1', d), 'Ex.5');
      const alarm = lamp(svg, 520, 330, 'ALARM H1', 'Ax.7', 'red');
      panelButton(svg, 24, 380, 'S2', 'Hand', 'm-btn-yellow', (d) => L.input('s2', d), 'Ex.6');
      r = { v, v3, pipes, outPipe, streams, l1, l2, lm, heater, stir, blade, motor, temp, sens, alarm };
    },
    render(logic) {
      const L = logic as MischerLogic;
      const k = TH, mixa = L.mix;
      const y1 = TB - L.vol1 * k, h1 = L.vol1 * k, h2 = L.vol2 * k;
      r.l1.setAttribute('y', String(y1)); r.l1.setAttribute('height', String(h1)); r.l1.style.opacity = String(1 - mixa);
      r.l2.setAttribute('y', String(y1 - h2)); r.l2.setAttribute('height', String(h2)); r.l2.style.opacity = String(1 - mixa);
      r.lm.setAttribute('y', String(TB - L.level * k)); r.lm.setAttribute('height', String(L.level * k)); r.lm.style.opacity = String(mixa);
      const top = TB - L.level * k;
      L.v.forEach((on, i) => {
        r.v[i]!.classList.toggle('on', on);
        r.pipes[i]!.classList.toggle('on', on);
        r.streams[i]!.style.display = on ? '' : 'none';
        r.streams[i]!.setAttribute('y2', String(Math.max(TT, top)));
      });
      r.v3.classList.toggle('on', L.v3);
      r.outPipe.classList.toggle('on', L.v3 && L.level > 0);
      r.heater.classList.toggle('on', L.heater);
      r.motor.style.fill = L.motor.running ? '#2a4fd6' : '';
      r.blade.setAttribute('transform', `translate(${CX} 0) scale(${Math.max(0.15, Math.abs(Math.cos((L.motor.angle * Math.PI) / 180)))} 1) translate(${-CX} 0)`);
      r.temp.textContent = `${Math.round(L.temp)} °C`;
      const ex = L.ex;
      [0, 1, 2, 4, 3].forEach((b, i) => r.sens[i]!.classList.toggle('on', ((ex >> b) & 1) === 1));
      r.alarm.classList.toggle('on', L.alarm);
    },
  };
};

export const mischer: ExternalModelDef = {
  id: 'ext-mischer',
  name: 'Mischbehälter',
  group: 'Modellpaket 2',
  desc: 'Zwei Komponenten werden über je ein grobes und ein feines Ventil zudosiert (Durchflusszähler liefern Impulse), gerührt, beheizt und über V3 entleert. Alarm bei Überfüllung. Modellvariante A: Schließer.',
  ax: ['V1.1 Komponente 1 grob', 'V1.2 Komponente 1 fein', 'V2.1 Komponente 2 grob', 'V2.2 Komponente 2 fein', 'V3 Ablassventil', 'H Heizung', 'M Rührwerk', 'H1 Meldeleuchte ALARM'],
  ex: ['QI1 Impulse Durchfluss Komp. 1', 'QI2 Impulse Durchfluss Komp. 2', 'TIS Temperatur max.', 'LIS1 Behälter nicht leer', 'LIS2 Behälter voll', 'S1 Taster START', 'S2 Taster Hand', ''],
  width: 720,
  height: 460,
  createLogic: () => new MischerLogic(),
  createView: view,
};

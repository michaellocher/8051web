import { el } from '../../kit.ts';
import type { ExternalModelDef, ModelView } from '../frame.ts';
import { SILO_LEVELS, SiloLogic } from './silo.logic.ts';
import { lamp, motorSymbol, panelSwitch } from './parts.ts';
import { faultButton, rect, txt } from './p1.parts.ts';
import { Motor } from '../logic.ts';

const TOP = 150, BOT = 410, X0 = 290, W = 150;
const body = `M${X0} ${TOP + 60} Q${X0} ${TOP} ${X0 + W / 2} ${TOP} Q${X0 + W} ${TOP} ${X0 + W} ${TOP + 60} V${BOT - 60} Q${X0 + W} ${BOT} ${X0 + W / 2} ${BOT} Q${X0} ${BOT} ${X0} ${BOT - 60} Z`;
const levelY = (l: number) => BOT - l * (BOT - TOP);

const view = (): ModelView => {
  let liquid: SVGRectElement;
  let stream: SVGPathElement;
  let sensors: SVGCircleElement[];
  let faults: ReturnType<typeof faultButton>[];
  let valve: SVGGElement;
  let h1: SVGCircleElement;
  let pumps: ReturnType<typeof motorSymbol>[];
  let pipes: SVGPathElement[];
  const rot = [new Motor(), new Motor()];
  let last = 0;
  return {
    mount(svg, logic) {
      const L = logic as SiloLogic;
      rect(svg, 0, 0, 720, 460, 'm-bg');
      const defs = el('defs', {}, svg);
      el('path', { d: body }, el('clipPath', { id: 'p1-silo-clip' }, defs));
      liquid = el('rect', { x: X0, y: BOT, width: W, height: 0, class: 'm-liquid', 'clip-path': 'url(#p1-silo-clip)' }, svg);
      el('path', { d: body, class: 'p1-outline' }, svg);
      // Zulauf mit Ventil
      rect(svg, 20, 108, 150, 14, 'p1-stream');
      stream = el('path', { d: `M237 115 H${X0 + 75} V${TOP + 2}`, class: 'm-pipe' }, svg);
      valve = el('g', { class: 'p1-bow', transform: 'translate(215 115)' }, svg);
      el('path', { d: 'M-22 -14 L0 0 L-22 14 Z', class: 'p1-bow-tri' }, valve);
      el('path', { d: 'M22 -14 L0 0 L22 14 Z', class: 'p1-bow-tri' }, valve);
      txt(svg, 215, 150, 'V1', 'm-label', 'middle');
      // Bedienfeld
      rect(svg, 20, 18, 190, 76, 'm-panel', 12);
      panelSwitch(svg, 30, 26, 'S0', 'EIN', (on) => L.input('s0', on), 'Ex.0');
      h1 = lamp(svg, 168, 56, 'H1 Störung', 'Ax.0', 'red');
      panelSwitch(svg, 200, 126, 'V1', 'Zulauf auf', (on) => L.input('v1', on), 'Hand').setAttribute('transform', 'translate(32 130)');
      // Sensoren
      sensors = []; faults = [];
      SILO_LEVELS.forEach((lv, i) => {
        const y = levelY(lv);
        el('line', { x1: 230, y1: y, x2: X0 + 14, y2: y, stroke: '#111', 'stroke-width': 2 }, svg);
        el('circle', { cx: X0 + 14, cy: y, r: 4, fill: '#111' }, svg);
        sensors.push(el('circle', { cx: 225, cy: y, r: 9, class: 'm-lamp green' }, svg));
        txt(svg, 225, y - 14, `S${i + 1} (Ex.${i + 1})`, 'm-label small', 'middle');
        faults.push(faultButton(svg, 150, y - 14, `Drahtbruch Sensor S${i + 1} ein/aus`, () => L.input(`f${i + 1}`, true)));
      });
      // Pumpen
      pumps = []; pipes = [];
      [0, 1].forEach((i) => {
        const y = 350 + i * 56;
        el('path', { d: `M${X0 + W - 4} ${y} H512`, class: 'm-pipe' }, svg);
        pipes.push(el('path', { d: `M548 ${y} H700`, class: 'm-pipe' }, svg));
        pumps.push(motorSymbol(svg, 530, y, `P${i + 1}`, `Ax.${i + 1}`, 18));
      });
    },
    render(logic, ax) {
      const L = logic as SiloLogic;
      const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
      const y = levelY(L.level);
      liquid.setAttribute('y', String(y)); liquid.setAttribute('height', String(BOT - y));
      stream.classList.toggle('on', L.inletOpen);
      valve.classList.toggle('open', L.inletOpen);
      sensors.forEach((s, i) => s.classList.toggle('on', L.sensor(i)));
      faults.forEach((f, i) => f.set(L.broken[i]!));
      h1.classList.toggle('on', (ax & 1) === 1);
      pumps.forEach((p, i) => {
        const on = ((ax >> (1 + i)) & 1) === 1 && L.level > 0.01;
        rot[i]!.step(on, dt);
        p.update(on, rot[i]!.angle);
        pipes[i]!.classList.toggle('on', on);
      });
    },
  };
};

export const silo: ExternalModelDef = {
  id: 'ext-silo',
  name: 'Siloentleerung',
  group: 'Modellpaket 1',
  desc: 'Ein Silo wird über das Ventil V1 (von Hand) befüllt und von zwei Pumpen entleert, gesteuert über drei Füllstandssensoren. Variante A ohne Drahtbruchsicherheit.',
  ax: ['H1 Störlampe', 'P1 Pumpe 1', 'P2 Pumpe 2', '', '', '', '', ''],
  ex: ['S0 Schalter EIN', 'S1 Füllstand oben (80 %)', 'S2 Füllstand Mitte (50 %)', 'S3 Füllstand unten (15 %)', '', '', '', ''],
  width: 720,
  height: 460,
  createLogic: () => new SiloLogic(),
  createView: view,
};

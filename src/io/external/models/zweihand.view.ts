import { el } from '../../kit.ts';
import type { ExternalModelDef, ModelView } from '../frame.ts';
import { ZweihandLogic } from './zweihand.logic.ts';
import { lamp, panelButton, panelSwitch } from './parts.ts';
import { rc, tx } from './p2.parts.ts';

const TRAVEL = 92;

const view = (): ModelView => {
  let r: { ram: SVGGElement; k1: SVGCircleElement; sheet: SVGRectElement; count: SVGTextElement; warn: SVGGElement; rot: SVGGElement; lamps: SVGCircleElement[]; b1: SVGGElement; b2: SVGGElement };
  return {
    mount(svg, logic) {
      const L = logic as ZweihandLogic;
      rc(svg, 0, 0, 720, 460, 'm-bg');
      // Bodenplatte und Unterwerkzeug
      rc(svg, 190, 430, 340, 18, 'p2-ground');
      rc(svg, 238, 392, 244, 38, 'p2-die');
      rc(svg, 300, 392, 120, 12, 'm-bg');
      const sheet = rc(svg, 244, 386, 232, 6, 'p2-sheet');
      // Ständer und Kopf
      rc(svg, 224, 130, 28, 300, 'p2-frame');
      rc(svg, 468, 130, 28, 300, 'p2-frame');
      rc(svg, 224, 44, 272, 96, 'p2-frame', 4);
      el('circle', { cx: 360, cy: 92, r: 30, class: 'p2-motor-face' }, svg);
      const rot = el('g', { transform: 'translate(360 92)' }, svg);
      el('path', { d: 'M0 -22 L5 -12 L-5 -12 Z', class: 'm-motor-mark' }, rot);
      tx(svg, 360, 98, 'M', 'm-label', 'middle');
      const k1 = lamp(svg, 190, 80, 'K1 Motor', 'Ax.0');
      // beweglicher Stempel
      const ram = el('g', {}, svg);
      rc(ram, 290, 150, 140, 40, 'p2-ram', 3);
      rc(ram, 342, 190, 36, 70, 'p2-rod');
      rc(ram, 272, 260, 176, 16, 'p2-ram', 3);
      rc(ram, 312, 276, 96, 36, 'p2-punch', 2);
      // Bedienfelder links/rechts
      rc(svg, 14, 190, 186, 128, 'm-panel', 10);
      rc(svg, 520, 190, 186, 128, 'm-panel', 10);
      panelButton(svg, 28, 202, 'S1', 'Taster links', 'm-btn-blue', (d) => L.input('s1', d), 'Ex.0');
      panelButton(svg, 534, 202, 'S2', 'Taster rechts', 'm-btn-blue', (d) => L.input('s2', d), 'Ex.1');
      panelSwitch(svg, 28, 262, 'S1', 'festgeklebt', (on) => L.input('tape1', on));
      panelSwitch(svg, 534, 262, 'S2', 'festgeklebt', (on) => L.input('tape2', on));
      // Hubendlagen
      const lamps = [lamp(svg, 570, 380, 'B1 unten', 'Ex.2'), lamp(svg, 650, 380, 'B2 oben', 'Ex.3')];
      const count = tx(svg, 20, 440, '', 'm-label');
      const warn = el('g', { class: 'p2-warn', transform: 'translate(560 80)' }, svg);
      el('path', { d: 'M0 -26 L26 20 L-26 20 Z', class: 'p2-warn-tri' }, warn);
      tx(warn, 0, 14, '!', 'p2-warn-text', 'middle');
      tx(svg, 560, 112, 'Gefahr', 'm-label small', 'middle');
      const b1 = el('g', {}, svg), b2 = el('g', {}, svg);
      r = { ram, k1, sheet, count, warn, rot, lamps, b1, b2 };
    },
    render(logic) {
      const L = logic as ZweihandLogic;
      r.ram.setAttribute('transform', `translate(0 ${L.ram * TRAVEL})`);
      r.sheet.classList.toggle('pressed', L.pressed > 0 && L.ram < 0.9 ? true : L.ram >= 0.9);
      r.rot.setAttribute('transform', `translate(360 92) rotate(${L.k1 ? (L.clock * 360 * 2) % 360 : 0})`);
      r.k1.classList.toggle('on', L.k1);
      r.lamps[0]!.classList.toggle('on', L.ram >= 0.98);
      r.lamps[1]!.classList.toggle('on', L.ram <= 0.02);
      r.count.textContent = `Gepresste Teile: ${L.pressed}`;
      r.warn.classList.toggle('on', L.status.startsWith('GEFAHR'));
    },
  };
};

export const zweihand: ExternalModelDef = {
  id: 'ext-zweihand',
  name: 'Zweihandverriegelung',
  group: 'Modellpaket 2',
  desc: 'Eine Presse darf nur fahren, wenn beide Taster innerhalb von 0,5 s betätigt werden und während des Hubs gedrückt bleiben. Mit „festgeklebt" lässt sich ein Taster dauerhaft überbrücken, um die Verriegelung zu prüfen.',
  ax: ['K1 Pressenmotor (Stempel ab)', '', '', '', '', '', '', ''],
  ex: ['S1 Taster links', 'S2 Taster rechts', 'B1 Stempel unten', 'B2 Stempel oben', '', '', '', ''],
  width: 720,
  height: 460,
  createLogic: () => new ZweihandLogic(),
  createView: view,
};

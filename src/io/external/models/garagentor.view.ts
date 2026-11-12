import { el } from '../../kit.ts';
import type { ExternalModelDef, ModelView } from '../frame.ts';
import { GaragentorLogic } from './garagentor.logic.ts';
import { lamp, motorSymbol, panelButton, panelSwitch } from './parts.ts';
import { ln, rc } from './p2.parts.ts';

const DX = 280, DY = 110, DW = 300, DH = 270;

const view = (): ModelView => {
  let r: { door: SVGRectElement; hem: SVGRectElement; crate: SVGGElement; motor: ReturnType<typeof motorSymbol>; warn: SVGCircleElement; lamps: SVGCircleElement[]; roll: SVGRectElement; m1: SVGCircleElement; m2: SVGCircleElement };
  return {
    mount(svg, logic) {
      const L = logic as GaragentorLogic;
      rc(svg, 0, 0, 720, 460, 'm-bg');
      const defs = el('defs', {}, svg);
      const pat = el('pattern', { id: 'p2-slats', width: 10, height: 18, patternUnits: 'userSpaceOnUse' }, defs);
      rc(pat, 0, 0, 10, 18, 'p2-slat-fill');
      rc(pat, 0, 15, 10, 3, 'p2-slat-edge');
      // Boden
      el('path', { d: 'M150 440 L250 380 L650 380 L750 440 Z', class: 'p2-drive' }, svg);
      // Garageninneres, Tor, Rahmen
      rc(svg, DX, DY, DW, DH, 'p2-inside');
      const crate = el('g', { transform: 'translate(0 0)' }, svg);
      rc(crate, 395, 312, 70, 68, 'p2-crate', 3);
      ln(crate, 395, 312, 465, 380, 'p2-crate-x'); ln(crate, 465, 312, 395, 380, 'p2-crate-x');
      const door = rc(svg, DX, DY, DW, DH, 'p2-door');
      const hem = rc(svg, DX, DY + DH - 8, DW, 8, 'p2-door-hem');
      rc(svg, DX - 40, DY - 40, 40, DH + 40, 'p2-gframe');
      rc(svg, DX + DW, DY - 40, 40, DH + 40, 'p2-gframe');
      rc(svg, DX - 40, DY - 40, DW + 80, 40, 'p2-gframe');
      const roll = rc(svg, DX, DY, DW, 12, 'p2-roll');
      // Lichtschranke
      ln(svg, DX - 30, 335, DX + DW + 30, 335, 'p2-beam');
      rc(svg, DX - 50, 327, 14, 16, 'p2-sensor', 2);
      rc(svg, DX + DW + 36, 327, 14, 16, 'p2-sensor', 2);
      // Motor
      ln(svg, DX + DW + 40, 60, 640, 60, 'p2-spindle-line');
      const motor = motorSymbol(svg, 670, 60, 'M', '', 22);
      // Lampen
      const warn = lamp(svg, DX + DW / 2, 56, 'H1 Warnleuchte · Ax.2', '', 'red');
      const m1 = lamp(svg, 650, 150, 'M1 auf', 'Ax.0'), m2 = lamp(svg, 690, 150, 'M2 ab', 'Ax.1');
      const lamps = [lamp(svg, 650, 220, 'Se1 oben', 'Ex.2'), lamp(svg, 650, 280, 'Se2 unten', 'Ex.3'), lamp(svg, 650, 340, 'Se3', 'Ex.4', 'red')];
      // Bedienung
      rc(svg, 8, 130, 224, 190, 'm-panel', 10);
      panelButton(svg, 20, 140, 'S1', 'Schlüsselschalter', 'm-btn-grey', (d) => L.input('s1', d), 'Ex.0');
      panelButton(svg, 20, 190, 'S2', 'Handtaster innen', 'm-btn-blue', (d) => L.input('s2', d), 'Ex.1');
      panelSwitch(svg, 20, 248, 'S3', 'Hindernis', (on) => L.input('obstacle', on), 'Ex.4');
      r = { door, hem, crate, motor, warn, lamps, roll, m1, m2 };
    },
    render(logic) {
      const L = logic as GaragentorLogic;
      const h = DH * (1 - L.pos);
      r.door.setAttribute('height', String(h));
      r.hem.setAttribute('y', String(DY + h - 8));
      r.hem.style.display = h > 10 ? '' : 'none';
      r.roll.setAttribute('height', String(12 + L.pos * 14));
      r.crate.style.display = L.obstacle ? '' : 'none';
      r.motor.update(L.dir !== 0, L.pos * 5000);
      r.warn.classList.toggle('on', L.warn);
      r.m1.classList.toggle('on', L.dir > 0);
      r.m2.classList.toggle('on', L.dir < 0);
      const ex = L.ex;
      [2, 3, 4].forEach((b, i) => r.lamps[i]!.classList.toggle('on', ((ex >> b) & 1) === 1));
    },
  };
};

export const garagentor: ExternalModelDef = {
  id: 'ext-garagentor',
  name: 'Garagentorsteuerung',
  group: 'Modellpaket 2',
  desc: 'Rolltor mit Schlüsselschalter (außen) und Handtaster (innen) als Impulstaster. Endschalter Se1/Se2, Warnleuchte H1 und Lichtschranke Se3: Beim Schließen muss ein Hindernis das Tor stoppen und wieder öffnen lassen.',
  ax: ['M1 Motor Tor auf', 'M2 Motor Tor ab', 'H1 Warnleuchte', '', '', '', '', ''],
  ex: ['S1 Schlüsselschalter außen', 'S2 Handtaster innen', 'Se1 Endlage oben (Tor offen)', 'Se2 Endlage unten (Tor zu)', 'Se3 Lichtschranke unterbrochen', '', '', ''],
  width: 720,
  height: 460,
  createLogic: () => new GaragentorLogic(),
  createView: view,
};

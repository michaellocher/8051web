import { el } from '../../kit.ts';
import type { ExternalModelDef, ModelView } from '../frame.ts';
import { PumpeLogic } from './pumpe.logic.ts';
import { lamp, panelButton, panelSwitch } from './parts.ts';
import { rc, tx } from './p2.parts.ts';
import { bowtie, faultButton } from './p1.parts.ts';

const HIGH = 0.75, LOW = 0.2;
const TX = 250, TY = 270, TW = 290, TH = 150; // Beckeninnenraum

const view = (): ModelView => {
  let r: {
    water: SVGRectElement; stream: SVGLineElement; inPipe: SVGPathElement; outPipe: SVGPathElement; rotor: SVGGElement;
    pumpBody: SVGCircleElement; v1: ReturnType<typeof bowtie>; q1: ReturnType<typeof faultButton>; lamps: SVGCircleElement[]; h1: SVGCircleElement;
  };
  return {
    mount(svg, logic) {
      const L = logic as PumpeLogic;
      rc(svg, 0, 0, 720, 460, 'm-bg');
      // Bedienfeld
      rc(svg, 14, 14, 300, 100, 'm-panel', 10);
      panelSwitch(svg, 28, 22, 'S0', 'EIN', (on) => L.input('s0', on), 'Ex.0');
      panelButton(svg, 28, 62, 'S3', 'Check', 'm-btn-green', (d) => L.input('check', d), 'Ex.3');
      const h1 = lamp(svg, 240, 62, 'H1 Betrieb/Störung', 'Ax.1', 'yellow');
      // Rohre
      const inPipe = el('path', { d: 'M0 232 H350 V262', class: 'p3-pipe' }, svg);
      const outPipe = el('path', { d: `M500 ${TY + TH - 20} V230 H600 M600 230 H720`, class: 'p3-pipe' }, svg);
      // Becken
      const water = rc(svg, TX, TY + TH, TW, 0, 'p3-water');
      el('path', { d: `M${TX} ${TY - 20} V${TY + TH} H${TX + TW} V${TY - 20}`, class: 'p3-wall' }, svg);
      for (const [lv, tag, io] of [[HIGH, 'S1', 'Ex.1'], [LOW, 'S2', 'Ex.2']] as const) {
        const y = TY + TH - lv * TH;
        el('line', { x1: TX + TW, y1: y, x2: 583, y2: y, class: 'p3-tick' }, svg);
        el('circle', { cx: TX + TW, cy: y, r: 3, fill: '#222' }, svg);
        void tag; void io;
      }
      const stream = el('line', { x1: 350, y1: 262, x2: 350, y2: TY + TH, class: 'p3-stream' }, svg);
      // Pumpe
      const pumpBody = el('circle', { cx: 600, cy: 230, r: 30, class: 'm-motor-body' }, svg);
      const rotor = el('g', { transform: 'translate(600 230)' }, svg);
      el('path', { d: 'M-16 -8 L18 0 L-16 8 Z', class: 'm-motor-mark' }, rotor);
      tx(svg, 600, 280, 'P1', 'm-label', 'middle');
      tx(svg, 600, 293, 'Ax.0', 'm-io', 'middle');
      // Handventil V1
      const v1 = bowtie(svg, 150, 232, 30);
      v1.g.style.cursor = 'pointer';
      v1.g.setAttribute('role', 'switch');
      v1.g.setAttribute('tabindex', '0');
      v1.g.setAttribute('aria-label', 'V1 Zulaufventil (Handventil)');
      const toggleV1 = () => L.input('v1', !L.v1Open);
      v1.g.addEventListener('click', toggleV1);
      v1.g.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleV1(); } });
      tx(svg, 150, 262, 'V1 Zulauf (Hand)', 'm-label small', 'middle');
      tx(svg, 150, 274, 'anklicken: auf/zu', 'm-io', 'middle');
      // Störungs-Taster Q1
      const q1 = faultButton(svg, 584, 150, 'Q1: Motorschutz auslösen/zurücksetzen', () => L.input('q1', !L.tripped));
      tx(svg, 600, 142, 'Q1 Motorschutz', 'm-label small', 'middle');
      tx(svg, 600, 192, 'Ex.4', 'm-io', 'middle');
      const lamps = [
        lamp(svg, 590, TY + TH - HIGH * TH + 0, '', ''),
        lamp(svg, 590, TY + TH - LOW * TH, '', ''),
      ];
      tx(svg, 604, TY + TH - HIGH * TH + 4, 'S1 Ex.1 oben', 'm-label small');
      tx(svg, 604, TY + TH - LOW * TH + 4, 'S2 Ex.2 unten', 'm-label small');
      r = { water, stream, inPipe, outPipe, rotor, pumpBody, v1, q1, lamps, h1 };
    },
    render(logic, ax) {
      const L = logic as PumpeLogic;
      const h = L.level * TH;
      r.water.setAttribute('y', String(TY + TH - h));
      r.water.setAttribute('height', String(h));
      r.stream.style.display = L.v1Open ? '' : 'none';
      r.stream.setAttribute('y2', String(TY + TH - h));
      r.inPipe.classList.toggle('on', L.v1Open);
      r.outPipe.classList.toggle('on', L.running && L.level > 0);
      r.rotor.setAttribute('transform', `translate(600 230) rotate(${L.motor.angle})`);
      r.pumpBody.style.fill = L.running ? '#2a4fd6' : '';
      r.v1.set(L.v1Open);
      r.q1.set(L.tripped);
      r.lamps[0]!.classList.toggle('on', L.level >= 0.75);
      r.lamps[1]!.classList.toggle('on', L.level >= 0.2);
      r.h1.classList.toggle('on', ((ax >> 1) & 1) === 1);
    },
  };
};

export const pumpe: ExternalModelDef = {
  id: 'ext-pumpe',
  name: 'Pumpensteuerung',
  group: 'Modellpaket 2',
  desc: 'Ein Becken wird über das Handventil V1 gefüllt und mit der Pumpe P1 geleert. Pumpe nur bei ausreichendem Wasserstand laufen lassen (Trockenlauf!), Motorschutz Q1 überwachen. Modellvariante A: Schließer.',
  ax: ['P1 Pumpe', 'H1 Meldeleuchte Betrieb/Störung', '', '', '', '', '', ''],
  ex: ['S0 Schalter EIN', 'S1 Füllstand oben', 'S2 Füllstand unten', 'S3 Taster Check', 'Q1 Motorschutz ausgelöst', '', '', ''],
  width: 720,
  height: 460,
  createLogic: () => new PumpeLogic(),
  createView: view,
};

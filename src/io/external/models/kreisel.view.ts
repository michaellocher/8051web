import { el } from '../../kit.ts';
import type { ExternalModelDef, ModelView } from '../frame.ts';
import { KreiselLogic } from './kreisel.logic.ts';
import { lamp, panelButton, panelSwitch } from './parts.ts';
import { rc, tx } from './p2.parts.ts';

const view = (): ModelView => {
  let r: { water: SVGPathElement; rotor: SVGGElement; m1: SVGCircleElement; h1: SVGCircleElement; s2: SVGCircleElement; wave: SVGPathElement; drops: SVGLineElement; dryTag: SVGTextElement; flow: SVGLineElement };
  return {
    mount(svg, logic) {
      const L = logic as KreiselLogic;
      rc(svg, 0, 0, 720, 460, 'm-bg');
      // Bedienfeld
      rc(svg, 20, 20, 250, 130, 'm-panel', 10);
      panelButton(svg, 36, 30, 'S0', 'AUS', 'm-btn-red', (d) => L.input('aus', d), 'Ex.0');
      panelButton(svg, 36, 84, 'S1', 'EIN', 'm-btn-green', (d) => L.input('ein', d), 'Ex.1');
      const h1 = lamp(svg, 230, 70, 'H1 Alarm', 'Ax.1', 'red');
      panelSwitch(svg, 20, 170, 'Fehler', 'Zulauf unterbrechen', (on) => L.input('dry', on));
      // Saugrohr und Druckrohr
      rc(svg, 40, 270, 200, 56, 'p2-tube');
      const water = el('path', { d: 'M40 273 H230 V323 H40 Z', class: 'm-liquid' }, svg);
      rc(svg, 450, 250, 230, 56, 'p2-tube');
      const flow = el('line', { x1: 460, y1: 278, x2: 672, y2: 278, class: 'p2-stream' }, svg);
      // Pumpengehäuse (Spirale)
      el('path', { d: 'M190 340 L330 340 L360 420 L160 420 Z', class: 'p2-base' }, svg);
      el('circle', { cx: 290, cy: 300, r: 88, class: 'p2-pump' }, svg);
      rc(svg, 340, 240, 52, 56, 'p2-pump');
      rc(svg, 392, 252, 62, 32, 'p2-pump');
      rc(svg, 376, 236, 14, 80, 'p2-flange');
      const rotor = el('g', { transform: 'translate(290 300)' }, svg);
      el('circle', { r: 60, class: 'p2-rotor-bg' }, rotor);
      for (let i = 0; i < 6; i++) el('path', { d: 'M0 0 Q 26 -14 46 -46', class: 'p2-blade', transform: `rotate(${i * 60})` }, rotor);
      el('circle', { r: 8, class: 'm-rod' }, rotor);
      tx(svg, 290, 410, 'Kreiselpumpe', 'm-label light', 'middle');
      // Sensor und Motor
      const m1 = lamp(svg, 290, 190, 'M1', 'Ax.0');
      el('line', { x1: 290, y1: 200, x2: 290, y2: 214, class: 'p2-wire' }, svg);
      const s2 = lamp(svg, 520, 190, 'S2 Durchfluss', 'Ex.2', 'yellow');
      el('line', { x1: 520, y1: 197, x2: 520, y2: 250, class: 'p2-wire' }, svg);
      rc(svg, 508, 232, 24, 16, 'p2-sensor', 3);
      const wave = el('path', { d: 'M560 200 h16 v-16 h16 v16 h16 v-16 h16 v16 h16', class: 'p2-wave' }, svg);
      const drops = el('line', { x1: 40, y1: 298, x2: 230, y2: 298, class: 'p2-stream' }, svg);
      const dryTag = tx(svg, 140, 350, 'Zulauf unterbrochen', 'm-label small', 'middle');
      void rc;
      r = { water, rotor, m1, h1, s2, wave, drops, dryTag, flow };
    },
    render(logic) {
      const L = logic as KreiselLogic;
      r.rotor.setAttribute('transform', `translate(290 300) rotate(${L.motor.angle})`);
      r.m1.classList.toggle('on', L.motor.speed > 0.05);
      r.h1.classList.toggle('on', L.alarm);
      r.s2.classList.toggle('on', ((L.ex >> 2) & 1) === 1);
      r.water.style.display = L.dry ? 'none' : '';
      r.drops.style.display = L.dry ? 'none' : '';
      r.dryTag.style.display = L.dry ? '' : 'none';
      r.flow.style.display = L.flowing ? '' : 'none';
      r.wave.classList.toggle('on', L.flowing);
    },
  };
};

export const kreisel: ExternalModelDef = {
  id: 'ext-kreisel',
  name: 'Kreiselpumpe',
  group: 'Modellpaket 2',
  desc: 'Pumpe mit Durchflusswächter: Der Sensor S2 liefert nur bei Förderung Impulse. Mit dem Schalter „Zulauf unterbrechen" läuft die Pumpe trocken – die Steuerung muss abschalten und Alarm geben.',
  ax: ['M1 Pumpenmotor', 'H1 Meldelampe Alarm', '', '', '', '', '', ''],
  ex: ['S0 Taster AUS', 'S1 Taster EIN', 'S2 Durchflusssensor (Impulse)', '', '', '', '', ''],
  width: 720,
  height: 460,
  createLogic: () => new KreiselLogic(),
  createView: view,
};

import { el } from '../../kit.ts';
import type { ExternalModelDef, ModelView } from '../frame.ts';
import { SchwestLogic } from './schwest.logic.ts';
import { lamp, panelButton } from './parts.ts';
import { rect, txt } from './p1.parts.ts';

const view = (): ModelView => {
  let corridor: SVGCircleElement[];
  let station: SVGCircleElement[];
  let beds: SVGRectElement[];
  let sound: SVGPathElement[];
  return {
    mount(svg, logic) {
      const L = logic as SchwestLogic;
      rect(svg, 0, 0, 720, 480, 'm-bg');
      corridor = []; beds = [];
      for (let i = 0; i < 3; i++) {
        const x = 20 + i * 232;
        rect(svg, x, 16, 220, 190, 'p1-room', 4);
        rect(svg, x + 8, 22, 22, 22, 'p1-badge', 2);
        txt(svg, x + 19, 39, String(i + 1), 'm-label', 'middle');
        beds.push(rect(svg, x + 136, 24, 76, 118, 'p1-bed', 6));
        rect(svg, x + 142, 30, 64, 36, 'p1-bed', 4);
        el('circle', { cx: x + 36, cy: 90, r: 18, fill: '#7b4a1a' }, svg);
        panelButton(svg, x + 72, 24, `S1.${i + 1}`, 'Ruf', 'm-btn-red', (d) => L.input(`call${i + 1}`, d), '', 50);
        txt(svg, x + 103, 78, `S1.${i + 1} · Ex.${i * 2}`, 'm-io', 'middle');
        el('path', { d: `M${x + 120} 206 V176 A30 30 0 0 0 ${x + 150} 176`, class: 'p1-door' }, svg);
        panelButton(svg, x + 12, 150, `S2.${i + 1}`, 'Anwesend', 'm-btn-green', (d) => L.input(`pres${i + 1}`, d), '', 76);
        txt(svg, x + 50, 200, `S2.${i + 1} · Ex.${i * 2 + 1}`, 'm-io', 'middle');
        corridor.push(lamp(svg, x + 105, 238, `P1.${i + 1}`, `Ax.${i}`, 'red'));
      }
      // Schwesternzimmer
      rect(svg, 20, 290, 440, 180, 'p1-room', 4);
      txt(svg, 40, 316, 'Schwesternzimmer', 'm-label');
      rect(svg, 300, 300, 150, 110, 'm-panel', 6);
      station = [];
      for (let i = 0; i < 3; i++) {
        rect(svg, 310, 308 + i * 32, 22, 22, 'p1-badge', 2);
        txt(svg, 321, 325 + i * 32, String(i + 1), 'm-label', 'middle');
        station.push(lamp(svg, 372, 320 + i * 32, '', '', 'red'));
        txt(svg, 392, 316 + i * 32, `P2.${i + 1}`, 'm-label small'); txt(svg, 392, 328 + i * 32, `Ax.${3 + i}`, 'm-io');
      }
      // Summer
      el('path', { d: 'M60 360 H84 L116 340 V392 L84 372 H60 Z', class: 'p1-horn' }, svg);
      sound = [0, 1, 2].map((k) => el('path', { d: `M${126 + k * 12} ${352 - k * 4} Q${138 + k * 12} 366 ${126 + k * 12} ${380 + k * 4}`, class: 'p1-sound' }, svg));
      txt(svg, 40, 412, 'P0 Summer · Ax.6', 'm-label small');
      panelButton(svg, 40, 424, 'S3', 'Quittieren', 'm-btn-green', (d) => L.input('quit', d), 'Ex.6');
      rect(svg, 490, 330, 210, 82, 'm-panel', 8);
      txt(svg, 595, 356, 'Modellvariante B', 'm-label', 'middle');
      txt(svg, 595, 376, '(mit Drahtbruchsicherheit:', 'm-label small', 'middle');
      txt(svg, 595, 392, 'alle Taster sind Öffner)', 'm-label small', 'middle');
    },
    render(logic, ax) {
      const L = logic as SchwestLogic;
      corridor.forEach((l, i) => l.classList.toggle('on', ((ax >> i) & 1) === 1));
      station.forEach((l, i) => l.classList.toggle('on', ((ax >> (3 + i)) & 1) === 1));
      beds.forEach((b, i) => { b.style.fill = L.waiting[i] ? '#ffd2d2' : ''; });
      sound.forEach((s) => s.classList.toggle('on', L.buzzer));
    },
  };
};

export const schwest: ExternalModelDef = {
  id: 'ext-schwest',
  name: 'Schwesternrufanlage',
  group: 'Modellpaket 1',
  desc: 'Drei Patientenzimmer rufen die Schwester: Flurlampe, Anzeige im Schwesternzimmer und Summer. Summer mit S3 quittieren, Ruf mit der Anwesenheitstaste im Zimmer löschen. Variante B: alle Taster sind Öffner.',
  ax: ['P1.1 Flurlampe Zimmer 1', 'P1.2 Flurlampe Zimmer 2', 'P1.3 Flurlampe Zimmer 3', 'P2.1 Anzeige Schwesternzimmer 1', 'P2.2 Anzeige Schwesternzimmer 2', 'P2.3 Anzeige Schwesternzimmer 3', 'P0 Summer', ''],
  ex: ['S1.1 Ruftaster Zimmer 1', 'S2.1 Anwesenheit Zimmer 1', 'S1.2 Ruftaster Zimmer 2', 'S2.2 Anwesenheit Zimmer 2', 'S1.3 Ruftaster Zimmer 3', 'S2.3 Anwesenheit Zimmer 3', 'S3 Quittieren Summer', ''],
  width: 720,
  height: 480,
  createLogic: () => new SchwestLogic(),
  createView: view,
};

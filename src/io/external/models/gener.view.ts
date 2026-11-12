import { el } from '../../kit.ts';
import type { ExternalModelDef, ModelView } from '../frame.ts';
import { GEN_KW, GEN_LIMIT, GenerLogic } from './gener.logic.ts';
import { label, lamp, panelSwitch } from './parts.ts';
import { blueMotor, faultButton, nBox, rect } from './p1.parts.ts';

const view = (): ModelView => {
  let motors: ReturnType<typeof blueMotor>[];
  let sensors: ReturnType<typeof nBox>[];
  let faults: ReturnType<typeof faultButton>[];
  let h1: SVGCircleElement;
  let bar: SVGRectElement;
  let loadText: SVGTextElement;
  return {
    mount(svg, logic) {
      const L = logic as GenerLogic;
      rect(svg, 0, 0, 720, 480, 'm-bg');
      // Generator (eigene Zeichnung)
      rect(svg, 60, 150, 260, 14, 'p1-mot-foot');
      rect(svg, 52, 66, 26, 84, 'p1-mot-cap', 6);
      rect(svg, 300, 66, 26, 84, 'p1-mot-cap', 6);
      rect(svg, 74, 52, 230, 98, 'p1-gen', 10);
      for (let i = 1; i < 6; i++) el('line', { x1: 74 + i * 38.3, y1: 54, x2: 74 + i * 38.3, y2: 148, class: 'p1-gen-rib' }, svg);
      rect(svg, 150, 34, 70, 20, 'p1-gen', 3);
      rect(svg, 36, 98, 16, 12, 'p1-shaft');
      rect(svg, 326, 98, 16, 12, 'p1-shaft');
      el('circle', { cx: 189, cy: 101, r: 22, class: 'm-panel' }, svg);
      label(svg, 189, 108, 'G', 'm-label', 'middle');
      // Lastanzeige
      rect(svg, 400, 24, 296, 112, 'm-panel', 10);
      label(svg, 548, 48, 'Modellvariante A', 'm-label', 'middle');
      label(svg, 548, 66, '(ohne Drahtbruchsicherheit)', 'm-label small', 'middle');
      rect(svg, 420, 84, 256, 16, 'm-tank', 3);
      bar = rect(svg, 421, 85, 0, 14, 'm-liquid', 2);
      el('line', { x1: 420 + (256 * GEN_LIMIT) / 17, y1: 78, x2: 420 + (256 * GEN_LIMIT) / 17, y2: 106, stroke: '#c0392b', 'stroke-width': 2 }, svg);
      loadText = label(svg, 548, 124, '', 'm-label small', 'middle');
      // Warnlampe
      rect(svg, 24, 270, 110, 70, 'm-panel', 10);
      h1 = lamp(svg, 54, 308, 'H1', 'Ax.0', 'red');
      label(svg, 96, 304, 'Überlast', 'm-label small');
      // vier Antriebe
      const xs = [296, 252, 208, 164];
      motors = []; sensors = []; faults = [];
      GEN_KW.forEach((kw, i) => {
        const y = 196 + i * 70;
        el('polyline', { points: `${xs[i]},164 ${xs[i]},${y + 30} 262,${y + 30}`, class: 'p1-wire', transform: 'translate(0 0)' }, svg);
        const sw = panelSwitch(svg, 262, y + 12, '', '', () => L.input(`m${i + 1}`, true));
        sw.querySelectorAll('text').forEach((t) => t.remove());
        motors.push(blueMotor(svg, 322, y));
        el('rect', { x: 418, y: y + 24, width: 22, height: 6, class: 'p1-shaft' }, svg);
        sensors.push(nBox(svg, 440, y + 13));
        label(svg, 484, y + 20, `S${i + 1} (Ex.${i})`, 'm-label small');
        label(svg, 484, y + 38, `M${i + 1} (${kw} kW)`, 'm-label small');
        const f = faultButton(svg, 600, y + 12, `Drahtbruch Drehzahlwächter S${i + 1} ein/aus`, () => L.input(`wb${i + 1}`, true));
        faults.push(f);
        label(svg, 640, y + 30, 'Draht-', 'm-io'); label(svg, 640, y + 40, 'bruch', 'm-io');
      });
    },
    render(logic, ax) {
      const L = logic as GenerLogic;
      L.motors.forEach((m, i) => motors[i]!.update(m.angle, m.speed > 0.05));
      sensors.forEach((s, i) => s.set(((L.ex >> i) & 1) === 1));
      faults.forEach((f, i) => f.set(L.broken[i]!));
      h1.classList.toggle('on', (ax & 1) === 1);
      bar.setAttribute('width', String((254 * Math.min(L.load, 17)) / 17));
      bar.style.fill = L.overload ? '#d93636' : '';
      loadText.textContent = `Last ${L.load} kW von ${GEN_LIMIT} kW zulässig`;
    },
  };
};

export const gener: ExternalModelDef = {
  id: 'ext-gener',
  name: 'Generatorüberwachung',
  group: 'Modellpaket 1',
  desc: 'Vier Motoren (2, 3, 5 und 7 kW) laufen am Generator (max. 10 kW). Drehzahlwächter melden laufende Motoren; bei Überlast soll die Warnlampe H1 leuchten. Variante A ohne Drahtbruchsicherheit.',
  ax: ['H1 Warnlampe Überlast', '', '', '', '', '', '', ''],
  ex: ['S1 Drehzahlwächter M1 (2 kW)', 'S2 Drehzahlwächter M2 (3 kW)', 'S3 Drehzahlwächter M3 (5 kW)', 'S4 Drehzahlwächter M4 (7 kW)', '', '', '', ''],
  width: 720,
  height: 480,
  createLogic: () => new GenerLogic(),
  createView: view,
};

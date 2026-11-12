import { el } from '../../kit.ts';
import type { ExternalModelDef, ModelView } from '../frame.ts';
import { LauflichtLogic } from './lauflicht.logic.ts';
import { lamp, panelButton } from './parts.ts';
import { rc, tx } from './p2.parts.ts';

const view = (): ModelView => {
  let r: { beacons: SVGGElement[]; lamps: SVGCircleElement[]; info: SVGTextElement };
  return {
    mount(svg, logic) {
      const L = logic as LauflichtLogic;
      rc(svg, 0, 0, 720, 460, 'm-bg');
      const defs = el('defs', {}, svg);
      const pat = el('pattern', { id: 'p2-stripes', width: 40, height: 40, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(-35)' }, defs);
      rc(pat, 0, 0, 40, 40, 'p2-stripe-white');
      rc(pat, 0, 0, 40, 20, 'p2-stripe-red');
      // Bedienfeld
      rc(svg, 14, 14, 300, 190, 'm-panel', 10);
      panelButton(svg, 28, 24, 'S0', 'EIN', 'm-btn-green', (d) => L.input('on', d), 'Ex.0');
      panelButton(svg, 170, 24, 'S0', 'AUS', 'm-btn-red', (d) => L.input('off', d), 'Ex.0');
      panelButton(svg, 28, 78, 'F', '◀ langsamer', 'm-btn-grey', (d) => L.input('slower', d), 'Ex.1–3');
      panelButton(svg, 170, 78, 'F', 'schneller ▶', 'm-btn-grey', (d) => L.input('faster', d), 'Ex.1–3');
      const lamps = [lamp(svg, 60, 160, 'F1 langsam', 'Ex.1', 'yellow'), lamp(svg, 160, 160, 'F2 mittel', 'Ex.2', 'yellow'), lamp(svg, 260, 160, 'F3 schnell', 'Ex.3', 'yellow')];
      const info = tx(svg, 340, 40, '', 'm-label');
      // Warnbaken
      const beacons = Array.from({ length: 6 }, (_, i) => {
        const x = 40 + i * 110, y = 250;
        const g = el('g', { class: 'p2-beacon' }, svg);
        rc(g, x + 20, y + 40, 20, 120, 'p2-post');
        rc(g, x, y + 40, 60, 110, 'p2-striped');
        rc(g, x - 4, y + 150, 68, 14, 'p2-foot', 2);
        rc(g, x + 6, y + 18, 48, 22, 'p2-cap', 6);
        el('circle', { cx: x + 30, cy: y, r: 26, class: 'p2-lens' }, g);
        el('path', { d: `M${x + 8} ${y - 18} L${x + 52} ${y + 18} M${x + 52} ${y - 18} L${x + 8} ${y + 18}`, class: 'p2-lens-grid' }, g);
        tx(g, x + 30, y + 35, `H${i + 1}`, 'm-label small', 'middle');
        tx(g, x + 30, y + 185, `Ax.${i}`, 'm-io', 'middle');
        return g;
      });
      r = { beacons, lamps, info };
    },
    render(logic) {
      const L = logic as LauflichtLogic;
      r.beacons.forEach((b, i) => b.classList.toggle('on', ((L.lamps >> i) & 1) === 1));
      r.lamps.forEach((l, i) => l.classList.toggle('on', L.speed === i + 1));
      r.info.textContent = L.on ? 'Schalter: EIN' : 'Schalter: AUS';
    },
  };
};

export const lauflicht: ExternalModelDef = {
  id: 'ext-lauflicht',
  name: 'Verkehrslauflicht',
  group: 'Modellpaket 2',
  desc: 'Sechs Warnleuchten einer Baustellenabsperrung sollen als Lauflicht von H1 nach H6 laufen. Das Bedienfeld schaltet EIN/AUS und wählt eine von drei Geschwindigkeiten (F1 langsam … F3 schnell).',
  ax: ['H1 Warnleuchte 1', 'H2 Warnleuchte 2', 'H3 Warnleuchte 3', 'H4 Warnleuchte 4', 'H5 Warnleuchte 5', 'H6 Warnleuchte 6', '', ''],
  ex: ['S0 Schalter EIN/AUS (EIN = 1)', 'F1 Geschwindigkeit langsam', 'F2 Geschwindigkeit mittel', 'F3 Geschwindigkeit schnell', '', '', '', ''],
  width: 720,
  height: 460,
  createLogic: () => new LauflichtLogic(),
  createView: view,
};

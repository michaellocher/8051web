import { el } from '../../kit.ts';
import type { ExternalModelDef, ModelView } from '../frame.ts';
import { SchiebetorLogic } from './schiebetor.logic.ts';
import { lamp, motorSymbol, panelButton, panelSwitch } from './parts.ts';
import { ln, rc } from './p2.parts.ts';

const GX = 150, TRAVEL = 280, GW = 270, GY = 250, GH = 150;

const view = (): ModelView => {
  let r: { leaf: SVGGElement; person: SVGGElement; motor: ReturnType<typeof motorSymbol>; lamps: Record<string, SVGCircleElement>; warn: SVGCircleElement };
  return {
    mount(svg, logic) {
      const L = logic as SchiebetorLogic;
      rc(svg, 0, 0, 720, 460, 'm-bg');
      // Bedienfeld
      rc(svg, 14, 14, 300, 126, 'm-panel', 10);
      panelButton(svg, 28, 24, 'S2', 'Schließen', 'm-btn-blue', (d) => L.input('close', d), 'Ex.1');
      panelButton(svg, 28, 76, 'S4', 'Öffnen', 'm-btn-blue', (d) => L.input('open', d), 'Ex.3');
      panelButton(svg, 170, 24, 'S1', 'STOP', 'm-btn-red', (d) => L.input('stop', d), 'Ex.0');
      panelSwitch(svg, 170, 78, 'S6', 'Hindernis', (on) => L.input('obstacle', on), 'Ex.5');
      // Boden, Pfeiler, Schiene
      rc(svg, 0, 412, 720, 48, 'p2-ground-soft');
      rc(svg, 128, GY - 10, 22, GH + 10, 'p2-pillar');
      rc(svg, 410, GY - 10, 22, GH + 10, 'p2-pillar');
      rc(svg, 128, 400, 580, 10, 'm-steel');
      // Torflügel
      const leaf = el('g', { transform: `translate(${GX} 0)` }, svg);
      rc(leaf, 0, GY, GW, GH, 'p2-gate', 2);
      for (let x = 12; x < GW; x += 12) ln(leaf, x, GY + 4, x, GY + GH - 4, 'p2-slat');
      rc(leaf, 0, GY + GH - 14, GW, 6, 'p2-gate-rail');
      // Lichtschranke und Person
      ln(svg, 70, 425, 480, 425, 'p2-beam');
      rc(svg, 60, 415, 12, 20, 'p2-sensor', 2);
      rc(svg, 478, 415, 12, 20, 'p2-sensor', 2);
      const person = el('g', { transform: 'translate(285 0)' }, svg);
      el('circle', { cx: 0, cy: 368, r: 8, class: 'p2-person' }, person);
      rc(person, -9, 378, 18, 34, 'p2-person', 4);
      // Motor und Meldelampen
      const motor = motorSymbol(svg, 660, 436, 'M', '', 14);
      const lamps = {
        h1: lamp(svg, 139, 222, 'H1 offen', 'Ax.0'), h2: lamp(svg, 421, 222, 'H2 zu', 'Ax.1'),
        k1: lamp(svg, 540, 440, 'K1 ←', 'Ax.3'), k2: lamp(svg, 590, 440, 'K2 →', 'Ax.4'),
        s3: lamp(svg, 110, 440, 'S3 zu', 'Ex.2'), s5: lamp(svg, 190, 440, 'S5 offen', 'Ex.4'),
        s6: lamp(svg, 370, 440, 'S6 Hindernis', 'Ex.5', 'red'),
      };
      const warn = lamp(svg, 520, 60, 'H3 Warnleuchte', 'Ax.2', 'red');
      r = { leaf, person, motor, lamps, warn };
    },
    render(logic) {
      const L = logic as SchiebetorLogic;
      r.leaf.setAttribute('transform', `translate(${GX + L.pos * TRAVEL} 0)`);
      r.person.style.display = L.obstacle ? '' : 'none';
      r.motor.update(L.dir !== 0, L.pos * 4000);
      const ex = L.ex;
      r.lamps['h1']!.classList.toggle('on', L.h1);
      r.lamps['h2']!.classList.toggle('on', L.h2);
      r.lamps['k1']!.classList.toggle('on', L.dir < 0);
      r.lamps['k2']!.classList.toggle('on', L.dir > 0);
      r.lamps['s3']!.classList.toggle('on', ((ex >> 2) & 1) === 1);
      r.lamps['s5']!.classList.toggle('on', ((ex >> 4) & 1) === 1);
      r.lamps['s6']!.classList.toggle('on', ((ex >> 5) & 1) === 1);
      r.warn.classList.toggle('on', L.h3);
    },
  };
};

export const schiebetor: ExternalModelDef = {
  id: 'ext-schiebetor',
  name: 'Schiebetorsteuerung',
  group: 'Modellpaket 2',
  desc: 'Ein Motor fährt das Schiebetor nach rechts (öffnen, K2) oder links (schließen, K1) bis zu den Endschaltern. Eine Lichtschranke überwacht die Durchfahrt: Beim Schließen muss das Tor bei Hindernis stoppen bzw. wieder öffnen.',
  ax: ['H1 Meldelampe Tor offen', 'H2 Meldelampe Tor geschlossen', 'H3 Warnleuchte', 'K1 Motor Schließen (←)', 'K2 Motor Öffnen (→)', '', '', ''],
  ex: ['S1 Taster STOP', 'S2 Taster Schließen', 'S3 Endschalter Tor geschlossen', 'S4 Taster Öffnen', 'S5 Endschalter Tor offen', 'S6 Lichtschranke unterbrochen', '', ''],
  width: 720,
  height: 460,
  createLogic: () => new SchiebetorLogic(),
  createView: view,
};

import { el } from '../../kit.ts';
import type { ExternalModelDef, ModelView } from '../frame.ts';
import { Foerder2Logic } from './foerder2.logic.ts';
import { lamp, panelButton, panelSwitch } from './parts.ts';
import { ln, rc, tx } from './p2.parts.ts';
import { belt, msgBox, warnTriangle } from './p3.parts.ts';

const B1 = { x: 20, y: 170, w: 210 }, B2 = { x: 250, y: 170, w: 210 }, B3 = { x: 20, y: 318, w: 440 };
const BH = 26;

const view = (): ModelView => {
  let r: {
    belts: ReturnType<typeof belt>[]; mat: SVGRectElement[]; drop: SVGLineElement[]; heap: SVGPathElement; msgs: ReturnType<typeof msgBox>;
    h1: SVGCircleElement; h2: SVGCircleElement; beacon: SVGPathElement; mat3: SVGRectElement; lastErr: number;
  };
  return {
    mount(svg, logic) {
      const L = logic as Foerder2Logic;
      rc(svg, 0, 0, 720, 460, 'm-bg');
      // Vorratstrichter
      for (const x of [50, 360]) {
        el('path', { d: `M${x} 50 H${x + 90} L${x + 56} 140 H${x + 34} Z`, class: 'p3-grain' }, svg);
        rc(svg, x + 34, 140, 22, 20, 'p3-grain');
      }
      // Bänder und Gut
      const belts = [belt(svg, B1.x, B1.y, B1.w, BH), belt(svg, B2.x, B2.y, B2.w, BH), belt(svg, B3.x, B3.y, B3.w, BH)];
      const mat = [rc(svg, B1.x + 14, B1.y - 8, 0, 8, 'p3-grain', 2), rc(svg, B2.x + B2.w - 14, B2.y - 8, 0, 8, 'p3-grain', 2)];
      const mat3 = rc(svg, B1.x + 14, B3.y - 8, 0, 8, 'p3-grain', 2);
      const drop = [
        el('line', { x1: B1.x + B1.w - 8, y1: B1.y + BH, x2: B1.x + B1.w - 8, y2: B3.y - 2, class: 'p3-stream grain' }, svg),
        el('line', { x1: B2.x + 8, y1: B2.y + BH, x2: B2.x + 8, y2: B3.y - 2, class: 'p3-stream grain' }, svg),
      ];
      const heap = el('path', { d: '', class: 'p3-grain' }, svg);
      // Beschriftung der Bänder
      tx(svg, B1.x, B1.y + BH + 18, 'M1  Ax.0', 'm-label small');
      tx(svg, B2.x + B2.w, B2.y + BH + 18, 'M2  Ax.1', 'm-label small', 'end');
      tx(svg, B3.x + B3.w, B3.y + BH + 18, 'M3  Ax.2', 'm-label small', 'end');
      // Bedienung M1, M2, M3
      panelButton(svg, 20, 230, 'S1', 'M1 Start', 'm-btn-green', (d) => L.input('s1', d), 'Ex.0');
      panelButton(svg, 20, 276, 'S2', 'M1 Stop', 'm-btn-red', (d) => L.input('s2', d), 'Ex.1');
      panelButton(svg, 250, 230, 'S3', 'M2 Start', 'm-btn-green', (d) => L.input('s3', d), 'Ex.2');
      panelButton(svg, 250, 276, 'S4', 'M2 Stop', 'm-btn-red', (d) => L.input('s4', d), 'Ex.3');
      panelButton(svg, 20, 372, 'S5', 'M3 Start', 'm-btn-green', (d) => L.input('s5', d), 'Ex.4');
      panelButton(svg, 20, 416, 'S6', 'M3 Stop', 'm-btn-red', (d) => L.input('s6', d), 'Ex.5');
      rc(svg, 190, 368, 170, 84, 'm-panel', 10);
      panelSwitch(svg, 200, 372, 'S8', 'Automatik', (on) => L.input('s8', on), 'Ex.7');
      panelSwitch(svg, 200, 412, 'S7', 'NOT-AUS', (on) => L.input('s7', on), 'Ex.6');
      const h2 = lamp(svg, 400, 400, 'H2 Auto', 'Ax.4', 'green');
      // Rundumleuchte H1
      const beacon = el('path', { d: 'M232 60 a16 16 0 0 1 32 0 v10 h-32 Z', class: 'p3-beacon' }, svg);
      rc(svg, 228, 70, 40, 8, 'p3-metal-dark', 2);
      tx(svg, 248, 36, 'H1 RUN', 'm-label small', 'middle');
      tx(svg, 248, 94, 'Ax.3', 'm-io', 'middle');
      const h1 = h2; // Platzhalter, H1 = Rundumleuchte
      // Fehlermeldungen
      warnTriangle(svg, 506, 40, 1);
      tx(svg, 530, 46, 'Fehlermeldungen', 'm-label');
      const msgs = msgBox(svg, 486, 62, 224, 300);
      panelButton(svg, 560, 372, '', 'Meldungen löschen', 'm-btn-grey', (d) => L.input('clear', d), '', 150);
      ln(svg, 486, 366, 486, 366, 'p3-tick');
      r = { belts, mat, drop, heap, msgs, h1, h2, beacon, mat3, lastErr: -1 };
    },
    render(logic) {
      const L = logic as Foerder2Logic;
      r.belts.forEach((b, i) => b.update((i === 1 ? -1 : 1) * L.m[i]!.angle * 2.2));
      // Gut auf M1/M2
      const w1 = L.front[0]! * (B1.w - 28), w2 = L.front[1]! * (B2.w - 28);
      r.mat[0]!.setAttribute('width', String(w1));
      r.mat[1]!.setAttribute('x', String(B2.x + B2.w - 14 - w2)); r.mat[1]!.setAttribute('width', String(w2));
      r.drop[0]!.style.display = L.front[0]! >= 1 && L.m[0].speed > 0.3 ? '' : 'none';
      r.drop[1]!.style.display = L.front[1]! >= 1 && L.m[1].speed > 0.3 ? '' : 'none';
      r.drop[0]!.setAttribute('y2', String(B3.y - 2 - L.pile * 40)); r.drop[1]!.setAttribute('y2', String(B3.y - 2 - L.pile * 40));
      r.mat3.setAttribute('width', String(L.feeding || L.m[2].speed > 0.3 && L.delivered > 0 ? (L.m[2].speed > 0.3 ? B3.w - 28 : 0) : 0));
      const ph = L.pile * 46, cx = (B1.x + B1.w + B2.x) / 2;
      r.heap.setAttribute('d', L.pile > 0.02 ? `M${cx - 30 * L.pile - 14} ${B3.y} Q${cx} ${B3.y - ph * 1.6} ${cx + 30 * L.pile + 14} ${B3.y} Z` : '');
      r.msgs.set(L.errors);
      r.beacon.classList.toggle('on', L.h1);
      r.h2.classList.toggle('on', L.h2);
    },
  };
};

export const foerder2: ExternalModelDef = {
  id: 'ext-foerder2',
  name: 'Förderanlage II',
  group: 'Modellpaket 2',
  desc: 'Zwei Zubringerbänder M1/M2 fördern auf das Sammelband M3 (immer M3 zuerst starten, zuletzt stoppen). Hand- und Automatikbetrieb (S8), NOT-AUS (S7), Fehlerliste im Modellfenster. Modellvariante A: Schließer.',
  ax: ['M1 Zubringerband 1', 'M2 Zubringerband 2', 'M3 Sammelband', 'H1 Meldeleuchte RUN', 'H2 Meldeleuchte Automatik', '', '', ''],
  ex: ['S1 Taster Start M1', 'S2 Taster Stop M1', 'S3 Taster Start M2', 'S4 Taster Stop M2', 'S5 Taster Start M3', 'S6 Taster Stop M3', 'S7 NOT-AUS', 'S8 Schalter Hand/Automatik'],
  width: 720,
  height: 460,
  createLogic: () => new Foerder2Logic(),
  createView: view,
};

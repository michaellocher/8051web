import { el } from '../../kit.ts';
import type { ExternalModelDef, ModelView } from '../frame.ts';
import { SiebenLogic } from './sieben.logic.ts';
import { rc, tx } from './p2.parts.ts';

const T = 26;
const hseg = (x: number, y: number, len = 120) =>
  `M${x + 12} ${y} H${x + len - 12} L${x + len} ${y + T / 2} L${x + len - 12} ${y + T} H${x + 12} L${x} ${y + T / 2} Z`;
const vseg = (x: number, y0: number, y1: number) =>
  `M${x + T / 2} ${y0} L${x + T} ${y0 + 12} V${y1 - 12} L${x + T / 2} ${y1} L${x} ${y1 - 12} V${y0 + 12} Z`;

const view = (): ModelView => {
  let r: { segs: SVGPathElement[]; keys: SVGGElement[]; value: SVGTextElement };
  return {
    mount(svg, logic) {
      const L = logic as SiebenLogic;
      rc(svg, 0, 0, 720, 460, 'm-bg');
      // BCD-Schalter
      rc(svg, 20, 110, 340, 190, 'm-panel', 14);
      tx(svg, 190, 140, 'BCD-Code', 'p4-title', 'middle');
      const keys = [3, 2, 1, 0].map((b, i) => {
        const x = 40 + i * 78;
        const g = el('g', { class: 'p4-key', transform: `translate(${x} 156)`, tabindex: 0, role: 'switch', 'aria-checked': 'false', 'aria-label': `S${b + 1} Wert ${1 << b}` }, svg);
        rc(g, 0, 0, 62, 62, 'p4-key-face', 8);
        tx(g, 31, 43, String(1 << b), 'p4-key-num', 'middle');
        tx(g, 31, 84, `S${b + 1}`, 'm-label small', 'middle');
        tx(g, 31, 97, `Ex.${b}`, 'm-io', 'middle');
        let on = false;
        const flip = () => {
          on = !on; g.classList.toggle('on', on); g.setAttribute('aria-checked', String(on)); L.input(`s${b + 1}`, on);
        };
        g.addEventListener('click', flip);
        g.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); } });
        return g;
      });
      const value = tx(svg, 190, 284, '', 'm-label', 'middle');
      // Anzeige
      rc(svg, 440, 16, 260, 428, 'p4-display', 10);
      const ox = 487, oy = 60;
      const paths = [
        hseg(ox + 20, oy), vseg(ox + 140, oy + 30, oy + 146), vseg(ox + 140, oy + 180, oy + 296),
        hseg(ox + 20, oy + 300), vseg(ox, oy + 180, oy + 296), vseg(ox, oy + 30, oy + 146), hseg(ox + 20, oy + 150),
      ];
      const segs = paths.map((d) => el('path', { d, class: 'p4-seg' }, svg));
      const label = (cx: number, cy: number, name: string, io: string) => {
        rc(svg, cx - 24, cy - 17, 48, 34, 'p4-tag', 4);
        tx(svg, cx, cy - 2, name, 'p4-tag-name', 'middle');
        tx(svg, cx, cy + 12, io, 'p4-tag-io', 'middle');
      };
      label(ox + 83, 36, 'A', 'Ax.0');
      label(ox + 166 + 30, oy + 90, 'B', 'Ax.1');
      label(ox + 166 + 30, oy + 240, 'C', 'Ax.2');
      label(ox + 83, 428, 'D', 'Ax.3');
      label(ox - 30, oy + 240, 'E', 'Ax.4');
      label(ox - 30, oy + 90, 'F', 'Ax.5');
      label(ox + 83, oy + 90, 'G', 'Ax.6');
      r = { segs, keys, value };
    },
    render(logic) {
      const L = logic as SiebenLogic;
      r.segs.forEach((s, i) => s.classList.toggle('on', (L.seg >> i & 1) === 1));
      r.value.textContent = `Wert: ${L.value}`;
    },
  };
};

export const sieben: ExternalModelDef = {
  id: 'ext-sieben',
  name: 'Sieben-Segment-Anzeige',
  group: 'Modellpaket 2',
  desc: 'Vier BCD-Schalter (Ex.0–3, Wertigkeit 1/2/4/8) liefern eine Zahl, die das Programm decodiert und auf den sieben Segmenten A–G (Ax.0–6) anzeigt. Das Modell prüft, ob die Anzeige zur Schalterstellung passt.',
  ax: ['A Segment oben', 'B Segment oben rechts', 'C Segment unten rechts', 'D Segment unten', 'E Segment unten links', 'F Segment oben links', 'G Segment Mitte', ''],
  ex: ['S1 BCD-Schalter Wert 1', 'S2 BCD-Schalter Wert 2', 'S3 BCD-Schalter Wert 4', 'S4 BCD-Schalter Wert 8', '', '', '', ''],
  width: 720,
  height: 460,
  createLogic: () => new SiebenLogic(),
  createView: view,
};

/** GRAY-Geber (Winkelcodierer) und GRAY-Aktor (Motor mit Positionsmeldung). */
import { board, el, rowY, setLit, wire, type DeviceDef } from '../kit.ts';
import { annulusSector, label } from './b2util.ts';
import { GRAY_STEPS, GrayActuator, GraySensor, STEP_DEG, toGray } from './gray.logic.ts';

const CX = 134, CY = 80, R = 60, RING = 11;

/** Zeichnet die Gray-Scheibe (äußerster Ring = D0 … innerster = D3, weiß = 1; Beschriftung 0–F) und gibt die Zeigergruppe zurück */
function drawDisc(svg: SVGSVGElement, needleClass: string) {
  el('circle', { cx: CX, cy: CY, r: R + 1, class: 'b2-disc-bg b2-gray-bg' }, svg);
  for (let bit = 0; bit < 4; bit++) {
    const r1 = R - bit * RING, r0 = r1 - RING;
    for (let p = 0; p < GRAY_STEPS; p++) {
      if (((toGray(p) >> bit) & 1) === 0) el('path', { d: annulusSector(CX, CY, r0, r1, p * STEP_DEG - STEP_DEG / 2, p * STEP_DEG + STEP_DEG / 2), class: 'b2-disc-on' }, svg);
    }
  }
  for (let p = 0; p < GRAY_STEPS; p++) {
    const t = (p * STEP_DEG * Math.PI) / 180;
    label(svg, CX + Math.sin(t) * (R + 9), CY - Math.cos(t) * (R + 9) + 3, p.toString(16).toUpperCase(), 'dev-tiny', 'middle');
  }
  const needle = el('g', {}, svg);
  el('line', { x1: CX, y1: CY, x2: CX, y2: CY - R, class: needleClass }, needle);
  el('circle', { cx: CX, cy: CY, r: 5, class: needleClass + '-hub' }, needle);
  return needle;
}

const setAngle = (g: SVGElement, deg: number) => g.setAttribute('transform', `rotate(${deg.toFixed(2)} ${CX} ${CY})`);

const graysensor: DeviceDef = {
  id: 'graysensor', name: 'GRAY-Geber', group: 'Sensoren & Aktoren', ports: 1, width: 212,
  desc: 'Winkelcodierer mit 4-Bit-GRAY-Code: D0–D3 (Px.0–Px.3) = Gray-Code der Zeigerposition (0–F), ein weißes Feld liefert 1, ein schwarzes 0; der äußerste Ring liefert D0, der innerste D3. D4–D7 sind nicht belegt (1). Zeiger mit dem Mausrad drehen (oder ziehen bzw. Pfeiltasten). Beispiel: Position 3 = 11110010b.',
  create(onInput) {
    const svg = board(212, 1, 'GRAY');
    const s = new GraySensor();
    const lamps: SVGElement[] = [];
    for (let i = 0; i < 8; i++) {
      wire(svg, i, 32, true);
      lamps.push(el('rect', { x: 9, y: rowY(i) - 5, width: 10, height: 10, rx: 2, class: 'dev-led red' }, svg));
      label(svg, 35, rowY(i) + 3, `D${i}`);
    }
    const needle = drawDisc(svg, 'b2-needle');
    const info = label(svg, CX, 157, '', 'dev-tiny', 'middle');
    const hit = el('circle', { cx: CX, cy: CY, r: R + 12, fill: 'transparent', class: 'b2-grab' }, svg);
    const toAngle = (e: PointerEvent) => {
      const m = svg.getScreenCTM();
      if (!m) return s.angle;
      const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
      return (Math.atan2(pt.x - CX, -(pt.y - CY)) * 180) / Math.PI;
    };
    const move = (e: PointerEvent) => { s.setAngle(toAngle(e)); onInput(); };
    hit.addEventListener('pointerdown', (e) => { try { hit.setPointerCapture(e.pointerId); } catch { /* synthetische Ereignisse */ } move(e); });
    hit.addEventListener('pointermove', (e) => { if (e.buttons & 1) move(e); });
    svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      s.rotate(e.deltaY > 0 ? 1 : -1);
      onInput();
    }, { passive: false });
    svg.setAttribute('tabindex', '0');
    svg.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); s.rotate(1); onInput(); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); s.rotate(-1); onInput(); }
    });
    return {
      svg,
      drive: () => s.pins(),
      sample() {},
      render() {
        setAngle(needle, s.angle);
        const v = s.pins();
        lamps.forEach((l, i) => setLit(l, (v >> i) & 1));
        info.textContent = `Pos ${s.position.toString(16).toUpperCase()} = ${v.toString(2).padStart(8, '0')}b`;
      },
    };
  },
};

const grayakt: DeviceDef = {
  id: 'grayakt', name: 'GRAY-Aktor', group: 'Sensoren & Aktoren', ports: 1, width: 212,
  desc: 'Motor mit Positionsmeldung durch 4-Bit-GRAY-Code: D0–D3 (Px.0–Px.3, Ausgänge zum Port) = Gray-Code der Zeigerposition, weiß = 1, der äußerste Ring liefert D0. D4/D5 (Eingänge vom Port) steuern den Motor: D4 = 1, D5 = 0 Rechtslauf; D4 = 0, D5 = 1 Linkslauf; 00 und 11 Motor aus. D6/D7 sind nicht belegt. Die Drehung wird mit simulierter Zeit berechnet (90 °/s).',
  create() {
    const svg = board(212, 1, 'Aktor');
    const a = new GrayActuator();
    for (let i = 0; i < 6; i++) { wire(svg, i, 32, i < 4); label(svg, 35, rowY(i) + 3, i < 4 ? `D${i}` : i === 4 ? 'D4 rechts' : 'D5 links'); }
    const needle = drawDisc(svg, 'b2-needle');
    const info = label(svg, CX, 157, '', 'dev-tiny', 'middle');
    const mot = label(svg, 8, rowY(7) + 3, '', 'dev-tiny');
    return {
      svg,
      drive: () => a.inputs(),
      sample([p = 0xff], cycles) { a.advance(p, cycles); },
      render() {
        setAngle(needle, a.angle);
        mot.textContent = a.direction === 0 ? 'Motor aus' : a.direction > 0 ? 'Rechtslauf' : 'Linkslauf';
        info.textContent = `Pos ${a.position.toString(16).toUpperCase()}`;
      },
    };
  },
};

export const GRAY_DEVICES: readonly DeviceDef[] = [graysensor, grayakt];

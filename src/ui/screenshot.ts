/**
 * „Bildschirm kopieren": Ausschnitt der Oberfläche aufziehen und als Bild in die Zwischenablage legen.
 * Nutzt die Bildschirmaufnahme des Browsers (der Browser fragt einmal nach Erlaubnis).
 */
import { $ } from './dom.ts';

export async function copyScreenRegion(): Promise<string> {
  if (!navigator.mediaDevices?.getDisplayMedia || !('ClipboardItem' in window)) {
    return 'Dieser Browser unterstützt keine Bildschirmaufnahme – bitte das Bildschirmfoto des Systems verwenden.';
  }
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { displaySurface: 'browser' },
    audio: false,
    preferCurrentTab: true,
  } as DisplayMediaStreamOptions);
  let frame: ImageBitmap;
  try {
    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    await new Promise((r) => requestAnimationFrame(r));
    frame = await createImageBitmap(video);
  } finally {
    for (const t of stream.getTracks()) t.stop();
  }

  const overlay = $('[data-shot]');
  const canvas = $<HTMLCanvasElement>('[data-shot-canvas]');
  const rectEl = $('[data-shot-rect]');
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  canvas.getContext('2d')!.drawImage(frame, 0, 0, innerWidth, innerHeight);
  overlay.hidden = false;
  rectEl.hidden = true;

  const sel = await new Promise<DOMRect | undefined>((resolve) => {
    let start: { x: number; y: number } | undefined;
    const done = (r: DOMRect | undefined) => {
      overlay.removeEventListener('pointerdown', down);
      overlay.removeEventListener('pointermove', move);
      overlay.removeEventListener('pointerup', up);
      removeEventListener('keydown', key, true);
      overlay.hidden = true;
      resolve(r);
    };
    const rect = (e: PointerEvent) => new DOMRect(Math.min(start!.x, e.clientX), Math.min(start!.y, e.clientY), Math.abs(e.clientX - start!.x), Math.abs(e.clientY - start!.y));
    const down = (e: PointerEvent) => { start = { x: e.clientX, y: e.clientY }; overlay.setPointerCapture(e.pointerId); };
    const move = (e: PointerEvent) => {
      if (!start) return;
      const r = rect(e);
      Object.assign(rectEl.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.width}px`, height: `${r.height}px` });
      rectEl.hidden = false;
    };
    const up = (e: PointerEvent) => { if (start) done(rect(e)); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); done(undefined); } };
    overlay.addEventListener('pointerdown', down);
    overlay.addEventListener('pointermove', move);
    overlay.addEventListener('pointerup', up);
    addEventListener('keydown', key, true);
  });
  if (!sel || sel.width < 4 || sel.height < 4) return 'Bildschirm kopieren abgebrochen.';

  const sx = frame.width / innerWidth, sy = frame.height / innerHeight;
  const out = new OffscreenCanvas(Math.round(sel.width * sx), Math.round(sel.height * sy));
  out.getContext('2d')!.drawImage(frame, sel.x * sx, sel.y * sy, sel.width * sx, sel.height * sy, 0, 0, out.width, out.height);
  const blob = await out.convertToBlob({ type: 'image/png' });
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
  return `Ausschnitt (${out.width} × ${out.height} Pixel) in die Zwischenablage kopiert.`;
}

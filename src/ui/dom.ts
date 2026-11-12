/** Kleine DOM-Helfer */

export function $<T extends Element = HTMLElement>(sel: string, root: ParentNode = document): T {
  const e = root.querySelector<T>(sel);
  if (!e) throw new Error(`Element ${sel} fehlt`);
  return e;
}
export const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document): T[] =>
  [...root.querySelectorAll<T>(sel)];

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<Record<string, string>> & { class?: string; text?: string } = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else e.setAttribute(k, v);
  }
  e.append(...children);
  return e;
}

export const isVisible = (e: Element | null | undefined): e is HTMLElement =>
  !!e && e.checkVisibility({ visibilityProperty: true });

/** Liest die Zeilenhöhe aus der CSS-Variable --row (Pixel). */
export function rowHeight(el: Element, extra = 0): number {
  const v = parseFloat(getComputedStyle(el).getPropertyValue('--row'));
  return (Number.isFinite(v) ? v : 17) + extra;
}

export function parseHexInput(s: string, max: number): number | undefined {
  const t = s.trim().replace(/h$/i, '').replace(/^0x/i, '');
  if (!/^[0-9a-f]+$/i.test(t)) return undefined;
  const v = parseInt(t, 16);
  return v <= max ? v : undefined;
}

/** Inline-Editor über einem Element; liefert den eingegebenen Text oder undefined bei Abbruch. */
export function inlineEdit(target: HTMLElement, initial: string, maxLen: number): Promise<string | undefined> {
  const { promise, resolve } = Promise.withResolvers<string | undefined>();
  const r = target.getBoundingClientRect();
  const input = h('input', { class: 'reg-input floating', value: initial, maxlength: String(maxLen), spellcheck: 'false' });
  Object.assign(input.style, {
    position: 'fixed', left: `${r.left - 2}px`, top: `${r.top - 2}px`,
    width: `${Math.max(r.width + 4, 40)}px`, height: `${r.height + 4}px`, zIndex: '80',
  });
  document.body.append(input);
  input.select();
  let done = false;
  const finish = (v: string | undefined) => {
    if (done) return;
    done = true;
    input.remove();
    resolve(v);
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') finish(input.value);
    else if (e.key === 'Escape') finish(undefined);
    e.stopPropagation();
  });
  input.addEventListener('blur', () => finish(input.value));
  return promise;
}

export function download(name: string, text: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

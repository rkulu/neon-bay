// input.js — keyboard and mouse state. Taps are tracked in a separate
// "hits" set so a fast press is never lost between frames: keydown records
// the hit, keyup only releases the held key, and the frame loop clears
// hits after the game has read them. pressed() consumes one hit.
export function makeInput(canvas) {
  const input = {
    keys: new Set(),
    hits: new Set(),
    mouse: { x: 0, y: 0, down: false, click: false },
    pressed(code) {
      if (!this.hits.has(code)) return false;
      this.hits.delete(code);
      return true;
    },
    clearHits() {
      this.hits.clear();
      this.mouse.click = false;
    },
  };
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    input.keys.add(e.code);
    input.hits.add(e.code);
  });
  window.addEventListener('keyup', (e) => input.keys.delete(e.code));
  window.addEventListener('blur', () => { input.keys.clear(); input.hits.clear(); });
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouse.x = e.clientX - r.left;
    input.mouse.y = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouse.x = e.clientX - r.left;
    input.mouse.y = e.clientY - r.top;
    input.mouse.down = true;
    input.mouse.click = true;
  });
  window.addEventListener('mouseup', () => { input.mouse.down = false; });
  return input;
}

// A do-nothing input used to settle staged screenshot scenes.
export function makeDummyInput() {
  return {
    keys: new Set(),
    mouse: { x: 640, y: 300, down: false, click: false },
    pressed() { return false; },
    clearHits() {},
  };
}

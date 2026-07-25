import { describe, it, expect } from 'vitest';
import { placeWindow } from './windowShell.js';

// A floating window should sit beside what you clicked, never on top of it, and
// never off screen — that's the whole job.
const size = { width: 340, height: 300 };
const view = { width: 1280, height: 800 };
const row = (x: number, y = 100) => ({ x, y, width: 200, height: 20 });

describe('placeWindow', () => {
  it('opens to the right when there is room', () => {
    expect(placeWindow(row(100), size, view)).toEqual({ x: 312, y: 100 });
  });

  it('flips to the left when the right side is too tight', () => {
    // Row ends at 1150: only 130px to the right, but 900px to the left.
    expect(placeWindow(row(950), size, view).x).toBe(950 - size.width - 12);
  });

  it('pins to the right edge when neither side fits', () => {
    const narrow = { width: 600, height: 800 };
    const { x } = placeWindow({ x: 20, y: 100, width: 560, height: 20 }, size, narrow);
    expect(x).toBe(narrow.width - size.width - 12);
    expect(x).toBeGreaterThanOrEqual(8);
  });

  it('keeps the whole window on screen vertically', () => {
    expect(placeWindow(row(100, 5), size, view).y).toBe(8); // too near the top
    expect(placeWindow(row(100, 780), size, view).y).toBe(view.height - size.height - 8);
  });

  it('falls back to the bottom-right corner with no anchor', () => {
    expect(placeWindow(null, size, view)).toEqual({
      x: view.width - size.width - 24,
      y: view.height - size.height - 24
    });
  });

  it('never places a window off screen, however small the viewport', () => {
    const tiny = { width: 320, height: 240 };
    for (const anchor of [null, row(0), row(300), row(160, 200)]) {
      const p = placeWindow(anchor, size, tiny);
      expect(p.x, JSON.stringify(anchor)).toBeGreaterThanOrEqual(8);
      expect(p.y, JSON.stringify(anchor)).toBeGreaterThanOrEqual(8);
    }
  });
});

import { registerReactTestLoader } from './test-support/react-loader.mjs';
import assert from 'node:assert/strict';
import { createElement, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { generateDungeon } from './generator-test-import.mjs';

// Exercise the actual React renderers without a browser or an additional test framework.
const hook = registerReactTestLoader();
try {
  const { default: Preview } = await import('../components/generator-preview-map.tsx');
  const { buildInkDrawing } = await import('../components/dungeon-map/drawing/geometry.ts');
  for (const style of ['castle', 'mine', 'cave', 'v1']) {
    const draft = generateDungeon({ version: style === 'v1' ? 'v1' : 'v2', style: style === 'v1' ? 'castle' : style,
      variant: 0, levels: 2, rooms: 6, seed: 'preview-rendering', name: 'Náhled',
      size: 'medium', corridors: 'winding', connections: 1, separateExit: true });
    const before = structuredClone(draft), floor = draft.floors[0];
    const known = new Set(floor.map.floors);
    const drawing = buildInkDrawing(floor.map, known, known, true, false);
    const hand = renderToStaticMarkup(createElement(Preview, { floor, appearance: 'hand-drawn' }));
    const classic = renderToStaticMarkup(createElement(Preview, { floor, appearance: 'classic' }));
    assert(hand.includes(`data-ink-theme="${style === 'v1' ? 'universal' : style}"`));
    assert(!classic.includes('data-ink-theme='));
    for (const { d } of drawing.walls) assert(hand.includes(`d="${d}"`), 'Preview must use the playing surface contours.');
    for (const markup of [hand, classic]) {
      assert.equal((markup.match(/data-map-floor=/g) || []).length, floor.map.floors.length);
      assert.equal((markup.match(/data-preview-room=/g) || []).length, floor.rooms.length);
      assert(markup.includes('data-map-stairs='));
      assert(markup.includes('data-map-access="entrance"'));
      assert(markup.includes('data-map-access="exit"'));
    }
    const pair = renderToStaticMarkup(createElement(Fragment, null,
      createElement(Preview, { floor, appearance: 'hand-drawn' }),
      createElement(Preview, { floor: draft.floors[1], appearance: 'hand-drawn' })));
    const clips = [...pair.matchAll(/<clipPath id="([^"]+)"/g)].map(match => match[1]);
    const grids = [...pair.matchAll(/<pattern id="([^"]+)"/g)].map(match => match[1]);
    assert.equal(new Set([...clips, ...grids]).size, 4, 'Concurrent previews need distinct SVG resource IDs.');
    assert.deepEqual(draft, before, 'Rendering must not alter a generated proposal.');
  }
  console.log('PASS: actual preview renderers match playing contours, preserve V1/V2 floors/labels/stairs/access and immutable drafts, with distinct SVG IDs.');
} finally { hook.deregister(); }

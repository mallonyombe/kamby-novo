import test from 'node:test';
import assert from 'node:assert/strict';
import { nextHeaderState } from '../frontend/header-scroll.js';

function run(positions, initial = { compact: false }) {
  const states = [];
  for (const scrollY of positions) {
    initial = nextHeaderState(initial, { scrollY, maxScrollY: 2000 });
    states.push(initial.visibleCompact);
  }
  return states;
}

test('the initial header stays expanded near the top and collapses once past the departure threshold', () => {
  assert.deepEqual(run([0, 1, 7, 15, 30, 47, 48, 80]), [false, false, false, false, false, false, true, true]);
});

test('small or large upward movements away from the top never expand the compact header', () => {
  assert.deepEqual(run([0, 60, 800, 795, 760, 400, 100, 49, 25, 9]), [false, true, true, true, true, true, true, true, true, true]);
});

test('reversals and touchpad jitter produce only one collapse until the actual top is reached', () => {
  const positions = [0, 60];
  for (let i = 0; i < 500; i++) positions.push(500, 499, 501, 475, 470, 520);
  const states = run([...positions, 20, 9, 8, 0]);
  assert.equal(states.filter((state, i) => i > 0 && state !== states[i - 1]).length, 2);
  assert.deepEqual(states.slice(-4), [true, true, false, false]);
});

test('the threshold gap prevents flicker around both the collapse and top positions', () => {
  assert.deepEqual(run([48, 47, 49, 46, 15, 9, 8, 9, 15, 8, 12, 47]), [true, true, true, true, true, true, false, false, false, false, false, false]);
});

test('search temporarily opens the header and closing it restores compact mode at the same depth', () => {
  let state = nextHeaderState({}, { scrollY: 700 });
  state = nextHeaderState(state, { scrollY: 700, searching: true });
  assert.equal(state.visibleCompact, false);
  assert.equal(state.compact, true);
  state = nextHeaderState(state, { scrollY: 680, searching: true });
  assert.equal(state.visibleCompact, false);
  state = nextHeaderState(state, { scrollY: 680, searching: false });
  assert.equal(state.visibleCompact, true);
});

test('search closed at the top remains expanded and a restored deep position starts compact', () => {
  const top = nextHeaderState({ compact: true }, { scrollY: 0, searching: false });
  assert.equal(top.visibleCompact, false);
  assert.equal(nextHeaderState({}, { scrollY: 500 }).visibleCompact, true);
});

test('elastic scrolling at the bottom stays compact and negative top overscroll stays expanded', () => {
  let state = nextHeaderState({}, { scrollY: 2100, maxScrollY: 2000 });
  assert.equal(state.visibleCompact, true);
  state = nextHeaderState(state, { scrollY: 1990, maxScrollY: 2000 });
  assert.equal(state.visibleCompact, true);
  state = nextHeaderState(state, { scrollY: -40 });
  assert.equal(state.visibleCompact, false);
  assert.equal(nextHeaderState(state, { scrollY: 5 }).visibleCompact, false);
});

test('a short page needs no compact state and invalid scroll samples preserve the existing state', () => {
  assert.equal(nextHeaderState({ compact: true }, { scrollY: 30, maxScrollY: 0 }).visibleCompact, false);
  assert.equal(nextHeaderState({ compact: true }, { scrollY: NaN }).visibleCompact, true);
});

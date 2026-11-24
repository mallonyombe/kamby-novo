import assert from 'node:assert/strict';
import test from 'node:test';
import {sellerDraft} from '../frontend/seller-draft.js';

test('interrupted shop setup resumes only for its owner and clears after completion', () => {
  const records = new Map();
  const storage = {
    getItem: key => records.get(key) ?? null,
    setItem: (key, value) => records.set(key, value),
    removeItem: key => records.delete(key)
  };
  const draft = sellerDraft('first', storage);
  assert.equal(draft.values, null);
  draft.save('Mercearia', '+258');
  assert.deepEqual(sellerDraft('first', storage).values, {name:'Mercearia', phone:'+258'});
  assert.equal(sellerDraft('second', storage).values, null);
  draft.clear();
  assert.equal(sellerDraft('first', storage).values, null);
});

test('unavailable storage keeps the current form usable', () => {
  const denied = {getItem(){throw Error()}, setItem(){throw Error()}, removeItem(){throw Error()}};
  const draft = sellerDraft('first', denied);
  draft.save('Casa', '');
  assert.deepEqual(draft.values, {name:'Casa', phone:''});
  draft.clear();
  assert.equal(draft.values, null);
});

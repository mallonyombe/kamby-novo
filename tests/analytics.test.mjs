import test from 'node:test';
import assert from 'node:assert/strict';
import { setAnalyticsAllowed, startAnalytics, trackAnalytics } from '../frontend/analytics.js';

test('analytics loads only on production after opt-in and stops on revoke', () => {
  const values = new Map();
  const scripts = [];
  globalThis.localStorage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  globalThis.location = { protocol: 'https:', hostname: 'preview.example', origin: 'https://preview.example' };
  globalThis.window = { addEventListener() {} };
  globalThis.document = { createElement: () => ({}), head: { append: tag => scripts.push(tag) } };

  startAnalytics();
  setAnalyticsAllowed(true);
  assert.equal(scripts.length, 0);

  setAnalyticsAllowed(false);
  location.hostname = 'kambymz.vercel.app';
  location.origin = 'https://' + location.hostname;
  trackAnalytics('view_item');
  assert.equal(scripts.length, 0);

  setAnalyticsAllowed(true);
  assert.equal(scripts.length, 1);
  assert.equal(window.dataLayer.find(row => row[0] === 'set')[1].page_location, location.origin + '/');
  trackAnalytics('view_item');
  trackAnalytics('unknown');
  setAnalyticsAllowed(false);
  trackAnalytics('whatsapp_contact');
  assert.deepEqual(window.dataLayer.filter(row => row[0] === 'event').map(row => row[1]), ['page_view', 'view_item']);
  assert.equal(window['ga-disable-G-XWTGWKM4XH'], true);
});

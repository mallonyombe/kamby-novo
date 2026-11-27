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

test('consent is configured before initialization, and a storage change revokes other tabs', () => {
  const values = new Map();
  const scripts = [];
  const cookies = [];
  let onStorage;
  globalThis.localStorage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  globalThis.location = { protocol: 'https:', hostname: 'kambymz.vercel.app', origin: 'https://kambymz.vercel.app' };
  globalThis.window = { addEventListener(type, listener) { if (type === 'storage') onStorage = listener; } };
  globalThis.document = {
    createElement: () => ({}),
    head: { append: tag => scripts.push(tag) },
    set cookie(value) { cookies.push(value); }
  };

  startAnalytics();
  assert.equal(scripts.length, 0);
  assert.equal(window.dataLayer, undefined);
  assert.equal(window['ga-disable-G-XWTGWKM4XH'], true);

  setAnalyticsAllowed(true);
  assert.equal(scripts.length, 1);
  const [defaultConsent, grantedConsent, initialize] = window.dataLayer;
  assert.deepEqual(Array.from(defaultConsent).slice(0, 2), ['consent', 'default']);
  assert.equal(defaultConsent[2].analytics_storage, 'denied');
  assert.deepEqual(Array.from(grantedConsent).slice(0, 2), ['consent', 'update']);
  assert.deepEqual(grantedConsent[2], {
    analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied'
  });
  assert.equal(initialize[0], 'js');
  const configuration = window.dataLayer.find(row => row[0] === 'config')[2];
  assert.equal(configuration.cookie_flags, 'SameSite=Lax;Secure');
  assert.equal(configuration.cookie_expires, 2_592_000);
  assert.equal(configuration.cookie_update, false);

  cookies.length = 0;
  values.set('kamby:analytics', 'deny');
  onStorage({ key: 'kamby:analytics' });
  assert.equal(window['ga-disable-G-XWTGWKM4XH'], true);
  assert.deepEqual(new Set(cookies.map(value => value.split('=')[0])), new Set(['_ga', '_ga_XWTGWKM4XH']));
  assert.ok(cookies.every(value => value.includes('Max-Age=0')));
  const commandCount = window.dataLayer.length;
  trackAnalytics('view_store');
  assert.equal(window.dataLayer.length, commandCount);
});

test('a failed write when withdrawing consent still disables the tag in the current tab', () => {
  const values = new Map();
  let readOnly = false;
  globalThis.localStorage = {
    getItem: key => values.get(key),
    setItem(key, value) {
      if (readOnly) throw new Error('storage unavailable');
      values.set(key, value);
    }
  };
  globalThis.location = { protocol: 'https:', hostname: 'kambymz.vercel.app', origin: 'https://kambymz.vercel.app' };
  globalThis.window = { addEventListener() {} };
  globalThis.document = { createElement: () => ({}), head: { append() {} } };

  setAnalyticsAllowed(true);
  readOnly = true;
  assert.throws(() => setAnalyticsAllowed(false), /storage unavailable/);
  assert.equal(values.get('kamby:analytics'), 'allow');
  assert.equal(window['ga-disable-G-XWTGWKM4XH'], true);
  trackAnalytics('view_item');
  assert.deepEqual(window.dataLayer.filter(row => row[0] === 'event').map(row => row[1]), ['page_view']);

  readOnly = false;
  setAnalyticsAllowed(false);
  assert.equal(values.get('kamby:analytics'), 'deny');
});

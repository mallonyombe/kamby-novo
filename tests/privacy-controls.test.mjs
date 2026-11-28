import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { privacyPolicyVersion, registrationEvidence } from '../frontend/account-registration.js';
import { analyticsChoice, analyticsAllowed } from '../frontend/analytics.js';
import { cataloguePhoto } from '../frontend/catalogue-photos.js';

test('registration requires declared age, affirmative acceptance and matching published documents', () => {
  const documents = {terms_version: 'terms-1', privacy_version: privacyPolicyVersion};
  const selection = {adult: 'yes', accepted: true, marketing: false};
  assert.deepEqual(registrationEvidence(selection, documents), {
    adult_declared: true, legal_accepted: true, terms_version: 'terms-1',
    privacy_version: privacyPolicyVersion, email_marketing: false
  });
  assert.throws(() => registrationEvidence({...selection, adult: 'no'}, documents), /18 anos/);
  assert.throws(() => registrationEvidence({...selection, accepted: false}, documents), /Aceita/);
  assert.throws(() => registrationEvidence(selection, {...documents, privacy_version: 'old'}), /actualizados/);
  assert.equal(registrationEvidence({...selection, marketing: true}, documents).email_marketing, true);
});

test('an older opt-in is insufficient for new measurement purposes', () => {
  const previous = globalThis.localStorage;
  const values = new Map([['kamby:analytics', 'allow']]);
  globalThis.localStorage = { getItem: key => values.get(key) };
  try {
    assert.equal(analyticsChoice(), null);
    assert.equal(analyticsAllowed(), false);
    values.set('kamby:analytics', 'deny');
    assert.equal(analyticsChoice(), false);
  } finally {
    if (previous) globalThis.localStorage = previous;
    else delete globalThis.localStorage;
  }
});

test('excluded catalogue artwork cannot fall through to a legacy storage image', () => {
  const prefix = '5fbe93ee-5913-460f-bf14-4ede0fb4868c/82040807-07b8-4d39-a188-6f36259da1e1/';
  assert.equal(cataloguePhoto(prefix + '1824a802-2c67-44d6-89f3-8bbf6098f796/gallery-0.png'), '');
  assert.equal(cataloguePhoto(prefix + 'a0f7ae50-b946-440a-8acb-a5429c71890b/gallery-0.png'), '');
  assert.equal(cataloguePhoto(prefix + '6618ee6f-cf90-40ac-b34b-18becb8bc152/gallery-0.png'), '/catalogue-caneca.jpg');
  assert.equal(cataloguePhoto('original-taken-by-a-vendor.png'), undefined);
});

test('public policy and registration require the same privacy document version', async () => {
  const document = await readFile(new URL('../frontend/legal.html', import.meta.url), 'utf8');
  const migration = await readFile(new URL('../supabase/migrations/20261128170000_public_legal_documents.sql', import.meta.url), 'utf8');
  assert.ok(document.includes('Versão ' + privacyPolicyVersion));
  assert.ok(document.includes('id="privacy-2026-11-27.1"'));
  assert.ok(migration.includes("values ('" + privacyPolicyVersion + "')"));
});

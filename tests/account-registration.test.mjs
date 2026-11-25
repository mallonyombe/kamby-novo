import test from 'node:test';
import assert from 'node:assert/strict';
import { registrationCredentials, loadAccountProfile } from '../frontend/account-registration.js';

test('registration requests a confirmation link back to the app and validates passwords', () => {
  const input = {
    name: '  Ana  Manuel ', email: 'ANA@example.test',
    password: 'test-password', confirmation: 'test-password'
  };
  const origin = 'https://kamby.example.test';
  assert.deepEqual(registrationCredentials(input, origin), {
    email: 'ana@example.test', password: 'test-password',
    options: {
      emailRedirectTo: origin + '/',
      data: { display_name: 'Ana Manuel', kamby_registration: true }
    }
  });
  assert.throws(() => registrationCredentials({ ...input, confirmation: 'another-password' }, origin), /não coincidem/);
});

test('profile provisioning waits for confirmation and preserves a concurrent edit', async () => {
  const account = {
    id: 'buyer', user_metadata: { kamby_registration: true, display_name: 'Ana Manuel' }
  };
  let data = null;
  const inserts = [];
  const profile = {
    select: () => profile,
    eq: () => profile,
    maybeSingle: async () => ({ data, error: null }),
    insert: async values => {
      inserts.push(values);
      data = { display_name: 'Nome editado' };
      return { error: { code: '23505' } };
    }
  };
  const platform = { from: () => profile };
  assert.equal((await loadAccountProfile(platform, account)).data, null);
  assert.deepEqual(inserts, []);
  const confirmed = { ...account, email_confirmed_at: '2026-11-25' };
  assert.equal((await loadAccountProfile(platform, confirmed)).data.display_name, 'Nome editado');
  assert.deepEqual(inserts, [{ id: 'buyer', display_name: 'Ana Manuel' }]);
  await loadAccountProfile(platform, confirmed);
  assert.equal(inserts.length, 1);
});

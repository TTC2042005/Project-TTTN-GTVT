const test = require('node:test');
const assert = require('node:assert/strict');
const { buildAuthorizationUrl, getProviderProfile } = require('../src/services/oauthService');

function setGoogleConfig(t) {
  const keys = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_CALLBACK_URL'];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  process.env.GOOGLE_CLIENT_ID = 'test-client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
  process.env.GOOGLE_CALLBACK_URL = 'http://localhost:4000/api/auth/google/callback';
  t.after(() => keys.forEach((key) => {
    if (previous[key] === undefined) delete process.env[key];
    else process.env[key] = previous[key];
  }));
}

test('Google authorization URL includes the registered callback and anti-CSRF state', (t) => {
  setGoogleConfig(t);
  const url = new URL(buildAuthorizationUrl('google', 'state-value'));

  assert.equal(url.origin, 'https://accounts.google.com');
  assert.equal(url.searchParams.get('redirect_uri'), process.env.GOOGLE_CALLBACK_URL);
  assert.equal(url.searchParams.get('state'), 'state-value');
  assert.equal(url.searchParams.get('scope'), 'openid email profile');
});

test('Google profile is accepted only when the provider confirms the email', async (t) => {
  setGoogleConfig(t);
  const originalFetch = global.fetch;
  t.after(() => { global.fetch = originalFetch; });
  let requestCount = 0;
  global.fetch = async () => {
    requestCount += 1;
    const data = requestCount === 1
      ? { access_token: 'provider-access-token' }
      : { sub: 'google-user-id', email: 'PHOTO@example.com', email_verified: true, name: 'Film Photographer' };
    return { ok: true, json: async () => data };
  };

  const profile = await getProviderProfile('google', 'authorization-code');
  assert.deepEqual(profile, {
    id: 'google-user-id',
    email: 'photo@example.com',
    name: 'Film Photographer',
    avatarUrl: null,
  });

  requestCount = 0;
  global.fetch = async () => {
    requestCount += 1;
    const data = requestCount === 1
      ? { access_token: 'provider-access-token' }
      : { sub: 'google-user-id', email: 'photo@example.com', email_verified: false, name: 'Film Photographer' };
    return { ok: true, json: async () => data };
  };
  await assert.rejects(getProviderProfile('google', 'authorization-code'), /email is not verified/);
});

test('Facebook authorization and profile use the configured app and callback', async (t) => {
  const keys = ['FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET', 'FACEBOOK_CALLBACK_URL'];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  process.env.FACEBOOK_APP_ID = 'test-facebook-app';
  process.env.FACEBOOK_APP_SECRET = 'test-facebook-secret';
  process.env.FACEBOOK_CALLBACK_URL = 'http://localhost:4000/api/auth/facebook/callback';
  t.after(() => keys.forEach((key) => {
    if (previous[key] === undefined) delete process.env[key];
    else process.env[key] = previous[key];
  }));

  const authorizationUrl = new URL(buildAuthorizationUrl('facebook', 'facebook-state'));
  assert.equal(authorizationUrl.searchParams.get('redirect_uri'), process.env.FACEBOOK_CALLBACK_URL);
  assert.equal(authorizationUrl.searchParams.get('state'), 'facebook-state');
  assert.equal(authorizationUrl.searchParams.get('scope'), 'email,public_profile');

  const originalFetch = global.fetch;
  t.after(() => { global.fetch = originalFetch; });
  let requestCount = 0;
  global.fetch = async (url) => {
    requestCount += 1;
    const requestUrl = new URL(url);
    if (requestCount === 1) {
      assert.equal(requestUrl.searchParams.get('client_id'), process.env.FACEBOOK_APP_ID);
      assert.equal(requestUrl.searchParams.get('client_secret'), process.env.FACEBOOK_APP_SECRET);
      assert.equal(requestUrl.searchParams.get('code'), 'authorization-code');
      return { ok: true, json: async () => ({ access_token: 'facebook-access-token' }) };
    }
    assert.equal(requestUrl.searchParams.get('access_token'), 'facebook-access-token');
    return {
      ok: true,
      json: async () => ({
        id: 'facebook-user-id',
        email: 'PHOTO@example.com',
        name: 'Film Photographer',
        picture: { data: { url: 'https://example.test/avatar.jpg' } },
      }),
    };
  };

  const profile = await getProviderProfile('facebook', 'authorization-code');
  assert.deepEqual(profile, {
    id: 'facebook-user-id',
    email: 'photo@example.com',
    name: 'Film Photographer',
    avatarUrl: 'https://example.test/avatar.jpg',
  });
});

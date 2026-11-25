const providers = {
  google: {
    clientId: 'GOOGLE_CLIENT_ID',
    clientSecret: 'GOOGLE_CLIENT_SECRET',
    callbackUrl: 'GOOGLE_CALLBACK_URL',
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    profileUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
  },
  facebook: {
    clientId: 'FACEBOOK_APP_ID',
    clientSecret: 'FACEBOOK_APP_SECRET',
    callbackUrl: 'FACEBOOK_CALLBACK_URL',
    authorizationUrl: 'https://www.facebook.com/v24.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v24.0/oauth/access_token',
    profileUrl: 'https://graph.facebook.com/v24.0/me?fields=id,name,email,picture.type(large)',
  },
};

function getProviderConfig(provider) {
  const definition = providers[provider];
  if (!definition) throw new Error('Unsupported OAuth provider');
  const config = {
    ...definition,
    clientId: process.env[definition.clientId],
    clientSecret: process.env[definition.clientSecret],
    callbackUrl: process.env[definition.callbackUrl],
  };
  if (!config.clientId || !config.clientSecret || !config.callbackUrl) {
    throw new Error(`${provider} OAuth is not configured`);
  }
  return config;
}

function buildAuthorizationUrl(provider, state) {
  const config = getProviderConfig(provider);
  const url = new URL(config.authorizationUrl);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.callbackUrl);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);
  url.searchParams.set('scope', provider === 'google' ? 'openid email profile' : 'email,public_profile');
  if (provider === 'google') url.searchParams.set('prompt', 'select_account');
  return url.toString();
}

async function requestJson(url, options) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(10000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error('OAuth provider request failed');
  return data;
}

async function getProviderProfile(provider, code) {
  const config = getProviderConfig(provider);
  const tokenUrl = new URL(config.tokenUrl);
  const tokenFields = {
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: config.callbackUrl,
    grant_type: 'authorization_code',
  };
  if (provider === 'facebook') {
    Object.entries(tokenFields).forEach(([key, value]) => tokenUrl.searchParams.set(key, value));
  }
  const tokenData = await requestJson(
    provider === 'facebook' ? tokenUrl : config.tokenUrl,
    provider === 'google'
      ? {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(tokenFields),
      }
      : undefined,
  );
  if (typeof tokenData.access_token !== 'string' || !tokenData.access_token) {
    throw new Error('OAuth provider returned no access token');
  }

  const profileUrl = new URL(config.profileUrl);
  if (provider === 'facebook') {
    profileUrl.searchParams.set('access_token', tokenData.access_token);
  }
  const profile = await requestJson(
    profileUrl,
    provider === 'google'
      ? { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
      : undefined,
  );
  if (provider === 'google' && profile.email_verified !== true) {
    throw new Error('Google email is not verified');
  }

  const id = provider === 'google' ? profile.sub : profile.id;
  const email = typeof profile.email === 'string' ? profile.email.trim().toLowerCase() : '';
  if (typeof id !== 'string' || !id || !email || typeof profile.name !== 'string' || !profile.name.trim()) {
    throw new Error('OAuth profile is incomplete');
  }

  return {
    id,
    email,
    name: profile.name.trim(),
    avatarUrl: provider === 'google' ? profile.picture || null : profile.picture?.data?.url || null,
  };
}

module.exports = { buildAuthorizationUrl, getProviderProfile };

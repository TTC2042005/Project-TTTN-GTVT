import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { API_BASE } from '../lib/api';
import { removeToken, setToken, setUser } from '../lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!router.isReady) return;

    const hash = new URLSearchParams(window.location.hash.slice(1));
    const oauthToken = hash.get('oauth_token');
    if (oauthToken) {
      const returnTo = hash.get('returnTo');
      window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}`);
      setToken(oauthToken);
      async function completeSocialLogin() {
        try {
          const response = await fetch(`${API_BASE}/api/auth/profile`, {
            headers: { Authorization: `Bearer ${oauthToken}` },
          });
          const user = await response.json();
          if (!response.ok) throw new Error(user.error || 'Could not complete social login');
          setUser(user);
          const fallbackPath = user.role === 'admin' ? '/admin' : '/';
          const requestedPath = typeof returnTo === 'string' ? returnTo : router.query.returnTo;
          let destination = fallbackPath;
          if (typeof requestedPath === 'string' && requestedPath.startsWith('/') && !requestedPath.startsWith('//') && !requestedPath.includes('\\')) {
            try {
              const parsed = new URL(requestedPath, window.location.origin);
              if (parsed.origin === window.location.origin) destination = `${parsed.pathname}${parsed.search}${parsed.hash}`;
            } catch {
              destination = fallbackPath;
            }
          }
          router.replace(destination);
        } catch (loginError) {
          removeToken();
          setError(loginError.message || 'Could not complete social login');
        }
      }
      completeSocialLogin();
      return;
    }

    const oauthMessages = {
      google_not_configured: 'Google login chưa được cấu hình. Hãy thêm Google Client ID/Secret vào cấu hình backend.',
      facebook_not_configured: 'Facebook login chưa được cấu hình. Hãy thêm Facebook App ID/Secret vào cấu hình backend.',
      oauth_account_exists: 'Email này đã có tài khoản. Hãy đăng nhập bằng phương thức hiện tại trước.',
      oauth_cancelled: 'Bạn đã hủy đăng nhập bằng mạng xã hội.',
      oauth_state_invalid: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.',
      oauth_failed: 'Không thể đăng nhập bằng mạng xã hội. Vui lòng thử lại.',
    };
    const oauthError = router.query.oauthError;
    if (typeof oauthError === 'string') setError(oauthMessages[oauthError] || oauthMessages.oauth_failed);
  }, [router.isReady, router.query.oauthError, router.query.returnTo]);

  function startSocialLogin(provider) {
    const returnTo = typeof router.query.returnTo === 'string' ? router.query.returnTo : '';
    const target = new URL(`${API_BASE}/api/auth/${provider}`);
    if (returnTo) target.searchParams.set('returnTo', returnTo);
    window.location.assign(target.toString());
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      setToken(data.token);
      // persist user info indefinitely in localStorage
      if (data.user) setUser(data.user);
      const fallbackPath = data.user?.role === 'admin' ? '/admin' : '/';
      const requestedPath = typeof router.query.returnTo === 'string' ? router.query.returnTo : fallbackPath;
      const returnTo = requestedPath.startsWith('/') && !requestedPath.startsWith('//') && !requestedPath.includes('\\')
        ? requestedPath
        : fallbackPath;
      router.push(returnTo);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="register-page">
      <div className="register-shell">
        <section className="register-hero-panel">
          <div className="hero-visual-wrap">
            <img src="/Film-camera.png" alt="Film camera" className="hero-visual-img" />
          </div>
          <div className="hero-copy-panel">
            <span className="hero-tag">Welcome back</span>
            <h1>Let’s keep your film journey going.</h1>
            <p className="hero-description">Your memories, your photos, your community.</p>
            <div className="hero-pill-list">
              <div className="hero-pill">
                <strong>500+</strong>
                <span>Film Labs</span>
              </div>
              <div className="hero-pill">
                <strong>50K+</strong>
                <span>Photographers</span>
              </div>
              <div className="hero-pill">
                <strong>100K+</strong>
                <span>Photos Shared</span>
              </div>
            </div>
          </div>
        </section>

        <section className="register-card">
          <div className="register-header">
            <p className="eyebrow">Welcome back</p>
            <h2>Sign in to your account</h2>
            <p className="register-subtitle">Access your orders, photos and community.</p>
          </div>

          <form onSubmit={handleSubmit} className="register-form">
            <div className="input-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
              />
            </div>

            <div className="input-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
            </div>

            <div className="form-row">
              <label className="checkbox-group">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                Remember me
              </label>
              <a href="/forgot-password" className="forgot-link">Forgot password?</a>
            </div>

            {error && <div className="form-error">{error}</div>}
            <button type="submit" className="btn-register">Sign in</button>
          </form>

          <div className="divider">Or continue with</div>

          <div className="social-grid">
            <button type="button" className="social-btn google-btn" onClick={() => startSocialLogin('google')}>
              <img src="/google.svg" alt="Google icon" />
              Google
            </button>
            <button type="button" className="social-btn facebook-btn" onClick={() => startSocialLogin('facebook')}>
              <img src="/facebook.svg" alt="Facebook icon" />
              Facebook
            </button>
            <button type="button" className="social-btn apple-btn">
              <img src="/apple.svg" alt="Apple icon" />
              Apple
            </button>
          </div>

          <p className="register-footer">
            Don’t have an account? <a href="/register">Create one</a>
          </p>
        </section>
      </div>
    </main>
  );
}

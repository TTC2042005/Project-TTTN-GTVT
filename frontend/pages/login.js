import { useState } from 'react';
import { useRouter } from 'next/router';
import { API_BASE } from '../lib/api';
import { setToken, setUser } from '../lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');

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
      router.push('/');
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
            <button type="button" className="social-btn google-btn">
              <img src="/google.svg" alt="Google icon" />
              Google
            </button>
            <button type="button" className="social-btn facebook-btn">
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

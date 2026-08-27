import { useState } from 'react';
import { useRouter } from 'next/router';
import { API_BASE } from '../lib/api';
import { setToken, setUser } from '../lib/auth';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
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
            <span className="hero-tag">Film Lab</span>
            <h1>Join the analog community</h1>
            <p>Discover labs, scan memories, sell film gear, and connect with fellow photographers.</p>
            <div className="hero-pill-list">
              <span>Shoot</span>
              <span>Scan</span>
              <span>Print</span>
            </div>
          </div>
        </section>

        <section className="register-card">
          <div className="register-header">
            <p className="eyebrow">Create account</p>
            <h2>Start your film journey</h2>
            <p className="register-subtitle">Fast setup with film-inspired design and real community access.</p>
          </div>

          <form onSubmit={handleSubmit} className="register-form">
            <div className="input-group">
              <label htmlFor="name">Full name</label>
              <input
                id="name"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nguyễn Văn A"
                required
              />
            </div>

            <div className="input-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
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
                placeholder="••••••••"
                required
              />
            </div>

            <div className="input-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                id="confirmPassword"
                className="input"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            {error && <div className="form-error">{error}</div>}

            <button type="submit" className="btn-register">Create account</button>
          </form>

          <div className="divider">Or continue with</div>

          <div className="social-grid">
            <button type="button" className="social-btn google-btn">
              <img src="/google.svg" alt="Google icon" />
              Continue with Google
            </button>
            <button type="button" className="social-btn github-btn">
              <img src="/github.svg" alt="GitHub icon" />
              Continue with GitHub
            </button>
          </div>

          <p className="register-footer">
            Already have an account? <a href="/login">Sign in</a>
          </p>
        </section>
      </div>
    </main>
  );
}

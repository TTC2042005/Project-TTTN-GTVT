import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { fetchJson } from '../../lib/api';
import { getToken, authHeaders } from '../../lib/auth';

export default function ProfileEdit() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function loadProfile() {
      const token = getToken();
      if (!token) {
        router.push('/login');
        return;
      }
      setLoading(true);
      try {
        const data = await fetchJson('/api/auth/profile');
        setProfile(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [router]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!profile?.name) return setError('Provide your name.');

    setError('');
    setSaving(true);
    try {
      await fetchJson('/api/auth/profile', {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: profile.name, phone: profile.phone, avatarUrl: profile.avatarUrl }),
      });
      setMessage('Profile updated successfully.');
      router.push('/profile');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="container">
        <p>Loading profile…</p>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="container">
        <section className="page-hero">
          <p className="badge">Edit profile</p>
          <h1>Profile not available</h1>
          <p>Sign in to update your account information.</p>
          <Link href="/login" className="button">Login</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="container">
      <section className="page-hero">
        <p className="badge">Edit Profile</p>
        <h1>Update your account details</h1>
        <p>Keep your contact information and profile up to date.</p>
      </section>

      <section className="card" style={{ maxWidth: 760 }}>
        <form onSubmit={handleSubmit} className="form-grid">
          <label className="form-control">
            <span>Name</span>
            <input
              className="input"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              required
            />
          </label>
          <label className="form-control">
            <span>Phone</span>
            <input
              className="input"
              value={profile.phone || ''}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
            />
          </label>
          <label className="form-control">
            <span>Avatar URL</span>
            <input
              className="input"
              value={profile.avatarUrl || ''}
              onChange={(e) => setProfile({ ...profile, avatarUrl: e.target.value })}
            />
          </label>
          <label className="form-control">
            <span>Location</span>
            <input className="input" value={profile.location || ''} readOnly />
          </label>
          {message && <div className="callout">{message}</div>}
          {error && <div className="form-error">{error}</div>}
          <div className="form-actions">
            <button type="submit" className="button" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
            <Link href="/profile" className="button secondary">Cancel</Link>
          </div>
        </form>
      </section>
    </main>
  );
}

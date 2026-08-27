import { useEffect, useState } from 'react';
import Link from 'next/link';
import { API_BASE } from '../lib/api';
import { getToken, authHeaders } from '../lib/auth';

export default function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function loadProfile() {
      try {
        const token = getToken();
        if (!token) return;
        const res = await fetch(`${API_BASE}/api/auth/profile`, {
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        if (res.ok) setProfile(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  if (loading) return <main className="container"><p>Loading profile...</p></main>;
  if (!profile) return (
    <main className="container">
      <section className="page-hero">
        <p className="badge">Profile</p>
        <h1>Account access required</h1>
        <p>Please login to view and manage your Film Lab account.</p>
        <Link href="/login" className="button">Login</Link>
      </section>
    </main>
  );

  return (
    <main className="container">
      <section className="page-hero">
        <p className="badge">Profile</p>
        <h1>My Account</h1>
        <p>View your profile details, role, and contact information in one place.</p>
      </section>

      <section className="detail-grid" style={{ gap: '1.75rem' }}>
        <article className="card">
          <div className="card-meta">
            <span>{profile.role?.toUpperCase() || 'Member'}</span>
            <span>{profile.email}</span>
          </div>
          <h2>{profile.name}</h2>
          <p>{profile.bio || 'No biography available yet.'}</p>
          <div className="detail-meta">
            <span><strong>Phone:</strong> {profile.phone || 'Not added'}</span>
            <span><strong>Joined:</strong> {new Date(profile.createdAt).toLocaleDateString()}</span>
          </div>
          {message && <p className="callout">{message}</p>}
        </article>

        <aside className="card detail-panel">
          <h3>Account overview</h3>
          <p><strong>Name:</strong> {profile.name}</p>
          <p><strong>Email:</strong> {profile.email}</p>
          <p><strong>Role:</strong> {profile.role || 'Member'}</p>
          <p><strong>Phone:</strong> {profile.phone || 'Not added'}</p>
          <p><strong>Location:</strong> {profile.location || 'Unknown'}</p>
          <div className="card-footer" style={{ marginTop: '1.5rem' }}>
            <Link href="/profile/edit" className="button secondary">Edit profile</Link>
            <Link href="/orders" className="button">View orders</Link>
          </div>
        </aside>
      </section>
    </main>
  );
}

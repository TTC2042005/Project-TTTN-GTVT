import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchJson } from '../lib/api';
import { getToken, authHeaders } from '../lib/auth';

export default function Events() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function loadEvents() {
      setLoading(true);
      setError('');
      try {
        const [workshops, photowalks] = await Promise.all([
          fetchJson('/api/events/workshops'),
          fetchJson('/api/events/photowalks'),
        ]);
        setEvents([...workshops, ...photowalks].sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate)));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadEvents();
  }, []);

  const handleRegister = async (eventType, eventId) => {
    const token = getToken();
    if (!token) {
      window.location.href = '/login';
      return;
    }
    setMessage('');
    try {
      await fetchJson('/api/events/register', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventType, eventId }),
      });
      setMessage('Registered successfully. Check your profile for details.');
    } catch (err) {
      setMessage(err.message);
    }
  };

  return (
    <main className="events-page">
      <section className="events-hero">
        <div className="events-hero-copy">
          <span className="hero-tag">EVENTS & WORKSHOPS</span>
          <h1>Capture moments. Connect with film lovers.</h1>
          <p>Join workshops, photowalks, and film community events. Learn, create, and share real analog experiences.</p>
          <div className="hero-action-group">
            <Link href="/events" className="button">Explore Events</Link>
            <Link href="/profile" className="button secondary">My Bookings</Link>
          </div>
          {message && <div className="callout" style={{ marginTop: '1rem' }}>{message}</div>}
        </div>
        <div className="events-hero-visual">
          <img src="/film-camera.jpg" alt="Film camera" className="hero-visual-img" />
        </div>
      </section>

      <section className="events-toolbar container">
        <div className="events-tabs">
          <button type="button" className="tab active">All Events</button>
          <button type="button" className="tab">Workshops</button>
          <button type="button" className="tab">Photowalks</button>
          <button type="button" className="tab">Talks & Meetups</button>
          <button type="button" className="tab">Exhibitions</button>
        </div>
        <div className="events-filters">
          <select className="select">
            <option>All Locations</option>
            <option>Hà Nội</option>
            <option>TP HCM</option>
            <option>Da Nang</option>
          </select>
          <select className="select">
            <option>Upcoming</option>
            <option>Today</option>
            <option>This Week</option>
            <option>This Month</option>
          </select>
        </div>
      </section>

      <section className="container">
        <div className="events-heading-row">
          <div>
            <h2>Upcoming Events</h2>
            <p>Don't miss out on these exciting film photography experiences.</p>
          </div>
          <button type="button" className="button secondary">View Calendar</button>
        </div>

        {loading ? (
          <div className="lab-list-loading">Loading events…</div>
        ) : error ? (
          <div className="lab-list-error">{error}</div>
        ) : (
          <div className="events-grid">
            {events.map((event) => (
              <article key={event.id} className="event-card">
                <div className="event-card-image" style={{ backgroundImage: `url(${event.imageUrl || '/film-camera.jpg'})` }}>
                  <span className="event-tag">{event.visibility === 'public' ? event.type || 'Event' : 'Hidden'}</span>
                  <span className="event-date">{new Date(event.eventDate).toLocaleDateString()}</span>
                </div>
                <div className="event-card-body">
                  <h3>{event.title}</h3>
                  <p>{event.description}</p>
                  <div className="event-card-meta">
                    <span>📍 {event.location || 'Online'}</span>
                    <span>⏰ {event.time || 'TBA'}</span>
                  </div>
                  <div className="event-card-bottom">
                    <div className="event-attendees">
                      <span className="pill small">{event.capacity || 'Open'}</span>
                      <small>{event.publishedAt ? 'Published' : 'Draft'}</small>
                    </div>
                    <div className="event-action-group">
                      <span className="badge">{event.price || 'Free'}</span>
                      <button type="button" className="button" onClick={() => handleRegister(event.type?.toLowerCase() === 'photowalk' ? 'photowalk' : 'workshop', event.id)}>
                        Register Now
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="container host-event-card">
        <div>
          <strong>Host Your Own Event</strong>
          <p>Share your knowledge, organize workshops or photowalks, and connect with the film community.</p>
        </div>
        <button type="button" className="button">Create Event</button>
      </section>
    </main>
  );
}

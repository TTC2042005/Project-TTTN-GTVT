import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { fetchJson } from '../lib/api';

const features = [
  { title: 'Find Film Labs', description: 'Compare and book services', icon: '📍' },
  { title: 'Flexible Packages', description: 'Choose what fits you', icon: '📦' },
  { title: 'Lab Reviews', description: 'Real feedback from users', icon: '⭐' },
  { title: 'Trusted & Secure', description: 'Verified labs you can trust', icon: '🔒' },
  { title: 'Support Community', description: 'Get help from film lovers', icon: '🤝' },
];

const services = [
  { title: 'Scanning', description: 'High quality scans', icon: '🖨️' },
  { title: 'Printing', description: 'Photo & enlargements', icon: '🖼️' },
  { title: 'Development', description: 'C41, E6, BW', icon: '🧪' },
  { title: 'Restoration', description: 'Fix old photos', icon: '🛠️' },
];

export default function Home() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [labs, setLabs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadLabs() {
      setLoading(true);
      setError('');
      try {
        const data = await fetchJson('/api/film-labs?rating=4');
        setLabs(data.slice(0, 4));
      } catch (err) {
        setError(err.message || 'Unable to load film labs');
      } finally {
        setLoading(false);
      }
    }

    loadLabs();
  }, []);

  const trendingLabs = useMemo(() => {
    return labs.map((lab) => ({
      id: lab.id,
      name: lab.name,
      rating: lab.rating?.toFixed(1) || 'N/A',
      reviews: lab.reviews?.length || 0,
      tags: lab.services?.slice(0, 3).map((service) => service.serviceType) || [],
      location: `${lab.city || 'Unknown'}, ${lab.country || 'Vietnam'}`,
      time: lab.turnaround || '24-72h',
      price: lab.priceRange || 'From 100k',
      image: lab.photoUrl || '/film-camera.jpg',
    }));
  }, [labs]);

  const handleSearch = async () => {
    router.push(`/labs?q=${encodeURIComponent(search.trim())}`);
  };

  return (
    <main className="home-page">
      <section className="home-hero container">
        <div className="hero-copy">
          <span className="hero-eyebrow">Find trusted film labs near you ✨</span>
          <h1>Search and compare film lab services.</h1>
          <p>Find labs by location, package, turnaround time, and customer feedback so you can print and scan with confidence.</p>
          <div className="hero-search-bar">
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by city, service, or lab name..."
              className="input"
            />
            <button className="button" onClick={handleSearch}>Search</button>
          </div>
          <div className="hero-feature-row">
            {features.slice(0, 4).map((feature) => (
              <div key={feature.title} className="feature-pill">
                <span>{feature.icon}</span>
                <div>
                  <strong>{feature.title}</strong>
                  <small>{feature.description}</small>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="hero-visual">
          <img src="/film-camera.jpg" alt="Film lab hero" className="hero-visual-img" />
          <div className="hero-testimonial">
            <blockquote>“Good labs make great photos even better.”</blockquote>
            <div className="testimonial-meta">
              <div className="avatar-group">👤👤👤👤👤</div>
              <span>12.5K+ photographers trust Film Lab</span>
            </div>
          </div>
        </div>
      </section>

      <section className="home-cards container">
        {features.map((feature) => (
          <div key={feature.title} className="home-card feature-card">
            <strong>{feature.title}</strong>
            <p>{feature.description}</p>
          </div>
        ))}
      </section>

      <section className="home-grid container">
        <div className="trending-section">
          <div className="section-heading">
            <h2>Trending Film Labs</h2>
            <Link href="/labs" className="view-all">View all →</Link>
          </div>
          <div className="trending-list">
            {loading ? (
              <p>Loading labs…</p>
            ) : error ? (
              <p className="callout">{error}</p>
            ) : trendingLabs.length > 0 ? (
              trendingLabs.map((lab) => (
                <article key={lab.id} className="trending-lab-card">
                  <img src={lab.image} alt={lab.name} />
                  <div>
                    <h3>{lab.name}</h3>
                    <div className="lab-meta">
                      <span>⭐ {lab.rating} ({lab.reviews})</span>
                      <span>{lab.tags.join(' • ')}</span>
                    </div>
                    <div className="lab-info">
                      <span>{lab.location}</span>
                      <span>{lab.time}</span>
                    </div>
                    <div className="card-footer">
                      <Link href={`/labs/${lab.id}`} className="button secondary">View lab</Link>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <p>No trending labs found yet.</p>
            )}
          </div>
        </div>

        <div className="promo-section">
          <div className="promo-card">
            <span className="badge">Package of the Month</span>
            <h2>Black & White Film Package</h2>
            <ul>
              <li>C41 or BW Development</li>
              <li>High-res Scanning</li>
              <li>Dust & Scratch Removal</li>
            </ul>
            <div className="promo-footer">
              <strong>From 150.000đ</strong>
              <button className="button secondary" onClick={() => router.push('/labs')}>View Package</button>
            </div>
          </div>
          <div className="small-cards">
            {services.map((service) => (
              <div key={service.title} className="small-card">
                <span>{service.icon}</span>
                <div>
                  <strong>{service.title}</strong>
                  <small>{service.description}</small>
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="home-sidebar">
          <div className="sidebar-card map-card">
            <div className="sidebar-header">
              <h3>Find Labs Near You</h3>
            </div>
            <div className="map-placeholder">Map</div>
            <button className="button secondary">Use my location</button>
          </div>

          <div className="sidebar-card why-card">
            <h3>Why choose Film Lab?</h3>
            <ul>
              <li>15,000+ active users</li>
              <li>Verified labs and real reviews</li>
              <li>Secure payment & data protection</li>
              <li>Support from film photography community</li>
            </ul>
            <img src="/film-camera.jpg" alt="Analog camera illustration" className="sidebar-illustration" />
          </div>
        </aside>
      </section>

      <section className="lab-owner-callout container">
        <div>
          <strong>Are you a lab owner?</strong>
          <p>List your lab and reach thousands of film photographers.</p>
        </div>
        <button className="button" onClick={() => router.push('/profile')}>List Your Lab</button>
      </section>
    </main>
  );
}

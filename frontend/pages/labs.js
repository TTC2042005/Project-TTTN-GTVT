import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchJson } from '../lib/api';

const tags = ['Verified Labs', 'Real Reviews', 'Fast Turnaround', 'Secure Service'];
const serviceTypes = ['C41', 'E6', 'BW', 'Scanning', 'Printing', 'Restoration'];

const stats = [
  { label: 'Verified labs', value: '500+' },
  { label: 'Trusted reviews', value: '4.8 avg' },
  { label: 'Fast service', value: '24-72h' },
];

export default function Labs() {
  const [labs, setLabs] = useState([]);
  const [filters, setFilters] = useState({
    q: '',
    city: '',
    country: '',
    serviceType: '',
    minPrice: '',
    maxPrice: '',
    rating: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState('rating');

  const getLowestPrice = (lab) => {
    const prices = [...(lab.services || []), ...(lab.packages || [])]
      .map((item) => Number(item.price))
      .filter((price) => Number.isFinite(price) && price >= 0);
    return prices.length ? Math.min(...prices) : Number.POSITIVE_INFINITY;
  };
  const getHighestPrice = (lab) => {
    const prices = [...(lab.services || []), ...(lab.packages || [])]
      .map((item) => Number(item.price))
      .filter((price) => Number.isFinite(price) && price >= 0);
    return prices.length ? Math.max(...prices) : Number.POSITIVE_INFINITY;
  };

  const sortedLabs = [...labs].sort((a, b) => {
    if (sortBy === 'price-asc' || sortBy === 'price-desc') {
      const getPrice = sortBy === 'price-asc' ? getLowestPrice : getHighestPrice;
      const priceA = getPrice(a);
      const priceB = getPrice(b);
      const unknownLast = Number.isFinite(priceA) ? (Number.isFinite(priceB) ? 0 : -1) : (Number.isFinite(priceB) ? 1 : 0);
      if (unknownLast) return unknownLast;
      const priceOrder = sortBy === 'price-asc' ? priceA - priceB : priceB - priceA;
      return priceOrder || Number(b.rating || 0) - Number(a.rating || 0);
    }
    if (sortBy === 'name') return String(a.name || '').localeCompare(String(b.name || ''), 'vi');
    if (sortBy === 'newest') return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    return Number(b.rating || 0) - Number(a.rating || 0) || getLowestPrice(a) - getLowestPrice(b);
  });

  const buildQueryString = () => {
    const params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    if (filters.city) params.set('city', filters.city);
    if (filters.country) params.set('country', filters.country);
    if (filters.serviceType) params.set('serviceType', filters.serviceType);
    if (filters.rating) params.set('rating', filters.rating);
    if (filters.minPrice) params.set('minPrice', filters.minPrice);
    if (filters.maxPrice) params.set('maxPrice', filters.maxPrice);
    return params.toString() ? `?${params.toString()}` : '';
  };

  const loadLabs = async () => {
    setLoading(true);
    setError(null);

    try {
      const queryString = buildQueryString();
      const data = await fetchJson(`/api/film-labs${queryString}`);
      setLabs(data);
    } catch (err) {
      setError(err.message || 'Unable to load film labs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLabs();
  }, []);

  const handleChange = (field) => (event) => {
    setFilters((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSearch = async (event) => {
    event.preventDefault();
    await loadLabs();
  };

  const clearFilters = () => {
    const emptyFilters = { q: '', city: '', country: '', serviceType: '', minPrice: '', maxPrice: '', rating: '' };
    setFilters(emptyFilters);
    setError(null);
    setLoading(true);
    fetchJson('/api/film-labs')
      .then(setLabs)
      .catch((err) => setError(err.message || 'Unable to load film labs'))
      .finally(() => setLoading(false));
  };

  return (
    <main className="labs-page">
      <section className="labs-hero container">
        <div className="labs-hero-copy">
          <p className="badge">Film Labs</p>
          <h1>Search and compare film lab services in one place.</h1>
          <p>Browse verified labs, compare packages, and book your next development, scanning, or printing job with confidence.</p>

          <form className="labs-search-bar" onSubmit={handleSearch}>
            <input
              value={filters.q}
              onChange={handleChange('q')}
              type="text"
              placeholder="Search by city, lab name, or service"
              className="input"
            />
            <button type="submit" className="button">Search</button>
          </form>

          <div className="labs-pill-row">
            {tags.map((tag) => (
              <span key={tag} className="labs-pill">{tag}</span>
            ))}
          </div>

          <div className="stats-row">
            {stats.map((stat) => (
              <div key={stat.label} className="stat-card">
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="labs-filter-panel container">
        <div className="filter-grid">
          <div className="filter-field">
            <label>City</label>
            <input value={filters.city} onChange={handleChange('city')} className="input" placeholder="Hà Nội, TP.HCM" />
          </div>
          <div className="filter-field">
            <label>Country</label>
            <input value={filters.country} onChange={handleChange('country')} className="input" placeholder="Vietnam" />
          </div>
          <div className="filter-field">
            <label>Service type</label>
            <select value={filters.serviceType} onChange={handleChange('serviceType')} className="select">
              <option value="">Any service</option>
              {serviceTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div className="filter-field">
            <label>Rating</label>
            <select value={filters.rating} onChange={handleChange('rating')} className="select">
              <option value="">Any rating</option>
              <option value="4">4+ stars</option>
              <option value="3">3+ stars</option>
              <option value="2">2+ stars</option>
            </select>
          </div>
          <div className="filter-field">
            <label>Min price</label>
            <input value={filters.minPrice} onChange={handleChange('minPrice')} type="number" min="0" className="input" placeholder="100" />
          </div>
          <div className="filter-field">
            <label>Max price</label>
            <input value={filters.maxPrice} onChange={handleChange('maxPrice')} type="number" min="0" className="input" placeholder="300" />
          </div>
        </div>
        <div className="filter-actions">
          <button type="button" className="button secondary" onClick={clearFilters}>Clear filters</button>
          <button type="button" className="button" onClick={handleSearch}>Apply filters</button>
        </div>
      </section>

      <section className="labs-grid container">
        <div className="labs-main">
          <div className="labs-list-header">
            <div>
              <h2>Film Labs</h2>
              <p>Curated film labs with top reviews, fast turnaround, and helpful service details.</p>
            </div>
            <label className="labs-sort-control">
              <span>Sort by</span>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="select" aria-label="Sort Film Labs">
                <option value="rating">Highest rated</option>
                <option value="price-asc">Lowest price</option>
                <option value="price-desc">Highest price</option>
                <option value="newest">Recently added</option>
                <option value="name">Name A–Z</option>
              </select>
            </label>
          </div>

          {loading ? (
            <div className="lab-list-loading">Loading film labs…</div>
          ) : error ? (
            <div className="lab-list-error">{error}</div>
          ) : (
            <div className="lab-list">
              {labs.length === 0 ? (
                <div className="lab-list-empty">No film labs found for your search.</div>
              ) : (
                sortedLabs.map((lab) => (
                  <article key={lab.id} className="lab-card">
                    <img src={lab.photoUrl || '/film-camera.jpg'} alt={lab.name} loading="lazy" decoding="async" />
                    <div className="lab-card-content">
                      <div className="lab-card-title">
                        <h3>{lab.name}</h3>
                        <span className="lab-price">{lab.priceRange || (Number.isFinite(getLowestPrice(lab)) ? `From ${getLowestPrice(lab).toLocaleString('vi-VN')}đ` : 'Contact lab')}</span>
                      </div>
                      <div className="lab-meta-row">
                        <span>⭐ {lab.rating?.toFixed(1) || '—'}</span>
                        <span>({lab.reviews?.length ?? 0} reviews)</span>
                      </div>
                      <div className="lab-tags">
                        {(lab.services || []).slice(0, 3).map((service) => (
                          <span key={service.id}>{service.serviceType || service.name}</span>
                        ))}
                      </div>
                      <div className="lab-details">
                        <span>{lab.address}, {lab.city}</span>
                        <span>{lab.rating ? `${lab.rating >= 4.5 ? 'Top choice' : 'Verified lab'}` : 'Verified lab'}</span>
                      </div>
                      <div className="lab-actions">
                        <Link href={`/labs/${lab.id}`} className="button secondary">View details</Link>
                        <Link href={`/labs/${lab.id}`} className="button">Book now</Link>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          )}
        </div>

        <aside className="labs-side">
          <div className="promo-panel">
            <div className="promo-badge">Package of the Month</div>
            <h3>Black & White Film Package</h3>
            <p>Perfect for portraits and timeless analog prints with premium film processing.</p>
            <ul>
              <li>C41 or BW development</li>
              <li>High-res scanning</li>
              <li>Dust & scratch removal</li>
            </ul>
            <div className="promo-cta">
              <strong>From 150.000đ</strong>
              <button className="button secondary">View package</button>
            </div>
          </div>

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
            <div className="sidebar-illustration">📷</div>
          </div>
        </aside>
      </section>

      <section className="labs-callout container">
        <div>
          <strong>Are you a lab owner?</strong>
          <p>List your lab and reach thousands of film photographers who book services every week.</p>
        </div>
        <div className="labs-callout-actions">
          <Link href="/upload?tool=film-review" className="button secondary">Upload & review a photo</Link>
          <button className="button">List Your Lab</button>
        </div>
      </section>
    </main>
  );
}

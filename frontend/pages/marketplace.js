import { useEffect, useState } from 'react';
import fs from 'fs';
import path from 'path';
import Link from 'next/link';
import { fetchJson } from '../lib/api';

const categories = ['All Categories', 'Cameras', 'Lenses', 'Film', 'Accessories', 'Tripods', 'Bags', 'Darkroom'];
const conditions = ['Any', 'New', 'Used'];

const stats = [
  { label: 'Items listed', value: '12.5K+' },
  { label: 'Average rating', value: '4.8/5' },
  { label: 'Active sellers', value: '2.3K+' },
  { label: 'Community trusted', value: '100%' },
];

const trendingListings = [
  {
    title: 'Canon AE-1 Program',
    price: '$150',
    location: 'Hanoi, Vietnam',
    seller: 'Minh Tran',
    rating: '4.9',
    badge: 'Featured',
    image: '/film-camera.jpg',
  },
  {
    title: 'Nikon 50mm f/1.8 AI-s',
    price: '$120',
    location: 'Ho Chi Minh City',
    seller: 'Hoàng Nam',
    rating: '4.8',
    badge: 'Like New',
    image: '/Film-camera.png',
  },
  {
    title: 'Kodak Portra 400 (35mm)',
    price: '$75',
    location: 'Da Nang',
    seller: 'Linh Le',
    rating: '4.9',
    badge: 'New',
    image: '/film-camera.jpg',
  },
  {
    title: 'Sekonic L-308X Light Meter',
    price: '$80',
    location: 'Hanoi, Vietnam',
    seller: 'An Nguyen',
    rating: '4.7',
    badge: 'Good',
    image: '/Film-camera.jpg',
  },
  {
    title: 'Leica M6 Classic',
    price: '$2,250',
    location: 'Phong Vu',
    seller: 'Phong Vu',
    rating: '5.0',
    badge: 'Featured',
    image: '/Film-camera.jpg',
  },
];

const marketplaceReasons = [
  'Trusted Community',
  'Secure Transactions',
  'Quality Guaranteed',
  'Support Community',
];

const cameraPrices = {
  'Canon EOS Rebel T5 (EOS 1200D)': 280,
  'Canon EOS Rebel T6 (1300D)': 350,
  'Canon PowerShot SX620 HS': 180,
  'Nikon Coolpix B500': 220,
  'Nikon COOLPIX P610': 260,
};

const formatPrice = (price) => `$${Number(price || 0).toLocaleString('en-US')}`;

export default function Marketplace({ staticCameras: propsStaticCameras = [] }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All Categories');
  const [condition, setCondition] = useState('Any');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [error, setError] = useState('');
  const [staticCameras, setStaticCameras] = useState(propsStaticCameras || []);

  const buildQuery = () => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (category && category !== 'All Categories') params.set('category', category);
    if (condition && condition !== 'Any') params.set('condition', condition);
    if (minPrice) params.set('minPrice', minPrice);
    if (maxPrice) params.set('maxPrice', maxPrice);
    return params.toString() ? `?${params.toString()}` : '';
  };

  const loadProducts = async () => {
    setLoading(true);
    setError('');
    try {
      let response = await fetchJson(`/api/marketplace/listings${buildQuery()}`);

      // If browsing Cameras or All Categories, include static images from public/Cameras
      if (category === 'Cameras' || category === 'All Categories') {
        try {
          const staticItems = await fetchJson('/api/static-cameras');
          // If there's a query, filter static items client-side
          const q = query && query.trim().toLowerCase();
          const filteredStatic = q ? staticItems.filter((it) => it.title.toLowerCase().includes(q)) : staticItems;
          // Merge DB response and static items (avoid duplicates by title)
          const existingTitles = new Set(response.map((p) => (p.title || '').toLowerCase()));
          const merged = [...response];
          for (const it of filteredStatic) {
            if (!existingTitles.has((it.title || '').toLowerCase())) merged.push(it);
          }
          response = merged;
        } catch (err) {
          // ignore static items if fetch fails
        }
      }
      // If query present and not using server-side q param, filter client-side as fallback
      if (query && category !== 'All Categories') {
        const q = query.trim().toLowerCase();
        response = response.filter((p) => (p.title || '').toLowerCase().includes(q));
      }
      setProducts(response);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
    // load static gallery separately so images always display if not provided by server
    if (!propsStaticCameras || propsStaticCameras.length === 0) {
      (async () => {
        try {
          const list = await fetchJson('/api/static-cameras');
          setStaticCameras(list);
        } catch (e) {
          // ignore
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  return (
    <main className="marketplace-page">
      <section className="marketplace-hero container">
        <div className="marketplace-hero-copy">
          <span className="hero-tag">Marketplace</span>
          <h1>Shop analog gear and list what you want to sell.</h1>
          <p>Find film cameras, lenses, accessories, and supplies from trusted sellers in the community.</p>
          <div className="marketplace-actions">
            <Link href="/marketplace" className="button">Browse Listings</Link>
            <button type="button" className="button secondary">Sell Your Gear</button>
          </div>
          <div className="marketplace-stats-row">
            {stats.map((item) => (
              <div key={item.label} className="stat-pill">
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="marketplace-hero-image">
          <img src="/film-camera.jpg" alt="Analog gear marketplace" className="hero-visual-img" />
        </div>
      </section>

      <section className="marketplace-categories container">
        {categories.map((cat) => (
            <button
              key={cat}
              className={`category-pill ${cat === category ? 'active' : ''}`}
              type="button"
              onClick={() => { setCategory(cat); setQuery(''); }}
            >
              {cat}
            </button>
          ))}
      </section>

        {staticCameras.length > 0 && (
          <section className="marketplace-cameras container">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Featured gear</span>
                <h2>Cameras Collection</h2>
              </div>
              <p>Browse carefully selected cameras ready for their next roll.</p>
            </div>
            <div className="camera-grid">
              {staticCameras.map((cam) => (
                <div key={cam.id} className="camera-card">
                  <div className="camera-image-wrap">
                    <img src={cam.imageUrl} alt={cam.title} />
                    <span className="listing-badge">{cam.condition || 'Used'}</span>
                  </div>
                  <div className="camera-card-body">
                    <div>
                      <span className="camera-category">{cam.category || 'Cameras'}</span>
                      <h3>{cam.title}</h3>
                    </div>
                    <div className="camera-card-footer">
                      <strong>{formatPrice(cam.price || cameraPrices[cam.title])}</strong>
                      <span>In stock</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

      <section className="marketplace-search container">
        <div className="search-grid">
          <input
            className="input search-input"
            placeholder="Search cameras, lenses, film, accessories..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="filter-row">
            <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <select className="select" value={condition} onChange={(e) => setCondition(e.target.value)}>
              {conditions.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <button type="button" className="button search-button" onClick={loadProducts}>Search</button>
          </div>
          <div className="price-range-row">
            <input
              className="input small"
              placeholder="Min price"
              type="number"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
            />
            <input
              className="input small"
              placeholder="Max price"
              type="number"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
            />
            <button type="button" className="button secondary" onClick={loadProducts}>Apply</button>
          </div>
        </div>
      </section>

      <section className="marketplace-main container">
        <div className="marketplace-listings">
          <div className="listings-head">
            <div>
              <button className="pill small active">Latest Listings</button>
              <button className="pill small">Trending</button>
              <button className="pill small">Recommended</button>
            </div>
            <div className="listings-sort">
              <span>Sort by:</span>
              <select className="select small">
                <option>Newest First</option>
                <option>Highest Price</option>
              </select>
              <button className="icon-button">☐</button>
              <button className="icon-button">≡</button>
            </div>
          </div>
          {loading ? (
            <div className="lab-list-loading">Loading marketplace listings…</div>
          ) : error ? (
            <div className="lab-list-error">{error}</div>
          ) : products.length === 0 ? (
            <div className="lab-list-empty">No listings matched your search.</div>
          ) : (
            <div className="listing-grid">
              {products.map((product) => (
                <article key={product.id} className="listing-card">
                  <div className="listing-image" style={{ backgroundImage: `url(${product.imageUrl || '/film-camera.jpg'})` }}>
                    <span className="listing-badge">{product.condition || 'Used'}</span>
                  </div>
                  <div className="listing-body">
                    <h3>{product.title}</h3>
                    <p className="listing-price">{formatPrice(product.price)}</p>
                    <div className="listing-meta">
                      <span>{product.category}</span>
                      <span>{product.seller?.name || 'Seller'}</span>
                    </div>
                    <div className="listing-seller">Stock: {product.stock}</div>
                    <div className="listing-actions">
                      <Link href={`/marketplace/${product.id}`} className="button secondary">View</Link>
                      <Link href={`/marketplace/${product.id}`} className="button">Buy</Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
          <div className="marketplace-subscribe-card">
            <div>
              <strong>Never miss a great deal</strong>
              <p>Get notified about new listings and exclusive offers.</p>
            </div>
            <div className="subscribe-row">
              <input className="input" placeholder="Enter your email" />
              <button className="button">Subscribe</button>
            </div>
          </div>
        </div>

        <aside className="marketplace-sidebar">
          <div className="sidebar-card">
            <h3>Why buy on Film Lab?</h3>
            <div className="reason-list">
              {marketplaceReasons.map((reason) => (
                <div key={reason} className="reason-item">
                  <span>✔</span>
                  <p>{reason}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="sidebar-card sell-gear-card">
            <div>
              <strong>Sell Your Gear</strong>
              <p>Turn your unused gear into someone else’s treasure.</p>
            </div>
            <button className="button">Start Listing</button>
          </div>
        </aside>
      </section>
    </main>
  );
}

export async function getServerSideProps() {
  try {
    const camerasDir = path.join(process.cwd(), 'public', 'Cameras');
    let items = [];
    if (fs.existsSync(camerasDir)) {
      const files = fs.readdirSync(camerasDir).filter((f) => /\.(jpg|jpeg|png|webp|gif)$/i.test(f));
      items = files.map((file) => ({
        id: `static-${file}`,
        title: path.parse(file).name,
        category: 'Cameras',
        condition: 'Used',
        price: cameraPrices[path.parse(file).name] || 0,
        description: '',
        imageUrl: `/Cameras/${encodeURIComponent(file)}`,
        stock: 1,
      }));
    }
    return { props: { staticCameras: items } };
  } catch (e) {
    return { props: { staticCameras: [] } };
  }
}

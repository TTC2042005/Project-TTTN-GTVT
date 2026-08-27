import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchJson } from '../../lib/api';

const cameraPrices = {
  'Canon EOS Rebel T5 (EOS 1200D)': 280,
  'Canon EOS Rebel T6 (1300D)': 350,
  'Canon PowerShot SX620 HS': 180,
  'Nikon Coolpix B500': 220,
  'Nikon COOLPIX P610': 260,
};

const getProductImage = (item) => {
  if (!item) return '';
  if (item.category === 'Cameras' && cameraPrices[item.title]) {
    return `/Cameras/${encodeURIComponent(`${item.title}.jpg`)}`;
  }
  return item.imageUrl || '';
};

export default function MarketplaceDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;

    async function loadProduct() {
      setLoading(true);
      try {
        const data = await fetchJson(`/api/marketplace/listings/${id}`);
        setProduct(data);
      } catch (err) {
        setError(err.message || 'Could not load product');
      } finally {
        setLoading(false);
      }
    }

    loadProduct();
  }, [id]);

  return (
    <main className="container">
      <section className="page-hero">
        <p className="badge">Marketplace</p>
        <h1>{product ? product.title : 'Listing details'}</h1>
        <p>Review listing information, seller details, pricing, and item condition before making a purchase.</p>
      </section>

      <section className="card" style={{ maxWidth: 980 }}>
        {loading ? (
          <p>Loading listing...</p>
        ) : error ? (
          <div className="callout">{error}</div>
        ) : product ? (
          <div className="detail-grid">
            <div className="detail-panel">
              {getProductImage(product) ? (
                <img src={getProductImage(product)} alt={product.title} className="detail-image" />
              ) : (
                <div className="detail-image" style={{ display: 'grid', placeItems: 'center', color: 'var(--muted)' }}>
                  No image available
                </div>
              )}

              <div className="detail-meta">
                <span>{product.category || 'Film gear'}</span>
                <span>{product.condition || 'Unknown condition'}</span>
                <span>${cameraPrices[product.title] || Number(product.price || 0).toLocaleString('en-US')}</span>
              </div>

              <p>{product.description}</p>
            </div>

            <aside className="detail-panel">
              <div className="card-meta">
                <span>Seller</span>
                <span>{product.seller?.name || 'Unknown'}</span>
              </div>
              <div className="card-meta">
                <span>Location</span>
                <span>{product.location || 'Not listed'}</span>
              </div>
              <div className="card-meta">
                <span>Condition</span>
                <span>{product.condition || 'N/A'}</span>
              </div>
              <div className="card-meta">
                <span>Stock</span>
                <span>{product.available ? 'Available' : 'Sold out'}</span>
              </div>
              <div className="card-footer" style={{ marginTop: '1.5rem' }}>
                <Link href="/marketplace" className="button secondary">Back to marketplace</Link>
                <button type="button" className="button">Contact seller</button>
              </div>
            </aside>
          </div>
        ) : (
          <p>Listing not found.</p>
        )}
      </section>
    </main>
  );
}

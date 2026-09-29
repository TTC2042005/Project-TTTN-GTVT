import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { API_BASE, fetchJson } from '../../lib/api';
import { authHeaders, getToken } from '../../lib/auth';

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
  const [quantity, setQuantity] = useState(1);
  const [order, setOrder] = useState(null);
  const [proofFile, setProofFile] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState('');
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    if (!id) return;

    async function loadProduct() {
      setLoading(true);
      try {
        let data;
        try {
          data = await fetchJson(`/api/marketplace/listings/${id}`);
        } catch (listingError) {
          const responses = await Promise.all([
            fetch('/api/static-cameras'),
            fetch('/api/static-lenses'),
            fetch('/api/static-films'),
          ]);
          const catalogs = await Promise.all(responses.map((response) => response.ok ? response.json() : []));
          data = catalogs.flat().find((item) => item.id === id);
          if (!data) throw listingError;
        }
        setProduct(data);
      } catch (err) {
        setError(err.message || 'Could not load product');
      } finally {
        setLoading(false);
      }
    }

    loadProduct();
  }, [id]);

  const handlePurchase = async () => {
    if (!getToken()) {
      router.push('/login');
      return;
    }

    setPurchasing(true);
    setPaymentStatus('');
    try {
      const isStaticItem = product.id.startsWith('static-');
      const body = isStaticItem
        ? { quantity: Number(quantity), paymentMethod: 'Bank QR', itemTitle: product.title, itemCategory: product.category, itemPrice: product.price }
        : { productId: product.id, quantity: Number(quantity), paymentMethod: 'Bank QR' };
      const response = await fetch(`${API_BASE}/api/marketplace/orders`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not create order');
      setOrder(data);
      setPaymentStatus('Order created. Please transfer the exact amount and upload your receipt.');
    } catch (err) {
      setPaymentStatus(err.message || 'Could not create order');
    } finally {
      setPurchasing(false);
    }
  };

  const handleProofUpload = async () => {
    if (!proofFile || !order) return;
    setPurchasing(true);
    setPaymentStatus('');
    try {
      const form = new FormData();
      form.append('photo', proofFile);
      const uploadResponse = await fetch(`${API_BASE}/api/uploads`, {
        method: 'POST',
        headers: authHeaders(),
        body: form,
      });
      const upload = await uploadResponse.json();
      if (!uploadResponse.ok) throw new Error(upload.error || 'Could not upload payment proof');

      const confirmResponse = await fetch(`${API_BASE}/api/marketplace/orders/${order.id}/confirm-payment`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId: upload.id }),
      });
      const confirmation = await confirmResponse.json();
      if (!confirmResponse.ok) throw new Error(confirmation.error || 'Could not submit payment proof');
      setPaymentStatus('Payment proof submitted. Your order is awaiting verification.');
    } catch (err) {
      setPaymentStatus(err.message || 'Could not submit payment proof');
    } finally {
      setPurchasing(false);
    }
  };

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
                {!order && (
                  <>
                    <label className="quantity-control">
                      <span>Quantity</span>
                      <input className="input" type="number" min="1" max={product.category === 'Film' ? 10 : product.stock || 1} value={quantity} onChange={(event) => setQuantity(event.target.value)} />
                    </label>
                    <button type="button" className="button" onClick={handlePurchase} disabled={purchasing || quantity < 1}>
                      {purchasing ? 'Creating order…' : product.category === 'Film' ? 'Buy ticket' : 'Buy now'}
                    </button>
                  </>
                )}
              </div>
              {order && (
                <div className="payment-panel">
                  <h2>Pay by QR</h2>
                  <p>Scan this QR code and transfer ${Number(order.totalPrice).toLocaleString('en-US')}.</p>
                  <img src="/QR.jpg" alt="QR code for payment" className="payment-qr" />
                  <label className="form-control">
                    <span>Upload payment receipt</span>
                    <input type="file" accept="image/*" onChange={(event) => setProofFile(event.target.files?.[0] || null)} />
                  </label>
                  <button type="button" className="button" onClick={handleProofUpload} disabled={!proofFile || purchasing}>
                    {purchasing ? 'Submitting…' : 'Submit receipt'}
                  </button>
                </div>
              )}
              {paymentStatus && <p className="callout">{paymentStatus}</p>}
            </aside>
          </div>
        ) : (
          <p>Listing not found.</p>
        )}
      </section>
    </main>
  );
}

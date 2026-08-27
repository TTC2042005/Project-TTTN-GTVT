import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchJson, API_BASE } from '../../lib/api';
import { getToken, authHeaders } from '../../lib/auth';

export default function OrderDetailsPage() {
  const router = useRouter();
  const { id } = router.query;
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [proofFile, setProofFile] = useState(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [proofUploadId, setProofUploadId] = useState(null);
  const [confirmStatus, setConfirmStatus] = useState('');

  useEffect(() => {
    if (!id) return;
    async function loadOrder() {
      setLoading(true);
      setError('');
      try {
        const data = await fetchJson(`/api/orders/${id}`, {
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        });
        setOrder(data);
      } catch (err) {
        setError(err.message || 'Unable to load order details');
      } finally {
        setLoading(false);
      }
    }
    loadOrder();
  }, [id]);

  useEffect(() => {
    if (!id || !getToken()) return;
    const eventSource = new EventSource(`${API_BASE}/api/orders/${id}/live`, {
      withCredentials: true,
    });

    eventSource.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      setOrder((current) => current ? { ...current, status: payload.status || current.status } : current);
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => eventSource.close();
  }, [id]);

  if (!getToken()) {
    return (
      <main className="container">
        <section className="page-hero">
          <p className="badge">Order</p>
          <h1>Login required</h1>
          <p>Sign in to view your order details.</p>
          <Link href="/login" className="button">Login</Link>
        </section>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="container">
        <p>Loading order details…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="container">
        <p>{error}</p>
        <Link href="/orders" className="button secondary">Back to orders</Link>
      </main>
    );
  }

  if (!order) {
    return null;
  }

  return (
    <main className="container">
      <section className="page-hero">
        <p className="badge">Order Details</p>
        <h1>Order #{order.id}</h1>
        <p>Track the progress of your booking and payment status.</p>
      </section>

      <section className="card detail-grid">
        <div className="detail-panel">
          <div className="card-meta">
            <span>Status</span>
            <span>{order.status}</span>
          </div>
          <div className="card-meta">
            <span>Ordered</span>
            <span>{new Date(order.requestedAt).toLocaleDateString()}</span>
          </div>
          <div className="card-meta">
            <span>Total</span>
            <span>${order.totalPrice.toFixed(2)}</span>
          </div>
          <div className="card-meta">
            <span>Payment</span>
            <span>{order.paymentMethod || 'Pending'}</span>
          </div>
          {order.checkout?.checkoutUrl && (
            <div className="card-meta">
              <span>Checkout</span>
              <a href={order.checkout.checkoutUrl} target="_blank" rel="noreferrer">Open payment link</a>
            </div>
          )}
          {/* Bank QR static payment display */}
          {(order.checkout?.provider === 'bank_qr' || order.paymentMethod === 'Bank QR') && (
            <div className="card-meta bank-qr">
              <h3>Pay with Bank QR</h3>
              {order.checkout?.qrUrl ? (
                <img src={order.checkout.qrUrl} alt="Bank QR" style={{ maxWidth: 280, borderRadius: 8 }} />
              ) : (
                <p>No QR image available.</p>
              )}
              <p><strong>Account:</strong> {order.checkout?.accountName || '—'}</p>
              <p><strong>Number:</strong> {order.checkout?.accountNumber || '—'}</p>
              <p><strong>Bank:</strong> {order.checkout?.bankName || '—'}</p>

              <div style={{ marginTop: 12 }}>
                <label className="input-group">
                  <span>Upload payment proof (screenshot)</span>
                  <input type="file" accept="image/*" onChange={(e) => setProofFile(e.target.files?.[0] || null)} />
                </label>
                <div style={{ marginTop: 8 }}>
                  <button className="button" disabled={!proofFile || uploadingProof} onClick={async () => {
                    if (!proofFile) return;
                    setUploadingProof(true);
                    setConfirmStatus('');
                    try {
                      const form = new FormData();
                      form.append('photo', proofFile);
                      const res = await fetch(`${API_BASE}/api/uploads`, {
                        method: 'POST',
                        headers: { ...authHeaders() },
                        body: form,
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error || 'Upload failed');
                      setProofUploadId(data.id);
                      // Confirm payment
                      const confirmRes = await fetch(`${API_BASE}/api/orders/${order.id}/confirm-payment`, {
                        method: 'POST',
                        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
                        body: JSON.stringify({ providerReference: null, uploadId: data.id }),
                      });
                      const confirmData = await confirmRes.json();
                      if (!confirmRes.ok) throw new Error(confirmData.error || 'Confirmation failed');
                      setConfirmStatus('Confirmation submitted — awaiting verification');
                    } catch (err) {
                      setConfirmStatus(err.message || 'Unable to submit proof');
                    } finally {
                      setUploadingProof(false);
                    }
                  }}>{uploadingProof ? 'Uploading…' : 'Upload proof & confirm'}</button>
                </div>
                {confirmStatus && <p className="callout">{confirmStatus}</p>}
              </div>
            </div>
          )}
          <div className="card-meta">
            <span>Lab</span>
            <span>{order.FilmLab?.name || 'Unknown'}</span>
          </div>
          {order.transactions?.length > 0 && (
            <div className="transaction-list">
              <h3>Payment history</h3>
              {order.transactions.map((transaction) => (
                <div key={transaction.id} className="transaction-row">
                  <span>{transaction.paymentMethod}</span>
                  <span>${transaction.amount.toFixed(2)}</span>
                  <span>{transaction.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <aside className="detail-panel">
          <h2>Order items</h2>
          {order.items?.length > 0 ? (
            <ul className="order-items-list">
              {order.items.map((item) => (
                <li key={item.id}>
                  <div>
                    <strong>{item.itemType}</strong>
                    <p>ID: {item.itemId}</p>
                  </div>
                  <div>
                    <span>{item.quantity} × ${item.unitPrice.toFixed(2)}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p>No items were attached to this order.</p>
          )}
          <div className="card-footer" style={{ marginTop: '1.5rem' }}>
            <Link href="/orders" className="button secondary">Back to orders</Link>
          </div>
        </aside>
      </section>
    </main>
  );
}

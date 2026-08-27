import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchJson } from '../../lib/api';
import { getToken, authHeaders } from '../../lib/auth';

const paymentOptions = ['Card', 'Bank Transfer', 'Bank QR', 'Cash on Pickup'];

export default function LabDetails() {
  const router = useRouter();
  const { id } = router.query;
  const [lab, setLab] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [paymentMethod, setPaymentMethod] = useState(paymentOptions[0]);
  const [orderItems, setOrderItems] = useState([]);
  const [bookingStatus, setBookingStatus] = useState(null);
  const [bookingError, setBookingError] = useState(null);

  const orderTotal = orderItems.reduce((sum, item) => sum + (item.quantity || 0) * item.unitPrice, 0);

  useEffect(() => {
    if (!id) return;

    const fetchLab = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchJson(`/api/film-labs/${id}`);
        setLab(data);
        setOrderItems(
          (data.packages || []).map((pkg) => ({
            itemType: 'package',
            itemId: pkg.id,
            title: pkg.title,
            unitPrice: pkg.price || 0,
            quantity: 1,
          }))
        );
      } catch (err) {
        setError(err.message || 'Unable to load lab details');
      } finally {
        setLoading(false);
      }
    };

    fetchLab();
  }, [id]);

  const handleReviewSubmit = async (event) => {
    event.preventDefault();
    const token = getToken();
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      await fetchJson(`/api/reviews/film-lab/${id}`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, reviewText }),
      });
      setReviewText('');
      const refreshed = await fetchJson(`/api/film-labs/${id}`);
      setLab(refreshed);
      setBookingStatus('Review submitted successfully.');
    } catch (err) {
      setBookingError(err.message || 'Unable to submit review');
    }
  };

  const handleOrderSubmit = async () => {
    const token = getToken();
    if (!token) {
      router.push('/login');
      return;
    }

    const items = orderItems.filter((item) => item.quantity > 0).map((item) => ({
      itemType: item.itemType,
      itemId: item.itemId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    }));

    if (items.length === 0) {
      setBookingError('Please select at least one package to book.');
      return;
    }

    try {
      setBookingError(null);
      const order = await fetchJson('/api/orders', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ labId: id, items, dueDate: null, trackingCode: null, paymentMethod, createCheckout: true }),
      });
      setBookingStatus(`Booking created: ${order.id}. Payment method: ${paymentMethod}.`);
    } catch (err) {
      setBookingError(err.message || 'Unable to create booking');
    }
  };

  const updateQuantity = (index, value) => {
    setOrderItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], quantity: Number(value) };
      return next;
    });
  };

  if (loading) {
    return (
      <main className="container">
        <p>Loading film lab details…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="container">
        <p>{error}</p>
        <Link href="/labs" className="button secondary">Back to Labs</Link>
      </main>
    );
  }

  if (!lab) {
    return null;
  }

  return (
    <main className="container lab-details-page">
      <section className="lab-details-hero">
        <div className="lab-details-copy">
          <p className="badge">Film Lab</p>
          <h1>{lab.name}</h1>
          <p>{lab.description || 'Trusted film lab for development, scanning, and printing.'}</p>
          <div className="lab-details-meta">
            <span>⭐ {lab.rating?.toFixed(1) || '—'}</span>
            <span>{lab.address}, {lab.city}, {lab.country}</span>
            <span>{lab.priceRange || 'Pricing on request'}</span>
          </div>
          <div className="lab-details-actions">
            <button type="button" className="button" onClick={handleOrderSubmit}>Book now</button>
            <Link href="/labs" className="button secondary">Back to labs</Link>
          </div>
          {bookingStatus && <div className="success-message">{bookingStatus}</div>}
          {bookingError && <div className="form-error">{bookingError}</div>}
        </div>
        <div className="lab-details-image">
          <img src={lab.photoUrl || '/film-camera.jpg'} alt={lab.name} />
        </div>
      </section>

      <section className="lab-details-grid">
        <div className="lab-details-panel">
          <div className="lab-section-card">
            <h2>Services</h2>
            {lab.services?.length > 0 ? (
              <ul>
                {lab.services.map((service) => (
                  <li key={service.id}>
                    <strong>{service.name}</strong>
                    <p>{service.description || service.serviceType}</p>
                    <span>{service.price ? `${service.price.toLocaleString()}đ` : 'Contact'}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No service details available yet.</p>
            )}
          </div>

          <div className="lab-section-card">
            <h2>Packages</h2>
            {lab.packages?.length > 0 ? (
              <>
                <ul>
                  {lab.packages.map((pkg, index) => (
                    <li key={pkg.id} className="package-row">
                      <div>
                        <strong>{pkg.title}</strong>
                        <p>{pkg.description}</p>
                      </div>
                      <div className="package-booking">
                        <span>{pkg.price ? `${pkg.price.toLocaleString()}đ` : 'Contact'}</span>
                        <input
                          type="number"
                          min="0"
                          value={orderItems[index]?.quantity ?? 0}
                          onChange={(event) => updateQuantity(index, event.target.value)}
                          className="input"
                        />
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="booking-summary">
                  <strong>Total</strong>
                  <span>{orderTotal.toLocaleString()}đ</span>
                </div>
                <div className="payment-method-card">
                  <h3>Payment method</h3>
                  <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="select">
                    {paymentOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <p>No package details available yet.</p>
            )}
          </div>

          <div className="lab-section-card">
            <h2>Write a review</h2>
            <form className="review-form" onSubmit={handleReviewSubmit}>
              <label>
                Rating
                <select value={rating} onChange={(event) => setRating(Number(event.target.value))} className="select">
                  {[5, 4, 3, 2, 1].map((value) => (
                    <option key={value} value={value}>{value} stars</option>
                  ))}
                </select>
              </label>
              <label>
                Your review
                <textarea
                  value={reviewText}
                  onChange={(event) => setReviewText(event.target.value)}
                  className="textarea"
                  placeholder="Share your experience with this lab"
                />
              </label>
              <button type="submit" className="button">Submit review</button>
            </form>
          </div>
        </div>

        <aside className="lab-details-side">
          <div className="sidebar-card">
            <h3>About this lab</h3>
            <p>{lab.description || 'Trusted lab with experienced analog staff, premium scanning, and printing services.'}</p>
          </div>

          <div className="sidebar-card">
            <h3>Reviews</h3>
            {lab.reviews?.length > 0 ? (
              lab.reviews.map((review) => (
                <div key={review.id} className="review-card">
                  <strong>{review.rating} stars</strong>
                  <p>{review.reviewText}</p>
                </div>
              ))
            ) : (
              <p>No reviews yet. Be the first to review this lab.</p>
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}

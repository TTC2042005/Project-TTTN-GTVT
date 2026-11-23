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

const normalizeCatalogText = (value = '') => String(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[đĐ]/g, 'd')
  .toLowerCase()
  .trim();

export default function MarketplaceDetail() {
  const router = useRouter();
  const { id } = router.query;
  const itemId = Array.isArray(id) ? id[0] : id;
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [inventoryStatus, setInventoryStatus] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [order, setOrder] = useState(null);
  const [proofFile, setProofFile] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState('');
  const [purchasing, setPurchasing] = useState(false);
  const [screenings, setScreenings] = useState([]);
  const [selectedScreeningId, setSelectedScreeningId] = useState('');
  const [ticketQuantity, setTicketQuantity] = useState(1);
  const [reservations, setReservations] = useState([]);
  const [screeningLoading, setScreeningLoading] = useState(false);
  const [screeningError, setScreeningError] = useState('');
  const [bookingStatus, setBookingStatus] = useState('');
  const [bookingBusy, setBookingBusy] = useState(false);
  const isStaticFilm = product?.category === 'Film' && String(product.id).startsWith('static-film-');
  const isCatalogItem = String(product?.id || '').startsWith('static-');
  const selectedScreening = screenings.find((screening) => screening.id === selectedScreeningId);
  const alreadyReserved = reservations.some((reservation) => reservation.screening?.id === selectedScreeningId);

  useEffect(() => {
    if (!itemId) return;

    async function loadProduct() {
      setLoading(true);
      setError('');
      setInventoryStatus('');
      setProduct(null);
      try {
        let data;
        if (String(itemId).startsWith('static-')) {
          const catalogPath = String(itemId).startsWith('static-film-')
            ? '/api/static-films'
            : String(itemId).startsWith('static-lens-')
              ? '/api/static-lenses'
              : '/api/static-cameras';
          const response = await fetch(catalogPath);
          if (!response.ok) throw new Error(`Could not load catalog (${response.status})`);
          const catalog = await response.json();
          data = catalog.find((item) => item.id === itemId);
          if (!data) throw new Error('Catalog item not found');
          if (data.category === 'Cameras' || data.category === 'Lenses') {
            try {
              const listings = await fetchJson(`/api/marketplace/listings?category=${encodeURIComponent(data.category)}`);
              if (!Array.isArray(listings)) throw new Error('Marketplace listings returned an invalid response');
              const liveListing = listings.find((listing) => (
                normalizeCatalogText(listing.title) === normalizeCatalogText(data.title)
                && normalizeCatalogText(listing.category) === normalizeCatalogText(data.category)
              ));
              if (liveListing) {
                data = { ...liveListing, imageUrl: liveListing.imageUrl || data.imageUrl };
              } else {
                setInventoryStatus('This catalog item is not for sale yet. A seller must publish a live database listing before it can be purchased.');
              }
            } catch (listingError) {
              setInventoryStatus(`Could not verify live stock: ${listingError.message}`);
            }
          }
        } else {
          data = await fetchJson(`/api/marketplace/listings/${encodeURIComponent(itemId)}`);
        }
        setProduct(data);
      } catch (err) {
        setError(err.message || 'Could not load product');
      } finally {
        setLoading(false);
      }
    }

    loadProduct();
  }, [itemId]);

  const loadFilmBookings = async (filmTitle) => {
    setScreeningLoading(true);
    setScreeningError('');
    try {
      const availableScreenings = await fetchJson(`/api/film-screenings?filmTitle=${encodeURIComponent(filmTitle)}`);
      setScreenings(availableScreenings);
      if (!availableScreenings.some((screening) => screening.id === selectedScreeningId)) {
        setSelectedScreeningId(availableScreenings[0]?.id || '');
      }

      if (getToken()) {
        try {
          const myReservations = await fetchJson('/api/film-screenings/my-reservations', { headers: authHeaders() });
          setReservations(myReservations.filter((reservation) => (
            reservation.status === 'reserved' && reservation.screening?.filmTitle === filmTitle
          )));
        } catch (err) {
          setBookingStatus(err.message || 'Could not load your reservations');
        }
      } else {
        setReservations([]);
      }
    } catch (err) {
      setScreenings([]);
      setScreeningError(err.message || 'Could not load film showtimes');
    } finally {
      setScreeningLoading(false);
    }
  };

  useEffect(() => {
    if (isStaticFilm && product) loadFilmBookings(product.title);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product]);

  const handleReservation = async () => {
    if (!getToken()) {
      router.push(`/login?returnTo=${encodeURIComponent(router.asPath)}`);
      return;
    }
    if (!selectedScreeningId) return;

    setBookingBusy(true);
    setBookingStatus('');
    try {
      await fetchJson(`/api/film-screenings/${selectedScreeningId}/reservations`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: Number(ticketQuantity) }),
      });
      setBookingStatus('Reservation confirmed. Payment is not required for this booking.');
      await loadFilmBookings(product.title);
    } catch (err) {
      setBookingStatus(err.message || 'Could not reserve tickets');
    } finally {
      setBookingBusy(false);
    }
  };

  const handleCancelReservation = async (reservationId) => {
    setBookingBusy(true);
    setBookingStatus('');
    try {
      await fetchJson(`/api/film-screenings/reservations/${reservationId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      setBookingStatus('Reservation cancelled.');
      await loadFilmBookings(product.title);
    } catch (err) {
      setBookingStatus(err.message || 'Could not cancel reservation');
    } finally {
      setBookingBusy(false);
    }
  };

  const handlePurchase = async () => {
    if (!getToken()) {
      router.push(`/login?returnTo=${encodeURIComponent(router.asPath)}`);
      return;
    }

    setPurchasing(true);
    setPaymentStatus('');
    try {
      const response = await fetch(`${API_BASE}/api/marketplace/orders`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id, quantity: Number(quantity), paymentMethod: 'Bank QR' }),
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
        <p>{isStaticFilm ? 'Choose a screening time and venue to reserve tickets.' : 'Review listing information, seller details, pricing, and item condition.'}</p>
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
                <span>{isStaticFilm ? 'Select a showtime for ticket price' : `${isCatalogItem ? 'Catalog reference: ' : ''}$${Number(product.price || 0).toLocaleString('en-US')}`}</span>
              </div>

              <p>{product.description}</p>
              {isStaticFilm && <Link href="/marketplace" className="button secondary">Back to marketplace</Link>}
            </div>

            <aside className="detail-panel">
              {isStaticFilm ? (
                <>
                  <h2>Movie showtimes</h2>
                  {screeningLoading ? (
                    <p>Loading showtimes…</p>
                  ) : screenings.length === 0 ? (
                    <>
                      <p className="callout">{screeningError || 'No upcoming screenings have been published yet. An admin must add verified showtime details.'}</p>
                      <button type="button" className="button" disabled>Book movie ticket</button>
                    </>
                  ) : (
                    <>
                      <div className="screening-list">
                        {screenings.map((screening) => (
                          <label key={screening.id} className={`screening-option ${selectedScreeningId === screening.id ? 'selected' : ''}`}>
                            <input
                              type="radio"
                              name="film-screening"
                              value={screening.id}
                              checked={selectedScreeningId === screening.id}
                              onChange={() => { setSelectedScreeningId(screening.id); setTicketQuantity(1); }}
                            />
                            <span>
                              <strong>{new Date(screening.eventDate).toLocaleString('vi-VN')}</strong>
                              <span>{screening.venueName}</span>
                              <span>{screening.venueAddress}</span>
                              <span>${Number(screening.ticketPrice).toLocaleString('en-US')} · {screening.availableTickets} tickets left</span>
                            </span>
                          </label>
                        ))}
                      </div>
                      <label className="quantity-control">
                        <span>Tickets</span>
                        <input
                          className="input"
                          type="number"
                          min="1"
                          step="1"
                          max={Math.min(10, selectedScreening?.availableTickets || 1)}
                          value={ticketQuantity}
                          onChange={(event) => setTicketQuantity(event.target.value)}
                        />
                      </label>
                      <button
                        type="button"
                        className="button"
                        onClick={handleReservation}
                        disabled={bookingBusy || alreadyReserved || !selectedScreeningId || !selectedScreening?.availableTickets || !Number.isInteger(Number(ticketQuantity)) || Number(ticketQuantity) < 1 || Number(ticketQuantity) > Math.min(10, selectedScreening.availableTickets)}
                      >
                        {bookingBusy ? 'Processing…' : alreadyReserved ? 'Already reserved' : 'Book movie ticket'}
                      </button>
                    </>
                  )}
                  {reservations.length > 0 && (
                    <div className="reservation-list">
                      <h3>Your reservations</h3>
                      {reservations.map((reservation) => (
                        <div key={reservation.id} className="reservation-item">
                          <span>
                            {reservation.quantity} ticket(s) · {new Date(reservation.screening.eventDate).toLocaleString('vi-VN')}
                            <br />
                            {reservation.screening.venueName}
                          </span>
                          <button
                            type="button"
                            className="button secondary"
                            onClick={() => handleCancelReservation(reservation.id)}
                            disabled={bookingBusy}
                          >
                            Cancel
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {bookingStatus && <p className="callout" role="status">{bookingStatus}</p>}
                </>
              ) : (
                <>
              <div className="card-meta">
                <span>Seller</span>
                <span>{product.seller?.name || (isCatalogItem ? 'Website catalog' : 'Unknown')}</span>
              </div>
              <div className="card-meta">
                <span>Location</span>
                <span>{product.location || (isCatalogItem ? 'Catalog item' : 'Not listed')}</span>
              </div>
              <div className="card-meta">
                <span>Condition</span>
                <span>{product.condition || 'N/A'}</span>
              </div>
              <div className="card-meta">
                <span>Stock</span>
                <span>{isCatalogItem ? 'Reference only' : Number(product.stock) > 0 ? `${product.stock} available` : 'Sold out'}</span>
              </div>
              <div className="card-footer" style={{ marginTop: '1.5rem' }}>
                <Link href="/marketplace" className="button secondary">Back to marketplace</Link>
                {isCatalogItem && !isStaticFilm && (
                  <button type="button" className="button" disabled>Buy</button>
                )}
                {!isCatalogItem && !order && (
                  <>
                    <label className="quantity-control">
                      <span>Quantity</span>
                      <input className="input" type="number" min="1" max={product.stock || 1} value={quantity} onChange={(event) => setQuantity(event.target.value)} />
                    </label>
                    <button type="button" className="button" onClick={handlePurchase} disabled={purchasing || Number(quantity) < 1 || Number(quantity) > Number(product.stock)}>
                      {purchasing ? 'Creating order…' : 'Buy now'}
                    </button>
                  </>
                )}
              </div>
              {isCatalogItem && !isStaticFilm && <p className="callout" role="status">{inventoryStatus || 'This is a catalog reference, not a live listing for purchase.'}</p>}
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
                </>
              )}
            </aside>
          </div>
        ) : (
          <p>Listing not found.</p>
        )}
      </section>
    </main>
  );
}

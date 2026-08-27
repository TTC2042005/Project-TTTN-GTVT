import useSWR from 'swr';
import Link from 'next/link';
import { API_BASE, fetchJson } from '../lib/api';
import { getToken, authHeaders } from '../lib/auth';

const fetcher = async (url) => {
  const headers = { ...authHeaders(), 'Content-Type': 'application/json' };
  const res = await fetch(`${API_BASE}${url}`, { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Unable to fetch orders');
  return data;
};

export default function OrdersPage() {
  const token = getToken();
  const { data, error } = useSWR(token ? '/api/orders' : null, fetcher);

  if (!token) return (
    <main className="container">
      <section className="page-hero">
        <p className="badge">Orders</p>
        <h1>Review your orders</h1>
        <p>Sign in to track requests, print orders, and lab deliveries.</p>
        <Link href="/login" className="button">Login</Link>
      </section>
    </main>
  );

  if (error) return <main className="container"><p>Error: {error.message}</p></main>;
  if (!data) return <main className="container"><p>Loading orders...</p></main>;

  return (
    <main className="container">
      <section className="page-hero">
        <p className="badge">Orders</p>
        <h1>My Orders</h1>
        <p>Track the status of your film lab requests and marketplace purchases.</p>
      </section>

      {data.length === 0 ? (
        <section className="card">
          <h2>No orders yet</h2>
          <p>Start by booking a lab service or purchasing film gear from the marketplace.</p>
        </section>
      ) : (
        <section className="detail-grid">
          <aside className="card detail-panel">
            <h2>Order summary</h2>
            <p>Quick access to the most recent orders and status updates.</p>
            <div className="card-meta">
              <span>Total orders</span>
              <span>{data.length}</span>
            </div>
            <div className="card-meta">
              <span>Pending</span>
              <span>{data.filter((order) => order.status === 'pending').length}</span>
            </div>
            <div className="card-meta">
              <span>Completed</span>
              <span>{data.filter((order) => order.status === 'completed').length}</span>
            </div>
            <div className="card-meta">
              <span>Most recent</span>
              <span>{new Date(data[0].requestedAt).toLocaleDateString()}</span>
            </div>
          </aside>

          <section className="card-grid">
            {data.map((order) => (
              <article key={order.id} className="card">
                <div className="card-meta">
                  <span>Order #{order.id}</span>
                  <span>{new Date(order.requestedAt).toLocaleDateString()}</span>
                </div>
                <h3>{order.status}</h3>
                <p><strong>Total:</strong> ${order.totalPrice.toFixed(2)}</p>
                <p><strong>Items:</strong> {order.items?.length || 0}</p>
                <p><strong>Delivery:</strong> {order.deliveryStatus || 'Processing'}</p>
                <div className="card-footer">
                  <Link href={`/order/${order.id}`} className="button secondary">View details</Link>
                </div>
              </article>
            ))}
          </section>
        </section>
      )}
    </main>
  );
}

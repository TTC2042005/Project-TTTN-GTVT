import { useEffect, useState } from 'react';
import Link from 'next/link';
import { API_BASE } from '../lib/api';
import { getToken, authHeaders } from '../lib/auth';

export default function AdminDashboardPage() {
  const [overview, setOverview] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadAdminData() {
      try {
        const [overviewRes, ordersRes] = await Promise.all([
          fetch(`${API_BASE}/api/admin/overview`, { headers: authHeaders() }),
          fetch(`${API_BASE}/api/admin/orders`, { headers: authHeaders() }),
        ]);
        const overviewData = await overviewRes.json();
        const ordersData = await ordersRes.json();
        if (!overviewRes.ok || !ordersRes.ok) throw new Error(overviewData.error || ordersData.error || 'Unable to load admin dashboard');
        setOverview(overviewData);
        setOrders(ordersData);
      } catch (err) {
        setError(err.message || 'Unable to load admin dashboard');
      } finally {
        setLoading(false);
      }
    }

    if (getToken()) {
      loadAdminData();
    } else {
      setLoading(false);
    }
  }, []);

  if (!getToken()) {
    return (
      <main className="container">
        <section className="page-hero">
          <p className="badge">Admin Dashboard</p>
          <h1>Access restricted</h1>
          <p>Please sign in with an administrator account.</p>
          <Link href="/login" className="button">Login</Link>
        </section>
      </main>
    );
  }

  if (loading) return <main className="container"><p>Loading admin dashboard...</p></main>;
  if (error) return <main className="container"><p>{error}</p></main>;

  return (
    <main className="container">
      <section className="page-hero">
        <p className="badge">Admin Dashboard</p>
        <h1>Operations intelligence</h1>
        <p>Monitor payments, orders, users, and storage activity from one place.</p>
      </section>

      <section className="detail-grid">
        <article className="card">
          <h2>At a glance</h2>
          <div className="card-meta"><span>Total Orders</span><span>{overview?.totalOrders ?? 0}</span></div>
          <div className="card-meta"><span>Revenue</span><span>{(overview?.totalRevenue || 0).toLocaleString()}đ</span></div>
          <div className="card-meta"><span>Users</span><span>{overview?.totalUsers ?? 0}</span></div>
          <div className="card-meta"><span>Labs</span><span>{overview?.labs ?? 0}</span></div>
          <div className="card-meta"><span>Products</span><span>{overview?.products ?? 0}</span></div>
          <div className="card-meta"><span>Reviews</span><span>{overview?.reviews ?? 0}</span></div>
          <div className="card-meta"><span>Transactions</span><span>{overview?.transactions ?? 0}</span></div>
        </article>

        <article className="card">
          <h2>Order pipeline</h2>
          <div className="card-meta"><span>Pending</span><span>{overview?.pendingOrders ?? 0}</span></div>
          <div className="card-meta"><span>Processing</span><span>{overview?.processingOrders ?? 0}</span></div>
          <div className="card-meta"><span>Completed</span><span>{overview?.completedOrders ?? 0}</span></div>
        </article>
      </section>

      <section className="card" style={{ marginTop: '1.5rem' }}>
        <h2>Recent orders</h2>
        {orders.length === 0 ? <p>No orders yet.</p> : orders.map((order) => (
          <div key={order.id} className="upload-card">
            <div>
              <strong>#{order.id.slice(0, 8)} • {order.User?.name || 'Unknown'}</strong>
              <p>{order.status} • {order.totalPrice?.toLocaleString()}đ</p>
            </div>
            <span>{order.FilmLab?.name || 'Unassigned'}</span>
          </div>
        ))}
      </section>
    </main>
  );
}

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { API_BASE } from '../lib/api';
import { getToken, authHeaders } from '../lib/auth';

export default function LabDashboardPage() {
  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [statsRes, ordersRes] = await Promise.all([
          fetch(`${API_BASE}/api/lab-management/dashboard`, { headers: authHeaders() }),
          fetch(`${API_BASE}/api/lab-management/orders`, { headers: authHeaders() }),
        ]);
        const statsData = await statsRes.json();
        const ordersData = await ordersRes.json();
        if (!statsRes.ok || !ordersRes.ok) throw new Error(statsData.error || ordersData.error || 'Unable to load dashboard');
        setStats(statsData);
        setOrders(ordersData);
      } catch (err) {
        setError(err.message || 'Unable to load dashboard');
      } finally {
        setLoading(false);
      }
    }

    if (getToken()) {
      loadDashboard();
    } else {
      setLoading(false);
    }
  }, []);

  if (!getToken()) {
    return (
      <main className="container">
        <section className="page-hero">
          <p className="badge">Lab Dashboard</p>
          <h1>Sign in to manage your lab</h1>
          <p>Lab owners and admins can review orders, pricing, and reports here.</p>
          <Link href="/login" className="button">Login</Link>
        </section>
      </main>
    );
  }

  if (loading) return <main className="container"><p>Loading dashboard...</p></main>;
  if (error) return <main className="container"><p>{error}</p></main>;

  return (
    <main className="container">
      <section className="page-hero">
        <p className="badge">Lab Dashboard</p>
        <h1>Operations overview</h1>
        <p>Review active orders, revenue, and customer activity from one place.</p>
      </section>

      <section className="detail-grid">
        <article className="card">
          <h2>Today at a glance</h2>
          <div className="card-meta"><span>Total orders</span><span>{stats?.totalOrders ?? 0}</span></div>
          <div className="card-meta"><span>Processing</span><span>{stats?.processingOrders ?? 0}</span></div>
          <div className="card-meta"><span>Revenue</span><span>{stats?.totalRevenue?.toLocaleString() ?? 0}đ</span></div>
          <div className="card-meta"><span>New customers</span><span>{stats?.newCustomers ?? 0}</span></div>
        </article>

        <article className="card">
          <h2>Recent orders</h2>
          {orders.length === 0 ? <p>No orders yet.</p> : orders.map((order) => (
            <div key={order.id} className="upload-card">
              <div>
                <strong>Order #{order.id.slice(0, 8)}</strong>
                <p>{order.status} • {order.totalPrice?.toLocaleString()}đ</p>
              </div>
              <span>{new Date(order.createdAt).toLocaleDateString()}</span>
            </div>
          ))}
        </article>
      </section>
    </main>
  );
}

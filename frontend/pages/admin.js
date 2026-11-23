import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchJson } from '../lib/api';
import { authHeaders, getToken, removeToken, removeUser } from '../lib/auth';

const sections = [
  { id: 'overview', label: 'Tổng quan' },
  { id: 'marketplace', label: 'Marketplace' },
  { id: 'screenings', label: 'Suất chiếu & vé' },
  { id: 'accounts-labs', label: 'Tài khoản & Film Lab' },
  { id: 'events-content', label: 'Sự kiện & nội dung' },
  { id: 'payments-logs', label: 'Thanh toán & nhật ký' },
];

const emptyEvent = {
  eventType: 'workshop',
  title: '',
  description: '',
  location: '',
  eventDate: '',
  capacity: '',
  isPublished: false,
};

const emptyScreening = {
  filmTitle: '',
  eventDate: '',
  venueName: '',
  venueAddress: '',
  capacity: '',
  ticketPrice: '',
};

const emptyListing = {
  title: '',
  category: 'Cameras',
  condition: 'Used',
  price: '',
  stock: '',
  description: '',
};

const orderTransitions = {
  pending: ['paid', 'cancelled'],
  paid: ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  shipped: ['completed'],
  completed: [],
  cancelled: [],
};

const labOrderTransitions = {
  pending: ['received', 'processing', 'cancelled'],
  received: ['processing', 'cancelled'],
  processing: ['scanning', 'cancelled'],
  scanning: ['completed', 'cancelled'],
  completed: ['delivered'],
};

function formatCurrency(value, currency = 'USD') {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency,
    minimumFractionDigits: currency === 'VND' ? 0 : 2,
    maximumFractionDigits: currency === 'VND' ? 0 : 2,
  }).format(Number(value) || 0);
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString('vi-VN') : '—';
}

function localDateTimeValue(value) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default function AdminDashboardPage() {
  const [access, setAccess] = useState('checking');
  const [activeSection, setActiveSection] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [labOrders, setLabOrders] = useState([]);
  const [listings, setListings] = useState([]);
  const [marketplaceOrders, setMarketplaceOrders] = useState([]);
  const [screenings, setScreenings] = useState([]);
  const [catalogItems, setCatalogItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [labs, setLabs] = useState([]);
  const [events, setEvents] = useState([]);
  const [posts, setPosts] = useState([]);
  const [reports, setReports] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editingScreeningId, setEditingScreeningId] = useState('');
  const [screeningForm, setScreeningForm] = useState(emptyScreening);
  const [listingForm, setListingForm] = useState(emptyListing);
  const [eventForm, setEventForm] = useState(emptyEvent);
  const [editingEvent, setEditingEvent] = useState(null);
  const [userSearch, setUserSearch] = useState('');

  async function loadAdminData() {
    const [
      overviewData,
      ordersData,
      listingsData,
      marketplaceOrdersData,
      screeningsData,
      usersData,
      labsData,
      eventsData,
      postsData,
      reportsData,
      transactionsData,
      auditData,
    ] = await Promise.all([
      fetchJson('/api/admin/overview', { headers: authHeaders() }),
      fetchJson('/api/admin/orders', { headers: authHeaders() }),
      fetchJson('/api/admin/marketplace/listings', { headers: authHeaders() }),
      fetchJson('/api/admin/marketplace/orders', { headers: authHeaders() }),
      fetchJson('/api/admin/film-screenings', { headers: authHeaders() }),
      fetchJson('/api/admin/users', { headers: authHeaders() }),
      fetchJson('/api/admin/labs', { headers: authHeaders() }),
      fetchJson('/api/admin/events', { headers: authHeaders() }),
      fetchJson('/api/admin/content/posts', { headers: authHeaders() }),
      fetchJson('/api/admin/reports', { headers: authHeaders() }),
      fetchJson('/api/admin/transactions', { headers: authHeaders() }),
      fetchJson('/api/admin/audit-logs', { headers: authHeaders() }),
    ]);
    setOverview(overviewData);
    setLabOrders(ordersData);
    setListings(listingsData);
    setMarketplaceOrders(marketplaceOrdersData);
    setScreenings(screeningsData);
    setUsers(usersData);
    setLabs(labsData);
    setEvents(eventsData);
    setPosts(postsData);
    setReports(reportsData);
    setTransactions(transactionsData);
    setAuditLogs(auditData);

    const catalogResults = await Promise.allSettled([
      fetch('/api/static-cameras'),
      fetch('/api/static-lenses'),
    ]);
    const items = [];
    for (const result of catalogResults) {
      if (result.status !== 'fulfilled' || !result.value.ok) continue;
      const catalog = await result.value.json();
      if (Array.isArray(catalog)) items.push(...catalog);
    }
    setCatalogItems(items);
  }

  async function reloadAdminData() {
    setLoading(true);
    setError('');
    try {
      await loadAdminData();
      setAccess('admin');
    } catch (loadError) {
      if (loadError.status === 401 || loadError.status === 403) {
        setAccess('forbidden');
      } else {
        setError(loadError.message || 'Không thể tải dữ liệu quản trị.');
        setAccess('error');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!getToken()) {
      setAccess('guest');
      setLoading(false);
      return;
    }

    reloadAdminData();
    // Load once after the token is available in localStorage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clearFeedback() {
    setError('');
    setNotice('');
  }

  async function saveScreening(event) {
    event.preventDefault();
    clearFeedback();
    setSaving(true);
    try {
      const body = {
        ...screeningForm,
        eventDate: new Date(screeningForm.eventDate).toISOString(),
        capacity: Number(screeningForm.capacity),
        ticketPrice: Number(screeningForm.ticketPrice),
      };
      await fetchJson(
        editingScreeningId ? `/api/film-screenings/${editingScreeningId}` : '/api/film-screenings',
        {
          method: editingScreeningId ? 'PATCH' : 'POST',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      setNotice(editingScreeningId ? 'Đã cập nhật suất chiếu.' : 'Đã tạo suất chiếu.');
      setEditingScreeningId('');
      setScreeningForm(emptyScreening);
      await loadAdminData();
    } catch (saveError) {
      setError(saveError.message || 'Không thể lưu suất chiếu.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleScreening(screening) {
    clearFeedback();
    setSaving(true);
    try {
      await fetchJson(`/api/film-screenings/${screening.id}`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublished: !screening.isPublished }),
      });
      setNotice(screening.isPublished ? 'Đã ẩn suất chiếu.' : 'Đã công bố suất chiếu.');
      await loadAdminData();
    } catch (saveError) {
      setError(saveError.message || 'Không thể cập nhật suất chiếu.');
    } finally {
      setSaving(false);
    }
  }

  async function saveListing(event) {
    event.preventDefault();
    clearFeedback();
    setSaving(true);
    try {
      const catalogItem = catalogItems.find((item) => item.title === listingForm.title);
      await fetchJson('/api/marketplace/listings', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...listingForm,
          price: Number(listingForm.price),
          stock: Number(listingForm.stock),
          imageUrl: catalogItem?.imageUrl || '',
        }),
      });
      setNotice('Đã tạo listing thật. Sản phẩm tương ứng trong catalog có thể mua ngay.');
      setListingForm(emptyListing);
      await loadAdminData();
    } catch (saveError) {
      setError(saveError.message || 'Không thể tạo listing.');
    } finally {
      setSaving(false);
    }
  }

  async function removeListing(listing) {
    if (!window.confirm(`Xóa listing "${listing.title}"?`)) return;
    clearFeedback();
    setSaving(true);
    try {
      await fetchJson(`/api/marketplace/listings/${listing.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      setNotice('Đã xóa listing.');
      await loadAdminData();
    } catch (saveError) {
      setError(saveError.message || 'Không thể xóa listing.');
    } finally {
      setSaving(false);
    }
  }

  async function updateMarketplaceOrder(order, status) {
    if (status === 'cancelled' && !window.confirm('Bạn có chắc muốn hủy đơn này?')) return;
    clearFeedback();
    setSaving(true);
    try {
      await fetchJson(`/api/marketplace/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      setNotice('Đã cập nhật trạng thái đơn Marketplace.');
      await loadAdminData();
    } catch (saveError) {
      setError(saveError.message || 'Không thể cập nhật đơn Marketplace.');
    } finally {
      setSaving(false);
    }
  }

  async function saveEvent(event) {
    event.preventDefault();
    clearFeedback();
    setSaving(true);
    try {
      const body = {
        ...eventForm,
        eventDate: new Date(eventForm.eventDate).toISOString(),
        capacity: Number(eventForm.capacity),
      };
      const path = editingEvent
        ? `/api/admin/events/${editingEvent.eventType}/${editingEvent.id}`
        : '/api/admin/events';
      await fetchJson(path, {
        method: editingEvent ? 'PATCH' : 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setNotice(editingEvent ? 'Đã cập nhật sự kiện.' : 'Đã tạo sự kiện từ dữ liệu bạn nhập.');
      setEventForm(emptyEvent);
      setEditingEvent(null);
      await loadAdminData();
    } catch (saveError) {
      setError(saveError.message || 'Không thể lưu sự kiện.');
    } finally {
      setSaving(false);
    }
  }

  async function updateUserRole(user, role) {
    clearFeedback();
    setSaving(true);
    try {
      await fetchJson(`/api/admin/users/${user.id}/role`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      setNotice(`Đã cập nhật quyền cho ${user.email}.`);
      await loadAdminData();
    } catch (saveError) {
      setError(saveError.message || 'Không thể cập nhật quyền người dùng.');
    } finally {
      setSaving(false);
    }
  }

  async function updateListingReview(listing, moderationStatus) {
    clearFeedback();
    setSaving(true);
    try {
      await fetchJson(`/api/admin/marketplace/listings/${listing.id}`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ moderationStatus }),
      });
      setNotice('Đã cập nhật trạng thái duyệt listing.');
      await loadAdminData();
    } catch (saveError) {
      setError(saveError.message || 'Không thể cập nhật listing.');
    } finally {
      setSaving(false);
    }
  }

  async function updateLabOrder(order, status) {
    clearFeedback();
    setSaving(true);
    try {
      await fetchJson(`/api/lab-management/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      setNotice('Đã cập nhật trạng thái đơn Film Lab.');
      await loadAdminData();
    } catch (saveError) {
      setError(saveError.message || 'Không thể cập nhật đơn Film Lab.');
    } finally {
      setSaving(false);
    }
  }

  async function updatePostVisibility(post, visibility) {
    clearFeedback();
    setSaving(true);
    try {
      await fetchJson(`/api/admin/content/posts/${post.id}`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility }),
      });
      setNotice('Đã cập nhật trạng thái bài viết.');
      await loadAdminData();
    } catch (saveError) {
      setError(saveError.message || 'Không thể cập nhật bài viết.');
    } finally {
      setSaving(false);
    }
  }

  async function updateReport(report, status) {
    const resolutionNote = status === 'dismissed'
      ? window.prompt('Ghi chú xử lý (bắt buộc):')
      : window.prompt('Ghi chú xử lý (không bắt buộc):') || '';
    if (status === 'dismissed' && !resolutionNote?.trim()) return;
    clearFeedback();
    setSaving(true);
    try {
      await fetchJson(`/api/admin/reports/${report.id}`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, resolutionNote }),
      });
      setNotice('Đã cập nhật báo cáo vi phạm.');
      await loadAdminData();
    } catch (saveError) {
      setError(saveError.message || 'Không thể cập nhật báo cáo.');
    } finally {
      setSaving(false);
    }
  }

  async function reviewTransaction(transaction, verificationStatus) {
    const note = verificationStatus === 'rejected'
      ? window.prompt('Nhập lý do từ chối:')
      : window.prompt('Ghi chú đối soát (không bắt buộc):') || '';
    if (verificationStatus === 'rejected' && !note?.trim()) return;
    if (!transaction.Order || transaction.Order.status !== 'pending_verification') {
      setError('Đơn chưa ở trạng thái chờ xác minh thanh toán.');
      return;
    }
    clearFeedback();
    setSaving(true);
    try {
      await fetchJson(`/api/orders/${transaction.Order.id}/verify-payment`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: verificationStatus === 'verified' ? 'approve' : 'reject',
          transactionId: transaction.id,
          note,
        }),
      });
      setNotice('Đã xác minh thanh toán; trạng thái giao dịch và đơn hàng được cập nhật theo luồng hợp lệ.');
      await loadAdminData();
    } catch (saveError) {
      setError(saveError.message || 'Không thể ghi nhận kết quả đối soát.');
    } finally {
      setSaving(false);
    }
  }

  if (access === 'checking' || loading) {
    return <main className="container"><p>Đang kiểm tra quyền quản trị…</p></main>;
  }

  if (access === 'guest') {
    return (
      <main className="container">
        <section className="page-hero">
          <p className="badge">Admin</p>
          <h1>Đăng nhập để tiếp tục</h1>
          <p>Trang quản trị chỉ dành cho tài khoản có quyền admin.</p>
          <Link href="/login?returnTo=%2Fadmin" className="button">Đăng nhập</Link>
        </section>
      </main>
    );
  }

  if (access === 'forbidden') {
    return (
      <main className="container">
        <section className="page-hero">
          <p className="badge">Admin</p>
          <h1>Không có quyền truy cập</h1>
          <p>Tài khoản hiện tại không có quyền admin. Việc phân quyền được xác minh ở backend.</p>
          <Link href="/" className="button secondary">Về trang chủ</Link>
        </section>
      </main>
    );
  }

  if (access === 'error') {
    return (
      <main className="container">
        <section className="page-hero">
          <p className="badge">Admin</p>
          <h1>Không thể tải dữ liệu quản trị</h1>
          <p role="alert">{error}</p>
          <button type="button" className="button" onClick={reloadAdminData} disabled={loading}>
            {loading ? 'Đang tải…' : 'Thử tải lại'}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-shell admin-page">
      <header className="admin-heading">
        <div>
          <p className="badge">Film Lab Ecosystem · Admin workspace</p>
          <h1>Trung tâm quản trị</h1>
          <p>Khu vực riêng dành cho quản lý vận hành hệ thống.</p>
        </div>
        <div className="admin-heading-actions">
          <Link href="/" className="button secondary">Mở trang công khai ↗</Link>
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              removeToken();
              removeUser();
              window.location.href = '/login';
            }}
          >
            Đăng xuất
          </button>
        </div>
      </header>

      <div className="admin-layout">
        <aside className="admin-sidebar" aria-label="Điều hướng quản trị">
          <span className="admin-sidebar-title">Không gian quản trị</span>
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              className={`admin-nav-button ${activeSection === section.id ? 'active' : ''}`}
              onClick={() => { setActiveSection(section.id); clearFeedback(); }}
            >
            <span>{section.label}</span>
            {section.id === 'overview' && overview?.pendingTransactionVerifications > 0
              ? <span className="admin-nav-count">{overview.pendingTransactionVerifications}</span>
              : null}
            </button>
          ))}
        </aside>

        <section className="admin-content">
          {error && <div className="callout" role="alert">{error}</div>}
          {notice && <div className="callout admin-success" role="status">{notice}</div>}

          {activeSection === 'overview' && (
            <>
              <div className="admin-section-heading">
                <div><h2>Tổng quan</h2><p>Số liệu hiện tại từ database.</p></div>
              </div>
              <div className="admin-stat-grid">
                <article className="admin-stat-card"><span>Người dùng</span><strong>{overview?.totalUsers ?? 0}</strong></article>
                <article className="admin-stat-card"><span>Film Lab</span><strong>{overview?.labs ?? 0}</strong></article>
                <article className="admin-stat-card"><span>Sản phẩm đang bán</span><strong>{overview?.products ?? 0}</strong></article>
                <article className="admin-stat-card"><span>Đơn chờ xử lý</span><strong>{overview?.pendingOrders ?? 0}</strong></article>
                <article className="admin-stat-card"><span>Listing chờ duyệt</span><strong>{overview?.pendingListings ?? 0}</strong></article>
                <article className="admin-stat-card"><span>Giao dịch chờ đối soát</span><strong>{overview?.pendingTransactionVerifications ?? 0}</strong></article>
                <article className="admin-stat-card"><span>Đơn Marketplace chờ xử lý</span><strong>{overview?.pendingMarketplaceOrders ?? 0}</strong></article>
                <article className="admin-stat-card"><span>Báo cáo vi phạm mở</span><strong>{overview?.openReports ?? 0}</strong></article>
                <article className="admin-stat-card"><span>Suất chiếu sắp tới</span><strong>{overview?.upcomingFilmScreenings ?? 0}</strong></article>
                <article className="admin-stat-card"><span>Đặt vé đang hoạt động</span><strong>{overview?.activeTicketReservations ?? 0}</strong></article>
              </div>
              <div className="admin-card-grid">
                <article className="card admin-panel">
                  <h3>Đơn Film Lab</h3>
                  <p>{overview?.totalOrders ?? 0} tổng đơn · {overview?.processingOrders ?? 0} đang xử lý</p>
                  <button type="button" className="button secondary" onClick={() => setActiveSection('accounts-labs')}>Xem đơn hàng</button>
                </article>
                <article className="card admin-panel">
                  <h3>Lịch chiếu</h3>
                  <p>{overview?.upcomingFilmScreenings ?? 0} suất chiếu đã công bố.</p>
                  <button type="button" className="button secondary" onClick={() => setActiveSection('screenings')}>Quản lý suất chiếu</button>
                </article>
              </div>
            </>
          )}

          {activeSection === 'screenings' && (
            <>
              <div className="admin-section-heading">
                <div><h2>Suất chiếu phim</h2><p>Chỉ nhập lịch, địa điểm và giá đã được xác nhận.</p></div>
              </div>
              <form className="card admin-form" onSubmit={saveScreening}>
                <h3>{editingScreeningId ? 'Chỉnh sửa suất chiếu' : 'Thêm suất chiếu'}</h3>
                <div className="admin-form-grid">
                  <label className="form-control">
                    <span>Tên phim (khớp catalog)</span>
                    <input
                      className="input"
                      list="film-title-options"
                      value={screeningForm.filmTitle}
                      onChange={(event) => setScreeningForm({ ...screeningForm, filmTitle: event.target.value })}
                      required
                    />
                    <datalist id="film-title-options">
                      {catalogItems.filter((item) => item.category === 'Film').map((item) => (
                        <option key={item.id} value={item.title} />
                      ))}
                    </datalist>
                  </label>
                  <label className="form-control">
                    <span>Ngày và giờ</span>
                    <input className="input" type="datetime-local" value={screeningForm.eventDate} onChange={(event) => setScreeningForm({ ...screeningForm, eventDate: event.target.value })} required />
                  </label>
                  <label className="form-control">
                    <span>Tên rạp / địa điểm</span>
                    <input className="input" value={screeningForm.venueName} onChange={(event) => setScreeningForm({ ...screeningForm, venueName: event.target.value })} required />
                  </label>
                  <label className="form-control">
                    <span>Địa chỉ</span>
                    <input className="input" value={screeningForm.venueAddress} onChange={(event) => setScreeningForm({ ...screeningForm, venueAddress: event.target.value })} required />
                  </label>
                  <label className="form-control">
                    <span>Sức chứa</span>
                    <input className="input" type="number" min="1" step="1" value={screeningForm.capacity} onChange={(event) => setScreeningForm({ ...screeningForm, capacity: event.target.value })} required />
                  </label>
                  <label className="form-control">
                    <span>Giá vé (USD)</span>
                    <input className="input" type="number" min="0" step="0.01" value={screeningForm.ticketPrice} onChange={(event) => setScreeningForm({ ...screeningForm, ticketPrice: event.target.value })} required />
                  </label>
                </div>
                <div className="admin-form-actions">
                  <button type="submit" className="button" disabled={saving}>{saving ? 'Đang lưu…' : editingScreeningId ? 'Lưu thay đổi' : 'Tạo suất chiếu'}</button>
                  {editingScreeningId && <button type="button" className="button secondary" onClick={() => { setEditingScreeningId(''); setScreeningForm(emptyScreening); }}>Hủy sửa</button>}
                </div>
              </form>

              <div className="card admin-table-card">
                <div className="admin-section-heading"><div><h3>Danh sách suất chiếu</h3><p>Suất đã ẩn vẫn hiển thị tại đây để có thể công bố lại.</p></div></div>
                {screenings.length === 0 ? <p>Chưa có suất chiếu trong database.</p> : (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead><tr><th>Phim / lịch</th><th>Địa điểm</th><th>Vé</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
                      <tbody>
                        {screenings.map((screening) => (
                          <tr key={screening.id}>
                            <td><strong>{screening.filmTitle}</strong><small>{formatDate(screening.eventDate)}</small></td>
                            <td>{screening.venueName}<small>{screening.venueAddress}</small></td>
                            <td>{screening.reservedTickets}/{screening.capacity} đặt<br />{screening.availableTickets} còn · {formatCurrency(screening.ticketPrice)}</td>
                            <td><span className={`admin-status ${screening.isPublished ? 'published' : 'hidden'}`}>{screening.isPublished ? 'Đã công bố' : 'Đang ẩn'}</span></td>
                            <td><div className="admin-row-actions">
                              <button type="button" className="button secondary" onClick={() => { setEditingScreeningId(screening.id); setScreeningForm({ filmTitle: screening.filmTitle, eventDate: localDateTimeValue(screening.eventDate), venueName: screening.venueName, venueAddress: screening.venueAddress, capacity: String(screening.capacity), ticketPrice: String(screening.ticketPrice) }); }}>Sửa</button>
                              <button type="button" className="button secondary" disabled={saving} onClick={() => toggleScreening(screening)}>{screening.isPublished ? 'Ẩn' : 'Công bố'}</button>
                            </div></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {activeSection === 'marketplace' && (
            <>
              <div className="admin-section-heading">
                <div><h2>Marketplace</h2><p>Duyệt listing thật, quản lý sản phẩm/người bán và theo dõi đơn.</p></div>
              </div>
              <form className="card admin-form" onSubmit={saveListing}>
                <h3>Đăng sản phẩm Camera / Lens</h3>
                <div className="admin-form-grid">
                  <label className="form-control">
                    <span>Tên sản phẩm (khớp catalog nếu có)</span>
                    <input className="input" list="catalog-product-options" value={listingForm.title} onChange={(event) => {
                      const title = event.target.value;
                      const catalogItem = catalogItems.find((item) => item.title === title);
                      setListingForm({ ...listingForm, title, category: catalogItem?.category || listingForm.category });
                    }} required />
                    <datalist id="catalog-product-options">
                      {catalogItems.map((item) => <option key={item.id} value={item.title} />)}
                    </datalist>
                  </label>
                  <label className="form-control"><span>Danh mục</span><select className="select" value={listingForm.category} onChange={(event) => setListingForm({ ...listingForm, category: event.target.value })}><option>Cameras</option><option>Lenses</option><option>Accessories</option></select></label>
                  <label className="form-control"><span>Tình trạng</span><input className="input" value={listingForm.condition} onChange={(event) => setListingForm({ ...listingForm, condition: event.target.value })} /></label>
                  <label className="form-control"><span>Giá bán (USD)</span><input className="input" type="number" min="0" step="0.01" value={listingForm.price} onChange={(event) => setListingForm({ ...listingForm, price: event.target.value })} required /></label>
                  <label className="form-control"><span>Tồn kho thật</span><input className="input" type="number" min="0" step="1" value={listingForm.stock} onChange={(event) => setListingForm({ ...listingForm, stock: event.target.value })} required /></label>
                  <label className="form-control"><span>Mô tả</span><input className="input" value={listingForm.description} onChange={(event) => setListingForm({ ...listingForm, description: event.target.value })} /></label>
                </div>
                <div className="admin-form-actions"><button type="submit" className="button" disabled={saving}>{saving ? 'Đang lưu…' : 'Tạo listing'}</button></div>
              </form>

              <div className="card admin-table-card">
                <div className="admin-section-heading"><div><h3>Listing trong database</h3><p>{listings.length} sản phẩm · giá và tồn kho lấy từ dữ liệu thật.</p></div></div>
                {listings.length === 0 ? <p>Chưa có listing nào.</p> : (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead><tr><th>Sản phẩm</th><th>Người bán</th><th>Giá</th><th>Tồn kho</th><th>Duyệt</th><th></th></tr></thead>
                      <tbody>
                        {listings.map((listing) => (
                          <tr key={listing.id}>
                            <td><strong>{listing.title}</strong><small>{listing.category} · {listing.condition || 'Chưa rõ tình trạng'}</small></td>
                            <td>{listing.seller?.name || '—'}<small>{listing.seller?.email || ''}</small></td>
                            <td>{formatCurrency(listing.price)}</td>
                            <td>{listing.stock}</td>
                            <td>
                              <select
                                className="select admin-status-select"
                                value={listing.moderationStatus || 'approved'}
                                disabled={saving}
                                onChange={(event) => updateListingReview(listing, event.target.value)}
                                aria-label={`Trạng thái duyệt ${listing.title}`}
                              >
                                <option value="pending">Chờ duyệt</option>
                                <option value="approved">Đã duyệt</option>
                                <option value="rejected">Từ chối</option>
                              </select>
                            </td>
                            <td><button type="button" className="button secondary" disabled={saving} onClick={() => removeListing(listing)}>Xóa</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="card admin-table-card">
                <div className="admin-section-heading"><div><h3>Đơn Marketplace</h3><p>Trạng thái đơn và thao tác chuyển trạng thái theo nghiệp vụ.</p></div></div>
                {marketplaceOrders.length === 0 ? <p>Chưa có đơn Marketplace.</p> : (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead><tr><th>Sản phẩm / người mua</th><th>Tổng tiền</th><th>Trạng thái</th><th>Cập nhật</th></tr></thead>
                      <tbody>
                        {marketplaceOrders.map((order) => {
                          const transitions = orderTransitions[order.status] || [];
                          return (
                            <tr key={order.id}>
                              <td><strong>{order.product?.title || 'Catalog order'}</strong><small>{order.buyer?.name || '—'} · {formatDate(order.createdAt)}</small><small>{order.proofUploadId ? `Có chứng từ: ${order.proofUploadId}` : 'Chưa có chứng từ thanh toán'}</small></td>
                              <td>{formatCurrency(order.totalPrice)}</td>
                              <td><span className={`admin-status ${order.status}`}>{order.status}</span></td>
                              <td><select className="select admin-status-select" value="" disabled={saving || transitions.length === 0} onChange={(event) => { if (event.target.value) updateMarketplaceOrder(order, event.target.value); }}><option value="">Chọn trạng thái</option>{transitions.map((status) => <option key={status} value={status}>{status}</option>)}</select></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {activeSection === 'accounts-labs' && (
            <>
              <div className="admin-section-heading">
                <div><h2>Tài khoản & Film Lab</h2><p>Tra cứu người dùng, phân quyền và hỗ trợ xử lý lab/đơn.</p></div>
              </div>
              <div className="card admin-table-card">
                <div className="admin-section-heading">
                  <div><h3>Tài khoản người dùng</h3><p>{users.length} tài khoản được hiển thị (tối đa 200).</p></div>
                  <input className="input admin-search" value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Tìm email hoặc tên" aria-label="Tìm người dùng" />
                </div>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead><tr><th>Người dùng</th><th>Ngày tạo</th><th>Quyền</th></tr></thead>
                    <tbody>
                      {users.filter((user) => `${user.name} ${user.email}`.toLowerCase().includes(userSearch.toLowerCase())).map((user) => (
                        <tr key={user.id}>
                          <td><strong>{user.name}</strong><small>{user.email}{user.location ? ` · ${user.location}` : ''}</small></td>
                          <td>{formatDate(user.createdAt)}</td>
                          <td>
                            <select className="select admin-status-select" value={user.role} disabled={saving} onChange={(event) => updateUserRole(user, event.target.value)} aria-label={`Quyền ${user.email}`}>
                              <option value="photographer">Photographer</option>
                              <option value="seller">Seller</option>
                              <option value="lab_owner">Lab owner</option>
                              <option value="admin">Admin</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card admin-table-card">
                <div className="admin-section-heading"><div><h3>Film Lab</h3><p>{labs.length} lab trong database.</p></div></div>
                {labs.length === 0 ? <p>Chưa có Film Lab.</p> : (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead><tr><th>Lab</th><th>Chủ sở hữu</th><th>Địa điểm</th><th>Đánh giá</th></tr></thead>
                      <tbody>
                        {labs.map((lab) => (
                          <tr key={lab.id}>
                            <td><strong>{lab.name}</strong><small>{lab.priceRange || 'Chưa có khoảng giá'}</small></td>
                            <td>{lab.owner?.name || '—'}<small>{lab.owner?.email || ''}</small></td>
                            <td>{lab.address}<small>{lab.city}, {lab.country}</small></td>
                            <td>{lab.rating}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="card admin-table-card">
                <div className="admin-section-heading"><div><h3>Đơn Film Lab</h3><p>{labOrders.length} đơn; trạng thái chỉ chuyển theo luồng hợp lệ.</p></div></div>
                {labOrders.length === 0 ? <p>Chưa có đơn Film Lab.</p> : (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead><tr><th>Khách hàng</th><th>Film Lab</th><th>Ngày tạo</th><th>Trạng thái</th><th>Tổng tiền</th><th>Thao tác</th></tr></thead>
                      <tbody>
                        {labOrders.map((order) => {
                          const transitions = labOrderTransitions[order.status] || [];
                          return (
                            <tr key={order.id}>
                              <td>{order.User?.name || '—'}<small>{order.User?.email || ''}</small></td>
                              <td>{order.FilmLab?.name || 'Chưa gán'}</td>
                              <td>{formatDate(order.createdAt)}</td>
                              <td><span className={`admin-status ${order.status}`}>{order.status}</span></td>
                              <td>{formatCurrency(order.totalPrice, 'VND')}</td>
                              <td>
                                <select className="select admin-status-select" value="" disabled={saving || transitions.length === 0} onChange={(event) => { if (event.target.value) updateLabOrder(order, event.target.value); }} aria-label={`Trạng thái đơn ${order.id}`}>
                                  <option value="">Cập nhật trạng thái</option>
                                  {transitions.map((status) => <option key={status} value={status}>{status}</option>)}
                                </select>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {activeSection === 'events-content' && (
            <>
              <div className="admin-section-heading">
                <div><h2>Sự kiện & nội dung</h2><p>Quản lý workshop, photowalk, bài viết và báo cáo vi phạm.</p></div>
              </div>
              <form className="card admin-form" onSubmit={saveEvent}>
                <h3>{editingEvent ? 'Chỉnh sửa sự kiện' : 'Tạo sự kiện'}</h3>
                <p>Sự kiện chỉ được tạo từ thông tin bạn nhập; hệ thống không tự sinh lịch mẫu.</p>
                <div className="admin-form-grid">
                  <label className="form-control"><span>Loại sự kiện</span><select className="select" value={eventForm.eventType} disabled={Boolean(editingEvent)} onChange={(event) => setEventForm({ ...eventForm, eventType: event.target.value })}><option value="workshop">Workshop</option><option value="photowalk">Photowalk</option></select></label>
                  <label className="form-control"><span>Tên sự kiện</span><input className="input" value={eventForm.title} onChange={(event) => setEventForm({ ...eventForm, title: event.target.value })} required /></label>
                  <label className="form-control"><span>Thời gian</span><input className="input" type="datetime-local" value={eventForm.eventDate} onChange={(event) => setEventForm({ ...eventForm, eventDate: event.target.value })} required /></label>
                  <label className="form-control"><span>Địa điểm / địa chỉ</span><input className="input" value={eventForm.location} onChange={(event) => setEventForm({ ...eventForm, location: event.target.value })} required /></label>
                  <label className="form-control"><span>Sức chứa</span><input className="input" type="number" min="1" step="1" value={eventForm.capacity} onChange={(event) => setEventForm({ ...eventForm, capacity: event.target.value })} required /></label>
                  <label className="form-control"><span>Mô tả</span><textarea className="input" rows="3" value={eventForm.description} onChange={(event) => setEventForm({ ...eventForm, description: event.target.value })} /></label>
                </div>
                <label className="checkbox-group"><input type="checkbox" checked={eventForm.isPublished} onChange={(event) => setEventForm({ ...eventForm, isPublished: event.target.checked })} /> Công bố sự kiện</label>
                <div className="admin-form-actions">
                  <button type="submit" className="button" disabled={saving}>{saving ? 'Đang lưu…' : editingEvent ? 'Lưu thay đổi' : 'Tạo sự kiện'}</button>
                  {editingEvent && <button type="button" className="button secondary" onClick={() => { setEditingEvent(null); setEventForm(emptyEvent); }}>Hủy sửa</button>}
                </div>
              </form>

              <div className="card admin-table-card">
                <div className="admin-section-heading"><div><h3>Workshop & photowalk</h3><p>{events.length} sự kiện đang có trong database.</p></div></div>
                {events.length === 0 ? <p>Chưa có sự kiện. Không có lịch mẫu nào được tạo tự động.</p> : (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead><tr><th>Sự kiện</th><th>Người tổ chức</th><th>Thời gian / địa điểm</th><th>Đăng ký</th><th>Trạng thái</th><th></th></tr></thead>
                      <tbody>
                        {events.map((event) => (
                          <tr key={`${event.eventType}:${event.id}`}>
                            <td><strong>{event.title}</strong><small>{event.eventType === 'workshop' ? 'Workshop' : 'Photowalk'}</small></td>
                            <td>{event.organizer?.name || '—'}<small>{event.organizer?.email || ''}</small></td>
                            <td>{formatDate(event.eventDate)}<small>{event.location}</small></td>
                            <td>{event.registeredCount}/{event.capacity}</td>
                            <td><span className={`admin-status ${event.publishedAt ? 'published' : 'hidden'}`}>{event.publishedAt ? 'Đã công bố' : 'Đang ẩn'}</span></td>
                            <td><button type="button" className="button secondary" onClick={() => {
                              setEditingEvent(event);
                              setEventForm({
                                eventType: event.eventType,
                                title: event.title,
                                description: event.description || '',
                                location: event.location || '',
                                eventDate: localDateTimeValue(event.eventDate),
                                capacity: String(event.capacity),
                                isPublished: Boolean(event.publishedAt),
                              });
                            }}>Sửa</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="card admin-table-card">
                <div className="admin-section-heading"><div><h3>Bài viết cộng đồng</h3><p>{posts.length} bài viết gần nhất.</p></div></div>
                {posts.length === 0 ? <p>Chưa có bài viết.</p> : (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead><tr><th>Bài viết</th><th>Tác giả</th><th>Bình luận</th><th>Hiển thị</th></tr></thead>
                      <tbody>
                        {posts.map((post) => (
                          <tr key={post.id}>
                            <td><strong>{post.title}</strong><small>{post.body.slice(0, 120)}{post.body.length > 120 ? '…' : ''}</small></td>
                            <td>{post.author?.name || '—'}<small>{post.author?.email || ''}</small></td>
                            <td>{post.commentCount}</td>
                            <td><select className="select admin-status-select" value={post.visibility} disabled={saving} onChange={(event) => updatePostVisibility(post, event.target.value)} aria-label={`Hiển thị bài ${post.title}`}><option value="public">Công khai</option><option value="private">Ẩn</option><option value="draft">Bản nháp</option></select></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="card admin-table-card">
                <div className="admin-section-heading"><div><h3>Báo cáo vi phạm</h3><p>{reports.filter((report) => ['open', 'reviewing'].includes(report.status)).length} báo cáo cần xử lý.</p></div></div>
                {reports.length === 0 ? <p>Chưa có báo cáo vi phạm.</p> : (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead><tr><th>Nội dung bị báo cáo</th><th>Người báo cáo</th><th>Lý do</th><th>Trạng thái</th><th>Xử lý</th></tr></thead>
                      <tbody>
                        {reports.map((report) => (
                          <tr key={report.id}>
                            <td>{report.targetType}<small>{report.targetId}</small></td>
                            <td>{report.reporter?.name || '—'}<small>{report.reporter?.email || ''}</small></td>
                            <td>{report.reason}</td>
                            <td><span className={`admin-status ${report.status}`}>{report.status}</span></td>
                            <td><select className="select admin-status-select" value="" disabled={saving || ['resolved', 'dismissed'].includes(report.status)} onChange={(event) => { if (event.target.value) updateReport(report, event.target.value); }} aria-label={`Xử lý báo cáo ${report.id}`}><option value="">Chọn</option><option value="reviewing">Đang xem xét</option><option value="resolved">Đã xử lý</option><option value="dismissed">Bỏ qua</option></select></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {activeSection === 'payments-logs' && (
            <>
              <div className="admin-section-heading">
                <div><h2>Thanh toán & nhật ký</h2><p>Đối soát giao dịch riêng biệt; việc review không tự sửa trạng thái thanh toán của nhà cung cấp.</p></div>
              </div>
              <div className="card admin-table-card">
                <div className="admin-section-heading"><div><h3>Giao dịch</h3><p>{transactions.length} giao dịch gần nhất.</p></div></div>
                {transactions.length === 0 ? <p>Chưa có giao dịch.</p> : (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead><tr><th>Giao dịch</th><th>Đơn / khách hàng</th><th>Số tiền</th><th>Thanh toán</th><th>Đối soát</th><th></th></tr></thead>
                      <tbody>
                        {transactions.map((transaction) => (
                          <tr key={transaction.id}>
                            <td><strong>{transaction.providerReference || transaction.id.slice(0, 8)}</strong><small>{formatDate(transaction.createdAt)}</small></td>
                            <td>{transaction.Order?.id?.slice(0, 8) || '—'}<small>{transaction.Order?.status || 'Không gắn đơn'}</small><small>{transaction.Order?.User?.email || ''}</small></td>
                            <td>{formatCurrency(transaction.amount, transaction.currency || 'USD')}</td>
                            <td><span className={`admin-status ${transaction.status}`}>{transaction.status}</span></td>
                            <td><span className={`admin-status ${transaction.verificationStatus}`}>{transaction.verificationStatus}</span><small>{transaction.verificationNote || transaction.verifier?.email || ''}</small></td>
                            <td>{transaction.verificationStatus === 'pending'
                              && transaction.status === 'pending'
                              && transaction.Order?.status === 'pending_verification' ? (
                              <div className="admin-row-actions">
                                <button type="button" className="button secondary" disabled={saving} onClick={() => reviewTransaction(transaction, 'verified')}>Đã xác minh</button>
                                <button type="button" className="button secondary" disabled={saving} onClick={() => reviewTransaction(transaction, 'rejected')}>Từ chối</button>
                              </div>
                            ) : transaction.verificationStatus === 'pending' ? 'Chưa đủ điều kiện đối soát' : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="card admin-table-card">
                <div className="admin-section-heading"><div><h3>Nhật ký quản trị</h3><p>{auditLogs.length} thao tác gần nhất; không ghi lại mật khẩu hay token.</p></div></div>
                {auditLogs.length === 0 ? <p>Chưa có thao tác quản trị được ghi nhận.</p> : (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead><tr><th>Thời gian</th><th>Người thao tác</th><th>Hành động</th><th>Đối tượng</th><th>Chi tiết</th></tr></thead>
                      <tbody>
                        {auditLogs.map((log) => (
                          <tr key={log.id}>
                            <td>{formatDate(log.createdAt)}</td>
                            <td>{log.actor?.name || log.actor?.email || '—'}</td>
                            <td>{log.action}</td>
                            <td>{log.entityType}<small>{log.entityId || ''}</small></td>
                            <td><code>{JSON.stringify(log.details || {})}</code></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

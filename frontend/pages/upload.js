import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { getToken, authHeaders } from '../lib/auth';
import { API_BASE } from '../lib/api';

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [message, setMessage] = useState('');
  const [quality, setQuality] = useState(null);
  const [currentUpload, setCurrentUpload] = useState(null);
  const [subjectType, setSubjectType] = useState('film');
  const [reviewQuestion, setReviewQuestion] = useState('');
  const [allowExternalAi, setAllowExternalAi] = useState(false);
  const [reviewResult, setReviewResult] = useState(null);
  const [editPreset, setEditPreset] = useState('auto');
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    async function loadUploads() {
      try {
        const res = await fetch(`${API_BASE}/api/uploads`, {
          headers: authHeaders(),
        });
        const data = await res.json();
        if (res.ok) setUploads(data);
      } catch (err) {
        console.error(err);
      }
    }
    if (getToken()) {
      setLoading(true);
      loadUploads().finally(() => setLoading(false));
    }
  }, []);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    if (router.isReady && router.query.tool === 'film-review') {
      document.getElementById('film-image-tools')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [router.isReady, router.query.tool]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) return setMessage('Select a file first.');

    setUploading(true);
    setMessage('');
    setReviewResult(null);
    const formData = new FormData();
    formData.append('photo', file);

    try {
      const res = await fetch(`${API_BASE}/api/uploads`, {
        method: 'POST',
        headers: authHeaders(),
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setMessage('Ảnh đã tải lên. Bạn có thể xem chỉ số, xin nhận xét hoặc tạo bản chỉnh sửa bên dưới.');
      setQuality(data.quality || null);
      setCurrentUpload(data);
      setUploads((prev) => [data, ...prev]);
    } catch (err) {
      setMessage(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function handleFileChange(event) {
    const nextFile = event.target.files?.[0] || null;
    setFile(nextFile);
    setPreviewUrl(nextFile ? URL.createObjectURL(nextFile) : '');
    setMessage('');
    setQuality(null);
    setCurrentUpload(null);
    setReviewResult(null);
  }

  async function loadPrivatePreview(upload) {
    const response = await fetch(`${API_BASE}${upload.url}`, { headers: authHeaders() });
    if (!response.ok) throw new Error('Không thể tải ảnh riêng tư');
    const url = URL.createObjectURL(await response.blob());
    setPreviewUrl(url);
  }

  async function requestImageReview() {
    if (!currentUpload) return;
    setReviewing(true);
    setMessage('');
    try {
      const response = await fetch(`${API_BASE}/api/uploads/${currentUpload.id}/review`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectType, question: reviewQuestion, allowExternalAi }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Không thể đánh giá ảnh');
      setReviewResult(data);
    } catch (err) {
      setMessage(err.message || 'Không thể đánh giá ảnh');
    } finally {
      setReviewing(false);
    }
  }

  async function applyEditPreset() {
    if (!currentUpload) return;
    setEditing(true);
    setMessage('');
    try {
      const response = await fetch(`${API_BASE}/api/uploads/${currentUpload.id}/edit`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ preset: editPreset }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Không thể chỉnh sửa ảnh');
      setCurrentUpload(data);
      setQuality(data.quality || null);
      setReviewResult(null);
      setUploads((prev) => [data, ...prev]);
      await loadPrivatePreview(data);
      setMessage('Đã tạo bản chỉnh sửa mới; ảnh gốc vẫn được giữ nguyên trong kho.');
    } catch (err) {
      setMessage(err.message || 'Không thể chỉnh sửa ảnh');
    } finally {
      setEditing(false);
    }
  }

  async function openUpload(upload) {
    const previewWindow = window.open('', '_blank');
    try {
      const response = await fetch(`${API_BASE}${upload.url}`, { headers: authHeaders() });
      if (!response.ok) throw new Error('Unable to open this upload');
      const fileUrl = URL.createObjectURL(await response.blob());
      if (previewWindow) previewWindow.location.href = fileUrl;
      else window.location.href = fileUrl;
      window.setTimeout(() => URL.revokeObjectURL(fileUrl), 60_000);
    } catch (error) {
      if (previewWindow) previewWindow.close();
      setMessage(error.message || 'Unable to open this upload');
    }
  }

  if (!getToken()) return (
    <main className="container">
      <section className="page-hero">
        <p className="badge">Upload</p>
        <h1>Photo upload requires login</h1>
        <p>Sign in first to upload scans or film photos and receive image quality feedback.</p>
        <Link href="/login" className="button">Login</Link>
      </section>
    </main>
  );

  return (
    <main className="container">
      <section className="page-hero">
        <p className="badge">Film Photo Studio</p>
        <h1>Tải ảnh lên để đánh giá hoặc chỉnh sửa</h1>
        <p>Kiểm tra scan phim, nhận góp ý cho ảnh sản phẩm và tạo bản chỉnh sáng/tương phản/màu. Ảnh tải lên được lưu riêng trong kho của bạn.</p>
      </section>

      <section id="film-image-tools" className="card image-tools-card" style={{ maxWidth: 900 }}>
        <div className="image-tools-intro">
          <span className="eyebrow">Upload & Review</span>
          <h2>Ảnh scan phim hoặc ảnh sản phẩm</h2>
          <p>Chọn ảnh JPEG, PNG, WebP, TIFF hoặc AVIF (tối đa 15 MB). Chỉ số cơ bản được xử lý trên backend website; chỉ gửi ảnh đã thu nhỏ tới AI bên ngoài khi bạn chủ động đồng ý.</p>
        </div>
        <form onSubmit={handleSubmit} className="form-grid">
          <label className="form-control">
            <span>Chọn ảnh</span>
            <input type="file" className="input" accept="image/jpeg,image/png,image/webp,image/tiff,image/avif" onChange={handleFileChange} />
          </label>
          {file && <p className="upload-file-meta">{file.name} · {(file.size / (1024 * 1024)).toFixed(2)} MB</p>}
          <button type="submit" className="button" disabled={!file || uploading}>{uploading ? 'Đang tải ảnh…' : 'Tải ảnh lên & phân tích'}</button>
        </form>
        {message && <p className="callout" style={{ marginTop: '1rem' }}>{message}</p>}
      </section>

      {previewUrl && (
        <section className="card" style={{ maxWidth: 760, marginTop: '1.5rem' }}>
          <h2>Preview</h2>
          <img src={previewUrl} alt="Upload preview" style={{ width: '100%', borderRadius: 20, objectFit: 'cover' }} />
        </section>
      )}

      {quality && (
        <section className="card" style={{ maxWidth: 760, marginTop: '1.5rem' }}>
          <h2>Chỉ số ảnh cơ bản</h2>
          <p className="muted-note">Đây là phép đo heuristic về pixel, không xác định chắc chắn loại film stock hoặc chất lượng nghệ thuật.</p>
          <div className="grid-2" style={{ gap: '1rem' }}>
            <div>
              <p><strong>Brightness:</strong> {quality.labels.brightness} ({(quality.brightness * 100).toFixed(0)}%)</p>
              <p><strong>Contrast:</strong> {quality.labels.contrast} ({(quality.contrast * 100).toFixed(0)}%)</p>
              <p><strong>Sharpness:</strong> {quality.labels.sharpness} ({(quality.sharpness * 100).toFixed(0)}%)</p>
            </div>
            <div>
              <p><strong>Noise:</strong> {quality.labels.noise} ({(quality.noise * 100).toFixed(0)}%)</p>
              <p><strong>Colorfulness:</strong> {quality.labels.colorfulness} ({quality.colorfulness.toFixed(1)})</p>
            </div>
          </div>
        </section>
      )}

      {currentUpload && (
        <section className="card image-tools-card" style={{ maxWidth: 900, marginTop: '1.5rem' }}>
          <div className="grid-2 image-action-grid">
            <div className="image-action-panel">
              <h2>Nhờ AI nhận xét ảnh</h2>
              <label className="form-control">
                <span>Ảnh này là</span>
                <select className="select" value={subjectType} onChange={(event) => setSubjectType(event.target.value)}>
                  <option value="film">Ảnh scan phim</option>
                  <option value="product">Ảnh sản phẩm đăng bán</option>
                </select>
              </label>
              <label className="form-control">
                <span>Câu hỏi/yêu cầu (không bắt buộc)</span>
                <textarea className="input textarea" rows={3} maxLength={500} value={reviewQuestion} onChange={(event) => setReviewQuestion(event.target.value)} placeholder="Ví dụ: Màu scan có bị ám vàng không? Ảnh sản phẩm nên cải thiện gì?" />
              </label>
              <label className="ai-image-consent">
                <input type="checkbox" checked={allowExternalAi} onChange={(event) => setAllowExternalAi(event.target.checked)} />
                <span>Đồng ý gửi bản ảnh đã thu nhỏ tới OpenAI để phân tích trực quan. Nếu không chọn, chỉ dùng các chỉ số cục bộ.</span>
              </label>
              <button type="button" className="button" onClick={requestImageReview} disabled={reviewing}>
                {reviewing ? 'Đang nhận xét…' : 'Nhận xét ảnh'}
              </button>
              {reviewResult && (
                <div className="image-review-result" aria-live="polite">
                  <strong>{reviewResult.source === 'openai-vision' ? 'Nhận xét AI' : 'Gợi ý theo chỉ số ảnh'}</strong>
                  <p>{reviewResult.answer}</p>
                  <small>{reviewResult.fallback ? 'Phân tích cục bộ · ảnh không được gửi ra ngoài' : 'AI vision · ảnh đã được gửi tới nhà cung cấp theo consent của bạn'}</small>
                </div>
              )}
            </div>

            <div className="image-action-panel">
              <h2>Chỉnh sửa ảnh</h2>
              <p>Chọn một preset để tạo ảnh đã chỉnh như một bản mới. Ảnh gốc không bị ghi đè.</p>
              <label className="form-control">
                <span>Kiểu chỉnh sửa</span>
                <select className="select" value={editPreset} onChange={(event) => setEditPreset(event.target.value)}>
                  <option value="auto">Tự cân bằng màu và độ nét</option>
                  <option value="brighten">Tăng sáng nhẹ</option>
                  <option value="contrast">Tăng tương phản và độ nét</option>
                  <option value="warm">Tông màu ấm</option>
                  <option value="cool">Tông màu mát</option>
                  <option value="black-white">Chuyển đen trắng</option>
                </select>
              </label>
              <button type="button" className="button secondary" onClick={applyEditPreset} disabled={editing}>
                {editing ? 'Đang chỉnh sửa…' : 'Tạo bản chỉnh sửa'}
              </button>
              <p className="muted-note">Các preset xử lý ảnh bằng Sharp trên backend; không thay thế hậu kỳ chuyên nghiệp hoặc giữ nguyên dữ liệu RAW.</p>
            </div>
          </div>
        </section>
      )}

      <section className="card" style={{ maxWidth: 760, marginTop: '1.5rem' }}>
        <h2>Recent uploads</h2>
        {loading ? (
          <p>Loading your uploads…</p>
        ) : uploads.length === 0 ? (
          <p>No uploads yet. Your latest upload will appear here.</p>
        ) : (
          <div className="upload-list">
            {uploads.map((upload) => (
              <article key={upload.id} className="upload-card">
                <div>
                  <strong>{upload.originalName}</strong>
                  <p>{new Date(upload.createdAt).toLocaleString()}</p>
                </div>
                <button type="button" className="button secondary" onClick={() => openUpload(upload)}>View file</button>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

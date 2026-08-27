import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getToken, authHeaders } from '../lib/auth';
import { API_BASE } from '../lib/api';

export default function UploadPage() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [message, setMessage] = useState('');
  const [quality, setQuality] = useState(null);
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

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

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) return setMessage('Select a file first.');

    setUploading(true);
    setMessage('');
    const formData = new FormData();
    formData.append('photo', file);

    const res = await fetch(`${API_BASE}/api/uploads`, {
      method: 'POST',
      headers: authHeaders(),
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || 'Upload failed');
      setUploading(false);
      return;
    }
    setMessage('Upload successful! Review the quality report below.');
    setQuality(data.quality || null);
    setUploads((prev) => [data, ...prev]);
    setUploading(false);
  }

  function handleFileChange(event) {
    const nextFile = event.target.files?.[0] || null;
    setFile(nextFile);
    setPreviewUrl(nextFile ? URL.createObjectURL(nextFile) : '');
    setMessage('');
    setQuality(null);
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
        <p className="badge">Upload</p>
        <h1>Upload your film photo</h1>
        <p>Submit a scan or photo and receive a quick quality report for brightness, contrast, sharpness, noise, and color.</p>
      </section>

      <section className="card" style={{ maxWidth: 760 }}>
        <form onSubmit={handleSubmit} className="form-grid">
          <label className="form-control">
            <span>Select photo</span>
            <input type="file" className="input" accept="image/*" onChange={handleFileChange} />
          </label>
          <button type="submit" className="button" disabled={!file || uploading}>{uploading ? 'Uploading…' : 'Upload'}</button>
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
          <h2>Quality report</h2>
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
                <Link href={upload.url} className="button secondary">View file</Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

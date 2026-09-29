export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export async function fetchJson(path, options) {
  const res = await fetch(`${API_BASE}${path}`, options);
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : null;
  if (!res.ok) {
    const message = typeof data?.error === 'string' ? data.error : data?.error?.message;
    const error = new Error(message || `API request failed (${res.status})`);
    error.status = res.status;
    throw error;
  }
  return data;
}

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export async function fetchJson(path, options) {
  const res = await fetch(`${API_BASE}${path}`, options);
  const data = await res.json();
  if (!res.ok) {
    const error = new Error(data.error || 'API request failed');
    error.status = res.status;
    throw error;
  }
  return data;
}

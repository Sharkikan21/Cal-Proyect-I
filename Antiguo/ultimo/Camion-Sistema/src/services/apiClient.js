// src/services/apiClient.js
const API_BASE_URL =
    (typeof window !== 'undefined' && window.env?.BASE_URL) ||
    (import.meta?.env?.VITE_API_BASE_URL) ||
    'http://127.0.0.1:8123';

console.log('API_BASE_URL configurada:', API_BASE_URL);

export async function apiFetch(path, options = {}) {
    const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;

    const token =
        localStorage.getItem('access_token') ||
        sessionStorage.getItem('access_token');

    const headers = new Headers(options.headers || {});
    if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
    }
    if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
        headers.set('Content-Type', 'application/json');
    }

    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
    }
    // si no hay body (204) retorna null
    if (res.status === 204) return null;

    // intenta parsear JSON
    const ct = res.headers.get('content-type') || '';
    return ct.includes('application/json') ? res.json() : res.text();
}

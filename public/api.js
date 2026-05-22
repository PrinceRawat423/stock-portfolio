const API_BASE =
  window.location.protocol === 'file:' ||
  !['localhost', '127.0.0.1'].includes(window.location.hostname) ||
  window.location.port !== '3000'
    ? 'http://localhost:3000'
    : '';

function apiUrl(path) {
  return `${API_BASE}${path}`;
}

async function apiFetch(path, options = {}) {
  const config = {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.headers || {})
    }
  };

  return fetch(apiUrl(path), config);
}

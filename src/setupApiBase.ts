// Redirects any fetch('/api/...') to the external backend when
// REACT_APP_API_BASE is set. No-op in local dev (empty string).
const API_BASE = process.env.REACT_APP_API_BASE ?? '';

if (API_BASE && typeof window !== 'undefined' && window.fetch) {
  const origFetch = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string' && input.startsWith('/api/')) {
      return origFetch(API_BASE + input, init);
    }
    return origFetch(input, init);
  }) as typeof fetch;
  console.log('[WorldTV] API_BASE active:', API_BASE);
}

export {};

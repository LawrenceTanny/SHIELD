

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './Styles/index.css'
import 'leaflet/dist/leaflet.css'
import MainLayout from './Header.jsx'

if (typeof document !== 'undefined') {
  document.documentElement.dataset.theme = 'light'
  document.body.dataset.theme = 'light'
}

// ─── Global Fetch Interceptor for Automatic CSRF Token Injection ───
if (typeof window !== 'undefined') {
  const originalFetch = window.fetch;
  let cachedCsrfToken = null;

  window.fetch = async function (resource, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const urlStr = typeof resource === 'string' ? resource : (resource.url || '');
    
    const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim();
    const isApiRequest = urlStr.startsWith(apiBaseUrl) || urlStr.startsWith('/api/');
    const isStateChanging = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);
    
    if (isApiRequest && isStateChanging) {
      if (!cachedCsrfToken) {
        try {
          const tokenRes = await originalFetch(`${apiBaseUrl}/api/csrf-token`, {
            credentials: 'include'
          });
          if (tokenRes.ok) {
            const data = await tokenRes.json();
            cachedCsrfToken = data.csrfToken;
          }
        } catch (err) {
          console.error('Failed to load CSRF token:', err);
        }
      }
      
      if (cachedCsrfToken) {
        options.headers = {
          ...options.headers,
          'X-CSRF-Token': cachedCsrfToken
        };
      }
    }
    
    return originalFetch(resource, options);
  };
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MainLayout />
  </StrictMode>,
)
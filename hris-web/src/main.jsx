import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Initialize In-Memory Cache
window.hrisCache = {
  karyawan_data: null,
  corporate_policies: null,
  payroll_data: null
};

window.initHrisCache = () => {
  if (!window.hrisCache) {
    window.hrisCache = {
      karyawan_data: null,
      corporate_policies: null,
      payroll_data: null
    };
  }
  
  if (!window.hrisCache.karyawan_data) {
    const raw = localStorage.getItem('hris_employees') || localStorage.getItem('karyawan_data') || '[]';
    try {
      window.hrisCache.karyawan_data = JSON.parse(raw);
    } catch(e) {
      window.hrisCache.karyawan_data = [];
    }
  }
  
  if (!window.hrisCache.corporate_policies) {
    const raw = localStorage.getItem('corporate_policies') || '[]';
    try {
      window.hrisCache.corporate_policies = JSON.parse(raw);
    } catch(e) {
      window.hrisCache.corporate_policies = [];
    }
  }
  
  if (!window.hrisCache.payroll_data) {
    const raw = localStorage.getItem('hris_payroll_slips') || '[]';
    try {
      window.hrisCache.payroll_data = JSON.parse(raw);
    } catch(e) {
      window.hrisCache.payroll_data = [];
    }
  }
};

window.getHrisEmployees = () => {
  window.initHrisCache();
  return window.hrisCache.karyawan_data;
};

window.setHrisEmployees = (list) => {
  window.initHrisCache();
  window.hrisCache.karyawan_data = list;
  localStorage.setItem('hris_employees', JSON.stringify(list));
  localStorage.setItem('karyawan_data', JSON.stringify(list));
};

window.getHrisPolicies = () => {
  window.initHrisCache();
  return window.hrisCache.corporate_policies;
};

window.setHrisPolicies = (list) => {
  window.initHrisCache();
  window.hrisCache.corporate_policies = list;
  localStorage.setItem('corporate_policies', JSON.stringify(list));
};

window.getHrisPayroll = () => {
  window.initHrisCache();
  return window.hrisCache.payroll_data;
};

window.setHrisPayroll = (list) => {
  window.initHrisCache();
  window.hrisCache.payroll_data = list;
  localStorage.setItem('hris_payroll_slips', JSON.stringify(list));
};

// Warm up cache immediately
window.initHrisCache();

// Persistent Network Layer: Intercept window.fetch to inject 5s timeout and Localtunnel Bypass headers.
// NOTE: Retry logic removed to prevent app freeze on startup (multiple simultaneous API calls).
const originalFetch = window.fetch.bind(window);
window.fetch = async (url, options = {}) => {
  // Only inject headers for our own API endpoints, not external resources
  const isApiUrl = typeof url === 'string' && (
    url.includes('barokahgroupindonesia.tech') ||
    url.includes('barokahgrup') ||
    url.includes('localtunnel') ||
    url.includes('loca.lt') ||
    url.includes('trycloudflare') ||
    url.includes('127.0.0.1') ||
    url.includes('localhost') ||
    (url.startsWith('/') && !url.startsWith('//'))
  );

  if (isApiUrl) {
    options = { ...options };
    options.headers = options.headers ? { ...options.headers } : {};
    if (!(options.headers instanceof Headers)) {
      options.headers['Bypass-Tunnel-Reminder'] = 'true';
    }
  }

  // If caller already provided a signal, respect it; otherwise create a 5s timeout
  if (!options.signal) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 5000); // 5-second timeout
    try {
      const response = await originalFetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);
      return response;
    } catch (error) {
      clearTimeout(id);
      throw error;
    }
  }

  return originalFetch(url, options);
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

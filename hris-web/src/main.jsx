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

// Persistent Network Layer: Intercept window.fetch to inject 15s timeout, Localtunnel Bypass headers, and 3-cycle auto-retry on transient failures.
const originalFetch = window.fetch;
window.fetch = async (url, options = {}) => {
  options.headers = options.headers || {};
  
  if (typeof url === 'string' && (url.includes('barokahgrup') || url.includes('localtunnel') || url.includes('loca.lt') || url.includes('trycloudflare') || url.includes('127.0.0.1') || url.includes('localhost') || url.startsWith('/') || !url.startsWith('http'))) {
    if (options.headers instanceof Headers) {
      options.headers.set('Bypass-Tunnel-Reminder', 'true');
      if (!options.headers.has('Content-Type')) {
        options.headers.set('Content-Type', 'application/json');
      }
    } else {
      options.headers['Bypass-Tunnel-Reminder'] = 'true';
      if (!options.headers['Content-Type']) {
        options.headers['Content-Type'] = 'application/json';
      }
    }
  }

  const maxRetries = 3;
  const retryDelay = 2000;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 15000); // 15-second timeout
    
    try {
      const response = await originalFetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(id);
      return response;
    } catch (error) {
      clearTimeout(id);
      const isTransient = error.name === 'AbortError' || error.message.includes('Failed to fetch') || error.message.includes('NetworkError');
      if (isTransient && attempt < maxRetries) {
        console.warn(`WebAdmin Network Retry (${attempt}/${maxRetries}) for: ${url}`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      } else {
        throw error;
      }
    }
  }
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

/**
 * HRISContext.jsx — Global Reactive State Synchronizer
 * =====================================================
 * Pusat komando tunggal untuk seluruh data induk HRIS.
 * Strategi: localStorage Patcher + CustomEvent Bus
 */

import React, {
  createContext, useContext, useState,
  useEffect, useCallback, useRef, useMemo
} from 'react';

// ─── In-Memory Storage Patch ─────────────────────────────────────────────────
const trackedKeys = new Set([
  'hris_employees', 'karyawan_data', 'outlet_cabang_data',
  'target_omzet_data', 'daily_revenue_logs', 'target_staf_data',
  'hris_payroll_slips', 'corporate_policies', 'quiz_bank', 
  'quiz_bank_generated', 'quiz_results', 'hris_notifications', 
  'hris_broadcasts', 'hris_broadcast_receipts', 'hris_trainings', 
  'hris_training_results', 'hris_training_materials', 'hris_user_passwords', 
  'hris_custom_usernames', 'hris_user_roles', 'hris_disc_results', 
  'hris_360_ratings', 'hris_payroll_mobile_slips', 'filter_karyawan_state',
  'user_credentials', 'rbac_settings', 'organizational_roles'
]);

const memoryStorage = {};

let originalGetItem = null;
let originalSetItem = null;
let originalRemoveItem = null;

if (typeof window !== 'undefined') {
  originalGetItem = localStorage.getItem.bind(localStorage);
  originalSetItem = localStorage.setItem.bind(localStorage);
  originalRemoveItem = localStorage.removeItem.bind(localStorage);

  // Initialize memoryStorage with existing values from actual localStorage
  trackedKeys.forEach(key => {
    const val = originalGetItem(key);
    if (val !== null) {
      memoryStorage[key] = val;
    }
  });

  localStorage.getItem = function(key) {
    if (trackedKeys.has(key)) {
      return memoryStorage[key] || null;
    }
    return originalGetItem(key);
  };

  localStorage.setItem = function(key, value) {
    if (trackedKeys.has(key)) {
      memoryStorage[key] = String(value);
      window.dispatchEvent(new CustomEvent('hris:storage', { detail: { key, value } }));
      originalSetItem(key, value);
      return;
    }
    return originalSetItem(key, value);
  };

  localStorage.removeItem = function(key) {
    if (trackedKeys.has(key)) {
      delete memoryStorage[key];
      window.dispatchEvent(new CustomEvent('hris:storage', { detail: { key, value: null } }));
      originalRemoveItem(key);
      return;
    }
    return originalRemoveItem(key);
  };
}

const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    let hostname = window.location.hostname;
    if (hostname.includes('barokahgroupindonesia.tech')) {
      return 'https://api.barokahgroupindonesia.tech/api';
    }
    if (hostname === 'localhost') {
      hostname = '127.0.0.1';
    }
    const isTunnel = hostname.includes('localtunnel') || hostname.includes('ngrok') || hostname.includes('loca.lt') || hostname.includes('trycloudflare');
    if (!isTunnel) {
      return `http://${hostname}:5000/api`;
    }
  }
  return 'https://barokahgrup-hris.localtunnel.me/api';
};

const getSyncApiUrl = () => {
  if (typeof window !== 'undefined') {
    let hostname = window.location.hostname;
    if (hostname === 'localhost') {
      hostname = '127.0.0.1';
    }
    return `http://${hostname}:3001/api/sync`;
  }
  return 'http://127.0.0.1:3001/api/sync';
};

const API_URL = getApiUrl();
const SYNC_API_URL = getSyncApiUrl();

// ─── LocalStorage Keys (Canonical) ───────────────────────────────────────────
export const LS_KEYS = {
  EMPLOYEES:      'hris_employees',
  EMPLOYEES_ALT:  'karyawan_data',
  OUTLETS:        'outlet_cabang_data',
  TARGET_OMZET:   'target_omzet_data',
  DAILY_REVENUE:  'daily_revenue_logs',
  TARGET_STAF:    'target_staf_data',
  PAYROLL:        'hris_payroll_slips',
  POLICIES:       'corporate_policies',
};

// ─── Pesan Sinkronisasi ───────────────────────────────────────────────────────
export const SYNC_MESSAGES = {
  EMPLOYEE_CHANGED: 'Menyinkronkan Data Karyawan ke Seluruh Modul...',
  TARGET_CHANGED:   'Memperbarui Target Outlet ke Seluruh Grafik...',
  REVENUE_CHANGED:  'Mengakumulasikan Omzet ke Dashboard & Grafik...',
  OUTLET_CHANGED:   'Menyinkronkan Data Outlet ke Semua Halaman...',
  PAYROLL_CHANGED:  'Menyinkronkan Slip Gaji...',
  QUIZ_SENT:        'Menyebarkan Soal Kuis & Menyinkronkan Notifikasi ke Gadget Karyawan...',
  QUIZ_CHANGED:     'Memperbarui Bank Soal Kuis...',
  QUIZ_GENERATING:  'Menganalisis Dokumen & Memproduksi Bank Soal Kuis Kompetensi...',
  BROADCAST_SENT:   'Menembakkan Push Notification & Menyinkronkan Log Siaran...',
  TRAINING_SAVED:   'Menerbitkan Jadwal Training & Mengirimkan Undangan Seluler...',
  GENERIC:          'Menyinkronkan Perubahan ke Seluruh Modul...',
  FILTER_CHANGED:   'Menyinkronkan Laporan Card Global & Menyusun Ulang Struktur Dashboard...',
  SYNC_INT:         'Menyinkronkan Integritas Data Lintas Platform...',
  DISPATCH_EVENT:   'Menembakkan Sinyal Event ke Server & Membangunkan Notifikasi Mobile...',
  ROLE_CHANGED:     'Menyinkronkan Struktur Jabatan & Divisi...',
  POLICY_CHANGED:   'Menyinkronkan Kebijakan Perusahaan...',
};

const KEY_TO_ACTION = {
  'hris_employees':      'EMPLOYEE_CHANGED',
  'karyawan_data':       'EMPLOYEE_CHANGED',
  'outlet_cabang_data':  'OUTLET_CHANGED',
  'target_omzet_data':   'TARGET_CHANGED',
  'daily_revenue_logs':  'REVENUE_CHANGED',
  'target_staf_data':    'TARGET_CHANGED',
  'hris_payroll_slips':  'PAYROLL_CHANGED',
  'quiz_bank':           'QUIZ_CHANGED',
  'quiz_bank_generated': 'QUIZ_GENERATING',
  'quiz_results':        'QUIZ_SENT',
  'hris_notifications':  'QUIZ_SENT',
  'hris_broadcasts':          'BROADCAST_SENT',
  'hris_broadcast_receipts':  'BROADCAST_SENT',
  'hris_trainings':           'TRAINING_SAVED',
  'hris_training_results':    'TRAINING_SAVED',
  'hris_training_materials':  'TRAINING_SAVED',
  'organizational_roles':     'ROLE_CHANGED',
  'corporate_policies':       'POLICY_CHANGED',
};

const HRISContext = createContext(null);

const lsRead = (key, fallback = null) => {
  try {
    const raw = trackedKeys.has(key) ? memoryStorage[key] : localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const lsWrite = (key, value) => {
  try {
    const serialized = JSON.stringify(value);
    if (trackedKeys.has(key)) {
      memoryStorage[key] = serialized;
      window.dispatchEvent(new CustomEvent('hris:storage', { detail: { key, value } }));
    } else {
      if (originalSetItem) {
        originalSetItem(key, serialized);
      } else {
        localStorage.setItem(key, serialized);
      }
    }
  } catch (e) {
    console.error('[HRIS] lsWrite failed:', key, e);
  }
};

export function HRISProvider({ children }) {
  const [employees, setEmployees]         = useState(() => lsRead('hris_employees', []));
  const [outlets, setOutlets]             = useState(() => lsRead('outlet_cabang_data', []));
  const [targetOmzet, setTargetOmzet]     = useState(() => lsRead('target_omzet_data', []));
  const [dailyRevenue, setDailyRevenue]   = useState(() => lsRead('daily_revenue_logs', []));
  const [targetStaf, setTargetStaf]       = useState(() => lsRead('target_staf_data', []));
  const [roles, setRoles]                 = useState(() => lsRead('organizational_roles', []));
  const [policies, setPolicies]           = useState(() => lsRead('corporate_policies', []));
  const [syncStatus, setSyncStatus]       = useState({ active: false, message: '', type: '' });
  const syncTimer = useRef(null);

  const triggerSync = useCallback((actionType, duration = 800) => {
    const message = SYNC_MESSAGES[actionType] || SYNC_MESSAGES.GENERIC;
    setSyncStatus({ active: true, message, type: actionType });
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => setSyncStatus({ active: false, message: '', type: '' }), duration);
  }, []);

  const applyKey = useCallback((key, rawValue) => {
    const actionType = KEY_TO_ACTION[key];
    if (!actionType) return;
    const parsed = typeof rawValue === 'string'
      ? (() => { try { return JSON.parse(rawValue); } catch { return null; } })()
      : rawValue;
    if (parsed === null) return;

    if (key === 'hris_employees' || key === 'karyawan_data') {
      setEmployees(Array.isArray(parsed) ? parsed : []);
    } else if (key === 'outlet_cabang_data') {
      setOutlets(Array.isArray(parsed) ? parsed : []);
    } else if (key === 'target_omzet_data') {
      setTargetOmzet(Array.isArray(parsed) ? parsed : []);
    } else if (key === 'daily_revenue_logs') {
      setDailyRevenue(Array.isArray(parsed) ? parsed : []);
    } else if (key === 'target_staf_data') {
      // Accept both array and object formats
      setTargetStaf(Array.isArray(parsed) ? parsed : (typeof parsed === 'object' && parsed !== null ? parsed : []));
    } else if (key === 'organizational_roles') {
      setRoles(Array.isArray(parsed) ? parsed : []);
    } else if (key === 'corporate_policies') {
      setPolicies(Array.isArray(parsed) ? parsed : []);
    }
    const duration = actionType === 'QUIZ_GENERATING' ? 300 : 800;
    triggerSync(actionType, duration);
  }, [triggerSync]);

  // Listen to intra-tab CustomEvent
  useEffect(() => {
    const h = (e) => applyKey(e.detail.key, e.detail.value);
    window.addEventListener('hris:storage', h);
    return () => window.removeEventListener('hris:storage', h);
  }, [applyKey]);

  // Listen to cross-tab StorageEvent
  useEffect(() => {
    const h = (e) => { if (e.key && e.newValue) applyKey(e.key, e.newValue); };
    window.addEventListener('storage', h);
    return () => window.removeEventListener('storage', h);
  }, [applyKey]);

  // Handle sync user_credentials di memori
  useEffect(() => {
    const handleCredentialChange = (e) => {
      const { key } = e.detail || {};
      if (key === 'hris_user_passwords' || key === 'hris_custom_usernames' || key === 'hris_user_roles') {
        try {
          const passwords = JSON.parse(localStorage.getItem('hris_user_passwords') || '{}');
          const usernames = JSON.parse(localStorage.getItem('hris_custom_usernames') || '{}');
          const roles = JSON.parse(localStorage.getItem('hris_user_roles') || '{}');
          memoryStorage['user_credentials'] = JSON.stringify({ passwords, usernames, roles });
        } catch (err) {}
      }
    };
    window.addEventListener('hris:storage', handleCredentialChange);
    return () => window.removeEventListener('hris:storage', handleCredentialChange);
  }, []);

  // Inisialisasi awal user_credentials di memori
  useEffect(() => {
    try {
      const passwords = JSON.parse(localStorage.getItem('hris_user_passwords') || '{}');
      const usernames = JSON.parse(localStorage.getItem('hris_custom_usernames') || '{}');
      const roles = JSON.parse(localStorage.getItem('hris_user_roles') || '{}');
      memoryStorage['user_credentials'] = JSON.stringify({ passwords, usernames, roles });
    } catch (e) {}
  }, []);

  // Sync with main backend (port 5000) — only runs after user is logged in
  useEffect(() => {
    const token = sessionStorage.getItem('token');
    if (!API_URL || !token || token.startsWith('local-')) return;

    const syncWithMainBackend = async () => {
      const headers = { 'Authorization': `Bearer ${token}` };
      const fetchWithTimeout = async (url, opts = {}) => {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 4000);
        try {
          const r = await originalFetch(url, { ...opts, signal: ctrl.signal });
          clearTimeout(tid);
          return r;
        } catch (e) {
          clearTimeout(tid);
          throw e;
        }
      };

      try {
        // 1. Fetch training materials
        const resMat = await fetchWithTimeout(`${API_URL}/training-media`);
        const jsonMat = await resMat.json();
        if (jsonMat.status === 'success' && jsonMat.materials) {
          const localMat = lsRead('hris_training_materials', []);
          if (JSON.stringify(localMat) !== JSON.stringify(jsonMat.materials)) {
            if (originalSetItem) {
              originalSetItem('hris_training_materials', JSON.stringify(jsonMat.materials));
            } else {
              localStorage.setItem('hris_training_materials', JSON.stringify(jsonMat.materials));
            }
            window.dispatchEvent(new CustomEvent('hris:storage', { detail: { key: 'hris_training_materials', value: jsonMat.materials } }));
          }
        }
      } catch (e) { /* silently ignore */ }

      try {
        // 2. Fetch DISC results
        const resDisc = await fetchWithTimeout(`${API_URL}/disc-results`);
        const jsonDisc = await resDisc.json();
        if (jsonDisc.status === 'success' && jsonDisc.results) {
          const localDisc = lsRead('hris_disc_results', []);
          if (JSON.stringify(localDisc) !== JSON.stringify(jsonDisc.results)) {
            if (originalSetItem) {
              originalSetItem('hris_disc_results', JSON.stringify(jsonDisc.results));
            } else {
              localStorage.setItem('hris_disc_results', JSON.stringify(jsonDisc.results));
            }
            window.dispatchEvent(new CustomEvent('hris:storage', { detail: { key: 'hris_disc_results', value: jsonDisc.results } }));
          }
        }
      } catch (e) { /* silently ignore */ }

      try {
        // 3. Fetch credentials
        const resCred = await fetchWithTimeout(`${API_URL}/credentials`);
        const jsonCred = await resCred.json();
        if (jsonCred.status === 'success' && jsonCred.data) {
          const list = jsonCred.data;
          const passwords = {}, usernames = {}, roles = {};
          list.forEach(c => { passwords[c.id] = c.password; usernames[c.id] = c.username; roles[c.id] = c.role; });
          const localPass = lsRead('hris_user_passwords', {});
          if (JSON.stringify(localPass) !== JSON.stringify(passwords)) lsWrite('hris_user_passwords', passwords);
          const localUsernames = lsRead('hris_custom_usernames', {});
          if (JSON.stringify(localUsernames) !== JSON.stringify(usernames)) lsWrite('hris_custom_usernames', usernames);
          const localRoles = lsRead('hris_user_roles', {});
          if (JSON.stringify(localRoles) !== JSON.stringify(roles)) lsWrite('hris_user_roles', roles);
        }
      } catch (e) { /* silently ignore */ }

      try {
        // 4. Fetch mobile slips
        const resSlips = await fetchWithTimeout(`${API_URL}/payroll/mobile-slips`);
        const jsonSlips = await resSlips.json();
        if (jsonSlips.status === 'success' && jsonSlips.data) {
          const localSlips = lsRead('hris_payroll_mobile_slips', []);
          if (JSON.stringify(localSlips) !== JSON.stringify(jsonSlips.data)) {
            if (originalSetItem) {
              originalSetItem('hris_payroll_mobile_slips', JSON.stringify(jsonSlips.data));
            } else {
              localStorage.setItem('hris_payroll_mobile_slips', JSON.stringify(jsonSlips.data));
            }
            window.dispatchEvent(new CustomEvent('hris:storage', { detail: { key: 'hris_payroll_mobile_slips', value: jsonSlips.data } }));
          }
        }
      } catch (e) { /* silently ignore */ }

      try {
        // 5. Fetch quizzes
        const resQuizzes = await fetchWithTimeout(`${API_URL}/quizzes`);
        const jsonQuizzes = await resQuizzes.json();
        if (jsonQuizzes.status === 'success' && jsonQuizzes.data) {
          const localQuizzes = lsRead('quiz_bank', []);
          if (JSON.stringify(localQuizzes) !== JSON.stringify(jsonQuizzes.data)) {
            if (originalSetItem) {
              originalSetItem('quiz_bank', JSON.stringify(jsonQuizzes.data));
            } else {
              localStorage.setItem('quiz_bank', JSON.stringify(jsonQuizzes.data));
            }
            window.dispatchEvent(new CustomEvent('hris:storage', { detail: { key: 'quiz_bank', value: jsonQuizzes.data } }));
          }
        }
      } catch (e) { /* silently ignore */ }

      try {
        // 6. Fetch quiz attempts
        const resAttempts = await fetchWithTimeout(`${API_URL}/quizzes/attempts`);
        const jsonAttempts = await resAttempts.json();
        if (jsonAttempts.status === 'success' && jsonAttempts.data) {
          const localResults = lsRead('quiz_results', []);
          if (JSON.stringify(localResults) !== JSON.stringify(jsonAttempts.data)) {
            if (originalSetItem) {
              originalSetItem('quiz_results', JSON.stringify(jsonAttempts.data));
            } else {
              localStorage.setItem('quiz_results', JSON.stringify(jsonAttempts.data));
            }
            window.dispatchEvent(new CustomEvent('hris:storage', { detail: { key: 'quiz_results', value: jsonAttempts.data } }));
          }
        }
      } catch (e) { /* silently ignore */ }
    };

    syncWithMainBackend();

    // Poll every 30 seconds (was 6s — too aggressive)
    const interval = setInterval(syncWithMainBackend, 30000);
    return () => clearInterval(interval);
  }, [API_URL]);


  // Outbound push to main backend on changes
  useEffect(() => {
    if (!API_URL) return;
    const handleStorageChange = async (e) => {
      const { key, value } = e.detail || {};
      if (key === 'hris_training_materials') {
        try {
          await fetch(`${API_URL}/training-media`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ materials: value })
          });
        } catch (err) {}
      }
      // Pushing credentials on change dinonaktifkan
      if (key === 'hris_payroll_mobile_slips') {
        try {
          await fetch(`${API_URL}/payroll/mobile-slips`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slips: value })
          });
        } catch (err) {}
      }
      if (key === 'quiz_bank') {
        try {
          await fetch(`${API_URL}/quizzes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quizzes: value })
          });
        } catch (err) {}
      }
      if (key === 'quiz_results') {
        try {
          await fetch(`${API_URL}/quizzes/attempts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ attempts: value })
          });
        } catch (err) {}
      }
    };
    window.addEventListener('hris:storage', handleStorageChange);
    return () => window.removeEventListener('hris:storage', handleStorageChange);
  }, [API_URL]);

  // Master dispatch
  const dispatch = useCallback((actionType, data, duration) => {
    switch (actionType) {
      case 'EMPLOYEE_CHANGED': {
        const list = Array.isArray(data) ? data : [];
        setEmployees(list);
        lsWrite('hris_employees', list);
        lsWrite('karyawan_data', list);
        if (window.setHrisEmployees) window.setHrisEmployees(list);
        triggerSync('EMPLOYEE_CHANGED', duration);
        break;
      }
      case 'OUTLET_CHANGED': {
        const list = Array.isArray(data) ? data : [];
        setOutlets(list);
        lsWrite('outlet_cabang_data', list);
        triggerSync('OUTLET_CHANGED', duration);
        break;
      }
      case 'TARGET_CHANGED': {
        if (data?.targetOmzet !== undefined) {
          setTargetOmzet(data.targetOmzet);
          lsWrite('target_omzet_data', data.targetOmzet);
        }
        if (data?.targetStaf !== undefined) {
          const stafData = data.targetStaf;
          setTargetStaf(Array.isArray(stafData) ? stafData : (typeof stafData === 'object' && stafData !== null ? stafData : []));
          lsWrite('target_staf_data', stafData);
        }
        triggerSync('TARGET_CHANGED', duration);
        break;
      }
      case 'REVENUE_CHANGED': {
        const list = Array.isArray(data) ? data : [];
        setDailyRevenue(list);
        lsWrite('daily_revenue_logs', list);
        triggerSync('REVENUE_CHANGED', duration);
        break;
      }
      case 'QUIZ_SENT': {
        triggerSync('QUIZ_SENT', duration);
        break;
      }
      case 'QUIZ_CHANGED': {
        triggerSync('QUIZ_CHANGED', duration);
        break;
      }
      case 'QUIZ_GENERATING': {
        triggerSync('QUIZ_GENERATING', duration ?? 300);
        break;
      }
      case 'BROADCAST_SENT': {
        triggerSync('BROADCAST_SENT', duration);
        break;
      }
      case 'TRAINING_SAVED': {
        triggerSync('TRAINING_SAVED', duration);
        break;
      }
      case 'ROLE_CHANGED': {
        const list = Array.isArray(data) ? data : [];
        setRoles(list);
        lsWrite('organizational_roles', list);
        triggerSync('ROLE_CHANGED', duration);
        break;
      }
      case 'POLICY_CHANGED': {
        const list = Array.isArray(data) ? data : [];
        setPolicies(list);
        lsWrite('corporate_policies', list);
        triggerSync('POLICY_CHANGED', duration);
        break;
      }
      case 'FILTER_CHANGED': {
        triggerSync('FILTER_CHANGED', duration ?? 200);
        break;
      }
      default:
        triggerSync('GENERIC', duration);
    }
  }, [triggerSync]);

  const activeEmployees = useMemo(
    () => employees.filter(e => !e.employee_status || e.employee_status === 'active'),
    [employees]
  );

  const employeesByOutlet = useMemo(() => {
    const map = {};
    activeEmployees.forEach(e => {
      const key = (e.outlet || 'LAINNYA').toUpperCase().trim();
      if (!map[key]) map[key] = [];
      map[key].push(e);
    });
    return map;
  }, [activeEmployees]);

  const totalMonthlyRevenue = useMemo(() => {
    const now = new Date();
    return dailyRevenue
      .filter(r => {
        const d = new Date(r.date || r.tanggal || '');
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((sum, r) => sum + (parseFloat(r.amount || r.jumlah || 0)), 0);
  }, [dailyRevenue]);

  const value = useMemo(() => ({
    employees, outlets, targetOmzet, dailyRevenue, targetStaf, syncStatus,
    activeEmployees, employeesByOutlet, totalMonthlyRevenue,
    roles, setRoles, policies, setPolicies,
    dispatch, LS_KEYS, SYNC_MESSAGES, triggerSync
  }), [employees, outlets, targetOmzet, dailyRevenue, targetStaf, syncStatus,
      activeEmployees, employeesByOutlet, totalMonthlyRevenue, roles, policies, dispatch, triggerSync]);

  return <HRISContext.Provider value={value}>{children}</HRISContext.Provider>;
}

export function useHRIS() {
  const ctx = useContext(HRISContext);
  if (!ctx) throw new Error('useHRIS() harus di dalam <HRISProvider>');
  return ctx;
}

// Hook ringan untuk subscribe ke satu localStorage key tertentu
export function useHRISStorage(key, defaultValue = null) {
  const [value, setValue] = useState(() => lsRead(key, defaultValue));
  useEffect(() => {
    const h = (e) => {
      if (e.detail?.key === key) {
        const v = e.detail.value;
        setValue(typeof v === 'string' ? (() => { try { return JSON.parse(v); } catch { return v; } })() : v);
      }
    };
    const sh = (e) => { if (e.key === key && e.newValue) { try { setValue(JSON.parse(e.newValue)); } catch {} } };
    window.addEventListener('hris:storage', h);
    window.addEventListener('storage', sh);
    return () => { window.removeEventListener('hris:storage', h); window.removeEventListener('storage', sh); };
  }, [key]);
  const write = useCallback((v) => { setValue(v); lsWrite(key, v); }, [key]);
  return [value, write];
}

export default HRISContext;

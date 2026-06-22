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

const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    let hostname = window.location.hostname;
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
};

const HRISContext = createContext(null);

const lsRead = (key, fallback = null) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const lsWrite = (key, value) => {
  try {
    const serialized = JSON.stringify(value);
    // Bypass patched setItem untuk avoid double event
    Object.getPrototypeOf(localStorage).setItem.call(localStorage, key, serialized);
    window.dispatchEvent(new CustomEvent('hris:storage', { detail: { key, value } }));
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

  // Monkey-patch localStorage.setItem untuk intercept semua writes
  useEffect(() => {
    const tracked = new Set(['hris_employees','karyawan_data','outlet_cabang_data',
      'target_omzet_data','daily_revenue_logs','target_staf_data','hris_payroll_slips',
      'quiz_bank','quiz_bank_generated','quiz_results','hris_notifications',
      'hris_broadcasts','hris_broadcast_receipts',
      'hris_trainings','hris_training_results','hris_training_materials',
      'hris_user_passwords','hris_custom_usernames','hris_user_roles', 'hris_disc_results','hris_360_ratings','hris_payroll_mobile_slips']);
    const proto = Object.getPrototypeOf(localStorage);
    const original = proto.setItem.bind(localStorage);
    proto.setItem = function(key, value) {
      original(key, value);
      if (tracked.has(key)) {
        window.dispatchEvent(new CustomEvent('hris:storage', { detail: { key, value } }));
      }
      if (key === 'hris_user_passwords' || key === 'hris_custom_usernames' || key === 'hris_user_roles') {
        try {
          const passwords = JSON.parse(localStorage.getItem('hris_user_passwords') || '{}');
          const usernames = JSON.parse(localStorage.getItem('hris_custom_usernames') || '{}');
          const roles = JSON.parse(localStorage.getItem('hris_user_roles') || '{}');
          original('user_credentials', JSON.stringify({ passwords, usernames, roles }));
        } catch (e) {}
      }
    };
    return () => { proto.setItem = original; };
  }, []);

  // Initialize unified user_credentials on startup
  useEffect(() => {
    try {
      const passwords = JSON.parse(localStorage.getItem('hris_user_passwords') || '{}');
      const usernames = JSON.parse(localStorage.getItem('hris_custom_usernames') || '{}');
      const roles = JSON.parse(localStorage.getItem('hris_user_roles') || '{}');
      localStorage.setItem('user_credentials', JSON.stringify({ passwords, usernames, roles }));
    } catch (e) {}
  }, []);

  // Sync with localserver.js
  useEffect(() => {
    const fetchLatestServerState = async () => {
      try {
        const res = await fetch(SYNC_API_URL);
        const json = await res.json();
        if (json.status === 'success' && json.serverState) {
          const state = json.serverState;
          Object.keys(state).forEach(key => {
            if (state[key] && (!localStorage.getItem(key) || localStorage.getItem(key) !== JSON.stringify(state[key]))) {
              Object.getPrototypeOf(localStorage).setItem.call(localStorage, key, JSON.stringify(state[key]));
              if (key === 'hris_employees') setEmployees(state[key]);
              if (key === 'outlet_cabang_data') setOutlets(state[key]);
              if (key === 'target_omzet_data') setTargetOmzet(state[key]);
              if (key === 'daily_revenue_logs') setDailyRevenue(state[key]);
              if (key === 'target_staf_data') setTargetStaf(state[key]);
            }
          });
        }
      } catch (e) {
        console.log('localserver.js not running or unreachable on port 3001.');
      }
    };
    fetchLatestServerState();

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(SYNC_API_URL);
        const json = await res.json();
        if (json.status === 'success' && json.serverState) {
          const state = json.serverState;
          const keysToSync = ['hris_disc_results', 'hris_360_ratings', 'quiz_results', 'hris_user_passwords', 'hris_custom_usernames', 'hris_user_roles'];
          keysToSync.forEach(key => {
            if (state[key] && localStorage.getItem(key) !== JSON.stringify(state[key])) {
              Object.getPrototypeOf(localStorage).setItem.call(localStorage, key, JSON.stringify(state[key]));
              window.dispatchEvent(new CustomEvent('hris:storage', { detail: { key, value: state[key] } }));
            }
          });
        }
      } catch (e) {}
    }, 5000);
    return () => clearInterval(pollInterval);
  }, []);

  // Sync outbound writes to localserver.js
  useEffect(() => {
    let debounceTimer;
    const trackedKeys = new Set([
      'hris_employees', 'karyawan_data', 'outlet_cabang_data',
      'target_omzet_data', 'daily_revenue_logs', 'target_staf_data',
      'hris_payroll_slips', 'quiz_bank', 'quiz_bank_generated',
      'quiz_results', 'hris_notifications', 'hris_broadcasts',
      'hris_broadcast_receipts', 'hris_trainings', 'hris_training_results',
      'hris_training_materials', 'hris_disc_results', 'hris_360_ratings',
      'hris_user_passwords', 'hris_custom_usernames', 'hris_user_roles',
      'hris_payroll_mobile_slips'
    ]);

    const handleStorageChange = (e) => {
      const { key } = e.detail || {};
      if (key && trackedKeys.has(key)) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
          const payload = {};
          trackedKeys.forEach(k => {
            const v = localStorage.getItem(k);
            try { payload[k] = v ? JSON.parse(v) : null; } catch { payload[k] = v; }
          });
          try {
            await fetch(SYNC_API_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ data: payload })
            });
          } catch (err) {}
        }, 1000);
      }
    };

    window.addEventListener('hris:storage', handleStorageChange);
    return () => {
      window.removeEventListener('hris:storage', handleStorageChange);
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, []);

  // Sync with main backend (port 5000)
  useEffect(() => {
    if (!API_URL) return;

    const syncWithMainBackend = async () => {
      try {
        // 1. Fetch materials from main backend
        const resMat = await fetch(`${API_URL}/training-media`);
        const jsonMat = await resMat.json();
        if (jsonMat.status === 'success' && jsonMat.materials) {
          const localMat = lsRead('hris_training_materials', []);
          if (JSON.stringify(localMat) !== JSON.stringify(jsonMat.materials)) {
            Object.getPrototypeOf(localStorage).setItem.call(localStorage, 'hris_training_materials', JSON.stringify(jsonMat.materials));
            window.dispatchEvent(new CustomEvent('hris:storage', { detail: { key: 'hris_training_materials', value: jsonMat.materials } }));
          }
        }

        // 2. Fetch DISC results from main backend
        const resDisc = await fetch(`${API_URL}/disc-results`);
        const jsonDisc = await resDisc.json();
        if (jsonDisc.status === 'success' && jsonDisc.results) {
          const localDisc = lsRead('hris_disc_results', []);
          if (JSON.stringify(localDisc) !== JSON.stringify(jsonDisc.results)) {
            Object.getPrototypeOf(localStorage).setItem.call(localStorage, 'hris_disc_results', JSON.stringify(jsonDisc.results));
            window.dispatchEvent(new CustomEvent('hris:storage', { detail: { key: 'hris_disc_results', value: jsonDisc.results } }));
          }
        }

        // 3. Push credentials to main backend to ensure zero-stale state on start
        const localPass = lsRead('hris_user_passwords', {});
        const localUsernames = lsRead('hris_custom_usernames', {});
        const localRoles = lsRead('hris_user_roles', {});
        await fetch(`${API_URL}/auth/sync-credentials`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ passwords: localPass, usernames: localUsernames, roles: localRoles })
        });

        // 4. Fetch mobile slips from main backend
        const resSlips = await fetch(`${API_URL}/payroll/mobile-slips`);
        const jsonSlips = await resSlips.json();
        if (jsonSlips.status === 'success' && jsonSlips.data) {
          const localSlips = lsRead('hris_payroll_mobile_slips', []);
          if (JSON.stringify(localSlips) !== JSON.stringify(jsonSlips.data)) {
            Object.getPrototypeOf(localStorage).setItem.call(localStorage, 'hris_payroll_mobile_slips', JSON.stringify(jsonSlips.data));
            window.dispatchEvent(new CustomEvent('hris:storage', { detail: { key: 'hris_payroll_mobile_slips', value: jsonSlips.data } }));
          }
        }

        // 5. Fetch quizzes from main backend
        const resQuizzes = await fetch(`${API_URL}/quizzes`);
        const jsonQuizzes = await resQuizzes.json();
        if (jsonQuizzes.status === 'success' && jsonQuizzes.data) {
          const localQuizzes = lsRead('quiz_bank', []);
          if (JSON.stringify(localQuizzes) !== JSON.stringify(jsonQuizzes.data)) {
            Object.getPrototypeOf(localStorage).setItem.call(localStorage, 'quiz_bank', JSON.stringify(jsonQuizzes.data));
            window.dispatchEvent(new CustomEvent('hris:storage', { detail: { key: 'quiz_bank', value: jsonQuizzes.data } }));
          }
        }

        // 6. Fetch quiz attempts from main backend
        const resAttempts = await fetch(`${API_URL}/quizzes/attempts`);
        const jsonAttempts = await resAttempts.json();
        if (jsonAttempts.status === 'success' && jsonAttempts.data) {
          const localResults = lsRead('quiz_results', []);
          if (JSON.stringify(localResults) !== JSON.stringify(jsonAttempts.data)) {
            Object.getPrototypeOf(localStorage).setItem.call(localStorage, 'quiz_results', JSON.stringify(jsonAttempts.data));
            window.dispatchEvent(new CustomEvent('hris:storage', { detail: { key: 'quiz_results', value: jsonAttempts.data } }));
          }
        }
      } catch (e) {
        console.log('Main backend not running or unreachable on port 5000.');
      }
    };

    syncWithMainBackend();

    // Poll DISC results from main backend every 6 seconds
    const interval = setInterval(syncWithMainBackend, 6000);
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
      if (key === 'hris_user_passwords' || key === 'hris_custom_usernames' || key === 'hris_user_roles') {
        const passwords = lsRead('hris_user_passwords', {});
        const usernames = lsRead('hris_custom_usernames', {});
        const roles = lsRead('hris_user_roles', {});
        try {
          await fetch(`${API_URL}/auth/sync-credentials`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ passwords, usernames, roles })
          });
        } catch (err) {}
      }
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
    dispatch, LS_KEYS, SYNC_MESSAGES, triggerSync
  }), [employees, outlets, targetOmzet, dailyRevenue, targetStaf, syncStatus,
      activeEmployees, employeesByOutlet, totalMonthlyRevenue, dispatch, triggerSync]);

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

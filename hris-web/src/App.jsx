import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import Employees from './components/Employees';
import Attendances from './components/Attendances';
import Leaves from './components/Leaves';
import Payroll from './components/Payroll';
import SettingsPage from './components/SettingsPage';
import OutletPage from './components/OutletPage';
import OmzetCabang from './components/OmzetCabang';
import SopPage from './components/SopPage';
import KontrakPage from './components/KontrakPage';
import PenilaianKPI from './components/PenilaianKPI';
import SanksiPage from './components/SanksiPage';
import TrainingPage from './components/TrainingPage';
import PolicyPage from './components/PolicyPage';
import KuisKompetensi from './components/KuisKompetensi';
import BroadcastUtama from './components/BroadcastUtama';
import { HRISProvider } from './context/HRISContext';
import SyncOverlay from './components/SyncOverlay';
import HakUser from './components/HakUser';

import { Lock, CheckCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { checkAccess, getRoleFromPosition } from './utils/security';
import './App.css';

const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    const { protocol, host } = window.location;
    return `${protocol}//${host}/api`;
  }
  return 'http://127.0.0.1:5000/api';
};

const API_URL = getApiUrl();

const validateLocalLogin = (inputEmail, password) => {
  // Try parsing user_credentials first
  let creds = null;
  try {
    const raw = localStorage.getItem('user_credentials');
    creds = raw ? JSON.parse(raw) : null;
  } catch (e) {}

  // Fallback to separate keys if user_credentials doesn't exist
  let passwords = creds?.passwords || {};
  let usernames = creds?.usernames || {};
  let roles = creds?.roles || {};

  if (!creds) {
    try {
      passwords = JSON.parse(localStorage.getItem('hris_user_passwords') || '{}');
      usernames = JSON.parse(localStorage.getItem('hris_custom_usernames') || '{}');
      roles = JSON.parse(localStorage.getItem('hris_user_roles') || '{}');
    } catch (e) {}
  }

  // Support super admin local intercept 'admin' / 'admin123'
  if (inputEmail === 'admin' && password === 'admin123') {
    return {
      id: 9999,
      email: 'admin@hris.local',
      role: 'owner',
      fullName: 'Admin Super',
      position: 'Super Administrator'
    };
  }

  const localEmployees = JSON.parse(localStorage.getItem('hris_employees') || '[]');
  let foundEmp = null;

  for (let i = 0; i < localEmployees.length; i++) {
    const emp = localEmployees[i];
    const firstName = emp.full_name.trim().split(/\s+/)[0] || 'USR';
    const prefix = (firstName.substring(0, 3).padEnd(3, 'X')).toUpperCase();
    const suffix = String(i + 1).padStart(5, '0');
    const generatedId = prefix + suffix;
    const customUsername = usernames[emp.id];
    
    if (
      generatedId.toLowerCase() === inputEmail ||
      (customUsername && customUsername.toLowerCase() === inputEmail)
    ) {
      foundEmp = emp;
      break;
    }
  }

  if (foundEmp) {
    const savedPass = passwords[foundEmp.id] || foundEmp.nik || '123456';
    if (String(savedPass) === String(password)) {
      const userRole = (roles[foundEmp.id] || getRoleFromPosition(foundEmp.position, foundEmp.role) || 'karyawan').toLowerCase();
      const isWebAllowed = userRole === 'master' || userRole === 'owner' || userRole === 'admin' || userRole === 'leader';
      
      if (!isWebAllowed) {
        throw new Error('Akses Ditolak: Akun Karyawan biasa hanya diperbolehkan masuk melalui Aplikasi Mobile Android.');
      }

      return {
        id: foundEmp.id,
        email: foundEmp.nik + '@hris.local',
        role: (userRole === 'master' || userRole === 'owner') ? 'owner' : (userRole === 'leader' ? 'leader' : 'admin'),
        employeeId: foundEmp.id,
        fullName: foundEmp.full_name,
        outlet: foundEmp.outlet,
        position: foundEmp.position
      };
    }
  }

  // Check default credentials
  if (inputEmail === 'admin@hris.com' && password === 'admin123') {
    return {
      id: 2,
      email: 'admin@hris.com',
      role: 'admin',
      fullName: 'HR Administrator',
      position: 'Human Resources Manager'
    };
  }
  if (inputEmail === 'owner@hris.com' && password === 'ownerpassword123') {
    return {
      id: 1,
      email: 'owner@hris.com',
      role: 'owner',
      fullName: 'Direktur Utama',
      position: 'Chief Executive Officer'
    };
  }

  return null;
};

export default function App() {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [userPermissions, setUserPermissions] = useState(null);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Ambil daftar perizinan dinamis pengguna saat token tersedia
  useEffect(() => {
    if (token) {
      if (token === 'local-admin-token' || token.startsWith('local-employee-token-')) {
        const mockPermissions = {};
        const modules = [
          'employees', 'attendances', 'leaves', 'payroll', 'outlets',
          'revenues', 'sops', 'contracts', 'kpis', 'sanctions',
          'trainings', 'policies', 'settings', 'kuis', 'broadcast'
        ];
        for (const mod of modules) {
          mockPermissions[mod] = { can_view: 1, can_edit: 1, can_delete: 1 };
        }
        setUserPermissions(mockPermissions);
        return;
      }

      fetch(`${API_URL}/auth/my-permissions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') {
          setUserPermissions(data.data.permissions);
        }
      })
      .catch(err => console.error('Eror mengambil hak akses:', err));
    } else {
      setUserPermissions(null);
    }
  }, [token]);

  // Login Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Periksa apakah token ada di sessionStorage saat boot (untuk persistensi ringan sesi)
  useEffect(() => {
    const savedToken = sessionStorage.getItem('token');
    const savedUser = sessionStorage.getItem('user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoggingIn(true);
    const startTime = Date.now();

    const inputEmail = email.toLowerCase().trim();

    // Promise for Network Login Check
    const networkLoginPromise = (async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500); // 1.5s timeout

      try {
        const res = await fetch(`${API_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: inputEmail, password, client: 'web' }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || 'Network error or invalid credentials');
        }

        const data = await res.json();
        if (data.status === 'success') {
          return data.data;
        } else {
          throw new Error(data.message || 'Invalid credentials');
        }
      } catch (err) {
        clearTimeout(timeoutId);
        throw err;
      }
    })();

    try {
      // Race the network request against a hard 1.5s timeout
      const networkResult = await Promise.race([
        networkLoginPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1500))
      ]);

      // Make sure we run the loading state for at least 0.3s
      const elapsed = Date.now() - startTime;
      if (elapsed < 300) {
        await new Promise(resolve => setTimeout(resolve, 300 - elapsed));
      }

      // Successful network login
      setLoggingIn(false);
      
      const userObj = networkResult.user;
      if (userObj.role !== 'owner' && userObj.role !== 'admin' && userObj.role !== 'leader' && userObj.role !== 'master') {
        setLoginError('Akses Ditolak: Akun Karyawan biasa hanya diperbolehkan masuk melalui Aplikasi Mobile Android.');
        return;
      }

      // Zero-Error Login success actions
      if (navigator.vibrate) navigator.vibrate(50); // subtle haptic vibration
      setToken(networkResult.token);
      setUser(userObj);
      sessionStorage.setItem('token', networkResult.token);
      sessionStorage.setItem('user', JSON.stringify(userObj));
      setPassword(''); // Clear password field
    } catch (netErr) {
      console.log('Network auth failed or timed out. Falling back to local authentication...', netErr.message);

      // LocalStorage Fallback Authentication
      try {
        const localResult = validateLocalLogin(inputEmail, password);

        // Make sure we run the loading state for at least 0.3s
        const elapsed = Date.now() - startTime;
        if (elapsed < 300) {
          await new Promise(resolve => setTimeout(resolve, 300 - elapsed));
        }

        setLoggingIn(false);

        if (localResult) {
          // Zero-Error Login success actions
          if (navigator.vibrate) navigator.vibrate(50); // subtle haptic vibration
          const localToken = 'local-session-token-' + localResult.id;
          setToken(localToken);
          setUser(localResult);
          sessionStorage.setItem('token', localToken);
          sessionStorage.setItem('user', JSON.stringify(localResult));
          setPassword(''); // Clear password field
        } else {
          setLoginError('Email / ID Pengguna atau password salah.');
        }
      } catch (localErr) {
        setLoggingIn(false);
        setLoginError(localErr.message || 'Gagal memproses otentikasi.');
      }
    }
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    setActiveTab('dashboard');
  };

  const renderTabContent = () => {
    // 1. Proteksi Halaman Hak Akses & Hak User (settings / hakuser) - Khusus Peran Master
    const currentUserRole = getRoleFromPosition(user?.position, user?.role);
    if ((activeTab === 'settings' || activeTab === 'hakuser') && currentUserRole !== 'master') {
      return (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          background: 'var(--card-bg)',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          marginTop: '20px'
        }} className="glass-card">
          <h2 style={{ color: 'var(--danger)', marginBottom: '16px' }}>Akses Ditolak</h2>
          <p style={{ color: 'var(--text-muted)' }}>Halaman ini hanya dapat diakses oleh akun dengan Peran Master.</p>
        </div>
      );
    }

    // 2. Proteksi Halaman Berdasarkan Dynamic READ access
    if (activeTab !== 'dashboard' && !checkAccess(user, 'read')) {
      return (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          background: 'var(--card-bg)',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          marginTop: '20px'
        }} className="glass-card">
          <h2 style={{ color: 'var(--danger)', marginBottom: '16px' }}>Akses Ditolak</h2>
          <p style={{ color: 'var(--text-muted)' }}>Anda tidak memiliki wewenang untuk melihat halaman ini.</p>
        </div>
      );
    }

    // 3. Proteksi Halaman Berdasarkan can_view (Fallback backend)
    if (
      userPermissions &&
      activeTab !== 'dashboard' &&
      userPermissions[activeTab] &&
      userPermissions[activeTab].can_view === 0
    ) {
      return (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          background: 'var(--card-bg)',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          marginTop: '20px'
        }} className="glass-card">
          <h2 style={{ color: 'var(--danger)', marginBottom: '16px' }}>Akses Ditolak</h2>
          <p style={{ color: 'var(--text-muted)' }}>Anda tidak memiliki wewenang untuk melihat halaman ini.</p>
        </div>
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return <Dashboard token={token} API_URL={API_URL} userPermissions={userPermissions} setActiveTab={setActiveTab} />;
      case 'employees':
        return <Employees token={token} API_URL={API_URL} userPermissions={userPermissions} user={user} theme={theme} />;
      case 'attendances':
        return <Attendances token={token} API_URL={API_URL} userPermissions={userPermissions} />;
      case 'leaves':
        return <Leaves token={token} API_URL={API_URL} userPermissions={userPermissions} user={user} />;
      case 'payroll':
        return <Payroll token={token} API_URL={API_URL} userPermissions={userPermissions} />;
      case 'contracts':
        return <KontrakPage token={token} API_URL={API_URL} userPermissions={userPermissions} />;
      case 'settings':
        return <SettingsPage token={token} API_URL={API_URL} userPermissions={userPermissions} user={user} />;
      case 'hakuser':
        return <HakUser token={token} API_URL={API_URL} user={user} />;
      case 'outlets':
        return <OutletPage token={token} API_URL={API_URL} userPermissions={userPermissions} user={user} />;
      case 'revenues':
        return <OmzetCabang token={token} API_URL={API_URL} userPermissions={userPermissions} theme={theme} />;
      case 'sops':
        return <SopPage token={token} API_URL={API_URL} userPermissions={userPermissions} />;

      case 'kpis':
        return <PenilaianKPI token={token} API_URL={API_URL} userPermissions={userPermissions} />;
      case 'sanctions':
        return <SanksiPage token={token} API_URL={API_URL} userPermissions={userPermissions} />;
      case 'trainings':
        return <TrainingPage token={token} API_URL={API_URL} userPermissions={userPermissions} />;
      case 'policies':
        return <PolicyPage token={token} API_URL={API_URL} userPermissions={userPermissions} user={user} />;
      case 'kuis':
        return <KuisKompetensi token={token} API_URL={API_URL} userPermissions={userPermissions} />;
      case 'broadcast':
        return <BroadcastUtama token={token} API_URL={API_URL} userPermissions={userPermissions} />;

      default:
        return <Dashboard token={token} API_URL={API_URL} userPermissions={userPermissions} setActiveTab={setActiveTab} />;
    }
  };

  // Jika Belum Terotentikasi, Render Tampilan Login Frosted Glass
  if (!token) {
    return (
      <div className="login-screen">
        <div className="glass-card login-card animate-fade-in">
          <div className="login-header">
            <div className="logo-icon" style={{ margin: '0 auto', width: '50px', height: '50px' }}>
              <Lock size={24} color="#fff" />
            </div>
            <h2>Barokah Grup</h2>
            <p>Masukkan ID dan password Anda untuk masuk</p>
          </div>

          <form onSubmit={handleLoginSubmit} style={{ textAlign: 'left' }}>
            {loginError && (
              <p style={{
                color: 'var(--danger)',
                background: 'var(--danger-glow)',
                padding: '12px',
                borderRadius: '10px',
                marginBottom: '20px',
                fontSize: '0.9rem',
                border: '1px solid hsla(0, 84%, 60%, 0.2)'
              }}>
                {loginError}
              </p>
            )}

             <div className="input-group">
              <label>ID Pengguna</label>
              <input
                type="text"
                className="input-field"
                placeholder="Masukkan ID atau Username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loggingIn}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
              />
            </div>

            <div className="input-group" style={{ position: 'relative' }}>
              <label>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input-field"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ width: '100%', paddingRight: '40px' }}
                  required
                  disabled={loggingIn}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loggingIn}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '4px',
                    zIndex: 5
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={loggingIn} style={{ width: '100%', justifyContent: 'center', marginTop: '20px', height: '48px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {loggingIn ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Lock size={18} />}
              <span>{loggingIn ? 'Menghubungkan ke Gerbang Barokah API & Sinkronisasi Kredensial...' : 'Masuk Dashboard'}</span>
            </button>
            {loggingIn && <div className="marching-loader"></div>}

            <div style={{ marginTop: '24px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
              <p style={{ color: '#00ADB5', fontSize: '0.85rem', marginBottom: '12px', textAlign: 'center', fontWeight: 'bold', letterSpacing: '0.05em' }}>⚡ BYPASS MASUK INSTAN</p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setEmail('owner@hris.com');
                    setPassword('ownerpassword123');
                    setTimeout(() => {
                      const form = document.querySelector('form');
                      if (form) form.requestSubmit();
                    }, 100);
                  }}
                  disabled={loggingIn}
                  className="btn-secondary"
                  style={{ flex: 1, justifyContent: 'center', fontSize: '0.8rem', height: '38px', background: 'rgba(0,173,181,0.1)', border: '1px solid rgba(0,173,181,0.3)', color: '#00ADB5', cursor: 'pointer', borderRadius: '8px', fontWeight: 'bold' }}
                >
                  Masuk Owner
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmail('admin@hris.com');
                    setPassword('admin123');
                    setTimeout(() => {
                      const form = document.querySelector('form');
                      if (form) form.requestSubmit();
                    }, 100);
                  }}
                  disabled={loggingIn}
                  className="btn-secondary"
                  style={{ flex: 1, justifyContent: 'center', fontSize: '0.8rem', height: '38px', background: 'rgba(0,173,181,0.1)', border: '1px solid rgba(0,173,181,0.3)', color: '#00ADB5', cursor: 'pointer', borderRadius: '8px', fontWeight: 'bold' }}
                >
                  Masuk Admin
                </button>
              </div>
            </div>
          </form>


        </div>
      </div>
    );
  }

  // Tampilan Dasbor Lengkap Terotentikasi
  return (
    <HRISProvider>
      {/* Global Sync Overlay — Marching Ants Animation */}
      <SyncOverlay />

      <div className="app-container">
        {/* Sidebar Navigasi Kiri */}
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout} user={user} userPermissions={userPermissions} />

        {/* Konten Sisi Kanan */}
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', overflowX: 'hidden' }}>
          {/* Topbar Header */}
          <Header activeTab={activeTab} user={user} token={token} API_URL={API_URL} setActiveTab={setActiveTab} theme={theme} setTheme={setTheme} />

          {/* Konten Halaman Aktif */}
          <main className="main-content">
            {renderTabContent()}
          </main>
        </div>
      </div>
    </HRISProvider>
  );
}

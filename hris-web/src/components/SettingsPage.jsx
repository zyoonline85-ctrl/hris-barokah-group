import React, { useState, useEffect } from 'react';
import { 
  Shield, Key, Lock, Check, X, AlertTriangle, Eye, EyeOff, 
  Save, MapPin, Clock, Search, HelpCircle, Terminal, User as UserIcon, RefreshCw, Settings
} from 'lucide-react';
import { getRoleFromPosition, checkAccess, checkAccessMobile } from '../utils/security';

export default function SettingsPage({ token, API_URL, userPermissions, user }) {
  // Page Tabs
  const [activeTab, setActiveTab] = useState('matrix'); // 'matrix' | 'credentials' | 'sandbox' | 'geofencing'
  
  // Current user role
  const currentUserRole = getRoleFromPosition(user?.position, user?.role);
  
  // Error Pop-up State
  const [errorMessage, setErrorMessage] = useState(null);

  // States for RBAC Settings (Tab 1)
  const [rbacSettings, setRbacSettings] = useState([]);
  const [loadingPerms, setLoadingPerms] = useState(true);

  // States for User Credentials (Tab 2)
  const [employees, setEmployees] = useState([]);
  const [customPasswords, setCustomPasswords] = useState({});
  const [loadingCreds, setLoadingCreds] = useState(true);
  const [searchCreds, setSearchCreds] = useState('');
  const [currentPageCreds, setCurrentPageCreds] = useState(1);
  const [showPasswordMap, setShowPasswordMap] = useState({});
  const [editCredsModal, setEditCredsModal] = useState({ isOpen: false, employee: null, password: '' });

  // States for Sandbox Simulation (Tab 3)
  const [simUser, setSimUser] = useState('');
  const [simTargetEmp, setSimTargetEmp] = useState('');
  const [simTargetOutlet, setSimTargetOutlet] = useState('AYAM PECAK 2001 SEAFOOD');
  const [simResult, setSimResult] = useState(null);

  // States for Geofencing GPS (Tab 4)
  const [officeLatitude, setOfficeLatitude] = useState('-6.2088');
  const [officeLongitude, setOfficeLongitude] = useState('106.8456');
  const [geofenceRadius, setGeofenceRadius] = useState('150');
  const [clockInDeadline, setClockInDeadline] = useState('08:00:00');
  const [lateDeduction, setLateDeduction] = useState('50000');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [savingParams, setSavingParams] = useState(false);
  const [paramsMessage, setParamsMessage] = useState('');

  // Dialog / Modal confirmations
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'YAKIN',
    cancelText: 'BATAL',
    onConfirm: null
  });

  const [toast, setToast] = useState({ show: false, type: '', message: '' });

  const modules = [
    { name: 'employees', label: 'Kelola Karyawan' },
    { name: 'attendances', label: 'Log Kehadiran' },
    { name: 'leaves', label: 'Pusat Pengajuan Cuti' },
    { name: 'payroll', label: 'Payroll' },
    { name: 'contracts', label: 'Surat Penugasan' },
    { name: 'outlets', label: 'Outlet Cabang' },
    { name: 'revenues', label: 'Omzet Cabang' },
    { name: 'sops', label: 'SOP & Prosedur' },
    { name: 'kpis', label: 'Penilaian KPI' },
    { name: 'sanctions', label: 'Sanksi & SP' },
    { name: 'trainings', label: 'Program Pelatihan' },
    { name: 'policies', label: 'Kebijakan Perusahaan' },
    { name: 'settings', label: 'Hak Akses' }
  ];

  const showToast = (type, message) => {
    setToast({ show: true, type, message });
    setTimeout(() => {
      setToast({ show: false, type: '', message: '' });
    }, 4000);
  };

  const showError = (msg) => {
    setErrorMessage(msg);
  };

  // Pre-initialize and load RBAC settings from localStorage
  const loadRbacSettings = () => {
    setLoadingPerms(true);
    const defaultRbac = [
      {
        id: 1,
        role: 'master',
        label: 'Master',
        read: true,
        edit: true,
        delete: true,
        mobile: 'Semua Outlet',
        mobile_position: 'Semua Jabatan',
        locked: true
      },
      {
        id: 2,
        role: 'leader',
        label: 'Leader',
        read: true,
        edit: true,
        delete: false,
        mobile: 'Sesuai Outlet Terdaftar',
        mobile_position: 'Di Bawah Jabatan',
        locked: false
      },
      {
        id: 3,
        role: 'admin',
        label: 'Admin',
        read: true,
        edit: true,
        delete: false,
        mobile: 'Sesuai Outlet Terdaftar',
        mobile_position: 'Semua Jabatan',
        locked: false
      }
    ];

    try {
      const stored = localStorage.getItem('rbac_settings');
      if (stored) {
        setRbacSettings(JSON.parse(stored));
      } else {
        localStorage.setItem('rbac_settings', JSON.stringify(defaultRbac));
        setRbacSettings(defaultRbac);
      }
    } catch (e) {
      console.error(e);
      setRbacSettings(defaultRbac);
    } finally {
      setLoadingPerms(false);
    }
  };

  // Load User accounts (derived from employees + passwords)
  const loadUserAccounts = () => {
    setLoadingCreds(true);
    try {
      const storedEmployees = localStorage.getItem('hris_employees');
      const storedPasswords = localStorage.getItem('hris_user_passwords');
      
      const parsedEmployees = storedEmployees ? JSON.parse(storedEmployees) : [];
      const parsedPasswords = storedPasswords ? JSON.parse(storedPasswords) : {};

      setEmployees(parsedEmployees);
      setCustomPasswords(parsedPasswords);
      
      // Set sandbox defaults
      if (parsedEmployees.length > 0) {
        setSimUser(parsedEmployees[0].id);
        setSimTargetEmp(parsedEmployees[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCreds(false);
    }
  };

  // Load Geofencing Settings from API
  const loadGeofencingSettings = async () => {
    try {
      const res = await fetch(`${API_URL}/settings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.status === 'success') {
        data.data.forEach(item => {
          if (item.key === 'office_latitude') setOfficeLatitude(item.value);
          if (item.key === 'office_longitude') setOfficeLongitude(item.value);
          if (item.key === 'geofence_radius_meters') setGeofenceRadius(item.value);
          if (item.key === 'clock_in_deadline') setClockInDeadline(item.value);
          if (item.key === 'late_deduction_amount') setLateDeduction(item.value);
          if (item.key === 'gemini_api_key') setGeminiApiKey(item.value);
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadRbacSettings();
    loadUserAccounts();
    loadGeofencingSettings();
  }, [token, API_URL]);

  // Handle matrix checkbox and dropdown changes with automatic save
  const handleRbacChange = (roleName, field, value) => {
    if (currentUserRole !== 'master') {
      showError("Akses Ditolak! Anda tidak memiliki izin untuk melakukan aksi ini.");
      return;
    }

    if (roleName === 'master') {
      showToast('error', 'Akses Master dikunci penuh dan tidak dapat diubah.');
      return;
    }

    const updated = rbacSettings.map(row => {
      if (row.role === roleName) {
        return { ...row, [field]: value };
      }
      return row;
    });

    setRbacSettings(updated);
    localStorage.setItem('rbac_settings', JSON.stringify(updated));
    showToast('success', `Hak akses untuk Peran ${roleName.toUpperCase()} berhasil diperbarui!`);
  };



  // Change user password logic
  const handleEditPasswordSubmit = (e) => {
    e.preventDefault();
    if (!checkAccess(user, 'edit')) {
      showError("Akses Ditolak! Anda tidak memiliki izin untuk melakukan aksi ini.");
      return;
    }

    const emp = editCredsModal.employee;
    const newPass = editCredsModal.password.trim();

    if (!newPass) {
      showToast('error', 'Kata sandi tidak boleh kosong.');
      return;
    }

    try {
      const updatedPasswords = { ...customPasswords, [emp.id]: newPass };
      localStorage.setItem('hris_user_passwords', JSON.stringify(updatedPasswords));
      setCustomPasswords(updatedPasswords);
      showToast('success', `Sandi untuk ${emp.full_name} berhasil diperbarui!`);
      setEditCredsModal({ isOpen: false, employee: null, password: '' });
    } catch (err) {
      console.error(err);
      showToast('error', 'Gagal memperbarui sandi.');
    }
  };

  // Run Sandbox simulation check
  const runSandboxCheck = () => {
    const actor = employees.find(e => String(e.id) === String(simUser));
    const target = employees.find(e => String(e.id) === String(simTargetEmp));

    if (!actor || !target) {
      showToast('error', 'Pilih Karyawan terlebih dahulu.');
      return;
    }

    const checkResult = checkAccessMobile(actor, target, simTargetOutlet);
    setSimResult({
      actor: {
        name: actor.full_name,
        role: getRoleFromPosition(actor.position).toUpperCase(),
        outlet: actor.outlet || 'PUSAT'
      },
      target: {
        name: target.full_name,
        outlet: target.outlet || 'PUSAT'
      },
      ...checkResult
    });
  };

  // Save geofencing parameters
  const triggerSaveParams = (e) => {
    e.preventDefault();
    if (!checkAccess(user, 'edit')) {
      showError("Akses Ditolak! Anda tidak memiliki izin untuk melakukan aksi ini.");
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Simpan Parameter Sistem & AI',
      message: 'Apakah Anda yakin ingin memperbarui parameter GPS, jam kerja outlet, dan kunci API Gemini?',
      confirmText: 'YA, SIMPAN',
      cancelText: 'BATAL',
      onConfirm: () => executeSaveParams()
    });
  };

  const executeSaveParams = async () => {
    setSavingParams(true);
    setParamsMessage('');
    try {
      const payload = [
        { key: 'office_latitude', value: officeLatitude },
        { key: 'office_longitude', value: officeLongitude },
        { key: 'geofence_radius_meters', value: geofenceRadius },
        { key: 'clock_in_deadline', value: clockInDeadline },
        { key: 'late_deduction_amount', value: lateDeduction },
        { key: 'gemini_api_key', value: geminiApiKey }
      ];

      const res = await fetch(`${API_URL}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ settings: payload })
      });
      const data = await res.json();
      if (data.status === 'success') {
        showToast('success', 'Parameter sistem berhasil disimpan!');
        setParamsMessage('Parameter berhasil disimpan ke server SQLite.');
      } else {
        showToast('error', 'Gagal menyimpan parameter.');
      }
      setConfirmModal({ ...confirmModal, isOpen: false });
    } catch (err) {
      console.error(err);
      showToast('error', 'Kesalahan koneksi.');
    } finally {
      setSavingParams(false);
    }
  };

  // Process user account credentials map
  const userAccounts = employees.map((emp, idx) => {
    const generatedId = emp.full_name.trim().split(/\s+/)[0].substring(0, 3).toUpperCase() + String(idx + 1).padStart(5, '0');
    const password = customPasswords[emp.id] || emp.nik || '123456';
    return { ...emp, generatedId, password };
  });

  const filteredAccounts = userAccounts.filter(acc => 
    acc.full_name.toLowerCase().includes(searchCreds.toLowerCase()) ||
    acc.generatedId.toLowerCase().includes(searchCreds.toLowerCase()) ||
    acc.position.toLowerCase().includes(searchCreds.toLowerCase())
  );

  const indexOfLastRow = currentPageCreds * 8;
  const indexOfFirstRow = indexOfLastRow - 8;
  const currentCredsRows = filteredAccounts.slice(indexOfFirstRow, indexOfLastRow);
  const totalPagesCreds = Math.ceil(filteredAccounts.length / 8);

  return (
    <div className="dark-theme-wrapper animate-fade-in">
      <style>{`
        .dark-theme-wrapper {
          background-color: #0b0f19;
          color: #f1f5f9;
          padding: 30px;
          border-radius: 16px;
          border: 1px solid rgba(255, 98, 188, 0.2);
          font-family: 'Outfit', sans-serif;
          min-height: calc(100vh - 120px);
          margin-top: 10px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
        }

        .dark-theme-wrapper input, 
        .dark-theme-wrapper select, 
        .dark-theme-wrapper textarea {
          background-color: var(--text-main) !important;
          color: #f1f5f9 !important;
          border: 1px solid #475569 !important;
          border-radius: 8px !important;
          padding: 8px 12px !important;
          outline: none !important;
        }

        .dark-theme-wrapper input:focus, 
        .dark-theme-wrapper select:focus {
          border-color: #ff62bc !important;
          box-shadow: 0 0 0 2px rgba(255, 98, 188, 0.2) !important;
        }

        .dark-theme-wrapper button:disabled {
          opacity: 0.45 !important;
          cursor: not-allowed !important;
        }

        /* High-contrast button styles inside Hak Akses page */
        .dark-theme-wrapper .btn-primary {
          background-color: #00ADB5 !important;
          color: #0b0f19 !important; /* High contrast dark text on Electric Cyan background */
          font-weight: 800 !important;
        }
        .dark-theme-wrapper .btn-primary:hover {
          background-color: #00c2cb !important;
          color: #0b0f19 !important;
        }
        .dark-theme-wrapper .btn-secondary {
          background-color: rgba(255, 255, 255, 0.08) !important;
          color: #ffffff !important; /* High contrast pure white text on dark background */
          border: 1px solid #475569 !important;
          font-weight: 700 !important;
        }
        .dark-theme-wrapper .btn-secondary:hover {
          background-color: rgba(255, 255, 255, 0.16) !important;
          color: #ffffff !important;
        }

        /* Access Banner */
        .security-badge-banner {
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(239, 68, 68, 0.12);
          border: 1px solid rgba(239, 68, 68, 0.35);
          padding: 10px 18px;
          border-radius: 10px;
          font-size: 0.82rem;
          color: #fca5a5;
          font-weight: 700;
          margin-bottom: 24px;
          box-shadow: 0 4px 15px rgba(239, 68, 68, 0.05);
        }

        /* Tab Switcher */
        .settings-tab-list {
          display: flex;
          gap: 12px;
          border-bottom: 1px solid var(--text-main);
          padding-bottom: 12px;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }

        .settings-tab-btn {
          background: transparent;
          color: var(--text-muted);
          border: 1px solid var(--border-color);
          padding: 10px 18px;
          border-radius: 8px;
          font-size: 0.8rem;
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s ease-in-out;
        }

        .settings-tab-btn:hover {
          color: var(--accent-primary);
          border-color: var(--accent-primary);
        }

        .settings-tab-btn.active {
          background: var(--accent-primary);
          color: var(--bg-main);
          border: 1px solid var(--accent-primary);
          box-shadow: 0 4px 14px rgba(0, 173, 181, 0.25);
        }

        /* Table Design */
        .dark-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.82rem;
          margin-bottom: 20px;
        }

        .dark-table th {
          background-color: #0f172a;
          color: #94a3b8;
          font-weight: 800;
          border-bottom: 2px solid var(--text-main);
          padding: 12px;
          text-align: left;
          text-transform: uppercase;
        }

        .dark-table td {
          border-bottom: 1px solid var(--text-main);
          padding: 12px;
          color: #cbd5e1;
        }

        .dark-table tr:hover td {
          background-color: rgba(255, 255, 255, 0.02);
        }

        /* Checkbox Custom styling */
        .custom-chk {
          width: 16px;
          height: 16px;
          cursor: pointer;
          accent-color: #ff62bc;
        }

        /* Role Pill badges */
        .role-pill {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 0.7rem;
          font-weight: 800;
          text-transform: uppercase;
        }

        .role-master { background-color: rgba(255, 98, 188, 0.15); color: #ff62bc; border: 1px solid rgba(255, 98, 188, 0.3); }
        .role-leader { background-color: rgba(180, 45, 241, 0.15); color: #b42df1; border: 1px solid rgba(180, 45, 241, 0.3); }
        .role-admin { background-color: rgba(6, 182, 212, 0.15); color: #06b6d4; border: 1px solid rgba(6, 182, 212, 0.3); }
        .role-user { background-color: rgba(100, 116, 139, 0.15); color: #94a3b8; border: 1px solid rgba(100, 116, 139, 0.3); }

        /* Terminal block for Sandbox */
        .terminal-box {
          background-color: #05070f;
          border: 1px solid var(--text-main);
          border-radius: 12px;
          padding: 20px;
          font-family: 'Courier New', Courier, monospace;
          margin-top: 20px;
          position: relative;
        }

        .terminal-box::before {
          content: 'SECURITY ENGINE checkAccessMobile()';
          position: absolute;
          top: -10px;
          left: 15px;
          background-color: #0b0f19;
          padding: 0 8px;
          font-size: 0.65rem;
          color: #ff62bc;
          font-weight: 700;
          letter-spacing: 1px;
        }

        /* Centralized Error Overlay styling */
        .error-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(2, 4, 10, 0.85);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 99999;
          animation: fade-in 0.25s ease-out;
        }

        .error-modal-content {
          background: #0f1322;
          border: 2px solid #ef4444;
          border-radius: 20px;
          padding: 40px;
          max-width: 480px;
          width: 90%;
          text-align: center;
          box-shadow: 0 25px 50px -12px rgba(239, 68, 68, 0.25);
          animation: scale-up 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        @keyframes scale-up {
          0% { transform: scale(0.9); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }

        @keyframes fade-in {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
      `}</style>

      {/* Header and Authorization Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ff62bc', textTransform: 'uppercase' }}>🔒 MODUL HAK AKSES & MANAJEMEN USER</h2>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '4px' }}>Gerbang tata kelola keamanan perizinan Web Portal dan otorisasi cabang Mobile Android.</p>
        </div>
        <div>
          <span className="role-pill role-master" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>Role Anda: {currentUserRole}</span>
        </div>
      </div>



      {/* central tab list */}
      <div className="settings-tab-list">
        <button className={`settings-tab-btn ${activeTab === 'matrix' ? 'active' : ''}`} onClick={() => setActiveTab('matrix')}>
          <Shield size={16} />
          <span>PENGATURAN HAK AKSES</span>
        </button>
        <button className={`settings-tab-btn ${activeTab === 'credentials' ? 'active' : ''}`} onClick={() => setActiveTab('credentials')}>
          <Key size={16} />
          <span>MANAJEMEN KREDENSIAL</span>
        </button>
        <button className={`settings-tab-btn ${activeTab === 'system' ? 'active' : ''}`} onClick={() => setActiveTab('system')}>
          <Settings size={16} />
          <span>PARAMETER SISTEM & AI</span>
        </button>
      </div>

      {/* TAB CONTENT 1: PENGATURAN HAK AKSES */}
      {activeTab === 'matrix' && (
        <div className="glass-card animate-fade-in" style={{ background: '#0f172a', border: '1px solid var(--text-main)', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f1f5f9' }}>Matriks Hak Akses & Peran Pengguna</h3>
              <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>Konfigurasi izin aktivitas Web Portal dan cakupan informasi Mobile App secara real-time.</p>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="dark-table">
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>No</th>
                  <th>Nama Role (Tingkatan Pengguna)</th>
                  <th style={{ textAlign: 'center' }}>READ</th>
                  <th style={{ textAlign: 'center' }}>EDIT</th>
                  <th style={{ textAlign: 'center' }}>DELETE</th>
                  <th>Mobile: Outlet Scope</th>
                  <th>Mobile: Position Hierarchy</th>
                </tr>
              </thead>
              <tbody>
                {rbacSettings.map((row, index) => (
                  <tr key={row.role}>
                    <td style={{ fontWeight: 600 }}>{index + 1}</td>
                    <td><span className={`role-pill role-${row.role}`} style={{ fontSize: '0.8rem', padding: '6px 12px' }}>{row.label}</span></td>
                    <td style={{ textAlign: 'center' }}><input type="checkbox" className="custom-chk" checked={row.read} onChange={(e) => handleRbacChange(row.role, 'read', e.target.checked)} disabled={row.locked} /></td>
                    <td style={{ textAlign: 'center' }}><input type="checkbox" className="custom-chk" checked={row.edit} onChange={(e) => handleRbacChange(row.role, 'edit', e.target.checked)} disabled={row.locked} /></td>
                    <td style={{ textAlign: 'center' }}><input type="checkbox" className="custom-chk" checked={row.delete} onChange={(e) => handleRbacChange(row.role, 'delete', e.target.checked)} disabled={row.locked} /></td>
                    <td><select value={row.mobile} onChange={(e) => handleRbacChange(row.role, 'mobile', e.target.value)} disabled={row.locked} style={{ background: 'var(--text-main)', color: '#fff', border: '1px solid #475569', borderRadius: '4px', padding: '4px' }}><option value="Semua Outlet">Semua Outlet</option><option value="Sesuai Outlet Terdaftar">Sesuai Outlet Terdaftar</option></select></td>
                    <td><select value={row.mobile_position || 'Hanya Data Pribadi'} onChange={(e) => handleRbacChange(row.role, 'mobile_position', e.target.value)} disabled={row.locked} style={{ background: 'var(--text-main)', color: '#fff', border: '1px solid #475569', borderRadius: '4px', padding: '4px' }}><option value="Semua Jabatan">Semua Jabatan</option><option value="Di Bawah Jabatan">Di Bawah Jabatan</option><option value="Hanya Data Pribadi">Hanya Data Pribadi</option></select></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Mobile Access Visual Summary Cards ── */}
          <div style={{ marginTop: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{ width: '4px', height: '20px', background: 'linear-gradient(135deg, #ff62bc, #b42df1)', borderRadius: '4px' }} />
              <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#f1f5f9', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                📱 Ringkasan Akses Informasi Mobile Per Peran
              </h4>
            </div>
            <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '16px', lineHeight: '1.6' }}>
              Kartu berikut menampilkan ringkasan akses data yang bisa dilihat karyawan di Aplikasi Android, berdasarkan kombinasi <strong style={{ color: '#94a3b8' }}>Outlet</strong> dan <strong style={{ color: '#94a3b8' }}>Jabatan</strong> yang dikonfigurasi pada tabel di atas.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
              {rbacSettings.map((row) => {
                const outletScope = row.mobile;
                const jabatanScope = row.mobile_position || 'Hanya Data Pribadi';

                const outletBadge = outletScope === 'Semua Outlet'
                  ? { label: '🌐 Semua Outlet', color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: '#10b981' }
                  : { label: '📍 Outlet Terdaftar Saja', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: '#f59e0b' };

                const jabatanBadge = jabatanScope === 'Semua Jabatan'
                  ? { label: '👥 Semua Jabatan', desc: 'Bisa melihat data seluruh karyawan di outlet yang diizinkan, tanpa terkecuali jabatan apapun.', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', border: '#3b82f6' }
                  : jabatanScope === 'Di Bawah Jabatan'
                  ? { label: '🔽 Di Bawah Jabatan', desc: 'Hanya bisa melihat data karyawan yang memiliki jabatan lebih rendah, plus data pribadinya sendiri.', color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)', border: '#8b5cf6' }
                  : { label: '👤 Hanya Data Pribadi', desc: 'Hanya bisa melihat data miliknya sendiri. Tidak bisa melihat data rekan atau bawahan.', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: '#475569' };

                const roleColors = {
                  master: { accent: '#ff62bc', glow: 'rgba(255,98,188,0.15)' },
                  leader: { accent: '#b42df1', glow: 'rgba(180,45,241,0.15)' },
                  admin:  { accent: '#06b6d4', glow: 'rgba(6,182,212,0.15)' },
                };
                const rc = roleColors[row.role] || { accent: '#94a3b8', glow: 'rgba(148,163,184,0.08)' };

                return (
                  <div key={row.role} style={{
                    background: '#0f172a',
                    border: `1px solid ${rc.accent}40`,
                    borderRadius: '14px',
                    padding: '20px',
                    boxShadow: `0 4px 20px ${rc.glow}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span className={`role-pill role-${row.role}`} style={{ padding: '6px 14px', fontSize: '0.82rem' }}>
                        {row.label}
                      </span>
                      {row.locked && (
                        <span style={{ fontSize: '0.65rem', color: '#64748b', background: 'var(--text-main)', padding: '3px 8px', borderRadius: '4px', fontWeight: 700 }}>
                          🔒 DIKUNCI
                        </span>
                      )}
                    </div>

                    {/* Web badges */}
                    <div style={{ background: '#0b1120', borderRadius: '10px', padding: '12px', border: '1px solid var(--text-main)' }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                        🖥️ Akses Web Portal
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {[
                          { key: 'read', label: 'READ', activeColor: '#34d399', activeBg: 'rgba(16,185,129,0.15)', activeBorder: '#10b981' },
                          { key: 'edit', label: 'EDIT', activeColor: '#93c5fd', activeBg: 'rgba(59,130,246,0.15)', activeBorder: '#3b82f6' },
                          { key: 'delete', label: 'DELETE', activeColor: '#fca5a5', activeBg: 'rgba(239,68,68,0.15)', activeBorder: '#ef4444' },
                        ].map(({ key, label, activeColor, activeBg, activeBorder }) => (
                          <span key={key} style={{
                            padding: '3px 10px', borderRadius: '20px', fontSize: '0.68rem', fontWeight: 700,
                            background: row[key] ? activeBg : 'rgba(100,116,139,0.1)',
                            color: row[key] ? activeColor : '#475569',
                            border: `1px solid ${row[key] ? activeBorder : '#334155'}`
                          }}>
                            {row[key] ? '✓' : '✗'} {label}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Mobile scope */}
                    <div style={{ background: '#0b1120', borderRadius: '10px', padding: '12px', border: '1px solid var(--text-main)' }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
                        📱 Cakupan Data Mobile Android
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '10px' }}>
                        <span style={{ fontSize: '0.62rem', color: '#64748b', paddingTop: '4px', minWidth: '52px', fontWeight: 700 }}>OUTLET:</span>
                        <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '0.68rem', fontWeight: 700, background: outletBadge.bg, color: outletBadge.color, border: `1px solid ${outletBadge.border}44` }}>
                          {outletBadge.label}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <span style={{ fontSize: '0.62rem', color: '#64748b', paddingTop: '4px', minWidth: '52px', fontWeight: 700 }}>JABATAN:</span>
                        <div style={{ flex: 1 }}>
                          <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '0.68rem', fontWeight: 700, background: jabatanBadge.bg, color: jabatanBadge.color, border: `1px solid ${jabatanBadge.border}44`, display: 'inline-block', marginBottom: '6px' }}>
                            {jabatanBadge.label}
                          </span>
                          <p style={{ fontSize: '0.65rem', color: '#64748b', lineHeight: '1.5', margin: 0 }}>{jabatanBadge.desc}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Jabatan Scope Legend Panel ── */}
          <div style={{ marginTop: '28px', padding: '20px', background: '#070c18', borderRadius: '12px', border: '1px solid var(--text-main)' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px' }}>
              📖 Panduan Opsi "Akses Informasi Mobile Berdasarkan Jabatan" (Position Hierarchy)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              {[
                {
                  label: '👥 Semua Jabatan',
                  color: '#3b82f6',
                  bg: 'rgba(59,130,246,0.08)',
                  desc: 'Pengguna mobile bisa melihat data karyawan seluruh jabatan di outlet yang diizinkan — dari Owner, SPV, Admin, hingga karyawan harian biasa.',
                  example: 'Contoh: Master bisa melihat semua data karyawan di semua outlet.'
                },
                {
                  label: '🔽 Di Bawah Jabatan',
                  color: '#8b5cf6',
                  bg: 'rgba(139,92,246,0.08)',
                  desc: 'Pengguna mobile hanya bisa melihat data karyawan yang jabatannya berada di bawah miliknya, ditambah data pribadinya sendiri. Data atasan/rekan setara tersembunyi.',
                  example: 'Contoh: Leader hanya bisa melihat data User/Karyawan biasa saja.'
                },
                {
                  label: '👤 Hanya Data Pribadi',
                  color: '#94a3b8',
                  bg: 'rgba(148,163,184,0.08)',
                  desc: 'Pengguna mobile hanya bisa mengakses rekam jejaknya sendiri — absensi, slip gaji, cuti, dan profil pribadinya. Data karyawan lain sepenuhnya tersembunyi.',
                  example: 'Contoh: Admin hanya bisa melihat profil dan slip gaji miliknya sendiri.'
                }
              ].map(item => (
                <div key={item.label} style={{ padding: '14px', background: item.bg, borderRadius: '10px', border: `1px solid ${item.color}22` }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: item.color, marginBottom: '6px' }}>{item.label}</div>
                  <p style={{ fontSize: '0.68rem', color: '#94a3b8', lineHeight: '1.55', margin: '0 0 8px 0' }}>{item.desc}</p>
                  <p style={{ fontSize: '0.65rem', color: '#64748b', fontStyle: 'italic', margin: 0 }}>{item.example}</p>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '14px', padding: '10px 14px', background: 'rgba(255,98,188,0.08)', border: '1px solid rgba(255,98,188,0.2)', borderRadius: '8px', fontSize: '0.7rem', color: '#fca5a5', lineHeight: '1.5' }}>
              ⚡ <strong>Tips Real-time:</strong> Setiap perubahan centang atau pilihan dropdown di tabel atas langsung tersimpan otomatis ke <code style={{ background: 'rgba(255,255,255,0.05)', padding: '1px 5px', borderRadius: '4px' }}>localStorage</code> ("rbac_settings") dan berlaku seketika untuk semua pengguna yang login di perangkat ini.
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: KREDENSIAL PENGGUNA */}
      {activeTab === 'credentials' && (
        <div className="glass-card animate-fade-in" style={{ background: '#0f172a', border: '1px solid var(--text-main)', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f1f5f9' }}>Manajemen Kredensial Login & Sandi Karyawan</h3>
              <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>Ubah password dan lihat username/ID login resmi milik seluruh karyawan terdaftar di database.</p>
            </div>
            
            <div style={{ position: 'relative', width: '260px' }}>
              <input 
                type="text" 
                placeholder="Cari nama / ID..." 
                value={searchCreds} 
                onChange={(e) => { setSearchCreds(e.target.value); setCurrentPageCreds(1); }}
                style={{ width: '100%', paddingLeft: '32px' }}
              />
              <Search size={14} color="#64748b" style={{ position: 'absolute', left: '10px', top: '12px' }} />
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="dark-table">
              <thead>
                <tr>
                  <th>Nama Karyawan</th>
                  <th>ID Pengguna (Username)</th>
                  <th>Jabatan Kerja</th>
                  <th>Lokasi Outlet</th>
                  <th>Status Role</th>
                  <th>Password (Sandi)</th>
                  {currentUserRole !== 'admin' && <th>Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {currentCredsRows.map(acc => {
                  const resolvedRole = getRoleFromPosition(acc.position);
                  const isVisible = showPasswordMap[acc.id];
                  return (
                    <tr key={acc.id}>
                      <td style={{ fontWeight: 700 }}>{acc.full_name}</td>
                      <td style={{ fontFamily: 'monospace', color: '#ff62bc', fontWeight: 700 }}>{acc.generatedId}</td>
                      <td>{acc.position}</td>
                      <td>{acc.outlet || 'PUSAT'}</td>
                      <td>
                        <span className={`role-pill role-${resolvedRole}`}>{resolvedRole}</span>
                      </td>
                      <td style={{ fontFamily: 'monospace' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>{isVisible ? acc.password : '••••••••'}</span>
                          <button 
                            onClick={() => setShowPasswordMap(p => ({ ...p, [acc.id]: !p[acc.id] }))}
                            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                          >
                            {isVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                      </td>
                      {currentUserRole !== 'admin' && (
                        <td>
                          <button 
                            className="btn-secondary" 
                            style={{ padding: '6px 12px', fontSize: '0.72rem' }}
                            onClick={() => setEditCredsModal({ isOpen: true, employee: acc, password: acc.password })}
                          >
                            Ubah Sandi
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {filteredAccounts.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: '#64748b' }}>Karyawan tidak ditemukan.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPagesCreds > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}>
              <button 
                onClick={() => setCurrentPageCreds(p => Math.max(1, p - 1))} 
                disabled={currentPageCreds === 1}
                className="btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.75rem' }}
              >
                Sebelumnya
              </button>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8', alignSelf: 'center' }}>
                Halaman {currentPageCreds} dari {totalPagesCreds}
              </span>
              <button 
                onClick={() => setCurrentPageCreds(p => Math.min(totalPagesCreds, p + 1))} 
                disabled={currentPageCreds === totalPagesCreds}
                className="btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.75rem' }}
              >
                Selanjutnya
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT 3: PARAMETER SISTEM & AI */}
      {activeTab === 'system' && (
        <div className="glass-card animate-fade-in" style={{ background: '#0f172a', border: '1px solid var(--text-main)', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f1f5f9' }}>Parameter Operasional & Kunci AI Gemini</h3>
              <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>Konfigurasi koordinat kantor utama, radius toleransi GPS absensi, jam kerja, dan integrasi API Kecerdasan Buatan.</p>
            </div>
          </div>

          <form onSubmit={triggerSaveParams} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div className="input-group">
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#f1f5f9' }}>LATITUDE KANTOR UTAMA:</label>
                <input 
                  type="text" 
                  value={officeLatitude} 
                  onChange={(e) => setOfficeLatitude(e.target.value)} 
                  required 
                  style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '10px', borderRadius: '8px' }}
                />
              </div>

              <div className="input-group">
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#f1f5f9' }}>LONGITUDE KANTOR UTAMA:</label>
                <input 
                  type="text" 
                  value={officeLongitude} 
                  onChange={(e) => setOfficeLongitude(e.target.value)} 
                  required 
                  style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '10px', borderRadius: '8px' }}
                />
              </div>

              <div className="input-group">
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#f1f5f9' }}>RADIUS GEOFENCE (METER):</label>
                <input 
                  type="number" 
                  value={geofenceRadius} 
                  onChange={(e) => setGeofenceRadius(e.target.value)} 
                  required 
                  style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '10px', borderRadius: '8px' }}
                />
              </div>

              <div className="input-group">
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#f1f5f9' }}>BATAS ABSENSI MASUK (HH:MM:SS):</label>
                <input 
                  type="text" 
                  value={clockInDeadline} 
                  onChange={(e) => setClockInDeadline(e.target.value)} 
                  required 
                  style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '10px', borderRadius: '8px' }}
                />
              </div>

              <div className="input-group">
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#f1f5f9' }}>DENDA KETERLAMBATAN (RP):</label>
                <input 
                  type="number" 
                  value={lateDeduction} 
                  onChange={(e) => setLateDeduction(e.target.value)} 
                  required 
                  style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '10px', borderRadius: '8px' }}
                />
              </div>

              <div className="input-group" style={{ position: 'relative' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#f1f5f9' }}>KUNCI API GEMINI (UNTUK GENERATE SOP):</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input 
                    type={showApiKey ? "text" : "password"} 
                    value={geminiApiKey} 
                    onChange={(e) => setGeminiApiKey(e.target.value)} 
                    placeholder="Masukkan Kunci API Gemini..." 
                    style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '10px 40px 10px 10px', borderRadius: '8px', width: '100%' }}
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowApiKey(!showApiKey)} 
                    style={{ position: 'absolute', right: '10px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  >
                    {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>

            {paramsMessage && (
              <div style={{ color: '#2ecc71', fontSize: '0.85rem', marginTop: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Check size={16} />
                <span>{paramsMessage}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button 
                type="submit" 
                className="btn-primary" 
                disabled={savingParams}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', fontSize: '0.85rem' }}
              >
                {savingParams ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                <span>{savingParams ? 'Menyimpan...' : 'SIMPAN PERUBAHAN'}</span>
              </button>
            </div>
          </form>
        </div>
      )}



      {/* CONFIRMATION DIALOG MODAL */}
      {confirmModal.isOpen && (
        <div className="error-modal-overlay">
          <div className="error-modal-content" style={{ borderColor: '#ff62bc', boxShadow: '0 25px 50px -12px rgba(255, 98, 188, 0.25)' }}>
            <AlertTriangle size={48} color="#ff62bc" style={{ margin: '0 auto 16px auto' }} />
            <h3 style={{ fontSize: '1.2rem', color: '#f1f5f9', marginBottom: '12px' }}>{confirmModal.title}</h3>
            <p style={{ fontSize: '0.85rem', color: '#f1f5f9', marginBottom: '24px', lineHeight: '1.5' }}>{confirmModal.message}</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button 
                className="btn-secondary" 
                onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                style={{ padding: '10px 20px' }}
              >
                {confirmModal.cancelText}
              </button>
              <button 
                className="btn-primary" 
                onClick={confirmModal.onConfirm}
                style={{ padding: '10px 20px' }}
              >
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT CREDENTIALS MODAL */}
      {editCredsModal.isOpen && (
        <div className="error-modal-overlay">
          <div className="error-modal-content" style={{ borderColor: '#b42df1', boxShadow: '0 25px 50px -12px rgba(180, 45, 241, 0.25)' }}>
            <Key size={40} color="#b42df1" style={{ margin: '0 auto 16px auto' }} />
            <h3 style={{ fontSize: '1.15rem', color: '#f1f5f9', marginBottom: '4px' }}>Ubah Kata Sandi Akun</h3>
            <p style={{ fontSize: '0.78rem', color: '#e2e8f0', marginBottom: '20px' }}>Ubah password untuk Karyawan: <strong style={{ color: '#ff62bc' }}>{editCredsModal.employee?.full_name}</strong></p>
            
            <form onSubmit={handleEditPasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#f1f5f9' }}>KATA SANDI BARU:</label>
                <input 
                  type="text" 
                  value={editCredsModal.password} 
                  onChange={(e) => setEditCredsModal(prev => ({ ...prev, password: e.target.value }))}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button 
                  type="button" 
                  className="btn-secondary" 
                  onClick={() => setEditCredsModal({ isOpen: false, employee: null, password: '' })}
                  style={{ padding: '8px 16px', fontSize: '0.78rem' }}
                >
                  BATAL
                </button>
                <button 
                  type="submit" 
                  className="btn-primary"
                  style={{ padding: '8px 16px', fontSize: '0.78rem' }}
                >
                  SIMPAN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CENTRALIZED ERROR MODAL (showError) */}
      {errorMessage && (
        <div className="error-modal-overlay">
          <div className="error-modal-content">
            <Lock size={48} color="#ef4444" style={{ margin: '0 auto 16px auto' }} />
            <h3 style={{ fontSize: '1.35rem', color: '#f87171', marginBottom: '12px', fontWeight: 'bold' }}>AKSES DITOLAK!</h3>
            <p style={{ fontSize: '0.85rem', color: '#f1f5f9', marginBottom: '24px', lineHeight: '1.6' }}>{errorMessage}</p>
            <button 
              className="btn-primary" 
              onClick={() => setErrorMessage(null)} 
              style={{ background: '#b91c1c', color: '#ffffff', border: 'none', padding: '10px 30px', fontWeight: 'bold', borderRadius: '10px' }}
            >
              PAHAM & KELUAR
            </button>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toast.show && (
        <div className={`toast-notification ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`} style={{ zIndex: 999999 }}>
          <Shield size={20} />
          <span className="toast-message">{toast.message}</span>
        </div>
      )}
    </div>
  );
}

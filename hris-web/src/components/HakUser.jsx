import React, { useState, useEffect } from 'react';
import { Key, User, Shield, Check, X, AlertTriangle, Eye, EyeOff, Store, Save } from 'lucide-react';
import { getRoleFromPosition } from '../utils/security';
import { useHRIS, useHRISStorage } from '../context/HRISContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import PDFCompileOverlay from './PDFCompileOverlay';


const C = {
  bg: '#222831',
  surface: '#393E46',
  cyan: '#00ADB5',
  text: '#EEEEEE',
  muted: '#b2bec3',
  border: '#4a5568',
  cyanBorder: 'rgba(0, 173, 181, 0.4)',
  cyanDim: 'rgba(0, 173, 181, 0.12)',
  success: '#2ecc71',
  danger: '#e74c3c',
  warn: '#f1c40f',
};

export default function HakUser({ token, API_URL, user }) {
  const { employees } = useHRIS();
  const [selectedOutlet, setSelectedOutlet] = useState('Semua Outlet');
  const [customPasswords, setCustomPasswords] = useHRISStorage('hris_user_passwords', {});
  const [customUsernames, setCustomUsernames] = useHRISStorage('hris_custom_usernames', {});
  const [customRoles, setCustomRoles] = useHRISStorage('hris_user_roles', {});
  
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [roleInput, setRoleInput] = useState('');
  const [showPasswordMap, setShowPasswordMap] = useState({});
  
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSavingAnim, setIsSavingAnim] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);


  // Check role: Master only
  const userRole = getRoleFromPosition(user?.position, user?.role);
  const isMaster = userRole === 'master';

  const outletsList = ['Semua Outlet', ...new Set(employees.map(e => e.outlet).filter(Boolean))];

  // Helper to generate default username based on employee's index in full list
  const getGeneratedUsername = (emp) => {
    if (!emp) return '';
    const idx = employees.findIndex(e => e.id === emp.id);
    const firstName = emp.full_name.trim().split(/\s+/)[0] || 'USR';
    const prefix = (firstName.substring(0, 3).padEnd(3, 'X')).toUpperCase();
    const suffix = String(idx >= 0 ? idx + 1 : 1).padStart(5, '0');
    return prefix + suffix;
  };

  // Get employees for selected outlet who DO NOT have custom passwords in localStorage
  const filteredEmployeesWithoutAccount = employees.filter(emp => {
    if (selectedOutlet !== 'Semua Outlet' && emp.outlet !== selectedOutlet) return false;
    return !customPasswords[emp.id];
  });

  // Get active accounts (employees with passwords)
  const activeAccounts = employees.filter(emp => {
    if (selectedOutlet !== 'Semua Outlet' && emp.outlet !== selectedOutlet) return false;
    return !!customPasswords[emp.id];
  }).map(emp => {
    const generatedId = getGeneratedUsername(emp);
    const username = customUsernames[emp.id] || generatedId;
    const password = customPasswords[emp.id];
    const role = customRoles[emp.id] || 'Karyawan';
    return {
      ...emp,
      username,
      password,
      role
    };
  });

  const cap = (s = '') => String(s).replace(/\b\w/g, c => c.toUpperCase());

  const handleExportPDF = () => {
    setIsExportingPDF(true);
    setTimeout(() => {
      try {
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

        // Full B&W header block
        doc.setFillColor(0, 0, 0);
        doc.rect(0, 0, 297, 38, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(cap('LAPORAN DAFTAR AKUN LOGIN AKTIF KARYAWAN'), 14, 14);

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(180, 180, 180);
        doc.text(cap(`HRIS Barokah Grup - Modul Manajemen Hak Akses Karyawan`), 14, 22);
        doc.text(cap(`Dicetak: ${new Date().toLocaleString('id-ID')} | Total Akumulasi Akun: ${activeAccounts.length}`), 14, 28);

        const tableData = activeAccounts.map(acc => [
          cap(acc.full_name),
          acc.username,
          cap(acc.position),
          cap(acc.outlet || 'PUSAT'),
          cap(acc.role),
          acc.password
        ]);

        autoTable(doc, {
          startY: 42,
          head: [[cap('Nama Staf'), cap('ID Pengguna'), cap('Jabatan'), cap('Outlet'), cap('Peran Akses'), cap('Kata Sandi')]],
          body: tableData,
          theme: 'grid',
          styles: { fontSize: 8, cellPadding: 3 },
          headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
        });

        doc.save(`Laporan_Hak_Akses_${new Date().toISOString().slice(0, 10)}.pdf`);
      } catch (err) {
        console.error('PDF generation error:', err);
      } finally {
        setIsExportingPDF(false);
        // Reset filters
        setSelectedOutlet('Semua Outlet');
      }
    }, 200);
  };

  // Handle employee selection in form
  const handleEmpChange = (empId) => {
    setSelectedEmpId(empId);
    if (!empId) {
      setUsernameInput('');
      setRoleInput('');
      return;
    }
    const emp = employees.find(e => e.id === empId);
    if (emp) {
      setUsernameInput(getGeneratedUsername(emp));
      const pos = (emp.position || '').toLowerCase();
      if (pos.includes('owner')) setRoleInput('Owner');
      else if (pos.includes('master') || pos.includes('chief') || pos.includes('ceo')) setRoleInput('Master');
      else if (pos.includes('leader') || pos.includes('kepala') || pos.includes('spv') || pos.includes('supervisor')) setRoleInput('Leader');
      else if (pos.includes('admin') || pos.includes('hr') || pos.includes('personalia') || pos.includes('staff admin')) setRoleInput('Admin');
      else setRoleInput('Karyawan');
    }
  };

  const handlePreSave = (e) => {
    e.preventDefault();
    if (!selectedEmpId || !usernameInput || !passwordInput || !roleInput) {
      alert('Tolong lengkapi semua field!');
      return;
    }
    setShowConfirm(true);
  };

  const executeSave = async () => {
    setShowConfirm(false);
    setIsSavingAnim(true);

    const updatedPasswords = { ...customPasswords, [selectedEmpId]: passwordInput };
    const updatedUsernames = { ...customUsernames, [selectedEmpId]: usernameInput };
    const updatedRoles = { ...customRoles, [selectedEmpId]: roleInput };

    // Get selected employee info for sync body
    const emp = employees.find(e => String(e.id) === String(selectedEmpId));
    const employeeName = emp ? emp.full_name : '';
    const outlet = emp ? (emp.outlet || 'PUSAT') : 'PUSAT';

    // 1. Simpan data kredensial ke localStorage secara langsung melalui hook react
    setCustomPasswords(updatedPasswords);
    setCustomUsernames(updatedUsernames);
    setCustomRoles(updatedRoles);
    localStorage.setItem('user_credentials', JSON.stringify({
      passwords: updatedPasswords,
      usernames: updatedUsernames,
      roles: updatedRoles
    }));

    // 2. Kirim ke Server (POST Request) secara real-time / paralel
    const syncPromise = fetch(`${API_URL}/credentials/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: usernameInput,
        password: passwordInput,
        employeeName: employeeName,
        outlet: outlet,
        role: roleInput,
        id: selectedEmpId,
        employeeId: selectedEmpId
      })
    }).catch(err => {
      console.error('Real-time sync to server error:', err);
    });

    // 3. Wajib mengunci form selama 0.2 detik (200ms) diiringi animasi
    const delayPromise = new Promise(resolve => setTimeout(resolve, 200));

    try {
      await Promise.all([syncPromise, delayPromise]);
    } catch (e) {
      console.error('Promise.all error:', e);
    }

    // Success notify, tutup modal, dan kosongkan form
    alert('Kredensial berhasil disinkronkan ke server pusat dan disimpan secara lokal!');

    // Reset Form
    setSelectedEmpId('');
    setUsernameInput('');
    setPasswordInput('');
    setRoleInput('');
    setIsSavingAnim(false);
  };

  const handleDeleteAccount = async (empId) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus akun login karyawan ini?')) {
      const updatedPasswords = { ...customPasswords };
      const updatedUsernames = { ...customUsernames };
      const updatedRoles = { ...customRoles };
      delete updatedPasswords[empId];
      delete updatedUsernames[empId];
      delete updatedRoles[empId];

      // Sync instantly to backend REST API to ensure zero-stale state
      try {
        await fetch(`${API_URL}/auth/sync-credentials`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            passwords: updatedPasswords,
            usernames: updatedUsernames,
            roles: updatedRoles
          })
        });
      } catch (err) {
        console.error('REST sync error during delete:', err);
      }

      setCustomPasswords(updatedPasswords);
      setCustomUsernames(updatedUsernames);
      setCustomRoles(updatedRoles);
      localStorage.setItem('user_credentials', JSON.stringify({
        passwords: updatedPasswords,
        usernames: updatedUsernames,
        roles: updatedRoles
      }));
    }
  };

  if (!isMaster) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', background: C.surface, borderRadius: '16px', border: `1px solid ${C.border}`, marginTop: '20px' }}>
        <Shield size={48} color={C.danger} style={{ marginBottom: '16px', display: 'block', margin: '0 auto' }} />
        <h2 style={{ color: C.danger, marginBottom: '12px' }}>Akses Ditolak</h2>
        <p style={{ color: C.text }}>Halaman Hak Akses User ini eksklusif hanya untuk akun dengan Peran Master.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', background: C.bg, minHeight: '100vh', color: C.text }}>
      <style>{`
        @keyframes ant-march {
          to {
            stroke-dashoffset: -20;
          }
        }
        .marching-border {
          stroke-dasharray: 8, 4;
          animation: ant-march 0.6s linear infinite;
        }
        .form-select, .form-input {
          background: ${C.bg};
          border: 1.5px solid ${C.border};
          color: ${C.text};
          padding: 10px 14px;
          border-radius: 8px;
          outline: none;
          transition: all 0.2s ease;
          width: 100%;
        }
        .form-select:focus, .form-input:focus {
          border-color: ${C.cyan};
          box-shadow: 0 0 8px rgba(0, 173, 181, 0.25);
        }
        .action-btn {
          background: ${C.cyan};
          color: ${C.bg};
          border: none;
          padding: 10px 20px;
          border-radius: 8px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s ease;
        }
        .action-btn:hover {
          background: #00c2cb;
          box-shadow: 0 0 15px rgba(0, 173, 181, 0.4);
        }
        .dark-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 12px;
        }
        .dark-table th {
          background: rgba(0, 0, 0, 0.2);
          color: ${C.cyan};
          font-weight: 700;
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 14px 16px;
          border-bottom: 2px solid ${C.border};
          text-align: left;
        }
        .dark-table td {
          padding: 14px 16px;
          border-bottom: 1px solid ${C.border};
          font-size: 0.86rem;
        }
        .dark-table tbody tr {
          transition: background-color 0.15s ease;
        }
        .dark-table tbody tr:hover {
          background: rgba(238, 238, 238, 0.02);
        }
      `}</style>

      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: `1.5px solid ${C.border}`, paddingBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '1.40rem', fontWeight: 800, color: C.cyan, display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
            🔑 Manajemen Kredensial &amp; Hak Akses Karyawan
          </h1>
          <p style={{ color: C.muted, fontSize: '0.84rem', marginTop: '4px' }}>Khusus Master: Atur user login dan saring karyawan belum berakun per outlet.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <select 
            className="form-select" 
            style={{ width: '220px' }} 
            value={selectedOutlet} 
            onChange={e => setSelectedOutlet(e.target.value)}
          >
            {outletsList.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <button
            id="global-pdf-btn"
            type="button"
            onClick={handleExportPDF}
            style={{
              backgroundColor: '#000000',
              color: '#ffffff',
              fontWeight: 'bold',
              borderRadius: '6px',
              padding: '10px 16px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.84rem',
              transition: 'transform 0.1s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.03)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            📥 Download Laporan PDF
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.9fr', gap: '24px', alignItems: 'start' }}>
        {/* FORM BUAT AKUN BARU */}
        <div style={{ background: C.surface, borderRadius: '14px', border: `1.5px solid ${C.cyanBorder}`, padding: '24px', boxShadow: '0 4px 30px rgba(0,0,0,0.15)' }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '18px', color: C.cyan, display: 'flex', alignItems: 'center', gap: '8px' }}>
            🚀 Buat Akun Login Baru
          </h2>
          <form onSubmit={handlePreSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: C.muted, fontWeight: 700, marginBottom: '6px' }}>PILIH KARYAWAN ({filteredEmployeesWithoutAccount.length})</label>
              <select 
                className="form-select" 
                value={selectedEmpId} 
                onChange={e => handleEmpChange(e.target.value)}
                required
              >
                <option value="">-- Pilih Karyawan Tanpa Akun --</option>
                {filteredEmployeesWithoutAccount.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name} ({emp.position} - {emp.outlet})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: C.muted, fontWeight: 700, marginBottom: '6px' }}>USERNAME / ID PENGGUNA</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Misal: BUD00001" 
                value={usernameInput} 
                onChange={e => setUsernameInput(e.target.value.toUpperCase())}
                required 
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: C.muted, fontWeight: 700, marginBottom: '6px' }}>KATA SANDI (PASSWORD)</label>
              <input 
                type="password" 
                className="form-input" 
                placeholder="Masukkan kata sandi baru" 
                value={passwordInput} 
                onChange={e => setPasswordInput(e.target.value)}
                required 
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: C.muted, fontWeight: 700, marginBottom: '6px' }}>PERAN AKSES (ROLE)</label>
              <select 
                className="form-select" 
                value={roleInput} 
                onChange={e => setRoleInput(e.target.value)}
                required
              >
                <option value="">-- Pilih Peran --</option>
                <option value="Master">Master (Web & Mobile)</option>
                <option value="Owner">Owner (Web & Mobile)</option>
                <option value="Admin">Admin (Web & Mobile)</option>
                <option value="Leader">Leader (Web & Mobile)</option>
                <option value="Karyawan">Karyawan (Mobile-Only)</option>
              </select>
            </div>

            <button type="submit" className="action-btn" style={{ marginTop: '10px' }}>
              <Save size={16} /> Simpan Akun
            </button>
          </form>
        </div>

        {/* TABEL USER YANG SUDAH MEMILIKI AKUN */}
        <div style={{ background: C.surface, borderRadius: '14px', border: `1.5px solid ${C.border}`, padding: '24px' }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '16px', color: C.cyan }}>
            📋 Daftar Akun Login Aktif ({activeAccounts.length})
          </h2>
          
          <div style={{ overflowX: 'auto' }}>
            <table className="dark-table">
              <thead>
                <tr>
                  <th>Nama Staf</th>
                  <th>ID Pengguna</th>
                  <th>Jabatan</th>
                  <th>Outlet</th>
                  <th>Peran Akses</th>
                  <th>Kata Sandi</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {activeAccounts.map(acc => {
                  const isVisible = showPasswordMap[acc.id];
                  return (
                    <tr key={acc.id}>
                      <td style={{ fontWeight: 700 }}>{acc.full_name}</td>
                      <td style={{ fontFamily: 'monospace', color: C.cyan, fontWeight: 700 }}>{acc.username}</td>
                      <td style={{ textTransform: 'capitalize' }}>{acc.position}</td>
                      <td>{acc.outlet || 'PUSAT'}</td>
                      <td style={{ fontWeight: 600, color: acc.role === 'Karyawan' ? C.muted : C.cyan }}>{acc.role}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontFamily: 'monospace' }}>{isVisible ? acc.password : '••••••••'}</span>
                          <button 
                            onClick={() => setShowPasswordMap(p => ({ ...p, [acc.id]: !p[acc.id] }))}
                            style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer' }}
                          >
                            {isVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                      </td>
                      <td>
                        <button 
                          onClick={() => handleDeleteAccount(acc.id)}
                          style={{ background: 'transparent', border: 'none', color: C.danger, cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}
                        >
                          Hapus Akun
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {activeAccounts.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: C.muted, padding: '30px' }}>
                      Tidak ada akun login aktif untuk kriteria saringan ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* DOUBLE CONFIRMATION MODAL */}
      {showConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)' }}>
          <div style={{ background: C.surface, borderRadius: '16px', border: `1.5px solid ${C.cyan}`, padding: '30px', width: '400px', textAlign: 'center', boxShadow: '0 0 30px rgba(0,173,181,0.3)' }}>
            <AlertTriangle size={48} color={C.warn} style={{ marginBottom: '16px', display: 'block', margin: '0 auto' }} />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '12px' }}>Konfirmasi Buat Akun</h3>
            <p style={{ color: C.muted, fontSize: '0.86rem', lineHeight: '1.5', marginBottom: '24px' }}>
              Apakah Anda yakin ingin memublikasikan kredensial akun login ini? Akun akan langsung dikunci di database lokal dan dapat digunakan seketika.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button 
                className="action-btn" 
                style={{ background: 'transparent', border: `1.5px solid ${C.border}`, color: C.text }} 
                onClick={() => setShowConfirm(false)}
              >
                Batal
              </button>
              <button className="action-btn" onClick={executeSave}>
                Ya, Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ELECTRIC CYAN MARCHING ANTS ANIMATION OVERLAY */}
      {isSavingAnim && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(34,40,49,0.9)', zIndex: 10000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'relative', width: '320px', height: '140px', background: C.surface, borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            {/* SVG Marching Ants Border */}
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
              <rect 
                x="3" y="3" 
                width="314" height="134" 
                rx="13" ry="13" 
                fill="none" 
                stroke={C.cyan} 
                strokeWidth="3" 
                className="marching-border" 
              />
            </svg>
            <h4 style={{ color: C.cyan, fontWeight: 900, fontSize: '1rem', letterSpacing: '1px', marginBottom: '8px' }}>🤖 MENGUNCI KREDENSIAL</h4>
            <p style={{ color: C.text, fontSize: '0.8rem', margin: 0 }}>Menyuntikkan Kredensial ke Local Database...</p>
          </div>
        </div>
      )}
      {/* PDF Exporter Compiler Overlay */}
      <PDFCompileOverlay isOpen={isExportingPDF} />
    </div>
  );
}

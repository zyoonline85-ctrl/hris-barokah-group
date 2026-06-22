import React, { useState, useEffect, useRef } from 'react';
import { Bell, Sun, Moon } from 'lucide-react';

export default function Header({ activeTab, user, token, API_URL, setActiveTab, theme, setTheme }) {
  const titles = {
    dashboard: 'Dasbor Analitik Utama',
    employees: 'Manajemen Data Karyawan',
    attendances: 'Log Rekam Kehadiran',
    leaves: 'Manajemen Cuti & Izin',
    payroll: 'Pemrosesan Slip Gaji (Payroll)',
    contracts: 'Manajemen Surat Penugasan',
    outlets: 'Manajemen Outlet Cabang Utama',
    revenues: 'Omzet Pendapatan Cabang',
    sops: 'SOP & Prosedur Operasional',
    kpis: 'Penilaian Kinerja KPI',
    sanctions: 'Sanksi & Surat Peringatan (SP)',
    trainings: 'Program Pelatihan & Sertifikasi',
    policies: 'Kebijakan & Peraturan Perusahaan',
    user: 'LOG STATUS DAN HAK AKSES PENGGUNA SISTEM',
    users: 'LOG STATUS DAN HAK AKSES PENGGUNA SISTEM',
    rbac: 'Manajemen Hak Akses RBAC',
    settings: 'KONFIGURASI HAK AKSES & PARAMETER SISTEM',
  };

  const [pendingCount, setPendingCount] = useState(0);
  const prevCountRef = useRef(0);

  const playChime = () => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880.00, ctx.currentTime + 0.15); // A5
      
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
      console.error('Audio play error:', e);
    }
  };

  useEffect(() => {
    if (!token || !API_URL) return;

    const fetchPendingCount = async () => {
      try {
        const res = await fetch(`${API_URL}/leaves?status=pending`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.status === 'success') {
          const count = Array.isArray(data.data) ? data.data.length : 0;
          setPendingCount(count);
          if (count > prevCountRef.current) {
            playChime();
          }
          prevCountRef.current = count;
        }
      } catch (err) {
        console.error('Error fetching pending leaves count:', err);
      }
    };

    fetchPendingCount();
    const interval = setInterval(fetchPendingCount, 10000); // poll every 10s

    return () => clearInterval(interval);
  }, [token, API_URL]);

  const getInitials = (name) => {
    if (!name) return 'HR';
    const splitName = name.split(' ');
    if (splitName.length > 1) {
      return (splitName[0][0] + splitName[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <header className="header animate-fade-in">
      <div className="header-title">
        <h1>{titles[activeTab] || 'HRIS Portal'}</h1>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        {/* Theme Toggle Button */}
        {setTheme && (
          <div
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title={theme === 'dark' ? 'Ganti ke Mode Terang' : 'Ganti ke Mode Gelap'}
            style={{
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: theme === 'dark' ? 'rgba(0,173,181,0.08)' : 'rgba(165,182,141,0.12)',
              border: theme === 'dark' ? '1px solid rgba(0,173,181,0.25)' : '1px solid rgba(165,182,141,0.3)',
              transition: 'all 0.3s ease',
              boxShadow: theme === 'dark' ? '0 0 8px rgba(0,173,181,0.15)' : '0 0 8px rgba(165,182,141,0.2)'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'scale(1.1)';
              e.currentTarget.style.boxShadow = theme === 'dark' ? '0 0 14px rgba(0,173,181,0.35)' : '0 0 14px rgba(165,182,141,0.4)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = theme === 'dark' ? '0 0 8px rgba(0,173,181,0.15)' : '0 0 8px rgba(165,182,141,0.2)';
            }}
          >
            {theme === 'dark'
              ? <Sun size={18} color="#00ADB5" />
              : <Moon size={18} color="#A5B68D" />
            }
          </div>
        )}

        {token && (
          <div 
            onClick={() => setActiveTab && setActiveTab('leaves')} 
            style={{ 
              position: 'relative', 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'rgba(165, 182, 141, 0.05)',
              border: '1px solid rgba(165, 182, 141, 0.1)',
              transition: 'all 0.25s ease'
            }}
            title="Pusat Pengajuan Masuk"
          >
            <Bell size={20} color="var(--text-main)" />
            {pendingCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                background: '#E74C3C',
                color: '#fff',
                fontSize: '0.68rem',
                fontWeight: 'bold',
                borderRadius: '10px',
                padding: '2px 6px',
                border: '2px solid #000',
                boxShadow: '0 0 10px rgba(231,76,60,0.5)',
                display: 'inline-block'
              }}>
                {pendingCount}
              </span>
            )}
          </div>
        )}

        <div className="user-profile">
          <div className="user-info" style={{ textAlign: 'right' }}>
            <span className="user-name">{user?.fullName || 'Owner Company'}</span>
            <span className="user-role">{user?.role?.toUpperCase() || 'OWNER'}</span>
          </div>
          <div className="user-avatar">
            {getInitials(user?.fullName)}
          </div>
        </div>
      </div>
    </header>
  );
}

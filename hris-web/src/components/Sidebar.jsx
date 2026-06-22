import { 
  LayoutDashboard, Users, Calendar, FileText, LogOut, 
  ShieldAlert, Shield, Settings, Store, BookOpen, 
  HelpCircle, BarChart3, AlertTriangle, Award, Key, Coins, Radio
} from 'lucide-react';
import { getRoleFromPosition, checkAccess } from '../utils/security';

export default function Sidebar({ activeTab, setActiveTab, onLogout, user, userPermissions }) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard Utama', icon: LayoutDashboard },
    { id: 'employees', label: 'Kelola Karyawan', icon: Users },
    { id: 'attendances', label: 'Log Kehadiran', icon: Calendar },
    { id: 'leaves', label: 'Pusat Pengajuan', icon: ShieldAlert },
    { id: 'payroll', label: 'Payroll', icon: FileText },
    { id: 'contracts', label: 'Surat Penugasan', icon: FileText },
    { id: 'outlets', label: 'Outlet Cabang', icon: Store },
    { id: 'revenues', label: 'Omzet Cabang', icon: Coins },
    { id: 'sops', label: 'SOP & Prosedur', icon: BookOpen },
    { id: 'kpis', label: 'Penilaian KPI', icon: BarChart3 },
    { id: 'sanctions', label: 'Sanksi & SP', icon: AlertTriangle },
    { id: 'trainings', label: 'Program Pelatihan', icon: Award },
    { id: 'kuis', label: 'Kuis Kompetensi', icon: BookOpen },
    { id: 'broadcast', label: 'Broadcast & Notifikasi', icon: Radio },
    { id: 'policies', label: 'Kebijakan Perusahaan', icon: ShieldAlert },
  ];

  // Saring menuItems berdasarkan data perizinan
  const filteredMenuItems = menuItems.filter(item => {
    if (item.id === 'dashboard') return true;

    // Check if the user has global read access from checkAccess
    if (!checkAccess(user, 'read')) return false;

    if (user && user.role === 'owner') return true;
    if (userPermissions && userPermissions[item.id]) {
      return userPermissions[item.id].can_view === 1;
    }
    return false;
  });

  // Halaman Hak Akses (settings) ditambahkan jika memiliki izin view settings (khusus Peran Master)
  const currentUserRole = getRoleFromPosition(user?.position, user?.role);
  const showSettings = (currentUserRole === 'master');
  if (showSettings) {
    filteredMenuItems.push(
      { id: 'settings', label: 'Hak Akses', icon: Settings },
      { id: 'hakuser', label: 'Hak User', icon: Key }
    );
  }


  return (
    <aside className="sidebar animate-fade-in" style={{ position: 'relative', overflowX: 'hidden', overflowY: 'auto' }}>
      {/* Decorative Ornaments (Glow circles and Wavy shapes) */}
      <div style={{
        position: 'absolute',
        top: '-50px',
        left: '-50px',
        width: '150px',
        height: '150px',
        borderRadius: '50%',
        background: 'rgba(255, 255, 255, 0.08)',
        filter: 'blur(20px)',
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-30px',
        right: '-30px',
        width: '120px',
        height: '120px',
        borderRadius: '50%',
        background: 'rgba(255, 98, 188, 0.25)', /* Sampled Hot Pink glow */
        filter: 'blur(30px)',
        pointerEvents: 'none'
      }} />

      {/* Dynamic SVG background shapes and patterns in Sidebar */}
      <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.12 }} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="sidebar-dots" x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1" fill="var(--bg-surface)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#sidebar-dots)" />
        {/* Dynamic diagonal stripes/lines */}
        <line x1="-50" y1="200" x2="300" y2="550" stroke="var(--bg-surface)" strokeWidth="2" strokeDasharray="10 15" />
        <line x1="-20" y1="180" x2="330" y2="530" stroke="var(--bg-surface)" strokeWidth="0.5" />
        <line x1="-80" y1="220" x2="270" y2="570" stroke="var(--bg-surface)" strokeWidth="1" strokeDasharray="4 4" />
        {/* Glowing floating decorative orbits */}
        <circle cx="210" cy="120" r="40" fill="none" stroke="#ff98d1" strokeWidth="1.25" strokeDasharray="6 4" />
        <circle cx="50" cy="700" r="80" fill="none" stroke="#ff62bc" strokeWidth="1.5" />
        <circle cx="50" cy="700" r="60" fill="none" stroke="#ff62bc" strokeWidth="0.75" strokeDasharray="12 6" />
      </svg>

      <div className="logo-container" style={{ position: 'relative', zIndex: 2 }}>
        <div className="logo-icon">
          <FileText size={22} color="#fff" />
        </div>
        <span className="logo-text">HRIS SYSTEM</span>
      </div>

      {/* Decorative Abstract Line Ornament at top */}
      <div style={{
        height: '4px',
        background: 'linear-gradient(to right, #ff62bc, #ff98d1, #b42df1)',
        borderRadius: '2px',
        marginBottom: '25px',
        marginTop: '-15px',
        opacity: 0.9,
        position: 'relative',
        zIndex: 2
      }} />

      <nav style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, position: 'relative', zIndex: 2 }}>
        <ul className="nav-links">
          {filteredMenuItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <li key={item.id}>
                <div
                  className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(item.id)}
                >
                  <IconComponent size={20} />
                  <span>{item.label}</span>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="logout-container">
          <div className="nav-item" onClick={onLogout} style={{ borderLeftColor: 'var(--danger)', color: 'var(--danger)' }}>
            <LogOut size={20} color="var(--danger)" />
            <span style={{ color: 'var(--danger)' }}>Keluar Sesi</span>
          </div>
        </div>
      </nav>
    </aside>
  );
}

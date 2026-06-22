import React, { useEffect, useState } from 'react';
import { useHRIS } from '../context/HRISContext';
import { 
  Users, Calendar, AlertCircle, Coins, Award, Briefcase, FileText, 
  Shield, ShieldAlert, Store, BookOpen, HelpCircle, BarChart3, 
  AlertTriangle, Info, Key, ArrowUpRight, CheckCircle2,
  SlidersHorizontal, X, Eye, EyeOff, RotateCcw, Loader2
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import PDFCompileOverlay from './PDFCompileOverlay';

const capitalEachWord = (str) => {
  if (!str) return '';
  return String(str).toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
};

// ─── SVG Donut Chart Component ───
const SvgDonutChart = ({ data, size = 155 }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const radius = size * 0.35;
  const strokeWidth = size * 0.12;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercent = 0;

  if (total === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: size, height: size }}>
        <svg width={size} height={size}>
          <circle cx={center} cy={center} r={radius} fill="none" stroke="rgba(15,23,42,0.08)" strokeWidth={strokeWidth} />
        </svg>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-main)', opacity: 0.5, marginTop: '8px' }}>Tidak Ada Data</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {data.map((item, idx) => {
          if (item.value === 0) return null;
          const percent = (item.value / total) * 100;
          const strokeLength = circumference * (percent / 100);
          const strokeOffset = circumference - (circumference * (accumulatedPercent / 100));
          accumulatedPercent += percent;

          return (
            <circle
              key={idx}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={item.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${strokeLength} ${circumference}`}
              strokeDashoffset={strokeOffset}
              style={{ transition: 'all 0.5s ease', cursor: 'pointer' }}
              title={`${item.label}: ${item.value} (${Math.round(percent)}%)`}
            />
          );
        })}
      </svg>
      {/* Centered Total Label */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        pointerEvents: 'none'
      }}>
        <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1 }}>{total}</span>
        <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px' }}>Total</span>
      </div>
    </div>
  );
};

// ─── SVG Multi Line Chart Component ───
const SvgMultiLineChart = ({ data, width = 600, height = 300 }) => {
  const outlets = Object.keys(data);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun'];

  const margin = { top: 25, right: 30, bottom: 40, left: 70 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  let maxVal = 100000000;
  outlets.forEach(ot => {
    const vals = data[ot] || [];
    vals.forEach(v => {
      if (v > maxVal) maxVal = v;
    });
  });
  maxVal = Math.ceil(maxVal / 50000000) * 50000000;

  const yTicks = [0, maxVal * 0.25, maxVal * 0.5, maxVal * 0.75, maxVal];
  const formatCompactRp = (value) => {
    if (value >= 1000000000) {
      return 'Rp ' + (value / 1000000000).toFixed(1).replace(/\.0$/, '') + ' M';
    }
    if (value >= 1000000) {
      return 'Rp ' + (value / 1000000).toFixed(0) + ' Jt';
    }
    if (value >= 1000) {
      return 'Rp ' + (value / 1000).toFixed(0) + ' Rb';
    }
    return 'Rp ' + value;
  };

  const getX = (index) => margin.left + (index / 5) * plotW;
  const getY = (val) => margin.top + plotH - (val / maxVal) * plotH;

  const colors = {
    'AYAM PECAK 2001 SEAFOOD RANTAU PRAPAT': '#00ADB5',
    'AYAM PECAK 2001 SEAFOOD KISARAN': '#00D8FF',
    'PECEL LELE PAK HAJI KISARAN': 'var(--accent-primary)',
    'AYAM PECAK 2001 SEAFOOD TEBING TINGGI': '#FF97D0',
    'AYAM BAKAR SURABAYA TEBING TINGGI': '#B331F1',
    'Lainnya': '#94a3b8'
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ background: 'var(--bg-surface)', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
        {/* Horizontal grid lines */}
        {yTicks.map((tick, i) => {
          const y = getY(tick);
          return (
            <g key={i}>
              <line x1={margin.left} y1={y} x2={width - margin.right} y2={y} stroke="rgba(238, 238, 238, 0.08)" strokeDasharray="4 4" />
              <text x={margin.left - 10} y={y + 4} fill="var(--text-muted)" fontSize="10px" textAnchor="end" fontWeight="600">
                {formatCompactRp(tick)}
              </text>
            </g>
          );
        })}

        {/* X axis labels */}
        {months.map((m, i) => {
          const x = getX(i);
          return (
            <text key={i} x={x} y={height - margin.bottom + 20} fill="var(--text-muted)" fontSize="11px" textAnchor="middle" fontWeight="700">
              {m}
            </text>
          );
        })}

        {/* Plot the lines */}
        {outlets.map((ot) => {
          const values = data[ot] || [0, 0, 0, 0, 0, 0];
          const color = colors[ot] || colors['Lainnya'];
          
          let pathD = '';
          values.forEach((v, idx) => {
            const x = getX(idx);
            const y = getY(v);
            if (idx === 0) pathD += `M ${x} ${y}`;
            else pathD += ` L ${x} ${y}`;
          });

          return (
            <g key={ot}>
              <path
                d={pathD}
                fill="none"
                stroke={color}
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ transition: 'all 0.3s ease' }}
              />
              {values.map((v, idx) => {
                const x = getX(idx);
                const y = getY(v);
                return (
                  <circle
                    key={idx}
                    cx={x}
                    cy={y}
                    r="5"
                    fill="var(--bg-surface)"
                    stroke={color}
                    strokeWidth="3"
                    style={{ transition: 'all 0.3s ease', cursor: 'pointer' }}
                    title={`${ot} (${months[idx]}): ${formatCompactRp(v)}`}
                  />
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

const MOCK_OMZET_TRENDS = {
  'AYAM PECAK 2001 SEAFOOD RANTAU PRAPAT': [310000000, 330000000, 320000000, 340000000, 335000000, 350000000],
  'AYAM PECAK 2001 SEAFOOD KISARAN': [280000000, 290000000, 310000000, 305000000, 315000000, 320000000],
  'PECEL LELE PAK HAJI KISARAN': [150000000, 160000000, 155000000, 170000000, 165000000, 180000000],
  'AYAM PECAK 2001 SEAFOOD TEBING TINGGI': [160000000, 175000000, 170000000, 180000000, 175000000, 180000000],
  'AYAM BAKAR SURABAYA TEBING TINGGI': [120000000, 130000000, 140000000, 135000000, 145000000, 150000000]
};

export default function Dashboard({ token, API_URL, userPermissions, setActiveTab }) {
  // ─── Subscribe ke Global HRIS Context untuk reaktivitas lintas modul ────────
  const { activeEmployees: ctxEmployees, totalMonthlyRevenue: ctxRevenue,
          dailyRevenue: ctxDailyRevenue, dispatch: hrisDispatch } = useHRIS();

  const [isExportingPDF, setIsExportingPDF] = useState(false);

  const handleExportPDF = () => {
    setIsExportingPDF(true);
    setTimeout(() => {
      try {
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        
        // Title
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text(capitalEachWord("LAPORAN EKOSISTEM HRIS BAROKAH GRUP"), 15, 15);
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(capitalEachWord(`Periode: ${startDate} s/d ${endDate}`), 15, 22);
        doc.text(capitalEachWord(`Total Karyawan Terfilter: ${filteredEmployees.length} Orang (Pria: ${priaCount}, Wanita: ${wanitaCount})`), 15, 27);
        
        // Plain Summary Metrics
        const metricsHeaders = [
          [capitalEachWord("Total Omzet"), capitalEachWord("Pengeluaran Operasional"), capitalEachWord("Pendapatan Bersih"), capitalEachWord("Rata-rata Kehadiran"), capitalEachWord("Total Kasbon Aktif"), capitalEachWord("Gaji Terbayar")]
        ];
        const metricsData = [
          [
            formatCurrency(grandTotalOmzet),
            formatCurrency(totalPengeluaranOperasional),
            formatCurrency(totalPendapatanBersih),
            `${averageAttendanceRate}%`,
            formatCurrency(totalKasbonAktif),
            formatCurrency(totalGajiTerbayar)
          ].map(s => capitalEachWord(s))
        ];
        
        autoTable(doc, {
          startY: 32,
          head: metricsHeaders,
          body: metricsData,
          theme: 'grid',
          headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255] },
          styles: { fontSize: 8, font: 'helvetica' }
        });
        
        // Table 1: Target vs Actual Staff per Outlet
        const staffHeaders = [[capitalEachWord("Nama Outlet"), capitalEachWord("Aktual Staf"), capitalEachWord("Target Staf")]];
        const staffRows = staffComparisonList.map(item => [
          capitalEachWord(item.outletName),
          String(item.actual),
          String(item.target)
        ]);
        
        doc.text(capitalEachWord("Perbandingan Aktual vs Target Staffing Outlet"), 15, doc.lastAutoTable.finalY + 10);
        
        autoTable(doc, {
          startY: doc.lastAutoTable.finalY + 12,
          head: staffHeaders,
          body: staffRows,
          theme: 'grid',
          headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255] },
          styles: { fontSize: 8 }
        });
        
        // Table 2: Leaderboard KPI Top 5
        const kpiHeaders = [[capitalEachWord("Nama Karyawan"), capitalEachWord("Jabatan"), capitalEachWord("Skor KPI")]];
        const kpiRows = leaderboardData.slice(0, 5).map(item => [
          capitalEachWord(item.name),
          capitalEachWord(item.position),
          String(item.totalKpi)
        ]);
        
        doc.text(capitalEachWord("Peringkat 5 Tertinggi Leaderboard KPI Karyawan"), 15, doc.lastAutoTable.finalY + 10);
        
        autoTable(doc, {
          startY: doc.lastAutoTable.finalY + 12,
          head: kpiHeaders,
          body: kpiRows,
          theme: 'grid',
          headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255] },
          styles: { fontSize: 8 }
        });
        
        doc.save(`Laporan_Ekosistem_Dashboard_${Date.now()}.pdf`);
      } catch (err) {
        console.error("PDF generation failed:", err);
      } finally {
        setIsExportingPDF(false);
        // Auto-cleanup: Reset filters back to default
        const activeList = getActiveOutletsList();
        setSelectedOutlets(activeList);
        setUiSelectedOutlets(activeList);
        setStartDate(defaults.start);
        setUiStartDate(defaults.start);
        setEndDate(defaults.end);
        setUiEndDate(defaults.end);
      }
    }, 200);
  };

  // Database & LocalStorage States
  const [employees, setEmployees] = useState([]);
  const [userAccounts, setUserAccounts] = useState([]);
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [realtimeLogs, setRealtimeLogs] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [payroll, setPayroll] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [revenues, setRevenues] = useState([]);
  const [sops, setSops] = useState([]);
  const [documentations, setDocumentations] = useState([]);
  const [kpis, setKpis] = useState([]);
  const [sanctions, setSanctions] = useState([]);
  const [trainings, setTrainings] = useState([]);
  const [policies, setPolicies] = useState([]);
  
  const [loading, setLoading] = useState(true);

  // --- Dashboard Main Control Multi-Filter Engine States ---
  const getDefaultDates = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return {
      start: `${yyyy}-${mm}-01`,
      end: `${yyyy}-${mm}-${dd}`
    };
  };

  const getActiveOutletsList = () => {
    const rawOutlets = localStorage.getItem('outlet_cabang_data');
    if (rawOutlets) {
      try {
        const parsed = JSON.parse(rawOutlets);
        const names = parsed.map(o => o.nama_tablet || o.nama_outlet).filter(Boolean);
        if (names.length > 0) return [...new Set(names)];
      } catch (e) {}
    }
    if (outlets && outlets.length > 0) {
      const names = outlets.map(o => o.nama_tablet || o.nama_outlet || o.name).filter(Boolean);
      if (names.length > 0) return [...new Set(names)];
    }
    if (employees && employees.length > 0) {
      const names = employees.map(e => e.outlet).filter(Boolean);
      if (names.length > 0) return [...new Set(names)];
    }
    return [
      'AYAM PECAK 2001 SEAFOOD RANTAU PRAPAT',
      'AYAM PECAK 2001 SEAFOOD KISARAN',
      'PECEL LELE PAK HAJI KISARAN',
      'AYAM PECAK 2001 SEAFOOD TEBING TINGGI',
      'AYAM BAKAR SURABAYA TEBING TINGGI'
    ];
  };

  const defaults = getDefaultDates();
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);
  const [selectedOutlets, setSelectedOutlets] = useState([]);
  const [isOutletDropdownOpen, setIsOutletDropdownOpen] = useState(false);
  const [isFilterLoading, setIsFilterLoading] = useState(false);

  // --- UI Filter & Confirmation States ---
  const [uiStartDate, setUiStartDate] = useState(defaults.start);
  const [uiEndDate, setUiEndDate] = useState(defaults.end);
  const [uiSelectedOutlets, setUiSelectedOutlets] = useState([]);
  const [showConfirmSaring, setShowConfirmSaring] = useState(false);
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [isApplyingFilter, setIsApplyingFilter] = useState(false);

  const triggerFilterLoading = () => {
    setIsFilterLoading(true);
    setTimeout(() => {
      setIsFilterLoading(false);
    }, 500);
  };

  // ─── Reactive: Sync employees dari context saat berubah di modul lain ────────
  useEffect(() => {
    if (ctxEmployees && ctxEmployees.length > 0) {
      setEmployees(prev => {
        // Hanya update jika benar-benar berbeda (hindari infinite loop)
        if (prev.length !== ctxEmployees.length) return ctxEmployees;
        return prev;
      });
    }
  }, [ctxEmployees]);

  // ─── Reactive: Sync revenue dari context saat OmzetCabang input omzet ────────
  useEffect(() => {
    if (ctxDailyRevenue && ctxDailyRevenue.length > 0) {
      // Map daily_revenue_logs format ke format yang dipakai Dashboard
      const revenueByOutlet = ctxDailyRevenue.reduce((acc, r) => {
        const outletId = r.outlet_id || r.outletId || '';
        if (!acc[outletId]) acc[outletId] = 0;
        acc[outletId] += parseFloat(r.amount || r.jumlah || 0);
        return acc;
      }, {});
      // Inject ke revenues state jika ada data baru
      setRevenues(prev => {
        const updated = [...prev];
        Object.entries(revenueByOutlet).forEach(([outletId, total]) => {
          const idx = updated.findIndex(r => r.outlet_id === outletId || r.id === outletId);
          if (idx >= 0) {
            updated[idx] = { ...updated[idx], totalRevenue: total };
          }
        });
        return updated;
      });
    }
  }, [ctxDailyRevenue]);

  useEffect(() => {
    if (selectedOutlets.length === 0 && (employees.length > 0 || outlets.length > 0)) {
      const activeList = getActiveOutletsList();
      setSelectedOutlets(activeList);
      setUiSelectedOutlets(activeList);
    }
  }, [employees, outlets, selectedOutlets]);


  // --- Filter Confirmation Handlers ---
  const handleConfirmSaringOk = () => {
    setIsApplyingFilter(true);
    setIsFilterLoading(true);
    setTimeout(() => {
      setSelectedOutlets(uiSelectedOutlets);
      setStartDate(uiStartDate);
      setEndDate(uiEndDate);
      setIsFilterLoading(false);
      setIsApplyingFilter(false);
      setShowConfirmSaring(false);
    }, 500);
  };

  const handleConfirmSaringCancel = () => {
    setUiSelectedOutlets(selectedOutlets);
    setUiStartDate(startDate);
    setUiEndDate(endDate);
    setShowConfirmSaring(false);
  };

  const handleConfirmResetOk = () => {
    setIsApplyingFilter(true);
    setIsFilterLoading(true);
    setTimeout(() => {
      const activeList = getActiveOutletsList();
      setSelectedOutlets(activeList);
      setUiSelectedOutlets(activeList);
      setStartDate(defaults.start);
      setUiStartDate(defaults.start);
      setEndDate(defaults.end);
      setUiEndDate(defaults.end);
      setIsOutletDropdownOpen(false);
      setIsFilterLoading(false);
      setIsApplyingFilter(false);
      setShowConfirmReset(false);
    }, 500);
  };

  const handleConfirmResetCancel = () => {
    setShowConfirmReset(false);
  };

  useEffect(() => {
    const handleOutsideClick = (event) => {
      const dropdownEl = document.getElementById('outlet-filter-dropdown-container');
      if (dropdownEl && !dropdownEl.contains(event.target)) {
        setIsOutletDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);


  // Dashboard Filter State - persisted to localStorage
  const ALL_MODULES = [
    'employees', 'user',
    'attendances', 'leaves',
    'payroll', 'revenues',
    'outlets', 'policies',
    'sops', 'trainings',
    'kpis', 'sanctions'
  ];

  const loadFilter = () => {
    try {
      const stored = localStorage.getItem('hris_dashboard_filter');
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    const def = {};
    ALL_MODULES.forEach(m => { def[m] = true; });
    return def;
  };

  const [dashFilter, setDashFilter] = useState(loadFilter);
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  const saveFilter = (newFilter) => {
    setDashFilter(newFilter);
    localStorage.setItem('hris_dashboard_filter', JSON.stringify(newFilter));
  };

  const toggleModule = (mod) => {
    saveFilter({ ...dashFilter, [mod]: !dashFilter[mod] });
  };

  const selectAll = () => {
    const all = {};
    ALL_MODULES.forEach(m => { all[m] = true; });
    saveFilter(all);
  };

  const deselectAll = () => {
    const none = {};
    ALL_MODULES.forEach(m => { none[m] = false; });
    saveFilter(none);
  };

  const hiddenCount = ALL_MODULES.filter(m => !dashFilter[m]).length;

  const isVisible = (mod) => dashFilter[mod] !== false;

  // Helper to generate dynamic ID for User accounts (matching UsersPage.jsx)
  const generateUserId = (fullName, index) => {
    const firstName = fullName.trim().split(/\s+/)[0] || 'USR';
    const prefix = (firstName.substring(0, 3).padEnd(3, 'X')).toUpperCase();
    const suffix = String(index + 1).padStart(5, '0');
    return prefix + suffix;
  };
  const clearDashboardTrash = async () => {
    if (!window.confirm("Apakah Anda yakin ingin melakukan pembersihan hard reset dasbor & database lokal? Semua log sampah dan memori uji coba lama akan dibersihkan secara permanen.")) {
      return;
    }

    try {
      // 1. Clear LocalStorage test keys (keep login credentials and custom settings)
      const keysToKeep = ['token', 'user_profile', 'hris_user_passwords', 'hris_dashboard_filter'];
      const keysToDelete = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!keysToKeep.includes(key)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(k => localStorage.removeItem(k));

      // 2. Clear frontend state variables to blank/empty
      setEmployees([]);
      setUserAccounts([]);
      setAttendanceLogs([]);
      setRealtimeLogs([]);
      setLeaves([]);
      setPayroll([]);
      setOutlets([]);
      setRevenues([]);
      setSops([]);
      setDocumentations([]);
      setQuizzes([]);
      setQuizAttempts([]);
      setKpis([]);
      setSanctions([]);
      setTrainings([]);
      setPolicies([]);

      // 3. Call backend endpoint to clean database
      const res = await fetch(`${API_URL}/settings/clear-trash`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Bypass-Tunnel-Reminder': 'true'
        }
      });
      const data = await res.json();
      if (data.status === 'success') {
        alert("Pembersihan Hard Reset Dasbor & Database Sukses! Penyimpanan kembali kosong, bersih, dan loading menjadi super cepat.");
        window.location.reload();
      } else {
        alert("Gagal melakukan pembersihan di sisi server: " + data.message);
      }
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan saat memproses hard reset pembersihan.");
    }
  };

  useEffect(() => {
    async function fetchAllData() {
      try {
        const headers = { 'Authorization': `Bearer ${token}` };

        // --- 1. EMPLOYEES & USER ACCOUNTS (LocalStorage with API Fallback) ---
        let empList = [];
        const localEmp = localStorage.getItem('hris_employees');
        if (localEmp) {
          try {
            empList = JSON.parse(localEmp);
          } catch (e) {
            console.error('Failed to parse local employees:', e);
          }
        }
        
        try {
          const resEmp = await fetch(`${API_URL}/employees`, { headers });
          const dataEmp = await resEmp.json();
          if (dataEmp.status === 'success' && dataEmp.data && dataEmp.data.length > 0) {
            if (empList.length === 0) {
              empList = dataEmp.data;
            }
          }
        } catch (err) {
          console.error('Failed to fetch employees from API:', err);
        }
        setEmployees(empList);

        // Derive user accounts
        let customPasswords = {};
        try {
          const stored = localStorage.getItem('hris_user_passwords');
          if (stored) customPasswords = JSON.parse(stored);
        } catch (e) {
          console.error('Failed to parse custom passwords:', e);
        }

        const accounts = empList.map((emp, index) => {
          const generatedId = generateUserId(emp.full_name, index);
          const password = customPasswords[emp.id] || emp.nik || '123456';
          return { ...emp, generatedId, password };
        });
        setUserAccounts(accounts);

        // --- 2. ATTENDANCES (LocalStorage Realtime + Backend History Merge) ---
        const localRealtime = JSON.parse(localStorage.getItem('hris_attendances_realtime') || '[]');
        setRealtimeLogs(localRealtime);

        try {
          const resAtt = await fetch(`${API_URL}/attendance/history`, { headers });
          const dataAtt = await resAtt.json();
          let backendLogs = dataAtt.status === 'success' ? dataAtt.data : [];
          
          const localHistory = JSON.parse(localStorage.getItem('hris_attendances_history') || '[]');
          const mergedHistory = [...localHistory];
          backendLogs.forEach(b => {
            if (!mergedHistory.some(m => m.id === b.id || (m.date === b.date && m.nik === b.nik))) {
              mergedHistory.push(b);
            }
          });
          setAttendanceLogs(mergedHistory);
        } catch (err) {
          console.error('Failed to fetch attendance history:', err);
          const localHistory = JSON.parse(localStorage.getItem('hris_attendances_history') || '[]');
          setAttendanceLogs(localHistory);
        }

        // --- 3. OTHER MODULES (API Calls with Graceful Degradation) ---
        const fetchAPI = async (endpoint) => {
          try {
            const res = await fetch(`${API_URL}/${endpoint}`, { headers });
            const data = await res.json();
            return data.status === 'success' ? data.data : [];
          } catch (e) {
            console.error(`Error fetching ${endpoint}:`, e);
            return [];
          }
        };

        const [
          leavesData,
          payrollData,
          outletsData,
          revenuesData,
          sopsData,
          docsData,
          kpisData,
          sanctionsData,
          trainingsData,
          policiesData
        ] = await Promise.all([
          fetchAPI('leaves'),
          fetchAPI('payroll'),
          fetchAPI('outlets'),
          fetchAPI('outlets/revenues'),
          fetchAPI('sops'),
          fetchAPI('documentations'),
          fetchAPI('kpis'),
          fetchAPI('sanctions'),
          fetchAPI('trainings'),
          fetchAPI('policies')
        ]);

        setLeaves(leavesData);
        let localPayrollData = [];
        try {
          const rawPayroll = localStorage.getItem('hris_payroll_slips');
          if (rawPayroll) localPayrollData = JSON.parse(rawPayroll);
        } catch (e) {}
        setPayroll(localPayrollData.length > 0 ? localPayrollData : payrollData);
        setOutlets(outletsData);
        setRevenues(revenuesData);
        setSops(sopsData);
        setDocumentations(docsData);
        setKpis(kpisData);
        setSanctions(sanctionsData);
        setTrainings(trainingsData);
        setPolicies(policiesData);

        setLoading(false);
      } catch (err) {
        console.error('Dashboard boot error:', err);
        setLoading(false);
      }
    }

    fetchAllData();
  }, [token, API_URL]);

  // ─── Reactive: Sinkronisasi dari HRISContext ke Dashboard State ──────────────
  // Karyawan: Update donut chart saat ada karyawan baru/dihapus dari modul Karyawan
  useEffect(() => {
    if (Array.isArray(ctxEmployees) && ctxEmployees.length > 0) {
      setEmployees(ctxEmployees);
    }
  }, [ctxEmployees]);

  // Revenue Harian: Update blok omzet saat input baru dari OmzetCabang
  useEffect(() => {
    if (Array.isArray(ctxDailyRevenue) && ctxDailyRevenue.length > 0) {
      // Map daily_revenue_logs format ke format yang digunakan Dashboard
      setRevenues(ctxDailyRevenue);
    }
  }, [ctxDailyRevenue]);

  // Utility to check access authorization dynamically
  const hasPermission = (tabId) => {
    if (!userPermissions) return true;
    if (tabId === 'user') {
      return userPermissions.settings?.can_view === 1 || userPermissions.employees?.can_view === 1;
    }
    return userPermissions[tabId]?.can_view === 1;
  };

  if (loading) {
    return (
      <div className="spinner-container" style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div className="loading-spinner"></div>
        <p className="loading-text" style={{ marginTop: '16px', fontWeight: 600, color: 'var(--text-muted)' }}>MEMPROSES METRIK DASBOR...</p>
      </div>
    );
  }

  // --- STATISTICS CALCULATIONS ---
  // Helper to check if a slip falls in date range
  const isSlipInDateRange = (slip, start, end) => {
    const sYear = parseInt(slip.tahun);
    const sMonth = parseInt(slip.bulan);
    if (isNaN(sYear) || isNaN(sMonth)) return true;

    const startParts = start.split('-');
    const endParts = end.split('-');
    if (startParts.length !== 3 || endParts.length !== 3) return true;

    const startY = parseInt(startParts[0]);
    const startM = parseInt(startParts[1]);
    const endY = parseInt(endParts[0]);
    const endM = parseInt(endParts[1]);

    const slipAbs = sYear * 12 + sMonth;
    const startAbs = startY * 12 + startM;
    const endAbs = endY * 12 + endM;

    return slipAbs >= startAbs && slipAbs <= endAbs;
  };

  const isSlipInOutlets = (slip, selectedList) => {
    const slipOutlet = (slip.outlet || '').trim().toUpperCase();
    return selectedList.some(so => so.trim().toUpperCase() === slipOutlet);
  };

  // Filtered Datasets
  const filteredEmployees = employees.filter(emp => {
    if (emp.employee_status === 'inactive' || emp.status === 'inactive') return false;
    const empOutlet = (emp.outlet || '').trim().toUpperCase();
    return selectedOutlets.some(so => so.trim().toUpperCase() === empOutlet);
  });

  const filteredRealtimeLogs = realtimeLogs.filter(log => {
    const logOutlet = (log.outlet || '').trim().toUpperCase();
    const isOutletSelected = selectedOutlets.some(so => so.trim().toUpperCase() === logOutlet);
    const isWithinDate = log.date && log.date >= startDate && log.date <= endDate;
    return isOutletSelected && isWithinDate;
  });

  const filteredAttendanceLogs = attendanceLogs.filter(log => {
    const logOutlet = (log.outlet || '').trim().toUpperCase();
    const isOutletSelected = selectedOutlets.some(so => so.trim().toUpperCase() === logOutlet);
    const isWithinDateRange = log.date && log.date >= startDate && log.date <= endDate;
    return isOutletSelected && isWithinDateRange;
  });

  const filteredPayroll = payroll.filter(p => 
    isSlipInOutlets(p, selectedOutlets) && isSlipInDateRange(p, startDate, endDate)
  );

  const filteredRevenues = revenues.filter(r => {
    const oName = (r.nama_outlet || '').trim().toUpperCase();
    const isOutletSelected = selectedOutlets.some(so => so.trim().toUpperCase() === oName);
    const isWithinDateRange = r.tanggal && r.tanggal >= startDate && r.tanggal <= endDate;
    return isOutletSelected && isWithinDateRange;
  });

  // SDM
  const totalEmployees = filteredEmployees.length;
  const contractEmployees = filteredEmployees.filter(e => (e.employee_status || '').toLowerCase().includes('kontrak')).length;
  const permanentEmployees = filteredEmployees.filter(e => (e.employee_status || '').toLowerCase().includes('tetap')).length;
  const transferEmployees = filteredEmployees.filter(e => {
    const st = (e.employee_status || '').toLowerCase();
    return st.includes('transfer') || st.includes('magang') || st.includes('harian') || st.includes('percobaan');
  }).length;

  // Akun Kredensial
  const totalAccounts = userAccounts.filter(a => {
    const aOutlet = (a.outlet || '').trim().toUpperCase();
    return selectedOutlets.some(so => so.trim().toUpperCase() === aOutlet);
  }).length;
  const ownerCount = userAccounts.filter(a => {
    const aOutlet = (a.outlet || '').trim().toUpperCase();
    const isOwner = (a.position || '').toLowerCase() === 'owner';
    return isOwner && selectedOutlets.some(so => so.trim().toUpperCase() === aOutlet);
  }).length;
  const adminCount = userAccounts.filter(a => {
    const aOutlet = (a.outlet || '').trim().toUpperCase();
    const pos = (a.position || '').toLowerCase();
    const isAdmin = pos === 'admin' || pos === 'master' || pos === 'kepala cabang';
    return isAdmin && selectedOutlets.some(so => so.trim().toUpperCase() === aOutlet);
  }).length;
const employeeCount = Math.max(0, totalAccounts - ownerCount - adminCount);

  // Absensi Hari Ini / Filtered Realtime Logs
  const hadirCount = filteredRealtimeLogs.filter(l => ['hadir', 'ontime', 'terlambat', 'tepat waktu'].includes((l.status || '').toLowerCase())).length;
  const ontimeCount = filteredRealtimeLogs.filter(l => ['ontime', 'tepat waktu'].includes((l.status || '').toLowerCase())).length;
  const terlambatCount = filteredRealtimeLogs.filter(l => ['terlambat', 'late'].includes((l.status || '').toLowerCase())).length;
  const alphaCount = Math.max(0, totalEmployees - hadirCount);

  // Cuti
  const filteredLeaves = leaves.filter(l => {
    const lOutlet = (l.outlet || '').trim().toUpperCase();
    return selectedOutlets.some(so => so.trim().toUpperCase() === lOutlet);
  });
  const totalLeaves = filteredLeaves.length;
  const pendingLeaves = filteredLeaves.filter(l => (l.status || '').toLowerCase() === 'pending').length;
  const approvedLeaves = filteredLeaves.filter(l => ['approved', 'disetujui', 'diterima'].includes((l.status || '').toLowerCase())).length;
  const rejectedLeaves = filteredLeaves.filter(l => ['rejected', 'ditolak'].includes((l.status || '').toLowerCase())).length;

  // Sanksi
  const filteredSanctions = sanctions.filter(s => {
    const sOutlet = (s.outlet || '').trim().toUpperCase();
    return selectedOutlets.some(so => so.trim().toUpperCase() === sOutlet);
  });

  // Payroll slips summary counts
  const totalPayrollBudget = filteredPayroll.reduce((sum, p) => sum + (parseFloat(p.net_salary) || 0), 0);
  const paidPayrollCount = filteredPayroll.filter(p => ['paid', 'lunas', 'sudah dibayar'].includes((p.payment_status || '').toLowerCase())).length;
  const unpaidPayrollCount = filteredPayroll.filter(p => ['unpaid', 'pending', 'belum dibayar'].includes((p.payment_status || '').toLowerCase())).length;
  const totalPayrolls = filteredPayroll.length;

  // Omzet Toko
  let grandTotalOmzet = 0;
  if (revenues && revenues.length > 0) {
    grandTotalOmzet = filteredRevenues.reduce((sum, r) => sum + (parseFloat(r.jumlah_omzet) || 0), 0);
  } else {
    // Fallback mock omzet
    const startParts = startDate.split('-');
    const endParts = endDate.split('-');
    if (startParts.length === 3 && endParts.length === 3) {
      const startY = parseInt(startParts[0]);
      const startM = parseInt(startParts[1]);
      const endY = parseInt(endParts[0]);
      const endM = parseInt(endParts[1]);

      const activeSelectedOutlets = Object.keys(MOCK_OMZET_TRENDS).filter(key => 
        selectedOutlets.some(so => so.trim().toUpperCase() === key.trim().toUpperCase())
      );

      activeSelectedOutlets.forEach(ot => {
        const trend = MOCK_OMZET_TRENDS[ot] || [0, 0, 0, 0, 0, 0];
        trend.forEach((val, idx) => {
          const m = idx + 1;
          const absMonth = 2026 * 12 + m;
          const absStart = startY * 12 + startM;
          const absEnd = endY * 12 + endM;
          if (absMonth >= absStart && absMonth <= absEnd) {
            grandTotalOmzet += val;
          }
        });
      });
    }
  }
  const avgOmzet = filteredRevenues.length > 0 ? Math.round(grandTotalOmzet / filteredRevenues.length) : 0;
  const totalRevenueTransactions = filteredRevenues.length;
  const maxOmzet = filteredRevenues.length > 0 ? Math.max(...filteredRevenues.map(r => parseFloat(r.jumlah_omzet) || 0)) : 0;

  // Outlet
  const totalOutlets = outlets.length;
  const activeOutlets = outlets.filter(o => ['active', 'aktif'].includes((o.status || '').toLowerCase())).length;
  const investorOutlets = outlets.filter(o => (o.permodalan || '').toLowerCase() === 'investor').length;
  const bootstrapOutlets = outlets.filter(o => (o.permodalan || '').toLowerCase() === 'bootstrap').length;

  // Kebijakan
  const totalPolicies = policies.length;
  const activePolicies = policies.filter(p => !p.status || (p.status || '').toLowerCase() === 'aktif').length;
  const branchSpecificPolicies = policies.filter(p => p.hanya_outlet_terpilih === 1).length;
  const globalPolicies = policies.filter(p => p.hanya_outlet_terpilih !== 1).length;

  // SOP
  const totalSops = sops.length;
  const uniqueSopPositions = [...new Set(sops.map(s => s.jabatan_terkait).filter(Boolean))].length;
  const totalDocumentations = documentations.length;
  const activeDocumentations = documentations.filter(d => (d.status || '').toLowerCase() === 'aktif').length;



  // Pelatihan
  const totalTrainings = trainings.length;
  const runningTrainings = trainings.filter(t => (t.status || '').toLowerCase() === 'berjalan').length;
  const upcomingTrainings = trainings.filter(t => (t.status || '').toLowerCase() === 'mendatang').length;
  const finishedTrainings = trainings.filter(t => (t.status || '').toLowerCase() === 'selesai').length;

  // KPI
  const totalKpis = kpis.length;
  const totalKpiScore = kpis.reduce((sum, k) => sum + (parseFloat(k.skor_kpi) || 0), 0);
  const avgKpiScore = totalKpis > 0 ? Math.round(totalKpiScore / totalKpis) : 0;
  const goodKpiCount = kpis.filter(k => (parseFloat(k.skor_kpi) || 0) >= 85).length;
  const lowKpiCount = kpis.filter(k => (parseFloat(k.skor_kpi) || 0) < 70).length;

  // Sanksi
  const totalSanctions = sanctions.length;
  const activeSanctionsCount = sanctions.filter(s => (s.status || '').toLowerCase() === 'aktif').length;
  const resolvedSanctionsCount = sanctions.filter(s => (s.status || '').toLowerCase() === 'selesai').length;
  const spSanctionsCount = sanctions.filter(s => (s.tipe_sanksi || '').toLowerCase().startsWith('sp')).length;



  // Currency & format helpers
  const formatCurrency = (val) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
  };

  const formatCompactCurrency = (value) => {
    if (value >= 1000000000) {
      return 'Rp ' + (value / 1000000000).toFixed(1).replace(/\.0$/, '') + ' M';
    }
    if (value >= 1000000) {
      return 'Rp ' + (value / 1000000).toFixed(1).replace(/\.0$/, '') + ' Jt';
    }
    if (value >= 1000) {
      return 'Rp ' + (value / 1000).toFixed(0) + ' Rb';
    }
    return 'Rp ' + value;
  };

  // --- SEKTOR 1: SEKTOR KARYAWAN CALCULATIONS ---
  const JABATAN_OFFICIAL = [
    'Kepala Cabang', 'Supervisor', 'Kepala Produksi', 'Koki', 'Helper',
    'Kepala Pelayanan', 'Kasir', 'Waiters', 'Admin'
  ];
  const roleCounts = {};
  JABATAN_OFFICIAL.forEach(r => { roleCounts[r] = 0; });
  roleCounts['Lainnya'] = 0;
  filteredEmployees.forEach(emp => {
    const job = (emp.position || emp.jabatan || '').trim();
    const match = JABATAN_OFFICIAL.find(r => r.toLowerCase() === job.toLowerCase());
    if (match) roleCounts[match]++;
    else roleCounts['Lainnya']++;
  });
  const roleChartData = Object.entries(roleCounts).map(([label, value], i) => {
    const chartColors = [
      '#00ADB5', '#00D8FF', '#33c2cc', 'var(--accent-primary)', '#B331F1',
      '#FF97D0', 'var(--accent-primary)', '#cbd5b8', '#867ae9', '#94a3b8'
    ];
    return { label, value, color: chartColors[i % chartColors.length] };
  });

  let priaCount = 0;
  let wanitaCount = 0;
  filteredEmployees.forEach(emp => {
    const g = (emp.gender || emp.jenis_kelamin || '').toLowerCase();
    if (g.startsWith('pria') || g.startsWith('laki') || g === 'l') priaCount++;
    else if (g.startsWith('wanita') || g.startsWith('perempuan') || g === 'p') wanitaCount++;
    else priaCount++;
  });
  const genderChartData = [
    { label: 'Pria', value: priaCount, color: '#00ADB5' },
    { label: 'Wanita', value: wanitaCount, color: '#FF97D0' }
  ];

  let tenureUnder1 = 0;
  let tenure1to2 = 0;
  let tenureOver2 = 0;
  filteredEmployees.forEach(emp => {
    const dateStr = emp.start_working_date || emp.joined_date;
    if (!dateStr) {
      tenureUnder1++;
      return;
    }
    try {
      const start = new Date(dateStr);
      const now = new Date();
      const diffYears = (now - start) / (1000 * 60 * 60 * 24 * 365.25);
      if (diffYears < 1) tenureUnder1++;
      else if (diffYears <= 2) tenure1to2++;
      else tenureOver2++;
    } catch {
      tenureUnder1++;
    }
  });
  const tenureChartData = [
    { label: '< 1 Tahun', value: tenureUnder1, color: 'var(--accent-primary)' },
    { label: '1-2 Tahun', value: tenure1to2, color: '#00D8FF' },
    { label: '> 2 Tahun', value: tenureOver2, color: '#00ADB5' }
  ];

  const rawOutlets = localStorage.getItem('outlet_cabang_data');
  const outletList = rawOutlets ? JSON.parse(rawOutlets) : [];
  const cachedStafTargets = JSON.parse(localStorage.getItem('target_staf_data') || '[]');
  
  // Filter staff target comparison table only for selected outlets
  const staffComparisonList = outletList
    .filter(o => selectedOutlets.some(so => so.trim().toUpperCase() === (o.nama_tablet || '').trim().toUpperCase()))
    .map(o => {
      const actual = filteredEmployees.filter(e => {
        const eOutlet = (e.outlet || '').trim().toUpperCase();
        const oTablet = (o.nama_tablet || '').trim().toUpperCase();
        return eOutlet === oTablet;
      }).length;

      // Extract Month and Year from date range
      const endParts = endDate.split('-');
      const targetMonthIndo = (() => {
        const m = parseInt(endParts[1]);
        const BULAN_INDO = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        return BULAN_INDO[m - 1] || 'Juni';
      })();
      const targetYearStr = endParts[0] || '2026';

      const targetEntry = cachedStafTargets.find(t => 
        (t.outlet_name || '').trim().toUpperCase() === (o.nama_tablet || '').trim().toUpperCase() &&
        t.bulan === targetMonthIndo &&
        t.tahun === targetYearStr
      );
      const target = targetEntry ? parseInt(targetEntry.target_staf) : 0;
      return {
        outletName: o.nama_tablet,
        actual,
        target,
      };
    });

  // --- SEKTOR 2: SEKTOR OMZET CALCULATIONS ---

  const getOmzetTrendData = () => {
    const activeSelectedOutlets = outletList
      .map(o => o.nama_tablet)
      .filter(Boolean)
      .filter(name => selectedOutlets.some(so => so.trim().toUpperCase() === name.trim().toUpperCase()));

    const grouped = {};
    activeSelectedOutlets.forEach(name => {
      grouped[name] = [0, 0, 0, 0, 0, 0];
    });

    if (revenues && revenues.length > 0) {
      filteredRevenues.forEach(r => {
        const oName = (r.nama_outlet || '').trim().toUpperCase();
        if (grouped[oName] && r.tanggal) {
          const parts = r.tanggal.split('-');
          if (parts.length === 3) {
            const y = parseInt(parts[0]);
            const m = parseInt(parts[1]);
            if (y === 2026 && m >= 1 && m <= 6) {
              grouped[oName][m - 1] += parseFloat(r.jumlah_omzet) || 0;
            }
          }
        }
      });
      return grouped;
    }

    // Mock trend filter
    const startParts = startDate.split('-');
    const endParts = endDate.split('-');
    const startY = parseInt(startParts[0]);
    const startM = parseInt(startParts[1]);
    const endY = parseInt(endParts[0]);
    const endM = parseInt(endParts[1]);

    const mockFiltered = {};
    activeSelectedOutlets.forEach(ot => {
      const trend = MOCK_OMZET_TRENDS[ot] || [0, 0, 0, 0, 0, 0];
      mockFiltered[ot] = trend.map((val, idx) => {
        const m = idx + 1; // Jan = 1, Jun = 6
        const absMonth = 2026 * 12 + m;
        const absStart = startY * 12 + startM;
        const absEnd = endY * 12 + endM;
        return (absMonth >= absStart && absMonth <= absEnd) ? val : 0;
      });
    });

    return mockFiltered;
  };

  // --- SEKTOR 3: SEKTOR LOG KEHADIRAN CALCULATIONS ---
  const monthLogs = filteredAttendanceLogs;
  const totalMonthLogs = monthLogs.length;
  const monthHadir = monthLogs.filter(log => log.status === 'Hadir' || log.status === 'Terlambat' || log.status === 'Tepat Waktu' || log.status === 'Ontime' || String(log.status).toLowerCase().includes('time')).length;
  const monthLate = monthLogs.filter(log => log.status === 'Terlambat' || String(log.status).toLowerCase().includes('late')).length;
  const averageAttendanceRate = totalMonthLogs > 0 ? Math.round((monthHadir / totalMonthLogs) * 100) : 94;
  const totalLateCases = monthLate;

  // --- SEKTOR 4: SEKTOR PAYROLL CALCULATIONS ---
  const totalGajiTerbayar = filteredPayroll.reduce((sum, p) => sum + (parseFloat(p.thp) || parseFloat(p.net_salary) || 0), 0);
  const totalKasbonAktif = filteredPayroll.reduce((sum, p) => {
    const d = p.deduction || {};
    return sum + (parseFloat(d.kasbon) || 0);
  }, 0);
  const totalPengeluaranOperasional = filteredPayroll.reduce((sum, p) => sum + (parseFloat(p.total_pendapatan) || parseFloat(p.gross_salary) || 0), 0);
  const totalPendapatanBersih = grandTotalOmzet - totalPengeluaranOperasional;

  // --- SEKTOR 5: PERFORMANCE CALCULATIONS ---
  const getLeaderboardData = () => {
    const attLogs = filteredAttendanceLogs;
    
    // Parse kuis results in range
    const quizRes = JSON.parse(localStorage.getItem('quiz_results') || '[]').filter(q => {
      const dateStr = q.tanggal_selesai || q.date;
      if (!dateStr) return false;
      const cleanDate = dateStr.slice(0, 10);
      return cleanDate >= startDate && cleanDate <= endDate;
    });

    // Parse training scores in range
    const trainingRes = JSON.parse(localStorage.getItem('hris_training_kpi_scores') || '[]').filter(t => {
      const dateStr = t.updated_at || t.created_at || t.date;
      if (!dateStr) return false;
      const cleanDate = dateStr.slice(0, 10);
      return cleanDate >= startDate && cleanDate <= endDate;
    });

    // Parse survey ratings in range
    const surveyData = JSON.parse(localStorage.getItem('survey_360_data') || '[]').filter(s => {
      const dateStr = s.date;
      if (!dateStr) return true;
      const cleanDate = dateStr.slice(0, 10);
      return cleanDate >= startDate && cleanDate <= endDate;
    });
    
    const rankings = filteredEmployees.map(emp => {
      const employeeId = emp.id || emp.employee_id;
      const outletName = emp.outlet || '';

      // 1. Kehadiran (25%)
      const outletLogs = attLogs.filter(log => log.outlet === outletName);
      const uniqueDates = [...new Set(outletLogs.map(log => log.date))];
      const totalWorkingDays = uniqueDates.length > 0 ? uniqueDates.length : 25;
      const empLogs = attLogs.filter(log => log.employee_id === employeeId || log.nik === emp.nik);
      const presentDays = empLogs.filter(log => log.status === 'Hadir' || log.status === 'Terlambat' || log.status === 'Tepat Waktu' || log.status === 'Ontime' || log.status === 'Hadir (GPS)').length;
      const attendancePct = totalWorkingDays > 0 ? Math.min(100, Math.round((presentDays / totalWorkingDays) * 100)) : 0;
      const scoreKehadiran = attendancePct * 0.25;

      // 2. Disiplin (25%)
      const lateDays = empLogs.filter(log => log.status === 'Terlambat' || log.status_in === 'late' || (log.notes && /terlambat|late/i.test(log.notes))).length;
      const disiplinPct = presentDays > 0 ? Math.max(0, Math.round(100 - (lateDays / presentDays) * 100)) : 100;
      const scoreDisiplin = disiplinPct * 0.25;

      // 3. Survei 360 (30%)
      const empSurveys = surveyData.filter(s => String(s.target_id || s.employee_id) === String(employeeId));
      const surveyPct = empSurveys.length > 0
        ? Math.round(empSurveys.reduce((sum, s) => sum + (s.score || 0), 0) / empSurveys.length)
        : 75;
      const scoreSurvey = surveyPct * 0.30;

      // 4. Training (10%)
      const empTrainings = trainingRes.filter(t => String(t.employee_id) === String(employeeId));
      const trainingPct = empTrainings.length > 0
        ? Math.round(empTrainings.reduce((sum, t) => sum + (t.score || 0), 0) / empTrainings.length)
        : 80;
      const scoreTraining = trainingPct * 0.10;

      // 5. Kuis (10%)
      const empQuizzes = quizRes.filter(q => String(q.employee_id) === String(employeeId));
      const quizPct = empQuizzes.length > 0
        ? Math.round(empQuizzes.reduce((sum, q) => sum + (q.skor || q.score || 0), 0) / empQuizzes.length)
        : 80;
      const scoreKuis = quizPct * 0.10;

      const totalKpi = Math.round((scoreKehadiran + scoreDisiplin + scoreSurvey + scoreTraining + scoreKuis) * 10) / 10;

      return {
        name: emp.full_name || emp.nama || 'Karyawan',
        position: emp.position || emp.jabatan || '-',
        totalKpi,
      };
    });

    return rankings.sort((a, b) => b.totalKpi - a.totalKpi);
  };
  const leaderboardData = getLeaderboardData();

  return (
    <div className="interactive-dashboard-wrapper animate-fade-in">
      <style>{`
        .interactive-dashboard-wrapper {
          padding: 24px;
          margin: -24px;
          box-sizing: border-box;
        }

        .dashboard-header-container {
          background: var(--bg-surface);
          color: var(--text-main);
          padding: 24px 30px;
          border-radius: 18px;
          margin-bottom: 30px;
          box-shadow: var(--shadow-lg);
          display: flex;
          justify-content: space-between;
          align-items: center;
          position: relative;
          overflow: hidden;
          border: 1px solid var(--accent-primary);
        }

        .dashboard-header-container::before {
          content: "";
          position: absolute;
          top: -60px;
          right: -60px;
          width: 180px;
          height: 180px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(65, 45, 21, 0.6) 0%, transparent 70%);
          pointer-events: none;
        }

        .dashboard-header-left h2 {
          font-size: 1.45rem;
          font-weight: 800;
          letter-spacing: 0.5px;
          background: linear-gradient(to right, var(--text-main), #c8c3aa);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 6px;
        }

        .dashboard-header-left p {
          font-size: 0.82rem;
          color: var(--text-muted);
        }

        .category-container {
          background: var(--bg-surface);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border: 1px solid var(--accent-primary);
          border-radius: 20px;
          padding: 24px;
          margin-bottom: 28px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
        }

        .category-title-wrap {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
          border-left: 4px solid var(--theme-color, var(--primary-solid));
          padding-left: 12px;
        }

        .category-title {
          font-size: 0.95rem;
          font-weight: 800;
          color: var(--text-dark);
          letter-spacing: 0.75px;
          text-transform: uppercase;
        }

        .module-block {
          background: rgba(65, 45, 21, 0.3);
          border: 1px dashed rgba(165, 182, 141, 0.2);
          border-radius: 16px;
          padding: 18px;
          margin-bottom: 16px;
        }

        .module-block:last-child {
          margin-bottom: 0;
        }

        .module-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 14px;
          padding-bottom: 8px;
          border-bottom: 1px solid rgba(65, 45, 21, 0.4);
        }

        .module-name {
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--text-dark);
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .module-shortcut {
          font-size: 0.68rem;
          color: var(--theme-color, var(--primary-solid));
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 2px;
          cursor: pointer;
          opacity: 0.85;
          transition: var(--transition-smooth);
        }

        .module-shortcut:hover {
          opacity: 1;
          transform: translateX(2px);
        }

        .cards-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }

        @media (max-width: 1200px) {
          .cards-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 600px) {
          .cards-grid {
            grid-template-columns: 1fr;
          }
        }

        .interactive-card {
          background: rgba(57, 62, 70, 0.8);
          border: 1px solid var(--accent-primary);
          border-radius: 12px;
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: 105px;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          position: relative;
          overflow: hidden;
        }

        .interactive-card:hover {
          transform: translateY(-5px);
          border-color: var(--theme-color);
          background: rgba(65, 45, 21, 0.7);
          box-shadow: 0 10px 20px -8px var(--theme-glow), 0 0 10px rgba(65, 45, 21, 0.5);
        }

        .card-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 8px;
        }

        .card-label {
          font-size: 0.62rem;
          font-weight: 800;
          color: var(--text-main);
          letter-spacing: 0.25px;
          text-transform: uppercase;
        }

        .card-icon-container {
          width: 26px;
          height: 26px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: var(--theme-glow);
          color: var(--theme-color);
        }

        .card-value {
          font-size: 1.25rem;
          font-weight: 800;
          color: var(--text-dark);
          line-height: 1.1;
        }

        .card-footer {
          font-size: 0.58rem;
          font-weight: 700;
          color: var(--text-muted);
          margin-top: 6px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        /* Micro-Sparkline SVG style */
        .card-spark {
          display: inline-flex;
          align-items: center;
        }

        /* Pulse Dot Indicator for Realtime Metrics */
        .pulse-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background-color: var(--theme-color);
          box-shadow: 0 0 0 0 var(--theme-color);
          animation: pulse 1.6s infinite;
        }

        @keyframes pulse {
          0% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(var(--pulse-color-rgb), 0.7);
          }
          70% {
            transform: scale(1);
            box-shadow: 0 0 0 4px rgba(var(--pulse-color-rgb), 0);
          }
          100% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(var(--pulse-color-rgb), 0);
          }
        }
        .sector-grid-2col {
          display: grid;
          grid-template-columns: 1fr;
          gap: 24px;
        }
        @media (min-width: 1024px) {
          .sector-grid-2col {
            grid-template-columns: 1.25fr 0.75fr;
          }
        }
      `}</style>



      {/* Hero Header */}
      <div className="dashboard-header-container">
        <div className="dashboard-header-left">
          <h2>DASHBOARD METRIK UTAMA & KPI SISTEM</h2>
          <p>Kompilasi ringkasan visual interaktif dari setiap halaman modul operasional dan administratif HRIS Anda.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={clearDashboardTrash}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#fca5a5',
              borderRadius: '10px',
              padding: '10px 18px',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              position: 'relative',
              zIndex: 2,
              flexShrink: 0
            }}
          >
            <RotateCcw size={16} />
            <span>RESET DASBOR</span>
          </button>

          <button
            id="dashboard-filter-btn"
            onClick={() => setShowFilterPanel(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: showFilterPanel ? 'rgba(255,98,188,0.25)' : 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,98,188,0.45)',
              color: 'var(--bg-surface)',
              borderRadius: '10px',
              padding: '10px 18px',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              position: 'relative',
              zIndex: 2,
              flexShrink: 0
            }}
          >
            <SlidersHorizontal size={16} />
            <span>FILTER TAMPILAN</span>
            {hiddenCount > 0 && (
              <span style={{
                background: '#ff62bc', color: '#fff', borderRadius: '50%',
                width: '18px', height: '18px', fontSize: '0.6rem', fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'absolute', top: '-7px', right: '-7px'
              }}>
                {hiddenCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ─── MAIN CONTROL MULTI-FILTER ENGINE ─── */}
      <div style={{
        background: 'rgba(57, 62, 70, 0.7)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid var(--accent-primary)',
        borderRadius: '16px',
        padding: '20px 24px',
        marginBottom: '24px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '20px'
      }}>
        {/* Left Section: Controls */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '24px', flex: 1 }}>
          
          {/* Date Range Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Dari Tanggal</span>
              <input
                type="date"
                value={uiStartDate}
                onChange={(e) => {
                  setUiStartDate(e.target.value);
                }}
                className="filter-date-input"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--accent-primary)',
                  color: 'var(--text-main)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--text-main)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--accent-primary)'}
              />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sampai Tanggal</span>
              <input
                type="date"
                value={uiEndDate}
                onChange={(e) => {
                  setUiEndDate(e.target.value);
                }}
                className="filter-date-input"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--accent-primary)',
                  color: 'var(--text-main)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--text-main)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--accent-primary)'}
              />
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: '1px', height: '32px', backgroundColor: 'var(--accent-primary)', display: 'inline-block' }} />

          {/* Multi-Select Dropdown Container */}
          <div id="outlet-filter-dropdown-container" style={{ position: 'relative', minWidth: '220px' }}>
            <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Filter Outlet Cabang</span>
            <button
              onClick={() => setIsOutletDropdownOpen(!isOutletDropdownOpen)}
              style={{
                width: '100%',
                background: 'var(--bg-surface)',
                border: '1px solid var(--accent-primary)',
                color: 'var(--text-main)',
                borderRadius: '8px',
                padding: '9px 12px',
                fontSize: '0.8rem',
                fontWeight: 700,
                textAlign: 'left',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <span>
                {uiSelectedOutlets.length === 0
                  ? 'Tidak Ada Cabang'
                  : uiSelectedOutlets.length === getActiveOutletsList().length
                    ? 'Semua Outlet Terpilih'
                    : `${uiSelectedOutlets.length} Cabang Terpilih`}
              </span>
              <SlidersHorizontal size={14} style={{ color: 'var(--text-muted)' }} />
            </button>

            {isOutletDropdownOpen && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                right: 0,
                background: 'var(--bg-card)',
                border: '1px solid var(--accent-primary)',
                borderRadius: '10px',
                padding: '12px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.6)',
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                maxHeight: '220px',
                overflowY: 'auto'
              }}>
                {/* Select All */}
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', padding: '4px 0', borderBottom: '1px solid rgba(165, 182, 141, 0.06)' }}>
                  <input
                    type="checkbox"
                    checked={uiSelectedOutlets.length === getActiveOutletsList().length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setUiSelectedOutlets(getActiveOutletsList());
                      } else {
                        setUiSelectedOutlets([]);
                      }
                    }}
                    style={{ accentColor: 'var(--text-main)' }}
                  />
                  <span>Pilih Semua Outlet</span>
                </label>

                {/* Individual Outlets */}
                {getActiveOutletsList().map((name) => (
                  <label key={name} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', cursor: 'pointer', padding: '2px 0' }}>
                    <input
                      type="checkbox"
                      checked={uiSelectedOutlets.includes(name)}
                      onChange={(e) => {
                        let updated;
                        if (e.target.checked) {
                          updated = [...uiSelectedOutlets, name];
                        } else {
                          updated = uiSelectedOutlets.filter(item => item !== name);
                        }
                        setUiSelectedOutlets(updated);
                      }}
                      style={{ accentColor: 'var(--text-main)' }}
                    />
                    <span style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                      {name.replace('AYAM PECAK 2001 SEAFOOD ', '').replace('PECEL LELE ', '')}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Right Section: Saring & Reset Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            id="global-pdf-btn"
            onClick={handleExportPDF}
            style={{
              backgroundColor: '#000000',
              color: '#ffffff',
              fontWeight: 'bold',
              borderRadius: '6px',
              padding: '10px 16px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.8rem',
              transition: 'transform 0.1s ease',
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.03)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            📥 Download Laporan PDF
          </button>
          <button
            onClick={() => setShowConfirmSaring(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'var(--accent-primary)',
              border: 'none',
              color: '#fff',
              borderRadius: '10px',
              padding: '10px 18px',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              outline: 'none'
            }}
            onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
            onMouseLeave={(e) => e.currentTarget.style.filter = 'none'}
          >
            <span>🔍 Saring</span>
          </button>
          
          <button
            onClick={() => setShowConfirmReset(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(165, 182, 141, 0.08)',
              border: '1px solid var(--accent-primary)',
              color: 'var(--text-main)',
              borderRadius: '10px',
              padding: '10px 18px',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              outline: 'none'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(165, 182, 141, 0.12)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(165, 182, 141, 0.08)'}
          >
            <span>🔄 Reset Filter</span>
          </button>
        </div>

      </div>

      {/* Selected Outlets Badges Panel */}
      {uiSelectedOutlets.length > 0 && uiSelectedOutlets.length < getActiveOutletsList().length && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          marginBottom: '24px',
          padding: '0 4px'
        }}>
          {uiSelectedOutlets.map(name => (
            <span key={name} style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'var(--text-main)',
              color: 'var(--bg-surface)',
              borderRadius: '6px',
              padding: '4px 10px',
              fontSize: '0.68rem',
              fontWeight: 800
            }}>
              <span>{name}</span>
              <span
                onClick={() => {
                  setUiSelectedOutlets(uiSelectedOutlets.filter(item => item !== name));
                }}
                style={{
                  cursor: 'pointer',
                  fontWeight: 900,
                  fontSize: '0.75rem',
                  lineHeight: 1,
                  padding: '0 2px'
                }}
              >
                &times;
              </span>
            </span>
          ))}
        </div>
      )}

      {/* ── FILTER PANEL ── */}
      {showFilterPanel && (
        <div id="dashboard-filter-panel" style={{
          background: 'rgba(255,255,255,0.7)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 98, 188, 0.25)',
          borderRadius: '18px',
          padding: '24px',
          marginBottom: '24px',
          boxShadow: '0 8px 32px rgba(13, 27, 62, 0.08)',
          animation: 'slideDown 0.25s ease-out'
        }}>
          <style>{`
            @keyframes slideDown {
              from { opacity: 0; transform: translateY(-12px); }
              to   { opacity: 1; transform: translateY(0); }
            }
            .filter-toggle-btn {
              display: flex; align-items: center; gap: 8px;
              background: rgba(255,255,255,0.8);
              border: 1px solid rgba(255, 152, 209, 0.35);
              border-radius: 8px;
              padding: 7px 13px;
              font-size: 0.72rem;
              font-weight: 700;
              cursor: pointer;
              transition: all 0.18s ease;
              color: var(--text-dark);
            }
            .filter-toggle-btn.active {
              background: var(--filter-color, #ff62bc);
              color: #fff;
              border-color: transparent;
              box-shadow: 0 3px 10px rgba(0,0,0,0.12);
            }
            .filter-toggle-btn:hover { transform: translateY(-1px); }
            .filter-group-label {
              font-size: 0.65rem;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.6px;
              color: var(--text-muted);
              margin-bottom: 8px;
              padding-left: 2px;
              border-left: 3px solid var(--filter-color, #ff62bc);
              padding-left: 8px;
            }
          `}</style>

          {/* Panel header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-dark)', margin: 0 }}>⚙️ Atur Tampilan Dashboard</h4>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>Pilih modul yang ingin ditampilkan. Preferensi disimpan otomatis.</p>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={selectAll}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#059669', borderRadius: '8px', padding: '7px 14px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
              >
                <Eye size={13} /> Tampilkan Semua
              </button>
              <button
                onClick={deselectAll}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(100,116,139,0.08)', border: '1px solid rgba(100,116,139,0.2)', color: 'var(--text-muted)', borderRadius: '8px', padding: '7px 14px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
              >
                <EyeOff size={13} /> Sembunyikan Semua
              </button>
              <button
                onClick={() => setShowFilterPanel(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Filter groups */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '20px' }}>

            {/* Grup 1 */}
            <div style={{ '--filter-color': '#ff62bc' }}>
              <div className="filter-group-label">1. SDM & Pengguna</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {[{ key: 'employees', label: '👷 Kelola Karyawan' }, { key: 'user', label: '🔑 Log & Hak Akses' }].map(({ key, label }) => (
                  <button key={key} className={`filter-toggle-btn${dashFilter[key] ? ' active' : ''}`} style={{ '--filter-color': '#ff62bc' }} onClick={() => toggleModule(key)}>
                    {dashFilter[key] ? <Eye size={13} /> : <EyeOff size={13} />} {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Grup 2 */}
            <div style={{ '--filter-color': '#b42df1' }}>
              <div className="filter-group-label">2. Operasional & Kehadiran</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {[{ key: 'attendances', label: '📅 Log Kehadiran' }, { key: 'leaves', label: '🏖️ Pengajuan Cuti & Izin' }].map(({ key, label }) => (
                  <button key={key} className={`filter-toggle-btn${dashFilter[key] ? ' active' : ''}`} style={{ '--filter-color': '#b42df1' }} onClick={() => toggleModule(key)}>
                    {dashFilter[key] ? <Eye size={13} /> : <EyeOff size={13} />} {label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ '--filter-color': '#ca8a04' }}>
              <div className="filter-group-label">3. Finansial & Omzet</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {[{ key: 'payroll', label: '💰 Payroll' }, { key: 'revenues', label: '📈 Omzet Cabang' }].map(({ key, label }) => (
                  <button key={key} className={`filter-toggle-btn${dashFilter[key] ? ' active' : ''}`} style={{ '--filter-color': '#ca8a04' }} onClick={() => toggleModule(key)}>
                    {dashFilter[key] ? <Eye size={13} /> : <EyeOff size={13} />} {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Grup 4 */}
            <div style={{ '--filter-color': '#0284c7' }}>
              <div className="filter-group-label">4. Cabang & Regulasi</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {[{ key: 'outlets', label: '🏪 Outlet Cabang' }, { key: 'policies', label: '📜 Kebijakan Perusahaan' }].map(({ key, label }) => (
                  <button key={key} className={`filter-toggle-btn${dashFilter[key] ? ' active' : ''}`} style={{ '--filter-color': '#0284c7' }} onClick={() => toggleModule(key)}>
                    {dashFilter[key] ? <Eye size={13} /> : <EyeOff size={13} />} {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Grup 5 */}
            <div style={{ '--filter-color': '#10b981' }}>
              <div className="filter-group-label">5. SOP & Pembelajaran</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {[
                  { key: 'sops', label: '📚 SOP & Prosedur' },
                  { key: 'trainings', label: '🎓 Program Pelatihan' }
                ].map(({ key, label }) => (
                  <button key={key} className={`filter-toggle-btn${dashFilter[key] ? ' active' : ''}`} style={{ '--filter-color': '#10b981' }} onClick={() => toggleModule(key)}>
                    {dashFilter[key] ? <Eye size={13} /> : <EyeOff size={13} />} {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Grup 6 */}
            <div style={{ '--filter-color': '#f43f5e' }}>
              <div className="filter-group-label">6. Kinerja & Disiplin</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {[{ key: 'kpis', label: '📊 Penilaian KPI' }, { key: 'sanctions', label: '⚠️ Sanksi & SP' }].map(({ key, label }) => (
                  <button key={key} className={`filter-toggle-btn${dashFilter[key] ? ' active' : ''}`} style={{ '--filter-color': '#f43f5e' }} onClick={() => toggleModule(key)}>
                    {dashFilter[key] ? <Eye size={13} /> : <EyeOff size={13} />} {label}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Footer badge */}
          {hiddenCount > 0 && (
            <div style={{ marginTop: '18px', padding: '10px 14px', background: 'rgba(255,98,188,0.08)', border: '1px solid rgba(255,98,188,0.2)', borderRadius: '8px', fontSize: '0.72rem', color: '#be185d', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <EyeOff size={14} />
              {hiddenCount} modul sedang disembunyikan dari dashboard. Klik tombol di atas untuk menampilkannya kembali.
            </div>
          )}
        </div>
      )}

        {isFilterLoading ? (
          <div className="spinner-container" style={{ minHeight: '50vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div className="loading-spinner" style={{ borderTopColor: 'var(--text-main)', boxShadow: '0 0 15px rgba(165, 182, 141, 0.15)' }}></div>
            <p className="loading-text" style={{ marginTop: '16px', fontWeight: 600, color: 'var(--text-muted)' }}>MENYARING DATA METRIK...</p>
          </div>
        ) : (
          <>
            {/* ════════════════════════════════════════════════════════════
                GLOBAL MACRO SUMMARY BAR — Command Center Lintas Modul
                Dikontrol penuh oleh filter Date Range + Outlet
            ════════════════════════════════════════════════════════════ */}
            {(() => {
              // ── Compute Macro Metrics dari semua data yang sudah ter-filter ──

              // [1] SDM: Karyawan Aktif
              const macroKaryawanAktif = filteredEmployees.length;

              // [2] SDM: Cuti Pending
              const macroCutiPending = filteredLeaves.filter(l =>
                (l.status || '').toLowerCase() === 'pending'
              ).length;

              // [3] Kehadiran: % Hadir hari ini (real-time logs)
              const todayStr = new Date().toISOString().split('T')[0];
              const todayRealtime = filteredRealtimeLogs.filter(l => (l.date || '').startsWith(todayStr));
              const todayHadir = todayRealtime.filter(l =>
                ['hadir', 'ontime', 'terlambat', 'tepat waktu', 'hadir (gps)'].includes((l.status || '').toLowerCase())
              ).length;
              const todayAlpha = filteredEmployees.length > 0
                ? Math.max(0, filteredEmployees.length - todayHadir)
                : 0;
              const macroHadirPct = filteredEmployees.length > 0
                ? Math.round((todayHadir / filteredEmployees.length) * 100)
                : 0;

              // [4] Finansial: Total Omzet Aktual
              const macroOmzetAktual = filteredRevenues.reduce((s, r) =>
                s + (parseFloat(r.jumlah_omzet) || parseFloat(r.amount) || 0), 0
              );

              // [5] Finansial: Total Gaji Terbayar (THP)
              const macroGajiTerbayar = filteredPayroll.reduce((s, p) =>
                s + (parseFloat(p.thp) || parseFloat(p.net_salary) || 0), 0
              );

              // [6] Finansial: Pendapatan Bersih (Omzet - Gaji Bruto)
              const macroGajiBruto = filteredPayroll.reduce((s, p) =>
                s + (parseFloat(p.total_pendapatan) || parseFloat(p.gross_salary) || 0), 0
              );
              const macroPendapatanBersih = macroOmzetAktual - macroGajiBruto;

              // [7] KPI: Rata-rata skor KPI dari leaderboard
              const macroLeaderboard = leaderboardData;
              const macroAvgKpi = macroLeaderboard.length > 0
                ? Math.round(macroLeaderboard.reduce((s, r) => s + r.totalKpi, 0) / macroLeaderboard.length)
                : 0;

              // [8] Training: Jadwal aktif
              const macroTrainingAktif = (() => {
                try {
                  const allT = JSON.parse(localStorage.getItem('hris_trainings') || '[]');
                  return allT.filter(t => (t.status || '').toLowerCase() === 'berjalan').length;
                } catch { return 0; }
              })();

              // [9] Sanksi: Aktif
              const macroSanksiAktif = filteredSanctions.filter(s =>
                (s.status || '').toLowerCase() === 'aktif'
              ).length;

              const fmt = (v) => {
                if (v >= 1_000_000_000) return `Rp ${(v / 1_000_000_000).toFixed(1)}M`;
                if (v >= 1_000_000) return `Rp ${(v / 1_000_000).toFixed(1)}Jt`;
                if (v >= 1_000) return `Rp ${(v / 1_000).toFixed(0)}Rb`;
                return `Rp ${v}`;
              };

              const macroCards = [
                {
                  id: 'karyawan-aktif',
                  label: 'Karyawan Aktif',
                  value: `${macroKaryawanAktif} Orang`,
                  sub: `${macroCutiPending} cuti pending`,
                  icon: '👷',
                  color: '#00ADB5',
                  glow: 'rgba(0,173,181,0.15)',
                  tabTarget: 'employees'
                },
                {
                  id: 'kehadiran-hari-ini',
                  label: 'Hadir Hari Ini',
                  value: `${macroHadirPct}%`,
                  sub: `${todayHadir} hadir · ${todayAlpha} alpha`,
                  icon: '📋',
                  color: macroHadirPct >= 80 ? '#2ecc71' : macroHadirPct >= 60 ? '#f39c12' : '#e74c3c',
                  glow: macroHadirPct >= 80 ? 'rgba(46,204,113,0.15)' : macroHadirPct >= 60 ? 'rgba(243,156,18,0.15)' : 'rgba(231,76,60,0.15)',
                  tabTarget: 'attendances'
                },
                {
                  id: 'total-omzet',
                  label: 'Total Omzet',
                  value: fmt(macroOmzetAktual),
                  sub: `Periode filter aktif`,
                  icon: '📈',
                  color: '#27ae60',
                  glow: 'rgba(39,174,96,0.15)',
                  tabTarget: 'revenues'
                },
                {
                  id: 'gaji-terbayar',
                  label: 'Gaji Terbayar (THP)',
                  value: fmt(macroGajiTerbayar),
                  sub: `${filteredPayroll.length} slip gaji`,
                  icon: '💰',
                  color: '#f39c12',
                  glow: 'rgba(243,156,18,0.15)',
                  tabTarget: 'payroll'
                },
                {
                  id: 'pendapatan-bersih',
                  label: 'Pendapatan Bersih',
                  value: fmt(Math.abs(macroPendapatanBersih)),
                  sub: macroPendapatanBersih >= 0 ? 'Surplus ✅' : 'Defisit ⚠️',
                  icon: '🏦',
                  color: macroPendapatanBersih >= 0 ? '#2ecc71' : '#e74c3c',
                  glow: macroPendapatanBersih >= 0 ? 'rgba(46,204,113,0.15)' : 'rgba(231,76,60,0.15)',
                  tabTarget: 'revenues'
                },
                {
                  id: 'avg-kpi',
                  label: 'Avg. Skor KPI',
                  value: `${macroAvgKpi} / 100`,
                  sub: macroAvgKpi >= 85 ? 'Performa ⭐ Sangat Baik' : macroAvgKpi >= 70 ? 'Performa Baik' : 'Perlu Perhatian',
                  icon: '🎯',
                  color: macroAvgKpi >= 85 ? '#2ecc71' : macroAvgKpi >= 70 ? '#f39c12' : '#e74c3c',
                  glow: macroAvgKpi >= 85 ? 'rgba(46,204,113,0.15)' : macroAvgKpi >= 70 ? 'rgba(243,156,18,0.15)' : 'rgba(231,76,60,0.15)',
                  tabTarget: 'kpis'
                },
                {
                  id: 'training-berjalan',
                  label: 'Training Berjalan',
                  value: `${macroTrainingAktif} Jadwal`,
                  sub: 'Program aktif saat ini',
                  icon: '🎓',
                  color: '#9b59b6',
                  glow: 'rgba(155,89,182,0.15)',
                  tabTarget: 'trainings'
                },
                {
                  id: 'sanksi-aktif',
                  label: 'Sanksi Aktif',
                  value: `${macroSanksiAktif} Kasus`,
                  sub: macroSanksiAktif === 0 ? 'Tidak ada pelanggaran ✅' : 'Perlu tindak lanjut ⚠️',
                  icon: '⚠️',
                  color: macroSanksiAktif === 0 ? '#2ecc71' : '#e74c3c',
                  glow: macroSanksiAktif === 0 ? 'rgba(46,204,113,0.15)' : 'rgba(231,76,60,0.15)',
                  tabTarget: 'sanctions'
                },
              ];

              return (
                <div style={{ marginBottom: '28px' }}>
                  {/* Title bar */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    marginBottom: '14px',
                  }}>
                    <div style={{
                      width: '4px',
                      height: '20px',
                      borderRadius: '2px',
                      background: 'linear-gradient(180deg, #00ADB5, #00D8FF)'
                    }} />
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '1.5px'
                    }}>
                      COMMAND CENTER — RINGKASAN LINTAS MODUL (REAKTIF)
                    </span>
                    <div style={{
                      flex: 1,
                      height: '1px',
                      background: 'linear-gradient(to right, rgba(0,173,181,0.3), transparent)'
                    }} />
                    <span style={{
                      fontSize: '0.65rem',
                      color: 'var(--text-muted)',
                      fontWeight: 600,
                      background: 'rgba(0,173,181,0.1)',
                      border: '1px solid rgba(0,173,181,0.2)',
                      padding: '3px 10px',
                      borderRadius: '20px'
                    }}>
                      {selectedOutlets.length} Outlet · {startDate} → {endDate}
                    </span>
                  </div>

                  {/* Cards Grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))',
                    gap: '14px'
                  }}>
                    {macroCards.map((card) => (
                      <div
                        key={card.id}
                        id={`macro-card-${card.id}`}
                        onClick={() => setActiveTab && setActiveTab(card.tabTarget)}
                        style={{
                          background: `linear-gradient(135deg, rgba(57,62,70,0.8), rgba(34,40,49,0.9))`,
                          border: `1px solid ${card.color}33`,
                          borderRadius: '14px',
                          padding: '16px 18px',
                          cursor: 'pointer',
                          transition: 'all 0.25s ease',
                          position: 'relative',
                          overflow: 'hidden',
                          backdropFilter: 'blur(8px)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-3px)';
                          e.currentTarget.style.boxShadow = `0 8px 24px ${card.color}33`;
                          e.currentTarget.style.borderColor = `${card.color}88`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = 'none';
                          e.currentTarget.style.borderColor = `${card.color}33`;
                        }}
                      >
                        {/* Glow accent strip */}
                        <div style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          height: '3px',
                          background: `linear-gradient(90deg, ${card.color}, ${card.color}55)`,
                          borderRadius: '14px 14px 0 0'
                        }} />

                        {/* Icon */}
                        <div style={{
                          fontSize: '1.4rem',
                          marginBottom: '10px',
                          lineHeight: 1
                        }}>
                          {card.icon}
                        </div>

                        {/* Label */}
                        <div style={{
                          fontSize: '0.65rem',
                          fontWeight: 800,
                          color: 'var(--text-muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.8px',
                          marginBottom: '4px'
                        }}>
                          {card.label}
                        </div>

                        {/* Value */}
                        <div style={{
                          fontSize: '1.3rem',
                          fontWeight: 900,
                          color: card.color,
                          lineHeight: 1.1,
                          marginBottom: '6px',
                          fontVariantNumeric: 'tabular-nums'
                        }}>
                          {card.value}
                        </div>

                        {/* Sub-text */}
                        <div style={{
                          fontSize: '0.62rem',
                          color: 'var(--text-muted)',
                          fontWeight: 500,
                          lineHeight: 1.3
                        }}>
                          {card.sub}
                        </div>

                        {/* Bottom glow */}
                        <div style={{
                          position: 'absolute',
                          bottom: -20,
                          right: -20,
                          width: 60,
                          height: 60,
                          borderRadius: '50%',
                          background: card.glow,
                          filter: 'blur(20px)',
                          pointerEvents: 'none'
                        }} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* ─── SEKTOR 1: KARYAWAN ─── */}
            <div className="category-container" style={{ '--theme-color': 'var(--text-main)', '--theme-glow': 'rgba(165, 182, 141, 0.12)', '--pulse-color-rgb': '225,220,201', marginBottom: '24px' }}>
          <div className="category-title-wrap">
            <span className="category-title">1. Sektor Karyawan (Analisis & Target)</span>
          </div>

          <div className="sector-grid-2col">
            {/* Left Block: Donut/Pie Charts */}
            <div style={{
              background: 'rgba(57, 62, 70, 0.6)',
              border: '1px solid var(--accent-primary)',
              borderRadius: '16px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '20px'
            }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 10px 0', borderBottom: '1px solid rgba(165, 182, 141, 0.1)', paddingBottom: '8px' }}>
                📊 Karakteristik & Distribusi Karyawan
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-around', gap: '24px' }}>
                {/* Pie 1: Jabatan */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '160px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '12px', textAlign: 'center' }}>Distribusi Jabatan</span>
                  <SvgDonutChart data={roleChartData} size={130} />
                  <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
                    {roleChartData.slice(0, 3).map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: item.color, display: 'inline-block', flexShrink: 0 }} />
                          {item.label}
                        </span>
                        <span style={{ fontWeight: 600 }}>{item.value}</span>
                      </div>
                    ))}
                    {roleChartData.length > 3 && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.62rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        <span>Lainnya</span>
                        <span style={{ fontWeight: 600 }}>{roleChartData.slice(3).reduce((sum, item) => sum + item.value, 0)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Pie 2: Gender */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '130px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '12px', textAlign: 'center' }}>Rasio Gender</span>
                  <SvgDonutChart data={genderChartData} size={130} />
                  <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
                    {genderChartData.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: item.color, display: 'inline-block' }} />
                          {item.label}
                        </span>
                        <span style={{ fontWeight: 600 }}>{item.value} ({totalEmployees > 0 ? Math.round((item.value / totalEmployees) * 100) : 0}%)</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pie 3: Masa Kerja */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '130px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '12px', textAlign: 'center' }}>Kelompok Masa Kerja</span>
                  <SvgDonutChart data={tenureChartData} size={130} />
                  <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
                    {tenureChartData.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: item.color, display: 'inline-block' }} />
                          {item.label}
                        </span>
                        <span style={{ fontWeight: 600 }}>{item.value} ({totalEmployees > 0 ? Math.round((item.value / totalEmployees) * 100) : 0}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Block: Target Staf Table */}
            <div style={{
              background: 'rgba(57, 62, 70, 0.6)',
              border: '1px solid var(--accent-primary)',
              borderRadius: '16px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 14px 0', borderBottom: '1px solid rgba(165, 182, 141, 0.1)', paddingBottom: '8px' }}>
                🏪 Perbandingan Target Staf (Juni 2026)
              </h4>
              <div style={{ overflowX: 'auto', flex: 1 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(165, 182, 141, 0.15)' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--text-muted)' }}>Nama Outlet</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--text-muted)' }}>Aktual</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--text-muted)' }}>Target</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--text-muted)' }}>Status Selisih</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffComparisonList.map((row, idx) => {
                      const diff = row.actual - row.target;
                      let bgColor = 'transparent';
                      let statusText = 'Sesuai';
                      let textColor = 'var(--text-main)';

                      if (row.actual === row.target) {
                        bgColor = 'rgba(46, 204, 113, 0.15)'; // Green Tembaga
                        statusText = 'Sesuai Target';
                        textColor = '#2ecc71';
                      } else if (row.actual < row.target) {
                        bgColor = 'rgba(231, 76, 60, 0.15)'; // Red Maroon
                        statusText = `Kurang ${Math.abs(diff)} Orang`;
                        textColor = '#e74c3c';
                      } else {
                        bgColor = 'rgba(243, 156, 18, 0.15)'; // Orange Wood
                        statusText = `Lebih ${diff} Orang`;
                        textColor = '#f39c12';
                      }

                      return (
                        <tr key={idx} style={{ backgroundColor: bgColor, borderBottom: '1px solid rgba(165, 182, 141, 0.06)', transition: 'all 0.2s ease' }}>
                          <td style={{ padding: '10px', fontWeight: 600, color: 'var(--text-main)' }}>{row.outletName || 'Outlet'}</td>
                          <td style={{ padding: '10px', textAlign: 'center', fontWeight: 700, fontSize: '0.8rem' }}>{row.actual} Orang</td>
                          <td style={{ padding: '10px', textAlign: 'center', fontWeight: 700, fontSize: '0.8rem', color: 'rgba(238, 238, 238, 0.6)' }}>{row.target} Orang</td>
                          <td style={{ padding: '10px', textAlign: 'center', fontWeight: 800, color: textColor }}>{statusText}</td>
                        </tr>
                      );
                    })}
                    {staffComparisonList.length === 0 && (
                      <tr>
                        <td colSpan="4" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>Tidak ada data target outlet untuk periode ini.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* ─── SEKTOR 2: OMZET ─── */}
        <div className="category-container" style={{ '--theme-color': '#f39c12', '--theme-glow': 'rgba(243, 156, 18, 0.12)', '--pulse-color-rgb': '243, 156, 18', marginBottom: '24px' }}>
          <div className="category-title-wrap">
            <span className="category-title">2. Sektor Omzet (Trend Bulanan Cabang)</span>
          </div>

          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>📈 Grafik Realisasi Omzet Cabang (Jan - Jun 2026)</h4>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>Akumulasi omzet bulanan dari laporan harian setiap cabang.</p>
              </div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.68rem' }}>
                  <span style={{ width: '12px', height: '4px', backgroundColor: '#e74c3c', borderRadius: '2px' }} />
                  <span>Rantau Prapat</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.68rem' }}>
                  <span style={{ width: '12px', height: '4px', backgroundColor: '#2ecc71', borderRadius: '2px' }} />
                  <span>Kisaran Seafood</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.68rem' }}>
                  <span style={{ width: '12px', height: '4px', backgroundColor: '#f1c40f', borderRadius: '2px' }} />
                  <span>Pak Haji Kisaran</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.68rem' }}>
                  <span style={{ width: '12px', height: '4px', backgroundColor: '#3498db', borderRadius: '2px' }} />
                  <span>Tebing Tinggi Seafood</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.68rem' }}>
                  <span style={{ width: '12px', height: '4px', backgroundColor: '#e67e22', borderRadius: '2px' }} />
                  <span>Bakar Sby Tebing</span>
                </div>
              </div>
            </div>

            <div style={{ width: '100%', minHeight: '300px' }}>
              <SvgMultiLineChart data={getOmzetTrendData()} width={700} height={320} />
            </div>
          </div>
        </div>

        {/* ─── SEKTOR 3: KEHADIRAN ─── */}
        <div className="category-container" style={{ '--theme-color': '#2ecc71', '--theme-glow': 'rgba(46, 204, 113, 0.12)', '--pulse-color-rgb': '46, 204, 113', marginBottom: '24px' }}>
          <div className="category-title-wrap">
            <span className="category-title">3. Sektor Log Kehadiran & Absensi</span>
          </div>

          <div className="sector-grid-2col">
            {/* Today's Realtime Status */}
            <div style={{
              background: 'rgba(57, 62, 70, 0.6)',
              border: '1px solid var(--accent-primary)',
              borderRadius: '16px',
              padding: '24px'
            }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 16px 0', borderBottom: '1px solid rgba(165, 182, 141, 0.1)', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="pulse-dot" style={{ backgroundColor: '#2ecc71' }}></span> Status Kehadiran Realtime Hari Ini
              </h4>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(165, 182, 141, 0.06)', borderRadius: '12px', padding: '12px 16px', display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Hadir</span>
                  <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#2ecc71', margin: '4px 0' }}>{hadirCount} Orang</span>
                  <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)' }}>Telah melakukan absensi</span>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(165, 182, 141, 0.06)', borderRadius: '12px', padding: '12px 16px', display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Tepat Waktu</span>
                  <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', margin: '4px 0' }}>{ontimeCount} Orang</span>
                  <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)' }}>Masuk sebelum toleransi</span>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(165, 182, 141, 0.06)', borderRadius: '12px', padding: '12px 16px', display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Terlambat</span>
                  <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f39c12', margin: '4px 0' }}>{terlambatCount} Orang</span>
                  <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)' }}>Melebihi jam toleransi</span>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(165, 182, 141, 0.06)', borderRadius: '12px', padding: '12px 16px', display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Alpha / Mangkir</span>
                  <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#e74c3c', margin: '4px 0' }}>{alphaCount} Orang</span>
                  <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)' }}>Belum absen masuk</span>
                </div>
              </div>
            </div>

            {/* Monthly Statistics */}
            <div style={{
              background: 'rgba(57, 62, 70, 0.6)',
              border: '1px solid var(--accent-primary)',
              borderRadius: '16px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 16px 0', borderBottom: '1px solid rgba(165, 182, 141, 0.1)', paddingBottom: '8px' }}>
                  📅 Rekapitulasi Presensi (Juni 2026)
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Rerata Tingkat Kehadiran</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#2ecc71' }}>{averageAttendanceRate}%</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Keterlambatan</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f39c12' }}>{totalLateCases} Kali</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Log Kehadiran Juni</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800 }}>{monthHadir} / {totalMonthLogs} Presensi</span>
                  </div>
                </div>
              </div>
              
              {/* Visual Bar */}
              <div style={{ marginTop: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  <span>Rasio Kehadiran</span>
                  <span>{averageAttendanceRate}%</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'rgba(165, 182, 141, 0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${averageAttendanceRate}%`, height: '100%', background: 'linear-gradient(to right, #2ecc71, #27ae60)', borderRadius: '3px' }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── SEKTOR 4: PAYROLL ─── */}
        <div className="category-container" style={{ '--theme-color': '#ca8a04', '--theme-glow': 'rgba(202, 138, 4, 0.12)', '--pulse-color-rgb': '202, 138, 4', marginBottom: '24px' }}>
          <div className="category-title-wrap">
            <span className="category-title">4. Sektor Keuangan & Payroll Gaji</span>
          </div>

          <div className="cards-grid">
            {/* Card 1 */}
            <div className="interactive-card" onClick={() => setActiveTab('payroll')}>
              <div className="card-top">
                <span className="card-label">Total Gaji Terbayar</span>
                <div className="card-icon-container"><Coins size={13} /></div>
              </div>
              <div className="card-value" style={{ fontSize: '1.1rem' }}>{formatCurrency(totalGajiTerbayar)}</div>
              <div className="card-footer"><span>Akumulasi bersih (Take Home Pay)</span></div>
            </div>

            {/* Card 2 */}
            <div className="interactive-card" onClick={() => setActiveTab('payroll')}>
              <div className="card-top">
                <span className="card-label">Kasbon Aktif</span>
                <div className="card-icon-container"><Coins size={13} /></div>
              </div>
              <div className="card-value" style={{ fontSize: '1.1rem' }}>{formatCurrency(totalKasbonAktif)}</div>
              <div className="card-footer"><span>Potongan kasbon bulan berjalan</span></div>
            </div>

            {/* Card 3 */}
            <div className="interactive-card" onClick={() => setActiveTab('payroll')}>
              <div className="card-top">
                <span className="card-label">Biaya Operasional Gaji</span>
                <div className="card-icon-container"><Briefcase size={13} /></div>
              </div>
              <div className="card-value" style={{ fontSize: '1.1rem' }}>{formatCurrency(totalPengeluaranOperasional)}</div>
              <div className="card-footer"><span>Pengeluaran kotor gaji karyawan</span></div>
            </div>

            {/* Card 4 */}
            <div className="interactive-card" onClick={() => setActiveTab('revenues')}>
              <div className="card-top">
                <span className="card-label">Pendapatan Bersih</span>
                <div className="card-icon-container"><Coins size={13} /></div>
              </div>
              <div className="card-value" style={{ fontSize: '1.1rem', color: totalPendapatanBersih >= 0 ? '#2ecc71' : '#e74c3c' }}>
                {formatCurrency(totalPendapatanBersih)}
              </div>
              <div className="card-footer"><span>Total Omzet - Beban Gaji</span></div>
            </div>
          </div>
        </div>

        {/* ─── SEKTOR 5: KINERJA ─── */}
        <div className="category-container" style={{ '--theme-color': '#f43f5e', '--theme-glow': 'rgba(244, 63, 94, 0.12)', '--pulse-color-rgb': '244, 63, 94', marginBottom: '0px' }}>
          <div className="category-title-wrap">
            <span className="category-title">5. Sektor Performance (Peringkat KPI Karyawan)</span>
          </div>

          <div style={{
            background: 'rgba(57, 62, 70, 0.6)',
            border: '1px solid var(--accent-primary)',
            borderRadius: '16px',
            padding: '24px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>🥇 Papan Peringkat Kinerja (KPI) Juni 2026</h4>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>Skor dihitung dinamis (Absensi 25%, Keterlambatan 25%, Survei 360 30%, Training 10%, Kuis 10%).</p>
              </div>
              <button
                onClick={() => setActiveTab('kpis')}
                style={{
                  background: 'rgba(165, 182, 141, 0.08)',
                  border: '1px solid var(--accent-primary)',
                  color: 'var(--text-main)',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                Lihat Detail KPI
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {leaderboardData.slice(0, 5).map((row, idx) => {
                let badgeEmoji = '';
                let rankText = `${idx + 1}`;
                
                if (idx === 0) {
                  badgeEmoji = '🥇';
                } else if (idx === 1) {
                  badgeEmoji = '🥈';
                } else if (idx === 2) {
                  badgeEmoji = '🥉';
                }

                return (
                  <div key={idx} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 18px',
                    borderRadius: '12px',
                    background: idx < 3 ? 'rgba(65, 45, 21, 0.3)' : 'rgba(0, 0, 0, 0.2)',
                    border: idx < 3 ? '1px solid rgba(165, 182, 141, 0.12)' : '1px solid rgba(165, 182, 141, 0.04)',
                    transition: 'all 0.2s ease'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ width: '28px', fontSize: '1rem', fontWeight: 800, textAlign: 'center', color: idx < 3 ? 'var(--text-main)' : 'var(--text-muted)' }}>
                        {badgeEmoji || rankText}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-main)' }}>{row.name}</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{row.position}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Skor KPI:</span>
                      <span style={{
                        fontWeight: 800,
                        fontSize: '0.9rem',
                        color: row.totalKpi >= 85 ? '#2ecc71' : row.totalKpi >= 70 ? '#f39c12' : '#e74c3c'
                      }}>
                        {row.totalKpi} / 100
                      </span>
                    </div>
                  </div>
                );
              })}
              {leaderboardData.length === 0 && (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.75rem' }}>
                  Tidak ada data kinerja karyawan yang terdata untuk periode ini.
                </div>
              )}
            </div>
          </div>
        </div>
          </>
        )}

      {/* Pop-up Dialog Konfirmasi Saring */}
      {showConfirmSaring && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(8px)',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            background: '#393E46',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '30px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            textAlign: 'center'
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#EEEEEE', marginBottom: '14px' }}>
              KONFIRMASI FILTER
            </h3>
            <p style={{ fontSize: '0.88rem', color: '#EEEEEE', marginBottom: '24px', lineHeight: '1.5' }}>
              Apakah Anda yakin ingin menyaring data berdasarkan rentang waktu dan outlet yang dipilih? Proses ini akan memperbarui seluruh grafik dan visual halaman.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={handleConfirmSaringOk}
                disabled={isApplyingFilter}
                className="btn-primary"
                style={{
                  flex: 1,
                  height: '42px',
                  justifyContent: 'center',
                  background: 'var(--accent-primary)',
                  color: '#fff',
                  border: 'none',
                  fontSize: '0.85rem',
                  fontWeight: '700'
                }}
              >
                {isApplyingFilter ? (
                  <>
                    <Loader2 className="animate-spin" size={16} color="var(--bg-main)" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <span>OK</span>
                )}
              </button>
              <button
                type="button"
                onClick={handleConfirmSaringCancel}
                disabled={isApplyingFilter}
                className="btn-secondary"
                style={{ flex: 1, height: '42px', fontSize: '0.85rem', fontWeight: '700' }}
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pop-up Dialog Konfirmasi Reset */}
      {showConfirmReset && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(8px)',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            background: '#393E46',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '30px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            textAlign: 'center'
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#EEEEEE', marginBottom: '14px' }}>
              KONFIRMASI RESET FILTER
            </h3>
            <p style={{ fontSize: '0.88rem', color: '#EEEEEE', marginBottom: '24px', lineHeight: '1.5' }}>
              Apakah Anda yakin ingin mengembalikan seluruh pengaturan filter ke setelan awal (default)?
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={handleConfirmResetOk}
                disabled={isApplyingFilter}
                className="btn-primary"
                style={{
                  flex: 1,
                  height: '42px',
                  justifyContent: 'center',
                  background: 'var(--accent-primary)',
                  color: '#fff',
                  border: 'none',
                  fontSize: '0.85rem',
                  fontWeight: '700'
                }}
              >
                {isApplyingFilter ? (
                  <>
                    <Loader2 className="animate-spin" size={16} color="var(--bg-main)" />
                    <span>Mengembalikan...</span>
                  </>
                ) : (
                  <span>OK</span>
                )}
              </button>
              <button
                type="button"
                onClick={handleConfirmResetCancel}
                disabled={isApplyingFilter}
                className="btn-secondary"
                style={{ flex: 1, height: '42px', fontSize: '0.85rem', fontWeight: '700' }}
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
      <PDFCompileOverlay isOpen={isExportingPDF} />
    </div>
  );
}

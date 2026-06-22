import React, { useState, useEffect, useRef } from 'react';
import { 
  Store, Plus, Edit, Trash2, Calendar, TrendingUp, Coins, 
  Search, Filter, X, CheckCircle, AlertCircle, Loader2, BarChart2, ChevronDown
} from 'lucide-react';
import { useHRIS } from '../context/HRISContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import PDFCompileOverlay from './PDFCompileOverlay';

const INDO_MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export default function OmzetCabang({ token, API_URL }) {
  // ─── Subscribe ke HRIS Context ─────────────────────────────────────────────
  const { dispatch: hrisDispatch, targetOmzet: ctxTargetOmzet, dailyRevenue: ctxDailyRevenue } = useHRIS();

  const [isExportingPDF, setIsExportingPDF] = useState(false);

  const capitalEachWord = (s) => {
    if (s === undefined || s === null) return '';
    return String(s).toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  };

  const handleExportPDF = () => {
    setIsExportingPDF(true);
    setTimeout(() => {
      try {
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        
        // Header
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text(capitalEachWord("LAPORAN OMZET DAN DENDA CABANG BAROKAH GRUP"), 15, 15);
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(capitalEachWord(`Periode: ${filterStartDate} s/d ${filterEndDate}`), 15, 22);
        doc.text(capitalEachWord(`Cabang Terfilter: ${selectedOutlets.join(', ')}`), 15, 27);
        
        // Summary metrics table
        const metricsHeaders = [
          [capitalEachWord("Total Omzet Terkumpul"), capitalEachWord("Total Target Terkumpul"), capitalEachWord("Rataan Setoran Harian"), capitalEachWord("Total Denda Selisih Stok")]
        ];
        const metricsData = [
          [
            formatRp(totalActualSum),
            formatRp(totalTargetSum),
            formatRp(avgHarianActual),
            formatRp(totalDendaSum)
          ].map(s => capitalEachWord(s))
        ];
        
        autoTable(doc, {
          startY: 32,
          head: metricsHeaders,
          body: metricsData,
          theme: 'grid',
          headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255] },
          styles: { fontSize: 9 }
        });
        
        // Table: Daily logs details (excluding NO column)
        const tableHeaders = [
          [capitalEachWord("Tanggal"), capitalEachWord("Nama Outlet"), capitalEachWord("Jumlah Omzet"), capitalEachWord("Denda Selisih Stok"), capitalEachWord("Penanggung Jawab Shift")]
        ];
        const tableRows = filteredDailyLogs.map(log => [
          log.tanggal,
          capitalEachWord(log.outlet_name),
          formatRp(log.jumlah_omzet),
          formatRp(log.denda_stok || 0),
          capitalEachWord(log.pj_shift || '-')
        ]);
        
        doc.text(capitalEachWord("Daftar Rincian Setoran Omzet Dan Denda Harian"), 15, doc.lastAutoTable.finalY + 10);
        
        autoTable(doc, {
          startY: doc.lastAutoTable.finalY + 12,
          head: tableHeaders,
          body: tableRows,
          theme: 'grid',
          headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255] },
          styles: { fontSize: 8.5 }
        });
        
        doc.save(`Laporan_Omzet_Cabang_${Date.now()}.pdf`);
      } catch (err) {
        console.error("PDF generation failed:", err);
      } finally {
        setIsExportingPDF(false);
        // Auto-cleanup: reset filters to default
        const allOutletNames = outlets.map(o => 
          o.wilayah ? `${o.nama} ${o.wilayah}`.trim().toUpperCase() : o.nama.toUpperCase()
        );
        setSelectedOutlets(allOutletNames);
        setFilterStartDate('2026-06-01');
        setFilterEndDate('2026-06-30');
      }
    }, 200);
  };

  // ─── Reactive: sync targetOmzet dari Context ke local state ─────────────────
  useEffect(() => {
    if (Array.isArray(ctxTargetOmzet) && ctxTargetOmzet.length > 0) {
      setTargetOmzet(ctxTargetOmzet);
    }
  }, [ctxTargetOmzet]);

  // ─── Reactive: sync dailyRevenue dari Context ke local state ────────────────
  useEffect(() => {
    if (Array.isArray(ctxDailyRevenue) && ctxDailyRevenue.length > 0) {
      setDailyLogs(ctxDailyRevenue);
    }
  }, [ctxDailyRevenue]);

  // --- Data States ---
  const [outlets, setOutlets] = useState([]);
  const [targetOmzet, setTargetOmzet] = useState([]);
  const [dailyLogs, setDailyLogs] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // --- Header Filter States (Reactive) ---
  const [selectedOutlets, setSelectedOutlets] = useState([]); // Array of outlet names
  const [filterStartDate, setFilterStartDate] = useState('2026-06-01');
  const [filterEndDate, setFilterEndDate] = useState('2026-06-30');
  const [isOutletDropdownOpen, setIsOutletDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // --- Modal Form State ---
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' or 'edit'
  const [editingId, setEditingId] = useState(null);
  const [formOutletId, setFormOutletId] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formAmount, setFormAmount] = useState('');
  const [formDendaStok, setFormDendaStok] = useState('');
  const [formPjShift, setFormPjShift] = useState('');
  const [isFormSaving, setIsFormSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // --- Pagination States ---
  const [dailyPage, setDailyPage] = useState(1);
  const rowsPerPage = 10;

  // --- Custom Confirm Modal State ---
  const [confirmDelete, setConfirmDelete] = useState({
    isOpen: false,
    logId: null
  });

  // --- Toast Alert State ---
  const [toast, setToast] = useState({ show: false, type: '', message: '' });

  const triggerToast = (type, message) => {
    setToast({ show: true, type, message });
    setTimeout(() => {
      setToast({ show: false, type: '', message: '' });
    }, 4000);
  };

  // --- Data Initializer & Hydration ---
  useEffect(() => {
    // 1. Load or seed Outlets
    const loadOutlets = () => {
      const raw = localStorage.getItem('outlet_cabang_data') || localStorage.getItem('outlet_data') || '[]';
      let parsed = [];
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = [];
      }
      if (!Array.isArray(parsed) || parsed.length === 0) {
        parsed = [
          { id: 'ABS TT', nama: 'AYAM BAKAR SURABAYA', wilayah: 'TEBING TINGGI', status: 'AKTIF' },
          { id: 'APS TT', nama: 'AYAM PECAK 2001 SEAFOOD', wilayah: 'TEBING TINGGI', status: 'AKTIF' },
          { id: 'APS KIS', nama: 'AYAM PECAK 2001 SEAFOOD', wilayah: 'KISARAN', status: 'AKTIF' },
          { id: 'APS RP', nama: 'AYAM PECAK 2001 SEAFOOD', wilayah: 'RANTAU PRAPAT', status: 'AKTIF' },
          { id: 'PLPH KIS', nama: 'PECEL LELE PAK HAJI', wilayah: 'KISARAN', status: 'AKTIF' }
        ];
        localStorage.setItem('outlet_cabang_data', JSON.stringify(parsed));
      }
      return parsed;
    };

    // 2. Load or seed Targets
    const loadTargets = () => {
      const raw = localStorage.getItem('target_omzet_data') || '[]';
      let parsed = [];
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = [];
      }
      if (!Array.isArray(parsed) || parsed.length === 0) {
        parsed = [];
        const outletNames = [
          'AYAM PECAK 2001 SEAFOOD TEBING TINGGI',
          'AYAM BAKAR SURABAYA TEBING TINGGI',
          'AYAM PECAK 2001 SEAFOOD KISARAN',
          'PECEL LELE PAK HAJI KISARAN',
          'AYAM PECAK 2001 SEAFOOD RANTAU PRAPAT'
        ];
        const targetRates = {
          'AYAM PECAK 2001 SEAFOOD TEBING TINGGI': 180000000,
          'AYAM BAKAR SURABAYA TEBING TINGGI': 150000000,
          'AYAM PECAK 2001 SEAFOOD KISARAN': 320000000,
          'PECEL LELE PAK HAJI KISARAN': 180000000,
          'AYAM PECAK 2001 SEAFOOD RANTAU PRAPAT': 350000000
        };

        // Seed target data for all months of 2026
        let idx = 1;
        INDO_MONTHS.forEach(m => {
          outletNames.forEach(name => {
            parsed.push({
              id: `tomzet-seed-${idx++}`,
              outlet_name: name,
              target_omzet: targetRates[name],
              bulan: m,
              tahun: '2026'
            });
          });
        });
        localStorage.setItem('target_omzet_data', JSON.stringify(parsed));
      }
      return parsed;
    };

    // 3. Load or seed Daily Logs
    const loadDailyLogs = () => {
      const raw = localStorage.getItem('daily_revenue_logs') || '[]';
      let parsed = [];
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = [];
      }
      if (!Array.isArray(parsed) || parsed.length === 0) {
        parsed = [];
        const outletsList = [
          { id: 'ABS TT', name: 'AYAM BAKAR SURABAYA TEBING TINGGI', base: 4900000 },
          { id: 'APS TT', name: 'AYAM PECAK 2001 SEAFOOD TEBING TINGGI', base: 6000000 },
          { id: 'APS KIS', name: 'AYAM PECAK 2001 SEAFOOD KISARAN', base: 10600000 },
          { id: 'APS RP', name: 'AYAM PECAK 2001 SEAFOOD RANTAU PRAPAT', base: 11600000 },
          { id: 'PLPH KIS', name: 'PECEL LELE PAK HAJI KISARAN', base: 5800000 }
        ];

        let logIdx = 1;
        // Seed logs from January 2026 to June 15, 2026
        // Months: 1 (Jan), 2 (Feb), 3 (Mar), 4 (Apr), 5 (May), 6 (June)
        const monthsLength = [31, 28, 31, 30, 31, 15]; // June only up to 15
        
        for (let mIdx = 0; mIdx < 6; mIdx++) {
          const monthNum = String(mIdx + 1).padStart(2, '0');
          const maxDays = monthsLength[mIdx];
          
          for (let day = 1; day <= maxDays; day++) {
            const dayStr = String(day).padStart(2, '0');
            const dateStr = `2026-${monthNum}-${dayStr}`;
            
            outletsList.forEach(ot => {
              // Add random variation to base daily revenue
              const variation = (Math.random() * 0.4) - 0.15; // -15% to +25%
              const amount = Math.round(ot.base * (1 + variation));
              
              // Seed random stock denda (15% chance, Rp50.000 to Rp250.000)
              const hasDenda = Math.random() < 0.15;
              const dendaAmount = hasDenda ? Math.round((Math.random() * 4 + 1) * 50000) : 0;
              
              parsed.push({
                id: `rev-seed-${logIdx++}`,
                outlet_id: ot.id,
                outlet_name: ot.name,
                tanggal: dateStr,
                jumlah_omzet: amount,
                pj_shift: day % 2 === 0 ? 'Budi Santoso' : 'Rian Wijaya',
                denda_stok: dendaAmount
              });
            });
          }
        }
        localStorage.setItem('daily_revenue_logs', JSON.stringify(parsed));
      }
      return parsed;
    };

    setIsLoadingData(true);
    const loadedOutlets = loadOutlets();
    const loadedTargets = loadTargets();
    const loadedLogs = loadDailyLogs();

    setOutlets(loadedOutlets);
    setTargetOmzet(loadedTargets);
    setDailyLogs(loadedLogs);

    // Default select all outlets
    const names = loadedOutlets.map(o => 
      o.wilayah ? `${o.nama} ${o.wilayah}`.trim().toUpperCase() : o.nama.toUpperCase()
    );
    setSelectedOutlets(names);

    setIsLoadingData(false);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOutletDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper formatting currency
  const formatRp = (val) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(val || 0);
  };

  const formatRpCompact = (val) => {
    if (!val) return 'Rp 0';
    if (val >= 1000000000) {
      return `Rp ${(val / 1000000000).toFixed(1)}M`;
    }
    if (val >= 1000000) {
      return `Rp ${(val / 1000000).toFixed(0)}jt`;
    }
    if (val >= 1000) {
      return `Rp ${(val / 1000).toFixed(0)}rb`;
    }
    return `Rp ${val}`;
  };

  // --- Data Calculations for Selected Filters (Reactive) ---

  // Helper to calculate daily target dynamically for a given date
  const getDailyTargetForDate = (dateStr) => {
    const [year, month] = dateStr.split('-');
    const monthIndex = parseInt(month, 10) - 1;
    const monthName = INDO_MONTHS[monthIndex];
    if (!monthName) return 0;
    
    const daysInMonth = new Date(parseInt(year, 10), monthIndex + 1, 0).getDate();
    
    let totalTarget = 0;
    selectedOutlets.forEach(outletName => {
      const targetObj = targetOmzet.find(t => 
        t.outlet_name.toUpperCase() === outletName.toUpperCase() &&
        t.bulan.toLowerCase() === monthName.toLowerCase() &&
        String(t.tahun) === String(year)
      );
      if (targetObj) {
        const monthlyTarget = parseFloat(targetObj.target_omzet) || 0;
        totalTarget += monthlyTarget / daysInMonth;
      }
    });
    return totalTarget;
  };

  // 1. Calculate Daily Logs Table Data (Reactive based on outlets and date range)
  const getFilteredDailyLogs = () => {
    const list = dailyLogs.filter(log => {
      const matchesOutlet = selectedOutlets.includes(log.outlet_name.toUpperCase());
      const matchesDate = log.tanggal >= filterStartDate && log.tanggal <= filterEndDate;
      return matchesOutlet && matchesDate;
    });
    // Sort descending by date
    return list.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
  };

  const filteredDailyLogs = getFilteredDailyLogs();

  // 2. Compile Data for Daily Chart (Day by Day)
  const getDailyChartData = () => {
    if (!filterStartDate || !filterEndDate) return [];
    
    const start = new Date(filterStartDate);
    const end = new Date(filterEndDate);
    const dates = [];
    let curr = new Date(start);
    
    // Safety check to prevent UI lockup if start > end or diff is too large
    let count = 0;
    while (curr <= end && count < 100) {
      dates.push(curr.toISOString().split('T')[0]);
      curr.setDate(curr.getDate() + 1);
      count++;
    }
    
    return dates.map(dateStr => {
      // Calculate actual revenue for that date
      const actualSum = dailyLogs
        .filter(log => {
          if (!selectedOutlets.includes(log.outlet_name.toUpperCase())) return false;
          return log.tanggal === dateStr;
        })
        .reduce((sum, log) => sum + (parseFloat(log.jumlah_omzet) || 0), 0);
        
      // Calculate target revenue for that date
      const targetSum = getDailyTargetForDate(dateStr);
      
      const parts = dateStr.split('-');
      const dayLabel = `${parts[2]}/${parts[1]}`;
      
      return {
        dateStr,
        dayLabel,
        actual: actualSum,
        target: targetSum
      };
    });
  };

  const dailyChartList = getDailyChartData();

  // --- CRUD Event Handlers ---

  // Save/Create Record Handler
  const handleSaveRevenue = (e) => {
    e.preventDefault();
    setFormError('');

    if (!formOutletId) {
      setFormError('Silakan pilih outlet terlebih dahulu.');
      return;
    }
    if (!formAmount || parseFloat(formAmount) <= 0) {
      setFormError('Masukkan jumlah omzet yang valid (lebih dari 0).');
      return;
    }
    if (!formPjShift.trim()) {
      setFormError('Masukkan nama Penanggung Jawab (PJ) Shift.');
      return;
    }

    // Trigger Toska Spinner inside button and lock click
    setIsFormSaving(true);

    const selectedOutlet = outlets.find(o => o.id === formOutletId);
    const outletFullName = selectedOutlet.wilayah 
      ? `${selectedOutlet.nama} ${selectedOutlet.wilayah}`.trim().toUpperCase()
      : selectedOutlet.nama.toUpperCase();

    // 0.4 seconds loading process mimicking network check / locking double submit
    setTimeout(() => {
      const existingLogs = JSON.parse(localStorage.getItem('daily_revenue_logs') || '[]');
      let updatedLogs = [];

      if (modalMode === 'create') {
        const newLog = {
          id: `rev-manual-${Date.now()}`,
          outlet_id: formOutletId,
          outlet_name: outletFullName,
          tanggal: formDate,
          jumlah_omzet: parseFloat(formAmount),
          pj_shift: formPjShift.trim(),
          denda_stok: parseFloat(formDendaStok) || 0
        };
        updatedLogs = [newLog, ...existingLogs];
        triggerToast('success', 'Omzet harian berhasil dicatat!');
      } else {
        // Edit Mode
        updatedLogs = existingLogs.map(log => {
          if (log.id === editingId) {
            return {
              ...log,
              outlet_id: formOutletId,
              outlet_name: outletFullName,
              tanggal: formDate,
              jumlah_omzet: parseFloat(formAmount),
              pj_shift: formPjShift.trim(),
              denda_stok: parseFloat(formDendaStok) || 0
            };
          }
          return log;
        });
        triggerToast('success', 'Catatan omzet berhasil diperbarui!');
      }

      // Save back to local storage
      localStorage.setItem('daily_revenue_logs', JSON.stringify(updatedLogs));
      setDailyLogs(updatedLogs);
      // ⚡ GLOBAL SYNC — Dashboard langsung update Pendapatan Bersih & Pengeluaran
      hrisDispatch('REVENUE_CHANGED', updatedLogs);

      // Auto-Cleanup & Reset Lifecycle Form
      setFormOutletId('');
      setFormAmount('');
      setFormDendaStok('');
      setFormPjShift('');
      setEditingId(null);
      setFormError('');
      setIsFormSaving(false);
      setShowModal(false);
    }, 400);
  };

  const handleEditClick = (log) => {
    setModalMode('edit');
    setEditingId(log.id);
    
    // Map full name to outlet ID
    const matchedOutlet = outlets.find(o => {
      const fullName = o.wilayah ? `${o.nama} ${o.wilayah}` : o.nama;
      return fullName.toUpperCase() === log.outlet_name.toUpperCase();
    });

    setFormOutletId(matchedOutlet ? matchedOutlet.id : '');
    setFormDate(log.tanggal);
    setFormAmount(String(log.jumlah_omzet));
    setFormDendaStok(log.denda_stok ? String(log.denda_stok) : '0');
    setFormPjShift(log.pj_shift || 'Budi Santoso');
    setFormError('');
    setShowModal(true);
  };

  // Custom Confirm Delete Handlers
  const handleDeleteClick = (id) => {
    setConfirmDelete({
      isOpen: true,
      logId: id
    });
  };

  const executeDeleteLog = () => {
    const id = confirmDelete.logId;
    const existingLogs = JSON.parse(localStorage.getItem('daily_revenue_logs') || '[]');
    const updated = existingLogs.filter(log => log.id !== id);

    localStorage.setItem('daily_revenue_logs', JSON.stringify(updated));
    setDailyLogs(updated);
    // ⚡ GLOBAL SYNC — sebarkan penghapusan ke Dashboard
    hrisDispatch('REVENUE_CHANGED', updated);
    setConfirmDelete({ isOpen: false, logId: null });
    triggerToast('success', 'Catatan omzet berhasil dihapus.');
  };

  // Reset form when close/cancel modal
  const handleCloseModal = () => {
    setFormOutletId('');
    setFormAmount('');
    setFormDendaStok('');
    setFormPjShift('');
    setEditingId(null);
    setFormError('');
    setShowModal(false);
  };

  // --- Outlet color map helper for charts ---
  const outletColors = {
    'AYAM BAKAR SURABAYA TEBING TINGGI': '#a29bfe', // soft purple
    'AYAM PECAK 2001 SEAFOOD TEBING TINGGI': '#fd79a8', // rose pink
    'AYAM PECAK 2001 SEAFOOD KISARAN': '#ffeaa7', // pastel yellow
    'AYAM PECAK 2001 SEAFOOD RANTAU PRAPAT': '#55efc4', // mint green
    'PECEL LELE PAK HAJI KISARAN': '#00ADB5', // Electric Cyan
  };
  const getOutletColor = (name) => outletColors[name.toUpperCase()] || '#EEEEEE';

  // --- Dynamic Table Data Helpers ---
  const getSelectedOutletsSorted = () => {
    return outlets
      .map(o => o.wilayah ? `${o.nama} ${o.wilayah}`.trim().toUpperCase() : o.nama.toUpperCase())
      .filter(name => selectedOutlets.includes(name));
  };

  const activeTableCols = getSelectedOutletsSorted();

  const getFilteredDates = () => {
    const datesSet = new Set();
    dailyLogs.forEach(log => {
      const matchesOutlet = selectedOutlets.includes(log.outlet_name.toUpperCase());
      const matchesDate = log.tanggal >= filterStartDate && log.tanggal <= filterEndDate;
      if (matchesOutlet && matchesDate) {
        datesSet.add(log.tanggal);
      }
    });
    return Array.from(datesSet).sort((a, b) => new Date(b) - new Date(a));
  };

  const filteredDates = getFilteredDates();

  const getLogForDateAndOutlet = (dateStr, outletName) => {
    return dailyLogs.find(l => 
      l.tanggal === dateStr && 
      l.outlet_name.toUpperCase() === outletName.toUpperCase()
    );
  };

  // Helper to calculate total omzet of a row (date) across selected outlets
  const getRowTotalForDate = (dateStr) => {
    return activeTableCols.reduce((sum, colName) => {
      const log = getLogForDateAndOutlet(dateStr, colName);
      return sum + (log ? parseFloat(log.jumlah_omzet) || 0 : 0);
    }, 0);
  };

  // Helper to calculate total omzet of a column (outlet) across all filtered dates
  const getColTotalForOutlet = (colName) => {
    return filteredDates.reduce((sum, dateStr) => {
      const log = getLogForDateAndOutlet(dateStr, colName);
      return sum + (log ? parseFloat(log.jumlah_omzet) || 0 : 0);
    }, 0);
  };

  // Helper to calculate Grand Total of all selected outlets across all filtered dates
  const getGrandTotal = () => {
    return filteredDates.reduce((sum, dateStr) => {
      return sum + getRowTotalForDate(dateStr);
    }, 0);
  };

  const handleCellClick = (dateStr, outletName) => {
    const log = getLogForDateAndOutlet(dateStr, outletName);
    
    // Find outlet ID for the given outletName
    const matchedOutlet = outlets.find(o => {
      const fullName = o.wilayah ? `${o.nama} ${o.wilayah}` : o.nama;
      return fullName.toUpperCase() === outletName.toUpperCase();
    });

    if (log) {
      handleEditClick(log);
    } else {
      setModalMode('create');
      setFormOutletId(matchedOutlet ? matchedOutlet.id : '');
      setFormDate(dateStr);
      setFormAmount('');
      setFormPjShift('Budi Santoso'); // default PJ
      setFormError('');
      setShowModal(true);
    }
  };

  // --- Pagination Calculators ---
  const totalDailyPages = Math.ceil(filteredDates.length / rowsPerPage) || 1;
  const paginatedDates = filteredDates.slice(
    (dailyPage - 1) * rowsPerPage,
    dailyPage * rowsPerPage
  );

  // Stat Card summaries (Reactive)
  const totalActualSum = filteredDailyLogs.reduce((sum, log) => sum + (parseFloat(log.jumlah_omzet) || 0), 0);
  const totalDendaSum  = filteredDailyLogs.reduce((sum, log) => sum + (parseFloat(log.denda_stok) || 0), 0);

  // Rata-rata setoran harian (dari hari unik yang ada datanya)
  const uniqueDaysWithData = new Set(filteredDailyLogs.map(l => l.tanggal)).size;
  const avgHarianActual = uniqueDaysWithData > 0 ? totalActualSum / uniqueDaysWithData : 0;

  // Calculate total target dynamically based on the date range
  const calculateTotalTargetForRange = () => {
    if (!filterStartDate || !filterEndDate) return 0;
    const start = new Date(filterStartDate);
    const end = new Date(filterEndDate);
    let totalTarget = 0;
    let curr = new Date(start);
    let count = 0;
    while (curr <= end && count < 100) {
      const dateStr = curr.toISOString().split('T')[0];
      totalTarget += getDailyTargetForDate(dateStr);
      curr.setDate(curr.getDate() + 1);
      count++;
    }
    return totalTarget;
  };
  
  const totalTargetSum = calculateTotalTargetForRange();
  const averageAchievement = totalTargetSum > 0 ? (totalActualSum / totalTargetSum) * 100 : 0;

  // ⚡ Publish ringkasan card ke localStorage agar Dashboard bisa membacanya
  useEffect(() => {
    const cardSummary = {
      totalActualSum,
      totalDendaSum,
      avgHarianActual,
      averageAchievement,
      totalTargetSum,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem('hris_omzet_card_summary', JSON.stringify(cardSummary));
    // Trigger agar Dashboard menerima update
    window.dispatchEvent(new CustomEvent('hris:storage', { detail: { key: 'hris_omzet_card_summary' } }));
  }, [totalActualSum, totalDendaSum, avgHarianActual, averageAchievement]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', position: 'relative' }}>
      <style>{`
        .clickable-row {
          cursor: pointer;
          transition: all 0.2s ease-in-out;
        }
        .clickable-row:hover {
          background: rgba(255, 255, 255, 0.05) !important;
        }
        .clickable-cell {
          cursor: pointer;
          transition: all 0.2s ease-in-out;
        }
        .clickable-cell:hover {
          background: rgba(0, 173, 181, 0.15) !important;
          color: var(--accent-primary) !important;
        }
        .input-date-custom {
          background: var(--bg-main);
          color: #fff;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          height: 42px;
          padding: 0 12px;
          font-size: 0.85rem;
          outline: none;
          transition: border-color 0.2s;
        }
        .input-date-custom:focus {
          border-color: var(--accent-primary);
        }
      `}</style>

      {/* Header Info Banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        background: 'rgba(0, 173, 181, 0.1)',
        border: '1px solid rgba(0, 173, 181, 0.3)',
        padding: '12px 18px',
        borderRadius: '10px',
        fontSize: '0.82rem',
        color: '#EEEEEE',
        fontWeight: '600'
      }}>
        <span>🔒 Halaman Analisis Finansial Terenkripsi. Diizinkan: Owner, SPV Keuangan, Admin Portal.</span>
      </div>

      {/* Floating Toast Notification */}
      {toast.show && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          background: toast.type === 'success' ? 'rgba(16, 185, 129, 0.95)' : 'rgba(239, 68, 68, 0.95)',
          color: '#EEEEEE',
          padding: '12px 24px',
          borderRadius: '10px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontWeight: '600',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.1)',
          animation: 'slideIn 0.3s ease-out'
        }}>
          {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* ============================================================ */}
      {/* PART 1: LAYER FILTER HEADER PREMIUM */}
      {/* ============================================================ */}
      <div className="glass-card" style={{ padding: '24px', position: 'relative' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--accent-primary)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Filter Analisis Pendapatan (Reaktif)
        </h3>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-end' }}>
          {/* Dropdown Multi-Select Outlets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '250px', position: 'relative' }} ref={dropdownRef}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '700' }}>CABANG OUTLET:</label>
            <button
              type="button"
              onClick={() => setIsOutletDropdownOpen(!isOutletDropdownOpen)}
              className="input-field"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--bg-main)',
                color: '#fff',
                height: '42px',
                padding: '0 12px',
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left',
                border: '1px solid var(--border-color)',
                borderRadius: '8px'
              }}
            >
              <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', marginRight: '8px', fontSize: '0.85rem' }}>
                {selectedOutlets.length === 0
                  ? 'Pilih Outlet...'
                  : selectedOutlets.length === outlets.length
                  ? 'Semua Outlet'
                  : `${selectedOutlets.length} Outlet Terpilih`}
              </span>
              <ChevronDown size={16} color="var(--text-muted)" />
            </button>
            
            {isOutletDropdownOpen && (
              <div className="glass-card animate-fade-in" style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: '68px',
                zIndex: 100,
                padding: '12px',
                maxHeight: '260px',
                overflowY: 'auto',
                background: 'rgba(21, 27, 38, 0.98)',
                backdropFilter: 'blur(12px)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '0.85rem',
                  color: '#fff',
                  cursor: 'pointer',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  fontWeight: 'bold'
                }}>
                  <input
                    type="checkbox"
                    checked={selectedOutlets.length === outlets.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        const allOutletNames = outlets.map(o => 
                          o.wilayah ? `${o.nama} ${o.wilayah}`.trim().toUpperCase() : o.nama.toUpperCase()
                        );
                        setSelectedOutlets(allOutletNames);
                      } else {
                        setSelectedOutlets([]);
                      }
                    }}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--accent-primary)' }}
                  />
                  <span>PILIH SEMUA</span>
                </label>
                
                {outlets.map(o => {
                  const fullName = o.wilayah ? `${o.nama} ${o.wilayah}` : o.nama;
                  const nameUpper = fullName.toUpperCase();
                  const isChecked = selectedOutlets.includes(nameUpper);
                  
                  return (
                    <label key={o.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      fontSize: '0.82rem',
                      color: '#fff',
                      cursor: 'pointer',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      transition: 'background 0.2s',
                      background: isChecked ? 'rgba(0, 173, 181, 0.05)' : 'transparent'
                    }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setSelectedOutlets(selectedOutlets.filter(n => n !== nameUpper));
                          } else {
                            setSelectedOutlets([...selectedOutlets, nameUpper]);
                          }
                        }}
                        style={{ width: '15px', height: '15px', accentColor: 'var(--accent-primary)' }}
                      />
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: getOutletColor(fullName) }}></span>
                        {fullName}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Date Range Filters */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '700' }}>TANGGAL MULAI:</label>
            <input
              type="date"
              className="input-date-custom"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              style={{ width: '160px' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '700' }}>TANGGAL AKHIR:</label>
            <input
              type="date"
              className="input-date-custom"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              style={{ width: '160px' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.75rem', color: 'transparent', fontWeight: '700' }}>Export</label>
            <button
              id="global-pdf-btn"
              onClick={handleExportPDF}
              style={{
                height: '42px',
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
          </div>
        </div>
      </div>

      {/* ── Cards KPI Overview (4 cards) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        {/* Card 1: Total Omzet Aktual */}
        <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, var(--success), rgba(16,185,129,0.3))' }} />
          <div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px' }}>TOTAL OMZET AKTUAL</span>
            <h4 style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--success)', marginTop: '6px', lineHeight: 1 }}>
              {formatRp(totalActualSum)}
            </h4>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>{uniqueDaysWithData} hari tercatat</p>
          </div>
          <div style={{ background: 'var(--success-glow)', padding: '10px', borderRadius: '10px', color: 'var(--success)' }}>
            <TrendingUp size={22} />
          </div>
        </div>

        {/* Card 2: Rataan Setoran Harian */}
        <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #a29bfe, rgba(162,155,254,0.3))' }} />
          <div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px' }}>RATAAN SETORAN HARIAN</span>
            <h4 style={{ fontSize: '1.3rem', fontWeight: '800', color: '#a29bfe', marginTop: '6px', lineHeight: 1 }}>
              {formatRp(avgHarianActual)}
            </h4>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>Per hari ({selectedOutlets.length} outlet)</p>
          </div>
          <div style={{ background: 'rgba(162,155,254,0.12)', padding: '10px', borderRadius: '10px', color: '#a29bfe' }}>
            <Coins size={22} />
          </div>
        </div>

        {/* Card 3: Persentase Capaian Target */}
        <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, var(--accent-primary), rgba(0,173,181,0.3))' }} />
          <div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px' }}>PERSENTASE CAPAIAN TARGET</span>
            <h4 style={{ fontSize: '1.3rem', fontWeight: '800', color: averageAchievement >= 100 ? 'var(--success)' : averageAchievement >= 80 ? 'var(--accent-primary)' : '#ff7675', marginTop: '6px', lineHeight: 1 }}>
              {averageAchievement.toFixed(1)}%
            </h4>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>Target: {formatRp(totalTargetSum)}</p>
          </div>
          <div style={{ background: 'var(--primary-glow)', padding: '10px', borderRadius: '10px', color: 'var(--accent-primary)' }}>
            <BarChart2 size={22} />
          </div>
        </div>

        {/* Card 4: Total Denda Stok / Varian */}
        <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #ff7675, rgba(255,118,117,0.3))' }} />
          <div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px' }}>TOTAL VARIAN DENDA STOK</span>
            <h4 style={{ fontSize: '1.3rem', fontWeight: '800', color: totalDendaSum > 0 ? '#ff7675' : 'var(--text-muted)', marginTop: '6px', lineHeight: 1 }}>
              {formatRp(totalDendaSum)}
            </h4>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              {totalDendaSum > 0 ? `${filteredDailyLogs.filter(l => (l.denda_stok||0) > 0).length} kejadian denda` : 'Tidak ada denda ✅'}
            </p>
          </div>
          <div style={{ background: 'rgba(255,118,117,0.12)', padding: '10px', borderRadius: '10px', color: '#ff7675' }}>
            <AlertCircle size={22} />
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* PART 2: GRAFIK PERKEMBANGAN OMZET DAN TARGET */}
      {/* ============================================================ */}
      <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BarChart2 size={20} color="var(--accent-primary)" />
            <span>GRAFIK PERKEMBANGAN OMZET HARIAN & TARGET OPERASIONAL</span>
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Grafik batang menunjukkan omzet aktual harian (gabungan outlet terpilih), sedangkan garis putus-putus merah merupakan target operasional harian.
          </p>
        </div>

        {/* SVG Daily Bar/Line Chart */}
        {selectedOutlets.length === 0 ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Silakan pilih minimal 1 outlet untuk memetakan diagram perkembangan omzet.
          </div>
        ) : dailyChartList.length === 0 ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Tidak ada data untuk rentang waktu terpilih.
          </div>
        ) : (
          <div style={{ width: '100%', overflowX: 'auto', paddingBottom: '10px' }}>
            {(() => {
              const width = Math.max(800, dailyChartList.length * 32 + 100);
              const height = 300;
              const margin = { top: 30, right: 30, bottom: 40, left: 80 };
              const chartWidth = width - margin.left - margin.right;
              const chartHeight = height - margin.top - margin.bottom;

              // Find max val in chart data to scale Y axis
              let maxVal = 0;
              dailyChartList.forEach(d => {
                if (d.actual > maxVal) maxVal = d.actual;
                if (d.target > maxVal) maxVal = d.target;
              });
              maxVal = maxVal > 0 ? maxVal * 1.15 : 10000000; // Give 15% headroom

              // Helper maps data point to X coordinate
              const getX = (idx) => margin.left + (idx / Math.max(dailyChartList.length - 1, 1)) * chartWidth;
              // Helper maps value to Y coordinate
              const getY = (val) => margin.top + chartHeight - (val / maxVal) * chartHeight;

              // Create Y-axis tick values (5 ticks)
              const yTicks = Array.from({ length: 5 }, (_, i) => Math.round((maxVal / 4) * i));

              // Compile path coordinates for dynamic target line
              const targetPathD = dailyChartList.map((d, idx) => {
                const prefix = idx === 0 ? 'M' : 'L';
                return `${prefix} ${getX(idx)} ${getY(d.target)}`;
              }).join(' ');

              return (
                <div style={{ minWidth: `${width}px` }}>
                  <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: `${height}px` }}>
                    <defs>
                      <linearGradient id="chartBarGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent-primary)" />
                        <stop offset="100%" stopColor="rgba(0, 173, 181, 0.15)" />
                      </linearGradient>
                    </defs>

                    {/* Grid Lines */}
                    {yTicks.map((tick, idx) => {
                      const y = getY(tick);
                      return (
                        <g key={idx}>
                          <line x1={margin.left} y1={y} x2={width - margin.right} y2={y} stroke="rgba(238,238,238,0.06)" strokeDasharray="4 4" />
                          <text x={margin.left - 12} y={y + 4} fill="var(--text-muted)" fontSize="9px" textAnchor="end" fontWeight="600">
                            {formatRpCompact(tick)}
                          </text>
                        </g>
                      );
                    })}

                    {/* X axis labels (Dates) */}
                    {dailyChartList.map((d, idx) => {
                      const x = getX(idx);
                      // Skip rendering text labels if they are too dense
                      const shouldShowLabel = dailyChartList.length <= 15 || idx % Math.ceil(dailyChartList.length / 15) === 0 || idx === dailyChartList.length - 1;
                      
                      return (
                        <g key={idx}>
                          {shouldShowLabel && (
                            <text x={x} y={height - 15} fill="var(--text-muted)" fontSize="9px" textAnchor="middle" fontWeight="700">
                              {d.dayLabel}
                            </text>
                          )}
                          {/* Tiny tick mark */}
                          <line x1={x} y1={height - margin.bottom} x2={x} y2={height - margin.bottom + 4} stroke="rgba(238,238,238,0.15)" />
                        </g>
                      );
                    })}

                    {/* Draw actual revenue bars */}
                    {dailyChartList.map((d, idx) => {
                      const x = getX(idx);
                      const y = getY(d.actual);
                      const barH = chartHeight - (y - margin.top);
                      const barW = Math.max((chartWidth / dailyChartList.length) * 0.45, 8);

                      return (
                        <rect
                          key={idx}
                          x={x - barW / 2}
                          y={y}
                          width={barW}
                          height={Math.max(barH, 2)}
                          fill="url(#chartBarGrad)"
                          rx="4"
                          style={{ transition: 'all 0.3s ease' }}
                        >
                          <title>Tanggal {d.dateStr}: {formatRp(d.actual)}</title>
                        </rect>
                      );
                    })}

                    {/* Draw Target Line (Dashed) */}
                    {targetPathD && (
                      <path
                        d={targetPathD}
                        fill="none"
                        stroke="#ff4757"
                        strokeWidth="2.5"
                        strokeDasharray="6 4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ transition: 'all 0.3s ease' }}
                      />
                    )}

                    {/* Target dots */}
                    {dailyChartList.map((d, idx) => {
                      const x = getX(idx);
                      const y = getY(d.target);
                      return (
                        <circle
                          key={`dot-${idx}`}
                          cx={x}
                          cy={y}
                          r="4"
                          fill="var(--bg-surface)"
                          stroke="#ff4757"
                          strokeWidth="2.5"
                        >
                          <title>Target Harian: {formatRp(d.target)}</title>
                        </circle>
                      );
                    })}
                  </svg>
                </div>
              );
            })()}

            {/* Custom Chart Legend */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'center', marginTop: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
                <span style={{ width: '16px', height: '12px', background: 'var(--accent-primary)', borderRadius: '3px', display: 'inline-block' }}></span>
                <span style={{ color: '#fff', fontWeight: 600 }}>Omzet Aktual (Kumulatif)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
                <span style={{ width: '24px', height: '0px', borderBottom: '2.5px dashed #ff4757', display: 'inline-block' }}></span>
                <span style={{ color: '#ff7675', fontWeight: 600 }}>Garis Bantu Target Operasional Harian</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* PART 3: TABEL LOG OMZET HARIAN */}
      {/* ============================================================ */}
      <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>
              LOG OMZET PER HARI
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Klik pada baris tabel untuk mengubah atau menghapus catatan setoran omzet harian.
            </p>
          </div>
          
          <button
            onClick={() => {
              setModalMode('create');
              setFormOutletId('');
              setFormDate(new Date().toISOString().split('T')[0]);
              setFormAmount('');
              setFormPjShift('');
              setFormError('');
              setShowModal(true);
            }}
            className="btn-primary"
            style={{ padding: '8px 16px', fontSize: '0.78rem', gap: '8px', height: '36px' }}
          >
            <Plus size={14} />
            <span>Tambah Omzet</span>
          </button>
        </div>

        <div className="table-container">
          <table className="data-table" style={{ fontSize: '12px' }}>
            <thead>
              <tr>
                <th style={{ width: '120px' }}>TANGGAL</th>
                {activeTableCols.map(colName => (
                  <th key={colName} style={{ textAlign: 'right', paddingRight: '24px', minWidth: '150px', fontSize: '11px', whiteSpace: 'normal' }}>
                    {colName}
                  </th>
                ))}
                <th style={{ textAlign: 'right', paddingRight: '24px', minWidth: '150px', color: 'var(--accent-primary)', fontWeight: 'bold' }}>
                  TOTAL
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedDates.length === 0 ? (
                <tr>
                  <td colSpan={2 + activeTableCols.length} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0' }}>
                    Tidak ada catatan setoran harian untuk periode / outlet tersaring.
                  </td>
                </tr>
              ) : (
                <>
                  {paginatedDates.map((dateStr, idx) => {
                    const rowTotal = getRowTotalForDate(dateStr);
                    return (
                      <tr key={dateStr} style={{ height: '42px' }}>
                        <td>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Calendar size={14} color="var(--text-muted)" />
                            <span>{dateStr}</span>
                          </span>
                        </td>
                        {activeTableCols.map(colName => {
                          const log = getLogForDateAndOutlet(dateStr, colName);
                          return (
                            <td 
                              key={colName}
                              onClick={() => handleCellClick(dateStr, colName)}
                              className="clickable-cell"
                              style={{ 
                                textAlign: 'right', 
                                paddingRight: '24px',
                                fontWeight: log ? 700 : 'normal',
                                color: log ? 'var(--success)' : 'rgba(255,255,255,0.2)'
                              }}
                            >
                              {log ? formatRp(log.jumlah_omzet) : '-'}
                            </td>
                          );
                        })}
                        <td style={{ textAlign: 'right', paddingRight: '24px', fontWeight: 700, color: 'var(--success)', background: 'rgba(255,255,255,0.01)' }}>
                          {formatRp(rowTotal)}
                        </td>
                      </tr>
                    );
                  })}
                  
                  {/* Total Row */}
                  <tr style={{ height: '45px', background: 'rgba(0, 173, 181, 0.08)', borderTop: '2px solid var(--border-color)', borderBottom: '2px solid var(--border-color)', fontWeight: 'bold' }}>
                    <td colSpan="1" style={{ textAlign: 'center', textTransform: 'uppercase', letterSpacing: '1px', color: '#fff', fontSize: '11px' }}>
                      TOTAL
                    </td>
                    {activeTableCols.map(colName => {
                      const colTotal = getColTotalForOutlet(colName);
                      return (
                        <td key={colName} style={{ textAlign: 'right', paddingRight: '24px', color: 'var(--success)' }}>
                          {formatRp(colTotal)}
                        </td>
                      );
                    })}
                    <td style={{ textAlign: 'right', paddingRight: '24px', color: 'var(--success)', background: 'rgba(0, 173, 181, 0.12)', fontSize: '13px' }}>
                      {formatRp(getGrandTotal())}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Daily Table Pagination */}
        {totalDailyPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
            <button
              disabled={dailyPage === 1}
              onClick={() => setDailyPage(prev => Math.max(prev - 1, 1))}
              className="btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.75rem', height: '32px' }}
            >
              Kembali
            </button>
            <span style={{ fontSize: '0.75rem', alignSelf: 'center', color: 'var(--text-muted)' }}>
              Halaman {dailyPage} dari {totalDailyPages}
            </span>
            <button
              disabled={dailyPage === totalDailyPages}
              onClick={() => setDailyPage(prev => Math.min(prev + 1, totalDailyPages))}
              className="btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.75rem', height: '32px' }}
            >
              Lanjut
            </button>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* PART 4: FORM MODAL "INPUT OMZET HARIAN" & LIFE-CYCLE RESET */}
      {/* ============================================================ */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(8px)',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div className="glass-card" style={{ maxWidth: '500px', width: '90%', padding: '30px', background: 'var(--bg-surface)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>
                {modalMode === 'create' ? 'CATAT SETORAN OMZET HARIAN' : 'UBAH DATA SETORAN OMZET'}
              </h2>
              <button 
                onClick={handleCloseModal} 
                disabled={isFormSaving}
                style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {formError && (
              <p style={{
                color: 'var(--danger)',
                background: 'var(--danger-glow)',
                padding: '10px',
                borderRadius: '8px',
                marginBottom: '16px',
                fontSize: '0.8rem',
                fontWeight: '600',
                border: '1px solid rgba(239, 68, 68, 0.2)'
              }}>
                {formError}
              </p>
            )}

            <form onSubmit={handleSaveRevenue} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="input-group" style={{ textAlign: 'left' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>PILIH CABANG OUTLET</label>
                <select
                  className="input-field"
                  value={formOutletId}
                  onChange={(e) => setFormOutletId(e.target.value)}
                  required
                  disabled={isFormSaving}
                  style={{ background: 'var(--bg-main)', color: '#fff', height: '42px' }}
                >
                  <option value="">-- PILIH CABANG --</option>
                  {outlets.map(o => (
                    <option key={o.id} value={o.id}>
                      {o.nama} {o.wilayah ? `(${o.wilayah})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="input-group" style={{ textAlign: 'left' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>TANGGAL SETORAN</label>
                <input
                  type="date"
                  className="input-field"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  required
                  disabled={isFormSaving}
                  style={{ height: '42px' }}
                />
              </div>

              <div className="input-group" style={{ textAlign: 'left' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>OMZET RIIL HARIAN (RP)</label>
                <input
                  type="number"
                  className="input-field"
                  placeholder="Contoh: 7500000"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  required
                  disabled={isFormSaving}
                  style={{ height: '42px' }}
                />
              </div>

              <div className="input-group" style={{ textAlign: 'left' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>DENDA STOK / VARIAN (RP)</label>
                <input
                  type="number"
                  className="input-field"
                  placeholder="Contoh: 150000"
                  value={formDendaStok}
                  onChange={(e) => setFormDendaStok(e.target.value)}
                  disabled={isFormSaving}
                  style={{ height: '42px' }}
                />
              </div>

              <div className="input-group" style={{ textAlign: 'left' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>PENANGGUNG JAWAB (PJ) SHIFT / PIC</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Nama lengkap penanggung jawab"
                  value={formPjShift}
                  onChange={(e) => setFormPjShift(e.target.value)}
                  required
                  disabled={isFormSaving}
                  style={{ height: '42px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '10px', flexDirection: 'column' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={isFormSaving}
                    style={{ flex: 2, justifyContent: 'center', height: '42px' }}
                  >
                    {isFormSaving ? (
                      <>
                        <Loader2 className="animate-spin" size={16} color="var(--bg-main)" />
                        <span>Menyimpan...</span>
                      </>
                    ) : (
                      <span>{modalMode === 'create' ? 'Simpan Rekap' : 'Simpan Perubahan'}</span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    disabled={isFormSaving}
                    className="btn-secondary"
                    style={{ flex: 1, height: '42px' }}
                  >
                    Batal
                  </button>
                </div>
                
                {modalMode === 'edit' && (
                  <button
                    type="button"
                    onClick={() => {
                      handleCloseModal();
                      handleDeleteClick(editingId);
                    }}
                    disabled={isFormSaving}
                    className="btn-secondary"
                    style={{
                      width: '100%',
                      height: '42px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      color: 'var(--danger)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      fontWeight: '700'
                    }}
                  >
                    🗑️ Hapus Catatan
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Delete Modal */}
      {confirmDelete.isOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(8px)'
        }}>
          <div className="glass-card" style={{ maxWidth: '400px', width: '90%', padding: '24px', textAlign: 'center' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', marginBottom: '12px' }}>KONFIRMASI HAPUS</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: '1.4' }}>
              Apakah Anda yakin ingin menghapus catatan rekap omzet harian ini secara permanen?
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={executeDeleteLog}
                className="btn-primary"
                style={{ flex: 1, background: 'var(--danger)', color: '#fff', border: 'none', height: '38px', justifyContent: 'center' }}
              >
                Hapus
              </button>
              <button
                onClick={() => setConfirmDelete({ isOpen: false, logId: null })}
                className="btn-secondary"
                style={{ flex: 1, height: '38px' }}
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
      <PDFCompileOverlay isOpen={isExportingPDF} />
    </div>
  );
}

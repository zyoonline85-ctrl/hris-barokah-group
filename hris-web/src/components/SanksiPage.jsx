import React, { useState, useEffect } from 'react';
import { AlertTriangle, Plus, Check, Trash2, ShieldAlert, Award, FileText, Search, Users, CheckCircle, Clock, Edit, Filter, Calendar } from 'lucide-react';
import { useHRIS } from '../context/HRISContext';

export default function SanksiPage({ token, API_URL }) {
  // ─── Subscribe ke HRIS Context — employees dari context = selalu sinkron! ──────
  const { activeEmployees: ctxActiveEmployees } = useHRIS();

  const toTitleCase = (str) => {
    if (!str) return '';
    return str
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const [sanctions, setSanctions] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Horizontal Filters State
  const [filterDate, setFilterDate] = useState('');
  const [filterMonths, setFilterMonths] = useState([]); // Array of numbers (1-12)
  const [showMonthPopover, setShowMonthPopover] = useState(false);
  const [filterYear, setFilterYear] = useState('');
  const [filterOutlet, setFilterOutlet] = useState('');
  const [filterType, setFilterType] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Form State
  const [showModal, setShowModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);

  // Input Fields
  const [empId, setEmpId] = useState('');
  const [empName, setEmpName] = useState('');
  const [empNik, setEmpNik] = useState('');
  const [empOutlet, setEmpOutlet] = useState('');
  const [empPosition, setEmpPosition] = useState('');
  
  const [sanctionType, setSanctionType] = useState('Surat Teguran Lisan 1');
  const [bentukKesalahan, setBentukKesalahan] = useState('Pelanggaran Teknis');
  const [reason, setReason] = useState(''); // Keterangan Perkara
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [publishedDate, setPublishedDate] = useState(new Date().toISOString().split('T')[0]);
  const [errorMsg, setErrorMsg] = useState('');

  // Available outlets derived from live employee data (synced with Kelola Karyawan)
  const [outletOptions, setOutletOptions] = useState([]);
  // Outlet yang dipilih di form (filter karyawan)
  const [formSelectedOutlet, setFormSelectedOutlet] = useState('');

  // Smart SP history for selected employee
  const [empSPHistory, setEmpSPHistory] = useState([]);

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'YAKIN',
    cancelText: 'BATAL',
    onConfirm: null
  });
  
  const [editingId, setEditingId] = useState(null);

  // Column Visibility State
  const [showColFilter, setShowColFilter] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    no: true,
    employeeId: true,
    employee: true,
    outlet: true,
    position: true,
    tipe_sanksi: true,
    tanggal_terbit: true,
    duration: true,
    status: true,
    actions: true
  });

  const colLabelMap = {
    no: 'No',
    employeeId: 'ID Karyawan',
    employee: 'Nama Lengkap',
    outlet: 'Outlet',
    position: 'Jabatan',
    tipe_sanksi: 'Jenis Peringatan',
    tanggal_terbit: 'Tanggal Terbit',
    duration: 'Masa Berlaku',
    status: 'Status SP',
    actions: 'Aksi'
  };

  // Derive outlets from live employee data for filter sync
  const getOutletsFromEmployees = (empList) => {
    const outlets = new Set();
    empList.forEach(e => {
      if (e.outlet && e.outlet.trim()) outlets.add(e.outlet.trim());
    });
    return Array.from(outlets).sort();
  };

  const fetchSanctions = async () => {
    try {
      const res = await fetch(`${API_URL}/sanctions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.status === 'success') {
        setSanctions(data.data);
        localStorage.setItem('disciplinary_records', JSON.stringify(data.data));
      }
    } catch (err) {
      console.error(err);
      // Fallback to local storage if offline or failed
      const cached = localStorage.getItem('disciplinary_records');
      if (cached) {
        setSanctions(JSON.parse(cached));
      }
    }
  };

  const fetchEmployees = async () => {
    // ⚡ Prioritas 1: Baca dari HRIS Context (sudah pasti terbaru & aktif)
    if (ctxActiveEmployees && ctxActiveEmployees.length > 0) {
      const normalized = ctxActiveEmployees.map(e => ({
        id: e.id,
        nik: e.nik || e.employee_id || '',
        full_name: e.full_name || e.name || '',
        position: e.position || '',
        department: e.department || '',
        outlet: e.outlet || '',
        status: e.employee_status || 'active'
      }));
      setEmployees(normalized);
      setOutletOptions(getOutletsFromEmployees(normalized));
      return;
    }

    // Prioritas 2: API endpoint sanksi
    try {
      const res = await fetch(`${API_URL}/sanctions/employees`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.status === 'success' && data.data.length > 0) {
        setEmployees(data.data);
        setOutletOptions(getOutletsFromEmployees(data.data));
        return;
      }
    } catch (err) {
      console.warn('fetchEmployees API failed, fallback to localStorage:', err);
    }

    // Prioritas 3: localStorage fallback
    try {
      const localRaw = localStorage.getItem('hris_employees');
      if (localRaw) {
        const localList = JSON.parse(localRaw);
        const activeEmps = localList
          .filter(e => !e.employee_status || e.employee_status === 'active')
          .map(e => ({
            id: e.id,
            nik: e.nik || e.employee_id || '',
            full_name: e.full_name || e.name || '',
            position: e.position || '',
            department: e.department || '',
            outlet: e.outlet || '',
            status: e.employee_status || 'active'
          }));
        setEmployees(activeEmps);
        setOutletOptions(getOutletsFromEmployees(activeEmps));
      }
    } catch (err) {
      console.error('fetchEmployees localStorage error:', err);
    }
  };

  const loadData = async () => {
    setLoading(true);
    await Promise.all([fetchSanctions(), fetchEmployees()]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [token, API_URL]);

  // ─── Reactive: saat karyawan berubah di Kelola Karyawan, Sanksi langsung update ──
  useEffect(() => {
    if (ctxActiveEmployees && ctxActiveEmployees.length > 0) {
      const normalized = ctxActiveEmployees.map(e => ({
        id: e.id,
        nik: e.nik || e.employee_id || '',
        full_name: e.full_name || e.name || '',
        position: e.position || '',
        department: e.department || '',
        outlet: e.outlet || '',
        status: e.employee_status || 'active'
      }));
      setEmployees(normalized);
      setOutletOptions(getOutletsFromEmployees(normalized));
    }
  }, [ctxActiveEmployees]);



  // Handle Employee Selection — auto-fill data & smart SP recommendation
  const handleEmployeeSelect = (emp) => {
    setEmpId(String(emp.id));
    setEmpName(emp.full_name);
    setEmpNik(emp.nik || '');
    setEmpOutlet(emp.outlet || 'CABANG UTAMA');
    setEmpPosition(emp.position || '');

    // Load this employee's SP history from already-fetched sanctions
    const history = sanctions
      .filter(s => String(s.employee_id) === String(emp.id))
      .sort((a, b) => new Date(b.tanggal_berlaku) - new Date(a.tanggal_berlaku));
    setEmpSPHistory(history);

    // Smart: recommend next SP type based on active sanctions
    const activeHistory = history.filter(s => s.status === 'aktif');
    const hasSP3 = activeHistory.some(s => s.tipe_sanksi === 'Surat Peringatan 3');
    const hasSP2 = activeHistory.some(s => s.tipe_sanksi === 'Surat Peringatan 2');
    const hasSP1 = activeHistory.some(s => s.tipe_sanksi === 'Surat Peringatan 1');
    const hasTeguran3 = activeHistory.some(s => s.tipe_sanksi === 'Surat Teguran Lisan 3');
    const hasTeguran2 = activeHistory.some(s => s.tipe_sanksi === 'Surat Teguran Lisan 2');
    const hasTeguran1 = activeHistory.some(s => s.tipe_sanksi === 'Surat Teguran Lisan 1');

    if (hasSP3) setSanctionType('PHK');
    else if (hasSP2) setSanctionType('Surat Peringatan 3');
    else if (hasSP1) setSanctionType('Surat Peringatan 2');
    else if (hasTeguran3) setSanctionType('Surat Peringatan 1');
    else if (hasTeguran2) setSanctionType('Surat Teguran Lisan 3');
    else if (hasTeguran1) setSanctionType('Surat Teguran Lisan 2');
    else setSanctionType('Surat Teguran Lisan 1');
  };

  // Legacy handler for edit mode compatibility
  const handleEmployeeChange = (employeeId, fallbackData = null) => {
    const emp = employees.find(e => e && e.id && String(e.id) === String(employeeId));
    if (emp) {
      handleEmployeeSelect(emp);
      setFormSelectedOutlet(emp.outlet || '');
    } else if (fallbackData) {
      setEmpId(String(employeeId));
      setEmpName(fallbackData.nama_karyawan || '');
      setEmpNik(fallbackData.nik_karyawan || '');
      setEmpOutlet(fallbackData.outlet || 'CABANG UTAMA');
      setEmpPosition(fallbackData.position || '');
      setFormSelectedOutlet(fallbackData.outlet || '');
      const history = sanctions
        .filter(s => String(s.employee_id) === String(employeeId))
        .sort((a, b) => new Date(b.tanggal_berlaku) - new Date(a.tanggal_berlaku));
      setEmpSPHistory(history);
    }
  };

  // Build optgroup map: { outletName: [emp, emp, ...] }
  const empByOutlet = employees.reduce((acc, emp) => {
    const key = emp.outlet || 'CABANG UTAMA';
    if (!acc[key]) acc[key] = [];
    acc[key].push(emp);
    return acc;
  }, {});

  // Count active SP for a given employee (from loaded sanctions)
  const getActiveSPCount = (employeeId) => {
    return sanctions.filter(s =>
      s && String(s.employee_id) === String(employeeId) && s.status === 'aktif'
    ).length;
  };

  // SP type severity order for badge coloring
  const getSPBadgeColor = (tipe) => {
    if (tipe === 'PHK') return { bg: '#7f1d1d', color: '#fca5a5', border: '#ef4444' };
    if (tipe?.startsWith('Surat Peringatan 3')) return { bg: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '#ef4444' };
    if (tipe?.startsWith('Surat Peringatan 2')) return { bg: 'rgba(249,115,22,0.15)', color: '#fb923c', border: '#fb923c' };
    if (tipe?.startsWith('Surat Peringatan 1')) return { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '#f59e0b' };
    return { bg: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '#6366f1' };
  };

  // Calculated Expiry Date
  const getCalculatedEndDate = () => {
    if (!publishedDate) return '';
    const start = new Date(publishedDate);
    const months = sanctionType.startsWith('Surat Teguran Lisan') ? 3 : 6;
    start.setMonth(start.getMonth() + months);
    return start.toISOString().split('T')[0];
  };

  // Dynamic Signee Matrix
  const getDynamicSignee = () => {
    if (sanctionType.startsWith('Surat Teguran Lisan')) {
      return 'SPV (Supervisor)';
    } else if (sanctionType === 'Surat Peringatan 1' || sanctionType === 'Surat Peringatan 2') {
      return 'Manajemen';
    } else {
      return 'General Manager';
    }
  };

  const handleOpenAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  // Trigger Review Modal
  const triggerReview = (e) => {
    e.preventDefault();
    if (!empId) {
      setErrorMsg('Silakan pilih karyawan terlebih dahulu.');
      return;
    }
    setErrorMsg('');
    setShowModal(false);
    setShowReviewModal(true);
  };

  const executeSubmit = async () => {
    setErrorMsg('');

    const payload = {
      employee_id: empId,
      tipe_sanksi: sanctionType,
      bentuk_kesalahan: bentukKesalahan,
      alasan: reason,
      tanggal_berlaku: effectiveDate,
      tanggal_terbit: publishedDate
    };

    try {
      let url = `${API_URL}/sanctions`;
      let method = 'POST';
      if (editingId) {
        url = `${API_URL}/sanctions/${editingId}`;
        method = 'PUT';
      }

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.status === 201 || data.status === 'success') {
        setShowReviewModal(false);
        resetForm();
        fetchSanctions();
      } else {
        setErrorMsg(data.message || 'Gagal menerbitkan sanksi.');
        setShowReviewModal(false);
        setShowModal(true);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Kesalahan koneksi internet.');
      setShowReviewModal(false);
      setShowModal(true);
    }
  };

  const triggerResolve = (id, currentStatus) => {
    const nextStatus = currentStatus === 'aktif' ? 'selesai' : 'aktif';
    setConfirmModal({
      isOpen: true,
      title: 'Konfirmasi Ubah Status',
      message: `Apakah Anda yakin ingin mengubah status sanksi ini menjadi: ${nextStatus.toUpperCase()}?`,
      confirmText: 'YAKIN SIMPAN',
      cancelText: 'BATAL',
      onConfirm: () => executeResolve(id, nextStatus)
    });
  };

  const executeResolve = async (id, nextStatus) => {
    try {
      const res = await fetch(`${API_URL}/sanctions/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: nextStatus })
      });
      const data = await res.json();
      if (data.status === 'success') {
        fetchSanctions();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const triggerDelete = (id) => {
    setConfirmModal({
      isOpen: true,
      title: 'Konfirmasi Hapus',
      message: 'Apakah Anda yakin ingin menghapus catatan sanksi ini?',
      confirmText: 'YA, HAPUS',
      cancelText: 'BATAL',
      onConfirm: () => executeDelete(id)
    });
  };

  const executeDelete = async (id) => {
    try {
      const res = await fetch(`${API_URL}/sanctions/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.status === 'success') {
        fetchSanctions();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const resetForm = () => {
    setEmpId('');
    setEmpName('');
    setEmpNik('');
    setEmpOutlet('');
    setEmpPosition('');
    setEmpSPHistory([]);
    setFormSelectedOutlet('');
    setSanctionType('Surat Teguran Lisan 1');
    setBentukKesalahan('Pelanggaran Teknis');
    setReason('');
    setEffectiveDate(new Date().toISOString().split('T')[0]);
    setPublishedDate(new Date().toISOString().split('T')[0]);
    setErrorMsg('');
    setEditingId(null);
  };

  const handleEdit = (sanc) => {
    setEditingId(sanc.id);
    // Pass sanction record as fallback data for employee info
    handleEmployeeChange(sanc.employee_id, sanc);
    setSanctionType(sanc.tipe_sanksi);
    setBentukKesalahan(sanc.bentuk_kesalahan || 'Pelanggaran Teknis');
    setReason(sanc.alasan);
    setEffectiveDate(sanc.tanggal_berlaku);
    setPublishedDate(sanc.tanggal_terbit || sanc.tanggal_berlaku || new Date().toISOString().split('T')[0]);
    setErrorMsg('');
    setShowModal(true);
  };

  // Official Printer-Friendly PDF Download Helper (window.print-based)
  const handleDownloadPDF = (s) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const printHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Surat Peringatan Resmi - ${s.nama_karyawan}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Georgia&family=Inter:wght@400;600;700&display=swap');
          body {
            font-family: 'Georgia', serif;
            color: #000;
            background-color: #fff;
            padding: 3cm 2.5cm;
            margin: 0;
            line-height: 1.6;
          }
          .header {
            text-align: center;
            margin-bottom: 2rem;
            border-bottom: 2px double #000;
            padding-bottom: 1.5rem;
          }
          .header h1 {
            font-family: 'Inter', sans-serif;
            font-size: 24px;
            font-weight: 700;
            margin: 0 0 5px 0;
            letter-spacing: 2px;
            text-transform: uppercase;
          }
          .header p {
            font-family: 'Inter', sans-serif;
            font-size: 12px;
            color: #555;
            margin: 0;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .title {
            text-align: center;
            font-size: 18px;
            font-weight: bold;
            text-decoration: underline;
            margin-bottom: 2rem;
            text-transform: uppercase;
            font-family: 'Inter', sans-serif;
          }
          .opening {
            margin-bottom: 1.5rem;
            font-style: italic;
          }
          .meta-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 2rem;
          }
          .meta-table td {
            padding: 6px 0;
            vertical-align: top;
            font-size: 14px;
          }
          .meta-table td.label {
            width: 30%;
            font-weight: bold;
            font-family: 'Inter', sans-serif;
          }
          .meta-table td.colon {
            width: 3%;
          }
          .meta-table td.value {
            width: 67%;
          }
          .body-content {
            margin-bottom: 3rem;
            text-align: justify;
            font-size: 14px;
            text-indent: 1.5cm;
          }
          .footer-note {
            margin-bottom: 3rem;
            font-style: italic;
            text-align: center;
          }
          .signature-section {
            margin-top: 4rem;
            display: flex;
            justify-content: space-between;
          }
          .signature-box {
            width: 200px;
            text-align: center;
          }
          .signature-space {
            height: 80px;
          }
          .signature-name {
            font-weight: bold;
            text-decoration: underline;
            font-family: 'Inter', sans-serif;
          }
          .signature-role {
            font-size: 12px;
            color: #555;
            font-family: 'Inter', sans-serif;
          }
          @media print {
            body {
              padding: 0;
              margin: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>BAROKAH GRUP</h1>
          <p>Sistem Penegakan Disiplin & Hukum Internal Perusahaan</p>
        </div>
        
        <div class="title">
          ${s.tipe_sanksi || ''}
        </div>
        
        <div class="opening">
          Dengan evaluasi internal manajemen atas pelaporan dari lapangan dan terbukti valid, maka kami memberikan informasi:
        </div>
        
        <table class="meta-table">
          <tr>
            <td class="label">Nama Lengkap</td>
            <td class="colon">:</td>
            <td class="value">${s.nama_karyawan}</td>
          </tr>
          <tr>
            <td class="label">ID Karyawan</td>
            <td class="colon">:</td>
            <td class="value">${s.nik_karyawan}</td>
          </tr>
          <tr>
            <td class="label">Jabatan / Outlet</td>
            <td class="colon">:</td>
            <td class="value">${s.position} / ${s.outlet}</td>
          </tr>
          <tr>
            <td class="label">Bentuk Kesalahan</td>
            <td class="colon">:</td>
            <td class="value">${s.bentuk_kesalahan || 'Pelanggaran Teknis'}</td>
          </tr>
          <tr>
            <td class="label">Masa Berlaku</td>
            <td class="colon">:</td>
            <td class="value">${s.tanggal_berlaku} s/d ${s.tanggal_berakhir}</td>
          </tr>
        </table>
        
        <div style="font-weight: bold; margin-bottom: 0.5rem; font-family: 'Inter', sans-serif;">KETERANGAN PERKARA / KRONOLOGI:</div>
        <div class="body-content">
          ${s.alasan}
        </div>
        
        <div style="font-size: 13px; font-weight: bold; text-align: center; margin: 1.5rem 0; font-family: 'Inter', sans-serif;">
          Surat ini diterbitkan pada tanggal ${s.tanggal_terbit || s.tanggal_berlaku} dan berlaku sampai dengan ${s.tanggal_berakhir} tanpa kesalahan
        </div>

        <div class="footer-note">
          "Semoga bisa ditindaklanjuti ke arah yang lebih baik."
        </div>
        
        <div class="signature-section">
          <div class="signature-box">
            <div>Dikeluarkan Oleh,</div>
            <div class="signature-space"></div>
            <div class="signature-name">HR Admin</div>
            <div class="signature-role">Manajemen Barokah Grup</div>
          </div>
          <div class="signature-box">
            <div>Diketahui Oleh,</div>
            <div class="signature-space"></div>
            <div class="signature-name">${s.diketahui_oleh || 'SPV'}</div>
            <div class="signature-role">Petinggi Berwenang</div>
          </div>
        </div>
        
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          }
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(printHtml);
    printWindow.document.close();
  };

  // Month popover selection
  const monthsList = [
    { value: 1, name: 'Januari' },
    { value: 2, name: 'Februari' },
    { value: 3, name: 'Maret' },
    { value: 4, name: 'April' },
    { value: 5, name: 'Mei' },
    { value: 6, name: 'Juni' },
    { value: 7, name: 'Juli' },
    { value: 8, name: 'Agustus' },
    { value: 9, name: 'September' },
    { value: 10, name: 'Oktober' },
    { value: 11, name: 'November' },
    { value: 12, name: 'Desember' }
  ];

  const handleMonthToggle = (mVal) => {
    setFilterMonths(prev => 
      prev.includes(mVal) ? prev.filter(x => x !== mVal) : [...prev, mVal]
    );
    setCurrentPage(1);
  };

  const handleSelectAllMonths = () => {
    if (filterMonths.length === 12) {
      setFilterMonths([]);
    } else {
      setFilterMonths(monthsList.map(m => m.value));
    }
    setCurrentPage(1);
  };

  // Statistics calculation
  const totalSanctions = sanctions.length;
  const activeSanctions = sanctions.filter(s => s && s.status === 'aktif').length;
  const resolvedSanctions = sanctions.filter(s => s && s.status === 'selesai').length;
  const spCount = sanctions.filter(s => s && ((s.tipe_sanksi || '').startsWith('Surat Peringatan') || s.tipe_sanksi === 'PHK')).length;

  // Filter Logic
  const filteredSanctions = sanctions.filter(s => {
    if (!s) return false;

    // Search filter
    const matchesSearch = 
      (s.nama_karyawan || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.nik_karyawan || '').includes(search) ||
      (s.alasan || '').toLowerCase().includes(search.toLowerCase());

    // Date filter
    const matchesDate = !filterDate || s.tanggal_berlaku === filterDate;

    // Month filter
    let matchesMonth = true;
    if (filterMonths.length > 0) {
      const d = s.tanggal_berlaku ? new Date(s.tanggal_berlaku) : null;
      const sancMonth = (d && !isNaN(d.getTime())) ? d.getMonth() + 1 : null;
      matchesMonth = sancMonth !== null && filterMonths.includes(sancMonth);
    }

    // Year filter
    let matchesYear = true;
    if (filterYear) {
      const d = s.tanggal_berlaku ? new Date(s.tanggal_berlaku) : null;
      const sancYear = (d && !isNaN(d.getTime())) ? d.getFullYear().toString() : '';
      matchesYear = sancYear === filterYear;
    }

    // Outlet filter
    const matchesOutlet = !filterOutlet || s.outlet === filterOutlet;

    // Type filter
    const matchesType = !filterType || s.tipe_sanksi === filterType;

    return matchesSearch && matchesDate && matchesMonth && matchesYear && matchesOutlet && matchesType;
  });

  // Pagination Logic
  const totalPages = Math.ceil(filteredSanctions.length / itemsPerPage) || 1;
  const indexOfLastRow = currentPage * itemsPerPage;
  const indexOfFirstRow = indexOfLastRow - itemsPerPage;
  const currentRows = filteredSanctions.slice(indexOfFirstRow, indexOfLastRow);

  const handlePageChange = (pageNo) => {
    if (pageNo < 1 || pageNo > totalPages) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentPage(pageNo);
      setIsTransitioning(false);
    }, 150);
  };

  useEffect(() => {
    // Reset to page 1 on filter changes
    setCurrentPage(1);
  }, [search, filterDate, filterMonths, filterYear, filterOutlet, filterType]);

  return (
    <div className="glass-card animate-fade-in" style={{ padding: '30px' }}>
      

      
      {/* Grid Ringkasan Sanksi */}
      <div className="stats-grid animate-fade-in" style={{ marginBottom: '28px', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
        
        {/* Card 1: Total Sanksi */}
        <div className="glass-card stat-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '12px', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <div className="stat-info">
            <span className="stat-label" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Sanksi</span>
            <div className="stat-value" style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginTop: '4px' }}>{totalSanctions} Kasus</div>
          </div>
          <div className="stat-icon" style={{ background: 'var(--primary-glow)', color: 'var(--primary-solid)', width: '38px', height: '38px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={18} />
          </div>
        </div>

        {/* Card 2: Status Aktif */}
        <div className="glass-card stat-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '12px', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <div className="stat-info">
            <span className="stat-label" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Sanksi Aktif</span>
            <div className="stat-value" style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--danger)', marginTop: '4px' }}>{activeSanctions} Kasus</div>
          </div>
          <div className="stat-icon" style={{ background: 'var(--danger-glow)', color: 'var(--danger)', width: '38px', height: '38px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={18} />
          </div>
        </div>

        {/* Card 3: Telah Selesai */}
        <div className="glass-card stat-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '12px', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <div className="stat-info">
            <span className="stat-label" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Telah Diselesaikan</span>
            <div className="stat-value" style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--success)', marginTop: '4px' }}>{resolvedSanctions} Kasus</div>
          </div>
          <div className="stat-icon" style={{ background: 'var(--success-glow)', color: 'var(--success)', width: '38px', height: '38px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle size={18} />
          </div>
        </div>

        {/* Card 4: Surat Peringatan (SP) */}
        <div className="glass-card stat-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '12px', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <div className="stat-info">
            <span className="stat-label" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Surat Peringatan & PHK</span>
            <div className="stat-value" style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--warning)', marginTop: '4px' }}>{spCount} Terbit</div>
          </div>
          <div className="stat-icon" style={{ background: 'var(--warning-glow)', color: 'var(--warning)', width: '38px', height: '38px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldAlert size={18} />
          </div>
        </div>

      </div>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="logo-icon" style={{ background: 'var(--danger-glow)', width: '42px', height: '42px' }}>
            <AlertTriangle size={20} color="var(--danger)" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Sanksi & Tindakan Disiplin Karyawan</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Penerbitan surat peringatan (SP) dan teguran kedisiplinan karyawan.</p>
          </div>
        </div>

        <button className="btn-primary" onClick={handleOpenAddModal} style={{ background: 'var(--danger)', color: '#fff' }}>
          <Plus size={16} />
          <span>Terbitkan Tindakan Sanksi</span>
        </button>
      </div>

      {/* FILTER PANEL HORIZONTAL */}
      <div className="glass-card" style={{
        padding: '20px',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        background: 'var(--bg-card)',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '15px',
        marginBottom: '20px',
        textAlign: 'left'
      }}>
        {/* Tanggal */}
        <div className="input-group">
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>FILTER TANGGAL</label>
          <input
            type="date"
            className="input-field"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            style={{ height: '38px', fontSize: '0.85rem' }}
          />
        </div>

        {/* Bulan (Custom Multi-select Popover) */}
        <div className="input-group" style={{ position: 'relative' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>FILTER BULAN</label>
          <button
            type="button"
            className="input-field"
            onClick={() => setShowMonthPopover(!showMonthPopover)}
            style={{
              height: '38px',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(0,0,0,0.2)',
              border: '1px solid var(--border-color)',
              color: '#fff',
              textAlign: 'left',
              width: '100%',
              cursor: 'pointer'
            }}
          >
            <span>
              {filterMonths.length === 0 
                ? 'Semua Bulan' 
                : filterMonths.length === 12 
                  ? 'Semua Bulan' 
                  : `${filterMonths.length} Bulan Terpilih`}
            </span>
            <Calendar size={14} color="var(--text-muted)" />
          </button>
          
          {showMonthPopover && (
            <div className="glass-card animate-fade-in" style={{
              position: 'absolute',
              top: '60px',
              left: 0,
              zIndex: 100,
              background: '#150c05',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '16px',
              width: '260px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>PILIH BULAN</span>
                <button
                  type="button"
                  onClick={handleSelectAllMonths}
                  style={{ background: 'none', border: 'none', color: 'var(--primary-solid)', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  {filterMonths.length === 12 ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px' }}>
                {monthsList.map(m => (
                  <label key={m.value} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#fff', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={filterMonths.includes(m.value)}
                      onChange={() => handleMonthToggle(m.value)}
                      style={{ accentColor: 'var(--primary-solid)' }}
                    />
                    <span>{m.name}</span>
                  </label>
                ))}
              </div>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setShowMonthPopover(false)}
                style={{ width: '100%', marginTop: '12px', height: '30px', fontSize: '0.8rem', background: 'var(--border-color)' }}
              >
                Tutup
              </button>
            </div>
          )}
        </div>

        {/* Tahun */}
        <div className="input-group">
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>FILTER TAHUN</label>
          <select
            className="input-field"
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            style={{ height: '38px', fontSize: '0.85rem' }}
          >
            <option value="">Semua Tahun</option>
            {Array.from({ length: 21 }, (_, i) => 2020 + i).map(y => (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </select>
        </div>

        {/* Dropdown Pilihan Outlet — sinkron dari data karyawan live */}
        <div className="input-group">
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>FILTER OUTLET</label>
          <select
            className="input-field"
            value={filterOutlet}
            onChange={(e) => setFilterOutlet(e.target.value)}
            style={{ height: '38px', fontSize: '0.85rem' }}
          >
            <option value="">Semua Outlet</option>
            {outletOptions.map((o, idx) => (
              <option key={idx} value={o}>{o}</option>
            ))}
          </select>
        </div>

        {/* Dropdown Jenis SP */}
        <div className="input-group">
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>JENIS SANKSI / SP</label>
          <select
            className="input-field"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={{ height: '38px', fontSize: '0.85rem' }}
          >
            <option value="">Semua Jenis</option>
            <option value="Surat Teguran Lisan 1">Surat Teguran Lisan 1</option>
            <option value="Surat Teguran Lisan 2">Surat Teguran Lisan 2</option>
            <option value="Surat Teguran Lisan 3">Surat Teguran Lisan 3</option>
            <option value="Surat Peringatan 1">Surat Peringatan 1 (SP1)</option>
            <option value="Surat Peringatan 2">Surat Peringatan 2 (SP2)</option>
            <option value="Surat Peringatan 3">Surat Peringatan 3 (SP3)</option>
            <option value="PHK">PHK</option>
          </select>
        </div>
      </div>

      {/* Search & Column Sorter Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ position: 'relative', width: '300px' }}>
          <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Cari Nama atau Perkara..."
            className="input-field"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '40px', paddingRight: '12px', height: '40px' }}
          />
        </div>

        {/* Column Visibility Filter */}
        <div style={{ position: 'relative' }}>
          <button
            className="btn-secondary"
            onClick={() => setShowColFilter(!showColFilter)}
            style={{ height: '40px', display: 'flex', alignItems: 'center', gap: '8px', padding: '0 16px', background: 'hsla(0, 0%, 100%, 0.02)' }}
          >
            <Filter size={16} />
            <span>SARING KOLOM</span>
          </button>
          {showColFilter && (
            <div className="glass-card animate-fade-in" style={{
              position: 'absolute',
              right: 0,
              top: '46px',
              zIndex: 50,
              padding: '16px',
              minWidth: '200px',
              background: 'rgba(15, 23, 42, 0.95)',
              backdropFilter: 'blur(12px)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              textAlign: 'left'
            }}>
              <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary-solid)', textTransform: 'uppercase', marginBottom: '4px' }}>TAMPILKAN KOLOM</h4>
              {Object.keys(visibleColumns).map(col => (
                <label key={col} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#fff', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={visibleColumns[col]}
                    onChange={() => setVisibleColumns(prev => ({ ...prev, [col]: !prev[col] }))}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--primary-solid)' }}
                  />
                  <span>{colLabelMap[col]}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sanctions Table */}
      {loading ? (
        <div className="spinner-container">
          <div className="loading-spinner"></div>
          <p className="loading-text">Memuat data sanksi...</p>
        </div>
      ) : (
        <div style={{ transition: 'opacity 0.15s ease-in-out', opacity: isTransitioning ? 0 : 1 }}>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  {visibleColumns.no && <th style={{ width: '60px' }}>No</th>}
                  {visibleColumns.employeeId && <th>ID Karyawan</th>}
                  {visibleColumns.employee && <th>Nama Lengkap</th>}
                  {visibleColumns.outlet && <th>Outlet</th>}
                  {visibleColumns.position && <th>Jabatan</th>}
                  {visibleColumns.tipe_sanksi && <th>Jenis Peringatan</th>}
                  {visibleColumns.tanggal_terbit && <th>Tanggal Terbit</th>}
                  {visibleColumns.duration && <th>Masa Berlaku</th>}
                  {visibleColumns.status && <th>Status SP</th>}
                  {visibleColumns.actions && <th style={{ width: '220px' }}>Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {currentRows.length === 0 ? (
                  <tr>
                    <td colSpan={Object.values(visibleColumns).filter(Boolean).length} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Mulus: Belum ada pelanggaran/sanksi disiplin terbit.</td>
                  </tr>
                ) : (
                  currentRows.map((s, index) => {
                    const rowNumber = indexOfFirstRow + index + 1;
                    return (
                      <tr key={s.id}>
                        {visibleColumns.no && <td>{rowNumber}</td>}
                        {visibleColumns.employeeId && (
                          <td style={{ color: 'var(--text-main)', fontFamily: 'monospace', fontWeight: 'bold' }}>
                            {s.nik_karyawan}
                          </td>
                        )}
                        {visibleColumns.employee && <td style={{ fontWeight: 600 }}>{s.nama_karyawan}</td>}
                        {visibleColumns.outlet && <td>{s.outlet || 'CABANG UTAMA'}</td>}
                        {visibleColumns.position && <td style={{ color: 'var(--text-main)' }}>{s.position}</td>}
                        {visibleColumns.tipe_sanksi && (
                          <td>
                            <span 
                              className={`badge ${(s.tipe_sanksi || '').startsWith('Surat Peringatan') ? 'badge-danger' : s.tipe_sanksi === 'PHK' ? 'badge-danger' : 'badge-warning'}`}
                              style={{ 
                                fontWeight: 700,
                                background: (s.tipe_sanksi || '').startsWith('Surat Teguran') ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                color: (s.tipe_sanksi || '').startsWith('Surat Teguran') ? '#f59e0b' : '#ef4444'
                              }}
                            >
                              {s.tipe_sanksi || ''}
                            </span>
                          </td>
                        )}
                        {visibleColumns.tanggal_terbit && (
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-main)', fontFamily: 'monospace' }}>
                            {s.tanggal_terbit || s.tanggal_berlaku}
                          </td>
                        )}
                        {visibleColumns.duration && (
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {s.tanggal_berlaku} <span style={{ color: 'var(--primary-solid)' }}>s/d</span> {s.tanggal_berakhir}
                          </td>
                        )}
                        {visibleColumns.status && (
                          <td>
                            <button
                              onClick={() => triggerResolve(s.id, s.status)}
                              style={{ 
                                fontWeight: 800,
                                background: s.status === 'aktif' ? '#2ECC71' : 'var(--border-color)',
                                color: s.status === 'aktif' ? 'var(--bg-surface)' : 'var(--text-main)',
                                border: s.status === 'aktif' ? '1px solid #2ECC71' : '1px solid #7c5c36',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'inline-block'
                              }}
                            >
                              {s.status === 'aktif' ? 'ACTIVE' : 'INACTIVE'}
                            </button>
                          </td>
                        )}
                        {visibleColumns.actions && (
                          <td>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              {/* Download PDF */}
                              <button
                                onClick={() => handleDownloadPDF(s)}
                                style={{
                                  background: 'var(--primary-glow)',
                                  border: '1px solid var(--primary-solid)',
                                  color: 'var(--text-main)',
                                  padding: '5px 8px',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                                title="Download PDF"
                              >
                                <FileText size={13} />
                                <span>PDF</span>
                              </button>
                              
                              {/* Edit */}
                              <button
                                onClick={() => handleEdit(s)}
                                style={{ background: 'hsla(0,0%,100%,0.05)', border: 'none', color: '#fff', padding: '6px', borderRadius: '6px', cursor: 'pointer' }}
                                title="Ubah Sanksi"
                              >
                                <Edit size={13} />
                              </button>

                              {/* Delete */}
                              <button
                                onClick={() => triggerDelete(s.id)}
                                style={{ background: 'var(--danger-glow)', border: 'none', color: 'var(--danger)', padding: '6px', borderRadius: '6px', cursor: 'pointer' }}
                                title="Hapus Log"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Pagination */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Menampilkan {indexOfFirstRow + 1} - {Math.min(indexOfLastRow, filteredSanctions.length)} dari {filteredSanctions.length} baris
            </span>
            <div style={{ display: 'flex', gap: '5px' }}>
              <button
                className="btn-secondary"
                disabled={currentPage === 1}
                onClick={() => handlePageChange(currentPage - 1)}
                style={{ padding: '4px 10px', fontSize: '0.8rem' }}
              >
                Sebelumnya
              </button>
              {Array.from({ length: totalPages }).map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => handlePageChange(idx + 1)}
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.8rem',
                    border: 'none',
                    borderRadius: '4px',
                    background: currentPage === idx + 1 ? 'var(--primary-solid)' : 'hsla(0,0%,100%,0.05)',
                    color: '#fff',
                    cursor: 'pointer',
                    fontWeight: currentPage === idx + 1 ? 'bold' : 'normal'
                  }}
                >
                  {idx + 1}
                </button>
              ))}
              <button
                className="btn-secondary"
                disabled={currentPage === totalPages}
                onClick={() => handlePageChange(currentPage + 1)}
                style={{ padding: '4px 10px', fontSize: '0.8rem' }}
              >
                Berikutnya
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- FORM MODAL SANKSI --- */}
      {showModal && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="glass-card modal-content animate-fade-in" style={{ maxWidth: '560px', width: '92%' }}>
            <h3 style={{ marginBottom: '20px', fontWeight: 600, color: 'var(--danger)', textAlign: 'left' }}>
              {editingId ? '✏️ Ubah Tindakan Disiplin / SP' : '⚠️ Terbitkan Tindakan Disiplin / SP'}
            </h3>

            {errorMsg && (
              <p style={{ color: 'var(--danger)', background: 'var(--danger-glow)', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem', textAlign: 'left' }}>
                {errorMsg}
              </p>
            )}

            <form onSubmit={triggerReview} style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
              
              {/* LANGKAH 1: PILIH OUTLET */}
              <div className="input-group">
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600 }}>Pilih Outlet</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{employees.length} karyawan aktif &bull; {outletOptions.length} outlet</span>
                </label>
                <select className="input-field" value={formSelectedOutlet}
                  onChange={(e) => { setFormSelectedOutlet(e.target.value); setEmpId(''); setEmpName(''); setEmpNik(''); setEmpOutlet(''); setEmpPosition(''); setEmpSPHistory([]); }}
                  style={{ height: '44px', fontSize: '0.9rem' }}>
                  <option value="">-- Pilih Outlet Terlebih Dahulu --</option>
                  {outletOptions.map((o, i) => {
                    const count = employees.filter(e => (e.outlet || '').trim() === o).length;
                    return <option key={i} value={o}>{o}  ({count} karyawan aktif)</option>;
                  })}
                </select>
                {employees.length === 0 && !loading && (
                  <p style={{ fontSize: '0.78rem', color: 'var(--danger)', marginTop: '6px' }}>
                    Belum ada data karyawan. Tambahkan dulu di halaman Kelola Karyawan.
                  </p>
                )}
              </div>

              {/* LANGKAH 2: PILIH KARYAWAN (muncul setelah outlet dipilih) */}
              {formSelectedOutlet && (() => {
                const listKaryawan = employees
                  .filter(e => (e.outlet || '').trim() === formSelectedOutlet)
                  .sort((a, b) => a.full_name.localeCompare(b.full_name));
                return (
                  <div className="input-group">
                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600 }}>Pilih Nama Karyawan</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{listKaryawan.length} karyawan di {formSelectedOutlet}</span>
                    </label>
                    <select className="input-field" value={empId}
                      onChange={(e) => {
                        const selectedId = e.target.value;
                        if (!selectedId) { setEmpId(''); setEmpName(''); setEmpNik(''); setEmpOutlet(''); setEmpPosition(''); setEmpSPHistory([]); return; }
                        const emp = listKaryawan.find(em => String(em.id) === selectedId);
                        if (emp) handleEmployeeSelect(emp);
                      }}
                      required
                      style={{ height: '44px', fontSize: '0.9rem' }}>
                      <option value="">-- Pilih Nama Karyawan --</option>
                      {listKaryawan.map(emp => {
                        const spCount = getActiveSPCount(emp.id);
                        return (
                          <option key={emp.id} value={String(emp.id)}>
                            {emp.full_name}{spCount > 0 ? `  (⚠️ ${spCount} SP aktif)` : ''}
                          </option>
                        );
                      })}
                    </select>
                    {listKaryawan.length === 0 && (
                      <p style={{ fontSize: '0.78rem', color: 'var(--warning)', marginTop: '6px' }}>Tidak ada karyawan aktif di outlet ini.</p>
                    )}
                  </div>
                );
              })()}

              {/* INFO KARYAWAN + RIWAYAT SP (muncul setelah karyawan dipilih) */}
              {empId && (
                <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '0.82rem' }}>
                    <div><span style={{ color: 'var(--text-muted)' }}>NIK </span><strong>{empNik || '—'}</strong></div>
                    <div><span style={{ color: 'var(--text-muted)' }}>Jabatan </span><strong>{empPosition || '—'}</strong></div>
                    <div><span style={{ color: 'var(--text-muted)' }}>Outlet </span><strong>{empOutlet || '—'}</strong></div>
                  </div>
                  {empSPHistory.length > 0 ? (
                    <div>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: '6px' }}>RIWAYAT SANKSI</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {empSPHistory.slice(0, 6).map((s, i) => {
                          const col = getSPBadgeColor(s.tipe_sanksi);
                          return (
                            <span key={i} style={{ background: col.bg, color: col.color, border: `1px solid ${col.border}`, borderRadius: '20px', padding: '3px 10px', fontSize: '0.7rem', fontWeight: 600, opacity: s.status === 'selesai' ? 0.5 : 1 }}>
                              {s.tipe_sanksi} {s.status === 'selesai' ? '✓' : '●'}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.78rem', color: 'var(--success)' }}>✓ Belum pernah menerima sanksi</div>
                  )}
                  <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px dashed rgba(239,68,68,0.3)', borderRadius: '8px', padding: '8px 12px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: 'var(--danger)' }}>⚡</span>
                    <span style={{ color: 'var(--text-muted)' }}>Rekomendasi sistem:</span>
                    <strong style={{ color: 'var(--danger)' }}>{sanctionType}</strong>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginLeft: 'auto' }}>berdasarkan riwayat aktif</span>
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="input-group">
                  <label>Outlet Terdaftar</label>
                  <input
                    type="text"
                    className="input-field"
                    value={empOutlet}
                    readOnly
                    disabled
                    style={{ background: 'rgba(255,255,255,0.02)', color: 'var(--text-muted)' }}
                  />
                </div>
                <div className="input-group">
                  <label>Jabatan Terdaftar</label>
                  <input
                    type="text"
                    className="input-field"
                    value={empPosition}
                    readOnly
                    disabled
                    style={{ background: 'rgba(255,255,255,0.02)', color: 'var(--text-muted)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="input-group">
                  <label>Jenis Tindakan Peringatan</label>
                  <select
                    className="input-field"
                    value={sanctionType}
                    onChange={(e) => setSanctionType(e.target.value)}
                    required
                  >
                    <option value="Surat Teguran Lisan 1">Surat Teguran Lisan 1</option>
                    <option value="Surat Teguran Lisan 2">Surat Teguran Lisan 2</option>
                    <option value="Surat Teguran Lisan 3">Surat Teguran Lisan 3</option>
                    <option value="Surat Peringatan 1">Surat Peringatan 1</option>
                    <option value="Surat Peringatan 2">Surat Peringatan 2</option>
                    <option value="Surat Peringatan 3">Surat Peringatan 3</option>
                    <option value="PHK">PHK</option>
                  </select>
                </div>
                <div className="input-group">
                  <label>Bentuk Kesalahan</label>
                  <select
                    className="input-field"
                    value={bentukKesalahan}
                    onChange={(e) => setBentukKesalahan(e.target.value)}
                    required
                  >
                    <option value="Pelanggaran Teknis">Pelanggaran Teknis</option>
                    <option value="Pelanggaran Kode Etik">Pelanggaran Kode Etik</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
                <div className="input-group">
                  <label>Tanggal Diterbitkan</label>
                  <input
                    type="date"
                    className="input-field"
                    value={publishedDate}
                    onChange={(e) => setPublishedDate(e.target.value)}
                    required
                  />
                </div>
                <div className="input-group">
                  <label>Tanggal Berlaku Sanksi</label>
                  <input
                    type="date"
                    className="input-field"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    required
                  />
                </div>
                <div className="input-group">
                  <label>Masa Kadaluwarsa (Otomatis)</label>
                  <input
                    type="text"
                    className="input-field"
                    value={`${getCalculatedEndDate()} (${sanctionType.startsWith('Surat Teguran Lisan') ? '3' : '6'} Bulan)`}
                    readOnly
                    disabled
                    style={{ background: 'rgba(255,255,255,0.02)', color: 'var(--text-muted)' }}
                  />
                </div>
              </div>

              <div className="input-group">
                <label>Keterangan Perkara / Kronologi Kasus</label>
                <textarea
                  className="input-field"
                  rows="4"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ketik kronologi perkara secara jelas dan formal di sini..."
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center', background: 'var(--danger)' }}>
                  <AlertTriangle size={16} />
                  <span>Review Draf Surat</span>
                </button>
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)} style={{ flex: 1 }}>
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- HALAMAN REVIEW LEGALITAS DRAFT SURAT (PREVIEW MODAL) --- */}
      {showReviewModal && (
        <div className="modal-backdrop">
          <div className="glass-card modal-content animate-fade-in" style={{ maxWidth: '650px', width: '95%', padding: '0px', overflow: 'hidden' }}>
            {/* Modal Header */}
            <div style={{ background: 'var(--border-color)', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--border-color)' }}>
              <ShieldAlert size={22} color="var(--text-main)" />
              <div style={{ textAlign: 'left' }}>
                <h4 style={{ color: 'var(--text-main)', margin: 0, fontWeight: 700, fontSize: '1.1rem' }}>HALAMAN REVIEW LEGALITAS DRAF SURAT</h4>
                <span style={{ fontSize: '0.75rem', color: 'rgba(238, 238, 238, 0.6)' }}>Sistem Penegakan Disiplin & Hukum Internal Perusahaan</span>
              </div>
            </div>

            {/* Modal Body (Surat Resmi Preview) */}
            <div style={{
              background: '#fff',
              color: '#000',
              padding: '30px 40px',
              fontFamily: 'Georgia, serif',
              textAlign: 'left',
              maxHeight: '450px',
              overflowY: 'auto',
              borderBottom: '1px solid #ddd',
              fontSize: '0.9rem',
              lineHeight: 1.6
            }}>
              <div style={{ textSelf: 'center', textAlign: 'center', marginBottom: '20px', borderBottom: '2px double #000', paddingBottom: '10px' }}>
                <h2 style={{ margin: '0 0 5px 0', fontFamily: 'sans-serif', fontSize: '20px', letterSpacing: '1px', textTransform: 'uppercase', color: '#000' }}>BAROKAH GRUP</h2>
                <p style={{ margin: 0, fontSize: '10px', color: '#555', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Disciplinary & Corporate Legal SP Engine</p>
              </div>

              <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '15px', textDecoration: 'underline', marginBottom: '20px', textTransform: 'uppercase' }}>
                {sanctionType}
              </div>

              <div style={{ marginBottom: '15px', fontStyle: 'italic' }}>
                "Dengan evaluasi internal manajemen atas pelaporan dari lapangan dan terbukti valid, maka kami memberikan informasi :"
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
                <tbody>
                  <tr>
                    <td style={{ width: '30%', fontWeight: 'bold', padding: '4px 0' }}>Nama Lengkap</td>
                    <td style={{ width: '3%', padding: '4px 0' }}>:</td>
                    <td style={{ width: '67%', padding: '4px 0' }}>{empName}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 'bold', padding: '4px 0' }}>ID Karyawan</td>
                    <td style={{ padding: '4px 0' }}>:</td>
                    <td style={{ padding: '4px 0' }}>{empNik}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 'bold', padding: '4px 0' }}>Jabatan / Outlet</td>
                    <td style={{ padding: '4px 0' }}>:</td>
                    <td style={{ padding: '4px 0' }}>{empPosition} / {empOutlet}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 'bold', padding: '4px 0' }}>Jenis Peringatan</td>
                    <td style={{ padding: '4px 0' }}>:</td>
                    <td style={{ padding: '4px 0' }}>{sanctionType}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 'bold', padding: '4px 0' }}>Bentuk Kesalahan</td>
                    <td style={{ padding: '4px 0' }}>:</td>
                    <td style={{ padding: '4px 0' }}>{bentukKesalahan}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 'bold', padding: '4px 0' }}>Masa Berlaku</td>
                    <td style={{ padding: '4px 0' }}>:</td>
                    <td style={{ padding: '4px 0' }}>{effectiveDate} s/d {getCalculatedEndDate()}</td>
                  </tr>
                </tbody>
              </table>

              <div style={{ fontSize: '13px', fontWeight: 'bold', textAlign: 'center', margin: '15px 0', fontFamily: 'sans-serif', color: '#000' }}>
                Surat ini diterbitkan pada tanggal {publishedDate} dan berlaku sampai dengan {getCalculatedEndDate()} tanpa kesalahan
              </div>

              <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>KETERANGAN PERKARA / KRONOLOGI:</div>
              <div style={{ textIndent: '1.5cm', textAlign: 'justify', marginBottom: '25px', color: '#111' }}>
                {reason}
              </div>

              <div style={{ textAlign: 'center', fontStyle: 'italic', marginBottom: '25px' }}>
                "Semoga bisa ditindaklanjuti ke arah yang lebih baik."
              </div>

              {/* Signature Block */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px' }}>
                <div style={{ width: '150px', textAlign: 'center' }}>
                  <div>Dibuat Oleh,</div>
                  <div style={{ height: '50px' }}></div>
                  <div style={{ fontWeight: 'bold', textDecoration: 'underline' }}>HR Admin</div>
                  <div style={{ fontSize: '10px', color: '#555' }}>Manajemen Barokah</div>
                </div>
                <div style={{ width: '150px', textAlign: 'center' }}>
                  <div>Diketahui Oleh,</div>
                  <div style={{ height: '50px' }}></div>
                  <div style={{ fontWeight: 'bold', textDecoration: 'underline' }}>{getDynamicSignee()}</div>
                  <div style={{ fontSize: '10px', color: '#555' }}>Petinggi Berwenang</div>
                </div>
              </div>
            </div>

            {/* Modal Footer Controls */}
            <div style={{ background: 'var(--bg-card)', padding: '16px 24px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={executeSubmit}
                style={{
                  background: 'var(--text-main)',
                  color: '#000',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '6px',
                  fontWeight: '700',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <CheckCircle size={16} />
                <span>SETUJU & TERBITKAN</span>
              </button>
              
              <button
                type="button"
                onClick={() => {
                  setShowReviewModal(false);
                  setShowModal(true);
                }}
                className="btn-secondary"
                style={{ padding: '10px 20px', fontSize: '0.85rem' }}
              >
                KEMBALI KE EDIT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="confirm-overlay">
          <div className="confirm-card">
            <h3 className="confirm-title">{confirmModal.title}</h3>
            <p className="confirm-message">{confirmModal.message}</p>
            <div className="confirm-actions">
              <button className="btn-confirm-yes" onClick={() => { confirmModal.onConfirm(); setConfirmModal(prev => ({ ...prev, isOpen: false })); }}>
                {confirmModal.confirmText}
              </button>
              <button className="btn-confirm-cancel" onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}>
                {confirmModal.cancelText}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

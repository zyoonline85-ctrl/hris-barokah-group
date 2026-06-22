import React, { useState, useEffect } from 'react';
import { Check, X, FileText, CheckCircle2, XCircle, Search, Users, ShieldAlert, Clock, Edit, Trash2, Eye, Send, ExternalLink, AlertTriangle } from 'lucide-react';
import { getRoleFromPosition } from '../utils/security';

export default function Leaves({ token, API_URL, userPermissions, user }) {
  const toTitleCase = (str) => {
    if (!str) return '';
    return str
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getMaxLeaveLimit = () => {
    try {
      const raw = localStorage.getItem('corporate_policies');
      if (!raw) return 2;
      const policiesList = JSON.parse(raw);
      if (!Array.isArray(policiesList)) return 2;

      const matchingPolicy = policiesList.find(p => p.status === 'ACTIVE' && p.nama_aturan === 'Batasan Pengajuan Libur & Denda Operasional');
      if (matchingPolicy && matchingPolicy.deskripsi) {
        const match = matchingPolicy.deskripsi.match(/Maksimal pengajuan libur adalah\s*(\d+)\s*hari/i);
        if (match) {
          return parseInt(match[1], 10);
        }
      }
    } catch (e) {
      console.error('Error parsing max leave limit policy:', e);
    }
    return 2;
  };

  const maxLeaveLimit = getMaxLeaveLimit();

  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [activeMainTab, setActiveMainTab] = useState('izin_sakit'); // 'izin_sakit' | 'kasbon'
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'YAKIN',
    cancelText: 'BATAL',
    onConfirm: null
  });

  // Modal States
  const [previewModal, setPreviewModal] = useState({ isOpen: false, leave: null });
  const [showModal, setShowModal] = useState(false); // Edit Modal
  const [editingId, setEditingId] = useState(null);
  const [leaveType, setLeaveType] = useState('cuti');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      let url = `${API_URL}/leaves`;
      if (statusFilter) url += `?status=${statusFilter}`;

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.status === 'success') {
        setLeaves(data.data);
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, [token, API_URL, statusFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, activeMainTab]);

  const handleEdit = (lv) => {
    setEditingId(lv.id);
    setLeaveType(lv.leave_type);
    setStartDate(lv.start_date);
    setEndDate(lv.end_date);
    setReason(lv.reason);
    setAttachmentUrl(lv.attachment_url || '');
    setErrorMsg('');
    setShowModal(true);
  };

  const triggerSave = (e) => {
    e.preventDefault();
    setConfirmModal({
      isOpen: true,
      title: 'Konfirmasi Simpan',
      message: 'Apakah Anda yakin ingin menyimpan perubahan pengajuan cuti ini?',
      confirmText: 'YAKIN SIMPAN',
      cancelText: 'BATAL',
      onConfirm: () => executeSubmit()
    });
  };

  const executeSubmit = async () => {
    setErrorMsg('');
    const payload = {
      leave_type: leaveType,
      start_date: startDate,
      end_date: endDate,
      reason: reason,
      attachment_url: attachmentUrl
    };

    try {
      const res = await fetch(`${API_URL}/leaves/${editingId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.status === 'success') {
        setShowModal(false);
        fetchLeaves();
      } else {
        setErrorMsg(data.message || 'Gagal menyimpan perubahan.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Kesalahan koneksi internet.');
    }
  };

  const triggerDelete = (id) => {
    setConfirmModal({
      isOpen: true,
      title: 'Konfirmasi Hapus',
      message: 'Apakah Anda yakin ingin menghapus pengajuan cuti ini secara permanen?',
      confirmText: 'YA, HAPUS',
      cancelText: 'BATAL',
      onConfirm: () => executeDelete(id)
    });
  };

  const executeDelete = async (id) => {
    try {
      const res = await fetch(`${API_URL}/leaves/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.status === 'success') {
        fetchLeaves();
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const triggerAction = (id, status) => {
    const statusLabel = status === 'approved' ? 'DISETUJUI' : 'DITOLAK';
    setConfirmModal({
      isOpen: true,
      title: 'Konfirmasi Persetujuan',
      message: `Apakah Anda yakin ingin memproses pengajuan ini dengan status: ${statusLabel}?`,
      confirmText: 'YAKIN SIMPAN',
      cancelText: 'BATAL',
      onConfirm: () => executeAction(id, status)
    });
  };

  const runApprovalCrossAutomations = (leaveId, actionStatus) => {
    if (actionStatus !== 'approved') return;

    const lv = leaves.find(l => String(l.id) === String(leaveId));
    if (!lv) return;

    const empId = lv.employee_id;
    const empNik = lv.nik;
    const empFullName = lv.full_name;
    const empOutlet = lv.outlet;
    
    const dateParts = lv.start_date.split('-');
    const requestYear = parseInt(dateParts[0], 10);
    const requestMonth = parseInt(dateParts[1], 10);

    // AUTOMATION A: Kasbon
    if (lv.leave_type === 'kasbon') {
      const amount = parseFloat(lv.cash_advance_amount) || 0;
      
      let slips = [];
      try {
        slips = JSON.parse(localStorage.getItem('hris_payroll_slips') || '[]');
      } catch (e) {}

      let slipIndex = slips.findIndex(s => 
        (String(s.employee_id) === String(empId) || s.nik === empNik) &&
        s.bulan === requestMonth &&
        s.tahun === requestYear
      );

      if (slipIndex !== -1) {
        let slip = slips[slipIndex];
        if (!slip.slip_sent) {
          if (!slip.deduction) slip.deduction = {};
          slip.deduction.kasbon = String((parseFloat(slip.deduction.kasbon) || 0) + amount);

          // Recalculate THP
          const totalIncome = Object.values(slip.income || {}).reduce((a, b) => a + (parseFloat(b) || 0), 0);
          const totalDeduction = Object.values(slip.deduction || {}).reduce((a, b) => a + (parseFloat(b) || 0), 0);
          slip.total_pendapatan = totalIncome;
          slip.total_pengeluaran = totalDeduction;
          slip.thp = totalIncome - totalDeduction;

          slips[slipIndex] = slip;
          localStorage.setItem('hris_payroll_slips', JSON.stringify(slips));
        }
      }
    }

    if (lv.leave_type === 'cuti' || lv.leave_type === 'izin' || lv.leave_type === 'sakit') {
      let attendanceHistory = [];
      try {
        attendanceHistory = JSON.parse(localStorage.getItem('hris_attendances_history') || '[]');
      } catch (e) {}

      const getDatesInRange = (startStr, endStr) => {
        const dates = [];
        const start = new Date(startStr);
        const end = new Date(endStr);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return dates;
        let current = new Date(start);
        while (current <= end) {
          const yyyy = current.getFullYear();
          const mm = String(current.getMonth() + 1).padStart(2, '0');
          const dd = String(current.getDate()).padStart(2, '0');
          dates.push(`${yyyy}-${mm}-${dd}`);
          current.setDate(current.getDate() + 1);
        }
        return dates;
      };

      const dates = getDatesInRange(lv.start_date, lv.end_date);
      let absensiPenalty = 0;
      let peakDaysList = [];
      try {
        peakDaysList = JSON.parse(localStorage.getItem('peak_day_rules') || '[]');
      } catch (e) {}

      const labelStatus = lv.leave_type === 'sakit' ? 'Sakit (Disetujui)' : (lv.leave_type === 'izin' ? 'Izin (Disetujui)' : 'Libur Reguler (Disetujui)');

      dates.forEach(d => {
        const dObj = new Date(d);
        const day = dObj.getDay();
        const isWeekend = day === 0 || day === 6;
        
        const y = dObj.getFullYear();
        const m = dObj.getMonth() + 1;
        const dayNum = dObj.getDate();
        const isPeakDay = peakDaysList.some(p => parseInt(p.tanggal) === dayNum && parseInt(p.bulan) === m && parseInt(p.tahun) === y);

        if (isPeakDay) {
          absensiPenalty += 250000;
        } else if (isWeekend) {
          absensiPenalty += 200000;
        }

        let attIndex = attendanceHistory.findIndex(h => 
          (String(h.employee_id) === String(empId) || h.nik === empNik) && h.date === d
        );

        const attObj = {
          id: attIndex !== -1 ? attendanceHistory[attIndex].id : `att-${Date.now()}-${d}`,
          employee_id: empId,
          nik: empNik,
          full_name: empFullName,
          outlet: empOutlet,
          date: d,
          clock_in: '',
          clock_out: '',
          status_in: labelStatus,
          notes: labelStatus
        };

        if (attIndex !== -1) {
          attendanceHistory[attIndex] = { ...attendanceHistory[attIndex], ...attObj };
        } else {
          attendanceHistory.push(attObj);
        }
      });

      localStorage.setItem('hris_attendances_history', JSON.stringify(attendanceHistory));

      if (absensiPenalty > 0) {
        let slips = [];
        try {
          slips = JSON.parse(localStorage.getItem('hris_payroll_slips') || '[]');
        } catch (e) {}

        let slipIndex = slips.findIndex(s => 
          (String(s.employee_id) === String(empId) || s.nik === empNik) &&
          s.bulan === requestMonth &&
          s.tahun === requestYear
        );

        if (slipIndex !== -1) {
          let slip = slips[slipIndex];
          if (!slip.slip_sent) {
            if (!slip.deduction) slip.deduction = {};
            slip.deduction.absensi = String((parseFloat(slip.deduction.absensi) || 0) + absensiPenalty);

            const totalIncome = Object.values(slip.income || {}).reduce((a, b) => a + (parseFloat(b) || 0), 0);
            const totalDeduction = Object.values(slip.deduction || {}).reduce((a, b) => a + (parseFloat(b) || 0), 0);
            slip.total_pendapatan = totalIncome;
            slip.total_pengeluaran = totalDeduction;
            slip.thp = totalIncome - totalDeduction;

            slips[slipIndex] = slip;
            localStorage.setItem('hris_payroll_slips', JSON.stringify(slips));
          }
        }
      }
    }

    // AUTOMATION C: Masuk Setengah Hari (Time-Bound Logic)
    if (lv.leave_type === 'setengah_hari') {
      let attendanceHistory = [];
      try {
        attendanceHistory = JSON.parse(localStorage.getItem('hris_attendances_history') || '[]');
      } catch (e) {}

      const d = lv.start_date;
      let attIndex = attendanceHistory.findIndex(h => 
        (String(h.employee_id) === String(empId) || h.nik === empNik) && h.date === d
      );

      const attObj = {
        id: attIndex !== -1 ? attendanceHistory[attIndex].id : `att-${Date.now()}-${d}`,
        employee_id: empId,
        nik: empNik,
        full_name: empFullName,
        outlet: empOutlet,
        date: d,
        clock_in: attIndex !== -1 && attendanceHistory[attIndex].clock_in ? attendanceHistory[attIndex].clock_in : '10:00',
        clock_out: lv.half_day_clock_out || '17:00',
        status_in: 'half_day',
        notes: 'Masuk Setengah Hari (Disetujui)'
      };

      if (attIndex !== -1) {
        attendanceHistory[attIndex] = { ...attendanceHistory[attIndex], ...attObj };
      } else {
        attendanceHistory.push(attObj);
      }

      localStorage.setItem('hris_attendances_history', JSON.stringify(attendanceHistory));

      const clockOutTime = lv.half_day_clock_out || '17:00';
      const parts = clockOutTime.split(':');
      const hrs = parseInt(parts[0], 10) || 0;

      if (hrs < 18) {
        let slips = [];
        try {
          slips = JSON.parse(localStorage.getItem('hris_payroll_slips') || '[]');
        } catch (e) {}

        let slipIndex = slips.findIndex(s => 
          (String(s.employee_id) === String(empId) || s.nik === empNik) &&
          s.bulan === requestMonth &&
          s.tahun === requestYear
        );

        if (slipIndex !== -1) {
          let slip = slips[slipIndex];
          if (!slip.slip_sent) {
            if (!slip.deduction) slip.deduction = {};
            const basicSalary = parseFloat(slip.income?.gaji_pokok) || 1200000;
            const cutAmount = Math.round(basicSalary / 30);
            slip.deduction.masuk_setengah_hari = String((parseFloat(slip.deduction.masuk_setengah_hari) || 0) + cutAmount);

            const totalIncome = Object.values(slip.income || {}).reduce((a, b) => a + (parseFloat(b) || 0), 0);
            const totalDeduction = Object.values(slip.deduction || {}).reduce((a, b) => a + (parseFloat(b) || 0), 0);
            slip.total_pendapatan = totalIncome;
            slip.total_pengeluaran = totalDeduction;
            slip.thp = totalIncome - totalDeduction;

            slips[slipIndex] = slip;
            localStorage.setItem('hris_payroll_slips', JSON.stringify(slips));
          }
        }
      }
    }

    window.dispatchEvent(new Event('storage'));
  };

  const executeAction = async (id, status) => {
    try {
      const res = await fetch(`${API_URL}/leaves/${id}/approve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (data.status === 'success') {
        const updatedLeaves = leaves.map(l => {
          if (String(l.id) === String(id)) {
            return { ...l, status };
          }
          return l;
        });
        setLeaves(updatedLeaves);
        localStorage.setItem('hris_leaves', JSON.stringify(updatedLeaves));
        localStorage.setItem('leaves', JSON.stringify(updatedLeaves));
        localStorage.setItem('hris_leave_requests', JSON.stringify(updatedLeaves));

        runApprovalCrossAutomations(id, status);
        fetchLeaves();
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendNotification = async (id) => {
    try {
      const res = await fetch(`${API_URL}/leaves/${id}/send`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.status === 'success') {
        setLeaves(prev => prev.map(l => String(l.id) === String(id) ? { ...l, is_sent: 1 } : l));
        fetchLeaves();
      } else {
        alert(data.message || 'Gagal mengirim notifikasi.');
      }
    } catch (err) {
      console.error(err);
      alert('Koneksi internet bermasalah.');
    }
  };

  // Security Access Guard check
  const currentUserRole = getRoleFromPosition(user?.position, user?.role);
  const positionLower = (user?.position || '').toLowerCase();
  const hasAccess = currentUserRole === 'master' || 
                    currentUserRole === 'leader' || 
                    positionLower.includes('hrd') || 
                    positionLower.includes('direksi');

  const leavesForActiveTab = leaves.filter(l => 
    activeMainTab === 'kasbon' ? l.leave_type === 'kasbon' : l.leave_type !== 'kasbon'
  );

  const totalLeaves = leavesForActiveTab.length;
  const pendingLeaves = leavesForActiveTab.filter(l => l.status === 'pending').length;
  const approvedLeaves = leavesForActiveTab.filter(l => l.status === 'approved').length;
  const rejectedLeaves = leavesForActiveTab.filter(l => l.status === 'rejected').length;

  const filteredLeaves = leavesForActiveTab.filter(lv =>
    (lv.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (lv.nik || '').includes(search) ||
    (lv.reason || '').toLowerCase().includes(search.toLowerCase()) ||
    (lv.leave_type || '').toLowerCase().includes(search.toLowerCase()) ||
    (lv.department || '').toLowerCase().includes(search.toLowerCase())
  );

  // Pagination Logic
  const indexOfLastRow = currentPage * 10;
  const indexOfFirstRow = indexOfLastRow - 10;
  const currentRows = filteredLeaves.slice(indexOfFirstRow, indexOfLastRow);
  const totalPages = Math.ceil(filteredLeaves.length / 10);

  const handlePageChange = (page) => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentPage(page);
      setIsTransitioning(false);
    }, 300);
  };

  const getDuration = (start, end) => {
    try {
      const s = new Date(start);
      const e = new Date(end);
      if (isNaN(s.getTime()) || isNaN(e.getTime())) return '-';
      const diff = Math.abs(e - s);
      return (Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1) + ' Hari';
    } catch { return '-'; }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    } catch {}
    return dateStr;
  };

  // Badge render helpers with strong contrast colors (especially text over white blocks)
  const getLeaveTypeBadge = (type) => {
    let label = toTitleCase(type);
    let bg = 'rgba(255, 255, 255, 0.05)';
    let fg = '#fff';
    let border = '1px solid rgba(255, 255, 255, 0.1)';

    if (type === 'cuti') {
      label = 'Cuti';
      bg = 'rgba(46, 204, 113, 0.12)';
      fg = '#2ECC71';
      border = '1px solid rgba(46, 204, 113, 0.25)';
    } else if (type === 'sakit') {
      label = 'Sakit';
      bg = 'rgba(231, 76, 60, 0.12)';
      fg = '#E74C3C';
      border = '1px solid rgba(231, 76, 60, 0.25)';
    } else if (type === 'izin') {
      label = 'Izin';
      bg = 'rgba(241, 196, 15, 0.12)';
      fg = '#F1C40F';
      border = '1px solid rgba(241, 196, 15, 0.25)';
    } else if (type === 'setengah_hari') {
      label = '½ Hari';
      bg = 'rgba(155, 89, 182, 0.12)';
      fg = '#9B59B6';
      border = '1px solid rgba(155, 89, 182, 0.25)';
    } else if (type === 'kasbon') {
      label = 'Kasbon';
      bg = 'rgba(52, 152, 219, 0.12)';
      fg = '#3498DB';
      border = '1px solid rgba(52, 152, 219, 0.25)';
    }

    return (
      <span className="badge" style={{ background: bg, color: fg, border: border, padding: '4px 8px', fontSize: '0.75rem', borderRadius: '6px', fontWeight: '600', whiteSpace: 'nowrap' }}>
        {label}
      </span>
    );
  };

  const getApprovalBadge = (status) => {
    switch (status) {
      case 'approved':
        return (
          <span className="badge" style={{ background: 'rgba(46, 204, 113, 0.15)', color: '#2ECC71', border: '1px solid rgba(46, 204, 113, 0.3)', padding: '4px 8px', fontSize: '0.75rem', borderRadius: '6px', fontWeight: '600', whiteSpace: 'nowrap' }}>
            Disetujui
          </span>
        );
      case 'rejected':
        return (
          <span className="badge" style={{ background: 'rgba(231, 76, 60, 0.15)', color: '#E74C3C', border: '1px solid rgba(231, 76, 60, 0.3)', padding: '4px 8px', fontSize: '0.75rem', borderRadius: '6px', fontWeight: '600', whiteSpace: 'nowrap' }}>
            Ditolak
          </span>
        );
      default:
        return (
          <span className="badge" style={{ background: 'rgba(230, 126, 34, 0.15)', color: '#E67E22', border: '1px solid rgba(230, 126, 34, 0.3)', padding: '4px 8px', fontSize: '0.75rem', borderRadius: '6px', fontWeight: '600', whiteSpace: 'nowrap' }}>
            Menunggu
          </span>
        );
    }
  };

  const getSentBadge = (isSent) => {
    if (isSent) {
      return (
        <span className="badge" style={{ background: 'rgba(52, 152, 219, 0.15)', color: '#3498DB', border: '1px solid rgba(52, 152, 219, 0.3)', padding: '4px 8px', fontSize: '0.75rem', borderRadius: '6px', fontWeight: '600', whiteSpace: 'nowrap' }}>
          Terkirim
        </span>
      );
    }
    // High contrast white block with black text
    return (
      <span className="badge" style={{ background: '#FFFFFF', color: '#000000', border: '1px solid #CCCCCC', padding: '4px 8px', fontSize: '0.75rem', borderRadius: '6px', fontWeight: '700', whiteSpace: 'nowrap' }}>
        Belum Dikirim
      </span>
    );
  };

  const getReadBadge = (isRead) => {
    if (isRead) {
      return (
        <span className="badge" style={{ background: 'rgba(26, 188, 156, 0.15)', color: '#1ABC9C', border: '1px solid rgba(26, 188, 156, 0.3)', padding: '4px 8px', fontSize: '0.75rem', borderRadius: '6px', fontWeight: '600', whiteSpace: 'nowrap' }}>
          Sudah Dibaca
        </span>
      );
    }
    // High contrast white block with black text
    return (
      <span className="badge" style={{ background: '#FFFFFF', color: '#000000', border: '1px solid #CCCCCC', padding: '4px 8px', fontSize: '0.75rem', borderRadius: '6px', fontWeight: '700', whiteSpace: 'nowrap' }}>
        Belum Dibaca
      </span>
    );
  };

  if (!hasAccess) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        background: 'var(--bg-card)',
        borderRadius: '16px',
        border: '1px solid var(--border-color)',
        marginTop: '20px',
        color: 'var(--text-main)'
      }} className="glass-card animate-fade-in">
        <h2 style={{ color: '#E74C3C', marginBottom: '16px' }}>🔒 Akses Ditolak</h2>
        <p style={{ color: 'rgba(238, 238, 238, 0.55)' }}>
          Halaman ini hanya dapat diakses oleh Master, Leader, serta staf dengan jabatan HRD & Direksi.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card animate-fade-in" style={{ padding: '30px' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .filter-tab-btn {
          padding: 8px 16px;
          font-size: 0.9rem;
          background: rgba(255, 255, 255, 0.04);
          color: var(--text-main);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          display: inline-flex;
          align-items: center;
        }
        .filter-tab-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.15);
        }
        .filter-tab-btn.active {
          background: var(--accent-primary);
          color: #000000;
          border-color: var(--accent-primary);
          font-weight: 700;
          box-shadow: 0 4px 12px var(--primary-glow);
        }
      `}} />
      
      {/* Grid Ringkasan Pengajuan Cuti */}
      <div className="stats-grid animate-fade-in" style={{ marginBottom: '28px', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
        
        {/* Card 1: Total Pengajuan */}
        <div className="glass-card stat-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '12px', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <div className="stat-info">
            <span className="stat-label" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>TOTAL PENGAJUAN</span>
            <div className="stat-value" style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginTop: '4px' }}>{totalLeaves} Kasus</div>
          </div>
          <div className="stat-icon" style={{ background: 'var(--primary-glow)', color: 'var(--primary-solid)', width: '38px', height: '38px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={18} />
          </div>
        </div>

        {/* Card 2: Menunggu */}
        <div className="glass-card stat-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '12px', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <div className="stat-info">
            <span className="stat-label" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>MENUNGGU</span>
            <div className="stat-value" style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--warning)', marginTop: '4px' }}>{pendingLeaves} Kasus</div>
          </div>
          <div className="stat-icon" style={{ background: 'var(--warning-glow)', color: 'var(--warning)', width: '38px', height: '38px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={18} />
          </div>
        </div>

        {/* Card 3: Disetujui */}
        <div className="glass-card stat-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '12px', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <div className="stat-info">
            <span className="stat-label" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>DISETUJUI</span>
            <div className="stat-value" style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--success)', marginTop: '4px' }}>{approvedLeaves} Kasus</div>
          </div>
          <div className="stat-icon" style={{ background: 'var(--success-glow)', color: 'var(--success)', width: '38px', height: '38px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={18} />
          </div>
        </div>

        {/* Card 4: Ditolak */}
        <div className="glass-card stat-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '12px', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <div className="stat-info">
            <span className="stat-label" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>DITOLAK</span>
            <div className="stat-value" style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--danger)', marginTop: '4px' }}>{rejectedLeaves} Kasus</div>
          </div>
          <div className="stat-icon" style={{ background: 'var(--danger-glow)', color: 'var(--danger)', width: '38px', height: '38px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <XCircle size={18} />
          </div>
        </div>

      </div>

      {/* 2 Main Tab Navigation: Izin/Sakit vs Kasbon */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '24px', gap: '8px' }}>
        <button
          onClick={() => setActiveMainTab('izin_sakit')}
          style={{
            padding: '12px 20px',
            background: 'transparent',
            border: 'none',
            borderBottom: activeMainTab === 'izin_sakit' ? '3px solid var(--accent-primary)' : '3px solid transparent',
            color: activeMainTab === 'izin_sakit' ? 'var(--accent-primary)' : 'var(--text-muted)',
            fontSize: '0.95rem',
            fontWeight: activeMainTab === 'izin_sakit' ? '700' : '500',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <FileText size={16} />
          <span>Pengajuan Izin & Sakit</span>
        </button>
        <button
          onClick={() => setActiveMainTab('kasbon')}
          style={{
            padding: '12px 20px',
            background: 'transparent',
            border: 'none',
            borderBottom: activeMainTab === 'kasbon' ? '3px solid var(--accent-primary)' : '3px solid transparent',
            color: activeMainTab === 'kasbon' ? 'var(--accent-primary)' : 'var(--text-muted)',
            fontSize: '0.95rem',
            fontWeight: activeMainTab === 'kasbon' ? '700' : '500',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Users size={16} />
          <span>Pengajuan Kasbon</span>
        </button>
      </div>

      {/* Top Filter Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '20px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>
          {activeMainTab === 'kasbon' ? 'DAFTAR PENGAJUAN KASBON' : 'DAFTAR PENGAJUAN IZIN & SAKIT'}
        </h3>
        
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          
          {/* Search Input */}
          <div style={{ position: 'relative', width: '220px' }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Cari ..."
              className="input-field"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '32px', paddingRight: '10px', height: '38px', fontSize: '0.85rem' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className={`filter-tab-btn ${statusFilter === '' ? 'active' : ''}`}
              onClick={() => setStatusFilter('')}
            >
              Semua
            </button>
            <button
              className={`filter-tab-btn ${statusFilter === 'pending' ? 'active' : ''}`}
              onClick={() => setStatusFilter('pending')}
            >
              Pending
            </button>
            <button
              className={`filter-tab-btn ${statusFilter === 'approved' ? 'active' : ''}`}
              onClick={() => setStatusFilter('approved')}
            >
              Disetujui
            </button>
            <button
              className={`filter-tab-btn ${statusFilter === 'rejected' ? 'active' : ''}`}
              onClick={() => setStatusFilter('rejected')}
            >
              Ditolak
            </button>
          </div>
        </div>
      </div>

      {/* Leaves Table */}
      {loading ? (
        <div className="spinner-container">
          <div className="loading-spinner"></div>
          <p className="loading-text">Memuat data pengajuan cuti...</p>
        </div>
      ) : (
        <div className="table-container" style={{ display: 'flex', flexDirection: 'column' }}>
          {activeMainTab === 'izin_sakit' ? (
            <table className="data-table" style={{ margin: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
              <thead>
                <tr>
                  <th rowSpan={2} style={{ width: '50px', textAlign: 'center' }}>No</th>
                  <th rowSpan={2}>Nama Lengkap</th>
                  <th rowSpan={2}>Jabatan</th>
                  <th rowSpan={2}>Outlet</th>
                  <th rowSpan={2}>Jenis Pengajuan</th>
                  <th colSpan={2} style={{ textAlign: 'center' }}>Tanggal Pengajuan</th>
                  <th rowSpan={2} style={{ textAlign: 'center' }}>Aksi</th>
                  <th rowSpan={2} style={{ textAlign: 'center' }}>Kirim</th>
                  <th rowSpan={2} style={{ textAlign: 'center' }}>Keterangan</th>
                  <th rowSpan={2} style={{ textAlign: 'center' }}>Log Dibaca</th>
                </tr>
                <tr>
                  <th style={{ textAlign: 'center', borderLeft: '1px solid var(--border-color)', fontSize: '0.8rem' }}>Mulai</th>
                  <th style={{ textAlign: 'center', fontSize: '0.8rem' }}>Akhir</th>
                </tr>
              </thead>
              <tbody style={{
                opacity: isTransitioning ? 0.4 : 1,
                transform: isTransitioning ? 'translateY(8px) scale(0.995)' : 'translateY(0) scale(1)',
                transition: 'opacity 0.25s ease-in-out, transform 0.25s ease-in-out'
              }}>
                {currentRows.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Tidak ada pengajuan cuti/izin ditemukan.</td>
                  </tr>
                ) : (
                  currentRows.map((lv, index) => {
                    const no = indexOfFirstRow + index + 1;

                    return (
                      <tr key={lv.id}>
                        <td style={{ textAlign: 'center' }}>{no}</td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{toTitleCase(lv.full_name)}</span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>NIK: {lv.nik}</span>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontWeight: 550 }}>{toTitleCase(lv.position || lv.department || '-')}</span>
                        </td>
                        <td>
                          <span className="badge badge-secondary" style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
                            {toTitleCase(lv.outlet || 'Semua Outlet')}
                          </span>
                        </td>
                        <td>{getLeaveTypeBadge(lv.leave_type)}</td>
                        <td style={{ textAlign: 'center' }}>{formatDate(lv.start_date)}</td>
                        <td style={{ textAlign: 'center' }}>{formatDate(lv.end_date)}</td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            onClick={() => setPreviewModal({ isOpen: true, leave: lv })}
                            style={{
                              background: 'rgba(255, 255, 255, 0.06)',
                              color: '#fff',
                              border: '1px solid var(--border-color)',
                              padding: '6px 12px',
                              borderRadius: '6px',
                              fontSize: '0.8rem',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontWeight: '600',
                              transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => {
                              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
                              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                              e.currentTarget.style.borderColor = 'var(--border-color)';
                            }}
                          >
                            <Eye size={13} />
                            <span>Proses</span>
                          </button>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {lv.status === 'approved' ? (
                            lv.is_sent ? (
                              <button
                                disabled
                                style={{
                                  background: 'rgba(255, 255, 255, 0.02)',
                                  color: 'rgba(255, 255, 255, 0.2)',
                                  border: '1px solid rgba(255, 255, 255, 0.05)',
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  fontSize: '0.8rem',
                                  cursor: 'not-allowed',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  fontWeight: '600'
                                }}
                              >
                                <CheckCircle2 size={13} color="#2ECC71" />
                                <span>Terkirim</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleSendNotification(lv.id)}
                                style={{
                                  background: '#3498DB',
                                  color: '#fff',
                                  border: 'none',
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  fontSize: '0.8rem',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  fontWeight: '600',
                                  transition: 'all 0.2s ease',
                                  boxShadow: '0 4px 10px rgba(52, 152, 219, 0.3)'
                                }}
                                onMouseOver={(e) => {
                                  e.currentTarget.style.background = '#2980B9';
                                  e.currentTarget.style.transform = 'translateY(-1px)';
                                }}
                                onMouseOut={(e) => {
                                  e.currentTarget.style.background = '#3498DB';
                                  e.currentTarget.style.transform = 'translateY(0)';
                                }}
                              >
                                <Send size={13} />
                                <span>Kirim</span>
                              </button>
                            )
                          ) : (
                            <button
                              disabled
                              style={{
                                background: 'rgba(255, 255, 255, 0.02)',
                                color: 'rgba(255, 255, 255, 0.15)',
                                border: '1px solid rgba(255, 255, 255, 0.03)',
                                padding: '6px 12px',
                                borderRadius: '6px',
                                fontSize: '0.8rem',
                                cursor: 'not-allowed',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                            >
                              <Send size={13} />
                              <span>Kirim</span>
                            </button>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                            {getApprovalBadge(lv.status)}
                            {lv.status === 'approved' && getSentBadge(lv.is_sent)}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {lv.status === 'approved' && getReadBadge(lv.is_read)}
                          {lv.status !== 'approved' && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : (
            <table className="data-table" style={{ margin: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
              <thead>
                <tr>
                  <th style={{ width: '50px', textAlign: 'center' }}>No</th>
                  <th>Nama</th>
                  <th>Nama Outlet</th>
                  <th>Jabatan</th>
                  <th style={{ textAlign: 'right' }}>Jumlah Kasbon</th>
                  <th style={{ textAlign: 'center' }}>Tanggal Kasbon</th>
                  <th style={{ textAlign: 'center' }}>Aksi</th>
                  <th style={{ textAlign: 'center' }}>Kirim</th>
                  <th style={{ textAlign: 'center' }}>Keterangan</th>
                  <th style={{ textAlign: 'center' }}>Log Dibaca</th>
                </tr>
              </thead>
              <tbody style={{
                opacity: isTransitioning ? 0.4 : 1,
                transform: isTransitioning ? 'translateY(8px) scale(0.995)' : 'translateY(0) scale(1)',
                transition: 'opacity 0.25s ease-in-out, transform 0.25s ease-in-out'
              }}>
                {currentRows.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Tidak ada pengajuan kasbon ditemukan.</td>
                  </tr>
                ) : (
                  currentRows.map((lv, index) => {
                    const no = indexOfFirstRow + index + 1;
                    const amountFormatted = lv.cash_advance_amount ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(lv.cash_advance_amount) : 'Rp 0';
                    return (
                      <tr key={lv.id}>
                        <td style={{ textAlign: 'center' }}>{no}</td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{toTitleCase(lv.full_name)}</span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>NIK: {lv.nik}</span>
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-secondary" style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
                            {toTitleCase(lv.outlet || 'Semua Outlet')}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 550 }}>{toTitleCase(lv.position || lv.department || '-')}</span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--accent-primary)' }}>{amountFormatted}</td>
                        <td style={{ textAlign: 'center' }}>{formatDate(lv.start_date)}</td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            onClick={() => setPreviewModal({ isOpen: true, leave: lv })}
                            style={{
                              background: 'rgba(255, 255, 255, 0.06)',
                              color: '#fff',
                              border: '1px solid var(--border-color)',
                              padding: '6px 12px',
                              borderRadius: '6px',
                              fontSize: '0.8rem',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontWeight: '600',
                              transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => {
                              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
                              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                              e.currentTarget.style.borderColor = 'var(--border-color)';
                            }}
                          >
                            <Eye size={13} />
                            <span>Proses</span>
                          </button>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {lv.status === 'approved' ? (
                            lv.is_sent ? (
                              <button
                                disabled
                                style={{
                                  background: 'rgba(255, 255, 255, 0.02)',
                                  color: 'rgba(255, 255, 255, 0.2)',
                                  border: '1px solid rgba(255, 255, 255, 0.05)',
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  fontSize: '0.8rem',
                                  cursor: 'not-allowed',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  fontWeight: '600'
                                }}
                              >
                                <CheckCircle2 size={13} color="#2ECC71" />
                                <span>Terkirim</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleSendNotification(lv.id)}
                                style={{
                                  background: '#3498DB',
                                  color: '#fff',
                                  border: 'none',
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  fontSize: '0.8rem',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  fontWeight: '600',
                                  transition: 'all 0.2s ease',
                                  boxShadow: '0 4px 10px rgba(52, 152, 219, 0.3)'
                                }}
                                onMouseOver={(e) => {
                                  e.currentTarget.style.background = '#2980B9';
                                  e.currentTarget.style.transform = 'translateY(-1px)';
                                }}
                                onMouseOut={(e) => {
                                  e.currentTarget.style.background = '#3498DB';
                                  e.currentTarget.style.transform = 'translateY(0)';
                                }}
                              >
                                <Send size={13} />
                                <span>Kirim</span>
                              </button>
                            )
                          ) : (
                            <button
                              disabled
                              style={{
                                background: 'rgba(255, 255, 255, 0.02)',
                                color: 'rgba(255, 255, 255, 0.15)',
                                border: '1px solid rgba(255, 255, 255, 0.03)',
                                padding: '6px 12px',
                                borderRadius: '6px',
                                fontSize: '0.8rem',
                                cursor: 'not-allowed',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                            >
                              <Send size={13} />
                              <span>Kirim</span>
                            </button>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                            {getApprovalBadge(lv.status)}
                            {lv.status === 'approved' && getSentBadge(lv.is_sent)}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {lv.status === 'approved' && getReadBadge(lv.is_read)}
                          {lv.status !== 'approved' && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {/* Premium Pagination Control Bar */}
          {totalPages > 1 && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 20px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '0 0 12px 12px',
              fontSize: '0.85rem',
              color: 'var(--text-main)'
            }}>
              <div>
                Menampilkan <span style={{ fontWeight: 600 }}>{indexOfFirstRow + 1}</span> - <span style={{ fontWeight: 600 }}>{Math.min(indexOfLastRow, filteredLeaves.length)}</span> dari <span style={{ fontWeight: 600 }}>{filteredLeaves.length}</span> pengajuan
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  style={{
                    padding: '6px 12px',
                    background: currentPage === 1 ? 'rgba(65, 45, 21, 0.1)' : 'var(--border-color)',
                    border: '1px solid var(--border-color)',
                    color: currentPage === 1 ? 'rgba(238, 238, 238, 0.3)' : 'var(--text-main)',
                    borderRadius: '6px',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    fontWeight: 600
                  }}
                >
                  Sebelumnya
                </button>
                {[...Array(totalPages)].map((_, i) => (
                  <button
                    key={i + 1}
                    onClick={() => handlePageChange(i + 1)}
                    style={{
                      padding: '6px 12px',
                      background: currentPage === i + 1 ? 'var(--text-main)' : 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      color: currentPage === i + 1 ? 'var(--bg-surface)' : 'var(--text-main)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      fontWeight: '700'
                    }}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  style={{
                    padding: '6px 12px',
                    background: currentPage === totalPages ? 'rgba(65, 45, 21, 0.1)' : 'var(--border-color)',
                    border: '1px solid var(--border-color)',
                    color: currentPage === totalPages ? 'rgba(238, 238, 238, 0.3)' : 'var(--text-main)',
                    borderRadius: '6px',
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    fontWeight: 600
                  }}
                >
                  Berikutnya
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Preview Modal (Processes Approvals first) */}
      {previewModal.isOpen && previewModal.leave && (() => {
        const lv = previewModal.leave;
        const duration = getDuration(lv.start_date, lv.end_date);
        
        // Check if denda applies
        const sDate = new Date(lv.start_date);
        const eDate = new Date(lv.end_date);
        const days = isNaN(sDate.getTime()) || isNaN(eDate.getTime()) ? 0 : Math.ceil(Math.abs(eDate - sDate) / (1000 * 60 * 60 * 24)) + 1;
        const isDendaWarning = lv.status === 'pending' && lv.leave_type === 'cuti' && days > maxLeaveLimit;

        return (
          <div className="modal-backdrop" style={{ backdropFilter: 'blur(8px)', background: 'rgba(0, 0, 0, 0.7)', zIndex: 1000 }}>
            <div className="glass-card modal-content animate-fade-in" style={{ maxWidth: '600px', width: '90%', padding: '24px', background: 'rgba(15, 23, 42, 0.95)', border: '1px solid var(--border-color)', borderRadius: '16px' }}>
              <div className="modal-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: '700', letterSpacing: '0.05em' }}>🔍 PREVIEW PENGAJUAN</h2>
                <button 
                  onClick={() => setPreviewModal({ isOpen: false, leave: null })} 
                  style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Denda Warning alert */}
              {isDendaWarning && (
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  background: 'rgba(231, 76, 60, 0.12)',
                  border: '1px solid rgba(231, 76, 60, 0.3)',
                  padding: '12px',
                  borderRadius: '8px',
                  marginBottom: '16px'
                }}>
                  <AlertTriangle size={18} color="#E74C3C" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div style={{ textAlign: 'left' }}>
                    <p style={{ color: '#E74C3C', fontWeight: '700', fontSize: '0.85rem', margin: 0 }}>⚠️ Denda Operasional Berlaku</p>
                    <p style={{ color: 'rgba(238,238,238,0.7)', fontSize: '0.78rem', margin: '4px 0 0 0' }}>
                      Durasi cuti ({days} hari) melebihi batas reguler ({maxLeaveLimit} hari). Persetujuan akan otomatis menghitung penalti weekend/peak day.
                    </p>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left', fontSize: '0.88rem' }}>
                {/* Employee Profile Grid */}
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: 'var(--primary-solid)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Profil Karyawan</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Nama Lengkap</span>
                      <p style={{ margin: '2px 0 0 0', fontWeight: '600' }}>{toTitleCase(lv.full_name)}</p>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>NIK / ID</span>
                      <p style={{ margin: '2px 0 0 0', fontWeight: '600', fontFamily: 'monospace' }}>{lv.nik}</p>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Jabatan & Departemen</span>
                      <p style={{ margin: '2px 0 0 0', fontWeight: '600' }}>{toTitleCase(lv.position || '-')}</p>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Outlet Penugasan</span>
                      <p style={{ margin: '2px 0 0 0', fontWeight: '600' }}>{toTitleCase(lv.outlet || 'Semua Outlet')}</p>
                    </div>
                  </div>
                </div>

                {/* Leave Details */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Jenis Pengajuan</span>
                    <div style={{ marginTop: '4px' }}>{getLeaveTypeBadge(lv.leave_type)}</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Durasi Pengajuan</span>
                    <p style={{ margin: '4px 0 0 0', fontWeight: '600', fontSize: '0.95rem' }}>{duration}</p>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Tanggal Mulai</span>
                    <p style={{ margin: '2px 0 0 0', fontWeight: '600' }}>{formatDate(lv.start_date)}</p>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Tanggal Akhir</span>
                    <p style={{ margin: '2px 0 0 0', fontWeight: '600' }}>{formatDate(lv.end_date)}</p>
                  </div>
                </div>

                {/* Additional conditional details */}
                {lv.leave_type === 'kasbon' && (
                  <div style={{ background: 'rgba(52, 152, 219, 0.05)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(52, 152, 219, 0.15)' }}>
                    <span style={{ color: '#3498DB', fontSize: '0.75rem', fontWeight: '600' }}>Jumlah Kasbon Diajukan</span>
                    <p style={{ margin: '2px 0 0 0', fontSize: '1.2rem', fontWeight: '800', color: '#3498DB' }}>
                      {lv.cash_advance_amount ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(lv.cash_advance_amount) : 'Rp 0'}
                    </p>
                  </div>
                )}

                {lv.leave_type === 'setengah_hari' && (
                  <div style={{ background: 'rgba(155, 89, 182, 0.05)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(155, 89, 182, 0.15)' }}>
                    <span style={{ color: '#9B59B6', fontSize: '0.75rem', fontWeight: '600' }}>Jam Keluar (Clock Out) Setengah Hari</span>
                    <p style={{ margin: '2px 0 0 0', fontSize: '1.1rem', fontWeight: '700', color: '#9B59B6' }}>
                      {lv.half_day_clock_out || '17:00'}
                    </p>
                  </div>
                )}

                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Alasan / Keterangan</span>
                  <div style={{
                    marginTop: '4px',
                    background: 'rgba(255,255,255,0.02)',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.04)',
                    maxHeight: '100px',
                    overflowY: 'auto',
                    whiteSpace: 'pre-wrap',
                    fontSize: '0.82rem',
                    lineHeight: '1.4'
                  }}>
                    {lv.reason || '(Tidak ada alasan ditulis)'}
                  </div>
                </div>

                {/* Attachment Link */}
                {lv.attachment_url && (
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Lampiran Berkas / Dokumen</span>
                    <div style={{ marginTop: '4px' }}>
                      <a 
                        href={lv.attachment_url} 
                        target="_blank" 
                        rel="noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: 'rgba(52, 152, 219, 0.1)',
                          color: '#3498DB',
                          border: '1px solid rgba(52, 152, 219, 0.2)',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          textDecoration: 'none',
                          fontSize: '0.8rem',
                          fontWeight: '600'
                        }}
                      >
                        <ExternalLink size={13} />
                        <span>Buka Lampiran Berkas</span>
                      </a>
                    </div>
                  </div>
                )}

                {/* Status Logs */}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px', marginTop: '4px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Status Pengajuan</span>
                    <div style={{ marginTop: '2px' }}>{getApprovalBadge(lv.status)}</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Penerimaan Mobile User</span>
                    <div style={{ marginTop: '2px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {lv.status === 'approved' ? (
                        <>
                          {getSentBadge(lv.is_sent)}
                          {getReadBadge(lv.is_read)}
                        </>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>-</span>
                      )}
                    </div>
                  </div>
                  {lv.status !== 'pending' && lv.approved_by_email && (
                    <div style={{ gridColumn: 'span 2' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Diproses Oleh</span>
                      <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-main)', fontWeight: '600' }}>
                        {lv.approved_by_email} (pada {lv.approval_date ? new Date(lv.approval_date).toLocaleString('id-ID') : '-'})
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons Block */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '24px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px', flexWrap: 'wrap' }}>
                {lv.status === 'pending' && (
                  <>
                    <button
                      onClick={() => {
                        setConfirmModal({
                          isOpen: true,
                          title: 'Setujui Pengajuan',
                          message: 'Apakah Anda yakin ingin menyetujui pengajuan ini?',
                          confirmText: 'YA, SETUJUI',
                          cancelText: 'BATAL',
                          onConfirm: () => {
                            executeAction(lv.id, 'approved');
                            setPreviewModal({ isOpen: false, leave: null });
                          }
                        });
                      }}
                      style={{
                        background: '#2ECC71',
                        color: '#fff',
                        border: 'none',
                        padding: '10px 20px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '0.85rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 4px 12px rgba(46, 204, 113, 0.25)',
                        flex: '1',
                        justifyContent: 'center'
                      }}
                    >
                      <Check size={16} />
                      <span>Setujui</span>
                    </button>
                    <button
                      onClick={() => {
                        setConfirmModal({
                          isOpen: true,
                          title: 'Tolak Pengajuan',
                          message: 'Apakah Anda yakin ingin menolak pengajuan ini?',
                          confirmText: 'YA, TOLAK',
                          cancelText: 'BATAL',
                          onConfirm: () => {
                            executeAction(lv.id, 'rejected');
                            setPreviewModal({ isOpen: false, leave: null });
                          }
                        });
                      }}
                      style={{
                        background: '#E74C3C',
                        color: '#fff',
                        border: 'none',
                        padding: '10px 20px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '0.85rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 4px 12px rgba(231, 76, 60, 0.25)',
                        flex: '1',
                        justifyContent: 'center'
                      }}
                    >
                      <X size={16} />
                      <span>Tolak</span>
                    </button>
                  </>
                )}

                {/* Edit & Delete actions in Modal */}
                <button
                  onClick={() => {
                    setPreviewModal({ isOpen: false, leave: null });
                    handleEdit(lv);
                  }}
                  className="btn-secondary"
                  style={{
                    padding: '10px 16px',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    flex: lv.status === 'pending' ? 'none' : '1',
                    justifyContent: 'center'
                  }}
                >
                  <Edit size={14} />
                  <span>Ubah Data</span>
                </button>
                
                <button
                  onClick={() => {
                    setPreviewModal({ isOpen: false, leave: null });
                    triggerDelete(lv.id);
                  }}
                  style={{
                    background: 'rgba(231, 76, 60, 0.08)',
                    color: '#E74C3C',
                    border: '1px solid rgba(231, 76, 60, 0.2)',
                    padding: '10px 16px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '0.85rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    flex: lv.status === 'pending' ? 'none' : '1',
                    justifyContent: 'center'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = 'rgba(231, 76, 60, 0.16)'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'rgba(231, 76, 60, 0.08)'}
                >
                  <Trash2 size={14} />
                  <span>Hapus</span>
                </button>

                <button
                  onClick={() => setPreviewModal({ isOpen: false, leave: null })}
                  className="btn-secondary"
                  style={{
                    padding: '10px 16px',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    marginLeft: 'auto',
                    flex: lv.status === 'pending' ? '100%' : 'none',
                    justifyContent: 'center',
                    marginTop: lv.status === 'pending' ? '8px' : '0'
                  }}
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Edit Leaf Modal */}
      {showModal && (
        <div className="modal-backdrop" style={{ backdropFilter: 'blur(8px)', background: 'rgba(0, 0, 0, 0.7)', zIndex: 1000 }}>
          <div className="glass-card modal-content animate-fade-in" style={{ maxWidth: '500px', width: '90%', background: 'rgba(15, 23, 42, 0.95)', border: '1px solid var(--border-color)', borderRadius: '16px' }}>
            <div className="modal-header">
              <h2>UBAH PENGAJUAN CUTI / IZIN</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {errorMsg && (
              <p style={{ color: 'var(--danger)', background: 'var(--danger-glow)', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem' }}>
                {errorMsg}
              </p>
            )}

            <form onSubmit={triggerSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
              <div className="input-group">
                <label>Tipe Pengajuan</label>
                <select className="input-field" value={leaveType} onChange={(e) => setLeaveType(e.target.value)} style={{ background: 'var(--bg-main)', color: '#fff' }}>
                  <option value="cuti">Cuti Tahunan</option>
                  <option value="sakit">Sakit (Medis)</option>
                  <option value="izin">Izin Darurat</option>
                  <option value="setengah_hari">Masuk Setengah Hari</option>
                  <option value="kasbon">Kasbon</option>
                </select>
              </div>

              <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="input-group">
                  <label>Tanggal Mulai</label>
                  <input type="date" className="input-field" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
                </div>
                <div className="input-group">
                  <label>Tanggal Selesai</label>
                  <input type="date" className="input-field" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
                </div>
              </div>

              <div className="input-group">
                <label>Alasan</label>
                <textarea className="input-field" rows="3" value={reason} onChange={(e) => setReason(e.target.value)} required></textarea>
              </div>

              <div className="input-group">
                <label>Tautan Lampiran Berkas</label>
                <input type="url" className="input-field" value={attachmentUrl} onChange={(e) => setAttachmentUrl(e.target.value)} placeholder="https://drive.google.com/..." />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                  <span>Simpan Perubahan</span>
                </button>
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)} style={{ flex: 1 }}>
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="confirm-overlay" style={{ zIndex: 2000 }}>
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

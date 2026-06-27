import React, { useState, useEffect, useCallback } from 'react';
import {
  Coins, Plus, X, Send, Trash2, Filter, Search, Calendar,
  ChevronDown, CheckCircle, AlertCircle, Users, TrendingUp, TrendingDown
} from 'lucide-react';
import { getLiveOutletList } from '../utils/outletUtils';
import { useHRIS } from '../context/HRISContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── Konstanta Palet Warna ───────────────────────────────────────────────────
const PALETTE = {
  bgMain: 'var(--bg-surface)',
  bgSurface: 'var(--bg-card)',
  accent: 'var(--border-color)',
  cream: 'var(--text-main)',
  creamMuted: 'var(--text-muted)',
  activeTabBg: 'var(--accent-primary)',
  activeTabText: 'var(--bg-main)',
  success: '#2ecc71',
  danger: '#e74c3c',
  warning: '#f39c12',
};

// ─── Helper Utilitas ─────────────────────────────────────────────────────────
const toTitleCase = (str) => {
  if (!str) return '';
  return str.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

const formatCurrency = (val) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(val) || 0);

const parseNum = (v) => parseFloat(String(v).replace(/[^0-9.-]/g, '')) || 0;

const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const currentYear = new Date().getFullYear();
const TAHUN = Array.from({ length: 21 }, (_, i) => 2020 + i);

// ─── Lifted Math Helpers ─────────────────────────────────────────────────────
const getPolicyClockOutTimeLocal = (outletName, policies) => {
  const activePolicies = policies.filter(p => 
    p.status === 'ACTIVE' && 
    p.nama_aturan && p.nama_aturan.toLowerCase().includes('jam pulang')
  );
  const matching = activePolicies.find(p => 
    p.all_outlets || 
    (p.outlets || []).some(o => o.toUpperCase().trim() === (outletName || '').toUpperCase().trim())
  );
  if (matching && matching.deskripsi) {
    const match = matching.deskripsi.match(/pukul\s*(\d{2})[.:](\d{2})/i);
    if (match) return `${match[1]}:${match[2]}`;
  }
  if ((outletName || '').toUpperCase().includes('AYAM BAKAR SURABAYA') || (outletName || '').toUpperCase().includes('ABS')) {
    return '22:30';
  }
  return '00:30';
};

const isCheckoutBeforePolicyLocal = (clockOut, policyClockOut) => {
  if (!clockOut || !policyClockOut) return false;
  const parseToMinutesFromNoon = (timeStr) => {
    const parts = timeStr.split(':');
    const hrs = parseInt(parts[0], 10) || 0;
    const mins = parseInt(parts[1], 10) || 0;
    return hrs >= 12 ? (hrs - 12) * 60 + mins : (hrs + 12) * 60 + mins;
  };
  return parseToMinutesFromNoon(clockOut) < parseToMinutesFromNoon(policyClockOut);
};

const getOfficialBreakDuration = (outletName, policies) => {
  if (!outletName) return 120;
  const breakPolicies = policies.filter(p => 
    p.status === 'ACTIVE' &&
    ((p.nama_aturan || '').toLowerCase().includes('durasi istirahat') ||
     (p.nama_aturan || '').toLowerCase().includes('istirahat'))
  );
  const matching = breakPolicies.find(p => 
    (p.outlets || []).some(o => o.toUpperCase().trim() === outletName.toUpperCase().trim()) || p.all_outlets
  );
  if (matching && matching.deskripsi) {
    const match = matching.deskripsi.match(/(\d+)\s*(?:jam|hour)/i);
    if (match) return parseInt(match[1], 10) * 60;
  }
  if (outletName.toUpperCase().includes('AYAM BAKAR SURABAYA') || outletName.toUpperCase().includes('ABS')) {
    return 120;
  }
  return 180;
};

const parseToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
};

const parseTimeStringToMs = (timeStr) => {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  if (parts.length < 2) return 0;
  const hrs = parseInt(parts[0], 10) || 0;
  const mins = parseInt(parts[1], 10) || 0;
  const secs = parts[2] ? (parseInt(parts[2], 10) || 0) : 0;
  return ((hrs * 60 + mins) * 60 + secs) * 1000;
};


// ─── Key localStorage untuk slip gaji mobile ─────────────────────────────────
const PAYROLL_LS_KEY = 'hris_payroll_slips';

// ─── Nilai awal form pendapatan ───────────────────────────────────────────────
const initIncome = {
  gaji_pokok: '',
  uang_makan: '',
  uang_lembur: '',
  tunjangan_keluarga: '',
  tunjangan_jabatan: '',
  tunjangan_posisi: '',
  tunjangan_tidak_absen: '',
  tunjangan_lama_bekerja: '',
  tunjangan_lain: '',
  adjust_gaji: '',
};

// ─── Nilai awal form pengeluaran ──────────────────────────────────────────────
const initDeduction = {
  kasbon: '',
  libur_reguler: '',
  sakit_rawat_inap: '',
  sakit_surat_dokter: '',
  masuk_setengah_hari: '',
  libur_tambahan: '',
  potongan_kelebihan_libur: '',
  denda_weekend_libur_nasional: '',
  denda_keterlambat_istirahat: '',
  absensi: '',
  denda_stok: '',
};

// ─── Label field ─────────────────────────────────────────────────────────────
const INCOME_LABELS = {
  gaji_pokok: 'Gaji Pokok',
  uang_makan: 'Uang Makan',
  uang_lembur: 'Uang Lembur',
  tunjangan_keluarga: 'Tunjangan Keluarga',
  tunjangan_jabatan: 'Tunjangan Jabatan',
  tunjangan_posisi: 'Tunjangan Posisi',
  tunjangan_tidak_absen: 'Tunjangan Tidak Absen',
  tunjangan_lama_bekerja: 'Tunjangan Lama Bekerja',
  tunjangan_lain: 'Tunjangan Lain-Lain',
  adjust_gaji: 'Adjust Gaji Sebelumnya',
};

const DEDUCTION_LABELS = {
  kasbon: 'Kasbon',
  libur_reguler: 'Libur Reguler',
  sakit_rawat_inap: 'Sakit Rawat Inap',
  sakit_surat_dokter: 'Sakit (Surat Dokter)',
  masuk_setengah_hari: 'Masuk Kerja ½ Hari',
  libur_tambahan: 'Libur Tambahan',
  potongan_kelebihan_libur: 'Potongan Kelebihan Libur (>2 Hari)',
  denda_weekend_libur_nasional: 'Denda Weekend & Libur Nasional',
  denda_keterlambat_istirahat: 'Denda Keterlambat Istirahat',
  absensi: 'Absensi',
  denda_stok: 'Denda Stok',
};

// ─── Komponen InputField inline ───────────────────────────────────────────────
const CurrencyInput = ({ label, value, onChange }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: PALETTE.creamMuted, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
      {label}
    </label>
    <div style={{ position: 'relative' }}>
      <span style={{
        position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)',
        fontSize: '0.78rem', color: PALETTE.creamMuted, fontWeight: 700, pointerEvents: 'none'
      }}>Rp</span>
      <input
        type="number"
        min="0"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="0"
        style={{
          width: '100%', background: PALETTE.bgMain, border: `1px solid ${PALETTE.accent}`,
          borderRadius: '8px', padding: '9px 10px 9px 32px', color: PALETTE.cream,
          fontSize: '0.88rem', fontWeight: 600, outline: 'none',
          transition: 'border-color 0.2s',
        }}
        onFocus={e => e.target.style.borderColor = PALETTE.cream}
        onBlur={e => e.target.style.borderColor = PALETTE.accent}
      />
    </div>
  </div>
);

// ─── Fungsi baca outlet dari localStorage halaman outlet cabang ───────────────
// Menggunakan getLiveOutletList() terpusat
const getOutletsFromLocalStorage = () => {
  return getLiveOutletList();
};

// ─── Fungsi baca/tulis slip ke localStorage ───────────────────────────────────
const loadSlips = () => {
  try {
    const raw = localStorage.getItem(PAYROLL_LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveSlips = (slips) => {
  localStorage.setItem(PAYROLL_LS_KEY, JSON.stringify(slips));
};

// ─── Fungsi kirim slip ke localStorage mobile karyawan ───────────────────────
const sendSlipToMobile = (slip) => {
  const key = 'hris_payroll_mobile_slips';
  try {
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    // Hapus slip lama untuk karyawan+bulan+tahun yang sama, lalu tambahkan baru
    const filtered = existing.filter(
      s => !(s.employee_id === slip.employee_id && s.bulan === slip.bulan && s.tahun === slip.tahun)
    );
    filtered.push({ ...slip, sent_at: new Date().toISOString() });
    localStorage.setItem(key, JSON.stringify(filtered));
    return true;
  } catch {
    return false;
  }
};

// ─── Fungsi menghitung range cutoff berdasarkan outlet, bulan, dan tahun ───
const getCutoffRange = (empOutlet, month, year) => {
  let startDay = 1;
  let endDay = 1;
  
  try {
    const policies = JSON.parse(localStorage.getItem('corporate_policies') || '[]');
    const matchingPolicy = policies.find(p => 
      p.nama_aturan === 'Periode Cut-Off & Tanggal Gajian' &&
      (p.outlets || []).some(o => o.toUpperCase().trim() === (empOutlet || '').toUpperCase().trim())
    );
    
    if (matchingPolicy && matchingPolicy.deskripsi) {
      const match = matchingPolicy.deskripsi.match(/Periode\s+Cut-Off:\s*(\d+)\s*-\s*(\d+)/i);
      if (match) {
        startDay = parseInt(match[1], 10);
        endDay = parseInt(match[2], 10);
      }
    }
  } catch (e) {
    console.error('Error parsing cutoff policy:', e);
  }
  
  let startDate, endDate;
  
  if (startDay === 1) {
    const startMonthStr = String(month).padStart(2, '0');
    const lastDay = new Date(year, month, 0).getDate();
    startDate = `${year}-${startMonthStr}-01`;
    endDate = `${year}-${startMonthStr}-${String(lastDay).padStart(2, '0')}`;
  } else {
    let prevMonth = month - 1;
    let prevYear = year;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear = year - 1;
    }
    
    const prevMonthStr = String(prevMonth).padStart(2, '0');
    const curMonthStr = String(month).padStart(2, '0');
    
    startDate = `${prevYear}-${prevMonthStr}-${String(startDay).padStart(2, '0')}`;
    let endDayVal = startDay - 1;
    endDate = `${year}-${curMonthStr}-${String(endDayVal).padStart(2, '0')}`;
  }
  
  return { startDate, endDate };
};

// ─── Kalkulasi Payroll Real-time ──────────────────────────────────────────────
const calculatePayroll = (emp, month, year, policies, historyLogs, leaves) => {
  if (!emp) return { pendapatan: 0, pengeluaran: 0, thp: 0 };

  // A. Gaji Pokok
  let gajiPokokVal = 0;
  try {
    const salaryPolicy = policies.find(p => {
      if (p.nama_aturan !== 'Struktur Gaji Pokok' || p.status !== 'ACTIVE' || !p.deskripsi) return false;
      const match = p.deskripsi.match(/Jabatan:\s*([^,]+)/i);
      if (match) {
        const policyJabatan = match[1].trim().toUpperCase();
        const empJabatan = (emp.position || emp.jabatan || '').trim().toUpperCase();
        return policyJabatan === empJabatan;
      }
      return false;
    });
    if (salaryPolicy && salaryPolicy.deskripsi) {
      const match = salaryPolicy.deskripsi.match(/Gaji\s+Pokok:\s*Rp\s*([\d.]+)/i);
      if (match) {
        gajiPokokVal = parseInt(match[1].replace(/\./g, ''), 10);
      }
    }
  } catch (e) {
    console.error('Error parsing Gaji Pokok policy:', e);
  }
  
  if (gajiPokokVal === 0) {
    const pos = (emp.position || emp.jabatan || '').toLowerCase();
    if (pos.includes('kepala cabang')) gajiPokokVal = 1700000;
    else if (pos.includes('quality control') || pos.includes('qc')) gajiPokokVal = 1400000;
    else if (pos.includes('training') && pos.includes('cabang')) gajiPokokVal = 1400000;
    else if (pos.includes('training')) gajiPokokVal = 1000000;
    else if (pos.includes('karyawan') || pos.includes('helper') || pos.includes('koki') || pos.includes('waiters')) gajiPokokVal = 1200000;
  }

  // Get Cutoff Range & Logs
  const { startDate, endDate } = getCutoffRange(emp.outlet || emp.nama_outlet, month, year);
  
  const empLogs = historyLogs.filter(log => 
    (String(log.employee_id) === String(emp.id) || log.nik === emp.nik) &&
    log.date >= startDate && log.date <= endDate
  );
  
  const empLeaves = leaves.filter(l => 
    (String(l.employee_id) === String(emp.id) || l.nik === emp.nik) &&
    (String(l.status).toLowerCase() === 'approved' || String(l.status) === 'DISETUJUI')
  );

  const getLeaveDatesInCutoff = (startStr, endStr, cutoffStartStr, cutoffEndStr) => {
    const dates = [];
    const start = new Date(startStr);
    const end = new Date(endStr);
    const cutoffStart = new Date(cutoffStartStr);
    const cutoffEnd = new Date(cutoffEndStr);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || isNaN(cutoffStart.getTime()) || isNaN(cutoffEnd.getTime())) {
      return dates;
    }
    
    let current = new Date(start);
    while (current <= end) {
      if (current >= cutoffStart && current <= cutoffEnd) {
        const yyyy = current.getFullYear();
        const mm = String(current.getMonth() + 1).padStart(2, '0');
        const dd = String(current.getDate()).padStart(2, '0');
        dates.push(`${yyyy}-${mm}-${dd}`);
      }
      current.setDate(current.getDate() + 1);
    }
    return dates;
  };

  const leaveDatesInCutoff = [];
  empLeaves.forEach(lv => {
    const dates = getLeaveDatesInCutoff(lv.start_date, lv.end_date, startDate, endDate);
    dates.forEach(d => {
      if (!leaveDatesInCutoff.includes(d)) {
        leaveDatesInCutoff.push(d);
      }
    });
  });

  const totalApprovedLeaveDays = leaveDatesInCutoff.length;

  // Daily leave rate deduction (> 2 days from policy)
  let maxLeaveDays = 2;
  try {
    const maxLeavePolicy = policies.find(p => p.status === 'ACTIVE' && p.nama_aturan === 'Batasan Pengajuan Libur & Denda Operasional');
    if (maxLeavePolicy && maxLeavePolicy.deskripsi) {
      const match = maxLeavePolicy.deskripsi.match(/Maksimal pengajuan libur adalah\s*(\d+)\s*hari/i);
      if (match) maxLeaveDays = parseInt(match[1], 10);
    }
  } catch (e) {}

  let potonganKelebihanLibur = 0;
  if (totalApprovedLeaveDays > maxLeaveDays) {
    potonganKelebihanLibur = Math.round((gajiPokokVal / 30) * (totalApprovedLeaveDays - maxLeaveDays));
  }

  // Weekend and public holiday fines (Rp200.000 per violation day from policy)
  let dendaWeekendRate = 200000;
  try {
    const leaveFinePolicy = policies.find(p => p.status === 'ACTIVE' && p.nama_aturan === 'Batasan Pengajuan Libur & Denda Operasional');
    if (leaveFinePolicy && leaveFinePolicy.deskripsi) {
      const match = leaveFinePolicy.deskripsi.match(/denda tambahan sebesar\s*rp\s*([\d.]+)/i);
      if (match) dendaWeekendRate = parseInt(match[1].replace(/\./g, ''), 10);
    }
  } catch (e) {}

  const HOLIDAYS_2026 = [
    '2026-01-01', '2026-01-15', '2026-02-17', '2026-03-19', '2026-03-20', '2026-03-21',
    '2026-04-03', '2026-05-01', '2026-05-14', '2026-05-31', '2026-06-01', '2026-06-15',
    '2026-07-16', '2026-08-17', '2026-09-24', '2026-12-25'
  ];

  let dendaWeekendLiburNasional = 0;
  leaveDatesInCutoff.forEach(d => {
    const dateObj = new Date(d);
    const day = dateObj.getDay();
    const isWeekend = day === 0 || day === 6; // Sunday or Saturday
    const isHoliday = HOLIDAYS_2026.includes(d);
    const logForDate = empLogs.find(log => log.date === d);
    const isLogPublicHoliday = logForDate && logForDate.notes && /libur nasional/i.test(logForDate.notes);

    if (isWeekend || isHoliday || isLogPublicHoliday) {
      dendaWeekendLiburNasional += dendaWeekendRate;
    }
  });

  // Denda keterlambat istirahat (1 menit = 1 poin, cutoff tolerance 15 poin, Rp1000/poin denda from policy)
  let totalBreakPoints = 0;
  empLogs.forEach(log => {
    if (log.jam_mulai_istirahat && log.jam_akhir_istirahat) {
      let start = parseToMinutes(log.jam_mulai_istirahat);
      let end = parseToMinutes(log.jam_akhir_istirahat);
      if (end < start) end += 24 * 60;
      
      const actualBreak = end - start;
      let logOutlet = (log.outlet || emp.outlet || '').trim();
      const officialBreak = getOfficialBreakDuration(logOutlet, policies);
      const overage = Math.max(0, actualBreak - officialBreak);
      totalBreakPoints += overage;
    }
  });

  let breakTolerance = 15;
  let breakRate = 1000;
  try {
    const breakPenaltyPolicy = policies.find(p => p.nama_aturan && p.nama_aturan.toLowerCase().includes('denda istirahat'));
    if (breakPenaltyPolicy && breakPenaltyPolicy.status === 'ACTIVE' && breakPenaltyPolicy.deskripsi) {
      const matchTol = breakPenaltyPolicy.deskripsi.match(/toleransi\s*([a-zA-Z0-9_\s]*)\s*(\d+)\s*poin/i);
      if (matchTol) breakTolerance = parseInt(matchTol[2], 10);
      const matchRate = breakPenaltyPolicy.deskripsi.match(/denda\s*rp\s*([\d.]+)/i);
      if (matchRate) breakRate = parseInt(matchRate[1].replace(/\./g, ''), 10);
    }
  } catch (e) {}

  let dendaKeterlambatIstirahat = 0;
  if (totalBreakPoints > breakTolerance) {
    dendaKeterlambatIstirahat = (totalBreakPoints - breakTolerance) * breakRate;
  }

  // B. Uang Makan (Dynamic from policy)
  let uangMakanRate = 20000;
  try {
    const makanPolicy = policies.find(p => p.nama_aturan && p.nama_aturan.toLowerCase().includes('uang makan'));
    if (makanPolicy && makanPolicy.status === 'ACTIVE' && makanPolicy.deskripsi) {
      const match = makanPolicy.deskripsi.match(/rp\s*([\d.]+)/i);
      if (match) uangMakanRate = parseInt(match[1].replace(/\./g, ''), 10);
    }
  } catch (e) {}

  let tepatWaktuDays = 0;
  empLogs.forEach(log => {
    const hasClockIn = !!log.clock_in;
    const isOntime = log.status_in === 'ontime';
    const isLate = log.status_in === 'late' || (log.notes && /terlambat|late/i.test(log.notes));
    const isAbsent = !log.clock_in || log.status_in === 'absent' || (log.notes && /tidak hadir|alpa|absent/i.test(log.notes));
    const logOutlet = log.outlet || emp.outlet || '';
    const policyTime = getPolicyClockOutTimeLocal(logOutlet, policies);
    const isHalfDay = (log.notes && /setengah hari|1\/2|half day/i.test(log.notes)) || 
                      log.status_in === 'half_day' ||
                      (log.clock_out && isCheckoutBeforePolicyLocal(log.clock_out, policyTime));
    
    if (hasClockIn && isOntime && !isLate && !isAbsent && !isHalfDay) {
      tepatWaktuDays++;
    }
  });
  const uangMakanVal = tepatWaktuDays * uangMakanRate;

  // C. Uang Lembur (Dynamic from policy)
  let lemburRate = 7000;
  let lemburMaxCap = 200000;
  try {
    const lemburPolicy = policies.find(p => p.nama_aturan && p.nama_aturan.toLowerCase().includes('uang lembur'));
    if (lemburPolicy && lemburPolicy.status === 'ACTIVE' && lemburPolicy.deskripsi) {
      const matchRate = lemburPolicy.deskripsi.match(/sebesar\s*rp\s*([\d.]+)/i);
      if (matchRate) lemburRate = parseInt(matchRate[1].replace(/\./g, ''), 10);
      const matchCap = lemburPolicy.deskripsi.match(/maksimal\s*rp\s*([\d.]+)/i);
      if (matchCap) lemburMaxCap = parseInt(matchCap[1].replace(/\./g, ''), 10);
    }
  } catch (e) {}

  let lemburDays = 0;
  const empOutletName = (emp.outlet || emp.nama_outlet || '').toUpperCase().trim();
  
  let empOutletId = '';
  try {
    const outletsData = JSON.parse(localStorage.getItem('outlet_cabang_data') || '[]');
    const foundOutlet = outletsData.find(o => 
      (o.nama_tablet || '').toUpperCase().trim() === empOutletName ||
      (o.id || '').toUpperCase().trim() === empOutletName
    );
    if (foundOutlet) {
      empOutletId = (foundOutlet.id || '').toUpperCase().trim();
    }
  } catch (e) {}

  const isAbsTt = empOutletId === 'ABS TT' || empOutletName.includes('AYAM BAKAR SURABAYA TEBING TINGGI') || empOutletName === 'ABS TT';
  
  if (!isAbsTt) {
    empLogs.forEach(log => {
      const hasClockIn = !!log.clock_in;
      const hasClockOut = !!log.clock_out;
      const isLate = log.status_in === 'late' || (log.notes && /terlambat|late/i.test(log.notes));
      const logOutlet = log.outlet || emp.outlet || '';
      const policyTime = getPolicyClockOutTimeLocal(logOutlet, policies);
      const isHalfDay = (log.notes && /setengah hari|1\/2|half day/i.test(log.notes)) || 
                        log.status_in === 'half_day' ||
                        (log.clock_out && isCheckoutBeforePolicyLocal(log.clock_out, policyTime));
      
      if (hasClockIn && hasClockOut && !isLate && !isHalfDay) {
        let markedLembur = log.notes && /lembur|overtime/i.test(log.notes);
        
        if (!markedLembur) {
          const inMs = parseTimeStringToMs(log.clock_in);
          const outMs = parseTimeStringToMs(log.clock_out);
          const diffMs = outMs - inMs;
          if (diffMs > 32400000) {
            markedLembur = true;
          }
        }
        
        if (markedLembur) {
          lemburDays++;
        }
      }
    });
  }
  let uangLemburVal = lemburDays * lemburRate;
  if (uangLemburVal > lemburMaxCap) {
    uangLemburVal = lemburMaxCap;
  }
  
  // D. Tunjangan Keluarga (Dynamic from policy)
  let tunjanganKeluargaVal = 0;
  let hasKelPolicy = false;
  try {
    const kelPolicy = policies.find(p => p.nama_aturan && p.nama_aturan.includes('Tunjangan Keluarga'));
    if (kelPolicy) {
      hasKelPolicy = true;
      if (kelPolicy.status === 'ACTIVE') {
        const isMarried = emp.marital_status && !/belum/i.test(emp.marital_status);
        
        const startWorkingDate = emp.start_working_date || emp.joined_date;
        let monthsOfWork = 0;
        if (startWorkingDate) {
          const start = new Date(startWorkingDate);
          const now = new Date();
          if (!isNaN(start.getTime())) {
            const yearDiff = now.getFullYear() - start.getFullYear();
            const monthDiff = now.getMonth() - start.getMonth();
            monthsOfWork = yearDiff * 12 + monthDiff;
          }
        }
        
        if (isMarried && monthsOfWork >= 1) {
          const match = kelPolicy.deskripsi.match(/rp\s*([\d.]+)/i);
          if (match) {
            tunjanganKeluargaVal = parseInt(match[1].replace(/\./g, ''), 10);
          } else {
            tunjanganKeluargaVal = 200000;
          }
        }
      }
    }
  } catch (e) {
    console.error('Error parsing Tunjangan Keluarga policy:', e);
  }
  
  if (!hasKelPolicy) {
    const isMarried = emp.marital_status && !/belum/i.test(emp.marital_status);
    tunjanganKeluargaVal = isMarried ? 100000 : 0;
  }
  
  // E. Tunjangan Jabatan (Dynamic from policy)
  let tunjanganJabatanVal = 0;
  let hasJabPolicy = false;
  try {
    const jabPolicy = policies.find(p => p.nama_aturan === 'Tunjangan Jabatan');
    if (jabPolicy) {
      hasJabPolicy = true;
      if (jabPolicy.status === 'ACTIVE' && jabPolicy.deskripsi) {
        const desc = jabPolicy.deskripsi.toLowerCase();
        const pos = (emp.position || emp.jabatan || '').toLowerCase();
        if (pos.includes('produksi')) {
          const match = desc.match(/kepala produksi\s*=\s*rp\s*([\d.]+)/i);
          if (match) tunjanganJabatanVal = parseInt(match[1].replace(/\./g, ''), 10);
        } else if (pos.includes('layanan') || pos.includes('pelayanan')) {
          const match = desc.match(/kepala pe?layanan\s*=\s*rp\s*([\d.]+)/i);
          if (match) tunjanganJabatanVal = parseInt(match[1].replace(/\./g, ''), 10);
        } else if (pos.includes('quality control') || pos.includes('qc')) {
          const match = desc.match(/quality control\s*=\s*rp\s*([\d.]+)/i);
          if (match) tunjanganJabatanVal = parseInt(match[1].replace(/\./g, ''), 10);
        }
      }
    }
  } catch (e) {
    console.error('Error parsing Tunjangan Jabatan policy:', e);
  }
  
  if (!hasJabPolicy) {
    const pos = (emp.position || emp.jabatan || '').toLowerCase();
    if (pos.includes('produksi') || pos.includes('pelayanan') || pos.includes('layanan')) {
      tunjanganJabatanVal = 200000;
    } else if (pos.includes('quality control') || pos.includes('qc')) {
      tunjanganJabatanVal = 100000;
    }
  }
  
  // F. Tunjangan Posisi (Dynamic from policy)
  let tunjanganPosisiVal = 0;
  let hasPosPolicy = false;
  try {
    const posPolicy = policies.find(p => p.nama_aturan === 'Tunjangan Posisi');
    if (posPolicy) {
      hasPosPolicy = true;
      if (posPolicy.status === 'ACTIVE' && posPolicy.deskripsi) {
        const pos = (emp.position || emp.jabatan || '').toLowerCase();
        if (pos.includes('koki') || pos.includes('helper') || pos.includes('bartender') || pos.includes('waiters')) {
          const match = posPolicy.deskripsi.match(/sebesar\s*rp\s*([\d.]+)/i);
          if (match) {
            tunjanganPosisiVal = parseInt(match[1].replace(/\./g, ''), 10);
          } else {
            tunjanganPosisiVal = 100000;
          }
        }
      }
    }
  } catch (e) {
    console.error('Error parsing Tunjangan Posisi policy:', e);
  }
  
  if (!hasPosPolicy) {
    const pos = (emp.position || emp.jabatan || '').toLowerCase();
    if (pos.includes('koki') || pos.includes('helper') || pos.includes('bartender') || pos.includes('waiters')) {
      tunjanganPosisiVal = 100000;
    }
  }
  
  // G. Tunjangan Tidak Absen (Dynamic from policy)
  let tunjanganTidakAbsenVal = 0;
  let hasNoAbsPolicy = false;
  try {
    const noAbsPolicy = policies.find(p => p.nama_aturan === 'Tunjangan Tidak Absen');
    if (noAbsPolicy) {
      hasNoAbsPolicy = true;
      if (noAbsPolicy.status === 'ACTIVE' && noAbsPolicy.deskripsi) {
        let hasAlpa = false;
        empLogs.forEach(log => {
          const isAbsent = !log.clock_in || log.status_in === 'absent' || (log.notes && /tidak hadir|alpa|absent/i.test(log.notes));
          if (isAbsent) {
            hasAlpa = true;
          }
        });
        if (!hasAlpa && empLogs.length > 0) {
          const match = noAbsPolicy.deskripsi.match(/mendapatkan\s*rp\s*([\d.]+)/i);
          if (match) {
            tunjanganTidakAbsenVal = parseInt(match[1].replace(/\./g, ''), 10);
          } else {
            tunjanganTidakAbsenVal = 75000;
          }
        }
      }
    }
  } catch (e) {
    console.error('Error parsing Tunjangan Tidak Absen policy:', e);
  }
  
  if (!hasNoAbsPolicy) {
    let hasAlpa = false;
    empLogs.forEach(log => {
      const isAbsent = !log.clock_in || log.status_in === 'absent' || (log.notes && /tidak hadir|alpa|absent/i.test(log.notes));
      if (isAbsent) {
        hasAlpa = true;
      }
    });
    if (!hasAlpa && empLogs.length > 0) {
      tunjanganTidakAbsenVal = 75000;
    }
  }
  
  // H. Tunjangan Lama Bekerja (Dynamic ladder from active policy)
  let tunjanganLamaBekerjaVal = 0;
  let hasLamaPolicy = false;
  try {
    const lamaPolicy = policies.find(p => p.nama_aturan === 'Tunjangan Lama Bekerja');
    if (lamaPolicy) {
      hasLamaPolicy = true;
      if (lamaPolicy.status === 'ACTIVE') {
        const startWorkingDate = emp.start_working_date || emp.joined_date;
        let monthsOfWork = 0;
        if (startWorkingDate) {
          const start = new Date(startWorkingDate);
          const now = new Date();
          if (!isNaN(start.getTime())) {
            const yearDiff = now.getFullYear() - start.getFullYear();
            const monthDiff = now.getMonth() - start.getMonth();
            monthsOfWork = yearDiff * 12 + monthDiff;
          }
        }
        
        if (monthsOfWork >= 3 && monthsOfWork < 6) {
          tunjanganLamaBekerjaVal = 100000;
        } else if (monthsOfWork >= 6 && monthsOfWork < 12) {
          tunjanganLamaBekerjaVal = 200000;
        } else if (monthsOfWork >= 12) {
          const extraPeriod = Math.floor((monthsOfWork - 12) / 6);
          tunjanganLamaBekerjaVal = 200000 + (extraPeriod * 50000);
        }
      }
    }
  } catch (e) {
    console.error('Error parsing Tunjangan Lama Bekerja policy:', e);
  }
  
  if (!hasLamaPolicy) {
    const startWorkingDate = emp.start_working_date || emp.joined_date;
    let monthsOfWork = 0;
    if (startWorkingDate) {
      try {
        const start = new Date(startWorkingDate);
        const now = new Date();
        if (!isNaN(start.getTime())) {
          const yearDiff = now.getFullYear() - start.getFullYear();
          const monthDiff = now.getMonth() - start.getMonth();
          monthsOfWork = yearDiff * 12 + monthDiff;
        }
      } catch (e) {}
    }
    
    if (monthsOfWork >= 3 && monthsOfWork < 6) {
      tunjanganLamaBekerjaVal = 100000;
    } else if (monthsOfWork >= 6 && monthsOfWork < 12) {
      tunjanganLamaBekerjaVal = 200000;
    } else if (monthsOfWork >= 12) {
      const extraPeriod = Math.floor((monthsOfWork - 12) / 6);
      tunjanganLamaBekerjaVal = 200000 + (extraPeriod * 50000);
    }
  }
  
  // approved kasbon
  const approvedKasbonTotal = empLeaves
    .filter(l => l.leave_type === 'kasbon' && l.start_date >= startDate && l.start_date <= endDate)
    .reduce((acc, curr) => acc + (parseFloat(curr.cash_advance_amount) || 0), 0);

  // alpa parsial setengah hari (< 18.00)
  let masukSetengahHariDeduction = 0;
  empLogs.forEach(log => {
    const logOutlet = log.outlet || emp.outlet || '';
    const policyTime = getPolicyClockOutTimeLocal(logOutlet, policies);
    const isHalfDay = (log.notes && /setengah hari|1\/2|half day|Masuk Setengah Hari/i.test(log.notes)) || 
                      log.status_in === 'half_day' ||
                      (log.clock_out && isCheckoutBeforePolicyLocal(log.clock_out, policyTime));
    
    if (isHalfDay) {
      const clockOut = log.clock_out;
      if (clockOut) {
        const parts = clockOut.split(':');
        const hrs = parseInt(parts[0], 10) || 0;
        if (hrs < 18) {
          masukSetengahHariDeduction += Math.round(gajiPokokVal / 30);
        }
      } else {
        masukSetengahHariDeduction += Math.round(gajiPokokVal / 30);
      }
    }
  });

  let absensiDeduction = 0;
  try {
    const peakDaysList = JSON.parse(localStorage.getItem('peak_day_rules') || '[]');
    leaveDatesInCutoff.forEach(d => {
      const dateObj = new Date(d);
      const day = dateObj.getDay();
      const isWeekend = day === 0 || day === 6;
      
      const y = dateObj.getFullYear();
      const m = dateObj.getMonth() + 1;
      const dayNum = dateObj.getDate();
      const isPeakDay = peakDaysList.some(p => parseInt(p.tanggal) === dayNum && parseInt(p.bulan) === m && parseInt(p.tahun) === y);
      
      if (isPeakDay) {
        absensiDeduction += 250000;
      } else if (isWeekend) {
        absensiDeduction += 200000;
      }
    });
  } catch (e) {
    console.error('Error calculating absensi penalty:', e);
  }

  const pendapatan = gajiPokokVal + uangMakanVal + uangLemburVal + tunjanganKeluargaVal + tunjanganJabatanVal + tunjanganPosisiVal + tunjanganTidakAbsenVal + tunjanganLamaBekerjaVal;
  const pengeluaran = dendaKeterlambatIstirahat + dendaWeekendLiburNasional + approvedKasbonTotal + potonganKelebihanLibur + masukSetengahHariDeduction + absensiDeduction;
  const thp = pendapatan - pengeluaran;

  return {
    pendapatan,
    pengeluaran,
    thp
  };
};

// ─── Komponen Utama ───────────────────────────────────────────────────────────
export default function Payroll({ token, API_URL }) {
  // ─── Subscribe ke HRIS Context untuk reaktivitas karyawan lintas modul ───────
  const { activeEmployees: ctxEmployees, outlets: ctxOutlets } = useHRIS();

  // ── State data ──
  const [slips, setSlips] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [availableOutlets, setAvailableOutlets] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(false);

  // ─── Reactive: saat karyawan berubah di context, Payroll langsung update ────────
  useEffect(() => {
    if (ctxEmployees && ctxEmployees.length > 0) {
      setEmployees(ctxEmployees);
    }
  }, [ctxEmployees]);

  // ─── Reactive: saat outlets berubah di context, update dropdown ──────────────────────────
  useEffect(() => {
    if (ctxOutlets && ctxOutlets.length > 0) {
      const names = ctxOutlets.map(o => o.nama_tablet ||
        `${(o.nama || '').trim()} ${(o.wilayah || '').trim()}`.trim().toUpperCase()).filter(Boolean);
      if (names.length > 0) setAvailableOutlets(names);
    }
  }, [ctxOutlets]);

  // ── State filter ──
  const [filterBulan, setFilterBulan] = useState(new Date().getMonth() + 1); // 1-12
  const [filterTahun, setFilterTahun] = useState(currentYear);
  const [filterOutlet, setFilterOutlet] = useState('');
  const [searchName, setSearchName] = useState('');
  const [filterEmployeeId, setFilterEmployeeId] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // ── State untuk Rekap Gaji Bulanan ──
  const [activeTab, setActiveTab] = useState('slips'); // 'rekap' atau 'slips'
  const [rekapBulan, setRekapBulan] = useState([new Date().getMonth() + 1]); // array of numbers: [1-12]
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  const monthDropdownRef = React.useRef(null);

  const getBulanLabel = () => {
    if (!rekapBulan || rekapBulan.length === 0) return 'Pilih Bulan';
    if (rekapBulan.length === 12) return 'Semua Bulan';
    if (rekapBulan.length <= 2) {
      return rekapBulan.map(m => BULAN[m - 1]).join(', ');
    }
    return `${rekapBulan.length} Bulan`;
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (monthDropdownRef.current && !monthDropdownRef.current.contains(event.target)) {
        setShowMonthDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  const [rekapTahun, setRekapTahun] = useState(2026); // current is 2026 as per local time
  const [rekapOutlet, setRekapOutlet] = useState('ALL'); // 'ALL' atau nama tablet
  const [rekapKaryawan, setRekapKaryawan] = useState('ALL'); // 'ALL' atau employee_id
  const [rekapCurrentPage, setRekapCurrentPage] = useState(1);
  const [rekapIsTransitioning, setRekapIsTransitioning] = useState(false);
  const [storageTrigger, setStorageTrigger] = useState(0);





  useEffect(() => {
    setCurrentPage(1);
  }, [filterBulan, filterTahun, filterOutlet, searchName]);

  useEffect(() => {
    setRekapCurrentPage(1);
  }, [rekapBulan, rekapTahun, rekapOutlet, rekapKaryawan]);

  // ── State modal tambah gaji ──
  const [showModal, setShowModal] = useState(false);
  const [editingSlipId, setEditingSlipId] = useState(null);
  const [previewSlip, setPreviewSlip] = useState(null);

  // ── State form input ──
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [formBulan, setFormBulan] = useState(new Date().getMonth() + 1);
  const [formTahun, setFormTahun] = useState(currentYear);
  const [income, setIncome] = useState(initIncome);
  const [deduction, setDeduction] = useState(initDeduction);

  // ── State UI ──
  const [toast, setToast] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ open: false, title: '', msg: '', onConfirm: null });
  const [showColFilter, setShowColFilter] = useState(false);
  const [visibleCols, setVisibleCols] = useState({
    no: true, nama: true, outlet: true, jabatan: true,
    lama_bekerja: true, total_pendapatan: true,
    total_pengeluaran: true, thp: true, log_kirim: true, aksi: true
  });

  const colLabels = {
    no: 'No', nama: 'Nama Karyawan', outlet: 'Outlet',
    jabatan: 'Jabatan', lama_bekerja: 'Lama Bekerja',
    total_pendapatan: 'Total Pendapatan', total_pengeluaran: 'Total Pengeluaran',
    thp: 'Gaji THP', log_kirim: 'Log', aksi: 'Aksi'
  };

  // ── Kalkulasi otomatis ──
  const totalPendapatan = Object.values(income).reduce((sum, v) => sum + parseNum(v), 0);
  const totalPengeluaran = Object.values(deduction).reduce((sum, v) => sum + parseNum(v), 0);
  const thp = totalPendapatan - totalPengeluaran;

  // ── Kalkulasi Payroll Rekap Bulanan Terotomatisasi ──
  const calculatedPayrollData = React.useMemo(() => {
    const policies = JSON.parse(localStorage.getItem('corporate_policies') || '[]');
    const historyLogs = JSON.parse(localStorage.getItem('hris_attendances_history') || localStorage.getItem('attendances_history') || '[]');
    
    return employees.map(emp => {
      let totalPendapatan = 0;
      let totalPengeluaran = 0;
      let totalThp = 0;

      const monthsArray = Array.isArray(rekapBulan) ? rekapBulan : [rekapBulan];
      monthsArray.forEach(m => {
        const payroll = calculatePayroll(emp, m, rekapTahun, policies, historyLogs, leaves);
        totalPendapatan += payroll.pendapatan || 0;
        totalPengeluaran += payroll.pengeluaran || 0;
        totalThp += payroll.thp || 0;
      });

      return {
        ...emp,
        payroll: {
          pendapatan: totalPendapatan,
          pengeluaran: totalPengeluaran,
          thp: totalThp
        }
      };
    });
  }, [employees, rekapBulan, rekapTahun, leaves, storageTrigger]);

  const handleOutletChange = (e) => {
    const val = e.target.value;
    setRekapOutlet(val);
    setRekapCurrentPage(1);

    if (val !== 'ALL' && rekapKaryawan !== 'ALL') {
      const selectedEmpObj = employees.find(emp => String(emp.id) === String(rekapKaryawan) || String(emp.employee_id) === String(rekapKaryawan));
      const empOutlet = (selectedEmpObj?.outlet || selectedEmpObj?.nama_outlet || '').toUpperCase().trim();
      if (empOutlet !== val.toUpperCase().trim()) {
        setRekapKaryawan('ALL');
      }
    }
  };

  const handleSlipsOutletChange = (e) => {
    const val = e.target.value;
    setFilterOutlet(val);
    setFilterEmployeeId('ALL');
    setCurrentPage(1);
  };

  const filteredEmployeesForDropdown = React.useMemo(() => {
    const activeEmployees = employees.filter(emp => emp.employee_status !== 'inactive' && emp.status !== 'inactive');
    if (filterOutlet === '') return activeEmployees;
    return activeEmployees.filter(emp => 
      (emp.outlet || emp.nama_outlet || '').toUpperCase().trim() === filterOutlet.toUpperCase().trim()
    );
  }, [employees, filterOutlet]);

  // ── Inisialisasi ──
  useEffect(() => {
    setLoading(true);
    setSlips(loadSlips());

    // Outlet dari localStorage halaman outlet cabang
    setAvailableOutlets(getOutletsFromLocalStorage());

    // Karyawan — coba berbagai key localStorage dulu
    const empKeys = ['hris_employees', 'karyawan_data', 'employees', 'hris_employee_data', 'employeeData'];
    let empLoaded = false;
    for (const key of empKeys) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          const arr = Array.isArray(parsed) ? parsed : (parsed?.data || parsed?.employees || []);
          if (arr.length > 0) {
            setEmployees(arr);
            empLoaded = true;
            break;
          }
        }
      } catch {}
    }

    // Fallback ke API jika localStorage tidak ada
    const p1 = (!empLoaded && token && API_URL) ? fetch(`${API_URL}/employees`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.status === 'success' && Array.isArray(d.data)) {
          setEmployees(d.data);
        }
      })
      .catch(() => {}) : Promise.resolve();

    // Load leaves dari localStorage terlebih dahulu
    const leavesKeys = ['hris_leaves', 'leaves', 'hris_leave_requests'];
    let leavesLoaded = false;
    for (const key of leavesKeys) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          const arr = Array.isArray(parsed) ? parsed : (parsed?.data || []);
          if (arr.length > 0) {
            setLeaves(arr);
            leavesLoaded = true;
            break;
          }
        }
      } catch {}
    }

    // Ambil Data Pengajuan Cuti/Izin dari API
    const p2 = (token && API_URL) ? fetch(`${API_URL}/leaves`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.status === 'success' && Array.isArray(d.data)) {
          setLeaves(d.data);
        }
      })
      .catch(err => console.error('Error fetching leaves in payroll:', err)) : Promise.resolve();

    Promise.all([p1, p2]).then(() => {
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, [token, API_URL]);

  // Sync data ketika ada trigger perubahan di storage
  useEffect(() => {
    const handleStorageChange = () => {
      setStorageTrigger(prev => prev + 1);
      setSlips(loadSlips());
      setAvailableOutlets(getOutletsFromLocalStorage());
      
      const empKeys = ['hris_employees', 'karyawan_data', 'employees', 'hris_employee_data', 'employeeData'];
      for (const key of empKeys) {
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            const arr = Array.isArray(parsed) ? parsed : (parsed?.data || parsed?.employees || []);
            if (arr.length > 0) {
              setEmployees(arr);
              break;
            }
          }
        } catch {}
      }

      const leavesKeys = ['hris_leaves', 'leaves', 'hris_leave_requests'];
      for (const key of leavesKeys) {
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            const arr = Array.isArray(parsed) ? parsed : (parsed?.data || []);
            if (arr.length > 0) {
              setLeaves(arr);
              break;
            }
          }
        } catch {}
      }


    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleAutoCalculate = (employeeId, month, year) => {
    if (!employeeId) return;
    
    const emp = employees.find(e => String(e.id) === String(employeeId) || String(e.employee_id) === String(employeeId));
    if (!emp) return;
    
    const policies = JSON.parse(localStorage.getItem('corporate_policies') || '[]');
    
    // A. Gaji Pokok
    let gajiPokokVal = 0;
    try {
      const salaryPolicy = policies.find(p => {
        if (p.nama_aturan !== 'Struktur Gaji Pokok' || p.status !== 'ACTIVE' || !p.deskripsi) return false;
        const match = p.deskripsi.match(/Jabatan:\s*([^,]+)/i);
        if (match) {
          const policyJabatan = match[1].trim().toUpperCase();
          const empJabatan = (emp.position || emp.jabatan || '').trim().toUpperCase();
          return policyJabatan === empJabatan;
        }
        return false;
      });
      if (salaryPolicy && salaryPolicy.deskripsi) {
        const match = salaryPolicy.deskripsi.match(/Gaji\s+Pokok:\s*Rp\s*([\d.]+)/i);
        if (match) {
          gajiPokokVal = parseInt(match[1].replace(/\./g, ''), 10);
        }
      }
    } catch (e) {
      console.error('Error parsing Gaji Pokok policy:', e);
    }
    
    if (gajiPokokVal === 0) {
      const pos = (emp.position || emp.jabatan || '').toLowerCase();
      if (pos.includes('kepala cabang')) gajiPokokVal = 1700000;
      else if (pos.includes('quality control') || pos.includes('qc')) gajiPokokVal = 1400000;
      else if (pos.includes('training') && pos.includes('cabang')) gajiPokokVal = 1400000;
      else if (pos.includes('training')) gajiPokokVal = 1000000;
      else if (pos.includes('karyawan') || pos.includes('helper') || pos.includes('koki') || pos.includes('waiters')) gajiPokokVal = 1200000;
    }
    
    // Get Cutoff Range & Logs
    const { startDate, endDate } = getCutoffRange(emp.outlet || emp.nama_outlet, month, year);
    let historyLogs = [];
    try {
      historyLogs = JSON.parse(localStorage.getItem('hris_attendances_history') || '[]');
    } catch (e) {}
    
    const empLogs = historyLogs.filter(log => 
      (String(log.employee_id) === String(emp.id) || log.nik === emp.nik) &&
      log.date >= startDate && log.date <= endDate
    );
    
    // Calculate Approved Leaves and Weekend/Holiday Deductions
    const empLeaves = leaves.filter(l => 
      (String(l.employee_id) === String(emp.id) || l.nik === emp.nik) &&
      l.status === 'approved'
    );

    const getLeaveDatesInCutoff = (startStr, endStr, cutoffStartStr, cutoffEndStr) => {
      const dates = [];
      const start = new Date(startStr);
      const end = new Date(endStr);
      const cutoffStart = new Date(cutoffStartStr);
      const cutoffEnd = new Date(cutoffEndStr);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime()) || isNaN(cutoffStart.getTime()) || isNaN(cutoffEnd.getTime())) {
        return dates;
      }
      
      let current = new Date(start);
      while (current <= end) {
        if (current >= cutoffStart && current <= cutoffEnd) {
          const yyyy = current.getFullYear();
          const mm = String(current.getMonth() + 1).padStart(2, '0');
          const dd = String(current.getDate()).padStart(2, '0');
          dates.push(`${yyyy}-${mm}-${dd}`);
        }
        current.setDate(current.getDate() + 1);
      }
      return dates;
    };

    const leaveDatesInCutoff = [];
    empLeaves.forEach(lv => {
      const dates = getLeaveDatesInCutoff(lv.start_date, lv.end_date, startDate, endDate);
      dates.forEach(d => {
        if (!leaveDatesInCutoff.includes(d)) {
          leaveDatesInCutoff.push(d);
        }
      });
    });

    const totalApprovedLeaveDays = leaveDatesInCutoff.length;

    // Daily leave rate deduction (> 2 days from policy)
    let maxLeaveDays = 2;
    try {
      const maxLeavePolicy = policies.find(p => p.status === 'ACTIVE' && p.nama_aturan === 'Batasan Pengajuan Libur & Denda Operasional');
      if (maxLeavePolicy && maxLeavePolicy.deskripsi) {
        const match = maxLeavePolicy.deskripsi.match(/Maksimal pengajuan libur adalah\s*(\d+)\s*hari/i);
        if (match) maxLeaveDays = parseInt(match[1], 10);
      }
    } catch (e) {}

    let potonganKelebihanLibur = 0;
    if (totalApprovedLeaveDays > maxLeaveDays) {
      potonganKelebihanLibur = Math.round((gajiPokokVal / 30) * (totalApprovedLeaveDays - maxLeaveDays));
    }

    // Weekend and public holiday fines (Rp200.000 per violation day from policy)
    let dendaWeekendRate = 200000;
    try {
      const leaveFinePolicy = policies.find(p => p.status === 'ACTIVE' && p.nama_aturan === 'Batasan Pengajuan Libur & Denda Operasional');
      if (leaveFinePolicy && leaveFinePolicy.deskripsi) {
        const match = leaveFinePolicy.deskripsi.match(/denda tambahan sebesar\s*rp\s*([\d.]+)/i);
        if (match) dendaWeekendRate = parseInt(match[1].replace(/\./g, ''), 10);
      }
    } catch (e) {}

    const HOLIDAYS_2026 = [
      '2026-01-01', '2026-01-15', '2026-02-17', '2026-03-19', '2026-03-20', '2026-03-21',
      '2026-04-03', '2026-05-01', '2026-05-14', '2026-05-31', '2026-06-01', '2026-06-15',
      '2026-07-16', '2026-08-17', '2026-09-24', '2026-12-25'
    ];

    let dendaWeekendLiburNasional = 0;
    leaveDatesInCutoff.forEach(d => {
      const dateObj = new Date(d);
      const day = dateObj.getDay();
      const isWeekend = day === 0 || day === 6; // Sunday or Saturday
      const isHoliday = HOLIDAYS_2026.includes(d);
      const logForDate = empLogs.find(log => log.date === d);
      const isLogPublicHoliday = logForDate && logForDate.notes && /libur nasional/i.test(logForDate.notes);

      if (isWeekend || isHoliday || isLogPublicHoliday) {
        dendaWeekendLiburNasional += dendaWeekendRate;
      }
    });

    let totalBreakPoints = 0;
    empLogs.forEach(log => {
      if (log.jam_mulai_istirahat && log.jam_akhir_istirahat) {
        let start = parseToMinutes(log.jam_mulai_istirahat);
        let end = parseToMinutes(log.jam_akhir_istirahat);
        if (end < start) end += 24 * 60;
        
        const actualBreak = end - start;
        let logOutlet = (log.outlet || emp.outlet || '').trim();
        const officialBreak = getOfficialBreakDuration(logOutlet, policies);
        const overage = Math.max(0, actualBreak - officialBreak);
        totalBreakPoints += overage;
      }
    });

    let breakTolerance = 15;
    let breakRate = 1000;
    try {
      const breakPenaltyPolicy = policies.find(p => p.nama_aturan && p.nama_aturan.toLowerCase().includes('denda istirahat'));
      if (breakPenaltyPolicy && breakPenaltyPolicy.status === 'ACTIVE' && breakPenaltyPolicy.deskripsi) {
        const matchTol = breakPenaltyPolicy.deskripsi.match(/toleransi\s*([a-zA-Z0-9_\s]*)\s*(\d+)\s*poin/i);
        if (matchTol) breakTolerance = parseInt(matchTol[2], 10);
        const matchRate = breakPenaltyPolicy.deskripsi.match(/denda\s*rp\s*([\d.]+)/i);
        if (matchRate) breakRate = parseInt(matchRate[1].replace(/\./g, ''), 10);
      }
    } catch (e) {}

    let dendaKeterlambatIstirahat = 0;
    if (totalBreakPoints > breakTolerance) {
      dendaKeterlambatIstirahat = (totalBreakPoints - breakTolerance) * breakRate;
    }

    // B. Uang Makan (Dynamic from policy)
    let uangMakanRate = 20000;
    try {
      const makanPolicy = policies.find(p => p.nama_aturan && p.nama_aturan.toLowerCase().includes('uang makan'));
      if (makanPolicy && makanPolicy.status === 'ACTIVE' && makanPolicy.deskripsi) {
        const match = makanPolicy.deskripsi.match(/rp\s*([\d.]+)/i);
        if (match) uangMakanRate = parseInt(match[1].replace(/\./g, ''), 10);
      }
    } catch (e) {}

    let tepatWaktuDays = 0;
    empLogs.forEach(log => {
      const hasClockIn = !!log.clock_in;
      const isOntime = log.status_in === 'ontime';
      const isLate = log.status_in === 'late' || (log.notes && /terlambat|late/i.test(log.notes));
      const isAbsent = !log.clock_in || log.status_in === 'absent' || (log.notes && /tidak hadir|alpa|absent/i.test(log.notes));
      const logOutlet = log.outlet || emp.outlet || '';
      const policyTime = getPolicyClockOutTimeLocal(logOutlet, policies);
      const isHalfDay = (log.notes && /setengah hari|1\/2|half day/i.test(log.notes)) || 
                        log.status_in === 'half_day' ||
                        (log.clock_out && isCheckoutBeforePolicyLocal(log.clock_out, policyTime));
      
      if (hasClockIn && isOntime && !isLate && !isAbsent && !isHalfDay) {
        tepatWaktuDays++;
      }
    });
    const uangMakanVal = tepatWaktuDays * uangMakanRate;
    
    // Helper to parse time string without browser Date dependency
    const parseTimeStringToMs = (timeStr) => {
      if (!timeStr) return 0;
      const parts = timeStr.split(':');
      if (parts.length < 2) return 0;
      const hrs = parseInt(parts[0], 10) || 0;
      const mins = parseInt(parts[1], 10) || 0;
      const secs = parts[2] ? (parseInt(parts[2], 10) || 0) : 0;
      return ((hrs * 60 + mins) * 60 + secs) * 1000;
    };

    // C. Uang Lembur (Dynamic from policy)
    let lemburRate = 7000;
    let lemburMaxCap = 200000;
    try {
      const lemburPolicy = policies.find(p => p.nama_aturan && p.nama_aturan.toLowerCase().includes('uang lembur'));
      if (lemburPolicy && lemburPolicy.status === 'ACTIVE' && lemburPolicy.deskripsi) {
        const matchRate = lemburPolicy.deskripsi.match(/sebesar\s*rp\s*([\d.]+)/i);
        if (matchRate) lemburRate = parseInt(matchRate[1].replace(/\./g, ''), 10);
        const matchCap = lemburPolicy.deskripsi.match(/maksimal\s*rp\s*([\d.]+)/i);
        if (matchCap) lemburMaxCap = parseInt(matchCap[1].replace(/\./g, ''), 10);
      }
    } catch (e) {}

    let lemburDays = 0;
    const empOutletName = (emp.outlet || emp.nama_outlet || '').toUpperCase().trim();
    
    // Precise ID Check for ABS TT
    let empOutletId = '';
    try {
      const outletsData = JSON.parse(localStorage.getItem('outlet_cabang_data') || '[]');
      const foundOutlet = outletsData.find(o => 
        (o.nama_tablet || '').toUpperCase().trim() === empOutletName ||
        (o.id || '').toUpperCase().trim() === empOutletName
      );
      if (foundOutlet) {
        empOutletId = (foundOutlet.id || '').toUpperCase().trim();
      }
    } catch (e) {}

    const isAbsTt = empOutletId === 'ABS TT' || empOutletName.includes('AYAM BAKAR SURABAYA TEBING TINGGI') || empOutletName === 'ABS TT';
    
    if (!isAbsTt) {
      empLogs.forEach(log => {
        const hasClockIn = !!log.clock_in;
        const hasClockOut = !!log.clock_out;
        const isLate = log.status_in === 'late' || (log.notes && /terlambat|late/i.test(log.notes));
        const logOutlet = log.outlet || emp.outlet || '';
        const policyTime = getPolicyClockOutTimeLocal(logOutlet, policies);
        const isHalfDay = (log.notes && /setengah hari|1\/2|half day/i.test(log.notes)) || 
                          log.status_in === 'half_day' ||
                          (log.clock_out && isCheckoutBeforePolicyLocal(log.clock_out, policyTime));
        
        if (hasClockIn && hasClockOut && !isLate && !isHalfDay) {
          let markedLembur = log.notes && /lembur|overtime/i.test(log.notes);
          
          if (!markedLembur) {
            const inMs = parseTimeStringToMs(log.clock_in);
            const outMs = parseTimeStringToMs(log.clock_out);
            const diffMs = outMs - inMs;
            if (diffMs > 32400000) { // 9 hours
              markedLembur = true;
            }
          }
          
          if (markedLembur) {
            lemburDays++;
          }
        }
      });
    }
    let uangLemburVal = lemburDays * lemburRate;
    if (uangLemburVal > lemburMaxCap) {
      uangLemburVal = lemburMaxCap;
    }
    
    // D. Tunjangan Keluarga (Dynamic from policy)
    let tunjanganKeluargaVal = 0;
    let hasKelPolicy = false;
    try {
      const kelPolicy = policies.find(p => p.nama_aturan && p.nama_aturan.includes('Tunjangan Keluarga'));
      if (kelPolicy) {
        hasKelPolicy = true;
        if (kelPolicy.status === 'ACTIVE') {
          const isMarried = emp.marital_status && !/belum/i.test(emp.marital_status);
          
          const startWorkingDate = emp.start_working_date || emp.joined_date;
          let monthsOfWork = 0;
          if (startWorkingDate) {
            const start = new Date(startWorkingDate);
            const now = new Date();
            if (!isNaN(start.getTime())) {
              const yearDiff = now.getFullYear() - start.getFullYear();
              const monthDiff = now.getMonth() - start.getMonth();
              monthsOfWork = yearDiff * 12 + monthDiff;
            }
          }
          
          if (isMarried && monthsOfWork >= 1) {
            const match = kelPolicy.deskripsi.match(/rp\s*([\d.]+)/i);
            if (match) {
              tunjanganKeluargaVal = parseInt(match[1].replace(/\./g, ''), 10);
            } else {
              tunjanganKeluargaVal = 200000;
            }
          }
        }
      }
    } catch (e) {
      console.error('Error parsing Tunjangan Keluarga policy:', e);
    }
    
    if (!hasKelPolicy) {
      const isMarried = emp.marital_status && !/belum/i.test(emp.marital_status);
      tunjanganKeluargaVal = isMarried ? 100000 : 0;
    }
    
    // E. Tunjangan Jabatan (Dynamic from policy)
    let tunjanganJabatanVal = 0;
    let hasJabPolicy = false;
    try {
      const jabPolicy = policies.find(p => p.nama_aturan === 'Tunjangan Jabatan');
      if (jabPolicy) {
        hasJabPolicy = true;
        if (jabPolicy.status === 'ACTIVE' && jabPolicy.deskripsi) {
          const desc = jabPolicy.deskripsi.toLowerCase();
          const pos = (emp.position || emp.jabatan || '').toLowerCase();
          if (pos.includes('produksi')) {
            const match = desc.match(/kepala produksi\s*=\s*rp\s*([\d.]+)/i);
            if (match) tunjanganJabatanVal = parseInt(match[1].replace(/\./g, ''), 10);
          } else if (pos.includes('layanan') || pos.includes('pelayanan')) {
            const match = desc.match(/kepala pe?layanan\s*=\s*rp\s*([\d.]+)/i);
            if (match) tunjanganJabatanVal = parseInt(match[1].replace(/\./g, ''), 10);
          } else if (pos.includes('quality control') || pos.includes('qc')) {
            const match = desc.match(/quality control\s*=\s*rp\s*([\d.]+)/i);
            if (match) tunjanganJabatanVal = parseInt(match[1].replace(/\./g, ''), 10);
          }
        }
      }
    } catch (e) {
      console.error('Error parsing Tunjangan Jabatan policy:', e);
    }
    
    if (!hasJabPolicy) {
      const pos = (emp.position || emp.jabatan || '').toLowerCase();
      if (pos.includes('produksi') || pos.includes('pelayanan') || pos.includes('layanan')) {
        tunjanganJabatanVal = 200000;
      } else if (pos.includes('quality control') || pos.includes('qc')) {
        tunjanganJabatanVal = 100000;
      }
    }
    
    // F. Tunjangan Posisi (Dynamic from policy)
    let tunjanganPosisiVal = 0;
    let hasPosPolicy = false;
    try {
      const posPolicy = policies.find(p => p.nama_aturan === 'Tunjangan Posisi');
      if (posPolicy) {
        hasPosPolicy = true;
        if (posPolicy.status === 'ACTIVE' && posPolicy.deskripsi) {
          const pos = (emp.position || emp.jabatan || '').toLowerCase();
          if (pos.includes('koki') || pos.includes('helper') || pos.includes('bartender') || pos.includes('waiters')) {
            const match = posPolicy.deskripsi.match(/sebesar\s*rp\s*([\d.]+)/i);
            if (match) {
              tunjanganPosisiVal = parseInt(match[1].replace(/\./g, ''), 10);
            } else {
              tunjanganPosisiVal = 100000;
            }
          }
        }
      }
    } catch (e) {
      console.error('Error parsing Tunjangan Posisi policy:', e);
    }
    
    if (!hasPosPolicy) {
      const pos = (emp.position || emp.jabatan || '').toLowerCase();
      if (pos.includes('koki') || pos.includes('helper') || pos.includes('bartender') || pos.includes('waiters')) {
        tunjanganPosisiVal = 100000;
      }
    }
    
    // G. Tunjangan Tidak Absen (Dynamic from policy)
    let tunjanganTidakAbsenVal = 0;
    let hasNoAbsPolicy = false;
    try {
      const noAbsPolicy = policies.find(p => p.nama_aturan === 'Tunjangan Tidak Absen');
      if (noAbsPolicy) {
        hasNoAbsPolicy = true;
        if (noAbsPolicy.status === 'ACTIVE' && noAbsPolicy.deskripsi) {
          let hasAlpa = false;
          empLogs.forEach(log => {
            const isAbsent = !log.clock_in || log.status_in === 'absent' || (log.notes && /tidak hadir|alpa|absent/i.test(log.notes));
            if (isAbsent) {
              hasAlpa = true;
            }
          });
          if (!hasAlpa && empLogs.length > 0) {
            const match = noAbsPolicy.deskripsi.match(/mendapatkan\s*rp\s*([\d.]+)/i);
            if (match) {
              tunjanganTidakAbsenVal = parseInt(match[1].replace(/\./g, ''), 10);
            } else {
              tunjanganTidakAbsenVal = 75000;
            }
          }
        }
      }
    } catch (e) {
      console.error('Error parsing Tunjangan Tidak Absen policy:', e);
    }
    
    if (!hasNoAbsPolicy) {
      let hasAlpa = false;
      empLogs.forEach(log => {
        const isAbsent = !log.clock_in || log.status_in === 'absent' || (log.notes && /tidak hadir|alpa|absent/i.test(log.notes));
        if (isAbsent) {
          hasAlpa = true;
        }
      });
      if (!hasAlpa && empLogs.length > 0) {
        tunjanganTidakAbsenVal = 75000;
      }
    }
    
    // H. Tunjangan Lama Bekerja (Dynamic ladder from active policy)
    let tunjanganLamaBekerjaVal = 0;
    let hasLamaPolicy = false;
    try {
      const lamaPolicy = policies.find(p => p.nama_aturan === 'Tunjangan Lama Bekerja');
      if (lamaPolicy) {
        hasLamaPolicy = true;
        if (lamaPolicy.status === 'ACTIVE') {
          const startWorkingDate = emp.start_working_date || emp.joined_date;
          let monthsOfWork = 0;
          if (startWorkingDate) {
            const start = new Date(startWorkingDate);
            const now = new Date();
            if (!isNaN(start.getTime())) {
              const yearDiff = now.getFullYear() - start.getFullYear();
              const monthDiff = now.getMonth() - start.getMonth();
              monthsOfWork = yearDiff * 12 + monthDiff;
            }
          }
          
          if (monthsOfWork >= 3 && monthsOfWork < 6) {
            tunjanganLamaBekerjaVal = 100000;
          } else if (monthsOfWork >= 6 && monthsOfWork < 12) {
            tunjanganLamaBekerjaVal = 200000;
          } else if (monthsOfWork >= 12) {
            const extraPeriod = Math.floor((monthsOfWork - 12) / 6);
            tunjanganLamaBekerjaVal = 200000 + (extraPeriod * 50000);
          }
        }
      }
    } catch (e) {
      console.error('Error parsing Tunjangan Lama Bekerja policy:', e);
    }
    
    if (!hasLamaPolicy) {
      const startWorkingDate = emp.start_working_date || emp.joined_date;
      let monthsOfWork = 0;
      if (startWorkingDate) {
        try {
          const start = new Date(startWorkingDate);
          const now = new Date();
          if (!isNaN(start.getTime())) {
            const yearDiff = now.getFullYear() - start.getFullYear();
            const monthDiff = now.getMonth() - start.getMonth();
            monthsOfWork = yearDiff * 12 + monthDiff;
          }
        } catch (e) {}
      }
      
      if (monthsOfWork >= 3 && monthsOfWork < 6) {
        tunjanganLamaBekerjaVal = 100000;
      } else if (monthsOfWork >= 6 && monthsOfWork < 12) {
        tunjanganLamaBekerjaVal = 200000;
      } else if (monthsOfWork >= 12) {
        const extraPeriod = Math.floor((monthsOfWork - 12) / 6);
        tunjanganLamaBekerjaVal = 200000 + (extraPeriod * 50000);
      }
    }
    
    // approved kasbon
    const approvedKasbonTotal = empLeaves
      .filter(l => l.leave_type === 'kasbon' && l.start_date >= startDate && l.start_date <= endDate)
      .reduce((acc, curr) => acc + (parseFloat(curr.cash_advance_amount) || 0), 0);

    // alpa parsial setengah hari (< 18.00)
    let masukSetengahHariDeduction = 0;
    empLogs.forEach(log => {
      const logOutlet = log.outlet || emp.outlet || '';
      const policyTime = getPolicyClockOutTimeLocal(logOutlet, policies);
      const isHalfDay = (log.notes && /setengah hari|1\/2|half day|Masuk Setengah Hari/i.test(log.notes)) || 
                        log.status_in === 'half_day' ||
                        (log.clock_out && isCheckoutBeforePolicyLocal(log.clock_out, policyTime));
      
      if (isHalfDay) {
        const clockOut = log.clock_out;
        if (clockOut) {
          const parts = clockOut.split(':');
          const hrs = parseInt(parts[0], 10) || 0;
          if (hrs < 18) {
            masukSetengahHariDeduction += Math.round(gajiPokokVal / 30);
          }
        } else {
          masukSetengahHariDeduction += Math.round(gajiPokokVal / 30);
        }
      }
    });

    let absensiDeduction = 0;
    try {
      const peakDaysList = JSON.parse(localStorage.getItem('peak_day_rules') || '[]');
      leaveDatesInCutoff.forEach(d => {
        const dateObj = new Date(d);
        const day = dateObj.getDay();
        const isWeekend = day === 0 || day === 6;
        
        const y = dateObj.getFullYear();
        const m = dateObj.getMonth() + 1;
        const dayNum = dateObj.getDate();
        const isPeakDay = peakDaysList.some(p => parseInt(p.tanggal) === dayNum && parseInt(p.bulan) === m && parseInt(p.tahun) === y);
        
        if (isPeakDay) {
          absensiDeduction += 250000;
        } else if (isWeekend) {
          absensiDeduction += 200000;
        }
      });
    } catch (e) {
      console.error('Error calculating absensi in auto-calculate:', e);
    }

    setIncome(prev => ({
      ...prev,
      gaji_pokok: String(gajiPokokVal),
      uang_makan: String(uangMakanVal),
      uang_lembur: String(uangLemburVal),
      tunjangan_keluarga: String(tunjanganKeluargaVal),
      tunjangan_jabatan: String(tunjanganJabatanVal),
      tunjangan_posisi: String(tunjanganPosisiVal),
      tunjangan_tidak_absen: String(tunjanganTidakAbsenVal),
      tunjangan_lama_bekerja: String(tunjanganLamaBekerjaVal),
    }));

    setDeduction(prev => ({
      ...prev,
      kasbon: String(approvedKasbonTotal),
      masuk_setengah_hari: String(masukSetengahHariDeduction),
      potongan_kelebihan_libur: String(potonganKelebihanLibur),
      denda_weekend_libur_nasional: String(dendaWeekendLiburNasional),
      denda_keterlambat_istirahat: String(dendaKeterlambatIstirahat),
      absensi: String(absensiDeduction),
      denda_stok: prev.denda_stok || '',
    }));
    
    showToast('success', `🔄 Kalkulasi Gaji otomatis untuk ${emp.full_name || emp.nama} berhasil dihitung!`);
  };

  useEffect(() => {
    if (!editingSlipId && selectedEmployee) {
      handleAutoCalculate(selectedEmployee, formBulan, formTahun);
    }
  }, [selectedEmployee, formBulan, formTahun, editingSlipId]);



  // ── Toast helper ──
  const showToast = useCallback((type, text) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // ── Buka modal tambah ──
  const openAddModal = () => {
    setEditingSlipId(null);
    setSelectedEmployee('');
    setFormBulan(new Date().getMonth() + 1);
    setFormTahun(currentYear);
    setIncome(initIncome);
    setDeduction(initDeduction);
    setShowModal(true);
  };

  // ── Buka modal edit ──
  const openEditModal = (slip) => {
    setEditingSlipId(slip.id);
    setSelectedEmployee(slip.employee_id);
    setFormBulan(slip.bulan);
    setFormTahun(slip.tahun);
    setIncome({ ...initIncome, ...slip.income });
    setDeduction({ ...initDeduction, ...slip.deduction });
    setShowModal(true);
  };

  const getExistingSlipForRekap = (emp) => {
    const targetMonth = Array.isArray(rekapBulan) && rekapBulan.length > 0 ? rekapBulan[0] : 1;
    return slips.find(s => 
      String(s.employee_id) === String(emp.id || emp.employee_id) && 
      Number(s.bulan) === Number(targetMonth) && 
      Number(s.tahun) === Number(rekapTahun)
    );
  };

  const handleEditRekap = (emp) => {
    const targetMonth = Array.isArray(rekapBulan) && rekapBulan.length > 0 ? rekapBulan[0] : 1;
    const targetYear = rekapTahun;
    const existingSlip = getExistingSlipForRekap(emp);
    
    if (existingSlip) {
      openEditModal(existingSlip);
    } else {
      setEditingSlipId(null);
      setSelectedEmployee(emp.id || emp.employee_id);
      setFormBulan(targetMonth);
      setFormTahun(targetYear);
      setShowModal(true);
    }
  };

  // ── Simpan slip ──
  const handleSave = () => {
    if (!selectedEmployee) {
      showToast('error', '⚠️ Gagal Menyimpan! Pilih nama karyawan terlebih dahulu.');
      return;
    }
    if (totalPendapatan === 0) {
      showToast('error', '⚠️ Total Pendapatan tidak boleh nol.');
      return;
    }

    const existing = loadSlips();
    const emp = employees.find(e => String(e.id) === String(selectedEmployee) || String(e.employee_id) === String(selectedEmployee));
    const newSlip = {
      id: editingSlipId || `slip-${Date.now()}`,
      employee_id: selectedEmployee,
      nama_karyawan: emp?.full_name || emp?.nama || 'Unknown',
      outlet: emp?.outlet || emp?.nama_outlet || '-',
      jabatan: emp?.position || emp?.jabatan || '-',
      lama_bekerja: (() => {
        const d = emp?.start_working_date || emp?.joined_date;
        if (!d) return '-';
        try {
          const start = new Date(d);
          const now = new Date();
          if (isNaN(start.getTime())) return '-';
          const yearDiff = now.getFullYear() - start.getFullYear();
          const monthDiff = now.getMonth() - start.getMonth();
          const totalMonths = yearDiff * 12 + monthDiff;
          if (totalMonths < 0) return '0 Bulan';
          const y = Math.floor(totalMonths / 12);
          const m = totalMonths % 12;
          return y > 0 ? `${y} Tahun ${m} Bulan` : `${m} Bulan`;
        } catch {
          return '-';
        }
      })(),
      bulan: formBulan,
      tahun: formTahun,
      income: { ...income },
      deduction: { ...deduction },
      total_pendapatan: totalPendapatan,
      total_pengeluaran: totalPengeluaran,
      thp,
      slip_sent: editingSlipId ? (existing.find(s => s.id === editingSlipId)?.slip_sent || false) : false,
      created_at: new Date().toISOString(),
    };
    let updated;
    if (editingSlipId) {
      updated = existing.map(s => s.id === editingSlipId ? newSlip : s);
    } else {
      // Cek duplikat bulan+tahun+karyawan
      const dup = existing.find(s =>
        String(s.employee_id) === String(selectedEmployee) &&
        s.bulan === formBulan && s.tahun === formTahun
      );
      if (dup) {
        showToast('error', '⚠️ Slip gaji untuk karyawan ini di bulan/tahun yang sama sudah ada!');
        return;
      }
      updated = [...existing, newSlip];
    }

    saveSlips(updated);
    setSlips(updated);
    setShowModal(false);
    setPreviewSlip(newSlip); // Auto preview right after saving!
    showToast('success', `✅ Slip gaji ${newSlip.nama_karyawan} berhasil ${editingSlipId ? 'diperbarui' : 'disimpan'}!`);
  };

  // ── Hapus slip ──
  const triggerDelete = (id) => {
    setConfirmModal({
      open: true,
      title: 'Hapus Slip Gaji',
      msg: 'Yakin ingin menghapus slip gaji ini secara permanen?',
      onConfirm: () => {
        const updated = loadSlips().filter(s => s.id !== id);
        saveSlips(updated);
        setSlips(updated);
        showToast('success', '🗑️ Slip gaji berhasil dihapus.');
      }
    });
  };

  // ── Dapatkan status log pengiriman slip ──
  const getSlipLogStatus = (slip) => {
    try {
      const mobileSlips = JSON.parse(localStorage.getItem('hris_payroll_mobile_slips') || '[]');
      const found = mobileSlips.find(
        s => String(s.employee_id) === String(slip.employee_id) && 
             Number(s.bulan) === Number(slip.bulan) && 
             Number(s.tahun) === Number(slip.tahun)
      );
      if (!found) return 'belum_kirim';
      return (found.is_read || found.isRead) ? 'dibaca' : 'terkirim';
    } catch {
      return 'belum_kirim';
    }
  };

  const getNotificationStatusBadge = (slip) => {
    const status = getSlipLogStatus(slip);
    if (status === 'dibaca') {
      return (
        <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '4px 8px', fontSize: '0.72rem', borderRadius: '6px', fontWeight: '700', whiteSpace: 'nowrap' }}>
          Dibaca
        </span>
      );
    }
    if (status === 'terkirim') {
      return (
        <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '4px 8px', fontSize: '0.72rem', borderRadius: '6px', fontWeight: '700', whiteSpace: 'nowrap' }}>
          Diterima
        </span>
      );
    }
    if (slip.slip_sent) {
      return (
        <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '4px 8px', fontSize: '0.72rem', borderRadius: '6px', fontWeight: '700', whiteSpace: 'nowrap' }}>
          Terkirim
        </span>
      );
    }
    return (
      <span className="badge" style={{ background: 'rgba(100, 116, 139, 0.1)', color: '#64748b', border: '1px solid rgba(100, 116, 139, 0.3)', padding: '4px 8px', fontSize: '0.72rem', borderRadius: '6px', fontWeight: '700', whiteSpace: 'nowrap' }}>
        Belum Dikirim
      </span>
    );
  };

  // ── Kirim slip ke mobile ──
  const handleSendSlipConfirm = (slip) => {
    const ok = sendSlipToMobile(slip);
    if (ok) {
      // Tandai sudah terkirim
      const updated = loadSlips().map(s => s.id === slip.id ? { ...s, slip_sent: true } : s);
      saveSlips(updated);
      setSlips(updated);
      showToast('success', `📱 Slip gaji ${slip.nama_karyawan} berhasil dikirim ke HP!`);
    } else {
      showToast('error', '❌ Gagal mengirim slip. Coba lagi.');
    }
  };

  const handleDownloadPDF = () => {
    try {
      const doc = new jsPDF('landscape');
      
      // Title Section
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('REKAPITULASI PAYROLL KARYAWAN - BAROKAH GRUP', 14, 18);
      
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(10);
      const periodeText = `Periode: ${BULAN[filterBulan - 1]} ${filterTahun}`;
      const outletText = `Outlet: ${filterOutlet || 'Semua Outlet'}`;
      const userText = `Karyawan: ${filterEmployeeId === 'ALL' ? 'Semua Karyawan' : (employees.find(e => String(e.id) === String(filterEmployeeId) || String(e.employee_id) === String(filterEmployeeId))?.full_name || filterEmployeeId)}`;
      doc.text(`${periodeText}   |   ${outletText}   |   ${userText}`, 14, 25);
      doc.text(`Tanggal Cetak: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} WIB`, 14, 30);
      
      // Prepare Table Data
      const tableHeaders = [['No', 'Nama Karyawan', 'Outlet', 'Jabatan', 'Lama Kerja', 'Total Pendapatan', 'Total Pengeluaran', 'Gaji THP', 'Status Kirim']];
      
      const tableData = filtered.map((slip, idx) => [
        idx + 1,
        toTitleCase(slip.nama_karyawan),
        slip.outlet || '-',
        toTitleCase(slip.jabatan) || '-',
        slip.lama_bekerja || '-',
        formatCurrency(slip.total_pendapatan),
        slip.total_pengeluaran > 0 ? `-${formatCurrency(slip.total_pengeluaran)}` : 'Rp 0',
        formatCurrency(slip.thp),
        getSlipLogStatus(slip) === 'dibaca' ? 'Dibaca' : getSlipLogStatus(slip) === 'terkirim' ? 'Diterima' : slip.slip_sent ? 'Terkirim' : 'Belum Kirim'
      ]);
      
      // Subtotal row at the bottom
      tableData.push([
        '',
        'TOTAL REKAP',
        '',
        '',
        `${filtered.length} Karyawan`,
        formatCurrency(totalPendapatanAll),
        `-${formatCurrency(totalPengeluaranAll)}`,
        formatCurrency(totalThp),
        ''
      ]);
      
      autoTable(doc, {
        startY: 35,
        head: tableHeaders,
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] }, // Blue theme accent color
        footStyles: { fillColor: [240, 244, 248], textColor: [15, 23, 42], fontStyle: 'bold' },
        didParseCell: (data) => {
          // Make the last row bold (total row)
          if (data.row.index === tableData.length - 1) {
            data.cell.styles.fontStyle = 'bold';
          }
        }
      });
      
      doc.save(`Rekap_Payroll_BarokahGrup_${BULAN[filterBulan - 1]}_${filterTahun}.pdf`);
      showToast('success', '📄 PDF Rekap Payroll berhasil diunduh!');
    } catch (err) {
      console.error(err);
      showToast('error', '❌ Gagal mengunduh PDF. Silakan coba lagi.');
    }
  };

  // ── Data yang sudah difilter ──
  const filtered = slips.filter(s => {
    const matchBulan = s.bulan === filterBulan;
    const matchTahun = s.tahun === filterTahun;
    const matchOutlet = filterOutlet === '' || s.outlet === filterOutlet;
    const matchEmployee = filterEmployeeId === 'ALL' || String(s.employee_id) === String(filterEmployeeId);
    return matchBulan && matchTahun && matchOutlet && matchEmployee;
  });
  // ── Pagination ──
  const indexOfLastRow = currentPage * 10;
  const indexOfFirstRow = indexOfLastRow - 10;
  const currentRows = filtered.slice(indexOfFirstRow, indexOfLastRow);
  const totalPages = Math.ceil(filtered.length / 10);

  const handlePageChange = (pageNumber) => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentPage(pageNumber);
      setIsTransitioning(false);
    }, 200);
  };
  // ── Summary stats ──
  const totalThp = filtered.reduce((sum, s) => sum + (s.thp || 0), 0);
  const totalPendapatanAll = filtered.reduce((sum, s) => sum + (s.total_pendapatan || 0), 0);
  const totalPengeluaranAll = filtered.reduce((sum, s) => sum + (s.total_pengeluaran || 0), 0);
  const sudahDikirim = filtered.filter(s => s.slip_sent).length;

  // ── Rekap Dynamic Filtered Data ──
  const filteredRekap = React.useMemo(() => {
    return calculatedPayrollData.filter(emp => {
      const matchOutlet = rekapOutlet === 'ALL' || (emp.outlet || emp.nama_outlet || '').toUpperCase().trim() === rekapOutlet.toUpperCase().trim();
      const matchKaryawan = rekapKaryawan === 'ALL' || String(emp.id) === String(rekapKaryawan) || String(emp.employee_id) === String(rekapKaryawan);
      return matchOutlet && matchKaryawan;
    });
  }, [calculatedPayrollData, rekapOutlet, rekapKaryawan]);

  // Rekap Pagination
  const rekapIndexOfLastRow = rekapCurrentPage * 10;
  const rekapIndexOfFirstRow = rekapIndexOfLastRow - 10;
  const rekapCurrentRows = filteredRekap.slice(rekapIndexOfFirstRow, rekapIndexOfLastRow);
  const rekapTotalPages = Math.ceil(filteredRekap.length / 10);

  const handleRekapPageChange = (pageNumber) => {
    setRekapIsTransitioning(true);
    setTimeout(() => {
      setRekapCurrentPage(pageNumber);
      setRekapIsTransitioning(false);
    }, 200);
  };

  // Rekap KPI Stats
  const rekapTotalThp = filteredRekap.reduce((sum, s) => sum + (s.payroll.thp || 0), 0);
  const rekapTotalPendapatanAll = filteredRekap.reduce((sum, s) => sum + (s.payroll.pendapatan || 0), 0);
  const rekapTotalPengeluaranAll = filteredRekap.reduce((sum, s) => sum + (s.payroll.pengeluaran || 0), 0);
  const rekapKaryawanCount = filteredRekap.length;
  const rekapSudahDikirim = filteredRekap.filter(emp => 
    slips.some(s => {
      const monthsArray = Array.isArray(rekapBulan) ? rekapBulan : [rekapBulan];
      return String(s.employee_id) === String(emp.id) && 
        monthsArray.includes(s.bulan) && 
        s.tahun === rekapTahun && 
        s.slip_sent;
    })
  ).length;

  // ── Styles reusable ──
  const S = {
    card: {
      background: PALETTE.bgSurface,
      border: `1px solid ${PALETTE.accent}`,
      borderRadius: '14px',
      padding: '18px 22px',
    },
    stickyTh: {
      position: 'sticky',
      left: 0,
      background: PALETTE.bgSurface,
      zIndex: 3,
      borderRight: `2px solid ${PALETTE.accent}`,
    },
    stickyTd: {
      position: 'sticky',
      left: 0,
      background: 'inherit',
      zIndex: 2,
      borderRight: `2px solid ${PALETTE.accent}`,
    },
    th: {
      padding: '14px 16px',
      fontSize: '0.72rem',
      fontWeight: 800,
      color: PALETTE.creamMuted,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      background: PALETTE.bgSurface,
      whiteSpace: 'nowrap',
      borderBottom: `2px solid ${PALETTE.accent}`,
    },
    td: {
      padding: '13px 16px',
      fontSize: '0.85rem',
      color: PALETTE.cream,
      whiteSpace: 'nowrap',
      borderBottom: `1px solid rgba(65,45,21,0.35)`,
      verticalAlign: 'middle',
    },
  };

  const renderTabNavigation = () => {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: `1px solid var(--border-color)`, paddingBottom: '12px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
          💰 Kelola Slip Gaji Karyawan (Payroll)
        </h2>
      </div>
    );
  };

  return (
    <div className="glass-card animate-fade-in" style={{ padding: '30px' }}>

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: 'fixed', top: '24px', right: '24px', zIndex: 9999,
          padding: '14px 20px', borderRadius: '12px', minWidth: '300px',
          background: toast.type === 'success' ? 'rgba(46,204,113,0.92)' : 'rgba(231,76,60,0.92)',
          border: `1px solid ${toast.type === 'success' ? '#2ecc71' : '#e74c3c'}`,
          color: '#fff', fontWeight: 700, fontSize: '0.88rem',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          animation: 'slideIn 0.3s ease',
        }}>
          {toast.text}
        </div>
      )}

      {renderTabNavigation()}

      {/* ── KPI Summary Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px,1fr))', gap: '16px', marginBottom: '28px' }}>
        {[
          { label: 'Total Anggaran THP', val: formatCurrency(totalThp), color: 'var(--text-main)', icon: <Coins size={16}/>, bg: 'var(--primary-glow)' },
          { label: 'Total Pendapatan', val: formatCurrency(totalPendapatanAll), color: 'var(--success)', icon: <TrendingUp size={16}/>, bg: 'var(--success-glow)' },
          { label: 'Total Pengeluaran', val: formatCurrency(totalPengeluaranAll), color: 'var(--danger)', icon: <TrendingDown size={16}/>, bg: 'var(--danger-glow)' },
          { label: 'Jumlah Karyawan', val: `${filtered.length} Orang`, color: 'var(--warning)', icon: <Users size={16}/>, bg: 'var(--warning-glow)' },
          { label: 'Slip Terkirim', val: `${sudahDikirim} / ${filtered.length}`, color: 'var(--success)', icon: <CheckCircle size={16}/>, bg: 'var(--success-glow)' },
        ].map((c, i) => (
          <div key={i} style={{ ...S.card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px 20px' }}>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>{c.label}</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: c.color }}>{c.val}</div>
            </div>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.color }}>
              {c.icon}
            </div>
          </div>
        ))}
      </div>

      {/* ── Panel Filter Terkondisi ── */}
      {activeTab === 'rekap' && (
        /* ── PANEL FILTER BERLAPIS (DI ATAS TABEL REKAP) ── */
        <div style={{
          ...S.card,
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          alignItems: 'flex-end',
          marginBottom: '20px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)'
        }}>
          {/* Dropdown 1: Pilih Bulan & Tahun */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative' }} ref={monthDropdownRef}>
              <label style={{ fontSize: '0.72rem', color: PALETTE.creamMuted, fontWeight: 700, textTransform: 'uppercase' }}>Bulan</label>
              <button
                type="button"
                onClick={() => setShowMonthDropdown(!showMonthDropdown)}
                style={{
                  height: '40px',
                  padding: '0 12px',
                  background: PALETTE.bgMain,
                  border: `1px solid ${PALETTE.accent}`,
                  borderRadius: '8px',
                  color: PALETTE.cream,
                  fontSize: '0.85rem',
                  minWidth: '150px',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>
                  {getBulanLabel()}
                </span>
                <ChevronDown size={14} style={{ color: PALETTE.creamMuted, marginLeft: '6px', flexShrink: 0 }} />
              </button>

              {showMonthDropdown && (
                <div style={{
                  position: 'absolute',
                  top: '46px',
                  left: 0,
                  zIndex: 100,
                  background: PALETTE.bgSurface,
                  border: `1px solid ${PALETTE.accent}`,
                  borderRadius: '8px',
                  padding: '10px',
                  width: '200px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}>
                  {/* Option: Semua Bulan */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: PALETTE.cream, cursor: 'pointer', padding: '4px 6px', borderRadius: '4px' }}
                         onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.08)'}
                         onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <input
                      type="checkbox"
                      checked={rekapBulan.length === 12}
                      onChange={() => {
                        if (rekapBulan.length === 12) {
                          setRekapBulan([]);
                        } else {
                          setRekapBulan([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
                        }
                      }}
                      style={{ accentColor: PALETTE.cream }}
                    />
                    <span style={{ fontWeight: 700 }}>Pilih Semua</span>
                  </label>
                  <div style={{ borderBottom: `1px solid ${PALETTE.accent}`, margin: '2px 0' }} />
                  
                  {/* List of 12 Months */}
                  <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {BULAN.map((b, i) => {
                      const monthVal = i + 1;
                      const isChecked = rekapBulan.includes(monthVal);
                      return (
                        <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: PALETTE.cream, cursor: 'pointer', padding: '4px 6px', borderRadius: '4px' }}
                               onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.08)'}
                               onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                setRekapBulan(rekapBulan.filter(m => m !== monthVal));
                              } else {
                                setRekapBulan([...rekapBulan, monthVal].sort((a, b) => a - b));
                              }
                            }}
                            style={{ accentColor: PALETTE.cream }}
                          />
                          {b}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.72rem', color: PALETTE.creamMuted, fontWeight: 700, textTransform: 'uppercase' }}>Tahun</label>
              <select
                value={rekapTahun}
                onChange={e => setRekapTahun(Number(e.target.value))}
                style={{ height: '40px', padding: '0 12px', background: PALETTE.bgMain, border: `1px solid ${PALETTE.accent}`, borderRadius: '8px', color: PALETTE.cream, fontSize: '0.85rem', minWidth: '100px', outline: 'none' }}
              >
                {TAHUN.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          {/* Dropdown 2: Pilih Outlet */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '180px' }}>
            <label style={{ fontSize: '0.72rem', color: PALETTE.creamMuted, fontWeight: 700, textTransform: 'uppercase' }}>Pilih Outlet</label>
            <select
              value={rekapOutlet}
              onChange={handleOutletChange}
              style={{ height: '40px', padding: '0 12px', background: PALETTE.bgMain, border: `1px solid ${PALETTE.accent}`, borderRadius: '8px', color: PALETTE.cream, fontSize: '0.85rem', width: '100%', outline: 'none' }}
            >
              <option value="ALL">Semua Outlet</option>
              {availableOutlets.map((o, i) => <option key={i} value={o}>{o}</option>)}
            </select>
          </div>

          {/* Dropdown 3: Pilih Karyawan (Cascade) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '220px' }}>
            <label style={{ fontSize: '0.72rem', color: PALETTE.creamMuted, fontWeight: 700, textTransform: 'uppercase' }}>Pilih Karyawan</label>
            <select
              value={rekapKaryawan}
              onChange={e => setRekapKaryawan(e.target.value)}
              style={{ height: '40px', padding: '0 12px', background: PALETTE.bgMain, border: `1px solid ${PALETTE.accent}`, borderRadius: '8px', color: PALETTE.cream, fontSize: '0.85rem', width: '100%', outline: 'none' }}
            >
              <option value="ALL">Semua Karyawan</option>
              {filteredEmployeesForDropdown.map((emp, i) => (
                <option key={i} value={emp.id || emp.employee_id}>
                  {emp.full_name || emp.nama} ({emp.employee_id || emp.id})
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {activeTab === 'slips' && (
        /* ── Panel Filter Riwayat Slip Gaji + Tombol Tambah ── */
        <div style={{
          ...S.card,
          display: 'flex', flexWrap: 'wrap', gap: '14px',
          alignItems: 'flex-end', marginBottom: '20px',
        }}>
          {/* Filter Outlet */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.72rem', color: PALETTE.creamMuted, fontWeight: 700, textTransform: 'uppercase' }}>Filter Outlet</label>
            <select
              value={filterOutlet}
              onChange={handleSlipsOutletChange}
              style={{ height: '40px', padding: '0 12px', background: PALETTE.bgMain, border: `1px solid ${PALETTE.accent}`, borderRadius: '8px', color: PALETTE.cream, fontSize: '0.85rem', minWidth: '160px', outline: 'none' }}
              disabled={availableOutlets.length === 0}
            >
              <option value="">{availableOutlets.length === 0 ? '— Outlet Kosong —' : '— Semua Outlet —'}</option>
              {availableOutlets.map((o, i) => <option key={i} value={o}>{o}</option>)}
            </select>
          </div>

          {/* Filter Karyawan (Cascade) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '220px' }}>
            <label style={{ fontSize: '0.72rem', color: PALETTE.creamMuted, fontWeight: 700, textTransform: 'uppercase' }}>Filter Karyawan</label>
            <select
              value={filterEmployeeId}
              onChange={e => {
                setFilterEmployeeId(e.target.value);
                setCurrentPage(1);
              }}
              style={{ height: '40px', padding: '0 12px', background: PALETTE.bgMain, border: `1px solid ${PALETTE.accent}`, borderRadius: '8px', color: PALETTE.cream, fontSize: '0.85rem', width: '100%', outline: 'none' }}
            >
              <option value="ALL">Semua Karyawan</option>
              {filteredEmployeesForDropdown.map((emp, i) => (
                <option key={i} value={emp.id || emp.employee_id}>
                  {toTitleCase(emp.full_name || emp.nama)} ({emp.employee_id || emp.id})
                </option>
              ))}
            </select>
          </div>

          {/* Filter Bulan */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.72rem', color: PALETTE.creamMuted, fontWeight: 700, textTransform: 'uppercase' }}>Filter Bulan</label>
            <select
              value={filterBulan}
              onChange={e => {
                setFilterBulan(Number(e.target.value));
                setCurrentPage(1);
              }}
              style={{ height: '40px', padding: '0 12px', background: PALETTE.bgMain, border: `1px solid ${PALETTE.accent}`, borderRadius: '8px', color: PALETTE.cream, fontSize: '0.85rem', minWidth: '140px', outline: 'none' }}
            >
              {BULAN.map((b, i) => <option key={i} value={i + 1}>{b}</option>)}
            </select>
          </div>

          {/* Filter Tahun */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.72rem', color: PALETTE.creamMuted, fontWeight: 700, textTransform: 'uppercase' }}>Filter Tahun</label>
            <select
              value={filterTahun}
              onChange={e => {
                setFilterTahun(Number(e.target.value));
                setCurrentPage(1);
              }}
              style={{ height: '40px', padding: '0 12px', background: PALETTE.bgMain, border: `1px solid ${PALETTE.accent}`, borderRadius: '8px', color: PALETTE.cream, fontSize: '0.85rem', minWidth: '100px', outline: 'none' }}
            >
              {TAHUN.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {/* Column filter toggle */}
          <div style={{ position: 'relative', alignSelf: 'flex-end' }}>
            <button
              onClick={() => setShowColFilter(!showColFilter)}
              style={{
                height: '40px', padding: '0 14px', background: PALETTE.accent,
                border: `1px solid ${PALETTE.accent}`, borderRadius: '8px',
                color: PALETTE.cream, fontSize: '0.82rem', fontWeight: 700,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
              }}
            >
              <Filter size={14} /> KOLOM
            </button>
            {showColFilter && (
              <div style={{
                position: 'absolute', bottom: '46px', right: 0, zIndex: 50,
                background: PALETTE.bgSurface, border: `1px solid ${PALETTE.accent}`,
                borderRadius: '12px', padding: '14px', minWidth: '180px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', gap: '8px',
              }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: PALETTE.cream, textTransform: 'uppercase', marginBottom: '4px' }}>Tampilkan Kolom</div>
                {Object.entries(colLabels).map(([k, v]) => (
                  <label key={k} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: PALETTE.cream, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={visibleCols[k]}
                      onChange={() => setVisibleCols(p => ({ ...p, [k]: !p[k] }))}
                      style={{ accentColor: PALETTE.cream }}
                    />
                    {v}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Tombol PDF */}
          <button
            onClick={handleDownloadPDF}
            style={{
              height: '40px', padding: '0 18px', background: '#3b82f6',
              border: 'none', borderRadius: '8px', color: '#ffffff',
              fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px',
              alignSelf: 'flex-end',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#2563eb'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#3b82f6'; e.currentTarget.style.transform = 'none'; }}
          >
            📄 UNDUH PDF
          </button>

          {/* Tombol tambah */}
          <button
            onClick={openAddModal}
            style={{
              height: '40px', padding: '0 18px', background: PALETTE.cream,
              border: 'none', borderRadius: '8px', color: PALETTE.bgMain,
              fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px',
              alignSelf: 'flex-end',
              boxShadow: '0 4px 12px rgba(165, 182, 141, 0.2)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f0ebe0'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = PALETTE.cream; e.currentTarget.style.transform = 'none'; }}
          >
            <Plus size={16} /> TAMBAHKAN GAJI
          </button>
        </div>
      )}



      {/* ── Tabel Terkondisi (Rekap vs Slips vs Kasbon) ── */}
      {activeTab === 'rekap' && (
        <>
          <div style={{ overflowX: 'auto', borderRadius: '12px', border: `1px solid ${PALETTE.accent}` }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
              <thead>
                <tr>
                  <th style={{ ...S.th, ...S.stickyTh, width: '48px', textAlign: 'center' }}>No</th>
                  <th style={{ ...S.th, ...S.stickyTh, left: '48px', minWidth: '160px' }}>Nama Lengkap</th>
                  <th style={S.th}>Outlet</th>
                  <th style={S.th}>Jabatan</th>
                  <th style={{ ...S.th, color: PALETTE.success }}>Pendapatan</th>
                  <th style={{ ...S.th, color: PALETTE.danger }}>Pengeluaran</th>
                  <th style={{ ...S.th, color: PALETTE.cream }}>Gaji THP</th>
                  <th style={{ ...S.th, width: '90px', textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody style={{
                opacity: rekapIsTransitioning ? 0 : 1,
                transform: rekapIsTransitioning ? 'scale(0.99)' : 'scale(1)',
                transition: 'opacity 0.4s ease-in-out, transform 0.3s ease'
              }}>
                {loading ? (
                  <tr>
                    <td
                      colSpan={8}
                      style={{ ...S.td, textAlign: 'center', padding: '40px' }}
                    >
                      <div className="spinner-container" style={{ minHeight: '120px' }}>
                        <div className="loading-spinner" style={{ width: '36px', height: '36px', border: '4px solid var(--border-color)', borderTopColor: 'var(--text-main)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px auto' }}></div>
                        <p className="loading-text" style={{ fontSize: '0.85rem', color: PALETTE.creamMuted }}>Menyelaraskan data rekap payroll...</p>
                      </div>
                    </td>
                  </tr>
                ) : rekapCurrentRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      style={{ ...S.td, textAlign: 'center', padding: '40px', color: PALETTE.creamMuted }}
                    >
                      📋 Belum ada data karyawan untuk outlet / filter yang dipilih.
                    </td>
                  </tr>
                ) : (
                  rekapCurrentRows.map((emp, idx) => (
                    <tr
                      key={emp.id || emp.employee_id}
                      style={{ background: idx % 2 === 0 ? PALETTE.bgMain : PALETTE.bgSurface, transition: 'background 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(65,45,21,0.55)'}
                      onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? PALETTE.bgMain : PALETTE.bgSurface}
                    >
                      <td style={{ ...S.td, ...S.stickyTd, textAlign: 'center', fontWeight: 700, color: PALETTE.creamMuted }}>
                        {rekapIndexOfFirstRow + idx + 1}
                      </td>
                      <td style={{ ...S.td, ...S.stickyTd, left: '48px', fontWeight: 700, color: PALETTE.cream }}>
                        {toTitleCase(emp.full_name || emp.nama)}
                        <div style={{ fontSize: '0.72rem', color: PALETTE.creamMuted, fontWeight: 500, marginTop: '2px' }}>
                          ID: {emp.employee_id || emp.id}
                        </div>
                      </td>
                      <td style={S.td}>
                        <span style={{
                          background: 'rgba(65,45,21,0.5)', color: PALETTE.cream,
                          padding: '3px 10px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600,
                        }}>
                          {emp.outlet || emp.nama_outlet || '-'}
                        </span>
                      </td>
                      <td style={{ ...S.td, color: PALETTE.creamMuted }}>{toTitleCase(emp.jabatan) || '-'}</td>
                      <td style={{ ...S.td, color: PALETTE.cream, fontWeight: 700, fontFamily: 'JetBrains Mono, Fira Code, Monaco, Courier New, monospace' }}>
                        {formatCurrency(emp.payroll.pendapatan)}
                      </td>
                      <td style={{ ...S.td, color: PALETTE.cream, fontWeight: 700, fontFamily: 'JetBrains Mono, Fira Code, Monaco, Courier New, monospace' }}>
                        {emp.payroll.pengeluaran > 0 ? `-${formatCurrency(emp.payroll.pengeluaran)}` : 'Rp 0'}
                      </td>
                      <td style={{ ...S.td, color: PALETTE.cream, fontWeight: 800, fontSize: '0.9rem', fontFamily: 'JetBrains Mono, Fira Code, Monaco, Courier New, monospace' }}>
                        {formatCurrency(emp.payroll.thp)}
                      </td>
                      <td style={{ ...S.td, textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button
                            onClick={() => handleEditRekap(emp)}
                            title="Edit Gaji"
                            style={{
                              width: '28px', height: '28px', background: 'rgba(65,45,21,0.5)',
                              border: `1px solid ${PALETTE.accent}`, borderRadius: '6px',
                              color: PALETTE.cream, cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.8rem'
                            }}
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => {
                              const existing = getExistingSlipForRekap(emp);
                              if (existing) {
                                triggerDelete(existing.id);
                              } else {
                                showToast('info', 'ℹ️ Belum ada slip gaji yang disimpan untuk karyawan ini.');
                              }
                            }}
                            title="Hapus Gaji"
                            style={{
                              width: '28px', height: '28px', background: 'rgba(231,76,60,0.1)',
                              border: `1px solid rgba(231,76,60,0.3)`, borderRadius: '6px',
                              color: PALETTE.danger, cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>

              {/* ── Baris Subtotal Rekap ── */}
              {filteredRekap.length > 0 && (
                <tfoot>
                  <tr style={{ background: PALETTE.accent }}>
                    <td style={{ ...S.td, fontWeight: 800 }}></td>
                    <td style={{ ...S.td, ...S.stickyTd, left: '48px', fontWeight: 800, color: PALETTE.cream, background: PALETTE.accent }}>
                      TOTAL ({filteredRekap.length} Orang)
                    </td>
                    <td style={S.td}></td>
                    <td style={S.td}></td>
                    <td style={{ ...S.td, fontWeight: 800, color: PALETTE.cream, fontFamily: 'JetBrains Mono, Fira Code, Monaco, Courier New, monospace' }}>
                      {formatCurrency(rekapTotalPendapatanAll)}
                    </td>
                    <td style={{ ...S.td, fontWeight: 800, color: PALETTE.cream, fontFamily: 'JetBrains Mono, Fira Code, Monaco, Courier New, monospace' }}>
                      -{formatCurrency(rekapTotalPengeluaranAll)}
                    </td>
                    <td style={{ ...S.td, fontWeight: 800, color: PALETTE.cream, fontSize: '0.92rem', fontFamily: 'JetBrains Mono, Fira Code, Monaco, Courier New, monospace' }}>
                      {formatCurrency(rekapTotalThp)}
                    </td>
                    <td style={S.td}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Controls Pagination Rekap */}
          {rekapTotalPages > 1 && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '16px',
              padding: '12px 20px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              gap: '16px',
              flexWrap: 'wrap'
            }}>
              <span style={{ fontSize: '0.85rem', color: 'rgba(238, 238, 238, 0.55)' }}>
                Menampilkan {rekapIndexOfFirstRow + 1}-{Math.min(rekapIndexOfLastRow, filteredRekap.length)} dari {filteredRekap.length} karyawan
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => handleRekapPageChange(rekapCurrentPage - 1)}
                  disabled={rekapCurrentPage === 1}
                  style={{
                    background: 'transparent',
                    color: 'var(--text-main)',
                    border: '1px solid var(--border-color)',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    cursor: rekapCurrentPage === 1 ? 'not-allowed' : 'pointer',
                    opacity: rekapCurrentPage === 1 ? 0.4 : 1,
                    fontSize: '0.85rem',
                    transition: 'all 0.2s'
                  }}
                >
                  Sebelumnya
                </button>
                {Array.from({ length: rekapTotalPages }, (_, i) => i + 1).map(p => {
                  const isActive = p === rekapCurrentPage;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handleRekapPageChange(p)}
                      style={{
                        background: isActive ? 'var(--text-main)' : 'transparent',
                        color: isActive ? 'var(--bg-surface)' : 'var(--text-main)',
                        border: `1px solid ${isActive ? 'var(--text-main)' : 'var(--border-color)'}`,
                        width: '32px',
                        height: '32px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: isActive ? '700' : '500',
                        fontSize: '0.85rem',
                        transition: 'all 0.2s'
                      }}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => handleRekapPageChange(rekapCurrentPage + 1)}
                  disabled={rekapCurrentPage === rekapTotalPages}
                  style={{
                    background: 'transparent',
                    color: 'var(--text-main)',
                    border: '1px solid var(--border-color)',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    cursor: rekapCurrentPage === rekapTotalPages ? 'not-allowed' : 'pointer',
                    opacity: rekapCurrentPage === rekapTotalPages ? 0.4 : 1,
                    fontSize: '0.85rem',
                    transition: 'all 0.2s'
                  }}
                >
                  Berikutnya
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'slips' && (
        <>
          <div style={{ overflowX: 'auto', borderRadius: '12px', border: `1px solid ${PALETTE.accent}` }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
              <thead>
                <tr>
                  {visibleCols.no && <th style={{ ...S.th, ...S.stickyTh, width: '48px', textAlign: 'center' }}>No</th>}
                  {visibleCols.nama && <th style={{ ...S.th, ...S.stickyTh, left: visibleCols.no ? '48px' : 0, minWidth: '160px' }}>Nama Karyawan</th>}
                  {visibleCols.outlet && <th style={S.th}>Outlet</th>}
                  {visibleCols.jabatan && <th style={S.th}>Jabatan</th>}
                  {visibleCols.lama_bekerja && <th style={S.th}>Lama Bekerja</th>}
                  {visibleCols.total_pendapatan && <th style={{ ...S.th, color: PALETTE.success }}>Total Pendapatan</th>}
                  {visibleCols.total_pengeluaran && <th style={{ ...S.th, color: PALETTE.danger }}>Total Pengeluaran</th>}
                  {visibleCols.thp && <th style={{ ...S.th, color: PALETTE.cream }}>Gaji THP</th>}
                  {visibleCols.log_kirim && <th style={{ ...S.th, textAlign: 'center' }}>Status Notifikasi</th>}
                  {visibleCols.aksi && <th style={{ ...S.th, textAlign: 'center' }}>Aksi</th>}
                </tr>
              </thead>
              <tbody style={{
                opacity: isTransitioning ? 0 : 1,
                transform: isTransitioning ? 'scale(0.99)' : 'scale(1)',
                transition: 'opacity 0.4s ease-in-out, transform 0.3s ease'
              }}>
                {loading ? (
                  <tr>
                    <td
                      colSpan={Object.values(visibleCols).filter(Boolean).length}
                      style={{ ...S.td, textAlign: 'center', padding: '40px' }}
                    >
                      <div className="spinner-container" style={{ minHeight: '120px' }}>
                        <div className="loading-spinner" style={{ width: '36px', height: '36px', border: '4px solid var(--border-color)', borderTopColor: 'var(--text-main)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px auto' }}></div>
                        <p className="loading-text" style={{ fontSize: '0.85rem', color: PALETTE.creamMuted }}>Menyelaraskan data slip gaji...</p>
                      </div>
                    </td>
                  </tr>
                ) : currentRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={Object.values(visibleCols).filter(Boolean).length}
                      style={{ ...S.td, textAlign: 'center', padding: '40px', color: PALETTE.creamMuted }}
                    >
                      📋 Belum ada data slip gaji untuk {BULAN[filterBulan - 1]} {filterTahun}
                      {filterOutlet ? ` — Outlet: ${filterOutlet}` : ''}. <br />
                      Klik <strong style={{ color: PALETTE.cream }}>TAMBAHKAN GAJI</strong> untuk menginput data.
                    </td>
                  </tr>
                ) : (
                  currentRows.map((slip, idx) => {
                    const relatedEmp = employees.find(emp => 
                      String(emp.id) === String(slip.employee_id) || 
                      String(emp.employee_id) === String(slip.employee_id)
                    );
                    const isEmpInactive = relatedEmp?.employee_status === 'inactive' || relatedEmp?.status === 'inactive';

                    return (
                      <tr
                        key={slip.id}
                        style={{ background: idx % 2 === 0 ? PALETTE.bgMain : PALETTE.bgSurface, transition: 'background 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.08)'}
                        onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? PALETTE.bgMain : PALETTE.bgSurface}
                      >
                        {visibleCols.no && (
                          <td style={{ ...S.td, ...S.stickyTd, textAlign: 'center', fontWeight: 700, color: PALETTE.creamMuted }}>
                            {indexOfFirstRow + idx + 1}
                          </td>
                        )}
                        {visibleCols.nama && (
                          <td style={{ ...S.td, ...S.stickyTd, left: visibleCols.no ? '48px' : 0, fontWeight: 700, color: PALETTE.cream }}>
                            {toTitleCase(slip.nama_karyawan)}
                            <div style={{ fontSize: '0.72rem', color: PALETTE.creamMuted, fontWeight: 500, marginTop: '2px' }}>
                              {BULAN[slip.bulan - 1]} {slip.tahun}
                            </div>
                          </td>
                        )}
                        {visibleCols.outlet && (
                          <td style={S.td}>
                            <span style={{
                              background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-primary)',
                              padding: '3px 10px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600,
                            }}>
                              {slip.outlet || '-'}
                            </span>
                          </td>
                        )}
                        {visibleCols.jabatan && <td style={{ ...S.td, color: PALETTE.creamMuted }}>{toTitleCase(slip.jabatan) || '-'}</td>}
                        {visibleCols.lama_bekerja && <td style={{ ...S.td, color: PALETTE.creamMuted }}>{slip.lama_bekerja || '-'}</td>}
                        {visibleCols.total_pendapatan && (
                          <td style={{ ...S.td, color: PALETTE.success, fontWeight: 700 }}>
                            {formatCurrency(slip.total_pendapatan)}
                          </td>
                        )}
                        {visibleCols.total_pengeluaran && (
                          <td style={{ ...S.td, color: PALETTE.danger, fontWeight: 700 }}>
                            {slip.total_pengeluaran > 0 ? `-${formatCurrency(slip.total_pengeluaran)}` : 'Rp 0'}
                          </td>
                        )}
                        {visibleCols.thp && (
                          <td style={{
                            ...S.td, fontWeight: 800, fontSize: '0.9rem',
                            color: slip.thp >= 0 ? PALETTE.cream : PALETTE.danger,
                          }}>
                            {formatCurrency(slip.thp)}
                          </td>
                        )}
                        {visibleCols.log_kirim && (
                          <td style={{ ...S.td, textAlign: 'center' }}>
                            {getNotificationStatusBadge(slip)}
                          </td>
                        )}
                        {visibleCols.aksi && (
                          <td style={{ ...S.td, textAlign: 'center' }}>
                            {isEmpInactive ? (
                              <span style={{
                                background: 'rgba(52, 152, 219, 0.15)',
                                color: '#3498db',
                                border: '1px solid #3498db',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 'bold',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}>
                                ❄️ Frozen
                              </span>
                            ) : (
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
                                {/* Kirim Slip (Aksi Kirim) */}
                                <button
                                  onClick={() => setPreviewSlip(slip)}
                                  title="Pratinjau & Kirim Slip"
                                  style={{
                                    padding: '5px 10px', background: 'var(--accent-primary)',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800,
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                                    transition: 'all 0.2s',
                                  }}
                                >
                                  <Send size={11} />
                                  Kirim
                                </button>
                                {/* Edit */}
                                <button
                                  onClick={() => openEditModal(slip)}
                                  title="Edit Slip"
                                  style={{
                                    width: '30px', height: '30px', background: 'rgba(59, 130, 246, 0.1)',
                                    border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '6px',
                                    color: 'var(--accent-primary)', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  }}
                                >
                                  ✏️
                                </button>
                                {/* Hapus */}
                                <button
                                  onClick={() => triggerDelete(slip.id)}
                                  title="Hapus Slip"
                                  style={{
                                    width: '30px', height: '30px', background: 'rgba(231,76,60,0.1)',
                                    border: `1px solid rgba(231,76,60,0.3)`, borderRadius: '6px',
                                    color: PALETTE.danger, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  }}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>

              {/* ── Baris Subtotal Slips ── */}
              {filtered.length > 0 && (
                <tfoot>
                  <tr style={{ background: PALETTE.accent }}>
                    {visibleCols.no && <td style={{ ...S.td, fontWeight: 800 }}></td>}
                    {visibleCols.nama && (
                      <td style={{ ...S.td, ...S.stickyTd, left: visibleCols.no ? '48px' : 0, fontWeight: 800, color: PALETTE.cream, background: PALETTE.accent }}>
                        TOTAL ({filtered.length} Orang)
                      </td>
                    )}
                    {visibleCols.outlet && <td style={S.td}></td>}
                    {visibleCols.jabatan && <td style={S.td}></td>}
                    {visibleCols.lama_bekerja && <td style={S.td}></td>}
                    {visibleCols.total_pendapatan && (
                      <td style={{ ...S.td, fontWeight: 800, color: PALETTE.success }}>
                        {formatCurrency(totalPendapatanAll)}
                      </td>
                    )}
                    {visibleCols.total_pengeluaran && (
                      <td style={{ ...S.td, fontWeight: 800, color: PALETTE.danger }}>
                        -{formatCurrency(totalPengeluaranAll)}
                      </td>
                    )}
                    {visibleCols.thp && (
                      <td style={{ ...S.td, fontWeight: 800, color: PALETTE.cream, fontSize: '0.92rem' }}>
                        {formatCurrency(totalThp)}
                      </td>
                    )}
                    {visibleCols.log_kirim && <td style={S.td}></td>}
                    {visibleCols.aksi && <td style={S.td}></td>}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Controls Pagination Slips */}
          {totalPages > 1 && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '16px',
              padding: '12px 20px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              gap: '16px',
              flexWrap: 'wrap'
            }}>
              <span style={{ fontSize: '0.85rem', color: 'rgba(238, 238, 238, 0.55)' }}>
                Menampilkan {indexOfFirstRow + 1}-{Math.min(indexOfLastRow, filtered.length)} dari {filtered.length} slip gaji
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  style={{
                    background: 'transparent',
                    color: 'var(--text-main)',
                    border: '1px solid var(--border-color)',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    opacity: currentPage === 1 ? 0.4 : 1,
                    fontSize: '0.85rem',
                    transition: 'all 0.2s'
                  }}
                >
                  Sebelumnya
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => {
                  const isActive = p === currentPage;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handlePageChange(p)}
                      style={{
                        background: isActive ? 'var(--text-main)' : 'transparent',
                        color: isActive ? 'var(--bg-surface)' : 'var(--text-main)',
                        border: `1px solid ${isActive ? 'var(--text-main)' : 'var(--border-color)'}`,
                        width: '32px',
                        height: '32px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: isActive ? '700' : '500',
                        fontSize: '0.85rem',
                        transition: 'all 0.2s'
                      }}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  style={{
                    background: 'transparent',
                    color: 'var(--text-main)',
                    border: '1px solid var(--border-color)',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    opacity: currentPage === totalPages ? 0.4 : 1,
                    fontSize: '0.85rem',
                    transition: 'all 0.2s'
                  }}
                >
                  Berikutnya
                </button>
              </div>
            </div>
          )}
        </>
      )}



      {/* ── Modal Tambah / Edit Gaji ── */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(6px)', display: 'flex',
          alignItems: 'flex-start', justifyContent: 'center',
          padding: '30px 16px', overflowY: 'auto', zIndex: 1000,
        }}>
          <div style={{
            width: '100%', maxWidth: '750px',
            background: PALETTE.bgSurface, border: `1px solid ${PALETTE.accent}`,
            borderRadius: '20px', padding: '28px',
            animation: 'fadeIn 0.3s ease',
          }}>
            {/* Header Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', paddingBottom: '16px', borderBottom: `1px solid ${PALETTE.accent}` }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: PALETTE.cream }}>
                {editingSlipId ? '✏️ Edit Data Gaji' : '➕ Tambahkan Data Gaji'}
              </h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', color: PALETTE.cream, cursor: 'pointer' }}>
                <X size={22} />
              </button>
            </div>

            {/* Pilih Karyawan + Periode */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', marginBottom: '20px' }}>
              <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: PALETTE.creamMuted, textTransform: 'uppercase' }}>Nama Karyawan *</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <select
                    value={selectedEmployee}
                    onChange={e => setSelectedEmployee(e.target.value)}
                    required
                    style={{ height: '44px', padding: '0 14px', background: PALETTE.bgMain, border: `1px solid ${PALETTE.accent}`, borderRadius: '8px', color: PALETTE.cream, fontSize: '0.9rem', flex: 1 }}
                  >
                    <option value="">— Pilih Karyawan —</option>
                    {employees.map((e, i) => (
                      <option key={i} value={e.id || e.employee_id}>
                        {e.full_name || e.nama} {e.nik ? `(${e.nik})` : ''}
                      </option>
                    ))}
                  </select>
                  {selectedEmployee && (
                    <button
                      type="button"
                      onClick={() => handleAutoCalculate(selectedEmployee, formBulan, formTahun)}
                      style={{
                        height: '44px', padding: '0 16px', background: PALETTE.accent,
                        border: `1px solid ${PALETTE.accent}`, borderRadius: '8px',
                        color: PALETTE.cream, fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '6px'
                      }}
                    >
                      🔄 HITUNG OTOMATIS
                    </button>
                  )}
                </div>
                {selectedEmployee && (() => {
                  // ─── KALKULATOR KPI PERFORMA BULANAN ───
                  const empObj = employees.find(e => String(e.id) === String(selectedEmployee) || String(e.employee_id) === String(selectedEmployee));

                  // Pilar 1: Kehadiran (25%) — dari attendance logs bulan yg dipilih
                  const attLogs = JSON.parse(localStorage.getItem('hris_attendance_history') || '[]');
                  const empAttLogs = attLogs.filter(l => {
                    const d = new Date(l.date || '');
                    return (String(l.employee_id) === String(selectedEmployee) || l.nik === empObj?.nik)
                      && d.getMonth() + 1 === formBulan && d.getFullYear() === formTahun;
                  });

                  // Cari jumlah hari kerja di outlet pada periode tsb
                  const outletLogs = attLogs.filter(l => {
                    const d = new Date(l.date || '');
                    return l.outlet === empObj?.outlet && d.getMonth() + 1 === formBulan && d.getFullYear() === formTahun;
                  });
                  const uniqueDates = [...new Set(outletLogs.map(l => l.date))];
                  const totalWorkingDays = uniqueDates.length > 0 ? uniqueDates.length : 25;

                  const hadir = empAttLogs.filter(l => l.clock_in || l.status === 'Hadir' || l.status === 'Terlambat').length;
                  const kehadiranPct = totalWorkingDays > 0 ? Math.min(100, Math.round((hadir / totalWorkingDays) * 100)) : 0;
                  const kehadiranKPI = Math.round(kehadiranPct * 0.25);

                  // Pilar 2: Disiplin (25%) — keterlambatan
                  const lateCount = empAttLogs.filter(l => l.status_in === 'late' || l.status === 'Terlambat' || (l.notes && /terlambat|late/i.test(l.notes))).length;
                  const disiplinPct = hadir > 0 ? Math.max(0, Math.round(100 - (lateCount / hadir) * 100)) : 100;
                  const disiplinKPI = Math.round(disiplinPct * 0.25);

                  // Pilar 3: Survei 360 (30%)
                  const survey360Data = JSON.parse(localStorage.getItem('survey_360_data') || '[]');
                  const empSurvey = survey360Data.filter(s => String(s.target_id || s.employee_id) === String(selectedEmployee) && s.month === formBulan && s.year === formTahun);
                  const surveiPct = empSurvey.length > 0
                    ? Math.round(empSurvey.reduce((a, s) => a + (s.score || 0), 0) / empSurvey.length)
                    : 75;
                  const surveiKPI = Math.round(surveiPct * 0.30);

                  // Pilar 4: Training (10%)
                  const trainingKpiScores = JSON.parse(localStorage.getItem('hris_training_kpi_scores') || '[]');
                  const empTrainingScores = trainingKpiScores.filter(t => {
                    const d = new Date(t.updated_at || t.created_at || t.date || '');
                    return String(t.employee_id) === String(selectedEmployee) && d.getMonth() + 1 === formBulan && d.getFullYear() === formTahun;
                  });
                  const trainingPct = empTrainingScores.length > 0
                    ? Math.round(empTrainingScores.reduce((sum, t) => sum + (t.score || 0), 0) / empTrainingScores.length)
                    : 80;
                  const trainingKPI = Math.round(trainingPct * 0.10);

                  // Pilar 5: Kuis (10%)
                  const quizResults = JSON.parse(localStorage.getItem('quiz_results') || '[]');
                  const empQuizzes = quizResults.filter(q => {
                    const d = new Date(q.tanggal_selesai || q.date || '');
                    return String(q.employee_id) === String(selectedEmployee) && d.getMonth() + 1 === formBulan && d.getFullYear() === formTahun;
                  });
                  const quizPct = empQuizzes.length > 0
                    ? Math.round(empQuizzes.reduce((sum, q) => sum + (q.skor || q.score || 0), 0) / empQuizzes.length)
                    : 80;
                  const kuisKPI = Math.round(quizPct * 0.10);

                  const totalKPI = kehadiranKPI + disiplinKPI + surveiKPI + trainingKPI + kuisKPI;
                  const kpiColor = totalKPI >= 80 ? '#4ECDC4' : totalKPI >= 60 ? '#F5A623' : '#E05C5C';

                  return (
                    <div style={{
                      background: 'linear-gradient(135deg,rgba(0,173,181,0.06),rgba(0,0,0,0.15))',
                      border: '1.5px solid rgba(0,173,181,0.25)',
                      borderRadius: '12px', padding: '14px 16px', marginTop: '10px',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#00ADB5', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          📊 Kalkulator KPI Performa Bulanan
                        </span>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                          <span style={{ fontSize: '1.4rem', fontWeight: 900, color: kpiColor }}>{totalKPI}</span>
                          <span style={{ fontSize: '0.72rem', color: '#9EA8B3' }}>/100</span>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.78rem' }}>
                        {[
                          { label: 'Kehadiran', bobot: '25%', pct: kehadiranPct, kpi: kehadiranKPI, data: hadir > 0 ? `${hadir}/${totalWorkingDays} hari` : 'Belum Ada Data' },
                          { label: 'Disiplin', bobot: '25%', pct: disiplinPct, kpi: disiplinKPI, data: hadir > 0 ? `${lateCount}x terlambat` : 'Belum Ada Data' },
                          { label: 'Survei 360°', bobot: '30%', pct: surveiPct, kpi: surveiKPI, data: empSurvey.length > 0 ? `${empSurvey.length} responden` : 'Default 75' },
                          { label: 'Training', bobot: '10%', pct: trainingPct, kpi: trainingKPI, data: empTrainingScores.length > 0 ? `${empTrainingScores.length} skor` : 'Default 80' },
                          { label: 'Kuis', bobot: '10%', pct: quizPct, kpi: kuisKPI, data: empQuizzes.length > 0 ? `${empQuizzes.length} kuis` : 'Default 80' },
                        ].map(p => {
                          const pColor = p.pct >= 80 ? '#4ECDC4' : p.pct >= 60 ? '#F5A623' : '#E05C5C';
                          return (
                            <div key={p.label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '10px 12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                <span style={{ color: '#9EA8B3', fontWeight: 600 }}>{p.label}</span>
                                <span style={{ color: '#9EA8B3', fontSize: '0.7rem' }}>Bobot {p.bobot}</span>
                              </div>
                              <div style={{ height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', marginBottom: '5px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${p.pct}%`, background: pColor, borderRadius: '4px', transition: 'width 0.4s ease' }} />
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#9EA8B3', fontSize: '0.7rem' }}>{p.data}</span>
                                <span style={{ color: pColor, fontWeight: 800 }}>+{p.kpi} poin</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed rgba(0,173,181,0.2)', fontSize: '0.78rem', fontWeight: 800 }}>
                        <span style={{ color: '#EEEEEE' }}>Total KPI Performa</span>
                        <span style={{ color: kpiColor, fontSize: '1rem' }}>{totalKPI} / 100 — {totalKPI >= 80 ? 'Sangat Baik' : totalKPI >= 60 ? 'Cukup Baik' : 'Perlu Peningkatan'}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: PALETTE.creamMuted, textTransform: 'uppercase' }}>Bulan</label>
                <select value={formBulan} onChange={e => setFormBulan(Number(e.target.value))}
                  style={{ height: '40px', padding: '0 12px', background: PALETTE.bgMain, border: `1px solid ${PALETTE.accent}`, borderRadius: '8px', color: PALETTE.cream, fontSize: '0.85rem' }}>
                  {BULAN.map((b, i) => <option key={i} value={i + 1}>{b}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: PALETTE.creamMuted, textTransform: 'uppercase' }}>Tahun</label>
                <select value={formTahun} onChange={e => setFormTahun(Number(e.target.value))}
                  style={{ height: '40px', padding: '0 12px', background: PALETTE.bgMain, border: `1px solid ${PALETTE.accent}`, borderRadius: '8px', color: PALETTE.cream, fontSize: '0.85rem' }}>
                  {TAHUN.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>

            {/* Dua Kolom: Pendapatan & Pengeluaran */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>

              {/* Kolom Pendapatan */}
              <div style={{ background: 'rgba(46,204,113,0.05)', border: '1px solid rgba(46,204,113,0.2)', borderRadius: '12px', padding: '16px' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: PALETTE.success, textTransform: 'uppercase', marginBottom: '14px', letterSpacing: '0.5px' }}>
                  📈 Komponen Pendapatan
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {Object.entries(INCOME_LABELS).map(([k, label]) => (
                    <CurrencyInput
                      key={k}
                      label={label}
                      value={income[k]}
                      onChange={v => setIncome(p => ({ ...p, [k]: v }))}
                    />
                  ))}
                </div>
                {/* Subtotal Pendapatan */}
                <div style={{
                  marginTop: '14px', paddingTop: '12px', borderTop: `1px solid rgba(46,204,113,0.3)`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: PALETTE.success, textTransform: 'uppercase' }}>Total Pendapatan</span>
                  <span style={{ fontSize: '1rem', fontWeight: 800, color: PALETTE.success }}>{formatCurrency(totalPendapatan)}</span>
                </div>
              </div>

              {/* Kolom Pengeluaran */}
              <div style={{ background: 'rgba(231,76,60,0.05)', border: '1px solid rgba(231,76,60,0.2)', borderRadius: '12px', padding: '16px' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: PALETTE.danger, textTransform: 'uppercase', marginBottom: '14px', letterSpacing: '0.5px' }}>
                  📉 Komponen Pengeluaran
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {Object.entries(DEDUCTION_LABELS).map(([k, label]) => (
                    <CurrencyInput
                      key={k}
                      label={label}
                      value={deduction[k]}
                      onChange={v => setDeduction(p => ({ ...p, [k]: v }))}
                    />
                  ))}
                </div>
                {/* Subtotal Pengeluaran */}
                <div style={{
                  marginTop: '14px', paddingTop: '12px', borderTop: `1px solid rgba(231,76,60,0.3)`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: PALETTE.danger, textTransform: 'uppercase' }}>Total Pengeluaran</span>
                  <span style={{ fontSize: '1rem', fontWeight: 800, color: PALETTE.danger }}>-{formatCurrency(totalPengeluaran)}</span>
                </div>
              </div>
            </div>

            {/* Box THP (Take Home Pay) */}
            <div style={{
              background: thp >= 0 ? 'rgba(165, 182, 141, 0.08)' : 'rgba(231,76,60,0.08)',
              border: `2px solid ${thp >= 0 ? PALETTE.cream : PALETTE.danger}`,
              borderRadius: '14px', padding: '18px 22px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: '20px',
            }}>
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: PALETTE.creamMuted, textTransform: 'uppercase', marginBottom: '4px' }}>
                  💸 Gaji Take Home Pay (THP)
                </div>
                <div style={{ fontSize: '0.72rem', color: PALETTE.creamMuted }}>
                  Total Pendapatan − Total Pengeluaran = THP
                </div>
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: thp >= 0 ? PALETTE.cream : PALETTE.danger }}>
                {formatCurrency(thp)}
              </div>
            </div>

            {/* Tombol Simpan */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleSave}
                style={{
                  flex: 1, height: '46px', background: PALETTE.cream, color: PALETTE.bgMain,
                  border: 'none', borderRadius: '10px', fontSize: '0.9rem', fontWeight: 800,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  boxShadow: '0 4px 14px rgba(165, 182, 141, 0.25)',
                }}
              >
                <CheckCircle size={18} />
                {editingSlipId ? 'Simpan Perubahan' : 'Simpan Slip Gaji'}
              </button>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  flex: 1, height: '46px', background: PALETTE.accent, color: PALETTE.cream,
                  border: `1px solid ${PALETTE.accent}`, borderRadius: '10px',
                  fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer',
                }}
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Preview Slip Gaji ── */}
      {previewSlip && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(6px)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          padding: '20px 16px', overflowY: 'auto', zIndex: 1000,
        }}>
          <div style={{
            width: '100%', maxWidth: '500px',
            background: PALETTE.bgSurface, border: `1px solid ${PALETTE.accent}`,
            borderRadius: '20px', padding: '28px',
            animation: 'fadeIn 0.3s ease',
            maxHeight: '90vh', overflowY: 'auto'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '12px', borderBottom: `1px solid ${PALETTE.accent}` }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: PALETTE.cream, margin: 0 }}>
                📄 Preview Slip Gaji
              </h2>
              <button onClick={() => setPreviewSlip(null)} style={{ background: 'transparent', border: 'none', color: PALETTE.cream, cursor: 'pointer' }}>
                <X size={22} />
              </button>
            </div>

            {/* Slip Content */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', color: PALETTE.cream }}>
              
              {/* Employee & Period Info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: PALETTE.creamMuted }}>Nama Karyawan</div>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{toTitleCase(previewSlip.nama_karyawan)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: PALETTE.creamMuted }}>Periode</div>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{BULAN[previewSlip.bulan - 1]} {previewSlip.tahun}</div>
                </div>
                <div style={{ marginTop: '8px' }}>
                  <div style={{ fontSize: '0.75rem', color: PALETTE.creamMuted }}>Jabatan</div>
                  <div>{toTitleCase(previewSlip.jabatan) || '-'}</div>
                </div>
                <div style={{ marginTop: '8px' }}>
                  <div style={{ fontSize: '0.75rem', color: PALETTE.creamMuted }}>Outlet</div>
                  <div>{toTitleCase(previewSlip.outlet) || '-'}</div>
                </div>
              </div>

              {/* Income Section */}
              <div>
                <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: PALETTE.success, borderBottom: '1px dashed rgba(46,204,113,0.2)', paddingBottom: '4px', margin: '10px 0 6px 0' }}>
                  PENDAPATAN
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem' }}>
                  {Object.entries(previewSlip.income || {}).map(([key, val]) => {
                    const value = Number(val || 0);
                    if (value === 0) return null;
                    return (
                      <div key={key} style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: PALETTE.creamMuted }}>{INCOME_LABELS[key] || toTitleCase(key.replace(/_/g, ' '))}</span>
                        <span>{formatCurrency(value)}</span>
                      </div>
                    );
                  })}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '4px', marginTop: '4px' }}>
                    <span>Total Pendapatan</span>
                    <span style={{ color: PALETTE.success }}>{formatCurrency(previewSlip.total_pendapatan)}</span>
                  </div>
                </div>
              </div>

              {/* Deduction Section */}
              <div>
                <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: PALETTE.danger, borderBottom: '1px dashed rgba(231,76,60,0.2)', paddingBottom: '4px', margin: '10px 0 6px 0' }}>
                  PENGELUARAN
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem' }}>
                  {Object.entries(previewSlip.deduction || {}).map(([key, val]) => {
                    const value = Number(val || 0);
                    if (value === 0) return null;
                    return (
                      <div key={key} style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: PALETTE.creamMuted }}>{DEDUCTION_LABELS[key] || toTitleCase(key.replace(/_/g, ' '))}</span>
                        <span>{formatCurrency(value)}</span>
                      </div>
                    );
                  })}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '4px', marginTop: '4px' }}>
                    <span>Total Pengeluaran</span>
                    <span style={{ color: PALETTE.danger }}>{formatCurrency(previewSlip.total_pengeluaran)}</span>
                  </div>
                </div>
              </div>

              {/* ─── KALKULATOR KPI PERFORMA BULANAN (Preview Slip) ─── */}
              {(() => {
                const empObj = employees.find(e => String(e.id) === String(previewSlip.employee_id) || String(e.employee_id) === String(previewSlip.employee_id));
                const slipMonth = previewSlip.bulan ? parseInt(previewSlip.bulan) : new Date().getMonth() + 1;
                const slipYear  = previewSlip.tahun ? parseInt(previewSlip.tahun)  : new Date().getFullYear();

                // Pilar 1: Kehadiran (25%)
                const attLogs = JSON.parse(localStorage.getItem('hris_attendance_history') || '[]');
                const empAttLogs = attLogs.filter(l => {
                  const d = new Date(l.date || '');
                  return (String(l.employee_id) === String(previewSlip.employee_id) || l.nik === empObj?.nik)
                    && d.getMonth() + 1 === slipMonth && d.getFullYear() === slipYear;
                });

                // Cari jumlah hari kerja di outlet pada periode tsb
                const outletLogs = attLogs.filter(l => {
                  const d = new Date(l.date || '');
                  return l.outlet === empObj?.outlet && d.getMonth() + 1 === slipMonth && d.getFullYear() === slipYear;
                });
                const uniqueDates = [...new Set(outletLogs.map(l => l.date))];
                const totalWorkingDays = uniqueDates.length > 0 ? uniqueDates.length : 25;

                const hadir = empAttLogs.filter(l => l.clock_in || l.status === 'Hadir' || l.status === 'Terlambat').length;
                const kehadiranPct = totalWorkingDays > 0 ? Math.min(100, Math.round((hadir / totalWorkingDays) * 100)) : 0;
                const kehadiranKPI = Math.round(kehadiranPct * 0.25);

                // Pilar 2: Disiplin (25%)
                const lateCount = empAttLogs.filter(l => l.status_in === 'late' || l.status === 'Terlambat' || (l.notes && /terlambat|late/i.test(l.notes))).length;
                const disiplinPct = hadir > 0 ? Math.max(0, Math.round(100 - (lateCount / hadir) * 100)) : 100;
                const disiplinKPI = Math.round(disiplinPct * 0.25);

                // Pilar 3: Survei 360 (30%)
                const survey360Data = JSON.parse(localStorage.getItem('survey_360_data') || '[]');
                const empSurvey = survey360Data.filter(s => String(s.target_id || s.employee_id) === String(previewSlip.employee_id) && s.month === slipMonth && s.year === slipYear);
                const surveiPct = empSurvey.length > 0
                  ? Math.round(empSurvey.reduce((a, s) => a + (s.score || 0), 0) / empSurvey.length)
                  : 75;
                const surveiKPI = Math.round(surveiPct * 0.30);

                // Pilar 4: Training (10%)
                const trainingKpiScores = JSON.parse(localStorage.getItem('hris_training_kpi_scores') || '[]');
                const empTrainingScores = trainingKpiScores.filter(t => {
                  const d = new Date(t.updated_at || t.created_at || t.date || '');
                  return String(t.employee_id) === String(previewSlip.employee_id) && d.getMonth() + 1 === slipMonth && d.getFullYear() === slipYear;
                });
                const trainingPct = empTrainingScores.length > 0
                  ? Math.round(empTrainingScores.reduce((sum, t) => sum + (t.score || 0), 0) / empTrainingScores.length)
                  : 80;
                const trainingKPI = Math.round(trainingPct * 0.10);

                // Pilar 5: Kuis (10%)
                const quizResults = JSON.parse(localStorage.getItem('quiz_results') || '[]');
                const empQuizzes = quizResults.filter(q => {
                  const d = new Date(q.tanggal_selesai || q.date || '');
                  return String(q.employee_id) === String(previewSlip.employee_id) && d.getMonth() + 1 === slipMonth && d.getFullYear() === slipYear;
                });
                const quizPct = empQuizzes.length > 0
                  ? Math.round(empQuizzes.reduce((sum, q) => sum + (q.skor || q.score || 0), 0) / empQuizzes.length)
                  : 80;
                const kuisKPI = Math.round(quizPct * 0.10);

                const totalKPI = kehadiranKPI + disiplinKPI + surveiKPI + trainingKPI + kuisKPI;
                const kpiColor = totalKPI >= 80 ? '#4ECDC4' : totalKPI >= 60 ? '#F5A623' : '#E05C5C';

                return (
                  <div style={{
                    background: 'linear-gradient(135deg,rgba(0,173,181,0.06),rgba(0,0,0,0.15))',
                    border: '1.5px solid rgba(0,173,181,0.25)',
                    borderRadius: '12px', padding: '14px 16px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#00ADB5', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        📊 Kalkulator KPI Performa Bulanan
                      </span>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                        <span style={{ fontSize: '1.3rem', fontWeight: 900, color: kpiColor }}>{totalKPI}</span>
                        <span style={{ fontSize: '0.7rem', color: '#9EA8B3' }}>/100</span>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.76rem' }}>
                      {[
                        { label: 'Kehadiran', bobot: '25%', pct: kehadiranPct, kpi: kehadiranKPI, data: hadir > 0 ? `${hadir}/${totalWorkingDays} hari` : 'Belum Ada Data' },
                        { label: 'Disiplin', bobot: '25%', pct: disiplinPct, kpi: disiplinKPI, data: hadir > 0 ? `${lateCount}x terlambat` : 'Belum Ada Data' },
                        { label: 'Survei 360°', bobot: '30%', pct: surveiPct, kpi: surveiKPI, data: empSurvey.length > 0 ? `${empSurvey.length} responden` : 'Default 75' },
                        { label: 'Training', bobot: '10%', pct: trainingPct, kpi: trainingKPI, data: empTrainingScores.length > 0 ? `${empTrainingScores.length} skor` : 'Default 80' },
                        { label: 'Kuis', bobot: '10%', pct: quizPct, kpi: kuisKPI, data: empQuizzes.length > 0 ? `${empQuizzes.length} kuis` : 'Default 80' },
                      ].map(p => {
                        const pColor = p.pct >= 80 ? '#4ECDC4' : p.pct >= 60 ? '#F5A623' : '#E05C5C';
                        return (
                          <div key={p.label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '8px 10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <span style={{ color: '#9EA8B3', fontWeight: 600 }}>{p.label}</span>
                              <span style={{ color: '#9EA8B3', fontSize: '0.68rem' }}>Bobot {p.bobot}</span>
                            </div>
                            <div style={{ height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', marginBottom: '4px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${p.pct}%`, background: pColor, borderRadius: '4px' }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#9EA8B3', fontSize: '0.68rem' }}>{p.data}</span>
                              <span style={{ color: pColor, fontWeight: 800, fontSize: '0.76rem' }}>+{p.kpi}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed rgba(0,173,181,0.2)', fontSize: '0.76rem', fontWeight: 800 }}>
                      <span style={{ color: '#EEEEEE' }}>Total KPI Performa</span>
                      <span style={{ color: kpiColor }}>{totalKPI}/100 — {totalKPI >= 80 ? 'Sangat Baik ★' : totalKPI >= 60 ? 'Cukup Baik' : 'Perlu Peningkatan'}</span>
                    </div>
                  </div>
                );
              })()}

              {/* Total THP */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(165,182,141,0.1)', padding: '12px 16px', borderRadius: '10px', border: `2px solid ${PALETTE.accent}`, marginTop: '10px' }}>
                <span style={{ fontWeight: 800, fontSize: '0.95rem', color: PALETTE.cream }}>Take Home Pay (THP)</span>
                <span style={{ fontWeight: 800, fontSize: '1.2rem', color: PALETTE.cream }}>{formatCurrency(previewSlip.thp)}</span>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px', paddingTop: '16px', borderTop: `1px solid ${PALETTE.accent}` }}>
              <button
                onClick={() => {
                  const slipToSend = previewSlip;
                  setPreviewSlip(null);
                  handleSendSlipConfirm(slipToSend);
                }}
                className="btn-primary"
                style={{ flex: 1.2, justifyContent: 'center', height: '40px', fontSize: '0.85rem' }}
              >
                🚀 Kirim Slip
              </button>
              <button
                onClick={() => {
                  const slipToEdit = previewSlip;
                  setPreviewSlip(null);
                  openEditModal(slipToEdit);
                }}
                style={{
                  flex: 1.2, height: '40px', background: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '8px',
                  color: 'var(--accent-primary)', fontWeight: 800, cursor: 'pointer',
                  fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                }}
              >
                ✏️ Edit Slip
              </button>
              <button
                onClick={() => setPreviewSlip(null)}
                className="btn-secondary"
                style={{ flex: 0.8, justifyContent: 'center', height: '40px', fontSize: '0.85rem' }}
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Konfirmasi ── */}
      {confirmModal.open && (
        <div className="confirm-overlay">
          <div className="confirm-card">
            <h3 className="confirm-title">{confirmModal.title}</h3>
            <p className="confirm-message">{confirmModal.msg}</p>
            <div className="confirm-actions">
              <button
                className="btn-confirm-yes"
                onClick={() => { confirmModal.onConfirm(); setConfirmModal(p => ({ ...p, open: false })); }}
              >
                YA, LANJUTKAN
              </button>
              <button
                className="btn-confirm-cancel"
                onClick={() => setConfirmModal(p => ({ ...p, open: false }))}
              >
                BATAL
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

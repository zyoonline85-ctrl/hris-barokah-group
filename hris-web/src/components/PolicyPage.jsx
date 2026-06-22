import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Shield, Plus, Edit, Trash2, Search, CheckCircle,
  AlertCircle, X, ChevronDown, Store
} from 'lucide-react';
import { getLiveOutletList } from '../utils/outletUtils';
import { checkAccess, getRoleFromPosition } from '../utils/security';

// ─── Konstanta Palet (Modern Professional Light Tech) ───────────────────────
const P = {
  bgMain:      '#222831',
  bgSurface:   '#393E46',
  accent:      '#00ADB5',
  cream:       '#EEEEEE',
  creamMuted:  '#b2bec3',
  success:     '#10b981',
  danger:      '#ef4444',
  warning:     '#f59e0b',
  successGlow: 'rgba(16, 185, 129, 0.08)',
  dangerGlow:  'rgba(239, 68, 68, 0.08)',
  creamGlow:   'rgba(0, 173, 181, 0.12)',
  accentLight: 'rgba(0, 173, 181, 0.08)',
};

// ─── Key localStorage ─────────────────────────────────────────────────────────
const LS_KEY = 'corporate_policies';

// ─── Baca outlet dari outlet_cabang_data (OutletPage) ───────────────────────
const getOutletOptions = () => {
  return getLiveOutletList();
};

// ─── Baca / Simpan kebijakan ─────────────────────────────────────────────────
const loadPolicies = () => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};
const savePolicies = (data) => localStorage.setItem(LS_KEY, JSON.stringify(data));

// ─── LATIHAN DINAMIS: Kalkulasi Ulang Slip Gaji Draf Bulan Berjalan ───────────
const recalculateDraftPayrolls = async (updatedPolicies, token, API_URL) => {
  try {
    const rawSlips = localStorage.getItem('hris_payroll_slips');
    if (!rawSlips) return;
    const slipsList = JSON.parse(rawSlips);
    if (!Array.isArray(slipsList) || slipsList.length === 0) return;

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const draftSlips = slipsList.filter(s => !s.slip_sent && s.bulan === currentMonth && s.tahun === currentYear);
    if (draftSlips.length === 0) return;

    const localEmp = localStorage.getItem('hris_employees');
    const employeesList = localEmp ? JSON.parse(localEmp) : [];
    const localHistory = localStorage.getItem('hris_attendances_history');
    const historyLogsList = localHistory ? JSON.parse(localHistory) : [];

    let leavesList = [];
    if (token && API_URL) {
      try {
        const res = await fetch(`${API_URL}/leaves`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.status === 'success') {
          leavesList = data.data;
        }
      } catch (e) {
        console.error('Error fetching leaves in background recalculator:', e);
      }
    }

    const getCutoffRangeLocal = (empOutlet, month, year) => {
      let startDay = 1;
      let endDay = 1;
      const matchingPolicy = updatedPolicies.find(p => 
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

    const getOfficialBreakDurationLocal = (outletName) => {
      if (!outletName) return 120;
      const breakPolicies = updatedPolicies.filter(p => 
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

    const getPolicyClockOutTimeLocal = (outletName) => {
      const activePolicies = updatedPolicies.filter(p => 
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

    const parseToMinutesLocal = (timeStr) => {
      if (!timeStr) return 0;
      const parts = timeStr.split(':');
      return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
    };

    const parseTimeStringToMsLocal = (timeStr) => {
      if (!timeStr) return 0;
      const parts = timeStr.split(':');
      if (parts.length < 2) return 0;
      return (((parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0)) * 60 + (parts[2] ? (parseInt(parts[2], 10) || 0) : 0)) * 1000;
    };

    const parseNum = (v) => {
      if (!v) return 0;
      const clean = String(v).replace(/[^0-9.-]/g, '');
      return parseFloat(clean) || 0;
    };

    const updatedSlipsList = slipsList.map(slip => {
      if (slip.slip_sent || slip.bulan !== currentMonth || slip.tahun !== currentYear) return slip;

      const emp = employeesList.find(e => String(e.id) === String(slip.employee_id) || String(e.employee_id) === String(slip.employee_id));
      if (!emp) return slip;

      // A. Gaji Pokok
      let gajiPokokVal = 0;
      try {
        const salaryPolicy = updatedPolicies.find(p => {
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
      } catch (e) {}
      if (gajiPokokVal === 0) {
        const pos = (emp.position || emp.jabatan || '').toLowerCase();
        if (pos.includes('kepala cabang')) gajiPokokVal = 1700000;
        else if (pos.includes('quality control') || pos.includes('qc')) gajiPokokVal = 1400000;
        else if (pos.includes('training') && pos.includes('cabang')) gajiPokokVal = 1400000;
        else if (pos.includes('training')) gajiPokokVal = 1000000;
        else gajiPokokVal = 1200000;
      }

      // Cutoff logs
      const { startDate, endDate } = getCutoffRangeLocal(emp.outlet || emp.nama_outlet, currentMonth, currentYear);
      const empLogs = historyLogsList.filter(log => {
        const logNik = log.nik || '';
        const empNik = emp.nik || '';
        const logEmpId = log.employee_id ? String(log.employee_id) : '';
        const empIdStr = String(emp.id);
        return ((logNik && logNik === empNik) || (logEmpId && logEmpId === empIdStr)) && log.date >= startDate && log.date <= endDate;
      });

      // Leaves
      const empLeaves = leavesList.filter(l => String(l.employee_id) === String(emp.id) && l.status === 'approved');
      const leaveDatesInCutoff = [];
      empLeaves.forEach(lv => {
        let cur = new Date(lv.start_date);
        const end = new Date(lv.end_date);
        while (cur <= end) {
          const dateStr = cur.toISOString().split('T')[0];
          if (dateStr >= startDate && dateStr <= endDate) {
            leaveDatesInCutoff.push(dateStr);
          }
          cur.setDate(cur.getDate() + 1);
        }
      });
      const totalApprovedLeaveDays = leaveDatesInCutoff.length;

      // Potongan Kelebihan Libur
      let maxLeaveDays = 2;
      try {
        const maxLeavePolicy = updatedPolicies.find(p => p.status === 'ACTIVE' && p.nama_aturan === 'Batasan Pengajuan Libur & Denda Operasional');
        if (maxLeavePolicy && maxLeavePolicy.deskripsi) {
          const match = maxLeavePolicy.deskripsi.match(/Maksimal pengajuan libur adalah\s*(\d+)\s*hari/i);
          if (match) maxLeaveDays = parseInt(match[1], 10);
        }
      } catch (e) {}

      let potonganKelebihanLibur = 0;
      if (totalApprovedLeaveDays > maxLeaveDays) {
        potonganKelebihanLibur = Math.round((gajiPokokVal / 30) * (totalApprovedLeaveDays - maxLeaveDays));
      }

      // Weekend/Holiday fines
      let dendaWeekendRate = 200000;
      try {
        const leaveFinePolicy = updatedPolicies.find(p => p.status === 'ACTIVE' && p.nama_aturan === 'Batasan Pengajuan Libur & Denda Operasional');
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
      let absensiDeduction = 0;
      try {
        const peakDaysList = JSON.parse(localStorage.getItem('peak_day_rules') || '[]');
        leaveDatesInCutoff.forEach(d => {
          const dateObj = new Date(d);
          const day = dateObj.getDay();
          const isWeekend = day === 0 || day === 6;
          const isHoliday = HOLIDAYS_2026.includes(d);
          const logForDate = empLogs.find(log => log.date === d);
          const isLogPublicHoliday = logForDate && logForDate.notes && /libur nasional/i.test(logForDate.notes);
          if (isWeekend || isHoliday || isLogPublicHoliday) {
            dendaWeekendLiburNasional += dendaWeekendRate;
          }

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
        console.error('Error calculating absensi in recalculate:', e);
      }

      // Break Overages
      let totalBreakPoints = 0;
      empLogs.forEach(log => {
        if (log.jam_mulai_istirahat && log.jam_akhir_istirahat) {
          let start = parseToMinutesLocal(log.jam_mulai_istirahat);
          let end = parseToMinutesLocal(log.jam_akhir_istirahat);
          if (end < start) end += 24 * 60;
          const actualBreak = end - start;
          let logOutlet = (log.outlet || emp.outlet || '').trim();
          const officialBreak = getOfficialBreakDurationLocal(logOutlet);
          const overage = Math.max(0, actualBreak - officialBreak);
          totalBreakPoints += overage;
        }
      });

      let breakTolerance = 15;
      let breakRate = 1000;
      try {
        const breakPenaltyPolicy = updatedPolicies.find(p => p.nama_aturan && p.nama_aturan.toLowerCase().includes('denda istirahat'));
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

      // Uang Makan
      let uangMakanRate = 20000;
      try {
        const makanPolicy = updatedPolicies.find(p => p.nama_aturan && p.nama_aturan.toLowerCase().includes('uang makan'));
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
        const policyTime = getPolicyClockOutTimeLocal(logOutlet);
        const isHalfDay = (log.notes && /setengah hari|1\/2|half day/i.test(log.notes)) || 
                          log.status_in === 'half_day' ||
                          (log.clock_out && isCheckoutBeforePolicyLocal(log.clock_out, policyTime));
        if (hasClockIn && isOntime && !isLate && !isAbsent && !isHalfDay) {
          tepatWaktuDays++;
        }
      });
      const uangMakanVal = tepatWaktuDays * uangMakanRate;

      // Uang Lembur
      let lemburRate = 7000;
      let lemburMaxCap = 200000;
      try {
        const lemburPolicy = updatedPolicies.find(p => p.nama_aturan && p.nama_aturan.toLowerCase().includes('uang lembur'));
        if (lemburPolicy && lemburPolicy.status === 'ACTIVE' && lemburPolicy.deskripsi) {
          const matchRate = lemburPolicy.deskripsi.match(/sebesar\s*rp\s*([\d.]+)/i);
          if (matchRate) lemburRate = parseInt(matchRate[1].replace(/\./g, ''), 10);
          const matchCap = lemburPolicy.deskripsi.match(/maksimal\s*rp\s*([\d.]+)/i);
          if (matchCap) lemburMaxCap = parseInt(matchCap[1].replace(/\./g, ''), 10);
        }
      } catch (e) {}

      let lemburDays = 0;
      const empOutletName = (emp.outlet || emp.nama_outlet || '').toUpperCase().trim();
      const isAbsTt = empOutletName.includes('AYAM BAKAR SURABAYA TEBING TINGGI') || empOutletName.includes('ABS TT');
      if (!isAbsTt) {
        empLogs.forEach(log => {
          const hasClockIn = !!log.clock_in;
          const hasClockOut = !!log.clock_out;
          const isLate = log.status_in === 'late' || (log.notes && /terlambat|late/i.test(log.notes));
          const logOutlet = log.outlet || emp.outlet || '';
          const policyTime = getPolicyClockOutTimeLocal(logOutlet);
          const isHalfDay = (log.notes && /setengah hari|1\/2|half day/i.test(log.notes)) || 
                            log.status_in === 'half_day' ||
                            (log.clock_out && isCheckoutBeforePolicyLocal(log.clock_out, policyTime));
          if (hasClockIn && hasClockOut && !isLate && !isHalfDay) {
            let markedLembur = log.notes && /lembur|overtime/i.test(log.notes);
            if (!markedLembur) {
              const inMs = parseTimeStringToMsLocal(log.clock_in);
              const outMs = parseTimeStringToMsLocal(log.clock_out);
              if (outMs - inMs > 32400000) markedLembur = true;
            }
            if (markedLembur) lemburDays++;
          }
        });
      }
      let uangLemburVal = lemburDays * lemburRate;
      if (uangLemburVal > lemburMaxCap) uangLemburVal = lemburMaxCap;

      // Tunjangan Keluarga
      let tunjanganKeluargaVal = 0;
      try {
        const kelPolicy = updatedPolicies.find(p => p.nama_aturan && p.nama_aturan.includes('Tunjangan Keluarga'));
        if (kelPolicy && kelPolicy.status === 'ACTIVE') {
          const isMarried = emp.marital_status && !/belum/i.test(emp.marital_status);
          const startWorkingDate = emp.start_working_date || emp.joined_date;
          let monthsOfWork = 0;
          if (startWorkingDate) {
            const start = new Date(startWorkingDate);
            const yearDiff = now.getFullYear() - start.getFullYear();
            const monthDiff = now.getMonth() - start.getMonth();
            monthsOfWork = yearDiff * 12 + monthDiff;
          }
          if (isMarried && monthsOfWork >= 1) {
            const match = kelPolicy.deskripsi.match(/rp\s*([\d.]+)/i);
            tunjanganKeluargaVal = match ? parseInt(match[1].replace(/\./g, ''), 10) : 200000;
          }
        }
      } catch (e) {}

      // Tunjangan Jabatan
      let tunjanganJabatanVal = 0;
      try {
        const jabPolicy = updatedPolicies.find(p => p.nama_aturan === 'Tunjangan Jabatan');
        if (jabPolicy && jabPolicy.status === 'ACTIVE' && jabPolicy.deskripsi) {
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
      } catch (e) {}

      // Tunjangan Posisi
      let tunjanganPosisiVal = 0;
      try {
        const posPolicy = updatedPolicies.find(p => p.nama_aturan === 'Tunjangan Posisi');
        if (posPolicy && posPolicy.status === 'ACTIVE' && posPolicy.deskripsi) {
          const pos = (emp.position || emp.jabatan || '').toLowerCase();
          if (pos.includes('koki') || pos.includes('helper') || pos.includes('bartender')) {
            const match = posPolicy.deskripsi.match(/sebesar\s*rp\s*([\d.]+)/i);
            tunjanganPosisiVal = match ? parseInt(match[1].replace(/\./g, ''), 10) : 100000;
          }
        }
      } catch (e) {}

      // Tunjangan Tidak Absen
      let tunjanganTidakAbsenVal = 0;
      try {
        const noAbsPolicy = updatedPolicies.find(p => p.nama_aturan === 'Tunjangan Tidak Absen');
        if (noAbsPolicy && noAbsPolicy.status === 'ACTIVE' && noAbsPolicy.deskripsi) {
          let hasAlpa = false;
          empLogs.forEach(log => {
            const isAbsent = !log.clock_in || log.status_in === 'absent' || (log.notes && /tidak hadir|alpa|absent/i.test(log.notes));
            if (isAbsent) hasAlpa = true;
          });
          if (!hasAlpa && empLogs.length > 0) {
            const match = noAbsPolicy.deskripsi.match(/mendapatkan\s*rp\s*([\d.]+)/i);
            tunjanganTidakAbsenVal = match ? parseInt(match[1].replace(/\./g, ''), 10) : 75000;
          }
        }
      } catch (e) {}

      // Tunjangan Lama Bekerja
      let tunjanganLamaBekerjaVal = 0;
      try {
        const lamaPolicy = updatedPolicies.find(p => p.nama_aturan === 'Tunjangan Lama Bekerja');
        if (lamaPolicy && lamaPolicy.status === 'ACTIVE') {
          const startWorkingDate = emp.start_working_date || emp.joined_date;
          let monthsOfWork = 0;
          if (startWorkingDate) {
            const start = new Date(startWorkingDate);
            const yearDiff = now.getFullYear() - start.getFullYear();
            const monthDiff = now.getMonth() - start.getMonth();
            monthsOfWork = yearDiff * 12 + monthDiff;
          }
          if (monthsOfWork >= 3 && monthsOfWork < 6) tunjanganLamaBekerjaVal = 100000;
          else if (monthsOfWork >= 6 && monthsOfWork < 12) tunjanganLamaBekerjaVal = 200000;
          else if (monthsOfWork >= 12) {
            const extraPeriod = Math.floor((monthsOfWork - 12) / 6);
            tunjanganLamaBekerjaVal = 200000 + (extraPeriod * 50000);
          }
        }
      } catch (e) {}

      const updatedIncome = {
        ...slip.income,
        gaji_pokok: String(gajiPokokVal),
        uang_makan: String(uangMakanVal),
        uang_lembur: String(uangLemburVal),
        tunjangan_keluarga: String(tunjanganKeluargaVal),
        tunjangan_jabatan: String(tunjanganJabatanVal),
        tunjangan_posisi: String(tunjanganPosisiVal),
        tunjangan_tidak_absen: String(tunjanganTidakAbsenVal),
        tunjangan_lama_bekerja: String(tunjanganLamaBekerjaVal),
      };

      const updatedDeduction = {
        ...slip.deduction,
        potongan_kelebihan_libur: String(potonganKelebihanLibur),
        denda_weekend_libur_nasional: String(dendaWeekendLiburNasional),
        denda_keterlambat_istirahat: String(dendaKeterlambatIstirahat),
        absensi: String(absensiDeduction),
      };

      const totalPendVal = Object.values(updatedIncome).reduce((sum, v) => sum + parseNum(v), 0);
      const totalPengVal = Object.values(updatedDeduction).reduce((sum, v) => sum + parseNum(v), 0);
      const newThp = totalPendVal - totalPengVal;

      return {
        ...slip,
        income: updatedIncome,
        deduction: updatedDeduction,
        total_pendapatan: totalPendVal,
        total_pengeluaran: totalPengVal,
        thp: newThp
      };
    });

    localStorage.setItem('hris_payroll_slips', JSON.stringify(updatedSlipsList));
    window.dispatchEvent(new Event('storage'));
  } catch (e) {
    console.error('Error in recalculateDraftPayrolls:', e);
  }
};

// ─── Seed Data Kebijakan Awal Barokah Grup ────────────────────────────────────
// Hanya berjalan SEKALI saat localStorage 'corporate_policies' masih kosong.
// Tidak akan menimpa data yang sudah diinput Admin.
//
// Nama outlet menggunakan format nama_tablet (NAMA OUTLET + WILAYAH).
// Jika outlet_cabang_data sudah terisi, 'Semua Outlet' akan mengambil dari sana.
// Jika belum ada, digunakan daftar 5 outlet Barokah Grup sebagai fallback seed.

const BAROKAH_OUTLETS = [
  'AYAM BAKAR SURABAYA TEBING TINGGI',
  'AYAM PECAK 2001 SEAFOOD KISARAN',
  'AYAM PECAK 2001 SEAFOOD RANTAU PRAPAT',
  'AYAM PECAK 2001 SEAFOOD TEBING TINGGI',
  'PECEL LELE PAK HAJI KISARAN',
];

const seedInitialPolicies = () => {
  let existing = [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      existing = JSON.parse(raw);
    }
  } catch {}

  const allOutlets = getOutletOptions();

  // Jika data kosong, masukkan 3 kebijakan bawaan standar terlebih dahulu
  if (existing.length === 0 && allOutlets.length > 0) {
    const outletStandar = allOutlets.filter(o => !o.toUpperCase().includes('AYAM BAKAR SURABAYA'));
    const outletStandarFinal = outletStandar.length > 0 ? outletStandar : allOutlets;
    const outletKhususFinal = allOutlets.filter(o => o.toUpperCase().includes('AYAM BAKAR SURABAYA'));

    existing = [
      {
        id: 'seed-pol-001',
        nama_aturan: 'Aturan Jam Kerja',
        outlets: allOutlets,
        all_outlets: true,
        deskripsi: 'Seluruh outlet masuk jam 10 siang.',
        status: 'ACTIVE',
        created_at: new Date().toISOString(),
      },
      {
        id: 'seed-pol-002',
        nama_aturan: 'Durasi Istirahat - Standar',
        outlets: outletStandarFinal,
        all_outlets: false,
        deskripsi: 'Durasi istirahat selama 3 jam.',
        status: 'ACTIVE',
        created_at: new Date().toISOString(),
      },
      {
        id: 'seed-pol-003',
        nama_aturan: 'Durasi Istirahat - Khusus',
        outlets: outletKhususFinal,
        all_outlets: false,
        deskripsi: 'Durasi istirahat selama 2 jam.',
        status: 'ACTIVE',
        created_at: new Date().toISOString(),
      },
    ];
  }

  // Suntikkan data Periode Cut-Off & Tanggal Gajian jika belum ada
  const cutOffSeedData = [
    {
      id: 'seed-cutoff-001',
      nama_aturan: 'Periode Cut-Off & Tanggal Gajian',
      outlets: ['AYAM PECAK 2001 SEAFOOD TEBING TINGGI'],
      all_outlets: false,
      deskripsi: 'Periode Cut-Off: 4 - 4, Tanggal Gajian: Tanggal 8.',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
    },
    {
      id: 'seed-cutoff-002',
      nama_aturan: 'Periode Cut-Off & Tanggal Gajian',
      outlets: ['AYAM PECAK 2001 SEAFOOD KISARAN'],
      all_outlets: false,
      deskripsi: 'Periode Cut-Off: 4 - 4, Tanggal Gajian: Tanggal 8.',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
    },
    {
      id: 'seed-cutoff-003',
      nama_aturan: 'Periode Cut-Off & Tanggal Gajian',
      outlets: ['AYAM PECAK 2001 SEAFOOD RANTAU PRAPAT'],
      all_outlets: false,
      deskripsi: 'Periode Cut-Off: 1 - 1, Tanggal Gajian: Tanggal 5.',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
    },
    {
      id: 'seed-cutoff-004',
      nama_aturan: 'Periode Cut-Off & Tanggal Gajian',
      outlets: ['AYAM BAKAR SURABAYA TEBING TINGGI'],
      all_outlets: false,
      deskripsi: 'Periode Cut-Off: 8 - 8, Tanggal Gajian: Tanggal 12.',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
    },
    {
      id: 'seed-cutoff-005',
      nama_aturan: 'Periode Cut-Off & Tanggal Gajian',
      outlets: ['PECEL LELE PAK HAJI KISARAN'],
      all_outlets: false,
      deskripsi: 'Periode Cut-Off: 23 - 23, Tanggal Gajian: Tanggal 27.',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
    },
  ];

  const targetAllOutlets = allOutlets.length > 0 ? allOutlets : BAROKAH_OUTLETS;

  const gajiPokokSeedData = [
    {
      id: 'seed-gajipokok-001',
      nama_aturan: 'Struktur Gaji Pokok',
      outlets: targetAllOutlets,
      all_outlets: true,
      deskripsi: 'Jabatan: KEPALA CABANG, Gaji Pokok: Rp1.700.000',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
    },
    {
      id: 'seed-gajipokok-002',
      nama_aturan: 'Struktur Gaji Pokok',
      outlets: targetAllOutlets,
      all_outlets: true,
      deskripsi: 'Jabatan: QUALITY CONTROL, Gaji Pokok: Rp1.400.000',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
    },
    {
      id: 'seed-gajipokok-003',
      nama_aturan: 'Struktur Gaji Pokok',
      outlets: targetAllOutlets,
      all_outlets: true,
      deskripsi: 'Jabatan: KARYAWAN, Gaji Pokok: Rp1.200.000',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
    },
    {
      id: 'seed-gajipokok-004',
      nama_aturan: 'Struktur Gaji Pokok',
      outlets: targetAllOutlets,
      all_outlets: true,
      deskripsi: 'Jabatan: KARYAWAN TRAINING, Gaji Pokok: Rp1.000.000',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
    },
    {
      id: 'seed-gajipokok-005',
      nama_aturan: 'Struktur Gaji Pokok',
      outlets: targetAllOutlets,
      all_outlets: true,
      deskripsi: 'Jabatan: KEPALA CABANG TRAINING, Gaji Pokok: Rp1.400.000',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
    },
  ];

  const tunjanganSeedData = [
    {
      id: 'seed-tunjangan-001',
      nama_aturan: 'Tunjangan Jabatan',
      outlets: targetAllOutlets,
      all_outlets: true,
      deskripsi: 'Kepala Produksi = Rp200.000, Kepala Pelayanan = Rp200.000, Quality Control = Rp100.000',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
    },
    {
      id: 'seed-tunjangan-002',
      nama_aturan: 'Tunjangan Posisi',
      outlets: targetAllOutlets,
      all_outlets: true,
      deskripsi: 'Posisi Koki, Helper, dan Bartender sebesar Rp100.000',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
    },
    {
      id: 'seed-tunjangan-003',
      nama_aturan: 'Tunjangan Tidak Absen',
      outlets: targetAllOutlets,
      all_outlets: true,
      deskripsi: 'Full hadir tanpa absen selama periode cut-off mendapatkan Rp75.000',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
    },
    {
      id: 'seed-tunjangan-004',
      nama_aturan: 'Tunjangan Lama Bekerja',
      outlets: targetAllOutlets,
      all_outlets: true,
      deskripsi: 'Masa kerja 3-6 bulan = Rp100.000; 6-12 bulan = Rp200.000; Setiap kelipatan 6 bulan berikutnya bertambah +Rp50.000',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
    },
    {
      id: 'seed-tunjangan-005',
      nama_aturan: 'Tunjangan Keluarga - Ketentuan Baru',
      outlets: targetAllOutlets,
      all_outlets: true,
      deskripsi: 'Tunjangan sebesar Rp200.000 per bulan, diberikan mulai bulan kedua bekerja kepada seluruh karyawan kecuali yang berstatus "Belum Menikah".',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
    },
    {
      id: 'seed-leavedenda-001',
      nama_aturan: 'Batasan Pengajuan Libur & Denda Operasional',
      outlets: targetAllOutlets,
      all_outlets: true,
      deskripsi: 'Maksimal pengajuan libur adalah 2 hari tanpa potongan dalam 1 periode cut-off. Jika melebihi 2 hari, dikenakan potongan gaji harian. Jika libur diambil pada hari Sabtu, Minggu, atau Libur Nasional, dikenakan denda tambahan sebesar Rp200.000 per hari.',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
    },
    {
      id: 'seed-makan-001',
      nama_aturan: 'Kebijakan Uang Makan',
      outlets: targetAllOutlets,
      all_outlets: true,
      deskripsi: 'Uang makan sebesar Rp20.000 per hari untuk kehadiran tepat waktu.',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
    },
    {
      id: 'seed-lembur-001',
      nama_aturan: 'Kebijakan Uang Lembur',
      outlets: targetAllOutlets,
      all_outlets: true,
      deskripsi: 'Uang lembur sebesar Rp7.000 per hari dengan batas maksimal Rp200.000 per periode.',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
    },
    {
      id: 'seed-denda-istirahat-001',
      nama_aturan: 'Kebijakan Denda Istirahat',
      outlets: targetAllOutlets,
      all_outlets: true,
      deskripsi: 'Batas toleransi keterlambatan istirahat adalah 15 poin. Setiap kelebihan poin dikenakan denda Rp1.000 per poin.',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
    },
  ];

  let modified = false;
  cutOffSeedData.forEach(seedItem => {
    const exists = existing.some(p => p.id === seedItem.id || 
      (p.nama_aturan === seedItem.nama_aturan && JSON.stringify(p.outlets) === JSON.stringify(seedItem.outlets)));
    if (!exists) {
      existing.push(seedItem);
      modified = true;
    }
  });

  gajiPokokSeedData.forEach(seedItem => {
    const exists = existing.some(p => p.id === seedItem.id || 
      (p.nama_aturan === seedItem.nama_aturan && p.deskripsi === seedItem.deskripsi));
    if (!exists) {
      existing.push(seedItem);
      modified = true;
    }
  });

  tunjanganSeedData.forEach(seedItem => {
    const exists = existing.some(p => p.id === seedItem.id || 
      (p.nama_aturan === seedItem.nama_aturan && p.deskripsi === seedItem.deskripsi));
    if (!exists) {
      existing.push(seedItem);
      modified = true;
    }
  });

  const jamPulangSeedData = [
    {
      id: 'seed-pulang-001',
      nama_aturan: 'Jam Pulang Kerja - Standar Operasional',
      outlets: allOutlets.filter(o => !o.toUpperCase().includes('AYAM BAKAR SURABAYA')).length > 0
        ? allOutlets.filter(o => !o.toUpperCase().includes('AYAM BAKAR SURABAYA'))
        : ['AYAM PECAK 2001 SEAFOOD TEBING TINGGI', 'AYAM PECAK 2001 SEAFOOD KISARAN', 'AYAM PECAK 2001 SEAFOOD RANTAU PRAPAT', 'PECEL LELE PAK HAJI KISARAN'],
      all_outlets: false,
      deskripsi: 'Jam pulang kerja operasional adalah pukul 00.30 WIB.',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
    },
    {
      id: 'seed-pulang-002',
      nama_aturan: 'Jam Pulang Kerja - Khusus',
      outlets: allOutlets.filter(o => o.toUpperCase().includes('AYAM BAKAR SURABAYA')).length > 0
        ? allOutlets.filter(o => o.toUpperCase().includes('AYAM BAKAR SURABAYA'))
        : ['AYAM BAKAR SURABAYA TEBING TINGGI'],
      all_outlets: false,
      deskripsi: 'Jam pulang kerja operasional adalah pukul 22.30 WIB.',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
    },
  ];

  jamPulangSeedData.forEach(seedItem => {
    const exists = existing.some(p => p.id === seedItem.id || 
      (p.nama_aturan === seedItem.nama_aturan && p.deskripsi === seedItem.deskripsi));
    if (!exists) {
      existing.push(seedItem);
      modified = true;
    }
  });

  const financialPenaltySeedData = [
    {
      id: 'seed-finpenalty-001',
      nama_aturan: 'Sanksi Finansial Libur Hari Sibuk (Weekend & Peak Day)',
      outlets: targetAllOutlets,
      all_outlets: true,
      deskripsi: 'Potongan denda mutlak sebesar Rp200.000 untuk libur di hari Sabtu atau Minggu (berdasarkan kalender sistem), dan pilihan denda Rp250.000 untuk hari-hari sibuk nasional (Peak Day) yang ditentukan oleh Admin.',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
    }
  ];

  financialPenaltySeedData.forEach(seedItem => {
    const exists = existing.some(p => p.id === seedItem.id || 
      (p.nama_aturan === seedItem.nama_aturan && p.deskripsi === seedItem.deskripsi));
    if (!exists) {
      existing.push(seedItem);
      modified = true;
    }
  });

  if (modified || existing.length > 0) {
    savePolicies(existing);
  }
};

// ─── Label Tampilan Outlet di tabel ─────────────────────────────────────────
const formatOutletLabel = (selectedOutlets, allOutlets) => {
  if (!selectedOutlets || selectedOutlets.length === 0) return '-';
  if (allOutlets.length > 0 && selectedOutlets.length === allOutlets.length) return '🌐 Semua Outlet';
  if (selectedOutlets.length === 1) return selectedOutlets[0];
  return selectedOutlets.join(', ');
};

// ─── Reusable style helpers ──────────────────────────────────────────────────
const S = {
  inputLabel: {
    fontSize: '0.72rem', fontWeight: 700,
    color: P.creamMuted, textTransform: 'uppercase',
    letterSpacing: '0.4px', display: 'block', marginBottom: '6px',
  },
  input: {
    width: '100%', background: P.bgMain,
    border: `1px solid ${P.accent}`, borderRadius: '8px',
    padding: '10px 14px', color: P.cream,
    fontSize: '0.88rem', outline: 'none',
    transition: 'border-color 0.2s', fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  th: {
    padding: '13px 16px', fontSize: '0.72rem', fontWeight: 800,
    color: P.creamMuted, textTransform: 'uppercase', letterSpacing: '0.5px',
    background: P.bgSurface, whiteSpace: 'nowrap',
    borderBottom: `2px solid ${P.accent}`,
  },
  td: {
    padding: '12px 16px', fontSize: '0.85rem', color: P.cream,
    borderBottom: `1px solid rgba(65,45,21,0.35)`, verticalAlign: 'middle',
  },
};

// ─── Komponen Multi-Select Outlet ────────────────────────────────────────────
function OutletMultiSelect({ options, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Tutup dropdown saat klik di luar
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const allSelected = options.length > 0 && selected.length === options.length;

  const toggleAll = () => onChange(allSelected ? [] : [...options]);
  const toggleOne = (opt) => {
    onChange(
      selected.includes(opt)
        ? selected.filter(s => s !== opt)
        : [...selected, opt]
    );
  };

  const label = allSelected
    ? '✅ Semua Outlet Dipilih'
    : selected.length > 0
      ? `${selected.length} outlet dipilih`
      : '— Pilih Outlet —';

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={options.length === 0}
        style={{
          ...S.input, display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', cursor: options.length === 0 ? 'not-allowed' : 'pointer',
          background: open ? P.bgSurface : P.bgMain,
          borderColor: open ? P.cream : P.accent,
          textAlign: 'left', padding: '10px 14px',
          opacity: options.length === 0 ? 0.6 : 1,
        }}
      >
        <span style={{ color: selected.length > 0 ? P.cream : P.creamMuted, fontSize: '0.85rem' }}>
          {options.length === 0 ? '— Outlet Kosong —' : label}
        </span>
        <ChevronDown
          size={16}
          color={P.creamMuted}
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}
        />
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 200,
          background: P.bgSurface, border: `1px solid ${P.accent}`,
          borderRadius: '10px', padding: '10px',
          boxShadow: '0 12px 35px rgba(0,0,0,0.7)',
          maxHeight: '260px', overflowY: 'auto',
        }}>
          {options.length === 0 ? (
            <div style={{ padding: '12px', color: P.creamMuted, fontSize: '0.82rem', textAlign: 'center' }}>
              Belum ada outlet tersimpan.<br />
              <span style={{ fontSize: '0.75rem' }}>Tambah outlet di halaman Outlet Cabang dulu.</span>
            </div>
          ) : (
            <>
              {/* Pilih Semua */}
              <label style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '9px 10px', cursor: 'pointer', borderRadius: '7px',
                background: allSelected ? P.accentLight : 'transparent',
                marginBottom: '4px', transition: 'background 0.15s',
              }}
                onMouseEnter={e => e.currentTarget.style.background = P.accentLight}
                onMouseLeave={e => e.currentTarget.style.background = allSelected ? P.accentLight : 'transparent'}
              >
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  style={{ width: '16px', height: '16px', accentColor: P.cream, cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: P.cream }}>
                  🌐 Pilih Semua Outlet
                </span>
              </label>

              <div style={{ borderTop: `1px solid ${P.accent}`, margin: '6px 0' }} />

              {/* Per Outlet */}
              {options.map((opt) => {
                const isChecked = selected.includes(opt);
                return (
                  <label
                    key={opt}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '8px 10px', cursor: 'pointer', borderRadius: '7px',
                      background: isChecked ? P.accentLight : 'transparent',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = P.accentLight}
                    onMouseLeave={e => e.currentTarget.style.background = isChecked ? P.accentLight : 'transparent'}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleOne(opt)}
                      style={{ width: '15px', height: '15px', accentColor: P.cream, cursor: 'pointer', flexShrink: 0 }}
                    />
                    <span style={{ fontSize: '0.82rem', color: P.cream, lineHeight: 1.3 }}>{opt}</span>
                  </label>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Render Deskripsi dengan Rupiah Highlight ───────────────────────────────
const renderDescription = (text) => {
  if (!text) return <span style={{ color: P.creamMuted, fontStyle: 'italic' }}>—</span>;
  
  const regex = /(Rp\s*\d+(?:\.\d{3})*)/g;
  const parts = text.split(regex);
  
  return parts.map((part, index) => {
    if (/^Rp\s*\d+/.test(part)) {
      const cleanNum = part.replace(/[^0-9]/g, '');
      const formatted = 'Rp ' + Number(cleanNum).toLocaleString('id-ID');
      return (
        <span key={index} style={{ color: P.cream, fontWeight: 800 }}>
          {formatted}
        </span>
      );
    }
    return part;
  });
};

// ─── Komponen Utama ───────────────────────────────────────────────────────────
export default function PolicyPage({ token, API_URL, userPermissions, user }) {

  // ── State data ──
  const [policies, setPolicies]           = useState([]);
  const [outletOptions, setOutletOptions] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState('');
  const [currentPage, setCurrentPage]     = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  // ── State form modal ──
  const [showModal, setShowModal]             = useState(false);
  const [editingId, setEditingId]             = useState(null);
  const [formNamaAturan, setFormNamaAturan]   = useState('');
  const [formDeskripsi, setFormDeskripsi]     = useState('');    // isi/deskripsi aturan
  const [formOutlets, setFormOutlets]         = useState([]);    // array nama_tablet terpilih
  const [formStatus, setFormStatus]           = useState('ACTIVE');  
  const [errorMsg, setErrorMsg]               = useState('');

  // ── Konfirmasi & Toast ──
  const [confirmModal, setConfirmModal] = useState({ open: false, title: '', msg: '', onConfirm: null });
  const [toast, setToast]               = useState(null);

  // ── Deteksi Hak Akses RBAC ──
  const currentRole = getRoleFromPosition(user?.position, user?.role);
  const canEdit = checkAccess(user, 'edit');
  const canDelete = ['master', 'leader'].includes(currentRole);

  const showToast = useCallback((type, text) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const showError = (msg) => {
    setErrorMsg(msg);
    showToast('error', msg);
  };

  const syncPoliciesWithBackend = async (data) => {
    if (!token || !API_URL) return;
    try {
      const res = await fetch(`${API_URL}/policies/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ policies: data })
      });
      const resData = await res.json();
      if (resData.status !== 'success') {
        console.error('Failed to sync policies with backend database:', resData.message);
      }
    } catch (e) {
      console.error('Network error syncing policies with backend database:', e);
    }
  };

  // ── Inisialisasi ──
  useEffect(() => {
    // 1. Seed data awal Barokah Grup (hanya jika localStorage masih kosong)
    seedInitialPolicies();

    // 2. Baca kebijakan dari localStorage (termasuk seed yang baru saja dibuat)
    const stored = loadPolicies();
    setPolicies(stored);
    
    // Sync to backend database on boot
    syncPoliciesWithBackend(stored);

    // 3. Baca opsi outlet dari outlet_cabang_data
    const opts = getOutletOptions();
    setOutletOptions(opts);

    setLoading(false);
  }, []);

  // ── Reset form ──
  const resetForm = () => {
    setEditingId(null);
    setFormNamaAturan('');
    setFormDeskripsi('');
    setFormOutlets([]);
    setFormStatus('ACTIVE');
    setErrorMsg('');
  };

  // ── Buka modal tambah ──
  const openAdd = () => {
    if (!checkAccess(user, 'write')) {
      showError("Akses Ditolak! Anda tidak memiliki izin untuk melakukan aksi ini.");
      return;
    }
    resetForm();
    // Refresh outlet options saat buka form (sinkron dengan OutletPage)
    setOutletOptions(getOutletOptions());
    setShowModal(true);
  };

  // ── Buka modal edit ──
  const openEdit = (pol) => {
    if (!checkAccess(user, 'edit')) {
      showError("Akses Ditolak! Anda tidak memiliki izin untuk melakukan aksi ini.");
      return;
    }
    setEditingId(pol.id);
    setFormNamaAturan(pol.nama_aturan || '');
    setFormDeskripsi(pol.deskripsi || '');
    setFormOutlets(pol.outlets || []);
    setFormStatus(pol.status || 'ACTIVE');
    setErrorMsg('');
    setOutletOptions(getOutletOptions());
    setShowModal(true);
  };

  // ── Simpan ──
  const handleSave = () => {
    if (!formNamaAturan.trim()) {
      showError('Gagal menyimpan! Nama aturan dan cakupan outlet wajib diisi.');
      return;
    }
    if (formOutlets.length === 0) {
      showError('Gagal menyimpan! Nama aturan dan cakupan outlet wajib diisi.');
      return;
    }

    const existing = loadPolicies();
    const allSelected = outletOptions.length > 0 && formOutlets.length === outletOptions.length;

    const policyObj = {
      id: editingId || `pol-${Date.now()}`,
      nama_aturan: formNamaAturan.trim(),
      deskripsi: formDeskripsi.trim(),
      outlets: formOutlets,
      all_outlets: allSelected,
      status: formStatus,
      created_at: new Date().toISOString(),
    };

    let updated;
    if (editingId) {
      updated = existing.map(p => p.id === editingId ? policyObj : p);
    } else {
      updated = [...existing, policyObj];
    }

    savePolicies(updated);
    setPolicies(updated);
    syncPoliciesWithBackend(updated);
    recalculateDraftPayrolls(updated, token, API_URL);
    setShowModal(false);
    showToast('success', `✅ Kebijakan "${policyObj.nama_aturan}" berhasil ${editingId ? 'diperbarui' : 'ditambahkan'}!`);
  };

  // ── Hapus ──
  const triggerDelete = (id, nama) => {
    if (!canDelete) {
      showError("Akses Ditolak! Anda tidak memiliki izin untuk melakukan aksi ini.");
      return;
    }
    setConfirmModal({
      open: true,
      title: 'Konfirmasi Hapus Kebijakan',
      msg: `Yakin ingin menghapus kebijakan "${nama}" secara permanen?`,
      onConfirm: () => {
        const updated = loadPolicies().filter(p => p.id !== id);
        savePolicies(updated);
        setPolicies(updated);
        syncPoliciesWithBackend(updated);
        recalculateDraftPayrolls(updated, token, API_URL);
        showToast('success', `🗑️ Kebijakan "${nama}" berhasil dihapus.`);
      },
    });
  };

  // ── Filter ──
  const filtered = policies.filter(p => {
    const q = search.toLowerCase();
    return (
      (p.nama_aturan || '').toLowerCase().includes(q) ||
      (p.outlets || []).some(o => o.toLowerCase().includes(q)) ||
      (p.status || '').toLowerCase().includes(q)
    );
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

  // ── Stats ──
  const totalAktif   = policies.filter(p => p.status === 'ACTIVE').length;
  const totalInaktif = policies.filter(p => p.status === 'INACTIVE').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: 'fixed', top: '24px', right: '24px', zIndex: 9999,
          padding: '14px 20px', borderRadius: '12px', minWidth: '300px', maxWidth: '420px',
          background: toast.type === 'success' ? 'rgba(46,204,113,0.92)' : 'rgba(231,76,60,0.92)',
          border: `1px solid ${toast.type === 'success' ? P.success : P.danger}`,
          color: '#fff', fontWeight: 700, fontSize: '0.88rem',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', gap: '10px',
          animation: 'fadeIn 0.3s ease',
        }}>
          {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          {toast.text}
        </div>
      )}



      {/* ── 2. KPI Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px,1fr))', gap: '16px' }}>
        {[
          { label: 'Total Kebijakan', val: `${policies.length} Aturan`, color: P.cream,    icon: <Shield size={18}/>,       bg: P.creamGlow },
          { label: 'Status ACTIVE',   val: `${totalAktif} Aktif`,       color: P.success,  icon: <CheckCircle size={18}/>,  bg: P.successGlow },
          { label: 'Status INACTIVE', val: `${totalInaktif} Tidak Aktif`, color: P.danger, icon: <AlertCircle size={18}/>, bg: P.dangerGlow },
          { label: 'Outlet Terdaftar', val: `${outletOptions.length} Outlet`, color: P.warning, icon: <Store size={18}/>, bg: 'rgba(243,156,18,0.1)' },
        ].map((c, i) => (
          <div key={i} style={{
            background: P.bgSurface, border: `1px solid ${P.accent}`,
            borderRadius: '14px', padding: '18px 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: '0.7rem', color: P.creamMuted, fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>{c.label}</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: c.color }}>{c.val}</div>
            </div>
            <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.color }}>
              {c.icon}
            </div>
          </div>
        ))}
      </div>

      {/* ── 3. Panel Tabel ── */}
      <div style={{ background: P.bgSurface, border: `1px solid ${P.accent}`, borderRadius: '14px', padding: '26px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: P.creamGlow, display: 'flex', alignItems: 'center', justifyContent: 'center', color: P.cream }}>
              <Shield size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: P.cream, margin: 0 }}>KEBIJAKAN PERUSAHAAN</h3>
              <p style={{ fontSize: '0.78rem', color: P.creamMuted, margin: 0 }}>
                Aturan kerja &amp; ketentuan operasional yang berlaku di seluruh cabang
              </p>
            </div>
          </div>

          {checkAccess(user, 'write') && (
            <button
              onClick={openAdd}
              style={{
                padding: '10px 18px', background: P.cream, color: P.bgMain,
                border: 'none', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 800,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                boxShadow: '0 4px 12px rgba(165, 182, 141, 0.2)', transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#f0ebe0'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = P.cream; e.currentTarget.style.transform = 'none'; }}
            >
              <Plus size={16} /> TAMBAH KEBIJAKAN
            </button>
          )}
        </div>

        {/* Search */}
        <div style={{ position: 'relative', maxWidth: '320px', marginBottom: '18px' }}>
          <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: P.creamMuted }} />
          <input
            type="text"
            placeholder="Cari nama aturan, outlet, status..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...S.input, paddingLeft: '34px', height: '40px' }}
            onFocus={e => e.target.style.borderColor = P.cream}
            onBlur={e => e.target.style.borderColor = P.accent}
          />
        </div>

        {/* Tabel Responsif */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: P.creamMuted }}>
            <div className="loading-spinner" style={{ margin: '0 auto 12px' }}></div>
            <p>Memuat kebijakan perusahaan...</p>
          </div>
        ) : (
          <>
            <div style={{ width: '100%', overflowX: 'auto', borderRadius: '10px', border: `1px solid ${P.accent}` }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', whiteSpace: 'nowrap', minWidth: '650px' }}>
              <thead>
                <tr>
                  <th style={{ ...S.th, width: '52px', textAlign: 'center' }}>NO</th>
                  <th style={{ ...S.th, minWidth: '180px' }}>NAMA ATURAN</th>
                  <th style={{ ...S.th, minWidth: '200px', whiteSpace: 'normal' }}>DESKRIPSI</th>
                  <th style={{ ...S.th, minWidth: '240px', whiteSpace: 'normal' }}>NAMA OUTLET</th>
                  <th style={{ ...S.th, minWidth: '120px', textAlign: 'center' }}>STATUS</th>
                  <th style={{ ...S.th, minWidth: '140px', textAlign: 'center' }}>AKSI</th>
                </tr>
              </thead>

              <tbody style={{
                opacity: isTransitioning ? 0 : 1,
                transform: isTransitioning ? 'scale(0.99)' : 'scale(1)',
                transition: 'opacity 0.4s ease-in-out, transform 0.3s ease'
              }}>
                {currentRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ ...S.td, textAlign: 'center', padding: '40px', color: P.creamMuted }}>
                      📋 Belum ada kebijakan yang dibuat.<br />
                      Klik <strong style={{ color: P.cream }}>TAMBAH KEBIJAKAN</strong> untuk menambahkan aturan baru.
                    </td>
                  </tr>
                ) : (
                  currentRows.map((pol, idx) => {
                    const isAllOutlets = pol.all_outlets ||
                      (outletOptions.length > 0 && (pol.outlets || []).length === outletOptions.length);
                    const outletLabel = isAllOutlets
                      ? '🌐 Semua Outlet'
                      : formatOutletLabel(pol.outlets || [], outletOptions);
                    const isActive = pol.status === 'ACTIVE';

                    return (
                      <tr
                        key={pol.id}
                        style={{ background: idx % 2 === 0 ? P.bgMain : P.bgSurface, transition: 'background 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(65,45,21,0.55)'}
                        onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? P.bgMain : P.bgSurface}
                      >
                        {/* No */}
                        <td style={{ ...S.td, textAlign: 'center', fontWeight: 700, color: P.creamMuted }}>
                          {indexOfFirstRow + idx + 1}
                        </td>

                        {/* Nama Aturan */}
                        <td style={{ ...S.td, fontWeight: 700, color: P.cream, whiteSpace: 'normal', minWidth: '180px' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: isActive ? P.success : P.danger, flexShrink: 0, marginTop: '6px' }} />
                            <span>{pol.nama_aturan}</span>
                          </div>
                        </td>

                        {/* Deskripsi Aturan */}
                        <td style={{ ...S.td, color: P.cream, whiteSpace: 'normal', minWidth: '200px', fontSize: '0.82rem', lineHeight: 1.5 }}>
                          {renderDescription(pol.deskripsi)}
                        </td>

                        {/* Nama Outlet */}
                        <td style={{ ...S.td, whiteSpace: 'normal', maxWidth: '260px' }}>
                          {isAllOutlets ? (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '5px',
                              padding: '3px 10px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700,
                              background: 'rgba(165, 182, 141, 0.12)', color: P.cream,
                              border: `1px solid ${P.accent}`,
                            }}>
                              🌐 Semua Outlet
                            </span>
                          ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {(pol.outlets || []).map((o, i) => (
                                <span key={i} style={{
                                  padding: '2px 8px', borderRadius: '5px', fontSize: '0.72rem', fontWeight: 600,
                                  background: P.accentLight, color: P.cream,
                                  border: `1px solid rgba(65,45,21,0.5)`,
                                  whiteSpace: 'nowrap',
                                }}>
                                  {o}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>

                        {/* Status */}
                        <td style={{ ...S.td, textAlign: 'center' }}>
                          <span style={{
                            padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 800,
                            background: isActive ? P.successGlow : P.dangerGlow,
                            color: isActive ? P.success : P.danger,
                            border: `1px solid ${isActive ? P.success : P.danger}`,
                            letterSpacing: '0.3px',
                          }}>
                            {isActive ? '● ACTIVE' : '○ INACTIVE'}
                          </span>
                        </td>

                        {/* Aksi */}
                        <td style={{ ...S.td, textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            {/* Tombol Edit — mematuhi RBAC */}
                            {canEdit ? (
                              <button
                                onClick={() => openEdit(pol)}
                                title="Edit Kebijakan"
                                style={{
                                  padding: '5px 11px', background: P.creamGlow,
                                  border: `1px solid ${P.cream}`, borderRadius: '6px',
                                  color: P.cream, fontSize: '0.75rem', fontWeight: 700,
                                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                                  transition: 'all 0.15s',
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(165, 182, 141, 0.2)'}
                                onMouseLeave={e => e.currentTarget.style.background = P.creamGlow}
                              >
                                <Edit size={12} /> UBAH
                              </button>
                            ) : (
                              <button
                                disabled
                                title="Anda tidak memiliki izin untuk mengubah kebijakan"
                                style={{
                                  padding: '5px 11px', background: 'rgba(65,45,21,0.2)',
                                  border: `1px solid rgba(65,45,21,0.3)`, borderRadius: '6px',
                                  color: 'rgba(165, 182, 141, 0.25)', fontSize: '0.75rem', fontWeight: 700,
                                  cursor: 'not-allowed', display: 'flex', alignItems: 'center', gap: '4px',
                                }}
                              >
                                <Edit size={12} /> UBAH
                              </button>
                            )}

                            {/* Tombol Hapus — hanya master/owner */}
                            {canDelete ? (
                              <button
                                onClick={() => triggerDelete(pol.id, pol.nama_aturan)}
                                title="Hapus Kebijakan"
                                style={{
                                  padding: '5px 11px', background: P.dangerGlow,
                                  border: `1px solid ${P.danger}`, borderRadius: '6px',
                                  color: P.danger, fontSize: '0.75rem', fontWeight: 700,
                                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                                  transition: 'all 0.15s',
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(231,76,60,0.2)'}
                                onMouseLeave={e => e.currentTarget.style.background = P.dangerGlow}
                              >
                                <Trash2 size={12} /> HAPUS
                              </button>
                            ) : (
                              <button
                                disabled
                                title="Hanya Master/Owner yang dapat menghapus"
                                style={{
                                  padding: '5px 11px', background: 'rgba(65,45,21,0.2)',
                                  border: `1px solid rgba(65,45,21,0.3)`, borderRadius: '6px',
                                  color: 'rgba(165, 182, 141, 0.25)', fontSize: '0.75rem', fontWeight: 700,
                                  cursor: 'not-allowed', display: 'flex', alignItems: 'center', gap: '4px',
                                }}
                              >
                                <Trash2 size={12} /> HAPUS
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>

              {/* Footer total */}
              {filtered.length > 0 && (
                <tfoot>
                  <tr style={{ background: P.accent }}>
                    <td style={S.td}></td>
                    <td style={{ ...S.td, fontWeight: 800, color: P.cream }}>
                      TOTAL: {filtered.length} KEBIJAKAN
                    </td>
                    <td style={S.td}></td>
                    <td style={S.td}></td>
                    <td style={{ ...S.td, textAlign: 'center' }}>
                      <span style={{ color: P.success, fontWeight: 700, marginRight: '6px' }}>{totalAktif} ACTIVE</span>
                      <span style={{ color: P.danger, fontWeight: 700 }}>{totalInaktif} INACTIVE</span>
                    </td>
                    <td style={S.td}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          
          {/* Controls Pagination */}
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
                Menampilkan {indexOfFirstRow + 1}-{Math.min(indexOfLastRow, filtered.length)} dari {filtered.length} kebijakan
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
      </div>

      {/* ── Modal Tambah / Edit Kebijakan ── */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(6px)', display: 'flex',
          alignItems: 'flex-start', justifyContent: 'center',
          padding: '30px 16px', overflowY: 'auto', zIndex: 1000,
        }}>
          <div style={{
            width: '100%', maxWidth: '560px',
            background: P.bgSurface, border: `1px solid ${P.accent}`,
            borderRadius: '20px', padding: '28px',
            animation: 'fadeIn 0.3s ease',
          }}>
            {/* Header Modal */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: '22px', paddingBottom: '14px', borderBottom: `1px solid ${P.accent}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: P.creamGlow, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Shield size={18} color={P.cream} />
                </div>
                <h2 style={{ fontSize: '1rem', fontWeight: 800, color: P.cream, margin: 0 }}>
                  {editingId ? 'UBAH KEBIJAKAN' : 'TAMBAH KEBIJAKAN BARU'}
                </h2>
              </div>
              <button onClick={() => { setShowModal(false); resetForm(); }} style={{ background: 'transparent', border: 'none', color: P.cream, cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {/* Error message */}
            {errorMsg && (
              <div style={{
                background: P.dangerGlow, border: `1px solid ${P.danger}`,
                color: P.danger, padding: '10px 14px', borderRadius: '8px',
                fontSize: '0.82rem', fontWeight: 700, marginBottom: '16px',
                display: 'flex', alignItems: 'flex-start', gap: '8px',
              }}>
                <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '1px' }} /> {errorMsg}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

              {/* Field 1: Nama Aturan */}
              <div>
                <label style={S.inputLabel}>Nama Aturan *</label>
                <input
                  type="text"
                  placeholder="Contoh: Wajib Briefing Pagi Jam 07.30"
                  value={formNamaAturan}
                  onChange={e => setFormNamaAturan(e.target.value)}
                  style={S.input}
                  onFocus={e => e.target.style.borderColor = P.cream}
                  onBlur={e => e.target.style.borderColor = P.accent}
                />
              </div>

              {/* Field 2: Deskripsi / Isi Aturan */}
              <div>
                <label style={S.inputLabel}>Deskripsi / Isi Aturan</label>
                <textarea
                  placeholder="Contoh: Seluruh outlet masuk jam 10 siang."
                  value={formDeskripsi}
                  onChange={e => setFormDeskripsi(e.target.value)}
                  rows={3}
                  style={{ ...S.input, resize: 'vertical', lineHeight: 1.5 }}
                  onFocus={e => e.target.style.borderColor = P.cream}
                  onBlur={e => e.target.style.borderColor = P.accent}
                />
              </div>

              {/* Field 2: Multi-Select Outlet */}
              <div>
                <label style={S.inputLabel}>
                  Nama Outlet *
                  <span style={{ marginLeft: '8px', fontSize: '0.65rem', fontWeight: 500, color: P.creamMuted, textTransform: 'none' }}>
                    (dari halaman Outlet Cabang — {outletOptions.length} tersedia)
                  </span>
                </label>
                <OutletMultiSelect
                  options={outletOptions}
                  selected={formOutlets}
                  onChange={setFormOutlets}
                />
                {/* Preview pilihan */}
                {formOutlets.length > 0 && formOutlets.length < outletOptions.length && (
                  <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {formOutlets.map((o, i) => (
                      <span key={i} style={{
                        padding: '2px 8px', borderRadius: '5px', fontSize: '0.72rem',
                        background: P.accentLight, color: P.cream, fontWeight: 600,
                      }}>
                        {o}
                        <button
                          type="button"
                          onClick={() => setFormOutlets(prev => prev.filter(x => x !== o))}
                          style={{ background: 'none', border: 'none', color: P.creamMuted, cursor: 'pointer', marginLeft: '4px', padding: 0, fontSize: '0.75rem' }}
                        >×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Field 3: Status */}
              <div>
                <label style={S.inputLabel}>Status Kebijakan *</label>
                <select
                  value={formStatus}
                  onChange={e => setFormStatus(e.target.value)}
                  style={{ ...S.input, height: '42px', cursor: 'pointer' }}
                  onFocus={e => e.target.style.borderColor = P.cream}
                  onBlur={e => e.target.style.borderColor = P.accent}
                >
                  <option value="ACTIVE">✅ ACTIVE — Berlaku Sekarang</option>
                  <option value="INACTIVE">○ INACTIVE — Tidak Berlaku</option>
                </select>
              </div>

              {/* Preview ringkasan kebijakan */}
              {formNamaAturan && formOutlets.length > 0 && (
                <div style={{
                  background: 'rgba(65,45,21,0.3)', border: `1px dashed ${P.accent}`,
                  borderRadius: '10px', padding: '12px 16px',
                }}>
                  <div style={{ fontSize: '0.68rem', color: P.creamMuted, fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
                    Preview Kebijakan:
                  </div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: P.cream, marginBottom: '4px' }}>
                    📋 {formNamaAturan}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: P.creamMuted }}>
                    Berlaku di: {formOutlets.length === outletOptions.length && outletOptions.length > 0
                      ? '🌐 Semua Outlet'
                      : formOutlets.join(', ')}
                  </div>
                  <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>
                    Status: <span style={{ color: formStatus === 'ACTIVE' ? P.success : P.danger, fontWeight: 700 }}>
                      {formStatus}
                    </span>
                  </div>
                </div>
              )}

              {/* Tombol Aksi */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={handleSave}
                  style={{
                    flex: 1, height: '46px', background: P.cream, color: P.bgMain,
                    border: 'none', borderRadius: '10px', fontSize: '0.9rem', fontWeight: 800,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    boxShadow: '0 4px 14px rgba(165, 182, 141, 0.25)', transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f0ebe0'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = P.cream; e.currentTarget.style.transform = 'none'; }}
                >
                  <CheckCircle size={18} />
                  {editingId ? 'Simpan Perubahan' : 'Simpan Kebijakan'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  style={{
                    flex: 1, height: '46px', background: P.accent, color: P.cream,
                    border: `1px solid ${P.accent}`, borderRadius: '10px',
                    fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  Batal
                </button>
              </div>

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
                YA, HAPUS
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

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Users, BarChart3, Plus, Trash2, Calendar, Clipboard, 
  MapPin, CheckCircle, AlertTriangle, ShieldAlert, Award, 
  Clock, Eye, Sparkles, RefreshCw, ChevronRight, CheckSquare, Square, X
} from 'lucide-react';
import { useHRIS } from '../context/HRISContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import PDFCompileOverlay from './PDFCompileOverlay';


// ─── Palet Warna Resmi (Menggunakan Light Theme Variables) ───────────────────
const C = {
  bg:          'var(--bg-main)',
  surface:     'var(--bg-surface)',
  cyan:        'var(--accent-primary)',
  cyanDim:     'rgba(59, 130, 246, 0.08)',
  cyanBorder:  'rgba(59, 130, 246, 0.25)',
  text:        'var(--text-main)',
  muted:       'var(--text-muted)',
  border:      'var(--border-color)',
  danger:      'var(--status-error)',
  dangerDim:   'rgba(239, 68, 68, 0.1)',
  dangerBorder:'rgba(239, 68, 68, 0.2)',
  success:     'var(--status-success)',
  successDim:  'rgba(16, 185, 129, 0.1)',
  warn:        'var(--warning)',
};

// ─── Helper Utils ────────────────────────────────────────────────────────────
const cap = (s = '') => String(s).replace(/\b\w/g, c => c.toUpperCase());
const uid = (prefix = 'SV') => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

const isLeader = (pos = '') => {
  const p = pos.toLowerCase().trim();
  return p.includes('kepala') || p.includes('supervisor') || p.includes('admin') || p.includes('qc') || p.includes('manager');
};

export default function PenilaianKPI({ token, API_URL }) {
  const { activeEmployees } = useHRIS();

  // ─── States ────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('survei-form'); // 'survei-form', 'hasil-survei', 'kpi-akumulatif', 'leaderboard'
  const [employees, setEmployees] = useState([]);

  // Briefing Log States
  const [showBriefingModal, setShowBriefingModal] = useState(false);
  const [briefingModalEmpId, setBriefingModalEmpId] = useState(null);
  const [briefingModalEmpName, setBriefingModalEmpName] = useState('');
  const [briefingDaysState, setBriefingDaysState] = useState([]);
  
  // Data State
  const [surveys, setSurveys] = useState([]);
  const [responses, setResponses] = useState([]);
  
  // Form State Tab 1
  const [judulSurvei, setJudulSurvei] = useState('');
  const [tipePaket, setTipePaket] = useState('staf'); // 'staf' | 'leader'
  const [targetOutlet, setTargetOutlet] = useState('Semua Outlet');
  const [tanggalKirim, setTanggalKirim] = useState(new Date().toISOString().slice(0, 10));

  // Animasi & Konfirmasi Modal States
  const [showConfirm1, setShowConfirm1] = useState(false);
  const [showConfirm2, setShowConfirm2] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendingStep, setSendingStep] = useState(0);
  const [isExportingPDF, setIsExportingPDF] = useState(false);


  // Filter States Tab 2 & 3
  const [filterMonth, setFilterMonth] = useState(6); // default Juni
  const [filterYear, setFilterYear] = useState(2026); // default 2026
  const [filterOutlet, setFilterOutlet] = useState('Semua Outlet');

  // Filter States Tab 4 (Leaderboard)
  const [lbSelectedOutlets, setLbSelectedOutlets] = useState(['Semua Outlet']);
  const [lbMonth, setLbMonth] = useState(6);
  const [lbYear, setLbYear] = useState(2026);
  const [lbPage, setLbPage] = useState(1);

  // Reset leaderboard page when filter changes
  useEffect(() => {
    setLbPage(1);
  }, [lbSelectedOutlets, lbMonth, lbYear]);

  // ─── Briefing Log Helper Methods ───────────────────────────────────────────
  const handleOpenBriefingModal = (empId, empName) => {
    setBriefingModalEmpId(empId);
    setBriefingModalEmpName(empName);
    
    // Generate dates for filterMonth / filterYear
    const daysInMonth = new Date(filterYear, filterMonth, 0).getDate();
    const briefingLogs = JSON.parse(localStorage.getItem('hris_briefing_logs') || '[]');
    const attLogs = JSON.parse(localStorage.getItem('hris_attendances_history') || localStorage.getItem('hris_attendance_history') || localStorage.getItem('attendance_logs') || '[]');

    const days = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${filterYear}-${String(filterMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      
      // Check if present
      const isPresent = attLogs.some(l => {
        const matchesEmp = String(l.employee_id) === String(empId) || l.nik === employees.find(e => e.id === empId)?.nik;
        return matchesEmp && l.date === dateStr && (l.clock_in || l.status === 'Hadir' || l.status === 'Terlambat');
      });

      // Check if briefing completed
      const logEntry = briefingLogs.find(b => String(b.employee_id) === String(empId) && b.date === dateStr);
      const completed = logEntry ? logEntry.completed : false;

      days.push({
        day: d,
        dateStr,
        completed,
        isPresent
      });
    }

    setBriefingDaysState(days);
    setShowBriefingModal(true);
  };

  const handleSaveBriefing = () => {
    let briefingLogs = JSON.parse(localStorage.getItem('hris_briefing_logs') || '[]');
    
    // Remove existing entries for this employee in the current month
    briefingLogs = briefingLogs.filter(b => {
      const matchesEmp = String(b.employee_id) === String(briefingModalEmpId);
      if (!matchesEmp) return true;
      const d = new Date(b.date);
      const inCurrentMonth = d.getMonth() + 1 === Number(filterMonth) && d.getFullYear() === Number(filterYear);
      return !inCurrentMonth;
    });

    // Add new entries
    briefingDaysState.forEach(day => {
      briefingLogs.push({
        employee_id: briefingModalEmpId,
        date: day.dateStr,
        completed: day.completed
      });
    });

    localStorage.setItem('hris_briefing_logs', JSON.stringify(briefingLogs));
    
    // Dispatch event to sync state
    window.dispatchEvent(new CustomEvent('hris:storage', { detail: { key: 'hris_briefing_logs', value: briefingLogs } }));

    setShowBriefingModal(false);
  };

  const handleAutoCheckPresentDays = () => {
    setBriefingDaysState(prev => prev.map(d => ({
      ...d,
      completed: d.isPresent ? true : d.completed
    })));
  };

  // ─── Seed Data & Data Loading ──────────────────────────────────────────────
  const loadData = useCallback(() => {
    // 1. Sync list karyawan
    const localEmployees = JSON.parse(localStorage.getItem('karyawan_data') || localStorage.getItem('hris_employees') || '[]');
    const mergedEmployees = localEmployees.length > 0 ? localEmployees : activeEmployees;
    setEmployees(mergedEmployees);

    // 2. Load surveys & responses
    let localSurveys = JSON.parse(localStorage.getItem('hris_360_surveys') || '[]');
    let localResponses = JSON.parse(localStorage.getItem('hris_360_responses') || '[]');

    setSurveys(localSurveys);
    setResponses(localResponses);
  }, [activeEmployees]);

  useEffect(() => {
    loadData();
    // React to global storage changes
    const handleStorageChange = (e) => {
      if (e.key === 'hris_360_surveys' || e.key === 'hris_360_responses' || e.key === 'karyawan_data' || e.key === 'hris_employees') {
        loadData();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('hris:storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('hris:storage', handleStorageChange);
    };
  }, [loadData]);

  // Sync reaktif list karyawan saat context update
  useEffect(() => {
    if (activeEmployees && activeEmployees.length > 0) {
      setEmployees(activeEmployees);
    }
  }, [activeEmployees]);

  // ─── Tab 1: Logika Distribusi Target Otomatis ──────────────────────────────
  const getTargetEmployeesForSurvey = (tipe, outlet) => {
    const outletList = outlet === 'Semua Outlet'
      ? [...new Set(employees.map(e => e.outlet).filter(Boolean))]
      : [outlet];

    let receivers = new Set();

    outletList.forEach(outName => {
      const outEmps = employees.filter(e => e.outlet === outName);
      
      if (tipe === 'staf') {
        // Evaluasi Karyawan Biasa: Staf menilai staf
        const ordinaryEmps = outEmps.filter(e => !isLeader(e.position));
        ordinaryEmps.forEach(emp => receivers.add(emp.id));
      } else if (tipe === 'leader') {
        // Evaluasi Leader: Siapa saja penilainya?
        const leaders = outEmps.filter(e => isLeader(e.position));
        
        leaders.forEach(leader => {
          const lPos = leader.position.toLowerCase();
          
          if (lPos.includes('cabang')) {
            // Kepala Cabang: Dinilai seluruh staf di outlet tsb
            outEmps.forEach(emp => {
              if (emp.id !== leader.id) receivers.add(emp.id);
            });
          } else if (lPos.includes('produksi')) {
            // Kepala Produksi: Helper, Bartender, Koki
            outEmps.forEach(emp => {
              const pos = emp.position.toLowerCase();
              if (['helper', 'bartender', 'koki'].some(p => pos.includes(p))) {
                receivers.add(emp.id);
              }
            });
          } else if (lPos.includes('layanan')) {
            // Kepala Layanan: Kasir, Waiters
            outEmps.forEach(emp => {
              const pos = emp.position.toLowerCase();
              if (['kasir', 'waiters', 'waiter'].some(p => pos.includes(p))) {
                receivers.add(emp.id);
              }
            });
          }
        });
      }
    });

    return Array.from(receivers).map(id => employees.find(e => e.id === id)).filter(Boolean);
  };

  const handleKirimSurvei = () => {
    if (!judulSurvei.trim()) return;
    setShowConfirm1(true);
  };

  const executeSurveyDistribution = () => {
    setIsSending(true);
    setSendingStep(0);

    const stepIntervals = [500, 1000, 1500];
    stepIntervals.forEach((time, index) => {
      setTimeout(() => {
        setSendingStep(index + 1);
        if (index === 2) {
          // Finalize sending
          const activeReceivers = getTargetEmployeesForSurvey(tipePaket, targetOutlet);
          const newSurveyId = uid('SV');
          const dateObj = new Date(tanggalKirim);
          
          const newSurvey = {
            id: newSurveyId,
            judul: cap(judulSurvei.trim()),
            tipe_paket: tipePaket,
            outlet: targetOutlet,
            penerima_count: activeReceivers.length,
            tanggal_kirim: tanggalKirim,
            created_at: new Date().toISOString()
          };

          // Generate mock responses for evaluation pairs
          const newResponses = [];
          const outletList = targetOutlet === 'Semua Outlet'
            ? [...new Set(employees.map(e => e.outlet).filter(Boolean))]
            : [targetOutlet];

          outletList.forEach(outName => {
            const outEmps = employees.filter(e => e.outlet === outName);

            if (tipePaket === 'staf') {
              const ordinaryEmps = outEmps.filter(e => !isLeader(e.position));
              ordinaryEmps.forEach(assessor => {
                ordinaryEmps.forEach(target => {
                  if (assessor.id !== target.id) {
                    const score = Math.round(75 + Math.random() * 25);
                    newResponses.push({
                      id: uid('RS'),
                      survey_id: newSurveyId,
                      target_id: target.id,
                      target_name: cap(target.full_name || target.nama || ''),
                      target_position: target.position,
                      target_outlet: target.outlet,
                      assessor_id: assessor.id,
                      assessor_position: assessor.position,
                      score,
                      theme: 'sejawat',
                      answers: Array.from({ length: 5 }, () => ['A', 'B', 'C'][Math.floor(Math.random() * 3)]),
                      date: tanggalKirim,
                      month: dateObj.getMonth() + 1,
                      year: dateObj.getFullYear()
                    });
                  }
                });
              });
            } else if (tipePaket === 'leader') {
              const leaders = outEmps.filter(e => isLeader(e.position));
              leaders.forEach(leader => {
                const lPos = leader.position.toLowerCase();
                let assessors = [];

                if (lPos.includes('cabang')) {
                  assessors = outEmps.filter(e => e.id !== leader.id);
                } else if (lPos.includes('produksi')) {
                  assessors = outEmps.filter(e => ['helper', 'bartender', 'koki'].some(p => e.position.toLowerCase().includes(p)));
                } else if (lPos.includes('layanan')) {
                  assessors = outEmps.filter(e => ['kasir', 'waiters', 'waiter'].some(p => e.position.toLowerCase().includes(p)));
                }

                assessors.forEach(assessor => {
                  const score = Math.round(80 + Math.random() * 20);
                  newResponses.push({
                    id: uid('RS'),
                    survey_id: newSurveyId,
                    target_id: leader.id,
                    target_name: cap(leader.full_name || leader.nama || ''),
                    target_position: leader.position,
                    target_outlet: leader.outlet,
                    assessor_id: assessor.id,
                    assessor_position: assessor.position,
                    score,
                    theme: isLeader(assessor.position) ? 'sejawat' : 'bawahan',
                    answers: Array.from({ length: 5 }, () => ['A', 'B'][Math.floor(Math.random() * 2)]),
                    date: tanggalKirim,
                    month: dateObj.getMonth() + 1,
                    year: dateObj.getFullYear()
                  });
                });
              });
            }
          });

          // Save to localStorage
          const updatedSurveys = [newSurvey, ...surveys];
          const updatedResponses = [...responses, ...newResponses];

          localStorage.setItem('hris_360_surveys', JSON.stringify(updatedSurveys));
          localStorage.setItem('hris_360_responses', JSON.stringify(updatedResponses));
          localStorage.setItem('survey_360_data', JSON.stringify(updatedResponses));

          // Dispatch event sync
          window.dispatchEvent(new CustomEvent('hris:storage', { detail: { key: 'hris_360_surveys', value: updatedSurveys } }));

          setSurveys(updatedSurveys);
          setResponses(updatedResponses);

          // Reset Form
          setJudulSurvei('');
          setTipePaket('staf');
          setTargetOutlet('Semua Outlet');

          // Close modal & overlay
          setIsSending(false);
          setShowConfirm2(false);
          setShowConfirm1(false);
        }
      }, time);
    });
  };

  const handleHapusSurvei = (surveyId) => {
    if (confirm('Apakah Anda yakin ingin menghapus survei ini beserta seluruh data evaluasinya?')) {
      const updSurveys = surveys.filter(s => s.id !== surveyId);
      const updResponses = responses.filter(r => r.survey_id !== surveyId);

      localStorage.setItem('hris_360_surveys', JSON.stringify(updSurveys));
      localStorage.setItem('hris_360_responses', JSON.stringify(updResponses));
      localStorage.setItem('survey_360_data', JSON.stringify(updResponses));

      window.dispatchEvent(new CustomEvent('hris:storage', { detail: { key: 'hris_360_surveys', value: updSurveys } }));

      setSurveys(updSurveys);
      setResponses(updResponses);
    }
  };

  // ─── Tab 2: Logika Hasil Evaluasi 360 ──────────────────────────────────────
  const getEvaluasi360Summary = () => {
    // Filter responses by month, year, outlet
    const filteredResp = responses.filter(r => {
      const isPeriodMatch = r.month === Number(filterMonth) && r.year === Number(filterYear);
      const isOutletMatch = filterOutlet === 'Semua Outlet' || r.target_outlet === filterOutlet;
      return isPeriodMatch && isOutletMatch;
    });

    // Group by target employee
    const targetGroup = {};
    filteredResp.forEach(r => {
      if (!targetGroup[r.target_id]) {
        targetGroup[r.target_id] = {
          employee_id: r.target_id,
          name: r.target_name,
          outlet: r.target_outlet,
          position: r.target_position,
          stafScores: [],
          leaderScores: [],
          allScores: []
        };
      }

      const isAssessorLeader = isLeader(r.assessor_position);
      if (isAssessorLeader) {
        targetGroup[r.target_id].leaderScores.push(r.score);
      } else {
        targetGroup[r.target_id].stafScores.push(r.score);
      }
      targetGroup[r.target_id].allScores.push(r.score);
    });

    return Object.values(targetGroup).map(item => {
      const avgStaf = item.stafScores.length > 0 
        ? parseFloat((item.stafScores.reduce((a, b) => a + b, 0) / item.stafScores.length).toFixed(1))
        : null;
      
      const avgLeader = item.leaderScores.length > 0 
        ? parseFloat((item.leaderScores.reduce((a, b) => a + b, 0) / item.leaderScores.length).toFixed(1))
        : null;

      const totalResponders = item.allScores.length;
      
      // Nilai Konversi Akhir (skala 100)
      const finalScore = totalResponders > 0
        ? Math.round(item.allScores.reduce((a, b) => a + b, 0) / totalResponders)
        : 75; // default 75 jika tidak ada responden

      return {
        ...item,
        avgStaf,
        avgLeader,
        totalResponders,
        finalScore
      };
    });
  };

  // ─── Tab 3: Rekapan KPI Akumulatif Global (The Brain Engine) ──────────────
  const getKpiAkumulatifGlobal = () => {
    // Load attendance & quiz & training
    const attLogs = JSON.parse(localStorage.getItem('hris_attendances_history') || localStorage.getItem('hris_attendance_history') || localStorage.getItem('attendance_logs') || '[]');
    const quizResults = JSON.parse(localStorage.getItem('quiz_results') || '[]');
    const trainingKpiScores = JSON.parse(localStorage.getItem('hris_training_kpi_scores') || localStorage.getItem('hris_training_results') || '[]');

    const activeEmps = filterOutlet === 'Semua Outlet'
      ? employees
      : employees.filter(e => e.outlet === filterOutlet);

    return activeEmps.map(emp => {
      // 1. Absensi (25% or 20% for Kepala Cabang)
      const empAttLogs = attLogs.filter(l => {
        const d = new Date(l.date || '');
        const matchesEmp = String(l.employee_id) === String(emp.id) || l.nik === emp.nik;
        const matchesPeriod = d.getMonth() + 1 === Number(filterMonth) && d.getFullYear() === Number(filterYear);
        return matchesEmp && matchesPeriod;
      });

      // Cari jumlah hari kerja di outlet pada periode tsb
      const outletLogs = attLogs.filter(l => {
        const d = new Date(l.date || '');
        return l.outlet === emp.outlet && d.getMonth() + 1 === Number(filterMonth) && d.getFullYear() === Number(filterYear);
      });
      const uniqueDates = [...new Set(outletLogs.map(l => l.date))];
      const totalWorkingDays = uniqueDates.length > 0 ? uniqueDates.length : 25;

      const presentDays = empAttLogs.filter(l => l.clock_in || l.status === 'Hadir' || l.status === 'Terlambat').length;
      const attendancePct = totalWorkingDays > 0 ? Math.min(100, Math.round((presentDays / totalWorkingDays) * 100)) : 0;

      // 2. Keterlambatan / Disiplin (25% or 20% for Kepala Cabang)
      const lateDays = empAttLogs.filter(l => l.status_in === 'late' || l.status === 'Terlambat' || (l.notes && /terlambat|late/i.test(l.notes))).length;
      const disciplinePct = presentDays > 0 ? Math.max(0, Math.round(100 - (lateDays / presentDays) * 100)) : 100;

      // 3. Survei 360 (30%)
      const empResponses = responses.filter(r => {
        return String(r.target_id) === String(emp.id) && r.month === Number(filterMonth) && r.year === Number(filterYear);
      });
      const surveyPct = empResponses.length > 0
        ? Math.round(empResponses.reduce((sum, r) => sum + (r.score || 0), 0) / empResponses.length)
        : 75; // default 75 jika survey kosong
      const weightedSurvey = parseFloat((surveyPct * 0.30).toFixed(1));

      // 4. Nilai Training (10%)
      const empTrainingScores = trainingKpiScores.filter(t => {
        const d = new Date(t.updated_at || t.created_at || t.date || '');
        const matchesEmp = String(t.employee_id) === String(emp.id);
        const matchesPeriod = d.getMonth() + 1 === Number(filterMonth) && d.getFullYear() === Number(filterYear);
        return matchesEmp && matchesPeriod;
      });
      const trainingPct = empTrainingScores.length > 0
        ? Math.round(empTrainingScores.reduce((sum, t) => sum + (t.score || 0), 0) / empTrainingScores.length)
        : 80; // default 80 jika training kosong
      const weightedTraining = parseFloat((trainingPct * 0.10).toFixed(1));

      // 5. Skor Kuis (10%)
      const empQuizzes = quizResults.filter(q => {
        const d = new Date(q.tanggal_selesai || q.date || '');
        const matchesEmp = String(q.employee_id) === String(emp.id);
        const matchesPeriod = d.getMonth() + 1 === Number(filterMonth) && d.getFullYear() === Number(filterYear);
        return matchesEmp && matchesPeriod;
      });
      const quizPct = empQuizzes.length > 0
        ? Math.round(empQuizzes.reduce((sum, q) => sum + (q.skor || q.score || 0), 0) / empQuizzes.length)
        : 80; // default 80 jika kuis kosong
      const weightedQuiz = parseFloat((quizPct * 0.10).toFixed(1));

      // 6. Briefing Log (Khusus Kepala Cabang - 10% Bobot)
      const isKepalaCabang = String(emp.position || emp.jabatan || '').toLowerCase().trim().includes('kepala cabang');
      const briefingLogs = JSON.parse(localStorage.getItem('hris_briefing_logs') || '[]');
      const empBriefings = briefingLogs.filter(b => {
        const matchesEmp = String(b.employee_id) === String(emp.id);
        if (!matchesEmp) return false;
        const d = new Date(b.date);
        return d.getMonth() + 1 === Number(filterMonth) && d.getFullYear() === Number(filterYear) && b.completed;
      });
      const completedCount = empBriefings.length;
      const briefingPct = totalWorkingDays > 0 ? Math.min(100, Math.round((completedCount / totalWorkingDays) * 100)) : 0;

      let weightedAttendance, weightedDiscipline, weightedBriefing, finalScore;

      if (isKepalaCabang) {
        weightedAttendance = parseFloat((attendancePct * 0.20).toFixed(1));
        weightedDiscipline = parseFloat((disciplinePct * 0.20).toFixed(1));
        weightedBriefing = parseFloat((briefingPct * 0.10).toFixed(1));
        finalScore = parseFloat((weightedAttendance + weightedDiscipline + weightedSurvey + weightedTraining + weightedQuiz + weightedBriefing).toFixed(1));
      } else {
        weightedAttendance = parseFloat((attendancePct * 0.25).toFixed(1));
        weightedDiscipline = parseFloat((disciplinePct * 0.25).toFixed(1));
        weightedBriefing = 0;
        finalScore = parseFloat((weightedAttendance + weightedDiscipline + weightedSurvey + weightedTraining + weightedQuiz).toFixed(1));
      }

      return {
        id: emp.id,
        name: cap(emp.full_name || emp.nama || ''),
        outlet: emp.outlet,
        position: emp.position,
        attendancePct,
        weightedAttendance,
        disciplinePct,
        weightedDiscipline,
        surveyPct,
        weightedSurvey,
        trainingPct,
        weightedTraining,
        quizPct,
        weightedQuiz,
        isKepalaCabang,
        briefingPct,
        weightedBriefing,
        finalScore
      };
    });
  };

  // ─── Tab 4: Ranking & Leaderboard (Multi-Select Outlet) ───────────────────
  const getLeaderboardData = () => {
    // 1. Get global accumulated KPI
    // We calculate globally for active period
    const attLogs = JSON.parse(localStorage.getItem('hris_attendances_history') || localStorage.getItem('hris_attendance_history') || localStorage.getItem('attendance_logs') || '[]');
    const quizResults = JSON.parse(localStorage.getItem('quiz_results') || '[]');
    const trainingKpiScores = JSON.parse(localStorage.getItem('hris_training_kpi_scores') || localStorage.getItem('hris_training_results') || '[]');

    // Filter employees by multi-selected outlets
    let filteredEmployees = employees;
    if (!lbSelectedOutlets.includes('Semua Outlet')) {
      filteredEmployees = employees.filter(e => lbSelectedOutlets.includes(e.outlet));
    }

    const calculated = filteredEmployees.map(emp => {
      // Absensi
      const empAttLogs = attLogs.filter(l => {
        const d = new Date(l.date || '');
        return (String(l.employee_id) === String(emp.id) || l.nik === emp.nik) &&
               d.getMonth() + 1 === Number(lbMonth) && d.getFullYear() === Number(lbYear);
      });
      const outletLogs = attLogs.filter(l => {
        const d = new Date(l.date || '');
        return l.outlet === emp.outlet && d.getMonth() + 1 === Number(lbMonth) && d.getFullYear() === Number(lbYear);
      });
      const uniqueDates = [...new Set(outletLogs.map(l => l.date))];
      const totalWorkingDays = uniqueDates.length > 0 ? uniqueDates.length : 25;
      const presentDays = empAttLogs.filter(l => l.clock_in || l.status === 'Hadir' || l.status === 'Terlambat').length;
      const attendancePct = totalWorkingDays > 0 ? Math.min(100, Math.round((presentDays / totalWorkingDays) * 100)) : 0;

      // Disiplin
      const lateDays = empAttLogs.filter(l => l.status_in === 'late' || l.status === 'Terlambat' || (l.notes && /terlambat|late/i.test(l.notes))).length;
      const disciplinePct = presentDays > 0 ? Math.max(0, Math.round(100 - (lateDays / presentDays) * 100)) : 100;

      // Survei 360
      const empResponses = responses.filter(r => {
        return String(r.target_id) === String(emp.id) && r.month === Number(lbMonth) && r.year === Number(lbYear);
      });
      const surveyPct = empResponses.length > 0
        ? Math.round(empResponses.reduce((sum, r) => sum + (r.score || 0), 0) / empResponses.length)
        : 75;

      // Training
      const empTraining = trainingKpiScores.filter(t => {
        const d = new Date(t.updated_at || t.created_at || t.date || '');
        return String(t.employee_id) === String(emp.id) && d.getMonth() + 1 === Number(lbMonth) && d.getFullYear() === Number(lbYear);
      });
      const trainingPct = empTraining.length > 0
        ? Math.round(empTraining.reduce((sum, t) => sum + (t.score || 0), 0) / empTraining.length)
        : 80;

      // Quiz
      const empQuizzes = quizResults.filter(q => {
        const d = new Date(q.tanggal_selesai || q.date || '');
        return String(q.employee_id) === String(emp.id) && d.getMonth() + 1 === Number(lbMonth) && d.getFullYear() === Number(lbYear);
      });
      const quizPct = empQuizzes.length > 0
        ? Math.round(empQuizzes.reduce((sum, q) => sum + (q.skor || q.score || 0), 0) / empQuizzes.length)
        : 80;

      // Briefing Log (Khusus Kepala Cabang - 10% Bobot)
      const isKepalaCabang = String(emp.position || emp.jabatan || '').toLowerCase().trim().includes('kepala cabang');
      const briefingLogs = JSON.parse(localStorage.getItem('hris_briefing_logs') || '[]');
      const empBriefings = briefingLogs.filter(b => {
        const matchesEmp = String(b.employee_id) === String(emp.id);
        if (!matchesEmp) return false;
        const d = new Date(b.date);
        return d.getMonth() + 1 === Number(lbMonth) && d.getFullYear() === Number(lbYear) && b.completed;
      });
      const completedCount = empBriefings.length;
      const briefingPct = totalWorkingDays > 0 ? Math.min(100, Math.round((completedCount / totalWorkingDays) * 100)) : 0;

      let weightedAttendance, weightedDiscipline, finalScore;

      if (isKepalaCabang) {
        weightedAttendance = parseFloat((attendancePct * 0.20).toFixed(1));
        weightedDiscipline = parseFloat((disciplinePct * 0.20).toFixed(1));
        const weightedBriefing = parseFloat((briefingPct * 0.10).toFixed(1));
        finalScore = parseFloat((
          weightedAttendance + 
          weightedDiscipline + 
          (surveyPct * 0.30) + 
          (trainingPct * 0.10) + 
          (quizPct * 0.10) + 
          weightedBriefing
        ).toFixed(1));
      } else {
        weightedAttendance = parseFloat((attendancePct * 0.25).toFixed(1));
        weightedDiscipline = parseFloat((disciplinePct * 0.25).toFixed(1));
        finalScore = parseFloat((
          weightedAttendance + 
          weightedDiscipline + 
          (surveyPct * 0.30) + 
          (trainingPct * 0.10) + 
          (quizPct * 0.10)
        ).toFixed(1));
      }

      // Dynamic Bonus Recommendation
      let bonusRecommendation = '❌ Tidak Ada Bonus (Pembinaan)';
      if (finalScore >= 90) {
        bonusRecommendation = '👑 Rp 1.000.000 (Bonus Utama & Promosi)';
      } else if (finalScore >= 80) {
        bonusRecommendation = '💵 Rp 500.000 (Bonus Performa)';
      } else if (finalScore >= 75) {
        bonusRecommendation = '🪙 Rp 250.000 (Apresiasi Kinerja)';
      }

      return {
        id: emp.id,
        name: cap(emp.full_name || emp.nama || ''),
        outlet: emp.outlet,
        position: emp.position,
        finalScore,
        bonusRecommendation
      };
    });

    // Sort descending
    return calculated.sort((a, b) => b.finalScore - a.finalScore);
  };

  const toggleLbOutlet = (outName) => {
    if (outName === 'Semua Outlet') {
      setLbSelectedOutlets(['Semua Outlet']);
      return;
    }
    
    let current = lbSelectedOutlets.filter(o => o !== 'Semua Outlet');
    if (current.includes(outName)) {
      current = current.filter(o => o !== outName);
    } else {
      current.push(outName);
    }

    if (current.length === 0) {
      setLbSelectedOutlets(['Semua Outlet']);
    } else {
      setLbSelectedOutlets(current);
    }
  };

  // Get options lists
  const outletsList = ['Semua Outlet', ...new Set(employees.map(e => e.outlet).filter(Boolean))];
  const monthsList = [
    { value: 1, label: 'Januari' },
    { value: 2, label: 'Februari' },
    { value: 3, label: 'Maret' },
    { value: 4, label: 'April' },
    { value: 5, label: 'Mei' },
    { value: 6, label: 'Juni' },
    { value: 7, label: 'Juli' },
    { value: 8, label: 'Agustus' },
    { value: 9, label: 'September' },
    { value: 10, label: 'Oktober' },
    { value: 11, label: 'November' },
    { value: 12, label: 'Desember' }
  ];
  const yearsList = Array.from({ length: 21 }, (_, i) => 2020 + i).reverse();

  // Data bindings for tables
  const hasil360Rows = getEvaluasi360Summary();
  const kpiAkumulatifRows = getKpiAkumulatifGlobal();
  const leaderboardRows = getLeaderboardData();

  const handleExportPDF = () => {
    setIsExportingPDF(true);
    setTimeout(() => {
      try {
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

        const kpiAccumulativeRowsWithBriefing = (rows) => rows.map(row => [
          cap(row.name),
          cap(row.outlet),
          cap(row.position),
          `${row.attendancePct}% (+${row.weightedAttendance} Poin)`,
          `${row.disciplinePct}% (+${row.weightedDiscipline} Poin)`,
          `${row.surveyPct} Poin (+${row.weightedSurvey} Poin)`,
          `${row.trainingPct} Poin (+${row.weightedTraining} Poin)`,
          `${row.quizPct} Poin (+${row.weightedQuiz} Poin)`,
          row.isKepalaCabang ? `${row.briefingPct}% (+${row.weightedBriefing} Poin)` : '—',
          `${row.finalScore} Poin`
        ]);

        const writeHeader = (titleText) => {
          doc.setFillColor(0, 0, 0);
          doc.rect(0, 0, 297, 38, 'F');

          doc.setTextColor(255, 255, 255);
          doc.setFontSize(16);
          doc.setFont('helvetica', 'bold');
          doc.text(cap(titleText), 14, 14);

          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(180, 180, 180);
          doc.text(cap(`HRIS Barokah Grup - Modul Evaluasi & Observer Kinerja`), 14, 22);
          doc.text(cap(`Dicetak: ${new Date().toLocaleString('id-ID')}`), 14, 28);
        };

        // PAGE 1: HASIL EVALUASI 360°
        writeHeader('LAPORAN HASIL EVALUASI 360');
        const table360Data = hasil360Rows.map(row => [
          cap(row.name),
          cap(row.outlet),
          cap(row.position),
          row.avgStaf !== null ? `${row.avgStaf} Poin` : '—',
          row.avgLeader !== null ? `${row.avgLeader} Poin` : '—',
          `${row.totalResponders} Responden`,
          `${row.finalScore}/100`
        ]);

        autoTable(doc, {
          startY: 42,
          head: [[cap('Nama Karyawan'), cap('Outlet'), cap('Jabatan'), cap('Rataan Skor Peer'), cap('Rataan Skor Leader'), cap('Total Responden'), cap('Skor Akhir')]],
          body: table360Data,
          theme: 'grid',
          styles: { fontSize: 8, cellPadding: 3 },
          headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
        });

        // PAGE 2: STANDINGS KPI STAF
        doc.addPage();
        writeHeader('LAPORAN STANDINGS KPI STAF');
        const tableKpiData = kpiAccumulativeRowsWithBriefing(kpiAkumulatifRows);

        autoTable(doc, {
          startY: 42,
          head: [[cap('Nama Karyawan'), cap('Outlet'), cap('Jabatan'), cap('Absensi (25%*)'), cap('Disiplin (25%*)'), cap('Survei 360 (30%)'), cap('Training (10%)'), cap('Kuis (10%)'), cap('Briefing (10%*)'), cap('Final Score KPI')]],
          body: tableKpiData,
          theme: 'grid',
          styles: { fontSize: 7.5, cellPadding: 2.5 },
          headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        });

        // PAGE 3: LEADERBOARD PERFORMA
        doc.addPage();
        writeHeader('LAPORAN KLASEMEN LEADERBOARD PERFORMA');
        const tableLbData = leaderboardRows.map(row => [
          cap(row.name),
          cap(row.outlet),
          cap(row.position),
          `${row.finalScore}/100`,
          cap(row.bonusRecommendation)
        ]);

        autoTable(doc, {
          startY: 42,
          head: [[cap('Nama Staf'), cap('Outlet'), cap('Jabatan'), cap('Skor KPI'), cap('Rekomendasi Bonus Insentif')]],
          body: tableLbData,
          theme: 'grid',
          styles: { fontSize: 8, cellPadding: 3 },
          headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
        });

        doc.save(`Laporan_Evaluasi_KPI_${new Date().toISOString().slice(0, 10)}.pdf`);
      } catch (err) {
        console.error('PDF generation error:', err);
      } finally {
        setIsExportingPDF(false);
        // Reset filters
        setFilterMonth(6);
        setFilterYear(2026);
        setFilterOutlet('Semua Outlet');
        setLbSelectedOutlets(['Semua Outlet']);
        setLbMonth(6);
        setLbYear(2026);
      }
    }, 200);
  };


  return (
    <div style={{ padding: '24px', background: C.bg, minHeight: '100vh', color: C.text, fontFamily: 'system-ui, sans-serif' }}>
      
      {/* CSS custom keyframe animations */}
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
        .tab-btn {
          background: ${C.surface};
          border: 1px solid ${C.border};
          color: ${C.muted};
          padding: 12px 20px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s ease;
        }
        .tab-btn:hover {
          color: ${C.text};
          border-color: ${C.cyanBorder};
        }
        .tab-btn.active {
          background: ${C.cyanDim};
          border-color: ${C.cyan};
          color: ${C.cyan};
          box-shadow: 0 0 12px rgba(0, 173, 181, 0.15);
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
          box-shadow: 0 0 8px rgba(0, 173, 181, 0.2);
        }
        .action-btn {
          padding: 8px 12px;
          border-radius: 6px;
          border: 1px solid transparent;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.15s ease;
        }
        .btn-cyan {
          background: ${C.cyan};
          color: ${C.bg};
        }
        .btn-cyan:hover {
          background: #00c2cb;
          box-shadow: 0 0 12px rgba(0, 173, 181, 0.3);
        }
        .btn-danger-dim {
          background: ${C.dangerDim};
          border-color: ${C.dangerBorder};
          color: ${C.danger};
        }
        .btn-danger-dim:hover {
          background: ${C.danger};
          color: ${C.text};
        }
        .kpi-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 12px;
        }
        .kpi-table th {
          background: rgba(0, 0, 0, 0.15);
          color: ${C.muted};
          font-weight: 700;
          font-size: 0.78rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 14px 16px;
          border-bottom: 2px solid ${C.border};
          text-align: left;
        }
        .kpi-table td {
          padding: 16px;
          border-bottom: 1px solid ${C.border};
          font-size: 0.88rem;
        }
        .kpi-table tbody tr {
          transition: background-color 0.15s ease;
        }
        .kpi-table tbody tr:hover {
          background: rgba(238, 238, 238, 0.02);
        }
        .outlet-pill {
          padding: 8px 16px;
          border-radius: 20px;
          background: ${C.surface};
          border: 1px solid ${C.border};
          color: ${C.muted};
          cursor: pointer;
          font-size: 0.8rem;
          font-weight: 700;
          transition: all 0.2s ease;
        }
        .outlet-pill.active {
          background: ${C.cyanDim};
          border-color: ${C.cyan};
          color: ${C.cyan};
          box-shadow: 0 0 8px rgba(0, 173, 181, 0.2);
        }
      `}</style>

      {/* HEADER PORTAL */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: `1.5px solid ${C.border}`, paddingBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: C.cyan, display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
            🛡️ HRIS Barokah Grup — Ultimate KPI &amp; 360 Observer
          </h1>
          <p style={{ color: C.muted, fontSize: '0.84rem', marginTop: '4px' }}>Modul Evaluasi Kinerja Karyawan &amp; Pemeringkatan Global Multi-Outlet</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: C.surface, padding: '4px 6px', borderRadius: '10px', border: `1px solid ${C.border}` }}>
            <button className={`tab-btn ${activeTab === 'survei-form' ? 'active' : ''}`} onClick={() => setActiveTab('survei-form')}>
              📋 Command Center
            </button>
            <button className={`tab-btn ${activeTab === 'hasil-survei' ? 'active' : ''}`} onClick={() => setActiveTab('hasil-survei')}>
              📊 Hasil 360°
            </button>
            <button className={`tab-btn ${activeTab === 'kpi-akumulatif' ? 'active' : ''}`} onClick={() => setActiveTab('kpi-akumulatif')}>
              🧠 Brain Engine
            </button>
            <button className={`tab-btn ${activeTab === 'leaderboard' ? 'active' : ''}`} onClick={() => setActiveTab('leaderboard')}>
              🏆 Leaderboard
            </button>
          </div>
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

      {/* ─── SUMMARY CARDS BAR (4 Metrics Spesifikasi) ─── */}
      {(() => {
        const kpiRows = kpiAkumulatifRows;
        const avgKpiGlobal = kpiRows.length > 0
          ? parseFloat((kpiRows.reduce((s, r) => s + (r.finalScore || 0), 0) / kpiRows.length).toFixed(1))
          : 0;
        const stafBawahTarget = kpiRows.filter(r => r.finalScore < 75).length;
        const totalSurveiDikirim = surveys.length;
        const totalResponden = responses.length;
        const partisipasiPct = totalSurveiDikirim > 0 && employees.length > 0
          ? Math.min(100, Math.round((totalResponden / Math.max(1, employees.length * totalSurveiDikirim)) * 100))
          : 0;

        // ⚡ Publish ke localStorage untuk Dashboard
        try {
          const kpiCardSummary = { avgKpiGlobal, stafBawahTarget, totalSurveiDikirim, totalResponden, partisipasiPct, updatedAt: new Date().toISOString() };
          localStorage.setItem('hris_kpi_card_summary', JSON.stringify(kpiCardSummary));
          window.dispatchEvent(new CustomEvent('hris:storage', { detail: { key: 'hris_kpi_card_summary' } }));
        } catch(e) {}

        const summCards = [
          {
            id: 'avg-kpi-global', icon: '🎯',
            label: 'Rataan Nilai KPI Global',
            value: `${avgKpiGlobal}`, unit: '/ 100',
            sub: avgKpiGlobal >= 85 ? 'Performa Sangat Baik ✅' : avgKpiGlobal >= 75 ? 'Performa Baik' : 'Perlu Perhatian ⚠️',
            color: avgKpiGlobal >= 85 ? C.success : avgKpiGlobal >= 75 ? C.cyan : C.danger,
          },
          {
            id: 'staf-bawah-target', icon: '⚠️',
            label: 'Staf Di Bawah Target KPI',
            value: `${stafBawahTarget}`, unit: 'Orang',
            sub: stafBawahTarget === 0 ? 'Semua di atas standar ✅' : 'KPI < 75 — perlu coaching',
            color: stafBawahTarget === 0 ? C.success : C.danger,
          },
          {
            id: 'total-survei-360', icon: '📩',
            label: 'Total Survei 360° Terkirim',
            value: `${totalSurveiDikirim}`, unit: 'Instrumen',
            sub: `${totalResponden} respons diterima`,
            color: '#9b59b6',
          },
          {
            id: 'partisipasi-responden', icon: '📊',
            label: 'Partisipasi Responden',
            value: `${partisipasiPct}`, unit: '%',
            sub: partisipasiPct >= 80 ? 'Tinggi ✅' : partisipasiPct >= 50 ? 'Cukup' : 'Rendah',
            color: partisipasiPct >= 80 ? C.success : partisipasiPct >= 50 ? C.warn : C.danger,
          },
        ];

        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '24px' }}>
            {summCards.map(card => (
              <div key={card.id} style={{
                background: `linear-gradient(135deg, ${C.surface}, ${C.bg})`,
                border: `1px solid ${card.color}33`, borderRadius: '14px', padding: '16px 18px',
                position: 'relative', overflow: 'hidden',
                transition: 'transform 0.2s ease',
              }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: `linear-gradient(90deg, ${card.color}, ${card.color}44)`, borderRadius: '14px 14px 0 0' }} />
                <div style={{ position: 'absolute', bottom: -20, right: -20, width: 60, height: 60, borderRadius: '50%', background: `${card.color}18`, filter: 'blur(18px)', pointerEvents: 'none' }} />
                <div style={{ fontSize: '1.4rem', marginBottom: '10px' }}>{card.icon}</div>
                <div style={{ fontSize: '0.65rem', fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>{card.label}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                  <span style={{ fontSize: '1.8rem', fontWeight: 900, color: card.color, lineHeight: 1 }}>{card.value}</span>
                  <span style={{ fontSize: '0.8rem', color: card.color, fontWeight: 700, opacity: 0.7 }}>{card.unit}</span>
                </div>
                <div style={{ fontSize: '0.65rem', color: C.muted, fontWeight: 500, marginTop: '5px' }}>{card.sub}</div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* =======================================================================
          TAB 1: FORM & KELOLA SURVEI 360 (COMMAND CENTER SURVEI)
          ======================================================================= */}
      {activeTab === 'survei-form' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.9fr', gap: '24px', alignItems: 'start' }}>
          
          {/* FORM KIRIM SURVEI */}
          <div style={{ background: C.surface, borderRadius: '14px', border: `1.5px solid ${C.cyanBorder}`, padding: '24px', boxShadow: '0 4px 30px rgba(0,0,0,0.15)' }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '18px', color: C.cyan, display: 'flex', alignItems: 'center', gap: '8px' }}>
              🚀 Kirim Instrumen Survei Baru
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: C.muted, fontWeight: 700, marginBottom: '6px' }}>JUDUL SURVEI</label>
                <input type="text" className="form-input" placeholder="Misal: Evaluasi Pelayanan Q2 Staf" value={judulSurvei} onChange={e => setJudulSurvei(e.target.value)} />
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: C.muted, fontWeight: 700, marginBottom: '6px' }}>TIPE PAKET SOAL</label>
                <select className="form-select" value={tipePaket} onChange={e => setTipePaket(e.target.value)}>
                  <option value="staf">👥 Paket Soal Karyawan (Staff Peer-to-Peer)</option>
                  <option value="leader">👑 Paket Soal Leader (Feedback Lintas Jabatan)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: C.muted, fontWeight: 700, marginBottom: '6px' }}>TARGET OUTLET DISTRIBUSI</label>
                <select className="form-select" value={targetOutlet} onChange={e => setTargetOutlet(e.target.value)}>
                  {outletsList.map(o => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: C.muted, fontWeight: 700, marginBottom: '6px' }}>TANGGAL PENGIRIMAN</label>
                <input type="date" className="form-input" value={tanggalKirim} onChange={e => setTanggalKirim(e.target.value)} />
              </div>

              <div style={{ marginTop: '10px', background: 'rgba(0,173,181,0.06)', borderRadius: '10px', border: `1px dashed ${C.cyanBorder}`, padding: '12px' }}>
                <span style={{ fontSize: '0.72rem', color: C.cyan, fontWeight: 700, display: 'block', marginBottom: '4px' }}>ℹ️ MATRIKS LOGIKA TARGET JABATAN:</span>
                <p style={{ margin: 0, fontSize: '0.75rem', color: C.muted, lineHeight: '1.4' }}>
                  {tipePaket === 'staf' 
                    ? '• Karyawan biasa di outlet target akan otomatis saling menilai satu sama lain (Peer-to-Peer).' 
                    : '• Kepala Cabang dinilai oleh seluruh kru outlet.\n• Kepala Produksi dinilai Koki, Helper, Bartender.\n• Kepala Layanan dinilai Kasir & Waiters.'}
                </p>
              </div>

              <button className="action-btn btn-cyan" style={{ justifyContent: 'center', width: '100%', padding: '12px', marginTop: '10px' }} onClick={handleKirimSurvei} disabled={!judulSurvei.trim()}>
                🚀 Kirim & Siarkan Survei ke HP Target ({getTargetEmployeesForSurvey(tipePaket, targetOutlet).length} Orang)
              </button>
            </div>
          </div>

          {/* TRACKER STATUS PENGIRIMAN */}
          <div style={{ background: C.surface, borderRadius: '14px', border: `1px solid ${C.border}`, padding: '24px' }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              📋 Tracker Status Pengiriman Survei
            </h2>
            {surveys.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', border: `1px dashed ${C.border}`, borderRadius: '10px' }}>
                <Clipboard size={40} color={C.muted} style={{ marginBottom: '12px' }} />
                <p style={{ color: C.muted, margin: 0, fontSize: '0.84rem' }}>Belum ada survei yang didistribusikan. Kirim survei baru di sebelah kiri.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="kpi-table">
                  <thead>
                    <tr>
                      <th>TANGGAL KIRIM</th>
                      <th>JUDUL SURVEI</th>
                      <th>TIPE PAKET</th>
                      <th>TARGET OUTLET</th>
                      <th>KETERANGAN PENERIMA</th>
                      <th style={{ textAlign: 'center' }}>AKSI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {surveys.map(s => (
                      <tr key={s.id}>
                        <td style={{ fontWeight: 600 }}>{s.tanggal_kirim}</td>
                        <td style={{ color: C.cyan, fontWeight: 700 }}>{s.judul}</td>
                        <td>
                          <span style={{ padding: '3px 8px', borderRadius: '4px', background: s.tipe_paket === 'leader' ? 'rgba(245,166,35,0.15)' : 'rgba(78,205,196,0.15)', color: s.tipe_paket === 'leader' ? C.warn : C.success, fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase' }}>
                            {s.tipe_paket === 'leader' ? '👑 Leader' : '👥 Staf'}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{s.outlet}</td>
                        <td style={{ fontWeight: 700, color: C.success }}>
                          🟢 {s.penerima_count} Karyawan Telah Menerima
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button className="action-btn btn-danger-dim" style={{ padding: '6px 10px', margin: '0 auto' }} onClick={() => handleHapusSurvei(s.id)}>
                            <Trash2 size={13} /> Hapus
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =======================================================================
          TAB 2: HASIL EVALUASI SURVEI 360 (DATA REVENUE STORAGE)
          ======================================================================= */}
      {activeTab === 'hasil-survei' && (
        <div>
          {/* HEADER FILTER REAKTIF */}
          <div style={{ display: 'flex', gap: '16px', background: C.surface, padding: '20px', borderRadius: '12px', border: `1px solid ${C.border}`, marginBottom: '24px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: C.cyan, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              ⚡ Filter Reaktif:
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr', gap: '12px', flex: 1 }}>
              <select className="form-select" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
                {monthsList.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              <select className="form-select" value={filterYear} onChange={e => setFilterYear(e.target.value)}>
                {yearsList.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <select className="form-select" value={filterOutlet} onChange={e => setFilterOutlet(e.target.value)}>
                {outletsList.map(o => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
          </div>

          {/* TABEL HASIL EVALUASI */}
          <div style={{ background: C.surface, borderRadius: '14px', border: `1px solid ${C.border}`, padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
                📊 Akumulasi Skor Evaluasi 360°
              </h2>
              <span style={{ fontSize: '0.8rem', color: C.muted }}>
                Bulan: <strong>{monthsList.find(m=>m.value === Number(filterMonth))?.label} {filterYear}</strong> • Outlet: <strong>{filterOutlet}</strong>
              </span>
            </div>

            {hasil360Rows.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px' }}>
                <ShieldAlert size={40} color={C.muted} style={{ marginBottom: '12px' }} />
                <p style={{ color: C.muted, margin: 0, fontSize: '0.84rem' }}>Tidak ditemukan data penilaian 360° pada periode dan outlet ini.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="kpi-table">
                  <thead>
                    <tr>
                      <th>NAMA KARYAWAN & OUTLET</th>
                      <th>JABATAN</th>
                      <th style={{ textAlign: 'center' }}>RATAAN SKOR KARYAWAN (PEER)</th>
                      <th style={{ textAlign: 'center' }}>RATAAN SKOR LEADER</th>
                      <th style={{ textAlign: 'center' }}>TOTAL RESPONDEN MENILAI</th>
                      <th style={{ textAlign: 'center', color: C.cyan }}>NILAI KONVERSI AKHIR (100)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hasil360Rows.map(row => (
                      <tr key={row.employee_id}>
                        <td>
                          <div style={{ fontWeight: 700, color: C.text }}>{row.name}</div>
                          <div style={{ fontSize: '0.72rem', color: C.muted, marginTop: '2px' }}>📍 {row.outlet}</div>
                        </td>
                        <td style={{ textTransform: 'capitalize', fontWeight: 600 }}>{row.position}</td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: row.avgStaf ? C.success : C.muted }}>
                          {row.avgStaf !== null ? `${row.avgStaf} Poin` : '—'}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: row.avgLeader ? C.warn : C.muted }}>
                          {row.avgLeader !== null ? `${row.avgLeader} Poin` : '—'}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>
                          👥 {row.totalResponders} Responden
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ padding: '6px 12px', borderRadius: '20px', background: `${C.cyan}18`, border: `1.5px solid ${C.cyanBorder}`, color: C.cyan, fontWeight: 800, fontSize: '0.9rem' }}>
                            {row.finalScore} / 100
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =======================================================================
          TAB 3: REKAPAN KPI AKUMULATIF GLOBAL (THE BRAIN ENGINE)
          ======================================================================= */}
      {activeTab === 'kpi-akumulatif' && (
        <div>
          {/* HEADER FILTER REAKTIF */}
          <div style={{ display: 'flex', gap: '16px', background: C.surface, padding: '20px', borderRadius: '12px', border: `1px solid ${C.border}`, marginBottom: '24px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: C.cyan, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              🧠 Filter Brain Engine:
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr', gap: '12px', flex: 1 }}>
              <select className="form-select" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
                {monthsList.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              <select className="form-select" value={filterYear} onChange={e => setFilterYear(e.target.value)}>
                {yearsList.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <select className="form-select" value={filterOutlet} onChange={e => setFilterOutlet(e.target.value)}>
                {outletsList.map(o => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
          </div>

          {/* TABLE REKAPAN GLOBAL */}
          <div style={{ background: C.surface, borderRadius: '14px', border: `1px solid ${C.border}`, padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
                  🧠 Lembar Rekapitulasi KPI Lintas Modul
                </h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: C.muted }}>
                  Berdasarkan formula: <strong>Absensi (25%) + Keterlambatan (25%) + Survei 360 (30%) + Training (10%) + Kuis (10%)</strong>
                </p>
              </div>
              <span style={{ fontSize: '0.75rem', padding: '6px 12px', borderRadius: '6px', background: C.dangerDim, color: C.danger, border: `1px solid ${C.dangerBorder}`, fontWeight: 700 }}>
                ⚠️ Alarm KPI &lt; 75 Aktif
              </span>
            </div>

            {kpiAkumulatifRows.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px' }}>
                <ShieldAlert size={40} color={C.muted} style={{ marginBottom: '12px' }} />
                <p style={{ color: C.muted, margin: 0, fontSize: '0.84rem' }}>Tidak ditemukan data karyawan pada filter ini.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="kpi-table">
                  <thead>
                    <tr>
                      <th>NAMA KARYAWAN & OUTLET</th>
                      <th>JABATAN</th>
                      <th style={{ textAlign: 'center' }}>ABSENSI (25%*)</th>
                      <th style={{ textAlign: 'center' }}>DISIPLIN (25%*)</th>
                      <th style={{ textAlign: 'center' }}>SURVEI 360 (30%)</th>
                      <th style={{ textAlign: 'center' }}>TRAINING (10%)</th>
                      <th style={{ textAlign: 'center' }}>KUIS (10%)</th>
                      <th style={{ textAlign: 'center' }}>BRIEFING (10%*)</th>
                      <th style={{ textAlign: 'center', color: C.cyan }}>FINAL SCORE KPI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kpiAkumulatifRows.map(row => {
                      const isAlarm = row.finalScore < 75;
                      return (
                        <tr key={row.id} style={{ background: isAlarm ? C.dangerDim : 'transparent' }}>
                          <td>
                            {isAlarm ? (
                              <span style={{ background: C.danger, color: '#FFFFFF', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.88rem', display: 'inline-block' }}>
                                🚨 {row.name}
                              </span>
                            ) : (
                              <div style={{ fontWeight: 700 }}>{row.name}</div>
                            )}
                            <div style={{ fontSize: '0.72rem', color: C.muted, marginTop: '3px' }}>📍 {row.outlet}</div>
                          </td>
                          <td style={{ textTransform: 'capitalize', fontWeight: 600 }}>
                            {row.position}
                            {row.isKepalaCabang && (
                              <button
                                onClick={() => handleOpenBriefingModal(row.id, row.name)}
                                style={{
                                  display: 'block',
                                  marginTop: '6px',
                                  padding: '4px 8px',
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  background: 'rgba(59, 130, 246, 0.1)',
                                  border: '1.5px solid rgba(59, 130, 246, 0.3)',
                                  borderRadius: '6px',
                                  color: '#3B82F6',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s'
                                }}
                                onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)' }}
                                onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)' }}
                              >
                                📝 Briefing Log
                              </button>
                            )}
                          </td>
                          
                          {/* Absensi */}
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ fontWeight: 700 }}>{row.attendancePct}%</div>
                            <div style={{ fontSize: '0.68rem', color: C.muted }}>
                              +{row.weightedAttendance} Poin
                              {row.isKepalaCabang && <span style={{ display: 'block', fontSize: '0.6rem', color: C.cyan }}>(Bobot 20%)</span>}
                            </div>
                          </td>

                          {/* Disiplin */}
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ fontWeight: 700 }}>{row.disciplinePct}%</div>
                            <div style={{ fontSize: '0.68rem', color: C.muted }}>
                              +{row.weightedDiscipline} Poin
                              {row.isKepalaCabang && <span style={{ display: 'block', fontSize: '0.6rem', color: C.cyan }}>(Bobot 20%)</span>}
                            </div>
                          </td>

                          {/* Survei 360 */}
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ fontWeight: 700 }}>{row.surveyPct} Poin</div>
                            <div style={{ fontSize: '0.68rem', color: C.muted }}>+{row.weightedSurvey} Poin</div>
                          </td>

                          {/* Training */}
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ fontWeight: 700 }}>{row.trainingPct} Poin</div>
                            <div style={{ fontSize: '0.68rem', color: C.muted }}>+{row.weightedTraining} Poin</div>
                          </td>

                          {/* Kuis */}
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ fontWeight: 700 }}>{row.quizPct} Poin</div>
                            <div style={{ fontSize: '0.68rem', color: C.muted }}>+{row.weightedQuiz} Poin</div>
                          </td>

                          {/* Briefing */}
                          <td style={{ textAlign: 'center' }}>
                            {row.isKepalaCabang ? (
                              <>
                                <div style={{ fontWeight: 700 }}>{row.briefingPct}%</div>
                                <div style={{ fontSize: '0.68rem', color: C.muted }}>+{row.weightedBriefing} Poin</div>
                              </>
                            ) : (
                              <div style={{ color: C.muted, fontSize: '0.78rem' }}>—</div>
                            )}
                          </td>

                          {/* Final Score */}
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ 
                              padding: '6px 14px', 
                              borderRadius: '20px', 
                              background: isAlarm ? C.danger : `${C.success}18`, 
                              border: `1.5px solid ${isAlarm ? C.danger : C.cyan}`, 
                              color: isAlarm ? '#FFFFFF' : C.success, 
                              fontWeight: 900, 
                              fontSize: '0.94rem' 
                            }}>
                              {row.finalScore} Poin
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ marginTop: '16px', padding: '12px', background: C.bg, borderRadius: '8px', border: `1px solid ${C.border}`, fontSize: '0.74rem', color: C.muted, lineHeight: '1.4' }}>
              💡 <strong>Keterangan Bobot Formula:</strong>
              <ul style={{ margin: '4px 0 0 0', paddingLeft: '16px' }}>
                <li><strong>Karyawan / Staf Biasa:</strong> Absensi (25%) + Disiplin (25%) + Survei 360 (30%) + Training (10%) + Kuis (10%)</li>
                <li><strong>Kepala Cabang:</strong> Absensi (20%) + Disiplin (20%) + Survei 360 (30%) + Training (10%) + Kuis (10%) + Kegiatan Briefing (10%)</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          TAB 4: RANKING PRESTASI TERTINGGI (LEADERBOARD SYSTEM)
          ======================================================================= */}
      {activeTab === 'leaderboard' && (
        <div>
          {/* HEADER MULTI-SELECT OUTLET & PERIOD */}
          <div style={{ background: C.surface, padding: '24px', borderRadius: '14px', border: `1px solid ${C.border}`, marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: C.cyan, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                🏆 Filter Leaderboard (Multi-Select Outlet)
              </span>
              <div style={{ display: 'flex', gap: '10px' }}>
                <select className="form-select" style={{ width: '140px', padding: '6px 10px' }} value={lbMonth} onChange={e => setLbMonth(e.target.value)}>
                  {monthsList.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
                <select className="form-select" style={{ width: '100px', padding: '6px 10px' }} value={lbYear} onChange={e => setLbYear(e.target.value)}>
                  {yearsList.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
              {outletsList.map(o => {
                const isSelected = lbSelectedOutlets.includes(o);
                return (
                  <button
                    key={o}
                    onClick={() => toggleLbOutlet(o)}
                    style={{
                      background: isSelected ? `${C.cyan}18` : C.surface,
                      border: `1.5px solid ${isSelected ? C.cyan : C.border}`,
                      color: isSelected ? C.cyan : C.muted,
                      borderRadius: '8px',
                      padding: '6px 14px',
                      cursor: 'pointer',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {o === 'Semua Outlet' ? '🌐 Semua Outlet' : `📍 ${o}`}
                  </button>
                );
              })}
            </div>
          </div>

          {/* LEADERBOARD TABLE dengan Pagination & PDF Download */}
          <div style={{ background: C.surface, borderRadius: '14px', border: `1px solid ${C.border}`, padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: C.cyan, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                🏆 Klasemen Performa Karyawan Barokah Grup
              </h2>
            </div>
            
            {leaderboardRows.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px' }}>
                <ShieldAlert size={40} color={C.muted} style={{ marginBottom: '12px' }} />
                <p style={{ color: C.muted, margin: 0, fontSize: '0.84rem' }}>Tidak ditemukan data penilaian performa pada kriteria saringan ini.</p>
              </div>
            ) : (() => {
              const LB_PAGE_SIZE = 10;
              const totalLbPages = Math.ceil(leaderboardRows.length / LB_PAGE_SIZE);
              const paginatedRows = leaderboardRows.slice((lbPage - 1) * LB_PAGE_SIZE, lbPage * LB_PAGE_SIZE);
              const startIndex = (lbPage - 1) * LB_PAGE_SIZE;

              return (
                <div>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="kpi-table">
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'center', width: '90px' }}>PERINGKAT</th>
                          <th>NAMA STAF &amp; CABANG</th>
                          <th>JABATAN</th>
                          <th style={{ textAlign: 'center' }}>TOTAL POIN AKHIR KPI</th>
                          <th>REKOMENDASI BONUS INSENTIF</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedRows.map((row, idx) => {
                          const rank = startIndex + idx + 1;
                          let rankBadge = null;
                          if (rank === 1) rankBadge = (<span style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)', color: '#222831', padding: '6px 14px', borderRadius: '20px', fontWeight: 900, fontSize: '0.78rem', boxShadow: '0 0 10px rgba(255,215,0,0.3)' }}>🥇 1st Gold</span>);
                          else if (rank === 2) rankBadge = (<span style={{ background: 'linear-gradient(135deg, #C0C0C0, #808080)', color: '#222831', padding: '6px 14px', borderRadius: '20px', fontWeight: 900, fontSize: '0.78rem' }}>🥈 2nd Silver</span>);
                          else if (rank === 3) rankBadge = (<span style={{ background: 'linear-gradient(135deg, #CD7F32, #8B4513)', color: '#FFFFFF', padding: '6px 14px', borderRadius: '20px', fontWeight: 900, fontSize: '0.78rem' }}>🥉 3rd Bronze</span>);
                          else rankBadge = (<span style={{ fontWeight: 800, color: C.muted }}>#{rank}</span>);

                          return (
                            <tr key={row.id}>
                              <td style={{ textAlign: 'center' }}>{rankBadge}</td>
                              <td>
                                <div style={{ fontWeight: 700, color: C.text }}>{row.name}</div>
                                <div style={{ fontSize: '0.72rem', color: C.muted, marginTop: '2px' }}>📍 {row.outlet}</div>
                              </td>
                              <td style={{ textTransform: 'capitalize', fontWeight: 600 }}>{row.position}</td>
                              <td style={{ textAlign: 'center' }}>
                                <span style={{ padding: '6px 12px', borderRadius: '8px', background: `${C.cyan}12`, border: `1px solid ${C.cyanBorder}`, color: C.cyan, fontWeight: 900, fontSize: '0.88rem' }}>
                                  {row.finalScore} / 100
                                </span>
                              </td>
                              <td style={{ fontWeight: 700, color: row.finalScore >= 75 ? C.success : C.danger }}>
                                {row.bonusRecommendation}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {totalLbPages > 1 && (
                    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:'8px', marginTop:'16px' }}>
                      <button onClick={() => setLbPage(p => Math.max(1, p-1))} disabled={lbPage===1}
                        style={{ background: lbPage===1 ? C.surface : C.cyanDim, border:`1px solid ${lbPage===1 ? C.border : C.cyanBorder}`, color: lbPage===1 ? C.muted : C.cyan, borderRadius:'8px', padding:'6px 14px', cursor: lbPage===1 ? 'not-allowed' : 'pointer', fontWeight:700, fontSize:'0.82rem' }}>
                        &laquo; Prev
                      </button>
                      <span style={{ color: C.muted, fontSize:'0.82rem' }}>{lbPage} / {totalLbPages}</span>
                      <button onClick={() => setLbPage(p => Math.min(totalLbPages, p+1))} disabled={lbPage===totalLbPages}
                        style={{ background: lbPage===totalLbPages ? C.surface : C.cyanDim, border:`1px solid ${lbPage===totalLbPages ? C.border : C.cyanBorder}`, color: lbPage===totalLbPages ? C.muted : C.cyan, borderRadius:'8px', padding:'6px 14px', cursor: lbPage===totalLbPages ? 'not-allowed' : 'pointer', fontWeight:700, fontSize:'0.82rem' }}>
                        Next &raquo;
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* =======================================================================
          MODAL 1: DOUBLE CONFIRMATION SURVEI - TAHAP 1
          ======================================================================= */}
      {showConfirm1 && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
          <div style={{ background: C.surface, borderRadius: '16px', border: `1.5px solid ${C.cyan}`, padding: '30px', width: '480px', maxWidth: '90vw', textAlign: 'center', boxShadow: '0 0 40px rgba(0,173,181,0.25)' }}>
            <AlertTriangle size={48} color={C.warn} style={{ marginBottom: '16px' }} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '12px', color: '#fff' }}>
              🤖 Konfirmasi Pengiriman Survei
            </h3>
            <p style={{ color: C.muted, fontSize: '0.86rem', lineHeight: '1.5', marginBottom: '24px' }}>
              Apakah Anda benar-benar yakin ingin mempublikasikan instrumen survei <strong>"{judulSurvei}"</strong>? 
              Tindakan ini akan mendistribusikan survei secara real-time ke HP masing-masing karyawan target.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button className="action-btn" style={{ background: 'transparent', border: `1.5px solid ${C.border}`, color: C.muted }} onClick={() => setShowConfirm1(false)}>
                Batal
              </button>
              <button className="action-btn btn-cyan" onClick={() => { setShowConfirm1(false); setShowConfirm2(true); }}>
                Lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          MODAL 2: DOUBLE CONFIRMATION SURVEI - TAHAP 2 (LINTAS JABATAN)
          ======================================================================= */}
      {showConfirm2 && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
          <div style={{ background: C.surface, borderRadius: '16px', border: `2px solid ${C.cyan}`, padding: '30px', width: '480px', maxWidth: '90vw', textAlign: 'center', boxShadow: '0 0 50px rgba(0,173,181,0.35)' }}>
            <Sparkles size={48} color={C.cyan} style={{ marginBottom: '16px' }} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '12px', color: '#fff' }}>
              ⚡ Mulai Distribusi Otomatis Lintas Jabatan
            </h3>
            <p style={{ color: C.muted, fontSize: '0.86rem', lineHeight: '1.5', marginBottom: '24px' }}>
              Sistem akan menjalankan pembagian matriks relasi penilai otomatis lintas jabatan. 
              Data mock hasil pengisian kuis survei HP akan langsung digenerasikan secara otonom. Klik OK untuk menyiarkan.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button className="action-btn" style={{ background: 'transparent', border: `1.5px solid ${C.border}`, color: C.muted }} onClick={() => setShowConfirm2(false)}>
                Batal
              </button>
              <button className="action-btn btn-cyan" onClick={executeSurveyDistribution}>
                Ya, OK & Distribusikan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          OVERLAY ANIMASI CONSOLE CYAN (MARCHING ANT LINE)
          ======================================================================= */}
      {isSending && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(34,40,49,0.92)', zIndex: 10000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)' }}>
          <div style={{ width: '420px', maxWidth: '90vw', background: '#1d212a', border: '1.5px solid rgba(0,173,181,0.3)', borderRadius: '12px', padding: '24px 30px', boxShadow: '0 0 60px rgba(0,173,181,0.2)' }}>
            
            {/* SVG Marching Ant Dashed Line */}
            <svg width="100%" height="8" style={{ marginBottom: '20px' }}>
              <line x1="0" y1="4" x2="100%" y2="4" stroke={C.cyan} strokeWidth="4" className="marching-border" />
            </svg>

            <h4 style={{ fontSize: '1.05rem', color: C.cyan, fontWeight: 800, textAlign: 'center', margin: '0 0 16px 0', letterSpacing: '1px' }}>
              🤖 ENGINE DISTRIBUSI AKTIF
            </h4>

            {/* Console Status Lines */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontFamily: 'monospace', fontSize: '0.78rem', color: C.muted }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: sendingStep >= 1 ? C.cyan : '#555' }}>
                <span>[1/3] Memetakan matrix relasi penilai...</span>
                <span>{sendingStep >= 1 ? 'OK' : '⏳'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: sendingStep >= 2 ? C.cyan : '#555' }}>
                <span>[2/3] Mendistribusikan paket soal ke HP...</span>
                <span>{sendingStep >= 2 ? 'OK' : '⏳'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: sendingStep >= 3 ? C.cyan : '#555' }}>
                <span>[3/3] Melakukan auto-generasi data mock...</span>
                <span>{sendingStep >= 3 ? 'OK' : '⏳'}</span>
              </div>
            </div>

            {/* Progress Bar */}
            <div style={{ width: '100%', height: '4px', background: 'rgba(238,238,238,0.05)', borderRadius: '10px', marginTop: '20px', overflow: 'hidden' }}>
              <div style={{ width: `${(sendingStep / 3) * 100}%`, height: '100%', background: C.cyan, transition: 'width 0.3s ease' }} />
            </div>
          </div>
        </div>
      )}
      {/* PDF Exporter Compiler Overlay */}
      <PDFCompileOverlay isOpen={isExportingPDF} />

      {/* =======================================================================
          MODAL 3: INPUT BRIEFING HARIAN (KEPALA CABANG ONLY)
          ======================================================================= */}
      {showBriefingModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: C.surface, borderRadius: '16px', border: `2px solid ${C.cyan}`, padding: '24px', width: '600px', maxWidth: '95vw', display: 'flex', flexDirection: 'column', maxHeight: '90vh', boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: `1.5px solid ${C.border}`, paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={22} color={C.cyan} />
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: C.text }}>
                    Briefing Log: {briefingModalEmpName}
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.74rem', color: C.muted }}>
                    Periode: {monthsList.find(m => m.value === Number(filterMonth))?.label} {filterYear}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowBriefingModal(false)} 
                style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', background: C.bg, padding: '10px 14px', borderRadius: '8px', marginBottom: '16px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: C.text }}>
                Total Terlaksana: {briefingDaysState.filter(d => d.completed).length} / {briefingDaysState.length} Hari ({Math.round((briefingDaysState.filter(d => d.completed).length / Math.max(1, briefingDaysState.length)) * 100)}%)
              </span>
              <button 
                onClick={handleAutoCheckPresentDays}
                style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '6px', color: C.success, fontSize: '0.74rem', padding: '5px 10px', cursor: 'pointer', fontWeight: 700 }}
              >
                ⚡ Centang Hari Hadir
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px', paddingRight: '6px', marginBottom: '16px' }}>
              {briefingDaysState.map((day) => {
                const dateObj = new Date(day.dateStr);
                const dayName = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'][dateObj.getDay()];
                return (
                  <div 
                    key={day.day} 
                    onClick={() => {
                      setBriefingDaysState(prev => prev.map(d => d.day === day.day ? { ...d, completed: !d.completed } : d));
                    }}
                    style={{ 
                      background: day.completed ? 'rgba(59, 130, 246, 0.08)' : C.bg, 
                      border: `1.5px solid ${day.completed ? C.cyan : C.border}`, 
                      borderRadius: '8px', 
                      padding: '10px', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: C.text }}>Hari {day.day}</span>
                    <span style={{ fontSize: '0.68rem', color: C.muted, marginTop: '2px' }}>{dayName}, {day.day} {monthsList.find(m => m.value === Number(filterMonth))?.label.slice(0, 3)}</span>
                    <div style={{ marginTop: '8px' }}>
                      {day.completed ? (
                        <span style={{ color: C.success, display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.74rem', fontWeight: 700 }}>
                          ✓ Done
                        </span>
                      ) : (
                        <span style={{ color: C.muted, display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.74rem', fontWeight: 500 }}>
                          ✗ Pending
                        </span>
                      )}
                    </div>
                    {day.isPresent && (
                      <span style={{ position: 'absolute', top: '4px', right: '4px', width: '6px', height: '6px', borderRadius: '50%', background: C.success }} title="Hadir kerja" />
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: `1.5px solid ${C.border}`, paddingTop: '12px' }}>
              <button 
                className="action-btn" 
                style={{ background: 'transparent', border: `1.5px solid ${C.border}`, color: C.muted }} 
                onClick={() => setShowBriefingModal(false)}
              >
                Batal
              </button>
              <button className="action-btn btn-cyan" onClick={handleSaveBriefing}>
                Simpan Briefing Log
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

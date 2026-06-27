import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, Search, CheckCircle, ChevronLeft, ChevronRight, AlertCircle, Users, Coins, Filter, FileText, TrendingUp, AlertTriangle, Loader2 } from 'lucide-react';
import { getRoleFromPosition, checkAccess } from '../utils/security';
import { getLiveOutletList } from '../utils/outletUtils';
import { useHRIS } from '../context/HRISContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import PDFCompileOverlay from './PDFCompileOverlay';

export default function Employees({ token, API_URL, userPermissions, user }) {
  const role = getRoleFromPosition(user?.position, user?.role);
  // ─── HRIS Global Dispatch — untuk menyebarkan perubahan karyawan secara instan ──
  const { dispatch: hrisDispatch, targetStaf: ctxTargetStaf, activeEmployees: ctxActiveEmployees } = useHRIS();

  // Reactive: force re-render saat targetStaf dari context berubah
  // getIdealStaffTarget() membaca localStorage; ini memastikan re-render dipicu
  const [, forceRenderTarget] = React.useState(0);
  useEffect(() => {
    forceRenderTarget(n => n + 1);
  }, [ctxTargetStaf]);


  const toTitleCase = (str) => {
    if (!str) return '';
    return str
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getDynamicPositions = () => {
    try {
      const policiesList = window.getHrisPolicies();
      if (!Array.isArray(policiesList)) return [];

      const positions = [];
      policiesList.forEach(p => {
        if (p.nama_aturan === 'Struktur Gaji Pokok' && p.status === 'ACTIVE' && p.deskripsi) {
          const match = p.deskripsi.match(/Jabatan:\s*([^,]+)/i);
          if (match) {
            const pos = match[1].trim();
            if (pos && !positions.includes(pos)) {
              positions.push(pos);
            }
          }
        }
      });
      return positions;
    } catch (e) {
      console.error('Error getting dynamic positions:', e);
      return [];
    }
  };

  const getSalaryForPosition = (posName) => {
    if (!posName) return 1200000;
    try {
      const policiesList = window.getHrisPolicies();
      if (!Array.isArray(policiesList)) return 1200000;

      const matchingPolicy = policiesList.find(p => {
        if (p.nama_aturan !== 'Struktur Gaji Pokok' || p.status !== 'ACTIVE' || !p.deskripsi) return false;
        const match = p.deskripsi.match(/Jabatan:\s*([^,]+)/i);
        if (match) {
          return match[1].trim().toUpperCase() === posName.trim().toUpperCase();
        }
        return false;
      });

      if (matchingPolicy && matchingPolicy.deskripsi) {
        const match = matchingPolicy.deskripsi.match(/Gaji\s+Pokok:\s*Rp\s*([\d.]+)/i);
        if (match) {
          return parseInt(match[1].replace(/\./g, ''), 10);
        }
      }
    } catch (e) {
      console.error('Error getting salary for position:', e);
    }
    
    const pos = posName.toLowerCase();
    if (pos.includes('kepala cabang')) return 1700000;
    if (pos.includes('quality control') || pos.includes('qc')) return 1400000;
    if (pos.includes('training') && pos.includes('cabang')) return 1400000;
    if (pos.includes('training')) return 1000000;
    return 1200000;
  };

  const positionOptions = [
    'Supervisor',
    'Admin',
    'Quality Control',
    'Kepala Cabang',
    'Kepala Produksi',
    'Kepala Layanan',
    'Koki',
    'Helper',
    'Waiters'
  ];

  const getClosestValidPosition = (pos) => {
    if (!pos) return 'helper';
    const p = pos.toLowerCase().trim();
    if (p.includes('supervisor') || p.includes('spv')) return 'supervisor';
    if (p.includes('admin')) return 'admin';
    if (p.includes('quality control') || p.includes('qc')) return 'quality control';
    if (p.includes('kepala cabang') || p.includes('cabang')) return 'kepala cabang';
    if (p.includes('kepala produksi') || p.includes('produksi')) return 'kepala produksi';
    if (p.includes('kepala layanan') || p.includes('layanan') || p.includes('kasir')) return 'kepala layanan';
    if (p.includes('koki') || p.includes('cook')) return 'koki';
    if (p.includes('helper')) return 'helper';
    if (p.includes('waiter')) return 'waiters';
    return 'helper';
  };


  // Logika Rumus Auto-Generator JavaScript/TypeScript untuk nomor urut ID Karyawan
  const getNextSequenceNumber = () => {
    try {
      const allList = window.getHrisEmployees() || [];
      const customUsernames = JSON.parse(localStorage.getItem('hris_custom_usernames') || '{}');
      
      let maxSeq = 0;
      
      // Hitung sequence max dari daftar karyawan
      allList.forEach(emp => {
        if (emp.employee_id) {
          const idStr = String(emp.employee_id).trim();
          let seqNum = 0;
          if (idStr.includes('/')) {
            seqNum = parseInt(idStr.split('/')[0], 10);
          } else {
            seqNum = parseInt(idStr, 10);
          }
          if (!isNaN(seqNum) && seqNum > maxSeq) {
            maxSeq = seqNum;
          }
        }
      });
      
      // Hitung sequence max dari custom usernames
      Object.values(customUsernames).forEach(val => {
        const seqNum = parseInt(String(val).trim(), 10);
        if (!isNaN(seqNum) && seqNum > maxSeq) {
          maxSeq = seqNum;
        }
      });
      
      let candidateSeq = maxSeq + 1;
      if (candidateSeq < 1) candidateSeq = 1;
      
      // Cari sequence number pertama yang benar-benar belum terpakai di cache manapun
      while (true) {
        const candidateIdStr = String(candidateSeq).padStart(5, '0');
        const conflictEmployees = allList.some(emp => String(emp.employee_id).trim() === candidateIdStr);
        const conflictCredentials = Object.values(customUsernames).some(val => String(val).trim() === candidateIdStr);
        
        if (!conflictEmployees && !conflictCredentials) {
          return candidateSeq;
        }
        candidateSeq++;
      }
    } catch (e) {
      console.error('Error getting next sequence number:', e);
      return 1;
    }
  };

  // Get ID OUTLET official code (e.g. ABS TT -> ABSTT)
  const getOutletCode = (outletName) => {
    if (!outletName) return '';
    let code = '';
    try {
      const rawOutlets = localStorage.getItem('outlet_cabang_data');
      if (rawOutlets) {
        const parsed = JSON.parse(rawOutlets);
        const found = parsed.find(o => 
          o.nama_tablet === outletName || 
          `${o.nama} ${o.wilayah}`.trim().toUpperCase() === outletName.trim().toUpperCase() ||
          (o.nama || '').trim().toUpperCase() === outletName.trim().toUpperCase()
        );
        if (found && found.id) {
          code = found.id;
        }
      }
    } catch (e) {
      console.error('Error parsing outlet data:', e);
    }
    
    if (!code) {
      const match = outletName.match(/\(([^)]+)\)/);
      if (match) {
        code = match[1];
      } else {
        code = outletName;
      }
    }
    return String(code).replace(/\s+/g, '').toUpperCase();
  };



  const [employees, setEmployees] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [search, setSearch] = useState('');
  const [inputSearch, setInputSearch] = useState('');
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearch(inputSearch);
    }, 300);
    return () => clearTimeout(handler);
  }, [inputSearch]);

  const [loading, setLoading] = useState(true);

  const [view, setView] = useState('list'); // 'list', 'add', 'edit'
  const [editMode, setEditMode] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [toast, setToast] = useState({ show: false, type: '', message: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [errorMessage, setErrorMessage] = useState(null);
  const showError = (msg) => {
    setErrorMessage(msg);
  };

  const [inactiveSearchText, setInactiveSearchText] = useState('');
  const [selectedActiveEmp, setSelectedActiveEmp] = useState(null);
  const [inactiveQuitDay, setInactiveQuitDay] = useState('');
  const [inactiveQuitMonth, setInactiveQuitMonth] = useState('');
  const [inactiveQuitYear, setInactiveQuitYear] = useState('');
  const [isInactiveDropdownOpen, setIsInactiveDropdownOpen] = useState(false);

  const [startWorkingDay, setStartWorkingDay] = useState('');
  const [startWorkingMonth, setStartWorkingMonth] = useState('');
  const [startWorkingYear, setStartWorkingYear] = useState('');

  const calculateMasaKerjaString = (startDateStr) => {
    if (!startDateStr) return '-';
    try {
      const start = new Date(startDateStr);
      const now = new Date();
      if (isNaN(start.getTime())) return '-';
      
      const yearDiff = now.getFullYear() - start.getFullYear();
      const monthDiff = now.getMonth() - start.getMonth();
      const totalMonths = yearDiff * 12 + monthDiff;
      
      if (totalMonths < 0) return '0 Bulan';
      const y = Math.floor(totalMonths / 12);
      const m = totalMonths % 12;
      
      if (y > 0) {
        return `${y} Tahun ${m} Bulan`;
      }
      return `${m} Bulan`;
    } catch (e) {
      return '-';
    }
  };

  // Persistent Global Filter States
  const BULAN_INDO = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const [activeTab, setActiveTab] = useState('active');

  const [isExportingPDF, setIsExportingPDF] = useState(false);

  const capitalEachWord = (s) => {
    if (s === undefined || s === null) return '';
    return String(s).toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  };

  const resetFiltersToDefault = () => {
    setSearch('');
    setInputSearch('');
    setUiSelectedOutlets(outlets);
    setActiveOutlets(outlets);
    setUiSelectedPosition('Semua Jabatan');
    setActivePosition('Semua Jabatan');
    setUiSelectedMonth('Semua Bulan');
    setActiveMonth('Semua Bulan');
    setUiSelectedYear('Semua Tahun');
    setActiveYear('Semua Tahun');
    
    const defaultState = {
      outlets: outlets,
      position: 'Semua Jabatan',
      month: 'Semua Bulan',
      year: 'Semua Tahun'
    };
    localStorage.setItem('filter_karyawan_state', JSON.stringify(defaultState));
    hrisDispatch('FILTER_CHANGED');
  };
  const [uiSelectedOutlets, setUiSelectedOutlets] = useState([]);
  const [activeOutlets, setActiveOutlets] = useState([]);
  const [uiSelectedPosition, setUiSelectedPosition] = useState('Semua Jabatan');
  const [activePosition, setActivePosition] = useState('Semua Jabatan');
  const [uiSelectedMonth, setUiSelectedMonth] = useState('Semua Bulan');
  const [activeMonth, setActiveMonth] = useState('Semua Bulan');
  const [uiSelectedYear, setUiSelectedYear] = useState('Semua Tahun');
  const [activeYear, setActiveYear] = useState('Semua Tahun');
  const [filterLoading, setFilterLoading] = useState(false);
  const [showOutletFilter, setShowOutletFilter] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isClosingModal, setIsClosingModal] = useState(false);

  // Sync state from localStorage on outlets loaded
  useEffect(() => {
    if (outlets.length > 0) {
      try {
        const savedState = localStorage.getItem('filter_karyawan_state');
        if (savedState) {
          const parsed = JSON.parse(savedState);
          setUiSelectedOutlets(parsed.outlets || []);
          setActiveOutlets(parsed.outlets || []);
          setUiSelectedPosition(parsed.position || 'Semua Jabatan');
          setActivePosition(parsed.position || 'Semua Jabatan');
          setUiSelectedMonth(parsed.month || 'Semua Bulan');
          setActiveMonth(parsed.month || 'Semua Bulan');
          setUiSelectedYear(parsed.year || 'Semua Tahun');
          setActiveYear(parsed.year || 'Semua Tahun');
        } else {
          setUiSelectedOutlets(outlets);
          setActiveOutlets(outlets);
        }
      } catch (e) {
        console.error('Error loading filter state:', e);
        setUiSelectedOutlets(outlets);
        setActiveOutlets(outlets);
      }
    }
  }, [outlets]);

  const handleOutletCheckboxChange = (outName) => {
    setUiSelectedOutlets(prev => {
      const updated = prev.includes(outName)
        ? prev.filter(o => o !== outName)
        : [...prev, outName];
      setActiveOutlets(updated);
      localStorage.setItem('filter_karyawan_state', JSON.stringify({
        outlets: updated,
        position: activePosition,
        month: activeMonth,
        year: activeYear
      }));
      setCurrentPage(1);
      hrisDispatch('FILTER_CHANGED');
      return updated;
    });
  };

  const handleAllOutletsChange = (e) => {
    const updated = e.target.checked ? outlets : [];
    setUiSelectedOutlets(updated);
    setActiveOutlets(updated);
    localStorage.setItem('filter_karyawan_state', JSON.stringify({
      outlets: updated,
      position: activePosition,
      month: activeMonth,
      year: activeYear
    }));
    setCurrentPage(1);
    hrisDispatch('FILTER_CHANGED');
  };

  const isAllOutletsSelected = uiSelectedOutlets.length === outlets.length;

  const handlePositionChange = (val) => {
    setUiSelectedPosition(val);
    setActivePosition(val);
    localStorage.setItem('filter_karyawan_state', JSON.stringify({
      outlets: activeOutlets,
      position: val,
      month: activeMonth,
      year: activeYear
    }));
    setCurrentPage(1);
    hrisDispatch('FILTER_CHANGED');
  };

  const handleMonthChange = (val) => {
    setUiSelectedMonth(val);
    setActiveMonth(val);
    localStorage.setItem('filter_karyawan_state', JSON.stringify({
      outlets: activeOutlets,
      position: activePosition,
      month: val,
      year: activeYear
    }));
    setCurrentPage(1);
    hrisDispatch('FILTER_CHANGED');
  };

  const handleYearChange = (val) => {
    setUiSelectedYear(val);
    setActiveYear(val);
    localStorage.setItem('filter_karyawan_state', JSON.stringify({
      outlets: activeOutlets,
      position: activePosition,
      month: activeMonth,
      year: val
    }));
    setCurrentPage(1);
    hrisDispatch('FILTER_CHANGED');
  };

  const getThemeColor = () => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    return currentTheme === 'light' ? '#A5B68D' : '#00ADB5';
  };

  const filteredEmployees = employees.filter(emp => {
    // 1. Text Search Filter
    const matchesSearch = search
      ? (
          (emp.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
          (emp.nik || '').includes(search) ||
          (emp.position || '').toLowerCase().includes(search.toLowerCase()) ||
          (emp.nickname && emp.nickname.toLowerCase().includes(search.toLowerCase())) ||
          (emp.outlet && emp.outlet.toLowerCase().includes(search.toLowerCase()))
        )
      : true;
      
    if (!matchesSearch) return false;

    // 2. Tab Filter
    if (activeTab === 'inactive') {
      if (emp.employee_status !== 'inactive') return false;
    } else {
      if (emp.employee_status === 'inactive') return false;
    }

    // 3. Outlet Filter
    if (activeOutlets.length > 0) {
      const activeOutletsUpper = activeOutlets.map(o => o.toUpperCase());
      const empOutletUpper = (emp.outlet || '').toUpperCase();
      if (!activeOutletsUpper.includes(empOutletUpper)) return false;
    }

    // 4. Position Filter
    if (activePosition !== 'Semua Jabatan') {
      if ((emp.position || '').toLowerCase() !== activePosition.toLowerCase()) return false;
    }

    // 5. Month and Year Filter
    const dateToCheck = emp.employee_status === 'inactive' ? emp.end_working_date : emp.start_working_date;
    if (dateToCheck) {
      const parts = dateToCheck.split('-');
      const y = parts[0];
      const m = parseInt(parts[1], 10);
      
      if (activeMonth !== 'Semua Bulan') {
        if (m !== parseInt(activeMonth, 10)) return false;
      }
      if (activeYear !== 'Semua Tahun') {
        if (y !== activeYear) return false;
      }
    } else {
      if (activeMonth !== 'Semua Bulan' || activeYear !== 'Semua Tahun') return false;
    }

    return true;
  });

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'YAKIN',
    cancelText: 'BATAL',
    onConfirm: null,
    onCancel: null
  });

  const [pdfPreviewModal, setPdfPreviewModal] = useState({ isOpen: false, tab: 'active' });
  const [pdfGenerating, setPdfGenerating] = useState(false);

  // Column Visibility State
  const [showColFilter, setShowColFilter] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    employee_id: true,
    full_name: true,
    nickname: true,
    employee_status: true,
    position: true,
    start_working_date: true,
    working_duration: true,
    outlet: true,
    marital_status: true,
    address: true,
    gender: true,
    whatsapp_number: true,
    nik: true,
    facebook_account: true,
    instagram_account: true,
    actions: true
  });

  const colLabelMap = {
    employee_id: 'Id Karyawan',
    full_name: 'Nama Lengkap',
    nickname: 'Nama Panggilan',
    employee_status: 'Status Karyawan',
    position: 'Jabatan',
    start_working_date: 'Mulai Bekerja',
    working_duration: 'Lama Bekerja',
    outlet: 'Outlet',
    marital_status: 'Status Pernikahan',
    address: 'Alamat Lengkap',
    gender: 'Jenis Kelamin',
    whatsapp_number: 'Nomor Whatsapp Aktif',
    nik: 'NIK',
    facebook_account: 'Akun Facebook',
    instagram_account: 'Akun Instagram',
    actions: 'Aksi'
  };


  const showToast = (type, message) => {
    setToast({ show: true, type, message });
    setTimeout(() => {
      setToast({ show: false, type: '', message: '' });
    }, 6000);
  };

  // Form State
  const [formData, setFormData] = useState({
    employee_id: '',
    nik: '',
    full_name: '',
    nickname: '',
    employee_status: 'active',
    end_working_date: '',
    position: positionOptions[0] ? positionOptions[0].toLowerCase() : 'supervisor',
    start_working_date: '',
    outlet: '',
    marital_status: 'Belum menikah',
    address: '',
    gender: 'Pria',
    whatsapp_number: '',
    facebook_account: '',
    instagram_account: ''
  });

  const [photoBase64, setPhotoBase64] = useState('');
  const [photoPreview, setPhotoPreview] = useState('');


  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const validateField = (name, value, dataToValidate = formData) => {
    let error = '';
    const trimmed = (value || '').trim();

    switch (name) {
      case 'full_name':
        if (!trimmed) {
          error = 'Nama Lengkap wajib diisi.';
        } else if (trimmed.length < 3) {
          error = 'Nama Lengkap minimal 3 karakter.';
        } else if (!/^[a-zA-Z\s\.\,\'\-]+$/.test(trimmed)) {
          error = 'Nama Lengkap hanya boleh berisi huruf, spasi, titik, koma, petik tunggal, dan tanda hubung.';
        }
        break;
      case 'nickname':
        if (!trimmed) {
          error = 'Nama Panggilan wajib diisi.';
        } else if (trimmed.length < 2) {
          error = 'Nama Panggilan minimal 2 karakter.';
        } else if (!/^[a-zA-Z\s\.\,\'\-]+$/.test(trimmed)) {
          error = 'Nama Panggilan hanya boleh berisi huruf, spasi, titik, koma, petik tunggal, dan tanda hubung.';
        }
        break;
      case 'nik':
        if (!trimmed) {
          error = 'Nomor Induk Karyawan (NIK) wajib diisi.';
        } else if (trimmed.length !== 16) {
          error = 'NIK harus tepat 16 karakter.';
        } else if (!/^\d+$/.test(trimmed)) {
          error = 'NIK hanya boleh berisi angka saja.';
        }
        break;
      case 'whatsapp_number':
        if (!trimmed) {
          error = 'Nomor Whatsapp wajib diisi.';
        } else if (!/^\+?\d+$/.test(trimmed)) {
          error = 'Nomor Whatsapp hanya boleh berisi angka saja.';
        } else if (trimmed.replace(/^\+/, '').length < 10 || trimmed.replace(/^\+/, '').length > 15) {
          error = 'Nomor Whatsapp harus berjumlah 10 hingga 15 digit.';
        } else {
          const cleanNum = trimmed.replace(/^\+/, '');
          if (!cleanNum.startsWith('08') && !cleanNum.startsWith('62')) {
            error = 'Nomor Whatsapp harus dimulai dengan 08 atau 62.';
          }
        }
        break;
      case 'address':
        if (!trimmed) {
          error = 'Alamat Lengkap wajib diisi.';
        } else if (trimmed.length < 10) {
          error = 'Alamat Lengkap minimal 10 karakter.';
        }
        break;
      case 'outlet':
        if (!trimmed) {
          error = 'Outlet Cabang wajib dipilih.';
        }
        break;
      case 'start_working_date':
        if (!trimmed) {
          error = 'Tanggal Mulai Bekerja wajib diisi.';
        }
        break;
      case 'facebook_account':
        if (trimmed && trimmed.length < 3) {
          error = 'Akun Facebook minimal 3 karakter.';
        }
        break;
      case 'instagram_account':
        if (trimmed) {
          if (trimmed.startsWith('@')) {
            error = 'Tulis username Instagram tanpa tanda @.';
          } else if (trimmed.length < 2) {
            error = 'Akun Instagram minimal 2 karakter.';
          } else if (!/^[a-zA-Z0-9._]+$/.test(trimmed)) {
            error = 'Username Instagram hanya boleh huruf, angka, titik, atau garis bawah.';
          }
        }
        break;
      case 'end_working_date':
        if (dataToValidate.employee_status === 'inactive' && !trimmed) {
          error = 'Tanggal Terakhir Bekerja wajib diisi.';
        }
        break;
      default:
        break;
    }
    return error;
  };

  const validateForm = (dataToValidate = formData) => {
    const errors = {};
    Object.keys(dataToValidate).forEach(key => {
      const err = validateField(key, dataToValidate[key], dataToValidate);
      if (err) {
        errors[key] = err;
      }
    });

    // Validasi duplikasi NIK di localData (kecuali ID terpilih saat mengedit)
    const trimmedNik = (dataToValidate.nik || '').trim();
    if (trimmedNik && !errors.nik) {
      const localData = localStorage.getItem('hris_employees') || localStorage.getItem('karyawan_data');
      const currentList = localData ? JSON.parse(localData) : [];
      const duplicateNik = currentList.find(emp => emp.nik.trim() === trimmedNik && emp.id !== selectedId);
      if (duplicateNik) {
        errors.nik = 'Nomor Induk Karyawan (NIK) sudah digunakan oleh karyawan lain.';
      }
    }

    // Validasi duplikasi ID Karyawan (employee_id) di localData (kecuali ID terpilih saat mengedit)
    const trimmedEmpId = (dataToValidate.employee_id || '').trim();
    if (trimmedEmpId && !errors.employee_id) {
      const localData = localStorage.getItem('hris_employees') || localStorage.getItem('karyawan_data');
      const currentList = localData ? JSON.parse(localData) : [];
      const duplicateEmpId = currentList.find(emp => String(emp.employee_id).trim() === trimmedEmpId && emp.id !== selectedId);
      if (duplicateEmpId) {
        errors.employee_id = 'ID Karyawan sudah digunakan oleh karyawan lain.';
      }
    }



    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Fetch employees from API and sync to localStorage
  const fetchEmployees = async () => {
    setLoading(true);
    try {
      if (token && API_URL) {
        const headers = { 'Authorization': `Bearer ${token}` };
        const res = await fetch(`${API_URL}/employees`, { headers });
        const data = await res.json();
        if (res.status === 200 && data.status === 'success') {
          const dbList = data.data.map(emp => ({
            id: emp.id,
            employee_id: emp.email || emp.nik || '', // Map email (which is the APK username) to employee_id
            nik: emp.nik || '',
            full_name: emp.full_name || '',
            nickname: (emp.full_name || '').split(' ')[0] || 'USR',
            employee_status: emp.status === 'inactive' ? 'inactive' : 'active',
            end_working_date: emp.end_working_date || '',
            position: emp.position || '',
            basic_salary: emp.basic_salary || 0,
            start_working_date: emp.joined_date || new Date().toISOString().split('T')[0],
            outlet: emp.outlet || '',
            marital_status: 'Belum Kawin',
            address: emp.address || '',
            gender: emp.gender || 'Pria',
            whatsapp_number: emp.phone || '',
            facebook_account: '',
            instagram_account: ''
          }));
          
          localStorage.setItem('hris_employees', JSON.stringify(dbList));
          localStorage.setItem('karyawan_data', JSON.stringify(dbList));
          setEmployees(dbList);
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn('Gagal fetch dari API, fallback ke localStorage:', err);
    }

    // Fallback ke localStorage jika API gagal
    try {
      const localData = localStorage.getItem('hris_employees');
      if (localData) {
        setEmployees(JSON.parse(localData));
      } else {
        setEmployees([]);
        localStorage.setItem('hris_employees', JSON.stringify([]));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch outlets using centralized utility
  const fetchOutlets = async () => {
    const list = getLiveOutletList();
    setOutlets(list);
  };

  useEffect(() => {
    fetchEmployees();
    fetchOutlets();
  }, [token]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  useEffect(() => {
    const totalPagesCount = Math.ceil(filteredEmployees.length / 10);
    if (currentPage > totalPagesCount && totalPagesCount > 0) {
      setCurrentPage(1);
    }
  }, [filteredEmployees.length, currentPage]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    setErrorMsg('');
    const err = validateField(name, value);
    setFieldErrors(prev => ({ ...prev, [name]: err }));
  };

  const openAddModal = () => {
    if (!checkAccess(user, 'write')) {
      showError("Akses Ditolak! Anda tidak memiliki izin untuk melakukan aksi ini.");
      return;
    }
    setEditMode(false);
    setSelectedId(null);
    setPhotoBase64('');
    setPhotoPreview('');
    
    const defaultOutlet = outlets.length > 0 ? outlets[0] : '';
    const nextSeq = getNextSequenceNumber();
    const initialEmpId = String(nextSeq).padStart(5, '0');

    const today = new Date();
    setStartWorkingDay(String(today.getDate()));
    setStartWorkingMonth(String(today.getMonth() + 1));
    setStartWorkingYear(String(today.getFullYear()));

    setFormData({
      employee_id: initialEmpId,
      nik: '',
      full_name: '',
      nickname: '',
      employee_status: 'active',
      end_working_date: '',
      position: positionOptions[0] ? positionOptions[0].toLowerCase() : 'supervisor',
      start_working_date: '',
      outlet: defaultOutlet,
      marital_status: 'Belum menikah',
      address: '',
      gender: 'Pria',
      whatsapp_number: '',
      facebook_account: '',
      instagram_account: ''
    });
    setFieldErrors({});
    setErrorMsg('');
    setSuccessMsg('');
    setView('add');
  };

  const openAddInactiveModal = () => {
    if (!checkAccess(user, 'write')) {
      showError("Akses Ditolak! Anda tidak memiliki izin untuk melakukan aksi ini.");
      return;
    }
    setEditMode(false);
    setSelectedActiveEmp(null);
    setInactiveSearchText('');
    
    const today = new Date();
    setInactiveQuitDay(String(today.getDate()));
    setInactiveQuitMonth(String(today.getMonth() + 1));
    setInactiveQuitYear(String(today.getFullYear()));
    setIsInactiveDropdownOpen(false);

    setFormData({
      employee_id: '',
      nik: '',
      full_name: '',
      nickname: '',
      employee_status: 'inactive',
      end_working_date: '',
      position: '',
      start_working_date: '',
      outlet: '',
      marital_status: '',
      address: '',
      gender: '',
      whatsapp_number: '',
      facebook_account: '',
      instagram_account: ''
    });
    setFieldErrors({});
    setErrorMsg('');
    setSuccessMsg('');
    setView('add');
  };

  const openEditModal = (emp) => {
    if (!checkAccess(user, 'edit')) {
      showError("Akses Ditolak! Anda tidak memiliki izin untuk melakukan aksi ini.");
      return;
    }
    setEditMode(true);
    setSelectedId(emp.id);
    setPhotoBase64('');
    setPhotoPreview(emp.photo_url ? (emp.photo_url.startsWith('http') ? emp.photo_url : API_URL.replace('/api', '') + emp.photo_url) : '');

    if (emp.start_working_date) {
      const parts = emp.start_working_date.split('-');
      if (parts.length === 3) {
        setStartWorkingYear(parts[0]);
        setStartWorkingMonth(String(parseInt(parts[1], 10)));
        setStartWorkingDay(String(parseInt(parts[2], 10)));
      }
    } else {
      const today = new Date();
      setStartWorkingDay(String(today.getDate()));
      setStartWorkingMonth(String(today.getMonth() + 1));
      setStartWorkingYear(String(today.getFullYear()));
    }

    setFormData({
      employee_id: emp.employee_id || '',
      nik: emp.nik,
      full_name: emp.full_name,
      nickname: emp.nickname || '',
      employee_status: emp.employee_status === 'inactive' ? 'inactive' : 'active',
      end_working_date: emp.end_working_date || '',
      position: getClosestValidPosition(emp.position),
      start_working_date: emp.start_working_date || '',
      outlet: emp.outlet || '',
      marital_status: emp.marital_status || 'Belum menikah',
      address: emp.address || '',
      gender: emp.gender || 'Pria',
      whatsapp_number: emp.whatsapp_number || '',
      facebook_account: emp.facebook_account || '',
      instagram_account: emp.instagram_account || ''
    });
    setFieldErrors({});
    setErrorMsg('');
    setSuccessMsg('');
    setView('edit');
  };



  const triggerSave = (e) => {
    e.preventDefault();
    if (editMode) {
      if (!checkAccess(user, 'edit')) {
        showError("Akses Ditolak! Anda tidak memiliki izin untuk melakukan aksi ini.");
        return;
      }
    } else {
      if (!checkAccess(user, 'write')) {
        showError("Akses Ditolak! Anda tidak memiliki izin untuk melakukan aksi ini.");
        return;
      }
    }

    const formattedDay = String(startWorkingDay).padStart(2, '0');
    const formattedMonth = String(startWorkingMonth).padStart(2, '0');
    const startWorkingDateStr = `${startWorkingYear}-${formattedMonth}-${formattedDay}`;

    // Auto-generate employee_id jika kosong pada mode tambah
    let updatedFormData = { 
      ...formData,
      start_working_date: startWorkingDateStr
    };
    if (!editMode && !formData.employee_id) {
      const nextSeq = getNextSequenceNumber();
      const initialEmpId = String(nextSeq).padStart(5, '0');
      updatedFormData.employee_id = initialEmpId;
    }
    setFormData(updatedFormData);

    setConfirmModal({
      isOpen: true,
      title: 'Konfirmasi Simpan',
      message: 'Apakah Anda yakin ingin menyimpan data karyawan baru ini? Data yang dimasukkan akan langsung aktif dan tersinkronisasi ke seluruh halaman HRIS.',
      confirmText: 'Yakin simpan',
      cancelText: 'BATAL',
      onConfirm: () => executeSubmit(updatedFormData)
    });
  };

  const closeModal = () => {
    setIsClosingModal(true);
    setTimeout(() => {
      setView('list');
      setIsClosingModal(false);
      setSelectedActiveEmp(null);
      setInactiveSearchText('');
      setInactiveQuitDay('');
      setInactiveQuitMonth('');
      setInactiveQuitYear('');
      setIsInactiveDropdownOpen(false);
      setStartWorkingDay('');
      setStartWorkingMonth('');
      setStartWorkingYear('');
      setFormData({
        employee_id: '',
        nik: '',
        full_name: '',
        nickname: '',
        employee_status: 'active',
        end_working_date: '',
        position: positionOptions[0] ? positionOptions[0].toLowerCase() : 'supervisor',
        start_working_date: new Date().toISOString().split('T')[0],
        outlet: outlets.length > 0 ? outlets[0] : '',
        marital_status: 'Belum menikah',
        address: '',
        gender: 'Pria',
        whatsapp_number: '',
        facebook_account: '',
        instagram_account: ''
      });
      setFieldErrors({});
      setErrorMsg('');
      setSuccessMsg('');
    }, 300);
  };

  const handleSelectActiveEmp = (emp) => {
    setSelectedActiveEmp(emp);
    setIsInactiveDropdownOpen(false);
    setInactiveSearchText(emp.full_name);
    
    setFormData(prev => ({
      ...prev,
      ...emp,
      employee_status: 'inactive'
    }));
  };

  const triggerSaveInactive = (e) => {
    e.preventDefault();
    if (!selectedActiveEmp) {
      setErrorMsg('Silakan pilih karyawan aktif terlebih dahulu.');
      return;
    }
    if (!inactiveQuitDay || !inactiveQuitMonth || !inactiveQuitYear) {
      setErrorMsg('Silakan pilih tanggal berhenti bekerja dengan lengkap.');
      return;
    }
    
    setConfirmModal({
      isOpen: true,
      title: 'Konfirmasi Simpan',
      message: `Apakah Anda yakin ingin menonaktifkan karyawan ${toTitleCase(selectedActiveEmp.full_name)}?`,
      confirmText: 'Yakin',
      cancelText: 'BATAL',
      onConfirm: () => executeAddInactiveSubmit()
    });
  };

  const executeAddInactiveSubmit = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setIsSaving(true);

    // Wait 0.2 seconds (200ms) for electric cyan spinner
    setTimeout(async () => {
      try {
        const formattedDay = String(inactiveQuitDay).padStart(2, '0');
        const formattedMonth = String(inactiveQuitMonth).padStart(2, '0');
        const quitDateStr = `${inactiveQuitYear}-${formattedMonth}-${formattedDay}`;

        const localData = localStorage.getItem('hris_employees') || localStorage.getItem('karyawan_data');
        let currentList = localData ? JSON.parse(localData) : [];

        let updatedEmp = null;
        currentList = currentList.map(emp => {
          if (emp.id === selectedActiveEmp.id) {
            updatedEmp = {
              ...emp,
              employee_status: 'inactive',
              end_working_date: quitDateStr
            };
            return updatedEmp;
          }
          return emp;
        });

        localStorage.setItem('hris_employees', JSON.stringify(currentList));
        localStorage.setItem('karyawan_data', JSON.stringify(currentList));
        setEmployees(currentList);

        if (updatedEmp) {
          // API PUT Request
          if (typeof selectedActiveEmp.id === 'number' && selectedActiveEmp.id < 1000000000000) {
            try {
              const payload = {
                full_name: updatedEmp.full_name,
                phone: updatedEmp.whatsapp_number,
                address: updatedEmp.address,
                position: updatedEmp.position,
                department: 'Operasional',
                basic_salary: updatedEmp.basic_salary,
                status: 'inactive',
                joined_date: updatedEmp.start_working_date,
                end_working_date: updatedEmp.end_working_date,
                outlet: updatedEmp.outlet,
                gender: updatedEmp.gender
              };

              await fetch(`${API_URL}/employees/${selectedActiveEmp.id}`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
              });
            } catch (err) {
              console.error('API Error:', err);
            }
          }
        }

        showToast('success', 'Data Berhasil Disimpan!');
        setIsSaving(false);
        
        // Reset states
        setSelectedActiveEmp(null);
        setInactiveSearchText('');
        setInactiveQuitDay('');
        setInactiveQuitMonth('');
        setInactiveQuitYear('');
        setIsInactiveDropdownOpen(false);
        
        setView('list');
        setCurrentPage(1);
      } catch (err) {
        console.error(err);
        setIsSaving(false);
        setErrorMsg('Gagal memproses perubahan status.');
      }
    }, 200);
  };

  const renderAddInactiveModalContent = () => {
    // Filter active employees list based on search text
    const activeStaffList = employees.filter(emp => {
      if (emp.employee_status === 'inactive' || emp.status === 'inactive') return false;
      if (inactiveSearchText) {
        return emp.full_name.toLowerCase().includes(inactiveSearchText.toLowerCase()) ||
               (emp.nik && emp.nik.includes(inactiveSearchText)) ||
               (emp.employee_id && emp.employee_id.includes(inactiveSearchText));
      }
      return true;
    });

    return (
      <form onSubmit={triggerSaveInactive} noValidate>
        {errorMsg && <p style={{ color: 'var(--danger)', background: 'var(--danger-glow)', padding: '12px', borderRadius: '10px', marginBottom: '20px', fontSize: '0.9rem', border: '1px solid hsla(0, 84%, 60%, 0.2)' }}>{errorMsg}</p>}
        {successMsg && <p style={{ color: 'var(--success)', background: 'var(--success-glow)', padding: '12px', borderRadius: '10px', marginBottom: '20px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid hsla(142, 70%, 45%, 0.2)' }}><CheckCircle size={16} /> {successMsg}</p>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px', marginBottom: '24px' }}>
          {/* Pencarian Pintar (Smart Search Field) */}
          <div className="glass-card" style={{ padding: '24px', background: 'rgba(15, 23, 42, 0.4)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#00ADB5', textTransform: 'uppercase', marginBottom: '16px', letterSpacing: '0.5px' }}>PENCARIAN KARYAWAN AKTIF</h3>
            
            <div className="input-group" style={{ marginBottom: '16px', position: 'relative' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', color: '#EEEEEE', marginBottom: '6px', fontWeight: 700 }}>NAMA LENGKAP KARYAWAN</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Ketik nama karyawan untuk mencari..." 
                  value={inactiveSearchText} 
                  onChange={(e) => {
                    setInactiveSearchText(e.target.value);
                    setIsInactiveDropdownOpen(true);
                    if (selectedActiveEmp && e.target.value !== selectedActiveEmp.full_name) {
                      setSelectedActiveEmp(null);
                    }
                  }}
                  onFocus={() => setIsInactiveDropdownOpen(true)}
                  style={{
                    paddingRight: '40px',
                    background: '#222831',
                    border: '1px solid #393E46',
                    color: '#EEEEEE',
                    borderRadius: '8px',
                    height: '44px',
                    width: '100%'
                  }}
                />
                <button
                  type="button"
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: '#00ADB5',
                    cursor: 'pointer'
                  }}
                  onClick={() => setIsInactiveDropdownOpen(!isInactiveDropdownOpen)}
                >
                  <Search size={18} />
                </button>
              </div>

              {/* Dropdown list of filtered active employees */}
              {isInactiveDropdownOpen && (
                <>
                  <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10 }} onClick={() => setIsInactiveDropdownOpen(false)} />
                  <div className="glass-card" style={{
                    position: 'absolute',
                    top: '76px',
                    left: 0,
                    width: '100%',
                    maxHeight: '220px',
                    overflowY: 'auto',
                    background: '#222831',
                    border: '1px solid #393E46',
                    borderRadius: '8px',
                    zIndex: 20,
                    boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
                  }}>
                    {activeStaffList.length === 0 ? (
                      <div style={{ padding: '12px', color: '#EEEEEE', fontSize: '0.85rem', textAlign: 'center' }}>
                        Tidak ada karyawan aktif ditemukan.
                      </div>
                    ) : (
                      activeStaffList.map(emp => (
                        <div
                          key={emp.id}
                          style={{
                            padding: '12px 16px',
                            color: '#EEEEEE',
                            cursor: 'pointer',
                            borderBottom: '1px solid #393E46',
                            transition: 'background 0.2s',
                            fontSize: '0.85rem',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#393E46'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          onClick={() => handleSelectActiveEmp(emp)}
                        >
                          <div style={{ fontWeight: 'bold' }}>{toTitleCase(emp.full_name)}</div>
                          <div style={{ fontSize: '0.75rem', color: '#00ADB5', marginTop: '2px' }}>
                            ID: {emp.employee_id} • Outlet: {toTitleCase(emp.outlet)} • Jabatan: {toTitleCase(emp.position)}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Real-time Auto-populate Logic Fields */}
          {selectedActiveEmp && (
            <div className="glass-card animate-fade-in" style={{ padding: '24px', background: 'rgba(15, 23, 42, 0.4)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#00ADB5', textTransform: 'uppercase', marginBottom: '16px', letterSpacing: '0.5px' }}>INFORMASI PENGISIAN OTOMATIS</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div className="input-group">
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#EEEEEE', marginBottom: '6px', fontWeight: 700 }}>ID KARYAWAN</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={selectedActiveEmp.employee_id || ''} 
                    disabled={true} 
                    style={{
                      color: '#EEEEEE',
                      fontWeight: 'bold',
                      background: '#393E46',
                      border: '1px solid #393E46',
                      cursor: 'not-allowed',
                      opacity: 0.7
                    }}
                  />
                </div>
                <div className="input-group">
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#EEEEEE', marginBottom: '6px', fontWeight: 700 }}>LAMA BEKERJA (STATUS AKTIF)</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={calculateMasaKerjaString(selectedActiveEmp.start_working_date)} 
                    disabled={true} 
                    style={{
                      color: '#EEEEEE',
                      fontWeight: 'bold',
                      background: '#393E46',
                      border: '1px solid #393E46',
                      cursor: 'not-allowed',
                      opacity: 0.7
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Input Kronologi Keluar */}
          {selectedActiveEmp && (
            <div className="glass-card animate-fade-in" style={{ padding: '24px', background: 'rgba(15, 23, 42, 0.4)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#00ADB5', textTransform: 'uppercase', marginBottom: '16px', letterSpacing: '0.5px' }}>KRONOLOGI BERHENTI BEKERJA</h3>
              
              <div className="input-group">
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#EEEEEE', marginBottom: '8px', fontWeight: 700 }}>TANGGAL BERHENTI BEKERJA</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  
                  {/* Select Hari/Tanggal */}
                  <div>
                    <select
                      className="input-field"
                      value={inactiveQuitDay}
                      onChange={(e) => setInactiveQuitDay(e.target.value)}
                      style={{ background: '#222831', color: '#EEEEEE', border: '1px solid #393E46', height: '42px' }}
                      required
                    >
                      <option value="">Hari / Tanggal</option>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                        <option key={d} value={String(d)}>{d}</option>
                      ))}
                    </select>
                  </div>

                  {/* Select Bulan */}
                  <div>
                    <select
                      className="input-field"
                      value={inactiveQuitMonth}
                      onChange={(e) => setInactiveQuitMonth(e.target.value)}
                      style={{ background: '#222831', color: '#EEEEEE', border: '1px solid #393E46', height: '42px' }}
                      required
                    >
                      <option value="">Pilih Bulan</option>
                      {BULAN_INDO.map((bln, idx) => (
                        <option key={idx} value={String(idx + 1)}>{bln}</option>
                      ))}
                    </select>
                  </div>

                  {/* Select Tahun */}
                  <div>
                    <select
                      className="input-field"
                      value={inactiveQuitYear}
                      onChange={(e) => setInactiveQuitYear(e.target.value)}
                      style={{ background: '#222831', color: '#EEEEEE', border: '1px solid #393E46', height: '42px' }}
                      required
                    >
                      <option value="">Pilih Tahun</option>
                      <option value="2020">2020</option>

                      <option value="2021">2021</option>

                      <option value="2022">2022</option>

                      <option value="2023">2023</option>

                      <option value="2024">2024</option>

                      <option value="2025">2025</option>

                      <option value="2026">2026</option>

                      <option value="2027">2027</option>

                      <option value="2028">2028</option>

                      <option value="2029">2029</option>

                      <option value="2030">2030</option>

                      <option value="2031">2031</option>

                      <option value="2032">2032</option>

                      <option value="2033">2033</option>

                      <option value="2034">2034</option>

                      <option value="2035">2035</option>

                      <option value="2036">2036</option>

                      <option value="2037">2037</option>

                      <option value="2038">2038</option>

                      <option value="2039">2039</option>

                      <option value="2040">2040</option>
                    </select>
                  </div>

                </div>
              </div>
            </div>
          )}

        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
          <button type="button" className="btn-secondary" onClick={closeModal} style={{ height: '44px', width: '120px' }}>Batal</button>
          <button type="submit" className="btn-primary" disabled={!selectedActiveEmp} style={{ height: '44px', width: '200px', background: selectedActiveEmp ? '#00ADB5' : 'rgba(0,173,181,0.2)', border: 'none', cursor: selectedActiveEmp ? 'pointer' : 'not-allowed' }}>Simpan</button>
        </div>
      </form>
    );
  };

  const executeSubmit = async (dataToSave = formData) => {
    setErrorMsg('');
    setSuccessMsg('');

    if (!validateForm(dataToSave)) {
      setErrorMsg('Gagal menyimpan. Silakan periksa kembali kolom pengisian yang belum sesuai standar.');
      showToast('error', 'Gagal: Input tidak sesuai standar.');
      return;
    }

    setIsSaving(true);

    setTimeout(async () => {
      try {
        const localData = localStorage.getItem('hris_employees') || localStorage.getItem('karyawan_data');
        let currentList = localData ? JSON.parse(localData) : [];

        if (editMode) {
          // Edit mode
          let updatedEmp = {
            id: selectedId,
            employee_id: dataToSave.employee_id || '',
            nik: dataToSave.nik.trim(),
            full_name: toTitleCase(dataToSave.full_name.trim()),
            nickname: toTitleCase(dataToSave.nickname.trim()),
            employee_status: dataToSave.employee_status,
            end_working_date: dataToSave.employee_status === 'inactive' ? dataToSave.end_working_date : '',
            position: toTitleCase(dataToSave.position),
            basic_salary: getSalaryForPosition(dataToSave.position),
            start_working_date: dataToSave.start_working_date,
            outlet: toTitleCase(dataToSave.outlet),
            marital_status: dataToSave.marital_status,
            address: toTitleCase(dataToSave.address.trim()),
            gender: dataToSave.gender,
            whatsapp_number: dataToSave.whatsapp_number.trim(),
            facebook_account: dataToSave.facebook_account.trim(),
            instagram_account: dataToSave.instagram_account.trim()
          };

          let apiSuccess = false;
          let isOffline = false;

          // PUT to backend API if selectedId is a database integer ID
          if (typeof selectedId === 'number' && selectedId < 1000000000000) {
            try {
              const payload = {
                full_name: updatedEmp.full_name,
                phone: updatedEmp.whatsapp_number,
                address: updatedEmp.address,
                position: updatedEmp.position,
                department: 'Operasional',
                basic_salary: updatedEmp.basic_salary,
                status: updatedEmp.employee_status,
                joined_date: updatedEmp.start_working_date,
                end_working_date: updatedEmp.end_working_date,
                outlet: updatedEmp.outlet,
                gender: updatedEmp.gender
              };
              const res = await fetch(`${API_URL}/employees/${selectedId}`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
              });

              if (res.status === 200) {
                const data = await res.json();
                if (data.status === 'success') {
                  apiSuccess = true;
                  if (photoBase64) {
                    try {
                      const resPhoto = await fetch(`${API_URL}/employees/${selectedId}/photo`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ photo: photoBase64 })
                      });
                      if (resPhoto.status === 200) {
                        const dPhoto = await resPhoto.json();
                        if (dPhoto.status === 'success' && dPhoto.data && dPhoto.data.photoUrl) {
                          updatedEmp.photo_url = dPhoto.data.photoUrl;
                        }
                      }
                    } catch (photoErr) {
                      console.error('Failed to upload photo during update:', photoErr);
                    }
                  }
                } else {
                  setErrorMsg(data.message || 'Gagal memperbarui data karyawan di server.');
                  showToast('error', data.message || 'Gagal di server.');
                  setIsSaving(false);
                  return;
                }
              } else {
                const data = await res.json().catch(() => ({}));
                setErrorMsg(data.message || 'Gagal memperbarui data karyawan di server.');
                showToast('error', data.message || 'Gagal di server.');
                setIsSaving(false);
                return;
              }
            } catch (err) {
              console.warn('Network error during API update, falling back to offline mode:', err);
              isOffline = true;
            }
          } else {
            // Local temp ID
            apiSuccess = true;
          }

          // Save changes if API succeeded or we are offline
          if (apiSuccess || isOffline) {
            currentList = currentList.map(emp => emp.id === selectedId ? updatedEmp : emp);
            localStorage.setItem('hris_employees', JSON.stringify(currentList));
            localStorage.setItem('karyawan_data', JSON.stringify(currentList));
            setEmployees(currentList);
            // ⚡ GLOBAL SYNC — sebarkan update ke Dashboard, Payroll, Sanksi, dsb.
            hrisDispatch('EMPLOYEE_CHANGED', currentList);
            showToast('success', isOffline ? 'Data disimpan lokal (Offline)' : 'Data Berhasil Disimpan!');
          }

        } else {
          // Add mode
          const tempId = Date.now();
          const newEmp = {
            id: tempId,
            employee_id: dataToSave.employee_id || '',
            nik: dataToSave.nik.trim(),
            full_name: toTitleCase(dataToSave.full_name.trim()),
            nickname: toTitleCase(dataToSave.nickname.trim()),
            employee_status: dataToSave.employee_status,
            end_working_date: dataToSave.employee_status === 'inactive' ? dataToSave.end_working_date : '',
            position: toTitleCase(dataToSave.position),
            basic_salary: getSalaryForPosition(dataToSave.position),
            start_working_date: dataToSave.start_working_date,
            outlet: toTitleCase(dataToSave.outlet),
            marital_status: dataToSave.marital_status,
            address: toTitleCase(dataToSave.address.trim()),
            gender: dataToSave.gender,
            whatsapp_number: dataToSave.whatsapp_number.trim(),
            facebook_account: dataToSave.facebook_account.trim(),
            instagram_account: dataToSave.instagram_account.trim()
          };

          let finalEmp = { ...newEmp };
          let apiSuccess = false;
          let isOffline = false;

          try {
            const payload = {
              email: String(newEmp.employee_id).trim(), // Username APK
              password: String(newEmp.employee_id).trim() + getOutletCode(newEmp.outlet), // Password APK
              nik: newEmp.nik,
              full_name: newEmp.full_name,
              phone: newEmp.whatsapp_number,
              address: newEmp.address,
              position: newEmp.position,
              department: 'Operasional',
              basic_salary: newEmp.basic_salary,
              joined_date: newEmp.start_working_date,
              end_working_date: newEmp.end_working_date,
              status: newEmp.employee_status,
              role: (newEmp.position.toLowerCase() === 'admin' || newEmp.position.toLowerCase() === 'owner' || newEmp.position.toLowerCase() === 'supervisor') ? 'admin' : 'employee',
              outlet: newEmp.outlet,
              gender: newEmp.gender
            };

            const res = await fetch(`${API_URL}/employees`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify(payload)
            });

            if (res.status === 201 || res.status === 200) {
              const data = await res.json();
              if (data.status === 'success') {
                apiSuccess = true;
                if (data.data && data.data.employeeId) {
                  finalEmp.id = data.data.employeeId; // Assign real database integer ID
                  if (photoBase64) {
                    try {
                      const resPhoto = await fetch(`${API_URL}/employees/${finalEmp.id}/photo`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ photo: photoBase64 })
                      });
                      if (resPhoto.status === 200) {
                        const dPhoto = await resPhoto.json();
                        if (dPhoto.status === 'success' && dPhoto.data && dPhoto.data.photoUrl) {
                          finalEmp.photo_url = dPhoto.data.photoUrl;
                        }
                      }
                    } catch (photoErr) {
                      console.error('Failed to upload photo during registration:', photoErr);
                    }
                  }
                }
              } else {
                setErrorMsg(data.message || 'Gagal mendaftarkan karyawan baru di server.');
                showToast('error', data.message || 'Gagal di server.');
                setIsSaving(false);
                return;
              }
            } else {
              const data = await res.json().catch(() => ({}));
              setErrorMsg(data.message || 'Gagal mendaftarkan karyawan baru di server.');
              showToast('error', data.message || 'Gagal di server.');
              setIsSaving(false);
              return;
            }
          } catch (err) {
            console.warn('Network error during API registration, falling back to offline mode:', err);
            isOffline = true;
          }

          // Save changes if API succeeded or we are offline
          if (apiSuccess || isOffline) {
            const newList = [...currentList, finalEmp];
            localStorage.setItem('hris_employees', JSON.stringify(newList));
            localStorage.setItem('karyawan_data', JSON.stringify(newList));
            setEmployees(newList);
            
            // Auto-generate and save login credentials to localStorage for automatic integration
            const empId = finalEmp.id;
            const generatedUsername = String(newEmp.employee_id).trim();
            const generatedPassword = String(newEmp.employee_id).trim() + getOutletCode(newEmp.outlet);
            
            const passwords = JSON.parse(localStorage.getItem('hris_user_passwords') || '{}');
            const usernames = JSON.parse(localStorage.getItem('hris_custom_usernames') || '{}');
            const roles = JSON.parse(localStorage.getItem('hris_user_roles') || '{}');
            
            passwords[empId] = generatedPassword;
            usernames[empId] = generatedUsername;
            roles[empId] = (newEmp.position.toLowerCase() === 'admin' || newEmp.position.toLowerCase() === 'owner' || newEmp.position.toLowerCase() === 'supervisor') ? 'admin' : 'employee';
            
            localStorage.setItem('hris_user_passwords', JSON.stringify(passwords));
            localStorage.setItem('hris_custom_usernames', JSON.stringify(usernames));
            localStorage.setItem('hris_user_roles', JSON.stringify(roles));
            localStorage.setItem('user_credentials', JSON.stringify({ passwords, usernames, roles }));
            
            window.dispatchEvent(new CustomEvent('hris:storage', { detail: { key: 'hris_user_passwords', value: passwords } }));
            window.dispatchEvent(new CustomEvent('hris:storage', { detail: { key: 'hris_custom_usernames', value: usernames } }));
            window.dispatchEvent(new CustomEvent('hris:storage', { detail: { key: 'hris_user_roles', value: roles } }));

            // ⚡ GLOBAL SYNC — sebarkan ke Dashboard, Payroll, Sanksi, dsb.
            hrisDispatch('EMPLOYEE_CHANGED', newList);

            
            // Proactively reset filters to ensure the newly added employee is visible in the table!
            setUiSelectedOutlets(outlets);
            setActiveOutlets(outlets);
            setUiSelectedPosition('Semua Jabatan');
            setActivePosition('Semua Jabatan');
            setUiSelectedMonth('Semua Bulan');
            setActiveMonth('Semua Bulan');
            setUiSelectedYear('Semua Tahun');
            setActiveYear('Semua Tahun');
            const defaultFilterState = {
              outlets: outlets,
              position: 'Semua Jabatan',
              month: 'Semua Bulan',
              year: 'Semua Tahun'
            };
            localStorage.setItem('filter_karyawan_state', JSON.stringify(defaultFilterState));

            if (apiSuccess) {
              fetchEmployees(); // Refresh list to get all latest DB values
            }
            showToast('success', isOffline ? 'Data disimpan lokal (Offline)' : 'Data Berhasil Disimpan!');
          }
        }

        setIsSaving(false);
        setStartWorkingDay('');
        setStartWorkingMonth('');
        setStartWorkingYear('');
        closeModal();
        setCurrentPage(1);
      } catch (err) {
        console.error(err);
        setIsSaving(false);
        setErrorMsg('Gagal memproses dan menyimpan data.');
        showToast('error', 'Gagal memproses data.');
      }
    }, 200);
  };

  const triggerDelete = (id) => {
    if (!checkAccess(user, 'delete')) {
      showError("Akses Ditolak! Anda tidak memiliki izin untuk melakukan aksi ini.");
      return;
    }
    setConfirmModal({
      isOpen: true,
      title: 'Konfirmasi Hapus',
      message: 'Apakah Anda yakin ingin menghapus data karyawan ini secara permanen dari browser?',
      confirmText: 'YA, HAPUS',
      cancelText: 'BATAL',
      onConfirm: () => executeDelete(id)
    });
  };

  const executeDelete = async (id) => {
    if (!checkAccess(user, 'delete')) {
      showError("Akses Ditolak! Anda tidak memiliki izin untuk melakukan aksi ini.");
      return;
    }
    try {
      const localData = localStorage.getItem('hris_employees') || localStorage.getItem('karyawan_data');
      if (localData) {
        const currentList = JSON.parse(localData);
        const empToDelete = currentList.find(emp => emp.id === id);
        const filteredList = currentList.filter(emp => emp.id !== id);
        localStorage.setItem('hris_employees', JSON.stringify(filteredList));
        localStorage.setItem('karyawan_data', JSON.stringify(filteredList));
        setEmployees(filteredList);
        // ⚡ GLOBAL SYNC — cabut akses karyawan dari Dashboard, Payroll, Sanksi
        hrisDispatch('EMPLOYEE_CHANGED', filteredList);

        // Delete from backend API if ID is a database integer ID
        if (empToDelete && typeof id === 'number' && id < 1000000000000) {
          try {
            await fetch(`${API_URL}/employees/${id}`, {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
          } catch (err) {
            console.error('Error deleting employee from backend database:', err);
          }
        }

        // Clean up mobile credentials
        if (empToDelete) {
          try {
            const rawCreds = localStorage.getItem('mobile_user_credentials');
            if (rawCreds) {
              const creds = JSON.parse(rawCreds);
              if (Array.isArray(creds)) {
                const filteredCreds = creds.filter(c => 
                  c.id !== id && 
                  c.profile_id !== id && 
                  c.employee_id !== empToDelete.employee_id
                );
                localStorage.setItem('mobile_user_credentials', JSON.stringify(filteredCreds));
              }
            }
          } catch (e) {
            console.error('Error cleaning mobile credentials:', e);
          }

          // Clean up custom user credentials (hris_user_passwords, hris_custom_usernames, hris_user_roles)
          try {
            const passwords = JSON.parse(localStorage.getItem('hris_user_passwords') || '{}');
            const usernames = JSON.parse(localStorage.getItem('hris_custom_usernames') || '{}');
            const roles = JSON.parse(localStorage.getItem('hris_user_roles') || '{}');
            
            let changed = false;
            if (passwords[id]) { delete passwords[id]; changed = true; }
            if (usernames[id]) { delete usernames[id]; changed = true; }
            if (roles[id]) { delete roles[id]; changed = true; }
            
            if (changed) {
              localStorage.setItem('hris_user_passwords', JSON.stringify(passwords));
              localStorage.setItem('hris_custom_usernames', JSON.stringify(usernames));
              localStorage.setItem('hris_user_roles', JSON.stringify(roles));
              localStorage.setItem('user_credentials', JSON.stringify({ passwords, usernames, roles }));
              
              window.dispatchEvent(new CustomEvent('hris:storage', { detail: { key: 'hris_user_passwords', value: passwords } }));
              window.dispatchEvent(new CustomEvent('hris:storage', { detail: { key: 'hris_custom_usernames', value: usernames } }));
              window.dispatchEvent(new CustomEvent('hris:storage', { detail: { key: 'hris_user_roles', value: roles } }));
            }
          } catch (e) {
            console.error('Error cleaning credentials keys:', e);
          }
        }

        showToast('success', 'Data Berhasil Disimpan!');
      }
    } catch (err) {
      console.error(err);
      showToast('error', 'Data Gagal');
    }
  };

  const executeToggleStatus = async (emp, newStatus) => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const endWorkingDate = newStatus === 'inactive' ? todayStr : '';

      const localData = localStorage.getItem('hris_employees') || localStorage.getItem('karyawan_data');
      let currentList = localData ? JSON.parse(localData) : [];
      
      let updatedEmp = null;
      currentList = currentList.map(item => {
        if (item.id === emp.id) {
          updatedEmp = {
            ...item,
            employee_status: newStatus,
            end_working_date: endWorkingDate
          };
          return updatedEmp;
        }
        return item;
      });

      localStorage.setItem('hris_employees', JSON.stringify(currentList));
      localStorage.setItem('karyawan_data', JSON.stringify(currentList));
      setEmployees(currentList);

      if (updatedEmp) {
        // PUT request to backend API
        if (typeof emp.id === 'number' && emp.id < 1000000000000) {
          const payload = {
            full_name: updatedEmp.full_name,
            phone: updatedEmp.whatsapp_number,
            address: updatedEmp.address,
            position: updatedEmp.position,
            department: 'Operasional',
            basic_salary: updatedEmp.basic_salary,
            status: newStatus,
            joined_date: updatedEmp.start_working_date,
            end_working_date: updatedEmp.end_working_date,
            outlet: updatedEmp.outlet,
            gender: updatedEmp.gender
          };

          await fetch(`${API_URL}/employees/${emp.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
          });
        }
      }
      showToast('success', 'Data Berhasil Disimpan!');
      setCurrentPage(1);
    } catch (err) {
      console.error('Error in executeToggleStatus:', err);
      showToast('error', 'Gagal memproses perubahan status.');
    }
  };

  const handleToggleStatus = (emp) => {
    if (!checkAccess(user, 'edit')) {
      showError("Akses Ditolak! Anda tidak memiliki izin untuk melakukan aksi ini.");
      return;
    }
    const newStatus = emp.employee_status === 'active' ? 'inactive' : 'active';

    // Validasi reaktivasi: minimal 3 bulan sejak dinonaktifkan
    if (newStatus === 'active' && emp.end_working_date) {
      const deactivationDate = new Date(emp.end_working_date);
      const now = new Date();
      const diffMs = now.getTime() - deactivationDate.getTime();
      const diffMonths = diffMs / (1000 * 60 * 60 * 24 * 30.44); // approximate months
      if (diffMonths < 3) {
        showError("Karyawan baru bisa diaktifkan kembali minimal 3 bulan setelah dinonaktifkan.");
        return;
      }
    }

    const confirmMsg = newStatus === 'inactive'
      ? `Apakah Anda yakin ingin menonaktifkan karyawan ${toTitleCase(emp.full_name)}?`
      : `Apakah Anda yakin ingin mengaktifkan kembali karyawan ${toTitleCase(emp.full_name)}?`;

    setConfirmModal({
      isOpen: true,
      title: 'Konfirmasi Ubah Status',
      message: confirmMsg,
      confirmText: 'Yakin',
      cancelText: 'BATAL',
      onConfirm: () => executeToggleStatus(emp, newStatus)
    });
  };

  const handleDownloadPDF = (tab) => {
    setPdfPreviewModal({ isOpen: true, tab });
  };

  const loadJsPDFAndGenerate = (tab) => {
    setIsExportingPDF(true);
    setPdfGenerating(true);
    setTimeout(() => {
      try {
        generatePDFWithJsPDF(tab);
        setPdfGenerating(false);
        setPdfPreviewModal({ isOpen: false, tab: 'active' });
        showToast('success', 'Laporan PDF berhasil dibuat dan diunduh!');
        resetFiltersToDefault();
      } catch (err) {
        console.error('PDF generation error:', err);
        setPdfGenerating(false);
        showToast('error', 'Gagal membuat PDF: ' + (err.message || 'Error tidak diketahui.'));
      } finally {
        setIsExportingPDF(false);
      }
    }, 200);
  };

  const generatePDFWithJsPDF = (tab) => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const pageW = doc.internal.pageSize.getWidth();

    // ---- Header Block ----
    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, pageW, 38, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text(capitalEachWord('LAPORAN DATA KARYAWAN BAROKAH GRUP'), 14, 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(180, 180, 180);
    const tipeLabel = tab === 'active' ? 'Karyawan Aktif' : 'Karyawan Inactive';
    const filterOutletLabel = uiSelectedOutlets.length === outlets.length ? 'Semua Outlet' : uiSelectedOutlets.join(', ');
    const filterPosLabel = uiSelectedPosition === 'Semua Jabatan' ? 'Semua Jabatan' : uiSelectedPosition;
    const filterBulanLabel = uiSelectedMonth === 'Semua Bulan' ? 'Semua Bulan' : BULAN_INDO[parseInt(uiSelectedMonth, 10) - 1];
    const filterTahunLabel = uiSelectedYear === 'Semua Tahun' ? 'Semua Tahun' : uiSelectedYear;
    doc.text(capitalEachWord(`Tipe: ${tipeLabel}  |  Outlet: ${filterOutletLabel}  |  Jabatan: ${filterPosLabel}  |  Periode: ${filterBulanLabel} ${filterTahunLabel}`), 14, 22);
    doc.text(capitalEachWord(`Tanggal Cetak: ${new Date().toLocaleDateString('id-ID', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}  |  Pukul: ${new Date().toLocaleTimeString('id-ID')}`), 14, 28);

    const rows = filteredEmployees.filter(emp =>
      tab === 'active' ? emp.employee_status !== 'inactive' : emp.employee_status === 'inactive'
    );

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.text(capitalEachWord(`Total Data: ${rows.length} karyawan`), 14, 34);

    let headers, data;

    if (tab === 'active') {
      headers = [[capitalEachWord('ID KARYAWAN'), capitalEachWord('NAMA LENGKAP'), capitalEachWord('NAMA PANGGILAN'), capitalEachWord('JABATAN'), capitalEachWord('OUTLET'), capitalEachWord('MULAI BEKERJA'), capitalEachWord('LAMA BEKERJA'), capitalEachWord('JENIS KELAMIN'), capitalEachWord('STATUS PERNIKAHAN')]];
      data = rows.map((emp) => [
        emp.employee_id || '-',
        capitalEachWord(emp.full_name),
        capitalEachWord(emp.nickname) || '-',
        capitalEachWord(emp.position),
        capitalEachWord(emp.outlet) || '-',
        emp.start_working_date || '-',
        calculateLamaBekerja(emp.start_working_date),
        capitalEachWord(emp.gender) || '-',
        capitalEachWord(emp.marital_status) || '-'
      ]);
    } else {
      headers = [[capitalEachWord('NAMA KARYAWAN'), capitalEachWord('NAMA PANGGILAN'), capitalEachWord('JABATAN'), capitalEachWord('OUTLET'), capitalEachWord('MULAI BEKERJA'), capitalEachWord('BERHENTI BEKERJA'), capitalEachWord('LAMA BEKERJA'), capitalEachWord('JENIS KELAMIN')]];
      data = rows.map((emp) => [
        capitalEachWord(emp.full_name),
        capitalEachWord(emp.nickname) || '-',
        capitalEachWord(emp.position),
        capitalEachWord(emp.outlet) || '-',
        emp.start_working_date || '-',
        formatIndonesianDate(emp.end_working_date),
        calculateLamaBekerja(emp.start_working_date),
        capitalEachWord(emp.gender) || '-'
      ]);
    }

    autoTable(doc, {
      startY: 42,
      head: headers,
      body: data,
      theme: 'grid',
      headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      styles: { fontSize: 7.5, cellPadding: 2.5, overflow: 'linebreak' },
      didDrawPage: (hookData) => {
        // footer on each page
        const pgH = doc.internal.pageSize.getHeight();
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text(capitalEachWord(`Barokah Grup HRIS System  —  Halaman ${hookData.pageNumber}`), 14, pgH - 6);
        doc.text(capitalEachWord(`Dicetak oleh sistem pada ${new Date().toLocaleDateString('id-ID')}`), pageW - 14, pgH - 6, { align: 'right' });
      }
    });

    const filename = `laporan_karyawan_${tab === 'active' ? 'aktif' : 'inactive'}_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(filename);
  };

  // Kalkulasi Pagination
  const indexOfLastRow = currentPage * 10;
  const indexOfFirstRow = indexOfLastRow - 10;
  const currentRows = filteredEmployees.slice(indexOfFirstRow, indexOfLastRow);
  const totalPages = Math.ceil(filteredEmployees.length / 10);

  const handlePageChange = (pageNumber) => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentPage(pageNumber);
      setIsTransitioning(false);
    }, 200);
  };

  // Helper to get ideal staff target
  const getIdealStaffTarget = () => {
    try {
      const cached = JSON.parse(localStorage.getItem('target_staf_data') || '[]');
      if (!Array.isArray(cached) || cached.length === 0) return 8;

      const currentDate = new Date();
      const currentMonthIndo = BULAN_INDO[currentDate.getMonth()];
      const currentYearStr = String(currentDate.getFullYear());

      let targetMonth = activeMonth === 'Semua Bulan' ? currentMonthIndo : BULAN_INDO[parseInt(activeMonth, 10) - 1];
      let targetYear = activeYear === 'Semua Tahun' ? currentYearStr : activeYear;

      let sum = 0;
      let matchedAny = false;

      activeOutlets.forEach(outName => {
        const match = cached.find(t => 
          (t.outlet_name || '').trim().toUpperCase() === outName.trim().toUpperCase() &&
          (t.bulan || '').trim().toLowerCase() === targetMonth.trim().toLowerCase() &&
          String(t.tahun).trim() === String(targetYear).trim()
        );
        if (match) {
          sum += parseInt(match.target_staf, 10) || 0;
          matchedAny = true;
        }
      });

      return matchedAny ? sum : 8;
    } catch (e) {
      console.error('Error calculating ideal staff target:', e);
      return 8;
    }
  };

  // Helper to format Indonesian dates
  const formatIndonesianDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '-';
      const day = date.getDate();
      const monthIndex = date.getMonth();
      const year = date.getFullYear();
      return `${day} ${BULAN_INDO[monthIndex]} ${year}`;
    } catch (e) {
      return '-';
    }
  };

  // Tab 1 Metrics calculations
  const activeCountFiltered = filteredEmployees.filter(e => e.employee_status === 'active').length;
  const activePria = filteredEmployees.filter(e => e.employee_status === 'active' && (e.gender || '').toLowerCase() === 'pria').length;
  const activeWanita = filteredEmployees.filter(e => e.employee_status === 'active' && (e.gender || '').toLowerCase() === 'wanita').length;
  const totalInactiveOverall = employees.filter(e => e.employee_status === 'inactive').length;
  const idealStaffTarget = getIdealStaffTarget();
  const activeStaffRatio = idealStaffTarget > 0 ? (activeCountFiltered / idealStaffTarget) : 0;

  // Tab 2 Metrics calculations
  const totalInactiveFiltered = employees.filter(e => 
    e.employee_status === 'inactive' && 
    activeOutlets.map(o => o.toUpperCase()).includes((e.outlet || '').toUpperCase())
  ).length;
  const inactivePria = filteredEmployees.filter(e => e.employee_status === 'inactive' && (e.gender || '').toLowerCase() === 'pria').length;
  const inactiveWanita = filteredEmployees.filter(e => e.employee_status === 'inactive' && (e.gender || '').toLowerCase() === 'wanita').length;
  const inactiveMonthYearCount = filteredEmployees.filter(e => e.employee_status === 'inactive').length;

  const getStatusLabel = (status) => {
    if (status === 'active' || status === 'aktif') return 'Active';
    if (status === 'inactive' || status === 'tidak aktif' || status === 'nonaktif') return 'Inactive';
    return toTitleCase(status);
  };


  const getPositionLabel = (pos) => {
    const validPos = getClosestValidPosition(pos);
    switch (validPos) {
      case 'supervisor': return 'Supervisor';
      case 'admin': return 'Admin';
      case 'quality control': return 'Quality Control';
      case 'kepala cabang': return 'Kepala Cabang';
      case 'kepala produksi': return 'Kepala Produksi';
      case 'kepala layanan': return 'Kepala Layanan';
      case 'koki': return 'Koki';
      case 'helper': return 'Helper';
      case 'waiters': return 'Waiters';
      default: return 'Helper';
    }
  };

  const calculateLamaBekerja = (startDateStr) => {
    if (!startDateStr) return '-';
    try {
      const start = new Date(startDateStr);
      const now = new Date();
      if (isNaN(start.getTime())) return '-';
      
      const yearDiff = now.getFullYear() - start.getFullYear();
      const monthDiff = now.getMonth() - start.getMonth();
      const totalMonths = yearDiff * 12 + monthDiff;
      
      if (totalMonths < 0) return '0 Bulan';
      return `${totalMonths} Bulan`;
    } catch (e) {
      return '-';
    }
  };

  const renderFormModal = () => {
    if (view !== 'add' && view !== 'edit') return null;

    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(2, 4, 10, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '60px',
        paddingBottom: '40px',
        overflowY: 'auto',
        zIndex: 1000,
        opacity: isClosingModal ? 0 : 1,
        transition: 'opacity 0.3s ease-in-out',
      }}>
        <div className="glass-card animate-fade-in" style={{ padding: '30px', maxWidth: '900px', width: '90%', margin: '0 auto', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
          
          {/* Saving Loading Spinner Overlay */}
          {isSaving && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              background: 'rgba(15, 23, 42, 0.7)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 100,
              borderRadius: '16px'
            }}>
              <div className="loading-spinner" style={{ borderTopColor: '#00ADB5', boxShadow: `0 0 15px #00ADB533` }}></div>
              <p style={{ color: '#fff', fontSize: '0.95rem', fontWeight: 600 }}>Menyimpan data...</p>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '30px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
            <button 
              type="button" 
              onClick={closeModal} 
              className="btn-secondary" 
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 16px', height: '40px' }}
            >
              <ChevronLeft size={18} />
              <span>Batal & Tutup</span>
            </button>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', margin: 0 }}>
              {view === 'edit' ? 'Ubah Rincian Data Karyawan' : (view === 'add' && formData.employee_status === 'inactive' ? 'Pindahkan Karyawan ke Inaktif' : 'Daftarkan Karyawan Baru')}
            </h2>
          </div>

          {view === 'add' && formData.employee_status === 'inactive' ? renderAddInactiveModalContent() : (
            <form onSubmit={triggerSave} noValidate>
              {errorMsg && <p style={{ color: 'var(--danger)', background: 'var(--danger-glow)', padding: '12px', borderRadius: '10px', marginBottom: '20px', fontSize: '0.9rem', border: '1px solid hsla(0, 84%, 60%, 0.2)' }}>{errorMsg}</p>}
              {successMsg && <p style={{ color: 'var(--success)', background: 'var(--success-glow)', padding: '12px', borderRadius: '10px', marginBottom: '20px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid hsla(142, 70%, 45%, 0.2)' }}><CheckCircle size={16} /> {successMsg}</p>}

              {/* Live ID Card Preview */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(223, 177, 91, 0.15), rgba(16, 23, 38, 0.8))',
                border: '1px solid var(--accent-primary)',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                gap: '20px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
              }}>
                <div style={{
                  width: '70px',
                  height: '70px',
                  borderRadius: '8px',
                  border: '1px solid var(--accent-primary)',
                  overflow: 'hidden',
                  background: 'rgba(0,0,0,0.3)',
                  flexShrink: 0
                }}>
                  {photoPreview ? (
                    <img src={photoPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '0.62rem', fontWeight: 700 }}>NO FOTO</div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '1px' }}>PREVIEW KARYAWAN</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>{formData.full_name || 'NAMA KARYAWAN'}</div>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    <span>ID: <strong style={{ color: 'var(--accent-primary)' }}>{formData.employee_id || 'AUTO_ID'}</strong></span>
                    <span>•</span>
                    <span>Jabatan: <strong>{formData.position ? toTitleCase(formData.position) : '—'}</strong></span>
                    <span>•</span>
                    <span>Outlet: <strong>{formData.outlet || '—'}</strong></span>
                  </div>
                </div>
              </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px', marginBottom: '24px' }}>
              {/* Bagian Kiri: Identitas Utama */}
              <div className="glass-card" style={{ padding: '24px', background: 'rgba(15, 23, 42, 0.4)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--primary-solid)', textTransform: 'uppercase', marginBottom: '16px', letterSpacing: '0.5px' }}>INFORMASI PRIBADI</h3>
                
                {/* Unggah Foto Profil */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px' }}>
                  <div style={{
                    width: '110px',
                    height: '110px',
                    borderRadius: '10px',
                    border: '2px dashed var(--accent-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    background: 'rgba(0,0,0,0.2)',
                    marginBottom: '10px',
                    position: 'relative'
                  }}>
                    {photoPreview ? (
                      <img 
                        src={photoPreview} 
                        alt="Foto Profil" 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                      />
                    ) : (
                      <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.72rem', padding: '10px' }}>
                        Belum Ada Foto
                      </div>
                    )}
                  </div>
                  <input 
                    type="file" 
                    id="employee-photo-input"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setPhotoBase64(reader.result);
                          setPhotoPreview(reader.result);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    style={{ display: 'none' }}
                  />
                  <button
                    type="button"
                    onClick={() => document.getElementById('employee-photo-input').click()}
                    style={{
                      background: 'rgba(59, 130, 246, 0.1)',
                      color: 'var(--accent-primary)',
                      border: '1px solid var(--accent-primary)',
                      borderRadius: '8px',
                      padding: '6px 12px',
                      fontSize: '0.78rem',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    Unggah Foto Profil
                  </button>
                </div>

                <div className="input-group" style={{ marginBottom: '16px' }}>
                  <label>ID KARYAWAN (OTOMATIS)</label>
                  <input 
                    type="text" 
                    name="employee_id" 
                    className="input-field" 
                    value={formData.employee_id || ''} 
                    disabled={true} 
                    placeholder="Akan digenerate otomatis..." 
                    style={{
                      color: 'var(--text-main)',
                      fontWeight: 'bold',
                      background: 'rgba(65, 45, 21, 0.25)',
                      border: '1px solid var(--border-color)',
                    }}
                  />
                </div>

                <div className="input-group" style={{ marginBottom: '16px' }}>
                  <label>NAMA LENGKAP</label>
                  <input 
                    type="text" 
                    name="full_name" 
                    className="input-field" 
                    value={formData.full_name} 
                    onChange={handleInputChange} 
                    placeholder="Nama lengkap sesuai KTP" 
                    style={fieldErrors.full_name ? { borderColor: 'var(--danger)', boxShadow: '0 0 0 2px var(--danger-glow)' } : {}}
                    required 
                  />
                  {fieldErrors.full_name && (
                    <span style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertCircle size={12} /> {fieldErrors.full_name}
                    </span>
                  )}
                </div>

                <div className="input-group" style={{ marginBottom: '16px' }}>
                  <label>NAMA PANGGILAN</label>
                  <input 
                    type="text" 
                    name="nickname" 
                    className="input-field" 
                    value={formData.nickname} 
                    onChange={handleInputChange} 
                    placeholder="Nama panggilan sehari-hari" 
                    style={fieldErrors.nickname ? { borderColor: 'var(--danger)', boxShadow: '0 0 0 2px var(--danger-glow)' } : {}}
                    required 
                  />
                  {fieldErrors.nickname && (
                    <span style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertCircle size={12} /> {fieldErrors.nickname}
                    </span>
                  )}
                </div>

                <div className="input-group" style={{ marginBottom: '16px' }}>
                  <label>NOMOR INDUK KARYAWAN (NIK)</label>
                  <input 
                    type="text" 
                    name="nik" 
                    className="input-field" 
                    value={formData.nik} 
                    onChange={handleInputChange} 
                    placeholder="Contoh: 3201XXXXXXXXXXXX" 
                    style={fieldErrors.nik ? { borderColor: 'var(--danger)', boxShadow: '0 0 0 2px var(--danger-glow)' } : {}}
                    required 
                    disabled={view === 'edit'} 
                  />
                  {fieldErrors.nik && (
                    <span style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertCircle size={12} /> {fieldErrors.nik}
                    </span>
                  )}
                </div>

                <div className="input-group" style={{ marginBottom: '16px' }}>
                  <label>JENIS KELAMIN</label>
                  <select 
                    name="gender" 
                    className="input-field" 
                    value={formData.gender} 
                    onChange={handleInputChange} 
                    style={{ background: 'var(--bg-main)', color: '#fff' }} 
                    required
                  >
                    <option value="Pria">Pria</option>
                    <option value="wanita">Wanita</option>
                  </select>
                </div>

                <div className="input-group">
                  <label>STATUS PERNIKAHAN</label>
                  <select 
                    name="marital_status" 
                    className="input-field" 
                    value={formData.marital_status} 
                    onChange={handleInputChange} 
                    style={{ background: 'var(--bg-main)', color: '#fff' }} 
                    required
                  >
                    <option value="Belum menikah">Belum Menikah</option>
                    <option value="menikah tanpa anak">Menikah Tanpa Anak</option>
                    <option value="menikah dengan anak">Menikah Dengan Anak</option>
                    <option value="duda">Duda</option>
                    <option value="janda">Janda</option>
                  </select>
                </div>
              </div>

              {/* Bagian Kanan: Informasi Pekerjaan & Sosial */}
              <div className="glass-card" style={{ padding: '24px', background: 'rgba(15, 23, 42, 0.4)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--primary-solid)', textTransform: 'uppercase', marginBottom: '16px', letterSpacing: '0.5px' }}>INFORMASI JABATAN & KONTAK</h3>

                <div className="input-group" style={{ marginBottom: '16px' }}>
                  <label>STATUS KARYAWAN</label>
                  <select 
                    name="employee_status" 
                    className="input-field" 
                    value={formData.employee_status} 
                    onChange={handleInputChange} 
                    style={{ background: 'var(--bg-main)', color: '#fff' }} 
                    required
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                {/* Tanggal Terakhir Bekerja - Only visible and required when status is inactive */}
                {formData.employee_status === 'inactive' && (
                  <div className="input-group" style={{ marginBottom: '16px' }}>
                    <label>TANGGAL TERAKHIR BEKERJA</label>
                    <input 
                      type="date" 
                      name="end_working_date" 
                      className="input-field" 
                      value={formData.end_working_date} 
                      onChange={handleInputChange} 
                      style={fieldErrors.end_working_date ? { borderColor: 'var(--danger)', boxShadow: '0 0 0 2px var(--danger-glow)' } : {}}
                      required 
                    />
                    {fieldErrors.end_working_date && (
                      <span style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <AlertCircle size={12} /> {fieldErrors.end_working_date}
                      </span>
                    )}
                  </div>
                )}

                <div className="input-group" style={{ marginBottom: '16px' }}>
                  <label>JABATAN</label>
                  <select 
                    name="position" 
                    className="input-field" 
                    value={formData.position} 
                    onChange={handleInputChange} 
                    style={{ background: 'var(--bg-main)', color: '#fff', textTransform: 'capitalize' }} 
                    required
                  >
                    {positionOptions.map((pos) => (
                      <option key={pos} value={pos.toLowerCase()}>
                        {toTitleCase(pos)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="input-group" style={{ marginBottom: '16px' }}>
                  <label>MULAI BEKERJA</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                    {/* Select Hari/Tanggal */}
                    <div>
                      <select
                        value={startWorkingDay}
                        onChange={(e) => setStartWorkingDay(e.target.value)}
                        className="input-field"
                        style={{ background: 'var(--bg-main)', color: '#fff', border: '1px solid var(--border-color)', height: '42px' }}
                        required
                      >
                        <option value="">Hari / Tanggal</option>
                        {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                          <option key={d} value={String(d)}>{d}</option>
                        ))}
                      </select>
                    </div>

                    {/* Select Bulan */}
                    <div>
                      <select
                        value={startWorkingMonth}
                        onChange={(e) => setStartWorkingMonth(e.target.value)}
                        className="input-field"
                        style={{ background: 'var(--bg-main)', color: '#fff', border: '1px solid var(--border-color)', height: '42px' }}
                        required
                      >
                        <option value="">Pilih Bulan</option>
                        {BULAN_INDO.map((bln, idx) => (
                          <option key={idx} value={String(idx + 1)}>{bln}</option>
                        ))}
                      </select>
                    </div>

                    {/* Select Tahun */}
                    <div>
                      <select
                        value={startWorkingYear}
                        onChange={(e) => setStartWorkingYear(e.target.value)}
                        className="input-field"
                        style={{ background: 'var(--bg-main)', color: '#fff', border: '1px solid var(--border-color)', height: '42px' }}
                        required
                      >
                        <option value="">Pilih Tahun</option>
                        <option value="2020">2020</option>

                        <option value="2021">2021</option>

                        <option value="2022">2022</option>

                        <option value="2023">2023</option>

                        <option value="2024">2024</option>

                        <option value="2025">2025</option>

                        <option value="2026">2026</option>

                        <option value="2027">2027</option>

                        <option value="2028">2028</option>

                        <option value="2029">2029</option>

                        <option value="2030">2030</option>

                        <option value="2031">2031</option>

                        <option value="2032">2032</option>

                        <option value="2033">2033</option>

                        <option value="2034">2034</option>

                        <option value="2035">2035</option>

                        <option value="2036">2036</option>

                        <option value="2037">2037</option>

                        <option value="2038">2038</option>

                        <option value="2039">2039</option>

                        <option value="2040">2040</option>
                      </select>
                    </div>
                  </div>
                  {fieldErrors.start_working_date && (
                    <span style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertCircle size={12} /> {fieldErrors.start_working_date}
                    </span>
                  )}
                </div>

                <div className="input-group" style={{ marginBottom: '16px' }}>
                  <label>OUTLET</label>
                  <select 
                    name="outlet" 
                    className="input-field" 
                    value={formData.outlet} 
                    onChange={handleInputChange} 
                    style={{ background: 'var(--bg-main)', color: '#fff', ...(fieldErrors.outlet ? { borderColor: 'var(--danger)', boxShadow: '0 0 0 2px var(--danger-glow)' } : {}) }} 
                    required
                    disabled={outlets.length === 0}
                  >
                    <option value="">{outlets.length === 0 ? '-- Outlet Kosong, Silakan Tambah Dahulu --' : '-- Pilih Outlet Cabang --'}</option>
                    {outlets.map((o, idx) => (
                      <option key={idx} value={o}>{toTitleCase(o)}</option>
                    ))}
                  </select>
                  {fieldErrors.outlet && (
                    <span style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertCircle size={12} /> {fieldErrors.outlet}
                    </span>
                  )}
                </div>

                <div className="input-group">
                  <label>NOMOR WHATSAPP AKTIF</label>
                  <input 
                    type="text" 
                    name="whatsapp_number" 
                    className="input-field" 
                    placeholder="Contoh: 08123456789" 
                    value={formData.whatsapp_number} 
                    onChange={handleInputChange} 
                    style={fieldErrors.whatsapp_number ? { borderColor: 'var(--danger)', boxShadow: '0 0 0 2px var(--danger-glow)' } : {}}
                    required 
                  />
                  {fieldErrors.whatsapp_number && (
                    <span style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertCircle size={12} /> {fieldErrors.whatsapp_number}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Bagian Bawah: Sosial Media & Alamat */}
            <div className="glass-card" style={{ padding: '24px', background: 'rgba(15, 23, 42, 0.4)', border: '1px solid var(--border-color)', borderRadius: '12px', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--primary-solid)', textTransform: 'uppercase', marginBottom: '16px', letterSpacing: '0.5px' }}>ALAMAT & AKUN SOSIAL MEDIA</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div className="input-group">
                  <label>AKUN FACEBOOK (OPSIONAL)</label>
                  <input 
                    type="text" 
                    name="facebook_account" 
                    className="input-field" 
                    placeholder="Username / Tautan Facebook" 
                    value={formData.facebook_account} 
                    onChange={handleInputChange} 
                    style={fieldErrors.facebook_account ? { borderColor: 'var(--danger)', boxShadow: '0 0 0 2px var(--danger-glow)' } : {}}
                  />
                  {fieldErrors.facebook_account && (
                    <span style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertCircle size={12} /> {fieldErrors.facebook_account}
                    </span>
                  )}
                </div>
                <div className="input-group">
                  <label>AKUN INSTAGRAM (OPSIONAL)</label>
                  <input 
                    type="text" 
                    name="instagram_account" 
                    className="input-field" 
                    placeholder="Username Instagram" 
                    value={formData.instagram_account} 
                    onChange={handleInputChange} 
                    style={fieldErrors.instagram_account ? { borderColor: 'var(--danger)', boxShadow: '0 0 0 2px var(--danger-glow)' } : {}}
                  />
                  {fieldErrors.instagram_account && (
                    <span style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertCircle size={12} /> {fieldErrors.instagram_account}
                    </span>
                  )}
                </div>
              </div>

              <div className="input-group">
                <label>ALAMAT LENGKAP</label>
                <textarea 
                  name="address" 
                  rows="3" 
                  className="input-field" 
                  value={formData.address} 
                  onChange={handleInputChange} 
                  placeholder="Tuliskan alamat lengkap tinggal saat ini..." 
                  style={{ resize: 'none', ...(fieldErrors.address ? { borderColor: 'var(--danger)', boxShadow: '0 0 0 2px var(--danger-glow)' } : {}) }} 
                  required
                ></textarea>
                {fieldErrors.address && (
                  <span style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertCircle size={12} /> {fieldErrors.address}
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
              <button type="button" className="btn-secondary" onClick={closeModal} style={{ height: '44px', width: '120px' }}>Batal</button>
              <button type="submit" className="btn-primary" style={{ height: '44px', width: '200px' }}>{view === 'edit' ? 'Simpan Perubahan' : 'Daftarkan Karyawan'}</button>
            </div>
          </form>
        )}
        </div>
      </div>
    );
  };

  return (
    <div className="glass-card animate-fade-in" style={{ padding: '30px', position: 'relative' }}>
      
      {/* 0.3s Theme Filter Spinner Overlay */}
      {filterLoading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(34, 40, 49, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
        }}>
          <div className="loading-spinner" style={{ borderTopColor: getThemeColor(), boxShadow: `0 0 15px ${getThemeColor()}33` }}></div>
          <p style={{ marginTop: '16px', color: '#fff', fontSize: '0.9rem', fontWeight: 600 }}>Menyaring data...</p>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toast.show && (
        <div className={`toast-notification ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>
          {toast.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          <span className="toast-message">{toast.message}</span>
        </div>
      )}

      {/* GLOBAL PERSISTENT MULTI-FILTER CONTROL HEADER */}
      <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '24px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
        
        {/* Multi-Select Outlet Dropdown */}
        <div style={{ position: 'relative' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 700 }}>OUTLET CABANG</label>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setShowOutletFilter(!showOutletFilter)}
            style={{ height: '42px', display: 'flex', alignItems: 'center', gap: '8px', padding: '0 16px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', cursor: 'pointer' }}
          >
            <Filter size={16} />
            <span>{uiSelectedOutlets.length === outlets.length ? 'Semua Outlet' : `${uiSelectedOutlets.length} Outlet`}</span>
          </button>
          {showOutletFilter && (
            <>
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 40 }} onClick={() => setShowOutletFilter(false)} />
              <div className="glass-card animate-fade-in" style={{
                position: 'absolute',
                left: 0,
                top: '68px',
                zIndex: 50,
                padding: '16px',
                minWidth: '220px',
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
                <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary-solid)', textTransform: 'uppercase', marginBottom: '4px' }}>PILIH OUTLET</h4>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#fff', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '6px' }}>
                  <input
                    type="checkbox"
                    checked={isAllOutletsSelected}
                    onChange={handleAllOutletsChange}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--primary-solid)' }}
                  />
                  <span style={{ fontWeight: 'bold' }}>Semua Outlet</span>
                </label>
                <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {outlets.map((out, idx) => (
                    <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#fff', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={uiSelectedOutlets.includes(out)}
                        onChange={() => handleOutletCheckboxChange(out)}
                        style={{ width: '16px', height: '16px', accentColor: 'var(--primary-solid)' }}
                      />
                      <span>{toTitleCase(out)}</span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Dropdown Jabatan */}
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 700 }}>JABATAN</label>
          <select
            className="input-field"
            value={uiSelectedPosition}
            onChange={(e) => handlePositionChange(e.target.value)}
            style={{ height: '42px', minWidth: '150px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', color: '#fff' }}
          >
            <option value="Semua Jabatan">Semua Jabatan</option>
            {positionOptions.map(pos => (
              <option key={pos} value={pos.toLowerCase()}>{toTitleCase(pos)}</option>
            ))}
          </select>
        </div>

        {/* Dropdown Bulan */}
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 700 }}>BULAN</label>
          <select
            className="input-field"
            value={uiSelectedMonth}
            onChange={(e) => handleMonthChange(e.target.value)}
            style={{ height: '42px', minWidth: '140px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', color: '#fff' }}
          >
            <option value="Semua Bulan">Semua Bulan</option>
            {BULAN_INDO.map((bln, idx) => (
              <option key={idx} value={idx + 1}>{bln}</option>
            ))}
          </select>
        </div>

        {/* Dropdown Tahun */}
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 700 }}>TAHUN</label>
          <select
            className="input-field"
            value={uiSelectedYear}
            onChange={(e) => handleYearChange(e.target.value)}
            style={{ height: '42px', minWidth: '120px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', color: '#fff' }}
          >
            <option value="Semua Tahun">Semua Tahun</option>
            <option value="2020">2020</option>

            <option value="2021">2021</option>

            <option value="2022">2022</option>

            <option value="2023">2023</option>

            <option value="2024">2024</option>

            <option value="2025">2025</option>

            <option value="2026">2026</option>

            <option value="2027">2027</option>

            <option value="2028">2028</option>

            <option value="2029">2029</option>

            <option value="2030">2030</option>

            <option value="2031">2031</option>

            <option value="2032">2032</option>

            <option value="2033">2033</option>

            <option value="2034">2034</option>

            <option value="2035">2035</option>

            <option value="2036">2036</option>

            <option value="2037">2037</option>

            <option value="2038">2038</option>

            <option value="2039">2039</option>

            <option value="2040">2040</option>
          </select>
        </div>
        
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', color: 'transparent', marginBottom: '6px', fontWeight: 700 }}>Export</label>
          <button
            id="global-pdf-btn"
            onClick={() => loadJsPDFAndGenerate(activeTab)}
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

      {/* ─── SUMMARY CARDS BAR ─────────────────────────────────────────────────── */}
      {(() => {
        const C = {
          bg:          '#222831',
          surface:     '#393E46',
          cyan:        '#00ADB5',
          text:        '#EEEEEE',
          muted:       '#9EA8B3',
          border:      'rgba(238,238,238,0.1)',
          danger:      '#E05C5C',
          success:     '#4ECDC4',
          warn:        '#F5A623',
        };

        const summCards = [
          {
            id: 'jumlah-aktif',
            icon: '👷',
            label: 'Jumlah Aktif',
            value: `${activeCountFiltered} Orang`,
            sub: `matching filter`,
            color: C.cyan,
          },
          {
            id: 'rasio-gender',
            icon: '👫',
            label: 'Rasio Gender',
            value: `L: ${activePria} | P: ${activeWanita}`,
            sub: `Karyawan aktif`,
            color: C.warn,
          },
          {
            id: 'total-inaktif',
            icon: '⚠️',
            label: 'Total Inaktif',
            value: `${totalInactiveOverall} Orang`,
            sub: `${totalInactiveFiltered} matching filter`,
            color: C.danger,
          },
          {
            id: 'rasio-staf-ideal',
            icon: '🎯',
            label: 'Rasio Staf Ideal (7/8)',
            value: `${activeCountFiltered} / ${idealStaffTarget}`,
            sub: `${(activeStaffRatio * 100).toFixed(0)}% Keterpenuhan`,
            color: C.success,
          }
        ];

        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '24px' }}>
            {summCards.map(card => (
              <div key={card.id} style={{
                background: `linear-gradient(135deg, ${C.surface}, ${C.bg})`,
                border: `1px solid ${card.color}33`,
                borderRadius: '12px',
                padding: '14px 16px',
                position: 'relative',
                overflow: 'hidden',
                cursor: 'default',
                transition: 'border-color 0.2s ease',
              }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, ${card.color}, ${card.color}44)`, borderRadius: '12px 12px 0 0' }} />
                <div style={{ fontSize: '1.2rem', marginBottom: '8px' }}>{card.icon}</div>
                <div style={{ fontSize: '0.62rem', fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '3px' }}>{card.label}</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 900, color: card.color, lineHeight: 1.1, marginBottom: '4px' }}>{card.value}</div>
                <div style={{ fontSize: '0.6rem', color: C.muted, fontWeight: 500 }}>{card.sub}</div>
                <div style={{ position: 'absolute', bottom: -15, right: -15, width: 45, height: 45, borderRadius: '50%', background: `${card.color}22`, filter: 'blur(15px)', pointerEvents: 'none' }} />
              </div>
            ))}
          </div>
        );
      })()}

      {/* TAB SWITCH BUTTONS */}
      <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '24px' }}>
        <button
          type="button"
          onClick={() => { setActiveTab('active'); setCurrentPage(1); }}
          style={{
            padding: '10px 20px',
            fontSize: '0.9rem',
            fontWeight: 800,
            background: activeTab === 'active' ? 'var(--text-main)' : 'transparent',
            color: activeTab === 'active' ? 'var(--bg-surface)' : 'var(--text-muted)',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Karyawan Aktif
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('inactive'); setCurrentPage(1); }}
          style={{
            padding: '10px 20px',
            fontSize: '0.9rem',
            fontWeight: 800,
            background: activeTab === 'inactive' ? 'var(--text-main)' : 'transparent',
            color: activeTab === 'inactive' ? 'var(--bg-surface)' : 'var(--text-muted)',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Karyawan Inactive
        </button>
      </div>

      {/* Top Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px', marginBottom: '24px' }}>
        
        {/* Search Input + Column Toggle */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: '300px' }}>
            <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Cari ..."
              className="input-field"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '40px', paddingRight: '12px', height: '42px' }}
            />
          </div>

          {/* Column Visibility Toggle Button */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setShowColFilter(!showColFilter)}
              style={{
                height: '42px',
                padding: '0 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: showColFilter ? 'var(--primary-glow)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${showColFilter ? 'var(--primary-solid)' : 'var(--border-color)'}`,
                borderRadius: '8px',
                color: showColFilter ? 'var(--primary-solid)' : 'var(--text-muted)',
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <Filter size={15} />
              <span>Kolom Tabel</span>
              <span style={{
                background: 'var(--primary-solid)',
                color: '#000',
                borderRadius: '10px',
                padding: '1px 7px',
                fontSize: '0.72rem',
                fontWeight: 800
              }}>
                {Object.values(visibleColumns).filter(Boolean).length}
              </span>
            </button>

            {showColFilter && (
              <>
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 40 }} onClick={() => setShowColFilter(false)} />
                <div className="glass-card animate-fade-in" style={{
                  position: 'absolute',
                  top: '50px',
                  left: 0,
                  zIndex: 50,
                  padding: '16px',
                  minWidth: '240px',
                  background: 'rgba(15, 23, 42, 0.97)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  boxShadow: '0 12px 35px rgba(0,0,0,0.6)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                    <h4 style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--primary-solid)', textTransform: 'uppercase', margin: 0 }}>Visibilitas Kolom</h4>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setVisibleColumns(prev => Object.fromEntries(Object.keys(prev).map(k => [k, true])))}
                        style={{ fontSize: '0.72rem', background: 'transparent', border: '1px solid var(--primary-solid)', color: 'var(--primary-solid)', borderRadius: '6px', padding: '2px 8px', cursor: 'pointer' }}
                      >Semua</button>
                      <button
                        type="button"
                        onClick={() => setVisibleColumns(prev => Object.fromEntries(Object.keys(prev).map(k => [k, k === 'employee_id' || k === 'full_name' || k === 'actions'])))}
                        style={{ fontSize: '0.72rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)', borderRadius: '6px', padding: '2px 8px', cursor: 'pointer' }}
                      >Reset</button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '320px', overflowY: 'auto' }}>
                    {Object.entries(colLabelMap).map(([key, label]) => (
                      <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '4px 6px', borderRadius: '6px', transition: 'background 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <input
                          type="checkbox"
                          checked={!!visibleColumns[key]}
                          onChange={() => setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }))}
                          style={{ width: '15px', height: '15px', accentColor: 'var(--primary-solid)', cursor: 'pointer', flexShrink: 0 }}
                        />
                        <span style={{ fontSize: '0.82rem', color: visibleColumns[key] ? '#fff' : 'var(--text-muted)', fontWeight: visibleColumns[key] ? 600 : 400, transition: 'color 0.15s' }}>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Actions Panel */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {activeTab === 'active' ? (
            <>
              {/* Download PDF Button */}
              <button
                onClick={() => handleDownloadPDF('active')}
                style={{
                  height: '42px',
                  padding: '0 20px',
                  background: '#000000',
                  color: '#ffffff',
                  border: '1px solid #ffffff',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'opacity 0.25s ease-in-out',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                <span>📥 Download Laporan PDF</span>
              </button>

              {role !== 'admin' && (
                <button className="btn-primary" onClick={openAddModal} style={{ height: '42px' }}>
                  <Plus size={18} />
                  <span>TAMBAH KARYAWAN</span>
                </button>
              )}
            </>
          ) : (
            <>
              {/* Download PDF Button */}
              <button
                onClick={() => handleDownloadPDF('inactive')}
                style={{
                  height: '42px',
                  padding: '0 20px',
                  background: '#000000',
                  color: '#ffffff',
                  border: '1px solid #ffffff',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'opacity 0.25s ease-in-out',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                <span>📥 Download Laporan PDF</span>
              </button>

              {role !== 'admin' && (
                <button className="btn-primary" onClick={openAddInactiveModal} style={{ height: '42px' }}>
                  <Plus size={18} />
                  <span>➕ TAMBAH KARYAWAN INACTIVE</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Main Table */}
      {loading ? (
        <div className="spinner-container">
          <div className="loading-spinner" style={{ borderTopColor: getThemeColor(), boxShadow: `0 0 15px ${getThemeColor()}33` }}></div>
          <p className="loading-text">Memuat data karyawan secara aman...</p>
        </div>
      ) : (
        <div className="table-container">
          {activeTab === 'active' ? (
            <table className="data-table" style={{ fontSize: '12px' }}>
              <thead>
                <tr>
                  {visibleColumns.employee_id && <th className="sticky-col-1">Id Karyawan</th>}
                  {visibleColumns.full_name && <th className={!visibleColumns.employee_id ? 'sticky-col-1' : 'sticky-col-2'}>Nama Lengkap</th>}
                  {visibleColumns.nickname && <th>Nama Panggilan</th>}
                  {visibleColumns.employee_status && <th>Status</th>}
                  {visibleColumns.position && <th>Jabatan</th>}
                  {visibleColumns.outlet && <th>Nama Outlet</th>}
                  {visibleColumns.start_working_date && <th>Mulai Bekerja</th>}
                  {visibleColumns.working_duration && <th>Lama Bekerja</th>}
                  {visibleColumns.gender && <th>Jenis Kelamin</th>}
                  {visibleColumns.marital_status && <th>Status Pernikahan</th>}
                  {visibleColumns.whatsapp_number && <th>Nomor WA</th>}
                  {visibleColumns.nik && <th>NIK</th>}
                  {visibleColumns.address && <th>Alamat</th>}
                  {visibleColumns.facebook_account && <th>Facebook</th>}
                  {visibleColumns.instagram_account && <th>Instagram</th>}
                  {visibleColumns.actions && <th>Aksi</th>}
                </tr>
              </thead>
              <tbody style={{
                opacity: isTransitioning ? 0 : 1,
                transform: isTransitioning ? 'scale(0.99)' : 'scale(1)',
                transition: 'opacity 0.4s ease-in-out, transform 0.3s ease'
              }}>
                {currentRows.length === 0 ? (
                  <tr>
                    <td colSpan={Object.values(visibleColumns).filter(Boolean).length || 1} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Tidak ada data karyawan aktif ditemukan.</td>
                  </tr>
                ) : (
                  currentRows.map((emp) => {
                    const isInactive = emp.employee_status === 'inactive';
                    return (
                      <tr 
                        key={emp.id} 
                        style={isInactive ? { backgroundColor: '#ef4444', color: '#ffffff' } : {}}
                      >
                        {visibleColumns.employee_id && (
                          <td className="sticky-col-1" style={{ fontWeight: 'bold', color: isInactive ? '#ffffff' : 'var(--text-main)' }}>
                            {emp.employee_id || '-'}
                          </td>
                        )}
                        {visibleColumns.full_name && (
                          <td className={!visibleColumns.employee_id ? 'sticky-col-1' : 'sticky-col-2'} style={{ color: isInactive ? '#ffffff' : 'inherit' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                overflow: 'hidden',
                                background: 'rgba(165,182,141,0.2)',
                                border: '1px solid var(--border-color)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}>
                                {emp.photo_url ? (
                                  <img 
                                    src={emp.photo_url.startsWith('http') ? emp.photo_url : API_URL.replace('/api', '') + emp.photo_url} 
                                    alt="" 
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                  />
                                ) : (
                                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>
                                    {(emp.full_name || 'K').charAt(0).toUpperCase()}
                                  </span>
                                )}
                              </div>
                              <span>{toTitleCase(emp.full_name)}</span>
                            </div>
                          </td>
                        )}
                        {visibleColumns.nickname && (
                          <td style={{ color: isInactive ? '#ffffff' : 'var(--text-muted)' }}>
                            {toTitleCase(emp.nickname) || '-'}
                          </td>
                        )}
                        {visibleColumns.employee_status && (
                          <td>
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(emp)}
                              className={`badge ${isInactive ? 'badge-danger' : 'badge-success'}`}
                              style={{ fontWeight: 600, border: isInactive ? '1px solid #ffffff' : 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px' }}
                            >
                              {getStatusLabel(emp.employee_status)}
                            </button>
                          </td>
                        )}
                        {visibleColumns.position && (
                          <td style={{ color: isInactive ? '#ffffff' : 'var(--text-main)' }}>
                            {toTitleCase(emp.position)}
                          </td>
                        )}
                        {visibleColumns.outlet && (
                          <td style={{ color: isInactive ? '#ffffff' : 'inherit' }}>
                            {toTitleCase(emp.outlet) || '-'}
                          </td>
                        )}
                        {visibleColumns.start_working_date && (
                          <td style={{ color: isInactive ? '#ffffff' : 'inherit' }}>
                            {emp.start_working_date || '-'}
                          </td>
                        )}
                        {visibleColumns.working_duration && (
                          <td style={{ color: isInactive ? '#ffffff' : 'inherit' }}>
                            {calculateLamaBekerja(emp.start_working_date)}
                          </td>
                        )}
                        {visibleColumns.gender && (
                          <td style={{ color: isInactive ? '#ffffff' : 'var(--text-muted)' }}>
                            {emp.gender || '-'}
                          </td>
                        )}
                        {visibleColumns.marital_status && (
                          <td style={{ color: isInactive ? '#ffffff' : 'var(--text-muted)' }}>
                            {toTitleCase(emp.marital_status) || '-'}
                          </td>
                        )}
                        {visibleColumns.whatsapp_number && (
                          <td style={{ color: isInactive ? '#ffffff' : 'inherit' }}>
                            {emp.whatsapp_number || '-'}
                          </td>
                        )}
                        {visibleColumns.nik && (
                          <td style={{ color: isInactive ? '#ffffff' : 'var(--text-muted)', fontFamily: 'monospace', letterSpacing: '0.5px' }}>
                            {emp.nik || '-'}
                          </td>
                        )}
                        {visibleColumns.address && (
                          <td style={{ color: isInactive ? '#ffffff' : 'var(--text-muted)', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {emp.address || '-'}
                          </td>
                        )}
                        {visibleColumns.facebook_account && (
                          <td style={{ color: isInactive ? '#ffffff' : 'var(--text-muted)' }}>
                            {emp.facebook_account || '-'}
                          </td>
                        )}
                        {visibleColumns.instagram_account && (
                          <td style={{ color: isInactive ? '#ffffff' : 'var(--text-muted)' }}>
                            {emp.instagram_account ? `@${emp.instagram_account}` : '-'}
                          </td>
                        )}
                        {visibleColumns.actions && (
                          <td>
                            <div style={{ display: 'flex', gap: '10px' }}>
                              {role !== 'admin' && (
                                <button onClick={() => openEditModal(emp)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: isInactive ? '#ffffff' : 'var(--text-muted)' }} title="Ubah Data">
                                  <Edit2 size={16} />
                                </button>
                              )}
                              {role !== 'admin' && (
                                <button 
                                  onClick={() => triggerDelete(emp.id)} 
                                  disabled={role === 'leader'}
                                  style={{ 
                                    background: 'transparent', 
                                    border: 'none', 
                                    cursor: role === 'leader' ? 'not-allowed' : 'pointer', 
                                    color: role === 'leader' ? 'rgba(239, 68, 68, 0.35)' : (isInactive ? '#ffffff' : 'var(--danger)'),
                                    opacity: role === 'leader' ? 0.45 : 1
                                  }} 
                                  title={role === 'leader' ? "Leader dilarang menghapus data" : "Hapus Permanen"}
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                              {role === 'admin' && <span style={{ color: isInactive ? '#ffffff' : 'var(--text-muted)', fontSize: '0.85rem' }}>Read Only</span>}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : (
            <table className="data-table" style={{ fontSize: '12px' }}>
              <thead>
                <tr>
                  <th className="sticky-col-1">NAMA & OUTLET</th>
                  <th>STATUS</th>
                  <th>TERAKHIR BEKERJA</th>
                  <th>AKSI</th>
                </tr>
              </thead>
              <tbody style={{
                opacity: isTransitioning ? 0 : 1,
                transform: isTransitioning ? 'scale(0.99)' : 'scale(1)',
                transition: 'opacity 0.4s ease-in-out, transform 0.3s ease'
              }}>
                {currentRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Tidak ada data karyawan inactive ditemukan.</td>
                  </tr>
                ) : (
                  currentRows.map((emp) => (
                    <tr key={emp.id}>
                      <td className="sticky-col-1">
                        <div style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>
                          {toTitleCase(emp.full_name)}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {toTitleCase(emp.outlet) || '-'} • {toTitleCase(emp.position)}
                        </div>
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(emp)}
                          style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            color: '#ef4444',
                            border: '1px solid #ef4444',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                          }}
                        >
                          🔴 Inactive (Ubah Aktif)
                        </button>
                      </td>
                      <td>{formatIndonesianDate(emp.end_working_date)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          {role !== 'admin' && (
                            <button onClick={() => openEditModal(emp)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }} title="Ubah Data">
                              <Edit2 size={16} />
                            </button>
                          )}
                          {role !== 'admin' && (
                            <button 
                              onClick={() => triggerDelete(emp.id)} 
                              disabled={role === 'leader'}
                              style={{ 
                                background: 'transparent', 
                                border: 'none', 
                                cursor: role === 'leader' ? 'not-allowed' : 'pointer', 
                                color: role === 'leader' ? 'rgba(239, 68, 68, 0.35)' : 'var(--danger)',
                                opacity: role === 'leader' ? 0.45 : 1
                              }} 
                              title={role === 'leader' ? "Leader dilarang menghapus data" : "Hapus Permanen"}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                          {role === 'admin' && <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Read Only</span>}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Kontrol Pagination */}
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
            Menampilkan {indexOfFirstRow + 1}-{Math.min(indexOfLastRow, filteredEmployees.length)} dari {filteredEmployees.length} karyawan
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

      {/* Render Add/Edit Modal Overlay */}
      {renderFormModal()}

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
              <button className="btn-confirm-cancel" onClick={() => { if (confirmModal.onCancel) confirmModal.onCancel(); setConfirmModal(prev => ({ ...prev, isOpen: false })); }}>
                {confirmModal.cancelText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF PREVIEW MODAL */}
      {pdfPreviewModal.isOpen && (() => {
        const tab = pdfPreviewModal.tab;
        const previewRows = filteredEmployees.filter(emp =>
          tab === 'active' ? emp.employee_status !== 'inactive' : emp.employee_status === 'inactive'
        );
        const filterOutletLabel = uiSelectedOutlets.length === outlets.length ? 'Semua Outlet' : uiSelectedOutlets.join(', ');
        const filterPosLabel = uiSelectedPosition === 'Semua Jabatan' ? 'Semua Jabatan' : toTitleCase(uiSelectedPosition);
        const filterBulanLabel = uiSelectedMonth === 'Semua Bulan' ? 'Semua Bulan' : (BULAN_INDO[parseInt(uiSelectedMonth, 10) - 1] || uiSelectedMonth);
        const filterTahunLabel = uiSelectedYear === 'Semua Tahun' ? 'Semua Tahun' : uiSelectedYear;
        return (
          <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(2, 4, 10, 0.82)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            zIndex: 9000, overflowY: 'auto', padding: '32px 16px'
          }}>
            <div className="glass-card animate-fade-in" style={{
              width: '100%', maxWidth: '1050px', padding: '32px',
              background: 'rgba(15, 23, 42, 0.98)',
              border: '1px solid var(--border-color)',
              borderRadius: '20px',
              boxShadow: '0 30px 60px rgba(0,0,0,0.7)'
            }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '18px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(0,173,181,0.12)', border: '1px solid rgba(0,173,181,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FileText size={20} color="#00ADB5" />
                    </div>
                    <div>
                      <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff', margin: 0 }}>Preview Laporan PDF</h2>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, marginTop: '2px' }}>Karyawan {tab === 'active' ? 'Aktif' : 'Inactive'} — Barokah Grup HRIS</p>
                    </div>
                  </div>
                </div>
                <button onClick={() => setPdfPreviewModal({ isOpen: false, tab: 'active' })} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '8px' }}>
                  <X size={22} />
                </button>
              </div>

              {/* Filter Summary Pills */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
                {[
                  { label: 'OUTLET', value: filterOutletLabel },
                  { label: 'JABATAN', value: filterPosLabel },
                  { label: 'BULAN', value: filterBulanLabel },
                  { label: 'TAHUN', value: filterTahunLabel },
                  { label: 'TOTAL DATA', value: `${previewRows.length} karyawan` }
                ].map((f, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    background: i === 4 ? 'rgba(0,173,181,0.12)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${i === 4 ? 'rgba(0,173,181,0.4)' : 'var(--border-color)'}`,
                    borderRadius: '20px', padding: '4px 14px'
                  }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{f.label}:</span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: i === 4 ? '#00ADB5' : '#fff', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.value}</span>
                  </div>
                ))}
              </div>

              {/* Preview Table */}
              <div style={{ maxHeight: '440px', overflowY: 'auto', borderRadius: '10px', border: '1px solid var(--border-color)', marginBottom: '24px' }}>
                {previewRows.length === 0 ? (
                  <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <FileText size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
                    <p style={{ margin: 0, fontWeight: 600 }}>Tidak ada data yang sesuai filter saat ini.</p>
                    <p style={{ margin: 0, fontSize: '0.82rem', marginTop: '6px' }}>Ubah filter di halaman utama lalu coba lagi.</p>
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                    <thead style={{ position: 'sticky', top: 0, background: 'rgba(0,173,181,0.9)', zIndex: 2 }}>
                      <tr>
                        <th style={{ padding: '10px 10px', color: '#000', fontWeight: 800, textAlign: 'left', whiteSpace: 'nowrap' }}>NO</th>
                        {tab === 'active' ? (
                          <>
                            <th style={{ padding: '10px', color: '#000', fontWeight: 800, textAlign: 'left', whiteSpace: 'nowrap' }}>ID KARYAWAN</th>
                            <th style={{ padding: '10px', color: '#000', fontWeight: 800, textAlign: 'left', whiteSpace: 'nowrap' }}>NAMA LENGKAP</th>
                            <th style={{ padding: '10px', color: '#000', fontWeight: 800, textAlign: 'left', whiteSpace: 'nowrap' }}>JABATAN</th>
                            <th style={{ padding: '10px', color: '#000', fontWeight: 800, textAlign: 'left', whiteSpace: 'nowrap' }}>OUTLET</th>
                            <th style={{ padding: '10px', color: '#000', fontWeight: 800, textAlign: 'left', whiteSpace: 'nowrap' }}>MULAI BEKERJA</th>
                            <th style={{ padding: '10px', color: '#000', fontWeight: 800, textAlign: 'left', whiteSpace: 'nowrap' }}>LAMA BEKERJA</th>
                            <th style={{ padding: '10px', color: '#000', fontWeight: 800, textAlign: 'left', whiteSpace: 'nowrap' }}>JENIS KELAMIN</th>
                            <th style={{ padding: '10px', color: '#000', fontWeight: 800, textAlign: 'left', whiteSpace: 'nowrap' }}>STATUS NIKAH</th>
                          </>
                        ) : (
                          <>
                            <th style={{ padding: '10px', color: '#000', fontWeight: 800, textAlign: 'left', whiteSpace: 'nowrap' }}>NAMA LENGKAP</th>
                            <th style={{ padding: '10px', color: '#000', fontWeight: 800, textAlign: 'left', whiteSpace: 'nowrap' }}>JABATAN</th>
                            <th style={{ padding: '10px', color: '#000', fontWeight: 800, textAlign: 'left', whiteSpace: 'nowrap' }}>OUTLET</th>
                            <th style={{ padding: '10px', color: '#000', fontWeight: 800, textAlign: 'left', whiteSpace: 'nowrap' }}>MULAI BEKERJA</th>
                            <th style={{ padding: '10px', color: '#000', fontWeight: 800, textAlign: 'left', whiteSpace: 'nowrap' }}>BERHENTI BEKERJA</th>
                            <th style={{ padding: '10px', color: '#000', fontWeight: 800, textAlign: 'left', whiteSpace: 'nowrap' }}>LAMA BEKERJA</th>
                            <th style={{ padding: '10px', color: '#000', fontWeight: 800, textAlign: 'left', whiteSpace: 'nowrap' }}>JENIS KELAMIN</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((emp, i) => (
                        <tr key={emp.id} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '8px 10px', color: 'var(--text-muted)', fontWeight: 600 }}>{i + 1}</td>
                          {tab === 'active' ? (
                            <>
                              <td style={{ padding: '8px 10px', color: '#00ADB5', fontWeight: 700, fontFamily: 'monospace' }}>{emp.employee_id || '-'}</td>
                              <td style={{ padding: '8px 10px', color: '#fff', fontWeight: 600 }}>{toTitleCase(emp.full_name)}</td>
                              <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{toTitleCase(emp.position)}</td>
                              <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{toTitleCase(emp.outlet) || '-'}</td>
                              <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{emp.start_working_date || '-'}</td>
                              <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{calculateLamaBekerja(emp.start_working_date)}</td>
                              <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{emp.gender || '-'}</td>
                              <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{toTitleCase(emp.marital_status) || '-'}</td>
                            </>
                          ) : (
                            <>
                              <td style={{ padding: '8px 10px', color: '#fff', fontWeight: 600 }}>{toTitleCase(emp.full_name)}</td>
                              <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{toTitleCase(emp.position)}</td>
                              <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{toTitleCase(emp.outlet) || '-'}</td>
                              <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{emp.start_working_date || '-'}</td>
                              <td style={{ padding: '8px 10px', color: '#ef4444' }}>{formatIndonesianDate(emp.end_working_date)}</td>
                              <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{calculateLamaBekerja(emp.start_working_date)}</td>
                              <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{emp.gender || '-'}</td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '18px' }}>
                <button
                  onClick={() => setPdfPreviewModal({ isOpen: false, tab: 'active' })}
                  disabled={pdfGenerating}
                  style={{
                    height: '44px', padding: '0 24px',
                    background: 'transparent',
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px', color: 'var(--text-muted)',
                    cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem'
                  }}
                >Batal</button>
                <button
                  onClick={() => previewRows.length > 0 && loadJsPDFAndGenerate(tab)}
                  disabled={pdfGenerating || previewRows.length === 0}
                  style={{
                    height: '44px', padding: '0 28px',
                    background: previewRows.length === 0 ? 'rgba(0,173,181,0.2)' : '#00ADB5',
                    border: 'none', borderRadius: '10px',
                    color: previewRows.length === 0 ? 'rgba(255,255,255,0.3)' : '#000',
                    cursor: previewRows.length === 0 ? 'not-allowed' : 'pointer',
                    fontWeight: 800, fontSize: '0.9rem',
                    display: 'flex', alignItems: 'center', gap: '10px',
                    transition: 'all 0.2s'
                  }}
                >
                  {pdfGenerating ? (
                    <>
                      <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                      <span>Membuat PDF...</span>
                    </>
                  ) : (
                    <>
                      <FileText size={18} />
                      <span>Unduh PDF ({previewRows.length} Data)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* CENTRALIZED ERROR MODAL (showError) */}
      {errorMessage && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(2, 4, 10, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999
        }}>
          <div style={{
            background: '#0f1322',
            border: '2px solid #ef4444',
            borderRadius: '20px',
            padding: '40px',
            maxWidth: '480px',
            width: '90%',
            textAlign: 'center',
            boxShadow: '0 25px 50px -12px rgba(239, 68, 68, 0.25)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                padding: '16px',
                borderRadius: '50%',
                color: '#ef4444'
              }}>
                <AlertTriangle size={36} />
              </div>
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f1f5f9', marginBottom: '12px' }}>Akses Ditolak</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', lineHeight: '1.5', marginBottom: '24px' }}>{errorMessage}</p>
            <button 
              onClick={() => setErrorMessage(null)} 
              className="btn-primary" 
              style={{ width: '100%', justifyContent: 'center', background: '#ef4444', border: 'none' }}
            >
              TUTUP
            </button>
          </div>
        </div>
      )}
      <PDFCompileOverlay isOpen={isExportingPDF} />
    </div>
  );
}

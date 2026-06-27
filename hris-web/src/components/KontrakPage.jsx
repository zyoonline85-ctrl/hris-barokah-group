import React, { useState, useEffect } from 'react';
import { FileText, Plus, Search, Filter, CheckCircle, AlertCircle, Calendar, Download, Send, Trash2, ArrowLeft, ArrowRight, User } from 'lucide-react';
import { useHRIS } from '../context/HRISContext';
import jsPDF from 'jspdf';


export default function KontrakPage({ token, API_URL }) {
  // ─── HRIS Context — Reactive employee list ─────────────────────────────────
  const { activeEmployees: ctxActiveEmployees } = useHRIS();

  const [contracts, setContracts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterOutlet, setFilterOutlet] = useState('');

  // Sub tab navigation state
  const [activeSubTab, setActiveSubTab] = useState('kontrak'); // 'kontrak' | 'lain-lain'
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const itemsPerPage = 10;

  // Form Modal States
  const [showModal, setShowModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [jenisKontrak, setJenisKontrak] = useState('Kontrak 1 Tahun');
  const [employeeId, setEmployeeId] = useState('');
  const [gajiPokok, setGajiPokok] = useState(1000000);
  const [editingContractId, setEditingContractId] = useState(null);
  
  // Auto-calculated fields
  const [nomorSurat, setNomorSurat] = useState('');
  const [nikKaryawan, setNikKaryawan] = useState('');
  const [statusKaryawan, setStatusKaryawan] = useState('Karyawan Kontrak');
  const [tempatTanggalLahir, setTempatTanggalLahir] = useState('Medan, 15 Juli 1997');
  const [tanggalPembuatan, setTanggalPembuatan] = useState(new Date().toISOString().split('T')[0]);
  const [tanggalSelesai, setTanggalSelesai] = useState('');
  
  const [uangMakan, setUangMakan] = useState(20000);
  const [uangLembur, setUangLembur] = useState(7000);
  const [tunjanganLamaBekerja, setTunjanganLamaBekerja] = useState(0);
  const [tunjanganKeluarga, setTunjanganKeluarga] = useState(0);

  // States for Penugasan Lain-Lain
  const [showLainLainModal, setShowLainLainModal] = useState(false);
  const [showLainLainPreviewModal, setShowLainLainPreviewModal] = useState(false);
  const [jenisSuratLain, setJenisSuratLain] = useState('Surat Dinas');
  const [employeeIdLain, setEmployeeIdLain] = useState('');
  const [keteranganLain, setKeteranganLain] = useState('');
  const [tanggalPembuatanLain, setTanggalPembuatanLain] = useState(new Date().toISOString().split('T')[0]);
  const [nomorSuratLain, setNomorSuratLain] = useState('');
  
  const [errorMsg, setErrorMsg] = useState('');
  const [toast, setToast] = useState({ show: false, type: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sendingContracts, setSendingContracts] = useState({});

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'YAKIN',
    cancelText: 'BATAL',
    onConfirm: null
  });

  const showToast = (type, message) => {
    setToast({ show: true, type, message });
    setTimeout(() => {
      setToast({ show: false, type: '', message: '' });
    }, 4000);
  };

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // Fetch contracts from API
      const resContracts = await fetch(`${API_URL}/contracts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const dataContracts = await resContracts.json();
      let activeContracts = [];
      if (dataContracts.status === 'success') {
        activeContracts = dataContracts.data;
        setContracts(activeContracts);
        localStorage.setItem('contract_ledger', JSON.stringify(activeContracts));
      } else {
        // Fallback to local storage
        const cached = JSON.parse(localStorage.getItem('contract_ledger') || '[]');
        setContracts(cached);
        activeContracts = cached;
      }

      // Fetch employees
      const resEmployees = await fetch(`${API_URL}/employees`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const dataEmployees = await resEmployees.json();
      if (dataEmployees.status === 'success') {
        setEmployees(dataEmployees.data);
      } else {
        setEmployees(JSON.parse(localStorage.getItem('hris_employees') || '[]'));
      }

      // Fetch policies
      const resPolicies = await fetch(`${API_URL}/policies`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const dataPolicies = await resPolicies.json();
      if (dataPolicies.status === 'success') {
        setPolicies(dataPolicies.data);
      } else {
        setPolicies(JSON.parse(localStorage.getItem('corporate_policies') || '[]'));
      }

      setLoading(false);
    } catch (err) {
      console.error('fetchInitialData error:', err);
      // Local fallback
      setContracts(JSON.parse(localStorage.getItem('contract_ledger') || '[]'));
      setEmployees(JSON.parse(localStorage.getItem('hris_employees') || '[]'));
      setPolicies(JSON.parse(localStorage.getItem('corporate_policies') || '[]'));
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
    if (!token || !API_URL) return;
    const interval = setInterval(fetchInitialData, 10000); // poll every 10s
    return () => clearInterval(interval);
  }, [token, API_URL]);

  // Reactive: update employees dari HRISContext (prioritas konteks vs API)
  useEffect(() => {
    if (Array.isArray(ctxActiveEmployees) && ctxActiveEmployees.length > 0) {
      setEmployees(ctxActiveEmployees);
    }
  }, [ctxActiveEmployees]);


  // Recalculate contract number and finished date when fields change
  useEffect(() => {
    if (!tanggalPembuatan) return;

    // Hitung tanggal selesai berdasarkan jenis kontrak
    const start = new Date(tanggalPembuatan);
    if (jenisKontrak === 'Surat Magang') {
      start.setMonth(start.getMonth() + 1);
    } else if (jenisKontrak === 'Kontrak 3 Bulan') {
      start.setMonth(start.getMonth() + 3);
    } else {
      start.setFullYear(start.getFullYear() + 1);
    }
    setTanggalSelesai(start.toISOString().split('T')[0]);

    // Nomor surat
    const year = dateGetYear(tanggalPembuatan);
    const month = dateGetMonth(tanggalPembuatan);
    let code = 'SPK';
    if (jenisKontrak === 'Surat Magang') code = 'SPKG';
    else if (jenisKontrak === 'Kontrak 3 Bulan') code = 'SPSK';
    else code = 'SPK';
    const romanMonths = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
    const romanStr = romanMonths[month] || 'I';

    const currentYearContracts = contracts.filter(c => c.tanggal_pembuatan && c.tanggal_pembuatan.startsWith(String(year)));
    const seq = currentYearContracts.length + 1;
    const numStr = String(seq).padStart(4, '0');

    setNomorSurat(`${numStr}/HRD/${code}/${romanStr}/${year}`);
  }, [jenisKontrak, tanggalPembuatan, contracts]);

  // Recalculate assignment letter number (SPT)
  useEffect(() => {
    if (!tanggalPembuatanLain) return;
    const start = new Date(tanggalPembuatanLain);
    const year = start.getFullYear();
    const month = start.getMonth() + 1;
    const code = 'SPT';
    const romanMonths = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
    const romanStr = romanMonths[month] || 'I';

    const currentYearContracts = contracts.filter(c => c.tanggal_pembuatan && c.tanggal_pembuatan.startsWith(String(year)));
    const seq = currentYearContracts.length + 1;
    const numStr = String(seq).padStart(4, '0');

    setNomorSuratLain(`${numStr}/HRD/${code}/${romanStr}/${year}`);
  }, [jenisSuratLain, tanggalPembuatanLain, contracts]);

  const dateGetYear = (dateStr) => {
    try {
      return new Date(dateStr).getFullYear();
    } catch(e) {
      return new Date().getFullYear();
    }
  };

  const dateGetMonth = (dateStr) => {
    try {
      return new Date(dateStr).getMonth() + 1;
    } catch(e) {
      return new Date().getMonth() + 1;
    }
  };

  // Handle employee selection and auto-populate
  const handleEmployeeChange = (empId) => {
    setEmployeeId(empId);
    if (!empId) {
      setNikKaryawan('');
      setStatusKaryawan('Karyawan Kontrak');
      setUangLembur(7000);
      setTunjanganLamaBekerja(0);
      setTunjanganKeluarga(0);
      return;
    }

    const emp = employees.find(e => String(e.id) === String(empId));
    if (emp) {
      setNikKaryawan(emp.nik || '');
      setStatusKaryawan(emp.employee_status || 'Karyawan Kontrak');
      
      // Places & Birthdate mock
      setTempatTanggalLahir(emp.address ? emp.address.split(',')[0] + ', 15 Juli 1997' : 'Tebing Tinggi, 15 Juli 1997');

      // Auto-calculate Overtime from policies
      let lemburRate = 7000;
      const isAyamBakarSurabaya = emp.outlet && emp.outlet.toUpperCase().includes('AYAM BAKAR SURABAYA');
      if (isAyamBakarSurabaya) {
        lemburRate = 0;
      } else {
        try {
          const lemburPolicy = policies.find(p => {
            const name = (p.nama_aturan || p.nama_kebijakan || '').toLowerCase();
            return name.includes('uang lembur');
          });
          if (lemburPolicy) {
            const isPolActive = lemburPolicy.status === 'ACTIVE' || lemburPolicy.status === 'aktif';
            if (isPolActive) {
              let applicable = true;
              const allOutlets = lemburPolicy.all_outlets !== undefined ? lemburPolicy.all_outlets : (lemburPolicy.hanya_outlet_terpilih === 0);
              if (!allOutlets) {
                const rawOutlets = lemburPolicy.outlets || lemburPolicy.berlaku_di || '[]';
                const outlets = typeof rawOutlets === 'string' ? JSON.parse(rawOutlets) : rawOutlets;
                applicable = outlets.includes(emp.outlet);
              }
              if (applicable) {
                const desc = lemburPolicy.deskripsi || lemburPolicy.nilai || '';
                const match = desc.match(/sebesar\s*rp\s*([\d.]+)/i);
                if (match) lemburRate = parseInt(match[1].replace(/\./g, ''), 10);
              }
            }
          }
        } catch (e) {
          console.error('Error parsing Overtime policy:', e);
        }
      }
      setUangLembur(lemburRate);

      // Auto-calculate service years (Tunjangan Lama Bekerja)
      let lamaVal = 0;
      try {
        const lamaPolicy = policies.find(p => {
          const name = (p.nama_aturan || p.nama_kebijakan || '').toLowerCase();
          return name.includes('tunjangan lama bekerja');
        });
        if (lamaPolicy) {
          const isPolActive = lamaPolicy.status === 'ACTIVE' || lamaPolicy.status === 'aktif';
          if (isPolActive) {
            let applicable = true;
            const allOutlets = lamaPolicy.all_outlets !== undefined ? lamaPolicy.all_outlets : (lamaPolicy.hanya_outlet_terpilih === 0);
            if (!allOutlets) {
              const rawOutlets = lamaPolicy.outlets || lamaPolicy.berlaku_di || '[]';
              const outlets = typeof rawOutlets === 'string' ? JSON.parse(rawOutlets) : rawOutlets;
              applicable = outlets.includes(emp.outlet);
            }
            if (applicable) {
              const startWorkingDate = emp.start_working_date || emp.joined_date || emp.joined_at || tanggalPembuatan;
              const start = new Date(startWorkingDate);
              const now = new Date();
              const yearDiff = now.getFullYear() - start.getFullYear();
              const monthDiff = now.getMonth() - start.getMonth();
              const months = yearDiff * 12 + monthDiff;
              if (months >= 3 && months < 6) lamaVal = 100000;
              else if (months >= 6 && months < 12) lamaVal = 200000;
              else if (months >= 12) {
                const extraPeriod = Math.floor((months - 12) / 6);
                lamaVal = 200000 + (extraPeriod * 50000);
              }
            }
          }
        }
      } catch (e) {
        console.error('Error parsing tenure policy:', e);
      }
      setTunjanganLamaBekerja(lamaVal);

      // Auto-calculate family allowance (Tunjangan Keluarga)
      let keluargaVal = 0;
      try {
        const kelPolicy = policies.find(p => {
          const name = (p.nama_aturan || p.nama_kebijakan || '').toLowerCase();
          return name.includes('tunjangan keluarga');
        });
        if (kelPolicy) {
          const isPolActive = kelPolicy.status === 'ACTIVE' || kelPolicy.status === 'aktif';
          if (isPolActive) {
            let applicable = true;
            const allOutlets = kelPolicy.all_outlets !== undefined ? kelPolicy.all_outlets : (kelPolicy.hanya_outlet_terpilih === 0);
            if (!allOutlets) {
              const rawOutlets = kelPolicy.outlets || kelPolicy.berlaku_di || '[]';
              const outlets = typeof rawOutlets === 'string' ? JSON.parse(rawOutlets) : rawOutlets;
              applicable = outlets.includes(emp.outlet);
            }
            if (applicable) {
              const isMarried = emp.marital_status && !/belum/i.test(emp.marital_status);
              const startWorkingDate = emp.start_working_date || emp.joined_date || emp.joined_at || tanggalPembuatan;
              const start = new Date(startWorkingDate);
              const now = new Date();
              const yearDiff = now.getFullYear() - start.getFullYear();
              const monthDiff = now.getMonth() - start.getMonth();
              const months = yearDiff * 12 + monthDiff;
              if (isMarried && months >= 1) {
                keluargaVal = 200000;
              }
            }
          }
        }
      } catch (e) {
        console.error('Error parsing family policy:', e);
      }
      setTunjanganKeluarga(keluargaVal);
    }
  };

  const resetContractForm = () => {
    setEmployeeId('');
    setJenisKontrak('Surat Perjanjian Kontrak');
    setGajiPokok(1000000);
    setNikKaryawan('');
    setStatusKaryawan('Karyawan Kontrak');
    setUangLembur(7000);
    setTunjanganLamaBekerja(0);
    setTunjanganKeluarga(0);
    setTanggalPembuatan(new Date().toISOString().split('T')[0]);
    setTanggalSelesai('');
    setErrorMsg('');
  };

  const handleOpenAddModal = () => {
    resetContractForm();
    setShowPreviewModal(false);
    setShowModal(true);
  };

  const triggerSave = (e) => {
    e.preventDefault();
    if (!employeeId) {
      setErrorMsg('Pilih nama karyawan pihak kedua.');
      return;
    }
    setShowPreviewModal(true);
  };

  const executeSubmit = async () => {
    setErrorMsg('');
    setIsSubmitting(true);
    const targetEmp = employees.find(e => String(e.id) === String(employeeId));
    
    if (editingContractId) {
      const updated = contracts.map(c => {
        if (c.id === editingContractId) {
          return {
            ...c,
            employee_id: parseInt(employeeId, 10),
            nama_karyawan: targetEmp ? targetEmp.full_name : 'Karyawan',
            outlet: targetEmp ? targetEmp.outlet : 'CABANG UTAMA',
            jenis_kontrak: jenisKontrak,
            gaji_pokok: parseFloat(gajiPokok),
            uang_makan: uangMakan,
            uang_lembur: uangLembur,
            tunjangan_lama_bekerja: tunjanganLamaBekerja,
            tunjangan_keluarga: tunjanganKeluarga,
            tanggal_pembuatan: tanggalPembuatan,
            tanggal_selesai: tanggalSelesai,
          };
        }
        return c;
      });
      setContracts(updated);
      localStorage.setItem('contract_ledger', JSON.stringify(updated));
      setShowModal(false);
      setShowPreviewModal(false);
      resetContractForm();
      setEditingContractId(null);
      showToast('success', 'Kontrak Kerja Digital Berhasil Diperbarui!');
      setIsSubmitting(false);
      return;
    }
    
    const payload = {
      employee_id: parseInt(employeeId, 10),
      jenis_kontrak: jenisKontrak,
      gaji_pokok: parseFloat(gajiPokok),
      uang_lembur: parseFloat(uangLembur),
      tanggal_pembuatan: tanggalPembuatan,
      marital_status: targetEmp ? targetEmp.marital_status : 'Belum menikah'
    };

    try {
      const res = await fetch(`${API_URL}/contracts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.status === 201 || data.status === 'success') {
        const newRecord = data.data;
        const fullRecord = {
          ...newRecord,
          nama_karyawan: targetEmp ? targetEmp.full_name : 'Karyawan',
          outlet: targetEmp ? targetEmp.outlet : 'CABANG UTAMA'
        };

        const updatedContracts = [fullRecord, ...contracts];
        setContracts(updatedContracts);
        localStorage.setItem('contract_ledger', JSON.stringify(updatedContracts));

        setShowModal(false);
        setShowPreviewModal(false);
        resetContractForm();
        showToast('success', 'Kontrak Kerja Digital Berhasil Diterbitkan!');
        fetchInitialData();
      } else {
        setErrorMsg(data.message || 'Gagal menyimpan kontrak kerja.');
        setShowPreviewModal(false);
      }
    } catch (err) {
      console.error('API connection failed, saving contract locally:', err);
      
      const localNewContract = {
        id: Date.now(),
        nomor_surat: nomorSurat,
        employee_id: parseInt(employeeId, 10),
        nama_karyawan: targetEmp ? targetEmp.full_name : 'Karyawan',
        outlet: targetEmp ? targetEmp.outlet : 'CABANG UTAMA',
        jenis_kontrak: jenisKontrak,
        gaji_pokok: parseFloat(gajiPokok),
        uang_makan: uangMakan,
        uang_lembur: uangLembur,
        tunjangan_lama_bekerja: tunjanganLamaBekerja,
        tunjangan_keluarga: tunjanganKeluarga,
        tanggal_pembuatan: tanggalPembuatan,
        tanggal_selesai: tanggalSelesai,
        status_persetujuan: 'BELUM SIGN'
      };

      const updatedContracts = [localNewContract, ...contracts];
      setContracts(updatedContracts);
      localStorage.setItem('contract_ledger', JSON.stringify(updatedContracts));

      setShowModal(false);
      setShowPreviewModal(false);
      resetContractForm();
      showToast('success', 'Kontrak Kerja Digital Berhasil Diterbitkan (Local Mode)!');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetLainLainForm = () => {
    setEmployeeIdLain('');
    setJenisSuratLain('Surat Dinas');
    setKeteranganLain('');
    setTanggalPembuatanLain(new Date().toISOString().split('T')[0]);
    setErrorMsg('');
  };

  const triggerSaveLainLain = (e) => {
    e.preventDefault();
    if (!employeeIdLain) {
      setErrorMsg('Pilih nama karyawan pihak kedua.');
      return;
    }
    setShowLainLainPreviewModal(true);
  };

  const executeSubmitLainLain = async () => {
    setErrorMsg('');
    setIsSubmitting(true);
    const targetEmp = employees.find(e => String(e.id) === String(employeeIdLain));
    
    const payload = {
      employee_id: parseInt(employeeIdLain, 10),
      jenis_kontrak: jenisSuratLain,
      gaji_pokok: 0,
      uang_makan: 0,
      uang_lembur: 0,
      tanggal_pembuatan: tanggalPembuatanLain,
      keterangan: keteranganLain
    };

    try {
      const res = await fetch(`${API_URL}/contracts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.status === 201 || data.status === 'success') {
        const newRecord = data.data;
        const fullRecord = {
          ...newRecord,
          nama_karyawan: targetEmp ? targetEmp.full_name : 'Karyawan',
          outlet: targetEmp ? targetEmp.outlet : 'CABANG UTAMA'
        };

        const updatedContracts = [fullRecord, ...contracts];
        setContracts(updatedContracts);
        localStorage.setItem('contract_ledger', JSON.stringify(updatedContracts));

        setShowLainLainModal(false);
        setShowLainLainPreviewModal(false);
        resetLainLainForm();
        showToast('success', 'Surat Penugasan Berhasil Diterbitkan!');
        fetchInitialData();
      } else {
        setErrorMsg(data.message || 'Gagal menyimpan surat penugasan.');
        setShowLainLainPreviewModal(false);
      }
    } catch (err) {
      console.error('API connection failed, saving letter locally:', err);
      
      const localNewContract = {
        id: Date.now(),
        nomor_surat: nomorSuratLain,
        employee_id: parseInt(employeeIdLain, 10),
        nama_karyawan: targetEmp ? targetEmp.full_name : 'Karyawan',
        outlet: targetEmp ? targetEmp.outlet : 'CABANG UTAMA',
        jenis_kontrak: jenisSuratLain,
        gaji_pokok: 0,
        uang_makan: 0,
        uang_lembur: 0,
        tunjangan_lama_bekerja: 0,
        tunjangan_keluarga: 0,
        tanggal_pembuatan: tanggalPembuatanLain,
        tanggal_selesai: tanggalPembuatanLain,
        status_persetujuan: 'BELUM SIGN',
        keterangan: keteranganLain
      };

      const updatedContracts = [localNewContract, ...contracts];
      setContracts(updatedContracts);
      localStorage.setItem('contract_ledger', JSON.stringify(updatedContracts));

      setShowLainLainModal(false);
      setShowLainLainPreviewModal(false);
      resetLainLainForm();
      showToast('success', 'Surat Penugasan Berhasil Diterbitkan (Local Mode)!');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toTitleCase = (str) => {
    if (!str) return '';
    return str.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const handleSendKontrak = (c) => {
    setSendingContracts(prev => ({ ...prev, [c.id]: true }));
    setTimeout(() => {
      const updated = contracts.map(item => 
        item.id === c.id ? { ...item, status_persetujuan: 'TERKIRIM' } : item
      );
      setContracts(updated);
      localStorage.setItem('contract_ledger', JSON.stringify(updated));
      showToast('success', `🚀 Kontrak ${c.nomor_surat} berhasil dikirimkan ke kotak masuk karyawan!`);
      setSendingContracts(prev => ({ ...prev, [c.id]: false }));
    }, 1200);
  };

  const handleSimulateStatus = (c, nextStatus) => {
    const updated = contracts.map(item => 
      item.id === c.id ? { ...item, status_persetujuan: nextStatus } : item
    );
    setContracts(updated);
    localStorage.setItem('contract_ledger', JSON.stringify(updated));
    showToast('success', `🔄 Status kontrak ${c.nomor_surat} diperbarui menjadi: ${nextStatus}`);
  };

  const openEditModal = (c) => {
    setEditingContractId(c.id);
    setEmployeeId(c.employee_id);
    setJenisKontrak(c.jenis_kontrak);
    setGajiPokok(c.gaji_pokok);
    setNikKaryawan(c.nik_karyawan || '');
    setStatusKaryawan(c.status_karyawan || 'Karyawan Kontrak');
    setUangLembur(c.uang_lembur || 7000);
    setTunjanganLamaBekerja(c.tunjangan_lama_bekerja || 0);
    setTunjanganKeluarga(c.tunjangan_keluarga || 0);
    setTanggalPembuatan(c.tanggal_pembuatan);
    setTanggalSelesai(c.tanggal_selesai || '');
    setShowModal(true);
  };

  const handleDeleteContract = (id) => {
    setConfirmModal({
      isOpen: true,
      title: 'Hapus Dokumen?',
      message: 'Apakah Anda yakin ingin menghapus dokumen surat penugasan ini secara permanen?',
      confirmText: 'YA, HAPUS',
      cancelText: 'BATAL',
      onConfirm: async () => {
        try {
          await fetch(`${API_URL}/contracts/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
        } catch (e) {}
        const updated = contracts.filter(c => c.id !== id);
        setContracts(updated);
        localStorage.setItem('contract_ledger', JSON.stringify(updated));
        showToast('success', 'Dokumen berhasil dihapus.');
      }
    });
  };

  const handleDownloadPDF = (c) => {
    try {
      const doc = new jsPDF();
      
      // Page 1 Border & Page design
      doc.rect(5, 5, 200, 287);
      
      // Header
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('BAROKAH GRUP', 105, 20, { align: 'center' });
      doc.setFontSize(10);
      doc.setFont('Helvetica', 'normal');
      doc.text('Ruko Abs Center, Blok A No. 12, Medan', 105, 25, { align: 'center' });
      doc.text('Email: hrd@barokahgrup.com | Telp: (061) 1234567', 105, 30, { align: 'center' });
      
      doc.line(15, 35, 195, 35);
      doc.line(15, 36, 195, 36);
      
      // Document Title
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('SURAT PERJANJIAN KERJA (SPK)', 105, 48, { align: 'center' });
      doc.setFontSize(10);
      doc.text(`Nomor: ${c.nomor_surat}`, 105, 53, { align: 'center' });
      
      doc.setFont('Helvetica', 'normal');
      doc.text('Yang bertandatangan di bawah ini:', 20, 65);
      
      // Pihak Pertama
      doc.text('1. Pihak Pertama (Perusahaan):', 20, 72);
      doc.text('Nama', 30, 78);
      doc.text(': Harry Setiawan', 70, 78);
      doc.text('Jabatan', 30, 83);
      doc.text(': General Manager', 70, 83);
      doc.text('Alamat', 30, 88);
      doc.text(': Kantor Pusat Barokah Grup, Medan', 70, 88);
      
      // Pihak Kedua
      doc.text('2. Pihak Kedua (Karyawan):', 20, 98);
      doc.text('Nama Karyawan', 30, 104);
      doc.text(`: ${toTitleCase(c.nama_karyawan)}`, 70, 104);
      doc.text('NIK / KTP', 30, 109);
      doc.text(`: ${c.nik_karyawan || '-'}`, 70, 109);
      doc.text('Jabatan / Outlet', 30, 114);
      doc.text(`: ${toTitleCase(c.jabatan || 'Karyawan')} / ${c.outlet || 'CABANG UTAMA'}`, 70, 114);
      
      doc.text('Kedua belah pihak sepakat untuk mengikatkan diri dalam Perjanjian Kerja dengan ketentuan:', 20, 125);
      
      // Pasal-pasal Page 1
      doc.setFont('Helvetica', 'bold');
      doc.text('Pasal 1: Ketentuan Umum & Ruang Lingkup', 20, 133);
      doc.setFont('Helvetica', 'normal');
      doc.text('Pihak Kedua bekerja sebagai karyawan di bawah arahan Pihak Pertama dan wajib mematuhi seluruh peraturan perusahaan serta SOP yang berlaku.', 20, 138, { maxWidth: 170 });
      
      doc.setFont('Helvetica', 'bold');
      doc.text('Pasal 2: Masa Berlaku & Jenis Kontrak', 20, 150);
      doc.setFont('Helvetica', 'normal');
      doc.text(`Perjanjian kerja ini berlaku untuk jangka waktu tertentu terhitung mulai tanggal ${c.tanggal_pembuatan} sampai ${c.tanggal_selesai || '-'} (${c.jenis_kontrak}).`, 20, 155, { maxWidth: 170 });
      
      doc.setFont('Helvetica', 'bold');
      doc.text('Pasal 3: Waktu Kerja & Kedisiplinan', 20, 167);
      doc.setFont('Helvetica', 'normal');
      doc.text('Pihak Kedua wajib menaati jam kerja yang ditetapkan, melakukan presensi dengan jujur, serta menjaga kedisiplinan dan nama baik perusahaan.', 20, 172, { maxWidth: 170 });
      
      doc.setFont('Helvetica', 'bold');
      doc.text('Pasal 4: Gaji & Tunjangan', 20, 184);
      doc.setFont('Helvetica', 'normal');
      doc.text(`Pihak Kedua berhak menerima Gaji Pokok sebesar ${formatCurrency(c.gaji_pokok || 1000000)}/bulan, Uang Makan ${formatCurrency(c.uang_makan || 20000)}/hari kerja, Uang Lembur ${formatCurrency(c.uang_lembur || 7000)}/hari kerja, Tunjangan Lama Bekerja ${formatCurrency(c.tunjangan_lama_bekerja || 0)}, dan Tunjangan Keluarga ${formatCurrency(c.tunjangan_keluarga || 0)} sesuai ketentuan.`, 20, 189, { maxWidth: 170 });
      
      doc.setFont('Helvetica', 'bold');
      doc.text('Pasal 5: Kewajiban Karyawan', 20, 206);
      doc.setFont('Helvetica', 'normal');
      doc.text('Pihak Kedua wajib menjalankan seluruh tugas pekerjaan dengan penuh tanggung jawab, memelihara aset perusahaan, serta melaporkan operasional secara jujur.', 20, 211, { maxWidth: 170 });
      
      // Page 2
      doc.addPage();
      doc.rect(5, 5, 200, 287);
      
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('SURAT PERJANJIAN KERJA (SPK)', 105, 20, { align: 'center' });
      doc.setFontSize(10);
      doc.text(`Nomor: ${c.nomor_surat} (Lanjutan)`, 105, 25, { align: 'center' });
      doc.line(15, 30, 195, 30);
      
      doc.setFont('Helvetica', 'bold');
      doc.text('Pasal 6: Kerahasiaan Perusahaan (NDA) & Resep', 20, 40);
      doc.setFont('Helvetica', 'normal');
      doc.text('Pihak Kedua wajib menjaga kerahasiaan resep masakan, formula rasa, data keuangan, dan rahasia dagang perusahaan. Pelanggaran terhadap NDA dikenakan denda sebesar Rp 25.000.000.', 20, 45, { maxWidth: 170 });
      
      doc.setFont('Helvetica', 'bold');
      doc.text('Pasal 7: Pemutusan Hubungan Kerja (PHK)', 20, 59);
      doc.setFont('Helvetica', 'normal');
      doc.text('Pihak Pertama berhak melakukan Pemutusan Hubungan Kerja (PHK) apabila Pihak Kedua melakukan pelanggaran berat atau setelah mendapatkan Surat Peringatan (SP) I, II, dan III.', 20, 64, { maxWidth: 170 });
      
      doc.setFont('Helvetica', 'bold');
      doc.text('Pasal 8: Penalti Keluar', 20, 78);
      doc.setFont('Helvetica', 'normal');
      doc.text('Apabila Pihak Kedua mengundurkan diri sebelum masa kontrak selesai (khususnya dalam 3 tahun setelah pelatihan berbayar), maka Pihak Kedua wajib membayar ganti rugi sebesar Rp 25.000.000 kepada Pihak Pertama.', 20, 83, { maxWidth: 170 });
      
      doc.setFont('Helvetica', 'bold');
      doc.text('Pasal 9: Penyelesaian Perselisihan', 20, 97);
      doc.setFont('Helvetica', 'normal');
      doc.text('Segala perselisihan yang timbul dari perjanjian kerja ini akan diselesaikan secara kekeluargaan terlebih dahulu, dan apabila tidak tercapai kesepakatan akan diselesaikan melalui jalur hukum.', 20, 102, { maxWidth: 170 });
      
      // Signature Section Page 2
      doc.text('Dibuat di Medan pada tanggal ' + c.tanggal_pembuatan, 20, 125);
      
      doc.setFont('Helvetica', 'bold');
      doc.text('Pihak Pertama (Perusahaan)', 30, 137);
      doc.text('Pihak Kedua (Karyawan)', 140, 137);
      
      doc.setFont('Helvetica', 'italic');
      doc.text('[Signed Digital]', 35, 150);
      doc.text(c.status_persetujuan === 'KONTRAK DITANDATANGANI' ? '[Signed Digital]' : '[Menunggu Signature]', 142, 150);
      
      doc.setFont('Helvetica', 'bold');
      doc.text('Harry Setiawan', 30, 165);
      doc.text(toTitleCase(c.nama_karyawan), 135, 165);
      
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('General Manager', 30, 169);
      doc.text('NIK: ' + (c.nik_karyawan || '-'), 135, 169);
      
      doc.save(`Kontrak_Kerja_${c.nama_karyawan.replace(/\s+/g, '_')}_${c.nomor_surat.replace(/\//g, '_')}.pdf`);
      showToast('success', '📄 PDF Kontrak Kerja berhasil diunduh!');
    } catch (err) {
      console.error(err);
      showToast('error', '❌ Gagal mengunduh PDF Kontrak.');
    }
  };

  // Search and filter contracts
  const filteredContracts = contracts.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = (c.nomor_surat || '').toLowerCase().includes(q) ||
                        (c.nama_karyawan || '').toLowerCase().includes(q) ||
                        (c.outlet || '').toLowerCase().includes(q);
    const matchOutlet = filterOutlet === '' || c.outlet === filterOutlet;

    const isLainLainType = ['Surat Dinas', 'Surat Pemindahan Tugas', 'Surat Perintah'].includes(c.jenis_kontrak);
    const matchTab = activeSubTab === 'kontrak' ? !isLainLainType : isLainLainType;

    return matchSearch && matchOutlet && matchTab;
  });

  // Unique Outlets for Filters
  const uniqueOutlets = [...new Set(employees.map(e => e.outlet).filter(Boolean))];

  // Pagination bounds
  const indexOfLastRow = currentPage * itemsPerPage;
  const indexOfFirstRow = indexOfLastRow - itemsPerPage;
  const currentRows = filteredContracts.slice(indexOfFirstRow, indexOfLastRow);
  const totalPages = Math.ceil(filteredContracts.length / itemsPerPage);

  const handlePageChange = (pageNumber) => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentPage(pageNumber);
      setIsTransitioning(false);
    }, 150);
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
  };

  // KPI calculations
  const totalCount = contracts.length;
  const signedCount = contracts.filter(c => c.status_persetujuan === 'KONTRAK DITANDATANGANI').length;
  const unsignedCount = totalCount - signedCount;

  return (
    <div className="glass-card animate-fade-in" style={{ padding: '0px' }}>
      
      {/* KPI Cards Summary Section */}
      <div className="stats-grid animate-fade-in" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', padding: '10px 0 24px 0' }}>
        
        {/* KPI 1: Total Kontrak */}
        <div className="glass-card stat-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '12px', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <div className="stat-info">
            <span className="stat-label" style={{ fontSize: '0.8rem', color: 'rgba(238, 238, 238, 0.6)' }}>Total Dokumen Surat Penugasan</span>
            <div className="stat-value" style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>{totalCount} Berkas</div>
          </div>
          <div className="stat-icon" style={{ background: 'rgba(165, 182, 141, 0.08)', color: 'var(--text-main)', width: '38px', height: '38px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileText size={18} />
          </div>
        </div>

        {/* KPI 2: Belum Sign */}
        <div className="glass-card stat-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '12px', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <div className="stat-info">
            <span className="stat-label" style={{ fontSize: '0.8rem', color: 'rgba(238, 238, 238, 0.6)' }}>Belum Ditandatangani</span>
            <div className="stat-value" style={{ fontSize: '1.4rem', fontWeight: 800, color: '#F39C12', marginTop: '4px' }}>{unsignedCount} Karyawan</div>
          </div>
          <div className="stat-icon" style={{ background: 'rgba(243, 156, 18, 0.1)', color: '#F39C12', width: '38px', height: '38px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertCircle size={18} />
          </div>
        </div>

        {/* KPI 3: Kontrak Aktif */}
        <div className="glass-card stat-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '12px', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <div className="stat-info">
            <span className="stat-label" style={{ fontSize: '0.8rem', color: 'rgba(238, 238, 238, 0.6)' }}>Kontrak Ditandatangani</span>
            <div className="stat-value" style={{ fontSize: '1.4rem', fontWeight: 800, color: '#2ECC71', marginTop: '4px' }}>{signedCount} Karyawan</div>
          </div>
          <div className="stat-icon" style={{ background: 'rgba(46, 204, 113, 0.1)', color: '#2ECC71', width: '38px', height: '38px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle size={18} />
          </div>
        </div>

      </div>

      {/* Floating Toast Notification */}
      {toast.show && (
        <div className={`toast-notification ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`} style={{ zIndex: 1000 }}>
          {toast.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          <span className="toast-message">{toast.message}</span>
        </div>
      )}

      {/* Action Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="logo-icon" style={{ background: 'rgba(165, 182, 141, 0.08)', width: '42px', height: '42px' }}>
            <FileText size={20} color="var(--text-main)" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-main)' }}>Manajemen Surat Penugasan Karyawan</h3>
            <p style={{ fontSize: '0.85rem', color: 'rgba(238, 238, 238, 0.6)' }}>Terbitkan kontrak kerja (PKWT) maupun surat dinas, pemindahan tugas, dan surat perintah.</p>
          </div>
        </div>

        {/* Luxury Wood-themed Button */}
        {activeSubTab === 'kontrak' ? (
          <button 
            className="btn-primary" 
            onClick={handleOpenAddModal} 
            style={{ 
              background: 'var(--border-color)', 
              color: 'var(--text-main)', 
              border: '1px solid #7c5c36',
              boxShadow: '0 4px 10px rgba(65, 45, 21, 0.3)',
              fontWeight: 700
            }}
          >
            <Plus size={16} />
            <span>Tambahkan Kontrak Baru</span>
          </button>
        ) : (
          <button 
            className="btn-primary" 
            onClick={() => { resetLainLainForm(); setShowLainLainModal(true); }} 
            style={{ 
              background: 'var(--border-color)', 
              color: 'var(--text-main)', 
              border: '1px solid #7c5c36',
              boxShadow: '0 4px 10px rgba(65, 45, 21, 0.3)',
              fontWeight: 700
            }}
          >
            <Plus size={16} />
            <span>Tambahkan Penugasan Baru</span>
          </button>
        )}
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '24px', gap: '8px' }}>
        <button
          onClick={() => { setActiveSubTab('kontrak'); setCurrentPage(1); }}
          style={{
            padding: '12px 20px',
            background: activeSubTab === 'kontrak' ? 'rgba(124, 92, 54, 0.2)' : 'transparent',
            color: 'var(--text-main)',
            border: 'none',
            borderBottom: activeSubTab === 'kontrak' ? '2px solid #7c5c36' : 'none',
            cursor: 'pointer',
            fontWeight: activeSubTab === 'kontrak' ? 'bold' : 'normal',
            borderRadius: '8px 8px 0 0',
            transition: 'all 0.25s ease'
          }}
        >
          📄 Kontrak Kerja Digital
        </button>
        <button
          onClick={() => { setActiveSubTab('lain-lain'); setCurrentPage(1); }}
          style={{
            padding: '12px 20px',
            background: activeSubTab === 'lain-lain' ? 'rgba(124, 92, 54, 0.2)' : 'transparent',
            color: 'var(--text-main)',
            border: 'none',
            borderBottom: activeSubTab === 'lain-lain' ? '2px solid #7c5c36' : 'none',
            cursor: 'pointer',
            fontWeight: activeSubTab === 'lain-lain' ? 'bold' : 'normal',
            borderRadius: '8px 8px 0 0',
            transition: 'all 0.25s ease'
          }}
        >
          📋 Penugasan Lain-Lain
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-card" style={{
        padding: '16px',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        background: 'var(--bg-card)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '15px',
        marginBottom: '20px'
      }}>
        {/* Search */}
        <div style={{ position: 'relative', width: '300px' }}>
          <Search size={18} color="rgba(238, 238, 238, 0.4)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Cari nomor surat atau nama..."
            className="input-field"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '40px', paddingRight: '12px', height: '38px', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}
          />
        </div>

        {/* Filter Outlet */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <Filter size={16} color="rgba(238, 238, 238, 0.6)" />
          <select
            className="input-field"
            value={filterOutlet}
            onChange={(e) => setFilterOutlet(e.target.value)}
            style={{ width: '200px', height: '38px', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}
          >
            <option value="">Semua Outlet</option>
            {uniqueOutlets.map((ot, idx) => (
              <option key={idx} value={ot}>{ot}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Table Recapitulation */}
      {loading ? (
        <div className="spinner-container">
          <div className="loading-spinner"></div>
          <p className="loading-text">Memuat data kontrak kerja...</p>
        </div>
      ) : (
        <div style={{ transition: 'opacity 0.15s ease-in-out', opacity: isTransitioning ? 0 : 1 }}>
          <div className="table-container" style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
            <table className="data-table" style={{ fontSize: '12px' }}>
              <thead>
                <tr style={{ background: 'var(--bg-card)', color: 'var(--text-main)' }}>
                  <th style={{ width: '60px' }}>No</th>
                  <th>Nomor Surat</th>
                  <th>Nama Karyawan</th>
                  <th>Outlet</th>
                  <th>{activeSubTab === 'kontrak' ? 'Jenis Kontrak' : 'Jenis Surat'}</th>
                  <th>Tanggal Terbit</th>
                  {activeSubTab === 'kontrak' ? <th>Status Persetujuan</th> : <th>Keterangan</th>}
                  {activeSubTab === 'lain-lain' && <th>Status</th>}
                  <th style={{ width: '240px', textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {currentRows.length === 0 ? (
                  <tr>
                    <td colSpan={activeSubTab === 'kontrak' ? 8 : 9} style={{ textAlign: 'center', color: 'rgba(238, 238, 238, 0.4)', padding: '30px' }}>
                      {activeSubTab === 'kontrak' ? 'Belum ada dokumen kontrak kerja digital terbit.' : 'Belum ada dokumen surat penugasan terbit.'}
                    </td>
                  </tr>
                ) : (
                  currentRows.map((c, index) => {
                    const rowNumber = indexOfFirstRow + index + 1;
                    return (
                      <tr key={c.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td>{rowNumber}</td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--text-main)' }}>{c.nomor_surat}</td>
                        <td style={{ fontWeight: 600, color: '#fff' }}>{c.nama_karyawan}</td>
                        <td style={{ color: 'rgba(238, 238, 238, 0.7)' }}>{c.outlet || 'CABANG UTAMA'}</td>
                        <td>
                          <span className="badge" style={{ background: 'rgba(165, 182, 141, 0.05)', color: 'var(--text-main)', fontWeight: 600 }}>
                            {c.jenis_kontrak}
                          </span>
                        </td>
                        <td style={{ color: 'rgba(238, 238, 238, 0.5)' }}>{c.tanggal_pembuatan}</td>
                        {activeSubTab === 'kontrak' ? (
                          <td>
                            {c.status_persetujuan === 'KONTRAK DITANDATANGANI' || c.status_persetujuan === 'DISETUJUI' ? (
                              <span className="badge" style={{ background: 'rgba(46, 204, 113, 0.15)', color: '#2ECC71', fontWeight: 700 }}>
                                DISETUJUI / SIGNED
                              </span>
                            ) : c.status_persetujuan === 'DIBACA' ? (
                              <span className="badge" style={{ background: 'rgba(52, 152, 219, 0.15)', color: '#3498db', fontWeight: 700 }}>
                                👁️ DIBACA
                              </span>
                            ) : c.status_persetujuan === 'TERKIRIM' ? (
                              <span className="badge" style={{ background: 'rgba(243, 156, 18, 0.15)', color: '#F39C12', fontWeight: 700 }}>
                                🚀 TERKIRIM
                              </span>
                            ) : (
                              <span className="badge" style={{ background: 'rgba(100, 116, 139, 0.15)', color: '#64748b', fontWeight: 700 }}>
                                📝 DRAFT
                              </span>
                            )}
                          </td>
                        ) : (
                          <td style={{ color: 'rgba(238, 238, 238, 0.6)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '200px' }} title={c.keterangan}>
                            {c.keterangan || '-'}
                          </td>
                        )}
                        {activeSubTab === 'lain-lain' && (
                          <td>
                            {c.status_persetujuan === 'KONTRAK DITANDATANGANI' || c.status_persetujuan === 'DISETUJUI' ? (
                              <span className="badge" style={{ background: 'rgba(46, 204, 113, 0.15)', color: '#2ECC71', fontWeight: 700 }}>
                                TTD Diterima
                              </span>
                            ) : (
                              <span className="badge" style={{ background: 'rgba(243, 156, 18, 0.15)', color: '#F39C12', fontWeight: 700 }}>
                                Belum Sign
                              </span>
                            )}
                          </td>
                        )}
                        <td>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
                            {/* Kirim Kontrak Button */}
                            {(c.status_persetujuan === 'DRAFT' || c.status_persetujuan === 'BELUM SIGN' || !c.status_persetujuan) && (
                              <button
                                onClick={() => handleSendKontrak(c)}
                                className="btn-secondary"
                                disabled={sendingContracts[c.id]}
                                style={{
                                  background: 'rgba(165, 182, 141, 0.05)',
                                  border: '1px solid var(--border-color)',
                                  color: 'var(--text-main)',
                                  padding: '5px 10px',
                                  fontSize: '0.75rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  cursor: 'pointer'
                                }}
                              >
                                <Send size={12} />
                                <span>Kirim Kontrak</span>
                              </button>
                            )}

                            {/* Simulasi Baca Button */}
                            {c.status_persetujuan === 'TERKIRIM' && (
                              <button
                                onClick={() => handleSimulateStatus(c, 'DIBACA')}
                                className="btn-secondary"
                                style={{
                                  background: 'rgba(52, 152, 219, 0.1)',
                                  border: '1px solid rgba(52, 152, 219, 0.3)',
                                  color: '#3498db',
                                  padding: '5px 10px',
                                  fontSize: '0.75rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  cursor: 'pointer'
                                }}
                              >
                                <span>👁️ Simulasi Baca</span>
                              </button>
                            )}

                            {/* Simulasi TTD Button */}
                            {c.status_persetujuan === 'DIBACA' && (
                              <button
                                onClick={() => handleSimulateStatus(c, 'KONTRAK DITANDATANGANI')}
                                className="btn-secondary"
                                style={{
                                  background: 'rgba(46, 204, 113, 0.1)',
                                  border: '1px solid rgba(46, 204, 113, 0.3)',
                                  color: '#2ECC71',
                                  padding: '5px 10px',
                                  fontSize: '0.75rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  cursor: 'pointer'
                                }}
                              >
                                <span>✍️ Simulasi TTD</span>
                              </button>
                            )}

                            {/* Download PDF Button */}
                            {(c.status_persetujuan === 'KONTRAK DITANDATANGANI' || c.status_persetujuan === 'DISETUJUI') && (
                              <button
                                onClick={() => handleDownloadPDF(c)}
                                className="btn-primary"
                                style={{
                                  background: 'var(--text-main)',
                                  color: '#000',
                                  border: '1px solid var(--border-color)',
                                  padding: '5px 12px',
                                  fontSize: '0.75rem',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontWeight: 700
                                }}
                              >
                                <Download size={12} />
                                <span>📄 Download PDF</span>
                              </button>
                            )}

                            {/* Edit Button */}
                            {c.status_persetujuan !== 'KONTRAK DITANDATANGANI' && c.status_persetujuan !== 'DISETUJUI' && (
                              <button
                                onClick={() => openEditModal(c)}
                                title="Edit Kontrak"
                                style={{
                                  width: '28px', height: '28px', background: 'rgba(243, 156, 18, 0.1)',
                                  border: '1px solid rgba(243, 156, 18, 0.3)', borderRadius: '6px',
                                  color: '#f39c12', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}
                              >
                                ✏️
                              </button>
                            )}

                            {/* Delete Button */}
                            <button
                              onClick={() => handleDeleteContract(c.id)}
                              title="Hapus Kontrak"
                              style={{
                                width: '28px', height: '28px', background: 'rgba(231,76,60,0.1)',
                                border: '1px solid rgba(231,76,60,0.3)', borderRadius: '6px',
                                color: '#e74c3c', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                              }}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '20px' }}>
              <button
                className="btn-secondary"
                disabled={currentPage === 1}
                onClick={() => handlePageChange(currentPage - 1)}
                style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <ArrowLeft size={14} /> Prev
              </button>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Halaman <strong>{currentPage}</strong> dari <strong>{totalPages}</strong>
              </span>
              <button
                className="btn-secondary"
                disabled={currentPage === totalPages}
                onClick={() => handlePageChange(currentPage + 1)}
                style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                Next <ArrowRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* --- MODAL INPUT TAMBAH KONTRAK BARU --- */}
      {showModal && (
        <div className="modal-backdrop" style={{ zIndex: 999 }}>
          <div className="glass-card modal-content animate-fade-in" style={{ maxWidth: '650px', width: '90%', background: '#150c05', border: '1px solid var(--border-color)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: '20px', fontWeight: 600, color: 'var(--text-main)', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>Terbitkan Kontrak Kerja Baru</h3>

            {errorMsg && (
              <p style={{ color: 'var(--danger)', background: 'var(--danger-glow)', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem' }}>
                {errorMsg}
              </p>
            )}

            <form onSubmit={triggerSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="input-group">
                  <label>Jenis Dokumen Kontrak</label>
                  <select
                    className="input-field"
                    value={jenisKontrak}
                    onChange={(e) => setJenisKontrak(e.target.value)}
                    style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}
                    required
                  >
                    <option value="Surat Magang">📄 Surat Magang (Durasi 1 Bulan)</option>
                    <option value="Kontrak 3 Bulan">📄 Kontrak Kerja 3 Bulan (Terhitung dari Awal Masuk)</option>
                    <option value="Kontrak 1 Tahun">📄 Kontrak Kerja 1 Tahun</option>
                  </select>
                </div>

                <div className="input-group">
                  <label>Nomor Surat (Auto-Generate)</label>
                  <input
                    type="text"
                    className="input-field"
                    value={nomorSurat}
                    readOnly
                    disabled
                    style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid var(--border-color)', color: 'var(--text-main)', fontFamily: 'monospace', fontWeight: 'bold' }}
                  />
                </div>
              </div>

              {/* Employee selection */}
              <div className="input-group">
                <label>Pihak Kedua (Pilih Karyawan)</label>
                <select
                  className="input-field"
                  value={employeeId}
                  onChange={(e) => handleEmployeeChange(e.target.value)}
                  style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}
                  required
                >
                  <option value="">-- Pilih Nama Karyawan --</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.full_name} ({e.outlet})</option>
                  ))}
                </select>
              </div>

              {/* Autopopulated read-only fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="input-group">
                  <label>Nomor KTP / NIK</label>
                  <input
                    type="text"
                    className="input-field"
                    value={nikKaryawan}
                    readOnly
                    disabled
                    placeholder="Auto-populated"
                    style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}
                  />
                </div>

                <div className="input-group">
                  <label>Status Karyawan</label>
                  <input
                    type="text"
                    className="input-field"
                    value={statusKaryawan}
                    readOnly
                    disabled
                    placeholder="Auto-populated"
                    style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}
                  />
                </div>
              </div>

              <div className="input-group">
                <label>Tempat & Tanggal Lahir (Auto-Populate)</label>
                <input
                  type="text"
                  className="input-field"
                  value={tempatTanggalLahir}
                  onChange={(e) => setTempatTanggalLahir(e.target.value)}
                  placeholder="Tempat Lahir, DD-MM-YYYY"
                  style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}
                />
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '4px' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'rgba(238, 238, 238, 0.8)', marginBottom: '10px' }}>STRUKTUR GAJI & TUNJANGAN HAK KARYAWAN</h4>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="input-group">
                  <label>Gaji Pokok Pihak Kedua</label>
                  <select
                    className="input-field"
                    value={gajiPokok}
                    onChange={(e) => setGajiPokok(parseInt(e.target.value, 10))}
                    style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}
                    required
                  >
                    <option value={1000000}>Rp 1.000.000</option>
                    <option value={1200000}>Rp 1.200.000</option>
                    <option value={1500000}>Rp 1.500.000</option>
                    <option value={1700000}>Rp 1.700.000</option>
                  </select>
                </div>

                <div className="input-group">
                  <label>Uang Makan (Terkunci Per Hari)</label>
                  <input
                    type="text"
                    className="input-field"
                    value={formatCurrency(uangMakan)}
                    readOnly
                    disabled
                    style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                <div className="input-group">
                  <label>Uang Lembur (Harian)</label>
                  <input
                    type="number"
                    className="input-field"
                    value={uangLembur}
                    onChange={(e) => setUangLembur(parseInt(e.target.value, 10) || 0)}
                    style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'var(--text-main)', fontSize: '0.8rem' }}
                  />
                </div>
                <div className="input-group">
                  <label>Tunj. Lama Bekerja</label>
                  <input
                    type="text"
                    className="input-field"
                    value={formatCurrency(tunjanganLamaBekerja)}
                    readOnly
                    disabled
                    style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid var(--border-color)', color: 'var(--text-main)', fontSize: '0.8rem' }}
                  />
                </div>
                <div className="input-group">
                  <label>Tunj. Keluarga</label>
                  <input
                    type="text"
                    className="input-field"
                    value={formatCurrency(tunjanganKeluarga)}
                    readOnly
                    disabled
                    style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid var(--border-color)', color: 'var(--text-main)', fontSize: '0.8rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="input-group">
                  <label>Tanggal Diterbitkan</label>
                  <input
                    type="date"
                    className="input-field"
                    value={tanggalPembuatan}
                    onChange={(e) => setTanggalPembuatan(e.target.value)}
                    style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}
                    required
                  />
                </div>

                <div className="input-group">
                  <label>Tanggal Selesai (Otomatis 1 Thn)</label>
                  <input
                    type="date"
                    className="input-field"
                    value={tanggalSelesai}
                    readOnly
                    disabled
                    style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '15px' }}>
                <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center', background: 'var(--text-main)', color: '#000', fontWeight: 'bold' }}>
                  <span>Simpan & Terbitkan Kontrak</span>
                </button>
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)} style={{ flex: 1 }}>
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="confirm-overlay" style={{ zIndex: 1000 }}>
          <div className="confirm-card" style={{ marginTop: '0', background: '#150c05', border: '1px solid var(--border-color)' }}>
            <h3 className="confirm-title" style={{ color: 'var(--text-main)' }}>{confirmModal.title}</h3>
            <p className="confirm-message" style={{ color: 'rgba(238, 238, 238, 0.7)' }}>{confirmModal.message}</p>
            <div className="confirm-actions">
              <button 
                className="btn-confirm-yes" 
                onClick={() => { confirmModal.onConfirm(); setConfirmModal(prev => ({ ...prev, isOpen: false })); }}
                style={{ background: '#2ecc71', color: '#000', fontWeight: 'bold' }}
              >
                {confirmModal.confirmText}
              </button>
              <button className="btn-confirm-cancel" onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}>
                {confirmModal.cancelText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreviewModal && (
        <div className="modal-backdrop" style={{ zIndex: 1050, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)' }}>
          <div className="glass-card modal-content animate-fade-in" style={{ maxWidth: '600px', width: '90%', background: 'var(--bg-card)', border: '2px solid var(--border-color)', maxHeight: '90vh', overflowY: 'auto', padding: '24px', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
            <h3 style={{ marginBottom: '16px', fontWeight: 700, color: 'var(--text-main)', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🔍</span> Preview Kontrak Kerja Digital
            </h3>
            
            <p style={{ color: 'rgba(238, 238, 238, 0.7)', fontSize: '0.82rem', marginBottom: '20px', lineHeight: '1.4' }}>
              Silakan periksa kembali detail draf kontrak berikut sebelum diterbitkan secara resmi ke karyawan bersangkutan.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: '#150c05', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '20px', fontSize: '0.85rem', color: 'var(--text-main)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', borderBottom: '1px solid rgba(65, 45, 21, 0.3)', paddingBottom: '8px' }}>
                <span style={{ color: 'rgba(238, 238, 238, 0.5)' }}>Nomor Surat:</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#fff' }}>{nomorSurat}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', borderBottom: '1px solid rgba(65, 45, 21, 0.3)', paddingBottom: '8px' }}>
                <span style={{ color: 'rgba(238, 238, 238, 0.5)' }}>Jenis Kontrak:</span>
                <span style={{ fontWeight: 600 }}>{jenisKontrak}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', borderBottom: '1px solid rgba(65, 45, 21, 0.3)', paddingBottom: '8px' }}>
                <span style={{ color: 'rgba(238, 238, 238, 0.5)' }}>Pihak Pertama (Perusahaan):</span>
                <span style={{ color: '#fff', fontWeight: 600 }}>Barokah Group (Management HRD)</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', borderBottom: '1px solid rgba(65, 45, 21, 0.3)', paddingBottom: '8px' }}>
                <span style={{ color: 'rgba(238, 238, 238, 0.5)' }}>Pihak Kedua (Karyawan):</span>
                <span style={{ color: '#fff', fontWeight: 600 }}>{
                  (() => {
                    const emp = employees.find(e => String(e.id) === String(employeeId));
                    return emp ? emp.full_name : 'Karyawan';
                  })()
                }</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', borderBottom: '1px solid rgba(65, 45, 21, 0.3)', paddingBottom: '8px' }}>
                <span style={{ color: 'rgba(238, 238, 238, 0.5)' }}>NIK Karyawan:</span>
                <span style={{ color: '#fff' }}>{nikKaryawan}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', borderBottom: '1px solid rgba(65, 45, 21, 0.3)', paddingBottom: '8px' }}>
                <span style={{ color: 'rgba(238, 238, 238, 0.5)' }}>Outlet Penugasan:</span>
                <span>{
                  (() => {
                    const emp = employees.find(e => String(e.id) === String(employeeId));
                    return emp ? emp.outlet : '-';
                  })()
                }</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', borderBottom: '1px solid rgba(65, 45, 21, 0.3)', paddingBottom: '8px' }}>
                <span style={{ color: 'rgba(238, 238, 238, 0.5)' }}>Status / Jabatan:</span>
                <span>{statusKaryawan} / {
                  (() => {
                    const emp = employees.find(e => String(e.id) === String(employeeId));
                    return emp ? emp.position : '-';
                  })()
                }</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', borderBottom: '1px solid rgba(65, 45, 21, 0.3)', paddingBottom: '8px' }}>
                <span style={{ color: 'rgba(238, 238, 238, 0.5)' }}>Masa Berlaku Kontrak:</span>
                <span>{tanggalPembuatan} s/d {tanggalSelesai}</span>
              </div>
              
              <div style={{ margin: '8px 0', borderTop: '1px dashed var(--border-color)' }}></div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', borderBottom: '1px solid rgba(65, 45, 21, 0.3)', paddingBottom: '8px' }}>
                <span style={{ color: 'rgba(238, 238, 238, 0.5)' }}>Gaji Pokok:</span>
                <span style={{ color: '#2ecc71', fontWeight: 700 }}>{formatCurrency(gajiPokok)}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', borderBottom: '1px solid rgba(65, 45, 21, 0.3)', paddingBottom: '8px' }}>
                <span style={{ color: 'rgba(238, 238, 238, 0.5)' }}>Uang Makan (Harian):</span>
                <span>{formatCurrency(uangMakan)} / hari kerja</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', borderBottom: '1px solid rgba(65, 45, 21, 0.3)', paddingBottom: '8px' }}>
                <span style={{ color: 'rgba(238, 238, 238, 0.5)' }}>Uang Lembur (Harian):</span>
                <span>{formatCurrency(uangLembur)} / hari kerja</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', borderBottom: '1px solid rgba(65, 45, 21, 0.3)', paddingBottom: '8px' }}>
                <span style={{ color: 'rgba(238, 238, 238, 0.5)' }}>Tunj. Lama Bekerja:</span>
                <span>{formatCurrency(tunjanganLamaBekerja)}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', paddingBottom: '4px' }}>
                <span style={{ color: 'rgba(238, 238, 238, 0.5)' }}>Tunj. Keluarga:</span>
                <span>{formatCurrency(tunjanganKeluarga)}</span>
              </div>
            </div>

            {/* Pasal-pasal Kontrak */}
            <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px', background: 'var(--bg-main)', marginBottom: '14px', fontSize: '0.78rem', lineHeight: '1.7', color: 'var(--text-main)', maxHeight: '280px', overflowY: 'auto' }}>
              <p style={{ fontWeight: 800, fontSize: '0.85rem', marginBottom: '10px', textAlign: 'center' }}>ISI PERJANJIAN KERJA (9 PASAL)</p>
              <p><strong>Pasal 1 — Ketentuan Umum & Ruang Lingkup</strong><br/>
                Pihak Kedua bekerja sebagai karyawan di bawah arahan Pihak Pertama dan wajib mematuhi seluruh peraturan perusahaan serta SOP yang berlaku.</p>
              <p style={{ marginTop: '8px' }}><strong>Pasal 2 — Masa Berlaku & Jenis Kontrak</strong><br/>
                Perjanjian kerja ini berlaku untuk jangka waktu tertentu terhitung mulai tanggal {tanggalPembuatan} sampai {tanggalSelesai || '-'} ({jenisKontrak}).</p>
              <p style={{ marginTop: '8px' }}><strong>Pasal 3 — Waktu Kerja & Kedisiplinan</strong><br/>
                Pihak Kedua wajib menaati jam kerja yang ditetapkan, melakukan presensi dengan jujur, serta menjaga kedisiplinan dan nama baik perusahaan.</p>
              <p style={{ marginTop: '8px' }}><strong>Pasal 4 — Gaji & Tunjangan</strong><br/>
                Pihak Kedua berhak menerima Gaji Pokok sebesar {formatCurrency(gajiPokok)}/bulan, Uang Makan {formatCurrency(uangMakan)}/hari kerja, Uang Lembur {formatCurrency(uangLembur)}/hari kerja, Tunjangan Lama Bekerja {formatCurrency(tunjanganLamaBekerja)}, dan Tunjangan Keluarga {formatCurrency(tunjanganKeluarga)} sesuai ketentuan.</p>
              <p style={{ marginTop: '8px' }}><strong>Pasal 5 — Kewajiban Karyawan</strong><br/>
                Pihak Kedua wajib menjalankan seluruh tugas pekerjaan dengan penuh tanggung jawab, memelihara aset perusahaan, serta melaporkan operasional secara jujur.</p>
              <p style={{ marginTop: '8px' }}><strong>Pasal 6 — Kerahasiaan Perusahaan (NDA) & Resep</strong><br/>
                Pihak Kedua wajib menjaga kerahasiaan resep masakan, formula rasa, data keuangan, dan rahasia dagang perusahaan. Pelanggaran terhadap NDA dikenakan denda sebesar Rp 25.000.000.</p>
              <p style={{ marginTop: '8px' }}><strong>Pasal 7 — Pemutusan Hubungan Kerja (PHK)</strong><br/>
                Pihak Pertama berhak melakukan Pemutusan Hubungan Kerja (PHK) apabila Pihak Kedua melakukan pelanggaran berat atau setelah mendapatkan Surat Peringatan (SP) I, II, dan III.</p>
              <p style={{ marginTop: '8px' }}><strong>Pasal 8 — Penalti Keluar</strong><br/>
                Apabila Pihak Kedua mengundurkan diri sebelum masa kontrak selesai (khususnya dalam 3 tahun setelah pelatihan berbayar), maka Pihak Kedua wajib membayar ganti rugi sebesar Rp 25.000.000 kepada Pihak Pertama.</p>
              <p style={{ marginTop: '8px' }}><strong>Pasal 9 — Penyelesaian Perselisihan</strong><br/>
                Segala perselisihan yang timbul dari perjanjian kerja ini akan diselesaikan secara kekeluargaan terlebih dahulu, dan apabila tidak tercapai kesepakatan akan diselesaikan melalui jalur hukum.</p>
              <div style={{ marginTop: '10px', padding: '8px 12px', background: 'rgba(59,130,246,0.06)', borderRadius: '8px', border: '1px solid rgba(59,130,246,0.2)', fontSize: '0.75rem' }}>
                ⚠️ <strong>Pernyataan Digital:</strong> Perjanjian ini bersifat digital. Dengan menekan tombol OK, Pihak Kedua menyetujui seluruh isi kontrak ini.
              </div>
            </div>

            {/* Tanda Tangan */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div style={{ textAlign: 'center', padding: '12px', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Pihak Pertama (General Manager)</p>
                <div style={{ height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #3B82F6', borderRadius: '6px', background: 'rgba(59,130,246,0.04)' }}>
                  <span style={{ fontSize: '0.8rem', color: '#3B82F6', fontWeight: 700, fontStyle: 'italic' }}>✍ TTD General Manager</span>
                </div>
                <p style={{ fontSize: '0.74rem', marginTop: '6px', fontWeight: 700 }}>Harry Setiawan</p>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>General Manager — Barokah Group</p>
              </div>
              <div style={{ textAlign: 'center', padding: '12px', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Pihak Kedua (Karyawan)</p>
                <div style={{ height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #10b981', borderRadius: '6px', background: 'rgba(16,185,129,0.04)' }}>
                  <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 700, fontStyle: 'italic' }}>⏳ Menunggu Persetujuan</span>
                </div>
                <p style={{ fontSize: '0.74rem', marginTop: '6px', fontWeight: 700 }}>{(() => { const emp = employees.find(e => String(e.id) === String(employeeId)); return emp ? emp.full_name : '-'; })()}</p>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{(() => { const emp = employees.find(e => String(e.id) === String(employeeId)); return emp ? emp.outlet : '-'; })()}</p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>

              <button 
                type="button"
                className="btn-primary" 
                disabled={isSubmitting}
                onClick={() => {
                  executeSubmit();
                }} 
                style={{ flex: 1, justifyContent: 'center', background: '#2ecc71', color: '#000', fontWeight: 'bold', padding: '10px', borderRadius: '8px', cursor: isSubmitting ? 'not-allowed' : 'pointer', border: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {isSubmitting ? (
                  <div className="spinner-mini" style={{ width: '16px', height: '16px', border: '2px solid transparent', borderTopColor: 'var(--bg-surface)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                ) : (
                  <span>Simpan & Terbitkan</span>
                )}
              </button>
              <button 
                type="button"
                className="btn-secondary" 
                disabled={isSubmitting}
                onClick={() => setShowPreviewModal(false)} 
                style={{ flex: 1, justifyContent: 'center', background: 'rgba(255,255,255,0.08)', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '10px', borderRadius: '8px', cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
              >
                Perbaiki Lagi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL INPUT TAMBAH PENUGASAN LAIN-LAIN BARU --- */}
      {showLainLainModal && (
        <div className="modal-backdrop" style={{ zIndex: 999 }}>
          <div className="glass-card modal-content animate-fade-in" style={{ maxWidth: '650px', width: '90%', background: '#150c05', border: '1px solid var(--border-color)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: '20px', fontWeight: 600, color: 'var(--text-main)', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>Terbitkan Surat Penugasan Baru</h3>

            {errorMsg && (
              <p style={{ color: 'var(--danger)', background: 'var(--danger-glow)', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem' }}>
                {errorMsg}
              </p>
            )}

            <form onSubmit={triggerSaveLainLain} style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="input-group">
                  <label>Jenis Surat Penugasan</label>
                  <select
                    className="input-field"
                    value={jenisSuratLain}
                    onChange={(e) => setJenisSuratLain(e.target.value)}
                    style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}
                    required
                  >
                    <option value="Surat Dinas">Surat Dinas</option>
                    <option value="Surat Pemindahan Tugas">Surat Pemindahan Tugas</option>
                    <option value="Surat Perintah">Surat Perintah</option>
                  </select>
                </div>

                <div className="input-group">
                  <label>Nomor Surat (Auto-Generate)</label>
                  <input
                    type="text"
                    className="input-field"
                    value={nomorSuratLain}
                    readOnly
                    disabled
                    style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid var(--border-color)', color: 'var(--text-main)', fontFamily: 'monospace', fontWeight: 'bold' }}
                  />
                </div>
              </div>

              {/* Employee selection */}
              <div className="input-group">
                <label>Pihak Kedua (Pilih Karyawan)</label>
                <select
                  className="input-field"
                  value={employeeIdLain}
                  onChange={(e) => setEmployeeIdLain(e.target.value)}
                  style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}
                  required
                >
                  <option value="">-- Pilih Nama Karyawan --</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.full_name} ({e.outlet})</option>
                  ))}
                </select>
              </div>

              {/* Keterangan / Detail Penugasan */}
              <div className="input-group">
                <label>Keterangan / Detail Penugasan (Manual)</label>
                <textarea
                  className="input-field"
                  rows="6"
                  value={keteranganLain}
                  onChange={(e) => setKeteranganLain(e.target.value)}
                  placeholder="Ketik detail instruksi dinas, mutasi outlet, atau surat perintah penugasan di sini secara manual..."
                  style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'var(--text-main)', resize: 'vertical', lineHeight: 1.5 }}
                  required
                />
              </div>

              <div className="input-group">
                <label>Tanggal Diterbitkan</label>
                <input
                  type="date"
                  className="input-field"
                  value={tanggalPembuatanLain}
                  onChange={(e) => setTanggalPembuatanLain(e.target.value)}
                  style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '15px' }}>
                <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center', background: 'var(--text-main)', color: '#000', fontWeight: 'bold' }}>
                  <span>Simpan & Terbitkan Surat</span>
                </button>
                <button type="button" className="btn-secondary" onClick={() => setShowLainLainModal(false)} style={{ flex: 1 }}>
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- PREVIEW MODAL PENUGASAN LAIN-LAIN --- */}
      {showLainLainPreviewModal && (
        <div className="modal-backdrop" style={{ zIndex: 1050, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)' }}>
          <div className="glass-card modal-content animate-fade-in" style={{ maxWidth: '600px', width: '90%', background: 'var(--bg-card)', border: '2px solid var(--border-color)', maxHeight: '90vh', overflowY: 'auto', padding: '24px', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
            <h3 style={{ marginBottom: '16px', fontWeight: 700, color: 'var(--text-main)', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🔍</span> Preview Surat Penugasan
            </h3>
            
            <p style={{ color: 'rgba(238, 238, 238, 0.7)', fontSize: '0.82rem', marginBottom: '20px', lineHeight: '1.4' }}>
              Silakan periksa kembali rincian surat penugasan berikut sebelum diterbitkan secara resmi.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: '#150c05', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '20px', fontSize: '0.85rem', color: 'var(--text-main)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', borderBottom: '1px solid rgba(65, 45, 21, 0.3)', paddingBottom: '8px' }}>
                <span style={{ color: 'rgba(238, 238, 238, 0.5)' }}>Nomor Surat:</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#fff' }}>{nomorSuratLain}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', borderBottom: '1px solid rgba(65, 45, 21, 0.3)', paddingBottom: '8px' }}>
                <span style={{ color: 'rgba(238, 238, 238, 0.5)' }}>Jenis Surat:</span>
                <span style={{ fontWeight: 600 }}>{jenisSuratLain}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', borderBottom: '1px solid rgba(65, 45, 21, 0.3)', paddingBottom: '8px' }}>
                <span style={{ color: 'rgba(238, 238, 238, 0.5)' }}>Pihak Pertama (Perusahaan):</span>
                <span style={{ color: '#fff', fontWeight: 600 }}>Barokah Group (Management HRD)</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', borderBottom: '1px solid rgba(65, 45, 21, 0.3)', paddingBottom: '8px' }}>
                <span style={{ color: 'rgba(238, 238, 238, 0.5)' }}>Pihak Kedua (Karyawan):</span>
                <span style={{ color: '#fff', fontWeight: 600 }}>{
                  (() => {
                    const emp = employees.find(e => String(e.id) === String(employeeIdLain));
                    return emp ? emp.full_name : 'Karyawan';
                  })()
                }</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', borderBottom: '1px solid rgba(65, 45, 21, 0.3)', paddingBottom: '8px' }}>
                <span style={{ color: 'rgba(238, 238, 238, 0.5)' }}>NIK Karyawan:</span>
                <span style={{ color: '#fff' }}>{
                  (() => {
                    const emp = employees.find(e => String(e.id) === String(employeeIdLain));
                    return emp ? emp.nik : '-';
                  })()
                }</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', borderBottom: '1px solid rgba(65, 45, 21, 0.3)', paddingBottom: '8px' }}>
                <span style={{ color: 'rgba(238, 238, 238, 0.5)' }}>Outlet / Jabatan:</span>
                <span>{
                  (() => {
                    const emp = employees.find(e => String(e.id) === String(employeeIdLain));
                    return emp ? `${emp.outlet} / ${emp.position}` : '-';
                  })()
                }</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', borderBottom: '1px solid rgba(65, 45, 21, 0.3)', paddingBottom: '8px' }}>
                <span style={{ color: 'rgba(238, 238, 238, 0.5)' }}>Tanggal Terbit:</span>
                <span>{tanggalPembuatanLain}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingTop: '4px' }}>
                <span style={{ color: 'rgba(238, 238, 238, 0.5)' }}>Keterangan Penugasan:</span>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(65,45,21,0.2)', whiteSpace: 'pre-wrap', color: '#fff' }}>
                  {keteranganLain || '-'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                type="button"
                className="btn-primary" 
                disabled={isSubmitting}
                onClick={() => {
                  executeSubmitLainLain();
                }} 
                style={{ flex: 1, justifyContent: 'center', background: '#2ecc71', color: '#000', fontWeight: 'bold', padding: '10px', borderRadius: '8px', cursor: isSubmitting ? 'not-allowed' : 'pointer', border: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {isSubmitting ? (
                  <div className="spinner-mini" style={{ width: '16px', height: '16px', border: '2px solid transparent', borderTopColor: 'var(--bg-surface)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                ) : (
                  <span>Simpan & Terbitkan</span>
                )}
              </button>
              <button 
                type="button"
                className="btn-secondary" 
                disabled={isSubmitting}
                onClick={() => setShowLainLainPreviewModal(false)} 
                style={{ flex: 1, justifyContent: 'center', background: 'rgba(255,255,255,0.08)', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '10px', borderRadius: '8px', cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
              >
                Perbaiki Lagi
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

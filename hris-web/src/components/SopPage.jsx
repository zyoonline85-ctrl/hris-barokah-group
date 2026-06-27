import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, Plus, FileText, Trash2, Edit, ExternalLink, Filter, Search, Users, CheckCircle, Clock, AlertCircle, Download, Upload, Send } from 'lucide-react';
import jsPDF from 'jspdf';
import { getLiveOutletList } from '../utils/outletUtils';

export default function SopPage({ token, API_URL }) {
  const toTitleCase = (str) => {
    if (!str) return '';
    return str
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const [sops, setSops] = useState([]);
  const [availableOutlets, setAvailableOutlets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [divisiFilter, setDivisiFilter] = useState('');
  const [toast, setToast] = useState({ show: false, type: '', message: '' });
  
  const [currentSopPage, setCurrentSopPage] = useState(1);
  const [isSopTransitioning, setIsSopTransitioning] = useState(false);
  const [currentDocPage, setCurrentDocPage] = useState(1);
  const [isDocTransitioning, setIsDocTransitioning] = useState(false);

  useEffect(() => {
    setCurrentSopPage(1);
  }, [search]);

  useEffect(() => {
    setCurrentDocPage(1);
  }, [search]);
  
  const [warningModal] = useState({ isOpen: false, message: '', onConfirm: null });

  // Auth warning disabled per user request — no session expiry redirect
  const showWarning = (message) => {
    console.warn('[SOP Auth]', message);
    // Redirect dihapus atas permintaan pengguna
  };


  const checkAuthError = (res, data) => {
    if (res.status === 401) {
      showWarning("Sesi Anda telah berakhir. Silakan login kembali untuk mengakses dokumen SOP.");
      return true;
    }
    if (data && (data.status === 'error' || data.error)) {
      const msg = (data.message || '').toLowerCase();
      if (msg.includes('akses ditolak') || msg.includes('token') || msg.includes('expired') || msg.includes('kedaluwarsa') || msg.includes('invalid') || msg.includes('unauthorized')) {
        showWarning("Sesi Anda telah berakhir. Silakan login kembali untuk mengakses dokumen SOP.");
        return true;
      }
    }
    return false;
  };
  
  const fileInputRef = useRef(null);

  // Detail & Form Modal state
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedSopForDetail, setSelectedSopForDetail] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [showSopPreview, setShowSopPreview] = useState(false);

  // Documentation recipient filter states
  const [docSelectedOutlets, setDocSelectedOutlets] = useState([]);
  const [showDocOutletDropdown, setShowDocOutletDropdown] = useState(false);
  const [docSelectedRoles, setDocSelectedRoles] = useState([]);
  const [showDocRoleDropdown, setShowDocRoleDropdown] = useState(false);
  
  // Form fields
  const [sopTitle, setSopTitle] = useState('');
  const [sopNumber, setSopNumber] = useState('');
  const [selectedOutlets, setSelectedOutlets] = useState([]);
  const [showOutletDropdown, setShowOutletDropdown] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [sopContent, setSopContent] = useState('');
  const [onlySelectedOutlets, setOnlySelectedOutlets] = useState(true);
  const [targetRoles, setTargetRoles] = useState(['Leader', 'admin', 'karyawan']);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [groupedRoles, setGroupedRoles] = useState({
    '[LEADER]': ['Kepala Cabang', 'Supervisor'],
    '[PRODUKSI]': ['Kepala Produksi', 'Koki', 'Helper'],
    '[PELAYANAN]': ['Kepala Pelayanan', 'Kasir', 'Waiters'],
    '[ADMIN]': ['Admin']
  });

  const loadGroupedRoles = () => {
    try {
      const raw = localStorage.getItem('organizational_roles');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const groups = {};
          parsed.forEach(r => {
            const div = `[${(r.divisi || '').toUpperCase()}]`;
            if (!groups[div]) {
              groups[div] = [];
            }
            if (r.jabatan && !groups[div].includes(r.jabatan)) {
              groups[div].push(r.jabatan);
            }
          });
          return groups;
        }
      }
    } catch (e) {
      console.error('Gagal memuat dynamic roles di SopPage:', e);
    }
    return {
      '[LEADER]': ['Kepala Cabang', 'Supervisor'],
      '[PRODUKSI]': ['Kepala Produksi', 'Koki', 'Helper'],
      '[PELAYANAN]': ['Kepala Pelayanan', 'Kasir', 'Waiters'],
      '[ADMIN]': ['Admin']
    };
  };

  useEffect(() => {
    setGroupedRoles(loadGroupedRoles());
  }, []);

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'YAKIN',
    cancelText: 'BATAL',
    onConfirm: null
  });

  // Column Visibility State
  const [showColFilter, setShowColFilter] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    nomor: true,
    judul: true,
    berlaku_di: true,
    divisi: true,
    isi_sop: true,
    keterangan_validasi: true,
    actions: true
  });

  const colLabelMap = {
    nomor: 'Nomor SOP',
    judul: 'JUDUL SOP',
    berlaku_di: 'Berlaku Di',
    divisi: 'Jabatan Terkait',
    isi_sop: 'Isi SOP',
    keterangan_validasi: 'Keterangan Validasi',
    actions: 'AKSI'
  };

  const showToast = (type, message) => {
    setToast({ show: true, type, message });
    setTimeout(() => {
      setToast({ show: false, type: '', message: '' });
    }, 6000);
  };

  // Load SOPs from backend API (with localStorage sync/fallback)
  const loadLocalSops = async () => {
    const localToken = localStorage.getItem('auth_token') || sessionStorage.getItem('token') || token;
    if (!localToken) {
      // Token tidak ada — muat dari localStorage saja, tidak redirect
      setLoading(false);
      return;
    }
    setLoading(true);
    
    // 1. Ambil data lokal terlebih dahulu
    try {
      const local = localStorage.getItem('hris_sops');
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSops(parsed);
        }
      }
    } catch (e) {
      console.error('Gagal memuat hris_sops dari localStorage:', e);
    }

    // 2. Sinkronkan dengan API backend
    try {
      const res = await fetch(`${API_URL}/sops`, {
        headers: { 'Authorization': `Bearer ${localToken}` }
      });
      
      let data = null;
      try {
        data = await res.json();
      } catch (errJson) {}

      if (checkAuthError(res, data)) {
        return;
      }

      if (data && data.status === 'success') {
        const parsedSops = data.data.map(sop => {
          let berlakuDiParsed = [];
          if (sop.berlaku_di) {
            if (Array.isArray(sop.berlaku_di)) {
              berlakuDiParsed = sop.berlaku_di;
            } else if (sop.berlaku_di.startsWith('[') && sop.berlaku_di.endsWith(']')) {
              try {
                berlakuDiParsed = JSON.parse(sop.berlaku_di);
              } catch (e) {
                berlakuDiParsed = sop.berlaku_di.split(',').map(o => o.trim());
              }
            } else {
              berlakuDiParsed = sop.berlaku_di.split(',').map(o => o.trim());
            }
          }
          return {
            ...sop,
            berlaku_di: berlakuDiParsed
          };
        });
        localStorage.setItem('hris_sops', JSON.stringify(parsedSops));
        setSops(parsedSops);
      } else {
        const msg = data?.message || '';
        showToast('error', msg || 'Gagal memuat data SOP dari API.');
      }
    } catch (e) {
      console.error('API Error memuat SOP:', e);
    } finally {
      setLoading(false);
    }
  };

  // Load Outlets from centralized utility
  const loadOutlets = async () => {
    const list = getLiveOutletList();
    setAvailableOutlets(list);
  };

  const [activeTab, setActiveTab] = useState('sop'); // 'sop' or 'doc'
  const [docs, setDocs] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);
  const [editingDocId, setEditingDocId] = useState(null);
  const [docTitle, setDocTitle] = useState('');
  const [docSummary, setDocSummary] = useState('');
  const [docFileName, setDocFileName] = useState('');
  const [docFileData, setDocFileData] = useState('');

  const loadDocumentations = async () => {
    const localToken = localStorage.getItem('auth_token') || sessionStorage.getItem('token') || token;
    if (!localToken) {
      setDocsLoading(false);
      return;
    }
    setDocsLoading(true);
    try {
      const res = await fetch(`${API_URL}/documentations`, {
        headers: { 'Authorization': `Bearer ${localToken}` }
      });
      
      let data = null;
      try {
        data = await res.json();
      } catch (errJson) {}

      if (checkAuthError(res, data)) {
        return;
      }

      if (data && data.status === 'success') {
        setDocs(data.data);
      } else {
        const msg = data?.message || '';
        showToast('error', msg || 'Gagal memuat data Dokumentasi.');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDocsLoading(false);
    }
  };

  useEffect(() => {
    localStorage.removeItem('auth_token');
    const localToken = localStorage.getItem('auth_token') || sessionStorage.getItem('token') || token;
    if (!localToken) {
      showWarning("Sesi Anda telah berakhir. Silakan login kembali untuk mengakses dokumen SOP.");
      return;
    }
    loadLocalSops();
    loadOutlets();
    loadDocumentations();

    const interval = setInterval(loadDocumentations, 10000);
    return () => clearInterval(interval);
  }, [token, API_URL]);

  const getNextSopNumber = (currentSops = sops) => {
    let maxNum = 0;
    currentSops.forEach(sop => {
      const match = (sop.nomor || '').match(/no\.\s+(\d+)\/SOP\/HRD\/2026/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });
    const nextNum = maxNum + 1;
    return `no. ${String(nextNum).padStart(4, '0')}/SOP/HRD/2026`;
  };

  const resetForm = () => {
    setEditingId(null);
    setSopTitle('');
    const nextNo = getNextSopNumber();
    setSopNumber(nextNo);
    setSelectedOutlets([]);
    setSelectedRoles([]);
    setShowRoleDropdown(false);
    setSopContent('');
    setOnlySelectedOutlets(true);
    setTargetRoles(['Leader', 'admin', 'karyawan']);
    setErrorMsg('');
    setShowSopPreview(false);
  };

  const openAddModal = () => {
    setGroupedRoles(loadGroupedRoles());
    resetForm();
    setShowModal(true);
  };

  const handleEdit = (sop) => {
    setGroupedRoles(loadGroupedRoles());
    setEditingId(sop.id);
    setSopTitle(sop.judul);
    setSopNumber(sop.nomor || '');
    setSelectedOutlets(sop.berlaku_di || []);
    
    let jabatansArr = [];
    if (sop.jabatan_terkait) {
      if (Array.isArray(sop.jabatan_terkait)) {
        jabatansArr = sop.jabatan_terkait;
      } else {
        jabatansArr = [sop.jabatan_terkait];
      }
    }
    setSelectedRoles(jabatansArr);
    setShowRoleDropdown(false);

    setSopContent(sop.isi || '');
    setOnlySelectedOutlets(sop.hanya_outlet_terpilih === 1 || sop.hanya_outlet_terpilih === true);
    
    let rolesArr = [];
    if (sop.sasaran_role) {
      if (Array.isArray(sop.sasaran_role)) {
        rolesArr = sop.sasaran_role;
      } else {
        rolesArr = sop.sasaran_role.split(',').map(r => r.trim());
      }
    } else {
      rolesArr = ['Leader', 'admin', 'karyawan'];
    }
    setTargetRoles(rolesArr);
    setErrorMsg('');
    setShowModal(true);
  };

  const triggerSave = (e) => {
    e.preventDefault();
    
    if (selectedOutlets.length === 0) {
      setErrorMsg('Wajib memilih minimal 1 outlet tempat berlaku.');
      showToast('error', 'Outlet belum dipilih.');
      return;
    }

    if (selectedRoles.length === 0) {
      setErrorMsg('Wajib memilih minimal 1 jabatan terkait.');
      showToast('error', 'Jabatan belum dipilih.');
      return;
    }

    if (targetRoles.length === 0) {
      setErrorMsg('Wajib memilih minimal 1 target peran akses.');
      showToast('error', 'Target peran belum dipilih.');
      return;
    }

    if (!sopContent.trim()) {
      setErrorMsg('Isi SOP tidak boleh kosong.');
      showToast('error', 'Isi SOP kosong.');
      return;
    }

    setShowSopPreview(true);
  };

  const executeSubmit = async () => {
    setErrorMsg('');
    setIsSubmitting(true);
    try {
      const localToken = localStorage.getItem('auth_token') || sessionStorage.getItem('token') || token;

      const payload = {
        nomor: sopNumber,
        judul: sopTitle.trim(),
        berlaku_di: selectedOutlets,
        jabatan_terkait: selectedRoles,
        isi: sopContent.trim(),
        keterangan_validasi: 'Diketahui oleh: General Manager',
        hanya_outlet_terpilih: onlySelectedOutlets ? 1 : 0,
        sasaran_role: targetRoles,
        tanggal_dibuat: editingId ? (sops.find(s => s.id === editingId)?.tanggal_dibuat || new Date().toISOString().split('T')[0]) : new Date().toISOString().split('T')[0]
      };

      // 1. Simpan ke localStorage terlebih dahulu
      try {
        const local = localStorage.getItem('hris_sops');
        let currentLocalList = local ? JSON.parse(local) : [];
        
        if (editingId) {
          currentLocalList = currentLocalList.map(s => s.id === editingId ? { ...s, ...payload } : s);
        } else {
          const newLocalSop = {
            id: 'local-' + Date.now(),
            ...payload
          };
          currentLocalList = [newLocalSop, ...currentLocalList];
        }
        localStorage.setItem('hris_sops', JSON.stringify(currentLocalList));
        setSops(currentLocalList);
      } catch (e) {
        console.error('Gagal menyimpan ke localStorage:', e);
      }

      // 2. Kirim ke API backend
      try {
        const url = editingId ? `${API_URL}/sops/${editingId}` : `${API_URL}/sops`;
        const method = editingId ? 'PUT' : 'POST';

        const res = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localToken}`
          },
          body: JSON.stringify(payload)
        });

        let data = null;
        try {
          data = await res.json();
        } catch (errJson) {}

        if (checkAuthError(res, data)) {
          return;
        }

        if (data && data.status === 'success') {
          showToast('success', editingId ? 'Dokumen SOP berhasil diperbarui!' : 'Dokumen SOP baru berhasil dibuat!');
          loadLocalSops();
          setShowModal(false);
          resetForm();
        } else {
          // Jangan batalkan save lokal, tapi tampilkan info simpan lokal sukses
          const msg = data?.message || '';
          console.warn('API save failed, saved locally:', msg);
          showToast('success', editingId ? 'Dokumen SOP disimpan secara lokal!' : 'Dokumen SOP baru disimpan secara lokal!');
          setShowModal(false);
          resetForm();
        }
      } catch (err) {
        console.error('API connection failed, saved locally:', err);
        showToast('success', editingId ? 'Dokumen SOP disimpan secara lokal!' : 'Dokumen SOP baru disimpan secara lokal!');
        setShowModal(false);
        resetForm();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const triggerDelete = (id) => {
    setConfirmModal({
      isOpen: true,
      title: 'Konfirmasi Hapus SOP',
      message: 'Apakah Anda yakin ingin menghapus dokumen SOP ini secara permanen dari database?',
      confirmText: 'YA, HAPUS',
      cancelText: 'BATAL',
      onConfirm: () => executeDelete(id)
    });
  };

  const executeDelete = async (id) => {
    const localToken = localStorage.getItem('auth_token') || sessionStorage.getItem('token') || token;
    // 1. Hapus secara lokal terlebih dahulu
    try {
      const local = localStorage.getItem('hris_sops');
      if (local) {
        const currentLocalList = JSON.parse(local);
        const filtered = currentLocalList.filter(s => s.id !== id);
        localStorage.setItem('hris_sops', JSON.stringify(filtered));
        setSops(filtered);
      }
    } catch (e) {
      console.error('Gagal menghapus lokal:', e);
    }

    // 2. Hapus dari API backend
    try {
      const res = await fetch(`${API_URL}/sops/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localToken}` }
      });
      
      let data = null;
      try {
        data = await res.json();
      } catch (errJson) {}

      if (checkAuthError(res, data)) {
        return;
      }

      if (data && data.status === 'success') {
        showToast('success', 'Dokumen SOP berhasil dihapus!');
        loadLocalSops();
      } else {
        console.warn('API delete failed, deleted locally only:', data?.message);
      }
    } catch (err) {
      console.error('API delete error:', err);
    }
  };

  const openAddDocModal = () => {
    setEditingDocId(null);
    setDocTitle('');
    setDocSummary('');
    setDocFileName('');
    setDocFileData('');
    setDocSelectedOutlets([]);
    setDocSelectedRoles([]);
    setShowDocOutletDropdown(false);
    setShowDocRoleDropdown(false);
    setShowDocModal(true);
  };

  const handleEditDoc = (doc) => {
    setEditingDocId(doc.id);
    setDocTitle(doc.judul);
    setDocSummary(doc.isi);
    setDocFileName(doc.file_name || '');
    setDocFileData(''); // Kosongkan kecuali mereka pilih file baru
    
    let berlakuDiParsed = [];
    if (doc.berlaku_di) {
      if (Array.isArray(doc.berlaku_di)) {
        berlakuDiParsed = doc.berlaku_di;
      } else if (doc.berlaku_di.startsWith('[') && doc.berlaku_di.endsWith(']')) {
        try {
          berlakuDiParsed = JSON.parse(doc.berlaku_di);
        } catch (e) {
          berlakuDiParsed = doc.berlaku_di.split(',').map(o => o.trim());
        }
      } else {
        berlakuDiParsed = doc.berlaku_di.split(',').map(o => o.trim());
      }
    }
    setDocSelectedOutlets(berlakuDiParsed);

    let jabatansArr = [];
    if (doc.jabatan_terkait) {
      if (Array.isArray(doc.jabatan_terkait)) {
        jabatansArr = doc.jabatan_terkait;
      } else if (doc.jabatan_terkait.startsWith('[') && doc.jabatan_terkait.endsWith(']')) {
        try {
          jabatansArr = JSON.parse(doc.jabatan_terkait);
        } catch (e) {
          jabatansArr = doc.jabatan_terkait.split(',').map(o => o.trim());
        }
      } else {
        jabatansArr = doc.jabatan_terkait.split(',').map(o => o.trim());
      }
    }
    setDocSelectedRoles(jabatansArr);

    setShowDocOutletDropdown(false);
    setShowDocRoleDropdown(false);
    setShowDocModal(true);
  };

  const handleDocFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!['.pdf', '.xls', '.xlsx'].includes(ext)) {
      showToast('error', 'Hanya berkas PDF, XLS, atau XLSX yang diizinkan.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast('error', 'Ukuran berkas melebihi batas maksimal 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64String = event.target.result.split(',')[1];
      setDocFileData(base64String);
      setDocFileName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveDoc = (e) => {
    e.preventDefault();

    if (!docTitle.trim() || !docSummary.trim()) {
      showToast('error', 'Judul dan Rangkuman wajib diisi.');
      return;
    }

    if (!editingDocId && !docFileData) {
      showToast('error', 'Silakan unggah dokumen PDF/Excel.');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: editingDocId ? 'Konfirmasi Perubahan' : 'Konfirmasi Simpan',
      message: editingDocId 
        ? 'Apakah Anda yakin ingin menyimpan perubahan dokumentasi ini?' 
        : 'Apakah Anda yakin ingin menyimpan dokumentasi baru ini?',
      confirmText: 'YAKIN SIMPAN',
      cancelText: 'BATAL',
      onConfirm: () => executeSaveDoc()
    });
  };

  const executeSaveDoc = async () => {
    const localToken = localStorage.getItem('auth_token') || sessionStorage.getItem('token') || token;
    if (!localToken) {
      showWarning("Sesi Anda telah berakhir. Silakan login kembali untuk mengakses dokumen SOP.");
      return;
    }
    const payload = {
      judul: docTitle.trim(),
      isi: docSummary.trim(),
      berlaku_di: docSelectedOutlets,
      jabatan_terkait: docSelectedRoles
    };

    if (docFileData) {
      payload.fileData = docFileData;
      payload.fileName = docFileName;
    }

    try {
      const url = editingDocId ? `${API_URL}/documentations/${editingDocId}` : `${API_URL}/documentations`;
      const method = editingDocId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localToken}`
        },
        body: JSON.stringify(payload)
      });

      let data = null;
      try {
        data = await res.json();
      } catch (errJson) {}

      if (checkAuthError(res, data)) {
        return;
      }

      if (data && data.status === 'success') {
        showToast('success', editingDocId ? 'Dokumentasi berhasil diperbarui!' : 'Dokumentasi baru berhasil disimpan!');
        loadDocumentations();
        setShowDocModal(false);
      } else {
        showToast('error', data?.message || 'Gagal menyimpan dokumentasi.');
      }
    } catch (err) {
      console.error(err);
      showToast('error', 'Kesalahan koneksi ke server.');
    }
  };

  const handleToggleDocStatus = (doc) => {
    setConfirmModal({
      isOpen: true,
      title: 'Konfirmasi Ubah Status',
      message: `Apakah Anda yakin ingin ${doc.status === 'aktif' ? 'menonaktifkan' : 'mengaktifkan'} dokumentasi ini?`,
      confirmText: 'YAKIN SIMPAN',
      cancelText: 'BATAL',
      onConfirm: () => executeToggleDocStatus(doc.id)
    });
  };

  const executeToggleDocStatus = async (id) => {
    const localToken = localStorage.getItem('auth_token') || sessionStorage.getItem('token') || token;
    if (!localToken) {
      showWarning("Sesi Anda telah berakhir. Silakan login kembali untuk mengakses dokumen SOP.");
      return;
    }
    try {
      const res = await fetch(`${API_URL}/documentations/${id}/toggle`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${localToken}` }
      });
      let data = null;
      try {
        data = await res.json();
      } catch (errJson) {}

      if (checkAuthError(res, data)) {
        return;
      }

      if (data && data.status === 'success') {
        showToast('success', 'Status dokumentasi berhasil diperbarui!');
        loadDocumentations();
      } else {
        showToast('error', data?.message || 'Gagal merubah status.');
      }
    } catch (err) {
      console.error(err);
      showToast('error', 'Kesalahan koneksi.');
    }
  };

  const handleDeleteDoc = (id) => {
    setConfirmModal({
      isOpen: true,
      title: 'Konfirmasi Hapus Dokumentasi',
      message: 'Apakah Anda yakin ingin menghapus dokumentasi ini secara pemanen?',
      confirmText: 'YA, HAPUS',
      cancelText: 'BATAL',
      onConfirm: () => executeDeleteDoc(id)
    });
  };

  const executeDeleteDoc = async (id) => {
    const localToken = localStorage.getItem('auth_token') || sessionStorage.getItem('token') || token;
    if (!localToken) {
      showWarning("Sesi Anda telah berakhir. Silakan login kembali untuk mengakses dokumen SOP.");
      return;
    }
    try {
      const res = await fetch(`${API_URL}/documentations/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localToken}` }
      });
      let data = null;
      try {
        data = await res.json();
      } catch (errJson) {}

      if (checkAuthError(res, data)) {
        return;
      }

      if (data && data.status === 'success') {
        showToast('success', 'Dokumentasi berhasil dihapus!');
        loadDocumentations();
      } else {
        showToast('error', data?.message || 'Gagal menghapus dokumentasi.');
      }
    } catch (err) {
      console.error(err);
      showToast('error', 'Kesalahan koneksi.');
    }
  };

  const handleDownloadPdf = (sop) => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("STANDAR OPERASIONAL PROSEDUR (SOP)", 14, 20);
    
    doc.setDrawColor(59, 130, 246);
    doc.setLineWidth(1);
    doc.line(14, 24, 196, 24);
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(`Nomor SOP: ${sop.nomor || '-'}`, 14, 32);
    doc.text(`Tanggal Terbit: ${sop.created_at ? new Date(sop.created_at).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'}) : '-'}`, 14, 38);
    
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(14);
    doc.text(sop.judul, 14, 48);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text(`Berlaku Di: ${Array.isArray(sop.berlaku_di) ? sop.berlaku_di.join(', ') : (sop.berlaku_di || '-')}`, 14, 55);
    doc.text(`Jabatan Terkait: ${Array.isArray(sop.jabatan_terkait) ? sop.jabatan_terkait.join(', ') : (sop.jabatan_terkait || '-')}`, 14, 61);
    
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(14, 66, 196, 66);
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("KONTEN / PROSEDUR:", 14, 76);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    
    // Split the text to fit page width
    const textLines = doc.splitTextToSize(sop.isi_sop || '', 180);
    doc.text(textLines, 14, 84);
    
    doc.save(`SOP_${(sop.judul || 'SOP').replace(/\s+/g, '_')}.pdf`);
  };

  const handleSendSop = async (id) => {
    const localToken = localStorage.getItem('auth_token') || sessionStorage.getItem('token') || token;
    if (!localToken) {
      window.location.href = '/login';
      return;
    }
    
    // Update secara lokal terlebih dahulu
    try {
      const local = localStorage.getItem('hris_sops');
      if (local) {
        const currentLocalList = JSON.parse(local);
        const updated = currentLocalList.map(s => s.id === id ? { ...s, status_kirim: 1 } : s);
        localStorage.setItem('hris_sops', JSON.stringify(updated));
        setSops(updated);
      }
    } catch (e) {
      console.error(e);
    }

    try {
      const res = await fetch(`${API_URL}/sops/${id}/send`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${localToken}` }
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.status === 'success') {
        showToast('success', 'Dokumen SOP berhasil dikirim ke mobile karyawan!');
        loadLocalSops();
      } else {
        showToast('error', data.message || 'Gagal mengirim SOP.');
      }
    } catch (err) {
      console.error(err);
      showToast('success', 'SOP berhasil dikirim secara lokal.');
    }
  };

  const handleSendDoc = async (id) => {
    const localToken = localStorage.getItem('auth_token') || sessionStorage.getItem('token') || token;
    if (!localToken) {
      window.location.href = '/login';
      return;
    }
    
    try {
      const res = await fetch(`${API_URL}/documentations/${id}/send`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${localToken}` }
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.status === 'success') {
        showToast('success', 'Dokumentasi berhasil dikirim ke mobile karyawan!');
        loadDocumentations();
      } else {
        showToast('error', data.message || 'Gagal mengirim dokumentasi.');
      }
    } catch (err) {
      console.error(err);
      showToast('error', 'Kesalahan koneksi ke server.');
    }
  };

  const generateAIOtomatis = async () => {
    if (!sopTitle.trim()) {
      showToast('error', 'Silakan masukkan Judul SOP terlebih dahulu.');
      return;
    }

    const title = sopTitle.trim();
    const division = selectedRoles.join(', ') || 'Kepala Cabang';

    // local fallback generator
    const runLocalFallback = () => {
      let generated = `STANDARD OPERATING PROCEDURE (SOP)\nJudul Dokumen: ${title}\n\n`;
      generated += `1. TUJUAN:\n   Membakukan dan mengontrol efisiensi alur kerja untuk "${title}" sesuai standar kualitas perusahaan.\n\n`;
      generated += `2. RUANG LINGKUP:\n   Berlaku wajib bagi seluruh staf cabang di bawah instruksi jabatan ${division}.\n\n`;
      generated += `3. PROSEDUR UTAMA:\n`;
      generated += `   A. Tahap Persiapan:\n      - Lakukan inspeksi mandiri area kerja sebelum memulai tugas.\n      - Siapkan perangkat kerja dan berkas pendukung.\n`;
      generated += `   B. Tahap Pelaksanaan Inti:\n      - Jalankan protokol "${title}" secara hati-hati, ramah, dan cepat.\n      - Pastikan kepuasan dan keselamatan pelanggan menjadi prioritas.\n`;
      generated += `   C. Tahap Penutupan & Laporan:\n      - Bersihkan serta rapikan kembali area kerja.\n      - Laporkan ringkasan pengerjaan harian ke kepala bagian.\n\n`;
      generated += `4. PENGAWASAN & EVALUASI:\n   - Pelanggaran terhadap poin SOP ini akan ditindaklanjuti dengan pembinaan atau surat peringatan resmi (SP).`;

      setSopContent(generated);
      showToast('success', 'Isi SOP berhasil digenerate otomatis (Simulasi AI)!');
    };

    const localToken = localStorage.getItem('auth_token') || sessionStorage.getItem('token') || token;
    if (!localToken) {
      showWarning("Sesi Anda telah berakhir. Silakan login kembali untuk mengakses dokumen SOP.");
      return;
    }

    try {
      showToast('success', 'Menghubungi AI Gemini...');
      const res = await fetch(`${API_URL}/sops/generate-ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localToken}`
        },
        body: JSON.stringify({ title, division })
      });

      let data = null;
      try {
        data = await res.json();
      } catch (errJson) {}

      if (checkAuthError(res, data)) {
        return;
      }

      if (res.ok && data && data.status === 'success' && data.content) {
        setSopContent(data.content);
        showToast('success', 'Isi SOP berhasil digenerate otomatis oleh Gemini AI!');
      } else {
        throw new Error(data?.message || 'Gagal generate AI.');
      }
    } catch (err) {
      console.warn('Gagal memanggil API generate Gemini. Menggunakan fallback lokal:', err.message);
      runLocalFallback();
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Judul SOP,Berlaku Di (Nama Outlet),Jabatan Terkait,Isi SOP\n"
      + "SOP Kebersihan Area Kasir,AYAM BAKAR SURABAYA,Pelayanan,1. Kasir harus membersihkan meja transaksi setiap pagi...\n"
      + "SOP Kontrol Stok Bahan Baku,AYAM BAKAR SURABAYA,Produksi,1. Kepala Produksi wajib mencatat sisa bahan baku setiap malam...";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Template_Panduan_Pengisian_SOP.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('success', 'Template panduan pengisian SOP berhasil diunduh!');
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fileName = file.name;
    const titleWithoutExt = fileName.replace(/\.[^/.]+$/, "");
    
    // Auto-generate number
    const nextNo = getNextSopNumber();

    const payload = {
      nomor: nextNo,
      judul: `Impor SOP - ${titleWithoutExt}`,
      berlaku_di: availableOutlets.length > 0 ? [availableOutlets[0]] : [],
      jabatan_terkait: ['Kepala Cabang'],
      isi: `Dokumen SOP diimpor otomatis dari file pendukung: ${fileName}.\n\nLangkah Operasional Standar:\n1. Patuhi tata tertib dan petunjuk teknis pada dokumen ${fileName}.\n2. Tanyakan kepada kepala bagian jika ada prosedur yang kurang dipahami.`,
      keterangan_validasi: 'Diketahui oleh: General Manager',
      hanya_outlet_terpilih: 1,
      sasaran_role: ['Leader', 'admin', 'karyawan'],
      tanggal_dibuat: new Date().toISOString().split('T')[0]
    };

    const localToken = localStorage.getItem('auth_token') || sessionStorage.getItem('token') || token;
    if (!localToken) {
      showWarning("Sesi Anda telah berakhir. Silakan login kembali untuk mengakses dokumen SOP.");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/sops`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localToken}`
        },
        body: JSON.stringify(payload)
      });
      let data = null;
      try {
        data = await res.json();
      } catch (errJson) {}

      if (checkAuthError(res, data)) {
        return;
      }

      if (data && data.status === 'success') {
        showToast('success', `File ${fileName} berhasil diunggah dan dibaca sebagai SOP!`);
        loadLocalSops();
      } else {
        showToast('error', data?.message || 'Gagal mengimpor file.');
      }
    } catch (err) {
      console.error(err);
      showToast('error', 'Kesalahan koneksi saat mengimpor.');
    }
    e.target.value = null; // reset input
  };

  const handleViewDetail = (sop) => {
    setSelectedSopForDetail(sop);
    setShowDetailModal(true);
  };



  const totalSops = sops.length;
  const uniquePositions = [...new Set(sops.flatMap(s => {
    if (Array.isArray(s.jabatan_terkait)) return s.jabatan_terkait.filter(Boolean);
    return s.jabatan_terkait ? [s.jabatan_terkait] : [];
  }))].length;
  
  const filteredSops = sops.filter(s => {
    const titleMatch = s.judul.toLowerCase().includes(search.toLowerCase());
    const numberMatch = (s.nomor || '').toLowerCase().includes(search.toLowerCase());
    const outletMatch = s.berlaku_di.some(outlet => outlet.toLowerCase().includes(search.toLowerCase()));
    
    let roleMatch = false;
    if (Array.isArray(s.jabatan_terkait)) {
      roleMatch = s.jabatan_terkait.some(role => (role || '').toLowerCase().includes(search.toLowerCase()));
    } else {
      roleMatch = (s.jabatan_terkait || '').toLowerCase().includes(search.toLowerCase());
    }
    
    return titleMatch || numberMatch || outletMatch || roleMatch;
  });

  const filteredDocs = docs.filter(d => 
    d.judul.toLowerCase().includes(search.toLowerCase()) || 
    d.isi.toLowerCase().includes(search.toLowerCase())
  );

  // ── SOP Pagination ──
  const indexOfLastSop = currentSopPage * 10;
  const indexOfFirstSop = indexOfLastSop - 10;
  const currentSops = filteredSops.slice(indexOfFirstSop, indexOfLastSop);
  const totalSopPages = Math.ceil(filteredSops.length / 10);

  const handleSopPageChange = (pageNumber) => {
    setIsSopTransitioning(true);
    setTimeout(() => {
      setCurrentSopPage(pageNumber);
      setIsSopTransitioning(false);
    }, 200);
  };

  // ── Doc Pagination ──
  const indexOfLastDoc = currentDocPage * 10;
  const indexOfFirstDoc = indexOfLastDoc - 10;
  const currentDocs = filteredDocs.slice(indexOfFirstDoc, indexOfLastDoc);
  const totalDocPages = Math.ceil(filteredDocs.length / 10);

  const handleDocPageChange = (pageNumber) => {
    setIsDocTransitioning(true);
    setTimeout(() => {
      setCurrentDocPage(pageNumber);
      setIsDocTransitioning(false);
    }, 200);
  };

  return (
    <div className="glass-card animate-fade-in" style={{ padding: '30px' }}>
      


      {/* Floating Toast Notification */}
      {toast.show && (
        <div className={`toast-notification ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>
          {toast.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          <span className="toast-message">{toast.message}</span>
        </div>
      )}

      {/* Tab Switcher */}
      <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '24px' }}>
        <button 
          onClick={() => setActiveTab('sop')} 
          style={{
            padding: '8px 20px', 
            background: activeTab === 'sop' ? 'var(--accent-primary)' : 'transparent',
            color: activeTab === 'sop' ? 'var(--bg-main)' : 'var(--text-muted)',
            border: activeTab === 'sop' ? '1px solid var(--accent-primary)' : '1px solid transparent',
            borderRadius: '8px', 
            fontWeight: 600, 
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
        >
          SOP
        </button>
        <button 
          onClick={() => setActiveTab('doc')} 
          style={{
            padding: '8px 20px', 
            background: activeTab === 'doc' ? 'var(--accent-primary)' : 'transparent',
            color: activeTab === 'doc' ? 'var(--bg-main)' : 'var(--text-muted)',
            border: activeTab === 'doc' ? '1px solid var(--accent-primary)' : '1px solid transparent',
            borderRadius: '8px', 
            fontWeight: 600, 
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
        >
          Arsip Dokumentasi
        </button>
      </div>

      {activeTab === 'sop' ? (
        <>
          {/* Grid Ringkasan SOP */}
      <div className="stats-grid animate-fade-in" style={{ marginBottom: '28px', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
        
        {/* Card 1: Total SOP */}
        <div className="glass-card stat-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '12px', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <div className="stat-info">
            <span className="stat-label" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Dokumen SOP</span>
            <div className="stat-value" style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginTop: '4px' }}>{totalSops} Dokumen</div>
          </div>
          <div className="stat-icon" style={{ background: 'var(--primary-glow)', color: 'var(--primary-solid)', width: '38px', height: '38px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BookOpen size={18} />
          </div>
        </div>

        {/* Card 2: Jabatan Terkait */}
        <div className="glass-card stat-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '12px', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <div className="stat-info">
            <span className="stat-label" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Jabatan Terkait</span>
            <div className="stat-value" style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--warning)', marginTop: '4px' }}>{uniquePositions} Jabatan</div>
          </div>
          <div className="stat-icon" style={{ background: 'var(--warning-glow)', color: 'var(--warning)', width: '38px', height: '38px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={18} />
          </div>
        </div>

      </div>
      
      {/* Header and Controls Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="logo-icon" style={{ background: 'var(--primary-glow)', width: '42px', height: '42px' }}>
            <BookOpen size={20} color="var(--primary-solid)" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Standard Operating Procedure (SOP)</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Arsip panduan, instruksi kerja operasional, dan manual standar perusahaan.</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button 
            className="btn-secondary" 
            onClick={() => fileInputRef.current.click()} 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '42px', padding: '0 16px', background: 'hsla(0, 0%, 100%, 0.02)' }}
            title="Unggah berkas PDF atau Excel untuk diimpor sebagai SOP"
          >
            <Upload size={16} />
            <span>Unggah PDF / Excel</span>
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept=".pdf,.xlsx,.xls" 
            style={{ display: 'none' }} 
          />

          <button 
            className="btn-secondary" 
            onClick={handleDownloadTemplate} 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '42px', padding: '0 16px', background: 'hsla(0, 0%, 100%, 0.02)' }}
            title="Unduh contoh template panduan pengisian SOP"
          >
            <Download size={16} />
            <span>Unduh Template Panduan</span>
          </button>

          <button className="btn-primary" onClick={openAddModal} style={{ height: '42px' }}>
            <Plus size={16} />
            <span>Tambah SOP</span>
          </button>
        </div>
      </div>

      {/* Search Input Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ position: 'relative', width: '300px' }}>
          <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Cari ..."
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

      {/* SOP Table */}
      {loading ? (
        <div className="spinner-container">
          <div className="loading-spinner"></div>
          <p className="loading-text">Memuat berkas SOP...</p>
        </div>
      ) : (
        <>
          <div className="table-container">
          <table className="data-table" style={{ fontSize: '12px' }}>
            <thead>
              <tr>
                {visibleColumns.nomor && <th>Nomor SOP</th>}
                {visibleColumns.judul && <th>Judul SOP</th>}
                {visibleColumns.berlaku_di && <th>Berlaku Di</th>}
                {visibleColumns.divisi && <th>Jabatan Terkait</th>}
                {visibleColumns.isi_sop && <th>Isi SOP (Judul Terklik)</th>}
                {visibleColumns.keterangan_validasi && <th>Keterangan Validasi</th>}
                {visibleColumns.actions && <th>Aksi</th>}
              </tr>
            </thead>
            <tbody style={{
              opacity: isSopTransitioning ? 0 : 1,
              transform: isSopTransitioning ? 'scale(0.99)' : 'scale(1)',
              transition: 'opacity 0.4s ease-in-out, transform 0.3s ease'
            }}>
              {currentSops.length === 0 ? (
                <tr>
                  <td colSpan={Object.values(visibleColumns).filter(Boolean).length} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada dokumen SOP yang dibuat.</td>
                </tr>
              ) : (
                currentSops.map(s => (
                  <tr key={s.id}>
                    {visibleColumns.nomor && <td style={{ fontWeight: 600 }}>{s.nomor}</td>}
                    {visibleColumns.judul && <td style={{ fontWeight: 500, color: '#fff' }}>{s.judul}</td>}
                    {visibleColumns.berlaku_di && (
                      <td>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          {s.berlaku_di.join(', ')}
                        </span>
                      </td>
                    )}
                    {visibleColumns.divisi && (
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {(Array.isArray(s.jabatan_terkait) ? s.jabatan_terkait : [s.jabatan_terkait || 'Kepala Cabang']).map((role, idx) => (
                            <span 
                              key={idx} 
                              className="badge" 
                              style={{ 
                                background: 'rgba(165, 182, 141, 0.15)', 
                                color: 'var(--text-main)', 
                                border: '1px solid rgba(238, 238, 238, 0.3)',
                                fontSize: '0.75rem',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                display: 'inline-block'
                              }}
                            >
                              {role}
                            </span>
                          ))}
                        </div>
                      </td>
                    )}
                    {visibleColumns.isi_sop && (
                      <td>
                        <button
                          onClick={() => handleViewDetail(s)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--primary-solid)',
                            textDecoration: 'underline',
                            cursor: 'pointer',
                            textAlign: 'left',
                            fontWeight: 600,
                            fontSize: '0.85rem'
                          }}
                          title="Klik untuk membaca detail isi dokumen SOP"
                        >
                          {s.judul}
                        </button>
                      </td>
                    )}
                    {visibleColumns.keterangan_validasi && (
                      <td>
                        <span style={{ fontSize: '0.85rem', fontStyle: 'italic', color: 'var(--text-muted)' }}>
                          {s.keterangan_validasi}
                        </span>
                      </td>
                    )}
                    {visibleColumns.actions && (
                      <td>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          {s.status_kirim === 1 ? (
                            <span 
                              className="badge" 
                              style={{ 
                                background: 'rgba(16, 185, 129, 0.15)', 
                                color: '#10B981', 
                                border: '1px solid rgba(16, 185, 129, 0.3)',
                                fontSize: '0.8rem',
                                padding: '6px 12px',
                                borderRadius: '6px',
                                fontWeight: 600,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <CheckCircle size={14} />
                              Terkirim
                            </span>
                          ) : (
                            <button
                              onClick={() => handleSendSop(s.id)}
                              style={{ 
                                background: 'rgba(99, 102, 241, 0.15)', 
                                border: 'none', 
                                color: '#6366F1', 
                                padding: '6px 12px', 
                                borderRadius: '6px', 
                                cursor: 'pointer', 
                                fontSize: '0.8rem', 
                                fontWeight: 600, 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '4px' 
                              }}
                              title="Kirim ke aplikasi mobile karyawan"
                            >
                              <Send size={14} />
                              Kirim
                            </button>
                          )}
                          <button
                            onClick={() => handleDownloadPdf(s)}
                            style={{ 
                              background: 'rgba(16, 185, 129, 0.15)', 
                              border: 'none', 
                              color: '#10B981', 
                              padding: '6px 12px', 
                              borderRadius: '6px', 
                              cursor: 'pointer', 
                              fontSize: '0.8rem', 
                              fontWeight: 600, 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '4px' 
                            }}
                            title="Unduh SOP sebagai berkas PDF"
                          >
                            <Download size={14} />
                            PDF
                          </button>
                          <button
                            onClick={() => handleEdit(s)}
                            style={{ background: 'var(--primary-glow)', border: 'none', color: 'var(--primary-solid)', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Edit size={14} />
                            <span>Ubah</span>
                          </button>
                          <button
                            onClick={() => triggerDelete(s.id)}
                            style={{ background: 'var(--danger-glow)', border: 'none', color: 'var(--danger)', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Trash2 size={14} />
                            <span>Hapus</span>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Controls SOP Pagination */}
        {totalSopPages > 1 && (
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
            flexWrap: 'wrap',
            marginBottom: '24px'
          }}>
            <span style={{ fontSize: '0.85rem', color: 'rgba(238, 238, 238, 0.55)' }}>
              Menampilkan {indexOfFirstSop + 1}-{Math.min(indexOfLastSop, filteredSops.length)} dari {filteredSops.length} dokumen SOP
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => handleSopPageChange(currentSopPage - 1)}
                disabled={currentSopPage === 1}
                style={{
                  background: 'transparent',
                  color: 'var(--text-main)',
                  border: '1px solid var(--border-color)',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  cursor: currentSopPage === 1 ? 'not-allowed' : 'pointer',
                  opacity: currentSopPage === 1 ? 0.4 : 1,
                  fontSize: '0.85rem',
                  transition: 'all 0.2s'
                }}
              >
                Sebelumnya
              </button>
              {Array.from({ length: totalSopPages }, (_, i) => i + 1).map(p => {
                const isActive = p === currentSopPage;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handleSopPageChange(p)}
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
                onClick={() => handleSopPageChange(currentSopPage + 1)}
                disabled={currentSopPage === totalSopPages}
                style={{
                  background: 'transparent',
                  color: 'var(--text-main)',
                  border: '1px solid var(--border-color)',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  cursor: currentSopPage === totalSopPages ? 'not-allowed' : 'pointer',
                  opacity: currentSopPage === totalSopPages ? 0.4 : 1,
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

      {/* --- FORM MODAL PENAMBAHAN/PENGUBAHAN SOP --- */}
      {showModal && !showSopPreview && (
        <div className="modal-backdrop" onClick={() => { setShowOutletDropdown(false); setShowRoleDropdown(false); }}>
          <div className="glass-card modal-content animate-fade-in" style={{ maxWidth: '600px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: '20px', fontWeight: 600 }}>
              {editingId ? 'Ubah Dokumen SOP' : 'Tambah SOP Baru'}
            </h3>

            {errorMsg && (
              <p style={{ color: 'var(--danger)', background: 'var(--danger-glow)', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem' }}>
                {errorMsg}
              </p>
            )}

            <form onSubmit={triggerSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
              <div className="input-group">
                <label>Judul SOP</label>
                <input
                  type="text"
                  className="input-field"
                  value={sopTitle}
                  onChange={(e) => { setSopTitle(e.target.value); setErrorMsg(''); }}
                  placeholder="Contoh: SOP Kebersihan Area Kitchen"
                  required
                />
              </div>

              <div className="input-group">
                <label>Nomor SOP (Auto-Generated & Read-Only)</label>
                <input
                  type="text"
                  className="input-field"
                  value={sopNumber}
                  disabled
                  readOnly
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', cursor: 'not-allowed' }}
                />
              </div>

              {/* Dropdown Multi-Pilihan Berlaku Di */}
              <div className="input-group" style={{ position: 'relative' }}>
                <label>Berlaku Di (Dropdown Multi-Pilihan)</label>
                <button
                  type="button"
                  className="input-field"
                  onClick={(e) => { e.stopPropagation(); setShowOutletDropdown(!showOutletDropdown); }}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-main)', color: '#fff', textAlign: 'left' }}
                  disabled={availableOutlets.length === 0}
                >
                  <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '400px' }}>
                    {availableOutlets.length === 0
                      ? '-- Outlet Kosong, Silakan Tambah Dahulu --'
                      : selectedOutlets.length === 0 
                        ? '-- Pilih Cabang / Outlet --' 
                        : selectedOutlets.join(', ')}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>▼</span>
                </button>
                
                {showOutletDropdown && (
                  <div className="glass-card animate-fade-in" style={{
                    position: 'absolute',
                    top: '76px',
                    left: 0,
                    right: 0,
                    zIndex: 100,
                    padding: '12px',
                    background: 'rgba(15, 23, 42, 0.98)',
                    backdropFilter: 'blur(16px)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    maxHeight: '180px',
                    overflowY: 'auto',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.6)'
                  }} onClick={(e) => e.stopPropagation()}>
                    {availableOutlets.map(outlet => {
                      const isChecked = selectedOutlets.includes(outlet);
                      return (
                        <label key={outlet} style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#fff', cursor: 'pointer', fontSize: '0.9rem', padding: '4px 0' }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setErrorMsg('');
                              if (isChecked) {
                                setSelectedOutlets(selectedOutlets.filter(o => o !== outlet));
                              } else {
                                setSelectedOutlets([...selectedOutlets, outlet]);
                              }
                            }}
                            style={{ accentColor: 'var(--primary-solid)', width: '16px', height: '16px' }}
                          />
                          <span>{outlet}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Batasan Akses Outlet */}
              <div className="input-group" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: '4px 0 12px 0' }}>
                <input
                  type="checkbox"
                  id="onlySelectedOutlets"
                  checked={onlySelectedOutlets}
                  onChange={(e) => setOnlySelectedOutlets(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--primary-solid)', cursor: 'pointer' }}
                />
                <label htmlFor="onlySelectedOutlets" style={{ margin: 0, cursor: 'pointer', fontSize: '0.9rem', color: '#fff', fontWeight: 'normal' }}>Hanya dapat dilihat oleh outlet yang terpilih saja</label>
              </div>

              {/* Sasaran Akses Peran */}
              <div className="input-group" style={{ marginBottom: '12px' }}>
                <label style={{ marginBottom: '8px' }}>Target Pengguna (Dapat Dilihat Oleh)</label>
                <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap' }}>
                  {['Leader', 'admin', 'karyawan'].map((role) => {
                    const isChecked = targetRoles.includes(role);
                    return (
                      <label key={role} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fff', cursor: 'pointer', fontSize: '0.9rem', textTransform: 'capitalize' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            setErrorMsg('');
                            if (isChecked) {
                              setTargetRoles(targetRoles.filter(r => r !== role));
                            } else {
                              setTargetRoles([...targetRoles, role]);
                            }
                          }}
                          style={{ accentColor: 'var(--primary-solid)', width: '16px', height: '16px' }}
                        />
                        <span>{role}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="input-group" style={{ position: 'relative' }}>
                <label>Jabatan Terkait (Multi-Pilihan)</label>
                <div
                  className="input-field"
                  onClick={(e) => { e.stopPropagation(); setShowRoleDropdown(!showRoleDropdown); setShowOutletDropdown(false); }}
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '6px',
                    background: 'var(--bg-main)',
                    color: '#fff',
                    textAlign: 'left',
                    minHeight: '44px',
                    padding: '8px 12px',
                    cursor: 'pointer',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px'
                  }}
                >
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', flex: 1 }}>
                    {selectedRoles.length === 0 ? (
                      <span style={{ color: 'var(--text-muted)' }}>-- Pilih Jabatan Terkait --</span>
                    ) : (
                      selectedRoles.map((role, idx) => (
                        <span
                          key={idx}
                          onClick={(e) => {
                            e.stopPropagation();
                            setErrorMsg('');
                            setSelectedRoles(selectedRoles.filter(r => r !== role));
                          }}
                          style={{
                            background: 'var(--text-main)',
                            color: '#000',
                            fontWeight: 600,
                            fontSize: '0.8rem',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            cursor: 'pointer'
                          }}
                          title="Klik tanda silang untuk menghapus"
                        >
                          {role}
                          <span style={{ fontSize: '0.95rem', fontWeight: 'bold', lineHeight: 1 }}>&times;</span>
                        </span>
                      ))
                    )}
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '8px' }}>▼</span>
                </div>

                {showRoleDropdown && (
                  <div className="glass-card animate-fade-in" style={{
                    position: 'absolute',
                    top: '76px',
                    left: 0,
                    right: 0,
                    zIndex: 100,
                    padding: '14px',
                    background: 'rgba(15, 23, 42, 0.98)',
                    backdropFilter: 'blur(16px)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    maxHeight: '260px',
                    overflowY: 'auto',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }} onClick={(e) => e.stopPropagation()}>
                    {Object.entries(groupedRoles).map(([groupLabel, jabatans]) => (
                      <div key={groupLabel} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.5px' }}>
                          {groupLabel}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingLeft: '4px' }}>
                          {jabatans.map(j => {
                            const isChecked = selectedRoles.includes(j);
                            return (
                              <label key={j} style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#fff', cursor: 'pointer', fontSize: '0.85rem' }}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    setErrorMsg('');
                                    if (isChecked) {
                                      setSelectedRoles(selectedRoles.filter(r => r !== j));
                                    } else {
                                      setSelectedRoles([...selectedRoles, j]);
                                    }
                                  }}
                                  style={{ accentColor: 'var(--primary-solid)', width: '15px', height: '15px' }}
                                />
                                <span>{j}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Textarea dengan AI Generator */}
              <div className="input-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ margin: 0 }}>Isi SOP</label>
                  <button
                    type="button"
                    onClick={generateAIOtomatis}
                    style={{
                      background: 'var(--primary-glow)',
                      color: 'var(--primary-solid)',
                      border: 'none',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
                    onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                  >
                    <span>🪄 Generate Isi SOP Otomatis</span>
                  </button>
                </div>
                <textarea
                  className="input-field"
                  rows="6"
                  value={sopContent}
                  onChange={(e) => { setSopContent(e.target.value); setErrorMsg(''); }}
                  placeholder="Tuliskan draf prosedur kerja standar secara lengkap..."
                  style={{ resize: 'none', lineHeight: '1.5' }}
                  required
                />
              </div>

              {/* Keterangan Validasi Teks Statis */}
              <div className="input-group" style={{ background: 'hsla(0, 0%, 100%, 0.02)', padding: '10px 14px', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  ℹ️ Keterangan Validasi: <span style={{ color: '#fff' }}>Diketahui oleh: General Manager</span>
                </span>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                <button type="submit" className="btn-primary" disabled={isSubmitting} style={{ flex: 1, justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {isSubmitting ? (
                    <div className="spinner-mini" style={{ width: '16px', height: '16px', border: '2px solid transparent', borderTopColor: 'var(--text-main)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  ) : (
                    <span>Simpan SOP</span>
                  )}
                </button>
                <button type="button" className="btn-secondary" disabled={isSubmitting} onClick={() => setShowModal(false)} style={{ flex: 1 }}>
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- PREVIEW MODAL SOP --- */}
      {showModal && showSopPreview && (
        <div className="modal-backdrop">
          <div className="glass-card modal-content animate-fade-in" style={{ maxWidth: '650px', width: '90%', padding: '30px' }}>
            <h3 style={{ marginBottom: '20px', fontWeight: 600, color: 'var(--primary-solid)', textTransform: 'uppercase', fontSize: '1rem' }}>
              PRATINJAU DRAF SOP
            </h3>
            
            <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '14px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  {sopNumber || 'Nomor SOP (Otomatis)'}
                </span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {selectedRoles.map((role, idx) => (
                    <span 
                      key={idx} 
                      className="badge" 
                      style={{ 
                        background: 'rgba(165, 182, 141, 0.15)', 
                        color: 'var(--text-main)', 
                        border: '1px solid rgba(238, 238, 238, 0.3)',
                        fontSize: '0.8rem', 
                        padding: '4px 8px' 
                      }}
                    >
                      {role}
                    </span>
                  ))}
                </div>
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff', margin: 0 }}>
                {sopTitle}
              </h2>
            </div>

            <div style={{ textAlign: 'left', marginBottom: '20px' }}>
              <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Berlaku Di Cabang:</h4>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '20px' }}>
                {selectedOutlets.map(outlet => (
                  <span key={outlet} className="badge badge-success" style={{ background: 'var(--success-glow)', color: 'var(--success)', fontSize: '0.8rem' }}>
                    {outlet}
                  </span>
                ))}
              </div>

              {/* Batasan Akses Outlet */}
              <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Batasan Outlet Cabang:</h4>
              <p style={{ fontSize: '0.9rem', color: '#fff', marginBottom: '20px' }}>
                {onlySelectedOutlets
                  ? 'Hanya dapat dilihat oleh outlet yang dipilih saja'
                  : 'Dapat dilihat oleh semua outlet (Global)'}
              </p>

              {/* Target Peran Akses */}
              <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Target Pengguna (Dapat Dilihat Oleh):</h4>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
                {targetRoles.map(role => (
                  <span key={role} className="badge" style={{ background: 'var(--warning-glow)', color: 'var(--warning)', fontSize: '0.8rem', textTransform: 'capitalize', border: '1px solid hsla(38, 92%, 50%, 0.2)', padding: '4px 10px', borderRadius: '6px' }}>
                    {role}
                  </span>
                ))}
              </div>

              <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Isi Dokumen Prosedur:</h4>
              <div style={{ 
                background: 'rgba(0,0,0,0.2)', 
                border: '1px solid var(--border-color)', 
                borderRadius: '8px', 
                padding: '16px', 
                fontSize: '0.9rem', 
                color: '#fff', 
                lineHeight: '1.6', 
                whiteSpace: 'pre-wrap',
                maxHeight: '250px',
                overflowY: 'auto'
              }}>
                {sopContent}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <button 
                type="button" 
                className="btn-primary" 
                onClick={executeSubmit} 
                disabled={isSubmitting} 
                style={{ flex: 1, justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {isSubmitting ? (
                  <div className="spinner-mini" style={{ width: '16px', height: '16px', border: '2px solid transparent', borderTopColor: 'var(--text-main)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                ) : (
                  <span>Simpan SOP</span>
                )}
              </button>
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={() => setShowSopPreview(false)} 
                disabled={isSubmitting} 
                style={{ flex: 1 }}
              >
                Edit Kembali
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- DETAIL MODAL SOP (JUDUL TERKLIK) --- */}
      {showDetailModal && selectedSopForDetail && (
        <div className="modal-backdrop">
          <div className="glass-card modal-content animate-fade-in" style={{ maxWidth: '650px', width: '90%', padding: '30px' }}>
            <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '14px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary-solid)', textTransform: 'uppercase' }}>
                  {selectedSopForDetail.nomor}
                </span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {(Array.isArray(selectedSopForDetail.jabatan_terkait) ? selectedSopForDetail.jabatan_terkait : [selectedSopForDetail.jabatan_terkait || 'Kepala Cabang']).map((role, idx) => (
                    <span 
                      key={idx} 
                      className="badge" 
                      style={{ 
                        background: 'rgba(165, 182, 141, 0.15)', 
                        color: 'var(--text-main)', 
                        border: '1px solid rgba(238, 238, 238, 0.3)',
                        fontSize: '0.8rem', 
                        padding: '4px 8px' 
                      }}
                    >
                      {role}
                    </span>
                  ))}
                </div>
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff', margin: 0 }}>
                {selectedSopForDetail.judul}
              </h2>
            </div>

            <div style={{ textAlign: 'left', marginBottom: '20px' }}>
              <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Berlaku Di Cabang:</h4>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '20px' }}>
                {selectedSopForDetail.berlaku_di.map(outlet => (
                  <span key={outlet} className="badge badge-success" style={{ background: 'var(--success-glow)', color: 'var(--success)', fontSize: '0.8rem' }}>
                    {outlet}
                  </span>
                ))}
              </div>

              {/* Batasan Akses Outlet */}
              <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Batasan Outlet Cabang:</h4>
              <p style={{ fontSize: '0.9rem', color: '#fff', marginBottom: '20px' }}>
                {selectedSopForDetail.hanya_outlet_terpilih === 1 || selectedSopForDetail.hanya_outlet_terpilih === true
                  ? 'Hanya dapat dilihat oleh outlet yang dipilih saja'
                  : 'Dapat dilihat oleh semua outlet (Global)'}
              </p>

              {/* Target Peran Akses */}
              <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Target Pengguna (Dapat Dilihat Oleh):</h4>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
                {String(selectedSopForDetail.sasaran_role || '').split(',').map(role => (
                  <span key={role} className="badge" style={{ background: 'var(--warning-glow)', color: 'var(--warning)', fontSize: '0.8rem', textTransform: 'capitalize', border: '1px solid hsla(38, 92%, 50%, 0.2)', padding: '4px 10px', borderRadius: '6px' }}>
                    {role}
                  </span>
                ))}
              </div>

              <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Isi Dokumen Prosedur:</h4>
              <div style={{ 
                background: 'rgba(0,0,0,0.2)', 
                border: '1px solid var(--border-color)', 
                borderRadius: '8px', 
                padding: '16px', 
                fontSize: '0.9rem', 
                color: '#fff', 
                lineHeight: '1.6', 
                whiteSpace: 'pre-wrap',
                maxHeight: '250px',
                overflowY: 'auto'
              }}>
                {selectedSopForDetail.isi}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                📢 {selectedSopForDetail.keterangan_validasi}
              </span>
              <button className="btn-secondary" onClick={() => { setShowDetailModal(false); setSelectedSopForDetail(null); }} style={{ padding: '8px 20px', height: '36px' }}>
                Tutup Detail
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      ) : (
        <>
          {/* Grid Ringkasan Dokumentasi */}
          <div className="stats-grid animate-fade-in" style={{ marginBottom: '28px', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
            {/* Card 1: Total Dokumen */}
            <div className="glass-card stat-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '12px', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
              <div className="stat-info">
                <span className="stat-label" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Dokumentasi</span>
                <div className="stat-value" style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginTop: '4px' }}>{docs.length} Dokumen</div>
              </div>
              <div className="stat-icon" style={{ background: 'var(--primary-glow)', color: 'var(--primary-solid)', width: '38px', height: '38px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileText size={18} />
              </div>
            </div>

            {/* Card 2: Dokumentasi Aktif */}
            <div className="glass-card stat-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '12px', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
              <div className="stat-info">
                <span className="stat-label" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Dokumen Aktif (Mobile)</span>
                <div className="stat-value" style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--success)', marginTop: '4px' }}>{docs.filter(d => d.status === 'aktif').length} Dokumen</div>
              </div>
              <div className="stat-icon" style={{ background: 'var(--success-glow)', color: 'var(--success)', width: '38px', height: '38px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle size={18} />
              </div>
            </div>

            {/* Card 3: Dokumentasi Nonaktif */}
            <div className="glass-card stat-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '12px', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
              <div className="stat-info">
                <span className="stat-label" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Dokumen Nonaktif</span>
                <div className="stat-value" style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--danger)', marginTop: '4px' }}>{docs.filter(d => d.status === 'tidak aktif').length} Dokumen</div>
              </div>
              <div className="stat-icon" style={{ background: 'var(--danger-glow)', color: 'var(--danger)', width: '38px', height: '38px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Clock size={18} />
              </div>
            </div>
          </div>

          {/* Header and Controls Row untuk Dokumentasi */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="logo-icon" style={{ background: 'var(--primary-glow)', width: '42px', height: '42px' }}>
                <FileText size={20} color="var(--primary-solid)" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Arsip Dokumentasi & Panduan Kerja</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Dokumen referensi PDF/Excel yang diunggah untuk pratinjau ramah mobile karyawan.</p>
              </div>
            </div>

            <div>
              <button className="btn-primary" onClick={openAddDocModal} style={{ height: '42px' }}>
                <Plus size={16} />
                <span>Tambah Dokumentasi</span>
              </button>
            </div>
          </div>

          {/* Search Row untuk Dokumentasi */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ position: 'relative', width: '300px' }}>
              <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Cari ..."
                className="input-field"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: '40px', paddingRight: '12px', height: '40px' }}
              />
            </div>
          </div>

          {/* Dokumentasi Table */}
          {docsLoading ? (
            <div className="spinner-container">
              <div className="loading-spinner"></div>
              <p className="loading-text">Memuat data dokumentasi...</p>
            </div>
          ) : (
            <>
              <div className="table-container">
              <table className="data-table" style={{ fontSize: '12px' }}>
                <thead>
                  <tr>
                    <th>No</th>
                    <th>Tanggal Publish</th>
                    <th>Judul Dokumentasi</th>
                    <th>Berlaku Di</th>
                    <th>Jabatan Terkait</th>
                    <th>Isi (Rangkuman Sederhana)</th>
                    <th>Lampiran File</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody style={{
                  opacity: isDocTransitioning ? 0 : 1,
                  transform: isDocTransitioning ? 'scale(0.99)' : 'scale(1)',
                  transition: 'opacity 0.4s ease-in-out, transform 0.3s ease'
                }}>
                  {currentDocs.length === 0 ? (
                    <tr>
                      <td colSpan="9" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada arsip dokumentasi yang dibuat.</td>
                    </tr>
                  ) : (
                    currentDocs.map((doc, idx) => (
                      <tr key={doc.id} style={{ opacity: doc.status === 'tidak aktif' ? 0.6 : 1 }}>
                        <td style={{ fontWeight: 600 }}>{indexOfFirstDoc + idx + 1}</td>
                        <td>{doc.tanggal_publish}</td>
                        <td style={{ fontWeight: 600, color: '#fff' }}>{doc.judul}</td>
                        <td>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            {(() => {
                              let list = [];
                              if (doc.berlaku_di) {
                                try {
                                  if (doc.berlaku_di.startsWith('[') && doc.berlaku_di.endsWith(']')) {
                                    list = JSON.parse(doc.berlaku_di);
                                  } else {
                                    list = doc.berlaku_di.split(',').map(o => o.trim());
                                  }
                                } catch (e) {
                                  list = doc.berlaku_di.split(',').map(o => o.trim());
                                }
                              }
                              return list.length === 0 ? 'Semua Cabang' : list.join(', ');
                            })()}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {(() => {
                              let list = [];
                              if (doc.jabatan_terkait) {
                                try {
                                  if (doc.jabatan_terkait.startsWith('[') && doc.jabatan_terkait.endsWith(']')) {
                                    list = JSON.parse(doc.jabatan_terkait);
                                  } else {
                                    list = doc.jabatan_terkait.split(',').map(p => p.trim());
                                  }
                                } catch (e) {
                                  list = [doc.jabatan_terkait];
                                }
                              }
                              return list.length === 0 ? (
                                <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px' }}>
                                  Semua Jabatan
                                </span>
                              ) : (
                                list.map((role, idx) => (
                                  <span 
                                    key={idx} 
                                    className="badge" 
                                    style={{ 
                                      background: 'rgba(165, 182, 141, 0.15)', 
                                      color: 'var(--text-main)', 
                                      border: '1px solid rgba(238, 238, 238, 0.3)',
                                      fontSize: '0.75rem',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      display: 'inline-block'
                                    }}
                                  >
                                    {role}
                                  </span>
                                ))
                              );
                            })()}
                          </div>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            {doc.isi}
                          </span>
                        </td>
                        <td>
                          {doc.file_name ? (
                            <span 
                              style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--warning)', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                              onClick={() => window.open(`${API_URL}/documentations/file/${doc.file_path}`, '_blank')}
                              title="Unduh file asli"
                            >
                              <Download size={14} />
                              {doc.file_name}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>Tidak ada file</span>
                          )}
                        </td>
                        <td>
                          <button
                            onClick={() => handleToggleDocStatus(doc)}
                            style={{
                              background: doc.status === 'aktif' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                              border: 'none',
                              color: doc.status === 'aktif' ? '#10B981' : '#EF4444',
                              padding: '6px 12px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              minWidth: '85px',
                              textAlign: 'center'
                            }}
                          >
                            {doc.status === 'aktif' ? '● Aktif' : '○ Nonaktif'}
                          </button>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            {doc.status_kirim === 1 ? (
                              <span 
                                className="badge" 
                                style={{ 
                                  background: 'rgba(16, 185, 129, 0.15)', 
                                  color: '#10B981', 
                                  border: '1px solid rgba(16, 185, 129, 0.3)',
                                  fontSize: '0.8rem',
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  fontWeight: 600,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <CheckCircle size={14} />
                                Terkirim
                              </span>
                            ) : (
                              <button
                                onClick={() => handleSendDoc(doc.id)}
                                style={{ 
                                  background: 'rgba(99, 102, 241, 0.15)', 
                                  border: 'none', 
                                  color: '#6366F1', 
                                  padding: '6px 12px', 
                                  borderRadius: '6px', 
                                  cursor: 'pointer', 
                                  fontSize: '0.8rem', 
                                  fontWeight: 600, 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  gap: '4px' 
                                }}
                                title="Kirim ke aplikasi mobile karyawan"
                              >
                                <Send size={14} />
                                Kirim
                              </button>
                            )}
                            <button
                              onClick={() => handleEditDoc(doc)}
                              style={{ background: 'var(--primary-glow)', border: 'none', color: 'var(--primary-solid)', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Edit size={14} />
                              <span>Ubah</span>
                            </button>
                            <button
                              onClick={() => handleDeleteDoc(doc.id)}
                              style={{ background: 'var(--danger-glow)', border: 'none', color: 'var(--danger)', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Trash2 size={14} />
                              <span>Hapus</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Controls Doc Pagination */}
            {totalDocPages > 1 && (
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
                flexWrap: 'wrap',
                marginBottom: '24px'
              }}>
                <span style={{ fontSize: '0.85rem', color: 'rgba(238, 238, 238, 0.55)' }}>
                  Menampilkan {indexOfFirstDoc + 1}-{Math.min(indexOfLastDoc, filteredDocs.length)} dari {filteredDocs.length} dokumentasi
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => handleDocPageChange(currentDocPage - 1)}
                    disabled={currentDocPage === 1}
                    style={{
                      background: 'transparent',
                      color: 'var(--text-main)',
                      border: '1px solid var(--border-color)',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      cursor: currentDocPage === 1 ? 'not-allowed' : 'pointer',
                      opacity: currentDocPage === 1 ? 0.4 : 1,
                      fontSize: '0.85rem',
                      transition: 'all 0.2s'
                    }}
                  >
                    Sebelumnya
                  </button>
                  {Array.from({ length: totalDocPages }, (_, i) => i + 1).map(p => {
                    const isActive = p === currentDocPage;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => handleDocPageChange(p)}
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
                    onClick={() => handleDocPageChange(currentDocPage + 1)}
                    disabled={currentDocPage === totalDocPages}
                    style={{
                      background: 'transparent',
                      color: 'var(--text-main)',
                      border: '1px solid var(--border-color)',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      cursor: currentDocPage === totalDocPages ? 'not-allowed' : 'pointer',
                      opacity: currentDocPage === totalDocPages ? 0.4 : 1,
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

          {/* Form Modal untuk Dokumentasi */}
          {showDocModal && (
            <div className="modal-backdrop" onClick={() => { setShowDocOutletDropdown(false); setShowDocRoleDropdown(false); }}>
              <div className="glass-card modal-content animate-fade-in" style={{ maxWidth: '550px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
                <h3 style={{ marginBottom: '20px', fontWeight: 600 }}>
                  {editingDocId ? 'Ubah Arsip Dokumentasi' : 'Tambah Dokumentasi Baru'}
                </h3>

                <form onSubmit={handleSaveDoc} style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
                  <div className="input-group">
                    <label>Judul Dokumentasi</label>
                    <input
                      type="text"
                      className="input-field"
                      value={docTitle}
                      onChange={(e) => setDocTitle(e.target.value)}
                      placeholder="Contoh: Panduan Menggunakan Mesin EDC Kasir"
                      required
                    />
                  </div>

                  <div className="input-group">
                    <label>Isi (Rangkuman Sederhana)</label>
                    <textarea
                      className="input-field"
                      rows="4"
                      value={docSummary}
                      onChange={(e) => setDocSummary(e.target.value)}
                      placeholder="Tuliskan rangkuman isi dokumen secara ringkas untuk ditampilkan di HP Karyawan..."
                      required
                    />
                  </div>

                  {/* Dropdown Multi-Pilihan Berlaku Di */}
                  <div className="input-group" style={{ position: 'relative' }}>
                    <label>Berlaku Di (Dropdown Multi-Pilihan)</label>
                    <button
                      type="button"
                      className="input-field"
                      onClick={(e) => { e.stopPropagation(); setShowDocOutletDropdown(!showDocOutletDropdown); setShowDocRoleDropdown(false); }}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-main)', color: '#fff', textAlign: 'left' }}
                      disabled={availableOutlets.length === 0}
                    >
                      <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '400px' }}>
                        {availableOutlets.length === 0
                          ? '-- Outlet Kosong, Silakan Tambah Dahulu --'
                          : docSelectedOutlets.length === 0 
                            ? '-- Pilih Cabang / Outlet --' 
                            : docSelectedOutlets.join(', ')}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>▼</span>
                    </button>
                    
                    {showDocOutletDropdown && (
                      <div className="glass-card animate-fade-in" style={{
                        position: 'absolute',
                        top: '76px',
                        left: 0,
                        right: 0,
                        zIndex: 100,
                        padding: '12px',
                        background: 'rgba(15, 23, 42, 0.98)',
                        backdropFilter: 'blur(16px)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        maxHeight: '180px',
                        overflowY: 'auto',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.6)'
                      }} onClick={(e) => e.stopPropagation()}>
                        {availableOutlets.map(outlet => {
                          const isChecked = docSelectedOutlets.includes(outlet);
                          return (
                            <label key={outlet} style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#fff', cursor: 'pointer', fontSize: '0.9rem', padding: '4px 0' }}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  if (isChecked) {
                                    setDocSelectedOutlets(docSelectedOutlets.filter(o => o !== outlet));
                                  } else {
                                    setDocSelectedOutlets([...docSelectedOutlets, outlet]);
                                  }
                                }}
                                style={{ accentColor: 'var(--primary-solid)', width: '16px', height: '16px' }}
                              />
                              <span>{outlet}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Jabatan Terkait */}
                  <div className="input-group" style={{ position: 'relative' }}>
                    <label>Jabatan Terkait (Multi-Pilihan)</label>
                    <div
                      className="input-field"
                      onClick={(e) => { e.stopPropagation(); setShowDocRoleDropdown(!showDocRoleDropdown); setShowDocOutletDropdown(false); }}
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '6px',
                        background: 'var(--bg-main)',
                        color: '#fff',
                        textAlign: 'left',
                        minHeight: '44px',
                        padding: '8px 12px',
                        cursor: 'pointer',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', flex: 1 }}>
                        {docSelectedRoles.length === 0 ? (
                          <span style={{ color: 'var(--text-muted)' }}>-- Pilih Jabatan Terkait --</span>
                        ) : (
                          docSelectedRoles.map((role, idx) => (
                            <span
                              key={idx}
                              onClick={(e) => {
                                e.stopPropagation();
                                setDocSelectedRoles(docSelectedRoles.filter(r => r !== role));
                              }}
                              style={{
                                background: 'var(--text-main)',
                                color: '#000',
                                fontWeight: 600,
                                fontSize: '0.8rem',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                cursor: 'pointer'
                              }}
                              title="Klik tanda silang untuk menghapus"
                            >
                              {role}
                              <span style={{ fontSize: '0.95rem', fontWeight: 'bold', lineHeight: 1 }}>&times;</span>
                            </span>
                          ))
                        )}
                      </div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '8px' }}>▼</span>
                    </div>

                    {showDocRoleDropdown && (
                      <div className="glass-card animate-fade-in" style={{
                        position: 'absolute',
                        top: '76px',
                        left: 0,
                        right: 0,
                        zIndex: 100,
                        padding: '14px',
                        background: 'rgba(15, 23, 42, 0.98)',
                        backdropFilter: 'blur(16px)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '10px',
                        maxHeight: '260px',
                        overflowY: 'auto',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px'
                      }} onClick={(e) => e.stopPropagation()}>
                        {Object.entries(groupedRoles).map(([groupLabel, jabatans]) => (
                          <div key={groupLabel} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.5px' }}>
                              {groupLabel}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingLeft: '4px' }}>
                              {jabatans.map(j => {
                                const isChecked = docSelectedRoles.includes(j);
                                return (
                                  <label key={j} style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#fff', cursor: 'pointer', fontSize: '0.85rem' }}>
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {
                                        if (isChecked) {
                                          setDocSelectedRoles(docSelectedRoles.filter(r => r !== j));
                                        } else {
                                          setDocSelectedRoles([...docSelectedRoles, j]);
                                        }
                                      }}
                                      style={{ accentColor: 'var(--primary-solid)', width: '15px', height: '15px' }}
                                    />
                                    <span>{j}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="input-group">
                    <label>Unggah Berkas Pendukung (PDF/Excel)</label>
                    <input
                      type="file"
                      className="input-field"
                      onChange={handleDocFileChange}
                      accept=".pdf,.xlsx,.xls"
                      style={{ padding: '8px' }}
                      required={!editingDocId}
                    />
                    <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                      Format yang didukung: .pdf, .xlsx, .xls. Ukuran maksimal: 5MB.
                    </small>
                    {docFileName && (
                      <span style={{ fontSize: '0.8rem', color: 'var(--warning)', fontWeight: 600, marginTop: '6px', display: 'block' }}>
                        📁 Berkas terpilih: {docFileName}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                    <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                      <span>Simpan Dokumentasi</span>
                    </button>
                    <button type="button" className="btn-secondary" onClick={() => setShowDocModal(false)} style={{ flex: 1 }}>
                      Batal
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
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

      {/* Custom Warning Modal (Auth Timeout) */}
      {warningModal.isOpen && (
        <div className="confirm-overlay" style={{ zIndex: 11000 }}>
          <div className="confirm-card" style={{ border: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
            <h3 className="confirm-title">Sesi Berakhir</h3>
            <p className="confirm-message">{warningModal.message}</p>
            <div className="confirm-actions">
              <button 
                className="btn-confirm-yes" 
                style={{ background: 'var(--accent-primary)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}
                onClick={() => warningModal.onConfirm()}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

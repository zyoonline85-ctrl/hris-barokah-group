import React, { useState, useEffect, useCallback } from 'react';
import { Store, Plus, Edit, Trash2, Search, Filter, X, CheckCircle, AlertCircle, Users } from 'lucide-react';
import { useHRIS } from '../context/HRISContext';

// ─── Konstanta Palet Warna (Modern Professional Light Tech) ─────────────────
const P = {
  bgMain: '#222831',
  bgSurface: '#393E46',
  accent: '#00ADB5',
  cream: '#EEEEEE',
  creamMuted: '#b2bec3',
  success: '#10b981',
  danger: '#ef4444',
  warning: '#f59e0b',
  successGlow: 'rgba(16, 185, 129, 0.08)',
  dangerGlow: 'rgba(239, 68, 68, 0.08)',
  warningGlow: 'rgba(245, 158, 11, 0.08)',
  creamGlow: 'rgba(0, 173, 181, 0.12)',
};

// ─── Key localStorage ─────────────────────────────────────────────────────────
const LS_KEY = 'outlet_cabang_data';

// ─── Getter: Nama Tablet = NAMA OUTLET + WILAYAH (pengenal unik antar halaman) ──
const getNamaTablet = (outlet) => {
  const nama = (outlet.nama || '').trim().toUpperCase();
  const wilayah = (outlet.wilayah || '').trim().toUpperCase();
  return wilayah ? `${nama} ${wilayah}` : nama;
};

// ─── Helper baca/tulis localStorage ─────────────────────────────────────────
const loadOutlets = () => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const persistOutlets = (data) => {
  localStorage.setItem(LS_KEY, JSON.stringify(data));
};

// ─── Locked Outlet IDs list ───
const LOCKED_OUTLET_IDS = ['ABS TT', 'APS TT', 'APS KIS', 'APS RP', 'PLPH KIS'];
const isLockedOutlet = (id) => LOCKED_OUTLET_IDS.includes(id);

// ─── Seed Data Outlet Resmi Barokah Grup ──────────────────────────────────────
const SEED_OUTLETS = [
  {
    id: 'ABS TT',
    nama: 'AYAM BAKAR SURABAYA',
    wilayah: 'TEBING TINGGI',
    alamat: 'JL. MH THAMRIN',
    permodalan: 'BOOTSTRAP',
    status: 'AKTIF',
  },
  {
    id: 'APS TT',
    nama: 'AYAM PECAK 2001 SEAFOOD',
    wilayah: 'TEBING TINGGI',
    alamat: 'DEPAN SAMSAT LAMA',
    permodalan: 'BOOTSTRAP',
    status: 'AKTIF',
  },
  {
    id: 'APS KIS',
    nama: 'AYAM PECAK 2001 SEAFOOD',
    wilayah: 'KISARAN',
    alamat: 'JL. COKRO',
    permodalan: 'BOOTSTRAP',
    status: 'AKTIF',
  },
  {
    id: 'APS RP',
    nama: 'AYAM PECAK 2001 SEAFOOD',
    wilayah: 'RANTAU PRAPAT',
    alamat: 'JL. SM RAJA',
    permodalan: 'BOOTSTRAP',
    status: 'AKTIF',
  },
  {
    id: 'PLPH KIS',
    nama: 'PECEL LELE PAK HAJI',
    wilayah: 'KISARAN',
    alamat: 'JL. SM RAJA',
    permodalan: 'BOOTSTRAP',
    status: 'AKTIF',
  },
];

const seedInitialOutlets = () => {
  try {
    const existing = localStorage.getItem(LS_KEY);
    if (existing) {
      const parsed = JSON.parse(existing);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Melakukan migrasi ID seed lama ke ID resmi baru agar tidak bentrok
        let modified = false;
        const migrated = parsed.map(o => {
          if (o.id === 'seed-out-001') { o.id = 'APS TT'; modified = true; }
          else if (o.id === 'seed-out-002') { o.id = 'APS KIS'; modified = true; }
          else if (o.id === 'seed-out-003') { o.id = 'APS RP'; modified = true; }
          else if (o.id === 'seed-out-004') { o.id = 'ABS TT'; modified = true; }
          else if (o.id === 'seed-out-005') { o.id = 'PLPH KIS'; modified = true; }
          return o;
        });
        if (modified) {
          persistOutlets(migrated);
        }
        return;
      }
    }
  } catch {}

  const seeded = SEED_OUTLETS.map(o => ({
    ...o,
    nama_tablet: getNamaTablet(o),
    created_at: new Date().toISOString(),
  }));

  persistOutlets(seeded);
};

// ─── Helper teks toPascalUpper ────────────────────────────────────────────────
const toUpper = (str) => (str || '').toUpperCase();

// ─── Komponen Utama ───────────────────────────────────────────────────────────
export default function OutletPage({ token, API_URL, user }) {
  // ─── HRIS Global Dispatch ─────────────────────────────────────────────────
  const { dispatch: hrisDispatch } = useHRIS();

  // ── State ──

  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchOutlet, setSearchOutlet] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchOutlet]);
  const [showColFilter, setShowColFilter] = useState(false);
  const [visibleCols, setVisibleCols] = useState({
    id: true,
    no: true,
    nama: true,
    wilayah: true,
    alamat: true,
    permodalan: true,
    status: true,
    aksi: true,
  });

  const colLabels = {
    id: 'ID OUTLET',
    no: 'NO',
    nama: 'NAMA OUTLET',
    wilayah: 'WILAYAH',
    alamat: 'ALAMAT',
    permodalan: 'PERMODALAN',
    status: 'STATUS',
    aksi: 'AKSI',
  };

  // ── Form state ──
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formId, setFormId] = useState('');
  const [formNama, setFormNama] = useState('');
  const [formWilayah, setFormWilayah] = useState('');
  const [formAlamat, setFormAlamat] = useState('');
  const [formPermodalan, setFormPermodalan] = useState('BOOTSTRAP');
  const [formStatus, setFormStatus] = useState('AKTIF');
  const [errorMsg, setErrorMsg] = useState('');

  // ── Konfirmasi & Toast ──
  const [confirmModal, setConfirmModal] = useState({ open: false, title: '', msg: '', onConfirm: null });
  const [toast, setToast] = useState(null);

  // ── State untuk sub-tab & Jabatan ──
  const [subTab, setSubTab] = useState('deskripsi_outlet');
  const [roles, setRoles] = useState([]);
  const [searchRole, setSearchRole] = useState('');
  const [roleModal, setRoleModal] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState(null);
  const [formRoleDivisi, setFormRoleDivisi] = useState('Leader');
  const [formRoleJabatan, setFormRoleJabatan] = useState('');
  const [roleConfirmModal, setRoleConfirmModal] = useState({ open: false, title: '', msg: '', onConfirm: null });
  const [currentRolePage, setCurrentRolePage] = useState(1);

  // ── State Target Operasional ──
  const [stafTargets, setStafTargets] = useState([]);
  const [omzetTargets, setOmzetTargets] = useState([]);

  // Staf Target Form Modal State
  const [stafModalOpen, setStafModalOpen] = useState(false);
  const [editingStafTarget, setEditingStafTarget] = useState(null);
  const [formStafOutlet, setFormStafOutlet] = useState('');
  const [formStafCount, setFormStafCount] = useState('');
  const [formStafMonth, setFormStafMonth] = useState('Juni');
  const [formStafYear, setFormStafYear] = useState('2026');

  // Omzet Target Form Modal State
  const [omzetModalOpen, setOmzetModalOpen] = useState(false);
  const [editingOmzetTarget, setEditingOmzetTarget] = useState(null);
  const [formOmzetOutlet, setFormOmzetOutlet] = useState('');
  const [formOmzetAmount, setFormOmzetAmount] = useState('');
  const [formOmzetMonth, setFormOmzetMonth] = useState('Juni');
  const [formOmzetYear, setFormOmzetYear] = useState('2026');

  // Target Pagination (10 rows max per page)
  const [stafTargetPage, setStafTargetPage] = useState(1);
  const [omzetTargetPage, setOmzetTargetPage] = useState(1);
  const [isSavingStaf, setIsSavingStaf] = useState(false);
  const [isSavingOmzet, setIsSavingOmzet] = useState(false);

  const BULAN_LIST = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  
  const formatRp = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);

  useEffect(() => {
    setCurrentRolePage(1);
  }, [searchRole]);

  useEffect(() => {
    // Seed and load Staff Targets (Hydration Fix: handles null, empty array, or parsing errors)
    const cachedStaf = localStorage.getItem('target_staf_data');
    let loadedStaf = [];
    try {
      loadedStaf = cachedStaf ? JSON.parse(cachedStaf) : [];
    } catch (e) {
      loadedStaf = [];
    }

    if (!Array.isArray(loadedStaf) || loadedStaf.length === 0) {
      loadedStaf = [
        { id: 'tstaf-1', outlet_name: 'AYAM PECAK 2001 SEAFOOD KISARAN', target_staf: 15, bulan: 'Juni', tahun: '2026' },
        { id: 'tstaf-2', outlet_name: 'AYAM PECAK 2001 SEAFOOD RANTAU PRAPAT', target_staf: 13, bulan: 'Juni', tahun: '2026' },
        { id: 'tstaf-3', outlet_name: 'AYAM PECAK 2001 SEAFOOD TEBING TINGGI', target_staf: 8, bulan: 'Juni', tahun: '2026' },
        { id: 'tstaf-4', outlet_name: 'AYAM BAKAR SURABAYA TEBING TINGGI', target_staf: 5, bulan: 'Juni', tahun: '2026' },
        { id: 'tstaf-5', outlet_name: 'PECEL LELE PAK HAJI KISARAN', target_staf: 8, bulan: 'Juni', tahun: '2026' }
      ];
      localStorage.setItem('target_staf_data', JSON.stringify(loadedStaf));
    }
    setStafTargets(loadedStaf);

    // Seed and load Omzet Targets (Hydration Fix: handles null, empty array, or parsing errors)
    const cachedOmzet = localStorage.getItem('target_omzet_data');
    let loadedOmzet = [];
    try {
      loadedOmzet = cachedOmzet ? JSON.parse(cachedOmzet) : [];
    } catch (e) {
      loadedOmzet = [];
    }

    if (!Array.isArray(loadedOmzet) || loadedOmzet.length === 0) {
      loadedOmzet = [
        { id: 'tomzet-1', outlet_name: 'AYAM PECAK 2001 SEAFOOD TEBING TINGGI', target_omzet: 180000000, bulan: 'Juni', tahun: '2026' },
        { id: 'tomzet-2', outlet_name: 'AYAM BAKAR SURABAYA TEBING TINGGI', target_omzet: 150000000, bulan: 'Juni', tahun: '2026' },
        { id: 'tomzet-3', outlet_name: 'AYAM PECAK 2001 SEAFOOD KISARAN', target_omzet: 320000000, bulan: 'Juni', tahun: '2026' },
        { id: 'tomzet-4', outlet_name: 'PECEL LELE PAK HAJI KISARAN', target_omzet: 180000000, bulan: 'Juni', tahun: '2026' },
        { id: 'tomzet-5', outlet_name: 'AYAM PECAK 2001 SEAFOOD RANTAU PRAPAT', target_omzet: 350000000, bulan: 'Juni', tahun: '2026' }
      ];
      localStorage.setItem('target_omzet_data', JSON.stringify(loadedOmzet));
    }
    setOmzetTargets(loadedOmzet);
  }, []);

  // Save Staff Target
  const handleSaveStaf = () => {
    if (!formStafOutlet || !formStafCount) {
      showToast('error', '⚠️ Silakan lengkapi semua field!');
      return;
    }

    const count = parseInt(formStafCount, 10);
    if (isNaN(count) || count < 0) {
      showToast('error', '⚠️ Target jumlah staf tidak valid!');
      return;
    }

    setIsSavingStaf(true);

    setTimeout(() => {
      const cached = JSON.parse(localStorage.getItem('target_staf_data') || '[]');
      let updated;
      if (editingStafTarget) {
        updated = cached.map(t => t.id === editingStafTarget.id ? {
          ...t,
          outlet_name: formStafOutlet,
          target_staf: count,
          bulan: formStafMonth,
          tahun: formStafYear
        } : t);
        showToast('success', '✅ Target staf berhasil diperbarui!');
      } else {
        const newTarget = {
          id: `tstaf-${Date.now()}`,
          outlet_name: formStafOutlet,
          target_staf: count,
          bulan: formStafMonth,
          tahun: formStafYear
        };
        updated = [...cached, newTarget];
        showToast('success', '✅ Target staf baru berhasil ditambahkan!');
      }
      localStorage.setItem('target_staf_data', JSON.stringify(updated));
      setStafTargets(updated);
      // ⚡ GLOBAL SYNC — Employees card staf ideal langsung berubah
      hrisDispatch('TARGET_CHANGED', { targetStaf: updated });
      setIsSavingStaf(false);
      setStafModalOpen(false);
      setEditingStafTarget(null);
      setFormStafOutlet('');
      setFormStafCount('');
    }, 600);
  };

  // Delete Staff Target
  const handleDeleteStaf = (id) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus target staf ini?')) {
      const cached = JSON.parse(localStorage.getItem('target_staf_data') || '[]');
      const updated = cached.filter(t => t.id !== id);
      localStorage.setItem('target_staf_data', JSON.stringify(updated));
      setStafTargets(updated);
      // ⚡ GLOBAL SYNC
      hrisDispatch('TARGET_CHANGED', { targetStaf: updated });
      showToast('success', '🗑️ Target staf berhasil dihapus.');
      if (stafTargetPage > 1 && updated.slice((stafTargetPage - 1) * 10, stafTargetPage * 10).length === 0) {
        setStafTargetPage(stafTargetPage - 1);
      }
    }
  };

  // Save Omzet Target
  const handleSaveOmzet = () => {
    if (!formOmzetOutlet || !formOmzetAmount) {
      showToast('error', '⚠️ Silakan lengkapi semua field!');
      return;
    }

    const amount = parseFloat(formOmzetAmount);
    if (isNaN(amount) || amount < 0) {
      showToast('error', '⚠️ Target omzet tidak valid!');
      return;
    }

    setIsSavingOmzet(true);

    setTimeout(() => {
      const cached = JSON.parse(localStorage.getItem('target_omzet_data') || '[]');
      let updated;
      if (editingOmzetTarget) {
        updated = cached.map(t => t.id === editingOmzetTarget.id ? {
          ...t,
          outlet_name: formOmzetOutlet,
          target_omzet: amount,
          bulan: formOmzetMonth,
          tahun: formOmzetYear
        } : t);
        showToast('success', '✅ Target omzet berhasil diperbarui!');
      } else {
        const newTarget = {
          id: `tomzet-${Date.now()}`,
          outlet_name: formOmzetOutlet,
          target_omzet: amount,
          bulan: formOmzetMonth,
          tahun: formOmzetYear
        };
        updated = [...cached, newTarget];
        showToast('success', '✅ Target omzet baru berhasil ditambahkan!');
      }
      localStorage.setItem('target_omzet_data', JSON.stringify(updated));
      setOmzetTargets(updated);
      // ⚡ GLOBAL SYNC — Garis merah target di grafik OmzetCabang bergeser
      hrisDispatch('TARGET_CHANGED', { targetOmzet: updated });
      setIsSavingOmzet(false);
      setOmzetModalOpen(false);
      setEditingOmzetTarget(null);
      setFormOmzetOutlet('');
      setFormOmzetAmount('');
    }, 600);
  };

  // Delete Omzet Target
  const handleDeleteOmzet = (id) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus target omzet ini?')) {
      const cached = JSON.parse(localStorage.getItem('target_omzet_data') || '[]');
      const updated = cached.filter(t => t.id !== id);
      localStorage.setItem('target_omzet_data', JSON.stringify(updated));
      setOmzetTargets(updated);
      // ⚡ GLOBAL SYNC
      hrisDispatch('TARGET_CHANGED', { targetOmzet: updated });
      showToast('success', '🗑️ Target omzet berhasil dihapus.');
      if (omzetTargetPage > 1 && updated.slice((omzetTargetPage - 1) * 10, omzetTargetPage * 10).length === 0) {
        setOmzetTargetPage(omzetTargetPage - 1);
      }
    }
  };

  const triggerEditStaf = (t) => {
    setEditingStafTarget(t);
    setFormStafOutlet(t.outlet_name);
    setFormStafCount(t.target_staf);
    setFormStafMonth(t.bulan);
    setFormStafYear(t.tahun);
    setStafModalOpen(true);
  };

  const triggerEditOmzet = (t) => {
    setEditingOmzetTarget(t);
    setFormOmzetOutlet(t.outlet_name);
    setFormOmzetAmount(t.target_omzet);
    setFormOmzetMonth(t.bulan);
    setFormOmzetYear(t.tahun);
    setOmzetModalOpen(true);
  };

  const showToast = useCallback((type, text) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const showError = (msg) => {
    setErrorMsg(msg);
    showToast('error', msg);
  };

  // ── RBAC: deteksi role untuk tombol Hapus ──
  // Hapus disabled jika role adalah 'leader' atau 'admin'
  const currentRole = (user?.role || user?.position || '').toLowerCase();
  const canDelete = !['leader', 'admin'].includes(currentRole);

  const loadRoles = useCallback(() => {
    try {
      const raw = localStorage.getItem('organizational_roles');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}

    const seed = [
      { id: 'role-1', divisi: 'Leader', jabatan: 'Kepala Cabang' },
      { id: 'role-2', divisi: 'Leader', jabatan: 'Supervisor' },
      { id: 'role-3', divisi: 'Produksi', jabatan: 'Kepala Produksi' },
      { id: 'role-4', divisi: 'Produksi', jabatan: 'Koki' },
      { id: 'role-5', divisi: 'Produksi', jabatan: 'Helper' },
      { id: 'role-6', divisi: 'Pelayanan', jabatan: 'Kepala Pelayanan' },
      { id: 'role-7', divisi: 'Pelayanan', jabatan: 'Kasir' },
      { id: 'role-8', divisi: 'Pelayanan', jabatan: 'Waiters' },
      { id: 'role-9', divisi: 'Admin', jabatan: 'Admin' }
    ];
    localStorage.setItem('organizational_roles', JSON.stringify(seed));
    return seed;
  }, []);

  const persistRoles = (data) => {
    localStorage.setItem('organizational_roles', JSON.stringify(data));
  };

  // ── Muat data dari localStorage (sumber utama), fallback ke API ──
  const loadData = useCallback(async () => {
    setLoading(true);

    // 0. Seed data awal Barokah Grup (hanya jika localStorage masih kosong)
    seedInitialOutlets();

    // 1. Baca dari localStorage
    const localData = loadOutlets();
    const localRoles = loadRoles();
    setRoles(localRoles);

    if (localData.length > 0) {
      setOutlets(localData);
      setLoading(false);
    } else if (token && API_URL) {
      // 2. Fallback: tarik dari API dan simpan ke localStorage
      try {
        const res = await fetch(`${API_URL}/outlets`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.status === 'success' && Array.isArray(data.data)) {
          // Normalisasi data API ke format lokal
          const normalized = data.data.map(o => ({
            id: o.id || `api-${Date.now()}-${Math.random()}`,
            nama: (o.nama || '').toUpperCase(),
            wilayah: (o.wilayah || '').toUpperCase(),
            alamat: (o.alamat || '').toUpperCase(),
            permodalan: (o.permodalan || 'BOOTSTRAP').toUpperCase(),
            status: o.status === 'active' || o.status === 'AKTIF' ? 'AKTIF' : 'TIDAK AKTIF',
            nama_tablet: getNamaTablet({ nama: o.nama, wilayah: o.wilayah }),
            created_at: o.created_at || new Date().toISOString(),
          }));
          persistOutlets(normalized);
          setOutlets(normalized);
        }
      } catch (err) {
        console.error('Gagal memuat outlet dari API:', err);
      }
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, [token, API_URL]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Reset form ──
  const resetForm = () => {
    setEditingId(null);
    setFormId('');
    setFormNama('');
    setFormWilayah('');
    setFormAlamat('');
    setFormPermodalan('BOOTSTRAP');
    setFormStatus('AKTIF');
    setErrorMsg('');
  };

  // ── CRUD Jabatan ──
  const resetRoleForm = () => {
    setEditingRoleId(null);
    setFormRoleDivisi('Leader');
    setFormRoleJabatan('');
    setErrorMsg('');
  };

  const openAddRoleModal = () => {
    resetRoleForm();
    setRoleModal(true);
  };

  const openEditRoleModal = (role) => {
    setEditingRoleId(role.id);
    setFormRoleDivisi(role.divisi);
    setFormRoleJabatan(role.jabatan);
    setErrorMsg('');
    setRoleModal(true);
  };

  const handleSaveRole = () => {
    if (!formRoleJabatan.trim()) {
      showError('Nama jabatan wajib diisi.');
      return;
    }

    const id = editingRoleId || `role-${Date.now()}`;
    const newRole = {
      id,
      divisi: formRoleDivisi,
      jabatan: formRoleJabatan.trim()
    };

    let updated;
    if (editingRoleId) {
      updated = roles.map(r => r.id === editingRoleId ? newRole : r);
    } else {
      if (roles.some(r => r.jabatan.toLowerCase() === formRoleJabatan.trim().toLowerCase())) {
        showError('Jabatan tersebut sudah terdaftar.');
        return;
      }
      updated = [...roles, newRole];
    }

    persistRoles(updated);
    setRoles(updated);
    setRoleModal(false);
    showToast('success', `✅ Jabatan "${newRole.jabatan}" berhasil ${editingRoleId ? 'diperbarui' : 'ditambahkan'}!`);
  };

  const triggerDeleteRole = (role) => {
    setRoleConfirmModal({
      open: true,
      title: 'Konfirmasi Hapus Jabatan',
      msg: `Yakin ingin menghapus jabatan "${role.jabatan}" secara permanen?`,
      onConfirm: () => {
        const updated = roles.filter(r => r.id !== role.id);
        persistRoles(updated);
        setRoles(updated);
        showToast('success', `🗑️ Jabatan "${role.jabatan}" berhasil dihapus.`);
      }
    });
  };

  // ── Buka modal tambah ──
  const openAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  // ── Buka modal edit ──
  const openEditModal = (outlet) => {
    setEditingId(outlet.id);
    setFormId(outlet.id);
    setFormNama(outlet.nama || '');
    setFormWilayah(outlet.wilayah || '');
    setFormAlamat(outlet.alamat || '');
    setFormPermodalan(outlet.permodalan || 'BOOTSTRAP');
    setFormStatus(outlet.status || 'AKTIF');
    setErrorMsg('');
    setShowModal(true);
  };

  // ── Simpan data (create / edit) ──
  const handleSave = () => {
    // Validasi global
    if (!formId.trim() || !formNama.trim() || !formWilayah.trim() || !formAlamat.trim() || !formPermodalan.trim() || !formStatus.trim()) {
      showError('Gagal menyimpan! Semua field deskripsi outlet wajib diisi.');
      return;
    }

    const existing = loadOutlets();
    const id = formId.trim().toUpperCase();
    const nama = formNama.trim().toUpperCase();
    const wilayah = formWilayah.trim().toUpperCase();
    const alamat = formAlamat.trim().toUpperCase();

    // Validasi duplikasi ID Outlet (hanya jika mode tambah)
    if (!editingId && existing.some(o => o.id.trim().toUpperCase() === id)) {
      showError('Gagal menyimpan! ID Outlet sudah digunakan oleh cabang lain.');
      return;
    }

    const outletObj = {
      id: editingId || id,
      nama,
      wilayah,
      alamat,
      permodalan: formPermodalan.toUpperCase(),
      status: formStatus.toUpperCase(),
      nama_tablet: getNamaTablet({ nama, wilayah }), // ← "Kolom Nama Tablet" untuk sinkronisasi
      created_at: new Date().toISOString(),
    };

    let updated;
    if (editingId) {
      updated = existing.map(o => o.id === editingId ? { ...o, ...outletObj } : o);
    } else {
      updated = [...existing, outletObj];
    }

    // Simpan ke localStorage (sumber utama semua halaman)
    persistOutlets(updated);
    setOutlets(updated);
    setShowModal(false);
    showToast('success', `✅ Outlet "${outletObj.nama_tablet}" berhasil ${editingId ? 'diperbarui' : 'ditambahkan'}!`);

    // Sync juga ke API (fire-and-forget, tidak blocking UI)
    if (token && API_URL) {
      const apiPayload = {
        nama: outletObj.nama,
        wilayah: outletObj.wilayah,
        alamat: outletObj.alamat,
        permodalan: outletObj.permodalan.toLowerCase(),
        status: outletObj.status === 'AKTIF' ? 'active' : 'inactive',
      };
      const url = editingId && !String(editingId).startsWith('local-')
        ? `${API_URL}/outlets/${editingId}`
        : `${API_URL}/outlets`;
      const method = editingId && !String(editingId).startsWith('local-') ? 'PUT' : 'POST';
      fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(apiPayload),
      }).catch(() => {}); // silent fail
    }
  };

  // ── Hapus data ──
  const triggerDelete = (id, nama_tablet) => {
    setConfirmModal({
      open: true,
      title: 'Konfirmasi Hapus Outlet',
      msg: `Yakin ingin menghapus outlet "${nama_tablet}" secara permanen dari sistem?`,
      onConfirm: () => {
        const existing = loadOutlets();
        const updated = existing.filter(o => o.id !== id);
        persistOutlets(updated);
        setOutlets(updated);
        showToast('success', `🗑️ Outlet "${nama_tablet}" berhasil dihapus.`);

        // Sync delete ke API
        if (token && API_URL && !String(id).startsWith('local-')) {
          fetch(`${API_URL}/outlets/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` },
          }).catch(() => {});
        }
      },
    });
  };

  // ── Filter data ──
  const filtered = outlets.filter(o => {
    const q = searchOutlet.toLowerCase();
    return (
      (o.nama || '').toLowerCase().includes(q) ||
      (o.wilayah || '').toLowerCase().includes(q) ||
      (o.alamat || '').toLowerCase().includes(q) ||
      (o.nama_tablet || '').toLowerCase().includes(q)
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
  const totalOutlets = outlets.length;
  const aktifCount = outlets.filter(o => o.status === 'AKTIF').length;
  const tidakAktifCount = outlets.filter(o => o.status === 'TIDAK AKTIF').length;
  const bootstrapCount = outlets.filter(o => (o.permodalan || '').toUpperCase() === 'BOOTSTRAP').length;

  // ── Filter data Jabatan ──
  const filteredRoles = roles.filter(r => {
    const q = searchRole.toLowerCase();
    return (
      (r.divisi || '').toLowerCase().includes(q) ||
      (r.jabatan || '').toLowerCase().includes(q)
    );
  });
  // ── Pagination Jabatan ──
  const indexOfLastRoleRow = currentRolePage * 10;
  const indexOfFirstRoleRow = indexOfLastRoleRow - 10;
  const currentRoleRows = filteredRoles.slice(indexOfFirstRoleRow, indexOfLastRoleRow);
  const totalRolePages = Math.ceil(filteredRoles.length / 10);

  // ── Pagination Target Staf ──
  const indexOfLastStafRow = stafTargetPage * 10;
  const indexOfFirstStafRow = indexOfLastStafRow - 10;
  const paginatedStaf = stafTargets.slice(indexOfFirstStafRow, indexOfLastStafRow);
  const totalStafPages = Math.ceil(stafTargets.length / 10);

  // ── Pagination Target Omzet ──
  const indexOfLastOmzetRow = omzetTargetPage * 10;
  const indexOfFirstOmzetRow = indexOfLastOmzetRow - 10;
  const paginatedOmzet = omzetTargets.slice(indexOfFirstOmzetRow, indexOfLastOmzetRow);
  const totalOmzetPages = Math.ceil(omzetTargets.length / 10);

  const handleRolePageChange = (pageNumber) => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentRolePage(pageNumber);
      setIsTransitioning(false);
    }, 200);
  };

  // ── Reusable style ──
  const S = {
    card: {
      background: P.bgSurface,
      border: `1px solid ${P.accent}`,
      borderRadius: '14px',
      padding: '18px 22px',
    },
    th: {
      padding: '13px 16px',
      fontSize: '0.72rem',
      fontWeight: 800,
      color: P.creamMuted,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      background: P.bgSurface,
      whiteSpace: 'nowrap',
      borderBottom: `2px solid ${P.accent}`,
    },
    td: {
      padding: '12px 16px',
      fontSize: '0.85rem',
      color: P.cream,
      whiteSpace: 'nowrap',
      borderBottom: `1px solid rgba(65,45,21,0.35)`,
      verticalAlign: 'middle',
    },
    inputLabel: {
      fontSize: '0.72rem',
      fontWeight: 700,
      color: P.creamMuted,
      textTransform: 'uppercase',
      letterSpacing: '0.4px',
      display: 'block',
      marginBottom: '6px',
    },
    input: {
      width: '100%',
      background: P.bgMain,
      border: `1px solid ${P.accent}`,
      borderRadius: '8px',
      padding: '10px 14px',
      color: P.cream,
      fontSize: '0.88rem',
      outline: 'none',
      transition: 'border-color 0.2s',
      fontFamily: 'inherit',
    },
  };

  const inputFocus = (e) => (e.target.style.borderColor = P.cream);
  const inputBlur  = (e) => (e.target.style.borderColor = P.accent);

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
        }}>
          {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          {toast.text}
        </div>
      )}

      {/* ── Sub Tabs Switcher ── */}
      <div style={{ display: 'flex', gap: '12px', borderBottom: `1px solid ${P.accent}`, paddingBottom: '10px' }}>
        <button
          type="button"
          onClick={() => { setSubTab('deskripsi_outlet'); setCurrentPage(1); }}
          style={{
            background: subTab === 'deskripsi_outlet' ? P.cream : 'transparent',
            border: `1px solid ${P.accent}`,
            color: subTab === 'deskripsi_outlet' ? P.bgMain : P.cream,
            padding: '10px 18px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '0.88rem',
            transition: 'all 0.2s'
          }}
        >
          🏪 Deskripsi Outlet
        </button>
        <button
          type="button"
          onClick={() => { setSubTab('struktur_jabatan'); setCurrentRolePage(1); }}
          style={{
            background: subTab === 'struktur_jabatan' ? P.cream : 'transparent',
            border: `1px solid ${P.accent}`,
            color: subTab === 'struktur_jabatan' ? P.bgMain : P.cream,
            padding: '10px 18px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '0.88rem',
            transition: 'all 0.2s'
          }}
        >
          🗺️ Struktur Jabatan
        </button>
        <button
          type="button"
          onClick={() => { setSubTab('target_operasional'); setStafTargetPage(1); setOmzetTargetPage(1); }}
          style={{
            background: subTab === 'target_operasional' ? P.cream : 'transparent',
            border: `1px solid ${P.accent}`,
            color: subTab === 'target_operasional' ? P.bgMain : P.cream,
            padding: '10px 18px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '0.88rem',
            transition: 'all 0.2s'
          }}
        >
          🎯 Target Operasional
        </button>
      </div>

      {subTab === 'deskripsi_outlet' ? (
        <>
          {/* ── 2. KPI Summary Cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: '16px' }}>
            {[
              { label: 'Total Outlet', val: `${totalOutlets} Cabang`, color: P.cream, icon: <Store size={18}/>, bg: P.creamGlow },
              { label: 'Status AKTIF', val: `${aktifCount} Outlet`, color: P.success, icon: <CheckCircle size={18}/>, bg: P.successGlow },
              { label: 'Tidak Aktif', val: `${tidakAktifCount} Outlet`, color: P.danger, icon: <AlertCircle size={18}/>, bg: P.dangerGlow },
              { label: 'Permodalan Bootstrap', val: `${bootstrapCount} Cabang`, color: P.warning, icon: <Users size={18}/>, bg: P.warningGlow },
            ].map((c, i) => (
              <div key={i} style={{ ...S.card, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: P.creamMuted, fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>{c.label}</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: c.color }}>{c.val}</div>
                </div>
                <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.color }}>
                  {c.icon}
                </div>
              </div>
            ))}
          </div>

          {/* ── 3. Panel Tabel ── */}
          <div style={{ ...S.card }}>

            {/* ── Header Tabel ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: P.creamGlow, display: 'flex', alignItems: 'center', justifyContent: 'center', color: P.cream }}>
                  <Store size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: P.cream, margin: 0 }}>DESKRIPSI OUTLET CABANG</h3>
                  <p style={{ fontSize: '0.78rem', color: P.creamMuted, margin: 0 }}>
                    Data outlet tersimpan lokal &amp; tersinkronisasi ke halaman Karyawan, Absensi, dan Payroll
                  </p>
                </div>
              </div>

              <button
                onClick={openAddModal}
                style={{
                  padding: '10px 18px', background: P.cream, color: P.bgMain,
                  border: 'none', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 800,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                  boxShadow: '0 4px 12px rgba(165, 182, 141, 0.2)',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f0ebe0'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = P.cream; e.currentTarget.style.transform = 'none'; }}
              >
                <Plus size={16} /> TAMBAH OUTLET
              </button>
            </div>

            {/* ── Search + Filter Kolom ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', width: '280px' }}>
                <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: P.creamMuted }} />
                <input
                  type="text"
                  placeholder="Cari nama, wilayah, alamat..."
                  value={searchOutlet}
                  onChange={e => setSearchOutlet(e.target.value)}
                  style={{ ...S.input, paddingLeft: '34px', height: '40px' }}
                  onFocus={inputFocus} onBlur={inputBlur}
                />
              </div>

              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowColFilter(!showColFilter)}
                  style={{
                    padding: '0 14px', height: '40px', background: P.accent,
                    border: `1px solid ${P.accent}`, borderRadius: '8px',
                    color: P.cream, fontSize: '0.82rem', fontWeight: 700,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                  }}
                >
                  <Filter size={14} /> KOLOM
                </button>
                {showColFilter && (
                  <div style={{
                    position: 'absolute', top: '46px', right: 0, zIndex: 50,
                    background: P.bgSurface, border: `1px solid ${P.accent}`,
                    borderRadius: '12px', padding: '14px', minWidth: '180px',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
                    display: 'flex', flexDirection: 'column', gap: '8px',
                  }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 800, color: P.cream, textTransform: 'uppercase', marginBottom: '4px' }}>Tampilkan Kolom</div>
                    {Object.entries(colLabels).map(([k, v]) => (
                      <label key={k} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: P.cream, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={visibleCols[k]}
                          onChange={() => setVisibleCols(p => ({ ...p, [k]: !p[k] }))}
                          style={{ accentColor: P.cream }}
                        />
                        {v}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Tabel Responsif ── */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: P.creamMuted }}>
                <div className="loading-spinner" style={{ margin: '0 auto 12px' }}></div>
                <p>Memuat data outlet...</p>
              </div>
            ) : (
              <>
                <div style={{ width: '100%', overflowX: 'auto', borderRadius: '10px', border: `1px solid ${P.accent}` }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', whiteSpace: 'nowrap', minWidth: '750px' }}>
                  <thead>
                    <tr>
                      {visibleCols.id       && <th style={{ ...S.th, minWidth: '100px' }}>ID OUTLET</th>}
                      {visibleCols.no       && <th style={{ ...S.th, width: '50px', textAlign: 'center' }}>No</th>}
                      {visibleCols.nama     && <th style={{ ...S.th, minWidth: '200px' }}>NAMA OUTLET</th>}
                      {visibleCols.wilayah  && <th style={{ ...S.th, minWidth: '130px' }}>WILAYAH</th>}
                      {visibleCols.alamat   && <th style={{ ...S.th, minWidth: '180px', whiteSpace: 'normal' }}>ALAMAT</th>}
                      {visibleCols.permodalan && <th style={{ ...S.th, minWidth: '130px' }}>PERMODALAN</th>}
                      {visibleCols.status   && <th style={{ ...S.th, minWidth: '110px' }}>STATUS</th>}
                      {visibleCols.aksi     && <th style={{ ...S.th, textAlign: 'center', minWidth: '140px' }}>AKSI</th>}
                    </tr>
                  </thead>
                  <tbody style={{
                    opacity: isTransitioning ? 0 : 1,
                    transform: isTransitioning ? 'scale(0.99)' : 'scale(1)',
                    transition: 'opacity 0.4s ease-in-out, transform 0.3s ease'
                  }}>
                    {currentRows.length === 0 ? (
                      <tr>
                        <td colSpan={Object.values(visibleCols).filter(Boolean).length}
                          style={{ ...S.td, textAlign: 'center', padding: '40px', color: P.creamMuted }}>
                          🏪 Belum ada outlet yang terdaftar. Klik <strong style={{ color: P.cream }}>TAMBAH OUTLET</strong> untuk menambahkan.
                        </td>
                      </tr>
                    ) : (
                      currentRows.map((o, idx) => (
                        <tr
                          key={o.id}
                          style={{ background: idx % 2 === 0 ? P.bgMain : P.bgSurface, transition: 'background 0.2s' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(65,45,21,0.55)'}
                          onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? P.bgMain : P.bgSurface}
                        >
                          {visibleCols.id && (
                            <td style={{ ...S.td, color: 'var(--text-main)', fontWeight: 'bold' }}>
                              {isLockedOutlet(o.id) ? '🔒 ' : ''}{o.id}
                            </td>
                          )}
                          {visibleCols.no && (
                            <td style={{ ...S.td, textAlign: 'center', fontWeight: 700, color: P.creamMuted }}>{indexOfFirstRow + idx + 1}</td>
                          )}
                          {visibleCols.nama && (
                            <td style={{ ...S.td }}>
                              <div style={{ fontWeight: 700, color: P.cream }}>{o.nama}</div>
                              <div style={{ fontSize: '0.72rem', color: P.creamMuted, marginTop: '2px' }}>
                                🔗 {o.nama_tablet}
                              </div>
                            </td>
                          )}
                          {visibleCols.wilayah && (
                            <td style={{ ...S.td }}>
                              <span style={{
                                background: 'rgba(65,45,21,0.4)', color: P.cream,
                                padding: '3px 10px', borderRadius: '5px', fontSize: '0.78rem', fontWeight: 600,
                              }}>
                                {o.wilayah || '-'}
                              </span>
                            </td>
                          )}
                          {visibleCols.alamat && (
                            <td style={{ ...S.td, whiteSpace: 'normal', minWidth: '180px', color: P.creamMuted }}>
                              {o.alamat || '-'}
                            </td>
                          )}
                          {visibleCols.permodalan && (
                            <td style={S.td}>
                              <span style={{
                                padding: '3px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700,
                                background: (o.permodalan || '').toUpperCase() === 'BOOTSTRAP'
                                  ? P.warningGlow : P.creamGlow,
                                color: (o.permodalan || '').toUpperCase() === 'BOOTSTRAP'
                                  ? P.warning : P.cream,
                              }}>
                                {o.permodalan || 'BOOTSTRAP'}
                              </span>
                            </td>
                          )}
                          {visibleCols.status && (
                            <td style={S.td}>
                              <span style={{
                                padding: '3px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700,
                                background: o.status === 'AKTIF' ? P.successGlow : P.dangerGlow,
                                color: o.status === 'AKTIF' ? P.success : P.danger,
                              }}>
                                {o.status || 'AKTIF'}
                              </span>
                            </td>
                          )}
                          {visibleCols.aksi && (
                            <td style={{ ...S.td, textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                <button
                                  onClick={() => openEditModal(o)}
                                  title="Edit Outlet"
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

                                {canDelete && !isLockedOutlet(o.id) ? (
                                  <button
                                    onClick={() => triggerDelete(o.id, o.nama_tablet)}
                                    title="Hapus Outlet"
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
                                    title={isLockedOutlet(o.id) ? "Cabang Resmi Utama Barokah Grup terkunci dan tidak dapat dihapus" : "Hanya Master/Owner yang dapat menghapus outlet"}
                                    style={{
                                      padding: '5px 11px',
                                      background: 'rgba(65,45,21,0.2)',
                                      border: `1px solid rgba(65,45,21,0.3)`,
                                      borderRadius: '6px',
                                      color: 'rgba(165, 182, 141, 0.25)',
                                      fontSize: '0.75rem', fontWeight: 700,
                                      cursor: 'not-allowed',
                                      display: 'flex', alignItems: 'center', gap: '4px',
                                    }}
                                  >
                                    <Trash2 size={12} /> HAPUS
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>

                  {/* ── Footer: Baris Total ── */}
                  {filtered.length > 0 && (
                    <tfoot>
                      <tr style={{ background: P.accent }}>
                        {visibleCols.no && <td style={{ ...S.td }}></td>}
                        {visibleCols.nama && (
                          <td style={{ ...S.td, fontWeight: 800, color: P.cream }}>
                            TOTAL: {filtered.length} OUTLET
                          </td>
                        )}
                        {visibleCols.wilayah && <td style={S.td}></td>}
                        {visibleCols.alamat && <td style={S.td}></td>}
                        {visibleCols.permodalan && <td style={S.td}></td>}
                        {visibleCols.status && (
                          <td style={S.td}>
                            <span style={{ color: P.success, fontWeight: 700 }}>{aktifCount} AKTIF</span>
                            {' / '}
                            <span style={{ color: P.danger, fontWeight: 700 }}>{tidakAktifCount} TIDAK AKTIF</span>
                          </td>
                        )}
                        {visibleCols.aksi && <td style={S.td}></td>}
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
                    Menampilkan {indexOfFirstRow + 1}-{Math.min(indexOfLastRow, filtered.length)} dari {filtered.length} outlet
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
        </>
      ) : subTab === 'struktur_jabatan' ? (
        <>
          {/* ── Job Stats Cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: '16px' }}>
            {[
              { label: 'Total Jabatan', val: `${roles.length} Posisi`, color: P.cream, icon: <Users size={18}/>, bg: P.creamGlow },
              { label: 'Total Divisi', val: `${new Set(roles.map(r => r.divisi)).size} Divisi`, color: P.warning, icon: <Store size={18}/>, bg: P.warningGlow },
            ].map((c, i) => (
              <div key={i} style={{ ...S.card, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: P.creamMuted, fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>{c.label}</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: c.color }}>{c.val}</div>
                </div>
                <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.color }}>
                  {c.icon}
                </div>
              </div>
            ))}
          </div>

          {/* ── 3. Panel Tabel Jabatan ── */}
          <div style={{ ...S.card }}>

            {/* ── Header Tabel ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: P.creamGlow, display: 'flex', alignItems: 'center', justifyContent: 'center', color: P.cream }}>
                  <Users size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: P.cream, margin: 0 }}>TABEL STRUKTUR JABATAN</h3>
                  <p style={{ fontSize: '0.78rem', color: P.creamMuted, margin: 0 }}>
                    Data struktur divisi &amp; jabatan resmi di Barokah Grup
                  </p>
                </div>
              </div>

              <button
                onClick={openAddRoleModal}
                style={{
                  padding: '10px 18px', background: P.cream, color: P.bgMain,
                  border: 'none', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 800,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                  boxShadow: '0 4px 12px rgba(165, 182, 141, 0.2)',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f0ebe0'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = P.cream; e.currentTarget.style.transform = 'none'; }}
              >
                <Plus size={16} /> TAMBAH JABATAN
              </button>
            </div>

            {/* ── Search Bar ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', width: '280px' }}>
                <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: P.creamMuted }} />
                <input
                  type="text"
                  placeholder="Cari divisi atau jabatan..."
                  value={searchRole}
                  onChange={e => setSearchRole(e.target.value)}
                  style={{ ...S.input, paddingLeft: '34px', height: '40px' }}
                  onFocus={inputFocus} onBlur={inputBlur}
                />
              </div>
            </div>

            {/* ── Tabel ── */}
            <div style={{ width: '100%', overflowX: 'auto', borderRadius: '10px', border: `1px solid ${P.accent}` }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', whiteSpace: 'nowrap', minWidth: '600px' }}>
                <thead>
                  <tr>
                    <th style={{ ...S.th, width: '60px', textAlign: 'center' }}>NO</th>
                    <th style={{ ...S.th, minWidth: '200px' }}>NAMA JABATAN</th>
                    <th style={{ ...S.th, minWidth: '200px' }}>DIVISI UTAMA</th>
                    <th style={{ ...S.th, textAlign: 'center', minWidth: '150px' }}>AKSI</th>
                  </tr>
                </thead>
                <tbody style={{
                  opacity: isTransitioning ? 0 : 1,
                  transform: isTransitioning ? 'scale(0.99)' : 'scale(1)',
                  transition: 'opacity 0.4s ease-in-out, transform 0.3s ease',
                }}>
                  {currentRoleRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ ...S.td, textAlign: 'center', padding: '40px', color: P.creamMuted }}>
                        📭 Belum ada data jabatan.
                      </td>
                    </tr>
                  ) : (
                    currentRoleRows.map((r, idx) => (
                      <tr
                        key={r.id}
                        style={{ background: idx % 2 === 0 ? P.bgMain : P.bgSurface, transition: 'background 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(65,45,21,0.55)'}
                        onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? P.bgMain : P.bgSurface}
                      >
                        <td style={{ ...S.td, textAlign: 'center', fontWeight: 700, color: P.creamMuted }}>{indexOfFirstRoleRow + idx + 1}</td>
                        <td style={{ ...S.td, color: 'var(--text-main)', fontWeight: 700 }}>{r.jabatan}</td>
                        <td style={{ ...S.td }}>
                          <span style={{
                            background: 'rgba(65,45,21,0.4)', color: P.cream,
                            padding: '4px 12px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700,
                            border: `1px solid ${P.accent}`
                          }}>
                            {r.divisi}
                          </span>
                        </td>
                        <td style={{ ...S.td, textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                            <button
                              onClick={() => openEditRoleModal(r)}
                              style={{
                                padding: '5px 11px', background: P.creamGlow,
                                border: `1px solid ${P.cream}`, borderRadius: '6px',
                                color: P.cream, fontSize: '0.75rem', fontWeight: 700,
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                              }}
                            >
                              <Edit size={12} /> UBAH
                            </button>
                            <button
                              onClick={() => triggerDeleteRole(r)}
                              style={{
                                padding: '5px 11px', background: P.dangerGlow,
                                border: `1px solid ${P.danger}`, borderRadius: '6px',
                                color: P.danger, fontSize: '0.75rem', fontWeight: 700,
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                              }}
                            >
                              <Trash2 size={12} /> HAPUS
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalRolePages > 1 && (
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
                  Menampilkan {indexOfFirstRoleRow + 1}-{Math.min(indexOfLastRoleRow, filteredRoles.length)} dari {filteredRoles.length} jabatan
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => handleRolePageChange(currentRolePage - 1)}
                    disabled={currentRolePage === 1}
                    style={{
                      background: 'transparent',
                      color: 'var(--text-main)',
                      border: '1px solid var(--border-color)',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      cursor: currentRolePage === 1 ? 'not-allowed' : 'pointer',
                      opacity: currentRolePage === 1 ? 0.4 : 1,
                      fontSize: '0.85rem',
                      transition: 'all 0.2s'
                    }}
                  >
                    Sebelumnya
                  </button>
                  {Array.from({ length: totalRolePages }, (_, i) => i + 1).map(p => {
                    const isActive = p === currentRolePage;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => handleRolePageChange(p)}
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
                    onClick={() => handleRolePageChange(currentRolePage + 1)}
                    disabled={currentRolePage === totalRolePages}
                    style={{
                      background: 'transparent',
                      color: 'var(--text-main)',
                      border: '1px solid var(--border-color)',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      cursor: currentRolePage === totalRolePages ? 'not-allowed' : 'pointer',
                      opacity: currentRolePage === totalRolePages ? 0.4 : 1,
                      fontSize: '0.85rem',
                      transition: 'all 0.2s'
                    }}
                  >
                    Berikutnya
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', animation: 'fadeIn 0.4s ease' }}>
          {/* ── SECTION 1: TARGET STAF ── */}
          <div style={{ ...S.card }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: P.creamGlow, display: 'flex', alignItems: 'center', justifyContent: 'center', color: P.cream }}>
                  <Users size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: P.cream, margin: 0 }}>TARGET STAF BULANAN</h3>
                  <p style={{ fontSize: '0.78rem', color: P.creamMuted, margin: 0 }}>Kelola target kuota jumlah karyawan per cabang</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingStafTarget(null);
                  setFormStafOutlet(outlets[0]?.nama_tablet || 'AYAM PECAK 2001 SEAFOOD KISARAN');
                  setFormStafCount('');
                  setFormStafMonth('Juni');
                  setFormStafYear('2026');
                  setStafModalOpen(true);
                }}
                style={{
                  padding: '10px 18px', background: P.cream, color: P.bgMain,
                  border: 'none', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 800,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                  boxShadow: '0 4px 12px rgba(165, 182, 141, 0.25)', transition: 'all 0.2s'
                }}
              >
                <Plus size={16} /> Atur Target Staf
              </button>
            </div>

            <div style={{ overflowX: 'auto', borderRadius: '12px', border: `1px solid ${P.accent}` }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', whiteSpace: 'nowrap', minWidth: '600px' }}>
                <thead>
                  <tr style={{ background: P.bgSurface, borderBottom: `1px solid ${P.accent}` }}>
                    <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '0.78rem', fontWeight: 800, color: P.creamMuted, textTransform: 'uppercase' }}>No</th>
                    <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '0.78rem', fontWeight: 800, color: P.creamMuted, textTransform: 'uppercase' }}>Nama Outlet</th>
                    <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '0.78rem', fontWeight: 800, color: P.creamMuted, textTransform: 'uppercase' }}>Target Staf</th>
                    <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '0.78rem', fontWeight: 800, color: P.creamMuted, textTransform: 'uppercase' }}>Bulan</th>
                    <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '0.78rem', fontWeight: 800, color: P.creamMuted, textTransform: 'uppercase' }}>Tahun</th>
                    <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: '0.78rem', fontWeight: 800, color: P.creamMuted, textTransform: 'uppercase', width: '120px' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedStaf.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ padding: '24px', textAlign: 'center', color: P.creamMuted, fontSize: '0.85rem' }}>Belum ada target staf yang diatur.</td>
                    </tr>
                  ) : (
                    paginatedStaf.map((t, idx) => (
                      <tr key={t.id} style={{ borderBottom: `1px solid ${P.accent}`, background: idx % 2 === 0 ? P.bgMain : P.bgSurface, transition: 'background 0.2s' }}>
                        <td style={{ padding: '14px 16px', fontSize: '0.85rem', color: P.cream, fontWeight: 700 }}>{(stafTargetPage - 1) * 10 + idx + 1}</td>
                        <td style={{ padding: '14px 16px', fontSize: '0.85rem', color: P.cream, fontWeight: 700 }}>{t.outlet_name}</td>
                        <td style={{ padding: '14px 16px', fontSize: '0.85rem', color: P.warning, fontWeight: 800 }}>{t.target_staf} Orang</td>
                        <td style={{ padding: '14px 16px', fontSize: '0.85rem', color: P.cream }}>{t.bulan}</td>
                        <td style={{ padding: '14px 16px', fontSize: '0.85rem', color: P.cream }}>{t.tahun}</td>
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                            <button
                              type="button"
                              onClick={() => triggerEditStaf(t)}
                              style={{ background: P.creamGlow, border: 'none', color: P.cream, padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 700 }}
                            >
                              <Edit size={12} /> EDIT
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteStaf(t.id)}
                              style={{ background: P.dangerGlow, border: 'none', color: P.danger, padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 700 }}
                            >
                              <Trash2 size={12} /> HAPUS
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Staf */}
            {totalStafPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', padding: '12px 20px', background: P.bgSurface, border: `1px solid ${P.accent}`, borderRadius: '8px', gap: '16px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.85rem', color: P.creamMuted }}>Menampilkan {(stafTargetPage - 1) * 10 + 1}-{Math.min(stafTargetPage * 10, stafTargets.length)} dari {stafTargets.length} data</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button type="button" onClick={() => setStafTargetPage(p => Math.max(1, p - 1))} disabled={stafTargetPage === 1} style={{ background: 'transparent', color: P.cream, border: `1px solid ${P.accent}`, padding: '6px 12px', borderRadius: '6px', cursor: stafTargetPage === 1 ? 'not-allowed' : 'pointer', opacity: stafTargetPage === 1 ? 0.4 : 1, fontSize: '0.85rem' }}>Sebelumnya</button>
                  {Array.from({ length: totalStafPages }, (_, i) => i + 1).map(p => {
                    const isActive = p === stafTargetPage;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setStafTargetPage(p)}
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
                          transition: 'all 0.2s',
                          marginLeft: '4px',
                          marginRight: '4px'
                        }}
                      >
                        {p}
                      </button>
                    );
                  })}
                  <button type="button" onClick={() => setStafTargetPage(p => Math.min(totalStafPages, p + 1))} disabled={stafTargetPage === totalStafPages} style={{ background: 'transparent', color: P.cream, border: `1px solid ${P.accent}`, padding: '6px 12px', borderRadius: '6px', cursor: stafTargetPage === totalStafPages ? 'not-allowed' : 'pointer', opacity: stafTargetPage === totalStafPages ? 0.4 : 1, fontSize: '0.85rem' }}>Berikutnya</button>
                </div>
              </div>
            )}
          </div>

          {/* ── SECTION 2: TARGET OMZET ── */}
          <div style={{ ...S.card }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: P.creamGlow, display: 'flex', alignItems: 'center', justifyContent: 'center', color: P.cream }}>
                  <Store size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: P.cream, margin: 0 }}>TARGET OMZET BULANAN</h3>
                  <p style={{ fontSize: '0.78rem', color: P.creamMuted, margin: 0 }}>Kelola target pendapatan nominal omzet per cabang</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingOmzetTarget(null);
                  setFormOmzetOutlet(outlets[0]?.nama_tablet || 'AYAM PECAK 2001 SEAFOOD KISARAN');
                  setFormOmzetAmount('');
                  setFormOmzetMonth('Juni');
                  setFormOmzetYear('2026');
                  setOmzetModalOpen(true);
                }}
                style={{
                  padding: '10px 18px', background: P.cream, color: P.bgMain,
                  border: 'none', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 800,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                  boxShadow: '0 4px 12px rgba(165, 182, 141, 0.25)', transition: 'all 0.2s'
                }}
              >
                <Plus size={16} /> Atur Target Omzet
              </button>
            </div>

            <div style={{ overflowX: 'auto', borderRadius: '12px', border: `1px solid ${P.accent}` }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', whiteSpace: 'nowrap', minWidth: '600px' }}>
                <thead>
                  <tr style={{ background: P.bgSurface, borderBottom: `1px solid ${P.accent}` }}>
                    <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '0.78rem', fontWeight: 800, color: P.creamMuted, textTransform: 'uppercase' }}>No</th>
                    <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '0.78rem', fontWeight: 800, color: P.creamMuted, textTransform: 'uppercase' }}>Nama Outlet</th>
                    <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '0.78rem', fontWeight: 800, color: P.creamMuted, textTransform: 'uppercase' }}>Target Omzet</th>
                    <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '0.78rem', fontWeight: 800, color: P.creamMuted, textTransform: 'uppercase' }}>Bulan</th>
                    <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '0.78rem', fontWeight: 800, color: P.creamMuted, textTransform: 'uppercase' }}>Tahun</th>
                    <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: '0.78rem', fontWeight: 800, color: P.creamMuted, textTransform: 'uppercase', width: '120px' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedOmzet.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ padding: '24px', textAlign: 'center', color: P.creamMuted, fontSize: '0.85rem' }}>Belum ada target omzet yang diatur.</td>
                    </tr>
                  ) : (
                    paginatedOmzet.map((t, idx) => (
                      <tr key={t.id} style={{ borderBottom: `1px solid ${P.accent}`, background: idx % 2 === 0 ? P.bgMain : P.bgSurface, transition: 'background 0.2s' }}>
                        <td style={{ padding: '14px 16px', fontSize: '0.85rem', color: P.cream, fontWeight: 700 }}>{(omzetTargetPage - 1) * 10 + idx + 1}</td>
                        <td style={{ padding: '14px 16px', fontSize: '0.85rem', color: P.cream, fontWeight: 700 }}>{t.outlet_name}</td>
                        <td style={{ padding: '14px 16px', fontSize: '0.85rem', color: P.success, fontWeight: 800 }}>{formatRp(t.target_omzet)}</td>
                        <td style={{ padding: '14px 16px', fontSize: '0.85rem', color: P.cream }}>{t.bulan}</td>
                        <td style={{ padding: '14px 16px', fontSize: '0.85rem', color: P.cream }}>{t.tahun}</td>
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                            <button
                              type="button"
                              onClick={() => triggerEditOmzet(t)}
                              style={{ background: P.creamGlow, border: 'none', color: P.cream, padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 700 }}
                            >
                              <Edit size={12} /> EDIT
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteOmzet(t.id)}
                              style={{ background: P.dangerGlow, border: 'none', color: P.danger, padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 700 }}
                            >
                              <Trash2 size={12} /> HAPUS
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Omzet */}
            {totalOmzetPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', padding: '12px 20px', background: P.bgSurface, border: `1px solid ${P.accent}`, borderRadius: '8px', gap: '16px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.85rem', color: P.creamMuted }}>Menampilkan {(omzetTargetPage - 1) * 10 + 1}-{Math.min(omzetTargetPage * 10, omzetTargets.length)} dari {omzetTargets.length} data</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button type="button" onClick={() => setOmzetTargetPage(p => Math.max(1, p - 1))} disabled={omzetTargetPage === 1} style={{ background: 'transparent', color: P.cream, border: `1px solid ${P.accent}`, padding: '6px 12px', borderRadius: '6px', cursor: omzetTargetPage === 1 ? 'not-allowed' : 'pointer', opacity: omzetTargetPage === 1 ? 0.4 : 1, fontSize: '0.85rem' }}>Sebelumnya</button>
                  {Array.from({ length: totalOmzetPages }, (_, i) => i + 1).map(p => {
                    const isActive = p === omzetTargetPage;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setOmzetTargetPage(p)}
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
                          transition: 'all 0.2s',
                          marginLeft: '4px',
                          marginRight: '4px'
                        }}
                      >
                        {p}
                      </button>
                    );
                  })}
                  <button type="button" onClick={() => setOmzetTargetPage(p => Math.min(totalOmzetPages, p + 1))} disabled={omzetTargetPage === totalOmzetPages} style={{ background: 'transparent', color: P.cream, border: `1px solid ${P.accent}`, padding: '6px 12px', borderRadius: '6px', cursor: omzetTargetPage === totalOmzetPages ? 'not-allowed' : 'pointer', opacity: omzetTargetPage === totalOmzetPages ? 0.4 : 1, fontSize: '0.85rem' }}>Berikutnya</button>
                </div>
              </div>
            )}
          </div>

          {/* ── Modal Atur Target Staf ── */}
          {stafModalOpen && (
            <div style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
              backdropFilter: 'blur(6px)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              padding: '20px', zIndex: 1000,
            }}>
              <div style={{
                width: '100%', maxWidth: '450px',
                background: P.bgSurface, border: `1px solid ${P.accent}`,
                borderRadius: '20px', padding: '28px',
                animation: 'fadeIn 0.3s ease',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: P.cream, margin: 0 }}>
                    {editingStafTarget ? '✏️ EDIT TARGET STAF' : '➕ ATUR TARGET STAF'}
                  </h3>
                  <button type="button" onClick={() => setStafModalOpen(false)} style={{ background: 'transparent', border: 'none', color: P.cream, cursor: 'pointer' }}>
                    <X size={20} />
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: P.creamMuted }}>NAMA OUTLET</label>
                    <select
                      value={formStafOutlet}
                      onChange={e => setFormStafOutlet(e.target.value)}
                      style={{ width: '100%', background: P.bgMain, border: `1px solid ${P.accent}`, borderRadius: '8px', padding: '10px', color: P.cream, fontSize: '0.88rem', outline: 'none' }}
                    >
                      {outlets.map(o => (
                        <option key={o.id} value={o.nama_tablet}>{o.nama_tablet}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: P.creamMuted }}>TARGET JUMLAH KARYAWAN (ANGKA)</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="Contoh: 15"
                      value={formStafCount}
                      onChange={e => setFormStafCount(e.target.value)}
                      style={{ width: '100%', background: P.bgMain, border: `1px solid ${P.accent}`, borderRadius: '8px', padding: '10px', color: P.cream, fontSize: '0.88rem', outline: 'none' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: P.creamMuted }}>BULAN</label>
                      <select
                        value={formStafMonth}
                        onChange={e => setFormStafMonth(e.target.value)}
                        style={{ width: '100%', background: P.bgMain, border: `1px solid ${P.accent}`, borderRadius: '8px', padding: '10px', color: P.cream, fontSize: '0.88rem', outline: 'none' }}
                      >
                        {BULAN_LIST.map(b => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: P.creamMuted }}>TAHUN</label>
                      <select
                        value={formStafYear}
                        onChange={e => setFormStafYear(e.target.value)}
                        style={{ width: '100%', background: P.bgMain, border: `1px solid ${P.accent}`, borderRadius: '8px', padding: '10px', color: P.cream, fontSize: '0.88rem', outline: 'none' }}
                      >
                        {['2025', '2026', '2027', '2028', '2029', '2030'].map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveStaf}
                    disabled={isSavingStaf}
                    style={{ width: '100%', background: P.cream, color: P.bgMain, border: 'none', borderRadius: '8px', padding: '12px', fontSize: '0.9rem', fontWeight: 800, cursor: isSavingStaf ? 'not-allowed' : 'pointer', marginTop: '10px', boxShadow: '0 4px 12px rgba(165, 182, 141, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    {isSavingStaf ? (
                      <>
                        <div className="spinner-mini" style={{ width: '16px', height: '16px', border: `2px solid ${P.bgMain}`, borderTop: `2px solid ${P.accent}`, borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                        <span>Menyimpan...</span>
                      </>
                    ) : (
                      editingStafTarget ? 'SIMPAN PERUBAHAN' : 'TAMBAHKAN TARGET'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Modal Atur Target Omzet ── */}
          {omzetModalOpen && (
            <div style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
              backdropFilter: 'blur(6px)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              padding: '20px', zIndex: 1000,
            }}>
              <div style={{
                width: '100%', maxWidth: '450px',
                background: P.bgSurface, border: `1px solid ${P.accent}`,
                borderRadius: '20px', padding: '28px',
                animation: 'fadeIn 0.3s ease',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: P.cream, margin: 0 }}>
                    {editingOmzetTarget ? '✏️ EDIT TARGET OMZET' : '➕ ATUR TARGET OMZET'}
                  </h3>
                  <button type="button" onClick={() => setOmzetModalOpen(false)} style={{ background: 'transparent', border: 'none', color: P.cream, cursor: 'pointer' }}>
                    <X size={20} />
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: P.creamMuted }}>NAMA OUTLET</label>
                    <select
                      value={formOmzetOutlet}
                      onChange={e => setFormOmzetOutlet(e.target.value)}
                      style={{ width: '100%', background: P.bgMain, border: `1px solid ${P.accent}`, borderRadius: '8px', padding: '10px', color: P.cream, fontSize: '0.88rem', outline: 'none' }}
                    >
                      {outlets.map(o => (
                        <option key={o.id} value={o.nama_tablet}>{o.nama_tablet}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: P.creamMuted }}>TARGET OMZET (RUPIAH)</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.88rem', color: P.creamMuted, fontWeight: 700 }}>Rp</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="Contoh: 180000000"
                        value={formOmzetAmount}
                        onChange={e => setFormOmzetAmount(e.target.value)}
                        style={{ width: '100%', background: P.bgMain, border: `1px solid ${P.accent}`, borderRadius: '8px', padding: '10px 10px 10px 32px', color: P.cream, fontSize: '0.88rem', outline: 'none' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: P.creamMuted }}>BULAN</label>
                      <select
                        value={formOmzetMonth}
                        onChange={e => setFormOmzetMonth(e.target.value)}
                        style={{ width: '100%', background: P.bgMain, border: `1px solid ${P.accent}`, borderRadius: '8px', padding: '10px', color: P.cream, fontSize: '0.88rem', outline: 'none' }}
                      >
                        {BULAN_LIST.map(b => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: P.creamMuted }}>TAHUN</label>
                      <select
                        value={formOmzetYear}
                        onChange={e => setFormOmzetYear(e.target.value)}
                        style={{ width: '100%', background: P.bgMain, border: `1px solid ${P.accent}`, borderRadius: '8px', padding: '10px', color: P.cream, fontSize: '0.88rem', outline: 'none' }}
                      >
                        {['2025', '2026', '2027', '2028', '2029', '2030'].map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveOmzet}
                    disabled={isSavingOmzet}
                    style={{ width: '100%', background: P.cream, color: P.bgMain, border: 'none', borderRadius: '8px', padding: '12px', fontSize: '0.9rem', fontWeight: 800, cursor: isSavingOmzet ? 'not-allowed' : 'pointer', marginTop: '10px', boxShadow: '0 4px 12px rgba(165, 182, 141, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    {isSavingOmzet ? (
                      <>
                        <div className="spinner-mini" style={{ width: '16px', height: '16px', border: `2px solid ${P.bgMain}`, borderTop: `2px solid ${P.accent}`, borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                        <span>Menyimpan...</span>
                      </>
                    ) : (
                      editingOmzetTarget ? 'SIMPAN PERUBAHAN' : 'TAMBAHKAN TARGET'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Modal Tambah / Edit Outlet ── */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(6px)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          padding: '20px', zIndex: 1000,
        }}>
          <div style={{
            width: '100%', maxWidth: '520px',
            background: P.bgSurface, border: `1px solid ${P.accent}`,
            borderRadius: '20px', padding: '28px',
            animation: 'fadeIn 0.3s ease',
          }}>
            {/* Header Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px', paddingBottom: '14px', borderBottom: `1px solid ${P.accent}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: P.creamGlow, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Store size={18} color={P.cream} />
                </div>
                <h2 style={{ fontSize: '1rem', fontWeight: 800, color: P.cream, margin: 0 }}>
                  {editingId ? 'UBAH DATA OUTLET' : 'TAMBAH OUTLET BARU'}
                </h2>
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', color: P.cream, cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {/* Error message */}
            {errorMsg && (
              <div style={{
                background: P.dangerGlow, border: `1px solid ${P.danger}`,
                color: P.danger, padding: '10px 14px', borderRadius: '8px',
                fontSize: '0.82rem', fontWeight: 700, marginBottom: '16px',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                <AlertCircle size={14} /> {errorMsg}
              </div>
            )}

            {/* Preview Nama Tablet */}
            {(formNama || formWilayah) && (
              <div style={{
                background: 'rgba(65,45,21,0.3)', border: `1px dashed ${P.accent}`,
                borderRadius: '8px', padding: '10px 14px', marginBottom: '18px',
              }}>
                <div style={{ fontSize: '0.68rem', color: P.creamMuted, fontWeight: 700, textTransform: 'uppercase', marginBottom: '3px' }}>
                  Preview Nama Tablet (Pengenal Unik):
                </div>
                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: P.cream }}>
                  🔗 {getNamaTablet({ nama: formNama, wilayah: formWilayah }) || '—'}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* ID Outlet */}
              <div>
                <label style={S.inputLabel}>ID OUTLET *</label>
                <input
                  type="text"
                  placeholder="Contoh: ABS MDN, APS BLG"
                  value={formId}
                  onChange={e => setFormId(e.target.value.toUpperCase())}
                  style={S.input}
                  disabled={!!editingId}
                  onFocus={inputFocus} onBlur={inputBlur}
                />
              </div>

              {/* Nama Outlet */}
              <div>
                <label style={S.inputLabel}>Nama Outlet *</label>
                <input
                  type="text"
                  placeholder="Contoh: AYAM BAKAR SURABAYA"
                  value={formNama}
                  onChange={e => setFormNama(e.target.value.toUpperCase())}
                  style={S.input}
                  onFocus={inputFocus} onBlur={inputBlur}
                />
              </div>

              {/* Wilayah */}
              <div>
                <label style={S.inputLabel}>Wilayah *</label>
                <input
                  type="text"
                  placeholder="Contoh: TEBING TINGGI"
                  value={formWilayah}
                  onChange={e => setFormWilayah(e.target.value.toUpperCase())}
                  style={S.input}
                  onFocus={inputFocus} onBlur={inputBlur}
                />
              </div>

              {/* Alamat */}
              <div>
                <label style={S.inputLabel}>Alamat Lengkap *</label>
                <textarea
                  placeholder="Contoh: JL. SM RAJA, DEPAN SAMSAT LAMA"
                  value={formAlamat}
                  onChange={e => setFormAlamat(e.target.value.toUpperCase())}
                  rows={2}
                  style={{ ...S.input, resize: 'vertical' }}
                  onFocus={inputFocus} onBlur={inputBlur}
                />
              </div>

              {/* Permodalan + Status (2 kolom) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={S.inputLabel}>Permodalan *</label>
                  <select
                    value={formPermodalan}
                    onChange={e => setFormPermodalan(e.target.value)}
                    style={{ ...S.input, height: '42px', cursor: 'pointer' }}
                    onFocus={inputFocus} onBlur={inputBlur}
                  >
                    <option value="BOOTSTRAP">BOOTSTRAP</option>
                    <option value="INVESTOR">INVESTOR</option>
                  </select>
                </div>
                <div>
                  <label style={S.inputLabel}>Status *</label>
                  <select
                    value={formStatus}
                    onChange={e => setFormStatus(e.target.value)}
                    style={{ ...S.input, height: '42px', cursor: 'pointer' }}
                    onFocus={inputFocus} onBlur={inputBlur}
                  >
                    <option value="AKTIF">AKTIF</option>
                    <option value="TIDAK AKTIF">TIDAK AKTIF</option>
                  </select>
                </div>
              </div>

              {/* Tombol Aksi */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                <button
                  onClick={handleSave}
                  style={{
                    flex: 1, height: '46px',
                    background: P.cream, color: P.bgMain,
                    border: 'none', borderRadius: '10px',
                    fontSize: '0.9rem', fontWeight: 800, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    boxShadow: '0 4px 14px rgba(165, 182, 141, 0.25)',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f0ebe0'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = P.cream; e.currentTarget.style.transform = 'none'; }}
                >
                  <CheckCircle size={18} />
                  {editingId ? 'Simpan Perubahan' : 'Tambahkan Outlet'}
                </button>
                <button
                  onClick={() => setShowModal(false)}
                  style={{
                    flex: 1, height: '46px',
                    background: P.accent, color: P.cream,
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

      {/* ── Modal Tambah / Edit Jabatan ── */}
      {roleModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(6px)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          padding: '20px', zIndex: 1000,
        }}>
          <div style={{
            width: '100%', maxWidth: '480px',
            background: P.bgSurface, border: `1px solid ${P.accent}`,
            borderRadius: '20px', padding: '28px',
            animation: 'fadeIn 0.3s ease',
          }}>
            {/* Header Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px', paddingBottom: '14px', borderBottom: `1px solid ${P.accent}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: P.creamGlow, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Users size={18} color={P.cream} />
                </div>
                <h2 style={{ fontSize: '1rem', fontWeight: 800, color: P.cream, margin: 0 }}>
                  {editingRoleId ? 'UBAH DATA JABATAN' : 'TAMBAH JABATAN BARU'}
                </h2>
              </div>
              <button onClick={() => setRoleModal(false)} style={{ background: 'transparent', border: 'none', color: P.cream, cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {/* Error message */}
            {errorMsg && (
              <div style={{
                background: P.dangerGlow, border: `1px solid ${P.danger}`,
                color: P.danger, padding: '10px 14px', borderRadius: '8px',
                fontSize: '0.82rem', fontWeight: 700, marginBottom: '16px',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                <AlertCircle size={14} /> {errorMsg}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Divisi */}
              <div>
                <label style={S.inputLabel}>Divisi Utama *</label>
                <select
                  value={formRoleDivisi}
                  onChange={e => setFormRoleDivisi(e.target.value)}
                  style={{ ...S.input, height: '42px', cursor: 'pointer' }}
                  onFocus={inputFocus} onBlur={inputBlur}
                >
                  <option value="Leader">Leader</option>
                  <option value="Produksi">Produksi</option>
                  <option value="Pelayanan">Pelayanan</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>

              {/* Nama Jabatan */}
              <div>
                <label style={S.inputLabel}>Nama Jabatan *</label>
                <input
                  type="text"
                  placeholder="Contoh: Kepala Cabang, Koki, Helper"
                  value={formRoleJabatan}
                  onChange={e => setFormRoleJabatan(e.target.value)}
                  style={S.input}
                  onFocus={inputFocus} onBlur={inputBlur}
                />
              </div>

              {/* Tombol Aksi */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                <button
                  onClick={handleSaveRole}
                  style={{
                    flex: 1, height: '46px',
                    background: P.cream, color: P.bgMain,
                    border: 'none', borderRadius: '10px',
                    fontSize: '0.9rem', fontWeight: 800, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    boxShadow: '0 4px 14px rgba(165, 182, 141, 0.25)',
                    transition: 'all 0.2s',
                  }}
                >
                  <CheckCircle size={18} />
                  Simpan
                </button>
                <button
                  onClick={() => setRoleModal(false)}
                  style={{
                    flex: 1, height: '46px',
                    background: P.accent, color: P.cream,
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

      {/* ── Modal Konfirmasi Hapus Jabatan ── */}
      {roleConfirmModal.open && (
        <div className="confirm-overlay">
          <div className="confirm-card">
            <h3 className="confirm-title">{roleConfirmModal.title}</h3>
            <p className="confirm-message">{roleConfirmModal.msg}</p>
            <div className="confirm-actions">
              <button
                className="btn-confirm-yes"
                onClick={() => { roleConfirmModal.onConfirm(); setRoleConfirmModal(p => ({ ...p, open: false })); }}
              >
                YA, HAPUS
              </button>
              <button
                className="btn-confirm-cancel"
                onClick={() => setRoleConfirmModal(p => ({ ...p, open: false }))}
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

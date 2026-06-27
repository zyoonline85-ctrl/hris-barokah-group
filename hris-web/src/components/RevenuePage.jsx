import React, { useState, useEffect } from 'react';
import { Store, Plus, Edit, Trash2, Calendar, TrendingUp, Coins, Search, Filter, X, CheckCircle, AlertCircle } from 'lucide-react';

export default function RevenuePage({ token, API_URL }) {
  // Data States
  const [outlets, setOutlets] = useState([]);
  const [revenues, setRevenues] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search and Filters
  const [searchRevenue, setSearchRevenue] = useState('');
  const [filterTanggal, setFilterTanggal] = useState('');
  const [filterBulan, setFilterBulan] = useState('');
  const [filterTahun, setFilterTahun] = useState('');

  // Column Visibility States
  const [showColFilterRevenue, setShowColFilterRevenue] = useState(false);
  const [visibleColumnsRevenue, setVisibleColumnsRevenue] = useState({
    tanggal: true,
    nama: true,
    omzet: true,
    total_omzet: true,
    aksi: true
  });
  const colLabelMapRevenue = {
    tanggal: 'TANGGAL OMZET',
    nama: 'NAMA OUTLET',
    omzet: 'OMZET',
    total_omzet: 'TOTAL OMZET (RUNNING)',
    aksi: 'AKSI'
  };

  // Form State for Revenue CRUD
  const [showRevenueModal, setShowRevenueModal] = useState(false);
  const [revOutletId, setRevOutletId] = useState('');
  const [revDate, setRevDate] = useState(new Date().toISOString().split('T')[0]);
  const [revAmount, setRevAmount] = useState('');
  const [editingRevenueId, setEditingRevenueId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'YAKIN',
    cancelText: 'BATAL',
    onConfirm: null
  });

  const [toast, setToast] = useState({ show: false, type: '', message: '' });

  const showToast = (type, message) => {
    setToast({ show: true, type, message });
    setTimeout(() => {
      setToast({ show: false, type: '', message: '' });
    }, 6000);
  };

  const toTitleCase = (str) => {
    if (!str) return '';
    return str
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const fetchOutlets = async () => {
    try {
      const res = await fetch(`${API_URL}/outlets`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.status === 'success') {
        setOutlets(data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchRevenues = async () => {
    try {
      const res = await fetch(`${API_URL}/outlets/revenues`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.status === 'success') {
        setRevenues(data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadData = async () => {
    setLoading(true);
    await Promise.all([fetchOutlets(), fetchRevenues()]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [token, API_URL]);

  // Revenue CRUD handlers
  const triggerRevenueSave = (e) => {
    e.preventDefault();
    setConfirmModal({
      isOpen: true,
      title: 'KONFIRMASI SIMPAN',
      message: 'Apakah Anda yakin ingin mencatat omzet harian cabang ini?',
      confirmText: 'YAKIN SIMPAN',
      cancelText: 'BATAL',
      onConfirm: () => executeRevenueSubmit()
    });
  };

  const executeRevenueSubmit = async () => {
    setErrorMsg('');
    const payload = {
      outlet_id: revOutletId,
      tanggal: revDate,
      jumlah_omzet: revAmount
    };

    try {
      let url = `${API_URL}/outlets/revenues`;
      let method = 'POST';
      if (editingRevenueId) {
        url = `${API_URL}/outlets/revenues/${editingRevenueId}`;
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
        setShowRevenueModal(false);
        setRevOutletId('');
        setRevAmount('');
        setEditingRevenueId(null);
        fetchRevenues();
        showToast('success', 'DATA BERHASIL DISIMPAN!');
      } else {
        setErrorMsg(data.message || 'Gagal menyimpan data.');
        showToast('error', 'DATA GAGAL');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Kesalahan koneksi internet.');
      showToast('error', 'DATA GAGAL');
    }
  };

  const handleEditRevenue = (rev) => {
    setEditingRevenueId(rev.id);
    setRevOutletId(rev.outlet_id || '');
    setRevDate(rev.tanggal);
    setRevAmount(String(rev.jumlah_omzet));
    setErrorMsg('');
    setShowRevenueModal(true);
  };

  const triggerDeleteRevenue = (id) => {
    setConfirmModal({
      isOpen: true,
      title: 'KONFIRMASI HAPUS',
      message: 'Apakah Anda yakin ingin menghapus catatan omzet ini?',
      confirmText: 'YA, HAPUS',
      cancelText: 'BATAL',
      onConfirm: () => executeDeleteRevenue(id)
    });
  };

  const executeDeleteRevenue = async (id) => {
    try {
      const res = await fetch(`${API_URL}/outlets/revenues/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.status === 'success') {
        fetchRevenues();
        showToast('success', 'DATA BERHASIL DISIMPAN!');
      } else {
        showToast('error', 'Gagal menghapus.');
      }
    } catch (err) {
      console.error(err);
      showToast('error', 'DATA GAGAL');
    }
  };

  const formatRupiah = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatCompactRupiah = (amount) => {
    if (amount >= 1000000000) {
      return (amount / 1000000000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (amount >= 1000000) {
      return (amount / 1000000).toFixed(1).replace(/\.0$/, '') + 'jt';
    }
    if (amount >= 1000) {
      return (amount / 1000).toFixed(0) + 'rb';
    }
    return String(amount);
  };

  // Filter and Calculate Running Totals for Revenues
  const processRevenues = () => {
    const sortedRevenues = [...revenues].sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));
    const runningTotals = {};

    const withRunningTotals = sortedRevenues.map(r => {
      const outletName = r.nama_outlet || 'Cabang';
      runningTotals[outletName] = (runningTotals[outletName] || 0) + (parseFloat(r.jumlah_omzet) || 0);
      return {
        ...r,
        running_total: runningTotals[outletName]
      };
    });

    const filtered = withRunningTotals.filter(r => {
      const matchesSearch = r.nama_outlet.toLowerCase().includes(searchRevenue.toLowerCase()) ||
                            r.tanggal.includes(searchRevenue);

      let matchesTanggal = true;
      if (filterTanggal) {
        matchesTanggal = r.tanggal === filterTanggal;
      }

      let matchesBulan = true;
      if (filterBulan) {
        const monthPart = r.tanggal.split('-')[1];
        matchesBulan = monthPart === filterBulan;
      }

      let matchesTahun = true;
      if (filterTahun) {
        const yearPart = r.tanggal.split('-')[0];
        matchesTahun = yearPart === filterTahun;
      }

      return matchesSearch && matchesTanggal && matchesBulan && matchesTahun;
    });

    return filtered.reverse();
  };

  const displayRevenues = processRevenues();

  // Aggregate Data for Chart
  const chartData = outlets.map(ot => {
    const total = revenues
      .filter(r => String(r.outlet_id) === String(ot.id))
      .reduce((sum, r) => sum + (parseFloat(r.jumlah_omzet) || 0), 0);
    return {
      name: ot.nama,
      total: total
    };
  });

  // Calculate Stat Cards
  const grandTotalOmzet = revenues.reduce((sum, r) => sum + (parseFloat(r.jumlah_omzet) || 0), 0);
  const avgOmzet = revenues.length > 0 ? Math.round(grandTotalOmzet / revenues.length) : 0;
  const totalLogsCount = revenues.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      


      {/* Floating Toast Notification */}
      {toast.show && (
        <div className={`toast-notification ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>
          {toast.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          <span className="toast-message">{toast.message}</span>
        </div>
      )}

      {/* Stats Cards Dashboard Summary */}
      <div className="stats-grid animate-fade-in" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
        
        {/* Card 1: Total Omzet Akumulatif */}
        <div className="glass-card stat-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '12px', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <div className="stat-info">
            <span className="stat-label" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>TOTAL OMZET MASUK</span>
            <div className="stat-value" style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--success)', marginTop: '4px' }}>{formatRupiah(grandTotalOmzet)}</div>
          </div>
          <div className="stat-icon" style={{ background: 'var(--success-glow)', color: 'var(--success)', width: '38px', height: '38px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUp size={18} />
          </div>
        </div>

        {/* Card 2: Rerata Omzet Harian */}
        <div className="glass-card stat-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '12px', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <div className="stat-info">
            <span className="stat-label" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>RERATA OMZET TOKO</span>
            <div className="stat-value" style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--warning)', marginTop: '4px' }}>{formatRupiah(avgOmzet)}</div>
          </div>
          <div className="stat-icon" style={{ background: 'var(--warning-glow)', color: 'var(--warning)', width: '38px', height: '38px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Coins size={18} />
          </div>
        </div>

        {/* Card 3: Log Pendapatan */}
        <div className="glass-card stat-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '12px', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <div className="stat-info">
            <span className="stat-label" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>PENCATATAN OMZET</span>
            <div className="stat-value" style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginTop: '4px' }}>{totalLogsCount} TRANSAKSI</div>
          </div>
          <div className="stat-icon" style={{ background: 'var(--primary-glow)', color: 'var(--primary-solid)', width: '38px', height: '38px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Coins size={18} />
          </div>
        </div>

      </div>

      {/* ============================================================ */}
      {/* GRAFIK OMZET OUTLET (SVG BAR CHART) */}
      {/* ============================================================ */}
      {(() => {
        const maxVal = Math.max(...chartData.map(d => d.total), 1);
        const height = 240;
        const padding = 40;
        const chartHeight = height - padding * 2;
        const barWidth = 46;
        const gap = 36;
        const totalChartWidth = chartData.length * (barWidth + gap) + 80;

        return (
          <div className="glass-card animate-fade-in" style={{ padding: '30px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <TrendingUp size={22} color="var(--primary-solid)" />
              <span>GRAFIK AKUMULASI OMZET SELURUH OUTLET</span>
            </h3>
            {chartData.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>Belum ada data omzet untuk digambarkan.</p>
            ) : (
              <div style={{ overflowX: 'auto', width: '100%', paddingBottom: '10px' }}>
                <svg viewBox={`0 0 ${totalChartWidth} ${height}`} style={{ width: '100%', minWidth: `${totalChartWidth}px`, height: `${height}px` }}>
                  <defs>
                    <linearGradient id="chartBarGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary-solid)" />
                      <stop offset="100%" stopColor="var(--primary-glow)" stopOpacity="0.3" />
                    </linearGradient>
                  </defs>

                  {/* Grid Lines */}
                  <line x1="50" y1={padding} x2={totalChartWidth - 30} y2={padding} stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="5" />
                  <line x1="50" y1={padding + chartHeight / 2} x2={totalChartWidth - 30} y2={padding + chartHeight / 2} stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="5" />
                  <line x1="50" y1={padding + chartHeight} x2={totalChartWidth - 30} y2={padding + chartHeight} stroke="var(--border-color)" strokeWidth="1" />

                  {chartData.map((d, i) => {
                    const barHeight = (d.total / maxVal) * chartHeight;
                    const x = 70 + i * (barWidth + gap);
                    const y = padding + chartHeight - barHeight;

                    return (
                      <g key={i}>
                        {/* Bar */}
                        <rect
                          x={x}
                          y={y}
                          width={barWidth}
                          height={barHeight}
                          fill="url(#chartBarGrad)"
                          rx="6"
                          style={{ transition: 'all 0.4s ease' }}
                        />
                        {/* Total Label */}
                        <text
                          x={x + barWidth / 2}
                          y={y - 10}
                          textAnchor="middle"
                          fill="#fff"
                          fontSize="10px"
                          fontWeight="700"
                        >
                          {formatCompactRupiah(d.total)}
                        </text>
                        {/* X Axis Label */}
                        <text
                          x={x + barWidth / 2}
                          y={padding + chartHeight + 20}
                          textAnchor="middle"
                          fill="var(--text-muted)"
                          fontSize="10px"
                          fontWeight="600"
                        >
                          {toTitleCase(d.name)}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            )}
          </div>
        );
      })()}

      {/* ============================================================ */}
      {/* TABEL: OMZET OUTLET */}
      {/* ============================================================ */}
      <div className="glass-card animate-fade-in" style={{ padding: '30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="logo-icon" style={{ background: 'var(--success-glow)', width: '42px', height: '42px' }}>
              <Coins size={20} color="var(--success)" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>OMZET OUTLET</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Pencatatan data omzet harian per cabang dan total omzet berjalan (Running Total).</p>
            </div>
          </div>

          <button className="btn-primary" onClick={() => { setErrorMsg(''); setShowRevenueModal(true); }} disabled={outlets.length === 0}>
            <Plus size={16} />
            <span>TAMBAHKAN OMZET</span>
          </button>
        </div>

        {/* Advanced Filters: Tanggal, Bulan, Tahun */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px', marginBottom: '24px' }}>
          {/* Search bar */}
          <div style={{ position: 'relative', width: '240px' }}>
            <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Cari ..."
              className="input-field"
              value={searchRevenue}
              onChange={(e) => setSearchRevenue(e.target.value)}
              style={{ paddingLeft: '40px', paddingRight: '12px', height: '40px' }}
            />
          </div>

          {/* Time filters group */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Filter Tanggal */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Tanggal:</span>
              <input
                type="date"
                className="input-field"
                value={filterTanggal}
                onChange={(e) => setFilterTanggal(e.target.value)}
                style={{ width: '130px', height: '40px', fontSize: '0.8rem' }}
              />
            </div>

            {/* Filter Bulan */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Bulan:</span>
              <select
                className="input-field"
                value={filterBulan}
                onChange={(e) => setFilterBulan(e.target.value)}
                style={{ width: '120px', height: '40px', fontSize: '0.8rem', background: 'var(--bg-main)', color: '#fff' }}
              >
                <option value="">Semua Bulan</option>
                <option value="01">Januari</option>
                <option value="02">Februari</option>
                <option value="03">Maret</option>
                <option value="04">April</option>
                <option value="05">Mei</option>
                <option value="06">Juni</option>
                <option value="07">Juli</option>
                <option value="08">Agustus</option>
                <option value="09">September</option>
                <option value="10">Oktober</option>
                <option value="11">November</option>
                <option value="12">Desember</option>
              </select>
            </div>

            {/* Filter Tahun */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Tahun:</span>
              <select
                className="input-field"
                value={filterTahun}
                onChange={(e) => setFilterTahun(e.target.value)}
                style={{ width: '100px', height: '40px', fontSize: '0.8rem', background: 'var(--bg-main)', color: '#fff' }}
              >
                <option value="">Semua</option>
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
                <option value="2040">2040</option></select>
            </div>

            {/* Reset button */}
            {(filterTanggal || filterBulan || filterTahun) && (
              <button
                className="btn-secondary"
                onClick={() => { setFilterTanggal(''); setFilterBulan(''); setFilterTahun(''); }}
                style={{ height: '40px', padding: '0 12px' }}
              >
                Reset
              </button>
            )}

            {/* Column Visibility Filter */}
            <div style={{ position: 'relative' }}>
              <button
                className="btn-secondary"
                onClick={() => setShowColFilterRevenue(!showColFilterRevenue)}
                style={{ height: '40px', display: 'flex', alignItems: 'center', gap: '8px', padding: '0 16px', background: 'hsla(0, 0%, 100%, 0.02)' }}
              >
                <Filter size={16} />
                <span>SARING KOLOM</span>
              </button>
              {showColFilterRevenue && (
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
                  {Object.keys(visibleColumnsRevenue).map(col => (
                    <label key={col} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#fff', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={visibleColumnsRevenue[col]}
                        onChange={() => setVisibleColumnsRevenue(prev => ({ ...prev, [col]: !prev[col] }))}
                        style={{ width: '16px', height: '16px', accentColor: 'var(--primary-solid)' }}
                      />
                      <span>{colLabelMapRevenue[col]}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Revenues Table */}
        {loading ? (
          <div className="spinner-container">
            <div className="loading-spinner"></div>
            <p className="loading-text">Memuat data omzet...</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table" style={{ fontSize: '12px' }}>
              <thead>
                <tr>
                  {visibleColumnsRevenue.tanggal && <th>{colLabelMapRevenue.tanggal}</th>}
                  {visibleColumnsRevenue.nama && <th>{colLabelMapRevenue.nama}</th>}
                  {visibleColumnsRevenue.omzet && <th>{colLabelMapRevenue.omzet}</th>}
                  {visibleColumnsRevenue.total_omzet && <th>{colLabelMapRevenue.total_omzet}</th>}
                  {visibleColumnsRevenue.aksi && <th style={{ width: '100px' }}>{colLabelMapRevenue.aksi}</th>}
                </tr>
              </thead>
              <tbody>
                {displayRevenues.length === 0 ? (
                  <tr>
                    <td colSpan={Object.values(visibleColumnsRevenue).filter(Boolean).length} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada data omzet yang cocok dengan kriteria filter.</td>
                  </tr>
                ) : (
                  displayRevenues.map(r => (
                    <tr key={r.id}>
                      {visibleColumnsRevenue.tanggal && (
                        <td>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Calendar size={14} color="var(--text-muted)" />
                            <span>{r.tanggal}</span>
                          </span>
                        </td>
                      )}
                      {visibleColumnsRevenue.nama && <td style={{ fontWeight: 600, color: '#fff' }}>{toTitleCase(r.nama_outlet)}</td>}
                      {visibleColumnsRevenue.omzet && <td style={{ fontWeight: 600, color: 'var(--success)' }}>{formatRupiah(r.jumlah_omzet)}</td>}
                      {visibleColumnsRevenue.total_omzet && <td style={{ fontWeight: 700, color: 'var(--primary-solid)' }}>{formatRupiah(r.running_total)}</td>}
                      {visibleColumnsRevenue.aksi && (
                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={() => handleEditRevenue(r)}
                              style={{ background: 'var(--primary-glow)', border: 'none', color: 'var(--primary-solid)', padding: '6px', borderRadius: '6px', cursor: 'pointer' }}
                              title="Ubah Catatan"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => triggerDeleteRevenue(r.id)}
                              style={{ background: 'var(--danger-glow)', border: 'none', color: 'var(--danger)', padding: '6px', borderRadius: '6px', cursor: 'pointer' }}
                              title="Hapus Catatan"
                            >
                              <Trash2 size={14} />
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
        )}
      </div>

      {/* ============================================================ */}
      {/* FORM MODAL: PENCATATAN OMZET */}
      {/* ============================================================ */}
      {showRevenueModal && (
        <div className="modal-backdrop">
          <div className="glass-card modal-content animate-fade-in" style={{ maxWidth: '500px', width: '90%' }}>
            <div className="modal-header">
              <h2>{editingRevenueId ? 'UBAH CATATAN OMZET' : 'CATAT OMZET HARIAN CABANG'}</h2>
              <button onClick={() => setShowRevenueModal(false)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {errorMsg && (
              <p style={{ color: 'var(--danger)', background: 'var(--danger-glow)', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem' }}>
                {errorMsg}
              </p>
            )}

            <form onSubmit={triggerRevenueSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
              <div className="input-group">
                <label>PILIH CABANG OUTLET</label>
                <select
                  className="input-field"
                  value={revOutletId}
                  onChange={(e) => setRevOutletId(e.target.value)}
                  required
                  style={{ background: 'var(--bg-main)', color: '#fff' }}
                >
                  <option value="">-- PILIH TOKO --</option>
                  {outlets.map(o => (
                    <option key={o.id} value={o.id}>{toTitleCase(o.nama)}</option>
                  ))}
                </select>
              </div>

              <div className="input-group">
                <label>TANGGAL OMZET</label>
                <input
                  type="date"
                  className="input-field"
                  value={revDate}
                  onChange={(e) => setRevDate(e.target.value)}
                  required
                />
              </div>

              <div className="input-group">
                <label>JUMLAH OMZET PENDAPATAN (RP)</label>
                <input
                  type="number"
                  className="input-field"
                  value={revAmount}
                  onChange={(e) => setRevAmount(e.target.value)}
                  placeholder="Contoh: 12000000"
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                  <span>CATAT OMZET</span>
                </button>
                <button type="button" className="btn-secondary" onClick={() => setShowRevenueModal(false)} style={{ flex: 1 }}>
                  BATAL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* CONFIRMATION POPUP MODAL */}
      {/* ============================================================ */}
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

/**
 * BroadcastUtama.jsx — Global Broadcast & Push Notification Command Center
 * =========================================================================
 * HRIS Barokah Grup — Pusat Komando Siaran Informasi ke Mobile Karyawan
 * Palet: #222831 (bg) | #393E46 (surface) | #00ADB5 (cyan) | #EEEEEE (text)
 * Aturan: Capital Each Word untuk Judul Siaran, Nama Pembuat, Target Outlet
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Radio, Send, Download, Trash2, Eye, X, ChevronDown,
  CheckSquare, Square, AlertTriangle, Info, FileText,
  Users, Bell, TrendingUp, Inbox, CheckCircle, Filter,
  Clock, Zap, BarChart2, RefreshCw
} from 'lucide-react';
import { useHRIS } from '../context/HRISContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import PDFCompileOverlay from './PDFCompileOverlay';

// ─── Palet & Konstanta ────────────────────────────────────────────────────────
const C = {
  bg:       '#222831',
  surface:  '#393E46',
  cyan:     '#00ADB5',
  cyanDim:  'rgba(0,173,181,0.12)',
  cyanBorder:'rgba(0,173,181,0.3)',
  text:     '#EEEEEE',
  muted:    '#9EA8B3',
  border:   'rgba(238,238,238,0.1)',
  card:     '#2D333B',
  danger:   '#E05C5C',
  dangerDim:'rgba(224,92,92,0.12)',
  dangerBorder:'rgba(224,92,92,0.3)',
  success:  '#4ECDC4',
  warn:     '#F5A623',
  warnDim:  'rgba(245,166,35,0.12)',
};

const KATEGORI_LIST = ['Penting / Darurat', 'Memo Operasional', 'Info Umum'];

const KATEGORI_CONFIG = {
  'Penting / Darurat': { color: C.danger,   bg: C.dangerDim,  border: C.dangerBorder, icon: '🚨', badge: 'DARURAT' },
  'Memo Operasional':  { color: C.warn,     bg: C.warnDim,    border: 'rgba(245,166,35,0.3)', icon: '📋', badge: 'MEMO' },
  'Info Umum':         { color: C.cyan,     bg: C.cyanDim,    border: C.cyanBorder,   icon: 'ℹ️', badge: 'INFO' },
};

// ─── Utilitas ─────────────────────────────────────────────────────────────────
const capitalEachWord = (s = '') => String(s).replace(/\b\w/g, c => c.toUpperCase());
const uid = () => `BC-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
const lsGet = (k, fb = []) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { console.error('[Broadcast] lsSet:', k, e); } };

const fmtDate = (iso) => {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
};

// ─── Micro-Components ─────────────────────────────────────────────────────────
const Chip = ({ label, color = C.cyan, bg = C.cyanDim, border = C.cyanBorder, onRemove }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: '5px',
    padding: '3px 10px', borderRadius: '20px', fontSize: '0.74rem',
    fontWeight: 700, color, background: bg, border: `1px solid ${border}`,
  }}>
    {label}
    {onRemove && <X size={10} style={{ cursor: 'pointer', opacity: 0.8 }} onClick={onRemove} />}
  </span>
);

const StatCard = ({ icon, label, val, color = C.cyan }) => (
  <div style={{
    background: C.surface, border: `1px solid ${C.border}`, borderRadius: '14px',
    padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px', flex: '1 1 140px',
  }}>
    <div style={{
      background: `${color}18`, border: `1px solid ${color}33`,
      borderRadius: '10px', padding: '10px', color, display: 'flex',
    }}>{icon}</div>
    <div>
      <p style={{ color: C.muted, fontSize: '0.72rem', marginBottom: '2px' }}>{label}</p>
      <p style={{ color, fontWeight: 800, fontSize: '1.3rem' }}>{val}</p>
    </div>
  </div>
);

// ─── READ RECEIPT PROGRESS BAR ────────────────────────────────────────────────
const ReadBar = ({ total, read }) => {
  const pct = total > 0 ? Math.round((read / total) * 100) : 0;
  const barColor = pct >= 80 ? C.success : pct >= 40 ? C.warn : C.danger;
  return (
    <div style={{ minWidth: '160px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.75rem' }}>
        <span style={{ color: barColor, fontWeight: 700 }}>{pct}%</span>
        <span style={{ color: C.muted }}>{read}/{total}</span>
      </div>
      <div style={{ height: '6px', background: 'rgba(238,238,238,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`, borderRadius: '4px',
          background: `linear-gradient(90deg, ${barColor}aa, ${barColor})`,
          transition: 'width 0.6s ease',
        }} />
      </div>
      <p style={{ color: C.muted, fontSize: '0.7rem', marginTop: '3px' }}>
        {read} Karyawan Sudah Membaca
      </p>
    </div>
  );
};

// ─── MULTI SELECT DROPDOWN ────────────────────────────────────────────────────
const MultiSelect = ({ label, options, selected, onChange, placeholder = 'Pilih...' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const toggle = (v) => onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v]);
  const allSelected = selected.length === options.length;
  const toggleAll = () => onChange(allSelected ? [] : [...options]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {label && <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: C.muted, marginBottom: '6px' }}>{label}</label>}
      <button type="button" onClick={() => setOpen(p => !p)}
        style={{
          width: '100%', background: C.bg, border: `1px solid ${selected.length ? C.cyanBorder : C.border}`,
          borderRadius: '10px', padding: '10px 14px', color: C.text,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer', fontSize: '0.86rem', textAlign: 'left',
        }}>
        <span style={{ color: selected.length ? C.text : C.muted }}>
          {selected.length === 0 ? placeholder : selected.length === options.length ? '✅ Semua Dipilih' : `${selected.length} Dipilih`}
        </span>
        <ChevronDown size={15} color={C.muted} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 500,
          background: C.surface, border: `1px solid ${C.cyanBorder}`,
          borderRadius: '12px', overflow: 'hidden',
          boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
        }}>
          {/* Pilih Semua */}
          <div onClick={toggleAll}
            style={{
              padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px',
              cursor: 'pointer', borderBottom: `1px solid ${C.border}`,
              background: allSelected ? C.cyanDim : 'transparent',
            }}>
            {allSelected ? <CheckSquare size={15} color={C.cyan} /> : <Square size={15} color={C.muted} />}
            <span style={{ color: allSelected ? C.cyan : C.text, fontWeight: 700, fontSize: '0.83rem' }}>
              {allSelected ? 'Batalkan Semua' : 'Pilih Semua'}
            </span>
          </div>
          <div style={{ maxHeight: '200px', overflowY: 'auto', padding: '6px' }}>
            {options.map(o => {
              const chk = selected.includes(o);
              return (
                <div key={o} onClick={() => toggle(o)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 10px', borderRadius: '8px', cursor: 'pointer',
                    background: chk ? C.cyanDim : 'transparent',
                    transition: 'background 0.15s',
                  }}>
                  {chk ? <CheckSquare size={14} color={C.cyan} /> : <Square size={14} color={C.muted} />}
                  <span style={{ color: chk ? C.cyan : C.text, fontSize: '0.84rem' }}>
                    {capitalEachWord(o)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── MODAL DETAIL SIARAN ──────────────────────────────────────────────────────
const DetailModal = ({ bc, receipts, onClose }) => {
  if (!bc) return null;
  const cfg = KATEGORI_CONFIG[bc.kategori] || KATEGORI_CONFIG['Info Umum'];
  const bcReceipts = receipts.filter(r => r.broadcast_id === bc.id);
  const readCount = bcReceipts.filter(r => r.status === 'read').length;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
      zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(8px)', padding: '20px',
    }}>
      <div style={{
        background: C.surface, borderRadius: '20px',
        border: `1.5px solid ${cfg.border}`,
        padding: '32px', width: '680px', maxWidth: '96vw',
        maxHeight: '88vh', overflowY: 'auto',
        boxShadow: `0 0 60px ${cfg.color}22`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <span style={{ fontSize: '1.4rem' }}>{cfg.icon}</span>
              <Chip label={cfg.badge} color={cfg.color} bg={cfg.bg} border={cfg.border} />
            </div>
            <h2 style={{ color: C.text, fontSize: '1.2rem', fontWeight: 800 }}>{bc.judul}</h2>
            <p style={{ color: C.muted, fontSize: '0.8rem', marginTop: '4px' }}>
              Dikirim {fmtDate(bc.created_at)} · oleh {capitalEachWord(bc.sender)}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer' }}>
            <X size={22} />
          </button>
        </div>

        {/* Pesan */}
        <div style={{
          background: C.bg, borderRadius: '12px', padding: '20px',
          border: `1px solid ${C.border}`, marginBottom: '24px',
          color: C.text, lineHeight: '1.7', fontSize: '0.9rem', whiteSpace: 'pre-wrap',
        }}>
          {bc.pesan}
        </div>

        {/* Meta Info */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
          {[
            { label: 'Target Outlet', val: bc.target_outlets?.join(', ') || 'Semua' },
            { label: 'Target Jabatan', val: bc.target_jabatan?.join(', ') || 'Semua' },
            { label: 'Total Penerima', val: `${bc.total_target} Karyawan` },
            { label: 'Sudah Membaca', val: `${readCount} / ${bc.total_target} (${bc.total_target > 0 ? Math.round(readCount / bc.total_target * 100) : 0}%)` },
          ].map(({ label, val }) => (
            <div key={label} style={{ background: C.bg, borderRadius: '10px', padding: '14px', border: `1px solid ${C.border}` }}>
              <p style={{ color: C.muted, fontSize: '0.72rem', marginBottom: '4px' }}>{label}</p>
              <p style={{ color: C.text, fontWeight: 700, fontSize: '0.88rem' }}>{capitalEachWord(val)}</p>
            </div>
          ))}
        </div>

        {/* Daftar penerima */}
        <p style={{ color: C.cyan, fontWeight: 700, fontSize: '0.83rem', marginBottom: '10px' }}>
          Daftar Penerima & Status Baca
        </p>
        <div style={{ maxHeight: '220px', overflowY: 'auto', borderRadius: '10px', border: `1px solid ${C.border}` }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: C.bg, position: 'sticky', top: 0 }}>
                {['Nama Karyawan', 'Outlet', 'Jabatan', 'Status', 'Dibaca Pada'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', color: C.cyan, fontWeight: 700, textAlign: 'left', borderBottom: `1px solid ${C.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bcReceipts.map((r, i) => (
                <tr key={r.id} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 ? 'rgba(238,238,238,0.015)' : 'transparent' }}>
                  <td style={{ padding: '9px 12px', color: C.text, fontWeight: 600 }}>{capitalEachWord(r.employee_name)}</td>
                  <td style={{ padding: '9px 12px', color: C.muted, fontSize: '0.8rem' }}>{capitalEachWord(r.outlet)}</td>
                  <td style={{ padding: '9px 12px', color: C.muted, fontSize: '0.8rem' }}>{capitalEachWord(r.jabatan)}</td>
                  <td style={{ padding: '9px 12px' }}>
                    {r.status === 'read'
                      ? <Chip label="✅ Dibaca" color={C.success} bg="rgba(78,205,196,0.1)" border="rgba(78,205,196,0.3)" />
                      : <Chip label="📬 Belum" color={C.muted} bg="rgba(158,168,179,0.1)" border="rgba(158,168,179,0.2)" />}
                  </td>
                  <td style={{ padding: '9px 12px', color: C.muted, fontSize: '0.76rem' }}>
                    {r.read_at ? fmtDate(r.read_at) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ─── MODAL KONFIRMASI KIRIM (Interceptor Guard) ───────────────────────────────
const InterceptorGuard = ({ isOpen, judul, targetCount, kategori, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  const cfg = KATEGORI_CONFIG[kategori] || KATEGORI_CONFIG['Info Umum'];
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)',
      zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(10px)',
    }}>
      <div style={{
        background: C.surface, borderRadius: '20px',
        border: `2px solid ${cfg.border}`,
        padding: '40px 36px', width: '480px', maxWidth: '94vw',
        boxShadow: `0 0 80px ${cfg.color}25`,
        animation: 'guardSlideIn 0.25s ease forwards',
      }}>
        {/* Icon */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '64px', height: '64px', borderRadius: '50%',
            background: cfg.bg, border: `2px solid ${cfg.border}`,
            fontSize: '2rem',
          }}>{cfg.icon}</div>
        </div>

        <h2 style={{ color: cfg.color, textAlign: 'center', fontSize: '1.15rem', fontWeight: 800, marginBottom: '12px' }}>
          Konfirmasi Siaran Real-Time
        </h2>

        <div style={{
          background: C.bg, borderRadius: '12px', padding: '16px 20px',
          border: `1px solid ${C.border}`, marginBottom: '20px',
        }}>
          <p style={{ color: C.muted, fontSize: '0.78rem', marginBottom: '4px' }}>Judul Siaran</p>
          <p style={{ color: C.text, fontWeight: 700, fontSize: '0.95rem' }}>{judul}</p>
        </div>

        <p style={{ color: C.muted, textAlign: 'center', fontSize: '0.88rem', lineHeight: '1.65', marginBottom: '28px' }}>
          Apakah Anda yakin ingin mengirimkan siaran ini secara{' '}
          <strong style={{ color: cfg.color }}>real-time</strong> ke HP{' '}
          <strong style={{ color: C.text }}>{targetCount} karyawan</strong> yang ditargetkan?
          <br /><br />
          <span style={{ color: C.danger, fontSize: '0.8rem' }}>⚠️ Tindakan ini tidak dapat dibatalkan setelah dikirim.</span>
        </p>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button type="button" onClick={onCancel}
            style={{
              flex: 1, padding: '12px', borderRadius: '10px', border: `1px solid ${C.border}`,
              background: 'transparent', color: C.muted, fontWeight: 700, cursor: 'pointer', fontSize: '0.88rem',
            }}>
            CANCEL
          </button>
          <button type="button" onClick={onConfirm}
            style={{
              flex: 1, padding: '12px', borderRadius: '10px', border: 'none',
              background: `linear-gradient(135deg, ${cfg.color}, ${cfg.color}cc)`,
              color: '#fff', fontWeight: 800, cursor: 'pointer', fontSize: '0.88rem',
              boxShadow: `0 4px 18px ${cfg.color}44`,
            }}>
            🚀 OK, SIARKAN!
          </button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function BroadcastUtama() {
  const { activeEmployees, dispatch: hrisDispatch } = useHRIS();

  const getApiUrl = () => {
    return `${window.location.protocol}//${window.location.host}/api`;
  };

  const [isSendingEvent, setIsSendingEvent] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  // ── State Data
  const [broadcasts, setBroadcasts] = useState(() => lsGet('hris_broadcasts', []));
  const [receipts, setReceipts] = useState(() => lsGet('hris_broadcast_receipts', []));

  // ── Form State
  const [judul, setJudul] = useState('');
  const [kategori, setKategori] = useState('Info Umum');
  const [targetOutlets, setTargetOutlets] = useState([]);
  const [targetJabatan, setTargetJabatan] = useState([]);
  const [pesan, setPesan] = useState('');
  const [charCount, setCharCount] = useState(0);

  // ── UI State
  const [showGuard, setShowGuard] = useState(false);
  const [showDetail, setShowDetail] = useState(null); // broadcast object
  const [searchQ, setSearchQ] = useState('');
  const [filterKategori, setFilterKategori] = useState('Semua');
  const [delConfirm, setDelConfirm] = useState(null); // broadcast id

  // ── Derived options
  const allOutlets = [...new Set(activeEmployees.map(e => e.outlet).filter(Boolean))].sort();
  const allJabatan = [...new Set(activeEmployees.map(e => e.position).filter(Boolean))].sort();

  // ── Listen storage changes
  useEffect(() => {
    const h = (e) => {
      if (e.detail?.key === 'hris_broadcasts') setBroadcasts(lsGet('hris_broadcasts', []));
      if (e.detail?.key === 'hris_broadcast_receipts') setReceipts(lsGet('hris_broadcast_receipts', []));
    };
    window.addEventListener('hris:storage', h);
    return () => window.removeEventListener('hris:storage', h);
  }, []);

  // ── Hitung target karyawan berdasarkan filter
  const computeTargets = useCallback(() => {
    let emps = activeEmployees;
    if (targetOutlets.length > 0) emps = emps.filter(e => targetOutlets.includes(e.outlet));
    if (targetJabatan.length > 0) emps = emps.filter(e => targetJabatan.includes(e.position));
    return emps;
  }, [activeEmployees, targetOutlets, targetJabatan]);

  const targetEmps = computeTargets();

  // ── Validasi form
  const isFormValid = judul.trim().length > 0 && pesan.trim().length > 0;

  // ── Klik Siarkan → buka interceptor guard
  const handleSiarkan = (e) => {
    e.preventDefault();
    if (!isFormValid) return;
    if (targetEmps.length === 0) {
      alert('Tidak ada karyawan yang sesuai dengan filter target yang dipilih. Pastikan ada karyawan aktif di outlet/jabatan yang dipilih.');
      return;
    }
    setShowGuard(true);
  };

  // ── Konfirmasi kirim
  const handleConfirmSend = useCallback(async () => {
    setShowGuard(false);
    setIsSendingEvent(true);

    const now = new Date().toISOString();
    const bcId = uid();
    const judulFormatted = capitalEachWord(judul.trim());
    const sender = 'Admin Super'; // TODO: dari auth user

    // Buat broadcast entry
    const newBc = {
      id: bcId,
      judul: judulFormatted,
      kategori,
      target_outlets: targetOutlets.length > 0 ? targetOutlets.map(capitalEachWord) : ['Semua Outlet'],
      target_jabatan: targetJabatan.length > 0 ? targetJabatan.map(capitalEachWord) : ['Semua Jabatan'],
      pesan: pesan.trim(),
      created_at: now,
      sender,
      total_target: targetEmps.length,
    };

    // Buat receipt entries (semua unread)
    const newReceipts = targetEmps.map(emp => ({
      id: uid(),
      broadcast_id: bcId,
      employee_id: emp.id,
      employee_name: capitalEachWord(emp.full_name || emp.nama || ''),
      outlet: capitalEachWord(emp.outlet || ''),
      jabatan: capitalEachWord(emp.position || ''),
      status: 'unread',
      sent_at: now,
      read_at: null,
    }));

    const performLocalFallback = () => {
      const updatedBc = [newBc, ...broadcasts];
      const updatedReceipts = [...receipts, ...newReceipts];
      lsSet('hris_broadcasts', updatedBc);
      lsSet('hris_broadcast_receipts', updatedReceipts);

      const existingNotifs = lsGet('hris_notifications', []);
      const notifEntries = targetEmps.map(emp => ({
        id: uid(),
        type: 'broadcast',
        broadcast_id: bcId,
        employee_id: emp.id,
        employee_name: capitalEachWord(emp.full_name || emp.nama || ''),
        outlet: capitalEachWord(emp.outlet || ''),
        judul: judulFormatted,
        kategori,
        pesan: pesan.trim(),
        status: 'unread',
        sent_at: now,
        read_at: null,
      }));
      lsSet('hris_notifications', [...existingNotifs, ...notifEntries]);

      setBroadcasts(updatedBc);
      setReceipts(updatedReceipts);
      hrisDispatch('BROADCAST_SENT');
    };

    // Dispatch event to server
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);

    try {
      const response = await fetch(`${getApiUrl()}/v1/dispatch-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'broadcast',
          targetOutlet: targetOutlets.length > 0 ? targetOutlets.map(capitalEachWord).join(', ') : 'Semua Outlet',
          targetJabatan: targetJabatan.length > 0 ? targetJabatan.map(capitalEachWord).join(', ') : 'Semua Jabatan',
          messageTitle: judulFormatted,
          content: pesan.trim()
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        performLocalFallback();
      } else {
        throw new Error('Server returned error status');
      }
    } catch (err) {
      console.warn('Real-time dispatcher failed or timed out. Falling back to local storage sync.', err);
      performLocalFallback();
    } finally {
      setIsSendingEvent(false);
      // Auto-clear form
      setJudul('');
      setKategori('Info Umum');
      setTargetOutlets([]);
      setTargetJabatan([]);
      setPesan('');
      setCharCount(0);
    }
  }, [judul, kategori, targetOutlets, targetJabatan, pesan, targetEmps, broadcasts, receipts, hrisDispatch]);

  // ── Hapus siaran
  const handleDelete = (bcId) => {
    const updatedBc = broadcasts.filter(b => b.id !== bcId);
    const updatedRec = receipts.filter(r => r.broadcast_id !== bcId);
    lsSet('hris_broadcasts', updatedBc);
    lsSet('hris_broadcast_receipts', updatedRec);
    setBroadcasts(updatedBc);
    setReceipts(updatedRec);
    setDelConfirm(null);
    hrisDispatch('BROADCAST_SENT');
  };

  // ── Simulasi: karyawan membaca
  const simulateReadAll = (bcId) => {
    const now = new Date().toISOString();
    const updated = receipts.map(r =>
      r.broadcast_id === bcId ? { ...r, status: 'read', read_at: now } : r
    );
    lsSet('hris_broadcast_receipts', updated);
    setReceipts(updated);
    hrisDispatch('BROADCAST_SENT');
  };

  // ── Stats
  const totalBc = broadcasts.length;
  const totalDarurat = broadcasts.filter(b => b.kategori === 'Penting / Darurat').length;
  const totalRead = receipts.filter(r => r.status === 'read').length;
  const totalUnread = receipts.filter(r => r.status === 'unread').length;

  // ── Filter tabel
  const filteredBc = broadcasts.filter(b => {
    const matchSearch = !searchQ || b.judul.toLowerCase().includes(searchQ.toLowerCase()) ||
      b.pesan.toLowerCase().includes(searchQ.toLowerCase());
    const matchKategori = filterKategori === 'Semua' || b.kategori === filterKategori;
    return matchSearch && matchKategori;
  });

  // ── Get read count per broadcast
  const getReadCount = (bcId) => receipts.filter(r => r.broadcast_id === bcId && r.status === 'read').length;

  // ── PDF Export
  const handleExportPDF = () => {
    setIsExportingPDF(true);
    setTimeout(() => {
      try {
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

        // Full B&W header block
        doc.setFillColor(0, 0, 0);
        doc.rect(0, 0, 297, 38, 'F');

        // Header
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(capitalEachWord('LAPORAN RIWAYAT SIARAN BROADCAST'), 14, 14);

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(180, 180, 180);
        doc.text(capitalEachWord(`HRIS Barokah Grup - Global Broadcast & Push Notification Command Center`), 14, 22);
        doc.text(capitalEachWord(`Dicetak: ${new Date().toLocaleString('id-ID')} | Total Siaran: ${broadcasts.length}`), 14, 28);

        const tableData = broadcasts.map(bc => {
          const readCnt = getReadCount(bc.id);
          const pct = bc.total_target > 0 ? Math.round(readCnt / bc.total_target * 100) : 0;
          return [
            fmtDate(bc.created_at),
            capitalEachWord(bc.judul),
            capitalEachWord(bc.kategori),
            capitalEachWord(bc.target_outlets?.join(', ') || 'Semua'),
            capitalEachWord(bc.target_jabatan?.join(', ') || 'Semua'),
            `${pct}% (${readCnt}/${bc.total_target})`,
          ];
        });

        autoTable(doc, {
          startY: 42,
          head: [[capitalEachWord('Tanggal & Jam'), capitalEachWord('Judul Siaran'), capitalEachWord('Kategori'), capitalEachWord('Target Outlet'), capitalEachWord('Target Jabatan'), capitalEachWord('Keterbacaan')]],
          body: tableData,
          theme: 'grid',
          styles: { fontSize: 8, cellPadding: 3 },
          headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
          columnStyles: {
            0: { cellWidth: 38 },
            5: { halign: 'center' },
          },
        });

        doc.save(`Laporan_Broadcast_${new Date().toISOString().slice(0, 10)}.pdf`);
      } catch (err) {
        console.error('PDF generation error:', err);
      } finally {
        setIsExportingPDF(false);
        // Auto-cleanup: reset filters
        setSearchQ('');
        setFilterKategori('Semua');
      }
    }, 200);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif", background: C.bg, minHeight: '100vh', color: C.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        @keyframes guardSlideIn {
          from { opacity: 0; transform: scale(0.93) translateY(12px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes bcFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseGlow {
          0%,100% { box-shadow: 0 0 14px rgba(0,173,181,0.3); }
          50%      { box-shadow: 0 0 32px rgba(0,173,181,0.6); }
        }
        .bc-anim { animation: bcFadeIn 0.3s ease forwards; }
        .bc-row:hover td { background: rgba(0,173,181,0.04) !important; }
        .bc-btn:hover { opacity: 0.85; }
        textarea:focus, input:focus, select:focus { outline: none; border-color: #00ADB5 !important; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #393E46; border-radius: 4px; }
      `}</style>

      {/* ═══ HEADER ═══ */}
      <div style={{
        background: `linear-gradient(135deg, ${C.surface} 0%, #252B32 100%)`,
        borderBottom: `1px solid ${C.border}`, padding: '28px 32px 22px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Decorative glow orbs */}
        <div style={{ position: 'absolute', top: '-60px', right: '-60px', width: '240px', height: '240px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,173,181,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-40px', left: '-40px', width: '160px', height: '160px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(224,92,92,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              background: 'linear-gradient(135deg, #00ADB5, #007a80)',
              borderRadius: '16px', width: '56px', height: '56px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'pulseGlow 3s ease infinite',
              boxShadow: '0 4px 20px rgba(0,173,181,0.4)',
            }}>
              <Radio size={28} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontSize: '1.55rem', fontWeight: 800, color: C.text, lineHeight: 1.2 }}>
                Broadcast & Notifikasi
              </h1>
              <p style={{ color: C.muted, fontSize: '0.84rem', marginTop: '4px' }}>
                Global Push Notification Command Center — Barokah Grup
              </p>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {[
              { icon: <Radio size={16} />, label: 'Total Siaran', val: totalBc, color: C.cyan },
              { icon: <AlertTriangle size={16} />, label: 'Darurat', val: totalDarurat, color: C.danger },
              { icon: <CheckCircle size={16} />, label: 'Telah Dibaca', val: totalRead, color: C.success },
              { icon: <Bell size={16} />, label: 'Belum Dibaca', val: totalUnread, color: C.warn },
            ].map(s => (
              <div key={s.label} style={{
                background: C.bg, border: `1px solid ${s.color}33`,
                borderRadius: '12px', padding: '10px 16px',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                <span style={{ color: s.color }}>{s.icon}</span>
                <div>
                  <p style={{ color: C.muted, fontSize: '0.68rem' }}>{s.label}</p>
                  <p style={{ color: s.color, fontWeight: 800, fontSize: '1.05rem' }}>{s.val}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: '28px' }}>

        {/* ═══ FORM SIARAN ═══ */}
        <form onSubmit={handleSiarkan} className="bc-anim">
          <div style={{
            background: C.surface, borderRadius: '20px',
            border: `1px solid ${C.border}`, overflow: 'hidden',
          }}>
            {/* Form Header */}
            <div style={{
              padding: '20px 28px 16px',
              borderBottom: `1px solid ${C.border}`,
              background: 'rgba(238,238,238,0.02)',
              display: 'flex', alignItems: 'center', gap: '10px',
            }}>
              <Zap size={18} color={C.cyan} />
              <h2 style={{ fontSize: '1rem', fontWeight: 800, color: C.text }}>
                Form Siaran Pintar
              </h2>
              <Chip label={`${targetEmps.length} Karyawan Akan Menerima`}
                color={targetEmps.length > 0 ? C.cyan : C.muted}
                bg={targetEmps.length > 0 ? C.cyanDim : 'rgba(158,168,179,0.1)'}
                border={targetEmps.length > 0 ? C.cyanBorder : 'rgba(158,168,179,0.2)'}
              />
            </div>

            <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Row 1: Judul + Kategori */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: C.muted, marginBottom: '6px' }}>
                    Judul Siaran <span style={{ color: C.danger }}>*</span>
                    <span style={{ color: C.cyan, fontWeight: 400, marginLeft: '6px', fontSize: '0.74rem' }}>
                      (otomatis Capital Each Word)
                    </span>
                  </label>
                  <input type="text" value={judul}
                    onChange={e => setJudul(e.target.value)}
                    placeholder="Contoh: Perubahan Jadwal Operasional Bulan Juli 2026"
                    required
                    style={{
                      width: '100%', background: C.bg, border: `1px solid ${C.border}`,
                      borderRadius: '10px', padding: '11px 14px', color: C.text,
                      fontSize: '0.9rem', boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: C.muted, marginBottom: '6px' }}>
                    Kategori Pengumuman
                  </label>
                  <select value={kategori} onChange={e => setKategori(e.target.value)}
                    style={{
                      width: '100%', background: C.bg,
                      border: `1px solid ${KATEGORI_CONFIG[kategori]?.border || C.border}`,
                      borderRadius: '10px', padding: '11px 14px',
                      color: KATEGORI_CONFIG[kategori]?.color || C.text,
                      fontSize: '0.88rem', cursor: 'pointer', fontWeight: 700,
                    }}>
                    {KATEGORI_LIST.map(k => (
                      <option key={k} value={k} style={{ background: C.surface, color: C.text, fontWeight: 700 }}>
                        {KATEGORI_CONFIG[k].icon} {k}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2: Target Outlet + Target Jabatan */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <MultiSelect
                  label="Target Cabang / Outlet (Multi-Select)"
                  options={allOutlets}
                  selected={targetOutlets}
                  onChange={setTargetOutlets}
                  placeholder="Semua Outlet (Default)"
                />
                <MultiSelect
                  label="Target Jabatan (Multi-Select)"
                  options={allJabatan}
                  selected={targetJabatan}
                  onChange={setTargetJabatan}
                  placeholder="Semua Jabatan (Default)"
                />
              </div>

              {/* Chips preview target */}
              {(targetOutlets.length > 0 || targetJabatan.length > 0) && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', padding: '12px 16px', background: C.bg, borderRadius: '10px', border: `1px solid ${C.border}` }}>
                  <span style={{ color: C.muted, fontSize: '0.76rem', alignSelf: 'center', marginRight: '4px' }}>Target:</span>
                  {targetOutlets.map(o => (
                    <Chip key={o} label={`🏪 ${capitalEachWord(o)}`} onRemove={() => setTargetOutlets(p => p.filter(x => x !== o))} />
                  ))}
                  {targetJabatan.map(j => (
                    <Chip key={j} label={`👤 ${capitalEachWord(j)}`} color={C.warn} bg={C.warnDim} border="rgba(245,166,35,0.3)" onRemove={() => setTargetJabatan(p => p.filter(x => x !== j))} />
                  ))}
                </div>
              )}

              {/* Row 3: Textarea pesan */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: C.muted }}>
                    Isi Pesan / Informasi <span style={{ color: C.danger }}>*</span>
                  </label>
                  <span style={{ fontSize: '0.74rem', color: charCount > 800 ? C.danger : C.muted }}>
                    {charCount} karakter
                  </span>
                </div>
                <textarea value={pesan}
                  onChange={e => { setPesan(e.target.value); setCharCount(e.target.value.length); }}
                  placeholder="Tuliskan detail pengumuman, arahan operasional, atau informasi penting yang perlu diketahui seluruh karyawan yang ditargetkan..."
                  required
                  rows={6}
                  style={{
                    width: '100%', background: C.bg, border: `1px solid ${C.border}`,
                    borderRadius: '10px', padding: '12px 14px', color: C.text,
                    fontSize: '0.88rem', resize: 'vertical', lineHeight: '1.6',
                    boxSizing: 'border-box', minHeight: '120px',
                  }}
                />
              </div>

              {/* Action Bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', paddingTop: '4px' }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {targetEmps.length > 0 && (
                    <Chip
                      label={`🎯 ${targetEmps.length} Karyawan Akan Menerima Siaran`}
                      color={C.success} bg="rgba(78,205,196,0.1)" border="rgba(78,205,196,0.3)"
                    />
                  )}
                  {targetEmps.length === 0 && activeEmployees.length > 0 && (
                    <Chip label="⚠️ Tidak ada karyawan sesuai filter" color={C.danger} bg={C.dangerDim} border={C.dangerBorder} />
                  )}
                </div>
                <button type="submit" disabled={!isFormValid || targetEmps.length === 0}
                  className="bc-btn"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '9px',
                    padding: '12px 28px', borderRadius: '12px', border: 'none',
                    background: isFormValid && targetEmps.length > 0
                      ? `linear-gradient(135deg, ${C.cyan}, #008c94)`
                      : 'rgba(238,238,238,0.1)',
                    color: isFormValid && targetEmps.length > 0 ? '#fff' : C.muted,
                    fontWeight: 800, fontSize: '0.9rem', cursor: isFormValid && targetEmps.length > 0 ? 'pointer' : 'not-allowed',
                    boxShadow: isFormValid && targetEmps.length > 0 ? '0 4px 20px rgba(0,173,181,0.4)' : 'none',
                    transition: 'all 0.2s ease',
                  }}>
                  <Send size={17} /> 🚀 Siarkan Informasi
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* ═══ TABEL RIWAYAT SIARAN ═══ */}
        <div className="bc-anim" style={{ animationDelay: '0.1s' }}>
          {/* Table Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: C.text }}>
                Riwayat Siaran & Real-Time Read Tracker
              </h2>
              <p style={{ color: C.muted, fontSize: '0.8rem', marginTop: '2px' }}>
                {broadcasts.length} siaran terdokumentasi · tracker baca diperbarui otomatis
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {/* Search */}
              <div style={{ position: 'relative' }}>
                <input type="text" placeholder="Cari judul atau pesan..." value={searchQ}
                  onChange={e => setSearchQ(e.target.value)}
                  style={{
                    background: C.surface, border: `1px solid ${C.border}`, borderRadius: '10px',
                    padding: '9px 14px 9px 36px', color: C.text, fontSize: '0.84rem', width: '220px',
                  }}
                />
                <Filter size={14} color={C.muted} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              </div>
              {/* Filter kategori */}
              <select value={filterKategori} onChange={e => setFilterKategori(e.target.value)}
                style={{
                  background: C.surface, border: `1px solid ${C.border}`, borderRadius: '10px',
                  padding: '9px 14px', color: C.text, fontSize: '0.84rem', cursor: 'pointer',
                }}>
                <option value="Semua">Semua Kategori</option>
                {KATEGORI_LIST.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
              {/* PDF Button */}
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

          {/* Table */}
          {filteredBc.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '80px 20px',
              background: C.surface, borderRadius: '16px', border: `1px dashed ${C.border}`,
            }}>
              <Inbox size={48} color={C.muted} style={{ marginBottom: '14px' }} />
              <p style={{ color: C.text, fontWeight: 700, marginBottom: '6px' }}>
                {broadcasts.length === 0 ? 'Belum Ada Siaran' : 'Tidak Ada Siaran Sesuai Filter'}
              </p>
              <p style={{ color: C.muted, fontSize: '0.84rem' }}>
                {broadcasts.length === 0 ? 'Gunakan form di atas untuk membuat siaran pertama Anda.' : 'Coba ubah filter pencarian.'}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto', borderRadius: '16px', border: `1px solid ${C.border}` }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ background: C.surface }}>
                    {['Tanggal & Jam', 'Judul Siaran', 'Kategori', 'Target Outlet / Jabatan', 'Persentase Keterbacaan', 'Aksi'].map(h => (
                      <th key={h} style={{
                        padding: '13px 16px', color: C.cyan, fontWeight: 700,
                        textAlign: 'left', borderBottom: `1px solid ${C.border}`,
                        whiteSpace: 'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredBc.map((bc, i) => {
                    const cfg = KATEGORI_CONFIG[bc.kategori] || KATEGORI_CONFIG['Info Umum'];
                    const isDarurat = bc.kategori === 'Penting / Darurat';
                    const readCnt = getReadCount(bc.id);
                    return (
                      <tr key={bc.id} className="bc-row"
                        style={{
                          borderBottom: `1px solid ${C.border}`,
                          boxShadow: isDarurat ? `inset 2px 0 0 ${C.danger}` : 'none',
                          background: isDarurat ? 'rgba(224,92,92,0.03)' : 'transparent',
                          transition: 'background 0.15s',
                        }}>
                        {/* Tanggal */}
                        <td style={{ padding: '14px 16px', color: C.muted, fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Clock size={12} />
                            {fmtDate(bc.created_at)}
                          </div>
                        </td>
                        {/* Judul */}
                        <td style={{ padding: '14px 16px', maxWidth: '240px' }}>
                          <p style={{ color: C.text, fontWeight: 700, marginBottom: '3px', lineHeight: '1.4' }}>
                            {bc.judul}
                          </p>
                          <p style={{ color: C.muted, fontSize: '0.76rem', lineHeight: '1.4',
                            overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                            {bc.pesan}
                          </p>
                        </td>
                        {/* Kategori */}
                        <td style={{ padding: '14px 16px' }}>
                          <Chip label={`${cfg.icon} ${cfg.badge}`} color={cfg.color} bg={cfg.bg} border={cfg.border} />
                        </td>
                        {/* Target */}
                        <td style={{ padding: '14px 16px', maxWidth: '200px' }}>
                          <p style={{ color: C.muted, fontSize: '0.78rem', marginBottom: '3px' }}>
                            🏪 {bc.target_outlets?.join(' · ') || 'Semua Outlet'}
                          </p>
                          <p style={{ color: C.muted, fontSize: '0.78rem' }}>
                            👤 {bc.target_jabatan?.join(' · ') || 'Semua Jabatan'}
                          </p>
                        </td>
                        {/* Read Receipt */}
                        <td style={{ padding: '14px 16px' }}>
                          <ReadBar total={bc.total_target} read={readCnt} />
                        </td>
                        {/* Aksi */}
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
                            <button type="button" className="bc-btn"
                              onClick={() => setShowDetail(bc)}
                              title="Lihat Detail"
                              style={{
                                background: C.cyanDim, border: `1px solid ${C.cyanBorder}`,
                                borderRadius: '8px', padding: '7px 11px', color: C.cyan,
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px',
                                fontSize: '0.76rem', fontWeight: 700, transition: 'all 0.15s',
                              }}>
                              <Eye size={13} /> Detail
                            </button>
                            <button type="button" className="bc-btn"
                              onClick={() => simulateReadAll(bc.id)}
                              title="Simulasi: Semua Sudah Baca"
                              style={{
                                background: 'rgba(78,205,196,0.1)', border: '1px solid rgba(78,205,196,0.3)',
                                borderRadius: '8px', padding: '7px 11px', color: C.success,
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px',
                                fontSize: '0.76rem', fontWeight: 700, transition: 'all 0.15s',
                              }}>
                              <CheckCircle size={13} /> Sim.Baca
                            </button>
                            <button type="button" className="bc-btn"
                              onClick={() => setDelConfirm(bc.id)}
                              title="Hapus Siaran"
                              style={{
                                background: C.dangerDim, border: `1px solid ${C.dangerBorder}`,
                                borderRadius: '8px', padding: '7px 9px', color: C.danger,
                                cursor: 'pointer', display: 'flex', alignItems: 'center',
                                transition: 'all 0.15s',
                              }}>
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div style={{ textAlign: 'center', paddingBottom: '8px' }}>
          <p style={{ color: C.muted, fontSize: '0.75rem' }}>
            🔄 Sistem membaca sinyal balik dari HP karyawan secara otomatis via localStorage sync · 
            Klik "Sim.Baca" untuk mensimulasikan respons karyawan membaca siaran
          </p>
        </div>
      </div>

      {/* ═══ MODALS ═══ */}

      {/* Interceptor Guard */}
      <InterceptorGuard
        isOpen={showGuard}
        judul={capitalEachWord(judul)}
        targetCount={targetEmps.length}
        kategori={kategori}
        onConfirm={handleConfirmSend}
        onCancel={() => setShowGuard(false)}
      />

      {/* Detail Modal */}
      <DetailModal
        bc={showDetail}
        receipts={receipts}
        onClose={() => setShowDetail(null)}
      />

      {/* Delete Confirm */}
      {delConfirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)',
          zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(6px)',
        }}>
          <div style={{
            background: C.surface, borderRadius: '16px',
            border: `1px solid ${C.dangerBorder}`, padding: '32px',
            width: '420px', maxWidth: '90vw',
            boxShadow: `0 0 40px rgba(224,92,92,0.2)`,
          }}>
            <h3 style={{ color: C.danger, marginBottom: '12px', fontSize: '1.05rem' }}>Hapus Siaran</h3>
            <p style={{ color: C.muted, marginBottom: '28px', lineHeight: '1.6', fontSize: '0.88rem' }}>
              Yakin ingin menghapus siaran ini? Semua log dan data keterbacaan terkait juga akan dihapus permanen.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setDelConfirm(null)}
                style={{ padding: '10px 20px', borderRadius: '10px', border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, fontWeight: 700, cursor: 'pointer', fontSize: '0.86rem' }}>
                Batal
              </button>
              <button onClick={() => handleDelete(delConfirm)}
                style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: C.danger, color: '#fff', fontWeight: 800, cursor: 'pointer', fontSize: '0.86rem' }}>
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
      {isSendingEvent && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(2, 4, 10, 0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999999,
          pointerEvents: 'all'
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px' }}>
            <svg width="100%" height="4" style={{ display: 'block', overflow: 'visible' }}>
              <line x1="0" y1="2" x2="100%" y2="2" stroke="#00ADB5" strokeWidth="4" strokeDasharray="20 12" style={{ animation: 'marchingAnts 0.3s linear infinite' }} />
            </svg>
          </div>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '4px' }}>
            <svg width="100%" height="4" style={{ display: 'block', overflow: 'visible' }}>
              <line x1="0" y1="2" x2="100%" y2="2" stroke="#00ADB5" strokeWidth="4" strokeDasharray="20 12" style={{ animation: 'marchingAnts 0.3s linear infinite reverse' }} />
            </svg>
          </div>
          <div style={{
            border: '1px solid #00ADB5',
            padding: '24px 36px',
            borderRadius: '12px',
            backgroundColor: '#1E222B',
            textAlign: 'center',
            boxShadow: '0 0 30px rgba(0, 173, 181, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '15px'
          }}>
            <div style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              border: '3px solid rgba(0,173,181,0.2)',
              borderTopColor: '#00ADB5',
              animation: 'spin 0.8s linear infinite'
            }} />
            <span style={{ color: '#00ADB5', fontWeight: 'bold' }}>
              Menghubungkan & Mengirimkan Sinyal Siaran Real-Time...
            </span>
          </div>
        </div>
      )}
      <PDFCompileOverlay isOpen={isExportingPDF} />
    </div>
  );
}

/**
 * TrainingPage.jsx — Training Program & Competency Development Module
 * ====================================================================
 * HRIS Barokah Grup — Sistem Tiga Tab Otonom
 * Palet: #222831 (bg) | #393E46 (surface) | #00ADB5 (cyan) | #EEEEEE (text)
 * Tab 1: Jadwal Training | Tab 2: Hasil Training | Tab 3: Materi Training
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  BookOpen, Plus, Edit2, Trash2, Calendar, Users, Clock,
  CheckCircle, Award, Upload, FileText, Video, Image,
  Download, Eye, X, ChevronDown, CheckSquare, Square,
  Filter, Inbox, AlertTriangle, BarChart2, Link2,
  GraduationCap, Target, Star, RefreshCw, Zap, FolderOpen
} from 'lucide-react';
import { useHRIS } from '../context/HRISContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import PDFCompileOverlay from './PDFCompileOverlay';

// ─── Palet ───────────────────────────────────────────────────────────────────
const C = {
  bg:          'var(--bg-main)',
  surface:     'var(--bg-card)',
  cyan:        'var(--accent-primary)',
  cyanDim:     'var(--primary-glow)',
  cyanBorder:  'var(--border-color)',
  text:        'var(--text-main)',
  muted:       'var(--text-muted)',
  border:      'var(--border-color)',
  danger:      'var(--danger)',
  dangerDim:   'var(--danger-glow)',
  dangerBorder:'var(--border-color)',
  success:     'var(--success)',
  warn:        'var(--warning)',
  warnDim:     'var(--warning-glow)',
  warnBorder:  'var(--border-color)',
};

// ─── Inline Custom Brand Icons ───────────────────────────────────────────────
const InstagramIcon = ({ size = 22, color = '#E1306C' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
  </svg>
);

const TiktokIcon = ({ size = 22, color = 'var(--accent-primary)' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
  </svg>
);

// ─── Utils ───────────────────────────────────────────────────────────────────
const cap = (s = '') => String(s).replace(/\b\w/g, c => c.toUpperCase());
const uid = () => `TR-${Date.now()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
const lsGet = (k, fb) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e) { console.error(e); } };

const fmtDT = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' })
    + ' ' + d.toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' });
};
const fmtDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' });
};

const getYouTubeId = (url) => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

const getTrainingStatus = (tgl) => {
  if (!tgl) return { label:'Draft', color: C.muted, bg:'rgba(158,168,179,0.1)' };
  const now = new Date();
  const d = new Date(tgl);
  const diff = (d - now) / (1000*60*60*24);
  if (diff > 1)    return { label:'Akan Datang', color: C.cyan,    bg: C.cyanDim };
  if (diff >= -1)  return { label:'Sedang Berjalan', color: C.warn, bg: C.warnDim };
  return            { label:'Selesai',      color: C.success, bg:'rgba(78,205,196,0.12)' };
};

const FILTER_LS_KEY = 'hris_training_filters';

// ─── Micro Components ────────────────────────────────────────────────────────
const Badge = ({ label, color=C.cyan, bg=C.cyanDim, border }) => (
  <span style={{
    display:'inline-block', padding:'3px 10px', borderRadius:'20px',
    fontSize:'0.72rem', fontWeight:700, color, background:bg,
    border:`1px solid ${border || 'var(--border-color)'}`,
  }}>{label}</span>
);

const Btn = ({ children, onClick, variant='primary', disabled=false, style={}, type='button' }) => {
  const v = {
    primary:   { background: C.cyan, color: '#222831', border:'none' },
    secondary: { background:'transparent', color: C.text, border:`1px solid ${C.border}` },
    danger:    { background: C.dangerDim, color: C.danger, border:`1px solid ${C.dangerBorder}` },
    ghost:     { background: C.cyanDim,  color: C.cyan,   border:`1px solid ${C.cyanBorder}` },
    black:     { background:'#000000', color:'#FFFFFF', border:'none' },
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{
      display:'flex', alignItems:'center', gap:'7px', padding:'9px 18px',
      borderRadius:'10px', fontWeight:700, fontSize:'0.84rem',
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1,
      transition:'all 0.18s ease', ...v[variant], ...style,
    }}>{children}</button>
  );
};

const FInput = ({ label, value, onChange, type='text', placeholder, required, rows, style={} }) => {
  const isTA = type === 'textarea';
  const El = isTA ? 'textarea' : 'input';
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
      {label && <label style={{ fontSize:'0.79rem', fontWeight:600, color:C.muted }}>
        {label}{required && <span style={{ color:C.danger }}> *</span>}
      </label>}
      <El type={isTA ? undefined : type} value={value} onChange={onChange}
        required={required} placeholder={placeholder} rows={rows || 4}
        style={{
          background:C.bg, border:`1px solid ${C.border}`, borderRadius:'9px',
          padding:'10px 13px', color:C.text, fontSize:'0.87rem',
          resize: isTA ? 'vertical' : undefined, lineHeight: isTA ? '1.6' : undefined,
          outline:'none', boxSizing:'border-box', width:'100%',
          transition:'border-color 0.18s',
          ...style,
        }}
        onFocus={e => e.target.style.borderColor = C.cyan}
        onBlur={e  => e.target.style.borderColor = 'var(--border-color)'}
      />
    </div>
  );
};

const FSel = ({ label, value, onChange, options=[], style={} }) => (
  <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
    {label && <label style={{ fontSize:'0.79rem', fontWeight:600, color:C.muted }}>{label}</label>}
    <select value={value} onChange={onChange} style={{
      background:C.bg, border:`1px solid ${C.border}`, borderRadius:'9px',
      padding:'10px 13px', color:C.text, fontSize:'0.87rem', cursor:'pointer',
      outline:'none', ...style,
    }}
      onFocus={e => e.target.style.borderColor = C.cyan}
      onBlur={e  => e.target.style.borderColor = 'var(--border-color)'}
    >
      {options.map(o => (
        <option key={o.value ?? o} value={o.value ?? o} style={{ background:C.surface }}>
          {o.label ?? o}
        </option>
      ))}
    </select>
  </div>
);

// ─── Multi-Select Dropdown ───────────────────────────────────────────────────
const MultiSel = ({ label, options, selected, onChange, placeholder='Semua (Default)' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const toggle = v => onChange(selected.includes(v) ? selected.filter(x=>x!==v) : [...selected, v]);
  const all = selected.length === options.length && options.length > 0;
  return (
    <div ref={ref} style={{ position:'relative' }}>
      {label && <label style={{ display:'block', fontSize:'0.79rem', fontWeight:600, color:C.muted, marginBottom:'5px' }}>{label}</label>}
      <button type="button" onClick={() => setOpen(p=>!p)} style={{
        width:'100%', background:C.bg, border:`1px solid ${selected.length ? C.cyanBorder : C.border}`,
        borderRadius:'9px', padding:'10px 13px', color:C.text,
        display:'flex', alignItems:'center', justifyContent:'space-between',
        cursor:'pointer', fontSize:'0.86rem',
      }}>
        <span style={{ color: selected.length ? C.text : C.muted }}>
          {selected.length === 0 ? placeholder : all ? '✅ Semua Dipilih' : `${selected.length} Dipilih`}
        </span>
        <ChevronDown size={14} color={C.muted} style={{ transform: open?'rotate(180deg)':'none', transition:'0.2s' }}/>
      </button>
      {open && (
        <div style={{
          position:'absolute', top:'calc(100% + 4px)', left:0, right:0, zIndex:600,
          background:C.surface, border:`1px solid ${C.cyanBorder}`, borderRadius:'12px',
          overflow:'hidden', boxShadow:'0 12px 40px rgba(0,0,0,0.6)',
        }}>
          <div onClick={() => onChange(all ? [] : [...options])}
            style={{ padding:'10px 13px', display:'flex', alignItems:'center', gap:'8px', cursor:'pointer', borderBottom:`1px solid ${C.border}`, background: all ? C.cyanDim : 'transparent' }}>
            {all ? <CheckSquare size={14} color={C.cyan}/> : <Square size={14} color={C.muted}/>}
            <span style={{ color: all ? C.cyan : C.text, fontWeight:700, fontSize:'0.82rem' }}>
              {all ? 'Batalkan Semua' : 'Pilih Semua'}
            </span>
          </div>
          <div style={{ maxHeight:'200px', overflowY:'auto', padding:'6px' }}>
            {options.map(o => {
              const chk = selected.includes(o);
              return (
                <div key={o} onClick={() => toggle(o)} style={{
                  display:'flex', alignItems:'center', gap:'8px', padding:'8px 10px',
                  borderRadius:'8px', cursor:'pointer', background: chk ? C.cyanDim : 'transparent',
                  transition:'background 0.15s',
                }}>
                  {chk ? <CheckSquare size={13} color={C.cyan}/> : <Square size={13} color={C.muted}/>}
                  <span style={{ color: chk ? C.cyan : C.text, fontSize:'0.83rem' }}>{cap(o)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Confirm Modal ───────────────────────────────────────────────────────────
const ConfirmModal = ({ isOpen, title, msg, onOk, onCancel, danger=false }) => {
  if (!isOpen) return null;
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', zIndex:9998, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(8px)' }}>
      <div style={{ background:C.surface, borderRadius:'18px', border:`1.5px solid ${danger ? C.dangerBorder : C.cyanBorder}`, padding:'34px', width:'440px', maxWidth:'92vw', boxShadow:`0 20px 60px rgba(0,0,0,0.7)` }}>
        <h3 style={{ color: danger ? C.danger : C.cyan, marginBottom:'12px', fontSize:'1.1rem' }}>{title}</h3>
        <p style={{ color:C.muted, marginBottom:'26px', lineHeight:'1.65', fontSize:'0.88rem' }}>{msg}</p>
        <div style={{ display:'flex', gap:'10px', justifyContent:'flex-end' }}>
          <Btn variant="secondary" onClick={onCancel}>Batal</Btn>
          <Btn variant={danger ? 'danger' : 'primary'} onClick={onOk}>{danger ? 'Ya, Hapus' : 'OK, Simpan'}</Btn>
        </div>
      </div>
    </div>
  );
};

// ─── Score Input Modal ───────────────────────────────────────────────────────
const ScoreModal = ({ isOpen, entry, onSave, onClose }) => {
  const [attendance, setAttendance] = useState('');
  const [score, setScore] = useState('');

  useEffect(() => {
    if (entry) {
      setAttendance(entry.attendance ?? '');
      setScore(entry.score ?? '');
    }
  }, [entry]);

  if (!isOpen || !entry) return null;
  const isLulus = Number(score) >= 70;

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.82)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(8px)' }}>
      <div style={{ background:C.surface, borderRadius:'20px', border:`1.5px solid ${C.cyanBorder}`, padding:'34px', width:'460px', maxWidth:'92vw', boxShadow:'0 0 60px rgba(0,173,181,0.2)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px' }}>
          <h3 style={{ color:C.cyan, fontSize:'1.1rem' }}>📝 Input Nilai Evaluasi</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer' }}><X size={20}/></button>
        </div>
        <div style={{ background:C.bg, borderRadius:'10px', padding:'14px 16px', marginBottom:'20px', border:`1px solid ${C.border}` }}>
          <p style={{ color:C.muted, fontSize:'0.75rem' }}>Peserta</p>
          <p style={{ color:C.text, fontWeight:700 }}>{cap(entry.employee_name)}</p>
          <p style={{ color:C.muted, fontSize:'0.78rem' }}>{cap(entry.outlet)} · {cap(entry.training_name)}</p>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:'14px', marginBottom:'22px' }}>
          <FInput label="Nilai Kehadiran (%)" type="number" value={attendance}
            onChange={e => setAttendance(e.target.value)} placeholder="0 - 100" />
          <FInput label="Skor Nilai Akhir (0–100)" type="number" value={score}
            onChange={e => setScore(e.target.value)} placeholder="Misal: 85" />
          {score !== '' && (
            <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'10px 14px', borderRadius:'8px', background: isLulus ? 'rgba(78,205,196,0.1)' : C.dangerDim, border:`1px solid ${isLulus ? 'rgba(78,205,196,0.3)' : C.dangerBorder}` }}>
              {isLulus ? <CheckCircle size={16} color={C.success}/> : <AlertTriangle size={16} color={C.danger}/>}
              <span style={{ color: isLulus ? C.success : C.danger, fontWeight:700, fontSize:'0.84rem' }}>
                {isLulus ? '✅ LULUS — Skor ≥ 70' : '❌ TIDAK LULUS — Skor < 70'}
              </span>
            </div>
          )}
        </div>
        <div style={{ display:'flex', gap:'10px', justifyContent:'flex-end' }}>
          <Btn variant="secondary" onClick={onClose}>Batal</Btn>
          <Btn variant="primary" onClick={() => onSave({ attendance: Number(attendance), score: Number(score), is_lulus: Number(score) >= 70 })}
            disabled={attendance === '' || score === ''}>
            <CheckCircle size={15}/> Simpan & Sinkronisasi KPI
          </Btn>
        </div>
      </div>
    </div>
  );
};

// ─── Material Upload Modal ───────────────────────────────────────────────────
const MaterialModal = ({ isOpen, onSave, onClose, trainingOptions }) => {
  const fileRef = useRef(null);
  const [title, setTitle]         = useState('');
  const [desc, setDesc]           = useState('');
  const [trgId, setTrgId]         = useState('');
  const [linkUrl, setLinkUrl]     = useState('');
  const [fileType, setFileType]   = useState('pdf');
  const [fileName, setFileName]   = useState('');
  const [fileData, setFileData]   = useState(null);

  const reset = () => { setTitle(''); setDesc(''); setTrgId(''); setLinkUrl(''); setFileType('pdf'); setFileName(''); setFileData(null); if (fileRef.current) fileRef.current.value=''; };

  const handleFile = (file) => {
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = e => setFileData(e.target.result);
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.82)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(8px)', padding:'20px' }}>
      <div style={{ background:C.surface, borderRadius:'20px', border:`1.5px solid ${C.cyanBorder}`, padding:'32px', width:'560px', maxWidth:'96vw', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 0 60px rgba(0,173,181,0.15)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px' }}>
          <h3 style={{ color:C.cyan, fontSize:'1.1rem' }}>📁 Tambah Materi Baru</h3>
          <button onClick={() => { reset(); onClose(); }} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer' }}><X size={20}/></button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
          <FInput label="Judul Materi" required value={title} onChange={e=>setTitle(e.target.value)} placeholder="Misal: Modul Higiene Dapur 2026"/>
          <FSel label="Jenis File" value={fileType} onChange={e=>setFileType(e.target.value)}
            options={[
              {value:'pdf',label:'📄 Dokumen PDF'},
              {value:'image',label:'🖼 Gambar / SOP'},
              {value:'video',label:'🎬 Link Video Tutorial'},
              {value:'instagram',label:'📸 Link Instagram'},
              {value:'tiktok',label:'🎵 Link TikTok'},
              {value:'sosmed',label:'🌐 Link Media Sosial Lainnya'}
            ]}/>
          {['video', 'instagram', 'tiktok', 'sosmed'].includes(fileType) ? (
            <FInput
              label={
                fileType === 'video' ? "URL Video (YouTube / Drive)" :
                fileType === 'instagram' ? "Link Instagram (Post / Reel)" :
                fileType === 'tiktok' ? "Link TikTok Video" : "Link Media Sosial Lainnya"
              }
              value={linkUrl}
              onChange={e=>setLinkUrl(e.target.value)}
              placeholder={
                fileType === 'video' ? "https://youtube.com/..." :
                fileType === 'instagram' ? "https://instagram.com/..." :
                fileType === 'tiktok' ? "https://tiktok.com/@..." : "https://..."
              }
            />
          ) : (
            <div>
              <label style={{ display:'block', fontSize:'0.79rem', fontWeight:600, color:C.muted, marginBottom:'6px' }}>Upload File</label>
              <div onClick={() => fileRef.current?.click()}
                style={{ border:`2px dashed ${C.border}`, borderRadius:'12px', padding:'28px', textAlign:'center', cursor:'pointer', background:C.bg, transition:'border-color 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = C.cyan}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(238,238,238,0.1)'}
              >
                <input ref={fileRef} type="file" style={{ display:'none' }}
                  accept={fileType==='pdf' ? '.pdf' : '.jpg,.jpeg,.png,.webp,.svg'}
                  onChange={e => { if(e.target.files[0]) handleFile(e.target.files[0]); }}
                />
                <Upload size={28} color={fileName ? C.cyan : C.muted} style={{ marginBottom:'8px' }}/>
                <p style={{ color: fileName ? C.cyan : C.muted, fontSize:'0.84rem', fontWeight: fileName ? 700 : 400 }}>
                  {fileName || `Klik atau drag file ${fileType === 'pdf' ? 'PDF' : 'Gambar'} di sini`}
                </p>
              </div>
            </div>
          )}
          <FSel label="Tautkan ke Jadwal Training (opsional)" value={trgId} onChange={e=>setTrgId(e.target.value)}
            options={[{value:'',label:'— Tidak Ditautkan —'}, ...trainingOptions.map(t=>({ value:t.id, label:cap(t.judul_pelatihan) }))]}/>
          <FInput label="Deskripsi Singkat" type="textarea" value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Isi singkat / tujuan materi ini..." rows={3}/>
        </div>
        <div style={{ display:'flex', gap:'10px', justifyContent:'flex-end', marginTop:'22px' }}>
          <Btn variant="secondary" onClick={() => { reset(); onClose(); }}>Batal</Btn>
          <Btn variant="primary" disabled={!title.trim() || (['video', 'instagram', 'tiktok', 'sosmed'].includes(fileType) ? !linkUrl.trim() : !fileData)}
            onClick={() => {
              onSave({ title: cap(title.trim()), desc, training_id: trgId, file_type: fileType, file_name: fileName, file_data: fileData, link_url: linkUrl });
              reset(); onClose();
            }}>
            <Upload size={15}/> Upload & Siarkan ke Mobile
          </Btn>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function TrainingPage({ token, API_URL }) {
  const { activeEmployees, dispatch: hrisDispatch } = useHRIS();

  const getApiUrl = () => {
    if (typeof window !== 'undefined' && window.location.hostname.includes('barokahgroupindonesia.tech')) {
      return 'https://api.barokahgroupindonesia.tech/api';
    }
    return `${window.location.protocol}//${window.location.host}/api`;
  };

  const [isSendingEvent, setIsSendingEvent] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  // ── Filters
  const savedFilters = lsGet('filter_training_state', { outlets:[], jabatan:[], bulan:'', tahun:'' });
  const [fOutlets,  setFOutlets]  = useState(savedFilters.outlets || []);
  const [fJabatan,  setFJabatan]  = useState(savedFilters.jabatan || []);
  const [fBulan,    setFBulan]    = useState(savedFilters.bulan   || '');
  const [fTahun,    setFTahun]    = useState(savedFilters.tahun   || '');

  const resetFiltersToDefault = () => {
    setFOutlets([]);
    setFJabatan([]);
    setFBulan('');
    setFTahun('');
    localStorage.setItem('filter_training_state', JSON.stringify({ outlets: [], jabatan: [], bulan: '', tahun: '' }));
    hrisDispatch('TRAINING_SAVED');
  };

  // Simpan filter ke localStorage setiap kali berubah
  useEffect(() => {
    lsSet('filter_training_state', { outlets:fOutlets, jabatan:fJabatan, bulan:fBulan, tahun:fTahun });
  }, [fOutlets, fJabatan, fBulan, fTahun]);

  // ── Data State
  const [trainings,  setTrainings]  = useState(() => lsGet('hris_trainings', []));
  const [results,    setResults]    = useState(() => lsGet('hris_training_results', []));
  const [materials,  setMaterials]  = useState(() => lsGet('hris_training_materials', []));

  // ── Tab State
  const [activeTab, setActiveTab] = useState('jadwal');

  // ── Modal State
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editTarget,        setEditTarget]        = useState(null);
  const [showConfirm,       setShowConfirm]       = useState(false);
  const [pendingForm,       setPendingForm]        = useState(null);
  const [delConfirm,        setDelConfirm]        = useState(null);
  const [showScoreModal,    setShowScoreModal]    = useState(false);
  const [scoreEntry,        setScoreEntry]        = useState(null);
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [showMaterialConfirm, setShowMaterialConfirm] = useState(false);
  const [pendingMaterial, setPendingMaterial] = useState(null);

  // ── Schedule Form
  const [form, setForm] = useState({
    judul_pelatihan:'', deskripsi:'', mentor:'',
    target_outlets:[], target_jabatan:[],
    tanggal_waktu:'',
  });
  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // ── Derived Options
  const allOutlets = [...new Set(activeEmployees.map(e=>e.outlet).filter(Boolean))].sort();
  const allJabatan = [...new Set(activeEmployees.map(e=>e.position).filter(Boolean))].sort();
  const BULAN_LIST = ['','01','02','03','04','05','06','07','08','09','10','11','12'];
  const BULAN_LABEL = { '':'Semua Bulan','01':'Januari','02':'Februari','03':'Maret','04':'April','05':'Mei','06':'Juni','07':'Juli','08':'Agustus','09':'September','10':'Oktober','11':'November','12':'Desember' };
  const currYear = new Date().getFullYear();
  const TAHUN_LIST = ['', ...Array.from({length:5}, (_,i) => String(currYear-2+i))];

  // ── Storage listener
  useEffect(() => {
    const h = (e) => {
      const { key } = e.detail || {};
      if (key === 'hris_trainings')         setTrainings(lsGet('hris_trainings', []));
      if (key === 'hris_training_results')  setResults(lsGet('hris_training_results', []));
      if (key === 'hris_training_materials')setMaterials(lsGet('hris_training_materials', []));
    };
    window.addEventListener('hris:storage', h);
    return () => window.removeEventListener('hris:storage', h);
  }, []);

  // ── Filter logic
  const filterByGlobal = useCallback((list, dateField = 'tanggal_waktu') => {
    return list.filter(item => {
      // outlet filter (pada data training)
      if (fOutlets.length > 0) {
        const tgt = item.target_outlets || [];
        if (!tgt.some(o => fOutlets.includes(o)) && !tgt.includes('Semua Outlet')) return false;
      }
      // jabatan filter
      if (fJabatan.length > 0) {
        const tgtJ = item.target_jabatan || [];
        if (!tgtJ.some(j => fJabatan.includes(j)) && !tgtJ.includes('Semua Jabatan')) return false;
      }
      // bulan / tahun filter
      if (fBulan || fTahun) {
        const dtStr = item[dateField] || item.created_at;
        if (dtStr) {
          const dt = new Date(dtStr);
          if (fBulan && String(dt.getMonth() + 1).padStart(2,'0') !== fBulan) return false;
          if (fTahun && String(dt.getFullYear()) !== fTahun) return false;
        }
      }
      return true;
    });
  }, [fOutlets, fJabatan, fBulan, fTahun]);

  const filteredTrainings = filterByGlobal(trainings);

  // Results & materials — filter by bulan/tahun only (outlet/jabatan via training link)
  const filteredResults   = results.filter(r => {
    if (fBulan && fTahun) {
      const d = new Date(r.date || r.created_at || '');
      if (fBulan && String(d.getMonth()+1).padStart(2,'0') !== fBulan) return false;
      if (fTahun && String(d.getFullYear()) !== fTahun) return false;
    }
    if (fOutlets.length > 0 && !fOutlets.includes(r.outlet)) return false;
    if (fJabatan.length > 0 && !fJabatan.includes(r.jabatan)) return false;
    return true;
  });

  const filteredMaterials = materials.filter(m => {
    if (fBulan || fTahun) {
      const d = new Date(m.created_at || '');
      if (fBulan && String(d.getMonth()+1).padStart(2,'0') !== fBulan) return false;
      if (fTahun && String(d.getFullYear()) !== fTahun) return false;
    }
    return true;
  });

  // ── Save Training
  const handleScheduleSubmit = e => {
    e.preventDefault();
    if (!form.judul_pelatihan.trim() || !form.tanggal_waktu) return;
    setPendingForm({ ...form });
    setShowConfirm(true);
  };

  const executeScheduleSave = useCallback(async () => {
    setShowConfirm(false);
    if (!pendingForm) return;

    setIsSendingEvent(true);
    const now = new Date().toISOString();
    let targetEmps = activeEmployees;
    if (pendingForm.target_outlets.length > 0) targetEmps = targetEmps.filter(e => pendingForm.target_outlets.includes(e.outlet));
    if (pendingForm.target_jabatan.length > 0)  targetEmps = targetEmps.filter(e => pendingForm.target_jabatan.includes(e.position));

    let updated;
    const isNew = !editTarget;
    const targetId = editTarget ? editTarget.id : uid();

    const performLocalSave = () => {
      if (editTarget) {
        updated = trainings.map(t => t.id === editTarget.id ? { ...t, ...pendingForm, judul_pelatihan: cap(pendingForm.judul_pelatihan), mentor: cap(pendingForm.mentor), updated_at: now } : t);
      } else {
        const newT = {
          id: targetId,
          ...pendingForm,
          judul_pelatihan: cap(pendingForm.judul_pelatihan.trim()),
          mentor: cap(pendingForm.mentor.trim()),
          target_outlets: pendingForm.target_outlets.length > 0 ? pendingForm.target_outlets : ['Semua Outlet'],
          target_jabatan: pendingForm.target_jabatan.length > 0 ? pendingForm.target_jabatan : ['Semua Jabatan'],
          total_target: targetEmps.length,
          created_at: now,
        };
        updated = [newT, ...trainings];

        const newResults = targetEmps.map(emp => ({
          id: uid(),
          training_id: newT.id,
          training_name: newT.judul_pelatihan,
          employee_id: emp.id,
          employee_name: cap(emp.full_name || emp.nama || ''),
          outlet: cap(emp.outlet || ''),
          jabatan: cap(emp.position || ''),
          attendance: null,
          score: null,
          is_lulus: null,
          date: pendingForm.tanggal_waktu?.split('T')[0] || now.split('T')[0],
          created_at: now,
        }));
        const updRes = [...results, ...newResults];
        lsSet('hris_training_results', updRes);
        setResults(updRes);

        const existingNotifs = lsGet('hris_notifications', []);
        const inviteNotifs = targetEmps.map(emp => ({
          id: uid(),
          type: 'training_invite',
          training_id: newT.id,
          employee_id: emp.id,
          employee_name: cap(emp.full_name || emp.nama || ''),
          outlet: cap(emp.outlet || ''),
          judul: newT.judul_pelatihan,
          mentor: newT.mentor,
          tanggal: pendingForm.tanggal_waktu,
          status: 'unread',
          sent_at: now,
        }));
        lsSet('hris_notifications', [...existingNotifs, ...inviteNotifs]);
      }

      lsSet('hris_trainings', updated);
      setTrainings(updated);
      hrisDispatch('TRAINING_SAVED');
    };

    if (isNew) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);

      try {
        const response = await fetch(`${getApiUrl()}/v1/dispatch-event`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'training_invite',
            targetOutlet: pendingForm.target_outlets.length > 0 ? pendingForm.target_outlets.map(cap).join(', ') : 'Semua Outlet',
            targetJabatan: pendingForm.target_jabatan.length > 0 ? pendingForm.target_jabatan.map(cap).join(', ') : 'Semua Jabatan',
            messageTitle: `Undangan Pelatihan: ${cap(pendingForm.judul_pelatihan.trim())}`,
            content: `Pelatihan "${cap(pendingForm.judul_pelatihan.trim())}" akan dimentori oleh ${cap(pendingForm.mentor.trim())} pada tanggal ${pendingForm.tanggal_waktu}.`
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          performLocalSave();
        } else {
          throw new Error('Server returned error status');
        }
      } catch (err) {
        console.warn('Real-time dispatcher failed or timed out. Falling back to local storage sync.', err);
        performLocalSave();
      } finally {
        setIsSendingEvent(false);
        setForm({ judul_pelatihan:'', deskripsi:'', mentor:'', target_outlets:[], target_jabatan:[], tanggal_waktu:'' });
        setEditTarget(null);
        setShowScheduleModal(false);
        setPendingForm(null);
      }
    } else {
      performLocalSave();
      setIsSendingEvent(false);
      setForm({ judul_pelatihan:'', deskripsi:'', mentor:'', target_outlets:[], target_jabatan:[], tanggal_waktu:'' });
      setEditTarget(null);
      setShowScheduleModal(false);
      setPendingForm(null);
    }
  }, [pendingForm, editTarget, trainings, results, activeEmployees, hrisDispatch]);

  // ── Delete Training
  const handleDeleteTraining = id => {
    const updated = trainings.filter(t => t.id !== id);
    const updRes  = results.filter(r => r.training_id !== id);
    lsSet('hris_trainings', updated);
    lsSet('hris_training_results', updRes);
    setTrainings(updated);
    setResults(updRes);
    setDelConfirm(null);
    hrisDispatch('TRAINING_SAVED');
  };

  // ── Save Score → Sync to Payroll KPI
  const handleSaveScore = useCallback(({ attendance, score, is_lulus }) => {
    if (!scoreEntry) return;
    const now = new Date().toISOString();
    const updRes = results.map(r =>
      r.id === scoreEntry.id ? { ...r, attendance, score, is_lulus, updated_at: now } : r
    );
    lsSet('hris_training_results', updRes);
    setResults(updRes);

    // ── KPI Sync: tulis ke hris_training_kpi_scores (dibaca KpiPage)
    const kpiScores = lsGet('hris_training_kpi_scores', []);
    const filtered  = kpiScores.filter(k => !(k.employee_id === scoreEntry.employee_id && k.training_id === scoreEntry.training_id));
    const newKpi = {
      id: uid(),
      employee_id: scoreEntry.employee_id,
      employee_name: scoreEntry.employee_name,
      outlet: scoreEntry.outlet,
      training_id: scoreEntry.training_id,
      training_name: scoreEntry.training_name,
      score,
      attendance,
      is_lulus,
      date: scoreEntry.date,
      synced_at: now,
    };
    lsSet('hris_training_kpi_scores', [...filtered, newKpi]);
    hrisDispatch('TRAINING_SAVED');

    setShowScoreModal(false);
    setScoreEntry(null);
  }, [scoreEntry, results, hrisDispatch]);

  // ── Upload Material
  const handleSaveMaterial = useCallback((mat) => {
    const now = new Date().toISOString();
    const newMat = {
      id: uid(),
      title: cap(mat.title),
      desc: mat.desc,
      training_id: mat.training_id,
      file_type: mat.file_type,
      file_name: mat.file_name,
      file_data: mat.file_data,
      link_url: mat.link_url,
      created_at: now,
    };
    const updated = [newMat, ...materials];
    lsSet('hris_training_materials', updated);
    setMaterials(updated);

    // Broadcast ke mobile: notifikasi materi baru
    const linked = trainings.find(t => t.id === mat.training_id);
    const targetEmps = linked
      ? activeEmployees.filter(e =>
          (linked.target_outlets.includes('Semua Outlet') || linked.target_outlets.includes(e.outlet)) &&
          (linked.target_jabatan.includes('Semua Jabatan') || linked.target_jabatan.includes(e.position))
        )
      : activeEmployees;

    const existingNotifs = lsGet('hris_notifications', []);
    const matNotifs = targetEmps.map(emp => ({
      id: uid(),
      type: 'training_material',
      material_id: newMat.id,
      employee_id: emp.id,
      employee_name: cap(emp.full_name || emp.nama || ''),
      outlet: cap(emp.outlet || ''),
      judul: newMat.title,
      file_type: newMat.file_type,
      status: 'unread',
      sent_at: now,
    }));
    lsSet('hris_notifications', [...existingNotifs, ...matNotifs]);
    hrisDispatch('TRAINING_SAVED');
    return newMat;
  }, [materials, trainings, activeEmployees, hrisDispatch]);

  // ── AI Mock Quiz Generator — 10 Title-Cased MCQ per materi
  const generateMockQuiz = useCallback((matTitle, matDesc) => {
    const t = cap(matTitle || 'Materi Pelatihan');
    const topik = t.replace(/Modul |Materi |Panduan |Sop |Standar /gi, '').trim() || 'Operasional Restoran';

    const templates = [
      {
        soal: `Apa Yang Dimaksud Dengan ${topik} Dalam Standar Operasional Perusahaan?`,
        pilihan: {
          A: `Prosedur Baku Yang Wajib Diikuti Seluruh Karyawan`,
          B: `Panduan Opsional Yang Dapat Diabaikan`,
          C: `Aturan Khusus Hanya Untuk Manajer`,
          D: `Kebijakan Yang Berlaku Satu Kali Saja`,
          E: `Instruksi Verbal Tanpa Dokumen Tertulis`,
        },
        kunci: 'A',
        rasional: `Standar Operasional Dalam ${topik} Adalah Prosedur Baku Yang Wajib Dipatuhi Semua Karyawan Untuk Menjaga Konsistensi Dan Kualitas Layanan.`,
      },
      {
        soal: `Mengapa ${topik} Penting Diterapkan Di Setiap Cabang Barokah Grup?`,
        pilihan: {
          A: `Hanya Untuk Memenuhi Persyaratan Audit Eksternal`,
          B: `Untuk Menjaga Standar Kualitas Dan Konsistensi Layanan Di Semua Outlet`,
          C: `Supaya Karyawan Tidak Perlu Dilatih Lagi`,
          D: `Agar Pelanggan Tidak Mengeluh`,
          E: `Karena Diwajibkan Oleh Pemerintah Daerah`,
        },
        kunci: 'B',
        rasional: `${topik} Diterapkan Untuk Memastikan Konsistensi Kualitas Dan Standar Layanan Di Seluruh Cabang Barokah Grup Secara Menyeluruh.`,
      },
      {
        soal: `Siapa Yang Bertanggung Jawab Memastikan ${topik} Berjalan Sesuai Standar Di Outlet?`,
        pilihan: {
          A: `Hanya Direktur Utama Perusahaan`,
          B: `Tim HRD Pusat Saja`,
          C: `Kepala Cabang Beserta Seluruh Tim Di Outlet`,
          D: `Karyawan Baru Yang Baru Bergabung`,
          E: `Auditor Eksternal Perusahaan`,
        },
        kunci: 'C',
        rasional: `Tanggung Jawab Penerapan ${topik} Ada Pada Kepala Cabang Dan Seluruh Tim Di Outlet, Bukan Hanya Satu Pihak Saja.`,
      },
      {
        soal: `Apa Konsekuensi Jika Karyawan Tidak Mematuhi Prosedur ${topik}?`,
        pilihan: {
          A: `Tidak Ada Konsekuensi Karena Bersifat Saran`,
          B: `Mendapat Penghargaan Khusus Dari Manajemen`,
          C: `Dipindahkan Ke Outlet Lain Secara Otomatis`,
          D: `Dapat Dikenai Sanksi Sesuai Peraturan Perusahaan`,
          E: `Gajinya Langsung Dipotong Penuh Satu Bulan`,
        },
        kunci: 'D',
        rasional: `Ketidakpatuhan Terhadap Prosedur ${topik} Dapat Berujung Pada Sanksi Sesuai Peraturan Perusahaan Yang Berlaku.`,
      },
      {
        soal: `Bagaimana Cara Yang Benar Melaporkan Temuan Masalah Terkait ${topik}?`,
        pilihan: {
          A: `Langsung Menyampaikan Ke Media Sosial`,
          B: `Diam Dan Tidak Melakukan Apa-Apa`,
          C: `Melaporkan Ke Atasan Langsung Dan Mendokumentasikannya`,
          D: `Menunggu Audit Dari HRD Pusat`,
          E: `Hanya Memberitahu Rekan Kerja Saja`,
        },
        kunci: 'C',
        rasional: `Temuan Masalah ${topik} Harus Segera Dilaporkan Ke Atasan Dan Didokumentasikan Agar Dapat Ditindaklanjuti Dengan Cepat Dan Tepat.`,
      },
      {
        soal: `Kapan Evaluasi Penerapan ${topik} Sebaiknya Dilakukan Secara Berkala?`,
        pilihan: {
          A: `Hanya Saat Ada Inspeksi Mendadak`,
          B: `Setiap Hari Tanpa Pengecualian`,
          C: `Minimal Sekali Dalam Setahun`,
          D: `Sesuai Jadwal Yang Telah Ditetapkan Manajemen`,
          E: `Tidak Perlu Dievaluasi Jika Tidak Ada Masalah`,
        },
        kunci: 'D',
        rasional: `Evaluasi ${topik} Dilakukan Sesuai Jadwal Resmi Yang Ditetapkan Manajemen Untuk Memastikan Standar Selalu Terjaga Dan Diperbarui Tepat Waktu.`,
      },
      {
        soal: `Dokumen Apa Yang Harus Dipahami Karyawan Sebelum Menerapkan ${topik}?`,
        pilihan: {
          A: `Dokumen Keuangan Perusahaan`,
          B: `Laporan Tahunan Pemegang Saham`,
          C: `Standar Operasional Prosedur (SOP) Yang Berlaku`,
          D: `Daftar Gaji Karyawan Outlet`,
          E: `Kontrak Kerja Karyawan Lain`,
        },
        kunci: 'C',
        rasional: `Sebelum Menerapkan ${topik}, Karyawan Wajib Memahami Dan Mengikuti Standar Operasional Prosedur (SOP) Resmi Yang Telah Ditetapkan Perusahaan.`,
      },
      {
        soal: `Apa Manfaat Utama Penerapan ${topik} Secara Konsisten Bagi Pelanggan?`,
        pilihan: {
          A: `Membuat Harga Produk Menjadi Lebih Mahal`,
          B: `Memperlambat Proses Pelayanan`,
          C: `Mengurangi Pilihan Menu Yang Tersedia`,
          D: `Memberikan Pengalaman Layanan Yang Konsisten Dan Memuaskan`,
          E: `Membatasi Kreatifitas Karyawan Dalam Bekerja`,
        },
        kunci: 'D',
        rasional: `Penerapan ${topik} Secara Konsisten Memberikan Pengalaman Layanan Yang Seragam Dan Memuaskan Bagi Setiap Pelanggan Di Semua Outlet.`,
      },
      {
        soal: `Apa Langkah Pertama Yang Harus Dilakukan Saat Menerima Materi ${topik} Baru?`,
        pilihan: {
          A: `Langsung Mempraktikkannya Tanpa Membaca`,
          B: `Menyimpan Dokumen Dan Tidak Membacanya`,
          C: `Membaca, Memahami, Dan Bertanya Jika Ada Yang Tidak Jelas`,
          D: `Menyerahkan Ke Rekan Kerja Untuk Dibaca`,
          E: `Menunggu Perintah Atasan Untuk Membaca`,
        },
        kunci: 'C',
        rasional: `Saat Menerima Materi ${topik} Baru, Karyawan Harus Membaca Dengan Seksama, Memahaminya, Dan Bertanya Jika Ada Hal Yang Masih Belum Dipahami.`,
      },
      {
        soal: `Bagaimana Sikap Profesional Yang Tepat Saat Menghadapi Tantangan Dalam ${topik}?`,
        pilihan: {
          A: `Menghindari Tugas Yang Berhubungan Dengan Masalah Tersebut`,
          B: `Mencari Kambing Hitam Atas Setiap Kegagalan`,
          C: `Menganalisis Masalah, Berkoordinasi, Dan Mencari Solusi Terbaik`,
          D: `Langsung Mengundurkan Diri Dari Pekerjaan`,
          E: `Mengeluh Ke Seluruh Rekan Kerja Di Outlet`,
        },
        kunci: 'C',
        rasional: `Sikap Profesional Dalam Menghadapi Tantangan ${topik} Adalah Menganalisis Masalah Secara Objektif, Berkoordinasi Dengan Tim, Dan Mencari Solusi Terbaik Bersama.`,
      },
    ];

    return {
      id: uid(),
      nama_kuis: cap(`Kuis Kompetensi — ${t}`),
      divisi: 'Semua',
      durasi_menit: 15,
      periode_aktif_start: new Date().toISOString().slice(0, 10),
      periode_aktif_end: '',
      soal: templates,
      created_at: new Date().toISOString(),
      status: 'draft',
      generated_from_material: true,
    };
  }, []);

  // ── Eksekusi upload materi + generate kuis setelah double-confirm
  const executeMaterialUploadWithQuiz = useCallback(() => {
    if (!pendingMaterial) return;
    setShowMaterialConfirm(false);

    // 1. Simpan materi
    handleSaveMaterial(pendingMaterial);

    // 2. Generate 10 soal dari judul materi
    const generatedQuiz = generateMockQuiz(pendingMaterial.title, pendingMaterial.desc);

    // 3. Tulis ke quiz_bank_generated (diambil oleh KuisKompetensi)
    const existing = lsGet('quiz_bank_generated', []);
    lsSet('quiz_bank_generated', [...existing, generatedQuiz]);

    // 4. Trigger sync overlay 300ms via QUIZ_GENERATING
    hrisDispatch('QUIZ_GENERATING', null, 300);

    setPendingMaterial(null);
  }, [pendingMaterial, handleSaveMaterial, generateMockQuiz, hrisDispatch]);

  const handleExportPDF = () => {
    setIsExportingPDF(true);
    setTimeout(() => {
      try {
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        
        // --- PAGE 1: Jadwal Agenda Training ---
        doc.setFillColor(0, 0, 0);
        doc.rect(0, 0, 297, 38, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(cap('LAPORAN PROGRAM PELATIHAN BAROKAH GRUP'), 14, 14);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(180, 180, 180);
        doc.text(cap(`Bagian 1: Jadwal Agenda Training · Dicetak: ${new Date().toLocaleString('id-ID')}`), 14, 22);

        const scheduleHeaders = [[cap('Tanggal & Jam'), cap('Nama Pelatihan'), cap('Target Outlet'), cap('Target Jabatan'), cap('Mentor'), cap('Status')]];
        const scheduleRows = filteredTrainings.map(t => {
          const st = getTrainingStatus(t.tanggal_waktu);
          return [
            fmtDT(t.tanggal_waktu),
            cap(t.judul_pelatihan),
            cap(t.target_outlets?.join(', ') || 'Semua Outlet'),
            cap(t.target_jabatan?.join(', ') || 'Semua Jabatan'),
            cap(t.mentor),
            cap(st.label)
          ];
        });

        autoTable(doc, {
          startY: 42,
          head: scheduleHeaders,
          body: scheduleRows,
          theme: 'grid',
          styles: { fontSize: 8, cellPadding: 2.5, textColor: [0, 0, 0] },
          headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold' }
        });

        // --- PAGE 2: Nilai Evaluasi Hasil Kelulusan ---
        doc.addPage();
        doc.setFillColor(0, 0, 0);
        doc.rect(0, 0, 297, 38, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(cap('LAPORAN PROGRAM PELATIHAN BAROKAH GRUP'), 14, 14);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(180, 180, 180);
        doc.text(cap(`Bagian 2: Nilai Evaluasi Hasil Kelulusan · Total: ${filteredResults.length} Karyawan`), 14, 22);

        const resultHeaders = [[cap('Nama Karyawan'), cap('Outlet'), cap('Nama Pelatihan'), cap('Kehadiran (%)'), cap('Skor Akhir'), cap('Status Kelulusan')]];
        const resultRows = filteredResults.map(r => [
          cap(r.employee_name),
          cap(r.outlet),
          cap(r.training_name),
          r.attendance !== null ? `${r.attendance}%` : '—',
          r.score !== null ? String(r.score) : '—',
          r.is_lulus === null ? cap('Belum Dinilai') : r.is_lulus ? cap('Lulus') : cap('Tidak Lulus')
        ]);

        autoTable(doc, {
          startY: 42,
          head: resultHeaders,
          body: resultRows,
          theme: 'grid',
          styles: { fontSize: 8, cellPadding: 2.5, textColor: [0, 0, 0] },
          headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold' }
        });

        // --- PAGE 3: Daftar Modul Materi ---
        doc.addPage();
        doc.setFillColor(0, 0, 0);
        doc.rect(0, 0, 297, 38, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(cap('LAPORAN PROGRAM PELATIHAN BAROKAH GRUP'), 14, 14);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(180, 180, 180);
        doc.text(cap(`Bagian 3: Daftar Modul Materi Pelatihan · Total: ${materials.length} Modul`), 14, 22);

        const materialHeaders = [[cap('Judul Modul'), cap('Deskripsi'), cap('Nama Pelatihan'), cap('Tipe Dokumen'), cap('Nama File')]];
        const materialRows = materials.map(m => [
          cap(m.title),
          cap(m.desc || '-'),
          cap(m.training_name || '-'),
          cap(m.file_type || '-'),
          cap(m.file_name || '-')
        ]);

        autoTable(doc, {
          startY: 42,
          head: materialHeaders,
          body: materialRows,
          theme: 'grid',
          styles: { fontSize: 8, cellPadding: 2.5, textColor: [0, 0, 0] },
          headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold' }
        });

        doc.save(`Laporan_Lengkap_Pelatihan_${new Date().toISOString().slice(0, 10)}.pdf`);
      } catch (err) {
        console.error('PDF export failed:', err);
      } finally {
        setIsExportingPDF(false);
        resetFiltersToDefault();
      }
    }, 200);
  };

  // ── Stats
  const totalJadwal     = trainings.length;
  const totalMendatang  = trainings.filter(t => getTrainingStatus(t.tanggal_waktu).label === 'Akan Datang').length;
  const totalLulus      = results.filter(r => r.is_lulus === true).length;
  const totalMaterial   = materials.length;

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily:"'Inter','Segoe UI',sans-serif", background:C.bg, minHeight:'100vh', color:C.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulseGlow { 0%,100%{box-shadow:0 0 14px rgba(0,173,181,0.3)} 50%{box-shadow:0 0 32px rgba(0,173,181,0.6)} }
        .tab-anim { animation: fadeUp 0.3s ease forwards; }
        .tr-row:hover td { background: rgba(0,173,181,0.04) !important; }
        .mat-card:hover { border-color: rgba(0,173,181,0.35) !important; transform: translateY(-2px); }
        .mat-card { transition: all 0.2s ease; }
        textarea:focus, input:focus, select:focus { outline:none; }
        ::-webkit-scrollbar { width:5px; height:5px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:#393E46; border-radius:4px; }
      `}</style>

      {/* ═══ COMPILING OVERLAY ═══ */}
      {isExportingPDF && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:99999, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }}>
          <div style={{ background:C.surface, padding:'30px', borderRadius:'16px', textAlign:'center', color:C.cyan }}>
            <div style={{ border:'4px solid rgba(0,173,181,0.2)', borderTop:'4px solid #00ADB5', borderRadius:'50%', width:'40px', height:'40px', animation:'spin 1s linear infinite', margin:'0 auto 15px' }}/>
            <p style={{ fontWeight:700 }}>Mengompilasi Data & Generate PDF...</p>
          </div>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* ═══ HEADER ═══ */}
      <div style={{ background:`linear-gradient(135deg,${C.surface} 0%,#252B32 100%)`, borderBottom:`1px solid ${C.border}`, padding:'26px 32px 20px', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:'-50px', right:'-50px', width:'220px', height:'220px', borderRadius:'50%', background:'radial-gradient(circle,rgba(0,173,181,0.12) 0%,transparent 70%)', pointerEvents:'none' }}/>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'16px', position:'relative', zIndex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
            <div style={{ background:'linear-gradient(135deg,#00ADB5,#007a80)', borderRadius:'14px', width:'52px', height:'52px', display:'flex', alignItems:'center', justifyContent:'center', animation:'pulseGlow 3s ease infinite', boxShadow:'0 4px 20px rgba(0,173,181,0.4)' }}>
              <GraduationCap size={26} color="#fff"/>
            </div>
            <div>
              <h1 style={{ fontSize:'1.5rem', fontWeight:800, color:C.text, lineHeight:1.2 }}>Program Pelatihan</h1>
              <p style={{ color:C.muted, fontSize:'0.84rem', marginTop:'3px' }}>Training & Competency Development — Barokah Grup</p>
            </div>
          </div>
          <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
            {[
              { icon:<Calendar size={15}/>, label:'Total Jadwal', val:totalJadwal, color:C.cyan, border:'var(--primary-glow)' },
              { icon:<Clock size={15}/>, label:'Akan Datang', val:totalMendatang, color:C.warn, border:'var(--warning-glow)' },
              { icon:<Award size={15}/>, label:'Peserta Lulus', val:totalLulus, color:C.success, border:'rgba(78,205,196,0.2)' },
              { icon:<FolderOpen size={15}/>, label:'Materi', val:totalMaterial, color:'#A78BFA', border:'rgba(167,139,250,0.2)' },
            ].map(s => (
              <div key={s.label} style={{ background:C.bg, border:`1px solid ${s.border}`, borderRadius:'12px', padding:'10px 16px', display:'flex', alignItems:'center', gap:'8px' }}>
                <span style={{ color:s.color }}>{s.icon}</span>
                <div>
                  <p style={{ color:C.muted, fontSize:'0.68rem' }}>{s.label}</p>
                  <p style={{ color:s.color, fontWeight:800, fontSize:'1.05rem' }}>{s.val}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── GLOBAL FILTER BAR ── */}
        <div style={{ marginTop:'20px', display:'grid', gridTemplateColumns:'1fr 1fr auto auto auto', gap:'12px', alignItems:'end' }}>
          <MultiSel label="Filter Outlet" options={allOutlets} selected={fOutlets} onChange={setFOutlets} placeholder="Semua Outlet"/>
          <MultiSel label="Filter Jabatan" options={allJabatan} selected={fJabatan} onChange={setFJabatan} placeholder="Semua Jabatan"/>
          <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
            <label style={{ fontSize:'0.79rem', fontWeight:600, color:C.muted }}>Bulan</label>
            <select value={fBulan} onChange={e=>setFBulan(e.target.value)} style={{ background:C.bg, border:`1px solid ${fBulan ? C.cyanBorder : C.border}`, borderRadius:'9px', padding:'10px 13px', color:C.text, fontSize:'0.84rem', cursor:'pointer', minWidth:'130px' }}>
              {BULAN_LIST.map(b => <option key={b} value={b} style={{ background:C.surface }}>{BULAN_LABEL[b]}</option>)}
            </select>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
            <label style={{ fontSize:'0.79rem', fontWeight:600, color:C.muted }}>Tahun</label>
            <select value={fTahun} onChange={e=>setFTahun(e.target.value)} style={{ background:C.bg, border:`1px solid ${fTahun ? C.cyanBorder : C.border}`, borderRadius:'9px', padding:'10px 13px', color:C.text, fontSize:'0.84rem', cursor:'pointer', minWidth:'100px' }}>
              {TAHUN_LIST.map(t => <option key={t} value={t} style={{ background:C.surface }}>{t || 'Semua Tahun'}</option>)}
            </select>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
            <label style={{ fontSize:'0.79rem', fontWeight:600, color:'transparent' }}>Export</label>
            <button
              id="global-pdf-btn"
              type="button"
              onClick={handleExportPDF}
              style={{
                height: '40px',
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

        {/* Active filter chips */}
        {(fOutlets.length > 0 || fJabatan.length > 0 || fBulan || fTahun) && (
          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginTop:'12px' }}>
            {fOutlets.map(o => <Badge key={o} label={`🏪 ${cap(o)}`} />)}
            {fJabatan.map(j => <Badge key={j} label={`👤 ${cap(j)}`} color={C.warn} bg={C.warnDim} />)}
            {fBulan && <Badge label={`📅 ${BULAN_LABEL[fBulan]}`} color="#A78BFA" bg="rgba(167,139,250,0.1)" />}
            {fTahun && <Badge label={`📆 ${fTahun}`} color="#A78BFA" bg="rgba(167,139,250,0.1)" />}
            <button onClick={resetFiltersToDefault}
              style={{ background:'none', border:'none', color:C.danger, cursor:'pointer', fontSize:'0.76rem', fontWeight:700, padding:'3px 8px' }}>
              ✕ Reset Filter
            </button>
          </div>
        )}
      </div>

      {/* ═══ TAB SWITCHER ═══ */}
      <div style={{ display:'flex', gap:'4px', padding:'14px 32px 0', borderBottom:`1px solid ${C.border}`, background:C.surface }}>
        {[
          { id:'jadwal',   label:'📅 Jadwal Training' },
          { id:'hasil',    label:'📊 Hasil & Evaluasi' },
          { id:'materi',   label:'📚 Materi Training' },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            background: activeTab===t.id ? C.bg : 'transparent',
            border:'none', borderRadius:'10px 10px 0 0',
            color: activeTab===t.id ? C.cyan : C.muted,
            padding:'12px 22px', fontWeight:700, fontSize:'0.88rem', cursor:'pointer',
            borderBottom: activeTab===t.id ? `3px solid ${C.cyan}` : '3px solid transparent',
            transition:'all 0.2s',
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ padding:'26px 32px' }}>

        {/* ══════════════════════════════════════════════════════
            TAB 1: JADWAL TRAINING
        ══════════════════════════════════════════════════════ */}
        {activeTab === 'jadwal' && (
          <div className="tab-anim">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'18px', flexWrap:'wrap', gap:'12px' }}>
              <div>
                <h2 style={{ fontSize:'1.05rem', fontWeight:700 }}>Jadwal & Agenda Training</h2>
                <p style={{ color:C.muted, fontSize:'0.8rem', marginTop:'2px' }}>{filteredTrainings.length} jadwal ditemukan</p>
              </div>
              <div style={{ display:'flex', gap:'10px' }}>
                <Btn variant="black" onClick={exportSchedulePDF}><Download size={14}/>📥 Download PDF</Btn>
                <Btn variant="primary" onClick={() => { setEditTarget(null); setForm({ judul_pelatihan:'', deskripsi:'', mentor:'', target_outlets:[], target_jabatan:[], tanggal_waktu:'' }); setShowScheduleModal(true); }}>
                  <Plus size={16}/>➕ Buat Jadwal Training Baru
                </Btn>
              </div>
            </div>

            {filteredTrainings.length === 0 ? (
              <div style={{ textAlign:'center', padding:'80px', background:C.surface, borderRadius:'16px', border:`1px dashed ${C.border}` }}>
                <Calendar size={48} color={C.muted} style={{ marginBottom:'14px' }}/>
                <p style={{ color:C.text, fontWeight:700, marginBottom:'6px' }}>Belum Ada Jadwal Training</p>
                <p style={{ color:C.muted, fontSize:'0.84rem' }}>Klik "Buat Jadwal Training Baru" untuk memulai.</p>
              </div>
            ) : (
              <div style={{ overflowX:'auto', borderRadius:'14px', border:`1px solid ${C.border}` }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.84rem' }}>
                  <thead>
                    <tr style={{ background:C.surface }}>
                      {['Tanggal & Jam','Nama Pelatihan','Target Outlet & Jabatan','Mentor','Status','Aksi'].map(h => (
                        <th key={h} style={{ padding:'13px 16px', color:C.cyan, fontWeight:700, textAlign:'left', borderBottom:`1px solid ${C.border}`, whiteSpace:'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTrainings.map(t => {
                      const st = getTrainingStatus(t.tanggal_waktu);
                      return (
                        <tr key={t.id} className="tr-row" style={{ borderBottom:`1px solid ${C.border}`, transition:'background 0.15s' }}>
                          <td style={{ padding:'14px 16px', color:C.muted, fontSize:'0.78rem', whiteSpace:'nowrap' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:'6px' }}><Clock size={12}/>{fmtDT(t.tanggal_waktu)}</div>
                          </td>
                          <td style={{ padding:'14px 16px' }}>
                            <p style={{ color:C.text, fontWeight:700 }}>{t.judul_pelatihan}</p>
                            {t.deskripsi && <p style={{ color:C.muted, fontSize:'0.76rem', marginTop:'2px', maxWidth:'220px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.deskripsi}</p>}
                          </td>
                          <td style={{ padding:'14px 16px' }}>
                            <p style={{ color:C.muted, fontSize:'0.78rem' }}>🏪 {t.target_outlets?.join(', ') || 'Semua'}</p>
                            <p style={{ color:C.muted, fontSize:'0.78rem' }}>👤 {t.target_jabatan?.join(', ') || 'Semua'}</p>
                          </td>
                          <td style={{ padding:'14px 16px', color:C.text, fontWeight:600 }}>{t.mentor}</td>
                          <td style={{ padding:'14px 16px' }}>
                            <Badge label={st.label} color={st.color} bg={st.bg}/>
                          </td>
                          <td style={{ padding:'14px 16px' }}>
                            <div style={{ display:'flex', gap:'7px' }}>
                              <button title="Edit" onClick={() => { setEditTarget(t); setForm({ judul_pelatihan:t.judul_pelatihan, deskripsi:t.deskripsi||'', mentor:t.mentor, target_outlets:t.target_outlets||[], target_jabatan:t.target_jabatan||[], tanggal_waktu:t.tanggal_waktu||'' }); setShowScheduleModal(true); }}
                                style={{ background:C.cyanDim, border:`1px solid ${C.cyanBorder}`, borderRadius:'8px', padding:'7px 10px', color:C.cyan, cursor:'pointer', display:'flex', alignItems:'center', transition:'all 0.15s' }}>
                                <Edit2 size={13}/>
                              </button>
                              <button title="Hapus" onClick={() => setDelConfirm(t.id)}
                                style={{ background:C.dangerDim, border:`1px solid ${C.dangerBorder}`, borderRadius:'8px', padding:'7px 10px', color:C.danger, cursor:'pointer', display:'flex', alignItems:'center', transition:'all 0.15s' }}>
                                <Trash2 size={13}/>
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
        )}

        {/* ══════════════════════════════════════════════════════
            TAB 2: HASIL TRAINING
        ══════════════════════════════════════════════════════ */}
        {activeTab === 'hasil' && (
          <div className="tab-anim">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'18px', flexWrap:'wrap', gap:'12px' }}>
              <div>
                <h2 style={{ fontSize:'1.05rem', fontWeight:700 }}>Rekap Nilai Evaluasi Peserta</h2>
                <p style={{ color:C.muted, fontSize:'0.8rem', marginTop:'2px' }}>
                  {filteredResults.length} peserta · {filteredResults.filter(r=>r.is_lulus===true).length} lulus · nilai tersinkronisasi ke KPI Kompetensi
                </p>
              </div>
              <Btn variant="black" onClick={handleExportPDF}><Download size={14}/>📥 Download PDF</Btn>
            </div>

            {/* KPI Sync Notice */}
            <div style={{ background:C.cyanDim, border:`1px solid ${C.cyanBorder}`, borderRadius:'12px', padding:'12px 18px', marginBottom:'18px', display:'flex', alignItems:'center', gap:'10px' }}>
              <Zap size={16} color={C.cyan}/>
              <p style={{ color:C.cyan, fontSize:'0.82rem', fontWeight:600 }}>
                Setiap nilai akhir yang diinput akan otomatis tersinkronisasi ke <strong>rapor KPI Nilai Kompetensi</strong> karyawan secara real-time.
              </p>
            </div>

            {filteredResults.length === 0 ? (
              <div style={{ textAlign:'center', padding:'80px', background:C.surface, borderRadius:'16px', border:`1px dashed ${C.border}` }}>
                <BarChart2 size={48} color={C.muted} style={{ marginBottom:'14px' }}/>
                <p style={{ color:C.text, fontWeight:700, marginBottom:'6px' }}>Belum Ada Data Hasil Training</p>
                <p style={{ color:C.muted, fontSize:'0.84rem' }}>Buat jadwal training terlebih dahulu agar peserta terdaftar otomatis di sini.</p>
              </div>
            ) : (
              <div style={{ overflowX:'auto', borderRadius:'14px', border:`1px solid ${C.border}` }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.84rem' }}>
                  <thead>
                    <tr style={{ background:C.surface }}>
                      {['Nama Karyawan & Outlet','Nama Pelatihan','Nilai Kehadiran (%)','Skor Nilai Akhir','Rekomendasi / Status Lulus','Aksi'].map(h => (
                        <th key={h} style={{ padding:'13px 16px', color:C.cyan, fontWeight:700, textAlign:'left', borderBottom:`1px solid ${C.border}`, whiteSpace:'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredResults.map(r => (
                      <tr key={r.id} className="tr-row" style={{ borderBottom:`1px solid ${C.border}`, transition:'background 0.15s' }}>
                        <td style={{ padding:'14px 16px' }}>
                          <p style={{ color:C.text, fontWeight:700 }}>{r.employee_name}</p>
                          <p style={{ color:C.muted, fontSize:'0.77rem', marginTop:'2px' }}>{r.outlet} · {r.jabatan}</p>
                        </td>
                        <td style={{ padding:'14px 16px', color:C.text, maxWidth:'180px' }}>
                          <p style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.training_name}</p>
                        </td>
                        <td style={{ padding:'14px 16px', textAlign:'center' }}>
                          {r.attendance !== null
                            ? <span style={{ color: r.attendance >= 80 ? C.success : C.warn, fontWeight:700 }}>{r.attendance}%</span>
                            : <span style={{ color:C.muted }}>—</span>}
                        </td>
                        <td style={{ padding:'14px 16px', textAlign:'center' }}>
                          {r.score !== null
                            ? <span style={{ color: r.score >= 70 ? C.success : C.danger, fontWeight:800, fontSize:'1rem' }}>{r.score}</span>
                            : <span style={{ color:C.muted }}>—</span>}
                        </td>
                        <td style={{ padding:'14px 16px' }}>
                          {r.is_lulus === null
                            ? <Badge label="⏳ Belum Dinilai" color={C.muted} bg="rgba(158,168,179,0.1)"/>
                            : r.is_lulus
                              ? <Badge label="✅ Lulus" color={C.success} bg="rgba(78,205,196,0.12)"/>
                              : <Badge label="❌ Tidak Lulus" color={C.danger} bg={C.dangerDim}/>}
                        </td>
                        <td style={{ padding:'14px 16px' }}>
                          <button onClick={() => { setScoreEntry(r); setShowScoreModal(true); }}
                            style={{ background:C.cyanDim, border:`1px solid ${C.cyanBorder}`, borderRadius:'8px', padding:'7px 12px', color:C.cyan, cursor:'pointer', display:'flex', alignItems:'center', gap:'5px', fontSize:'0.78rem', fontWeight:700, transition:'all 0.15s' }}>
                            <Edit2 size={13}/> {r.score !== null ? 'Edit Nilai' : 'Input Nilai'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            TAB 3: MATERI TRAINING
        ══════════════════════════════════════════════════════ */}
        {activeTab === 'materi' && (
          <div className="tab-anim">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px', flexWrap:'wrap', gap:'12px' }}>
              <div>
                <h2 style={{ fontSize:'1.05rem', fontWeight:700 }}>Pusat Modul & Materi Training</h2>
                <p style={{ color:C.muted, fontSize:'0.8rem', marginTop:'2px' }}>{filteredMaterials.length} materi tersedia · auto-siarkan ke HP karyawan saat upload</p>
              </div>
              <Btn variant="primary" onClick={() => setShowMaterialModal(true)}>
                <Plus size={16}/>📁 Tambah Materi Baru
              </Btn>
            </div>

            {filteredMaterials.length === 0 ? (
              <div style={{ textAlign:'center', padding:'80px', background:C.surface, borderRadius:'16px', border:`1px dashed ${C.border}` }}>
                <FolderOpen size={48} color={C.muted} style={{ marginBottom:'14px' }}/>
                <p style={{ color:C.text, fontWeight:700, marginBottom:'6px' }}>Belum Ada Materi Training</p>
                <p style={{ color:C.muted, fontSize:'0.84rem' }}>Upload PDF, gambar SOP, atau link video untuk mulai membangun modul pelatihan.</p>
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:'16px' }}>
                {filteredMaterials.map(m => {
                  const icons = {
                    pdf: <FileText size={22} color={C.danger}/>,
                    image: <Image size={22} color={C.warn}/>,
                    video: <Video size={22} color='#A78BFA'/>,
                    instagram: <InstagramIcon size={22} color='#E1306C'/>,
                    tiktok: <TiktokIcon size={22} color='#00ADB5'/>,
                    sosmed: <Link2 size={22} color='#4ECDC4'/>
                  };
                  const typeLabel = {
                    pdf: 'Dokumen PDF',
                    image: 'Gambar / SOP',
                    video: 'Video Tutorial',
                    instagram: 'Link Instagram',
                    tiktok: 'Link TikTok',
                    sosmed: 'Media Sosial'
                  };
                  const typeColor = {
                    pdf: C.danger,
                    image: C.warn,
                    video: '#A78BFA',
                    instagram: '#E1306C',
                    tiktok: '#00ADB5',
                    sosmed: '#4ECDC4'
                  };
                  const linked = trainings.find(t => t.id === m.training_id);
                  return (
                    <div key={m.id} className="mat-card" style={{ background:C.surface, borderRadius:'14px', border:`1px solid ${C.border}`, padding:'20px', cursor:'default', display:'flex', flexDirection:'column' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'12px' }}>
                        <div style={{ background:`${typeColor[m.file_type]}18`, border:`1px solid ${typeColor[m.file_type]}33`, borderRadius:'10px', padding:'10px', display:'flex', alignItems:'center', justifyContent:'center' }}>
                          {icons[m.file_type] || <FileText size={22} color={C.cyan}/>}
                        </div>
                        <div style={{ display:'flex', gap:'6px' }}>
                          {(['video', 'instagram', 'tiktok', 'sosmed'].includes(m.file_type) && m.link_url) ? (
                            <a href={m.link_url} target="_blank" rel="noreferrer" style={{ background:C.cyanDim, border:`1px solid ${C.cyanBorder}`, borderRadius:'8px', padding:'6px 9px', color:C.cyan, display:'flex', alignItems:'center', textDecoration:'none' }}>
                              <Eye size={13}/>
                            </a>
                          ) : m.file_data ? (
                            <a href={m.file_data} download={m.file_name} style={{ background:C.cyanDim, border:`1px solid ${C.cyanBorder}`, borderRadius:'8px', padding:'6px 9px', color:C.cyan, display:'flex', alignItems:'center' }}>
                              <Download size={13}/>
                            </a>
                          ) : null}
                          <button onClick={() => {
                            const upd = materials.filter(x=>x.id !== m.id);
                            lsSet('hris_training_materials', upd);
                            setMaterials(upd);
                            hrisDispatch('TRAINING_SAVED');
                          }} style={{ background:C.dangerDim, border:`1px solid ${C.dangerBorder}`, borderRadius:'8px', padding:'6px 9px', color:C.danger, cursor:'pointer', display:'flex', alignItems:'center' }}>
                            <Trash2 size={13}/>
                          </button>
                        </div>
                      </div>

                      {/* Thumbnail Preview Area */}
                      {(() => {
                        const ytId = m.file_type === 'video' ? getYouTubeId(m.link_url) : null;
                        if (ytId) {
                          return (
                            <div style={{ width: '100%', height: '140px', borderRadius: '8px', overflow: 'hidden', marginBottom: '12px', position: 'relative', background: '#000' }}>
                              <img src={`https://img.youtube.com/vi/${ytId}/0.jpg`} alt="YouTube Cover" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />
                              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ width: '38px', height: '38px', borderRadius: '50%', backgroundColor: 'rgba(0,173,181,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 15px rgba(0,173,181,0.5)' }}>
                                  <Video size={18} color="#fff" />
                                </div>
                              </div>
                            </div>
                          );
                        }
                        if (m.file_type === 'image' && m.file_data) {
                          return (
                            <div style={{ width: '100%', height: '140px', borderRadius: '8px', overflow: 'hidden', marginBottom: '12px', background: '#000' }}>
                              <img src={m.file_data} alt="Image Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                          );
                        }
                        // Placeholders for non-visuals
                        const placeholders = {
                          pdf: { bg: 'rgba(224,92,92,0.06)', border: 'rgba(224,92,92,0.2)', icon: <FileText size={40} color={C.danger} /> },
                          instagram: { bg: 'rgba(225,48,108,0.06)', border: 'rgba(225,48,108,0.2)', icon: <InstagramIcon size={40} color='#E1306C' /> },
                          tiktok: { bg: 'rgba(0,173,181,0.06)', border: 'rgba(0,173,181,0.2)', icon: <TiktokIcon size={40} color='#00ADB5' /> },
                          sosmed: { bg: 'rgba(78,205,196,0.06)', border: 'rgba(78,205,196,0.2)', icon: <Link2 size={40} color='#4ECDC4' /> }
                        };
                        const config = placeholders[m.file_type] || { bg: 'rgba(238,238,238,0.04)', border: 'rgba(238,238,238,0.1)', icon: <FileText size={40} color={C.cyan} /> };
                        return (
                          <div style={{ width: '100%', height: '140px', borderRadius: '8px', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: config.bg, border: `1px dashed ${config.border}` }}>
                            {config.icon}
                          </div>
                        );
                      })()}

                      <p style={{ color:C.text, fontWeight:700, marginBottom:'6px', fontSize:'0.92rem', lineHeight:'1.3' }}>{m.title}</p>
                      {m.desc && <p style={{ color:C.muted, fontSize:'0.78rem', marginBottom:'10px', lineHeight:'1.5', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{m.desc}</p>}
                      <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginTop:'auto' }}>
                        <Badge label={typeLabel[m.file_type] || 'File'} color={typeColor[m.file_type]} bg={`${typeColor[m.file_type]}15`}/>
                        {linked && <Badge label={`📅 ${linked.judul_pelatihan}`} color={C.muted} bg="rgba(158,168,179,0.1)"/>}
                      </div>
                      <p style={{ color:C.muted, fontSize:'0.72rem', marginTop:'10px' }}>📤 Diunggah {fmtDate(m.created_at)}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ SCHEDULE MODAL ═══ */}
      {showScheduleModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.82)', zIndex:9000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(8px)', padding:'20px' }}>
          <div style={{ background:C.surface, borderRadius:'20px', border:`1.5px solid ${C.cyanBorder}`, padding:'34px', width:'600px', maxWidth:'96vw', maxHeight:'92vh', overflowY:'auto', boxShadow:'0 0 60px rgba(0,173,181,0.15)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'26px' }}>
              <h2 style={{ color:C.cyan, fontSize:'1.2rem' }}>{editTarget ? '✏️ Edit Jadwal Training' : '➕ Buat Jadwal Training Baru'}</h2>
              <button onClick={() => setShowScheduleModal(false)} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer' }}><X size={22}/></button>
            </div>
            <form onSubmit={handleScheduleSubmit} style={{ display:'flex', flexDirection:'column', gap:'18px' }}>
              <FInput label="Judul Pelatihan" required value={form.judul_pelatihan}
                onChange={e=>setF('judul_pelatihan',e.target.value)}
                placeholder="Misal: Pelatihan Higiene Dan Sanitasi Dapur"/>
              <FInput label="Deskripsi Program" type="textarea" value={form.deskripsi}
                onChange={e=>setF('deskripsi',e.target.value)} rows={3}
                placeholder="Tujuan, materi utama, dan manfaat pelatihan..."/>
              <FInput label="Nama Mentor / Fasilitator" required value={form.mentor}
                onChange={e=>setF('mentor',e.target.value)} placeholder="Misal: Budi Santoso"/>
              <FInput label="Tanggal & Waktu Pelaksanaan" required type="datetime-local"
                value={form.tanggal_waktu} onChange={e=>setF('tanggal_waktu',e.target.value)}/>
              <MultiSel label="Target Outlet" options={allOutlets} selected={form.target_outlets}
                onChange={v=>setF('target_outlets',v)} placeholder="Semua Outlet (Default)"/>
              <MultiSel label="Target Jabatan" options={allJabatan} selected={form.target_jabatan}
                onChange={v=>setF('target_jabatan',v)} placeholder="Semua Jabatan (Default)"/>
              <div style={{ display:'flex', gap:'10px', justifyContent:'flex-end', paddingTop:'6px' }}>
                <Btn variant="secondary" type="button" onClick={() => setShowScheduleModal(false)}>Batal</Btn>
                <Btn variant="primary" type="submit" disabled={!form.judul_pelatihan.trim()||!form.tanggal_waktu||!form.mentor.trim()}>
                  <CheckCircle size={15}/> Simpan Jadwal
                </Btn>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ MODALS ═══ */}
      <ConfirmModal
        isOpen={showConfirm}
        title="Konfirmasi Terbitkan Jadwal"
        msg={`Jadwal training "${cap(pendingForm?.judul_pelatihan||'')}" akan diterbitkan dan undangan otomatis dikirim ke HP karyawan target. Lanjutkan?`}
        onOk={executeScheduleSave}
        onCancel={() => setShowConfirm(false)}
      />

      <ConfirmModal
        isOpen={!!delConfirm}
        title="Hapus Jadwal Training"
        msg="Yakin hapus jadwal ini? Semua data peserta dan hasil evaluasi terkait juga akan dihapus."
        danger
        onOk={() => handleDeleteTraining(delConfirm)}
        onCancel={() => setDelConfirm(null)}
      />

      <ScoreModal
        isOpen={showScoreModal}
        entry={scoreEntry}
        onSave={handleSaveScore}
        onClose={() => { setShowScoreModal(false); setScoreEntry(null); }}
      />

      <MaterialModal
        isOpen={showMaterialModal}
        trainingOptions={trainings}
        onSave={(mat) => {
          setPendingMaterial(mat);
          setShowMaterialModal(false);
          setShowMaterialConfirm(true);
        }}
        onClose={() => setShowMaterialModal(false)}
      />

      {/* ═══ KONFIRMASI GANDA UPLOAD MATERI & GENERATE KUIS ═══ */}
      <ConfirmModal
        isOpen={showMaterialConfirm}
        title="🤖 Terbitkan Materi & Generate Kuis Otomatis?"
        msg={`Materi "${cap(pendingMaterial?.title || '')}" akan disiapkan, lalu sistem AI akan otomatis memproduksi 10 Soal Kuis Kompetensi dari materi ini dan menambahkannya ke Bank Soal Kuis. Lanjutkan?`}
        onOk={executeMaterialUploadWithQuiz}
        onCancel={() => { setShowMaterialConfirm(false); setPendingMaterial(null); }}
      />
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
              Menghubungkan & Mengirimkan Sinyal Training Real-Time...
            </span>
          </div>
        </div>
      )}
      <PDFCompileOverlay isOpen={isExportingPDF} />
    </div>
  );
}

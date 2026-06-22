/**
 * SyncOverlay.jsx — Marching Ants Sync Animation
 * ================================================
 * Overlay tipis Electric Cyan (#00ADB5) dengan animasi garis putus-putus
 * berjalan yang muncul saat sinkronisasi data lintas modul sedang terjadi.
 * Tampil 800ms lalu fade out otomatis.
 */

import React, { useEffect, useState } from 'react';
import { useHRIS } from '../context/HRISContext';

export default function SyncOverlay() {
  const { syncStatus } = useHRIS();
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);
  const [displayMsg, setDisplayMsg] = useState('');

  useEffect(() => {
    if (syncStatus.active) {
      setDisplayMsg(syncStatus.message);
      setFading(false);
      setVisible(true);
    } else if (visible) {
      setFading(true);
      const t = setTimeout(() => { setVisible(false); setFading(false); }, 300);
      return () => clearTimeout(t);
    }
  }, [syncStatus.active, syncStatus.message]);

  if (!visible) return null;

  return (
    <>
      {/* Keyframes injected inline untuk isolasi */}
      <style>{`
        @keyframes marchingAnts {
          0%   { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: -40; }
        }
        @keyframes syncFadeIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes syncFadeOut {
          from { opacity: 1; transform: translateX(-50%) translateY(0); }
          to   { opacity: 0; transform: translateX(-50%) translateY(-8px); }
        }
        @keyframes syncPulse {
          0%, 100% { box-shadow: 0 0 16px rgba(0,173,181,0.4); }
          50%       { box-shadow: 0 0 32px rgba(0,173,181,0.7); }
        }
        @keyframes dotSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Top border — Marching Ants line */}
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0,
        zIndex: 99998,
        pointerEvents: 'none',
        opacity: fading ? 0 : 1,
        transition: 'opacity 0.3s ease',
      }}>
        <svg width="100%" height="4" style={{ display: 'block', overflow: 'visible' }}>
          <defs>
            <linearGradient id="syncGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor="#00ADB5" stopOpacity="0.2" />
              <stop offset="30%"  stopColor="#00ADB5" stopOpacity="1" />
              <stop offset="70%"  stopColor="#00FFF7" stopOpacity="1" />
              <stop offset="100%" stopColor="#00ADB5" stopOpacity="0.2" />
            </linearGradient>
          </defs>
          <line
            x1="0" y1="2" x2="100%" y2="2"
            stroke="url(#syncGrad)"
            strokeWidth="3"
            strokeDasharray="20 12"
            style={{ animation: 'marchingAnts 0.6s linear infinite' }}
          />
        </svg>
      </div>

      {/* Bottom border — Marching Ants line (reverse) */}
      <div style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        zIndex: 99998,
        pointerEvents: 'none',
        opacity: fading ? 0 : 1,
        transition: 'opacity 0.3s ease',
      }}>
        <svg width="100%" height="4" style={{ display: 'block', overflow: 'visible' }}>
          <line
            x1="0" y1="2" x2="100%" y2="2"
            stroke="#00ADB5"
            strokeWidth="2"
            strokeDasharray="20 12"
            strokeOpacity="0.4"
            style={{ animation: 'marchingAnts 0.6s linear infinite reverse' }}
          />
        </svg>
      </div>

      {/* Floating Badge */}
      <div style={{
        position: 'fixed',
        top: '18px',
        left: '50%',
        zIndex: 99999,
        pointerEvents: 'none',
        animation: fading ? 'syncFadeOut 0.3s ease forwards' : 'syncFadeIn 0.2s ease forwards',
      }}>
        <div style={{
          background: 'rgba(0, 10, 14, 0.92)',
          border: '1px solid #00ADB5',
          borderRadius: '28px',
          padding: '8px 18px 8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          animation: 'syncPulse 1.2s ease infinite',
          minWidth: '240px',
          justifyContent: 'center',
        }}>
          {/* Spinning dot */}
          <div style={{
            width: '14px',
            height: '14px',
            borderRadius: '50%',
            border: '2.5px solid rgba(0,173,181,0.3)',
            borderTopColor: '#00ADB5',
            animation: 'dotSpin 0.7s linear infinite',
            flexShrink: 0,
          }} />
          {/* Marching ants inline mini-svg */}
          <svg width="20" height="14" style={{ flexShrink: 0 }}>
            <rect x="1" y="1" width="18" height="12" rx="3"
              fill="none" stroke="#00ADB5" strokeWidth="1.5"
              strokeDasharray="8 4"
              style={{ animation: 'marchingAnts 0.5s linear infinite' }}
            />
          </svg>
          <span style={{
            color: '#00ADB5',
            fontSize: '0.75rem',
            fontWeight: 700,
            letterSpacing: '0.04em',
            whiteSpace: 'nowrap',
            textShadow: '0 0 8px rgba(0,173,181,0.5)',
          }}>
            {displayMsg}
          </span>
        </div>
      </div>
    </>
  );
}

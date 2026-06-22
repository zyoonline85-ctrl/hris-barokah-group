import React from 'react';

export default function PDFCompileOverlay({ isOpen }) {
  if (!isOpen) return null;
  return (
    <>
      <style>{`
        @keyframes marchingAnts {
          0%   { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: -40; }
        }
        @keyframes pulseGlow {
          0%, 100% { text-shadow: 0 0 10px rgba(0,173,181,0.5); }
          50%       { text-shadow: 0 0 20px rgba(0,173,181,0.9); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(10, 10, 10, 0.95)',
        zIndex: 999999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '20px',
        pointerEvents: 'all'
      }}>
        {/* Top Marching Ants Line */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px' }}>
          <svg width="100%" height="4" style={{ display: 'block', overflow: 'visible' }}>
            <line x1="0" y1="2" x2="100%" y2="2" stroke="#00ADB5" strokeWidth="4" strokeDasharray="20 12" style={{ animation: 'marchingAnts 0.3s linear infinite' }} />
          </svg>
        </div>

        {/* Bottom Marching Ants Line */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '4px' }}>
          <svg width="100%" height="4" style={{ display: 'block', overflow: 'visible' }}>
            <line x1="0" y1="2" x2="100%" y2="2" stroke="#00ADB5" strokeWidth="4" strokeDasharray="20 12" style={{ animation: 'marchingAnts 0.3s linear infinite reverse' }} />
          </svg>
        </div>

        {/* Compile Progress Card */}
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
          <span style={{
            color: '#00ADB5',
            fontWeight: 'bold',
            fontSize: '1rem',
            animation: 'pulseGlow 1.5s ease-in-out infinite',
            letterSpacing: '0.05em'
          }}>
            Mengompilasi Data Reaktif & Merangkum Laporan Dokumen PDF...
          </span>
        </div>
      </div>
    </>
  );
}

'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function FloatingContactButton() {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: 'fixed', bottom: '24px', left: '24px', zIndex: 50, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '12px' }}>
      
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', animation: 'fadeInUp 0.3s ease-out' }}>
          <Link href="/ai-assistant" style={{
            background: '#1e3a8a', color: 'white', textDecoration: 'none', borderRadius: '30px',
            padding: '12px 20px', fontSize: '14px', fontWeight: 'bold', boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap'
          }}>
            🤖 چت با Vira AI
          </Link>
          <Link href="/support" style={{
            background: '#16a34a', color: 'white', textDecoration: 'none', borderRadius: '30px',
            padding: '12px 20px', fontSize: '14px', fontWeight: 'bold', boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap'
          }}>
            💬 پشتیبانی
          </Link>
        </div>
      )}

      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '60px', height: '60px', borderRadius: '50%', background: '#1e3a8a', color: 'white',
          border: 'none', cursor: 'pointer', fontSize: '26px', boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.2s'
        }}
      >
        {open ? '✕' : '💬'}
      </button>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

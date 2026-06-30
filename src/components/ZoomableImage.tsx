'use client';

import { useState } from 'react';

type ZoomableImageProps = {
  src: string;
  alt: string;
  size?: number;
  borderColor?: string;
  borderWidth?: number;
  rounded?: boolean;
};

export default function ZoomableImage({
  src,
  alt,
  size = 40,
  borderColor = '#e5e7eb',
  borderWidth = 1,
  rounded = true,
}: ZoomableImageProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <img
        src={src}
        alt={alt}
        onClick={() => setOpen(true)}
        style={{
          width: size + 'px',
          height: size + 'px',
          borderRadius: rounded ? '50%' : '8px',
          objectFit: 'cover',
          display: 'block',
          border: borderWidth + 'px solid ' + borderColor,
          cursor: 'pointer',
        }}
      />

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            cursor: 'zoom-out',
            padding: '24px',
          }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); }}
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              fontSize: '20px',
              fontWeight: 'bold',
              color: '#1e3a8a',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="بستن"
          >
            ×
          </button>
          <img
            src={src}
            alt={alt}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '90vw',
              maxHeight: '85vh',
              borderRadius: '12px',
              border: '3px solid white',
              boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
              objectFit: 'contain',
            }}
          />
        </div>
      )}
    </>
  );
}

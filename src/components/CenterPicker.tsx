'use client';

import { useMemo, useState } from 'react';
import { searchCenters, type CenterRow, type MatchField } from '@/lib/fa';

const input = { width: '100%', marginTop: 6, marginBottom: 8, padding: 10, boxSizing: 'border-box' as const, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 };
const MAX_VISIBLE = 40;

/** انتخاب مرکز مخابراتی با جست‌وجو (نام مرکز، خیابان، محله، شهر یا بخشی از آدرس) و نمایش هم‌زمان نام و آدرس. */
export default function CenterPicker({
  centers,
  value,
  onChange,
  initialQuery = '',
}: {
  centers: CenterRow[];
  value: string;
  onChange: (id: string) => void;
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const selected = centers.find((c) => c.id === value) || null;
  const hits = useMemo(() => searchCenters(centers, query), [centers, query]);

  if (selected) {
    return (
      <div style={{ marginTop: 6, marginBottom: 16, padding: 12, border: '2px solid #1e3a8a', borderRadius: 10, background: '#eff6ff' }}>
        <p style={{ fontWeight: 'bold', color: '#1e3a8a' }}>{selected.name}</p>
        {selected.address && <p style={{ fontSize: 13, color: '#374151', marginTop: 4, lineHeight: 1.8 }}>آدرس: {selected.address}</p>}
        {(selected.city || selected.district) && (
          <p style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{[selected.city, selected.district].filter(Boolean).join(' · ')}</p>
        )}
        <button
          type="button"
          onClick={() => onChange('')}
          style={{ marginTop: 8, background: 'white', color: '#1e3a8a', border: '1px solid #1e3a8a', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13 }}
        >
          تغییر مرکز
        </button>
      </div>
    );
  }

  const visible = hits.slice(0, MAX_VISIBLE);

  return (
    <div style={{ marginBottom: 16 }}>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="نام مرکز، خیابان، محله یا شهر را بنویسید (مثلاً ولنجک)"
        style={input}
        aria-label="جست‌وجوی مرکز مخابراتی"
      />
      <div role="listbox" style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 10, background: 'white' }}>
        {visible.length === 0 && (
          <p style={{ padding: 16, textAlign: 'center', color: '#9ca3af', fontSize: 13, lineHeight: 1.9 }}>
            {centers.length === 0
              ? 'هنوز مرکزی برای انتخاب ثبت نشده است.'
              : 'مرکزی پیدا نشد؛ نام خیابان یا محله را دقیق‌تر بنویسید یا نام شهر را وارد کنید.'}
          </p>
        )}
        {visible.map(({ center: c, matched }) => {
          const viaArea = matched.includes('area' as MatchField) && !matched.includes('address' as MatchField) && !matched.includes('name' as MatchField);
          return (
            <button
              key={c.id}
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => onChange(c.id)}
              style={{ display: 'block', width: '100%', textAlign: 'right', padding: '10px 12px', border: 'none', borderBottom: '1px solid #f3f4f6', background: 'white', cursor: 'pointer' }}
            >
              <span style={{ display: 'block', fontWeight: 'bold', color: '#111827', fontSize: 14 }}>{c.name}</span>
              {c.address && <span style={{ display: 'block', fontSize: 12, color: '#4b5563', marginTop: 3, lineHeight: 1.8 }}>آدرس: {c.address}</span>}
              {viaArea && c.covered_areas && (
                <span style={{ display: 'block', fontSize: 11, color: '#0f766e', marginTop: 2 }}>محله‌های تحت پوشش: {c.covered_areas}</span>
              )}
              {(c.city || c.district) && <span style={{ display: 'block', fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{[c.city, c.district].filter(Boolean).join(' · ')}</span>}
            </button>
          );
        })}
        {hits.length > MAX_VISIBLE && (
          <p style={{ padding: 10, textAlign: 'center', color: '#6b7280', fontSize: 12 }}>
            {(hits.length - MAX_VISIBLE).toLocaleString('fa-IR')} نتیجه‌ی دیگر؛ برای محدودتر شدن، عبارت دقیق‌تری بنویسید.
          </p>
        )}
      </div>
    </div>
  );
}

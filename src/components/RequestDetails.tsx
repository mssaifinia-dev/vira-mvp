'use client';

import type { CatalogMaps } from '@/lib/serviceCatalog';

const line = { fontSize: '14px', color: '#6b7280', marginTop: '4px' } as const;

/** جزئیات تکمیلی یک درخواست خدمت (دسته، خرابی، مرکز، خیابان، فیلدهای فرم). برای درخواست‌های قدیمی چیزی نشان نمی‌دهد. */
export default function RequestDetails({ r, maps: mapsProp }: { r: any; maps: CatalogMaps | null }) {
  let maps = mapsProp;
  const emptyMaps: CatalogMaps = { categories: {}, faults: {}, centers: {}, centerAddress: {}, streets: {}, fields: {} } as unknown as CatalogMaps;
  if (!maps && !r.ftth_number) return null;
  maps = maps || emptyMaps;
  const category = r.category_id ? maps.categories[r.category_id] : '';
  const fault = r.fault_type_id ? maps.faults[r.fault_type_id] : '';
  const center = r.center_id ? maps.centers[r.center_id] : '';
  const centerAddress = r.center_id ? maps.centerAddress[r.center_id] : '';
  const street = r.street_id ? maps.streets[r.street_id] : r.street_text || '';
  const details = Object.entries(r.details || {}).filter(([, v]) => String(v).trim() !== '');

  if (!category && !fault && !center && !street && details.length === 0 && r.priority !== 'urgent' && !r.customer_name && !r.ftth_number) {
    return null;
  }

  return (
    <div>
      {r.priority === 'urgent' && (
        <span style={{ display: 'inline-block', marginTop: '6px', background: '#fee2e2', color: '#dc2626', borderRadius: '6px', padding: '2px 8px', fontSize: '12px', fontWeight: 'bold' }}>
          فوری
        </span>
      )}
      {(category || fault) && (
        <p style={line}>🔧 {[category, fault].filter(Boolean).join(' — ')}</p>
      )}
      {(center || street) && (
        <p style={line}>🏢 {[center, street].filter(Boolean).join(' · ')}</p>
      )}
      {centerAddress && <p style={{ ...line, fontSize: '12px' }}>آدرس مرکز: {centerAddress}</p>}
      {r.customer_name && <p style={line}>👤 {r.customer_name}</p>}
      {r.ftth_number && (
        <p style={line}>📶 شماره مجازی FTTH: <bdi dir="ltr" style={{ color: '#374151', fontWeight: 'bold' }}>{r.ftth_number}</bdi></p>
      )}
      {details.map(([k, v]) => (
        <p key={k} style={line}>
          {(maps.fields[r.category_id + '|' + k] || k) + ': '}
          <span style={{ color: '#374151' }}>{String(v)}</span>
        </p>
      ))}
    </div>
  );
}

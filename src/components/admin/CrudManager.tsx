'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Opt = { value: string; label: string };

export type FieldDef = {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'boolean' | 'select' | 'list' | 'file';
  required?: boolean;
  placeholder?: string;
  hint?: string;
  hideInList?: boolean;
  options?: Opt[];
  optionsFrom?: {
    table?: string;
    rpc?: string;
    select?: string;
    label: (r: any) => string;
    valueKey?: string;
    filter?: Record<string, any>;
  };
  bucket?: string;
  pathPrefix?: string;
  publicUrl?: boolean;
  accept?: string;
};

type Props = {
  table: string;
  title: string;
  fields: FieldDef[];
  defaults?: Record<string, any>;
  fixed?: Record<string, any>;
  orderBy?: string;
  ascending?: boolean;
  emptyText?: string;
  beforeSave?: (payload: Record<string, any>) => string | null; // خطا برمی‌گرداند یا null؛ می‌تواند payload را اصلاح کند
};

const inputStyle = { padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', width: '100%', boxSizing: 'border-box' as const };
const btnAdd = { background: '#16a34a', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 18px', cursor: 'pointer', fontWeight: 'bold' as const, fontSize: '14px' };
const btnMain = { background: '#1e3a8a', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 18px', cursor: 'pointer', fontWeight: 'bold' as const, fontSize: '14px' };
const btnGray = { background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '8px', padding: '10px 18px', cursor: 'pointer', fontSize: '14px' };
const btnEdit = { background: '#1e3a8a', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', fontSize: '12px', marginLeft: '8px' };
const btnDel = { background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', fontSize: '12px' };

export default function CrudManager({
  table,
  title,
  fields,
  defaults = {},
  fixed = {},
  orderBy = 'created_at',
  ascending = true,
  emptyText = 'هنوز موردی ثبت نشده است.',
  beforeSave,
}: Props) {
  const [rows, setRows] = useState<any[]>([]);
  const [optionSets, setOptionSets] = useState<Record<string, Opt[]>>({});
  const [editingId, setEditingId] = useState<string | null>(null); // 'new' | id
  const [form, setForm] = useState<Record<string, any>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState('');

  const load = useCallback(async () => {
    let q: any = supabase.from(table).select('*').order(orderBy, { ascending });
    for (const [k, v] of Object.entries(fixed)) q = q.eq(k, v);
    const res = await q;
    if (res.error) setError(res.error.message);
    setRows(res.data || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, orderBy, ascending]);

  useEffect(() => {
    load();
    (async () => {
      const sets: Record<string, Opt[]> = {};
      for (const f of fields) {
        const of = f.optionsFrom;
        if (!of) continue;
        let data: any[] | null = null;
        if (of.rpc) {
          const res = await supabase.rpc(of.rpc);
          data = res.data as any[] | null;
        } else {
          const build = (skipNull: boolean) => {
            let q: any = supabase.from(of.table as string).select(of.select || '*');
            for (const [k, v] of Object.entries(of.filter || {})) {
              if (v === null) { if (!skipNull) q = q.is(k, null); } else q = q.eq(k, v);
            }
            return q;
          };
          let res = await build(false);
          // ستونِ فیلتر (مثل deleted_at) هنوز وجود ندارد؟ بدون آن بخوان
          if (res.error) res = await build(true);
          data = res.data;
        }
        const vk = of.valueKey || 'id';
        sets[f.name] = (data || []).map((r: any) => ({ value: r[vk], label: of.label(r) }));
      }
      setOptionSets(sets);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function optionsOf(f: FieldDef): Opt[] {
    return f.options || optionSets[f.name] || [];
  }

  function display(f: FieldDef, row: any): string {
    const v = row[f.name];
    if (v === null || v === undefined || v === '') return '—';
    if (f.type === 'boolean') return v ? 'بله' : 'خیر';
    if (f.type === 'list') return Array.isArray(v) ? v.join('، ') : String(v);
    if (f.type === 'file') return '📎 فایل';
    if (f.type === 'select') return optionsOf(f).find((o) => o.value === v)?.label || String(v);
    return String(v);
  }

  function startNew() {
    const init: Record<string, any> = {};
    fields.forEach((f) => (init[f.name] = f.type === 'boolean' ? true : ''));
    setForm(init);
    setEditingId('new');
    setError('');
  }

  function startEdit(row: any) {
    const init: Record<string, any> = {};
    fields.forEach((f) => {
      const v = row[f.name];
      init[f.name] = f.type === 'list' ? (Array.isArray(v) ? v.join('، ') : '') : v ?? (f.type === 'boolean' ? false : '');
    });
    setForm(init);
    setEditingId(row.id);
    setError('');
  }

  async function upload(f: FieldDef, file: File) {
    if (!f.bucket) return;
    setUploading(f.name);
    setError('');
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = (f.pathPrefix || '') + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
    const res = await supabase.storage.from(f.bucket).upload(path, file, { upsert: false });
    setUploading('');
    if (res.error) {
      setError('آپلود ناموفق بود: ' + res.error.message);
      return;
    }
    const value = f.publicUrl ? supabase.storage.from(f.bucket).getPublicUrl(path).data.publicUrl : path;
    setForm((prev) => ({ ...prev, [f.name]: value }));
  }

  async function save() {
    setError('');
    const payload: Record<string, any> = editingId === 'new' ? { ...defaults, ...fixed } : { ...fixed };
    for (const f of fields) {
      let v = form[f.name];
      if (f.type === 'number') v = v === '' || v == null ? null : Number(v);
      else if (f.type === 'boolean') v = !!v;
      else if (f.type === 'list') v = String(v || '').split(/[,،\n]/).map((s) => s.trim()).filter(Boolean);
      else if (v === '' || v === undefined) v = null;

      if (f.required && (v === null || v === '')) {
        setError('«' + f.label + '» الزامی است.');
        return;
      }
      payload[f.name] = v;
    }
    if (fields.some((x) => x.name === 'slug') && !payload.slug) {
      payload.slug = 'item-' + Date.now().toString(36);
    }
    if (beforeSave) {
      const problem = beforeSave(payload);
      if (problem) {
        setError(problem);
        return;
      }
    }

    setBusy(true);
    const res: any =
      editingId === 'new'
        ? await supabase.from(table).insert(payload)
        : await supabase.from(table).update(payload).eq('id', editingId as string);
    setBusy(false);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    setEditingId(null);
    load();
  }

  async function remove(row: any) {
    if (!confirm('این مورد حذف شود؟')) return;
    const res = await supabase.from(table).delete().eq('id', row.id);
    if (res.error) {
      setError(
        res.error.code === '23503'
          ? 'این مورد در جای دیگری استفاده شده و حذف نمی‌شود. به‌جای حذف، آن را «غیرفعال» کنید.'
          : res.error.message
      );
      return;
    }
    load();
  }

  const listFields = fields.filter((f) => !f.hideInList && f.type !== 'textarea').slice(0, 4);

  return (
    <div style={{ background: 'white', borderRadius: '12px', padding: '24px', marginBottom: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e3a8a' }}>{title}</h2>
        {editingId === null && (
          <button onClick={startNew} style={btnAdd}>+ افزودن</button>
        )}
      </div>

      {error && (
        <p style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: '8px', padding: '10px', fontSize: '13px', marginBottom: '12px' }}>{error}</p>
      )}

      {editingId !== null && (
        <div style={{ background: '#f9fafb', borderRadius: '12px', padding: '16px', marginBottom: '16px', display: 'grid', gap: '12px' }}>
          {fields.map((f) => (
            <div key={f.name}>
              {f.type !== 'boolean' && (
                <label style={{ display: 'block', fontSize: '13px', color: '#374151', marginBottom: '4px' }}>
                  {f.label}{f.required && <span style={{ color: '#dc2626' }}> *</span>}
                </label>
              )}

              {f.type === 'textarea' ? (
                <textarea
                  style={{ ...inputStyle, minHeight: '90px' }}
                  placeholder={f.placeholder}
                  value={form[f.name] ?? ''}
                  onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                />
              ) : f.type === 'boolean' ? (
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                  <input type="checkbox" checked={!!form[f.name]} onChange={(e) => setForm({ ...form, [f.name]: e.target.checked })} />
                  {f.label}
                </label>
              ) : f.type === 'select' ? (
                <select style={inputStyle} value={form[f.name] ?? ''} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}>
                  <option value="">{f.required ? 'انتخاب کنید...' : '— (همه / هیچ‌کدام)'}</option>
                  {optionsOf(f).map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : f.type === 'file' ? (
                <div>
                  <input type="file" accept={f.accept} onChange={(e) => e.target.files?.[0] && upload(f, e.target.files[0])} style={{ fontSize: '13px' }} />
                  {uploading === f.name && <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>در حال آپلود... صبر کنید</p>}
                  {form[f.name] && uploading !== f.name && <p style={{ fontSize: '12px', color: '#16a34a', marginTop: '4px' }}>✓ فایل آپلود شد</p>}
                </div>
              ) : (
                <input
                  type={f.type === 'number' ? 'number' : 'text'}
                  style={inputStyle}
                  placeholder={f.placeholder}
                  value={form[f.name] ?? ''}
                  onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                />
              )}
              {f.hint && <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>{f.hint}</p>}
            </div>
          ))}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={save} disabled={busy || uploading !== ''} style={{ ...btnMain, opacity: busy || uploading ? 0.6 : 1 }}>
              {busy ? 'در حال ذخیره...' : 'ذخیره'}
            </button>
            <button onClick={() => setEditingId(null)} style={btnGray}>انصراف</button>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <p style={{ color: '#6b7280', textAlign: 'center', padding: '16px' }}>{emptyText}</p>
      ) : (
        rows.map((row) => (
          <div key={row.id} style={{ background: '#f9fafb', borderRadius: '8px', padding: '14px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {listFields.map((f, i) => (
                <p key={f.name} style={{ fontSize: i === 0 ? '15px' : '12px', fontWeight: i === 0 ? 'bold' : 'normal', color: i === 0 ? '#1e3a8a' : '#6b7280', marginTop: i === 0 ? 0 : '2px', wordBreak: 'break-word' }}>
                  {i === 0 ? '' : f.label + ': '}{display(f, row)}
                </p>
              ))}
            </div>
            <div style={{ whiteSpace: 'nowrap' }}>
              <button onClick={() => startEdit(row)} style={btnEdit}>ویرایش</button>
              <button onClick={() => remove(row)} style={btnDel}>حذف</button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

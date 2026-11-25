'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { flattenTree, loadCategories, type Cat } from '@/lib/categories';
import { can } from '@/lib/permissions';
import { useMyPerms } from '@/lib/useMyPerms';
import { Field, Modal, ReasonModal, badge, btn, inputStyle, useToast } from '@/components/admin/ui';

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

export default function AdminCategoriesPage() {
  const toast = useToast();
  const mine = useMyPerms();
  const [cats, setCats] = useState<Cat[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  const [formOpen, setFormOpen] = useState<null | 'add' | 'edit'>(null);
  const [editing, setEditing] = useState<Cat | null>(null);
  const [form, setForm] = useState({ name: '', slug: '', parent_id: '', sort_order: '0' });
  const [formErr, setFormErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Cat | null>(null);

  const load = useCallback(async () => {
    const list = await loadCategories(true);
    const probe = await supabase.from('product_categories').select('id').limit(1);
    if (probe.error) setMissing(true);
    setCats(list);
    const prods = await supabase.from('products').select('category_id').is('deleted_at', null);
    const m: Record<string, number> = {};
    ((prods.data as any[]) || []).forEach((p) => { if (p.category_id) m[p.category_id] = (m[p.category_id] || 0) + 1; });
    setCounts(m);
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      const userRes = await supabase.auth.getUser();
      const user = userRes.data.user;
      if (!user) { window.location.href = '/auth'; return; }
      const adminRes = await supabase.from('admins').select('id').eq('user_id', user.id).maybeSingle();
      if (!adminRes.data) { window.location.href = '/'; return; }
      load();
    })();
  }, [load]);

  const flat = useMemo(() => flattenTree(cats), [cats]);
  const byId = useMemo(() => { const m: Record<string, Cat> = {}; cats.forEach((c) => (m[c.id] = c)); return m; }, [cats]);
  const childCount = (id: string) => cats.filter((c) => c.parent_id === id).length;
  const subtreeCount = (id: string): number => (counts[id] || 0) + cats.filter((c) => c.parent_id === id).reduce((a, c) => a + subtreeCount(c.id), 0);

  // دسته‌هایی که می‌توان به‌عنوان والد انتخاب کرد (نه خودش و نه زیرمجموعه‌هایش؛ حداکثر ۲ سطح بالاتر)
  function parentOptions(selfId: string | null) {
    const banned = new Set<string>();
    if (selfId) {
      const walk = (id: string) => { banned.add(id); cats.filter((c) => c.parent_id === id).forEach((c) => walk(c.id)); };
      walk(selfId);
    }
    return flat.filter((f) => !banned.has(f.id) && f.depth < 2);
  }

  function openAdd(parentId: string | null) {
    setForm({ name: '', slug: '', parent_id: parentId || '', sort_order: '0' });
    setEditing(null);
    setFormErr('');
    setFormOpen('add');
  }
  function openEdit(c: Cat) {
    setForm({ name: c.name, slug: c.slug, parent_id: c.parent_id || '', sort_order: String(c.sort_order) });
    setEditing(c);
    setFormErr('');
    setFormOpen('edit');
  }

  function friendly(msg: string) {
    if (/23505|duplicate key|unique/i.test(msg)) return 'این شناسه‌ی لاتین قبلاً استفاده شده است';
    if (/23503|foreign key|violates/i.test(msg)) return 'این دسته زیرمجموعه یا محصول دارد؛ به‌جای حذف، آن را غیرفعال کنید';
    return msg;
  }

  async function submit() {
    const name = form.name.trim();
    if (!name) { setFormErr('نام دسته الزامی است'); return; }
    let slug = form.slug.trim().toLowerCase();
    if (formOpen === 'add' && !slug) slug = 'c-' + Date.now().toString(36);
    if (!SLUG_RE.test(slug)) { setFormErr('شناسه‌ی لاتین فقط شامل حروف کوچک انگلیسی، عدد و خط تیره باشد'); return; }
    const order = Number(form.sort_order);
    if (!Number.isFinite(order)) { setFormErr('ترتیب نمایش باید عدد باشد'); return; }

    setSaving(true);
    setFormErr('');
    if (formOpen === 'add') {
      const res = await supabase.from('product_categories').insert({ name, slug, parent_id: form.parent_id || null, sort_order: order }).select('id');
      setSaving(false);
      if (res.error) { setFormErr(friendly(res.error.message)); return; }
      toast.show('ok', 'دسته‌ی جدید ثبت شد.');
    } else if (editing) {
      const res = await supabase.from('product_categories').update({ name, parent_id: form.parent_id || null, sort_order: order }).eq('id', editing.id).select('id');
      setSaving(false);
      if (res.error) { setFormErr(friendly(res.error.message)); return; }
      if (!res.data || res.data.length === 0) { setFormErr('ذخیره انجام نشد (دسترسی ویرایش وجود ندارد)'); return; }
      toast.show('ok', 'دسته ذخیره شد. محصولات و موجودی تغییری نکردند.');
    }
    setFormOpen(null);
    load();
  }

  async function toggleActive(c: Cat) {
    const res = await supabase.from('product_categories').update({ is_active: !c.is_active }).eq('id', c.id).select('id');
    if (res.error || !res.data || res.data.length === 0) { toast.show('err', res.error?.message || 'دسترسی ویرایش وجود ندارد'); return; }
    toast.show('ok', c.is_active ? 'دسته غیرفعال شد و از فروشگاه مخفی می‌شود (محصولات حفظ می‌شوند).' : 'دسته فعال شد.');
    load();
  }

  async function doDelete(c: Cat) {
    const res = await supabase.from('product_categories').delete().eq('id', c.id).select('id');
    if (res.error) { toast.show('err', friendly(res.error.message)); return; }
    if (!res.data || res.data.length === 0) { toast.show('err', 'حذف انجام نشد (دسترسی حذف وجود ندارد)'); return; }
    toast.show('ok', 'دسته حذف شد.');
    load();
  }

  const canCreate = can(mine.perms, 'categories', 'create');
  const canEdit = can(mine.perms, 'categories', 'edit');
  const canDelete = can(mine.perms, 'categories', 'delete');

  return (
    <main style={{ minHeight: '100vh', background: '#f3f4f6', padding: '32px 16px' }} dir="rtl">
      {toast.node}
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 'bold', color: '#1e3a8a' }}>دسته‌بندی‌های فروشگاه و انبار</h1>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {canCreate && !missing && <button onClick={() => openAdd(null)} style={{ ...btn('#1e3a8a'), padding: '9px 16px', fontSize: 13 }}>+ دسته‌ی اصلی</button>}
            <a href="/admin" style={{ color: '#1e3a8a', fontSize: 14, textDecoration: 'none' }}>← بازگشت به پنل اصلی</a>
          </div>
        </div>

        {missing && (
          <div style={{ background: '#fef3c7', color: '#92400e', borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 14 }}>
            جدول دسته‌بندی‌ها هنوز ساخته نشده است. فایل 05_stage4_catalog_inventory.sql را در Supabase اجرا کنید.
          </div>
        )}

        <div style={{ background: '#eef2ff', borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 13, color: '#3730a3', lineHeight: 2 }}>
          دسته‌ها تا ۳ سطح (دسته‌ی اصلی ← زیردسته ← جزئی‌ترین زیردسته) تعریف می‌شوند. در فروشگاه با انتخاب یک دسته‌ی اصلی، همه‌ی محصولات زیرمجموعه‌اش نمایش داده می‌شود. انبار و فروشگاه از همین فهرست استفاده می‌کنند و جابه‌جایی دسته، موجودی و اطلاعات محصول را تغییر نمی‌دهد.
        </div>

        <div style={{ background: 'white', borderRadius: 12, overflow: 'hidden' }}>
          {loading ? (
            <p style={{ padding: 32, textAlign: 'center', color: '#6b7280' }}>در حال بارگذاری...</p>
          ) : flat.length === 0 ? (
            <p style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>دسته‌ای تعریف نشده است</p>
          ) : flat.map((f) => {
            const c = byId[f.id];
            const n = subtreeCount(c.id);
            return (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '10px 14px', paddingRight: 14 + f.depth * 28, borderBottom: '1px solid #f3f4f6', opacity: c.is_active ? 1 : 0.6, background: f.depth === 0 ? '#f9fafb' : undefined }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <span style={{ fontWeight: f.depth === 0 ? 'bold' : 'normal' }}>{f.depth ? '↳ ' : ''}{c.name}</span>
                  <span style={{ fontSize: 11, color: '#9ca3af', marginRight: 8 }} dir="ltr">{c.slug}</span>
                  {!c.is_active && <span style={badge('#fee2e2', '#dc2626')}>غیرفعال</span>}
                </div>
                <span style={{ fontSize: 12, color: '#6b7280' }}>{n.toLocaleString('fa-IR')} محصول</span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {canCreate && f.depth < 2 && <button onClick={() => openAdd(c.id)} style={btn('#e0e7ff', '#1e3a8a')}>+ زیردسته</button>}
                  {canEdit && <button onClick={() => openEdit(c)} style={btn('#dbeafe', '#1d4ed8')}>ویرایش</button>}
                  {canEdit && <button onClick={() => toggleActive(c)} style={btn(c.is_active ? '#fef3c7' : '#d1fae5', c.is_active ? '#d97706' : '#065f46')}>{c.is_active ? 'غیرفعال‌سازی' : 'فعال‌سازی'}</button>}
                  {canDelete && <button onClick={() => setDeleteTarget(c)} style={btn('#fee2e2', '#dc2626')}>حذف</button>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {formOpen && (
        <Modal title={formOpen === 'add' ? 'دسته‌ی جدید' : 'ویرایش دسته'} onClose={() => !saving && setFormOpen(null)} width={480}>
          <Field label="نام دسته *"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} /></Field>
          <Field label="شناسه‌ی لاتین (برای آدرس و کمیسیون؛ بعد از ساخت قابل تغییر نیست)">
            <input dir="ltr" value={form.slug} disabled={formOpen === 'edit'} onChange={(e) => setForm({ ...form, slug: e.target.value })} style={inputStyle} placeholder="مثلاً patch-cord (خالی = خودکار)" />
          </Field>
          <Field label="دسته‌ی والد">
            <select value={form.parent_id} onChange={(e) => setForm({ ...form, parent_id: e.target.value })} style={inputStyle}>
              <option value="">— دسته‌ی اصلی —</option>
              {parentOptions(editing ? editing.id : null).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="ترتیب نمایش (عدد کوچک‌تر بالاتر)"><input inputMode="numeric" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} style={inputStyle} /></Field>
          {formErr && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 10 }}>{formErr}</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button onClick={() => setFormOpen(null)} disabled={saving} style={{ ...btn('#e5e7eb', '#374151'), padding: '8px 18px', fontSize: 13 }}>انصراف</button>
            <button onClick={submit} disabled={saving} style={{ ...btn('#1e3a8a'), padding: '8px 18px', fontSize: 13, opacity: saving ? 0.6 : 1 }}>{saving ? 'در حال ذخیره...' : 'ذخیره'}</button>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <ReasonModal
          title={'حذف دسته «' + deleteTarget.name + '»'}
          description={childCount(deleteTarget.id) > 0 || (counts[deleteTarget.id] || 0) > 0
            ? 'این دسته زیرمجموعه یا محصول دارد؛ سیستم اجازه‌ی حذف نمی‌دهد. به‌جای حذف، آن را غیرفعال کنید.'
            : 'این دسته‌ی خالی برای همیشه حذف می‌شود.'}
          confirmLabel="حذف"
          danger
          requireReason={false}
          onConfirm={() => doDelete(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </main>
  );
}

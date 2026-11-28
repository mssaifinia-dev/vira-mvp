import { NextRequest, NextResponse } from 'next/server';
import { requirePerm, userClient } from '@/lib/serverAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { ImportKind, RowResult, canonicalRow, key, normPhone, specialtyKey, splitList } from '@/lib/importCore';
import { loginEmailFor } from '@/lib/otpCore';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * ورود گروهی با اکسل: تکنسین‌ها، سرپرستان مراکز/مناطق، خیابان‌های مراکز.
 * body: { kind, rows: [{ n, data }], dry_run, options: { create_missing_streets } }
 *  یا  { kind, log: { ... } }  برای ثبت خلاصه در تاریخچه.
 * هر ردیف مستقل است و دوباره‌اجرا کردن فایل بی‌خطر است (موارد تکراری ساخته نمی‌شوند).
 */

type Center = { id: string; name: string; district: string | null };
const yes = (v: unknown, dflt: boolean) => { const k = key(v); if (!k) return dflt; return !['0', 'خیر', 'false', 'no', 'غیرفعال'].includes(k); };
type Street = { id: string; center_id: string; name: string };
type Cat = { id: string; name: string };
type Ref = { centersByKey: Map<string, Center[]>; centers: Center[]; cats: Map<string, Cat>; allCats: Cat[]; streets: Street[] };

async function fetchAll(table: string, select: string, apply?: (q: any) => any): Promise<any[]> {
  const all: any[] = [];
  for (let from = 0; from < 100000; from += 1000) {
    let q: any = supabaseAdmin.from(table).select(select).range(from, from + 999);
    if (apply) q = apply(q);
    const { data, error } = await q;
    if (error) throw new Error(table + ': ' + error.message);
    all.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return all;
}

async function loadRef(): Promise<Ref> {
  const centers: Center[] = await fetchAll('telecom_centers', 'id,name,district', (q) => q.is('deleted_at', null));
  const catsRaw: Cat[] = await fetchAll('service_categories', 'id,name');
  const streets: Street[] = await fetchAll('center_streets', 'id,center_id,name');
  const centersByKey = new Map<string, Center[]>();
  for (const c of centers) {
    const k = key(c.name);
    centersByKey.set(k, [...(centersByKey.get(k) || []), c]);
  }
  const cats = new Map<string, Cat>();
  for (const c of catsRaw) cats.set(key(c.name), c);
  return { centersByKey, centers, cats, allCats: (await fetchAll('service_categories', 'id,name', (q) => q.eq('is_active', true))) as Cat[], streets };
}

// ---- کاربران ----
let userMapCache: Map<string, string> | null = null;
async function getUserMap(): Promise<Map<string, string>> {
  if (userMapCache) return userMapCache;
  const m = new Map<string, string>();
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const u of data.users) if (u.email) m.set(u.email, u.id);
    if (data.users.length < 1000) break;
  }
  userMapCache = m;
  return m;
}

async function ensureUser(phone: string, dry: boolean): Promise<{ id: string | null; created: boolean }> {
  const email = loginEmailFor(phone);
  if (dry) {
    const id = (await getUserMap()).get(email) || null;
    return { id, created: !id };
  }
  const cr = await supabaseAdmin.auth.admin.createUser({ email, password: randomUUID() + 'Aa1!', email_confirm: true });
  if (!cr.error && cr.data.user) {
    if (userMapCache) userMapCache.set(email, cr.data.user.id);
    return { id: cr.data.user.id, created: true };
  }
  if (cr.error && /already|registered|exists/i.test(cr.error.message)) {
    const id = (await getUserMap()).get(email);
    if (id) return { id, created: false };
  }
  throw new Error('ساخت حساب ناموفق: ' + (cr.error ? cr.error.message : 'نامشخص'));
}

function resolveCenters(names: string[], ref: Ref, errors: string[]): Center[] {
  const out: Center[] = [];
  for (const n of names) {
    const hits = ref.centersByKey.get(key(n));
    if (!hits) errors.push('مرکز «' + n + '» یافت نشد');
    else if (hits.length > 1) errors.push('نام مرکز «' + n + '» تکراری است؛ نام را یکتا کنید');
    else if (!out.includes(hits[0])) out.push(hits[0]);
  }
  return out;
}

async function createStreet(center_id: string, name: string, ref: Ref): Promise<Street> {
  const ins = await supabaseAdmin.from('center_streets').insert({ center_id, name, is_active: true }).select('id, center_id, name').single();
  if (ins.error || !ins.data) throw new Error('ساخت خیابان «' + name + '» ناموفق: ' + (ins.error ? ins.error.message : ''));
  ref.streets.push(ins.data as Street);
  return ins.data as Street;
}

type Out = { status: RowResult['status']; message: string };

// ================= تکنسین =================
async function doTechnician(c: Record<string, string>, ref: Ref, opts: { create_missing_streets?: boolean; all_services_if_empty?: boolean }, dry: boolean): Promise<Out> {
  const errors: string[] = [];
  if (!c.full_name) errors.push('نام خالی است');
  if (!c.city) errors.push('شهر خالی است');
  const phone = normPhone(c.phone);
  if (!phone) errors.push('موبایل نامعتبر است');
  const spec = specialtyKey(c.specialty);
  if (!spec) errors.push(c.specialty ? 'تخصص «' + c.specialty + '» شناخته نشد' : 'تخصص خالی است');

  const centers = resolveCenters(splitList(c.centers), ref, errors);

  const services: Cat[] = [];
  for (const n of splitList(c.services)) {
    const hit = ref.cats.get(key(n));
    if (!hit) errors.push('خدمت «' + n + '» یافت نشد');
    else if (!services.includes(hit)) services.push(hit);
  }

  if (services.length === 0 && opts.all_services_if_empty) services.push(...ref.allCats);

  const streetNames = splitList(c.streets);
  if (streetNames.length && centers.length === 0) errors.push('برای تعیین خیابان، نام مرکز لازم است');
  const centerIds = new Set(centers.map((x) => x.id));
  const plannedStreets: { street?: Street; create?: { center: Center; name: string } }[] = [];
  for (const sn of streetNames) {
    const hits = ref.streets.filter((s) => centerIds.has(s.center_id) && key(s.name) === key(sn));
    if (hits.length) hits.forEach((h) => plannedStreets.push({ street: h }));
    else if (opts.create_missing_streets && centers.length === 1) plannedStreets.push({ create: { center: centers[0], name: sn } });
    else errors.push('خیابان «' + sn + '» در مراکز تعیین‌شده یافت نشد');
  }
  if (errors.length) return { status: 'error', message: errors.join(' | ') };

  const user = await ensureUser(phone as string, dry);
  let existing: any = null;
  if (user.id) {
    const ex = await supabaseAdmin.from('technicians').select('id, deleted_at').eq('user_id', user.id).maybeSingle();
    existing = ex.data;
  }
  if (existing && existing.deleted_at) return { status: 'error', message: 'این تکنسین بایگانی شده است؛ ابتدا از پنل بازیابی کنید' };

  const summary =
    (existing ? 'به‌روزرسانی تکنسین' : 'تکنسین جدید') + (user.created ? ' + ساخت حساب' : '') +
    ' | مراکز: ' + centers.length + ' | خیابان: ' + plannedStreets.length + ' | خدمت: ' + services.length;
  if (dry) return { status: existing ? 'updated' : 'ok', message: summary };

  let techId: string;
  if (existing) {
    techId = existing.id;
    const patch: Record<string, unknown> = { full_name: c.full_name, phone, city: c.city, specialty: spec };
    if (c.national_id) patch.national_id = c.national_id;
    if (c.experience) patch.experience = c.experience;
    const up = await supabaseAdmin.from('technicians').update(patch).eq('id', techId);
    if (up.error) return { status: 'error', message: 'به‌روزرسانی ناموفق: ' + up.error.message };
  } else {
    const ins = await supabaseAdmin.from('technicians').insert({
      user_id: user.id, full_name: c.full_name, phone, city: c.city, specialty: spec,
      national_id: c.national_id || '', experience: c.experience || '', is_approved: true,
    }).select('id').single();
    if (ins.error || !ins.data) return { status: 'error', message: 'ثبت تکنسین ناموفق: ' + (ins.error ? ins.error.message : '') };
    techId = ins.data.id;
  }

  // محدوده
  const areasEx = await supabaseAdmin.from('technician_areas').select('center_id, street_id').eq('technician_id', techId);
  const haveAreas = new Set((areasEx.data || []).map((a: any) => a.center_id + '|' + (a.street_id || '')));
  const wantAreas: { center_id: string; street_id: string | null }[] = [];
  if (plannedStreets.length) {
    for (const p of plannedStreets) {
      const s = p.street ? p.street : await createStreet(p.create!.center.id, p.create!.name, ref);
      wantAreas.push({ center_id: s.center_id, street_id: s.id });
    }
  } else {
    for (const ce of centers) wantAreas.push({ center_id: ce.id, street_id: null });
  }
  const newAreas = wantAreas.filter((a) => !haveAreas.has(a.center_id + '|' + (a.street_id || '')));
  if (newAreas.length) {
    const ia = await supabaseAdmin.from('technician_areas').insert(newAreas.map((a) => ({ technician_id: techId, ...a })));
    if (ia.error) return { status: 'error', message: 'تکنسین ثبت شد ولی ثبت محدوده خطا داد: ' + ia.error.message };
  }

  // خدمات
  if (services.length) {
    const svEx = await supabaseAdmin.from('technician_services').select('category_id').eq('technician_id', techId);
    const haveSv = new Set((svEx.data || []).map((x: any) => x.category_id));
    const newSv = services.filter((s) => !haveSv.has(s.id));
    if (newSv.length) {
      const is = await supabaseAdmin.from('technician_services').insert(newSv.map((s) => ({ technician_id: techId, category_id: s.id })));
      if (is.error) return { status: 'error', message: 'تکنسین ثبت شد ولی ثبت خدمات خطا داد: ' + is.error.message };
    }
  }
  return { status: existing ? 'updated' : 'ok', message: summary };
}

// ================= مرکز =================
async function doCenter(c: Record<string, string>, ref: Ref, dry: boolean): Promise<Out> {
  const name = (c.name || '').trim();
  if (!name) return { status: 'error', message: 'نام مرکز خالی است' };
  if (ref.centersByKey.has(key(name))) return { status: 'skipped', message: 'مرکزی با این نام از قبل هست' };
  const verified = yes(c.verified, true);
  if (verified && !(c.address || '').trim()) return { status: 'error', message: 'مرکز تأییدشده باید آدرس داشته باشد (یا ستون «تأییدشده» را «خیر» کنید)' };
  if (dry) return { status: 'ok', message: 'مرکز جدید' + (c.district ? ' در «' + c.district + '»' : '') };
  const ins = await supabaseAdmin.from('telecom_centers').insert({
    name, address: c.address || null, province: c.province || 'تهران', city: c.city || null, district: c.district || null,
    covered_areas: c.covered_areas || null, verification_status: verified ? 'verified' : 'needs_review',
    is_active: yes(c.active, true), source_note: 'ورود گروهی از فایل',
  }).select('id, name, district').single();
  if (ins.error || !ins.data) return { status: 'error', message: 'ثبت مرکز ناموفق: ' + (ins.error ? ins.error.message : '') };
  const center = ins.data as Center;
  ref.centers.push(center);
  ref.centersByKey.set(key(name), [center]);
  return { status: 'ok', message: 'مرکز جدید ساخته شد' };
}

// ================= سرپرست =================
async function doSupervisor(c: Record<string, string>, ref: Ref, dry: boolean): Promise<Out> {
  const errors: string[] = [];
  const phone = normPhone(c.phone);
  if (!phone) errors.push('موبایل نامعتبر است');
  const targets = resolveCenters(splitList(c.centers), ref, errors);
  if (c.district) {
    const dk = key(c.district);
    const inDistrict = ref.centers.filter((x) => key(x.district) === dk);
    if (inDistrict.length === 0) errors.push('منطقه «' + c.district + '» مرکزی ندارد');
    for (const x of inDistrict) if (!targets.includes(x)) targets.push(x);
  }
  if (targets.length === 0 && errors.length === 0) errors.push('مرکز یا منطقه مشخص نشده است');
  if (errors.length) return { status: 'error', message: errors.join(' | ') };

  const user = await ensureUser(phone as string, dry);
  let have = new Set<string>();
  if (user.id) {
    const ex = await supabaseAdmin.from('center_supervisors').select('center_id').eq('user_id', user.id);
    have = new Set((ex.data || []).map((x: any) => x.center_id));
  }
  const fresh = targets.filter((t) => !have.has(t.id));
  const summary = (user.created ? 'ساخت حساب + ' : '') + 'سرپرست ' + targets.length + ' مرکز (' + fresh.length + ' جدید)';
  if (fresh.length === 0) return { status: 'skipped', message: 'همه‌ی این مراکز از قبل ثبت بودند' };
  if (dry) return { status: 'ok', message: summary };

  const ins = await supabaseAdmin.from('center_supervisors').insert(fresh.map((t) => ({ user_id: user.id, center_id: t.id })));
  if (ins.error) return { status: 'error', message: 'ثبت سرپرست ناموفق: ' + ins.error.message };
  return { status: 'ok', message: summary };
}

// ================= خیابان =================
async function doStreets(c: Record<string, string>, ref: Ref, dry: boolean): Promise<Out> {
  const errors: string[] = [];
  const centers = resolveCenters(splitList(c.center), ref, errors);
  if (centers.length !== 1 && errors.length === 0) errors.push('در هر ردیف دقیقاً یک مرکز بنویسید');
  const names = splitList(c.streets);
  if (names.length === 0) errors.push('نام خیابان خالی است');
  if (errors.length) return { status: 'error', message: errors.join(' | ') };

  const center = centers[0];
  const have = new Set(ref.streets.filter((s) => s.center_id === center.id).map((s) => key(s.name)));
  const fresh = Array.from(new Map(names.filter((n) => !have.has(key(n))).map((n) => [key(n), n])).values());
  if (fresh.length === 0) return { status: 'skipped', message: 'همه‌ی خیابان‌ها از قبل ثبت بودند' };
  if (dry) return { status: 'ok', message: fresh.length + ' خیابان جدید برای «' + center.name + '»' };
  for (const n of fresh) await createStreet(center.id, n, ref);
  return { status: 'ok', message: fresh.length + ' خیابان به «' + center.name + '» اضافه شد' };
}

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'درخواست نامعتبر است' }, { status: 400 }); }
  const kind = body.kind as ImportKind;
  if (!['centers', 'technicians', 'supervisors', 'streets'].includes(kind)) return NextResponse.json({ error: 'نوع نامعتبر است' }, { status: 400 });

  const admin = kind === 'technicians' ? await requirePerm(req, 'technicians', 'create') : await requirePerm(req, 'centers', 'edit');
  if (!admin) return NextResponse.json({ error: 'دسترسی ندارید' }, { status: 403 });

  // ثبت خلاصه در تاریخچه
  if (body.log) {
    const uc = userClient(admin.token);
    const r = await uc.rpc('admin_log_event', { p_action: 'import', p_record: kind, p_summary: body.log, p_reason: 'ورود گروهی با اکسل' });
    return NextResponse.json({ ok: !r.error });
  }

  const rows: { n: number; data: Record<string, unknown> }[] = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length === 0 || rows.length > 100) return NextResponse.json({ error: 'تعداد ردیف‌ها در هر درخواست باید بین ۱ تا ۱۰۰ باشد' }, { status: 400 });
  const dry = !!body.dry_run;
  const opts = { create_missing_streets: !!(body.options && body.options.create_missing_streets), all_services_if_empty: !!(body.options && body.options.all_services_if_empty) };

  try {
    const ref = await loadRef();
    const results: RowResult[] = [];
    for (const r of rows) {
      const c = canonicalRow(kind, r.data || {});
      let out: Out;
      try {
        out = kind === 'technicians' ? await doTechnician(c, ref, opts, dry)
          : kind === 'centers' ? await doCenter(c, ref, dry)
          : kind === 'supervisors' ? await doSupervisor(c, ref, dry)
          : await doStreets(c, ref, dry);
      } catch (e: any) {
        out = { status: 'error', message: String((e && e.message) || 'خطای نامشخص') };
      }
      results.push({ row: r.n, status: out.status, message: out.message });
    }
    return NextResponse.json({ results });
  } catch (e: any) {
    return NextResponse.json({ error: String((e && e.message) || 'خطای سرور') }, { status: 500 });
  }
}

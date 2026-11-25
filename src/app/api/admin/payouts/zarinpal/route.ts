import { NextRequest, NextResponse } from 'next/server';
import { requirePerm, userClient } from '@/lib/serverAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * واریز خودکار سهم ذی‌نفع از موجودی پنل زرین‌پال (Payout API).
 *
 * حالت کار با متغیر محیطی ZARINPAL_PAYOUT_MODE:
 *   (خالی) یا off : غیرفعال
 *   sandbox       : فقط اعتبارسنجی و ثبت «شبیه‌سازی»؛ هیچ تماسی با زرین‌پال و هیچ ثبتی در دفتر تسویه انجام نمی‌شود
 *   live          : واریز واقعی (نیازمند ZARINPAL_ACCESS_TOKEN و ZARINPAL_TERMINAL_ID)
 *
 * ترتیب امن: ثبت تلاش (کلید یکتا) → تماس با زرین‌پال → ثبت در دفتر تسویه با finance_create_payout.
 * اگر پول رفت ولی ثبت دفتر خطا داد، تلاش در وضعیت «sent» می‌ماند و با همان کلید فقط ثبت دفتر تکرار می‌شود
 * (پول دوباره ارسال نمی‌شود). اگر نتیجه‌ی تماس با زرین‌پال نامشخص بود (قطع ارتباط)، تلاش در وضعیت
 * «created» می‌ماند و تلاش خودکار مجدد مسدود است تا پنل زرین‌پال دستی بررسی شود.
 */

const GQL_URL = 'https://next.zarinpal.com/api/v4/graphql';
const MIN_RIAL = 100000; // حداقل مبلغ تسهیم فردایی طبق مستندات زرین‌پال
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fail(message: string, status = 400, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

async function gql(token: string, query: string, variables: Record<string, unknown>) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 25000);
  try {
    const res = await fetch(GQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ query, variables }),
      signal: ctl.signal,
    });
    const json: any = await res.json().catch(() => ({}));
    return { httpStatus: res.status, json };
  } finally {
    clearTimeout(timer);
  }
}

function gqlError(r: { httpStatus: number; json: any }): string {
  if (r.httpStatus === 401 || r.httpStatus === 403) return 'توکن زرین‌پال نامعتبر یا منقضی شده است؛ توکن جدید در تنظیمات سرور قرار دهید';
  const e = r.json && r.json.errors && r.json.errors[0];
  if (e && e.message) return String(e.message).slice(0, 300);
  return 'پاسخ نامعتبر از زرین‌پال (کد ' + r.httpStatus + ')';
}

const last4 = (s: string | null | undefined) => (s ? String(s).slice(-4) : null);

export async function POST(req: NextRequest) {
  const mode = String(process.env.ZARINPAL_PAYOUT_MODE || 'off').toLowerCase();
  if (mode !== 'sandbox' && mode !== 'live') {
    return fail('واریز خودکار زرین‌پال فعال نشده است (ZARINPAL_PAYOUT_MODE). فعلاً از «ثبت دستی» استفاده کنید', 503);
  }

  let body: any;
  try { body = await req.json(); } catch { return fail('درخواست نامعتبر است'); }
  const party = String(body.party || '');
  const key = String(body.key || '');
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 300) : '';
  const entryIds: string[] = Array.isArray(body.entry_ids) ? body.entry_ids.map((x: unknown) => String(x)) : [];
  if (!UUID.test(party) || entryIds.length === 0 || entryIds.length > 200 || !entryIds.every((x) => UUID.test(x))) {
    return fail('اطلاعات پرداخت ناقص یا نامعتبر است');
  }
  if (key.length < 8 || key.length > 100) return fail('کلید یکتای پرداخت نامعتبر است');

  // مجوزها: تأیید مالی + دیدن حساب‌های بانکی
  const admin = await requirePerm(req, 'finance', 'approve');
  if (!admin) return fail('دسترسی ندارید', 403);
  const bankOk = await requirePerm(req, 'bank', 'view');
  if (!bankOk) return fail('برای واریز خودکار به مجوز «حساب‌های بانکی» هم نیاز دارید', 403);

  const accessToken = process.env.ZARINPAL_ACCESS_TOKEN || '';
  const terminalId = process.env.ZARINPAL_TERMINAL_ID || '';
  if (mode === 'live' && (!accessToken || !terminalId)) {
    return fail('ZARINPAL_ACCESS_TOKEN یا ZARINPAL_TERMINAL_ID روی سرور تنظیم نشده است', 503);
  }

  const uc = userClient(admin.token);

  try {
    // ---------- ۱) تلاش قبلی با همین کلید ----------
    const prevRes = await supabaseAdmin.from('zarinpal_payout_attempts').select('*').eq('idem_key', key).maybeSingle();
    if (prevRes.error && /zarinpal_payout_attempts|schema cache|relation/i.test(prevRes.error.message)) {
      return fail('ابتدا فایل 11_stage8c_zarinpal_payout_attempts.sql را اجرا کنید', 503);
    }
    const prev: any = prevRes.data || null;
    if (prev) {
      if (prev.party_id !== party) return fail('این کلید پرداخت قبلاً برای ذی‌نفع دیگری استفاده شده است', 409);
      if (prev.status === 'recorded') {
        return NextResponse.json({ ok: true, duplicate: true, ref: prev.provider_url_code || prev.provider_payout_id, amount_toman: Number(prev.amount_toman) });
      }
      if (prev.status === 'created') {
        return fail('نتیجه‌ی تلاش قبلی نامشخص است. برای جلوگیری از واریز تکراری، ابتدا در پنل زرین‌پال بررسی کنید که واریز ثبت شده یا نه', 409);
      }
    }

    // ---------- ۲) اعتبارسنجی ردیف‌ها (با هویت خود مدیر) ----------
    const er = await uc.from('settlement_entries').select('id, party_id, amount, status, payout_id').in('id', entryIds);
    if (er.error) return fail('خواندن ردیف‌ها ناموفق بود: ' + er.error.message, 400);
    const rows: any[] = er.data || [];
    if (rows.length !== new Set(entryIds).size) return fail('بعضی ردیف‌ها یافت نشد یا دسترسی به آن‌ها ندارید');
    if (rows.some((r) => r.party_id !== party)) return fail('فقط ردیف‌های یک ذی‌نفع را می‌توان هم‌زمان پرداخت کرد');
    if (rows.some((r) => r.status !== 'payable' || r.payout_id)) return fail('بعضی ردیف‌ها آماده‌ی پرداخت نیستند یا قبلاً پرداخت شده‌اند');

    const totalToman = rows.reduce((a, r) => a + Number(r.amount), 0);
    const totalRial = Math.round(totalToman * 10);
    if (!Number.isFinite(totalRial) || totalRial <= 0) return fail('جمع مبلغ باید مثبت باشد');
    if (totalRial < MIN_RIAL) return fail('حداقل مبلغ واریز خودکار ' + (MIN_RIAL / 10).toLocaleString('fa-IR') + ' تومان است');

    // ---------- ۳) حساب مقصد ----------
    const pr = await supabaseAdmin.from('settlement_parties').select('id, name, technician_id').eq('id', party).maybeSingle();
    if (!pr.data) return fail('ذی‌نفع یافت نشد', 404);
    let iban: string | null = null;
    let providerAccountId: string | null = null;
    if (pr.data.technician_id) {
      const ta = await supabaseAdmin.from('technician_bank_accounts').select('iban').eq('technician_id', pr.data.technician_id).maybeSingle();
      iban = ta.data?.iban || null;
    } else {
      const pa = await supabaseAdmin.from('settlement_party_accounts').select('*').eq('party_id', party).maybeSingle();
      iban = pa.data?.iban || null;
      providerAccountId = pa.data?.provider_account_id ? String(pa.data.provider_account_id) : null;
    }
    if (!providerAccountId && !iban) return fail('حساب بانکی (شبا) این ذی‌نفع ثبت نشده است');

    // ---------- ۴) ثبت تلاش ----------
    if (!prev) {
      const ins = await supabaseAdmin.from('zarinpal_payout_attempts').insert({
        idem_key: key, party_id: party, entry_ids: entryIds, amount_toman: totalToman, amount_rial: totalRial,
        mode, status: 'created', iban_last4: last4(iban), created_by: admin.userId,
      }).select('id').single();
      if (ins.error) {
        if (/duplicate|unique/i.test(ins.error.message)) return fail('این پرداخت هم‌اکنون در حال انجام است', 409);
        return fail('ثبت تلاش پرداخت ناموفق بود: ' + ins.error.message, 500);
      }
    } else if (prev.status === 'failed' || prev.status === 'simulated') {
      await supabaseAdmin.from('zarinpal_payout_attempts').update({
        status: 'created', mode, error: null, amount_toman: totalToman, amount_rial: totalRial, iban_last4: last4(iban),
        entry_ids: entryIds,
      }).eq('idem_key', key);
    }

    // ---------- ۵) حالت آزمایشی: بدون تماس بیرونی و بدون ثبت در دفتر ----------
    if (mode === 'sandbox') {
      await supabaseAdmin.from('zarinpal_payout_attempts').update({
        status: 'simulated', bank_account_id: providerAccountId, error: null,
      }).eq('idem_key', key);
      return NextResponse.json({
        ok: true, dry_run: true, amount_toman: totalToman, amount_rial: totalRial,
        party: pr.data.name, has_provider_account: !!providerAccountId,
        message: 'حالت آزمایشی: هیچ واریزی انجام نشد و چیزی در دفتر تسویه ثبت نشد.',
      });
    }

    // ---------- ۶) واریز واقعی (اگر قبلاً ارسال نشده) ----------
    let payoutId: string | null = prev && prev.status === 'sent' ? prev.provider_payout_id : null;
    let urlCode: string | null = prev && prev.status === 'sent' ? prev.provider_url_code : null;

    if (!payoutId) {
      // شناسه‌ی حساب در پنل زرین‌پال: از ثبت ذی‌نفع یا با تطبیق شبا
      let bankAccountId = providerAccountId;
      if (!bankAccountId) {
        let ba;
        try {
          ba = await gql(accessToken, 'query { BankAccounts(limit: 200) { id iban holder_name } }', {});
        } catch {
          await supabaseAdmin.from('zarinpal_payout_attempts').update({ status: 'failed', error: 'عدم دسترسی به زرین‌پال هنگام خواندن حساب‌ها' }).eq('idem_key', key);
          return fail('ارتباط با زرین‌پال برقرار نشد؛ هیچ واریزی انجام نشد', 502);
        }
        const list: any[] = (ba.json && ba.json.data && ba.json.data.BankAccounts) || [];
        const want = String(iban).replace(/\s/g, '').toUpperCase();
        const hit = list.find((x) => String(x.iban || '').replace(/\s/g, '').toUpperCase() === want);
        if (!hit) {
          const msg = list.length === 0 && ba.json && ba.json.errors ? gqlError(ba) : 'این شبا در پنل زرین‌پال ثبت و تأیید نشده است';
          await supabaseAdmin.from('zarinpal_payout_attempts').update({ status: 'failed', error: msg }).eq('idem_key', key);
          return fail(msg + '؛ هیچ واریزی انجام نشد', 400);
        }
        bankAccountId = String(hit.id);
      }

      const mutation = `mutation PayoutAdd($terminal_id: ID!, $bank_account_id: ID!, $amount: BigInteger!, $description: String) {
        resource: PayoutAdd(terminal_id: $terminal_id, bank_account_id: $bank_account_id, amount: $amount, description: $description) {
          id url_code status amount
        }
      }`;
      let pa;
      try {
        pa = await gql(accessToken, mutation, {
          terminal_id: terminalId,
          bank_account_id: bankAccountId,
          amount: String(totalRial),
          description: ('ویرا ' + (note || key.slice(0, 8))).slice(0, 100),
        });
      } catch {
        // نتیجه نامشخص: تلاش در وضعیت created می‌ماند تا واریز تکراری رخ ندهد
        await supabaseAdmin.from('zarinpal_payout_attempts').update({ bank_account_id: bankAccountId, error: 'قطع ارتباط حین درخواست؛ نتیجه نامشخص' }).eq('idem_key', key);
        return fail('ارتباط با زرین‌پال در حین ارسال قطع شد و نتیجه نامشخص است. پنل زرین‌پال را بررسی کنید؛ تا آن زمان تلاش مجدد با همین پرداخت مسدود است', 504);
      }
      const res = pa.json && pa.json.data && pa.json.data.resource;
      if (!res || !res.id || (pa.json.errors && pa.json.errors.length)) {
        const msg = gqlError(pa);
        await supabaseAdmin.from('zarinpal_payout_attempts').update({ status: 'failed', bank_account_id: bankAccountId, error: msg }).eq('idem_key', key);
        return fail('زرین‌پال واریز را نپذیرفت: ' + msg + ' (هیچ مبلغی ثبت نشد)', 502);
      }
      payoutId = String(res.id);
      urlCode = res.url_code ? String(res.url_code) : null;
      await supabaseAdmin.from('zarinpal_payout_attempts').update({
        status: 'sent', bank_account_id: bankAccountId, provider_payout_id: payoutId, provider_url_code: urlCode,
        provider_status: res.status ? String(res.status) : null, error: null,
      }).eq('idem_key', key);
    }

    // ---------- ۷) ثبت در دفتر تسویه ----------
    const ref = 'ZP-' + (urlCode || payoutId);
    const led = await uc.rpc('finance_create_payout', {
      p_party: party,
      p_entry_ids: entryIds,
      p_method: 'manual',
      p_ref: ref,
      p_note: ((note ? note + ' | ' : '') + 'واریز خودکار زرین‌پال (شناسه ' + payoutId + ')').slice(0, 400),
      p_key: key,
    });
    if (led.error) {
      await supabaseAdmin.from('zarinpal_payout_attempts').update({ error: 'ثبت دفتر ناموفق: ' + String(led.error.message).slice(0, 300) }).eq('idem_key', key);
      return fail('واریز در زرین‌پال ثبت شد (شناسه ' + payoutId + ') ولی ثبت در دفتر تسویه خطا داد: ' + led.error.message + '. همین پرداخت را دوباره بزنید؛ پول دوباره ارسال نمی‌شود و فقط ثبت دفتر تکرار می‌شود', 500, { sent: true, ref });
    }
    await supabaseAdmin.from('zarinpal_payout_attempts').update({ status: 'recorded', ledger_result: led.data ?? null, error: null }).eq('idem_key', key);

    return NextResponse.json({ ok: true, ref, amount_toman: totalToman, provider_payout_id: payoutId, ledger: led.data ?? null });
  } catch (err: any) {
    return fail(err && err.message ? err.message : 'خطای سرور', 500);
  }
}

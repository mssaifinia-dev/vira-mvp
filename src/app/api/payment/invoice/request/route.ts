import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * پرداخت آنلاین فاکتور خدمات توسط مشتری (زرین‌پال).
 * مبلغ فقط از دیتابیس خوانده می‌شود. پول به حساب شرکت می‌رود و بعد از تأیید مشتری و
 * رضایت‌سنجی، طبق قالب تقسیم بین ذی‌نفعان تسویه می‌شود.
 */
export async function POST(req: NextRequest) {
  try {
    const header = req.headers.get('authorization') || '';
    const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
    if (!token) return NextResponse.json({ error: 'ابتدا وارد حساب کاربری شوید' }, { status: 401 });
    const { data: u, error: uErr } = await supabaseAdmin.auth.getUser(token);
    if (uErr || !u.user) return NextResponse.json({ error: 'نشست شما منقضی شده است' }, { status: 401 });

    const body = await req.json();
    const invoiceId = String(body.invoiceId || '');
    if (!/^[0-9a-f-]{36}$/i.test(invoiceId)) return NextResponse.json({ error: 'اطلاعات ناقص است' }, { status: 400 });

    const { data: inv } = await supabaseAdmin.from('invoices').select('id, request_id, total_amount, status, payment_verified').eq('id', invoiceId).maybeSingle();
    if (!inv) return NextResponse.json({ error: 'فاکتور یافت نشد' }, { status: 404 });

    const { data: reqRow } = await supabaseAdmin.from('service_requests').select('customer_id, phone').eq('id', inv.request_id).maybeSingle();
    if (!reqRow || reqRow.customer_id !== u.user.id) return NextResponse.json({ error: 'این فاکتور متعلق به شما نیست' }, { status: 403 });

    if (inv.status === 'issued') return NextResponse.json({ error: 'ابتدا فاکتور را تأیید کنید' }, { status: 400 });
    if (inv.status === 'void') return NextResponse.json({ error: 'این فاکتور باطل است' }, { status: 400 });
    if (inv.payment_verified) return NextResponse.json({ error: 'پرداخت این فاکتور قبلاً تأیید شده است' }, { status: 400 });

    const amountToman = Number(inv.total_amount);
    if (!Number.isFinite(amountToman) || amountToman <= 0) return NextResponse.json({ error: 'مبلغ فاکتور نامعتبر است' }, { status: 400 });

    const merchantId = process.env.ZARINPAL_MERCHANT_ID;
    if (!merchantId) return NextResponse.json({ error: 'درگاه پرداخت تنظیم نشده است' }, { status: 500 });
    const isSandbox = process.env.ZARINPAL_SANDBOX === 'true';
    const baseUrl = isSandbox ? 'https://sandbox.zarinpal.com' : 'https://payment.zarinpal.com';

    const zarinRes = await fetch(`${baseUrl}/pg/v4/payment/request.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: merchantId,
        amount: Math.round(amountToman * 10), // ریال
        callback_url: `${req.nextUrl.origin}/api/payment/invoice/verify`,
        description: 'پرداخت فاکتور خدمات ویرا',
        metadata: reqRow.phone ? { mobile: String(reqRow.phone).slice(0, 11) } : undefined,
      }),
    });
    const zarinData = await zarinRes.json();
    if (zarinData.data && zarinData.data.code === 100) {
      const authority = String(zarinData.data.authority);
      const upd = await supabaseAdmin.from('invoices').update({ payment_authority: authority }).eq('id', invoiceId);
      if (upd.error) return NextResponse.json({ error: 'ثبت اطلاعات پرداخت ناموفق بود' }, { status: 500 });
      return NextResponse.json({ url: `${baseUrl}/pg/StartPay/${authority}` });
    }
    return NextResponse.json({ error: zarinData.errors?.message || 'خطا در اتصال به درگاه پرداخت' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'خطای سرور' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * شروع پرداخت آنلاین (زرین‌پال).
 * مبلغ هرگز از مرورگر پذیرفته نمی‌شود؛ از جمع سفارش‌های ثبت‌شده‌ی خود کاربر در دیتابیس محاسبه می‌شود.
 */
export async function POST(req: NextRequest) {
  try {
    const header = req.headers.get('authorization') || '';
    const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
    if (!token) return NextResponse.json({ error: 'ابتدا وارد حساب کاربری شوید' }, { status: 401 });
    const { data: u, error: uErr } = await supabaseAdmin.auth.getUser(token);
    if (uErr || !u.user) return NextResponse.json({ error: 'نشست شما منقضی شده است' }, { status: 401 });

    const body = await req.json();
    const orderIds: string[] = Array.isArray(body.orderIds) ? Array.from(new Set(body.orderIds.map(String))) as string[] : [];
    const mobile = typeof body.mobile === 'string' ? body.mobile.slice(0, 11) : '';
    const description = typeof body.description === 'string' ? body.description.slice(0, 200) : '';

    if (orderIds.length === 0 || orderIds.length > 50 || orderIds.some((id) => !/^[0-9a-f-]{36}$/i.test(id))) {
      return NextResponse.json({ error: 'اطلاعات ناقص است' }, { status: 400 });
    }

    const { data: orders, error: oErr } = await supabaseAdmin
      .from('orders')
      .select('id, total_price, payment_status, status, payment_method')
      .in('id', orderIds)
      .eq('user_id', u.user.id);
    if (oErr || !orders || orders.length !== orderIds.length) {
      return NextResponse.json({ error: 'سفارش یافت نشد' }, { status: 404 });
    }
    if (orders.some((o) => o.payment_method !== 'online' || o.status !== 'pending' || o.payment_status === 'paid')) {
      return NextResponse.json({ error: 'این سفارش قابل پرداخت آنلاین نیست یا قبلاً پرداخت شده است' }, { status: 400 });
    }

    const amountToman = orders.reduce((sum, o) => sum + Number(o.total_price), 0);
    if (!Number.isFinite(amountToman) || amountToman <= 0) {
      return NextResponse.json({ error: 'مبلغ سفارش نامعتبر است' }, { status: 400 });
    }

    const merchantId = process.env.ZARINPAL_MERCHANT_ID;
    if (!merchantId) return NextResponse.json({ error: 'درگاه پرداخت تنظیم نشده است' }, { status: 500 });

    const isSandbox = process.env.ZARINPAL_SANDBOX === 'true';
    const baseUrl = isSandbox ? 'https://sandbox.zarinpal.com' : 'https://payment.zarinpal.com';
    // زرین‌پال مبلغ را به ریال می‌گیرد؛ قیمت‌های ما تومان است
    const amountRial = Math.round(amountToman * 10);
    const callbackUrl = `${req.nextUrl.origin}/api/payment/verify`;

    const zarinRes = await fetch(`${baseUrl}/pg/v4/payment/request.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: merchantId,
        amount: amountRial,
        callback_url: callbackUrl,
        description: description || 'خرید از ویرا',
        metadata: mobile ? { mobile } : undefined,
      }),
    });
    const zarinData = await zarinRes.json();

    if (zarinData.data && zarinData.data.code === 100) {
      const authority = String(zarinData.data.authority);
      const upd = await supabaseAdmin.from('orders').update({ payment_authority: authority }).in('id', orderIds).eq('user_id', u.user.id);
      if (upd.error) return NextResponse.json({ error: 'ثبت اطلاعات پرداخت ناموفق بود' }, { status: 500 });
      return NextResponse.json({ url: `${baseUrl}/pg/StartPay/${authority}` });
    }

    const errorMessage = zarinData.errors?.message || 'خطا در اتصال به درگاه پرداخت';
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'خطای سرور' }, { status: 500 });
  }
}

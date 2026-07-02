import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderIds, amountToman, mobile, description } = body;

    if (!orderIds || !orderIds.length || !amountToman) {
      return NextResponse.json({ error: 'اطلاعات ناقص است' }, { status: 400 });
    }

    const isSandbox = process.env.ZARINPAL_SANDBOX === 'true';
    const baseUrl = isSandbox ? 'https://sandbox.zarinpal.com' : 'https://payment.zarinpal.com';
    const merchantId = process.env.ZARINPAL_MERCHANT_ID;

    // زرین‌پال مبلغ را به ریال می‌گیرد؛ قیمت‌های ما تومان است، پس ضربدر ۱۰ می‌کنیم
    const amountRial = Math.round(amountToman * 10);

    const origin = req.nextUrl.origin;
    const callbackUrl = `${origin}/api/payment/verify`;

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
      const authority = zarinData.data.authority;

      // ذخیره authority و مبلغ روی سفارش‌های مرتبط برای تایید بعدی
      await supabase
        .from('orders')
        .update({ payment_authority: authority })
        .in('id', orderIds);

      return NextResponse.json({
        url: `${baseUrl}/pg/StartPay/${authority}`,
      });
    }

    const errorMessage = zarinData.errors?.message || 'خطا در اتصال به درگاه پرداخت';
    return NextResponse.json({ error: errorMessage }, { status: 400 });

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'خطای سرور' }, { status: 500 });
  }
}

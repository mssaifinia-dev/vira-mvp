import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const authority = req.nextUrl.searchParams.get('Authority');
  const status = req.nextUrl.searchParams.get('Status');
  const origin = req.nextUrl.origin;

  if (!authority) {
    return NextResponse.redirect(`${origin}/cart?payment=failed`);
  }

  // پیدا کردن سفارش‌های مرتبط با این authority
  const { data: orders } = await supabase
    .from('orders')
    .select('id, total_price, user_id')
    .eq('payment_authority', authority);

  if (!orders || orders.length === 0) {
    return NextResponse.redirect(`${origin}/cart?payment=failed`);
  }

  if (status !== 'OK') {
    await supabase
      .from('orders')
      .update({ payment_status: 'failed' })
      .eq('payment_authority', authority);
    return NextResponse.redirect(`${origin}/cart?payment=failed`);
  }

  const totalToman = orders.reduce((sum, o) => sum + o.total_price, 0);
  const amountRial = Math.round(totalToman * 10);

  const isSandbox = process.env.ZARINPAL_SANDBOX === 'true';
  const baseUrl = isSandbox ? 'https://sandbox.zarinpal.com' : 'https://payment.zarinpal.com';
  const merchantId = process.env.ZARINPAL_MERCHANT_ID;

  const verifyRes = await fetch(`${baseUrl}/pg/v4/payment/verify.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      merchant_id: merchantId,
      amount: amountRial,
      authority,
    }),
  });

  const verifyData = await verifyRes.json();

  if (verifyData.data && (verifyData.data.code === 100 || verifyData.data.code === 101)) {
    await supabase
      .from('orders')
      .update({ payment_status: 'paid' })
      .eq('payment_authority', authority);

    const userId = orders[0].user_id;
    if (userId) {
      await supabase.from('cart_items').delete().eq('user_id', userId);
    }

    return NextResponse.redirect(`${origin}/my-requests?payment=success`);
  }

  await supabase
    .from('orders')
    .update({ payment_status: 'failed' })
    .eq('payment_authority', authority);

  return NextResponse.redirect(`${origin}/cart?payment=failed`);
}

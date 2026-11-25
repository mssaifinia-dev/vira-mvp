import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * بازگشت از درگاه: تأیید پرداخت از خود زرین‌پال (نه از پارامترهای مرورگر).
 * چند‌بار صدا زدن این آدرس امن است (idempotent) و پرداخت تکراری ثبت نمی‌شود.
 */
export async function GET(req: NextRequest) {
  const authority = req.nextUrl.searchParams.get('Authority');
  const status = req.nextUrl.searchParams.get('Status');
  const origin = req.nextUrl.origin;
  const fail = () => NextResponse.redirect(`${origin}/cart?payment=failed`);

  if (!authority || authority.length > 64) return fail();

  const { data: orders } = await supabaseAdmin
    .from('orders')
    .select('id, total_price, user_id, payment_status')
    .eq('payment_authority', authority);

  if (!orders || orders.length === 0) return fail();

  // قبلاً تأیید شده: تکرار بازگشت از درگاه
  if (orders.every((o) => o.payment_status === 'paid')) {
    return NextResponse.redirect(`${origin}/my-requests?payment=success`);
  }

  if (status !== 'OK') {
    await supabaseAdmin.from('orders').update({ payment_status: 'failed' }).eq('payment_authority', authority).neq('payment_status', 'paid');
    return fail();
  }

  const totalToman = orders.reduce((sum, o) => sum + Number(o.total_price), 0);
  const amountRial = Math.round(totalToman * 10);

  const isSandbox = process.env.ZARINPAL_SANDBOX === 'true';
  const baseUrl = isSandbox ? 'https://sandbox.zarinpal.com' : 'https://payment.zarinpal.com';
  const merchantId = process.env.ZARINPAL_MERCHANT_ID;
  if (!merchantId) return fail();

  let verifyData: any = null;
  try {
    const verifyRes = await fetch(`${baseUrl}/pg/v4/payment/verify.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchant_id: merchantId, amount: amountRial, authority }),
    });
    verifyData = await verifyRes.json();
  } catch {
    return fail();
  }

  if (verifyData && verifyData.data && (verifyData.data.code === 100 || verifyData.data.code === 101)) {
    await supabaseAdmin
      .from('orders')
      .update({
        payment_status: 'paid',
        paid_at: new Date().toISOString(),
        payment_ref_id: verifyData.data.ref_id ? String(verifyData.data.ref_id) : null,
      })
      .eq('payment_authority', authority)
      .neq('payment_status', 'paid');

    const userId = orders[0].user_id;
    if (userId) await supabaseAdmin.from('cart_items').delete().eq('user_id', userId);

    return NextResponse.redirect(`${origin}/my-requests?payment=success`);
  }

  await supabaseAdmin.from('orders').update({ payment_status: 'failed' }).eq('payment_authority', authority).neq('payment_status', 'paid');
  return fail();
}

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** بازگشت از درگاه: تأیید پرداخت فاکتور از خود زرین‌پال (idempotent). */
export async function GET(req: NextRequest) {
  const authority = req.nextUrl.searchParams.get('Authority');
  const status = req.nextUrl.searchParams.get('Status');
  const origin = req.nextUrl.origin;
  if (!authority || authority.length > 64) return NextResponse.redirect(`${origin}/my-requests?payment=failed`);

  const { data: inv } = await supabaseAdmin
    .from('invoices').select('id, request_id, total_amount, payment_verified').eq('payment_authority', authority).maybeSingle();
  if (!inv) return NextResponse.redirect(`${origin}/my-requests?payment=failed`);
  const back = `${origin}/technician/track/${inv.request_id}`;

  if (inv.payment_verified) return NextResponse.redirect(`${back}?payment=success`);
  if (status !== 'OK') return NextResponse.redirect(`${back}?payment=failed`);

  const merchantId = process.env.ZARINPAL_MERCHANT_ID;
  if (!merchantId) return NextResponse.redirect(`${back}?payment=failed`);
  const isSandbox = process.env.ZARINPAL_SANDBOX === 'true';
  const baseUrl = isSandbox ? 'https://sandbox.zarinpal.com' : 'https://payment.zarinpal.com';

  let verifyData: any = null;
  try {
    const r = await fetch(`${baseUrl}/pg/v4/payment/verify.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchant_id: merchantId, amount: Math.round(Number(inv.total_amount) * 10), authority }),
    });
    verifyData = await r.json();
  } catch {
    return NextResponse.redirect(`${back}?payment=failed`);
  }

  if (verifyData && verifyData.data && (verifyData.data.code === 100 || verifyData.data.code === 101)) {
    await supabaseAdmin.from('invoices').update({
      payment_status: 'paid', payment_method: 'online', payment_verified: true,
      payment_ref_id: verifyData.data.ref_id ? String(verifyData.data.ref_id) : null,
      paid_online_at: new Date().toISOString(), customer_paid_at: new Date().toISOString(),
    }).eq('id', inv.id).eq('payment_verified', false);
    await supabaseAdmin.rpc('refresh_settlement_status', { p_kind: 'service_invoice', p_source: inv.id });
    return NextResponse.redirect(`${back}?payment=success`);
  }
  return NextResponse.redirect(`${back}?payment=failed`);
}

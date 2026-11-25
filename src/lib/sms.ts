import { supabase } from '@/lib/supabase';

export async function sendSms(mobile: string, message: string) {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return { error: 'not logged in' };
    const res = await fetch('/api/sms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ mobile, message }),
    });
    return await res.json();
  } catch (e) {
    console.log('SMS send failed', e);
    return { error: 'sms failed' };
  }
}

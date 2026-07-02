export async function sendSms(mobile: string, message: string) {
  try {
    const res = await fetch('/api/sms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile, message }),
    });
    return await res.json();
  } catch (e) {
    console.log('SMS send failed', e);
    return { error: 'sms failed' };
  }
}

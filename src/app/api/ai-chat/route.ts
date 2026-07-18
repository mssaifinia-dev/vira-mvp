import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const { message, userType } = await req.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'پیام معتبر نیست' }, { status: 400 });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'سرویس هوش مصنوعی تنظیم نشده' }, { status: 500 });
    }

    // بار گذاری سوالات متداول از دیتابیس برای context
    const faqsRes = await supabaseAdmin.from('vira_faqs').select('question, answer').limit(30);
    const faqs = faqsRes.data || [];
    const faqContext = faqs.length > 0
      ? '\n\nسوالات متداول ثبت‌شده در سیستم:\n' + faqs.map(f => `س: ${f.question}\nج: ${f.answer}`).join('\n\n')
      : '';

    const systemPrompt = `تو "ویرا هوشمند" هستی، دستیار هوش مصنوعی شرکت تامین ارتباط ویرا در ایران.

⚠️ قانون مهم: همیشه فقط و فقط به زبان فارسی پاسخ بده. هرگز از کلمات یا حروف زبان‌های دیگر (چینی، هندی، عربی و غیره) استفاده نکن. اگر کلمه فنی انگلیسی لازم بود (مثل نام محصول)، فقط همان کلمه انگلیسی رعایت‌شده را بنویس، نه چیز دیگری.

شرکت ویرا در این زمینه‌ها فعالیت می‌کند:
- فروش تجهیزات فیبر نوری، شبکه، دوربین مداربسته و خانه هوشمند (بخش فروشگاه)
- اعزام تکنسین برای رفع خرابی اینترنت، فیبر نوری، تلفن مسی، برق ساختمانی و صنعتی، خانه هوشمند، کانفیگ مودم
- همکاری با فروشندگان سراسر کشور برای فروش تجهیزات نو و استوک
- آکادمی آموزشی با دوره‌ها، ویدئوهای آموزشی (Vira TV)، مقالات فنی و انجمن کاربران

کاربر فعلی: ${userType === 'technician' ? 'یک تکنسین است که ممکن است سوال فنی تخصصی بپرسد' : 'یک مشتری عادی است'}

وظیفه تو:
1. اگر سوال فنی درباره عیب‌یابی است (مثلاً مشکل اینترنت، فیبر نوری، شبکه، برق)، راهنمای گام‌به‌گام و دقیق بده.
2. اگر سوال درباره خرید یا تجهیزات است، راهنمایی کن و به بخش فروشگاه سایت (/marketplace) ارجاع بده.
3. اگر مشکل نیاز به تکنسین دارد، به کاربر بگو در بخش "درخواست تکنسین" (/technician) ثبت درخواست کند.
4. اگر سوال آموزشی است، به آکادمی ویرا (/academy) ارجاع بده.
5. همیشه مودب، دقیق و مفید باش. پاسخ‌ها را کوتاه و کاربردی نگه دار (حداکثر ۶-۸ خط).
6. اگر نمی‌دانی، صادقانه بگو و پیشنهاد کن با پشتیبانی تماس بگیرد.

${faqContext}`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Groq API Error:', data);
      return NextResponse.json({ error: 'خطا در دریافت پاسخ از هوش مصنوعی' }, { status: 500 });
    }

    let aiMessage = data.choices?.[0]?.message?.content || 'متاسفانه نتوانستم پاسخ مناسبی پیدا کنم.';

    // فیلتر کاراکترهای خارجی (چینی، ژاپنی، کره‌ای، هندی و ...) که گاهی مدل اشتباهی تولید می‌کند
    aiMessage = aiMessage.replace(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af\u0900-\u097f]/g, '');

    return NextResponse.json({ reply: aiMessage });

  } catch (err: any) {
    console.error('Vira AI Error:', err);
    return NextResponse.json({ error: 'خطا در پردازش درخواست' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// مدل‌های Groq به ترتیب اولویت — هر دو Production (نه preview) تا با تغییرات آینده‌ی Groq گیر نکنیم
// لیست به‌روز مدل‌های فعال همیشه اینجاست: https://console.groq.com/docs/models
const GROQ_MODELS = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'];

const REQUEST_TIMEOUT_MS = 15000; // بعد از ۱۵ ثانیه درخواست رو قطع کن، کاربر منتظر نمونه

async function callGroq(apiKey: string, model: string, systemPrompt: string, message: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
      signal: controller.signal,
    });

    const data = await response.json();

    if (!response.ok) {
      // خطای دقیق Groq رو برمی‌گردونیم تا بالادست تصمیم بگیره retry کنه یا نه
      const err = new Error(data?.error?.message || `Groq HTTP ${response.status}`);
      (err as any).status = response.status;
      (err as any).code = data?.error?.code;
      throw err;
    }

    return data.choices?.[0]?.message?.content as string | undefined;
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { message, userType } = await req.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'پیام معتبر نیست' }, { status: 400 });
    }

    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      console.error('Vira AI: GROQ_API_KEY تنظیم نشده');
      return NextResponse.json({ error: 'سرویس هوش مصنوعی تنظیم نشده' }, { status: 500 });
    }

    // بار گذاری سوالات متداول از دیتابیس برای context — اگر دیتابیس هم مشکل داشت، چت نباید کلاً بخوابه
    let faqContext = '';
    try {
      const faqsRes = await supabaseAdmin.from('vira_faqs').select('question, answer').limit(30);
      const faqs = faqsRes.data || [];
      faqContext =
        faqs.length > 0
          ? '\n\nسوالات متداول ثبت‌شده در سیستم:\n' +
            faqs.map((f) => `س: ${f.question}\nج: ${f.answer}`).join('\n\n')
          : '';
    } catch (dbErr) {
      console.error('Vira AI: خطا در بارگذاری FAQ از Supabase، بدون context ادامه می‌دهیم', dbErr);
    }

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

    let aiMessage: string | undefined;
    let lastError: any = null;

    // به ترتیب مدل‌ها امتحان می‌کنیم؛ اگر یکی 404 (مدل حذف‌شده) یا 5xx یا rate-limit داد، میریم سراغ بعدی
    for (const model of GROQ_MODELS) {
      try {
        aiMessage = await callGroq(apiKey, model, systemPrompt, message);
        if (aiMessage) {
          if (model !== GROQ_MODELS[0]) {
            console.warn(`Vira AI: مدل اصلی جواب نداد، با fallback (${model}) پاسخ داده شد`);
          }
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.error(`Vira AI: خطا با مدل ${model} →`, err?.status, err?.code, err?.message);
        // اگر خطا401 (کلید نامعتبر) بود، امتحان مدل بعدی هم فایده‌ای نداره
        if (err?.status === 401) break;
        continue;
      }
    }

    if (!aiMessage) {
      // همه‌ی مدل‌ها فیل شدن — حداقل یه جواب مفید به کاربر بدیم، نه فقط پیام خطای خشک
      console.error('Vira AI: تمام مدل‌ها فیل شدند. آخرین خطا:', lastError?.message);
      return NextResponse.json({
        reply:
          'در حال حاضر امکان پاسخ‌گویی هوشمند وجود ندارد. می‌توانید سوال خود را در بخش «تماس با پشتیبانی» مطرح کنید یا کمی بعد دوباره امتحان کنید.',
      });
    }

    // فیلتر کاراکترهای خارجی (چینی، ژاپنی، کره‌ای، هندی و ...) که گاهی مدل اشتباهی تولید می‌کند
    aiMessage = aiMessage.replace(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af\u0900-\u097f]/g, '');

    return NextResponse.json({ reply: aiMessage || 'متاسفانه نتوانستم پاسخ مناسبی پیدا کنم.' });
  } catch (err: any) {
    console.error('Vira AI Error:', err);
    return NextResponse.json({ error: 'خطا در پردازش درخواست' }, { status: 500 });
  }
}
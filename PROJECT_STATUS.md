# 📋 گزارش جامع پروژه تامین ارتباط ویرا (vira-mvp)

> **تاریخ آخرین به‌روزرسانی:** ۲۹ تیر ۱۴۰۵ (19 July 2026)
> این فایل باید در ابتدای هر چت جدید مرتبط با این پروژه ارسال شود تا ادامه‌ی کار بدون نیاز به سؤال اضافه ممکن باشد.

---

## ۱. اطلاعات پایه پروژه

| مورد | مقدار |
|------|-------|
| نام کسب‌وکار | تامین ارتباط ویرا |
| مسیر پروژه (لوکال) | `C:\Users\Administrator\vira-mvp` |
| سیستم‌عامل توسعه | Windows (PowerShell — **نه Bash/Linux**، دستورات `rm -rf` کار نمی‌کنند، باید از `Remove-Item -Recurse -Force` استفاده شود) |
| فریم‌ورک | Next.js 16.2.9 (App Router) با پوشه `src/app/` |
| دیتابیس/بک‌اند | Supabase |
| ریپازیتوری | https://github.com/mssaifinia-dev/vira-mvp (Public) |
| دیپلوی | **Vercel** ✅ فعال |
| دامنه اصلی | https://tamin-vira.ir |
| زبان رابط کاربری | فارسی (RTL) |

### ساختار پوشه‌بندی مهم
```
vira-mvp/
├── src/
│   ├── app/                    ← تمام صفحات و API Routes اینجاست (نه در روت پروژه!)
│   │   ├── admin/               ← پنل مدیریت (چندین زیرصفحه)
│   │   ├── api/                 ← API Routes
│   │   ├── academy/              ← صفحه عمومی آکادمی
│   │   ├── ai-assistant/         ← صفحه عمومی Vira AI
│   │   ├── page.tsx              ← صفحه اصلی سایت
│   │   └── ... (سایر صفحات: marketplace, technician, seller, auth, ...)
│   ├── components/               ← کامپوننت‌های مشترک (Navbar.tsx, FadeInSection.tsx, ...)
│   └── lib/                      ← supabase.ts, supabaseAdmin.ts, sms.ts, strings.ts
├── public/
│   ├── icons/navbar-logo.png
│   └── images/hero-city-bg.jpg   ← عکس پس‌زمینه هدر صفحه اصلی
├── next.config.ts
├── middleware.ts   (⚠️ توجه: Next.js اعلام کرده این convention منسوخ شده و باید به "proxy" مهاجرت کند، فعلاً کار می‌کند)
└── .env.local
```

⚠️ **نکته‌ی حیاتی:** یک‌بار در این پروژه اشتباهاً پوشه‌ی `admin` در روت پروژه (بیرون از `src/app`) ساخته شد که باعث خطای 404 و سردرگمی زیادی شد. **مسیر صحیح همیشه `src/app/admin/...` است.**

---

## ۲. اطلاعات دسترسی (Credentials)

```
NEXT_PUBLIC_SUPABASE_URL=https://kniuozjyeyzqoaewwzee.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_H4zH5Ib4REIJ3UGvTvZLRQ_FpZd9FLL
SUPABASE_SERVICE_ROLE_KEY=**************************
ZARINPAL_MERCHANT_ID=00000000-0000-0000-0000-000000000000  (Sandbox - غیرواقعی)
ZARINPAL_SANDBOX=true
KAVENEGAR_API_KEY=<در .env.local موجود است>
GROQ_API_KEY=<در .env.local موجود است - برای Vira AI>
```

**ایمیل رسمی ویرا (برای ثبت‌نام سرویس‌های آنلاین):**
```
tamin.ertebat.vira@gmail.com
```
این ایمیل برای ساخت اکانت Groq استفاده شد. برای هر سرویس دیگری (Google Ads, Analytics, و غیره) هم از همین ایمیل استفاده شود.

**تفکیک کلاینت‌های Supabase:**
- `lib/supabase.ts` → کلاینت سمت کاربر (Anon Key)
- `lib/supabaseAdmin.ts` → کلاینت سمت سرور با دسترسی کامل (Service Role Key) — فقط در API Routes استفاده شود
- `lib/sms.ts` → helper ارسال پیامک

**ساختار احراز هویت کاربران:**
شماره موبایل کاربر به ایمیل ساختگی تبدیل می‌شود: `vira{phone}@gmail.com` + پسورد کاربر → از طریق Supabase Email Auth وارد می‌شود.

---

## ۳. وضعیت فعلی ماژول‌ها (خلاصه)

### ✅ کاملاً پیاده‌سازی و کارآمد
| ماژول | توضیح |
|-------|-------|
| فروشگاه | محصولات، سبد خرید، سفارش، دسته‌بندی |
| پرداخت | زرین‌پال (Sandbox) + پرداخت در محل |
| درخواست تکنسین | ثبت درخواست، اختصاص، فاکتور |
| فروشندگان | ثبت‌نام، تایید ادمین، داشبورد فروشنده |
| گزارش‌های مالی | درآمد سفارشات، کمیسیون، سود/زیان، حساب‌های بانکی (چارت Recharts) |
| مدیریت انبار | ویرایش دستی + آپلود مستقیم اکسل (بدون نیاز به تبدیل CSV) برای هم بروزرسانی قیمت/موجودی و هم افزودن محصول جدید |
| کدهای تخفیف | مدیریت کامل |
| تبلیغات | چیدمان چپ/راست/وسط با تابع `renderAdRows` در صفحه اصلی |
| بایگانی مشتریان، پیام‌های پشتیبانی | صفحات مجزا در ادمین |
| **آکادمی ویرا** | صفحه عمومی `/academy` با ۵ تب (آموزش/دوره، دسته‌بندی‌ها، Vira TV، Knowledge Base، Community) + پنل مدیریت `/admin/manage-academy` با ۴ تب (دوره، ویدئو، مقاله، انجمن) |
| **Vira AI** | صفحه عمومی `/ai-assistant` — چت **واقعی** متصل به **Groq API** (مدل `llama-3.3-70b-versatile`)، تشخیص خودکار تکنسین/مشتری، استفاده از FAQ های دیتابیس به‌عنوان context، فیلتر خودکار کاراکترهای خارجی (چینی/ژاپنی/کره‌ای/هندی) از پاسخ. مدیریت FAQ در `/admin/manage-ai` |
| پنل ادمین | صفحه اصلی با چیدمان کارتی رنگی برای همه لینک‌های مدیریتی + تب‌های سفارشات/تکنسین‌ها/درخواست‌ها/فروشندگان/محصولات |
| صفحه اصلی (بازطراحی لوکس) | عکس پس‌زمینه شهر هوشمند در هدر، شعار بزرگ، بخش آمار، ۵ کارت اصلی (فروشگاه، تکنسین، Vira AI وسط، آکادمی، فروشندگان)، بخش «چرا ویرا؟»، نظرات مشتریان، نمادهای اعتماد (زرین‌پال + جای اینماد)، انیمیشن fade-in هنگام اسکرول، دکمه شناور چت/پشتیبانی |
| Navbar | لوگو در دایره طوسی با سایه (بالای «درباره ما»)، دکمه‌های ناوبری با سبک شیشه‌ای (Glassmorphism) |
| Performance | `next.config.ts` (webp/avif، compress)، `middleware.ts` (کش تصاویر ۳۰ روز، HTML ۱ ساعت، JS/CSS ۱ سال) |
| دیپلوی | Vercel متصل به GitHub، push خودکار دیپلوی می‌کند |

### ⏳ باقیمانده (عمداً به تعویق افتاده — موقع راه‌اندازی نهایی)
| مورد | وضعیت | جزئیات |
|------|--------|--------|
| 💳 زرین‌پال واقعی | Sandbox فعال است | باید `ZARINPAL_MERCHANT_ID` واقعی و `ZARINPAL_SANDBOX=false` تنظیم شود |
| 📱 پیامک OTP کاوه‌نگار | ناقص | مشکل: fetch از localhost/Vercel به کاوه‌نگار timeout می‌دهد (`UND_ERR_CONNECT_TIMEOUT`). خط پیامکی که خریداری شده (`0018018949161`) از نوع **بین‌المللی** است نه داخلی — نیاز به خرید خط داخلی مناسب OTP یا بررسی علت timeout دارد. الگوی پیامکی «otp» با فرمت `%token` قبلاً در کاوه‌نگار ثبت و تایید شده است. |
| 🛡️ نماد اعتماد الکترونیکی (اینماد) | placeholder گذاشته شده | تا وقتی گرفته نشود، باکس با برچسب «به‌زودی» در صفحه اصلی نمایش داده می‌شود (`src/app/page.tsx`، بخش «نمادهای اعتماد») |
| 🗄️ مهاجرت از Supabase به دیتابیس ایرانی | فقط ایده — اختیاری/آینده | |

---

## ۴. جزئیات فنی مهم برای توسعه‌ی آینده

### ۴.۱ سیستم Vira AI (چگونه کار می‌کند)
- فایل API: `src/app/api/ai-chat/route.ts`
- فایل صفحه: `src/app/ai-assistant/page.tsx`
- مدل: Groq → `llama-3.3-70b-versatile` (رایگان، بدون کارت بانکی، چون فراخوانی از سرور Vercel در اروپا/آمریکا انجام می‌شود، فیلترینگ ایران مشکلی ایجاد نمی‌کند)
- System prompt شامل توضیح کسب‌وکار ویرا + تمام سوالات جدول `vira_faqs` (حداکثر ۳۰ مورد) به‌عنوان دانش اختصاصی
- کلید API در `.env.local`: `GROQ_API_KEY`
- **باگ شناخته‌شده و حل‌شده:** مدل گاهی کاراکترهای زبان‌های دیگر (چینی/ژاپنی/هندی) وسط پاسخ فارسی تولید می‌کرد → حل شد با (۱) دستور اکید در system prompt، (۲) کاهش `temperature` به `0.3`، (۳) فیلتر regex بعد از دریافت پاسخ که این رنج‌های یونیکد را حذف می‌کند: `[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af\u0900-\u097f]`
- کاربرد پنل مدیریت FAQ (`/admin/manage-ai`): هر سوال/جواب ثبت‌شده مستقیماً به مدل AI به‌عنوان دانش اختصاصی داده می‌شود تا جواب‌های دقیق و مخصوص کسب‌وکار (نه جواب عمومی) بدهد.

### ۴.۲ جداول دیتابیس مرتبط با آکادمی و AI (این جلسه ساخته شدند)
```sql
academy_courses (id, title, category, description, created_at)
academy_videos (id, title, category, video_url, description, created_at)
academy_articles (id, title, category, content, created_at)
academy_community_posts (id, title, description, created_at)
vira_faqs (id, question, answer, created_at)
```
همه با RLS فعال: فقط ادمین‌ها (جدول `admins`) می‌توانند insert/update/delete کنند؛ همه می‌توانند select کنند (به‌جز vira_faqs که فقط سمت سرور خوانده می‌شود).

### ۴.۳ چیدمان تبلیغات در صفحه اصلی
تابع `renderAdRows` در `src/app/page.tsx` بر اساس فیلد `alignment` (`right`/`left`/`center`/`full`) چیدمان را تعیین می‌کند:
- دو تبلیغ متوالی با alignment مخالف (راست+چپ) → کنار هم (۴۶٪ عرض هرکدام)
- تبلیغ تنها با alignment راست/چپ → گوشه مربوطه (۴۶٪ عرض)
- alignment=center → وسط (حداکثر ۵۰۰px)
- alignment=full → تمام عرض

### ۴.۴ مدیریت انبار (Excel)
فایل: `src/app/admin/inventory/page.tsx`
- بخش ۱: بروزرسانی قیمت/موجودی محصولات موجود — آپلود مستقیم `.xlsx` (کتابخانه `xlsx`/SheetJS)، تطبیق بر اساس ستون «نام محصول»
- بخش ۲: افزودن محصولات جدید — آپلود `.xlsx` با ستون‌های `name, category, description, price, stock, image`
- هر دو بخش دکمه «دانلود فایل نمونه» دارند که مستقیم `.xlsx` تولید می‌کند (نه CSV)

### ۴.۵ RLS Policies نمونه (الگوی استاندارد پروژه)
```sql
alter table TABLE_NAME enable row level security;

create policy "Admins can manage X" on TABLE_NAME for all to authenticated
  using (exists (select 1 from admins where user_id = auth.uid()))
  with check (exists (select 1 from admins where user_id = auth.uid()));

create policy "Everyone can view X" on TABLE_NAME for select to public using (true);
```

---

## ۵. اشتباهات رایج و درس‌های آموخته‌شده (برای جلوگیری از تکرار)

1. **Windows PowerShell ≠ Bash.** هرگز `rm -rf`، `mkdir -p` (بدون syntax صحیح) پیشنهاد نشود. معادل‌های صحیح:
   - `rm -rf folder` → `Remove-Item -Recurse -Force folder`
   - `mkdir -p path` → `mkdir path` معمولاً در PowerShell کار می‌کند اگر پوشه‌های والد از قبل موجود باشند
2. **مسیر صحیح صفحات همیشه `src/app/...` است**، نه پوشه‌ی `app/` در روت پروژه.
3. **Encoding فایل‌ها باید UTF-8 باشد** — یک‌بار متن فارسی داخل یک فایل جدید به‌صورت کاراکترهای خراب (mojibake) ذخیره شد.
4. **تگ `<label>` نباید تودرتو (nested) باشد** — این باعث رندر نادرست دکمه‌های آپلود فایل شد؛ همیشه دو `<label>` جدا برای دو دکمه‌ی آپلود مجزا بسازید.
5. **کاوه‌نگار API از سمت localhost/Vercel با خطای connect timeout مواجه شد** — دلیل دقیق مشخص نشد (شاید فیلترینگ یا مشکل خط پیامکی خریداری‌شده). سرویس‌های دیگر (مثل Groq) که سرورشان خارج از ایران است مشکلی نداشتند چون فراخوانی از Vercel (نه از ایران) انجام می‌شود.
6. **جواب Kavenegar از فیلد `result` استفاده می‌کند نه `return`** در برخی endpoint ها — همیشه دقیق response واقعی را لاگ و بررسی کنید قبل از فرض کردن ساختار.
7. **قبل از ساخت هر فایل جدید در ادمین، مسیر دقیق را با کاربر تایید کنید** — یک‌بار فولدر اشتباه در روت پروژه ساخته شد که باعث سردرگمی و خطای «Manifest file is empty» و 404 های متعدد شد.
8. برای گرفتن API Key سرویس‌های خارجی از ایران: سرویس‌هایی که فقط با ایمیل/GitHub کار می‌کنند (نه شماره موبایل) ساده‌ترند — مثل Groq. Google/Gemini برای شماره‌های ایرانی احراز هویت را سخت می‌گیرد.

---

## ۶. لینک‌های مهم پنل ادمین (`/admin`)

| لینک | مسیر |
|------|------|
| گزارش‌های کلی | `/admin/reports` |
| پیام‌های پشتیبانی | `/admin/support` |
| بایگانی مشتریان | `/admin/customers` |
| کدهای تخفیف | `/admin/discounts` |
| سود و زیان (گزارش مالی + حساب بانکی) | `/admin/finance` |
| مدیریت انبار (Excel) | `/admin/inventory` |
| تبلیغات | `/admin/advertisements` |
| درباره ما | `/admin/about` |
| مدیریت آکادمی | `/admin/manage-academy` |
| مدیریت Vira AI | `/admin/manage-ai` |
| محصولات | `/admin/products` |
| سفارش‌ها | `/admin/orders` |
| فروشندگان | `/admin/sellers` |

---

## ۷. نحوه استفاده از این گزارش

اگر در چت جدیدی نیاز به توسعه یا رفع باگ در این پروژه بود:
1. این فایل کامل را در ابتدای مکالمه ارسال کنید.
2. اگر فایل کد خاصی نیاز به ویرایش دارد که محتوایش اینجا نیست، محتوای فعلی آن فایل را هم ضمیمه کنید (چون این گزارش summary است نه backup کامل کد).
3. بکاپ کامل کد در فایل‌های zip با نام‌گذاری `vira-mvp-backup-YYYY-MM-DD-HHmm.zip` نگهداری می‌شود.

---

**پایان گزارش**

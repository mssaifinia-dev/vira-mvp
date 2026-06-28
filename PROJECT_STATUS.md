# وضعیت پروژه ویرا MVP - آخرین بروزرسانی: ۲ تیر ۱۴۰۵ (ادامه)

## معرفی پروژه
- نام: تامین ارتباط ویرا
- مسیر: C:\Users\Administrator\vira-mvp
- Supabase URL: https://kniuozjyeyzqoaewwzee.supabase.co
- آخرین بکاپ: vira-mvp-backup-23june-v2.zip

## ✅ تازه تکمیل شد (همین جلسه):
**پرداخت در محل** - ستون `payment_method` (online/cash_on_delivery) به `orders` اضافه شد. در `/cart` دو دکمه انتخاب روش پرداخت (💳 آنلاین / 💵 در محل) اضافه شد، انتخاب در orders ذخیره می‌شود.

**⚠️ کار ناتمام:** نمایش `payment_method` در پنل ادمین (تب سفارشات `/admin`) هنوز اضافه نشده - باید یک ستون "روش پرداخت" به جدول سفارشات در `admin/page.tsx` اضافه شود.

## نقشه راه ۱۹ موردی - وضعیت خلاصه (برای جزئیات کامل هر مورد، بکاپ‌های قبلی یا تاریخچه چت را ببین)
✅ تکمیل: ترجمه محصول، فیلتر تاریخ شمسی گزارش، رضایتمندی+هشدار، کنترل دسترسی، بایگانی مشتری+CSV، کد تخفیف، باطری شارژی، قیمت اصلی/شگفت‌انگیز/سود مشتری، سیستم انبار+CSV، جستجوی پیشرفته، **پرداخت در محل (نیمه - نمایش ادمین باقی)**

❌ باقیمانده: گزارش سود/زیان واقعی، تبلیغات درون‌برنامه‌ای، ورود محصول جدید گروهی با اکسل
❓ نامشخص: مورد #۵ "حساب کدو تا داریم" - باید از مرتضی بپرسیم
🔜 منتظر اقدام مرتضی: زرین‌پال، دامنه .ir، پنل پیامکی واقعی، ترب
🎯 هدف بزرگ: اپ ویندوز/اندروید/iOS (پروژه جدا)

## نکته حیاتی Encoding
فارسی جدید فقط در `strings.ts` (Unicode escape، کل فایل را جایگزین کن) یا مستقیم در صفحات جدیدتر (که خودشان سالم‌اند). برای فایل‌های بزرگ همیشه کل فایل را بده، نه Find&Replace.

## ⚠️ نکته مهم محدودیت گفتگو (برای خودم/AI بعدی):
مرتضی به محدودیت طول گفتگو حساس است (گفت "90 درصد استفاده کردی"). **در ادامه باید:**
- سوال‌های تاییدی غیرضروری را کم کنم، مستقیم‌تر کد بدهم
- برای کارهای کوچک، توضیح کمتر و کد بیشتر
- به محض احساس نزدیک شدن به انتهای گفتگو، فوراً بکاپ بگیرم و این فایل را آپدیت کنم بدون اینکه منتظر بمانم

## ساختار کامل صفحات
### فروشگاه: `/`, `/marketplace`, `/product/[id]`, `/cart` (تخفیف+پرداخت در محل/آنلاین), `/order/[id]`, `/auth`, `/my-requests`, `/notifications`, `/support`
### فروشنده: `/seller/register`, `/seller/dashboard`
### تکنسین: `/technician/register`, `/technician`, `/technician/track/[id]`, `/technician/dashboard`, `/technician/invoice/[id]`
### مدیریت: `/admin` (۵ تب + ۵ لینک: گزارش‌ها، پشتیبانی، بایگانی مشتری، تخفیف، انبار)، `/admin/reports`, `/admin/support`, `/admin/customers`, `/admin/discounts`, `/admin/inventory`

## جداول دیتابیس (آخرین ستون اضافه‌شده: `orders.payment_method`)
```sql
products: ...,seller_id, original_price, is_special_offer
orders: ...,commission_amount, seller_payout, seller_id, discount_code, discount_amount, payment_method (جدید)
-- بقیه جداول بدون تغییر از جلسه قبل: sellers, admins, cart_items, technicians, service_requests, invoices, invoice_items, category_commissions, support_tickets, notifications, customer_archive, discount_codes
```

## قدم بعدی دقیق (شروع فوری جلسه بعد):
1. **اول این:** اضافه کردن نمایش "روش پرداخت" به جدول سفارشات در `/admin/page.tsx` (ستون جدید: آنلاین/در محل)
2. از مرتضی بپرس: منظور از "حساب کدو تا داریم" چیست
3. گزارش سود/زیان واقعی
4. تبلیغات درون‌برنامه‌ای
5. ورود محصول گروهی با اکسل (نه فقط آپدیت قیمت موجود)

## نحوه تست:
سبد خرید → روش پرداخت انتخاب کن (آنلاین یا در محل) → تایید نهایی → باید در دیتابیس `orders.payment_method` مقدار درست ذخیره شود (چک با SQL: `SELECT payment_method FROM orders ORDER BY created_at DESC LIMIT 1;`)
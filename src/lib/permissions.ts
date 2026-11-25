// تعریف ماژول‌ها و انواع دسترسی (مشترک بین صفحه‌ی مدیران، منوها و سرور)

export const PERM_TYPES = [
  { key: 'view', label: 'مشاهده' },
  { key: 'create', label: 'افزودن' },
  { key: 'edit', label: 'ویرایش' },
  { key: 'delete', label: 'حذف' },
  { key: 'view_archive', label: 'مشاهده بایگانی' },
  { key: 'restore', label: 'بازیابی' },
  { key: 'report', label: 'گزارش‌گیری' },
  { key: 'approve', label: 'تأیید' },
  { key: 'manage', label: 'مدیریت کامل' },
] as const;

export const PERM_MODULES = [
  { key: 'customers', label: 'مشتریان' },
  { key: 'sellers', label: 'فروشندگان' },
  { key: 'technicians', label: 'تکنسین‌ها و امتیازها' },
  { key: 'requests', label: 'درخواست‌های تکنسین' },
  { key: 'centers', label: 'مراکز مخابراتی و خیابان‌ها' },
  { key: 'services', label: 'خدمات و فرم‌ها' },
  { key: 'inventory', label: 'انبار و محصولات' },
  { key: 'categories', label: 'دسته‌بندی‌ها' },
  { key: 'orders', label: 'سفارش‌ها' },
  { key: 'finance', label: 'امور مالی و فاکتورها' },
  { key: 'bank', label: 'حساب‌های بانکی' },
  { key: 'discounts', label: 'کدهای تخفیف' },
  { key: 'academy', label: 'آکادمی' },
  { key: 'advertisements', label: 'تبلیغات' },
  { key: 'content', label: 'محتوا (درباره ما، Vira AI)' },
  { key: 'support', label: 'پشتیبانی' },
  { key: 'reports', label: 'گزارش‌ها' },
  { key: 'history', label: 'تاریخچه و بازگردانی' },
  { key: 'backups', label: 'پشتیبان‌گیری' },
  { key: 'admins', label: 'مدیران و دسترسی‌ها' },
] as const;

export type MyPerms = {
  admin: boolean;
  super: boolean;
  full_name?: string | null;
  perms: Record<string, string[]>;
};

/** آیا مدیر در این ماژول، این دسترسی (یا «مدیریت کامل») را دارد؟ */
export function can(p: MyPerms | null, module: string, perm: string = 'view'): boolean {
  if (!p || !p.admin) return false;
  if (p.super) return true;
  const list = p.perms[module] || [];
  return list.includes(perm) || list.includes('manage');
}

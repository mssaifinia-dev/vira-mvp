// تعریف ماژول‌های پشتیبان‌گیری (مشترک بین صفحه‌ی مدیریت و سرور)

export type BackupModule = { key: string; label: string; tables: string[] };

export const BACKUP_MODULES: BackupModule[] = [
  { key: 'customers', label: 'مشتریان', tables: ['customer_archive'] },
  { key: 'sellers', label: 'فروشندگان', tables: ['sellers', 'seller_payouts'] },
  { key: 'technicians', label: 'تکنسین‌ها', tables: ['technicians', 'technician_areas', 'technician_services', 'technician_scopes', 'technician_requests'] },
  { key: 'requests', label: 'درخواست‌های تکنسین', tables: ['service_requests', 'service_request_events'] },
  { key: 'centers', label: 'مراکز مخابراتی و خیابان‌ها', tables: ['telecom_centers', 'center_streets', 'center_supervisors', 'telecom_center_audit'] },
  { key: 'catalog', label: 'خدمات و فرم‌ها', tables: ['service_categories', 'service_fault_types', 'service_form_fields'] },
  { key: 'shop', label: 'فروشگاه و انبار', tables: ['products', 'category_commissions', 'cart_items'] },
  { key: 'orders', label: 'سفارش‌ها و کدهای تخفیف', tables: ['orders', 'discount_codes'] },
  { key: 'finance', label: 'مالی (فاکتور، حساب بانکی، هزینه‌ها)', tables: ['invoices', 'invoice_items', 'bank_accounts', 'business_expenses', 'daily_revenue', 'seller_payouts'] },
  { key: 'academy', label: 'آکادمی', tables: ['academy_categories', 'academy_courses', 'academy_videos', 'academy_articles', 'academy_files', 'academy_community_posts'] },
  { key: 'ads', label: 'تبلیغات', tables: ['advertisements'] },
  { key: 'content', label: 'درباره ما و Vira AI', tables: ['about_content', 'about_images', 'vira_faqs'] },
  { key: 'support', label: 'پشتیبانی و اعلان‌ها', tables: ['support_tickets', 'notifications'] },
  { key: 'security', label: 'مدیران و تاریخچه تغییرات', tables: ['admins', 'audit_log', 'audit_undos'] },
  { key: 'system', label: 'سیستم', tables: ['vira_migration_log'] },
];

// کلید اصلی جدول‌هایی که id ندارند
export const PRIMARY_KEY: Record<string, string> = { vira_migration_log: 'name' };

export const ALL_TABLES: string[] = Array.from(new Set(BACKUP_MODULES.flatMap((m) => m.tables)));

// جدول‌هایی که هرگز از طریق «بازیابی» بازنویسی نمی‌شوند (امنیتی یا فقط‌افزودنی)
export const NEVER_RESTORE = ['audit_log', 'audit_undos', 'admins'];

// ترتیب بازیابی: ابتدا جدول‌های والد، بعد وابسته‌ها
export const RESTORE_ORDER: string[] = [
  'telecom_centers', 'center_streets', 'service_categories', 'service_fault_types', 'service_form_fields',
  'technicians', 'technician_areas', 'technician_services', 'technician_scopes', 'center_supervisors',
  'sellers', 'products', 'category_commissions', 'discount_codes', 'customer_archive',
  'service_requests', 'service_request_events', 'invoices', 'invoice_items', 'orders', 'cart_items',
  'seller_payouts', 'bank_accounts', 'business_expenses', 'daily_revenue',
  'academy_categories', 'academy_courses', 'academy_videos', 'academy_articles', 'academy_files', 'academy_community_posts',
  'advertisements', 'about_content', 'about_images', 'vira_faqs',
  'support_tickets', 'notifications', 'technician_requests', 'telecom_center_audit', 'vira_migration_log',
];

export function isRestorable(table: string): boolean {
  return RESTORE_ORDER.includes(table) && !NEVER_RESTORE.includes(table);
}

export const KIND_LABEL: Record<string, string> = {
  manual: 'دستی',
  pre_change: 'قبل از تغییر مهم',
  scheduled: 'زمان‌بندی‌شده',
  module: 'خروجی ماژول',
  pre_restore: 'قبل از بازیابی',
};

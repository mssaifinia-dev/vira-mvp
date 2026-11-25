import { supabase } from '@/lib/supabase';

export type Cat = {
  id: string;
  parent_id: string | null;
  slug: string;
  name: string;
  sort_order: number;
  is_active: boolean;
};

/** دسته‌بندی‌ها را می‌خواند؛ اگر جدول هنوز ساخته نشده باشد، فهرست خالی برمی‌گرداند (کد قبلی با فهرست ثابت کار می‌کند). */
export async function loadCategories(includeInactive = false): Promise<Cat[]> {
  let q = supabase.from('product_categories').select('id,parent_id,slug,name,sort_order,is_active').order('sort_order', { ascending: true }).order('name', { ascending: true });
  if (!includeInactive) q = q.eq('is_active', true);
  const res = await q;
  if (res.error || !res.data) return [];
  return res.data as Cat[];
}

const children = (cats: Cat[], parent: string | null) => cats.filter((c) => c.parent_id === parent);

/** فهرست مسطح با عمق (برای select و نمایش درختی) */
export function flattenTree(cats: Cat[]): { id: string; slug: string; label: string; depth: number }[] {
  const out: { id: string; slug: string; label: string; depth: number }[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const c of children(cats, parent)) {
      out.push({ id: c.id, slug: c.slug, label: (depth ? '— '.repeat(depth) : '') + c.name, depth });
      walk(c.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

/** خود دسته و همه‌ی زیردسته‌های آن (برای نمایش همه‌ی محصولات زیرمجموعه) */
export function descendantSlugs(cats: Cat[], slug: string): string[] {
  const root = cats.find((c) => c.slug === slug);
  if (!root) return [slug];
  const out = [root.slug];
  const walk = (id: string) => {
    for (const c of children(cats, id)) {
      out.push(c.slug);
      walk(c.id);
    }
  };
  walk(root.id);
  return out;
}

export function categoryLabel(cats: Cat[], slug: string, fallback?: string): string {
  const c = cats.find((x) => x.slug === slug);
  return c ? c.name : fallback ?? slug;
}

export function categoryDepth(cats: Cat[], slug: string): number {
  let depth = 0;
  let cur = cats.find((c) => c.slug === slug);
  while (cur && cur.parent_id && depth < 8) {
    cur = cats.find((c) => c.id === cur!.parent_id);
    depth++;
  }
  return depth;
}

/**
 * دسته‌های قابل نمایش در فیلتر فروشگاه: دسته‌های اصلی که محصول دارند،
 * و زیردسته‌های دسته‌ی انتخاب‌شده (یا دسته‌ای که زیرمجموعه‌اش انتخاب شده).
 */
export function chipSlugs(cats: Cat[], presentSlugs: string[], selected: string[]): string[] {
  const present = new Set(presentSlugs);
  const hasProducts = (c: Cat) => descendantSlugs(cats, c.slug).some((s) => present.has(s));
  const out: string[] = [];
  const walk = (parent: string | null) => {
    for (const c of children(cats, parent)) {
      if (!hasProducts(c)) continue;
      out.push(c.slug);
      const open = selected.some((s) => descendantSlugs(cats, c.slug).includes(s));
      if (open) walk(c.id);
    }
  };
  walk(null);
  // محصولاتی که دسته‌شان در درخت نیست (دادهٔ قدیمی) هم از دست نروند
  presentSlugs.forEach((s) => { if (!cats.some((c) => c.slug === s) && !out.includes(s)) out.push(s); });
  return out;
}

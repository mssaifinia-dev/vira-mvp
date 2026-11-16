import { supabase } from '@/lib/supabase';

export type CatalogMaps = {
  categories: Record<string, string>;
  faults: Record<string, string>;
  centers: Record<string, string>;
  centerAddress: Record<string, string>;
  streets: Record<string, string>;
  fields: Record<string, string>; // `${categoryId}|${key}` -> label
};

/** نام دسته‌ها، خرابی‌ها، مراکز، خیابان‌ها و عنوان فیلدها برای نمایش درخواست‌ها. اگر SQL هنوز اجرا نشده باشد، خالی برمی‌گرداند. */
export async function loadCatalogMaps(): Promise<CatalogMaps> {
  const maps: CatalogMaps = { categories: {}, faults: {}, centers: {}, centerAddress: {}, streets: {}, fields: {} };
  try {
    const [cats, faults, centers, streets, fields] = await Promise.all([
      supabase.from('service_categories').select('id,name'),
      supabase.from('service_fault_types').select('id,name'),
      // بدون فیلتر حذف/تأیید: درخواست‌های قبلی همچنان نام و آدرس مرکزِ خود را نشان می‌دهند
      supabase.from('telecom_centers').select('id,name,address'),
      supabase.from('center_streets').select('id,name'),
      supabase.from('service_form_fields').select('category_id,key,label'),
    ]);
    (cats.data || []).forEach((r: any) => (maps.categories[r.id] = r.name));
    (faults.data || []).forEach((r: any) => (maps.faults[r.id] = r.name));
    let centerRows: any[] = centers.data || [];
    if (centers.error) centerRows = (await supabase.from('telecom_centers').select('id,name')).data || [];
    centerRows.forEach((r: any) => { maps.centers[r.id] = r.name; if (r.address) maps.centerAddress[r.id] = r.address; });
    (streets.data || []).forEach((r: any) => (maps.streets[r.id] = r.name));
    (fields.data || []).forEach((r: any) => (maps.fields[r.category_id + '|' + r.key] = r.label));
  } catch {
    /* نادیده گرفته می‌شود */
  }
  return maps;
}

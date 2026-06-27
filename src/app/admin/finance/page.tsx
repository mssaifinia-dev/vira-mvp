'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Expense = {
  id: string;
  title: string;
  amount: number;
  category: string;
  expense_date: string;
};

const expenseCategories = [
  { value: 'salary', label: 'حقوق و دستمزد' },
  { value: 'rent', label: 'اجاره و ساختمان' },
  { value: 'marketing', label: 'تبلیغات و بازاریابی' },
  { value: 'software', label: 'نرم‌افزار و سرور' },
  { value: 'other', label: 'سایر' },
];

export default function AdminFinancePage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totalCommissionRevenue, setTotalCommissionRevenue] = useState(0);
  const [loading, setLoading] = useState(true);

  const [newTitle, setNewTitle] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newCategory, setNewCategory] = useState('other');
  const [error, setError] = useState('');

  useEffect(() => {
    checkAdminAndFetch();
  }, []);

  async function checkAdminAndFetch() {
    const userRes = await supabase.auth.getUser();
    const user = userRes.data.user;
    if (!user) { window.location.href = '/auth'; return; }

    const adminRes = await supabase.from('admins').select('id').eq('user_id', user.id).maybeSingle();
    if (!adminRes.data) { window.location.href = '/'; return; }

    fetchAll();
  }

  async function fetchAll() {
    const expensesRes = await supabase.from('business_expenses').select('*').order('expense_date', { ascending: false });
    setExpenses(expensesRes.data || []);

    const ordersRes = await supabase.from('orders').select('commission_amount');
    const invoicesRes = await supabase.from('invoices').select('commission_amount');

    let revenue = 0;
    for (const o of ordersRes.data || []) revenue += o.commission_amount || 0;
    for (const inv of invoicesRes.data || []) revenue += inv.commission_amount || 0;

    setTotalCommissionRevenue(revenue);
    setLoading(false);
  }

  async function addExpense() {
    setError('');
    if (!newTitle || !newAmount) {
      setError('عنوان و مبلغ الزامی است');
      return;
    }

    await supabase.from('business_expenses').insert({
      title: newTitle,
      amount: Number(newAmount),
      category: newCategory,
    });

    setNewTitle('');
    setNewAmount('');
    setNewCategory('other');
    fetchAll();
  }

  async function deleteExpense(id: string) {
    await supabase.from('business_expenses').delete().eq('id', id);
    fetchAll();
  }

  let totalExpenses = 0;
  for (const e of expenses) totalExpenses += e.amount;

  const netProfit = totalCommissionRevenue - totalExpenses;

  if (loading) {
    return (
      <main style={{minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center"}}>
        <p style={{color:"#1e3a8a"}}>در حال بارگذاری...</p>
      </main>
    );
  }

  return (
    <main style={{minHeight:"100vh", background:"#f3f4f6", padding:"32px 16px"}} dir="rtl">
      <div style={{maxWidth:"800px", margin:"0 auto"}}>

        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"24px"}}>
          <h1 style={{fontSize:"22px", fontWeight:"bold", color:"#1e3a8a"}}>سود و زیان</h1>
          <a href="/admin" style={{color:"#1e3a8a", fontSize:"14px", textDecoration:"none"}}>← بازگشت</a>
        </div>

        <div style={{display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:"12px", marginBottom:"24px"}}>
          <div style={{background:"white", borderRadius:"12px", padding:"16px", textAlign:"center"}}>
            <p style={{fontSize:"18px", fontWeight:"bold", color:"#16a34a"}}>{totalCommissionRevenue.toLocaleString('fa-IR')}</p>
            <p style={{fontSize:"12px", color:"#6b7280", marginTop:"4px"}}>درآمد پورسانت (تومان)</p>
          </div>
          <div style={{background:"white", borderRadius:"12px", padding:"16px", textAlign:"center"}}>
            <p style={{fontSize:"18px", fontWeight:"bold", color:"#dc2626"}}>{totalExpenses.toLocaleString('fa-IR')}</p>
            <p style={{fontSize:"12px", color:"#6b7280", marginTop:"4px"}}>کل هزینه‌ها (تومان)</p>
          </div>
          <div style={{background: netProfit >= 0 ? "#1e3a8a" : "#dc2626", borderRadius:"12px", padding:"16px", textAlign:"center"}}>
            <p style={{fontSize:"18px", fontWeight:"bold", color:"white"}}>{netProfit.toLocaleString('fa-IR')}</p>
            <p style={{fontSize:"12px", color:"rgba(255,255,255,0.8)", marginTop:"4px"}}>{netProfit >= 0 ? 'سود خالص' : 'زیان خالص'}</p>
          </div>
        </div>

        <div style={{background:"white", borderRadius:"12px", padding:"20px", marginBottom:"24px"}}>
          <p style={{fontWeight:"bold", marginBottom:"16px"}}>ثبت هزینه جدید</p>
          <div style={{display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:"12px", marginBottom:"12px"}}>
            <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="عنوان هزینه" style={{border:"1px solid #d1d5db", borderRadius:"8px", padding:"8px 10px"}} />
            <input type="number" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} placeholder="مبلغ (تومان)" style={{border:"1px solid #d1d5db", borderRadius:"8px", padding:"8px 10px"}} />
            <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} style={{border:"1px solid #d1d5db", borderRadius:"8px", padding:"8px 10px"}}>
              {expenseCategories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          {error ? <p style={{color:"red", fontSize:"13px", marginBottom:"8px"}}>{error}</p> : null}
          <button onClick={addExpense} style={{background:"#16a34a", color:"white", border:"none", borderRadius:"8px", padding:"8px 20px", cursor:"pointer", fontSize:"13px"}}>
            ثبت هزینه
          </button>
        </div>

        <div style={{background:"white", borderRadius:"12px", overflow:"hidden"}}>
          <table style={{width:"100%", borderCollapse:"collapse", textAlign:"right"}}>
            <thead style={{background:"#1e3a8a", color:"white"}}>
              <tr>
                <th style={{padding:"12px"}}>عنوان</th>
                <th style={{padding:"12px"}}>دسته</th>
                <th style={{padding:"12px"}}>مبلغ</th>
                <th style={{padding:"12px"}}>تاریخ</th>
                <th style={{padding:"12px"}}>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 ? (
                <tr><td colSpan={5} style={{padding:"24px", textAlign:"center", color:"#9ca3af"}}>هزینه‌ای ثبت نشده</td></tr>
              ) : expenses.map(e => (
                <tr key={e.id} style={{borderBottom:"1px solid #f3f4f6"}}>
                  <td style={{padding:"12px"}}>{e.title}</td>
                  <td style={{padding:"12px", color:"#6b7280", fontSize:"13px"}}>{expenseCategories.find(c => c.value === e.category)?.label || e.category}</td>
                  <td style={{padding:"12px", color:"#dc2626"}}>{e.amount.toLocaleString('fa-IR')}</td>
                  <td style={{padding:"12px", color:"#6b7280", fontSize:"13px"}}>{e.expense_date}</td>
                  <td style={{padding:"12px"}}>
                    <button onClick={() => deleteExpense(e.id)} style={{background:"#fee2e2", color:"#dc2626", border:"none", borderRadius:"6px", padding:"4px 10px", cursor:"pointer", fontSize:"12px"}}>حذف</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </main>
  );
}
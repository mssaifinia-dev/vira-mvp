'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type FinanceData = {
  totalOrderRevenue: number;
  commissionRevenue: number;
  technicianRevenue: number;
  businessExpenses: number;
  totalExpenses: number;
  netProfit: number;
  bankAccounts: Array<{
    id: string;
    bank_name: string;
    account_number: string;
    card_number: string;
    account_holder: string;
    balance: number;
  }>;
  totalBankBalance: number;
};

export default function FinancePage() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [newAccount, setNewAccount] = useState({ 
    bank_name: '', 
    account_number: '', 
    card_number: '',
    account_holder: '', 
    balance: 0 
  });
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchFinanceData();
  }, []);

  async function fetchFinanceData() {
    const ordersRes = await supabase
      .from('orders')
      .select('total_price');
    const totalOrderRevenue = ordersRes.data?.reduce((sum, o) => sum + (o.total_price || 0), 0) || 0;

    const commissionRes = await supabase
      .from('orders')
      .select('commission_amount')
      .not('commission_amount', 'is', null);
    const commissionRevenue = commissionRes.data?.reduce((sum, o) => sum + (o.commission_amount || 0), 0) || 0;

    const invoicesRes = await supabase
      .from('technician_invoices')
      .select('total_amount');
    const technicianRevenue = invoicesRes.data?.reduce((sum, i) => sum + (i.total_amount || 0), 0) || 0;

    const expensesRes = await supabase
      .from('business_expenses')
      .select('amount');
    const businessExpenses = expensesRes.data?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;

    const bankRes = await supabase.from('bank_accounts').select('*');
    const bankAccounts = bankRes.data || [];
    const totalBankBalance = bankAccounts.reduce((sum, b) => sum + (b.balance || 0), 0);

    const totalExpenses = businessExpenses;
    const totalRevenue = totalOrderRevenue + technicianRevenue;
    const netProfit = totalRevenue - totalExpenses;

    setData({
      totalOrderRevenue,
      commissionRevenue,
      technicianRevenue,
      businessExpenses,
      totalExpenses,
      netProfit,
      bankAccounts,
      totalBankBalance,
    });
    setLoading(false);
  }

  async function addBankAccount() {
    if (!newAccount.bank_name || !newAccount.account_holder) {
      alert('نام بانک و نام دارنده الزامی هستند');
      return;
    }

    setAdding(true);
    const res = await supabase.from('bank_accounts').insert([newAccount]);
    if (!res.error) {
      setNewAccount({ bank_name: '', account_number: '', card_number: '', account_holder: '', balance: 0 });
      fetchFinanceData();
    } else {
      alert('خطا در افزودن حساب: ' + res.error.message);
    }
    setAdding(false);
  }

  async function deleteBankAccount(id: string) {
    await supabase.from('bank_accounts').delete().eq('id', id);
    fetchFinanceData();
  }

  if (loading) return <main style={{minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center"}}><p>در حال بارگذاری...</p></main>;

  return (
    <main style={{minHeight:"100vh", background:"#f3f4f6", padding:"32px 16px"}} dir="rtl">
      <div style={{maxWidth:"1000px", margin:"0 auto"}}>

        <h1 style={{fontSize:"28px", fontWeight:"bold", color:"#1e3a8a", marginBottom:"24px"}}>
          📊 گزارش مالی
        </h1>

        {/* درآمدها */}
        <div style={{background:"white", borderRadius:"16px", padding:"24px", marginBottom:"24px"}}>
          <h2 style={{fontSize:"20px", fontWeight:"bold", color:"#111827", marginBottom:"16px"}}>💰 درآمدها</h2>
          
          <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(250px, 1fr))", gap:"16px"}}>
            <div style={{background:"#dcfce7", borderRadius:"12px", padding:"16px"}}>
              <p style={{color:"#6b7280", fontSize:"14px"}}>درآمد کل سفارشات</p>
              <p style={{fontSize:"24px", fontWeight:"bold", color:"#16a34a", marginTop:"8px"}}>
                {data?.totalOrderRevenue.toLocaleString('fa-IR')} تومان
              </p>
            </div>

            <div style={{background:"#dbeafe", borderRadius:"12px", padding:"16px"}}>
              <p style={{color:"#6b7280", fontSize:"14px"}}>درآمد کمیسیون فروشندگان</p>
              <p style={{fontSize:"24px", fontWeight:"bold", color:"#0284c7", marginTop:"8px"}}>
                {data?.commissionRevenue.toLocaleString('fa-IR')} تومان
              </p>
            </div>

            <div style={{background:"#fcd34d", borderRadius:"12px", padding:"16px"}}>
              <p style={{color:"#6b7280", fontSize:"14px"}}>درآمد سرویس تکنسین</p>
              <p style={{fontSize:"24px", fontWeight:"bold", color:"#ca8a04", marginTop:"8px"}}>
                {data?.technicianRevenue.toLocaleString('fa-IR')} تومان
              </p>
            </div>
          </div>
        </div>

        {/* هزینه‌ها */}
        <div style={{background:"white", borderRadius:"16px", padding:"24px", marginBottom:"24px"}}>
          <h2 style={{fontSize:"20px", fontWeight:"bold", color:"#111827", marginBottom:"16px"}}>💸 هزینه‌ها</h2>
          
          <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(250px, 1fr))", gap:"16px"}}>
            <div style={{background:"#fee2e2", borderRadius:"12px", padding:"16px"}}>
              <p style={{color:"#6b7280", fontSize:"14px"}}>هزینه‌های تجاری</p>
              <p style={{fontSize:"24px", fontWeight:"bold", color:"#dc2626", marginTop:"8px"}}>
                {data?.businessExpenses.toLocaleString('fa-IR')} تومان
              </p>
            </div>
          </div>
        </div>

        {/* خلاصه مالی */}
        <div style={{background:"white", borderRadius:"16px", padding:"24px", marginBottom:"24px"}}>
          <h2 style={{fontSize:"20px", fontWeight:"bold", color:"#111827", marginBottom:"16px"}}>📈 خلاصه مالی</h2>
          
          <div style={{borderTop:"1px solid #e5e7eb", paddingTop:"16px"}}>
            <div style={{display:"flex", justifyContent:"space-between", padding:"12px 0", borderBottom:"1px solid #f3f4f6"}}>
              <span style={{color:"#6b7280"}}>کل درآمد:</span>
              <span style={{fontWeight:"bold", color:"#1e3a8a"}}>
                {((data?.totalOrderRevenue || 0) + (data?.technicianRevenue || 0)).toLocaleString('fa-IR')} تومان
              </span>
            </div>
            <div style={{display:"flex", justifyContent:"space-between", padding:"12px 0", borderBottom:"1px solid #f3f4f6"}}>
              <span style={{color:"#6b7280"}}>کل هزینه:</span>
              <span style={{fontWeight:"bold", color:"#dc2626"}}>
                {data?.totalExpenses.toLocaleString('fa-IR')} تومان
              </span>
            </div>
            <div style={{display:"flex", justifyContent:"space-between", padding:"12px 0"}}>
              <span style={{color:"#6b7280", fontSize:"16px", fontWeight:"bold"}}>سود خالص:</span>
              <span style={{fontSize:"20px", fontWeight:"bold", color: (data?.netProfit || 0) >= 0 ? "#16a34a" : "#dc2626"}}>
                {data?.netProfit.toLocaleString('fa-IR')} تومان
              </span>
            </div>
          </div>
        </div>

        {/* حساب‌های بانکی */}
        <div style={{background:"white", borderRadius:"16px", padding:"24px"}}>
          <h2 style={{fontSize:"20px", fontWeight:"bold", color:"#111827", marginBottom:"16px"}}>🏦 حساب‌های بانکی</h2>

          {/* موجودی کل */}
          <div style={{background:"#eff6ff", borderRadius:"12px", padding:"16px", marginBottom:"16px"}}>
            <p style={{color:"#6b7280", fontSize:"14px"}}>موجودی کل</p>
            <p style={{fontSize:"24px", fontWeight:"bold", color:"#0284c7", marginTop:"8px"}}>
              {data?.totalBankBalance.toLocaleString('fa-IR')} تومان
            </p>
          </div>

          {/* لیست حساب‌ها */}
          {data?.bankAccounts && data.bankAccounts.length > 0 ? (
            <div style={{marginBottom:"20px"}}>
              {data.bankAccounts.map((account) => (
                <div key={account.id} style={{background:"#f9fafb", borderRadius:"8px", padding:"16px", marginBottom:"12px", border:"1px solid #e5e7eb"}}>
                  <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start"}}>
                    <div style={{flex:1}}>
                      <p style={{fontWeight:"bold", color:"#111827", fontSize:"16px"}}>{account.bank_name}</p>
                      
                      {account.account_number && (
                        <p style={{fontSize:"14px", color:"#6b7280", marginTop:"8px"}}>
                          شماره حساب: 
                          <span style={{direction:"ltr", unicodeBidi:"bidi-override", marginLeft:"8px", fontWeight:"bold", fontFamily:"monospace", color:"#1e3a8a", display:"inline-block"}}>
                            {account.account_number}
                          </span>
                        </p>
                      )}
                      
                      {account.card_number && (
                        <p style={{fontSize:"14px", color:"#6b7280", marginTop:"6px"}}>
                          شماره کارت: 
                          <span style={{direction:"ltr", unicodeBidi:"bidi-override", marginLeft:"8px", fontWeight:"bold", fontFamily:"monospace", color:"#1e3a8a", display:"inline-block"}}>
                            {account.card_number}
                          </span>
                        </p>
                      )}
                      
                      <p style={{fontSize:"14px", color:"#6b7280", marginTop:"6px"}}>
                        نام دارنده: {account.account_holder}
                      </p>
                      <p style={{fontSize:"15px", color:"#0284c7", marginTop:"8px", fontWeight:"bold"}}>
                        موجودی: {account.balance.toLocaleString('fa-IR')} تومان
                      </p>
                    </div>
                    <button
                      onClick={() => deleteBankAccount(account.id)}
                      style={{color:"#dc2626", background:"none", border:"none", cursor:"pointer", fontSize:"14px", marginLeft:"12px", padding:"4px 8px"}}
                    >
                      حذف
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{color:"#9ca3af", fontSize:"14px", marginBottom:"16px"}}>حساب بانکی ثبت نشده</p>
          )}

          {/* فرم افزودن حساب */}
          <div style={{borderTop:"1px solid #e5e7eb", paddingTop:"16px"}}>
            <p style={{fontWeight:"bold", marginBottom:"12px", fontSize:"16px"}}>➕ افزودن حساب جدید</p>
            
            <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))", gap:"12px", marginBottom:"12px"}}>
              <input
                type="text"
                placeholder="نام بانک (الزامی)"
                value={newAccount.bank_name}
                onChange={(e) => setNewAccount({...newAccount, bank_name: e.target.value})}
                style={{border:"1px solid #d1d5db", borderRadius:"8px", padding:"10px", boxSizing:"border-box"}}
              />
              <input
                type="text"
                placeholder="شماره حساب (اختیاری)"
                value={newAccount.account_number}
                onChange={(e) => setNewAccount({...newAccount, account_number: e.target.value})}
                style={{border:"1px solid #d1d5db", borderRadius:"8px", padding:"10px", boxSizing:"border-box"}}
              />
              <input
                type="text"
                placeholder="شماره کارت (اختیاری)"
                value={newAccount.card_number}
                onChange={(e) => setNewAccount({...newAccount, card_number: e.target.value})}
                style={{border:"1px solid #d1d5db", borderRadius:"8px", padding:"10px", boxSizing:"border-box"}}
              />
              <input
                type="text"
                placeholder="نام دارنده (الزامی)"
                value={newAccount.account_holder}
                onChange={(e) => setNewAccount({...newAccount, account_holder: e.target.value})}
                style={{border:"1px solid #d1d5db", borderRadius:"8px", padding:"10px", boxSizing:"border-box"}}
              />
              <input
                type="number"
                placeholder="موجودی (تومان)"
                value={newAccount.balance}
                onChange={(e) => setNewAccount({...newAccount, balance: parseInt(e.target.value) || 0})}
                style={{border:"1px solid #d1d5db", borderRadius:"8px", padding:"10px", boxSizing:"border-box"}}
              />
            </div>

            <button
              onClick={addBankAccount}
              disabled={adding}
              style={{background:"#1e3a8a", color:"white", padding:"10px 20px", borderRadius:"8px", border:"none", cursor:"pointer", fontWeight:"bold", opacity: adding ? 0.5 : 1}}
            >
              {adding ? 'در حال افزودن...' : 'افزودن حساب'}
            </button>
          </div>
        </div>

      </div>
    </main>
  );
}

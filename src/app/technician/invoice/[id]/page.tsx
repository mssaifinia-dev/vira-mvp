'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { strings } from '@/lib/strings';

type Request = {
  id: string;
  description: string;
  address: string;
  technician_id: string;
};

type PartItem = {
  name: string;
  price: string;
};

const COMMISSION_PERCENT = 15;
const TAX_PERCENT = 10;

export default function InvoicePage() {
  const { id } = useParams();
  const [request, setRequest] = useState<Request | null>(null);
  const [parts, setParts] = useState<PartItem[]>([{ name: '', price: '' }]);
  const [laborCost, setLaborCost] = useState('');
  const [transportCost, setTransportCost] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [existingInvoice, setExistingInvoice] = useState<any>(null);
  const [existingItems, setExistingItems] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, [id]);

  async function fetchData() {
    const { data: req } = await supabase
      .from('service_requests')
      .select('*')
      .eq('id', id)
      .single();
    setRequest(req);

    const { data: inv } = await supabase
      .from('invoices')
      .select('*')
      .eq('request_id', id)
      .maybeSingle();

    if (inv) {
      setExistingInvoice(inv);
      const { data: items } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', inv.id);
      setExistingItems(items || []);
    }
  }

  function addPartRow() {
    setParts([...parts, { name: '', price: '' }]);
  }

  function removePartRow(index: number) {
    setParts(parts.filter((_, i) => i !== index));
  }

  function updatePart(index: number, field: 'name' | 'price', value: string) {
    const updated = [...parts];
    updated[index][field] = value;
    setParts(updated);
  }

  const partsTotal = parts.reduce((sum, p) => sum + (parseFloat(p.price) || 0), 0);
  const labor = parseFloat(laborCost) || 0;
  const transport = parseFloat(transportCost) || 0;
  const subtotal = partsTotal + labor + transport;
  const tax = Math.round(subtotal * (TAX_PERCENT / 100));
  const total = subtotal + tax;
  const commission = Math.round(total * (COMMISSION_PERCENT / 100));
  const payout = total - commission;

  async function handleSubmit() {
    setSubmitting(true);
    setError('');
const { data: service } = await supabase
  .from('service_requests')
  .select('customer_id, phone')
  .eq('id', id)
  .single();

    if (!laborCost) {
      setError('error');
      setSubmitting(false);
      return;
    }

    const { data: invoice, error: invError } = await supabase
      .from('invoices')
      .insert({
        request_id: id,
        technician_id: request!.technician_id,
        parts_cost: partsTotal,
        labor_cost: labor,
        transport_cost: transport,
        total_amount: total,
        commission_percent: COMMISSION_PERCENT,
        commission_amount: commission,
        technician_payout: payout,
      })
      .select()
      .single();

    if (invError) {
      setError('error: ' + invError.message);
      setSubmitting(false);
      return;
    }

    const validParts = parts.filter(p => p.name && p.price);
    if (validParts.length > 0) {
      await supabase.from('invoice_items').insert(
        validParts.map(p => ({
          invoice_id: invoice.id,
          item_name: p.name,
          price: parseFloat(p.price),
        }))
      );
    }

    await supabase
      .from('service_requests')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', id);
// بروزرسانی بایگانی مشتریان
if (service) {

  const { data: customer } = await supabase
    .from('customer_archive')
    .select('*')
    .eq('user_id', service.customer_id)
    .maybeSingle();

  if (customer) {

    await supabase
      .from('customer_archive')
      .update({
        total_orders: (customer.total_orders || 0) + 1,
        total_spent: Number(customer.total_spent || 0) + total,
        last_order_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', service.customer_id);

  } else {

    await supabase
      .from('customer_archive')
      .insert({
        user_id: service.customer_id,
        phone: service.phone,
        full_name: '',
        city: '',
        total_orders: 1,
        total_spent: total,
        last_order_at: new Date().toISOString(),
        source: 'service',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

  }
}


    setDone(true);
    setSubmitting(false);
  }

  if (!request) return (
    <main style={{minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center"}}>
      <p style={{color:"#1e3a8a"}}>loading...</p>
    </main>
  );

  if (existingInvoice || done) {
    const displayParts = existingItems.length > 0 ? existingItems : parts.filter(p => p.name && p.price);
    const displayLabor = existingInvoice?.labor_cost ?? labor;
    const displayTransport = existingInvoice?.transport_cost ?? transport;
    const displayTotal = existingInvoice?.total_amount ?? total;
    const displayCommission = existingInvoice?.commission_amount ?? commission;
    const displayPayout = existingInvoice?.technician_payout ?? payout;
    const displaySubtotal = displayLabor + displayTransport + (displayParts.reduce((s: number, p: any) => s + parseFloat(p.price), 0));
    const displayTax = Math.round(displaySubtotal * (TAX_PERCENT / 100));

    return (
      <main style={{minHeight:"100vh", background:"#f3f4f6", padding:"32px 16px"}} dir="rtl">
        <div style={{maxWidth:"500px", margin:"0 auto"}}>
          <div style={{background:"white", borderRadius:"16px", padding:"32px"}}>

            {/* هدر فاکتور */}
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px", borderBottom:"2px solid #1e3a8a", paddingBottom:"16px"}}>
              <div>
                <h2 style={{fontWeight:"bold", color:"#1e3a8a", fontSize:"18px", margin:0}}>
                  {strings.invoice_title}
                </h2>
                <p style={{color:"#6b7280", fontSize:"12px", margin:"4px 0 0"}}>
                  {strings.invoice_company}
                </p>
              </div>
              <img src="/icons/navbar-logo.png" alt="vira" style={{height:"60px", objectFit:"contain"}} />
            </div>

            <div style={{background:"#f9fafb", borderRadius:"10px", padding:"16px"}}>

              {displayParts.length > 0 && (
                <>
                  <p style={{fontWeight:"bold", fontSize:"13px", color:"#6b7280", marginBottom:"8px"}}>
                    {strings.parts}:
                  </p>
                  {displayParts.map((p: any, i: number) => (
                    <div key={i} style={{display:"flex", justifyContent:"space-between", marginBottom:"6px", fontSize:"14px"}}>
                      <span>{p.item_name || p.name}</span>
                      <span>{parseFloat(p.price).toLocaleString('fa-IR')} {strings.toman}</span>
                    </div>
                  ))}
                  <div style={{borderTop:"1px solid #e5e7eb", margin:"8px 0"}} />
                </>
              )}

              <div style={{display:"flex", justifyContent:"space-between", marginBottom:"6px", fontSize:"14px"}}>
                <span>{strings.labor}:</span>
                <span>{displayLabor.toLocaleString('fa-IR')} {strings.toman}</span>
              </div>
              <div style={{display:"flex", justifyContent:"space-between", marginBottom:"6px", fontSize:"14px"}}>
                <span>{strings.transport}:</span>
                <span>{displayTransport.toLocaleString('fa-IR')} {strings.toman}</span>
              </div>

              <div style={{borderTop:"1px solid #e5e7eb", margin:"8px 0"}} />

              <div style={{display:"flex", justifyContent:"space-between", marginBottom:"6px", fontSize:"14px", color:"#6b7280"}}>
                <span>{strings.total}:</span>
                <span>{displaySubtotal.toLocaleString('fa-IR')} {strings.toman}</span>
              </div>
              <div style={{display:"flex", justifyContent:"space-between", marginBottom:"6px", fontSize:"14px", color:"#f59e0b"}}>
                <span>{strings.tax}:</span>
                <span>{displayTax.toLocaleString('fa-IR')} {strings.toman}</span>
              </div>

              <div style={{borderTop:"2px solid #1e3a8a", margin:"8px 0"}} />

              <div style={{display:"flex", justifyContent:"space-between", marginBottom:"12px", fontWeight:"bold", fontSize:"16px"}}>
                <span>{strings.total_with_tax}:</span>
                <span style={{color:"#1e3a8a"}}>{displayTotal.toLocaleString('fa-IR')} {strings.toman}</span>
              </div>

              <div style={{borderTop:"1px dashed #e5e7eb", margin:"8px 0", paddingTop:"8px"}}>
                <div style={{display:"flex", justifyContent:"space-between", fontSize:"12px", color:"#9ca3af", marginBottom:"4px"}}>
                  <span>{strings.commission} ({COMMISSION_PERCENT}%):</span>
                  <span>{displayCommission.toLocaleString('fa-IR')} {strings.toman}</span>
                </div>
                <div style={{display:"flex", justifyContent:"space-between", fontSize:"12px", color:"#16a34a"}}>
                  <span>{strings.payout}:</span>
                  <span>{displayPayout.toLocaleString('fa-IR')} {strings.toman}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => window.location.href = '/technician/dashboard'}
              style={{width:"100%", marginTop:"20px", background:"#1e3a8a", color:"white", padding:"12px", borderRadius:"10px", border:"none", cursor:"pointer", fontWeight:"bold"}}
            >
              {strings.back_to_panel}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={{minHeight:"100vh", background:"#f3f4f6", padding:"32px 16px"}} dir="rtl">
      <div style={{maxWidth:"500px", margin:"0 auto"}}>

        <h1 style={{fontSize:"22px", fontWeight:"bold", color:"#1e3a8a", marginBottom:"24px"}}>
          {strings.invoice_title}
        </h1>

        <div style={{background:"white", borderRadius:"16px", padding:"24px"}}>

          <p style={{fontWeight:"bold", marginBottom:"4px"}}>{request.description}</p>
          <p style={{color:"#6b7280", fontSize:"13px", marginBottom:"20px"}}>📍 {request.address}</p>

          {/* قطعات */}
          <div style={{marginBottom:"16px"}}>
            <label style={{display:"block", fontSize:"14px", fontWeight:"bold", color:"#374151", marginBottom:"8px"}}>
              {strings.parts}
            </label>

            {parts.map((part, index) => (
              <div key={index} style={{display:"flex", gap:"8px", marginBottom:"8px"}}>
                <input
                  type="text"
                  placeholder={strings.part_name}
                  value={part.name}
                  onChange={(e) => updatePart(index, 'name', e.target.value)}
                  style={{flex:2, border:"1px solid #d1d5db", borderRadius:"8px", padding:"8px 10px", fontSize:"13px"}}
                />
                <input
                  type="number"
                  placeholder={strings.price}
                  value={part.price}
                  onChange={(e) => updatePart(index, 'price', e.target.value)}
                  style={{flex:1, border:"1px solid #d1d5db", borderRadius:"8px", padding:"8px 10px", fontSize:"13px"}}
                />
                {parts.length > 1 && (
                  <button
                    onClick={() => removePartRow(index)}
                    style={{background:"#fee2e2", color:"#dc2626", border:"none", borderRadius:"8px", padding:"0 12px", cursor:"pointer"}}
                  >
                    x
                  </button>
                )}
              </div>
            ))}

            <button
              onClick={addPartRow}
              style={{color:"#1e3a8a", background:"none", border:"1px dashed #1e3a8a", borderRadius:"8px", padding:"6px 14px", fontSize:"13px", cursor:"pointer", marginTop:"4px"}}
            >
              + {strings.add_part}
            </button>
          </div>

          <div style={{marginBottom:"16px"}}>
            <label style={{display:"block", fontSize:"14px", color:"#6b7280", marginBottom:"4px"}}>{strings.labor} *</label>
            <input
              type="number"
              value={laborCost}
              onChange={(e) => setLaborCost(e.target.value)}
              placeholder="0"
              style={{width:"100%", border:"1px solid #d1d5db", borderRadius:"8px", padding:"10px 12px", boxSizing:"border-box"}}
            />
          </div>

          <div style={{marginBottom:"20px"}}>
            <label style={{display:"block", fontSize:"14px", color:"#6b7280", marginBottom:"4px"}}>{strings.transport}</label>
            <input
              type="number"
              value={transportCost}
              onChange={(e) => setTransportCost(e.target.value)}
              placeholder="0"
              style={{width:"100%", border:"1px solid #d1d5db", borderRadius:"8px", padding:"10px 12px", boxSizing:"border-box"}}
            />
          </div>

          {subtotal > 0 && (
            <div style={{background:"#f9fafb", borderRadius:"10px", padding:"16px", marginBottom:"16px"}}>
              <div style={{display:"flex", justifyContent:"space-between", marginBottom:"6px", fontSize:"13px", color:"#6b7280"}}>
                <span>{strings.total}:</span>
                <span>{subtotal.toLocaleString('fa-IR')} {strings.toman}</span>
              </div>
              <div style={{display:"flex", justifyContent:"space-between", marginBottom:"6px", fontSize:"13px", color:"#f59e0b"}}>
                <span>{strings.tax}:</span>
                <span>{tax.toLocaleString('fa-IR')} {strings.toman}</span>
              </div>
              <div style={{display:"flex", justifyContent:"space-between", marginBottom:"6px", fontWeight:"bold", fontSize:"15px"}}>
                <span>{strings.total_with_tax}:</span>
                <span style={{color:"#1e3a8a"}}>{total.toLocaleString('fa-IR')} {strings.toman}</span>
              </div>
              <div style={{borderTop:"1px dashed #e5e7eb", margin:"8px 0", paddingTop:"8px"}}>
                <div style={{display:"flex", justifyContent:"space-between", fontSize:"12px", color:"#dc2626", marginBottom:"4px"}}>
                  <span>{strings.commission} ({COMMISSION_PERCENT}%):</span>
                  <span>{commission.toLocaleString('fa-IR')} {strings.toman}</span>
                </div>
                <div style={{display:"flex", justifyContent:"space-between", fontSize:"12px", color:"#16a34a"}}>
                  <span>{strings.payout}:</span>
                  <span>{payout.toLocaleString('fa-IR')} {strings.toman}</span>
                </div>
              </div>
            </div>
          )}

          {error && <p style={{color:"red", fontSize:"14px", marginBottom:"12px"}}>{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{width:"100%", background:"#16a34a", color:"white", padding:"14px", borderRadius:"10px", border:"none", cursor:"pointer", fontSize:"16px", fontWeight:"bold", opacity: submitting ? 0.5 : 1}}
          >
            {submitting ? 'loading...' : strings.submit_invoice}
          </button>

        </div>
      </div>
    </main>
  );
}
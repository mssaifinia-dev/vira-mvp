'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { strings } from '@/lib/strings';
import ZoomableImage from '@/components/ZoomableImage';

type Request = {
  id: string;
  issue_type: string;
  description: string;
  address: string;
  status: string;
  eta_minutes: number | null;
  technician_id: string | null;
};

type Technician = {
  full_name: string;
  phone: string;
  photo_url: string | null;
};

type Invoice = {
  id: string;
  total_amount: number;
  payment_status: string;
  rating: number | null;
  feedback: string | null;
};

export default function TrackRequest() {
  const { id } = useParams();
  const [request, setRequest] = useState<Request | null>(null);
  const [technician, setTechnician] = useState<Technician | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    fetchRequest();
    const interval = setInterval(fetchRequest, 5000);
    return () => clearInterval(interval);
  }, [id]);

  async function fetchRequest() {
    const res1 = await supabase.from('service_requests').select('*').eq('id', id).single();
    const data = res1.data;
    setRequest(data);

    if (data && data.technician_id) {
      const res2 = await supabase.from('technicians').select('full_name, phone, photo_url').eq('id', data.technician_id).single();
      setTechnician(res2.data);
    }

    if (data && data.status === 'completed') {
      const res3 = await supabase.from('invoices').select('id, total_amount, payment_status, rating, feedback').eq('request_id', id).maybeSingle();
      setInvoice(res3.data);
    }

    setLoading(false);
  }

  async function handlePayment() {
    if (!invoice) return;
    setPaying(true);
    await supabase.from('invoices').update({ payment_status: 'paid' }).eq('id', invoice.id);
    setPaying(false);
    fetchRequest();
  }

  async function handleSubmitReview() {
    if (!invoice || rating === 0) return;
    setSubmittingReview(true);
    await supabase.from('invoices').update({ rating: rating, feedback: feedback }).eq('id', invoice.id);
    setSubmittingReview(false);
    fetchRequest();
  }

  const statusLabels: Record<string, string> = {
    pending: strings.status_pending,
    accepted: strings.status_accepted,
    in_progress: strings.status_in_progress,
    completed: strings.status_completed,
    cancelled: strings.status_cancelled,
  };

  if (loading) {
    return (
      <main style={{minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center"}}>
        <p style={{color:"#1e3a8a"}}>{strings.loading}</p>
      </main>
    );
  }

  if (!request) {
    return (
      <main style={{minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center"}}>
        <p style={{color:"#dc2626"}}>{strings.not_found}</p>
      </main>
    );
  }

  const showInvoiceBlock = request.status === 'completed' && invoice !== null;
  const isPaid = invoice !== null && invoice.payment_status === 'paid';
  const hasRating = invoice !== null && invoice.rating !== null && invoice.rating > 0;

  return (
    <main style={{minHeight:"100vh", background:"#f3f4f6", padding:"32px 16px"}} dir="rtl">
      <div style={{maxWidth:"500px", margin:"0 auto"}}>

        <h1 style={{fontSize:"22px", fontWeight:"bold", color:"#1e3a8a", textAlign:"center", marginBottom:"24px"}}>
          {strings.track_title}
        </h1>

        <div style={{background:"white", borderRadius:"16px", padding:"24px", textAlign:"center", marginBottom:"16px"}}>
          <p style={{fontSize:"18px", fontWeight:"bold", color:"#111827"}}>
            {statusLabels[request.status] || request.status}
          </p>

          {request.status === 'pending' ? (
            <p style={{color:"#6b7280", fontSize:"14px", marginTop:"8px"}}>
              {strings.finding_technician}
            </p>
          ) : null}

          {technician !== null ? (
            <div style={{marginTop:"16px", background:"#f0f9ff", borderRadius:"14px", padding:"20px", textAlign:"center"}}>
              {technician.photo_url ? (
                <div style={{display:"flex", justifyContent:"center", marginBottom:"16px"}}>
                  <ZoomableImage
                    src={technician.photo_url}
                    alt={technician.full_name}
                    size={180}
                    borderColor="#1e3a8a"
                    borderWidth={4}
                  />
                </div>
              ) : (
                <div style={{width:"180px", height:"180px", borderRadius:"50%", background:"#d1d5db", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"72px", margin:"0 auto 16px"}}>👤</div>
              )}
              <p style={{fontWeight:"bold", fontSize:"20px"}}>{technician.full_name}</p>
              <p style={{color:"#6b7280", fontSize:"16px", marginTop:"6px"}}>📞 {technician.phone}</p>
              {request.eta_minutes ? (
                <p style={{color:"#16a34a", fontSize:"16px", marginTop:"8px", fontWeight:"bold"}}>
                  ⏱ {strings.eta_label}: {request.eta_minutes} {strings.minutes_label}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div style={{background:"white", borderRadius:"16px", padding:"20px", marginBottom:"16px"}}>
          <p style={{color:"#6b7280", fontSize:"13px", marginBottom:"4px"}}>{strings.desc_label}</p>
          <p style={{fontWeight:"bold", marginBottom:"12px"}}>{request.description}</p>
          <p style={{color:"#6b7280", fontSize:"13px", marginBottom:"4px"}}>{strings.address_label}</p>
          <p style={{fontWeight:"bold"}}>{request.address}</p>
        </div>

        {showInvoiceBlock ? (
          <div style={{background:"white", borderRadius:"16px", padding:"20px", marginBottom:"16px"}}>
            <p style={{fontWeight:"bold", marginBottom:"12px", color:"#1e3a8a"}}>{strings.invoice_title}</p>
            <div style={{display:"flex", justifyContent:"space-between", marginBottom:"16px"}}>
              <span style={{color:"#6b7280"}}>{strings.total_with_tax}:</span>
              <span style={{fontWeight:"bold", fontSize:"18px", color:"#1e3a8a"}}>
                {invoice ? invoice.total_amount.toLocaleString('fa-IR') : ''} {strings.toman}
              </span>
            </div>

            <button
              onClick={function() { window.location.href = '/technician/invoice/' + request.id; }}
              style={{width:"100%", background:"#f3f4f6", color:"#1e3a8a", padding:"10px", borderRadius:"10px", border:"none", cursor:"pointer", fontWeight:"bold", marginBottom:"10px"}}
            >
              {strings.invoice_details_btn}
            </button>

            {isPaid ? (
              <div style={{background:"#d1fae5", color:"#065f46", padding:"12px", borderRadius:"10px", textAlign:"center", fontWeight:"bold"}}>
                {strings.paid_label}
              </div>
            ) : (
              <button
                onClick={handlePayment}
                disabled={paying}
                style={{width:"100%", background:"#16a34a", color:"white", padding:"14px", borderRadius:"10px", border:"none", cursor:"pointer", fontWeight:"bold", fontSize:"16px", opacity: paying ? 0.5 : 1}}
              >
                {paying ? '...' : strings.confirm_payment_btn}
              </button>
            )}
          </div>
        ) : null}

        {showInvoiceBlock && isPaid ? (
          <div style={{background:"white", borderRadius:"16px", padding:"20px"}}>

            {hasRating ? (
              <div style={{textAlign:"center"}}>
                <p style={{fontWeight:"bold", color:"#16a34a"}}>{strings.thanks_feedback}</p>
                <div style={{marginTop:"8px", fontSize:"24px"}}>
                  {[1,2,3,4,5].map(function(n) {
                    const filled = invoice && invoice.rating !== null && n <= invoice.rating;
                    return (
                      <span key={n} style={{color: filled ? "#f59e0b" : "#d1d5db"}}>★</span>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div>
                <p style={{fontWeight:"bold", marginBottom:"12px", color:"#1e3a8a"}}>
                  {strings.rate_service}
                </p>

                <div style={{display:"flex", justifyContent:"center", gap:"8px", marginBottom:"16px", fontSize:"32px"}}>
                  {[1,2,3,4,5].map(function(n) {
                    return (
                      <span
                        key={n}
                        onClick={function() { setRating(n); }}
                        style={{cursor:"pointer", color: n <= rating ? "#f59e0b" : "#d1d5db"}}
                      >
                        ★
                      </span>
                    );
                  })}
                </div>

                <textarea
                  value={feedback}
                  onChange={function(e) { setFeedback(e.target.value); }}
                  placeholder={strings.feedback_placeholder}
                  rows={3}
                  style={{width:"100%", border:"1px solid #d1d5db", borderRadius:"8px", padding:"10px", boxSizing:"border-box", marginBottom:"16px"}}
                />

                <button
                  onClick={handleSubmitReview}
                  disabled={rating === 0 || submittingReview}
                  style={{width:"100%", background: rating === 0 ? "#9ca3af" : "#1e3a8a", color:"white", padding:"14px", borderRadius:"10px", border:"none", cursor: rating === 0 ? "not-allowed" : "pointer", fontWeight:"bold", fontSize:"16px"}}
                >
                  {submittingReview ? '...' : strings.submit_review_btn}
                </button>
              </div>
            )}
          </div>
        ) : null}

      </div>
    </main>
  );
}

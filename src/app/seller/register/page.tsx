'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

const iranCities = [
  'تهران', 'مشهد', 'اصفهان', 'کرج', 'شیراز', 'تبریز', 'قم', 'اهواز',
  'کرمانشاه', 'رشت', 'ارومیه', 'زاهدان', 'کرمان', 'همدان', 'یزد',
  'اردبیل', 'بندرعباس', 'اراک', 'ساری', 'سنندج', 'گرگان', 'قزوین',
  'خرم‌آباد', 'زنجان', 'شهرکرد', 'بیرجند', 'بجنورد', 'ایلام', 'بوشهر',
  'سمنان', 'یاسوج',
];

const commitmentText = `تعهدنامه همکاری با پلتفرم تامین ارتباط ویرا (فروشندگان)

اینجانب صاحب فروشگاه که از این پس «فروشنده» نامیده می‌شوم، با آگاهی کامل از مفاد این تعهدنامه، موارد ذیل را می‌پذیرم:

ماده ۱ - ماهیت رابطه:
پلتفرم تامین ارتباط ویرا (از این پس «پلتفرم») صرفاً یک بستر واسطه‌گری جهت عرضه و فروش محصولات فروشنده به مشتریان است. هیچ‌گونه رابطه استخدامی، شراکتی یا وکالتی بین فروشنده و پلتفرم وجود ندارد. پلتفرم در قبال کیفیت، صحت مشخصات و تحویل محصولات هیچ‌گونه مسئولیت حقوقی، کیفری یا مدنی ندارد.

ماده ۲ - تعهد به صحت اطلاعات محصولات:
فروشنده متعهد می‌گردد که تمامی اطلاعات محصولات از جمله نام، توضیحات، تصاویر، قیمت و موجودی را به‌صورت دقیق و صادقانه درج نماید. هرگونه اطلاعات گمراه‌کننده یا خلاف واقع، موجب مسئولیت حقوقی فروشنده در برابر مشتری و پلتفرم خواهد بود.

ماده ۳ - تعهد به آپدیت فوری قیمت و موجودی:
فروشنده موظف است قیمت‌ها و موجودی محصولات را به‌صورت مستمر و فوری به‌روزرسانی نماید. فروش محصول با قیمت اشتباه یا در حالت اتمام موجودی، مسئولیت جبران خسارت مشتری را به‌عهده فروشنده می‌گذارد.

ماده ۴ - تعهد به ارسال به‌موقع:
فروشنده متعهد می‌گردد پس از ثبت سفارش، محصول را در بازه زمانی اعلام‌شده ارسال نماید. تأخیر در ارسال، عدم ارسال یا ارسال محصول معیوب، موجب مسئولیت مستقیم فروشنده در برابر مشتری است. پلتفرم هیچ‌گونه مسئولیتی در قبال تأخیر یا عدم ارسال ندارد.

ماده ۵ - مسئولیت کامل فروشنده:
فروشنده تمامی مسئولیت‌های ناشی از فروش محصولات از جمله خسارات مالی، کیفیت نامناسب، گارانتی، مرجوعی و هرگونه ادعای حقوقی مشتری را شخصاً و به‌تنهایی می‌پذیرد و پلتفرم را از هرگونه دعوا، شکایت یا مطالبه مبری می‌داند.

ماده ۶ - رعایت قوانین:
فروشنده متعهد است تمامی قوانین جمهوری اسلامی ایران از جمله قانون تجارت الکترونیک، قانون حمایت از مصرف‌کننده و مقررات مالیاتی را رعایت نماید.

ماده ۷ - اختیار تعلیق:
پلتفرم حق دارد در صورت تخلف از هر یک از مواد این تعهدنامه، حساب فروشنده را بدون نیاز به اطلاع قبلی تعلیق یا مسدود نماید و اطلاعات وی را در اختیار مراجع قضایی قرار دهد.

ماده ۸ - پذیرش قطعی:
امضای این تعهدنامه (الکترونیکی یا فیزیکی) به منزله مطالعه کامل، درک و پذیرش قطعی تمامی مفاد آن است و در مراجع قضایی قابل استناد می‌باشد.`;

type DocUpload = { file: File | null; preview: string | null; };

export default function SellerRegister() {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1 - info
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [shopMobile, setShopMobile] = useState('');
  const [city, setCity] = useState('تهران');
  const [shopAddress, setShopAddress] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [description, setDescription] = useState('');

  // Step 2 - documents
  const [docNationalId, setDocNationalId] = useState<DocUpload>({ file: null, preview: null });
  const [docLicense, setDocLicense] = useState<DocUpload>({ file: null, preview: null });
  const [docExtra, setDocExtra] = useState<DocUpload>({ file: null, preview: null });

  // Step 3 - commitment
  const [commitmentAccepted, setCommitmentAccepted] = useState(false);
  const [signatureName, setSignatureName] = useState('');
  const [docCommitment, setDocCommitment] = useState<DocUpload>({ file: null, preview: null });

  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  function handlePhone(val: string) {
    setPhone(val.replace(/[^0-9]/g, '').substring(0, 11));
  }

  function handleShopMobile(val: string) {
    setShopMobile(val.replace(/[^0-9]/g, '').substring(0, 11));
  }

  function handleNationalId(val: string) {
    setNationalId(val.replace(/[^0-9]/g, '').substring(0, 10));
  }

  function handleDocChange(e: React.ChangeEvent<HTMLInputElement>, setter: (d: DocUpload) => void) {
    const file = e.target.files?.[0];
    if (!file) return;
    setter({ file, preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null });
  }

  function validateStep1() {
    setError('');
    if (!shopName || !ownerName || !phone || !city || !shopAddress || !nationalId) {
      setError('لطفاً همه فیلدهای الزامی را پر کنید'); return false;
    }
    if (phone.length !== 11 || !phone.startsWith('09')) {
      setError('شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود'); return false;
    }
    if (shopMobile && (shopMobile.length !== 11 || !shopMobile.startsWith('09'))) {
      setError('شماره موبایل فروشگاه باید ۱۱ رقم و با ۰۹ شروع شود'); return false;
    }
    if (nationalId.length !== 10) {
      setError('کد ملی باید ۱۰ رقم باشد'); return false;
    }
    return true;
  }

  function validateStep2() {
    setError('');
    if (!docNationalId.file) { setError('آپلود تصویر کارت ملی الزامی است'); return false; }
    if (!docLicense.file) { setError('آپلود جواز کسب یا مجوز فعالیت الزامی است'); return false; }
    return true;
  }

  function validateStep3() {
    setError('');
    if (!commitmentAccepted) { setError('لطفاً تعهدنامه را مطالعه و تأیید کنید'); return false; }
    if (!signatureName.trim()) { setError('لطفاً نام کامل خود را به عنوان امضای دیجیتال وارد کنید'); return false; }
    if (signatureName.trim() !== ownerName.trim()) {
      setError('نام وارد شده باید دقیقاً با نام صاحب فروشگاه در مرحله اول مطابقت داشته باشد'); return false;
    }
    return true;
  }

  async function uploadDoc(file: File, userId: string, prefix: string): Promise<string> {
    const ext = file.name.split('.').pop();
    const path = `${userId}/${prefix}-${Date.now()}.${ext}`;
    const res = await supabase.storage.from('technician-documents').upload(path, file);
    if (res.error) throw new Error('خطا در آپلود ' + prefix + ': ' + res.error.message);
    return supabase.storage.from('technician-documents').getPublicUrl(path).data.publicUrl;
  }

  async function handleSubmit() {
    if (!validateStep3()) return;
    setLoading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = '/auth'; return; }

      const docNationalIdUrl = await uploadDoc(docNationalId.file!, user.id, 'seller-national-id');
      const docLicenseUrl = await uploadDoc(docLicense.file!, user.id, 'seller-license');
      const docExtraUrl = docExtra.file ? await uploadDoc(docExtra.file, user.id, 'seller-extra') : null;
      const docCommitmentUrl = docCommitment.file ? await uploadDoc(docCommitment.file, user.id, 'seller-commitment') : null;

      const { error: insertError } = await supabase.from('sellers').insert({
        user_id: user.id,
        shop_name: shopName,
        phone,
        city,
        description,
        national_id: nationalId,
        shop_address: shopAddress,
        shop_mobile: shopMobile || null,
        doc_national_id_url: docNationalIdUrl,
        doc_license_url: docLicenseUrl,
        doc_extra_url: docExtraUrl,
        doc_commitment_url: docCommitmentUrl,
        commitment_signed_at: new Date().toISOString(),
        commitment_signed_name: signatureName.trim(),
      });

      if (insertError) throw new Error(insertError.message);
      setDone(true);
    } catch (err: any) {
      setError(err.message || 'خطایی رخ داد');
    }

    setLoading(false);
  }

  if (done) {
    return (
      <main dir="rtl" style={{minHeight:'100vh', background:'#f3f4f6', display:'flex', alignItems:'center', justifyContent:'center'}}>
        <div style={{background:'white', padding:'32px', borderRadius:'16px', textAlign:'center', maxWidth:'400px'}}>
          <p style={{fontSize:'48px'}}>✅</p>
          <h2 style={{color:'#16a34a', fontWeight:'bold', marginTop:'16px'}}>درخواست فروشندگی ثبت شد!</h2>
          <p style={{color:'#6b7280', fontSize:'14px', marginTop:'8px'}}>پس از تأیید مدیر، پنل فروش شما فعال می‌شود.</p>
          <button onClick={() => { window.location.href = '/'; }}
            style={{marginTop:'20px', background:'#1e3a8a', color:'white', padding:'10px 24px', border:'none', borderRadius:'8px', cursor:'pointer'}}>
            بازگشت به خانه
          </button>
        </div>
      </main>
    );
  }

  const inputStyle: React.CSSProperties = {width:'100%', border:'1px solid #d1d5db', borderRadius:'8px', padding:'10px', boxSizing:'border-box', fontSize:'14px'};
  const labelStyle: React.CSSProperties = {display:'block', marginBottom:'4px', fontSize:'14px', color:'#6b7280'};
  const sectionStyle: React.CSSProperties = {marginBottom:'16px'};

  return (
    <main dir="rtl" style={{minHeight:'100vh', background:'#f3f4f6', padding:'32px 16px'}}>
      <div style={{maxWidth:'540px', margin:'0 auto'}}>

        {/* Progress bar */}
        <div style={{display:'flex', gap:'8px', marginBottom:'16px'}}>
          {[1,2,3].map(s => (
            <div key={s} style={{flex:1, height:'6px', borderRadius:'3px', background: step >= s ? '#1e3a8a' : '#d1d5db'}} />
          ))}
        </div>
        <p style={{textAlign:'center', color:'#6b7280', fontSize:'13px', marginBottom:'16px'}}>
          مرحله {step} از ۳ — {step===1 ? 'اطلاعات فروشگاه' : step===2 ? 'آپلود مدارک' : 'تعهدنامه'}
        </p>

        <div style={{background:'white', borderRadius:'16px', padding:'24px'}}>
          <h1 style={{color:'#1e3a8a', marginBottom:'24px', fontWeight:'bold', fontSize:'20px'}}>
            ثبت‌نام فروشنده
          </h1>
          <p style={{color:'#6b7280', fontSize:'13px', marginBottom:'20px', marginTop:'-16px'}}>
            پس از تأیید مدیر، پنل فروش شما فعال می‌شود
          </p>

          {/* ========== STEP 1 ========== */}
          {step === 1 && (
            <>
              <div style={sectionStyle}>
                <label style={labelStyle}>نام فروشگاه *</label>
                <input type="text" value={shopName} onChange={e => setShopName(e.target.value)}
                  placeholder="مثلاً: فروشگاه تجهیزات ارتباطی رضایی" style={inputStyle} />
              </div>

              <div style={sectionStyle}>
                <label style={labelStyle}>نام و نام خانوادگی صاحب فروشگاه *</label>
                <input type="text" value={ownerName} onChange={e => setOwnerName(e.target.value)} style={inputStyle} />
              </div>

              <div style={sectionStyle}>
                <label style={labelStyle}>کد ملی صاحب فروشگاه *</label>
                <input type="text" inputMode="numeric" value={nationalId} onChange={e => handleNationalId(e.target.value)} style={inputStyle} />
                <small style={{color:'#9ca3af'}}>{nationalId.length}/10</small>
              </div>

              <div style={sectionStyle}>
                <label style={labelStyle}>شماره موبایل (برای ارتباط) * (09xxxxxxxxx)</label>
                <input type="text" inputMode="numeric" value={phone} onChange={e => handlePhone(e.target.value)} style={inputStyle} />
                <small style={{color:'#9ca3af'}}>{phone.length}/11</small>
              </div>

              <div style={sectionStyle}>
                <label style={labelStyle}>شماره موبایل فروشگاه (اختیاری)</label>
                <input type="text" inputMode="numeric" value={shopMobile} onChange={e => handleShopMobile(e.target.value)} style={inputStyle} />
                {shopMobile && <small style={{color:'#9ca3af'}}>{shopMobile.length}/11</small>}
              </div>

              <div style={sectionStyle}>
                <label style={labelStyle}>شهر *</label>
                <select value={city} onChange={e => setCity(e.target.value)} style={inputStyle}>
                  {iranCities.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div style={sectionStyle}>
                <label style={labelStyle}>آدرس دقیق فروشگاه *</label>
                <textarea value={shopAddress} onChange={e => setShopAddress(e.target.value)}
                  rows={2} placeholder="استان، شهر، خیابان، پلاک..."
                  style={{...inputStyle, resize:'vertical'}} />
              </div>

              <div style={sectionStyle}>
                <label style={labelStyle}>توضیحات فروشگاه (اختیاری)</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)}
                  rows={3} placeholder="فروش تجهیزات فیبر نوری و مخابرات..."
                  style={{...inputStyle, resize:'vertical'}} />
              </div>
            </>
          )}

          {/* ========== STEP 2 ========== */}
          {step === 2 && (
            <>
              <p style={{color:'#374151', fontSize:'14px', marginBottom:'20px', background:'#fef3c7', padding:'12px', borderRadius:'8px'}}>
                ⚠️ لطفاً تصاویر واضح و خوانا از مدارک آپلود کنید. مدارک ناخوانا باعث رد درخواست می‌شود.
              </p>

              {[
                { label: 'تصویر کارت ملی صاحب فروشگاه *', doc: docNationalId, setter: setDocNationalId, required: true },
                { label: 'جواز کسب یا مجوز فعالیت *', doc: docLicense, setter: setDocLicense, required: true },
                { label: 'مدرک تکمیلی (اختیاری)', doc: docExtra, setter: setDocExtra, required: false },
              ].map(({ label, doc, setter, required }) => (
                <div key={label} style={{marginBottom:'16px', border:'1px solid #e5e7eb', borderRadius:'10px', padding:'12px'}}>
                  <label style={{display:'block', fontWeight:'bold', fontSize:'14px', color: required ? '#1e3a8a' : '#6b7280', marginBottom:'8px'}}>
                    {label}
                  </label>
                  {doc.preview && (
                    <div style={{position:'relative', marginBottom:'8px'}}>
                      <img src={doc.preview} alt={label} style={{width:'100%', maxHeight:'150px', objectFit:'cover', borderRadius:'6px', border:'1px solid #d1d5db'}} />
                      <span style={{position:'absolute', top:'4px', right:'4px', background:'#16a34a', color:'white', borderRadius:'50%', width:'20px', height:'20px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px'}}>✓</span>
                    </div>
                  )}
                  <label style={{display:'inline-block', background: doc.file ? '#16a34a' : '#1e3a8a', color:'white', padding:'6px 16px', borderRadius:'8px', cursor:'pointer', fontSize:'13px'}}>
                    {doc.file ? 'تغییر فایل' : 'انتخاب فایل'}
                    <input type="file" accept="image/*,application/pdf" onChange={e => handleDocChange(e, setter)} style={{display:'none'}} />
                  </label>
                  {doc.file && <span style={{fontSize:'12px', color:'#16a34a', marginRight:'8px'}}>✓ {doc.file.name}</span>}
                </div>
              ))}
            </>
          )}

          {/* ========== STEP 3 ========== */}
          {step === 3 && (
            <>
              <div style={{background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:'10px', padding:'16px', marginBottom:'16px', maxHeight:'300px', overflowY:'auto', fontSize:'13px', lineHeight:'2', color:'#374151', whiteSpace:'pre-line', direction:'rtl'}}>
                {commitmentText}
              </div>

              <div style={{background:'#fef3c7', padding:'12px', borderRadius:'8px', marginBottom:'12px', fontSize:'13px', color:'#92400e'}}>
                💡 می‌توانید این تعهدنامه را پرینت بگیرید، امضا کنید و اسکن‌شده را در قسمت آپلود زیر بارگذاری کنید (اجباری ).
              </div>

              <button
                onClick={() => {
                  const win = window.open('', '_blank');
                  if (!win) return;
                  win.document.write(`
                    <html dir="rtl">
                    <head>
                      <meta charset="utf-8"/>
                      <title>تعهدنامه فروشندگان تامین ارتباط ویرا</title>
                      <style>
                        body { font-family: Tahoma, Arial, sans-serif; padding: 40px; line-height: 2.2; font-size: 14px; color: #111; }
                        h2 { text-align: center; margin-bottom: 32px; }
                        pre { white-space: pre-wrap; font-family: inherit; }
                        .sign { margin-top: 60px; border-top: 1px solid #999; padding-top: 20px; display: flex; justify-content: space-between; }
                        @media print { button { display: none; } }
                      </style>
                    </head>
                    <body>
                      <h2>تعهدنامه همکاری فروشندگان با پلتفرم تامین ارتباط ویرا</h2>
                      <pre>${commitmentText.replace('تعهدنامه همکاری با پلتفرم تامین ارتباط ویرا (فروشندگان)\n\n', '')}</pre>
                      <div class="sign">
                        <div>نام و امضای صاحب فروشگاه: ................................</div>
                        <div>تاریخ: ................................</div>
                      </div>
                      <br/>
                      <button onclick="window.print()" style="padding:10px 24px;font-size:14px;cursor:pointer;background:#1e3a8a;color:white;border:none;border-radius:8px;">
                        پرینت / ذخیره PDF
                      </button>
                    </body>
                    </html>
                  `);
                  win.document.close();
                }}
                style={{width:'100%', background:'#0f766e', color:'white', padding:'10px', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'14px', marginBottom:'16px', fontWeight:'bold'}}
              >
                🖨️ دانلود / پرینت تعهدنامه
              </button>

              <div style={{marginBottom:'16px'}}>
                <label style={{display:'flex', alignItems:'flex-start', gap:'10px', cursor:'pointer'}}>
                  <input type="checkbox" checked={commitmentAccepted} onChange={e => setCommitmentAccepted(e.target.checked)}
                    style={{marginTop:'3px', width:'18px', height:'18px', cursor:'pointer'}} />
                  <span style={{fontSize:'14px', color:'#374151', lineHeight:'1.6'}}>
                    متن تعهدنامه فوق را به‌طور کامل مطالعه کردم و تمامی مفاد آن را می‌پذیرم و خود را ملزم به اجرای آن می‌دانم.
                  </span>
                </label>
              </div>

              <div style={{marginBottom:'16px'}}>
                <label style={{display:'block', marginBottom:'4px', fontSize:'14px', fontWeight:'bold', color:'#1e3a8a'}}>
                  امضای دیجیتال — نام کامل صاحب فروشگاه را دقیقاً وارد کنید *
                </label>
                <input type="text" value={signatureName} onChange={e => setSignatureName(e.target.value)}
                  placeholder={ownerName || 'نام و نام خانوادگی'}
                  style={{...inputStyle, fontFamily:'serif', fontSize:'16px', borderColor: signatureName && signatureName === ownerName ? '#16a34a' : '#d1d5db'}} />
                {signatureName && signatureName !== ownerName && (
                  <small style={{color:'#dc2626'}}>نام باید دقیقاً با «{ownerName}» مطابقت داشته باشد</small>
                )}
                {signatureName && signatureName === ownerName && (
                  <small style={{color:'#16a34a'}}>✓ امضا تأیید شد</small>
                )}
                <small style={{display:'block', color:'#9ca3af', marginTop:'4px'}}>
                  تاریخ و زمان امضا به‌صورت خودکار ثبت می‌شود: {new Date().toLocaleDateString('fa-IR')}
                </small>
              </div>

              <div style={{marginBottom:'16px', border:'1px solid #e5e7eb', borderRadius:'10px', padding:'12px'}}>
                <label style={{display:'block', fontSize:'14px', color:'#6b7280', marginBottom:'8px'}}>
                  آپلود تعهدنامه امضاشده (اختیاری — توصیه می‌شود)
                </label>
                {docCommitment.preview && (
                  <img src={docCommitment.preview} alt="تعهدنامه" style={{width:'100%', maxHeight:'120px', objectFit:'cover', borderRadius:'6px', marginBottom:'8px'}} />
                )}
                <label style={{display:'inline-block', background: docCommitment.file ? '#16a34a' : '#6b7280', color:'white', padding:'6px 16px', borderRadius:'8px', cursor:'pointer', fontSize:'13px'}}>
                  {docCommitment.file ? 'تغییر فایل' : 'انتخاب فایل'}
                  <input type="file" accept="image/*,application/pdf" onChange={e => handleDocChange(e, setDocCommitment)} style={{display:'none'}} />
                </label>
                {docCommitment.file && <span style={{fontSize:'12px', color:'#16a34a', marginRight:'8px'}}>✓ {docCommitment.file.name}</span>}
              </div>
            </>
          )}

          {error && (
            <p style={{color:'#dc2626', marginBottom:'12px', fontSize:'14px', background:'#fee2e2', padding:'10px', borderRadius:'8px'}}>
              ⚠️ {error}
            </p>
          )}

          <div style={{display:'flex', gap:'10px', marginTop:'8px'}}>
            {step > 1 && (
              <button onClick={() => { setStep((step - 1) as 1|2|3); setError(''); }}
                style={{flex:1, background:'#f3f4f6', color:'#374151', padding:'12px', border:'1px solid #d1d5db', borderRadius:'10px', cursor:'pointer', fontWeight:'bold', fontSize:'15px'}}>
                ← مرحله قبل
              </button>
            )}

            {step < 3 ? (
              <button
                onClick={() => {
                  if (step === 1 && !validateStep1()) return;
                  if (step === 2 && !validateStep2()) return;
                  setStep((step + 1) as 2|3);
                  setError('');
                }}
                style={{flex:1, background:'#1e3a8a', color:'white', padding:'12px', border:'none', borderRadius:'10px', cursor:'pointer', fontWeight:'bold', fontSize:'15px'}}>
                مرحله بعد ←
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={loading}
                style={{flex:1, background: loading ? '#9ca3af' : '#16a34a', color:'white', padding:'12px', border:'none', borderRadius:'10px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight:'bold', fontSize:'15px'}}>
                {loading ? 'در حال ارسال...' : '✓ ثبت نهایی'}
              </button>
            )}
          </div>

        </div>
      </div>
    </main>
  );
}

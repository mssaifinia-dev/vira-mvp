'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { strings } from '@/lib/strings';

const iranCities = [
  'تهران', 'مشهد', 'اصفهان', 'کرج', 'شیراز', 'تبریز', 'قم', 'اهواز',
  'کرمانشاه', 'رشت', 'ارومیه', 'زاهدان', 'کرمان', 'همدان', 'یزد',
  'اردبیل', 'بندرعباس', 'اراک', 'ساری', 'سنندج', 'گرگان', 'قزوین',
  'خرم‌آباد', 'زنجان', 'شهرکرد', 'بیرجند', 'بجنورد', 'ایلام', 'بوشهر',
  'سمنان', 'یاسوج',
];

const specialties = [
  { value: 'copper_repair', label: 'رفع خرابی تلفن مسی' },
  { value: 'fiber_repair', label: 'رفع خرابی فیبر نوری' },
  { value: 'fusion', label: 'فیوژن‌کار' },
  { value: 'smart_home', label: 'خانه هوشمند' },
  { value: 'electric_building', label: 'برقکار ساختمانی' },
  { value: 'electric_industrial', label: 'برقکار صنعتی' },
  { value: 'modem_config', label: 'کانفیگ و نصب مودم' },
  { value: 'appliance_repair', label: 'تعمیرکار لوازم خانگی' },
];

const commitmentText = `تعهدنامه همکاری با پلتفرم تامین ارتباط ویرا

اینجانب که از این پس «تکنسین» نامیده می‌شوم، با آگاهی کامل از مفاد این تعهدنامه، موارد ذیل را می‌پذیرم:

ماده ۱ - ماهیت رابطه:
پلتفرم تامین ارتباط ویرا (از این پس «پلتفرم») صرفاً یک بستر واسطه‌گری جهت معرفی تکنسین به مشتریان است و هیچ‌گونه رابطه استخدامی، کارگری، شراکتی یا وکالتی بین تکنسین و پلتفرم وجود ندارد. پلتفرم در قبال اقدامات، خدمات یا رفتار تکنسین هیچ‌گونه مسئولیت حقوقی، کیفری یا مدنی ندارد.

ماده ۲ - مسئولیت کامل تکنسین:
تکنسین متعهد می‌گردد که تمامی مسئولیت‌های ناشی از ارائه خدمات از جمله خسارات مالی، جانی، آسیب به اموال، نقص فنی، عدم رضایت مشتری و هرگونه ادعای حقوقی را شخصاً و به‌تنهایی می‌پذیرد و پلتفرم را از هرگونه دعوا، شکایت یا مطالبه مبری می‌داند.

ماده ۳ - صلاحیت و مجوزها:
تکنسین اعلام می‌دارد که دارای صلاحیت فنی، تخصص کافی و در صورت لزوم مجوزهای قانونی لازم برای ارائه خدمات مورد نظر است و صحت مدارک ارائه‌شده را تأیید می‌نماید. هرگونه ادعای خلاف این مورد، موجب مسئولیت کیفری و مدنی تکنسین خواهد بود.

ماده ۴ - رفتار حرفه‌ای:
تکنسین متعهد می‌گردد در تمامی مراحل ارائه خدمات، اصول اخلاق حرفه‌ای، احترام به مشتری، حفظ اموال و حریم خصوصی مشتری را رعایت نموده و از هرگونه تقلب، فریب، دریافت وجه خارج از توافق و رفتار مغایر با شأن حرفه‌ای خودداری نماید.

ماده ۵ - جبران خسارت:
در صورت ورود هرگونه خسارت به مشتری یا اشخاص ثالث ناشی از عملکرد تکنسین، تکنسین موظف به جبران کامل خسارات وارده است. پلتفرم حق دارد در صورت تخلف، حساب کاربری تکنسین را مسدود و اطلاعات وی را در اختیار مراجع قضایی قرار دهد.

ماده ۶ - اطلاعات شخصی:
تکنسین رضایت می‌دهد که اطلاعات هویتی و تخصصی وی جهت نمایش به مشتریان در پلتفرم استفاده شود.

ماده ۷ - پذیرش قطعی:
امضای این تعهدنامه (الکترونیکی یا فیزیکی) به منزله مطالعه کامل، درک و پذیرش قطعی تمامی مفاد آن است و در مراجع قضایی قابل استناد می‌باشد.`;

type DocUpload = {
  file: File | null;
  preview: string | null;
};

export default function TechnicianRegister() {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1 - info
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('تهران');
  const [nationalId, setNationalId] = useState('');
  const [specialty, setSpecialty] = useState('copper_repair');
  const [experience, setExperience] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Step 2 - documents
  const [docNationalId, setDocNationalId] = useState<DocUpload>({ file: null, preview: null });
  const [docCertificate, setDocCertificate] = useState<DocUpload>({ file: null, preview: null });
  const [docBackground, setDocBackground] = useState<DocUpload>({ file: null, preview: null });
  const [docSkillCard, setDocSkillCard] = useState<DocUpload>({ file: null, preview: null });
  const [docExtra, setDocExtra] = useState<DocUpload>({ file: null, preview: null });

  // Step 3 - commitment
  const [commitmentAccepted, setCommitmentAccepted] = useState(false);
  const [signatureName, setSignatureName] = useState('');
  const [docCommitment, setDocCommitment] = useState<DocUpload>({ file: null, preview: null });

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  function handlePhone(val: string) {
    setPhone(val.replace(/[^0-9]/g, '').substring(0, 11));
  }

  function handleNationalId(val: string) {
    setNationalId(val.replace(/[^0-9]/g, '').substring(0, 10));
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  function handleDocChange(e: React.ChangeEvent<HTMLInputElement>, setter: (d: DocUpload) => void) {
    const file = e.target.files?.[0];
    if (!file) return;
    setter({ file, preview: URL.createObjectURL(file) });
  }

  function validateStep1() {
    setError('');
    if (!fullName || !phone || !city || !nationalId) { setError(strings.required_error); return false; }
    if (phone.length !== 11 || !phone.startsWith('09')) { setError(strings.phone_error); return false; }
    if (nationalId.length !== 10) { setError(strings.national_id_error); return false; }
    if (!photoFile) { setError('لطفاً عکس پروفایل خود را آپلود کنید'); return false; }
    return true;
  }

  function validateStep2() {
    setError('');
    if (!docNationalId.file) { setError('آپلود تصویر کارت ملی الزامی است'); return false; }
    if (!docCertificate.file) { setError('آپلود تصویر مدرک تحصیلی یا فنی الزامی است'); return false; }
    if (!docBackground.file) { setError('آپلود تصویر سوء پیشینه الزامی است'); return false; }
    if (!docSkillCard.file) { setError('آپلود پروانه کسب یا کارت مهارت فنی الزامی است'); return false; }
    return true;
  }

  function validateStep3() {
    setError('');
    if (!commitmentAccepted) { setError('لطفاً تعهدنامه را مطالعه و تأیید کنید'); return false; }
    if (!signatureName.trim()) { setError('لطفاً نام کامل خود را به عنوان امضای دیجیتال وارد کنید'); return false; }
    if (signatureName.trim() !== fullName.trim()) { setError('نام وارد شده باید دقیقاً با نام کامل شما در مرحله اول مطابقت داشته باشد'); return false; }
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
    setSubmitting(true);
    setError('');

    try {
      const userRes = await supabase.auth.getUser();
      const user = userRes.data.user;
      if (!user) { window.location.href = '/auth'; return; }

      // Upload profile photo
      const photoExt = photoFile!.name.split('.').pop();
      const photoPath = `${user.id}-${Date.now()}.${photoExt}`;
      const photoUpload = await supabase.storage.from('technician-photos').upload(photoPath, photoFile!);
      if (photoUpload.error) throw new Error('خطا در آپلود عکس پروفایل: ' + photoUpload.error.message);
      const photoUrl = supabase.storage.from('technician-photos').getPublicUrl(photoPath).data.publicUrl;

      // Upload documents
      const docNationalIdUrl = await uploadDoc(docNationalId.file!, user.id, 'national-id');
      const docCertificateUrl = await uploadDoc(docCertificate.file!, user.id, 'certificate');
      const docBackgroundUrl = await uploadDoc(docBackground.file!, user.id, 'background');
      const docSkillCardUrl = await uploadDoc(docSkillCard.file!, user.id, 'skill-card');
      const docExtraUrl = docExtra.file ? await uploadDoc(docExtra.file, user.id, 'extra') : null;
      const docCommitmentUrl = docCommitment.file ? await uploadDoc(docCommitment.file, user.id, 'commitment') : null;

      const insertRes = await supabase.from('technicians').insert({
        user_id: user.id,
        full_name: fullName,
        phone,
        city,
        specialty,
        national_id: nationalId,
        experience,
        photo_url: photoUrl,
        doc_national_id_url: docNationalIdUrl,
        doc_certificate_url: docCertificateUrl,
        doc_background_url: docBackgroundUrl,
        doc_skill_card_url: docSkillCardUrl,
        doc_extra_url: docExtraUrl,
        doc_commitment_url: docCommitmentUrl,
        commitment_signed_at: new Date().toISOString(),
        commitment_signed_name: signatureName.trim(),
      });

      if (insertRes.error) throw new Error(insertRes.error.message);
      setDone(true);
    } catch (err: any) {
      setError(err.message || 'خطایی رخ داد');
    }

    setSubmitting(false);
  }

  if (done) {
    return (
      <main dir="rtl" style={{minHeight:'100vh', background:'#f3f4f6', display:'flex', alignItems:'center', justifyContent:'center'}}>
        <div style={{background:'white', padding:'32px', borderRadius:'16px', textAlign:'center', maxWidth:'400px'}}>
          <p style={{fontSize:'48px'}}>✅</p>
          <h2 style={{color:'#16a34a', fontWeight:'bold', marginTop:'16px'}}>{strings.register_done}</h2>
          <p style={{color:'#6b7280', fontSize:'14px', marginTop:'8px'}}>{strings.waiting_approval}</p>
          <button onClick={() => { window.location.href = '/'; }}
            style={{marginTop:'20px', background:'#1e3a8a', color:'white', padding:'10px 24px', border:'none', borderRadius:'8px', cursor:'pointer'}}>
            {strings.back_home}
          </button>
        </div>
      </main>
    );
  }

  const inputStyle: React.CSSProperties = {width:'100%', border:'1px solid #d1d5db', borderRadius:'8px', padding:'10px', boxSizing:'border-box'};
  const labelStyle: React.CSSProperties = {display:'block', marginBottom:'4px', fontSize:'14px', color:'#6b7280'};
  const sectionStyle: React.CSSProperties = {marginBottom:'16px'};

  return (
    <main dir="rtl" style={{minHeight:'100vh', background:'#f3f4f6', padding:'32px 16px'}}>
      <div style={{maxWidth:'540px', margin:'0 auto'}}>

        {/* Progress bar */}
        <div style={{display:'flex', gap:'8px', marginBottom:'24px'}}>
          {[1,2,3].map(s => (
            <div key={s} style={{flex:1, height:'6px', borderRadius:'3px',
              background: step >= s ? '#1e3a8a' : '#d1d5db'}} />
          ))}
        </div>
        <p style={{textAlign:'center', color:'#6b7280', fontSize:'13px', marginBottom:'16px'}}>
          مرحله {step} از ۳ — {step===1 ? 'اطلاعات شخصی' : step===2 ? 'آپلود مدارک' : 'تعهدنامه'}
        </p>

        <div style={{background:'white', borderRadius:'16px', padding:'24px'}}>
          <h1 style={{color:'#1e3a8a', marginBottom:'24px', fontWeight:'bold', fontSize:'20px'}}>
            {strings.register_technician}
          </h1>

          {/* ========== STEP 1 ========== */}
          {step === 1 && (
            <>
              <div style={{marginBottom:'16px', textAlign:'center'}}>
                <label style={{display:'block', marginBottom:'8px', fontSize:'14px', color:'#6b7280'}}>
                  عکس پروفایل * (مشتری شما را با این عکس می‌شناسد)
                </label>
                <div style={{width:'100px', height:'100px', borderRadius:'50%', background:'#f3f4f6', margin:'0 auto 8px', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', border:'2px solid #d1d5db'}}>
                  {photoPreview ? (
                    <img src={photoPreview} alt="پیش‌نمایش" style={{width:'100%', height:'100%', objectFit:'cover'}} />
                  ) : <span style={{fontSize:'32px'}}>👤</span>}
                </div>
                <label style={{display:'inline-block', background:'#1e3a8a', color:'white', padding:'8px 20px', borderRadius:'8px', cursor:'pointer', fontSize:'13px'}}>
                  انتخاب عکس
                  <input type="file" accept="image/*" onChange={handlePhotoChange} style={{display:'none'}} />
                </label>
              </div>

              <div style={sectionStyle}>
                <label style={labelStyle}>{strings.name_label} *</label>
                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} style={inputStyle} />
              </div>

              <div style={sectionStyle}>
                <label style={labelStyle}>{strings.phone_label} * (09xxxxxxxxx)</label>
                <input type="text" inputMode="numeric" value={phone} onChange={e => handlePhone(e.target.value)} style={inputStyle} />
                <small style={{color:'#9ca3af'}}>{phone.length}/11</small>
              </div>

              <div style={sectionStyle}>
                <label style={labelStyle}>{strings.national_id_label} *</label>
                <input type="text" inputMode="numeric" value={nationalId} onChange={e => handleNationalId(e.target.value)} style={inputStyle} />
                <small style={{color:'#9ca3af'}}>{nationalId.length}/10</small>
              </div>

              <div style={sectionStyle}>
                <label style={labelStyle}>{strings.city_label} *</label>
                <select value={city} onChange={e => setCity(e.target.value)} style={inputStyle}>
                  {iranCities.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div style={sectionStyle}>
                <label style={labelStyle}>{strings.specialty_label}</label>
                <select value={specialty} onChange={e => setSpecialty(e.target.value)} style={inputStyle}>
                  {specialties.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>

              <div style={sectionStyle}>
                <label style={labelStyle}>{strings.experience_label}</label>
                <input type="text" value={experience} onChange={e => setExperience(e.target.value)} style={inputStyle} />
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
                { label: 'تصویر کارت ملی *', doc: docNationalId, setter: setDocNationalId, required: true },
                { label: 'تصویر مدرک تحصیلی یا فنی *', doc: docCertificate, setter: setDocCertificate, required: true },
                { label: 'تصویر گواهی عدم سوء پیشینه *', doc: docBackground, setter: setDocBackground, required: true },
                { label: 'پروانه کسب یا کارت مهارت فنی *', doc: docSkillCard, setter: setDocSkillCard, required: true },
                { label: 'مدرک تکمیلی (اختیاری)', doc: docExtra, setter: setDocExtra, required: false },
              ].map(({ label, doc, setter, required }) => (
                <div key={label} style={{marginBottom:'16px', border:'1px solid #e5e7eb', borderRadius:'10px', padding:'12px'}}>
                  <label style={{display:'block', fontWeight:'bold', fontSize:'14px', color: required ? '#1e3a8a' : '#6b7280', marginBottom:'8px'}}>
                    {label}
                  </label>
                  {doc.preview ? (
                    <div style={{position:'relative', marginBottom:'8px'}}>
                      <img src={doc.preview} alt={label} style={{width:'100%', maxHeight:'150px', objectFit:'cover', borderRadius:'6px', border:'1px solid #d1d5db'}} />
                      <span style={{position:'absolute', top:'4px', right:'4px', background:'#16a34a', color:'white', borderRadius:'50%', width:'20px', height:'20px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px'}}>✓</span>
                    </div>
                  ) : null}
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
              <div style={{background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:'10px', padding:'16px', marginBottom:'20px', maxHeight:'300px', overflowY:'auto', fontSize:'13px', lineHeight:'2', color:'#374151', whiteSpace:'pre-line', direction:'rtl'}}>
                {commitmentText}
              </div>

              <div style={{background:'#fef3c7', padding:'12px', borderRadius:'8px', marginBottom:'16px', fontSize:'13px', color:'#92400e'}}>
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
                      <title>تعهدنامه تامین ارتباط ویرا</title>
                      <style>
                        body { font-family: Tahoma, Arial, sans-serif; padding: 40px; line-height: 2.2; font-size: 14px; color: #111; }
                        h2 { text-align: center; margin-bottom: 32px; }
                        pre { white-space: pre-wrap; font-family: inherit; }
                        .sign { margin-top: 60px; border-top: 1px solid #999; padding-top: 20px; display: flex; justify-content: space-between; }
                        @media print { button { display: none; } }
                      </style>
                    </head>
                    <body>
                      <h2>تعهدنامه همکاری با پلتفرم تامین ارتباط ویرا</h2>
                      <pre>${commitmentText.replace('تعهدنامه همکاری با پلتفرم ویرا تامین ارتباط\n\n', '')}</pre>
                      <div class="sign">
                        <div>نام و امضای تکنسین: ................................</div>
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
                  <input
                    type="checkbox"
                    checked={commitmentAccepted}
                    onChange={e => setCommitmentAccepted(e.target.checked)}
                    style={{marginTop:'3px', width:'18px', height:'18px', cursor:'pointer'}}
                  />
                  <span style={{fontSize:'14px', color:'#374151', lineHeight:'1.6'}}>
                    متن تعهدنامه فوق را به‌طور کامل مطالعه کردم و تمامی مفاد آن را می‌پذیرم و خود را ملزم به اجرای آن می‌دانم.
                  </span>
                </label>
              </div>

              <div style={{marginBottom:'16px'}}>
                <label style={{...labelStyle, fontWeight:'bold', color:'#1e3a8a'}}>
                  امضای دیجیتال — نام کامل خود را دقیقاً وارد کنید *
                </label>
                <input
                  type="text"
                  value={signatureName}
                  onChange={e => setSignatureName(e.target.value)}
                  placeholder={fullName || 'نام و نام خانوادگی'}
                  style={{...inputStyle, fontFamily:'serif', fontSize:'16px', borderColor: signatureName && signatureName === fullName ? '#16a34a' : '#d1d5db'}}
                />
                {signatureName && signatureName !== fullName && (
                  <small style={{color:'#dc2626'}}>نام باید دقیقاً با «{fullName}» مطابقت داشته باشد</small>
                )}
                {signatureName && signatureName === fullName && (
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
              <button
                onClick={() => { setStep((step - 1) as 1|2|3); setError(''); }}
                style={{flex:1, background:'#f3f4f6', color:'#374151', padding:'12px', border:'1px solid #d1d5db', borderRadius:'10px', cursor:'pointer', fontWeight:'bold', fontSize:'15px'}}
              >
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
                style={{flex:1, background:'#1e3a8a', color:'white', padding:'12px', border:'none', borderRadius:'10px', cursor:'pointer', fontWeight:'bold', fontSize:'15px'}}
              >
                مرحله بعد ←
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{flex:1, background: submitting ? '#9ca3af' : '#16a34a', color:'white', padding:'12px', border:'none', borderRadius:'10px', cursor: submitting ? 'not-allowed' : 'pointer', fontWeight:'bold', fontSize:'15px'}}
              >
                {submitting ? 'در حال ارسال...' : '✓ ثبت نهایی'}
              </button>
            )}
          </div>

        </div>
      </div>
    </main>
  );
}

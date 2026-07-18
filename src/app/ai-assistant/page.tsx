'use client';

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Array<{role: 'user' | 'ai', text: string}>>([
    { role: 'ai', text: 'سلام! من ویرا هوشمند هستم 🤖 چطور می‌تونم کمکتون کنم؟ می‌تونید سوالات فنی، خرید تجهیزات یا هر چیز دیگه‌ای درباره خدمات ویرا بپرسید.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [userType, setUserType] = useState<'customer' | 'technician'>('customer');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    checkIfTechnician();
  }, []);

  async function checkIfTechnician() {
    const userRes = await supabase.auth.getUser();
    const user = userRes.data.user;
    if (!user) return;
    const techRes = await supabase.from('technicians').select('id').eq('user_id', user.id).maybeSingle();
    if (techRes.data) setUserType('technician');
  }

  async function handleSend() {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, userType }),
      });

      const data = await res.json();

      if (data.reply) {
        setMessages(prev => [...prev, { role: 'ai', text: data.reply }]);
      } else {
        setMessages(prev => [...prev, { role: 'ai', text: 'متاسفانه مشکلی پیش اومد. لطفاً دوباره امتحان کنید یا با پشتیبانی تماس بگیرید.' }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', text: 'خطا در ارتباط با سرور. لطفاً دوباره امتحان کنید.' }]);
    } finally {
      setLoading(false);
    }
  }

  const quickQuestions = [
    'چگونه فیبر نوری نصب کنم؟',
    'مشکل اینترنت من چیه، چطور عیب‌یابی کنم؟',
    'کدام مودم برای خانه بهتره؟',
    'خانه هوشمند چیه و چطور راه‌اندازی میشه؟',
    'سرعت اینترنتم کم شده، چیکار کنم؟',
    'چطور دوربین مداربسته نصب کنم؟'
  ];

  const categories = [
    { icon: '📡', title: 'اینترنت و فیبر', desc: 'سوالات درباره اتصال اینترنت', question: 'مشکل اتصال اینترنت و فیبر نوری دارم، راهنمایی کنید' },
    { icon: '🏠', title: 'خانه هوشمند', desc: 'خودکارسازی خانه', question: 'خانه هوشمند چیه و چطور راه‌اندازی میشه؟' },
    { icon: '🛍️', title: 'خرید تجهیزات', desc: 'مشاوره خرید', question: 'برای خرید تجهیزات شبکه چه چیزی پیشنهاد می‌کنید؟' },
    { icon: '🔧', title: 'عیب‌یابی', desc: 'رفع مشکلات فنی', question: 'چطور مشکل فنی سیستم خودم رو عیب‌یابی کنم؟' },
    { icon: '📚', title: 'آموزش', desc: 'آموزش فنی و مفاهیم', question: 'برای یادگیری مفاهیم فنی از کجا شروع کنم؟' },
    { icon: '💰', title: 'قیمت و پرداخت', desc: 'سوالات مالی', question: 'روش‌های پرداخت و قیمت‌گذاری چطوره؟' }
  ];

  return (
    <main style={{ minHeight: '100vh', background: '#f3f4f6', padding: '32px 16px' }} dir="rtl">
      
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        
        <Link href="/" style={{ color: '#1e3a8a', fontSize: '14px', textDecoration: 'none', marginBottom: '24px', display: 'inline-block' }}>
          ← بازگشت
        </Link>

        <div style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)', borderRadius: '16px', padding: '40px 24px', color: 'white', textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '40px', fontWeight: 'bold', marginBottom: '12px' }}>
            🤖 Vira AI
          </h1>
          <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.8)' }}>
            دستیار هوشمند برای پاسخ‌دهی 24/7 و حل مسائل شما
          </p>
          {userType === 'technician' && (
            <span style={{ display: 'inline-block', marginTop: '12px', background: 'rgba(255,255,255,0.2)', padding: '4px 12px', borderRadius: '20px', fontSize: '12px' }}>
              🔧 حالت تکنسین فعال است
            </span>
          )}
        </div>

        {/* چت اینترفیس */}
        <div style={{ background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', marginBottom: '32px' }}>
          
          <div style={{ background: '#f9fafb', borderRadius: '12px', padding: '20px', minHeight: '400px', maxHeight: '450px', overflowY: 'auto', marginBottom: '16px' }}>
            {messages.map((msg, idx) => (
              <div key={idx} style={{ marginBottom: '16px', display: 'flex', justifyContent: msg.role === 'user' ? 'flex-start' : 'flex-end' }}>
                <div style={{
                  background: msg.role === 'user' ? '#e5e7eb' : '#1e3a8a',
                  color: msg.role === 'user' ? '#1f2937' : 'white',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  maxWidth: '75%',
                  fontSize: '14px',
                  lineHeight: '1.7',
                  whiteSpace: 'pre-wrap'
                }}>
                  {msg.text}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ background: '#1e3a8a', color: 'white', borderRadius: '12px', padding: '12px 16px', fontSize: '14px' }}>
                  در حال تایپ...
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* ورودی */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !loading && handleSend()}
              placeholder="سوال خود را بپرسید..."
              disabled={loading}
              style={{
                flex: 1,
                padding: '12px 16px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px',
                fontFamily: 'inherit'
              }}
            />
            <button
              onClick={handleSend}
              disabled={loading}
              style={{
                background: loading ? '#9ca3af' : '#1e3a8a',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '12px 20px',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: loading ? 'default' : 'pointer'
              }}
            >
              {loading ? '...' : 'ارسال'}
            </button>
          </div>

        </div>

        {/* سوالات سریع */}
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e3a8a', marginBottom: '16px' }}>
            سوالات پرتکرار:
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            {quickQuestions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => setInput(q)}
                style={{
                  background: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '12px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  textAlign: 'right',
                  color: '#374151'
                }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* دسته‌بندی */}
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e3a8a', marginBottom: '16px' }}>
            دسته‌بندی‌های موضوعی:
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            {categories.map((cat, idx) => (
              <div
                key={idx}
                onClick={() => setInput(cat.question)}
                style={{ background: 'white', borderRadius: '12px', padding: '20px', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', cursor: 'pointer' }}
              >
                <p style={{ fontSize: '32px', marginBottom: '8px' }}>{cat.icon}</p>
                <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e3a8a', marginBottom: '8px' }}>
                  {cat.title}
                </h3>
                <p style={{ fontSize: '13px', color: '#6b7280' }}>
                  {cat.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* اطلاعات */}
        <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '12px', padding: '16px', marginTop: '32px', textAlign: 'center' }}>
          <p style={{ fontSize: '14px', color: '#92400e' }}>
            💡 <strong>نکته:</strong> این دستیار هوشمند برای پاسخ‌دهی فوری و راهنمایی شما آماده است. برای مسائل پیچیده لطفاً با تیم پشتیبانی تماس بگیرید.
          </p>
        </div>

      </div>

    </main>
  );
}

'use client';

import Link from "next/link";
import { useState } from "react";

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Array<{role: 'user' | 'ai', text: string}>>([
    { role: 'ai', text: 'سلام! من دستیار هوشمند ویرا هستم. چطور می‌تونم کمکتون کنم؟' }
  ]);
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (input.trim()) {
      setMessages([...messages, { role: 'user', text: input }]);
      // شبیه‌سازی جواب AI
      setTimeout(() => {
        setMessages(prev => [...prev, { role: 'ai', text: 'جواب شما درحال پردازش است...' }]);
      }, 500);
      setInput('');
    }
  };

  const quickQuestions = [
    'چگونه فیبر نوری نصب کنم؟',
    'مشکل اینترنت چطور حل کنم؟',
    'کدام تجهیزات بهتر است؟',
    'خانه هوشمند چیه؟',
    'سرعت اینترنتم کم است',
    'دوربین مداربسته کجا بخریم؟'
  ];

  const categories = [
    { icon: '📡', title: 'اینترنت و فیبر', desc: 'سوالات درباره اتصال اینترنت' },
    { icon: '🏠', title: 'خانه هوشمند', desc: 'خودکارسازی خانه' },
    { icon: '🛍️', title: 'خرید تجهیزات', desc: 'مشاوره خرید' },
    { icon: '🔧', title: 'عیب‌یابی', desc: 'رفع مشکلات فنی' },
    { icon: '📚', title: 'آموزش', desc: 'آموزش فنی و مفاهیم' },
    { icon: '💰', title: 'قیمت و پرداخت', desc: 'سوالات مالی' }
  ];

  return (
    <main style={{ minHeight: '100vh', background: '#f3f4f6', padding: '32px 16px' }} dir="rtl">
      
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        
        <Link href="/" style={{ color: '#1e3a8a', fontSize: '14px', textDecoration: 'none', marginBottom: '24px', display: 'inline-block' }}>
          ← بازگشت
        </Link>

        {/* هدر */}
        <div style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)', borderRadius: '16px', padding: '40px 24px', color: 'white', textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '40px', fontWeight: 'bold', marginBottom: '12px' }}>
            🤖 Vira AI
          </h1>
          <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.8)' }}>
            دستیار هوشمند برای پاسخ‌دهی 24/7 و حل مسائل شما
          </p>
        </div>

        {/* چت اینترفیس */}
        <div style={{ background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', marginBottom: '32px' }}>
          
          <div style={{ background: '#f9fafb', borderRadius: '12px', padding: '20px', minHeight: '400px', maxHeight: '400px', overflowY: 'auto', marginBottom: '16px' }}>
            {messages.map((msg, idx) => (
              <div key={idx} style={{ marginBottom: '16px', display: 'flex', justifyContent: msg.role === 'user' ? 'flex-start' : 'flex-end' }}>
                <div style={{
                  background: msg.role === 'user' ? '#e5e7eb' : '#1e3a8a',
                  color: msg.role === 'user' ? '#1f2937' : 'white',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  maxWidth: '70%',
                  fontSize: '14px',
                  lineHeight: '1.5'
                }}>
                  {msg.text}
                </div>
              </div>
            ))}
          </div>

          {/* ورودی */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="سوال خود را بپرسید..."
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
              style={{
                background: '#1e3a8a',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '12px 20px',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              ارسال
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
              <div key={idx} style={{ background: 'white', borderRadius: '12px', padding: '20px', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
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

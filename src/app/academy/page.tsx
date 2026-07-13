'use client';

import Link from "next/link";
import { useState } from "react";

export default function AcademyPage() {
  const [activeTab, setActiveTab] = useState('courses');

  const sections = [
    {
      id: 'courses',
      title: '📚 آموزش',
      icon: '📚',
      items: ['دوره ها', 'ویدئو', 'PDF', 'آزمون', 'گواهینامه', 'پرسش و پاسخ', 'دانلود فایل', 'VIP دوره های']
    },
    {
      id: 'categories',
      title: '🏷️ دسته‌بندی‌ها',
      icon: '🏷️',
      items: ['FTTH', 'GPON', 'OLT', 'ONT', 'Fusion', 'OTDR', 'Cisco', 'Mikrotik', 'CCTV', 'Smart Home', 'Network', 'Electric']
    },
    {
      id: 'tv',
      title: '📺 Vira TV',
      icon: '📺',
      items: ['فیلم آموزشی', 'پخش زنده', 'وبینار', 'آرشیو', 'معرفی تجهیزات', 'کنفرانس', 'مصاحبه']
    },
    {
      id: 'knowledge',
      title: '📖 Knowledge Base',
      icon: '📖',
      items: ['مقالات', 'اخبار', 'بررسی محصولات', 'مقایسه تجهیزات', 'راهنمای نصب', 'راهنمای عیب یابی']
    },
    {
      id: 'community',
      title: '👥 Community',
      icon: '👥',
      items: ['انجمن کاربران', 'پرسش و پاسخ', 'اشتراک تجربه', 'بحث های تخصصی']
    }
  ];

  return (
    <main style={{ minHeight: '100vh', background: '#f3f4f6', padding: '32px 16px' }} dir="rtl">
      
      {/* هدر */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', marginBottom: '48px' }}>
        <Link href="/" style={{ color: '#1e3a8a', fontSize: '14px', textDecoration: 'none', marginBottom: '24px', display: 'inline-block' }}>
          ← بازگشت به صفحه اول
        </Link>

        <div style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)', borderRadius: '16px', padding: '48px 24px', color: 'white', textAlign: 'center', marginBottom: '40px' }}>
          <h1 style={{ fontSize: '48px', fontWeight: 'bold', marginBottom: '16px' }}>
            🎓 آکادمی ویرا
          </h1>
          <p style={{ fontSize: '18px', color: 'rgba(255,255,255,0.8)' }}>
            مرجع جامع آموزش فناوری ارتباطات، تجهیزات و خدمات ایران
          </p>
        </div>
      </div>

      {/* تب‌ها */}
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        <div style={{ display: 'flex', gap: '12px', marginBottom: '32px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveTab(section.id)}
              style={{
                padding: '12px 20px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer',
                background: activeTab === section.id ? '#1e3a8a' : '#e5e7eb',
                color: activeTab === section.id ? 'white' : '#374151',
                transition: 'all 0.3s'
              }}
            >
              {section.title}
            </button>
          ))}
        </div>

        {/* محتوای تب فعال */}
        {sections.map((section) => (
          activeTab === section.id && (
            <div key={section.id} style={{ background: 'white', borderRadius: '16px', padding: '40px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
              
              <h2 style={{ fontSize: '28px', fontWeight: 'bold', color: '#1e3a8a', marginBottom: '32px', textAlign: 'center' }}>
                {section.title}
              </h2>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px'
              }}>
                {section.items.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: '#f9fafb',
                      borderRadius: '12px',
                      padding: '20px',
                      textAlign: 'center',
                      border: '1px solid #e5e7eb',
                      cursor: 'pointer',
                      transition: 'all 0.3s',
                    
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f0f9ff';
                      e.currentTarget.style.borderColor = '#1e3a8a';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#f9fafb';
                      e.currentTarget.style.borderColor = '#e5e7eb';
                    }}
                  >
                    <p style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e3a8a' }}>
                      {item}
                    </p>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: '40px', textAlign: 'center' }}>
                <button
                  style={{
                    background: '#1e3a8a',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 32px',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  مشاهده تمام {section.title.replace(/[^\u0600-\u06FF]/g, '').trim()}
                </button>
              </div>

            </div>
          )
        ))}

      </div>

      {/* بخش إحصائیات */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', marginTop: '64px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '20px'
        }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '24px', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
            <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#1e3a8a' }}>500+</p>
            <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '8px' }}>دوره و آموزش</p>
          </div>
          <div style={{ background: 'white', borderRadius: '12px', padding: '24px', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
            <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#16a34a' }}>1000+</p>
            <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '8px' }}>ویدئو آموزشی</p>
          </div>
          <div style={{ background: 'white', borderRadius: '12px', padding: '24px', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
            <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#0284c7' }}>50000+</p>
            <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '8px' }}>دانشجوی فعال</p>
          </div>
          <div style={{ background: 'white', borderRadius: '12px', padding: '24px', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
            <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#8b5cf6' }}>12+</p>
            <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '8px' }}>دسته‌بندی تخصصی</p>
          </div>
        </div>
      </div>

    </main>
  );
}

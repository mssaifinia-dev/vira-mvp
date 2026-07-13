import Link from "next/link";
import { supabase } from "@/lib/supabase";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Alignment = 'right' | 'left' | 'center' | 'full';

type Advertisement = {
  id: string;
  title: string;
  image_url: string;
  link_url: string;
  position: string;
  active: boolean;
  sort_order: number;
  alignment: Alignment;
};

function renderAd(ad: Advertisement) {
  return (
    <a
      href={ad.link_url || "#"}
      style={{
        display: "block",
        background: "white",
        borderRadius: "16px",
        overflow: "hidden",
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
      }}
    >
      {ad.image_url ? (
        <img
          src={ad.image_url}
          alt={ad.title}
          style={{
            width: "100%",
            height: "250px",
            objectFit: "contain",
            background: "#f9fafb",
          }}
        />
      ) : (
        <div style={{
          padding: "25px",
          textAlign: "center",
          fontWeight: "bold",
          color: "#1e3a8a",
          fontSize: "18px",
        }}>
          {ad.title}
        </div>
      )}
    </a>
  );
}

function renderAdRows(ads: Advertisement[]) {
  const rows: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < ads.length) {
    const current = ads[i];

    if (current.alignment === 'right' || current.alignment === 'left') {
      const next = ads[i + 1];
      const pairs =
        next && (next.alignment === 'right' || next.alignment === 'left') && next.alignment !== current.alignment
          ? [current, next]
          : [current];

      pairs.sort((a, b) => (a.alignment === 'right' ? -1 : 1));

      const isSolo = pairs.length === 1;
      const soloAlignment = isSolo ? pairs[0].alignment : null;

      rows.push(
        <div
          key={key++}
          style={{
            display: 'flex',
            gap: '20px',
            flexWrap: 'wrap',
            marginBottom: '20px',
            justifyContent: isSolo
              ? soloAlignment === 'right' ? 'flex-start' : 'flex-end'
              : 'space-between',
            width: '100%',
          }}
        >
          {pairs.map((ad) => (
            <div key={ad.id} style={isSolo ? { flex: '0 1 46%', minWidth: '250px' } : { flex: '1 1 280px', minWidth: '250px' }}>
              {renderAd(ad)}
            </div>
          ))}
        </div>
      );
      i += pairs.length;
    } else if (current.alignment === 'center') {
      rows.push(
        <div key={key++} style={{ maxWidth: '500px', margin: '0 auto 20px auto' }}>
          {renderAd(current)}
        </div>
      );
      i += 1;
    } else {
      rows.push(
        <div key={key++} style={{ marginBottom: '20px' }}>
          {renderAd(current)}
        </div>
      );
      i += 1;
    }
  }

  return rows;
}

export default async function Home() {

  const { data: advertisements } = await supabase
    .from("advertisements")
    .select("*")
    .eq("active", true)
    .eq("position", "home_top")
    .order("sort_order", { ascending: true });


  return (
    <main className="min-h-screen bg-gray-100" dir="rtl">

      <section style={{
        background: "linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)",
        position:"relative",
        overflow:"hidden",
        padding:"64px 24px"
      }}>

        <svg width="100%" height="100%" viewBox="0 0 700 340"
          style={{
            position:"absolute",
            top:0,
            left:0,
            opacity:0.5
          }}
          aria-hidden="true">

          <line x1="0" y1="55" x2="700" y2="35"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="1.5" />

          <line x1="0" y1="95" x2="700" y2="85"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="1" />

          <circle cx="110" cy="60" r="3"
            fill="rgba(255,255,255,0.5)" />

          <circle cx="470" cy="45" r="3"
            fill="rgba(255,255,255,0.5)" />

        </svg>

        <div style={{
          position:"absolute",
          right:"24px",
          top:"24px",
          display:"flex",
          flexDirection:"column",
          gap:"16px",
          fontSize:"26px",
          opacity:0.5
        }}>

          <span>💻</span>
          <span>📡</span>
          <span>🧠</span>

        </div>

        <div style={{
          position:"relative",
          zIndex:2,
          textAlign:"center"
        }}>

          <div style={{
            width:"200px",
            height:"200px",
            background:"rgba(255,255,255,0.12)",
            borderRadius:"50%",
            display:"flex",
            alignItems:"center",
            justifyContent:"center",
            margin:"0 auto 18px"
          }}>

            <img
              src="/icons/navbar-logo.png"
              alt="ویرا"
              style={{width:"150px", height:"150px", objectFit:"contain"}}
            />

          </div>

          <h1 style={{
            color:"white",
            fontSize:"60px",
            fontWeight:"bold"
          }}>
            تامین ارتباط ویرا
          </h1>

          <p style={{
            color:"rgba(255,255,255,0.85)",
            fontSize:"20px",
            marginTop:"12px",
            fontWeight:"600"
          }}>
            ویرا؛ مرجع هوشمند ارتباطات، آموزش، تجهیزات و خدمات فناوری ایران
          </p>

          <p style={{
            color:"rgba(255,255,255,0.7)",
            fontSize:"16px",
            marginTop:"8px"
          }}>
            فیبر نوری، خودرو، خانه هوشمند و خدمات فنی
          </p>

        </div>

      </section>

      {advertisements && advertisements.length > 0 && (
        <section style={{ width: '100%', padding: '40px 24px 0 24px', boxSizing: 'border-box' }}>
          {renderAdRows(advertisements as Advertisement[])}
        </section>
      )}

      <section className="max-w-7xl mx-auto px-4 py-16">

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "24px"
        }}>

          <div className="bg-white rounded-2xl shadow-lg p-6 text-center">
            <h2 className="text-2xl font-bold text-blue-900">🛍️ فروشگاه</h2>
            <p className="mt-4 text-gray-600">مودم فیبر نوری، پچ کورد، پیگتیل، تجهیزات شبکه، دوربین و خانه هوشمند</p>
            <Link href="/marketplace" className="inline-block mt-5 bg-blue-900 text-white px-6 py-2 rounded-lg">
              ورود به فروشگاه
            </Link>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 text-center">
            <h2 className="text-2xl font-bold text-blue-900">🔧 تکنسین</h2>
            <p className="mt-4 text-gray-600">ثبت خرابی اینترنت، شبکه، برق و خانه هوشمند و اعزام تکنسین</p>
            <Link href="/technician" className="inline-block mt-5 bg-blue-900 text-white px-6 py-2 rounded-lg">
              ثبت درخواست
            </Link>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 text-center">
            <h2 className="text-2xl font-bold text-blue-900">👥 فروشندگان</h2>
            <p className="mt-4 text-gray-600">فروش تجهیزات نو و استوک توسط همکاران سراسر کشور</p>
            <Link href="/seller/register" className="inline-block mt-5 bg-blue-900 text-white px-6 py-2 rounded-lg">
              مشاهده فروشندگان
            </Link>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 text-center">
            <h2 className="text-2xl font-bold text-blue-900">📚 آکادمی ویرا</h2>
            <p className="mt-4 text-gray-600">آموزش‌های آنلاین، وبینارها و دوره‌های تخصصی درباره فناوری</p>
            <Link href="/academy" className="inline-block mt-5 bg-blue-900 text-white px-6 py-2 rounded-lg">
              بازدید آکادمی
            </Link>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 text-center">
            <h2 className="text-2xl font-bold text-blue-900">🤖 Vira AI</h2>
            <p className="mt-4 text-gray-600">دستیار هوشمند برای پاسخ‌دهی 24/7 و حل مسائل فوری</p>
            <Link href="/ai-assistant" className="inline-block mt-5 bg-blue-900 text-white px-6 py-2 rounded-lg">
              چت با AI
            </Link>
          </div>

        </div>

      </section>

    </main>
  );
}
